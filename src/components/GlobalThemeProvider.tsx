'use client';

import React, { useEffect, useState } from 'react';
import { getGlobalTheme, applyThemeClass, THEME_CHANGE_EVENT, ThemeType, VALID_THEMES } from '@/lib/theme';

export const GlobalThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(() => {
    if (typeof window !== 'undefined') {
      return getGlobalTheme();
    }
    return 'white';
  });

  useEffect(() => {
    // 1. Initial application
    const theme = getGlobalTheme();
    setCurrentTheme(theme);
    applyThemeClass(theme);

    // 2. Custom event listener (within same tab)
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeType>;
      if (customEvent.detail && VALID_THEMES.includes(customEvent.detail)) {
        setCurrentTheme(customEvent.detail);
        applyThemeClass(customEvent.detail);
      }
    };

    // 3. Storage event listener (across browser tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'clean_reader_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.theme && VALID_THEMES.includes(parsed.theme)) {
            setCurrentTheme(parsed.theme);
            applyThemeClass(parsed.theme);
          }
        } catch {}
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return <>{children}</>;
};
