import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiClient } from '../services/api';
import type { Language } from '../i18n/translations';

export interface NameDecorationEntry {
  value: string;
  labels: Record<Language, string>;
  html: string;
}

interface NameDecorationContextType {
  decorations: Record<string, NameDecorationEntry>;
  refresh: () => Promise<void>;
}

const NameDecorationContext = createContext<NameDecorationContextType>({
  decorations: {},
  refresh: async () => {}
});

interface ApiNameDecoration {
  value: string;
  labels?: Partial<Record<Language, string>>;
  html?: string;
}

export const NameDecorationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [decorations, setDecorations] = useState<Record<string, NameDecorationEntry>>({});

  const refresh = useCallback(async () => {
    try {
      const entries = await ApiClient.getDecorations();
      if (!Array.isArray(entries)) return;
      const next: Record<string, NameDecorationEntry> = {};
      for (const entry of entries as ApiNameDecoration[]) {
        if (!entry?.value) continue;
        next[entry.value] = {
          value: entry.value,
          labels: {
            en: entry.labels?.en || entry.value,
            fr: entry.labels?.fr || entry.labels?.en || entry.value,
            de: entry.labels?.de || entry.labels?.en || entry.value,
            es: entry.labels?.es || entry.labels?.en || entry.value,
            it: entry.labels?.it || entry.labels?.en || entry.value
          },
          html: typeof entry.html === 'string' ? entry.html : ''
        };
      }
      setDecorations(next);
    } catch (error) {
      console.warn('Unable to load name decorations', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <NameDecorationContext.Provider value={{ decorations, refresh }}>
      {children}
    </NameDecorationContext.Provider>
  );
};

export const useNameDecorations = () => useContext(NameDecorationContext);
