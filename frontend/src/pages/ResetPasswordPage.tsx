import React, { useState, useEffect } from 'react';
import { KeyRound, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { ApiClient } from '../services/api';
import { useI18n } from '../i18n/useI18n';

interface ResetPasswordPageProps {
  token: string;
  onNavigate: (tab: string) => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ token, onNavigate }) => {
  const { t } = useI18n();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError(t('Invalid or missing reset token. Please request a new password reset.'));
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError(t('Password must be at least 6 characters.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('Passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      await ApiClient.confirmPasswordReset(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || t('Failed to reset password. The link may have expired.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ width: '100%', maxWidth: '420px', margin: '2rem auto' }}>
        <div className="panel-card" style={{ padding: '2rem', gap: '1.25rem', textAlign: 'center' }}>
          <CheckCircle size={48} style={{ color: 'var(--accent-cyan)', margin: '0 auto' }} />
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>{t('Password Updated!')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {t('Your password has been reset successfully. You can now sign in with your new password.')}
          </p>
          <button
            className="btn-primary"
            onClick={() => onNavigate('login')}
            style={{ marginTop: '0.5rem' }}
          >
            {t('Sign In')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '2rem auto' }}>
      <div className="panel-card" style={{ padding: '2rem', gap: '1.25rem' }}>
        <div style={{ textAlign: 'center' }}>
          <KeyRound size={36} style={{ color: 'var(--accent-cyan)', margin: '0 auto 0.5rem' }} />
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('New Password')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t('Choose a new password for your account.')}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: 'var(--accent-red)',
            padding: '0.6rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            justifyContent: 'center'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
              {t('New Password')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('At least 6 characters')}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  padding: 0,
                  display: 'flex'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
              {t('Confirm New Password')}
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('Repeat your password')}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !token}
            style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <KeyRound size={18} />
            <span>{loading ? t('Saving...') : t('Set New Password')}</span>
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); onNavigate('login'); }}
            style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
          >
            {t('Back to Sign In')}
          </a>
        </div>
      </div>
    </div>
  );
};
