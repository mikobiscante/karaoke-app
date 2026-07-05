// components/MobileControls.js
import React, { useEffect, useState } from "react";
import { ref, push, set, onValue, remove, get } from "firebase/database";
import { db } from "../utils/firebase";
import { FaPlay, FaPause, FaStepForward, FaListUl, FaSearch } from "react-icons/fa";

export default function MobileControls({ roomId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [playState, setPlayState] = useState("paused");
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const qRef = ref(db, `rooms/${roomId}/queue`);
    const curRef = ref(db, `rooms/${roomId}/currentSong`);
    const pRef = ref(db, `rooms/${roomId}/playState`);

    const unsubQ = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([key, value]) => ({ key, ...value }));
      setQueue(arr);
    });

    const unsubCur = onValue(curRef, (snap) => setCurrentSong(snap.val() || null));
    const unsubP = onValue(pRef, (snap) => setPlayState(snap.val() || "paused"));

    return () => { unsubQ(); unsubCur(); unsubP(); };
  }, [roomId]);

  const search = async (q) => {
    if (!q) return;
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.items || []);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleQueue = async (item) => {
    if (!roomId) return;
    await push(ref(db, `rooms/${roomId}/queue`), {
      videoId: item.videoId,
      title: item.title,
      thumbnail: item.thumbnail,
      addedAt: Date.now()
    });
  };

  const handlePlayNow = async (item) => {
    if (!roomId) return;
    await set(ref(db, `rooms/${roomId}/currentSong`), {
      videoId: item.videoId,
      title: item.title,
      thumbnail: item.thumbnail
    });
    await push(ref(db, `rooms/${roomId}/queue`), {
      videoId: item.videoId,
      title: item.title,
      thumbnail: item.thumbnail,
      addedAt: Date.now()
    });
    await set(ref(db, `rooms/${roomId}/playState`), "playing");
  };

  const handlePausePlay = async () => {
    if (!roomId) return;
    const newState = playState === "playing" ? "paused" : "playing";
    await set(ref(db, `rooms/${roomId}/playState`), newState);
  };

  const handleSkip = async () => {
    if (!roomId) return;
    const qRef = ref(db, `rooms/${roomId}/queue`);
    const snap = await get(qRef);
    const data = snap.val() || {};
    const keys = Object.keys(data);
    if (keys.length === 0) {
      await set(ref(db, `rooms/${roomId}/currentSong`), null);
      await set(ref(db, `rooms/${roomId}/playState`), "paused");
      return;
    }
    const firstKey = keys[0];
    const next = data[keys[1]] || null;
    await remove(ref(db, `rooms/${roomId}/queue/${firstKey}`));
    await set(ref(db, `rooms/${roomId}/currentSong`), next || null);
    if (next) await set(ref(db, `rooms/${roomId}/playState`), "playing");
  };

  return (
    <div className="min-h-screen p-4 bg-gradient-to-b from-indigo-950 via-purple-900 to-pink-800 text-white">
      <div className="max-w-md mx-auto bg-white/6 backdrop-blur p-4 rounded-2xl shadow-xl">
        <h2 className="text-xl font-bold mb-3 text-center">Karaoke SingGing</h2>

        {/* Search */}
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") search(query); }}
              placeholder="Search YouTube karaoke..."
              className="flex-1 px-3 py-2 rounded-lg text-black"
            />
            <button
              onClick={() => search(query)}
              className="bg-pink-500 hover:bg-pink-400 px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <FaSearch /> {loadingSearch ? "..." : "Search"}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="mb-4 bg-white/5 p-3 rounded-lg max-h-64 overflow-auto">
            {results.map((r) => (
              <div key={r.videoId} className="flex items-center gap-3 p-2 rounded hover:bg-white/8 transition">
                <img src={r.thumbnail} alt="" className="w-20 h-12 rounded object-cover" />
                <div className="flex-1">
                  <div className="font-medium text-sm line-clamp-2">{r.title}</div>
                  <div className="text-xs opacity-80">{r.channelTitle}</div>
                </div>

                {currentSong ? (
                  <button
                    onClick={() => handleQueue({ videoId: r.videoId, title: r.title, thumbnail: r.thumbnail })}
                    className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-xs flex items-center gap-1"
                  >
                    <FaListUl /> Queue
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlayNow({ videoId: r.videoId, title: r.title, thumbnail: r.thumbnail })}
                    className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-xs flex items-center gap-1"
                  >
                    <FaPlay /> Play
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Current Song Controls */}
        <div className="mb-4 bg-white/5 p-3 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-gray-200">Now Playing</div>
              <div className="font-medium">{currentSong ? currentSong.title : "No song playing"}</div>
            </div>
            <div className="flex items-center gap-2">
              {currentSong && (
                <>
                  <button
                    onClick={handlePausePlay}
                    className="bg-yellow-500 hover:bg-yellow-600 p-3 rounded-full text-black"
                    aria-label="Pause/Play"
                  >
                    {playState === "playing" ? <FaPause /> : <FaPlay />}
                  </button>
                  <button
                    onClick={handleSkip}
                    className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-full text-white"
                    aria-label="Skip"
                  >
                    <FaStepForward />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Queue list */}
          <div>
            <div className="text-sm text-gray-300 mb-2">Queue</div>
            {queue.length === 0 ? (
              <div className="text-xs text-gray-400">No songs queued yet.</div>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-auto">
                {queue.map((v) => (
                  <li key={v.key} className="flex items-center gap-3 bg-white/6 p-2 rounded">
                    <img src={v.thumbnail} alt="" className="w-16 h-10 rounded object-cover" />
                    <div className="flex-1 text-sm line-clamp-2">{v.title}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
