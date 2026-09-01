// src/pages/ApiToolsPage.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import NetworkTest from './NetworkTest';
import OpenApi from './OpenApi';

// ---------- Helper functions (persist width) ----------
const getStoredWidth = (key, fallback = 50) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? parseFloat(stored) : fallback;
  } catch {
    return fallback;
  }
};

const setStoredWidth = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
};

// ---------- Component ----------
function ApiToolsPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isWhiteTheme = theme === 'white';

  // ---- Project ID state ----
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    try {
      return localStorage.getItem('apiToolsProjectId') || null;
    } catch {
      return null;
    }
  });
  const [refreshKey, setRefreshKey] = useState(0);

  // ---- Split pane state ----
  const containerRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    return getStoredWidth('apiToolsLeftWidth', 50);
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  // ---- Refs for drag (throttling) ----
  const rafIdRef = useRef(null);
  const dragStartRef = useRef({ x: 0, width: 0 });

  // ---- Project selection handler ----
  const handleProjectSelect = useCallback((projectId) => {
    setSelectedProjectId(projectId);
    try {
      localStorage.setItem('apiToolsProjectId', projectId);
    } catch {
      // ignore
    }
  }, []);

  const handleProjectRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // ---- Responsive handler ----
  const handleResize = useCallback(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (mobile) {
      setLeftWidth(100);
    } else {
      const stored = getStoredWidth('apiToolsLeftWidth', 50);
      setLeftWidth(stored);
    }
  }, []);

  // ---- Register resize listener ----
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // ---- Drag handlers ----
  const handleDragStart = useCallback(
    (e) => {
      e.preventDefault();
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      dragStartRef.current = { x: clientX, width: leftWidth };
      setIsDragging(true);
    },
    [leftWidth]
  );

  const handleDragMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) return;
      if (e.cancelable) e.preventDefault();

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const containerRect = containerRef.current.getBoundingClientRect();
        const deltaX = clientX - dragStartRef.current.x;
        const deltaPercent = (deltaX / containerRect.width) * 100;
        const newLeft = Math.min(80, Math.max(20, dragStartRef.current.width + deltaPercent));
        setLeftWidth(newLeft);
        setStoredWidth('apiToolsLeftWidth', newLeft);
        rafIdRef.current = null;
      });
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // ---- Global event listeners (while dragging) ----
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
      window.addEventListener('mouseleave', handleDragEnd);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('mouseleave', handleDragEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ---- Double-click & Keyboard to reset or adjust ----
  const handleDividerDoubleClick = useCallback(() => {
    const newWidth = 50;
    setLeftWidth(newWidth);
    setStoredWidth('apiToolsLeftWidth', newWidth);
  }, []);

  const handleDividerKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setLeftWidth((prev) => {
        const next = Math.max(20, prev - 5);
        setStoredWidth('apiToolsLeftWidth', next);
        return next;
      });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setLeftWidth((prev) => {
        const next = Math.min(80, prev + 5);
        setStoredWidth('apiToolsLeftWidth', next);
        return next;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDividerDoubleClick();
    }
  }, [handleDividerDoubleClick]);

  // ---- Theme-aware styles ----
  const bg = isWhiteTheme ? 'bg-gray-50' : 'bg-zinc-950';
  const headerBg = isWhiteTheme ? 'bg-white' : 'bg-zinc-900';
  const borderColor = isWhiteTheme ? 'border-gray-200' : 'border-zinc-800';
  const headerText = isWhiteTheme ? 'text-gray-700' : 'text-zinc-200';
  const mutedText = isWhiteTheme ? 'text-gray-400' : 'text-zinc-500';
  const dividerBg = isWhiteTheme ? 'bg-gray-200' : 'bg-zinc-800';
  const dividerHoverBg = 'hover:bg-blue-500';
  const dividerActiveBg = 'bg-blue-500';
  const dotBg = isWhiteTheme ? 'bg-gray-300/60' : 'bg-zinc-600/40';

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${bg} transition-colors duration-200`}>
      {/* ========== TOP HEADER ========== */}
      <header className={`h-[52px] shrink-0 flex items-center px-5 border-b ${headerBg} ${borderColor}`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
              isWhiteTheme ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            aria-label="Back to Studio Home"
          >
            ← Studio
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
              isWhiteTheme ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-zinc-800 text-zinc-400'
            }`}
            aria-label="Go to Dashboard"
          >
            <span>📊 Dashboard</span>
          </button>

          <div className={`w-px h-4 ${isWhiteTheme ? 'bg-slate-200' : 'bg-zinc-800'}`} />

          <span className={`text-xs font-bold tracking-wider uppercase ${headerText}`}>
            API Engineering Tools
          </span>
        </div>

        <div className="flex-1 flex items-center justify-end gap-3">
          <span className={`text-xs font-mono ${mutedText}`}>
            {user?.username || 'Guest'}
          </span>
        </div>
      </header>

      {/* ========== SPLIT PANES ========== */}
      <main
        ref={containerRef}
        className="flex-1 flex min-h-0"
        style={{ flexDirection: isMobile ? 'column' : 'row' }}
      >
        {/* Left Panel – OpenApi with Project Selector */}
        <section
          className="overflow-auto custom-scrollbar"
          style={{
            width: isMobile ? '100%' : `${leftWidth}%`,
            height: isMobile ? '50%' : '100%',
          }}
          aria-label="OpenAPI Specification Importer"
        >
          <OpenApi
            key={refreshKey}
            selectedProjectId={selectedProjectId}
            onProjectSelect={handleProjectSelect}
            onProjectRefresh={handleProjectRefresh}
          />
        </section>

        {/* Divider – visible only on desktop */}
        {!isMobile && (
          <div
            className={`relative w-1.5 group cursor-col-resize transition-all duration-150 ${
              isDragging ? dividerActiveBg : dividerBg
            } ${!isDragging && dividerHoverBg} shrink-0`}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onDoubleClick={handleDividerDoubleClick}
            onKeyDown={handleDividerKeyDown}
            role="separator"
            aria-valuenow={Math.round(leftWidth)}
            aria-valuemin={20}
            aria-valuemax={80}
            aria-label="Resize panels – double‑click to reset to 50/50"
            aria-orientation="vertical"
            tabIndex={0}
          >
            {/* Visual grip dots */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1.5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className={`w-1 h-1 rounded-full ${dotBg}`} />
              <div className={`w-1 h-1 rounded-full ${dotBg}`} />
              <div className={`w-1 h-1 rounded-full ${dotBg}`} />
            </div>

            {/* Hover/active glow effect */}
            <div
              className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${
                isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-blue-500/20 blur-sm" />
            </div>
          </div>
        )}

        {/* Right Panel – NetworkTest */}
        <section
          className="overflow-auto custom-scrollbar"
          style={{
            width: isMobile ? '100%' : `${100 - leftWidth}%`,
            height: isMobile ? '50%' : '100%',
          }}
          aria-label="Network Latency Diagnostic"
        >
          <NetworkTest projectId={selectedProjectId} />
        </section>
      </main>
    </div>
  );
}


export default React.memo(ApiToolsPage);