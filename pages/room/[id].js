// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, set, remove, get } from "firebase/database";
import { db } from "../../utils/firebase";
import YouTube from "react-youtube";
import { FaPlay, FaPause, FaStepForward, FaListUl } from "react-icons/fa";

const MobileControls = dynamic(() => import("../../components/MobileControls"), { ssr: false });
const HostControls = dynamic(() => import("../../components/HostControls"), { ssr: false });
const QRCodeCanvas = dynamic(() => import("qrcode.react").then(m => m.QRCodeCanvas), { ssr: false });

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const isMobile = router.query.mobile === "true";

  const [currentSong, setCurrentSong] = useState(null); // { videoId, title, thumbnail } or null
  const [queue, setQueue] = useState([]); // array of { key, videoId, title, thumbnail }
  const [playState, setPlayState] = useState("paused");
  const [showScore, setShowScore] = useState(false);
  const [lastScore, setLastScore] = useState(null);
  const playerRef = useRef(null);
  const scoringTimeoutRef = useRef(null);

  // subscribe to firebase nodes
  useEffect(() => {
    if (!id) return;
    const curRef = ref(db, `rooms/${id}/currentSong`);
    const qRef = ref(db, `rooms/${id}/queue`);
    const pRef = ref(db, `rooms/${id}/playState`);

    const unsubCur = onValue(curRef, (snap) => {
      const val = snap.val();
      setCurrentSong(val || null);
    });

    const unsubQ = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      // convert to array with keys so we can remove by key
      const arr = Object.entries(data).map(([key, value]) => ({ key, ...value }));
      setQueue(arr);
    });

    const unsubP = onValue(pRef, (snap) => setPlayState(snap.val() || "paused"));

    return () => { unsubCur(); unsubQ(); unsubP(); };
  }, [id]);

  // ensure player follows playState
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
      // load by id and autoplay if playState says playing
      playerRef.current.loadVideoById(currentSong.videoId);
      if (playState === "playing") playerRef.current.playVideo?.();
    } catch {}
  }, [currentSong]);

  // helper: advance queue (remove first item) and set next as currentSong
  const advanceQueue = async () => {
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
    // remove first (oldest) entry
    const firstKey = keys[0];
    const nextKey = keys[1] || null;
    // remove the first
    await remove(ref(db, `rooms/${id}/queue/${firstKey}`));
    // set next as currentSong (if exists)
    if (nextKey) {
      const next = data[nextKey];
      await set(ref(db, `rooms/${id}/currentSong`), next);
      // ensure autoplay
      await set(ref(db, `rooms/${id}/playState`), "playing");
    } else {
      // no next
      await set(ref(db, `rooms/${id}/currentSong`), null);
      await set(ref(db, `rooms/${id}/playState`), "paused");
    }
  };

  // when player state changes (YouTube events)
  const onPlayerStateChange = async (e) => {
    // 0 = ended
    if (e.data === 0 && id) {
      // show scoring popover for 3s, then advance and autoplay
      // generate a score (placeholder logic) — replace with your scoring algorithm
      const score = Math.floor(60 + Math.random() * 40); // 60-99
      setLastScore(score);
      setShowScore(true);

      // clear any existing timeout
      if (scoringTimeoutRef.current) clearTimeout(scoringTimeoutRef.current);

      scoringTimeoutRef.current = setTimeout(async () => {
        setShowScore(false);
        scoringTimeoutRef.current = null;
        // after scoring popover closes, advance queue and autoplay next
        await advanceQueue();
      }, 3000); // 3 seconds
    }
  };

  // host actions
  const togglePlay = async () => {
    if (!id) return;
    const newState = playState === "playing" ? "paused" : "playing";
    await set(ref(db, `rooms/${id}/playState`), newState);
  };

  const skip = async () => {
    if (!id) return;
    // immediate skip: show scoring briefly then advance
    const score = Math.floor(60 + Math.random() * 40);
    setLastScore(score);
    setShowScore(true);
    if (scoringTimeoutRef.current) clearTimeout(scoringTimeoutRef.current);
    scoringTimeoutRef.current = setTimeout(async () => {
      setShowScore(false);
      scoringTimeoutRef.current = null;
      await advanceQueue();
    }, 3000);
  };

  if (!id) return null;
  if (isMobile) return <MobileControls roomId={id} />;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-800 text-white">
      <header className="flex items-center justify-between px-6 py-4 bg-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          {/* <img src="/logo-singging.png" alt="Karaoke SingGing" className="h-10" /> */}
          <div>
            <div className="text-lg font-bold">Karaoke SingGing</div>
            <div className="text-xs text-gray-300">ROOM — <span className="font-mono">{id}</span></div>
          </div>
        </div>
        <HostControls roomId={id} onExitRedirect={() => router.push("/")} />
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Big video column */}
        <section className="lg:col-span-9 col-span-1 bg-black/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-120px)] relative">
          <div className="yt-wrapper flex-1">
            {currentSong ? (
              <YouTube
                videoId={currentSong.videoId}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 }
                }}
                onReady={(e) => {
                  playerRef.current = e.target;
                  // ensure autoplay if playState says playing
                  if (playState === "playing") {
                    try { e.target.playVideo?.(); } catch {}
                  }
                }}
                onStateChange={onPlayerStateChange}
                className="yt-iframe"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">Waiting for a song to be queued...</div>
                  <div className="text-sm opacity-80">Guests can scan the QR code to add songs.</div>
                </div>
              </div>
            )}
          </div>

          {/* Floating overlay controls */}
          <div className="absolute left-0 right-0 bottom-6 flex items-center justify-center gap-4 pointer-events-auto">
            <button
              onClick={togglePlay}
              className="overlay-control bg-white text-black p-4 rounded-full shadow-2xl"
              aria-label="Play/Pause"
            >
              {playState === "playing" ? <FaPause size={18} /> : <FaPlay size={18} />}
            </button>

            <button
              onClick={skip}
              className="overlay-control bg-pink-500 hover:bg-pink-400 p-4 rounded-full shadow-2xl text-white"
              aria-label="Skip"
            >
              <FaStepForward size={18} />
            </button>

            <button className="overlay-control bg-white/10 p-4 rounded-full shadow-lg text-white">
              <FaListUl size={18} />
            </button>
          </div>

          {/* scoring popover */}
          {showScore && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto bg-white/95 text-black rounded-2xl p-6 shadow-2xl w-80 text-center animate-fade-in">
                <div className="text-2xl font-bold mb-1">Score</div>
                <div className="text-4xl font-extrabold">{lastScore}</div>
                <div className="text-sm text-gray-600 mt-2">Great job! Next song will play shortly.</div>
              </div>
            </div>
          )}
        </section>

        {/* Compact sidebar */}
        <aside className="lg:col-span-3 col-span-1 bg-black/50 rounded-3xl shadow-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-pink-400 font-bold mb-3">▶ UP NEXT</h3>
            {queue.length === 0 ? (
              <p className="text-gray-400">No songs queued yet</p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-auto">
                {queue.map((item, i) => (
                  <li key={item.key} className="flex items-center gap-3 bg-white/6 p-2 rounded-lg">
                    <img src={item.thumbnail} alt="thumb" className="w-20 h-12 rounded object-cover" />
                    <div className="flex-1">
                      <div className="font-medium text-sm line-clamp-2">{item.title}</div>
                      <div className="text-xs opacity-80">Queued by guest</div>
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
