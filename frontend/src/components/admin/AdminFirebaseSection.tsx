import React, { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, Trash2 } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { FirebaseRealtimeService } from '../../services/firebaseRealtime';
import { useI18n } from '../../i18n/useI18n';

interface Row {
  matchId: string;
  mode: string;
  serverStatus: string;
  exists: boolean;
  stale: boolean;
  unreadable: boolean;
  status: string | null;
  ageMs: number | null;
  players: number;
}

const ROW_COLUMNS = '76px minmax(120px, 1fr) 56px 64px minmax(132px, max-content)';

const statCardStyle: React.CSSProperties = {
  padding: '0.9rem 1rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-tertiary)'
};

const badgeStyle = (tone: 'ready' | 'kept' | 'gone'): React.CSSProperties => {
  const colors = {
    ready: { color: 'var(--accent-green)', background: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.35)' },
    kept: { color: 'var(--accent-yellow)', background: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.35)' },
    gone: { color: 'var(--text-muted)', background: 'rgba(148, 163, 184, 0.12)', border: 'var(--border-color)' }
  }[tone];
  return {
    ...colors,
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    border: `1px solid ${colors.border}`,
    fontSize: '0.72rem',
    fontWeight: 700,
    whiteSpace: 'nowrap'
  };
};

export const AdminFirebaseSection: React.FC = () => {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await ApiClient.adminGetFirebaseMatches();
      const inspected = await FirebaseRealtimeService.inspectMatches(data.matches.map((match) => match.matchId));
      const inspections = new Map(inspected.map((entry) => [entry.matchId, entry]));
      setTotal(data.total);
      setRows(data.matches.map((match) => {
        const inspection = inspections.get(match.matchId);
        return {
          matchId: match.matchId,
          mode: match.mode,
          serverStatus: match.serverStatus,
          exists: inspection?.exists ?? false,
          stale: inspection?.stale ?? false,
          unreadable: inspection?.unreadable ?? false,
          status: inspection?.status ?? null,
          ageMs: inspection?.ageMs ?? null,
          players: inspection?.players ?? 0
        };
      }));
    } catch {
      setError(t('Some matches could not be read.'));
    } finally {
      setLoading(false);
    }
    // `t` only changes the message language, so it must not retrigger the load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const storedCount = rows.filter((row) => row.exists).length;
  const staleRows = rows.filter((row) => row.stale);
  const formatAge = (ageMs: number | null) => {
    if (ageMs === null) return '—';
    if (ageMs >= 60 * 60 * 1000) return `${(ageMs / (60 * 60 * 1000)).toFixed(1)} h`;
    return `${Math.max(1, Math.round(ageMs / 60000))} min`;
  };

  const clean = async () => {
    if (!staleRows.length) return;
    setCleaning(true);
    setError(null);
    setMessage(null);
    try {
      const deleted = await FirebaseRealtimeService.deleteMatches(staleRows.map((row) => row.matchId));
      await load();
      // Set after the refresh, which clears the previous message.
      setMessage(t('Deleted {count} matches.', { count: deleted }));
    } catch {
      setError(t('Some matches could not be read.'));
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.9rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-secondary)',
          fontSize: '0.84rem',
          lineHeight: 1.5
        }}
      >
        <Database size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
        <span>{t('Server matches older than two hours are checked here. Finished matches are removed after two hours, and a match still marked active after one day.')}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t('Old matches')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{total}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t('Still in Firebase')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{storedCount}</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{t('Ready to delete')}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-green)' }}>{staleRows.length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading || cleaning} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', fontSize: '0.8rem' }}>
          <RefreshCw size={14} /> {t('Refresh')}
        </button>
        <button type="button" className="btn-primary" onClick={() => void clean()} disabled={loading || cleaning || staleRows.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', fontSize: '0.8rem' }}>
          <Trash2 size={14} /> {t('Delete unused matches')}
        </button>
      </div>

      {message && <p style={{ color: 'var(--accent-green)', fontSize: '0.84rem' }}>{message}</p>}
      {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.84rem' }}>{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('Loading Firebase matches...')}</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('No old matches left in Firebase.')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '420px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: ROW_COLUMNS, gap: '0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', padding: '0 0.65rem' }}>
            <span>{t('Match')}</span>
            <span>{t('Status')}</span>
            <span>{t('Age')}</span>
            <span>{t('Players')}</span>
            <span>{t('Database')}</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.matchId}
              style={{
                display: 'grid',
                gridTemplateColumns: ROW_COLUMNS,
                gap: '0.5rem',
                alignItems: 'center',
                padding: '0.55rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                fontSize: '0.8rem'
              }}
            >
              <code style={{ color: 'var(--text-secondary)' }}>{row.matchId.slice(0, 8)}</code>
              <span style={{ color: 'var(--text-secondary)' }}>
                {row.mode} · {row.status ?? t('Unknown')}
                {row.unreadable && (
                  <span style={{ color: 'var(--accent-red)', marginLeft: '0.4rem' }}>{t('Some matches could not be read.')}</span>
                )}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{formatAge(row.ageMs)}</span>
              <span style={{ color: 'var(--text-muted)' }}>{row.players}</span>
              <span>
                {!row.exists
                  ? <span style={badgeStyle('gone')}>{t('Deleted')}</span>
                  : row.stale
                    ? <span style={badgeStyle('ready')}>{t('Ready to delete')}</span>
                    : <span style={badgeStyle('kept')}>{t('Kept')}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
