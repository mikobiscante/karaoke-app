// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, push, set, remove, get } from "firebase/database";
import { db } from "../../utils/firebase";
import YouTube from "react-youtube";

const MobileControls = dynamic(() => import("../../components/MobileControls"), { ssr: false });
const HostControls = dynamic(() => import("../../components/HostControls"), { ssr: false });

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const isMobile = router.query.mobile === "true";
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [playState, setPlayState] = useState("paused"); // 'playing' or 'paused'
  const playerRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    const curRef = ref(db, `rooms/${id}/currentSong`);
    const qRef = ref(db, `rooms/${id}/queue`);
    const pRef = ref(db, `rooms/${id}/playState`);

    const unsubCur = onValue(curRef, (snap) => setCurrentSong(snap.val()));
    const unsubQ = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      setQueue(Object.values(data));
    });
    const unsubP = onValue(pRef, (snap) => {
      const val = snap.val() || "paused";
      setPlayState(val);
    });

    return () => {
      unsubCur(); unsubQ(); unsubP();
    };
  }, [id]);

  // apply playState to player
  useEffect(() => {
    if (!playerRef.current) return;
    const player = playerRef.current;
    try {
      if (playState === "playing") player.playVideo?.();
      else player.pauseVideo?.();
    } catch (e) {
      // ignore
    }
  }, [playState]);

  // when currentSong changes, load it
  useEffect(() => {
    if (!playerRef.current || !currentSong) return;
    try {
      playerRef.current.loadVideoById(currentSong);
      // if playState says playing, play
      if (playState === "playing") playerRef.current.playVideo?.();
    } catch (e) {}
  }, [currentSong]);

  // on video end: remove first queue item and set next
  const onPlayerStateChange = async (e) => {
    // 0 = ended
    if (e.data === 0 && id) {
      const qRef = ref(db, `rooms/${id}/queue`);
      const snap = await get(qRef);
      const data = snap.val() || {};
      const keys = Object.keys(data);
      if (keys.length === 0) {
        await set(ref(db, `rooms/${id}/currentSong`), null);
        await set(ref(db, `rooms/${id}/playState`), "paused");
        return;
      }
      const firstKey = keys[0];
      const next = data[keys[1]] || null;
      await remove(ref(db, `rooms/${id}/queue/${firstKey}`));
      if (next) await set(ref(db, `rooms/${id}/currentSong`), next);
      else await set(ref(db, `rooms/${id}/currentSong`), null);
    }
  };

  if (!id) return null;
  if (isMobile) return <MobileControls roomId={id} />;

  return (
    <div className="min-h-screen p-8 bg-gradient-to-r from-purple-900 via-pink-700 to-orange-500 text-white">
      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-black/80 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Karaoke Room — <span className="font-mono">{id}</span></h2>
            <div className="flex items-center gap-4">
              <HostControls roomId={id} onExitRedirect={() => router.push("/")} />
            </div>
          </div>

          <div className="bg-black rounded-lg overflow-hidden">
            {currentSong ? (
              <YouTube
                videoId={currentSong}
                opts={{ width: "100%", height: "520", playerVars: { autoplay: 0, controls: 1 } }}
                onReady={(e) => (playerRef.current = e.target)}
                onStateChange={onPlayerStateChange}
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
              <div className="text-sm opacity-80 mt-2">State: <span className="font-medium">{playState}</span></div>
            </div>

            <div className="bg-white/10 p-4 rounded-lg w-64">
              <h3 className="font-semibold mb-2">Scan to Join</h3>
              <div className="flex items-center justify-center">
                {/* QR code client-only: render via dynamic import in a small inline component */}
                <QRCodeClient roomId={id} />
              </div>
            </div>
          </div>
        </div>

        <aside className="bg-white text-black rounded-2xl p-4 shadow-2xl">
          <h3 className="text-2xl font-bold mb-4">Queue</h3>
          {queue.length === 0 ? (
            <p className="text-gray-600">No songs queued yet. Guests can scan the QR to add songs.</p>
          ) : (
            <ul className="space-y-4">
              {queue.map((vid, i) => (
                <li key={i} className="flex items-center gap-3">
                  <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="thumb" className="w-20 h-12 object-cover rounded" />
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


const QRCodeCanvas = dynamic(() => import("qrcode.react").then((m) => m.QRCodeCanvas), { ssr: false });

function QRCodeClient({ roomId }) {
  if (typeof window === "undefined") return null;
  const url = `${window.location.origin}/room/${roomId}?mobile=true`;
  return <QRCodeCanvas value={url} size={140} bgColor="#ffffff" fgColor="#111827" />;
}
