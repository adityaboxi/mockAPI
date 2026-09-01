// src/context/ToastContext.jsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';

const ToastContext = createContext(null);

const MAX_TOASTS = 5;
const DEDUP_WINDOW_MS = 400;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const recentToastsRef = useRef(new Map());

  // Cleanup all pending timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => clearTimeout(timerId));
      timersRef.current.clear();
      recentToastsRef.current.clear();
    };
  }, []);

  const removeToast = useCallback((id) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 3500) => {
    if (!message) return;
    const msgStr = typeof message === 'string' ? message : String(message);

    // Flood & Deduplication Guard
    const dedupKey = `${type}:${msgStr}`;
    const now = Date.now();
    if (recentToastsRef.current.has(dedupKey)) {
      const lastTime = recentToastsRef.current.get(dedupKey);
      if (now - lastTime < DEDUP_WINDOW_MS) {
        return; // Suppress duplicate burst
      }
    }
    recentToastsRef.current.set(dedupKey, now);

    const id = `toast-${now}-${Math.random().toString(36).substring(2, 7)}`;
    const toast = { id, type, message: msgStr, duration };

    setToasts((prev) => {
      const updated = [...prev, toast];
      if (updated.length > MAX_TOASTS) {
        const oldest = updated[0];
        if (timersRef.current.has(oldest.id)) {
          clearTimeout(timersRef.current.get(oldest.id));
          timersRef.current.delete(oldest.id);
        }
        return updated.slice(updated.length - MAX_TOASTS);
      }
      return updated;
    });

    if (duration > 0) {
      const timerId = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timerId);
    }
  }, [removeToast]);

  const showSuccess = useCallback((message, duration) => addToast('success', message, duration), [addToast]);
  const showError = useCallback((message, duration) => addToast('error', message, duration), [addToast]);
  const showInfo = useCallback((message, duration) => addToast('info', message, duration), [addToast]);
  const showWarning = useCallback((message, duration) => addToast('warning', message, duration), [addToast]);

  const value = useMemo(() => ({
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
  }), [toasts, addToast, removeToast, showSuccess, showError, showInfo, showWarning]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      addToast: () => {},
      removeToast: () => {},
      showSuccess: (msg) => console.log('Toast (success):', msg),
      showError: (msg) => console.error('Toast (error):', msg),
      showInfo: (msg) => console.log('Toast (info):', msg),
      showWarning: (msg) => console.warn('Toast (warning):', msg),
    };
  }
  return context;
};