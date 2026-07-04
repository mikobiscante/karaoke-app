// components/HostControls.js
import { set, ref, remove } from "firebase/database";
import { db } from "../firebase";

export default function HostControls({ roomId }) {
  const exitRoom = async () => {
    if (!confirm("Exit room and clear data? This will remove the room for everyone.")) return;
    await remove(ref(db, `rooms/${roomId}`));
    // After removal, redirect handled by caller (page)
  };

  const clearQueue = async () => {
    await set(ref(db, `rooms/${roomId}/queue`), null);
  };

  return (
    <div className="flex gap-3">
      <button onClick={clearQueue} className="bg-yellow-500 hover:bg-yellow-600 px-3 py-2 rounded">Clear Queue</button>
      <button onClick={exitRoom} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded">Exit Room (Clear)</button>
    </div>
  );
}
