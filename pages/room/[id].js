// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, push, set, remove, get } from "firebase/database";
import { db } from "../../utils/firebase";
import YouTube from "react-youtube";
import { FaPlay, FaPause, FaStepForward, FaListUl, FaQrcode } from "react-icons/fa";

const MobileControls = dynamic(() => import("../../components/MobileControls"), { ssr: false });
const HostControls = dynamic(() => import("../../components/HostControls"), { ssr: false });
const QRCodeCanvas = dynamic(() => import("qrcode.react").then((m) => m.QRCodeCanvas), { ssr: false });

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

  // sync play state to player
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (playState === "playing") playerRef.current.playVideo?.();
      else playerRef.current.pauseVideo?.();
    } catch {}
  }, [playState]);

  // load new video when currentSong changes
  useEffect(() => {
    if (!playerRef.current) return;
    if (!currentSong) {
      try { playerRef.current.stopVideo?.(); } catch {}
      return;
    }
    try {
      playerRef.current.loadVideoById(currentSong);
      if (playState === "playing") playerRef.current.playVideo?.();
    } catch {}
  }, [currentSong]);

  // when video ends, pop queue and set next
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

  // host control actions
  const togglePlay = async () => {
    if (!id) return;
    const newState = playState === "playing" ? "paused" : "playing";
    await set(ref(db, `rooms/${id}/playState`), newState);
  };

  const skip = async () => {
    if (!id) return;
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
  };

  if (!id) return null;
  if (isMobile) return <MobileControls roomId={id} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-800 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* <img src="/logo-singging.png" alt="Karaoke SingGing" className="h-10" /> */}
          <div>
            <div className="text-lg font-bold">Karaoke SingGing</div>
            <div className="text-xs text-gray-300">ROOM CODE — <span className="font-mono">{id}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <HostControls roomId={id} onExitRedirect={() => router.push("/")} />
        </div>
      </header>

      {/* Main: big video + compact sidebar */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Video column: spans 8-9 columns on large screens to make it very big */}
        <section className="lg:col-span-9 col-span-1 bg-black/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          {/* Video container: full height, responsive aspect ratio */}
          <div className="relative flex-1 bg-black">
            {/* Use a container that forces 16:9 but grows to fill available height */}
            <div className="w-full h-full flex items-center justify-center">
              {currentSong ? (
                <div className="w-full h-full">
                  {/* wrapper ensures player fills container */}
                  <div className="w-full h-full">
                    <YouTube
                      videoId={currentSong}
                      opts={{
                        width: "100%",
                        height: "100%",
                        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 }
                      }}
                      onReady={(e) => {
                        // ensure player uses container size
                        playerRef.current = e.target;
                        try { e.target.setSize(window.innerWidth * 0.66, window.innerHeight * 0.78); } catch {}
                      }}
                      onStateChange={onPlayerStateChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-gray-300">
                    <div className="text-3xl font-bold mb-2">Waiting for a song to be queued...</div>
                    <div className="text-sm opacity-80">Guests can scan the QR code to add songs.</div>
                  </div>
                </div>
              )}
            </div>

            {/* Floating controls overlay (large, centered) */}
            <div className="absolute left-0 right-0 bottom-6 flex items-center justify-center gap-4 pointer-events-auto">
              <button
                onClick={togglePlay}
                className="bg-white/90 text-black p-4 rounded-full shadow-2xl transform hover:scale-105 transition"
                aria-label="Play/Pause"
              >
                {playState === "playing" ? <FaPause size={20} /> : <FaPlay size={20} />}
              </button>

              <button
                onClick={skip}
                className="bg-pink-500 hover:bg-pink-400 p-4 rounded-full shadow-2xl text-white transform hover:scale-105 transition"
                aria-label="Skip"
              >
                <FaStepForward size={20} />
              </button>

              <button
                onClick={() => { /* clear queue action for host if desired */ }}
                className="bg-white/10 p-4 rounded-full shadow-lg text-white opacity-90 hover:opacity-100 transition"
                aria-label="Queue"
              >
                <FaListUl size={20} />
              </button>
            </div>
          </div>
        </section>

        {/* Sidebar: compact, right column */}
        <aside className="lg:col-span-3 col-span-1 bg-black/50 rounded-3xl shadow-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-pink-400 font-bold mb-3">▶ UP NEXT</h3>
            {queue.length === 0 ? (
              <p className="text-gray-400">No songs queued yet</p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-auto pr-2">
                {queue.map((vid, i) => (
                  <li key={i} className="flex items-center gap-3 bg-white/6 p-2 rounded-lg">
                    <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="thumb" className="w-20 h-12 rounded object-cover" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Song {i + 1}</div>
                      <div className="text-xs opacity-80">Video ID: {vid}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 bg-white/6 p-4 rounded-xl text-center">
            <h4 className="font-semibold mb-2">Welcome to Karaoke SingGing</h4>
            <p className="text-sm text-gray-300 mb-3">Guests can add songs and send reactions from their phones.</p>
            <div className="flex items-center justify-center">
              <QRCodeClient roomId={id} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function QRCodeClient({ roomId }) {
  if (typeof window === "undefined") return null;
  const url = `${window.location.origin}/room/${roomId}?mobile=true`;
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeCanvas value={url} size={120} bgColor="#ffffff" fgColor="#111827" />
      <div className="text-xs text-gray-300">Scan to join on mobile</div>
    </div>
  );
}
