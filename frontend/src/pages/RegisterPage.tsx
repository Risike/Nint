import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, MailCheck } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import { ApiClient } from '../services/api';
import { validatePassword } from '../utils/passwordPolicy';
import { TurnstileWidget } from '../components/auth/TurnstileWidget';

interface RegisterPageProps {
  onNavigate: (tab: string) => void;
}

const PENDING_EMAIL_KEY = 'nint_pending_verification_email';
const PSEUDO_PATTERN = '[A-Za-z0-9]{3,32}';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  marginBottom: '0.3rem',
  color: 'var(--text-secondary)'
};

const hintStyle: React.CSSProperties = {
  margin: '0.3rem 0 0',
  fontSize: '0.72rem',
  color: 'var(--text-secondary)'
};

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register, verifyEmail } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState<'form' | 'verify'>(() => {
    try {
      return sessionStorage.getItem(PENDING_EMAIL_KEY) ? 'verify' : 'form';
    } catch {
      return 'form';
    }
  });
  const [pendingEmail, setPendingEmail] = useState(() => {
    try {
      return sessionStorage.getItem(PENDING_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState(false);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    ApiClient.getCaptchaConfig()
      .then((config) => {
        if (!cancelled) setCaptchaSiteKey(config.siteKey || '');
      })
      .catch(() => {
        if (!cancelled) setCaptchaError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const savePendingEmail = (value: string) => {
    setPendingEmail(value);
    try {
      if (value) sessionStorage.setItem(PENDING_EMAIL_KEY, value);
      else sessionStorage.removeItem(PENDING_EMAIL_KEY);
    } catch {
      // Session storage is a convenience only.
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!/^[A-Za-z0-9]{3,32}$/.test(username.trim())) {
      setError(t('Username must be 3-32 characters using only letters and numbers'));
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(t(passwordError));
      return;
    }
    if (!captchaSiteKey) {
      setError(t('Captcha is not configured. Registration is unavailable.'));
      return;
    }
    if (!captchaToken) {
      setError(t('Please complete the captcha.'));
      return;
    }

    setLoading(true);
    try {
      const result = await register(email, password, username.trim(), captchaToken);
      savePendingEmail(result.email || email);
      setStep('verify');
      setCode('');
      setPassword('');
      setCaptchaToken(null);
      setInfo(t('Verification code sent to {email}.', { email: result.email || email }));
    } catch (err: any) {
      setError(err.message || t('Registration failed'));
      setCaptchaToken(null);
      setCaptchaResetKey((key) => key + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError(t('Enter the 6-digit verification code'));
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(pendingEmail, code.trim());
      savePendingEmail('');
      onNavigate('solo');
    } catch (err: any) {
      setError(err.message || t('Email verification failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await ApiClient.resendVerification(pendingEmail);
      setInfo(t('A new verification code has been sent to {email}.', { email: pendingEmail }));
    } catch (err: any) {
      setError(err.message || t('Unable to resend the verification code'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '420px', margin: '2rem auto' }}>
      <div className="panel-card" style={{ padding: '2rem', gap: '1.25rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.4rem' }}>
            {step === 'form' ? t('Create Account') : t('Verify Your Email')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {step === 'form'
              ? t('Join Nint to claim your player handle and climb leaderboards.')
              : t('Enter the 6-digit code sent to {email} to activate your account.', { email: pendingEmail })}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </div>
        )}
        {info && (
          <div style={{ background: 'rgba(34, 211, 238, 0.12)', color: 'var(--accent-cyan)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', textAlign: 'center' }}>
            {info}
          </div>
        )}

        {step === 'form' ? (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <div>
              <label style={labelStyle}>{t('Username')}</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={32}
                pattern={PSEUDO_PATTERN}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('e.g. blockninja')}
                style={inputStyle}
              />
              <p style={hintStyle}>{t('3-32 characters, letters and numbers only. This is your player name and sign-in name.')}</p>
            </div>

            <div>
              <label style={labelStyle}>{t('Email Address')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('you@example.com')}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>{t('Password')}</label>
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('At least 8 characters, with upper, lower, number and special character')}
                style={inputStyle}
              />
              <p style={hintStyle}>{t('At least 8 characters, including an uppercase letter, a lowercase letter, a number and a special character.')}</p>
            </div>

            <div>
              {captchaSiteKey ? (
                <TurnstileWidget
                  siteKey={captchaSiteKey}
                  onToken={setCaptchaToken}
                  onError={() => setCaptchaError(true)}
                  resetKey={captchaResetKey}
                />
              ) : (
                <p style={{ ...hintStyle, color: captchaError ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                  {captchaError ? t('Captcha is not configured. Registration is unavailable.') : t('Loading captcha...')}
                </p>
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={loading || !captchaSiteKey} style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <UserPlus size={18} />
              <span>{loading ? t('Creating...') : t('Register')}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <div>
              <label style={labelStyle}>{t('Verification code')}</label>
              <input
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.35em', fontSize: '1.2rem', fontWeight: 700 }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <MailCheck size={18} />
              <span>{loading ? t('Verifying...') : t('Verify Email')}</span>
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.78rem' }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
              >
                {resending ? t('Sending...') : t('Resend code')}
              </button>
              <button
                type="button"
                onClick={() => {
                  savePendingEmail('');
                  setStep('form');
                  setError(null);
                  setInfo(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
              >
                {t('Back to registration')}
              </button>
            </div>
          </form>
        )}

        <div style={{ textAlign: 'center', fontSize: '0.85rem' }}>
          {t('Already have an account?')}{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('login'); }} style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>
            {t('Sign In')}
          </a>
        </div>
      </div>
    </div>
  );
};
