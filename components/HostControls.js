import { useState } from "react";
import { ref, remove, set, get } from "firebase/database";
import { db } from "../utils/firebase";
import Button from "./ui/Button";

export default function HostControls({ roomId, onExitRedirect, onSkipNoScore }) {
  const [busy, setBusy] = useState(false);

  const setPlayState = async (state) => {
    if (!roomId) return;
    setBusy(true);
    try {
      await set(ref(db, `rooms/${roomId}/playState`), state);
    } finally {
      setBusy(false);
    }
  };

  const localSkipNoScore = async () => {
    if (!roomId) return;
    setBusy(true);
    try {
      const qRef = ref(db, `rooms/${roomId}/queue`);
      const snap = await get(qRef);
      const data = snap.val() || {};
      const ordered = Object.entries(data || {}).map(([key, value]) => ({ key, ...value }));
      ordered.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

      if (ordered.length === 0) {
        await set(ref(db, `rooms/${roomId}/currentSong`), null);
        await set(ref(db, `rooms/${roomId}/playState`), "paused");
        setBusy(false);
        return;
      }

      const firstKey = ordered[0].key;
      const next = ordered[1] || null;

      await remove(ref(db, `rooms/${roomId}/queue/${firstKey}`));

      if (next) {
        await set(ref(db, `rooms/${roomId}/currentSong`), {
          videoId: next.videoId, title: next.title, thumbnail: next.thumbnail,
        });
        await set(ref(db, `rooms/${roomId}/playState`), "playing");
      } else {
        await set(ref(db, `rooms/${roomId}/currentSong`), null);
        await set(ref(db, `rooms/${roomId}/playState`), "paused");
      }
    } catch (err) {
      console.error("localSkipNoScore failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
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
      <Button onClick={() => setPlayState("playing")} variant="default" size="sm" disabled={busy}>Play</Button>
      <Button onClick={() => setPlayState("paused")} variant="secondary" size="sm" disabled={busy}>Pause</Button>
      <Button onClick={handleSkip} variant="outline" size="sm" disabled={busy}>Skip</Button>
      <Button onClick={exitRoom} variant="destructive" size="sm" disabled={busy}>Exit Room (Clear)</Button>
    </div>
  );
}