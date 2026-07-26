import { useState, useCallback, useMemo, useRef } from 'react';

// Maximum number of logs to keep in memory
const MAX_LOGS = 5000;

export function useLogs() {
  const [logs, setLogs] = useState([]);

  // ─── Add a new log ──────────────────────────────────────────
  const addLog = useCallback((log) => {
    setLogs((prev) => {
      // Avoid duplicates (by id or timestamp+message)
      const exists = prev.some(
        (l) =>
          (l.id && l.id === log.id) ||
          (l.timestamp === log.timestamp && l.message === log.message && l.container === log.container)
      );
      if (exists) return prev;

      const next = [log, ...prev];
      return next.slice(0, MAX_LOGS);
    });
  }, []);

  // ─── Clear all logs ────────────────────────────────────────
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // ─── Get logs for a specific node ──────────────────────────
  const getLogsForNode = useCallback(
    (nodeId) => logs.filter((l) => l.container === nodeId),
    [logs]
  );

  // ─── Error logs for a node ─────────────────────────────────
  const errorLogsForNode = useCallback(
    (nodeId) =>
      getLogsForNode(nodeId).filter((l) => l.level === 'ERROR' || l.level === 'FATAL'),
    [getLogsForNode]
  );

  // ─── Completed (info/warn) logs for a node ─────────────────
  const completedLogsForNode = useCallback(
    (nodeId) =>
      getLogsForNode(nodeId).filter((l) => l.level === 'INFO' || l.level === 'WARN'),
    [getLogsForNode]
  );

  // ─── Stats ──────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: logs.length,
      errors: logs.filter((l) => l.level === 'ERROR' || l.level === 'FATAL').length,
      warnings: logs.filter((l) => l.level === 'WARN').length,
      containers: new Set(logs.map((l) => l.container).filter(Boolean)).size,
    }),
    [logs]
  );

  // ─── Get logs filtered by level ────────────────────────────
  const getLogsByLevel = useCallback(
    (level) => logs.filter((l) => l.level === level),
    [logs]
  );

  // ─── Get logs within a time range ──────────────────────────
  const getLogsByTimeRange = useCallback(
    (start, end) =>
      logs.filter((l) => l.timestamp >= start && l.timestamp <= end),
    [logs]
  );

  return {
    logs,
    addLog,
    clearLogs,
    getLogsForNode,
    errorLogsForNode,
    completedLogsForNode,
    getLogsByLevel,
    getLogsByTimeRange,
    stats,
  };
}