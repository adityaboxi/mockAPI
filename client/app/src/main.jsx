// src/main.jsx
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProjectProvider } from './context/ProjectContext';
import { ThemeProvider } from './context/ThemeContext';
import { ApiVersionProvider } from './context/ApiVersionContext';
import { SocketProvider } from './context/SocketContext';
import { useTheme } from './context/ThemeContext';
import { useAuth } from './context/AuthContext';




// ──────────────────────────────────────────────────────────────
// GLOBAL FETCH OVERRIDE – ensure credentials are always sent
// ──────────────────────────────────────────────────────────────
const originalFetch = window.fetch;
window.fetch = function (url, options) {
  options = options || {};
  options.credentials = 'include';
  return originalFetch.call(this, url, options);
};

// ──────────────────────────────────────────────────────────────
// THEME-AWARE META TAG (for mobile browser chrome)
// ──────────────────────────────────────────────────────────────
function ThemeColorMeta() {
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = isWhiteTheme ? '#f9fafb' : '#09090b';
    }
  }, [isWhiteTheme]);

  return null;
}

// ──────────────────────────────────────────────────────────────
// ROOT CONTAINER – with loading state & theme-aware background
// ──────────────────────────────────────────────────────────────
function RootContainer() {
  const { theme } = useTheme();
  const { isLoading } = useAuth();
  const isWhiteTheme = theme === 'white';
  const [showApp, setShowApp] = useState(false);

  // ─── Apply theme-aware backgrounds ──────────────────────────
  useEffect(() => {
    const bgColor = isWhiteTheme ? '#f9fafb' : '#09090b';
    document.documentElement.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    // Apply smooth transition for theme changes
    document.documentElement.style.transition = 'background-color 0.2s ease';
    document.body.style.transition = 'background-color 0.2s ease';
  }, [isWhiteTheme]);

  // ─── Brief delay to prevent flash of unstyled content ──────
  useEffect(() => {
    const timer = setTimeout(() => setShowApp(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // ─── Loading state ────────────────────────────────────────────
  if (isLoading || !showApp) {
    const spinnerBg = isWhiteTheme ? 'bg-gray-50' : 'bg-zinc-950';
    const spinnerColor = isWhiteTheme ? 'border-blue-600' : 'border-blue-400';

    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${spinnerBg}`}>
        <div className="flex flex-col items-center gap-4">
          <div className={`w-8 h-8 border-3 rounded-full animate-spin ${spinnerColor} border-t-transparent`} />
          <p className={`text-xs font-medium ${isWhiteTheme ? 'text-gray-400' : 'text-zinc-500'}`}>
            Loading MockAPI…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ThemeColorMeta />
      <App />
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// APP WRAPPER – all providers, router, and strict mode
// ──────────────────────────────────────────────────────────────
function AppWrapper() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <ApiVersionProvider>
            <SocketProvider>
              <App />
            </SocketProvider>
          </ApiVersionProvider>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

// ──────────────────────────────────────────────────────────────
// BOOTSTRAP
// ──────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppWrapper />
    </BrowserRouter>
  </StrictMode>
);