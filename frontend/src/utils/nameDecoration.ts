const WRAPPERS: Record<string, [string, string]> = {
  brackets: ['⟨', '⟩'],
  sparkle: ['✦', '✦'],
  angles: ['‹', '›'],
  stars: ['★', '★'],
  diamonds: ['◆', '◆'],
  arrows: ['→', '←'],
  brackets_square: ['[', ']'],
  parentheses: ['(', ')'],
  quotes: ['“', '”'],
  guillemets: ['«', '»'],
  corner: ['「', '」'],
  corner_double: ['『', '』'],
  braces: ['{', '}'],
  chevrons_double: ['《', '》'],
  tildes: ['~', '~'],
  pipes: ['|', '|'],
  slashes: ['⟋', '⟍'],
  plus_signs: ['+', '+'],
  equals: ['=', '='],
  hashes: ['#', '#'],
  at_sign: ['@', '@'],
  music: ['♪', '♪'],
  hearts: ['♥', '♥'],
  lightning: ['⚡', '⚡'],
  flames: ['🔥', '🔥'],
  flowers: ['✿', '✿'],
  moons: ['☾', '☽'],
  crystals: ['⟡', '⟡'],
  target: ['◎', '◎'],
  crowns: ['♛', '♛'],
  wings: ['꧁', '꧂'],
  ribbon: ['🎀', '🎀'],
  orbit: ['☄', '☄'],
  terminal: ['>', '_']
};

const STYLE_TEMPLATES: Record<string, string> = {
  glow: '<span style="text-shadow: 0 0 10px {color}, 0 0 22px {color}">{name}</span>',
  underline: '<span style="border-bottom: 2px solid {color};padding-bottom: 1px">{name}</span>',
  double_underline: '<span style="border-bottom: 3px double {color};padding-bottom: 1px">{name}</span>',
  overline: '<span style="border-top: 2px solid {color};padding-top: 1px">{name}</span>',
  shadow: '<span style="text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.85)">{name}</span>',
  outline: '<span style="text-shadow: 1px 1px 0 rgba(0,0,0,.9), -1px -1px 0 rgba(0,0,0,.9), 1px -1px 0 rgba(0,0,0,.9), -1px 1px 0 rgba(0,0,0,.9)">{name}</span>',
  pill: '<span style="background: {color}22;border: 1px solid {color};border-radius: 999px;padding: .05em .45em">{name}</span>',
  box: '<span style="border: 1px solid {color};border-radius: 4px;padding: .05em .35em">{name}</span>',
  dots: '<span style="text-decoration: underline dotted">{name}</span>',
  wave: '<span style="text-decoration: underline wavy">{name}</span>',
  highlight: '<span style="background: linear-gradient(transparent 55%, {color}66 55%);padding: 0 .12em">{name}</span>',
  gold_frame: '<span style="border: 2px solid #facc15;border-radius: 4px;padding: .05em .35em;box-shadow: 0 0 8px rgba(250,204,21,.55);background: rgba(250,204,21,.08)">{name}</span>',
  emboss: '<span style="text-shadow: 0 1px 0 rgba(255,255,255,.4), 0 -1px 1px rgba(0,0,0,.85)">{name}</span>',
  glitch: '<span style="text-shadow: 2px 0 #ff0080, -2px 0 #00e5ff;transform: skewX(-4deg)">{name}</span>',
  dashed_line: '<span style="border-bottom: 2px dashed {color};padding-bottom: 1px">{name}</span>',
  orbit: '<span style="text-shadow: 0 0 8px {color}">☄ {name} ☄</span>',
  terminal: '<span style="font-family: monospace;background: {color}1f;border: 1px solid {color};border-radius: 3px;padding: .05em .35em">{name}</span>'
};

export function getDefaultDecorationHtml(value: string): string {
  if (value === 'none' || !value) return '{name}';
  if (STYLE_TEMPLATES[value]) return STYLE_TEMPLATES[value];
  if (WRAPPERS[value]) {
    const [before, after] = WRAPPERS[value];
    return `<span style="opacity: .8">${before}</span> {name} <span style="opacity: .8">${after}</span>`;
  }
  return '{name}';
}

const ALLOWED_TAGS = new Set([
  'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SMALL', 'MARK', 'SUP', 'SUB', 'BR'
]);
const ALLOWED_STYLE_PROPERTIES = new Set([
  'color', 'background', 'background-color', 'background-image',
  'text-shadow', 'box-shadow', 'border', 'border-top', 'border-right', 'border-bottom',
  'border-left', 'border-color', 'border-style', 'border-width', 'border-radius',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
  'line-height', 'text-decoration', 'text-transform', 'text-align',
  'opacity', 'transform', 'filter', 'display', 'vertical-align'
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeStyle(value: string): string {
  return value
    .split(';')
    .map((declaration) => {
      const separator = declaration.indexOf(':');
      if (separator <= 0) return '';
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const styleValue = declaration.slice(separator + 1).trim();
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) return '';
      if (!styleValue || /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:/i.test(styleValue)) return '';
      return `${property}: ${styleValue}`;
    })
    .filter(Boolean)
    .join('; ');
}

export function sanitizeDecorationHtml(value: string): string {
  if (typeof document === 'undefined') return '';
  const container = document.createElement('div');
  container.innerHTML = value;

  const sanitizeChildren = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') {
        child.remove();
        continue;
      }
      if (!ALLOWED_TAGS.has(child.tagName)) {
        sanitizeChildren(child);
        const fragment = document.createDocumentFragment();
        while (child.firstChild) fragment.appendChild(child.firstChild);
        child.replaceWith(fragment);
        continue;
      }
      for (const attribute of Array.from(child.attributes)) {
        if (attribute.name === 'class') {
          if (!/^[a-z0-9 _-]*$/i.test(attribute.value)) child.removeAttribute(attribute.name);
        } else if (attribute.name === 'style') {
          const style = sanitizeStyle(attribute.value);
          if (style) child.setAttribute('style', style);
          else child.removeAttribute('style');
        } else {
          child.removeAttribute(attribute.name);
        }
      }
      sanitizeChildren(child);
    }
  };

  sanitizeChildren(container);
  return container.innerHTML;
}

export function renderDecorationHtml(template: string, displayName: string, color: string): string {
  if (!template) return '';
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#f8fafc';
  const withValues = template
    .replace(/\{name\}/g, escapeHtml(displayName))
    .replace(/\{color\}/g, safeColor);
  return sanitizeDecorationHtml(withValues);
}
