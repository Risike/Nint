import React, { useEffect, useState } from 'react';
import { ApiClient } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { BarChart2, Trophy, Clock, Zap, Target, Swords } from 'lucide-react';

export const StatsPage: React.FC = () => {
  const { isAuthenticated, isGuest } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  if (isGuest) {
    return (
      <div className="panel-card" style={{ maxWidth: '500px', padding: '2rem', textAlign: 'center', margin: '2rem auto' }}>
        <BarChart2 size={40} color="var(--accent-blue)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Guest Statistics</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
          You are currently playing in guest mode. Detailed historical statistics, match history, and personal best tracking are saved to the server when you create an account.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading stats...</div>;
  }

  const stats = data?.stats || {};
  const personalBests = data?.personalBests || [];
  const recentMatches = data?.recentMatches || [];

  const formatPlaytime = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div style={{ width: '100%', maxWidth: '960px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Your Statistics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Lifetime performance overview and recent match records.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div className="panel-card">
          <div className="stat-label">Games Played</div>
          <div className="stat-value">{stats.games_played || 0}</div>
        </div>

        <div className="panel-card">
          <div className="stat-label">Win Rate (Versus)</div>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
            {data?.winRate || '0.0'}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.wins || 0}W / {stats.losses || 0}L
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">Total Lines Cleared</div>
          <div className="stat-value">{stats.total_lines?.toLocaleString() || 0}</div>
        </div>

        <div className="panel-card">
          <div className="stat-label">Total Playtime</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>
            {formatPlaytime(stats.total_playtime_ms || 0)}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">Tetrises Made</div>
          <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>
            {stats.total_tetrises || 0}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">T-Spins Executed</div>
          <div className="stat-value" style={{ color: 'var(--accent-purple)' }}>
            {stats.total_tspins || 0}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">Max Combo / Max B2B</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>
            x{stats.highest_combo || 0} / {stats.highest_b2b || 0}
          </div>
        </div>

        <div className="panel-card">
          <div className="stat-label">Perfect Clears</div>
          <div className="stat-value" style={{ color: 'var(--accent-yellow)' }}>
            {stats.total_perfect_clears || 0}
          </div>
        </div>
      </div>

      {/* Match History Table */}
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.8rem' }}>Recent Match History</h2>
      <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        {recentMatches.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No versus matches recorded yet. Jump into 1v1 AI or Online 1v1!
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.6rem 1rem' }}>Result</th>
                <th style={{ padding: '0.6rem 1rem' }}>Opponent</th>
                <th style={{ padding: '0.6rem 1rem' }}>Your Lines</th>
                <th style={{ padding: '0.6rem 1rem' }}>Opponent Lines</th>
                <th style={{ padding: '0.6rem 1rem' }}>Duration</th>
                <th style={{ padding: '0.6rem 1rem' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentMatches.map((m: any) => (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.6rem 1rem', fontWeight: 800, color: m.result === 'win' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                    {m.result.toUpperCase()}
                  </td>
                  <td style={{ padding: '0.6rem 1rem' }}>{m.opponent_name}</td>
                  <td style={{ padding: '0.6rem 1rem' }}>{m.player_lines}</td>
                  <td style={{ padding: '0.6rem 1rem' }}>{m.opponent_lines}</td>
                  <td style={{ padding: '0.6rem 1rem' }}>{(m.duration / 1000).toFixed(1)}s</td>
                  <td style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)' }}>
                    {new Date(m.created_at).toLocaleDateString()}
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
