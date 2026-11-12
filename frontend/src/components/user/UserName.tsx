import React from 'react';
import { useI18n } from '../../i18n/useI18n';
import { getTitleLabel } from '../../i18n/titles';
import { getProfileIconEmoji } from '../../i18n/profileIcons';
import { parseNameColor } from '../../utils/nameColor';
import { renderDecorationHtml } from '../../utils/nameDecoration';
import { useNameDecorations } from '../../context/NameDecorationContext';

export interface NameCosmetics {
  name_color?: string;
  name_decoration?: string;
  profile_icon?: string;
  title?: string;
}

interface UserNameProps {
  displayName: string;
  cosmetics?: Partial<NameCosmetics> | null;
  size?: string;
  align?: 'left' | 'center';
  showTitle?: boolean;
  showIcon?: boolean;
  decorationHtml?: string;
  style?: React.CSSProperties;
}

export const UserName: React.FC<UserNameProps> = ({
  displayName,
  cosmetics,
  size = '0.9rem',
  align = 'left',
  showTitle = true,
  showIcon = true,
  decorationHtml,
  style
}) => {
  const { language } = useI18n();
  const { decorations } = useNameDecorations();
  const parsedColor = parseNameColor(cosmetics?.name_color);
  const color = parsedColor.color;
  const decoration = cosmetics?.name_decoration || 'none';
  const title = getTitleLabel(cosmetics?.title, language).trim();
  const sizeRem = /^([\d.]+)rem$/.exec(size);
  const titleSize = sizeRem ? `${parseFloat(sizeRem[1]) * 0.7}rem` : '0.65rem';
  // Match the icon to the full name + title column instead of keeping it
  // smaller than the stacked text. Without a title, only the name height counts.
  const iconFontSize = sizeRem
    ? `${(parseFloat(sizeRem[1]) * (showTitle ? 1.8 : 1.15)).toFixed(3)}rem`
    : size;
  const profileIcon = getProfileIconEmoji(cosmetics?.profile_icon);
  const template = decorationHtml !== undefined ? decorationHtml : decorations[decoration]?.html;
  const renderedDecoration = template ? renderDecorationHtml(template, displayName, color) : '';

  const wrapName = (before: string, after: string): React.ReactNode => (
    <><span style={{ opacity: 0.8 }}>{before}</span> {displayName} <span style={{ opacity: 0.8 }}>{after}</span></>
  );

  let nameContent: React.ReactNode = renderedDecoration
    ? <span dangerouslySetInnerHTML={{ __html: renderedDecoration }} />
    : displayName;
  if (!renderedDecoration) switch (decoration) {
    case 'brackets': nameContent = wrapName('⟨', '⟩'); break;
    case 'sparkle': nameContent = wrapName('✦', '✦'); break;
    case 'angles': nameContent = wrapName('‹', '›'); break;
    case 'stars': nameContent = wrapName('★', '★'); break;
    case 'diamonds': nameContent = wrapName('◆', '◆'); break;
    case 'arrows': nameContent = wrapName('→', '←'); break;
    case 'brackets_square': nameContent = wrapName('[', ']'); break;
    case 'parentheses': nameContent = wrapName('(', ')'); break;
    case 'quotes': nameContent = wrapName('“', '”'); break;
    case 'guillemets': nameContent = wrapName('«', '»'); break;
    case 'corner': nameContent = wrapName('「', '」'); break;
    case 'corner_double': nameContent = wrapName('『', '』'); break;
    case 'braces': nameContent = wrapName('{', '}'); break;
    case 'chevrons_double': nameContent = wrapName('《', '》'); break;
    case 'tildes': nameContent = wrapName('~', '~'); break;
    case 'pipes': nameContent = wrapName('|', '|'); break;
    case 'slashes': nameContent = wrapName('⟋', '⟍'); break;
    case 'plus_signs': nameContent = wrapName('+', '+'); break;
    case 'equals': nameContent = wrapName('=', '='); break;
    case 'hashes': nameContent = wrapName('#', '#'); break;
    case 'at_sign': nameContent = wrapName('@', '@'); break;
    case 'music': nameContent = wrapName('♪', '♪'); break;
    case 'hearts': nameContent = wrapName('♥', '♥'); break;
    case 'lightning': nameContent = wrapName('⚡', '⚡'); break;
    case 'flames': nameContent = wrapName('🔥', '🔥'); break;
    case 'flowers': nameContent = wrapName('✿', '✿'); break;
    case 'moons': nameContent = wrapName('☾', '☽'); break;
    case 'crystals': nameContent = wrapName('⟡', '⟡'); break;
    case 'target': nameContent = wrapName('◎', '◎'); break;
    case 'crowns': nameContent = wrapName('♛', '♛'); break;
    case 'wings': nameContent = wrapName('꧁', '꧂'); break;
    case 'ribbon': nameContent = wrapName('🎀', '🎀'); break;
    case 'orbit': nameContent = wrapName('☄', '☄'); break;
    case 'terminal': nameContent = wrapName('>', '_'); break;
  }

  const nameStyle: React.CSSProperties = {
    color,
    fontWeight: 800,
    fontSize: size,
    display: 'inline-block',
    whiteSpace: 'nowrap'
  };

  if (!renderedDecoration) switch (decoration) {
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
    case 'gold_frame':
      nameStyle.border = '2px solid #facc15';
      nameStyle.borderRadius = '4px';
      nameStyle.padding = '0.05em 0.35em';
      nameStyle.boxShadow = '0 0 8px rgba(250, 204, 21, 0.55)';
      nameStyle.background = 'rgba(250, 204, 21, 0.08)';
      break;
    case 'emboss':
      nameStyle.textShadow = '0 1px 0 rgba(255, 255, 255, 0.4), 0 -1px 1px rgba(0, 0, 0, 0.85)';
      break;
    case 'glitch':
      nameStyle.textShadow = '2px 0 #ff0080, -2px 0 #00e5ff';
      nameStyle.transform = 'skewX(-4deg)';
      break;
    case 'dashed_line':
      nameStyle.borderBottom = `2px dashed ${color}`;
      nameStyle.paddingBottom = '1px';
      break;
    case 'orbit':
      nameStyle.textShadow = `0 0 8px ${color}`;
      break;
    case 'terminal':
      nameStyle.fontFamily = 'monospace';
      nameStyle.background = `${color}1f`;
      nameStyle.border = `1px solid ${color}`;
      nameStyle.borderRadius = '3px';
      nameStyle.padding = '0.05em 0.35em';
      break;
  }

  if (parsedColor.backgroundImage) {
    nameStyle.backgroundImage = parsedColor.backgroundImage;
    nameStyle.WebkitBackgroundClip = 'text';
    nameStyle.backgroundClip = 'text';
    nameStyle.WebkitTextFillColor = 'transparent';
    nameStyle.padding = '0 0.08em';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        gap: '0.35em',
        lineHeight: 1.15,
        ...style
      }}
    >
      {showIcon && (
        <span
          aria-hidden="true"
          data-profile-icon={cosmetics?.profile_icon || 'user'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            fontSize: iconFontSize,
            lineHeight: 1,
            flexShrink: 0
          }}
        >
          {profileIcon}
        </span>
      )}
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: align === 'center' ? 'center' : 'flex-start',
          gap: '1px',
          lineHeight: 1.15
        }}
      >
        <span
          style={nameStyle}
          data-name-color={!parsedColor.backgroundImage && parsedColor.color === '#f8fafc' ? 'default' : undefined}
        >
          {nameContent}
        </span>
        {showTitle && (
          <span
            aria-hidden={title ? undefined : true}
            style={{
              color: 'var(--text-muted)',
              fontSize: titleSize,
              fontWeight: 600,
              letterSpacing: '0.02em',
              lineHeight: 1.15
            }}
          >
            {title || '\u00A0'}
          </span>
        )}
      </span>
    </span>
  );
};
