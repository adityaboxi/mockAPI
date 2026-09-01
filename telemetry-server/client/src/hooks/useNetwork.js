import { useState, useEffect, useCallback } from 'react';
import { DataSet } from 'vis-data';
import { NODE_DEFS, FIXED_EDGES } from './diagramData';

const DYNAMIC_EDGES_FROM_OPENRESTY = { from: 'openresty-nginx uses lua', label: 'proxy', color: '#26c6da' };
const DYNAMIC_EDGES_TO_BACKEND = [
  { to: 'internal redis', label: 'lookup', dashes: true, color: '#ef5350' },
  { to: 'mongodb atlas', label: 'data', dashes: false, color: '#4caf50' },
];

let dynamicNodeCount = 0;
const DYNAMIC_START_X = 380;
const DYNAMIC_START_Y = 200;
const DYNAMIC_Y_STEP = 60;

export function useNetwork(logs) {
  // ─── Static nodes ──────────────────────────────────────────────
  const [nodes] = useState(() => {
    const ds = new DataSet();
    Object.entries(NODE_DEFS).forEach(([id, def]) => {
      ds.add({
        id,
        label: def.label,
        shape: 'box',
        font: { color: '#cdd6f4', size: 11, face: 'monospace' },
        margin: 10,
        borderWidth: 1.5,
        color: {
          background: '#181825',
          border: def.color || '#6c7086',
          highlight: {
            background: '#1e1e2e',
            border: '#89b4fa',
          },
        },
        x: def.x,
        y: def.y,
        fixed: true,
      });
    });
    return ds;
  });

  // ─── Static edges ──────────────────────────────────────────────
  const [edges] = useState(() => {
    const ds = new DataSet();
    FIXED_EDGES.forEach((def, index) => {
      ds.add({
        id: `fixed-edge-${index}`,
        ...def,
        arrows: 'to',
        smooth: {
          type: 'cubicBezier',
          forceDirection: 'none',
          roundness: 0.15,
        },
        width: 1.2,
        color: { color: def.color || '#6c7086', highlight: '#89b4fa' },
      });
    });
    return ds;
  });

  // ─── Dynamically add new runtime project containers ────────────
  useEffect(() => {
    const existingNodeIds = new Set(nodes.getIds());

    logs.forEach((log) => {
      const container = log.container;
      if (!container) return;
      if (NODE_DEFS[container]) return;
      if (existingNodeIds.has(container)) return;

      const yPos = DYNAMIC_START_Y + dynamicNodeCount * DYNAMIC_Y_STEP;
      dynamicNodeCount++;

      nodes.add({
        id: container,
        label: `📦 ${container}`,
        shape: 'box',
        font: { color: '#cdd6f4', size: 11, face: 'monospace' },
        margin: 10,
        borderWidth: 1.5,
        color: {
          background: '#181825',
          border: '#81c784',
          highlight: {
            background: '#1e1e2e',
            border: '#89b4fa',
          },
        },
        x: DYNAMIC_START_X,
        y: yPos,
        fixed: true,
      });

      const edgeOpenId = `dyn-edge-openresty-${container}`;
      if (!edges.get(edgeOpenId)) {
        edges.add({
          id: edgeOpenId,
          from: DYNAMIC_EDGES_FROM_OPENRESTY.from,
          to: container,
          arrows: 'to',
          smooth: { type: 'cubicBezier', roundness: 0.15 },
          width: 1.2,
          color: { color: DYNAMIC_EDGES_FROM_OPENRESTY.color },
          label: DYNAMIC_EDGES_FROM_OPENRESTY.label,
        });
      }

      DYNAMIC_EDGES_TO_BACKEND.forEach(({ to, label, dashes, color }) => {
        if (nodes.get(to)) {
          const edgeBackId = `dyn-edge-${container}-${to}`;
          if (!edges.get(edgeBackId)) {
            edges.add({
              id: edgeBackId,
              from: container,
              to,
              dashes: dashes || false,
              arrows: 'to',
              smooth: { type: 'cubicBezier', roundness: 0.15 },
              width: 1.2,
              color: { color: color || '#6c7086' },
              label: label || '',
            });
          }
        }
      });

      existingNodeIds.add(container);
    });
  }, [logs, nodes, edges]);

  // ─── Update node health borders based on recent telemetry ──────
  const updateNodeStatus = useCallback(() => {
    const recent = logs.slice(0, 50);
    nodes.forEach((node) => {
      const id = node.id;
      const nodeLogs = recent.filter((l) => l.container === id);
      const hasError = nodeLogs.some((l) => l.level === 'ERROR' || l.level === 'FATAL');
      const hasWarn = nodeLogs.some((l) => l.level === 'WARN');

      const originalColor = NODE_DEFS[id]?.color || '#81c784';
      let border = originalColor;

      if (hasError) border = '#f38ba8';
      else if (hasWarn) border = '#f9e2af';

      nodes.update({
        id,
        color: {
          border,
          background: '#181825',
          highlight: {
            border: '#89b4fa',
            background: '#1e1e2e',
          },
        },
      });
    });
  }, [nodes, logs]);

  useEffect(() => {
    updateNodeStatus();
  }, [logs, updateNodeStatus]);

  return { nodes, edges };
}