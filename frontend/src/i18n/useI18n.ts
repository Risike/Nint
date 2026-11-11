import { useCallback, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { LANGUAGE_LOCALES, Language, translate } from './translations';

export function useI18n() {
  const { settings, updateSettings } = useSettings();
  const language = settings.language;

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const t = useCallback(
    (source: string, vars?: Record<string, string | number>) => translate(language, source, vars),
    [language]
  );

  const setLanguage = useCallback(
    (next: Language) => updateSettings({ language: next }),
    [updateSettings]
  );

  const formatDate = useCallback(
    (value: string | number | Date) => new Date(value).toLocaleDateString(LANGUAGE_LOCALES[language]),
    [language]
  );

  return { t, language, setLanguage, formatDate, locale: LANGUAGE_LOCALES[language] };
}
