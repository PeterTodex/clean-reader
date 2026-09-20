import { ReaderSettings, storage } from '@/lib/storage';

export type ThemeType = ReaderSettings['theme'];

export interface ThemeMeta {
  id: ThemeType;
  label: string;
  bg: string;
  text: string;
  border: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'white', label: '纯净雅白', bg: '#ffffff', text: '#09090b', border: '#e4e4e7' },
  { id: 'parchment', label: '复古羊皮', bg: '#f5ebd7', text: '#2d1f11', border: '#dbc9a6' },
  { id: 'eyecare', label: '清新竹青', bg: '#edf4ee', text: '#142518', border: '#c4d9c7' },
  { id: 'apricot', label: '暖阳浅杏', bg: '#fbf4ea', text: '#2d241c', border: '#dfcebc' },
  { id: 'navy', label: '苍青夜读', bg: '#0b1120', text: '#e2e8f0', border: '#1e293b' },
  { id: 'dark', label: '夜间暗色', bg: '#121214', text: '#f4f4f5', border: '#27272a' },
];

export const VALID_THEMES: ThemeType[] = ['white', 'parchment', 'eyecare', 'apricot', 'navy', 'dark'];

export const THEME_CHANGE_EVENT = 'clean-reader-theme-change';

/**
 * Apply target theme class and dark-mode class to documentElement
 */
export function applyThemeClass(theme: ThemeType | string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Remove previous and legacy theme classes
  const allThemes = ['white', 'parchment', 'eyecare', 'apricot', 'navy', 'dark', 'oled', 'eink'];
  allThemes.forEach((t) => {
    root.classList.remove(`theme-${t}`);
  });

  // Handle migration
  let targetTheme = theme as string;
  if (targetTheme === 'oled') targetTheme = 'dark';
  if (targetTheme === 'eink') targetTheme = 'white';
  const safeTheme = (VALID_THEMES as string[]).includes(targetTheme) ? (targetTheme as ThemeType) : 'white';

  root.classList.add(`theme-${safeTheme}`);

  // Sync Tailwind dark: class
  if (safeTheme === 'dark' || safeTheme === 'navy') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Update global theme, persist to storage, and notify all components
 */
export function setGlobalTheme(theme: ThemeType | string): void {
  if (typeof window === 'undefined') return;
  let targetTheme = theme as string;
  if (targetTheme === 'oled') targetTheme = 'dark';
  if (targetTheme === 'eink') targetTheme = 'white';
  const safeTheme = (VALID_THEMES as string[]).includes(targetTheme) ? (targetTheme as ThemeType) : 'white';

  storage.saveSettings({ theme: safeTheme });
  applyThemeClass(safeTheme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: safeTheme }));
}

/**
 * Read currently saved theme from storage
 */
export function getGlobalTheme(): ThemeType {
  if (typeof window === 'undefined') return 'white';
  const settings = storage.getSettings();
  let theme = settings.theme as string;
  if (theme === 'oled') theme = 'dark';
  if (theme === 'eink') theme = 'white';
  return (VALID_THEMES as string[]).includes(theme) ? (theme as ThemeType) : 'white';
}
