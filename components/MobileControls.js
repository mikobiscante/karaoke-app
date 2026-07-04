// components/MobileControls.js
import React, { useEffect, useState } from "react";
import { ref, push, set, onValue } from "firebase/database";
import { db } from "../utils/firebase";

export default function MobileControls({ roomId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [preview, setPreview] = useState(null);
  const [queue, setQueue] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const qRef = ref(db, `rooms/${roomId}/queue`);
    const unsub = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      setQueue(Object.values(data));
    });
    return () => unsub();
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
    // set currentSong immediately
    await set(ref(db, `rooms/${roomId}/currentSong`), videoId);
    // also push to queue for record
    await push(ref(db, `rooms/${roomId}/queue`), videoId);
  };

  const handleQueue = async (videoId) => {
    if (!roomId) return;
    await push(ref(db, `rooms/${roomId}/queue`), videoId);
    // if no currentSong, set it
    onValue(ref(db, `rooms/${roomId}/currentSong`), async (snap) => {
      if (!snap.exists()) {
        await set(ref(db, `rooms/${roomId}/currentSong`), videoId);
      }
    }, { onlyOnce: true });
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-indigo-900 via-purple-800 to-pink-700 text-white">
      <div className="max-w-md mx-auto bg-white/5 p-6 rounded-2xl shadow-xl">
        <h2 className="text-2xl font-bold mb-3">Join Room: <span className="font-mono">{roomId}</span></h2>

        <div className="mb-4">
          <label className="block text-sm mb-2">Search Karaoke (YouTube)</label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") search(query); }}
              placeholder="Search song title or artist"
              className="flex-1 px-3 py-2 rounded-lg text-black"
            />
            <button
              onClick={() => search(query)}
              className="bg-pink-500 hover:bg-pink-600 px-4 py-2 rounded-lg font-semibold"
            >
              {loadingSearch ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Results</h3>
            <ul className="space-y-3 max-h-64 overflow-auto">
              {results.map((r) => (
                <li key={r.videoId} className="flex items-center gap-3 bg-white/10 p-2 rounded">
                  <img src={r.thumbnail} alt="" className="w-24 h-14 object-cover rounded" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{r.title}</div>
                    <div className="text-xs opacity-80">{r.channelTitle}</div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => handlePlayNow(r.videoId)} className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-xs">Play Now</button>
                    <button onClick={() => handleQueue(r.videoId)} className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-xs">Queue</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
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
