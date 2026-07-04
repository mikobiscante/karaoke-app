import { useState } from 'react';

export default function MobileControls({ roomId }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const search = async () => {
    const res = await fetch(`/api/search?q=${query}`);
    const data = await res.json();
    setResults(data);
  };

  return (
    <div className="p-4 bg-gradient-to-r from-pink-600 to-purple-700 min-h-screen text-white">
      <h2 className="text-2xl mb-4">Search Karaoke Songs</h2>
      <input
        className="p-2 rounded text-black"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search song"
      />
      <button className="ml-2 bg-blue-600 px-4 py-2 rounded" onClick={search}>
        Search
      </button>
      <ul className="mt-4">
        {results.map(r => (
          <li key={r.id.videoId} className="mb-2">
            {r.snippet.title}
            <button className="ml-2 bg-green-600 px-2 py-1 rounded">Queue</button>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <button className="bg-red-600 px-4 py-2 rounded">Stop</button>
        <button className="bg-yellow-600 px-4 py-2 rounded ml-2">Skip</button>
        <button className="bg-green-600 px-4 py-2 rounded ml-2">Play</button>
      </div>
    </div>
  );
}
