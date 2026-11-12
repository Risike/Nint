import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, RotateCcw, Search, UserX } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useI18n } from '../../i18n/useI18n';

export const AdminUsersSection: React.FC = () => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'clear_stats' | 'delete'; userId: string; email: string; displayName: string } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSearch = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    setSearchLoading(true);
    setActionError(null);
    try {
      const results = await ApiClient.adminSearchUsers(searchQuery);
      setSearchResults(results);
    } catch (e: any) {
      setActionError(e?.message || t('Failed to search users.'));
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    void handleSearch();
  }, []);

  const handleClearUserStats = async (userId: string) => {
    setActionError(null);
    try {
      await ApiClient.adminClearUserStats(userId);
      setActionSuccess(t('Player stats cleared successfully.'));
      setTimeout(() => setActionSuccess(null), 3000);
      setConfirmAction(null);
      await handleSearch();
    } catch (e: any) {
      setActionError(e?.message || t('Failed to clear user stats.'));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setActionError(null);
    try {
      await ApiClient.adminDeleteUser(userId);
      setActionSuccess(t('User account deleted successfully.'));
      setTimeout(() => setActionSuccess(null), 3000);
      setConfirmAction(null);
      setSearchResults((previous) => previous.filter((user) => user.id !== userId));
    } catch (e: any) {
      setActionError(e?.message || t('Failed to delete user account.'));
    }
  };

  return (
    <div className="panel-card" style={{ padding: '1.5rem', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <Search size={20} style={{ color: 'var(--accent-cyan)' }} />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('User Management')}
        </h2>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        {t('Search players by display name or email to clear their statistics or delete their account.')}
      </p>

      {actionSuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-green)',
            fontSize: '0.9rem'
          }}
        >
          <CheckCircle size={16} /> {actionSuccess}
        </div>
      )}

      {actionError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-red)',
            fontSize: '0.9rem'
          }}
        >
          <AlertTriangle size={16} /> {actionError}
        </div>
      )}

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t('Filter by name or email address...')}
          style={{
            flex: 1,
            padding: '0.6rem 0.85rem',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem'
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={searchLoading}
          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Search size={14} />
          {searchLoading ? t('Searching...') : t('Search')}
        </button>
      </form>

      {confirmAction && (
        <div
          style={{
            padding: '1.1rem',
            marginBottom: '1.25rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', color: 'var(--accent-red)', fontWeight: 700, fontSize: '0.95rem' }}>
            <AlertTriangle size={18} />
            {confirmAction.type === 'clear_stats'
              ? t('Reset statistics for {name} ({email})?', { name: confirmAction.displayName, email: confirmAction.email })
              : t('Permanently delete account for {name} ({email})?', { name: confirmAction.displayName, email: confirmAction.email })}
          </div>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
            {confirmAction.type === 'clear_stats'
              ? t('This will reset their W/L ratio, restore ELO rating to 1000, and clear all match history and scores. The account remains active.')
              : t('Warning: This permanently deletes this user account, including settings, scores, and all associated match history. This action cannot be undone.')}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => confirmAction.type === 'clear_stats'
                ? void handleClearUserStats(confirmAction.userId)
                : void handleDeleteUser(confirmAction.userId)}
              style={{
                padding: '0.45rem 1.1rem',
                fontSize: '0.85rem',
                background: 'var(--accent-red)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {confirmAction.type === 'clear_stats' ? t('Confirm: Clear Stats') : t('Confirm: Delete Account')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmAction(null)}
              style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }}
            >
              {t('Cancel')}
            </button>
          </div>
        </div>
      )}

      {searchResults.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          {t('No users found.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {searchResults.map((user) => (
            <div
              key={user.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.85rem 1rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                gap: '1rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                    {user.display_name}
                  </span>
                  {user.is_admin === 1 && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.15rem 0.45rem',
                        background: 'rgba(6, 182, 212, 0.2)',
                        color: 'var(--accent-cyan)',
                        borderRadius: '999px',
                        fontWeight: 700
                      }}
                    >
                      ADMIN
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {user.email}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>{t('ELO:')} </span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{user.rating}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>{t('Matches:')} </span>
                  <strong>{user.games_played}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>{t('W/L:')} </span>
                  <span style={{ color: 'var(--accent-green)' }}>{user.wins}</span> / <span style={{ color: 'var(--accent-red)' }}>{user.losses}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={() => setConfirmAction({ type: 'clear_stats', userId: user.id, email: user.email, displayName: user.display_name })}
                  title={t("Clear this user's stats")}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.78rem',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: '#eab308',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontWeight: 600
                  }}
                >
                  <RotateCcw size={12} /> {t('Clear Stats')}
                </button>
                {user.is_admin !== 1 && (
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'delete', userId: user.id, email: user.email, displayName: user.display_name })}
                    title={t('Delete this account permanently')}
                    style={{
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.78rem',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: 'var(--accent-red)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 600
                    }}
                  >
                    <UserX size={12} /> {t('Delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
