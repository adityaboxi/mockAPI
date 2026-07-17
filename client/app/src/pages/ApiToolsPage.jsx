// src/pages/ApiToolsPage.jsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import NetworkTest from './NetworkTest';
import OpenApi from './OpenApi';

// Helper to safely access localStorage
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

function ApiToolsPage({ projectId: propProjectId }) {
  // ---- Project ID ----
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
  const [leftWidth, setLeftWidth] = useState(() =>
    getStoredWidth('apiToolsLeftWidth', 50)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // ---- Drag refs for throttling ----
  const rafIdRef = useRef(null);
  const dragStartRef = useRef({ x: 0, width: 0 });

  // ---- Responsive check ----
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setLeftWidth(100);
      } else {
        const stored = getStoredWidth('apiToolsLeftWidth', 50);
        setLeftWidth(stored);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
  }, []);

  // ---- Global listeners ----
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
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // ---- Double-click to reset to 50/50 ----
  const handleDividerDoubleClick = useCallback(() => {
    const newWidth = 50;
    setLeftWidth(newWidth);
    setStoredWidth('apiToolsLeftWidth', newWidth);
  }, []);

  // ---- Render ----
  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-screen bg-zinc-950"
      style={{ flexDirection: isMobile ? 'column' : 'row' }}
    >
      {/* Left Panel - OpenApi */}
      <div
        className="overflow-auto border-r border-zinc-800"
        style={{
          width: isMobile ? '100%' : `${leftWidth}%`,
          height: isMobile ? '50%' : '100%',
        }}
      >
        <OpenApi />
      </div>

      {/* Divider - only visible on desktop */}
      {!isMobile && (
        <div
          className={`relative w-2 bg-zinc-800 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors ${
            isDragging ? 'bg-blue-500' : ''
          }`}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onDoubleClick={handleDividerDoubleClick}
          role="separator"
          aria-valuenow={leftWidth}
          aria-label="Resize panels – double‑click to reset"
          aria-orientation="vertical"
        >
          {/* Visual grip dots */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-none">
            <div className="w-1 h-1 rounded-full bg-zinc-500/40" />
            <div className="w-1 h-1 rounded-full bg-zinc-500/40" />
            <div className="w-1 h-1 rounded-full bg-zinc-500/40" />
          </div>
        </div>
      )}

      {/* Right Panel - NetworkTest */}
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
  );
}

export default ApiToolsPage;