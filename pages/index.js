// pages/index.js
import { useRouter } from "next/router";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [joinId, setJoinId] = useState("");

  const createRoom = () => {
    const roomId = uuidv4().slice(0, 8);
    router.push(`/room/${roomId}`);
  };

  const joinRoom = () => {
    if (!joinId) return;
    router.push(`/room/${joinId}?mobile=true`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-900 via-purple-800 to-pink-700 text-white p-6">
      <div className="max-w-2xl w-full bg-white/5 backdrop-blur rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-extrabold mb-4">Karaoke Live</h1>
        <p className="mb-6 text-indigo-100">Host a room on your monitor or join from your phone.</p>

        <div className="space-y-4">
          <button onClick={createRoom} className="w-full bg-pink-500 hover:bg-pink-600 py-3 rounded-lg font-semibold shadow">
            Create Room (Host on Monitor)
          </button>

          <div className="flex gap-2">
            <input value={joinId} onChange={(e)=>setJoinId(e.target.value)} placeholder="Enter room id" className="flex-1 px-3 py-2 rounded-lg text-black" />
            <button onClick={joinRoom} className="bg-indigo-600 hover:bg-indigo-700 px-4 rounded-lg">Join (Phone)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
