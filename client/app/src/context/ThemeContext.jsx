import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // ─── Initialise theme ──────────────────────────────────────────────────────
  const getInitialTheme = useCallback(() => {
    try {
      // Check localStorage first
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'white') {
        return saved;
      }

      // Fallback to system preference if available
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      return 'dark'; // Default to dark if nothing else
    } catch (error) {
      console.warn('Theme initialisation error:', error);
      return 'dark';
    }
  }, []);

  const [theme, setThemeState] = useState(getInitialTheme);

  // ─── Toggle between light and dark ────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'white' ? 'dark' : 'white'));
  }, []);

  // ─── Programmatic theme setter ─────────────────────────────────────────────
  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'dark' || newTheme === 'white') {
      setThemeState(newTheme);
    } else {
      console.warn(`Invalid theme: "${newTheme}". Use "dark" or "white".`);
    }
  }, []);

  // ─── Persist theme to localStorage ────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }, [theme]);

  // ─── Listen for system theme changes (optional) ──────────────────────────
  useEffect(() => {
    if (localStorage.getItem('theme')) {
      // If user has manually set a theme, don't override it
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setThemeState(e.matches ? 'dark' : 'white');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // ─── Memoize context value ────────────────────────────────────────────────
  const value = useMemo(() => ({
    theme,
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