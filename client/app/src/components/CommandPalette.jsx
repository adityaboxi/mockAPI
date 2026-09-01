// src/components/CommandPalette.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const CommandPalette = ({ onNewAPI, onOpenTester, onOpenCodeExport }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const selectedItemRef = useRef(null);
  const navigate = useNavigate();

  const { projects, selectProject } = useProject();
  const { theme, toggleTheme } = useTheme();
  const { isGuest } = useAuth();
  const isWhiteTheme = theme === 'white';

  // Listen for global shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Build searchable items list
  const allItems = useMemo(() => {
    const items = [];

    // 1. Quick Actions
    items.push({
      id: 'action-new-api',
      category: 'Actions',
      icon: '⚡',
      title: 'Create New Mock API Endpoint',
      subtitle: 'Open the endpoint blueprint builder',
      perform: () => {
        onNewAPI?.();
        navigate('/');
      },
    });

    if (onOpenTester) {
      items.push({
        id: 'action-test-api',
        category: 'Actions',
        icon: '🧪',
        title: 'Open Mock API Request Tester',
        subtitle: 'Test live mock endpoints in the console',
        perform: () => onOpenTester(),
      });
    }

    if (onOpenCodeExport) {
      items.push({
        id: 'action-export-code',
        category: 'Actions',
        icon: '🚀',
        title: 'Export Client Code (cURL, fetch, Python)',
        subtitle: 'Generate client SDK snippets for active endpoint',
        perform: () => onOpenCodeExport(),
      });
    }

    items.push({
      id: 'action-import-openapi',
      category: 'Actions',
      icon: '📄',
      title: 'Import OpenAPI / Swagger Spec',
      subtitle: 'Upload and convert JSON/YAML specifications',
      perform: () => navigate('/tools'),
    });

    items.push({
      id: 'action-dashboard',
      category: 'Actions',
      icon: '📊',
      title: 'Open Latency & Traffic Dashboard',
      subtitle: 'Inspect response time graphs and metrics',
      perform: () => navigate('/dashboard'),
    });

    items.push({
      id: 'action-tools',
      category: 'Actions',
      icon: '🛠️',
      title: 'Open API Engineering Tools',
      subtitle: 'Access network latency diagnostic and schema parsers',
      perform: () => navigate('/tools'),
    });

    items.push({
      id: 'action-toggle-theme',
      category: 'Actions',
      icon: isWhiteTheme ? '🌙' : '☀️',
      title: isWhiteTheme ? 'Switch to Dark Mode' : 'Switch to Light Mode',
      subtitle: `Current theme: ${theme}`,
      perform: () => toggleTheme(),
    });

    if (!isGuest) {
      items.push({
        id: 'action-manage-account',
        category: 'Actions',
        icon: '⚙️',
        title: 'Account Settings & Identity',
        subtitle: 'Manage workspace access and password',
        perform: () => navigate('/setting'),
      });
    }

    // 2. Workspaces & Projects
    (projects || []).forEach((proj) => {
      items.push({
        id: `proj-${proj.id}`,
        category: 'Workspaces',
        icon: '📦',
        title: proj.projectname || proj.id,
        subtitle: `Owner: @${proj.username} • ${proj.noofApis || 0} APIs`,
        perform: () => {
          selectProject(proj.projectname, proj.id, proj.invitationCode);
          navigate('/');
        },
      });
    });

    return items;
  }, [onNewAPI, onOpenTester, onOpenCodeExport, navigate, isWhiteTheme, theme, toggleTheme, isGuest, projects, selectProject]);

  // Filter items
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const term = query.toLowerCase();
    return allItems.filter(
      (item) => item.title.toLowerCase().includes(term) || item.subtitle.toLowerCase().includes(term)
    );
  }, [allItems, query]);

  // Handle arrow key navigation
  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].perform();
        setIsOpen(false);
      }
    }
  }, [filtered, selectedIndex]);

  if (!isOpen) return null;

  const cardBg = isWhiteTheme ? 'bg-white text-gray-800' : 'bg-[#181825] text-zinc-100';
  const borderBg = isWhiteTheme ? 'border-gray-200' : 'border-[#313244]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="commandPaletteTitle"
    >
      <div className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col font-mono max-h-[500px] ${cardBg} ${borderBg}`}>
        {/* Search Bar */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b shrink-0 ${borderBg}`}>
          <span className="text-zinc-500 text-sm" aria-hidden="true">🔍</span>
          <input
            id="commandPaletteTitle"
            ref={inputRef}
            type="text"
            placeholder="Type a command, workspace, or action…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder-zinc-500 font-mono"
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-400 border border-zinc-700 select-none">
            ESC
          </kbd>
        </div>

        {/* Command Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500 font-mono">
              No matching commands or workspaces found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const selectedStyle = isWhiteTheme
                ? 'bg-blue-50 text-blue-900 border-l-2 border-blue-600'
                : 'bg-blue-600/15 text-blue-300 border-l-2 border-blue-500';
              const unselectedStyle = isWhiteTheme
                ? 'hover:bg-gray-100 text-gray-700'
                : 'hover:bg-zinc-800/40 text-zinc-300';

              return (
                <div
                  key={item.id}
                  ref={isSelected ? selectedItemRef : null}
                  onClick={() => {
                    item.perform();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition text-xs select-none ${
                    isSelected ? selectedStyle : unselectedStyle
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="text-base shrink-0" aria-hidden="true">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{item.title}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{item.subtitle}</div>
                  </div>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-800/40 text-zinc-400 shrink-0">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className={`flex items-center justify-between px-4 py-2 border-t text-[10px] text-zinc-500 shrink-0 select-none ${borderBg}`}>
          <div className="flex items-center gap-2">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>MockAPI Navigation</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CommandPalette);