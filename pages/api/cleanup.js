import { ref, get, remove } from "firebase/database";
import { db } from "../../utils/firebase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const roomsRef = ref(db, "rooms");
    const snap = await get(roomsRef);
    const rooms = snap.val() || {};
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    let deleted = 0;

    for (const roomId of Object.keys(rooms)) {
      const data = rooms[roomId];
      // Rooms that are currently playing are still active — skip them
      if (data.playState === "playing") continue;

      const lastActive = data.lastActiveAt || data._createdAt || 0;
      if (now - lastActive > ONE_HOUR) {
        await remove(ref(db, `rooms/${roomId}`));
        deleted++;
      }
    }

    res.status(200).json({ deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
