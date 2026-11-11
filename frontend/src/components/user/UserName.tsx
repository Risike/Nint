import React from 'react';
import { useI18n } from '../../i18n/useI18n';
import { getTitleLabel } from '../../i18n/titles';

export interface NameCosmetics {
  name_color?: string;
  name_decoration?: string;
  title?: string;
}

interface UserNameProps {
  displayName: string;
  cosmetics?: Partial<NameCosmetics> | null;
  size?: string;
  align?: 'left' | 'center';
  showTitle?: boolean;
  style?: React.CSSProperties;
}

export const UserName: React.FC<UserNameProps> = ({
  displayName,
  cosmetics,
  size = '0.9rem',
  align = 'left',
  showTitle = true,
  style
}) => {
  const { language } = useI18n();
  const color = /^#[0-9a-f]{6}$/i.test(cosmetics?.name_color || '')
    ? cosmetics!.name_color!
    : '#f8fafc';
  const decoration = cosmetics?.name_decoration || 'none';
  const title = getTitleLabel(cosmetics?.title, language).trim();
  const titleSize = /^([\d.]+)rem$/.test(size) ? `${parseFloat(size) * 0.7}rem` : '0.65rem';

  const wrapName = (before: string, after: string): React.ReactNode => (
    <><span style={{ opacity: 0.8 }}>{before}</span> {displayName} <span style={{ opacity: 0.8 }}>{after}</span></>
  );

  let nameContent: React.ReactNode = displayName;
  switch (decoration) {
    case 'brackets': nameContent = wrapName('⟨', '⟩'); break;
    case 'sparkle': nameContent = wrapName('✦', '✦'); break;
    case 'angles': nameContent = wrapName('‹', '›'); break;
    case 'stars': nameContent = wrapName('★', '★'); break;
    case 'diamonds': nameContent = wrapName('◆', '◆'); break;
    case 'arrows': nameContent = wrapName('→', '←'); break;
    case 'brackets_square': nameContent = wrapName('[', ']'); break;
    case 'parentheses': nameContent = wrapName('(', ')'); break;
  }

  const nameStyle: React.CSSProperties = {
    color,
    fontWeight: 800,
    fontSize: size,
    display: 'inline-block',
    whiteSpace: 'nowrap'
  };

  switch (decoration) {
    case 'glow':
      nameStyle.textShadow = `0 0 10px ${color}, 0 0 22px ${color}66`;
      break;
    case 'underline':
      nameStyle.borderBottom = `2px solid ${color}`;
      nameStyle.paddingBottom = '1px';
      break;
    case 'double_underline':
      nameStyle.borderBottom = `3px double ${color}`;
      nameStyle.paddingBottom = '1px';
      break;
    case 'overline':
      nameStyle.borderTop = `2px solid ${color}`;
      nameStyle.paddingTop = '1px';
      break;
    case 'shadow':
      nameStyle.textShadow = '2px 2px 0 rgba(0, 0, 0, 0.85)';
      break;
    case 'outline':
      nameStyle.textShadow = '1px 1px 0 rgba(0, 0, 0, 0.9), -1px -1px 0 rgba(0, 0, 0, 0.9), 1px -1px 0 rgba(0, 0, 0, 0.9), -1px 1px 0 rgba(0, 0, 0, 0.9)';
      break;
    case 'pill':
      nameStyle.background = `${color}22`;
      nameStyle.border = `1px solid ${color}`;
      nameStyle.borderRadius = '999px';
      nameStyle.padding = '0.05em 0.45em';
      break;
    case 'box':
      nameStyle.border = `1px solid ${color}`;
      nameStyle.borderRadius = '4px';
      nameStyle.padding = '0.05em 0.35em';
      break;
    case 'dots':
      nameStyle.textDecoration = 'underline dotted';
      break;
    case 'wave':
      nameStyle.textDecoration = 'underline wavy';
      break;
    case 'highlight':
      nameStyle.background = `linear-gradient(transparent 55%, ${color}66 55%)`;
      nameStyle.padding = '0 0.12em';
      break;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: '1px',
        lineHeight: 1.15,
        ...style
      }}
    >
      <span style={nameStyle}>
        {nameContent}
      </span>
      {showTitle && title && (
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: titleSize,
            fontWeight: 600,
            letterSpacing: '0.02em'
          }}
        >
          {title}
        </span>
      )}
    </span>
  );
};
