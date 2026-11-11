import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { ApiClient } from '../services/api';
import { useI18n } from '../i18n/useI18n';

interface LoginPageProps {
  onNavigate: (tab: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, playAsGuest } = useAuth();
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot password sub-state
  const [isForgot, setIsForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
      onNavigate('solo');
    } catch (err: any) {
      setError(err.message || t('Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotLoading(true);
    try {
      await ApiClient.requestPasswordReset(forgotEmail);
      setForgotSuccess(true);
    } catch (err: any) {
      setError(err.message || t('Failed to send reset email'));
    } finally {
      setForgotLoading(false);
    }
  };

  if (isForgot) {
    return (
      <div style={{ width: '100%', maxWidth: '420px', margin: '2rem auto' }}>
        <div className="panel-card" style={{ padding: '2rem', gap: '1.25rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '50%', background: 'rgba(0, 229, 255, 0.1)', color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
              <Mail size={28} />
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Reset Password')}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {t("Enter your email address and we'll send you a link to reset your password.")}
            </p>
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {forgotSuccess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-green, #10b981)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={28} />
                <span>{t('If an account exists with that email, a password reset link has been sent to {email}.', { email: forgotEmail })}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {t('Check your inbox (and spam folder). The link will expire in 1 hour.')}
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setIsForgot(false); setForgotSuccess(false); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} />
                <span>{t('Back to Sign In')}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
                  {t('Email Address')}
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder={t('you@example.com')}
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
                disabled={forgotLoading}
                style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Mail size={18} />
                <span>{forgotLoading ? t('Sending link...') : t('Send Reset Link')}</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setIsForgot(false); setError(null); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} />
                <span>{t('Back to Sign In')}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '2rem auto' }}>
      <div className="panel-card" style={{ padding: '2rem', gap: '1.25rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Welcome Back')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {t('Sign in to track personal bests and leaderboard ranks.')}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
              {t('Email or Username')}
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t('you@example.com or test')}
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

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('Password')}
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setForgotEmail(identifier.includes('@') ? identifier : '');
                  setError(null);
                  setIsForgot(true);
                }}
                style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}
              >
                {t('Forgot password?')}
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          {import.meta.env.DEV && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              {t('Dev accounts: {accounts} — leave the password empty.', { accounts: 'test, test2' })}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <LogIn size={18} />
            <span>{loading ? t('Signing in...') : t('Sign In')}</span>
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', textAlign: 'center', fontSize: '0.85rem' }}>
          <div>
            {t("Don't have an account?")}{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('register'); }} style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>
              {t('Create Account')}
            </a>
          </div>

          <button
            className="btn-secondary"
            onClick={() => { playAsGuest(); onNavigate('solo'); }}
            style={{ padding: '0.5rem', fontSize: '0.8rem' }}
          >
            {t('Continue as Guest (No Account)')}
          </button>
        </div>
      </div>
    </div>
  );
};
