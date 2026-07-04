// components/MobileControls.js
import { useEffect, useState } from "react";
import { ref, push, set, onValue } from "firebase/database";
import { db } from "../firebase";

export default function MobileControls({ roomId, clientId }) {
  const [input, setInput] = useState("");
  const [previewId, setPreviewId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [queue, setQueue] = useState([]);

  const extractVideoId = (urlOrId) => {
    try {
      if (!urlOrId) return null;
      if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
      const u = new URL(urlOrId);
      if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
      if (u.hostname === "youtu.be") return u.pathname.slice(1);
    } catch (e) {
      if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
    }
    return null;
  };

  useEffect(() => {
    setPreviewId(extractVideoId(input));
  }, [input]);

  useEffect(() => {
    if (!roomId) return;
    const qRef = ref(db, `rooms/${roomId}/queue`);
    const unsub = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      setQueue(Object.values(data));
    });
    return () => unsub();
  }, [roomId]);

  const addToQueue = async () => {
    if (!roomId) return;
    const vid = extractVideoId(input);
    if (!vid) return alert("Enter a valid YouTube URL or ID (11 chars).");
    setAdding(true);
    await push(ref(db, `rooms/${roomId}/queue`), vid);

    // If no currentSong, set it immediately
    const curRef = ref(db, `rooms/${roomId}/currentSong`);
    onValue(curRef, async (snap) => {
      if (!snap.exists()) {
        await set(curRef, vid);
      }
    }, { onlyOnce: true });

    setInput("");
    setAdding(false);
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-b from-indigo-900 via-purple-800 to-pink-700 text-white">
      <div className="max-w-md mx-auto bg-white/5 p-6 rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold mb-4">Join Room: {roomId}</h2>
        <p className="mb-4">Paste a YouTube link or ID to queue a song. You can queue multiple songs.</p>

        <div className="space-y-3">
          <input value={input} onChange={(e)=>setInput(e.target.value)} placeholder="YouTube URL or ID" className="w-full px-3 py-2 rounded-lg text-black" />
          {previewId && (
            <div className="flex items-center gap-3 bg-white/10 p-3 rounded">
              <img src={`https://img.youtube.com/vi/${previewId}/mqdefault.jpg`} alt="thumb" className="w-28 h-16 rounded" />
              <div>
                <div className="font-semibold">Preview</div>
                <div className="text-sm opacity-80">Video ID: {previewId}</div>
              </div>
            </div>
          )}
          <button onClick={addToQueue} disabled={adding} className="w-full bg-pink-500 hover:bg-pink-600 py-2 rounded-lg font-semibold">
            {adding ? "Adding..." : "Add to Queue"}
          </button>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold mb-2">Queued Songs</h3>
          <ul className="space-y-2">
            {queue.map((v, i) => (
              <li key={i} className="flex items-center gap-3 bg-white/10 p-2 rounded">
                <img src={`https://img.youtube.com/vi/${v}/mqdefault.jpg`} alt="thumb" className="w-20 h-12 rounded" />
                <div className="text-sm">Video ID: {v}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
