import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Newspaper } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useI18n } from '../../i18n/useI18n';

export const AdminAnnouncementsSection: React.FC = () => {
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getNews()
      .then((data) => setMessage(data.message || ''))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      await ApiClient.setNews(message);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message || t('Failed to save news message.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel-card" style={{ padding: '1.5rem', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <Newspaper size={20} style={{ color: 'var(--accent-cyan)' }} />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('Homepage Announcement / News')}
        </h2>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        {t('This announcement is displayed as a banner on top of the home page for all players. Leave empty to hide the banner.')}
      </p>
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={t('Enter announcement message to display on the home page (e.g. Weekend Tournament starts Saturday at 8 PM UTC!)...')}
        rows={4}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-primary)',
          fontSize: '0.9rem',
          resize: 'vertical',
          fontFamily: 'inherit',
          boxSizing: 'border-box'
        }}
      />
      {error && (
        <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <AlertTriangle size={14} /> {error}
        </p>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={loading}
          style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
        >
          {loading ? t('Saving...') : t('Save Announcement')}
        </button>
        {saved && (
          <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={14} /> {t('Saved successfully!')}
          </span>
        )}
      </div>
    </div>
  );
};
