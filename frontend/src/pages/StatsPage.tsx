import React, { useEffect, useState } from 'react';
import { ApiClient } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LocalStorageManager } from '../services/storage';
import { BarChart2, Trophy, Clock, Zap, Target, Swords, Flame, Timer, Bot, Users } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';

export const StatsPage: React.FC = () => {
  const { isAuthenticated, isGuest } = useAuth();
  const { t, formatDate } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyTab, setHistoryTab] = useState<'cpu' | 'pvp'>('cpu');

  useEffect(() => {
    if (isAuthenticated) {
      ApiClient.getMyStats()
        .then(setData)
        .catch(console.warn)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const guestResults = !isAuthenticated ? LocalStorageManager.getItem<any[]>('guest_results', []) : [];

  const formatPlaytime = (ms: number) => {
    if (!ms || ms <= 0) return '0s';
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '—';
    const totalSec = (ms / 1000).toFixed(2);
    return `${totalSec}s`;
  };

  // Helper to extract personal bests (authenticated from server or computed from guest_results)
  const getSoloPersonalBests = () => {
    if (isAuthenticated && data?.personalBests) {
      const serverBests: Record<string, { score?: number; time?: number; date?: number }> = {};
      data.personalBests.forEach((pb: any) => {
        if (!serverBests[pb.mode]) serverBests[pb.mode] = {};
        if (pb.metric === 'score') {
          serverBests[pb.mode].score = pb.value;
          serverBests[pb.mode].date = pb.achieved_at;
        } else if (pb.metric === 'time_ms') {
          serverBests[pb.mode].time = pb.value;
          serverBests[pb.mode].date = pb.achieved_at;
        }
      });
      return serverBests;
    }

    // Guest fallback: compute from local storage
    const localBests: Record<string, { score?: number; time?: number; date?: number }> = {};
    guestResults.forEach((r: any) => {
      const modeKey = r.mode;
      if (!localBests[modeKey]) localBests[modeKey] = {};
      if (r.score !== undefined && (localBests[modeKey].score === undefined || r.score > (localBests[modeKey].score || 0))) {
        localBests[modeKey].score = r.score;
        localBests[modeKey].date = r.date;
      }
      if (r.duration !== undefined && r.duration > 0 && (localBests[modeKey].time === undefined || r.duration < (localBests[modeKey].time || Infinity))) {
        localBests[modeKey].time = r.duration;
        localBests[modeKey].date = r.date;
      }
    });
    return localBests;
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading stats...')}</div>;
  }

  const stats = data?.stats || {};
  const recentMatches = data?.recentMatches || [];
  const soloBests = getSoloPersonalBests();

  const guestStats = !isAuthenticated ? guestResults.reduce((acc: any, r: any) => {
    acc.playtime = (acc.playtime || 0) + (r.duration || 0); // Zen playtime is counted
    if (r.mode !== 'zen') {
      acc.gamesPlayed = (acc.gamesPlayed || 0) + 1;
      acc.lines = (acc.lines || 0) + (r.lines || 0);
      acc.tetrises = (acc.tetrises || 0) + (r.tetrises || 0);
      acc.tspins = (acc.tspins || 0) + (r.tSpins || 0);
      acc.perfectClears = (acc.perfectClears || 0) + (r.perfectClears || 0);
      acc.maxCombo = Math.max(acc.maxCombo || 0, r.maxCombo || 0);
      acc.maxB2B = Math.max(acc.maxB2B || 0, r.maxB2B || 0);
    }
    return acc;
  }, {}) : {};

  const soloModes = [
    {
      id: 'marathon_150',
      title: t('Marathon (150 Lines)'),
      description: t('Score attack & gravity endurance'),
      icon: <Flame size={20} color="var(--accent-cyan)" />,
      badgeBg: 'rgba(6, 182, 212, 0.15)',
      primaryMetric: 'score' as const,
      color: 'var(--accent-cyan)'
    },
    {
      id: 'sprint_40',
      title: t('Sprint (40 Lines)'),
      description: t('Clear 40 lines as fast as possible'),
      icon: <Timer size={20} color="var(--accent-orange)" />,
      badgeBg: 'rgba(249, 115, 22, 0.15)',
      primaryMetric: 'time' as const,
      color: 'var(--accent-orange)'
    },
    {
      id: 'ultra_3m',
      title: t('Ultra (3 Minutes)'),
      description: t('Max score within 3 minutes'),
      icon: <Zap size={20} color="var(--accent-yellow)" />,
      badgeBg: 'rgba(234, 179, 8, 0.15)',
      primaryMetric: 'score' as const,
      color: 'var(--accent-yellow)'
    }
  ];

  return (
    <div style={{ width: '100%', maxWidth: '960px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Your Statistics')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('Personal bests, lifetime performance overview and match records.')}
        </p>
      </div>

      {isGuest && (
        <div className="panel-card" style={{ padding: '1rem 1.25rem', marginBottom: '2rem', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <BarChart2 size={28} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('Playing as Guest')}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              {t('Your best scores are temporarily tracked in this browser. Log in or create an account to save them to the global leaderboards permanently!')}
            </div>
          </div>
        </div>
      )}

      {/* Solo Modes Best Scores & Times */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Trophy size={20} color="var(--accent-yellow)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{t('Solo Personal Bests')}</h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {soloModes.map((m) => {
            const best = soloBests[m.id];
            return (
              <div
                key={m.id}
                className="panel-card"
                style={{
                  padding: '1.25rem',
                  alignItems: 'stretch',
                  gap: '0.75rem',
                  borderTop: `3px solid ${m.color}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ background: m.badgeBg, padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                    {m.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{m.title}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.description}</span>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '0.25rem'
                }}>
                  <div>
                    <div className="stat-label" style={{ fontSize: '0.7rem' }}>{t('Best Score')}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem', color: m.primaryMetric === 'score' ? m.color : 'var(--text-primary)' }}>
                      {best?.score !== undefined ? best.score.toLocaleString() : '—'}
                    </div>
                  </div>

                  <div>
                    <div className="stat-label" style={{ fontSize: '0.7rem' }}>{t('Best Time')}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem', color: m.primaryMetric === 'time' ? m.color : 'var(--text-primary)' }}>
                      {best?.time !== undefined ? formatDuration(best.time) : '—'}
                    </div>
                  </div>
                </div>

                {best?.date && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {t('Achieved: {date}', { date: formatDate(best.date) })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lifetime Overview Metric Cards Grid */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Target size={20} color="var(--accent-purple)" />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{t('Lifetime Performance')}</h2>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2.5rem'
      }}>
        <div className="panel-card" style={{ borderTop: '2px solid var(--accent-cyan)' }}>
          <div className="stat-label">{t('Online PvP Rating')}</div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            {isAuthenticated ? (stats.rating ?? 1000) : '—'} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>ELO</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('Chess ELO system')}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">{t('Games Played')}</div>
          <div className="stat-value">{stats.games_played ?? (guestStats.gamesPlayed || 0)}</div>
        </div>

        <div className="panel-card">
          <div className="stat-label">{t('Win Rate (Versus)')}</div>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
            {data?.winRate || '0.0'}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.wins || 0}W / {stats.losses || 0}L
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">{t('Total Lines Cleared')}</div>
          <div className="stat-value">{(stats.total_lines ?? guestStats.lines ?? 0).toLocaleString()}</div>
        </div>

        <div className="panel-card">
          <div className="stat-label">{t('Total Playtime')}</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>
            {formatPlaytime(stats.total_playtime_ms || guestStats.playtime || 0)}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">{t('Tetrises Made')}</div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            {stats.total_tetrises ?? guestStats.tetrises ?? 0}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">{t('T-Spins Executed')}</div>
          <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>
            {stats.total_tspins ?? guestStats.tspins ?? 0}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">{t('Max Combo / Max B2B')}</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>
            x{stats.highest_combo ?? guestStats.maxCombo ?? 0} / {stats.highest_b2b ?? guestStats.maxB2B ?? 0}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">{t('Perfect Clears')}</div>
          <div className="stat-value" style={{ color: 'var(--accent-yellow)' }}>
            {stats.total_perfect_clears ?? guestStats.perfectClears ?? 0}
          </div>
        </div>
      </div>

      {/* Match History Section with Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Swords size={20} color="var(--accent-blue)" />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{t('Recent Match History')}</h2>
        </div>

        {/* Two Tabs: Player vs CPU & Online PvP */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-tertiary)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          gap: '4px'
        }}>
          <button
            onClick={() => setHistoryTab('cpu')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: historyTab === 'cpu' ? 'var(--accent-purple)' : 'transparent',
              color: historyTab === 'cpu' ? '#ffffff' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <Bot size={15} />
            <span>{t('Player vs CPU')}</span>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '999px',
              background: historyTab === 'cpu' ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-secondary)',
              color: historyTab === 'cpu' ? '#ffffff' : 'var(--text-muted)'
            }}>
              {recentMatches.filter((m: any) => m.opponent_type === 'ai').length}
            </span>
          </button>

          <button
            onClick={() => setHistoryTab('pvp')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: historyTab === 'pvp' ? 'var(--accent-cyan)' : 'transparent',
              color: historyTab === 'pvp' ? '#0b0f19' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={15} />
            <span>{t('Online 1v1')}</span>
            <span style={{
              fontSize: '0.75rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '999px',
              background: historyTab === 'pvp' ? 'rgba(0, 0, 0, 0.2)' : 'var(--bg-secondary)',
              color: historyTab === 'pvp' ? '#0b0f19' : 'var(--text-muted)'
            }}>
              {recentMatches.filter((m: any) => m.opponent_type === 'human' || m.opponent_type !== 'ai').length}
            </span>
          </button>
        </div>
      </div>

      {(() => {
        const filteredMatches = recentMatches.filter((m: any) =>
          historyTab === 'cpu' ? m.opponent_type === 'ai' : (m.opponent_type === 'human' || m.opponent_type !== 'ai')
        );

        return (
          <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
            {filteredMatches.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                {historyTab === 'cpu' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Bot size={32} style={{ opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>{t('No Player vs CPU matches recorded yet.')}</p>
                    <span style={{ fontSize: '0.8rem' }}>{t('Jump into Player vs CPU to challenge the bot!')}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={32} style={{ opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>{t('No Online 1v1 matches recorded yet.')}</p>
                    <span style={{ fontSize: '0.8rem' }}>{t('Create a room or join a friend in Online Player vs Player!')}</span>
                  </div>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.6rem 1rem' }}>{t('Result')}</th>
                    {historyTab === 'pvp' && <th style={{ padding: '0.6rem 1rem' }}>ELO</th>}
                    <th style={{ padding: '0.6rem 1rem' }}>{t('Opponent')}</th>
                    <th style={{ padding: '0.6rem 1rem' }}>{t('Your Lines')}</th>
                    <th style={{ padding: '0.6rem 1rem' }}>{t('Opponent Lines')}</th>
                    <th style={{ padding: '0.6rem 1rem' }}>{t('Duration')}</th>
                    <th style={{ padding: '0.6rem 1rem' }}>{t('Date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map((m: any) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.6rem 1rem', fontWeight: 800, color: m.result === 'win' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {m.result === 'win' ? t('WIN') : t('LOSS')}
                      </td>
                      {historyTab === 'pvp' && (
                        <td style={{ padding: '0.6rem 1rem', fontWeight: 700 }}>
                          {m.rating_change !== undefined && m.rating_change !== 0 ? (
                            <span style={{ color: m.rating_change > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                              {m.rating_change > 0 ? `+${m.rating_change}` : m.rating_change}
                              {m.new_rating ? ` (${m.new_rating})` : ''}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      )}
                      <td style={{ padding: '0.6rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {m.opponent_type === 'ai' ? (
                            <Bot size={14} color="var(--accent-purple)" />
                          ) : (
                            <Users size={14} color="var(--accent-cyan)" />
                          )}
                          <span>{m.opponent_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.6rem 1rem' }}>{m.player_lines}</td>
                      <td style={{ padding: '0.6rem 1rem' }}>{m.opponent_lines}</td>
                      <td style={{ padding: '0.6rem 1rem' }}>{(m.duration / 1000).toFixed(1)}s</td>
                      <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>
                        {formatDate(m.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })()}
    </div>
  );
};
