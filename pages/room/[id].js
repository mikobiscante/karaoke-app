// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, push, set, remove, get } from "firebase/database";
import { db } from "../../utils/firebase";
import YouTube from "react-youtube";
import { FaPlay, FaPause, FaStepForward, FaUsers, FaHeart } from "react-icons/fa";

const MobileControls = dynamic(() => import("../../components/MobileControls"), { ssr: false });
const HostControls = dynamic(() => import("../../components/HostControls"), { ssr: false });

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const isMobile = router.query.mobile === "true";
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [playState, setPlayState] = useState("paused");
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
    const unsubP = onValue(pRef, (snap) => setPlayState(snap.val() || "paused"));

    return () => { unsubCur(); unsubQ(); unsubP(); };
  }, [id]);

  useEffect(() => {
    if (!playerRef.current) return;
    const player = playerRef.current;
    try {
      if (playState === "playing") player.playVideo?.();
      else player.pauseVideo?.();
    } catch {}
  }, [playState]);

  useEffect(() => {
    if (!playerRef.current || !currentSong) return;
    try {
      playerRef.current.loadVideoById(currentSong);
      if (playState === "playing") playerRef.current.playVideo?.();
    } catch {}
  }, [currentSong]);

  const onPlayerStateChange = async (e) => {
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
      await set(ref(db, `rooms/${id}/currentSong`), next || null);
    }
  };

  if (!id) return null;
  if (isMobile) return <MobileControls roomId={id} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-800 text-white flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center px-8 py-4 bg-black/30 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo-singging.png" alt="Karaoke SingGing" className="h-10" />
          <h1 className="text-xl font-bold">Karaoke SingGing — Sing Together</h1>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2"><FaHeart className="text-pink-500" /> 0</div>
          <div className="flex items-center gap-2"><FaUsers className="text-cyan-400" /> 0 Guests</div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-3 gap-6 p-8">
        {/* Video Panel */}
        <section className="col-span-2 bg-black/70 rounded-3xl shadow-2xl p-4 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">ROOM CODE — <span className="font-mono">{id}</span></h2>
            <HostControls roomId={id} onExitRedirect={() => router.push("/")} />
          </div>

          <div className="flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center">
            {currentSong ? (
              <YouTube
                videoId={currentSong}
                opts={{ width: "100%", height: "520", playerVars: { autoplay: 0, controls: 1 } }}
                onReady={(e) => (playerRef.current = e.target)}
                onStateChange={onPlayerStateChange}
              />
            ) : (
              <div className="text-center text-gray-300 text-3xl font-bold">
                Waiting for a song to be queued...
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          <div className="mt-6 bg-gradient-to-r from-indigo-900 to-purple-800 rounded-xl p-4 flex justify-between items-center shadow-lg">
            <div className="text-sm">
              <span className="text-pink-400 font-semibold">🎵 NOW PLAYING</span>{" "}
              {currentSong ? currentSong : "No song selected"}
            </div>
            <div className="flex items-center gap-4">
              <button className="bg-pink-500 hover:bg-pink-600 p-3 rounded-full text-xl shadow-lg">
                <FaPlay />
              </button>
              <button className="bg-yellow-500 hover:bg-yellow-600 p-3 rounded-full text-xl shadow-lg">
                <FaPause />
              </button>
              <button className="bg-indigo-600 hover:bg-indigo-700 p-3 rounded-full text-xl shadow-lg">
                <FaStepForward />
              </button>
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="bg-black/50 rounded-3xl shadow-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-pink-400 font-bold mb-2">▶ UP NEXT</h3>
            {queue.length === 0 ? (
              <p className="text-gray-400">No songs queued yet</p>
            ) : (
              <ul className="space-y-3">
                {queue.map((vid, i) => (
                  <li key={i} className="flex items-center gap-3 bg-white/10 p-2 rounded-lg">
                    <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="thumb" className="w-20 h-12 rounded" />
                    <div>
                      <div className="font-medium text-sm">Song {i + 1}</div>
                      <div className="text-xs opacity-80">Video ID: {vid}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 bg-white/10 p-4 rounded-xl text-center">
            <h4 className="font-semibold mb-2">Welcome to Karaoke SingGing</h4>
            <p className="text-sm text-gray-300 mb-4">Guests can add songs and send reactions from their phones.</p>
            <QRCodeClient roomId={id} />
          </div>
        </aside>
      </main>
    </div>
  );
}

const QRCodeCanvas = dynamic(() => import("qrcode.react").then((m) => m.QRCodeCanvas), { ssr: false });
function QRCodeClient({ roomId }) {
  if (typeof window === "undefined") return null;
  const url = `${window.location.origin}/room/${roomId}?mobile=true`;
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeCanvas value={url} size={140} bgColor="#ffffff" fgColor="#111827" />
      <div className="text-xs text-gray-300">Scan to join on mobile</div>
    </div>
  );
}
