import { useEffect, useState } from "react";

export const usePlayback = () => {
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let animationFrame = 0;
    let lastTick = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = (now - lastTick) / 1000;
      lastTick = now;
      setTime((current) => current + deltaSeconds * speed);
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isPlaying, speed]);

  return {
    time,
    isPlaying,
    speed,
    setIsPlaying,
    setSpeed,
    reset: () => setTime(0),
    setTime,
  };
};

