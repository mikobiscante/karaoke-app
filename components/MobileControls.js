// components/MobileControls.js
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { ref, push, set, onValue, remove, get } from "firebase/database";
import { db } from "../utils/firebase";
import { FaPlay, FaPause, FaStepForward, FaListUl, FaSearch } from "react-icons/fa";

export default function MobileControls({ roomId }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [playState, setPlayState] = useState("paused");
  const [loadingSearch, setLoadingSearch] = useState(false);

  const idleTimerRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const qRef = ref(db, `rooms/${roomId}/queue`);
    const curRef = ref(db, `rooms/${roomId}/currentSong`);
    const pRef = ref(db, `rooms/${roomId}/playState`);

    const unsubQ = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([key, value]) => ({ key, ...value }));
      // sort by addedAt if present
      arr.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      setQueue(arr);
    });

    const unsubCur = onValue(curRef, (snap) => setCurrentSong(snap.val() || null));
    const unsubP = onValue(pRef, (snap) => setPlayState(snap.val() || "paused"));

    return () => { unsubQ(); unsubCur(); unsubP(); };
  }, [roomId]);

  // Idle redirect: if mobile is idle for 1 hour and nothing is playing, redirect to main page
  useEffect(() => {
    if (!roomId) return;

    const IDLE_MS = 60 * 60 * 1000; // 1 hour
    let timeoutId = null;

    const clearExisting = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const resetTimer = () => {
      clearExisting();
      // do not start idle timer while music is playing
      if (playState === "playing") return;
      timeoutId = setTimeout(() => {
        // redirect to main page when idle timeout fires
        try {
          router.push("/");
        } catch (err) {
          console.warn("Idle redirect failed:", err);
        }
      }, IDLE_MS);
    };

    const activityEvents = ["touchstart", "click", "scroll", "keydown"];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const onVisibility = () => {
      if (!document.hidden) resetTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // start timer initially (only if not playing)
    resetTimer();

    return () => {
      clearExisting();
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roomId, playState, router]);

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

  // Mobile: request a no-score skip (host will listen and run authoritative skip)
  const requestSkipNoScore = async () => {
    if (!roomId) return;
    await set(ref(db, `rooms/${roomId}/skipRequestNoScore`), { requestedAt: Date.now() });
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-indigo-950 via-purple-900 to-pink-800 text-white">
      <div className="max-w-md lg:max-w-lg mx-auto bg-white/6 backdrop-blur p-4 rounded-2xl shadow-xl">
        <h2 className="text-xl lg:text-2xl font-bold mb-3 text-center">Karaoke SingGing</h2>

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
              className="bg-pink-500 hover:bg-pink-400 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg flex items-center gap-1 sm:gap-2 transition text-xs sm:text-sm shrink-0"
            >
              <FaSearch /> {loadingSearch ? "..." : <span className="hidden sm:inline">Search</span>}
            </button>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="mb-4 bg-white/5 p-3 rounded-lg max-h-64 overflow-y-auto overflow-x-hidden">
            {results.map((r) => (
              <div key={r.videoId} className="flex items-center gap-2 p-2 rounded hover:bg-white/8 transition">
                <img src={r.thumbnail} alt="" className="w-16 sm:w-20 h-10 sm:h-12 rounded object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm line-clamp-2 break-words">{r.title}</div>
                  <div className="text-xs opacity-80 truncate">{r.channelTitle}</div>
                </div>

                {currentSong ? (
                  <button
                    onClick={() => handleQueue({ videoId: r.videoId, title: r.title, thumbnail: r.thumbnail })}
                    className="bg-blue-500 hover:bg-blue-600 px-2 sm:px-3 py-1.5 rounded text-xs flex items-center gap-1 shrink-0"
                  >
                    <FaListUl /> <span className="hidden sm:inline">Queue</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlayNow({ videoId: r.videoId, title: r.title, thumbnail: r.thumbnail })}
                    className="bg-green-500 hover:bg-green-600 px-2 sm:px-3 py-1.5 rounded text-xs flex items-center gap-1 shrink-0"
                  >
                    <FaPlay /> <span className="hidden sm:inline">Play</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Current Song Controls */}
        <div className="mb-4 bg-white/5 p-3 rounded-lg">
              <div className="flex items-center justify-between mb-3 gap-3">
            <div className="min-w-0">
              <div className="text-sm text-gray-200">Now Playing</div>
              <div className="font-medium truncate">{currentSong ? currentSong.title : "No song playing"}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                    onClick={requestSkipNoScore}
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

      <div className="mt-4 w-full bg-white/6 p-3 rounded-xl text-center text-gray-300" style={{fontSize: 14}}>
        <div className="mb-1">Buy me a coffee via GCash!</div>
        <div className="font-bold tracking-wider text-pink-200">09260560147</div>
      </div>
    </div>
  );
}
