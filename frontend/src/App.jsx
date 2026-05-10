import React, { useState, useEffect, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, ComposedChart, Bar, Legend
} from 'recharts';
import { AlertTriangle, ChevronDown, ChevronUp, Clock3, Cpu, Crosshair, Gauge, GitBranch, Radio, RefreshCw, Activity, ShieldAlert, ShieldCheck, Wifi, WifiOff, Zap } from 'lucide-react';
import FeatureGraphPage from './components/FeatureGraphPage';

// --- NARZĘDZIA POMOCNICZE ---
const panelClass = "hud-panel pointer-events-auto shrink-0 bg-black/78 border border-emerald-300/35 backdrop-blur-xl rounded-sm shadow-[0_0_34px_rgba(16,185,129,0.12)]";
const chartPanelClass = "hud-panel bg-black/64 p-3 rounded-sm border border-emerald-300/24 flex flex-col min-h-0 shadow-inner shadow-emerald-400/[0.03]";
const chartTitleClass = "text-[11px] text-slate-100 font-semibold tracking-[0.14em] mb-2 flex justify-between items-center shrink-0 uppercase";

const getThreatColor = (prob) => {
  const safeProb = Math.max(0, Math.min(1, prob || 0));
  const r = safeProb < 0.5 ? Math.floor(safeProb * 2 * 255) : 255;
  const g = safeProb > 0.5 ? Math.floor((1 - safeProb) * 2 * 255) : 255;
  return `rgb(${r},${g},0)`;
};

// Wspólny styl dla RechartsTooltip
const tooltipStyle = {
  backgroundColor: 'rgba(0, 10, 6, 0.96)',
  border: '1px solid rgba(52, 211, 153, 0.38)',
  color: '#d1fae5',
  fontSize: '12px',
  borderRadius: '2px',
  boxShadow: '0 0 28px rgba(16, 185, 129, 0.18)'
};

const labelStyle = { color: '#6ee7b7', fontSize: '11px', fontWeight: 700 };
const tickStyle = { fontSize: 11, fill: '#a7f3d0', fontWeight: 600 };
const lineAnimation = { isAnimationActive: true, animationDuration: 450, animationEasing: 'ease-out' };
const API_BASE_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;

const CollapseButton = ({ collapsed, onToggle, label = 'Toggle panel' }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onToggle}
    className="shrink-0 rounded-sm border border-emerald-300/24 bg-white/[0.045] p-1 text-emerald-100 hover:bg-emerald-300/14 hover:border-emerald-200/55 transition-all"
  >
    {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
  </button>
);

// ==========================================
// SEKCJA 1: NAVBAR
// ==========================================
const NavbarSection = ({ dataCount, isConnected, runtimeStats, collapsed, onToggle, onShowFeatureGraph }) => (
  <div className={`${panelClass} p-4 flex flex-col gap-3 w-[390px] max-[1100px]:w-[300px] max-w-[calc(100vw-32px)]`}>
    <div className="flex items-center justify-between gap-3 border-b border-emerald-400/20 pb-3">
      <ShieldCheck size={24} className="text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
      <div className="min-w-0 flex-1">
        <h1 className="glitch-title text-xl max-[1100px]:text-lg font-black tracking-[0.18em] text-emerald-100 leading-tight truncate">AEGIS GPS</h1>
        <div className="text-[10px] text-emerald-300/80 tracking-[0.16em] leading-snug truncate">ADVANCED DRONE SPOOFING DETECTION</div>
      </div>
      <CollapseButton collapsed={collapsed} onToggle={onToggle} label="Toggle system panel" />
    </div>
    <div className={`grid grid-cols-3 gap-2 mt-1 ${collapsed ? 'hidden' : ''}`}>
      <div className="flex flex-col text-[11px]">
        <span className="text-slate-400 text-[10px] tracking-[0.12em]">SYSTEM STATUS</span>
        <span className="text-emerald-300 font-semibold flex items-center gap-1">
          <Activity size={10}/> SECURE
        </span>
      </div>
      <div className="flex flex-col text-[11px]">
        <span className="text-slate-400 text-[10px] tracking-[0.12em]">MEMORY ALLOC</span>
        <span className="text-lime-300 font-semibold">{dataCount} PTS</span>
      </div>
      {/* NOWE: wskaźnik połączenia SSE */}
      <div className="flex flex-col text-[11px]">
        <span className="text-slate-400 text-[10px] tracking-[0.12em]">DATA FEED</span>
        <span className={`font-semibold flex items-center gap-1 ${isConnected ? 'text-emerald-300' : 'text-red-400'}`}>
          {isConnected ? <Wifi size={10}/> : <WifiOff size={10}/>}
          {isConnected ? 'LIVE' : 'NO FEED'}
        </span>
      </div>
    </div>
    <div className={`grid grid-cols-3 max-[1100px]:grid-cols-1 gap-2 border-t border-emerald-300/16 pt-2 ${collapsed ? 'hidden' : ''}`}>
      <div className="bg-white/[0.045] border border-emerald-300/16 p-2 rounded-sm min-w-0">
        <div className="flex items-center gap-1 text-[9px] text-slate-400 tracking-[0.12em]"><Cpu size={10}/> MODEL</div>
        <div className="text-[11px] text-emerald-100 font-semibold truncate">{runtimeStats.model || 'awaiting'}</div>
      </div>
      <div className="bg-white/[0.045] border border-emerald-300/16 p-2 rounded-sm">
        <div className="flex items-center gap-1 text-[9px] text-slate-400 tracking-[0.12em]"><Zap size={10}/> SCORED</div>
        <div className="text-[11px] text-emerald-100 font-semibold">{runtimeStats.totalScored || 0}</div>
      </div>
      <div className="bg-white/[0.045] border border-emerald-300/16 p-2 rounded-sm">
        <div className="flex items-center gap-1 text-[9px] text-slate-400 tracking-[0.12em]"><Clock3 size={10}/> LATENCY</div>
        <div className="text-[11px] text-emerald-100 font-semibold">{fmt(runtimeStats.lastLatency, 2)} ms</div>
      </div>
    </div>
    <button
      onClick={onShowFeatureGraph}
      className={`flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase border border-emerald-300/28 bg-emerald-300/8 text-emerald-100 px-3 py-2 rounded-sm hover:bg-emerald-300/14 hover:border-emerald-200/55 transition-all ${collapsed ? 'hidden' : ''}`}
    >
      <GitBranch size={14} /> Feature Graph
    </button>
  </div>
);

