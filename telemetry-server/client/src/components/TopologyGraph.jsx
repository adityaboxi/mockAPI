import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Network } from 'vis-network';
import { GROUP_BOXES, NODE_DEFS } from '../hooks/diagramData';

function TopologyGraph({ nodes, edges, logs, metricsMap, onNodeClick, onEdgeHover }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [hoverMetrics, setHoverMetrics] = useState(null);
  const animationFrameRef = useRef(null);
  const isDestroyedRef = useRef(false);

  // ─── Initialize Vis Network ───
  const activeEdgesRef = useRef(new Map());

  // Pre-calculate active traffic routes whenever logs change (O(1) lookup during 60FPS animation ticks)
  useEffect(() => {
    const map = new Map();
    const now = Date.now();
    const limit = Math.min(logs.length, 100);
    for (let i = 0; i < limit; i++) {
      const l = logs[i];
      if (!l) continue;
      const logTime = typeof l.timestamp === 'number' ? l.timestamp : new Date(l.timestamp).getTime();
      if (isNaN(logTime) || now - logTime > 15000) continue;

      const target = (l.container || l.serviceName || l.service || '').toLowerCase();
      if (!target) continue;

      edges.forEach((edge) => {
        const from = (edge.from || '').toLowerCase();
        const to = (edge.to || '').toLowerCase();
        if (target === from || target === to || target.includes(from) || target.includes(to)) {
          const edgeKey = `${edge.from}->${edge.to}`;
          const current = map.get(edgeKey) || { count: 0, hasErrors: false };
          current.count += 1;
          if (l.level === 'ERROR' || l.level === 'FATAL' || (l.statusCode && l.statusCode >= 400)) {
            current.hasErrors = true;
          }
          map.set(edgeKey, current);
        }
      });
    }
    activeEdgesRef.current = map;
  }, [logs, edges]);

  useEffect(() => {
    if (!containerRef.current) return;
    isDestroyedRef.current = false;

    const container = containerRef.current;
    container.style.width = '100%';
    container.style.height = '100%';

    const data = { nodes, edges };
    const options = {
      nodes: {
        shape: 'box',
        font: { size: 11, color: '#cdd6f4', face: 'monospace', vadjust: 0 },
        margin: { top: 7, bottom: 7, left: 10, right: 10 },
        borderWidth: 1.5,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.4)',
          size: 5,
          x: 2,
          y: 2,
        },
        color: {
          border: '#45475a',
          background: '#181825',
          highlight: {
            border: '#89b4fa',
            background: '#1e1e2e',
          },
        },
      },
      edges: {
        smooth: {
          type: 'cubicBezier',
          forceDirection: 'none',
          roundness: 0.15,
        },
        arrows: { to: { enabled: true, scaleFactor: 0.7 } },
        font: {
          size: 8.5,
          color: '#a6adc8',
          background: '#11111b',
          align: 'middle',
          face: 'monospace',
          strokeWidth: 0,
        },
        width: 1.2,
        color: { color: '#45475a', highlight: '#89b4fa', hover: '#89b4fa' },
        dashes: false,
      },
      physics: { enabled: false },
      layout: { hierarchical: false },
      interaction: {
        hover: true,
        tooltipDelay: 60,
        zoomView: true,
        zoomSpeed: 0.7,
        dragView: true,
        dragNodes: true,
        multiselect: false,
      },
    };

    const network = new Network(container, data, options);
    networkRef.current = network;

    // ─── Background Cluster & Sub-box Rendering ───
    network.on('beforeDrawing', (ctx) => {
      GROUP_BOXES.forEach((box) => {
        const x = box.x1;
        const y = box.y1;
        const width = box.x2 - box.x1;
        const height = box.y2 - box.y1;
        const radius = 10;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();

        ctx.fillStyle = box.color;
        ctx.fill();

        ctx.strokeStyle = box.borderColor;
        ctx.lineWidth = 1.2;
        if (box.borderDash && box.borderDash.length > 0) {
          ctx.setLineDash(box.borderDash);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();

        // Header Title Label
        if (box.label) {
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = box.borderColor.replace('0.4', '0.9').replace('0.35', '0.9');
          ctx.fillText(box.label.toUpperCase(), x + 14, y + 18);
        }
        ctx.restore();
      });
    });

    // ─── Animated Live Data Flow Particles on Edges & Real-time Node Badges ───
    network.on('afterDrawing', (ctx) => {
      if (!networkRef.current) return;
      const positions = networkRef.current.getPositions();
      const time = Date.now() / 1000;

      // 1. Data flow particles (O(1) lookup per edge via activeEdgesRef)
      edges.forEach((edge) => {
        const fromPos = positions[edge.from];
        const toPos = positions[edge.to];
        if (!fromPos || !toPos) return;

        const edgeKey = `${edge.from}->${edge.to}`;
        const activeInfo = activeEdgesRef.current.get(edgeKey);
        if (!activeInfo || activeInfo.count === 0) return;

        const hasErrors = activeInfo.hasErrors;
        const particleCount = Math.min(3, activeInfo.count);

        for (let i = 0; i < particleCount; i++) {
          const speed = 0.45;
          const offset = i / particleCount;
          const t = (time * speed + offset) % 1;

          const px = fromPos.x + (toPos.x - fromPos.x) * t;
          const py = fromPos.y + (toPos.y - fromPos.y) * t;

          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, hasErrors ? 3.5 : 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = hasErrors ? '#f38ba8' : (edge.color?.color || '#89b4fa');
          ctx.shadowColor = hasErrors ? '#f38ba8' : '#89b4fa';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }
      });

      // 2. Real-Time Node CPU & RAM Badges (Only for real container nodes, NOT external domains or external services)
      if (metricsMap) {
        Object.entries(positions).forEach(([nodeId, pos]) => {
          const def = NODE_DEFS[nodeId];
          if (def && (def.group === 'domain' || def.group === 'external' || def.group === 'gateway')) {
            return; // Do not draw CPU/RAM badges on external URLs or third-party services
          }

          const m = metricsMap instanceof Map ? metricsMap.get(nodeId) : metricsMap[nodeId];
          if (!m || (m.cpuPercent == null && m.memoryMb == null)) return;

          const cpu = m.cpuPercent ?? 0;
          const mem = m.memoryMb ?? 0;
          const cpuColor = cpu > 80 ? '#f38ba8' : cpu > 50 ? '#f9e2af' : '#a6da95';
          const badgeText = `${cpu}% | ${mem}MB`;

          ctx.save();
          ctx.font = 'bold 8.5px monospace';
          const textWidth = ctx.measureText(badgeText).width;
          const badgeW = textWidth + 8;
          const badgeH = 13;
          const bx = pos.x - badgeW / 2;
          const by = pos.y + 20;

          ctx.fillStyle = 'rgba(17, 17, 27, 0.85)';
          ctx.strokeStyle = cpuColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(bx, by, badgeW, badgeH, 3);
          } else {
            ctx.rect(bx, by, badgeW, badgeH);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = cpuColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, pos.x, by + badgeH / 2);
          ctx.restore();
        });
      }
    });

    // ─── Smooth Animation Loop ───
    const animate = () => {
      if (isDestroyedRef.current || !networkRef.current) return;
      networkRef.current.redraw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);

    setTimeout(() => {
      if (networkRef.current) {
        networkRef.current.fit({ animation: { duration: 300 } });
      }
    }, 150);

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        onNodeClick(params.nodes[0]);
      }
    });

    network.on('hoverEdge', (params) => {
      if (params.edge) {
        const edgeObj = edges.get(params.edge);
        if (edgeObj) {
          setHoveredEdge(edgeObj);
          const edgeLogs = logs.filter(
            (l) => l.container === edgeObj.from || l.container === edgeObj.to
          );
          const errorCount = edgeLogs.filter((l) => l.level === 'ERROR' || l.level === 'FATAL').length;
          setHoverMetrics({
            total: edgeLogs.length,
            errors: errorCount,
            healthy: edgeLogs.length - errorCount,
            rate: Math.max(1, Math.round((edgeLogs.length / 60) * 10) / 10),
          });
          onEdgeHover(edgeLogs, edgeObj);
        }
      }
    });

    network.on('blurEdge', () => {
      setHoveredEdge(null);
      setHoverMetrics(null);
      onEdgeHover([], null);
    });

    return () => {
      isDestroyedRef.current = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [nodes, edges, logs, onNodeClick, onEdgeHover]);

  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setData({ nodes, edges });
    }
  }, [nodes, edges]);

  const fitView = useCallback(() => {
    if (networkRef.current) {
      networkRef.current.fit({ animation: { duration: 300 } });
    }
  }, []);

  const zoomIn = useCallback(() => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.2, animation: { duration: 200 } });
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 0.8, animation: { duration: 200 } });
    }
  }, []);

  return (
    <div className="relative w-full h-full bg-[#11111b] rounded-xl border border-[#313244] overflow-hidden shadow-2xl font-mono">
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating View Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <button
          onClick={zoomIn}
          className="w-7 h-7 flex items-center justify-center bg-[#181825]/90 hover:bg-[#313244] border border-[#313244] rounded-md text-xs text-[#cdd6f4] transition"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-7 h-7 flex items-center justify-center bg-[#181825]/90 hover:bg-[#313244] border border-[#313244] rounded-md text-xs text-[#cdd6f4] transition"
          title="Zoom Out"
        >
          -
        </button>
        <button
          onClick={fitView}
          className="px-2.5 h-7 flex items-center justify-center bg-[#181825]/90 hover:bg-[#313244] border border-[#313244] rounded-md text-[10px] text-[#cdd6f4] transition"
          title="Fit to Screen"
        >
          fit view
        </button>
      </div>

      {/* Rich Hovered Edge Diagnostics Pill */}
      {hoveredEdge && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg border border-[#313244] text-[11px] text-[#cdd6f4] pointer-events-none z-10 bg-[#181825]/95 shadow-2xl flex items-center gap-3 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <span className="text-[#89b4fa] font-bold">{hoveredEdge.from}</span>
            <span className="text-[#6c7086]">➔</span>
            <span className="text-[#a6da95] font-bold">{hoveredEdge.to}</span>
          </div>
          {hoveredEdge.label && (
            <span className="px-1.5 py-0.5 rounded bg-[#313244] text-[9px] text-[#f9e2af]">
              {hoveredEdge.label}
            </span>
          )}
          {hoverMetrics && (
            <div className="flex items-center gap-2 border-l border-[#313244] pl-2 text-[10px]">
              <span className="text-[#cdd6f4]">{hoverMetrics.total} msgs</span>
              <span className="text-[#a6da95]">{hoverMetrics.rate} req/s</span>
              {hoverMetrics.errors > 0 ? (
                <span className="text-[#f38ba8] font-bold">{hoverMetrics.errors} errors</span>
              ) : (
                <span className="text-[#a6da95]">0 errors</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Health Legend & Live Status */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 px-3 py-2.5 rounded-lg border border-[#313244] text-[10px] text-[#a6adc8] z-10 bg-[#181825]/90 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#a6da95] shadow-[0_0_6px_#a6da95]" /> healthy node
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f9e2af] shadow-[0_0_6px_#f9e2af]" /> high load / warn
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#f38ba8] shadow-[0_0_6px_#f38ba8]" /> error state
        </div>
      </div>
    </div>
  );
}

export default TopologyGraph;