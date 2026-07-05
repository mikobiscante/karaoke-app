// components/MobileControls.js
import React, { useEffect, useState } from "react";
import { ref, push, set, onValue, remove } from "firebase/database";
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
      setQueue(Object.values(data));
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

  const handlePlayNow = async (videoId) => {
    if (!roomId) return;
    await set(ref(db, `rooms/${roomId}/currentSong`), videoId);
    await push(ref(db, `rooms/${roomId}/queue`), videoId);
    await set(ref(db, `rooms/${roomId}/playState`), "playing");
  };

  const handleQueue = async (videoId) => {
    if (!roomId) return;
    await push(ref(db, `rooms/${roomId}/queue`), videoId);
  };

  const handlePausePlay = async () => {
    if (!roomId) return;
    const newState = playState === "playing" ? "paused" : "playing";
    await set(ref(db, `rooms/${roomId}/playState`), newState);
  };

  const handleSkip = async () => {
    if (!roomId) return;
    const qRef = ref(db, `rooms/${roomId}/queue`);
    const snap = await onValue(qRef);
    const data = snap.val() || {};
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    const firstKey = keys[0];
    const next = data[keys[1]] || null;
    await remove(ref(db, `rooms/${roomId}/queue/${firstKey}`));
    await set(ref(db, `rooms/${roomId}/currentSong`), next || null);
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-indigo-950 via-purple-900 to-pink-800 text-white">
      <div className="max-w-md mx-auto bg-white/10 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-white/20">
        <h2 className="text-2xl font-bold mb-4 text-center">🎤 Room <span className="font-mono">{roomId}</span></h2>

        {/* Search Panel */}
        <div className="mb-6 bg-black/30 p-4 rounded-xl shadow-inner">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") search(query); }}
              placeholder="Search karaoke song..."
              className="flex-1 px-3 py-2 rounded-lg text-black"
            />
            <button
              onClick={() => search(query)}
              className="bg-pink-500 hover:bg-pink-600 px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
            >
              <FaSearch /> {loadingSearch ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="mb-6 bg-white/5 p-4 rounded-xl shadow-inner">
            <h3 className="font-semibold mb-2">Results</h3>
            <ul className="space-y-3 max-h-64 overflow-auto">
              {results.map((r) => (
                <li key={r.videoId} className="flex items-center gap-3 bg-white/10 p-2 rounded-lg">
                  <img src={r.thumbnail} alt="" className="w-24 h-14 object-cover rounded" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{r.title}</div>
                    <div className="text-xs opacity-80">{r.channelTitle}</div>
                  </div>
                  {currentSong ? (
                    <button onClick={() => handleQueue(r.videoId)} className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-xs flex items-center gap-1">
                      <FaListUl /> Queue
                    </button>
                  ) : (
                    <button onClick={() => handlePlayNow(r.videoId)} className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-xs flex items-center gap-1">
                      <FaPlay /> Play
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Current Song Controls */}
        {currentSong && (
          <div className="bg-black/40 p-4 rounded-xl shadow-lg flex flex-col items-center gap-4">
            <img src={`https://img.youtube.com/vi/${currentSong}/mqdefault.jpg`} alt="" className="w-64 h-36 rounded-lg shadow-md" />
            <div className="flex gap-4">
              <button onClick={handlePausePlay} className="bg-yellow-500 hover:bg-yellow-600 p-3 rounded-full text-xl shadow-lg">
                {playState === "playing" ? <FaPause /> : <FaPlay />}
              </button>
              <button onClick={handleSkip} className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-full text-xl shadow-lg">
                <FaStepForward />
              </button>
            </div>
          </div>
        )}

        {/* Queue Panel */}
        <div className="mt-6 bg-white/5 p-4 rounded-xl shadow-inner">
          <h3 className="font-semibold mb-2">Queued Songs</h3>
          {queue.length === 0 ? (
            <div className="text-sm text-gray-200">No songs queued yet.</div>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-auto">
              {queue.map((v, i) => (
                <li key={i} className="flex items-center gap-3 bg-white/10 p-2 rounded">
                  <img src={`https://img.youtube.com/vi/${v}/mqdefault.jpg`} alt="" className="w-20 h-12 rounded" />
                  <div className="text-sm">Video ID: {v}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
