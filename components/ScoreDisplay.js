import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Howl } from 'howler';
import Button from './ui/Button';

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
      <Button variant="primary" onClick={generateScore}>
        Finish Song & Rate
      </Button>
      {score !== null && (
        <motion.h1
          className="text-6xl font-400 mt-4 text-foreground"
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