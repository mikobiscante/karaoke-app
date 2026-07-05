import { useRouter } from "next/router";
import { v4 as uuidv4 } from "uuid";
import {
  FaMobileAlt,
  FaClock,
  FaTv,
  FaYoutube,
  FaArrowRight,
  FaQrcode,
} from "react-icons/fa";

export default function Home() {
  const router = useRouter();

  const createRoom = () => {
    const roomId = uuidv4().slice(0, 8);
    router.push(`/room/${roomId}`);
  };

  const joinRoom = () => {
    const code = prompt("Enter room code:");
    if (code) router.push(`/room/${code}?mobile=true`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-800 text-white flex flex-col items-center justify-center p-8">
      {/* Header */}
      <header className="w-full flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <img src="/logo-singging.png" alt="Karaoke SingGing" className="h-10" />
          <h1 className="text-2xl font-bold tracking-wide">Karaoke SingGing</h1>
        </div>
        <div className="text-sm font-semibold text-pink-400">💯 100% Free</div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl w-full grid grid-cols-2 gap-10 items-center">
        {/* Left Text */}
        <div>
          <h2 className="text-5xl font-extrabold leading-tight mb-4 drop-shadow-lg">
            QUEUE KARAOKE SONGS FROM <span className="text-pink-500">ANY PHONE</span>.
          </h2>
          <p className="text-lg text-gray-200 mb-6">
            Guests scan a room code, search songs, and add them instantly. The host controls playback on this screen.
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-300 mb-8">
            <div className="flex items-center gap-2">
              <FaMobileAlt className="text-pink-400" /> No App Required
            </div>
            <div className="flex items-center gap-2">
              <FaClock className="text-cyan-400" /> Real‑Time Queue
            </div>
            <div className="flex items-center gap-2">
              <FaTv className="text-indigo-400" /> Works on Any Device
            </div>
            <div className="flex items-center gap-2">
              <FaYoutube className="text-red-500" /> YouTube Karaoke Support
            </div>
          </div>

          {/* Action Panels */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-indigo-900/60 to-purple-800/60 rounded-xl p-6 shadow-xl border border-indigo-700 hover:shadow-pink-500/40 transition-all duration-300">
              <h3 className="text-xl font-bold mb-2">HOST THE ROOM</h3>
              <p className="text-sm text-gray-300 mb-4">Create a room and display the queue on your TV.</p>
              <button
                onClick={createRoom}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-5 py-3 rounded-lg flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Create Room <FaArrowRight />
              </button>
            </div>

            <div className="bg-gradient-to-br from-pink-900/60 to-purple-800/60 rounded-xl p-6 shadow-xl border border-pink-700 hover:shadow-cyan-500/40 transition-all duration-300">
              <h3 className="text-xl font-bold mb-2">JOIN THE ROOM</h3>
              <p className="text-sm text-gray-300 mb-4">Use your phone to join an existing session.</p>
              <button
                onClick={joinRoom}
                className="bg-pink-500 hover:bg-pink-400 text-black font-semibold px-5 py-3 rounded-lg flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-lg"
              >
                Join Room <FaQrcode />
              </button>
            </div>
          </div>
        </div>

        {/* Right Visual */}
        <div className="bg-black/40 rounded-3xl p-6 shadow-2xl flex flex-col justify-between hover:shadow-pink-500/30 transition-all duration-300">
          <h3 className="text-pink-400 font-bold mb-4">HOW IT WORKS</h3>
          <ul className="space-y-4 text-sm text-gray-300">
            <li>
              <span className="font-semibold text-cyan-400">1. Scan or Enter Code →</span> Guests scan the QR or enter the room code on their phones.
            </li>
            <li>
              <span className="font-semibold text-indigo-400">2. Search & Add Songs →</span> Find YouTube karaoke songs and add them to the queue.
            </li>
            <li>
              <span className="font-semibold text-pink-400">3. Sing Together →</span> The host controls playback for everyone on this screen.
            </li>
          </ul>
          <div className="mt-8 text-xs text-gray-400 text-center">
            Karaoke SingGing v1.0 — 100% Free
          </div>
        </div>
      </section>
    </div>
  );
}
