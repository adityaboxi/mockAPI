// src/components/ToastContainer.jsx
import React from 'react';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

const ToastContainer = () => {
  const { toasts, removeToast } = useToast();
  const { theme } = useTheme();
  const isWhiteTheme = theme === 'white';

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-0 left-0 sm:left-auto sm:right-5 sm:bottom-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => {
        let borderClass = isWhiteTheme ? 'border-blue-200' : 'border-blue-500/30';
        let bgClass = isWhiteTheme
          ? 'bg-white/95 text-slate-800 shadow-lg border-slate-200'
          : 'bg-[#181825]/95 text-zinc-100 shadow-2xl border-zinc-800';
        let icon = 'ℹ';
        let iconBg = 'bg-blue-500/20 text-blue-400';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        if (toast.type === 'success') {
          borderClass = isWhiteTheme ? 'border-emerald-200' : 'border-emerald-500/40';
          icon = '✓';
          iconBg = 'bg-emerald-500/20 text-emerald-400 font-bold';
        } else if (isError) {
          borderClass = isWhiteTheme ? 'border-rose-200' : 'border-rose-500/40';
          icon = '✕';
          iconBg = 'bg-rose-500/20 text-rose-400 font-bold';
        } else if (isWarning) {
          borderClass = isWhiteTheme ? 'border-amber-200' : 'border-amber-500/40';
          icon = '⚠';
          iconBg = 'bg-amber-500/20 text-amber-400 font-bold';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 ${bgClass} ${borderClass}`}
            role={isError || isWarning ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
          >
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0 select-none ${iconBg}`}
              aria-hidden="true"
            >
              {icon}
            </span>
            <div className="flex-1 text-xs font-mono leading-relaxed pt-0.5 break-words select-text">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-zinc-400 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1 text-xs leading-none transition-colors"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default React.memo(ToastContainer);