// ==========================================
// SEKCJA 2: GLOBUS, ACTIVE TARGETS, UNLOCK
// ==========================================
const GlobeBackground = ({ globeRef, globeData, alerts, focusedDroneId, isAutoRotate, handleLockOnTarget }) => {
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = isAutoRotate;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    }
  }, [isAutoRotate, globeRef]);

  return (
    <div className="absolute inset-0 z-0 opacity-82 cursor-crosshair">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#22c55e"
        atmosphereAltitude={0.15}
        pathsData={globeData.paths}
        pathsTransitionDuration={0}
        pathPoints="points"
        pathColor="color"
        pathResolution={30}
        pathWidth={1.5}
        ringsData={alerts}
        ringColor={() => t => `rgba(239, 68, 68, ${1 - t})`}
        ringMaxRadius={15}
        ringPropagationSpeed={2}
        ringRepeatPeriod={0}
        htmlElementsData={globeData.htmlElements}
        htmlLat="lat"
        htmlLng="lng"
        htmlElement={(d) => {
          const el = document.createElement('div');
          const isDanger = d.isCompromised || d.probability > 0.5;
          const isFocused = d.mId === focusedDroneId;
          const pulseClass = 'animate-pulse';
          const zIndexVal = isFocused ? 999 : (isDanger ? 10 : 1);
          el.style.pointerEvents = 'auto';
          el.style.cursor = 'crosshair';
          el.onclick = () => handleLockOnTarget(d.mId);

          el.innerHTML = `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; pointer-events: auto; z-index: ${zIndexVal};">
              <div class="${pulseClass}" style="position: relative; width: ${isFocused ? '20px' : '14px'}; height: ${isFocused ? '20px' : '14px'}; border-radius: 50%; background-color: ${isDanger ? '#ef4444' : d.color}; box-shadow: 0 0 20px 5px ${isDanger ? '#ef4444' : d.color}; border: ${isFocused ? '3px solid white' : '1px solid white'};"></div>
              <div class="absolute -top-8 text-[11px] whitespace-nowrap px-1.5 py-0.5 border font-bold ${isFocused ? 'bg-white text-black border-white z-50' : 'bg-black/90 border-gray-600'}" style="${!isFocused ? `color: ${d.color};` : ''}">
                ID:${d.mId} [${(d.probability * 100).toFixed(0)}%]
              </div>
            </div>
          `;
          return el;
        }}
      />
    </div>
  );
};

