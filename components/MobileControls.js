import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { ref, push, set, onValue } from "firebase/database";
import { db } from "../utils/firebase";
import { FaPlay, FaPause, FaStepForward, FaSearch, FaListUl } from "react-icons/fa";
import Button from "./ui/Button";
import Input from "./ui/Input";
import { Card, CardContent } from "./ui/Card";
import Badge from "./ui/Badge";

export default function MobileControls({ roomId }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [playState, setPlayState] = useState("paused");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestionsRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const qRef = ref(db, `rooms/${roomId}/queue`);
    const curRef = ref(db, `rooms/${roomId}/currentSong`);
    const pRef = ref(db, `rooms/${roomId}/playState`);

    const unsubQ = onValue(qRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([key, value]) => ({ key, ...value }));
      arr.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
      setQueue(arr);
    });

    const unsubCur = onValue(curRef, (snap) => setCurrentSong(snap.val() || null));
    const unsubP = onValue(pRef, (snap) => setPlayState(snap.val() || "paused"));

    return () => { unsubQ(); unsubCur(); unsubP(); };
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const IDLE_MS = 60 * 60 * 1000;
    let timeoutId = null;

    const clearExisting = () => {
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    };

    const resetTimer = () => {
      clearExisting();
      if (playState === "playing") return;
      timeoutId = setTimeout(() => {
        try { router.push("/"); } catch (err) { console.warn("Idle redirect failed:", err); }
      }, IDLE_MS);
    };

    const activityEvents = ["touchstart", "click", "scroll", "keydown"];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const onVisibility = () => { if (!document.hidden) resetTimer(); };
    document.addEventListener("visibilitychange", onVisibility);

    resetTimer();

    return () => {
      clearExisting();
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roomId, playState, router]);

  const search = async (q) => {
    if (!q) return;
    setShowSuggestions(false);
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.items || []);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setSuggestions(json.suggestions ? json.suggestions.slice(0, 5) : []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(val.trim());
      }, 350);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (q) => {
    if (!q) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setShowSuggestions(false);
    setSuggestions([]);
    search(q);
  };

  const selectSuggestion = (text) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery(text);
    handleSearch(text);
  };

  const handleQueue = async (item) => {
    if (!roomId) return;
    await push(ref(db, `rooms/${roomId}/queue`), {
      videoId: item.videoId, title: item.title, thumbnail: item.thumbnail, addedAt: Date.now()
    });
  };

  const handlePlayNow = async (item) => {
    if (!roomId) return;
    await set(ref(db, `rooms/${roomId}/currentSong`), {
      videoId: item.videoId, title: item.title, thumbnail: item.thumbnail
    });
    await push(ref(db, `rooms/${roomId}/queue`), {
      videoId: item.videoId, title: item.title, thumbnail: item.thumbnail, addedAt: Date.now()
    });
    await set(ref(db, `rooms/${roomId}/playState`), "playing");
  };

  const handlePausePlay = async () => {
    if (!roomId) return;
    const newState = playState === "playing" ? "paused" : "playing";
    await set(ref(db, `rooms/${roomId}/playState`), newState);
  };

  const requestSkipNoScore = async () => {
    if (!roomId) return;
    await set(ref(db, `rooms/${roomId}/skipRequestNoScore`), { requestedAt: Date.now() });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-2 sm:p-3 lg:p-4">
      <Card className="max-w-md lg:max-w-lg mx-auto border-border/60">
        <CardContent className="p-2 sm:p-3">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-400 mb-2 text-center">Karaoke SingGing</h2>

          <div className="mb-2 relative" ref={suggestionsRef}>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={handleQueryChange}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(query); }}
                placeholder="Search YouTube karaoke..."
                className="flex-1"
              />
              <Button
                onClick={() => handleSearch(query)}
                variant="secondary"
                size="default"
                disabled={loadingSearch}
              >
                <FaSearch /> {loadingSearch ? "..." : <span className="hidden sm:inline">Search</span>}
              </Button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => selectSuggestion(s)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm font-300 hover:bg-accent transition text-foreground"
                  >
                    <FaSearch className="text-muted-foreground shrink-0 text-xs" />
                    <span className="truncate">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="mb-2 bg-muted/30 p-2 sm:p-2.5 rounded-lg max-h-60 overflow-y-auto overflow-x-hidden border border-border/40">
              {results.map((r) => (
                <div key={r.videoId} className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded hover:bg-accent transition">
                  <img src={r.thumbnail} alt="" className="w-16 sm:w-20 h-10 sm:h-12 rounded object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-400 text-sm line-clamp-2 break-words">{r.title}</div>
                    <div className="text-xs text-muted-foreground font-300 truncate">{r.channelTitle}</div>
                  </div>
                  {currentSong ? (
                    <Button
                      onClick={() => handleQueue({ videoId: r.videoId, title: r.title, thumbnail: r.thumbnail })}
                      variant="secondary"
                      size="sm"
                    >
                      <FaListUl /> <span className="hidden sm:inline">Queue</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handlePlayNow({ videoId: r.videoId, title: r.title, thumbnail: r.thumbnail })}
                      variant="default"
                      size="sm"
                    >
                      <FaPlay /> <span className="hidden sm:inline">Play</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mb-2 bg-muted/20 p-2 sm:p-2.5 rounded-lg border border-border/40">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="min-w-0">
                <div className="text-sm text-muted-foreground font-300">Now Playing</div>
                <div className="font-400 truncate">{currentSong ? currentSong.title : "No song playing"}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {currentSong && (
                  <>
                    <Button onClick={handlePausePlay} variant="secondary" size="icon" aria-label="Pause/Play">
                      {playState === "playing" ? <FaPause /> : <FaPlay />}
                    </Button>
                    <Button onClick={requestSkipNoScore} variant="outline" size="icon" aria-label="Skip">
                      <FaStepForward />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1.5 font-300">Queue</div>
              {queue.length === 0 ? (
                <div className="text-xs text-muted-foreground font-300">No songs queued yet.</div>
              ) : (
                <ul className="space-y-2 max-h-40 overflow-auto">
                  {queue.map((v) => (
                    <li key={v.key} className="flex items-center gap-1.5 sm:gap-2 bg-card/50 p-1 sm:p-1.5 rounded border border-border/30">
                      <img src={v.thumbnail} alt="" className="w-16 h-10 rounded object-cover" />
                      <div className="flex-1 text-sm font-300 line-clamp-2">{v.title}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border pt-2 mt-2 text-center text-muted-foreground font-300" style={{fontSize: 13}}>
              <div className="mb-0.5">Buy me a coffee via GCash!</div>
              <div className="font-400 tracking-wider text-primary">09260560147</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}