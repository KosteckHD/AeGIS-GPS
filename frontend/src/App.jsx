import React, { useState, useEffect, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, ComposedChart, Bar, Legend
} from 'recharts';
import { Crosshair, RefreshCw, Activity, ShieldAlert, ShieldCheck, Wifi, WifiOff, GitBranch } from 'lucide-react';
import FeatureGraphPage from './components/FeatureGraphPage';

// --- NARZĘDZIA POMOCNICZE ---
const panelClass = "hud-panel pointer-events-auto bg-black/78 border border-emerald-300/35 backdrop-blur-xl rounded-sm shadow-[0_0_34px_rgba(16,185,129,0.12)]";
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

// ==========================================
// SEKCJA 1: NAVBAR
// ==========================================
const NavbarSection = ({ dataCount, isConnected, onShowFeatureGraph }) => (
  <div className={`${panelClass} p-4 flex flex-col gap-3 min-w-[320px]`}>
    <div className="flex items-center gap-3 border-b border-emerald-400/20 pb-3">
      <ShieldCheck size={24} className="text-emerald-300 drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
      <div>
        <h1 className="glitch-title text-xl font-black tracking-[0.18em] text-emerald-100 leading-tight">AEGIS GPS</h1>
        <div className="text-[10px] text-emerald-300/80 tracking-[0.24em]">ADVANCED DRONE SPOOFING DETECTION</div>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 mt-1">
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
    <button
      onClick={onShowFeatureGraph}
      className="flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase border border-emerald-300/28 bg-emerald-300/8 text-emerald-100 px-3 py-2 rounded-sm hover:bg-emerald-300/14 hover:border-emerald-200/55 transition-all"
    >
      <GitBranch size={14} /> Feature Graph
    </button>
  </div>
);

