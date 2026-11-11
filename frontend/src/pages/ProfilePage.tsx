import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../services/api';
import { User, KeyRound, Trash2, LogOut, CheckCircle2, Coins } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';

interface ProfilePageProps {
  onNavigate: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigate }) => {
  const { user, logout, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pick up credits earned in recent games when opening the profile.
  useEffect(() => {
    refreshProfile().catch(() => {});
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const updated = await ApiClient.updateMe({
        displayName,
        ...(newPassword ? { newPassword, currentPassword } : {})
      });
      // Changing the password rotates the session token server-side.
      if (updated?.token) {
        ApiClient.setToken(updated.token);
      }
      await refreshProfile();
      setMessage(t('Profile updated successfully!'));
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || t('Update failed'));
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setError(t('Please provide your password to confirm account deletion'));
      return;
    }
    if (!window.confirm(t('Are you absolutely sure you want to delete your account? This action cannot be undone.'))) {
      return;
    }
    try {
      await ApiClient.deleteMe(deletePassword);
      logout();
      onNavigate('home');
    } catch (err: any) {
      setError(err.message || t('Deletion failed'));
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '600px' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('User Profile')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {t('Manage your account credentials and personal information.')}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {message && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--accent-green)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            <CheckCircle2 size={16} />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Profile Card */}
        <div className="panel-card" style={{ alignItems: 'stretch', padding: '1.5rem', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.1rem' }}>
            <User size={20} color="var(--accent-cyan)" />
            <span>{t('Account Details')}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('Online Multiplayer Rating')}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {user?.rating ?? 1000} ELO
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('Chess ELO System')}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('Credits')}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-yellow)' }}>
                {(user?.credits ?? 0).toLocaleString()}
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('1 credit per cleared line')}</span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              {t('Email Address')}
            </label>
            <input
              type="text"
              disabled
              value={user?.email || ''}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)'
              }}
            />
          </div>

          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                {t('Display Name')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                <KeyRound size={16} />
                <span>{t('Change Password (optional)')}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="password"
                  placeholder={t('Current Password')}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
                <input
                  type="password"
                  placeholder={t('New Password')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-start' }}>
              {t('Save Changes')}
            </button>
          </form>
        </div>

        {/* Danger Zone: Delete Account & Sign Out */}
        <div className="panel-card" style={{ alignItems: 'stretch', padding: '1.5rem', gap: '1.25rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent-red)' }}>{t('Sign Out')}</span>
            <button
              className="btn-secondary"
              onClick={() => { logout(); onNavigate('home'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-red)' }}
            >
              <LogOut size={16} /> {t('Logout')}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-red)', marginBottom: '0.4rem' }}>
              {t('Delete Account')}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
              {t('Permanently erase your user account, personal bests, and match statistics.')}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="password"
                placeholder={t('Confirm with your password')}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
              <button
                className="btn-secondary"
                onClick={handleDeleteAccount}
                style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: 'var(--accent-red)', color: 'var(--accent-red)', fontSize: '0.85rem' }}
              >
                <Trash2 size={16} /> {t('Delete')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
