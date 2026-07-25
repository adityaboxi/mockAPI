// src/pages/ApiToolsPage.jsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
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
function ApiToolsPage({ projectId: propProjectId }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  // ---- Project ID (from prop or localStorage) ----
  const projectId = useMemo(() => {
    if (propProjectId) return propProjectId;
    try {
      const stored = localStorage.getItem('apiToolsProjectId');
      return stored || 'default-project-id';
    } catch {
      return 'default-project-id';
    }
  }, [propProjectId]);

  // ---- Split pane state ----
  const containerRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    const width = getStoredWidth('apiToolsLeftWidth', 50);
    return width;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ---- Refs for drag (throttling) ----
  const rafIdRef = useRef(null);
  const dragStartRef = useRef({ x: 0, width: 0 });

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

  // ---- Register resize listener (and call once on mount) ----
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

  // ---- Double-click to reset to 50/50 ----
  const handleDividerDoubleClick = useCallback(() => {
    const newWidth = 50;
    setLeftWidth(newWidth);
    setStoredWidth('apiToolsLeftWidth', newWidth);
  }, []);

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

  // ---- Render ----
  return (
    <div className={`h-screen flex flex-col overflow-hidden ${bg} transition-colors duration-200`}>
      {/* ========== TOP HEADER ========== */}
      <header className={`h-12 shrink-0 flex items-center px-5 border-b ${headerBg} ${borderColor}`}>
        <div className="flex items-center gap-5">
          <button
            onClick={() => navigate('/setting')}
            className={`
              flex items-center gap-2 text-sm font-medium transition-all duration-200
              ${isWhiteTheme ? 'text-gray-500 hover:text-gray-800' : 'text-zinc-400 hover:text-white'}
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded
              ${isWhiteTheme ? 'focus:ring-offset-white' : 'focus:ring-offset-zinc-900'}
            `}
            aria-label="Go back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back</span>
          </button>

          <div className={`w-px h-5 ${isWhiteTheme ? 'bg-gray-200' : 'bg-zinc-700'}`} />

          <span className={`text-sm font-semibold tracking-wide ${headerText}`}>
            API Tools
          </span>
        </div>

        <div className="flex-1 flex items-center justify-end gap-3">
          <span className={`text-xs font-mono ${mutedText}`}>
            Project: <span className="font-semibold">{projectId}</span>
          </span>
        </div>
      </header>

      {/* ========== SPLIT PANES ========== */}
      <div
        ref={containerRef}
        className="flex-1 flex min-h-0"
        style={{ flexDirection: isMobile ? 'column' : 'row' }}
      >
        {/* Left Panel – OpenApi */}
        <div
          className="overflow-auto"
          style={{
            width: isMobile ? '100%' : `${leftWidth}%`,
            height: isMobile ? '50%' : '100%',
          }}
        >
          <OpenApi />
        </div>

        {/* Divider – visible only on desktop */}
        {!isMobile && (
          <div
            className={`
              relative w-1.5 group cursor-col-resize transition-all duration-150
              ${isDragging ? dividerActiveBg : dividerBg}
              ${!isDragging && dividerHoverBg}
              flex-shrink-0
            `}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onDoubleClick={handleDividerDoubleClick}
            role="separator"
            aria-valuenow={leftWidth}
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
            <div className={`
              absolute inset-0 pointer-events-none transition-opacity duration-200
              ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
            `}>
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-blue-500/20 blur-sm" />
            </div>
          </div>
        )}

        {/* Right Panel – NetworkTest */}
        <div
          className="overflow-auto"
          style={{
            width: isMobile ? '100%' : `${100 - leftWidth}%`,
            height: isMobile ? '50%' : '100%',
          }}
        >
          <NetworkTest projectId={projectId} />
        </div>
      </div>
    </div>
  );
}

export default ApiToolsPage;