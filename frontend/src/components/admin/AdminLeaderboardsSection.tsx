import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Flame, RefreshCw, Skull, Swords, Timer, Trash2, Zap } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useI18n } from '../../i18n/useI18n';
import { UserName } from '../user/UserName';

type LeaderboardMode = 'marathon_150' | 'sprint_40' | 'ultra_3m' | 'boss_attack' | 'elo';

const MODES: { id: LeaderboardMode; label: string; icon: React.ReactNode }[] = [
  { id: 'marathon_150', label: 'Marathon', icon: <Flame size={16} /> },
  { id: 'sprint_40', label: 'Sprint (40L)', icon: <Zap size={16} /> },
  { id: 'ultra_3m', label: 'Ultra (3m)', icon: <Timer size={16} /> },
  { id: 'boss_attack', label: 'Boss Battle', icon: <Skull size={16} /> },
  { id: 'elo', label: 'Online PvP (ELO)', icon: <Swords size={16} /> }
];

export const AdminLeaderboardsSection: React.FC = () => {
  const { t, formatDate } = useI18n();
  const [mode, setMode] = useState<LeaderboardMode>('marathon_150');
  const [timeframe, setTimeframe] = useState('all');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ApiClient.getLeaderboard(mode, timeframe);
      setEntries((data.entries || []).slice(0, 10));
    } catch (e: any) {
      setError(e?.message || t('Failed to load leaderboard data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLeaderboard();
  }, [mode, timeframe]);

  const formatValue = (entry: any) => {
    if (mode === 'elo') return `${entry.score} ELO`;
    if (mode === 'sprint_40') return `${(entry.duration / 1000).toFixed(2)}s`;
    return Number(entry.score || 0).toLocaleString();
  };

  const handleReset = async () => {
    setResetting(true);
    setResetError(null);
    setResetSuccess(false);
    try {
      await ApiClient.clearLeaderboards();
      setShowResetConfirm(false);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
      await loadLeaderboard();
    } catch (e: any) {
      setResetError(e?.message || t('Failed to clear leaderboards.'));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="panel-card" style={{ padding: '1.25rem', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`btn-secondary ${mode === item.id ? 'btn-primary' : ''}`}
                onClick={() => setMode(item.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.8rem', fontSize: '0.82rem' }}
              >
                {item.icon} {t(item.label)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {mode !== 'elo' && (
              <select
                value={timeframe}
                onChange={(event) => setTimeframe(event.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem'
                }}
              >
                <option value="all">{t('All Time')}</option>
                <option value="monthly">{t('This Month')}</option>
                <option value="weekly">{t('This Week')}</option>
                <option value="daily">{t('Today')}</option>
              </select>
            )}
            <button className="icon-btn" type="button" onClick={() => void loadLeaderboard()} title={t('Refresh')}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{t('Top 10')}</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t('Global Leaderboards')}</span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('Loading leaderboards...')}
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-red)', fontSize: '0.85rem' }}>{error}</div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('No verified scores recorded for this category yet. Be the first to place!')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.55rem 0.6rem' }}>{t('Rank')}</th>
                  <th style={{ padding: '0.55rem 0.6rem' }}>{t('Player')}</th>
                  <th style={{ padding: '0.55rem 0.6rem' }}>{mode === 'elo' ? t('Rating') : mode === 'sprint_40' ? t('Time') : t('Score')}</th>
                  <th style={{ padding: '0.55rem 0.6rem' }}>{t('Date')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.55rem 0.6rem', fontWeight: 700 }}>#{entry.rank}</td>
                    <td style={{ padding: '0.55rem 0.6rem' }}>
                      <UserName
                        displayName={entry.display_name}
                        cosmetics={{
                          name_color: entry.name_color,
                          name_decoration: entry.name_decoration,
                          profile_icon: entry.profile_icon,
                          title: entry.title
                        }}
                        size="0.82rem"
                      />
                    </td>
                    <td style={{ padding: '0.55rem 0.6rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {formatValue(entry)}
                    </td>
                    <td style={{ padding: '0.55rem 0.6rem', color: 'var(--text-muted)' }}>
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel-card" style={{ padding: '1.25rem', alignItems: 'stretch', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Trash2 size={18} style={{ color: 'var(--accent-red)' }} />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{t('Reset world leaderboards')}</h2>
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {t('All scores, personal bests, ELO ratings and match history will be permanently erased for every player.')}
        </p>

        {resetError && (
          <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <AlertTriangle size={14} /> {resetError}
          </p>
        )}

        {!showResetConfirm ? (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            style={{
              alignSelf: 'flex-start',
              padding: '0.5rem 1rem',
              fontSize: '0.82rem',
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--accent-red)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Trash2 size={14} /> {t('Wipe All Leaderboards')}
          </button>
        ) : (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--accent-red)', fontWeight: 700, fontSize: '0.9rem' }}>
              <AlertTriangle size={16} /> {t('Confirm leaderboard wipe?')}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              {t('All solo game results and personal bests will be permanently erased for every player.')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={resetting}
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  background: 'var(--accent-red)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                {resetting ? t('Wiping...') : t('Yes, Wipe Everything')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowResetConfirm(false)}
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        )}

        {resetSuccess && (
          <div style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={14} /> {t('Leaderboards wiped successfully!')}
          </div>
        )}
      </div>
    </div>
  );
};
