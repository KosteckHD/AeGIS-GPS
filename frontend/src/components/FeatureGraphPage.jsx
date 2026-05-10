import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, GitBranch, Grip, Move, ShieldAlert } from 'lucide-react';

const panelClass = "hud-panel bg-black/72 border border-emerald-300/24 backdrop-blur-2xl rounded-lg shadow-[0_0_44px_rgba(16,185,129,0.12)]";

const modelGraphs = {
  'AV-GPS / Random Forest': {
    summary: 'Telemetryczny model dla platform z dodatkowymi sensorami. Najmocniej korzysta z cech trasy, sterowania, wibracji i lokalnej zmiennosci sygnalu.',
    metric: 'high recall, low FNR',
    nodes: [
      ['model', 'Random Forest', 'model', 20],
      ['target', 'Spoofing label', 'target', 15],
      ['xtrack', 'X-Track Error', 'route', 17],
      ['xtrackRoll', 'X-Track rolling std/mean', 'temporal', 18],
      ['gpsCourseRoll', 'GPS Course rolling std', 'temporal', 16],
      ['throttle', 'Throttle', 'control', 17],
      ['steering', 'Steering Angle', 'control', 14],
      ['vibration', 'Vertical Vibration', 'motion', 16],
      ['velocityRoll', 'Velocity rolling std', 'motion', 13],
      ['hdopRoll', 'GPS HDOP rolling mean', 'gps', 12],
      ['altitude', 'Altitude / Setpoint', 'control', 14],
    ],
    links: [
      ['model', 'xtrackRoll', 0.98], ['model', 'throttle', 0.92], ['model', 'vibration', 0.9],
      ['model', 'gpsCourseRoll', 0.86], ['model', 'xtrack', 0.76], ['model', 'steering', 0.62],
      ['model', 'altitude', 0.58], ['model', 'velocityRoll', 0.52], ['model', 'hdopRoll', 0.48],
      ['xtrack', 'xtrackRoll', 0.9], ['throttle', 'steering', 0.72], ['velocityRoll', 'vibration', 0.64],
      ['gpsCourseRoll', 'hdopRoll', 0.54], ['xtrackRoll', 'target', 0.92], ['throttle', 'target', 0.72],
    ],
  },
  'AV-GPS / XGBoost': {
    summary: 'Mocniejszy model tabelaryczny dla danych z pojazdu. Uczy sie nieliniowych interakcji miedzy jakoscia GPS, ruchem, sterowaniem i odchyleniem od trasy.',
    metric: 'best tabular balance',
    nodes: [
      ['model', 'XGBoost', 'model', 20],
      ['target', 'Spoofing label', 'target', 15],
      ['gpsQuality', 'GPS quality', 'gps', 16],
      ['satellites', 'Satellite Count / Locks', 'gps', 14],
      ['course', 'GPS Course', 'gps', 13],
      ['orientation', 'Heading / Yaw Rate', 'motion', 16],
      ['trajectory', 'X-Track Error', 'route', 18],
      ['delta', 'delta_* changes', 'temporal', 17],
      ['rolling', 'rolling mean/std', 'temporal', 17],
      ['control', 'Steering / Throttle', 'control', 15],
      ['leakage', 'Leakage removed', 'quality', 12],
    ],
    links: [
      ['model', 'trajectory', 0.92], ['model', 'delta', 0.86], ['model', 'rolling', 0.84],
      ['model', 'gpsQuality', 0.78], ['model', 'orientation', 0.7], ['model', 'control', 0.66],
      ['gpsQuality', 'satellites', 0.76], ['course', 'orientation', 0.62], ['trajectory', 'control', 0.7],
      ['delta', 'trajectory', 0.82], ['rolling', 'gpsQuality', 0.68], ['leakage', 'model', 0.45],
      ['trajectory', 'target', 0.86], ['delta', 'target', 0.78],
    ],
  },
  'Tuni2025 / XGBoost': {
    summary: 'Najlepszy wynik ogolny na cechach z okien I/Q. Model wykrywa spoofing przez energie, amplitude i stabilnosc sygnalu.',
    metric: '98.16% acc, PR-AUC 0.970',
    nodes: [
      ['model', 'XGBoost I/Q', 'model', 20],
      ['target', 'Spoofing label', 'target', 15],
      ['iStats', 'I-channel stats', 'signal', 15],
      ['qStats', 'Q-channel stats', 'signal', 15],
      ['ampMean', 'Amplitude mean/std', 'signal', 18],
      ['powerMean', 'Power mean/std', 'signal', 18],
      ['percentiles', 'Power p50/p90/p99', 'signal', 16],
      ['papr', 'PAPR', 'signal', 14],
      ['window', 'I/Q window', 'temporal', 16],
      ['scenarioSplit', 'Scenario split', 'quality', 12],
      ['ss33', 'SS33 time labels', 'quality', 13],
    ],
    links: [
      ['model', 'powerMean', 0.95], ['model', 'ampMean', 0.9], ['model', 'percentiles', 0.86],
      ['model', 'papr', 0.72], ['model', 'iStats', 0.66], ['model', 'qStats', 0.66],
      ['window', 'iStats', 0.78], ['window', 'qStats', 0.78], ['ampMean', 'powerMean', 0.88],
      ['powerMean', 'percentiles', 0.84], ['papr', 'percentiles', 0.62],
      ['scenarioSplit', 'model', 0.42], ['ss33', 'target', 0.58], ['powerMean', 'target', 0.86],
    ],
  },
  'Tuni2025 / Random Forest': {
    summary: 'Interpretowalny baseline dla cech I/Q. Pokazuje, ze duzo informacji o spoofingu znajduje sie w prostych statystykach mocy i amplitudy.',
    metric: '100% recall spoof',
    nodes: [
      ['model', 'Random Forest I/Q', 'model', 20],
      ['target', 'Spoofing label', 'target', 15],
      ['power', 'Power statistics', 'signal', 18],
      ['amplitude', 'Amplitude statistics', 'signal', 17],
      ['iqStd', 'I/Q std', 'signal', 15],
      ['percentiles', 'Energy percentiles', 'signal', 15],
      ['papr', 'PAPR', 'signal', 13],
      ['features', 'Extracted features', 'temporal', 15],
      ['balanced', 'class_weight balanced', 'quality', 12],
    ],
    links: [
      ['model', 'power', 0.92], ['model', 'amplitude', 0.88], ['model', 'percentiles', 0.78],
      ['model', 'iqStd', 0.7], ['model', 'papr', 0.58], ['features', 'power', 0.78],
      ['features', 'amplitude', 0.78], ['power', 'percentiles', 0.82], ['amplitude', 'iqStd', 0.66],
      ['balanced', 'model', 0.44], ['power', 'target', 0.8], ['amplitude', 'target', 0.76],
    ],
  },
  'Tuni2025 / CNN': {
    summary: 'Model dla urzadzen bez dodatkowej telemetrii. CNN analizuje surowe okna I/Q bez recznego projektowania cech.',
    metric: 'raw I/Q, 0% FNR',
    nodes: [
      ['model', 'CNN raw I/Q', 'model', 20],
      ['target', 'Spoofing label', 'target', 15],
      ['rawWindow', '2 x 131072 I/Q window', 'signal', 18],
      ['iChannel', 'I channel', 'signal', 15],
      ['qChannel', 'Q channel', 'signal', 15],
      ['conv', 'Convolution filters', 'model', 17],
      ['localPatterns', 'Local signal patterns', 'temporal', 17],
      ['noFeatureManual', 'No manual feature extraction', 'quality', 12],
      ['ss33', 'SS33 held-out test', 'quality', 13],
    ],
    links: [
      ['rawWindow', 'iChannel', 0.8], ['rawWindow', 'qChannel', 0.8], ['iChannel', 'conv', 0.78],
      ['qChannel', 'conv', 0.78], ['conv', 'localPatterns', 0.9], ['localPatterns', 'model', 0.92],
      ['model', 'target', 0.86], ['noFeatureManual', 'model', 0.5], ['ss33', 'target', 0.56],
      ['rawWindow', 'model', 0.72],
    ],
  },
};

