// src/main.jsx
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProjectProvider } from './context/ProjectContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ApiVersionProvider } from './context/ApiVersionContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';

// ──────────────────────────────────────────────────────────────
// GLOBAL FETCH OVERRIDE – ensure credentials are always sent
// ──────────────────────────────────────────────────────────────
if (typeof window !== 'undefined' && !window.__MOCKAPI_FETCH_PATCHED__) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    let options = init;

    // Handle Request object vs URL string input
    if (input instanceof Request) {
      options = {
        credentials: input.credentials || 'include',
        ...init,
      };
    } else {
      options = {
        credentials: 'include',
        ...init,
      };
    }

    return originalFetch.call(this, input, options);
  };
  window.__MOCKAPI_FETCH_PATCHED__ = true;
}

// ──────────────────────────────────────────────────────────────
// THEME-AWARE META TAG (for mobile browser chrome)
// ──────────────────────────────────────────────────────────────
function ThemeColorMeta() {
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = isWhiteTheme ? '#f9fafb' : '#09090b';
  }, [isWhiteTheme]);

  return null;
}

// ──────────────────────────────────────────────────────────────
// ROOT CONTAINER – with smooth background & class sync
// ──────────────────────────────────────────────────────────────
function RootContainer() {
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  useEffect(() => {
    const bgColor = isWhiteTheme ? '#f9fafb' : '#09090b';
    const root = document.documentElement;
    const body = document.body;

    root.style.backgroundColor = bgColor;
    body.style.backgroundColor = bgColor;
    root.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';

    // Synchronize Tailwind dark mode classes
    if (isWhiteTheme) {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }

    // Apply smooth transition for theme switches
    root.style.transition = 'background-color 0.2s ease';
    body.style.transition = 'background-color 0.2s ease';
  }, [isWhiteTheme]);

  return (
    <>
      <ThemeColorMeta />
      <App />
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// APP WRAPPER – all providers, router, and error boundary
// ──────────────────────────────────────────────────────────────
function AppWrapper() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ProjectProvider>
            <ApiVersionProvider>
              <SocketProvider>
                <ToastProvider>
                  <RootContainer />
                </ToastProvider>
              </SocketProvider>
            </ApiVersionProvider>
          </ProjectProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

// ──────────────────────────────────────────────────────────────
// BOOTSTRAP
// ──────────────────────────────────────────────────────────────
const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <AppWrapper />
      </BrowserRouter>
    </StrictMode>
  );
}