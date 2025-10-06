import { useCallback, useEffect, useMemo, useState } from 'react';

type ConcreteTheme = 'light' | 'dark';
export type ThemePreference = ConcreteTheme | 'system';

const STORAGE_KEY = 'settings:theme';
const THEME_QUERY = '(prefers-color-scheme: dark)';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

const readStoredPreference = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'system';
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored && isThemePreference(stored)) {
      return stored;
    }
  } catch (error) {
    console.warn('Unable to read theme preference from localStorage', error);
  }

  return 'system';
};

const resolveSystemTheme = (): ConcreteTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(THEME_QUERY).matches ? 'dark' : 'light';
};

export const useThemePreference = () => {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [systemTheme, setSystemTheme] = useState<ConcreteTheme>(() => resolveSystemTheme());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextTheme = resolveSystemTheme();
    setSystemTheme(nextTheme);

    const media = window.matchMedia(THEME_QUERY);

    const handleMediaChange = (event: MediaQueryListEvent | MediaQueryList) => {
      const isDark = 'matches' in event ? event.matches : media.matches;
      setSystemTheme(isDark ? 'dark' : 'light');
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleMediaChange);
      return () => {
        media.removeEventListener('change', handleMediaChange);
      };
    }

    media.addListener(handleMediaChange);
    return () => {
      media.removeListener(handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleFocus = () => {
      const nextTheme = resolveSystemTheme();
      setSystemTheme((current) => (current === nextTheme ? current : nextTheme));
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const appliedTheme = preference === 'system' ? systemTheme : preference;
    document.documentElement.setAttribute('data-theme', appliedTheme);
  }, [preference, systemTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, preference);
    } catch (error) {
      console.warn('Unable to persist theme preference', error);
    }
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
  }, []);

  return useMemo(
    () => ({
      preference,
      setPreference,
      systemTheme,
      appliedTheme: preference === 'system' ? systemTheme : preference,
    }),
    [preference, setPreference, systemTheme]
  );
};

export type ThemeController = ReturnType<typeof useThemePreference>;
