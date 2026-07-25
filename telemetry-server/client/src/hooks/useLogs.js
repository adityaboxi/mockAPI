import { useState, useCallback, useMemo } from 'react';

export function useLogs() {
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((log) => {
    setLogs((prev) => [log, ...prev].slice(0, 5000));
  }, []);

  const getLogsForNode = useCallback(
    (nodeId) => logs.filter((l) => l.container === nodeId),
    [logs]
  );

  const errorLogsForNode = useCallback(
    (nodeId) =>
      getLogsForNode(nodeId).filter((l) => l.level === 'ERROR' || l.level === 'FATAL'),
    [getLogsForNode]
  );

  const completedLogsForNode = useCallback(
    (nodeId) =>
      getLogsForNode(nodeId).filter((l) => l.level === 'INFO' || l.level === 'WARN'),
    [getLogsForNode]
  );

  const stats = useMemo(
    () => ({
      total: logs.length,
      errors: logs.filter((l) => l.level === 'ERROR' || l.level === 'FATAL').length,
    }),
    [logs]
  );

  return {
    logs,
    addLog,
    getLogsForNode,
    errorLogsForNode,
    completedLogsForNode,
    stats,
  };
}