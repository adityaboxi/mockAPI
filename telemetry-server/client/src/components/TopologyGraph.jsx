import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';

function TopologyGraph({ nodes, edges, logs, onNodeClick, onEdgeHover }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    container.style.width = '100%';
    container.style.height = '100%';

    const data = { nodes, edges };
    const options = {
      nodes: {
        shape: 'box',
        font: { size: 11, color: '#cdd6f4', face: 'monospace' },
        margin: 8,
        borderWidth: 1,
        shadow: false,
        color: {
          border: '#313244',
          background: '#181825',
        },
      },
      edges: {
        smooth: false,
        arrows: { to: { enabled: true, scaleFactor: 0.8 } },
        font: { size: 9, color: '#6c7086', background: '#1e1e2e', align: 'middle', face: 'monospace' },
        width: 1,
        color: { color: '#45475a', highlight: '#89b4fa' },
        dashes: false,
      },
      physics: { enabled: false },
      layout: { hierarchical: false },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        zoomSpeed: 1.0,
        dragView: true,
        dragNodes: false,
        multiselect: false,
        keyboard: { zoom: true },   // ✅ moved inside interaction
      },
      // background removed – handled by CSS
    };

    networkRef.current = new Network(container, data, options);

    setTimeout(() => {
      if (networkRef.current) {
        networkRef.current.fit({ animation: { duration: 300 } });
      }
    }, 100);

    networkRef.current.on('click', (params) => {
      if (params.nodes.length > 0) {
        onNodeClick(params.nodes[0]);
      }
    });

    networkRef.current.on('hoverEdge', (params) => {
      if (params.edge) {
        const edgeObj = edges.get(params.edge);
        if (edgeObj) {
          setHoveredEdge(edgeObj);
          const edgeLogs = logs.filter(
            (l) => l.container === edgeObj.from || l.container === edgeObj.to
          );
          onEdgeHover(edgeLogs, edgeObj);
        }
      }
    });

    networkRef.current.on('blurEdge', () => {
      setHoveredEdge(null);
      onEdgeHover([], null);
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [nodes, edges]);

  useEffect(() => {
    if (networkRef.current) {
      networkRef.current.setData({ nodes, edges });
      networkRef.current.fit({ animation: { duration: 200 } });
    }
  }, [nodes, edges]);

  return (
    <div className="relative w-full h-full bg-[#1e1e2e] rounded-xl border border-[#313244] overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />

      {hoveredEdge && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 glass rounded border border-[#313244] text-[10px] text-[#6c7086] font-mono pointer-events-none z-10 bg-[#181825]/90">
          <span>
            {hoveredEdge.from} → {hoveredEdge.to}
            {hoveredEdge.label && ` · ${hoveredEdge.label}`}
          </span>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex flex-col gap-0.5 px-2 py-1.5 glass rounded border border-[#313244] text-[9px] text-[#6c7086] font-mono z-10 bg-[#181825]/90">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a6da95]" /> healthy
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f9e2af]" /> warning
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f38ba8]" /> error
        </div>
      </div>
    </div>
  );
}

export default TopologyGraph;