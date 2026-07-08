// components/HostControls.js
import React, { useState } from "react";
import { ref, remove, set, get } from "firebase/database";
import { db } from "../utils/firebase";

export default function HostControls({ roomId, onExitRedirect, onSkipNoScore }) {
  const [busy, setBusy] = useState(false);

  const setPlayState = async (state) => {
    if (!roomId) return;
    setBusy(true);
    try {
      await set(ref(db, `rooms/${roomId}/playState`), state); // 'playing' or 'paused'
    } finally {
      setBusy(false);
    }
  };

  // Local no-score skip (fallback if parent doesn't provide onSkipNoScore)
  const localSkipNoScore = async () => {
    if (!roomId) return;
    setBusy(true);
    try {
      const qRef = ref(db, `rooms/${roomId}/queue`);
      const snap = await get(qRef);
      const data = snap.val() || {};
      // convert to ordered array by addedAt if present, otherwise keep insertion order
      const ordered = Object.entries(data || {}).map(([key, value]) => ({ key, ...value }));
      ordered.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

      if (ordered.length === 0) {
        // nothing to skip
        await set(ref(db, `rooms/${roomId}/currentSong`), null);
        await set(ref(db, `rooms/${roomId}/playState`), "paused");
        setBusy(false);
        return;
      }

      const firstKey = ordered[0].key;
      const next = ordered[1] || null;

      // remove the finished (first) entry
      await remove(ref(db, `rooms/${roomId}/queue/${firstKey}`));

      if (next) {
        // set next as currentSong and request autoplay
        await set(ref(db, `rooms/${roomId}/currentSong`), {
          videoId: next.videoId,
          title: next.title,
          thumbnail: next.thumbnail,
        });
        await set(ref(db, `rooms/${roomId}/playState`), "playing");
      } else {
        // no next
        await set(ref(db, `rooms/${roomId}/currentSong`), null);
        await set(ref(db, `rooms/${roomId}/playState`), "paused");
      }
    } catch (err) {
      console.error("localSkipNoScore failed:", err);
    } finally {
      setBusy(false);
    }
  };

  // Public skip handler used by the Skip button
  const handleSkip = async () => {
    // If parent provided an authoritative skip handler, use it
    if (typeof onSkipNoScore === "function") {
      try {
        setBusy(true);
        await onSkipNoScore();
      } catch (err) {
        console.error("onSkipNoScore threw:", err);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Otherwise run the local no-score skip flow
    await localSkipNoScore();
  };

  const exitRoom = async () => {
    if (!roomId) return;
    if (!confirm("Exit room and clear data?")) return;
    setBusy(true);
    try {
      await remove(ref(db, `rooms/${roomId}`));
      if (onExitRedirect) onExitRedirect();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center flex-wrap gap-2 lg:gap-3 justify-end">
      <button
        onClick={() => setPlayState("playing")}
        className="bg-green-500 hover:bg-green-600 px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded"
        disabled={busy}
      >
        Play
      </button>

      <button
        onClick={() => setPlayState("paused")}
        className="bg-yellow-500 hover:bg-yellow-600 px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded"
        disabled={busy}
      >
        Pause
      </button>

      <button
        onClick={handleSkip}
        className="bg-indigo-600 hover:bg-indigo-700 px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded"
        disabled={busy}
      >
        Skip
      </button>

      <button
        onClick={exitRoom}
        className="bg-red-600 hover:bg-red-700 px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm rounded"
        disabled={busy}
      >
        Exit Room (Clear)
      </button>
    </div>
  );
}
