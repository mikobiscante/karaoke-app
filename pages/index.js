import { useRouter } from "next/router";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";
import { ref, get } from "firebase/database";
import { db } from "../utils/firebase";
import {
  FaMobileAlt, FaClock, FaTv, FaYoutube, FaArrowRight, FaQrcode,
} from "react-icons/fa";
import Button from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";

export default function Home() {
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  const createRoom = () => {
    const roomId = uuidv4().slice(0, 8);
    router.push(`/room/${roomId}`);
  };

  const joinRoom = async () => {
    const code = prompt("Enter room code:");
    if (!code) return;
    setJoining(true);
    try {
      const snap = await get(ref(db, `rooms/${code}`));
      if (!snap.exists()) {
        alert(`Room "${code}" not found. Please check the code and try again.`);
        return;
      }
      router.push(`/room/${code}?mobile=true`);
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="w-full flex justify-between items-center gap-2 p-3 sm:px-8 sm:py-6 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img src="/logo-singging.png" alt="Karaoke SingGing" className="h-8 sm:h-10 shrink-0" />
          <h1 className="text-lg sm:text-xl lg:text-2xl font-400 tracking-wide">Karaoke SingGing</h1>
        </div>
        <div className="text-xs sm:text-sm font-300 text-muted-foreground shrink-0">100% Free</div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 pt-0">
        <section className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl xl:text-5xl font-400 leading-tight mb-4">
              QUEUE KARAOKE SONGS FROM <span className="text-primary">ANY PHONE</span>.
            </h2>
            <p className="text-lg text-muted-foreground mb-4 font-300">
              Guests scan a room code, search songs, and add them instantly. The host controls playback on this screen.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground mb-6 font-300">
              <div className="flex items-center gap-2"><FaMobileAlt className="text-primary" /> No App Required</div>
              <div className="flex items-center gap-2"><FaClock className="text-primary" /> Real-Time Queue</div>
              <div className="flex items-center gap-2"><FaTv className="text-primary" /> Works on Any Device</div>
              <div className="flex items-center gap-2"><FaYoutube className="text-destructive" /> YouTube Karaoke Support</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-border/60">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-xl font-400 mb-2">HOST THE ROOM</h3>
                  <p className="text-sm text-muted-foreground mb-3 font-300">Create a room and display the queue on your TV.</p>
                  <Button onClick={createRoom} size="lg" className="w-full">
                    Create Room <FaArrowRight />
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-xl font-400 mb-2">JOIN THE ROOM</h3>
                  <p className="text-sm text-muted-foreground mb-3 font-300">Use your phone to join an existing session.</p>
                  <Button onClick={joinRoom} disabled={joining} variant="secondary" size="lg" className="w-full">
                    {joining ? "Checking..." : "Join Room"} <FaQrcode />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="bg-card/40 p-4 border-border/60">
            <CardContent className="p-0">
              <h3 className="text-primary font-400 mb-3">HOW IT WORKS</h3>
              <ul className="space-y-3 text-sm text-muted-foreground font-300">
                <li><span className="font-400 text-foreground">1. Scan or Enter Code</span> Guests scan the QR or enter the room code on their phones.</li>
                <li><span className="font-400 text-foreground">2. Search & Add Songs</span> Find YouTube karaoke songs and add them to the queue.</li>
                <li><span className="font-400 text-foreground">3. Sing Together</span> The host controls playback for everyone on this screen.</li>
              </ul>
              <div className="mt-6 text-xs text-muted-foreground text-center font-300">Karaoke SingGing v1.0 &middot; 100% Free</div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}