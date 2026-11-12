import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApiClient } from '../services/api';
import type { Language } from '../i18n/translations';
import {
  THEME_CATALOG,
  type ThemeCatalogEntry,
  type ThemePreview
} from '../i18n/themes';

export type ThemeCatalog = Record<string, ThemeCatalogEntry>;

interface ApiTheme {
  value: string;
  mode: 'dark' | 'light';
  labels?: Partial<Record<Language, string>>;
  preview?: ThemePreview;
}

interface ThemeContextType {
  themes: ThemeCatalog;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STYLE_ID = 'nint-runtime-themes';

function buildCatalog(entries: ApiTheme[]): ThemeCatalog {
  if (!entries.length) return THEME_CATALOG;

  const catalog: ThemeCatalog = {};
  for (const entry of entries) {
    if (!entry?.value || !entry.preview) continue;
    const fallback = THEME_CATALOG[entry.value];
    catalog[entry.value] = {
      value: entry.value,
      mode: entry.mode === 'light' ? 'light' : 'dark',
      labels: {
        ...(fallback?.labels || {}),
        ...(entry.labels || {})
      } as Record<Language, string>,
      preview: {
        ...(fallback?.preview || entry.preview),
        ...entry.preview
      }
    };
  }

  return Object.keys(catalog).length ? catalog : THEME_CATALOG;
}

function buildThemeCss(catalog: ThemeCatalog): string {
  return Object.values(catalog).map(({ value, preview }) => `
[data-theme="${value}"] {
  --bg-primary: ${preview.bgPrimary};
  --bg-secondary: ${preview.bgSecondary};
  --bg-tertiary: ${preview.bgTertiary};
  --bg-card: ${preview.bgCard};
  --border-color: ${preview.borderColor};
  --border-focus: ${preview.borderFocus};
  --text-primary: ${preview.textPrimary};
  --text-secondary: ${preview.textSecondary};
  --text-muted: ${preview.textMuted};
  --accent-cyan: ${preview.accentCyan};
  --accent-blue: ${preview.accentBlue};
  --accent-purple: ${preview.accentPurple};
  --accent-pink: ${preview.accentPink};
  --accent-green: ${preview.accentGreen};
  --accent-orange: ${preview.accentOrange};
  --accent-red: ${preview.accentRed};
  --accent-yellow: ${preview.accentYellow};
  --shadow-lg: ${preview.shadow};
}`).join('\n');
}

function applyThemeCss(catalog: ThemeCatalog) {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = buildThemeCss(catalog);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themes, setThemes] = useState<ThemeCatalog>(THEME_CATALOG);

  useEffect(() => {
    let cancelled = false;
    const loadThemes = async () => {
      try {
        const entries = await ApiClient.getThemes();
        if (!cancelled) setThemes(buildCatalog(Array.isArray(entries) ? entries : []));
      } catch (error) {
        console.warn('Unable to load the theme catalog', error);
      }
    };
    void loadThemes();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyThemeCss(themes);
  }, [themes]);

  return (
    <ThemeContext.Provider value={{ themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeCatalog = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeCatalog must be used within ThemeProvider');
  return ctx;
};
