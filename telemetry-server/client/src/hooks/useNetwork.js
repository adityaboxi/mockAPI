import { useState, useEffect, useCallback, useRef } from 'react';
import { DataSet } from 'vis-data';
import { NODE_DEFS, FIXED_EDGES } from '../diagramData';

const DYNAMIC_EDGES_FROM_OPENRESTY = { from: 'openresty-nginx', label: 'proxy' };
const DYNAMIC_EDGES_TO_BACKEND = [
  { to: 'internal-redis', dashes: true },
  { to: 'mongodb-atlas', dashes: false },
];

let dynamicNodeCount = 0;
const DYNAMIC_START_X = 390;
const DYNAMIC_START_Y = 200;
const DYNAMIC_Y_STEP = 40;

export function useNetwork(logs) {
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

  const processedContainers = useRef(new Set());

  // Dynamically map new containers received in runtime logs
  useEffect(() => {
    const newContainers = logs
      .map((log) => log.container)
      .filter((name) => name && !NODE_DEFS[name] && !processedContainers.current.has(name));

    newContainers.forEach((name) => {
      const yPos = DYNAMIC_START_Y + dynamicNodeCount * DYNAMIC_Y_STEP;
      dynamicNodeCount++;

      nodes.add({
        id: name,
        label: name,
        shape: 'box',
        font: { color: '#cdd6f4', size: 12, face: 'monospace' },
        margin: 10,
        borderWidth: 1,
        color: { background: '#181825', border: '#89b4fa' },
        x: DYNAMIC_START_X,
        y: yPos,
        fixed: true,
      });

      edges.add({
        id: `dyn-edge-openresty-${name}`,
        from: DYNAMIC_EDGES_FROM_OPENRESTY.from,
        to: name,
        arrows: 'to',
        smooth: false,
        width: 1,
        color: { color: '#89b4fa' },
      });

      DYNAMIC_EDGES_TO_BACKEND.forEach(({ to, dashes }) => {
        if (nodes.get(to)) {
          edges.add({
            id: `dyn-edge-${name}-${to}`,
            from: name,
            to,
            dashes: dashes || false,
            arrows: 'to',
            smooth: false,
            width: 1,
            color: { color: '#6c7086' },
          });
        }
      });

      processedContainers.current.add(name);
    });
  }, [logs, nodes, edges]);

  // Dynamically highlight nodes matching live error status
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