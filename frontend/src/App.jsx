import React, { useState, useEffect, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, ComposedChart, Bar, Legend
} from 'recharts';
import { Crosshair, RefreshCw, Activity, ShieldAlert, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

// --- NARZĘDZIA POMOCNICZE ---
const panelClass = "pointer-events-auto bg-slate-950/70 border border-cyan-400/15 backdrop-blur-xl rounded-lg shadow-[0_24px_70px_rgba(2,8,23,0.45)]";
const chartPanelClass = "bg-slate-950/70 p-3 rounded-lg border border-white/10 flex flex-col min-h-0 shadow-inner shadow-white/[0.02]";
const chartTitleClass = "text-[11px] text-slate-200 font-semibold tracking-wide mb-2 flex justify-between items-center shrink-0";

const getThreatColor = (prob) => {
  const safeProb = Math.max(0, Math.min(1, prob || 0));
  const r = safeProb < 0.5 ? Math.floor(safeProb * 2 * 255) : 255;
  const g = safeProb > 0.5 ? Math.floor((1 - safeProb) * 2 * 255) : 255;
  return `rgb(${r},${g},0)`;
};

// Wspólny styl dla RechartsTooltip
const tooltipStyle = {
  backgroundColor: 'rgba(15, 23, 42, 0.96)',
  border: '1px solid rgba(125, 211, 252, 0.22)',
  color: '#e2e8f0',
  fontSize: '12px',
  borderRadius: '8px',
  boxShadow: '0 20px 45px rgba(2, 8, 23, 0.35)'
};

const labelStyle = { color: '#94a3b8', fontSize: '11px', fontWeight: 600 };
const tickStyle = { fontSize: 11, fill: '#94a3b8', fontWeight: 500 };

// ==========================================
// SEKCJA 1: NAVBAR
// ==========================================
const NavbarSection = ({ dataCount, isConnected }) => (
  <div className={`${panelClass} p-4 flex flex-col gap-3 min-w-[320px]`}>
    <div className="flex items-center gap-3 border-b border-cyan-400/10 pb-3">
      <ShieldCheck size={24} className="text-cyan-300" />
      <div>
        <h1 className="text-xl font-semibold tracking-wide text-slate-50 leading-tight">AEGIS GPS</h1>
        <div className="text-[10px] text-cyan-300/80 tracking-[0.16em]">ADVANCED DRONE SPOOFING DETECTION</div>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 mt-1">
      <div className="flex flex-col text-[11px]">
        <span className="text-slate-500 text-[10px]">SYSTEM STATUS</span>
        <span className="text-emerald-300 font-semibold flex items-center gap-1">
          <Activity size={10}/> SECURE
        </span>
      </div>
      <div className="flex flex-col text-[11px]">
        <span className="text-slate-500 text-[10px]">MEMORY ALLOC</span>
        <span className="text-cyan-300 font-semibold">{dataCount} PTS</span>
      </div>
      {/* NOWE: wskaźnik połączenia SSE */}
      <div className="flex flex-col text-[11px]">
        <span className="text-slate-500 text-[10px]">DATA FEED</span>
        <span className={`font-semibold flex items-center gap-1 ${isConnected ? 'text-emerald-300' : 'text-rose-400'}`}>
          {isConnected ? <Wifi size={10}/> : <WifiOff size={10}/>}
          {isConnected ? 'LIVE' : 'NO FEED'}
        </span>
      </div>
    </div>
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
    <div className="absolute inset-0 z-0 opacity-80 cursor-pointer">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#10b981"
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
          const isDanger = d.probability > 0.5;
          const isFocused = d.mId === focusedDroneId;
          const pulseClass = 'animate-pulse';
          const zIndexVal = isFocused ? 999 : (isDanger ? 10 : 1);

          el.innerHTML = `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: ${zIndexVal};">
              <div class="${pulseClass}" style="position: relative; width: ${isFocused ? '20px' : '14px'}; height: ${isFocused ? '20px' : '14px'}; border-radius: 50%; background-color: ${d.color}; box-shadow: 0 0 20px 5px ${d.color}; border: ${isFocused ? '3px solid white' : '1px solid white'};"></div>
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
    <div className="flex justify-between items-center border-b border-white/10 pb-2">
      <h3 className="text-[11px] font-semibold text-slate-300 tracking-wide">ACTIVE TARGETS / FLEET</h3>
      <span className="text-[10px] bg-cyan-400/10 px-2 py-0.5 rounded text-cyan-200 border border-cyan-400/10">{activeDrones.length} ONLINE</span>
    </div>
    <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
      {activeDrones.length === 0 ? (
        <span className="text-[11px] text-slate-400 tracking-wide uppercase py-2 text-center">Awaiting Connection...</span>
      ) : (
        activeDrones.map(drone => {
          const isDanger = drone.probability > 0.5;
          return (
            <div 
              key={drone.mId}
              onClick={() => handleLockOnTarget(drone.mId)}
              className={`flex justify-between items-center p-2 cursor-crosshair border-l-2 rounded-md transition-all ${focusedDroneId === drone.mId ? 'bg-white/10 border-white' : 'hover:bg-white/[0.06]'} ${isDanger ? 'border-rose-400' : 'border-emerald-300'}`}
            >
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-200">ID: {drone.mId}</span>
                <span className="text-[10px] text-slate-500">LAT: {drone.lat?.toFixed(3)} | LNG: {drone.lng?.toFixed(3)}</span>
              </div>
              <div className={`text-[10px] font-semibold px-2 py-1 rounded-md ${isDanger ? 'bg-rose-500/15 text-rose-300 animate-[pulse_1s_ease-in-out]' : 'bg-emerald-400/10 text-emerald-300'}`}>
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
      className={`p-2 rounded-md border transition-all flex items-center gap-2 text-xs ${isAutoRotate ? 'bg-cyan-400/10 border-cyan-300/30 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.16)]' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'}`}
    >
      <RefreshCw size={14} className={isAutoRotate ? "animate-spin-slow" : ""} /> [ROTOR]
    </button>
    <button 
      onClick={() => setFocusedDroneId(null)}
      className={`p-2 rounded-md border transition-all flex items-center gap-2 text-xs ${focusedDroneId ? 'bg-cyan-400/10 border-cyan-300/30 text-cyan-200' : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20'}`}
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
    <div className="w-full max-w-[1400px] flex flex-col gap-3 pointer-events-auto h-[270px]">
      
      {/* HORIZONTAL ALERTS BAR */}
      <div className="w-full bg-slate-950/75 border border-white/10 backdrop-blur-xl rounded-lg flex flex-col shadow-[0_-18px_60px_rgba(2,8,23,0.5)] h-[88px] shrink-0 overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2 border-b border-white/10">
          <h3 className="text-xs font-semibold text-rose-300 tracking-wide flex items-center gap-2">
            <ShieldAlert size={14} /> RECENT COMPROMISED SIGNATURES
          </h3>
          <div className="text-[11px] text-slate-300 font-semibold bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/10">
            LATEST THREATS: <span className="text-rose-300">{alerts.length}/5</span>
          </div>
        </div>
        
        <div className="flex-1 w-full p-2 overflow-hidden">
          {alerts.length === 0 ? (
            <div className="flex justify-center items-center w-full h-full gap-2 border border-dashed border-cyan-400/15 bg-cyan-400/5 rounded-md uppercase tracking-wide text-[11px] text-cyan-300/75">
              <ShieldCheck size={16} /> Awaiting Threat Signatures...
            </div>
          ) : (
            <div className="flex gap-2 h-full overflow-hidden">
              {alerts.map(alert => (
                <div 
                  key={alert.id}
                  onClick={() => handleLockOnTarget(alert.mId)}
                  className="w-[240px] shrink-0 h-full bg-rose-950/20 border border-rose-400/20 p-2 rounded-md flex flex-col justify-between hover:bg-rose-950/35 hover:border-rose-300/40 transition-all relative group cursor-crosshair box-border overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-rose-400/80 animate-[pulse_1s_ease-in-out]"></div>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col min-w-0">
                      <div className="text-[10px] text-slate-400 tracking-wide truncate">ID: {alert.mId}</div>
                      <div className="text-[11px] font-semibold text-rose-300 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping shrink-0"></span> 
                        <span className="truncate">SPOOF {(alert.probability * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-400 bg-slate-900/80 px-1 py-0.5 border border-white/10 font-mono shrink-0 ml-1 rounded">
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
      <div className="grid h-[170px] grid-cols-10 gap-3 flex-1 w-full bg-slate-950/75 border border-white/10 backdrop-blur-xl rounded-lg p-3 shadow-[0_20px_70px_rgba(2,8,23,0.45)]">
        
        {/* WYKRES 1: THREAT PROBABILITY — col-span-3 */}
        <div className={`col-span-3 ${chartPanelClass}`}>
          <h3 className={chartTitleClass}>
            <span>THREAT PROBABILITY</span>
            <span className="text-[10px] text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-400/10">SPOOF LEVEL</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
                <defs>
                  <linearGradient id="probabilityStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fb7185" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={[0, 1]} />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '6px', color: '#cbd5e1' }} />
                <Line 
                  name="Spoof Prob" 
                  type="monotone" 
                  dataKey="probability" 
                  stroke="url(#probabilityStroke)" 
                  strokeWidth={3} 
                  dot={false}
                  activeDot={{ r: 5, fill: '#fb7185', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* WYKRES 2: ALTITUDE TRACKING — col-span-3 */}
        <div className={`col-span-3 ${chartPanelClass}`}>
          <h3 className={chartTitleClass}>
            ALTITUDE TRACKING
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis tick={tickStyle} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: '11px', paddingTop: '6px', color: '#cbd5e1' }} />
                {/* monotone dla płynnego lotu drona */}
                <Line 
                  name="Real Alt (GPS)" 
                  type="monotone" 
                  dataKey="alt" 
                  stroke="#38bdf8" 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 5, fill: '#38bdf8', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false} 
                />
                {/* step + dashed dla sztywnego setpointu barometru */}
                <Line 
                  name="Baro Setpoint" 
                  type="step" 
                  dataKey="altSetpoint" 
                  stroke="#34d399" 
                  strokeWidth={2.5} 
                  strokeDasharray="6 5" 
                  dot={false} 
                  activeDot={{ r: 5, fill: '#34d399', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false} 
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
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                {/* domain z marginesem, żeby małe wahania były widoczne */}
                <YAxis yAxisId="left" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tick={{ ...tickStyle, fill: '#fb7185' }} 
                  axisLine={false} 
                  tickLine={false} 
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px', color: '#cbd5e1' }} />
                <Bar 
                  name="Sat Count" 
                  yAxisId="left" 
                  dataKey="satCount" 
                  fill="url(#satGradient)" 
                  isAnimationActive={false} 
                  radius={[4, 4, 0, 0]} 
                />
                <Line 
                  name="HDOP Noise" 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="gpsHdop" 
                  stroke="#fb7185" 
                  strokeWidth={2.5} 
                  dot={false} 
                  activeDot={{ r: 5, fill: '#fb7185', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false} 
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
  const [dataStream, setDataStream] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const [focusedDroneId, setFocusedDroneId] = useState(null);
  // NOWE: stan połączenia SSE
  const [isConnected, setIsConnected] = useState(false);
  const globeEl = useRef();
  const updateQueueRef = useRef([]);
  const updateTimeoutRef = useRef(null);
  const MAX_POINTS_PER_DRONE = 50;

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:8000/stream');
    
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
      altSetpoint: newData["Altitude Setpoint (m)"] || null,
      gpsHdop: newData["GPS HDOP"] || 1,
      satCount: newData["Satellite Count"] || 10
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
          color: getThreatColor(latest.probability)
        });
      }
      
      htmlElements.push({
        lat: latest.lat,
        lng: latest.lng,
        mId: latest.mId,
        probability: latest.probability,
        color: getThreatColor(latest.probability)
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

  return (
    <div className="relative w-screen h-screen bg-[#020617] text-slate-200 overflow-hidden selection:bg-cyan-900/70">
      
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
        
        {/* GÓRNY HUD (Left & Right) */}
        <div className="flex justify-between items-start w-full">
          {/* Lewa strona */}
          <div className="flex flex-col gap-3">
            <NavbarSection dataCount={dataStream.length} isConnected={isConnected} />
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
