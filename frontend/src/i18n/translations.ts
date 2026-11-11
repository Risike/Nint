import { fr } from './locales/fr';
import { de } from './locales/de';
import { es } from './locales/es';
import { it } from './locales/it';

export type Language = 'en' | 'fr' | 'de' | 'es' | 'it';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' }
];

export const LANGUAGE_LOCALES: Record<Language, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT'
};

const DICTIONARIES: Record<Exclude<Language, 'en'>, Record<string, string>> = {
  fr,
  de,
  es,
  it
};

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'fr' || value === 'de' || value === 'es' || value === 'it';
}

export function translate(
  language: Language,
  source: string,
  vars?: Record<string, string | number>
): string {
  const template = language === 'en' ? source : DICTIONARIES[language][source] || source;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] !== undefined ? String(vars[key]) : match
  );
}