// ==========================================
// SEKCJA 2: GLOBUS, ACTIVE TARGETS, UNLOCK
// ==========================================
const GlobeBackground = ({ globeRef, globeData, alerts, focusedDroneId, isAutoRotate }) => {
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

          el.innerHTML = `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: ${zIndexVal};">
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

const ActiveTargetsList = ({ activeDrones, focusedDroneId, handleLockOnTarget }) => (
  <div className={`${panelClass} p-3 flex flex-col gap-2 w-[320px] max-h-[250px] overflow-hidden`}>
    <div className="flex justify-between items-center border-b border-emerald-400/20 pb-2">
      <h3 className="text-[11px] font-semibold text-slate-100 tracking-[0.14em]">ACTIVE TARGETS / FLEET</h3>
      <span className="text-[10px] bg-emerald-300/14 px-2 py-0.5 rounded-sm text-emerald-100 border border-emerald-300/35">{activeDrones.length} ONLINE</span>
    </div>
    <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
      {activeDrones.length === 0 ? (
        <span className="text-[11px] text-slate-300 tracking-[0.16em] uppercase py-2 text-center">Awaiting Connection...</span>
      ) : (
        activeDrones.map(drone => {
          const isDanger = drone.isCompromised || drone.probability > 0.5;
          return (
            <div 
              key={drone.mId}
              onClick={() => handleLockOnTarget(drone.mId)}
              className={`target-row flex justify-between items-center p-2 cursor-crosshair border-l-2 rounded-sm transition-all ${focusedDroneId === drone.mId ? ' border-white' : ( isDanger ?  ('hover:bg-red-500 border-red-700') : ('hover:bg-emerald-500 border-emerald-700') ) } `}
            >
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-emerald-100">ID: {drone.mId}</span>
                <span className="text-[10px] text-slate-300">LAT: {drone.lat?.toFixed(3)} | LNG: {drone.lng?.toFixed(3)}</span>
              </div>
              <div className={`text-[10px] font-bold px-2 py-1 rounded-sm ${isDanger ? ('bg-red-600 text-red-300 animate-[pulse_1s_ease-in-out]') : ('bg-green-600 text-green-300')}`}>
                {(drone.probability * 100).toFixed(0)}% SGN
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

// ==========================================
// SEKCJA 3: STATYSTYKI (ZOPTYMALIZOWANA)
// ==========================================
const StatsSection = ({ alerts, chartData, handleLockOnTarget }) => (
  <div className="w-full flex justify-center pointer-events-none pb-4 relative z-20">
    <div className="w-full max-w-[1400px] flex flex-col gap-3 pointer-events-auto h-[282px]">
      
      {/* HORIZONTAL ALERTS BAR */}
      <div className="hud-panel w-full bg-black/76 border border-emerald-400/20 backdrop-blur-xl rounded-sm flex flex-col shadow-[0_-18px_60px_rgba(0,0,0,0.62)] h-[104px] shrink-0 overflow-hidden">
        <div className="flex justify-between items-center px-4 py-1.5 border-b border-emerald-400/18 shrink-0">
          <h3 className="text-xs font-semibold text-red-100 tracking-[0.14em] flex items-center gap-2">
            <ShieldAlert size={14} /> RECENT COMPROMISED SIGNATURES
          </h3>
          <div className="text-[11px] text-slate-200 font-semibold bg-white/[0.06] px-2 py-0.5 rounded-sm border border-emerald-300/24">
            LATEST THREATS: <span className="text-red-100">{alerts.length}/5</span>
          </div>
        </div>
        
        <div className="flex-1 w-full min-h-0 p-2 overflow-hidden">
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
                        <span className="truncate">SPOOF {(alert.probability * 100).toFixed(0)}%</span>
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
      <div className="hud-panel grid h-[165px] grid-cols-10 gap-3 flex-1 w-full bg-black/76 border border-emerald-400/20 backdrop-blur-xl rounded-sm p-3 shadow-[0_20px_70px_rgba(0,0,0,0.58)]">
        
        {/* WYKRES 1: THREAT PROBABILITY — col-span-3 */}
        <div className={`col-span-3 ${chartPanelClass}`}>
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
        <div className={`col-span-3 ${chartPanelClass}`}>
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
        <div className={`col-span-4 ${chartPanelClass}`}>
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
  // NOWE: stan połączenia SSE
  const [isConnected, setIsConnected] = useState(false);
  const globeEl = useRef();
  const updateQueueRef = useRef([]);
  const updateTimeoutRef = useRef(null);
  const compromisedIdsRef = useRef(new Set());
  const MAX_POINTS_PER_DRONE = 50;

  useEffect(() => {
    const eventSource = new EventSource('http://192.168.1.235:8000/stream');
    
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

    const parsedData = {
      ...newData,
      lat, lng, alt, mId, probability,
      timestamp: newData["Run Time"] || newData["Clock Time"] || new Date().toLocaleTimeString(),
      xTrackError: newData["X-Track Error (m)"] || 0,
      verticalVelocity: newData["Vertical Velocity (m/s)"] || 0,
      gpsHdop: newData["GPS HDOP"] || 1,
      satCount: newData["Satellite Count"] || 10,
      isCompromised: probability > 0.5 || compromisedIdsRef.current.has(mId)
    };

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

    if (probability > 0.5) {
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
      />

      {/* WARSTWA INTERFEJSU */}
      <div className="absolute inset-0 z-10 pointer-events-none px-4 pt-4 flex flex-col justify-between">
        <div className="pointer-events-none absolute inset-0 z-[-1] cyber-grid opacity-70"></div>
        
        {/* GÓRNY HUD (Left & Right) */}
        <div className="flex justify-between items-start w-full">
          {/* Lewa strona */}
          <div className="flex flex-col gap-3">
            <NavbarSection
              dataCount={dataStream.length}
              isConnected={isConnected}
              onShowFeatureGraph={() => setCurrentView('feature-graph')}
            />
            <ActiveTargetsList activeDrones={activeDrones} focusedDroneId={focusedDroneId} handleLockOnTarget={handleLockOnTarget} />
          </div>

          {/* Prawa strona */}
          <div className="flex flex-col gap-3">
            <GlobeControls 
              isAutoRotate={isAutoRotate} 
              setIsAutoRotate={setIsAutoRotate} 
              focusedDroneId={focusedDroneId} 
              setFocusedDroneId={setFocusedDroneId} 
            />
          </div>
        </div>

        {/* DOLNY HUD — Statystyki */}
        <StatsSection alerts={alerts} chartData={chartData} handleLockOnTarget={handleLockOnTarget} />

      </div>
    </div>
  );
};

export default SOCDashboard;
