// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, set, remove, get } from "firebase/database";
import { db } from "../../utils/firebase";
import YouTube from "react-youtube";
import { FaPlay, FaPause, FaStepForward, FaListUl } from "react-icons/fa";

const MobileControls = dynamic(
  () => import("../../components/MobileControls"),
  { ssr: false },
);
const HostControls = dynamic(() => import("../../components/HostControls"), {
  ssr: false,
});
const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeCanvas),
  { ssr: false },
);

export default function RoomPage() {
  const router = useRouter();
  const { id } = router.query;
  const isMobile = router.query.mobile === "true";

  const [currentSong, setCurrentSong] = useState(null); // { videoId, title, thumbnail }
  const [queue, setQueue] = useState([]); // [{ key, videoId, title, thumbnail, addedAt }]
  const [playState, setPlayState] = useState("paused");
  const [showScore, setShowScore] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  const playerRef = useRef(null);
  const scoreAnimRef = useRef(null);
  const scoringTimeoutRef = useRef(null);
  const confettiRef = useRef(null);

  // Subscribe to Firebase nodes
  useEffect(() => {
    if (!id) return;
    const curRef = ref(db, `rooms/${id}/currentSong`);
    const qRef = ref(db, `rooms/${id}/queue`);
    const pRef = ref(db, `rooms/${id}/playState`);

    const unsubCur = onValue(curRef, (snap) =>
      setCurrentSong(snap.val() || null),
    );
    const unsubQ = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([key, value]) => ({
        key,
        ...value,
      }));
      // sort by addedAt ascending (older first)
      arr.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      setQueue(arr);
    });
    const unsubP = onValue(pRef, (snap) =>
      setPlayState(snap.val() || "paused"),
    );

    return () => {
      unsubCur();
      unsubQ();
      unsubP();
    };
  }, [id]);

  // Ensure player follows playState
  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (playState === "playing") playerRef.current.playVideo?.();
      else playerRef.current.pauseVideo?.();
    } catch {}
  }, [playState]);

  // Load new video when currentSong changes and attempt autoplay
  useEffect(() => {
    if (!playerRef.current) return;
    if (!currentSong) {
      try {
        playerRef.current.stopVideo?.();
      } catch {}
      return;
    }
    try {
      playerRef.current.loadVideoById(currentSong.videoId);
      // small delay then try to play (helps with some autoplay policies)
      setTimeout(() => {
        try {
          playerRef.current.playVideo?.();
        } catch {}
      }, 250);
    } catch {}
  }, [currentSong]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (!currentSong || !currentSong.videoId) return;
    const t = setTimeout(() => {
      try {
        playerRef.current.loadVideoById(currentSong.videoId);
        playerRef.current.playVideo?.();
      } catch (err) {
        console.warn("Force play on currentSong change failed:", err);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [currentSong]);

  // Idle redirect: if room is idle for 1 hour, redirect to main page
  useEffect(() => {
    if (!id) return;

    const IDLE_MS = 60 * 60 * 1000; // 1 hour
    let timeoutId = null;

    // reset timer (clears previous and starts a new one)
    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // If music is playing, do not start the idle timer
      if (playState === "playing") return;

      timeoutId = setTimeout(() => {
        // Redirect to main page when idle timeout fires
        try {
          router.push("/");
        } catch (err) {
          console.warn("Idle redirect failed:", err);
        }
      }, IDLE_MS);
    };

    // activity events that indicate the room is active
    const activityEvents = [
      "mousemove",
      "keydown",
      "touchstart",
      "click",
      "scroll",
    ];

    // attach listeners
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true }),
    );

    // also reset when visibility changes (user returns to tab)
    const onVisibility = () => {
      if (!document.hidden) resetTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // start timer initially (only if not playing)
    resetTimer();

    // If playState changes to playing, clear the idle timer; if it becomes paused, restart it
    // (this effect depends on playState below so it will re-run when playState changes)

    return () => {
      // cleanup listeners and timeout
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, resetTimer),
      );
      document.removeEventListener("visibilitychange", onVisibility);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, playState, router]);

  // Helper: get ordered entries from snapshot object (by addedAt)
  const orderedEntries = (dataObj) => {
    const arr = Object.entries(dataObj || {}).map(([key, value]) => ({
      key,
      ...value,
    }));
    arr.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    return arr;
  };

  // Force host player to load & play whenever currentSong changes in Firebase
  useEffect(() => {
    if (!playerRef.current) return;
    if (!currentSong || !currentSong.videoId) return;
    // small delay to allow YouTube API to be ready
    const t = setTimeout(() => {
      try {
        playerRef.current.loadVideoById(currentSong.videoId);
        // try to play; browsers may block autoplay without a user gesture
        playerRef.current.playVideo?.();
      } catch (err) {
        console.warn("Force play on currentSong change failed:", err);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [currentSong]);

  // Advance queue: remove first (oldest) and set next as currentSong, ensure autoplay on host player
  const advanceQueue = async () => {
    if (!id) return;
    const qRef = ref(db, `rooms/${id}/queue`);
    const snap = await get(qRef);
    const data = snap.val() || {};
    const ordered = Object.entries(data)
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    if (ordered.length === 0) {
      await set(ref(db, `rooms/${id}/currentSong`), null);
      await set(ref(db, `rooms/${id}/playState`), "paused");
      return;
    }

    const firstKey = ordered[0].key;
    const next = ordered[1] || null;

    // remove the finished (first) entry
    await remove(ref(db, `rooms/${id}/queue/${firstKey}`));

    if (next) {
      await set(ref(db, `rooms/${id}/currentSong`), {
        videoId: next.videoId,
        title: next.title,
        thumbnail: next.thumbnail,
      });
      await set(ref(db, `rooms/${id}/playState`), "playing");

      // small delay then try to force play with retries
      setTimeout(async () => {
        try {
          const csSnap = await get(ref(db, `rooms/${id}/currentSong`));
          const cs = csSnap.val();
          const vid = cs?.videoId || next.videoId;
          if (vid) tryPlayWithRetries(vid, 4, 350);
        } catch (err) {
          console.warn("Could not auto-play next video on host player:", err);
        }
      }, 350);
    } else {
      await set(ref(db, `rooms/${id}/currentSong`), null);
      await set(ref(db, `rooms/${id}/playState`), "paused");
    }
  };

  // YouTube state change handler
  const onPlayerStateChange = async (e) => {
    // 0 = ended
    if (e.data === 0 && id) {
      // compute final score between 80 and 100
      const score = 80 + Math.floor(Math.random() * 21); // 80..100
      setFinalScore(score);
      startScoreSequence(score);
    }
  };

  // start scoring animation + confetti + advance after count-up + 2s pause
  // const startScoreSequence = (score) => {
  //   // clear any existing animations/timeouts
  //   if (scoreAnimRef.current) cancelAnimationFrame(scoreAnimRef.current);
  //   if (scoringTimeoutRef.current) clearTimeout(scoringTimeoutRef.current);
  //   setDisplayScore(0);
  //   setShowScore(true);
  //   launchConfetti();

  //   const countDuration = 3000; // 3s count-up
  //   const pauseAfter = 2000; // 2s appreciation pause
  //   const start = performance.now();
  //   const from = 0;
  //   const to = score;

  //   // animate numeric count-up with easeOutCubic
  //   const step = (now) => {
  //     const t = Math.min(1, (now - start) / countDuration);
  //     const eased = 1 - Math.pow(1 - t, 3);
  //     const current = Math.floor(from + (to - from) * eased);
  //     setDisplayScore(current);
  //     if (t < 1) {
  //       scoreAnimRef.current = requestAnimationFrame(step);
  //     } else {
  //       scoreAnimRef.current = null;
  //     }
  //   };
  //   scoreAnimRef.current = requestAnimationFrame(step);

  //   // After countDuration + pauseAfter, stop confetti, hide score, then advance & autoplay next
  //   scoringTimeoutRef.current = setTimeout(async () => {
  //     stopConfetti();
  //     setShowScore(false);
  //     setDisplayScore(0);
  //     scoringTimeoutRef.current = null;

  //     // Advance queue and ensure autoplay on host player
  //     try {
  //       await advanceQueue();
  //       // After advanceQueue sets currentSong and playState, attempt to force play again
  //       setTimeout(async () => {
  //         try {
  //           // fetch currentSong from DB to ensure we have the latest
  //           const csSnap = await get(ref(db, `rooms/${id}/currentSong`));
  //           const cs = csSnap.val();
  //           if (cs && cs.videoId && playerRef.current) {
  //             playerRef.current.loadVideoById(cs.videoId);
  //             playerRef.current.playVideo?.();
  //           }
  //         } catch (err) {
  //           console.warn("Error forcing play after advance:", err);
  //         }
  //       }, 350);
  //     } catch (err) {
  //       console.error("advanceQueue failed:", err);
  //     }
  //   }, countDuration + pauseAfter);
  // };
  const startScoreSequence = (score) => {
    if (scoreAnimRef.current) cancelAnimationFrame(scoreAnimRef.current);
    if (scoringTimeoutRef.current) clearTimeout(scoringTimeoutRef.current);
    setDisplayScore(0);
    setShowScore(true);
    launchConfetti();

    const countDuration = 3000; // 3s count-up
    const pauseAfter = 2000; // 2s appreciation pause
    const start = performance.now();
    const from = 0;
    const to = score;

    const step = (now) => {
      const t = Math.min(1, (now - start) / countDuration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = Math.floor(from + (to - from) * eased);
      setDisplayScore(current);
      if (t < 1) scoreAnimRef.current = requestAnimationFrame(step);
      else scoreAnimRef.current = null;
    };
    scoreAnimRef.current = requestAnimationFrame(step);

    scoringTimeoutRef.current = setTimeout(async () => {
      stopConfetti();
      setShowScore(false);
      setDisplayScore(0);
      scoringTimeoutRef.current = null;

      try {
        await advanceQueue(); // remove finished, set next currentSong + playState
        // small delay then force host player to load & play the new currentSong
        setTimeout(async () => {
          try {
            const csSnap = await get(ref(db, `rooms/${id}/currentSong`));
            const cs = csSnap.val();
            if (cs && cs.videoId) tryPlayWithRetries(cs.videoId, 4, 350);
          } catch (err) {
            console.warn("Error forcing play after advance:", err);
          }
        }, 350);
      } catch (err) {
        console.error("advanceQueue failed:", err);
      }
    }, countDuration + pauseAfter);
  };

  // Confetti helpers (DOM-based)
  const launchConfetti = () => {
    const container = confettiRef.current;
    if (!container) return;
    container.innerHTML = "";
    const colors = ["#ff4da6", "#7c3aed", "#06b6d4", "#f97316", "#fde047"];
    const pieces = 40;
    for (let i = 0; i < pieces; i++) {
      const el = document.createElement("div");
      el.className = "confetti";
      el.style.background = colors[i % colors.length];
      el.style.left = `${50 + (Math.random() - 0.5) * 60}%`;
      el.style.top = `${10 + Math.random() * 20}%`;
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      el.style.opacity = `${0.9 + Math.random() * 0.1}`;
      container.appendChild(el);
      const dx = (Math.random() - 0.5) * 600;
      const dy = 400 + Math.random() * 300;
      const rot = (Math.random() - 0.5) * 720;
      el.animate(
        [
          { transform: `translateY(0px) rotate(0deg)`, opacity: 1 },
          {
            transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
            opacity: 0.1,
          },
        ],
        {
          duration: 2200 + Math.random() * 800,
          easing: "cubic-bezier(.2,.8,.2,1)",
          fill: "forwards",
        },
      );
    }
    setTimeout(() => {
      if (container) container.innerHTML = "";
    }, 3200);
  };

  const stopConfetti = () => {
    const container = confettiRef.current;
    if (container) container.innerHTML = "";
  };

  // Host actions
  const togglePlay = async () => {
    if (!id) return;
    const newState = playState === "playing" ? "paused" : "playing";
    await set(ref(db, `rooms/${id}/playState`), newState);
  };

  const skip = async () => {
    if (!id) return;
    // show scoring sequence then advance (same as end-of-song)
    const score = 80 + Math.floor(Math.random() * 21);
    setFinalScore(score);
    startScoreSequence(score);
  };

  const tryPlayWithRetries = (videoId, attempts = 4, delay = 350) => {
    let tries = 0;
    const attempt = () => {
      tries++;
      try {
        if (playerRef.current && videoId) {
          playerRef.current.loadVideoById(videoId);
          playerRef.current.playVideo?.();
        }
      } catch (err) {
        // ignore and retry
      }
      if (tries < attempts) setTimeout(attempt, delay);
    };
    attempt();
  };

  if (!id) return null;
  if (isMobile) return <MobileControls roomId={id} />;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-800 text-white">
      <header className="flex items-center justify-between px-6 py-4 bg-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <img
            src="/logo-singging.png"
            alt="Karaoke SingGing"
            className="h-10"
          />
          <div>
            <div className="text-lg font-bold">Karaoke SingGing</div>
            <div className="text-xs text-gray-300">
              ROOM — <span className="font-mono">{id}</span>
            </div>
          </div>
        </div>
        <HostControls
          roomId={id}
          onExitRedirect={() => router.push("/")}
          onSkipNoScore={handleSkipNoScore}
        />
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Video column */}
        <section className="lg:col-span-9 col-span-1 bg-black/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-140px)] relative">
          <div className="yt-wrapper flex-1">
            {currentSong ? (
              <YouTube
                videoId={currentSong.videoId}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: {
                    autoplay: 0,
                    controls: 1,
                    modestbranding: 1,
                    rel: 0,
                  },
                }}
                onReady={(e) => {
                  playerRef.current = e.target;
                  if (playState === "playing") {
                    try {
                      e.target.playVideo?.();
                    } catch {}
                  }
                }}
                onStateChange={onPlayerStateChange}
                className="yt-iframe"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    Waiting for a song to be queued...
                  </div>
                  <div className="text-sm opacity-80">
                    Guests can scan the QR code to add songs.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* bottom control bar (non-overlapping) */}
          <div className="video-controls-bar">
            <button
              onClick={togglePlay}
              className="overlay-control bg-white text-black p-3 rounded-full shadow-lg"
              aria-label="Play/Pause"
            >
              {playState === "playing" ? (
                <FaPause size={18} />
              ) : (
                <FaPlay size={18} />
              )}
            </button>

            <button
              onClick={skip}
              className="overlay-control bg-pink-500 hover:bg-pink-400 p-3 rounded-full shadow-lg text-white"
              aria-label="Skip"
            >
              <FaStepForward size={18} />
            </button>

            <div className="ml-2 text-sm text-gray-200">
              {currentSong ? (
                <div className="font-medium">{currentSong.title}</div>
              ) : (
                <div>No song playing</div>
              )}
            </div>
          </div>

          {/* scoring popover + confetti container */}
          <div ref={confettiRef} className="confetti-container" />
          {showScore && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="score-popover pointer-events-auto">
                <div className="text-xl font-semibold">Performance Score</div>
                <div className="score-number">{displayScore}</div>
                <div className="mt-2 text-sm text-gray-600">
                  {displayScore >= 98
                    ? "Legendary performance!"
                    : displayScore >= 94
                      ? "Amazing! Crowd loved it!"
                      : displayScore >= 90
                        ? "Fantastic singing!"
                        : displayScore >= 86
                          ? "Great job!"
                          : "Nice effort!"}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="lg:col-span-3 col-span-1 bg-black/50 rounded-3xl shadow-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-pink-400 font-bold mb-3">▶ UP NEXT</h3>
            {queue.length === 0 ? (
              <p className="text-gray-400">No songs queued yet</p>
            ) : (
              <ul className="space-y-3 max-h-[60vh] overflow-auto">
                {queue.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center gap-3 bg-white/6 p-2 rounded-lg"
                  >
                    <img
                      src={item.thumbnail}
                      alt="thumb"
                      className="w-20 h-12 rounded object-cover"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm line-clamp-2">
                        {item.title}
                      </div>
                      <div className="text-xs opacity-80">Queued by guest</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 bg-white/6 p-4 rounded-xl text-center">
            <h4 className="font-semibold mb-2">Welcome to Karaoke SingGing</h4>
            <p className="text-sm text-gray-300 mb-3">
              Guests can add songs and send reactions from their phones.
            </p>
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
      <QRCodeCanvas
        value={url}
        size={120}
        bgColor="#ffffff"
        fgColor="#111827"
      />
      <div className="text-xs text-gray-300">Scan to join on mobile</div>
    </div>
  );
}
