// src/components/ErrorBoundary.jsx
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      const savedTheme = localStorage.getItem('theme');
      localStorage.clear();
      sessionStorage.clear();
      if (savedTheme) {
        localStorage.setItem('theme', savedTheme);
      }
    } catch (_) {}
    window.location.href = '/';
  };

  handleCopyError = () => {
    const errorDetails = `Error: ${this.state.error?.message}\nStack: ${this.state.error?.stack}\nComponentStack: ${this.state.errorInfo?.componentStack}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(errorDetails).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error, () => this.setState({ hasError: false, error: null }))
          : this.props.fallback;
      }

      const isChunkError =
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk');

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 text-zinc-100 p-6 font-sans">
          <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold select-none">
              ✕
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-zinc-100">
                {isChunkError ? 'New Version Available' : 'Application Runtime Error'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isChunkError
                  ? 'A new build of MockAPI was deployed. Reload to get the latest version.'
                  : 'MockAPI encountered an unexpected issue while rendering this component.'}
              </p>
              {this.state.error?.message && (
                <div className="p-3 bg-black/40 border border-rose-500/30 rounded-xl text-xs font-mono text-rose-300 text-left overflow-x-auto select-all max-h-32 custom-scrollbar">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleCopyError}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all focus:outline-none"
              >
                {this.state.copied ? '✓ Copied' : 'Copy Trace'}
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all focus:outline-none"
              >
                Reset Storage
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;