import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '0.85rem 1rem',
      fontSize: '0.8rem',
      color: 'var(--text-muted)',
      borderTop: '1px solid var(--border-color)',
      marginTop: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem'
    }}>
      <div>
        <strong>Nint</strong> — “Nint is not Tetris.”
      </div>
      <div>
        Created by <strong>Risike</strong>. Licence{' '}
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
      </div>
    </footer>
  );
};
