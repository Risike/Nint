import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '1.5rem',
      fontSize: '0.8rem',
      color: 'var(--text-muted)',
      borderTop: '1px solid var(--border-color)',
      marginTop: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem'
    }}>
      <div>
        <strong>Nint</strong> — “Nint is not Tetris.”
      </div>
      <div>
        An original Guideline-compliant online falling-block puzzle game.
      </div>
    </footer>
  );
};
