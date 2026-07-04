// components/HostControls.js
import React, { useState } from "react";
import { ref, remove, set, get, child } from "firebase/database";
import { db } from "../utils/firebase";

export default function HostControls({ roomId, onExitRedirect }) {
  const [busy, setBusy] = useState(false);

  const setPlayState = async (state) => {
    if (!roomId) return;
    setBusy(true);
    await set(ref(db, `rooms/${roomId}/playState`), state); // 'playing' or 'paused'
    setBusy(false);
  };

  const skip = async () => {
    if (!roomId) return;
    setBusy(true);
    const qRef = ref(db, `rooms/${roomId}/queue`);
    const snap = await get(qRef);
    const data = snap.val() || {};
    const keys = Object.keys(data);
    if (keys.length === 0) {
      // nothing to skip
      setBusy(false);
      return;
    }
    const firstKey = keys[0];
    const next = data[keys[1]] || null;
    await remove(ref(db, `rooms/${roomId}/queue/${firstKey}`));
    if (next) await set(ref(db, `rooms/${roomId}/currentSong`), next);
    else await set(ref(db, `rooms/${roomId}/currentSong`), null);
    setBusy(false);
  };

  const clearQueue = async () => {
    if (!roomId) return;
    await set(ref(db, `rooms/${roomId}/queue`), null);
  };

  const exitRoom = async () => {
    if (!roomId) return;
    if (!confirm("Exit room and clear data?")) return;
    await remove(ref(db, `rooms/${roomId}`));
    if (onExitRedirect) onExitRedirect();
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={() => setPlayState("playing")} className="bg-green-500 hover:bg-green-600 px-3 py-2 rounded">Play</button>
      <button onClick={() => setPlayState("paused")} className="bg-yellow-500 hover:bg-yellow-600 px-3 py-2 rounded">Pause</button>
      <button onClick={skip} className="bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded">Skip</button>
      <button onClick={clearQueue} className="bg-gray-500 hover:bg-gray-600 px-3 py-2 rounded">Clear Queue</button>
      <button onClick={exitRoom} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded">Exit Room (Clear)</button>
    </div>
  );
}
