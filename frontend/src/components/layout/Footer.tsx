import React from 'react';
import { Github } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';

export const Footer: React.FC = () => {
  const { t } = useI18n();
  return (
    <footer style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.15rem 0.55rem',
      padding: '0.45rem 1rem',
      fontSize: '0.75rem',
      lineHeight: 1.25,
      color: 'var(--text-muted)',
      borderTop: '1px solid var(--border-color)',
      marginTop: 'auto',
      textAlign: 'center'
    }}>
      <span style={{ whiteSpace: 'nowrap' }}>
        <strong>Nint</strong> — “Nint is not Tetris.”
      </span>
      <span aria-hidden="true">•</span>
      <span>
        {t('Created by {name}. Licence', { name: 'Risike' })}{' '}
        <a
          href="/LICENSE-GPL-3.0.txt"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--accent-cyan)',
            textDecoration: 'underline',
            fontWeight: 600
          }}
        >
          GPL 3.0
        </a>
      </span>
      <span aria-hidden="true">•</span>
      <a
        href="https://github.com/Risike/nint"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          color: 'var(--accent-cyan)',
          textDecoration: 'underline',
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}
      >
        <Github size={13} />
        GitHub
      </a>
    </footer>
  );
};
