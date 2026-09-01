// src/context/ThemeContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext(null);

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'white') {
      return saved;
    }
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'dark';
  } catch (error) {
    console.warn('Theme initialisation error:', error);
    return 'dark';
  }
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);

  // ─── Toggle between light and dark ────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'white' ? 'dark' : 'white'));
  }, []);

  // ─── Programmatic theme setter ─────────────────────────────────────────────
  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'dark' || newTheme === 'white') {
      setThemeState(newTheme);
    } else {
      console.warn(`Invalid theme: "${newTheme}". Use "dark" or "white".`);
    }
  }, []);

  // ─── Persist theme to localStorage & synchronize DOM ──────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.style.colorScheme = 'light';
      }

      // Update mobile viewport meta theme-color
      let meta = document.querySelector("meta[name='theme-color']");
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', theme === 'white' ? '#f8fafc' : '#09090b');
    }
  }, [theme]);

  // ─── Cross-Tab Sync & System Preference Listener ──────────────────────────
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'theme' && (e.newValue === 'dark' || e.newValue === 'white')) {
        setThemeState(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    let mediaQuery;
    let handleMediaChange;
    if (typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      handleMediaChange = (e) => {
        if (!localStorage.getItem('theme')) {
          setThemeState(e.matches ? 'dark' : 'white');
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
      }
    }

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (mediaQuery && mediaQuery.removeEventListener && handleMediaChange) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      }
    };
  }, []);

  // ─── Memoize context value ────────────────────────────────────────────────
  const value = useMemo(() => ({
    theme,
    isWhiteTheme: theme === 'white',
    isDarkTheme: theme === 'dark',
    toggleTheme,
    setTheme,
  }), [theme, toggleTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};