const groupStyles = {
  model: { fill: '#34d399', stroke: '#d1fae5', label: 'model' },
  target: { fill: '#ef4444', stroke: '#fecaca', label: 'target' },
  gps: { fill: '#38bdf8', stroke: '#bae6fd', label: 'gps' },
  route: { fill: '#facc15', stroke: '#fef08a', label: 'route' },
  control: { fill: '#fb923c', stroke: '#fed7aa', label: 'control' },
  motion: { fill: '#a78bfa', stroke: '#ddd6fe', label: 'motion' },
  temporal: { fill: '#22c55e', stroke: '#bbf7d0', label: 'temporal' },
  signal: { fill: '#06b6d4', stroke: '#cffafe', label: 'signal' },
  quality: { fill: '#94a3b8', stroke: '#e2e8f0', label: 'validation' },
};

const getNodePhase = (id) => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index) * (index + 3)) % 100;
  }
  return hash / 18;
};

function buildLayout(graph, width, height, pinnedPositions = {}) {
  const centerX = width / 2;
  const centerY = height / 2;
  const nodes = graph.nodes.map(([id, label, group, size], index) => {
    const angle = (Math.PI * 2 * index) / graph.nodes.length;
    const radius = id === 'model' ? 0 : Math.min(width, height) * 0.34;
    const pinned = pinnedPositions[id];
    return {
      id,
      label,
      group,
      size,
      x: pinned?.x ?? centerX + Math.cos(angle) * radius,
      y: pinned?.y ?? centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      pinned: Boolean(pinned),
    };
  });
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const links = graph.links.map(([source, target, strength]) => ({ source, target, strength }));

  for (let step = 0; step < 260; step += 1) {
    nodes.forEach((a, i) => {
      nodes.slice(i + 1).forEach((b) => {
        const dx = b.x - a.x || 0.01;
        const dy = b.y - a.y || 0.01;
        const distSq = dx * dx + dy * dy;
        const force = Math.min(2.8, 4200 / distSq);
        const dist = Math.sqrt(distSq);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      });
    });

    links.forEach((link) => {
      const a = byId[link.source];
      const b = byId[link.target];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const targetDistance = 110 - link.strength * 30;
      const force = (dist - targetDistance) * 0.018 * link.strength;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    nodes.forEach((node) => {
      if (node.pinned) return;
      node.vx += (centerX - node.x) * 0.004;
      node.vy += (centerY - node.y) * 0.004;
      if (node.id === 'model') {
        node.vx += (centerX - node.x) * 0.08;
        node.vy += (centerY - node.y) * 0.08;
      }
      node.vx *= 0.82;
      node.vy *= 0.82;
      node.x = Math.max(72, Math.min(width - 72, node.x + node.vx));
      node.y = Math.max(52, Math.min(height - 52, node.y + node.vy));
    });
  }

  return { nodes, links, byId };
}

const FeatureGraphPage = ({ onBack }) => {
  const [selectedModel, setSelectedModel] = useState('Tuni2025 / XGBoost');
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [pinnedPositions, setPinnedPositions] = useState({});
  const [draggingNode, setDraggingNode] = useState(null);
  const [graphSize, setGraphSize] = useState({ width: 1040, height: 610 });
  const graphPanelRef = useRef(null);
  const svgRef = useRef(null);
  const graph = modelGraphs[selectedModel];
  const width = graphSize.width;
  const height = graphSize.height;
  const layout = useMemo(() => buildLayout(graph, width, height, pinnedPositions), [graph, width, height, pinnedPositions]);
  const focusedNode = selectedNode || hoveredNode;
  const focusedLink = selectedLink || hoveredLink;

  useEffect(() => {
    const panel = graphPanelRef.current;
    if (!panel) return undefined;

    const resize = () => {
      const rect = panel.getBoundingClientRect();
      setGraphSize({
        width: Math.max(680, Math.round(rect.width - 24)),
        height: Math.max(520, Math.round(rect.height - 24)),
      });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  const getSvgPoint = (event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    return {
      x: Math.max(72, Math.min(width - 72, x)),
      y: Math.max(52, Math.min(height - 52, y)),
    };
  };

  const updateDraggedNode = (event) => {
    if (!draggingNode) return;
    const point = getSvgPoint(event);
    setPinnedPositions((prev) => ({
      ...prev,
      [draggingNode]: point,
    }));
  };

  const connectedIds = useMemo(() => {
    if (!focusedNode) return new Set();
    const ids = new Set([focusedNode]);
    layout.links.forEach((link) => {
      if (link.source === focusedNode) ids.add(link.target);
      if (link.target === focusedNode) ids.add(link.source);
    });
    return ids;
  }, [focusedNode, layout.links]);

  const activeNode = focusedNode ? layout.byId[focusedNode] : null;

  return (
    <div className="hacker-root relative min-h-screen bg-[#010302] text-emerald-100 font-mono overflow-hidden selection:bg-emerald-900/70">
      <div className="pointer-events-none absolute inset-0 cyber-grid opacity-60"></div>
      <div className="relative z-10 min-h-screen p-4 flex flex-col gap-4">
        <header className={`${panelClass} px-4 py-3 flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="pointer-events-auto h-10 w-10 rounded-sm border border-emerald-300/35 bg-white/[0.04] text-emerald-100 flex items-center justify-center hover:bg-emerald-300/12"
              title="Back to live dashboard"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xl font-black tracking-[0.14em] text-emerald-100">
                <GitBranch size={22} className="text-emerald-300" />
                FEATURE DEPENDENCY GRAPH
              </div>
              <p className="text-xs text-slate-300 tracking-[0.08em]">
                Force-directed map of model inputs, engineered features and validation safeguards
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(modelGraphs).map((name) => (
              <button
                key={name}
                onClick={() => {
                  setSelectedModel(name);
                  setSelectedNode(null);
                  setHoveredNode(null);
                  setSelectedLink(null);
                  setHoveredLink(null);
                  setPinnedPositions({});
                }}
                className={`pointer-events-auto px-3 py-2 text-[11px] border rounded-md transition-all ${
                  selectedModel === name
                    ? 'bg-emerald-300/18 border-emerald-200 text-emerald-50 shadow-[0_0_22px_rgba(52,211,153,0.22)]'
                    : 'bg-white/[0.045] border-emerald-300/18 text-slate-300 hover:border-emerald-300/55 hover:text-emerald-100 hover:bg-emerald-300/8'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </header>

        <main className="grid grid-cols-12 gap-4 flex-1 min-h-0">
          <aside className={`${panelClass} col-span-12 xl:col-span-3 p-4 flex flex-col gap-4`}>
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">Selected model</div>
              <h2 className="mt-1 text-2xl font-black text-emerald-50 leading-tight">{selectedModel}</h2>
              <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-red-100 bg-red-500/12 border border-red-300/24 px-2 py-1 rounded-md">
                <ShieldAlert size={13} /> {graph.metric}
              </div>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{graph.summary}</p>

            <div className="flex items-center gap-2 text-xs text-cyan-100 bg-cyan-400/8 border border-cyan-300/20 px-3 py-2 rounded-md">
              <Move size={14} className="text-cyan-200" />
              Drag nodes to rearrange the graph during the presentation.
            </div>

            <div className="grid grid-cols-2 gap-2">
              {Object.entries(groupStyles).map(([key, style]) => (
                <div key={key} className="flex items-center gap-2 text-[11px] text-slate-200 bg-white/[0.045] border border-emerald-300/12 px-2 py-1.5 rounded-md">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.fill, boxShadow: `0 0 12px ${style.fill}` }} />
                  {style.label}
                </div>
              ))}
            </div>

            <div className="border-t border-emerald-300/18 pt-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/90">Node inspector</div>
              {focusedLink ? (
                <div className="mt-2 bg-black/48 border border-cyan-300/24 p-3 rounded-md">
                  <div className="text-sm text-cyan-100 font-bold">
                    {layout.byId[focusedLink.source]?.label} -> {layout.byId[focusedLink.target]?.label}
                  </div>
                  <div className="mt-2 text-xs text-slate-300">Connection weight</div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.75)]"
                        style={{ width: `${Math.round(focusedLink.strength * 100)}%` }}
                      />
                    </div>
                    <span className="text-cyan-100 font-bold text-sm">{focusedLink.strength.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-200">
                    Higher weight means stronger modeled dependency in this visualization.
                  </div>
                </div>
              ) : activeNode ? (
                <div className="mt-2 bg-black/48 border border-emerald-300/18 p-3 rounded-md">
                  <div className="text-lg font-bold text-emerald-50">{activeNode.label}</div>
                  <div className="mt-1 text-xs text-slate-300">Group: {groupStyles[activeNode.group]?.label}</div>
                  <div className="mt-2 text-xs text-slate-200">
                    Highlighted links show how this signal contributes to the model decision path.
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-slate-300 bg-white/[0.03] border border-dashed border-emerald-300/18 p-3 rounded-md">
                  Hover or click a node to inspect its local dependencies.
                </div>
              )}
            </div>
          </aside>

          <section ref={graphPanelRef} className={`${panelClass} col-span-12 xl:col-span-9 p-3 min-h-[62vh] xl:min-h-0`}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[62vh] xl:h-full min-h-[520px] touch-none select-none rounded-lg"
              onPointerMove={updateDraggedNode}
              onPointerUp={() => setDraggingNode(null)}
              onPointerCancel={() => setDraggingNode(null)}
            >
              <defs>
                <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="linkGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="graphBackground" cx="50%" cy="48%" r="72%">
                  <stop offset="0%" stopColor="rgba(20,184,166,0.16)" />
                  <stop offset="52%" stopColor="rgba(15,23,42,0.18)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.10)" />
                </radialGradient>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(110,231,183,0.62)" />
                </marker>
              </defs>

              <rect width={width} height={height} rx="18" fill="url(#graphBackground)" />
              <g opacity="0.17">
                {Array.from({ length: Math.ceil(width / 70) }).map((_, index) => (
                  <line key={`v-${index}`} x1={index * 70} y1="0" x2={index * 70} y2={height} stroke="#34d399" strokeWidth="1" />
                ))}
                {Array.from({ length: Math.ceil(height / 70) }).map((_, index) => (
                  <line key={`h-${index}`} x1="0" y1={index * 70} x2={width} y2={index * 70} stroke="#34d399" strokeWidth="1" />
                ))}
              </g>
              {layout.links.map((link) => {
                const source = layout.byId[link.source];
                const target = layout.byId[link.target];
                const active = !focusedNode || (connectedIds.has(source.id) && connectedIds.has(target.id));
                const isLinkFocused = focusedLink?.source === link.source && focusedLink?.target === link.target;
                return (
                  <g key={`${link.source}-${link.target}`}>
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={isLinkFocused ? 'rgba(255,255,255,0.9)' : active ? 'rgba(110,231,183,0.66)' : 'rgba(71,85,105,0.22)'}
                      strokeWidth={isLinkFocused ? 7 : active ? 1 + link.strength * 3 : 1}
                      strokeLinecap="round"
                      filter={active ? 'url(#linkGlow)' : undefined}
                      markerEnd={link.target === 'target' ? 'url(#arrow)' : undefined}
                    />
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke="transparent"
                      strokeWidth="18"
                      strokeLinecap="round"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoveredLink(link)}
                      onMouseLeave={() => setHoveredLink(null)}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedLink(
                          selectedLink?.source === link.source && selectedLink?.target === link.target
                            ? null
                            : link
                        );
                        setSelectedNode(null);
                      }}
                    />
                    {isLinkFocused && (
                      <g transform={`translate(${(source.x + target.x) / 2},${(source.y + target.y) / 2})`}>
                        <rect x="-28" y="-15" width="56" height="24" rx="5" fill="rgba(0,0,0,0.84)" stroke="rgba(255,255,255,0.45)" />
                        <text textAnchor="middle" y="2" fill="#ecfeff" fontSize="11" fontWeight="800">
                          w={link.strength.toFixed(2)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {layout.links.map((link, index) => {
                const source = layout.byId[link.source];
                const target = layout.byId[link.target];
                const active = !focusedNode || (connectedIds.has(source.id) && connectedIds.has(target.id));
                if (!active) return null;

                const path = `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
                const duration = Math.max(1.4, 3.1 - link.strength * 1.2);

                return (
                  <g key={`particle-${link.source}-${link.target}`} opacity="0.92">
                    {[0, 1].map((particleIndex) => (
                      <circle
                        key={particleIndex}
                        r={particleIndex === 0 ? 3.8 : 2.4}
                        fill={particleIndex === 0 ? '#d1fae5' : '#67e8f9'}
                        filter="url(#linkGlow)"
                      >
                        <animateMotion
                          path={path}
                          dur={`${duration}s`}
                          begin={`${(index % 5) * 0.18 + particleIndex * duration * 0.5}s`}
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0;1;0.85;0"
                          dur={`${duration}s`}
                          begin={`${(index % 5) * 0.18 + particleIndex * duration * 0.5}s`}
                          repeatCount="indefinite"
                        />
                      </circle>
                    ))}
                  </g>
                );
              })}

              {layout.nodes.map((node) => {
                const style = groupStyles[node.group] || groupStyles.quality;
                const active = !focusedNode || connectedIds.has(node.id);
                const isSelected = focusedNode === node.id;
                const phase = getNodePhase(node.id);
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                      setDraggingNode(node.id);
                      setSelectedNode(node.id);
                      setSelectedLink(null);
                    }}
                    className={draggingNode === node.id ? 'cursor-grabbing' : 'cursor-grab'}
                    opacity={active ? 1 : 0.28}
                  >
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      additive="sum"
                      values="0 0; 0 -4; 0 0; 0 3; 0 0"
                      dur={`${4.2 + phase}s`}
                      begin={`${phase * 0.35}s`}
                      repeatCount="indefinite"
                    />
                    <circle
                      r={node.size + (isSelected ? 18 : 13)}
                      fill={style.fill}
                      opacity={isSelected ? 0.16 : 0.08}
                    />
                    <circle
                      r={node.size + (isSelected ? 6 : 0)}
                      fill={style.fill}
                      stroke={isSelected ? '#ffffff' : style.stroke}
                      strokeWidth={isSelected ? 3 : 1.5}
                      filter="url(#nodeGlow)"
                    />
                    <circle r={node.size + 9} fill="transparent" stroke={style.fill} strokeOpacity={isSelected ? 0.5 : 0.18} strokeWidth="1.5" />
                    <foreignObject x={node.size - 7} y={-node.size - 9} width="18" height="18" opacity={isSelected ? 1 : 0.68}>
                      <div className="h-full w-full rounded bg-black/65 border border-white/20 flex items-center justify-center text-white">
                        <Grip size={10} />
                      </div>
                    </foreignObject>
                    <text
                      y={node.size + 21}
                      textAnchor="middle"
                      fill={active ? '#ecfdf5' : '#94a3b8'}
                      fontSize="12"
                      fontWeight="700"
                      paintOrder="stroke"
                      stroke="rgba(0,0,0,0.78)"
                      strokeWidth="4"
                      strokeLinejoin="round"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </section>
        </main>
      </div>
    </div>
  );
};

export default FeatureGraphPage;
