import React, { useEffect, useState } from 'react';
import { ApiClient } from '../services/api';
import { Trophy, Medal, Timer, Flame, Zap, RefreshCw, Swords } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';

export const LeaderboardsPage: React.FC = () => {
  const [mode, setMode] = useState<string>('marathon_150');
  const [timeframe, setTimeframe] = useState<string>('all');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { t, formatDate } = useI18n();

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getLeaderboard(mode, timeframe);
      setEntries(data.entries || []);
    } catch (e: any) {
      setError(e.message || t('Failed to load leaderboard data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [mode, timeframe]);

  const formatScoreOrTime = (entry: any) => {
    if (mode === 'elo') {
      return `${entry.score} ELO`;
    }
    if (mode.startsWith('sprint')) {
      const ms = entry.duration;
      const totalSec = (ms / 1000).toFixed(2);
      return `${totalSec}s`;
    }
    return entry.score.toLocaleString();
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span style={{ color: '#eab308', fontWeight: 800 }}>🥇 {t('1st')}</span>;
    if (rank === 2) return <span style={{ color: '#94a3b8', fontWeight: 800 }}>🥈 {t('2nd')}</span>;
    if (rank === 3) return <span style={{ color: '#b45309', fontWeight: 800 }}>🥉 {t('3rd')}</span>;
    return <span style={{ fontWeight: 600 }}>#{rank}</span>;
  };

  return (
    <div style={{ width: '100%', maxWidth: '880px' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Global Leaderboards')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('Real verified scores submitted by authenticated players.')}
        </p>
      </div>

      {/* Mode Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn-secondary ${mode === 'marathon_150' ? 'btn-primary' : ''}`}
            onClick={() => setMode('marathon_150')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
          >
            <Flame size={16} /> {t('Marathon')}
          </button>
          <button
            className={`btn-secondary ${mode === 'sprint_40' ? 'btn-primary' : ''}`}
            onClick={() => setMode('sprint_40')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
          >
            <Zap size={16} /> {t('Sprint (40L)')}
          </button>
          <button
            className={`btn-secondary ${mode === 'ultra_3m' ? 'btn-primary' : ''}`}
            onClick={() => setMode('ultra_3m')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
          >
            <Timer size={16} /> {t('Ultra (3m)')}
          </button>
          <button
            className={`btn-secondary ${mode === 'elo' ? 'btn-primary' : ''}`}
            onClick={() => setMode('elo')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem' }}
          >
            <Swords size={16} /> {t('Online PvP (ELO)')}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="all">{t('All Time')}</option>
            <option value="monthly">{t('This Month')}</option>
            <option value="weekly">{t('This Week')}</option>
            <option value="daily">{t('Today')}</option>
          </select>

          <button className="icon-btn" onClick={fetchLeaderboard} title={t('Refresh')}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="panel-card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('Loading leaderboards...')}
          </div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--accent-red)' }}>
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {t('No verified scores recorded for this category yet. Be the first to place!')}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>{t('Rank')}</th>
                <th style={{ padding: '0.75rem 1rem' }}>{t('Player')}</th>
                <th style={{ padding: '0.75rem 1rem' }}>{mode === 'elo' ? t('Rating') : mode.startsWith('sprint') ? t('Time') : t('Score')}</th>
                {mode === 'elo' ? (
                  <>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('Win / Loss')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('Games')}</th>
                  </>
                ) : (
                  <>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('Lines / Level')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>PPS</th>
                  </>
                )}
                <th style={{ padding: '0.75rem 1rem' }}>{t('Date')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{getRankBadge(entry.rank)}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{entry.display_name}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {formatScoreOrTime(entry)}
                  </td>
                  {mode === 'elo' ? (
                    <>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{entry.wins || 0}{t('W')}</span>
                        {' '}/ <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{entry.losses || 0}{t('L')}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {entry.games_played || 0}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {t('{lines} lines (Lvl {level})', { lines: entry.lines, level: entry.level })}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                        {entry.pps ? entry.pps.toFixed(2) : '-'}
                      </td>
                    </>
                  )}
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {formatDate(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
