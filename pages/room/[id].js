// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import {
  ref,
  onValue,
  push,
  set,
  remove,
  onDisconnect,
  get,
  child,
} from "firebase/database";
import { db } from "../../utils/firebase";
import YouTube from "react-youtube";
import MobileControls from "../../components/MobileControls";
import HostControls from "../../components/HostControls";
import { v4 as uuidv4 } from "uuid";

import dynamic from "next/dynamic";

const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeCanvas),
  { ssr: false },
);

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const isMobile = router.query.mobile === "true";
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const playerRef = useRef(null);
  const clientIdRef = useRef(null);

  // presence: register this client in rooms/{id}/members/{clientId}
  useEffect(() => {
    if (!id) return;
    const clientId = uuidv4();
    clientIdRef.current = clientId;
    const memberRef = ref(db, `rooms/${id}/members/${clientId}`);
    set(memberRef, { joinedAt: Date.now(), mobile: isMobile ? true : false });

    // ensure removal on disconnect
    const disc = onDisconnect(memberRef);
    disc.remove();

    // watch members; if none remain, remove the room
    const membersRef = ref(db, `rooms/${id}/members`);
    const unsubMembers = onValue(membersRef, async (snap) => {
      const members = snap.val() || {};
      const keys = Object.keys(members);
      if (keys.length === 0) {
        // no members left — delete room
        await remove(ref(db, `rooms/${id}`));
      }
    });

    return () => {
      // explicit cleanup when component unmounts
      // remove this member immediately
      remove(memberRef).catch(() => {});
      unsubMembers();
      // if host left and no members, room will be removed by above listener
    };
  }, [id, isMobile]);

  // listen to currentSong and queue
  useEffect(() => {
    if (!id) return;
    const curRef = ref(db, `rooms/${id}/currentSong`);
    const qRef = ref(db, `rooms/${id}/queue`);

    const unsubCur = onValue(curRef, (snap) => {
      setCurrentSong(snap.val());
    });

    const unsubQ = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      setQueue(Object.values(data));
    });

    return () => {
      unsubCur();
      unsubQ();
    };
  }, [id]);

  // when currentSong changes, load it into player
  useEffect(() => {
    if (!playerRef.current || !currentSong) return;
    const player = playerRef.current;
    // react-youtube gives target in onReady; we store the player instance
    try {
      player.loadVideoById(currentSong);
      player.playVideo?.();
    } catch (e) {
      // ignore
    }
  }, [currentSong]);

  // Host exit handler (redirect to home after clearing)
  const handleExit = async () => {
    if (!id) return;
    if (!confirm("Exit room and clear all data?")) return;
    await remove(ref(db, `rooms/${id}`));
    router.push("/");
  };

  // Skip current song: remove first queue item and set next as currentSong
  const handleSkip = async () => {
    if (!id) return;
    const qRef = ref(db, `rooms/${id}/queue`);
    const snap = await get(qRef);
    const data = snap.val() || {};
    const keys = Object.keys(data);
    if (keys.length === 0) {
      await set(ref(db, `rooms/${id}/currentSong`), null);
      return;
    }
    const firstKey = keys[0];
    const next = data[keys[1]] || null;
    await remove(ref(db, `rooms/${id}/queue/${firstKey}`));
    if (next) await set(ref(db, `rooms/${id}/currentSong`), next);
    else await set(ref(db, `rooms/${id}/currentSong`), null);
  };

  if (!id) return null;

  if (isMobile) {
    // mobile UI: show MobileControls component
    return <MobileControls roomId={id} />;
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-r from-purple-900 via-pink-700 to-orange-500 text-white">
      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">
        {/* Main player */}
        <div className="col-span-2 bg-black/70 rounded-xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Karaoke Room — {id}</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSkip}
                className="bg-yellow-500 hover:bg-yellow-600 px-3 py-2 rounded"
              >
                Skip
              </button>
              <button
                onClick={handleExit}
                className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded"
              >
                Exit Room (Clear)
              </button>
            </div>
          </div>

          <div className="bg-black rounded-lg overflow-hidden">
            {currentSong ? (
              <YouTube
                videoId={currentSong}
                opts={{
                  width: "100%",
                  height: "520",
                  playerVars: { autoplay: 1, controls: 1 },
                }}
                onReady={(e) => (playerRef.current = e.target)}
                onStateChange={async (e) => {
                  // 0 = ended
                  if (e.data === 0) {
                    // when ended, remove first queue item and set next
                    const qRef = ref(db, `rooms/${id}/queue`);
                    const snap = await get(qRef);
                    const data = snap.val() || {};
                    const keys = Object.keys(data);
                    if (keys.length === 0) {
                      await set(ref(db, `rooms/${id}/currentSong`), null);
                      return;
                    }
                    const firstKey = keys[0];
                    const next = data[keys[1]] || null;
                    await remove(ref(db, `rooms/${id}/queue/${firstKey}`));
                    if (next)
                      await set(ref(db, `rooms/${id}/currentSong`), next);
                    else await set(ref(db, `rooms/${id}/currentSong`), null);
                  }
                }}
              />
            ) : (
              <div className="h-[520px] flex items-center justify-center text-gray-300">
                Waiting for a song to be queued...
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-4">
            <div className="bg-white/10 p-4 rounded-lg flex-1">
              <h3 className="font-semibold mb-2">Now Playing</h3>
              <div className="text-lg">{currentSong || "—"}</div>
            </div>

            <div className="bg-white/10 p-4 rounded-lg w-64">
              <h3 className="font-semibold mb-2">Scan to Join</h3>
              <div className="flex items-center justify-center">
                <QRCodeCanvas
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/room/${id}?mobile=true`}
                  size={140}
                  bgColor="#ffffff"
                  fgColor="#111827"
                />
                <QRCodeCanvas
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/room/${id}?mobile=true`}
                  size={140}
                  bgColor="#ffffff"
                  fgColor="#111827"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Queue column */}
        <aside className="bg-white text-black rounded-xl p-4 shadow-2xl">
          <h3 className="text-2xl font-bold mb-4">Queue</h3>
          {queue.length === 0 ? (
            <p className="text-gray-600">
              No songs queued yet. Guests can scan the QR to add songs.
            </p>
          ) : (
            <ul className="space-y-4">
              {queue.map((vid, i) => (
                <li key={i} className="flex items-center gap-3">
                  <img
                    src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`}
                    alt="thumb"
                    className="w-20 h-12 object-cover rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Song {i + 1}</div>
                    <div className="text-sm text-gray-600">Video ID: {vid}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
