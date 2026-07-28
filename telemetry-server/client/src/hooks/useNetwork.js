import { useState, useEffect, useCallback } from 'react';
import { DataSet } from 'vis-data';
import { NODE_DEFS, FIXED_EDGES } from './diagramData';

const DYNAMIC_EDGES_FROM_OPENRESTY = { from: 'openresty-nginx', label: 'proxy' };
const DYNAMIC_EDGES_TO_BACKEND = [
  { to: 'internal-redis', dashes: true },
  { to: 'mongodb-atlas', dashes: false },
];

let dynamicNodeCount = 0;
const DYNAMIC_START_X = 600;   // placed to the right of Redis nodes
const DYNAMIC_START_Y = 200;
const DYNAMIC_Y_STEP = 40;

export function useNetwork(logs) {
  // ─── Static nodes ──────────────────────────────────────────────
  const [nodes] = useState(() => {
    const ds = new DataSet();
    Object.entries(NODE_DEFS).forEach(([id, def]) => {
      ds.add({
        id,
        label: def.label,
        shape: 'box',
        font: { color: '#cdd6f4', size: 12, face: 'monospace' },
        margin: 10,
        borderWidth: 1,
        color: { background: def.color, border: '#6c7086' },
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
        smooth: false,
        width: 1,
        color: { color: '#6c7086', highlight: '#89b4fa' },
      });
    });
    return ds;
  });

  // ─── Dynamically add new containers and edges ──────────────────
  useEffect(() => {
    // Find containers that are not static and not yet added
    const existingNodeIds = new Set(nodes.getIds());

    logs.forEach((log) => {
      const container = log.container;
      if (!container) return;
      if (NODE_DEFS[container]) return;          // static – skip
      if (existingNodeIds.has(container)) return; // already added

      // ── Add node ──
      const yPos = DYNAMIC_START_Y + dynamicNodeCount * DYNAMIC_Y_STEP;
      dynamicNodeCount++;

      nodes.add({
        id: container,
        label: container,
        shape: 'box',
        font: { color: '#cdd6f4', size: 12, face: 'monospace' },
        margin: 10,
        borderWidth: 1,
        color: { background: '#181825', border: '#89b4fa' },
        x: DYNAMIC_START_X,
        y: yPos,
        fixed: true,
      });

      // ── Edge from openresty to container ──
      const edgeOpenId = `dyn-edge-openresty-${container}`;
      if (!edges.get(edgeOpenId)) {
        edges.add({
          id: edgeOpenId,
          from: DYNAMIC_EDGES_FROM_OPENRESTY.from,
          to: container,
          arrows: 'to',
          smooth: false,
          width: 1,
          color: { color: '#89b4fa' },
          label: DYNAMIC_EDGES_FROM_OPENRESTY.label,
        });
      }

      // ── Edges from container to backends ──
      DYNAMIC_EDGES_TO_BACKEND.forEach(({ to, dashes }) => {
        if (nodes.get(to)) {   // only if the target node exists
          const edgeBackId = `dyn-edge-${container}-${to}`;
          if (!edges.get(edgeBackId)) {
            edges.add({
              id: edgeBackId,
              from: container,
              to,
              dashes: dashes || false,
              arrows: 'to',
              smooth: false,
              width: 1,
              color: { color: '#6c7086' },
              label: to === 'mongodb-atlas' ? 'store' : 'session',
            });
          }
        }
      });

      // Remember that we've added this container
      existingNodeIds.add(container);
    });
  }, [logs, nodes, edges]);

  // ─── Update node borders based on recent logs ──────────────────
  const updateNodeStatus = useCallback(() => {
    const recent = logs.slice(0, 30);
    nodes.forEach((node) => {
      const id = node.id;
      const nodeLogs = recent.filter((l) => l.container === id);
      const hasError = nodeLogs.some((l) => l.level === 'ERROR' || l.level === 'FATAL');
      const hasWarn = nodeLogs.some((l) => l.level === 'WARN');

      let border = '#6c7086';
      if (hasError) border = '#f38ba8';
      else if (hasWarn) border = '#f9e2af';

      nodes.update({ id, color: { border, background: '#181825' } });
    });
  }, [nodes, logs]);

  useEffect(() => {
    updateNodeStatus();
  }, [logs, updateNodeStatus]);

  return { nodes, edges };
}