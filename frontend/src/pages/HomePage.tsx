import React, { useEffect, useState } from 'react';
import { Play, Swords, Globe, Zap, Timer, Flame, Trophy, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../services/api';

interface HomePageProps {
  onSelectMode: (mode: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectMode }) => {
  const { isGuest, user } = useAuth();

  const [newsMessage, setNewsMessage] = useState('');

  useEffect(() => {
    ApiClient.getNews().then(data => {
      if (data.message) setNewsMessage(data.message);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: '960px', textAlign: 'center', marginTop: '1rem' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem'
        }}>
          Nint
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          “Nint is not Tetris.”
        </p>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '0.4rem', maxWidth: '600px', margin: '0.4rem auto 0' }}>
          A modern, high-performance, Guideline-compliant online falling-block puzzle game.
        </p>

        {isGuest && (
          <div style={{
            display: 'inline-block',
            marginTop: '1rem',
            padding: '0.4rem 0.8rem',
            background: 'var(--bg-tertiary)',
            borderRadius: '999px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)'
          }}>
            Playing as <strong>Guest</strong> (Local progress only. Sign in to climb global leaderboards!)
          </div>
        )}
        {newsMessage && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            marginTop: '1rem', padding: '0.75rem 1rem',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'left', maxWidth: '600px', margin: '1rem auto 0'
          }}>
            <Megaphone size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{newsMessage}</span>
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
        textAlign: 'left'
      }}>
        {/* Marathon */}
        <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onSelectMode('marathon')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
              <Flame size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Marathon</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>150 Lines or Endless</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Classic endurance. Clear lines as gravity speeds up every 10 lines. Push for the highest score!
          </p>
        </div>

        {/* Sprint */}
        <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onSelectMode('sprint')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'rgba(234, 179, 8, 0.2)', color: 'var(--accent-yellow)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
              <Zap size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Sprint (40 Lines)</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Speedrun Attack</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Clear 40 lines as fast as humanly possible. Test your DAS handling and execution speed.
          </p>
        </div>

        {/* Ultra */}
        <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onSelectMode('ultra')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'rgba(236, 72, 153, 0.2)', color: 'var(--accent-pink)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
              <Timer size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Ultra</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>3 Minutes Score Attack</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Score as many points as possible before the 3-minute timer runs out. Maximize B2B and T-Spins.
          </p>
        </div>

        {/* Player vs CPU */}
        <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onSelectMode('versus_ai')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
              <Swords size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Player vs CPU</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>10 Difficulty Tiers</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Battle against an intelligent AI opponent with realistic reaction times, flat stacking, and downstacking.
          </p>
        </div>

        {/* Online Player vs Player */}
        <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onSelectMode('online')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-green)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
              <Globe size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Online Player vs Player</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Live Room & Matchmaking</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Play online matches with friends via room codes or jump into quick matchmaking.
          </p>
        </div>

        {/* Practice / Zen */}
        <div className="panel-card" role="button" tabIndex={0} style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s' }} onClick={() => onSelectMode('zen')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)', padding: '0.6rem', borderRadius: 'var(--radius-sm)' }}>
              <Play size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Zen & Custom Practice</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Endless Relaxation</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            No pressure, no game-over speedups. Configure starting parameters and practice setups freely.
          </p>
        </div>
      </div>
    </div>
  );
};
