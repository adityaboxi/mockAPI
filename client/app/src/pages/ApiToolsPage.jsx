// src/pages/ApiToolsPage.jsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
  console.log('[ApiToolsPage] 🚀 Component mounted with propProjectId:', propProjectId);

  // ---- Project ID (from prop or localStorage) ----
  const projectId = useMemo(() => {
    let id;
    if (propProjectId) {
      id = propProjectId;
      console.log('[ApiToolsPage] 📌 Using projectId from prop:', id);
    } else {
      try {
        const stored = localStorage.getItem('apiToolsProjectId');
        id = stored || 'default-project-id';
        console.log('[ApiToolsPage] 📌 Using projectId from localStorage:', id);
      } catch {
        id = 'default-project-id';
        console.warn('[ApiToolsPage] ⚠️ Failed to read localStorage, using default:', id);
      }
    }
    return id;
  }, [propProjectId]);

  // ---- Split pane state ----
  const containerRef = useRef(null);
  const [leftWidth, setLeftWidth] = useState(() => {
    const width = getStoredWidth('apiToolsLeftWidth', 50);
    console.log('[ApiToolsPage] 📐 Initial leftWidth from localStorage:', width);
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
    console.log('[ApiToolsPage] 📱 Resize detected – window width:', window.innerWidth, '– isMobile:', mobile);
    setIsMobile(mobile);
    if (mobile) {
      console.log('[ApiToolsPage] 📱 Mobile mode – setting leftWidth to 100% (stacked)');
      setLeftWidth(100);
    } else {
      const stored = getStoredWidth('apiToolsLeftWidth', 50);
      console.log('[ApiToolsPage] 💻 Desktop mode – restoring leftWidth from localStorage:', stored);
      setLeftWidth(stored);
    }
  }, []);

  // ---- Register resize listener (and call once on mount) ----
  useEffect(() => {
    handleResize(); // ensures initial sync
    window.addEventListener('resize', handleResize);
    return () => {
      console.log('[ApiToolsPage] 🧹 Removing resize listener');
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // ---- Drag handlers ----
  const handleDragStart = useCallback(
    (e) => {
      console.log('[ApiToolsPage] 👆 Drag started (event type:', e.type, ')');
      // Prevent text selection and scrolling
      e.preventDefault();
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      dragStartRef.current = { x: clientX, width: leftWidth };
      console.log('[ApiToolsPage] 📏 Drag start – clientX:', clientX, '– current width:', leftWidth);
      setIsDragging(true);
    },
    [leftWidth]
  );

  const handleDragMove = useCallback(
    (e) => {
      if (!isDragging || !containerRef.current) {
        if (!isDragging) console.warn('[ApiToolsPage] ⚠️ Drag move called but isDragging = false');
        if (!containerRef.current) console.warn('[ApiToolsPage] ⚠️ Drag move called but containerRef not set');
        return;
      }
      if (e.cancelable) e.preventDefault();

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const containerRect = containerRef.current.getBoundingClientRect();
        const deltaX = clientX - dragStartRef.current.x;
        const deltaPercent = (deltaX / containerRect.width) * 100;
        const newLeft = Math.min(80, Math.max(20, dragStartRef.current.width + deltaPercent));
        console.log('[ApiToolsPage] 🔄 Drag move – deltaX:', deltaX, '– deltaPercent:', deltaPercent.toFixed(2), '% – newLeft:', newLeft.toFixed(2), '%');
        setLeftWidth(newLeft);
        setStoredWidth('apiToolsLeftWidth', newLeft);
        rafIdRef.current = null;
      });
    },
    [isDragging]
  );

  const handleDragEnd = useCallback(() => {
    console.log('[ApiToolsPage] ✋ Drag ended');
    setIsDragging(false);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // ---- Global event listeners (while dragging) ----
  useEffect(() => {
    if (isDragging) {
      console.log('[ApiToolsPage] 🎯 Attaching global drag listeners');
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
      window.addEventListener('mouseleave', handleDragEnd);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    } else {
      console.log('[ApiToolsPage] 🧹 Removing global drag listeners');
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
    console.log('[ApiToolsPage] 👆👆 Double-click detected – resetting width to 50%');
    const newWidth = 50;
    setLeftWidth(newWidth);
    setStoredWidth('apiToolsLeftWidth', newWidth);
  }, []);

  // ---- Render ----
  console.log('[ApiToolsPage] 🖥️ Rendering – isMobile:', isMobile, '– leftWidth:', leftWidth, '% – projectId:', projectId);

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-screen bg-zinc-950"
      style={{ flexDirection: isMobile ? 'column' : 'row' }}
    >
      {/* Left Panel – OpenApi */}
      <div
        className="overflow-auto border-r border-zinc-800"
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
          className={`relative w-2 bg-zinc-800 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors ${
            isDragging ? 'bg-blue-500' : ''
          }`}
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-none">
            <div className="w-1 h-1 rounded-full bg-zinc-500/40" />
            <div className="w-1 h-1 rounded-full bg-zinc-500/40" />
            <div className="w-1 h-1 rounded-full bg-zinc-500/40" />
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
  );
}

export default ApiToolsPage;