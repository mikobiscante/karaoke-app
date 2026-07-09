import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { ref, onValue, set, remove, get } from "firebase/database";
import { db } from "../../utils/firebase";
import YouTube from "react-youtube";
import { FaPlay, FaPause, FaStepForward, FaBars, FaTimes } from "react-icons/fa";

import AdSlot from "../../components/AdSlot";
import { initAnalytics, getAnalyticsInstance } from "../../utils/firebase";
import { logEvent } from "firebase/analytics";
import Button from "../../components/ui/Button";

import Badge from "../../components/ui/Badge";

const ADS_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-XXXXXXXXXXXX";
const ADS_SLOT_MAIN = process.env.NEXT_PUBLIC_ADS_SLOT_MAIN || "1111111111";
const ADS_SLOT_SIDEBAR = process.env.NEXT_PUBLIC_ADS_SLOT_SIDEBAR || "2222222222";

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
  const [showScore, setShowScore] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [showMobileControls, setShowMobileControls] = useState(false);

  const playerRef = useRef(null);
  const scoreAnimRef = useRef(null);
  const scoringTimeoutRef = useRef(null);
  const advanceTimeoutRef = useRef(null);
  const scoredRef = useRef(false);
  const confettiRef = useRef(null);

  const lastTouchRef = useRef(0);
  const TOUCH_THROTTLE_MS = 10000;
  const touchRoom = (roomId) => {
    if (!roomId) return;
    const now = Date.now();
    if (now - lastTouchRef.current < TOUCH_THROTTLE_MS) return;
    lastTouchRef.current = now;
    set(ref(db, `rooms/${roomId}/lastActiveAt`), now).catch(() => {});
  };

  useEffect(() => {
    if (!id) return;
    const curRef = ref(db, `rooms/${id}/currentSong`);
    const qRef = ref(db, `rooms/${id}/queue`);
    const pRef = ref(db, `rooms/${id}/playState`);

    const unsubCur = onValue(curRef, (snap) => setCurrentSong(snap.val() || null));
    const unsubQ = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([key, value]) => ({ key, ...value }));
      arr.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      setQueue(arr);
      touchRoom(id);
    });
    const unsubP = onValue(pRef, (snap) => {
      setPlayState(snap.val() || "paused");
      touchRoom(id);
    });

    const skipNoScoreRef = ref(db, `rooms/${id}/skipRequestNoScore`);
    const unsubSkipNoScore = onValue(skipNoScoreRef, (snap) => {
      const val = snap.val();
      if (val && val.requestedAt) {
        set(skipNoScoreRef, null).catch(() => {});
        handleSkipNoScore();
      }
    });

    return () => {
      try { unsubCur(); } catch (e) {}
      try { unsubQ(); } catch (e) {}
      try { unsubP(); } catch (e) {}
      try { unsubSkipNoScore(); } catch (e) {}
    };
  }, [id]);

  useEffect(() => {
    if (!id || isMobile) return;
    set(ref(db, `rooms/${id}/_createdAt`), Date.now()).catch(() => {});
  }, [id, isMobile]);

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (playState === "playing") playerRef.current.playVideo?.();
      else playerRef.current.pauseVideo?.();
    } catch {}
  }, [playState]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (!currentSong) {
      try { playerRef.current.stopVideo?.(); } catch {}
      return;
    }
    scoredRef.current = false;
    if (scoringTimeoutRef.current) { clearTimeout(scoringTimeoutRef.current); scoringTimeoutRef.current = null; }
    if (advanceTimeoutRef.current) { clearTimeout(advanceTimeoutRef.current); advanceTimeoutRef.current = null; }
    stopConfetti();
    setShowScore(false);
    setDisplayScore(0);
    try {
      playerRef.current.loadVideoById(currentSong.videoId);
      setTimeout(() => {
        try { playerRef.current.playVideo?.(); } catch {}
      }, 500);
    } catch {}
  }, [currentSong]);

  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || !player.getDuration || playState !== "playing") return;
      if (scoredRef.current || !currentSong) return;
      const duration = player.getDuration();
      const current = player.getCurrentTime();
      const remaining = duration - current;
      if (remaining > 0 && remaining <= 12) {
        scoredRef.current = true;
        const score = 80 + Math.floor(Math.random() * 21);
        startScoreSequence(score, remaining);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [playState, currentSong]);

  useEffect(() => {
    if (!id) return;
    const IDLE_MS = 60 * 60 * 1000;
    let timeoutId = null;

    const resetTimer = () => {
      touchRoom(id);
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      if (playState === "playing") return;
      timeoutId = setTimeout(() => {
        remove(ref(db, `rooms/${id}`)).catch(() => {});
        try { router.push("/"); } catch (err) { console.warn("Idle redirect failed:", err); }
      }, IDLE_MS);
    };

    const activityEvents = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const onVisibility = () => { if (!document.hidden) resetTimer(); };
    document.addEventListener("visibilitychange", onVisibility);

    resetTimer();

    return () => {
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener("visibilitychange", onVisibility);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, playState, router]);

  useEffect(() => {
    if (!id) return;
    const roomRef = ref(db, `rooms/${id}`);
    const unsub = onValue(roomRef, (snap) => {
      if (!snap.exists()) {
        try { router.push("/"); } catch (err) { console.warn("Room gone, redirect failed:", err); }
      }
    });
    return () => unsub();
  }, [id, router]);

  useEffect(() => {
    let mounted = true;
    initAnalytics().then((a) => {
      if (!mounted) return;
      if (a) logEvent(a, "analytics_initialized");
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const analytics = getAnalyticsInstance();
    if (!analytics) return;
    if (!currentSong) { logEvent(analytics, "ad_shown", { slot: "main", roomId: id || null }); }
  }, [currentSong, id]);

  useEffect(() => {
    const analytics = getAnalyticsInstance();
    if (!analytics) return;
    logEvent(analytics, "ad_shown", { slot: "sidebar", roomId: id || null });
  }, [id]);

  const advanceQueue = async () => {
    if (!id) return;
    const qRef = ref(db, `rooms/${id}/queue`);
    const snap = await get(qRef);
    const data = snap.val() || {};
    const ordered = Object.entries(data).map(([key, value]) => ({ key, ...value })).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

    if (ordered.length === 0) {
      await set(ref(db, `rooms/${id}/currentSong`), null);
      await set(ref(db, `rooms/${id}/playState`), "paused");
      return;
    }

    const firstKey = ordered[0].key;
    const next = ordered[1] || null;

    await remove(ref(db, `rooms/${id}/queue/${firstKey}`));

    if (next) {
      await set(ref(db, `rooms/${id}/currentSong`), { videoId: next.videoId, title: next.title, thumbnail: next.thumbnail });
      await set(ref(db, `rooms/${id}/playState`), "playing");
    } else {
      await set(ref(db, `rooms/${id}/currentSong`), null);
      await set(ref(db, `rooms/${id}/playState`), "paused");
    }
  };

  const onPlayerStateChange = async (e) => {
    if (e.data === 0 && id && !scoredRef.current) {
      scoredRef.current = true;
      const score = 80 + Math.floor(Math.random() * 21);
      startScoreSequence(score, 0);
    }
  };

  const startScoreSequence = (score, remainingAtTrigger) => {
    if (scoreAnimRef.current) cancelAnimationFrame(scoreAnimRef.current);
    if (scoringTimeoutRef.current) clearTimeout(scoringTimeoutRef.current);
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);

    const countDuration = 3000;
    const pauseAfter = 5000;
    const showDuration = countDuration + pauseAfter;

    setDisplayScore(0);
    setShowScore(true);
    launchConfetti();

    const sfx = new Audio("/sounds/score-fanfare.m4a");
    sfx.currentTime = 2;
    sfx.play().catch(() => {});

    const start = performance.now();
    const from = 0;
    const to = score;

    const step = (now) => {
      const t = Math.min(1, (now - start) / countDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.floor(from + (to - from) * eased);
      setDisplayScore(current);
      if (t < 1) scoreAnimRef.current = requestAnimationFrame(step);
      else scoreAnimRef.current = null;
    };
    scoreAnimRef.current = requestAnimationFrame(step);

    scoringTimeoutRef.current = setTimeout(() => {
      stopConfetti();
      setShowScore(false);
      setDisplayScore(0);
      scoringTimeoutRef.current = null;
      sfx.pause();
      sfx.currentTime = 0;
    }, showDuration);

    const advanceDelayMs = Math.max(0, (remainingAtTrigger - 2) * 1000);
    advanceTimeoutRef.current = setTimeout(async () => {
      advanceTimeoutRef.current = null;
      try {
        await advanceQueue();
      } catch (err) {
        console.error("advanceQueue failed:", err);
      }
    }, advanceDelayMs);
  };

  const launchConfetti = () => {
    const container = confettiRef.current;
    if (!container) return;
    container.innerHTML = "";
    const pieces = 40;
    const colors = Array.from({ length: 3 }, () => {
      const h = Math.floor(Math.random() * 360);
      const s = 30 + Math.floor(Math.random() * 31);
      const l = 80 + Math.floor(Math.random() * 11);
      return `hsl(${h}, ${s}%, ${l}%)`;
    });
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
      el.animate([
        { transform: `translateY(0px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0.1 },
      ], { duration: 2200 + Math.random() * 800, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    }
    setTimeout(() => { if (container) container.innerHTML = ""; }, 3200);
  };

  const stopConfetti = () => {
    const container = confettiRef.current;
    if (container) container.innerHTML = "";
  };

  const togglePlay = async () => {
    if (!id) return;
    const newState = playState === "playing" ? "paused" : "playing";
    await set(ref(db, `rooms/${id}/playState`), newState);
  };

  const skip = async () => {
    await handleSkipNoScore();
  };

  const handleSkipNoScore = async () => {
    if (!id) return;
    try {
      const qRef = ref(db, `rooms/${id}/queue`);
      const snap = await get(qRef);
      const data = snap.val() || {};
      const ordered = Object.entries(data || {}).map(([key, value]) => ({ key, ...value })).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

      if (ordered.length === 0) {
        await set(ref(db, `rooms/${id}/currentSong`), null);
        await set(ref(db, `rooms/${id}/playState`), "paused");
        return;
      }

      const firstKey = ordered[0].key;
      const next = ordered[1] || null;

      await remove(ref(db, `rooms/${id}/queue/${firstKey}`));

      if (next) {
        await set(ref(db, `rooms/${id}/currentSong`), { videoId: next.videoId, title: next.title, thumbnail: next.thumbnail });
        await set(ref(db, `rooms/${id}/playState`), "playing");
      } else {
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
    <div className="min-h-screen lg:h-screen flex flex-col lg:flex-row bg-background text-foreground">
      <div className="flex-1 flex flex-col min-h-0">
        <header className="relative shrink-0 flex items-center justify-between px-3 lg:px-6 py-2 bg-card border-b border-border z-40">
        <div className="flex items-center gap-2 lg:gap-3">
          <img src="/logo-singging.png" alt="Karaoke SingGing" className="h-8 lg:h-10" />
          <div className="hidden lg:block">
            <div className="text-lg font-400">Karaoke SingGing</div>
          </div>
          <Badge variant="outline">ROOM — {id}</Badge>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setShowMobileControls((prev) => !prev)}
          aria-label="Toggle controls"
        >
          {showMobileControls ? <FaTimes size={18} /> : <FaBars size={18} />}
        </Button>

        <div className="hidden lg:block">
          <HostControls roomId={id} onExitRedirect={() => router.push("/")} onSkipNoScore={handleSkipNoScore} />
        </div>

        {showMobileControls && (
          <div className="absolute top-full right-0 lg:hidden mt-2 bg-card border border-border rounded-xl p-3 shadow-xl z-50 min-w-[200px]">
            <HostControls roomId={id} onExitRedirect={() => router.push("/")} onSkipNoScore={handleSkipNoScore} />
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden p-2 lg:p-4">
        <section className="lg:flex-[9] lg:min-w-0 bg-card/70 border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-0 max-lg:min-h-[45vh] relative">
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
                    try { e.target.playVideo?.(); } catch {}
                  }
                }}
                onStateChange={onPlayerStateChange}
                className="yt-iframe"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-400 mb-2 text-muted-foreground">Waiting for a song to be queued...</div>
                  <div className="text-sm text-muted-foreground font-300 mb-2">Guests can scan the QR code to add songs.</div>
                  <div className="ad-container main-ad" style={{ width: "100%", minHeight: 250 }}>
                    <AdSlot client={ADS_CLIENT} slot={ADS_SLOT_MAIN} responsive={true} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 sm:gap-3 items-center justify-center p-2 sm:p-3 bg-card border-t border-border">
            <Button variant="ghost" size="icon" onClick={togglePlay} aria-label="Play/Pause">
              {playState === "playing" ? <FaPause size={18} /> : <FaPlay size={18} />}
            </Button>
            <Button variant="secondary" size="icon" onClick={skip} aria-label="Skip">
              <FaStepForward size={18} />
            </Button>
            <div className="ml-2 text-sm text-muted-foreground font-300">
              {currentSong ? <span className="font-400 text-foreground">{currentSong.title}</span> : <span>No song playing</span>}
            </div>
          </div>

          <div ref={confettiRef} className="confetti-container" />
          {showScore && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="score-popover pointer-events-auto">
                <div className="text-2xl font-400">Performance Score</div>
                <div className="score-number">{displayScore}</div>
                <div className="mt-2 text-base text-muted-foreground">
                  {displayScore >= 98 ? "Legendary performance!" : displayScore >= 94 ? "Amazing! Crowd loved it!" : displayScore >= 90 ? "Fantastic singing!" : displayScore >= 86 ? "Great job!" : "Nice effort!"}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>

      <aside className="lg:w-80 xl:w-96 bg-card lg:border-l border-border max-lg:border-t flex flex-col min-h-0 overflow-hidden">
          <div className="shrink-0 px-3 lg:px-4 pt-3 lg:pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-primary font-400">UP NEXT</h3>
              {queue.length > 0 && (
                <Badge variant="secondary">{queue.length}</Badge>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 lg:px-4 pb-3 lg:pb-4">
            {queue.length === 0 ? (
              <p className="text-muted-foreground text-sm font-300">No songs queued yet</p>
            ) : (
              <ul className="space-y-2">
                {queue.map((item) => {
                  const isNowPlaying = item.key === queue[0]?.key;
                  return (
                    <li
                      key={item.key}
                      className={`flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-lg ${
                        isNowPlaying ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/30"
                      }`}
                    >
                      <img src={item.thumbnail} alt="thumb" className="w-16 lg:w-20 h-10 lg:h-12 rounded object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-400 text-sm line-clamp-2 break-words">{item.title}</div>
                        <div className={`text-xs truncate font-300 ${isNowPlaying ? "text-primary" : "text-muted-foreground"}`}>
                          {isNowPlaying ? "Now Playing" : "Queued by guest"}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="ad-container sidebar-ad w-full shrink-0 mt-3" style={{ minHeight: 100 }}>
              <AdSlot client={ADS_CLIENT} slot={ADS_SLOT_SIDEBAR} responsive={true} />
            </div>
          </div>

          <div className="shrink-0 border-t border-border p-3 lg:p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2 font-300">Scan to Add/Queue Songs</p>
            <div className="flex items-center justify-center">
              <QRCodeClient roomId={id} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground font-300">
              <div>Buy me a coffee via GCash</div>
              <div className="font-400 tracking-wider text-primary">09260560147</div>
            </div>
          </div>
        </aside>
    </div>
  );
}

function QRCodeClient({ roomId }) {
  if (typeof window === "undefined") return null;
  const url = `${window.location.origin}/room/${roomId}?mobile=true`;
  return (
    <div className="flex flex-col items-center gap-2">
      <QRCodeCanvas value={url} size={120} bgColor="#ffffff" fgColor="#0a0a0f" />
      <div className="text-xs text-muted-foreground font-300">Scan to join on mobile</div>
    </div>
  );
}