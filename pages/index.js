import { useState } from 'react';
import QRCodeDisplay from '../components/QRCodeDisplay';

export default function Home() {
  const [roomName, setRoomName] = useState('');
  const [created, setCreated] = useState(false);

  const handleCreate = () => {
    // TODO: Save room in Firebase
    setCreated(true);
  };

  return (
    <div className="bg-gradient-to-r from-purple-900 to-blue-900 min-h-screen flex flex-col items-center justify-center text-white">
      <h1 className="text-4xl font-bold mb-6">🎤 Karaoke Rooms</h1>
      <input
        className="p-2 rounded text-black"
        value={roomName}
        onChange={e => setRoomName(e.target.value)}
        placeholder="Room name"
      />
      <button
        className="mt-4 bg-pink-600 px-4 py-2 rounded"
        onClick={handleCreate}
      >
        Create Room
      </button>
      {created && <QRCodeDisplay roomName={roomName} />}
    </div>
  );
}
