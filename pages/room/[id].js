// pages/room/[id].js
import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, set, remove, get } from "firebase/database";
import { db } from "../../utils/firebase";
import YouTube from "react-youtube";
import { FaPlay, FaPause, FaStepForward, FaListUl, FaBars, FaTimes } from "react-icons/fa";

// top of file or component
import AdSlot from "../../components/AdSlot";
import { initAnalytics, getAnalyticsInstance } from "../../utils/firebase";
import { logEvent } from "firebase/analytics";

const ADS_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-XXXXXXXXXXXX";
const ADS_SLOT_MAIN = process.env.NEXT_PUBLIC_ADS_SLOT_MAIN || "1111111111";
const ADS_SLOT_SIDEBAR =
  process.env.NEXT_PUBLIC_ADS_SLOT_SIDEBAR || "2222222222";

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
  const [showMobileControls, setShowMobileControls] = useState(false);

  const playerRef = useRef(null);
  const scoreAnimRef = useRef(null);
  const scoringTimeoutRef = useRef(null);
  const confettiRef = useRef(null);

  // Mark room as recently active — used by cleanup API to decide if room is stale
  const lastTouchRef = useRef(0);
  const TOUCH_THROTTLE_MS = 10000;
  const touchRoom = (roomId) => {
    if (!roomId) return;
    const now = Date.now();
    if (now - lastTouchRef.current < TOUCH_THROTTLE_MS) return;
    lastTouchRef.current = now;
    set(ref(db, `rooms/${roomId}/lastActiveAt`), now).catch(() => {});
  };

  // Subscribe to Firebase nodes (queue, currentSong, playState) + mobile skip listener
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
      arr.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      setQueue(arr);
      touchRoom(id);
    });
    const unsubP = onValue(pRef, (snap) => {
      setPlayState(snap.val() || "paused");
      touchRoom(id);
    });

    // mobile no-score skip listener
    const skipNoScoreRef = ref(db, `rooms/${id}/skipRequestNoScore`);
    const unsubSkipNoScore = onValue(skipNoScoreRef, (snap) => {
      const val = snap.val();
      if (val && val.requestedAt) {
        // clear the request so it doesn't re-trigger
        set(skipNoScoreRef, null).catch(() => {});
        // call the authoritative handler on the host
        handleSkipNoScore();
      }
    });

    return () => {
      try {
        unsubCur();
      } catch (e) {}
      try {
        unsubQ();
      } catch (e) {}
      try {
        unsubP();
      } catch (e) {}
      try {
        unsubSkipNoScore();
      } catch (e) {}
    };
  }, [id]);

  // Write room marker on host mount so the room is discoverable for join validation
  useEffect(() => {
    if (!id || isMobile) return;
    set(ref(db, `rooms/${id}/_createdAt`), Date.now()).catch(() => {});
  }, [id, isMobile]);

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
      }, 500);
    } catch {}
  }, [currentSong]);

  // Idle redirect: if room is idle for 1 hour, redirect to main page
  useEffect(() => {
    if (!id) return;

    const IDLE_MS = 60 * 60 * 1000; // 1 hour
    let timeoutId = null;

    // reset timer (clears previous and starts a new one)
    const resetTimer = () => {
      touchRoom(id);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // If music is playing, do not start the idle timer
      if (playState === "playing") return;

      timeoutId = setTimeout(() => {
        // Delete the room and redirect to landing page when idle timeout fires
        remove(ref(db, `rooms/${id}`)).catch(() => {});
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

  // Redirect mobile users to landing page if room doesn't exist in Firebase
  useEffect(() => {
    if (!id || !isMobile) return;
    get(ref(db, `rooms/${id}`)).then((snap) => {
      if (!snap.exists()) router.push("/");
    }).catch(() => router.push("/"));
  }, [id, isMobile, router]);

  useEffect(() => {
    let mounted = true;
    initAnalytics().then((a) => {
      if (!mounted) return;
      if (a) logEvent(a, "analytics_initialized");
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const analytics = getAnalyticsInstance();
    if (!analytics) return;
    if (!currentSong) {
      logEvent(analytics, "ad_shown", { slot: "main", roomId: id || null });
    }
  }, [currentSong, id]);

  useEffect(() => {
    const analytics = getAnalyticsInstance();
    if (!analytics) return;
    logEvent(analytics, "ad_shown", { slot: "sidebar", roomId: id || null });
  }, [id]); // run once per room load

  // Helper: get ordered entries from snapshot object (by addedAt)
  const orderedEntries = (dataObj) => {
    const arr = Object.entries(dataObj || {}).map(([key, value]) => ({
      key,
      ...value,
    }));
    arr.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    return arr;
  };

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

  // room skip should not show score — call the authoritative no-score skip
  const skip = async () => {
    await handleSkipNoScore();
  };

  // Skip without scoring — advance queue and force autoplay on host monitor
  const handleSkipNoScore = async () => {
    if (!id) return;
    try {
      const qRef = ref(db, `rooms/${id}/queue`);
      const snap = await get(qRef);
      const data = snap.val() || {};
      const ordered = Object.entries(data || {})
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
        // set next as currentSong and request autoplay
        await set(ref(db, `rooms/${id}/currentSong`), {
          videoId: next.videoId,
          title: next.title,
          thumbnail: next.thumbnail,
        });
        await set(ref(db, `rooms/${id}/playState`), "playing");
      } else {
        // no next
        await set(ref(db, `rooms/${id}/currentSong`), null);
        await set(ref(db, `rooms/${id}/playState`), "paused");
      }
    } catch (err) {
      console.error("handleSkipNoScore failed:", err);
    }
  };

  if (!id) return null;
  if (isMobile) return <MobileControls roomId={id} />;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-800 text-white">
      <header className="relative flex items-center justify-between px-3 lg:px-6 py-1.5 lg:py-4 bg-black/30 backdrop-blur lg:rounded-none rounded-full mx-2 mt-2 lg:mx-0 lg:mt-0 z-40">
        <div className="flex items-center gap-2 lg:gap-3">
          <img
            src="/logo-singging.png"
            alt="Karaoke SingGing"
            className="h-8 lg:h-10"
          />
          <div className="hidden lg:block">
            <div className="text-lg font-bold">Karaoke SingGing</div>
          </div>
          <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded-full">
            ROOM — {id}
          </span>
        </div>

        <button
          className="lg:hidden p-2 text-white hover:bg-white/10 rounded-full transition"
          onClick={() => setShowMobileControls((prev) => !prev)}
          aria-label="Toggle controls"
        >
          {showMobileControls ? <FaTimes size={18} /> : <FaBars size={18} />}
        </button>

        <div className="hidden lg:block">
          <HostControls
            roomId={id}
            onExitRedirect={() => router.push("/")}
            onSkipNoScore={handleSkipNoScore}
          />
        </div>

        {showMobileControls && (
          <div className="absolute top-full right-0 lg:hidden mt-2 bg-gray-900/95 backdrop-blur rounded-xl p-3 shadow-xl z-50 min-w-[200px]">
            <HostControls
              roomId={id}
              onExitRedirect={() => router.push("/")}
              onSkipNoScore={handleSkipNoScore}
            />
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-2 lg:gap-4 p-2 lg:p-4 min-h-0 lg:overflow-hidden">
        {/* Video column */}
        <section className="lg:flex-[9] lg:min-w-0 bg-black/70 rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-0 max-lg:min-h-[45vh] relative">
          <div className="yt-wrapper flex-1 min-h-0">
            {currentSong ? (
              <YouTube
                videoId={currentSong.videoId}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: {
                    autoplay: 1,
                    controls: 1,
                    modestbranding: 1,
                    rel: 0,
                    playsinline: 1,
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
                  <div className="text-sm opacity-80 mb-2">
                    Guests can scan the QR code to add songs.
                  </div>
                  <div
                    className="ad-container main-ad"
                    style={{ width: "100%", minHeight: 250 }}
                  >
                    <AdSlot
                      client={ADS_CLIENT}
                      slot={ADS_SLOT_MAIN}
                      responsive={true}
                    />
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
        <aside className="lg:flex-[3] lg:min-w-0 bg-black/50 rounded-3xl shadow-2xl p-3 lg:p-4 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 lg:overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-pink-400 font-bold">▶ UP NEXT</h3>
              {queue.length > 0 && (
                <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full font-medium">{queue.length}</span>
              )}
            </div>
            {queue.length === 0 ? (
              <p className="text-gray-400 text-sm">No songs queued yet</p>
            ) : (
              <ul className="space-y-2">
                {queue.map((item) => {
                  const isCurrentSong = item.key === queue[0]?.key;
                  return (
                    <li
                      key={item.key}
                      className={`flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-lg ${
                        isCurrentSong
                          ? "bg-pink-600/20 ring-1 ring-pink-400/50"
                          : "bg-white/6"
                      }`}
                    >
                      <img
                        src={item.thumbnail}
                        alt="thumb"
                        className="w-16 lg:w-20 h-10 lg:h-12 rounded object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm line-clamp-2 break-words">
                          {item.title}
                        </div>
                        <div className={`text-xs truncate ${isCurrentSong ? "text-pink-300 font-medium" : "opacity-80"}`}>
                          {isCurrentSong ? "♪ Now Playing" : "Queued by guest"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div
            className="ad-container sidebar-ad w-full shrink-0"
            style={{ minHeight: 100 }}
          >
            <AdSlot
              client={ADS_CLIENT}
              slot={ADS_SLOT_SIDEBAR}
              responsive={true}
            />
          </div>

          <div className="bg-white/6 p-2 sm:p-3 rounded-xl text-center shrink-0">
            <p className="text-sm text-gray-300 mb-2">Scan to Add/Queue Songs</p>
            <div className="flex items-center justify-center">
              <QRCodeClient roomId={id} />
            </div>
            <div className="mt-2 text-xs text-gray-300">
              <div>Buy me a coffee via GCash</div>
              <div className="font-bold tracking-wider text-pink-200">09260560147</div>
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