const ActiveTargetsList = ({ activeDrones, focusedDroneId, handleLockOnTarget, collapsed, onToggle }) => (
  <div className={`${panelClass} p-3 flex flex-col gap-2 w-[390px] max-[1100px]:w-[300px] max-w-[calc(100vw-32px)] ${collapsed ? 'max-h-[52px]' : 'max-h-[250px]'} overflow-hidden`}>
    <div className="flex justify-between items-center border-b border-emerald-400/20 pb-2">
      <h3 className="text-[11px] font-semibold text-slate-100 tracking-[0.14em]">ACTIVE TARGETS / FLEET</h3>
      <div className="flex items-center gap-2">
        <span className="text-[10px] bg-emerald-300/14 px-2 py-0.5 rounded-sm text-emerald-100 border border-emerald-300/35">{activeDrones.length} ONLINE</span>
        <CollapseButton collapsed={collapsed} onToggle={onToggle} label="Toggle target list" />
      </div>
    </div>
    <div className={`flex flex-col gap-1 overflow-y-auto custom-scrollbar ${collapsed ? 'hidden' : ''}`}>
      {activeDrones.length === 0 ? (
        <span className="text-[11px] text-slate-300 tracking-[0.16em] uppercase py-2 text-center">Awaiting Connection...</span>
      ) : (
        activeDrones.map(drone => {
          const isDanger = drone.isCompromised || drone.probability > 0.5 || drone["Model Prediction"] === 1;
          return (
            <div 
              key={drone.mId}
              onClick={() => handleLockOnTarget(drone.mId)}
              className={`target-row flex justify-between items-center p-2 cursor-crosshair border-l-2 rounded-sm transition-all ${focusedDroneId === drone.mId ? 'border-white bg-white/10' : ( isDanger ?  ('bg-red-500/10 hover:bg-red-500/20 border-red-400') : ('hover:bg-emerald-500/12 border-emerald-500') ) } `}
            >
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-emerald-100">ID: {drone.mId}</span>
                <span className="text-[10px] text-slate-300">LAT: {drone.lat?.toFixed(3)} | LNG: {drone.lng?.toFixed(3)}</span>
              </div>
              <div className={`text-[10px] font-bold px-2 py-1 rounded-sm border ${isDanger ? ('bg-red-500/22 text-red-50 border-red-300/45 animate-[pulse_1s_ease-in-out]') : ('bg-emerald-500/16 text-emerald-50 border-emerald-300/30')}`}>
                {isDanger ? 'MODEL HIT' : `${(drone.probability * 100).toFixed(1)}%`}
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);

const GlobeControls = ({ isAutoRotate, setIsAutoRotate, focusedDroneId, setFocusedDroneId }) => (
  <div className={`${panelClass} flex flex-col gap-2 p-2`}>
    <button 
      onClick={() => setIsAutoRotate(!isAutoRotate)}
      className={`p-2 rounded-sm border transition-all flex items-center gap-2 text-xs ${isAutoRotate ? 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.18)]' : 'bg-white/[0.04] border-emerald-300/20 text-slate-300 hover:border-emerald-300/40'}`}
    >
      <RefreshCw size={14} className={isAutoRotate ? "animate-spin-slow" : ""} /> [ROTOR]
    </button>
    <button 
      onClick={() => setFocusedDroneId(null)}
      className={`p-2 rounded-sm border transition-all flex items-center gap-2 text-xs ${focusedDroneId ? 'bg-emerald-400/10 border-emerald-300/40 text-emerald-100' : 'bg-white/[0.04] border-emerald-300/20 text-slate-300 hover:border-emerald-300/40'}`}
    >
      <Crosshair size={14} /> [UNLOCK]
    </button>
  </div>
);

const fmt = (value, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toFixed(digits);
};

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

const fmtValue = (value, digits = 2) => {
  if (digits === null) return value ?? 'N/A';
  return fmt(value, digits);
};

const RiskBar = ({ label, value, detail, danger }) => (
  <div className="space-y-1">
    <div className="flex justify-between gap-2 text-[10px]">
      <span className="text-slate-300 tracking-[0.11em] uppercase truncate">{label}</span>
      <span className={danger ? 'text-red-100 font-semibold' : 'text-emerald-100 font-semibold'}>{detail}</span>
    </div>
    <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
      <div
        className={`h-full ${danger ? 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.75)]' : 'bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.65)]'}`}
        style={{ width: `${Math.round(clamp01(value) * 100)}%` }}
      />
    </div>
  </div>
);

const TargetIntelPanel = ({ target, collapsed, onToggle }) => {
  if (!target) {
    return (
      <div className={`${panelClass} w-[320px] max-[1100px]:w-[300px] p-3`}>
        <div className="flex items-center justify-between border-b border-emerald-400/20 pb-2">
          <div className="text-[11px] font-semibold text-slate-100 tracking-[0.14em]">
            TARGET INTEL
          </div>
          <CollapseButton collapsed={collapsed} onToggle={onToggle} label="Toggle target intel" />
        </div>
        <div className={`mt-3 text-[11px] text-slate-300 border border-dashed border-emerald-300/24 bg-white/[0.035] p-3 rounded-sm ${collapsed ? 'hidden' : ''}`}>
          Click a target on the globe or fleet list to inspect current GNSS state.
        </div>
      </div>
    );
  }

  const isSpoofed = target.isCompromised || target.probability > 0.5 || target["Model Prediction"] === 1;
  const satCount = Number(target["Satellite Count"]);
  const hdop = Number(target["GPS HDOP"]);
  const xTrack = Number(target["X-Track Error (m)"]);
  const threshold = Number(target["Model Threshold"]);
  const riskFactors = [
    ['Satellite Loss', clamp01((8 - satCount) / 6), Number.isFinite(satCount) ? `${satCount} locked` : 'N/A', satCount <= 6],
    ['HDOP Drift', clamp01((hdop - 1) / 8), Number.isFinite(hdop) ? hdop.toFixed(2) : 'N/A', hdop >= 3],
    ['Route Error', clamp01(xTrack / 45), Number.isFinite(xTrack) ? `${xTrack.toFixed(1)} m` : 'N/A', xTrack >= 8],
    ['Model Margin', threshold ? clamp01(target.probability / Math.max(threshold * 80, 0.001)) : clamp01(target.probability), `thr ${fmt(threshold, 3)}`, isSpoofed],
  ];

  const rows = [
    ['Run Time', target["Run Time"], null],
    ['Satellites', target["Satellite Count"], 0],
    ['GPS HDOP', target["GPS HDOP"], 3],
    ['X-Track Error', target["X-Track Error (m)"], 2],
    ['Altitude', target["Vertical Position (m)"], 2],
    ['Altitude Setpoint', target["Altitude Setpoint (m)"], 2],
    ['Model Threshold', target["Model Threshold"], 3],
  ];

  return (
    <div className={`${panelClass} w-[320px] max-[1100px]:w-[300px] p-3`}>
      <div className="flex items-center justify-between border-b border-emerald-400/20 pb-2">
        <h3 className="text-[11px] font-semibold text-slate-100 tracking-[0.14em]">TARGET INTEL</h3>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-sm border font-bold ${isSpoofed ? 'text-red-100 bg-red-500/18 border-red-300/35' : 'text-emerald-100 bg-emerald-300/12 border-emerald-300/30'}`}>
            {isSpoofed ? 'SPOOF SUSPECT' : 'CLEAN'}
          </span>
          <CollapseButton collapsed={collapsed} onToggle={onToggle} label="Toggle target intel" />
        </div>
      </div>

      <div className={collapsed ? 'hidden' : ''}>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-[10px] text-slate-400 tracking-[0.14em]">MEASUREMENT ID</div>
          <div className="text-2xl font-black text-emerald-50">{target.mId}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 tracking-[0.14em]">MODEL PROBABILITY</div>
          <div className={`text-2xl font-black ${isSpoofed ? 'text-red-100' : 'text-emerald-100'}`}>
            {(target.probability * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {rows.map(([label, value, digits]) => (
          <div key={label} className="bg-white/[0.045] border border-emerald-300/16 px-2 py-2 rounded-sm min-w-0">
            <div className="text-[9px] text-slate-400 tracking-[0.11em] uppercase truncate">{label}</div>
            <div className="text-sm font-semibold text-slate-50 truncate">{fmtValue(value, digits)}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 bg-white/[0.035] border border-emerald-300/16 p-2 rounded-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-300 tracking-[0.14em] uppercase flex items-center gap-1"><Gauge size={11}/> Risk Factors</span>
          <span className={`text-[10px] font-semibold ${isSpoofed ? 'text-red-100' : 'text-emerald-100'}`}>
            {target["Inference Mode"] || 'live model'}
          </span>
        </div>
        {riskFactors.map(([label, value, detail, danger]) => (
          <RiskBar key={label} label={label} value={value} detail={detail} danger={danger} />
        ))}
      </div>

      <div className={`mt-3 border p-2 rounded-sm ${isSpoofed ? 'bg-red-500/10 border-red-300/30' : 'bg-emerald-500/8 border-emerald-300/20'}`}>
        <div className="text-[10px] tracking-[0.14em] uppercase text-slate-300">Operator Recommendation</div>
        <div className={`mt-1 text-[11px] leading-snug ${isSpoofed ? 'text-red-50' : 'text-emerald-50'}`}>
          {isSpoofed
            ? 'Flag GNSS as degraded, verify inertial/vehicle telemetry and hold autonomous route updates.'
            : 'Signal pattern is nominal. Keep monitoring constellation quality and route deviation.'}
        </div>
      </div>

      <div className="mt-3 bg-black/58 border border-emerald-300/16 p-2 rounded-sm">
        <div className="flex justify-between text-[10px] text-slate-300">
          <span>LAT {fmt(target.lat, 4)}</span>
          <span>LNG {fmt(target.lng, 4)}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
          <div
            className={`h-full ${isSpoofed ? 'bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.8)]' : 'bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.7)]'}`}
            style={{ width: `${Math.min(100, Math.max(0, target.probability * 100))}%` }}
          />
        </div>
        <div className="mt-2 text-[10px] text-slate-400 truncate">
          {target["Model Source"] || 'model probability from live API'} | {fmt(target["Inference Latency (ms)"], 2)} ms
        </div>
      </div>
      </div>
    </div>
  );
};

const MissionSummaryPanel = ({ runtimeStats, activeDrones, collapsed, onToggle }) => {
  const online = activeDrones.length;
  const compromised = activeDrones.filter(d => d.isCompromised || d["Model Prediction"] === 1).length;
  const avgProbability = activeDrones.length
    ? activeDrones.reduce((sum, item) => sum + (Number(item.probability) || 0), 0) / activeDrones.length
    : 0;
  const detectionRate = runtimeStats.totalScored
    ? runtimeStats.detections / runtimeStats.totalScored
    : 0;

  return (
    <div className={`${panelClass} w-[320px] max-[1100px]:w-[300px] p-3`}>
      <div className="flex items-center justify-between border-b border-emerald-400/20 pb-2">
        <h3 className="text-[11px] font-semibold text-slate-100 tracking-[0.14em]">LIVE EVALUATION</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-emerald-100 bg-emerald-300/12 border border-emerald-300/28 px-2 py-0.5 rounded-sm max-w-[132px] truncate">
            {runtimeStats.mode || 'warming up'}
          </span>
          <CollapseButton collapsed={collapsed} onToggle={onToggle} label="Toggle live evaluation" />
        </div>
      </div>
      <div className={`grid grid-cols-2 gap-2 mt-3 ${collapsed ? 'hidden' : ''}`}>
        <div className="bg-white/[0.045] border border-emerald-300/16 p-2 rounded-sm">
          <div className="text-[9px] text-slate-400 tracking-[0.12em] uppercase flex items-center gap-1"><Radio size={10}/> Online</div>
          <div className="text-xl font-black text-emerald-50">{online}</div>
        </div>
        <div className="bg-red-500/10 border border-red-300/28 p-2 rounded-sm">
          <div className="text-[9px] text-red-100/80 tracking-[0.12em] uppercase flex items-center gap-1"><AlertTriangle size={10}/> Compromised</div>
          <div className="text-xl font-black text-red-50">{compromised}</div>
        </div>
        <div className="bg-white/[0.045] border border-emerald-300/16 p-2 rounded-sm">
          <div className="text-[9px] text-slate-400 tracking-[0.12em] uppercase">Detections</div>
          <div className="text-xl font-black text-emerald-50">{runtimeStats.detections || 0}</div>
        </div>
        <div className="bg-white/[0.045] border border-emerald-300/16 p-2 rounded-sm">
          <div className="text-[9px] text-slate-400 tracking-[0.12em] uppercase">Threat Ratio</div>
          <div className="text-xl font-black text-emerald-50">{(detectionRate * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div className={`mt-3 space-y-2 ${collapsed ? 'hidden' : ''}`}>
        <RiskBar label="Fleet Avg Probability" value={avgProbability} detail={`${(avgProbability * 100).toFixed(1)}%`} danger={avgProbability > 0.1} />
        <RiskBar label="Stream Progress" value={(runtimeStats.totalScored || 0) / 3600} detail={`${runtimeStats.totalScored || 0}/3600`} danger={false} />
      </div>
    </div>
  );
};

// ==========================================
// SEKCJA 3: STATYSTYKI (ZOPTYMALIZOWANA)
// ==========================================
const StatsSection = ({ alerts, chartData, handleLockOnTarget, collapsed, onToggle }) => (
  <div className="w-full flex justify-center pointer-events-none pb-4 max-[1100px]:pb-3 relative z-20">
    <div className={`w-full max-w-[1400px] flex flex-col gap-3 pointer-events-auto ${collapsed ? 'h-[45px]' : 'h-[282px] max-[1100px]:h-[238px] max-[900px]:h-[430px]'}`}>
      
      {/* HORIZONTAL ALERTS BAR */}
      <div className={`hud-panel w-full bg-black/76 border border-emerald-400/20 backdrop-blur-xl rounded-sm flex flex-col shadow-[0_-18px_60px_rgba(0,0,0,0.62)] ${collapsed ? 'h-[45px]' : 'h-[104px] max-[1100px]:h-[86px]'} shrink-0 overflow-hidden`}>
        <div className="flex justify-between items-center px-4 py-1.5 border-b border-emerald-400/18 shrink-0">
          <h3 className="text-xs font-semibold text-red-100 tracking-[0.14em] flex items-center gap-2">
            <ShieldAlert size={14} /> RECENT COMPROMISED SIGNATURES
          </h3>
          <div className="flex items-center gap-2">
            <div className="text-[11px] text-slate-200 font-semibold bg-white/[0.06] px-2 py-0.5 rounded-sm border border-emerald-300/24">
              LATEST THREATS: <span className="text-red-100">{alerts.length}/5</span>
            </div>
            <CollapseButton collapsed={collapsed} onToggle={onToggle} label="Toggle telemetry panels" />
          </div>
        </div>
        
        <div className={`flex-1 w-full min-h-0 p-2 overflow-hidden ${collapsed ? 'hidden' : ''}`}>
          {alerts.length === 0 ? (
            <div className="flex justify-center items-center w-full h-full gap-2 border border-dashed border-emerald-300/28 bg-white/[0.035] rounded-sm uppercase tracking-[0.14em] text-[11px] text-slate-200">
              <ShieldCheck size={16} /> Awaiting Threat Signatures...
            </div>
          ) : (
            <div className="alert-strip flex gap-2 h-full min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar pb-1">
              {alerts.map(alert => (
                <div 
                  key={alert.id}
                  onClick={() => handleLockOnTarget(alert.mId)}
                  className="w-[260px] shrink-0 h-full min-h-0 bg-red-950/28 border border-red-300/35 px-2.5 py-1.5 rounded-sm flex flex-col justify-center hover:bg-red-950/45 hover:border-red-200/55 transition-all relative group cursor-crosshair box-border overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-red-400/90 animate-[pulse_1s_ease-in-out]"></div>
                  <div className="flex justify-between items-center gap-2 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="text-[10px] text-slate-200 tracking-[0.12em] truncate">ID: {alert.mId}</div>
                      <div className="text-[11px] font-semibold text-red-100 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping shrink-0"></span> 
                        <span className="truncate">MODEL HIT {(alert.probability * 100).toFixed(2)}%</span>
                      </div>
                      <div className="text-[9px] text-slate-300 truncate">
                        SAT {alert["Satellite Count"] ?? 'N/A'} | HDOP {fmt(alert["GPS HDOP"], 2)} | XTE {fmt(alert["X-Track Error (m)"], 1)}m
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-100 bg-black/80 px-1.5 py-0.5 border border-red-200/24 font-mono shrink-0 rounded-sm">
                      {alert.timestamp}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CRITICAL STATS ROW — CSS Grid zamiast % szerokości */}
      <div className={`hud-panel grid h-[165px] max-[1100px]:h-[136px] max-[900px]:h-[330px] grid-cols-10 max-[900px]:grid-cols-1 gap-3 flex-1 w-full bg-black/76 border border-emerald-400/20 backdrop-blur-xl rounded-sm p-3 shadow-[0_20px_70px_rgba(0,0,0,0.58)] ${collapsed ? 'hidden' : ''}`}>
        
        {/* WYKRES 1: THREAT PROBABILITY — col-span-3 */}
        <div className={`col-span-3 max-[900px]:col-span-1 ${chartPanelClass}`}>
          <h3 className={chartTitleClass}>
            <span>THREAT PROBABILITY</span>
            <span className="text-[10px] text-red-100 bg-red-500/16 px-2 py-0.5 rounded-sm border border-red-300/24">SPOOF LEVEL</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                <defs>
                  <linearGradient id="probabilityStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(52,211,153,0.13)" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={[0, 1]} />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '6px', color: '#6ee7b7' }} />
                <Line 
                  name="Spoof Prob" 
                  type="monotone" 
                  dataKey="probability" 
                  stroke="url(#probabilityStroke)" 
                  strokeWidth={3} 
                  dot={false}
                  activeDot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                  {...lineAnimation}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* WYKRES 2: NAVIGATION DEVIATION — col-span-3 */}
        <div className={`col-span-3 max-[900px]:col-span-1 ${chartPanelClass}`}>
          <h3 className={chartTitleClass}>
            NAVIGATION DEVIATION
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 4 }}>
                <CartesianGrid stroke="rgba(52,211,153,0.13)" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis yAxisId="left" tick={tickStyle} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <YAxis yAxisId="right" orientation="right" tick={{ ...tickStyle, fill: '#22d3ee' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: '11px', paddingTop: '6px', color: '#6ee7b7' }} />
                <Line 
                  name="X-Track Error" 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="xTrackError" 
                  stroke="#facc15" 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 5, fill: '#facc15', stroke: '#fff', strokeWidth: 2 }}
                  {...lineAnimation}
                />
                <Line 
                  name="Vertical Velocity" 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="verticalVelocity" 
                  stroke="#22d3ee" 
                  strokeWidth={2.5} 
                  strokeDasharray="6 5" 
                  dot={false} 
                  activeDot={{ r: 5, fill: '#22d3ee', stroke: '#fff', strokeWidth: 2 }}
                  {...lineAnimation}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* WYKRES 3: CONSTELLATION HEALTH — col-span-4 */}
        <div className={`col-span-4 max-[900px]:col-span-1 ${chartPanelClass}`}>
          <h3 className={chartTitleClass}>
            CONSTELLATION HEALTH
          </h3>
          <div className="flex-1 w-full min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 4 }}>
                <defs>
                  <linearGradient id="satGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a3e635" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.48} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(52,211,153,0.13)" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                {/* domain z marginesem, żeby małe wahania były widoczne */}
                <YAxis yAxisId="left" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tick={{ ...tickStyle, fill: '#f87171' }} 
                  axisLine={false} 
                  tickLine={false} 
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px', color: '#6ee7b7' }} />
                <Bar 
                  name="Sat Count" 
                  yAxisId="left" 
                  dataKey="satCount" 
                  fill="url(#satGradient)" 
                  isAnimationActive={true}
                  animationDuration={450}
                  animationEasing="ease-out"
                  radius={[4, 4, 0, 0]} 
                />
                <Line 
                  name="HDOP Noise" 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="gpsHdop" 
                  stroke="#f87171" 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 5, fill: '#f87171', stroke: '#fff', strokeWidth: 2 }}
                  {...lineAnimation}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  </div>
);


// ==========================================
// GŁÓWNY KOMPONENT / APLIKACJA
// ==========================================
const SOCDashboard = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [dataStream, setDataStream] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [, setCompromisedIds] = useState(() => new Set());
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [focusedDroneId, setFocusedDroneId] = useState(null);
  const [runtimeStats, setRuntimeStats] = useState({
    detections: 0,
    lastLatency: 0,
    mode: '',
    model: '',
    threshold: null,
    totalScored: 0,
  });
  const [collapsedPanels, setCollapsedPanels] = useState(() => {
    const tabletPortrait = typeof window !== 'undefined' && window.innerWidth <= 900;
    return {
      system: tabletPortrait,
      targets: false,
      intel: false,
      evaluation: true,
      telemetry: tabletPortrait,
    };
  });
  // NOWE: stan połączenia SSE
  const [isConnected, setIsConnected] = useState(false);
  const globeEl = useRef();
  const updateQueueRef = useRef([]);
  const updateTimeoutRef = useRef(null);
  const compromisedIdsRef = useRef(new Set());
  const MAX_POINTS_PER_DRONE = 50;

  const togglePanel = (panel) => {
    setCollapsedPanels(prev => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  };

  useEffect(() => {
    const eventSource = new EventSource(`${API_BASE_URL}/stream`);
    
    eventSource.onopen = () => setIsConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        updateQueueRef.current.push(newData);
        
        // Debounce updates: process queue every 50ms to batch changes
        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = setTimeout(() => {
          const queue = updateQueueRef.current;
          updateQueueRef.current = [];
          queue.forEach(data => handleNewData(data));
        }, 50);
      } catch (e) {
        console.error("SSE Parse Error:", e);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error. Is FastAPI running?", err);
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  const handleNewData = (newData) => {
    const mId = newData["Measurement_ID"] || "UNKNOWN";
    const lat = newData["GPS Latitude"];
    const lng = newData["GPS Longitude"];
    const alt = newData["Vertical Position (m)"] || newData["Relative Altitude (m)"] || newData["Altitude AMSL (m)"] || 50;
    
    const probability = newData["Probability"] !== undefined 
      ? newData["Probability"] 
      : (newData["Data Type"] === 1 ? (0.7 + Math.random() * 0.2) : (0.05 + Math.random() * 0.15));
    const isModelSpoof = newData["Model Prediction"] === 1;

    const parsedData = {
      ...newData,
      lat, lng, alt, mId, probability,
      timestamp: newData["Run Time"] || newData["Clock Time"] || new Date().toLocaleTimeString(),
      xTrackError: newData["X-Track Error (m)"] || 0,
      verticalVelocity: newData["Vertical Velocity (m/s)"] || 0,
      gpsHdop: newData["GPS HDOP"] || 1,
      satCount: newData["Satellite Count"] || 10,
      isCompromised: isModelSpoof || probability > 0.5 || compromisedIdsRef.current.has(mId)
    };

    setRuntimeStats(prev => ({
      detections: prev.detections + (isModelSpoof ? 1 : 0),
      lastLatency: newData["Inference Latency (ms)"] ?? prev.lastLatency,
      mode: newData["Inference Mode"] || prev.mode,
      model: newData["Model Source"] || prev.model,
      threshold: newData["Model Threshold"] ?? prev.threshold,
      totalScored: newData["Realtime Scored Count"] ?? (prev.totalScored + 1),
    }));

    setDataStream(prev => {
      const updated = [...prev, parsedData];
      // Group by drone and limit each drone to MAX_POINTS_PER_DRONE
      const byDrone = {};
      updated.forEach(d => {
        if (!byDrone[d.mId]) byDrone[d.mId] = [];
        byDrone[d.mId].push(d);
      });
      
      // Keep only last MAX_POINTS_PER_DRONE per drone to stabilize buffer sizes
      const result = [];
      Object.values(byDrone).forEach(points => {
        if (points.length > MAX_POINTS_PER_DRONE) {
          result.push(...points.slice(points.length - MAX_POINTS_PER_DRONE));
        } else {
          result.push(...points);
        }
      });
      return result;
    });

    if (isModelSpoof || probability > 0.5) {
      setFocusedDroneId(prev => prev ?? mId);

      setCompromisedIds(prev => {
        if (prev.has(mId)) return prev;
        const updated = new Set(prev);
        updated.add(mId);
        compromisedIdsRef.current = updated;
        return updated;
      });

      setAlerts(prev => {
        if (prev.some(a => a.mId === mId && (Date.now() - a.id) < 5000)) return prev;
        const updated = [{ ...parsedData, id: Date.now() }, ...prev];
        return updated.length > 5 ? updated.slice(0, 5) : updated;
      });
    }
  };

  const globeData = useMemo(() => {
    const byMeasurement = {};
    dataStream.forEach(d => {
      if (!byMeasurement[d.mId]) byMeasurement[d.mId] = [];
      byMeasurement[d.mId].push(d);
    });

    const paths = [];
    const htmlElements = [];

    Object.values(byMeasurement).forEach(pts => {
      const latest = pts[pts.length - 1];

      if (pts.length > 1) {
        paths.push({
          id: `${latest.mId}-${pts.length}`,
          points: pts.map(p => [p.lat, p.lng, p.alt / 10000]),
          color: latest.isCompromised ? '#ef4444' : getThreatColor(latest.probability)
        });
      }
      
      htmlElements.push({
        lat: latest.lat,
        lng: latest.lng,
        mId: latest.mId,
        probability: latest.probability,
        color: latest.isCompromised ? '#ef4444' : getThreatColor(latest.probability),
        isCompromised: latest.isCompromised
      });
    });

    return { paths, htmlElements };
  }, [dataStream]);

  const handleLockOnTarget = (droneId) => {
    setFocusedDroneId(droneId);
    
    const targetPoints = dataStream.filter(d => d.mId === droneId);
    if (targetPoints.length > 0 && globeEl.current) {
      const latest = targetPoints[targetPoints.length - 1];
      globeEl.current.pointOfView({ lat: latest.lat, lng: latest.lng }, 800);
    }
  };

  const activeDrones = useMemo(() => {
    const droneMap = {};
    dataStream.forEach(d => {
      droneMap[d.mId] = d;
    });
    return Object.values(droneMap).sort((a, b) => b.probability - a.probability);
  }, [dataStream]);

  const focusedStream = focusedDroneId ? dataStream.filter(d => d.mId === focusedDroneId) : dataStream;
  const chartData = focusedStream.slice(-30);
  const focusedTarget = focusedDroneId ? activeDrones.find(d => d.mId === focusedDroneId) : null;

  if (currentView === 'feature-graph') {
    return <FeatureGraphPage onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="hacker-root relative w-screen h-screen bg-[#010302] text-emerald-200 font-mono overflow-hidden selection:bg-emerald-900/70">
      
      {/* TŁO GLOBUSA */}
      <GlobeBackground 
        globeRef={globeEl} 
        globeData={globeData} 
        alerts={alerts} 
        focusedDroneId={focusedDroneId} 
        isAutoRotate={isAutoRotate} 
        handleLockOnTarget={handleLockOnTarget}
      />

      {/* WARSTWA INTERFEJSU */}
      <div className="absolute inset-0 z-10 pointer-events-none px-4 max-[900px]:px-3 pt-4 max-[900px]:pt-3 flex flex-col justify-between">
        <div className="pointer-events-none absolute inset-0 z-[-1] cyber-grid opacity-70"></div>
        
        {/* GÓRNY HUD (Left & Right) */}
        <div className="flex justify-between items-start gap-4 max-[900px]:gap-2 w-full">
          {/* Lewa strona */}
          <div className="pointer-events-auto flex flex-col gap-3 max-[1100px]:gap-2 max-h-[calc(100vh-330px)] max-[1100px]:max-h-[calc(100vh-276px)] max-[900px]:max-h-[calc(100vh-462px)] overflow-y-auto custom-scrollbar pr-1">
            <NavbarSection
              dataCount={dataStream.length}
              isConnected={isConnected}
              runtimeStats={runtimeStats}
              collapsed={collapsedPanels.system}
              onToggle={() => togglePanel('system')}
              onShowFeatureGraph={() => setCurrentView('feature-graph')}
            />
            <ActiveTargetsList
              activeDrones={activeDrones}
              focusedDroneId={focusedDroneId}
              handleLockOnTarget={handleLockOnTarget}
              collapsed={collapsedPanels.targets}
              onToggle={() => togglePanel('targets')}
            />
          </div>

          {/* Prawa strona */}
          <div className="pointer-events-auto flex flex-col gap-3 max-[1100px]:gap-2 max-h-[calc(100vh-330px)] max-[1100px]:max-h-[calc(100vh-276px)] max-[900px]:max-h-[calc(100vh-462px)] overflow-y-auto custom-scrollbar pr-1">
            <GlobeControls 
              isAutoRotate={isAutoRotate} 
              setIsAutoRotate={setIsAutoRotate} 
              focusedDroneId={focusedDroneId} 
              setFocusedDroneId={setFocusedDroneId} 
            />
            <TargetIntelPanel
              target={focusedTarget}
              collapsed={collapsedPanels.intel}
              onToggle={() => togglePanel('intel')}
            />
            <MissionSummaryPanel
              runtimeStats={runtimeStats}
              activeDrones={activeDrones}
              collapsed={collapsedPanels.evaluation}
              onToggle={() => togglePanel('evaluation')}
            />
          </div>
        </div>

        {/* DOLNY HUD — Statystyki */}
        <StatsSection
          alerts={alerts}
          chartData={chartData}
          handleLockOnTarget={handleLockOnTarget}
          collapsed={collapsedPanels.telemetry}
          onToggle={() => togglePanel('telemetry')}
        />

      </div>
    </div>
  );
};

export default SOCDashboard;
