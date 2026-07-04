import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Howl } from 'howler';

export default function ScoreDisplay({ roomId }) {
  const [score, setScore] = useState(null);

  useEffect(() => {
    if (score !== null) {
      const drum = new Howl({ src: ['/drumroll.mp3'] });
      drum.play();
    }
  }, [score]);

  const generateScore = () => {
    let s = 80 + Math.floor(Math.random() * 19);
    if (Math.random() < 0.05) s = 99;
    if (Math.random() < 0.02) s = 100;
    setScore(s);
  };

  return (
    <div className="mt-6">
      <button className="bg-purple-600 px-4 py-2 rounded" onClick={generateScore}>
        Finish Song & Rate
      </button>
      {score !== null && (
        <motion.h1
          className="text-6xl font-bold mt-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2 }}
        >
          {score}
        </motion.h1>
      )}
    </div>
  );
}
