import React, { useEffect, useState } from 'react';
import { soundManager } from '../../game/audio/soundManager';

interface CountdownOverlayProps {
  onComplete: () => void;
  active: boolean;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ onComplete, active }) => {
  const [count, setCount] = useState<number | string>(3);

  useEffect(() => {
    if (!active) {
      setCount(3);
      return;
    }

    soundManager.playCountdown(3);
    setCount(3);

    const timer1 = setTimeout(() => {
      soundManager.playCountdown(2);
      setCount(2);
    }, 1000);

    const timer2 = setTimeout(() => {
      soundManager.playCountdown(1);
      setCount(1);
    }, 2000);

    const timer3 = setTimeout(() => {
      soundManager.playCountdownGo();
      setCount('GO!');
    }, 3000);

    const timer4 = setTimeout(() => {
      onComplete();
    }, 3700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      borderRadius: 'var(--radius-md)'
    }}>
      <div
        key={count}
        style={{
          fontSize: typeof count === 'number' ? '5.5rem' : '4.5rem',
          fontWeight: 900,
          fontFamily: 'monospace',
          color: count === 'GO!' ? 'var(--accent-green)' : 'var(--accent-cyan)',
          textShadow: count === 'GO!'
            ? '0 0 25px rgba(34, 197, 94, 0.8)'
            : '0 0 25px rgba(6, 182, 212, 0.8)',
          animation: 'countdownPop 0.8s ease-out forwards'
        }}
      >
        {count}
      </div>

      <style>{`
        @keyframes countdownPop {
          0% { transform: scale(0.4); opacity: 0; }
          40% { transform: scale(1.15); opacity: 1; }
          70% { transform: scale(1.0); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
