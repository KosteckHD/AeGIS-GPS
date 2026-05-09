import React, { useState, useEffect, useRef, useMemo } from 'react';
import Globe from 'react-globe.gl';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import { AlertTriangle, Crosshair, RefreshCw, Activity, ShieldAlert, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

// --- NARZĘDZIA POMOCNICZE ---
const getThreatColor = (prob) => {
  const safeProb = Math.max(0, Math.min(1, prob || 0));
  const r = safeProb < 0.5 ? Math.floor(safeProb * 2 * 255) : 255;
  const g = safeProb > 0.5 ? Math.floor((1 - safeProb) * 2 * 255) : 255;
  return `rgb(${r},${g},0)`;
};

// Wspólny styl dla RechartsTooltip
const tooltipStyle = {
  backgroundColor: '#080808',
  borderColor: '#1f2937',
  color: '#10b981',
  fontSize: '10px',
  borderRadius: '2px',
  boxShadow: '0 0 10px rgba(16,185,129,0.15)'
};

const labelStyle = { color: '#6b7280', fontSize: '10px' };

// ==========================================
// SEKCJA 1: NAVBAR
// ==========================================
const NavbarSection = ({ dataCount, isConnected }) => (
  <div className="pointer-events-auto bg-black/70 border border-green-500/30 backdrop-blur-md p-4 rounded-sm shadow-[0_0_20px_rgba(16,185,129,0.12)] flex flex-col gap-2 min-w-[300px]">
    <div className="flex items-center gap-3 border-b border-green-900/40 pb-2">
      <ShieldCheck size={24} className="text-green-400" />
      <div>
        <h1 className="text-xl font-bold tracking-widest text-green-400 leading-tight">AEGIS GPS</h1>
        <div className="text-[10px] text-green-600 tracking-[0.2em]">ADVANCED DRONE SPOOFING DETECTION</div>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 mt-1">
      <div className="flex flex-col text-[11px]">
        <span className="text-gray-500 text-[10px]">SYSTEM STATUS</span>
        <span className="text-green-400 font-bold flex items-center gap-1">
          <Activity size={10}/> SECURE
        </span>
      </div>
      <div className="flex flex-col text-[11px]">
        <span className="text-gray-500 text-[10px]">MEMORY ALLOC</span>
        <span className="text-green-400 font-bold">{dataCount} PTS</span>
      </div>
      {/* NOWE: wskaźnik połączenia SSE */}
      <div className="flex flex-col text-[11px]">
        <span className="text-gray-500 text-[10px]">DATA FEED</span>
        <span className={`font-bold flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-red-500'}`}>
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
const GlobeBackground = ({ globeRef, globeData, alerts, focusedDroneId, isAutoRotate }) => (
  <div className="absolute inset-0 z-0 opacity-80">
    <Globe
      ref={globeRef}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      backgroundColor="rgba(0,0,0,0)"
      atmosphereColor="#10b981"
      atmosphereAltitude={0.15}
      pathsData={globeData.paths}
      pathPoints="points"
      pathColor="color"
      pathResolution={30}
      pathWidth={1.5}
      ringsData={alerts}
      ringColor={() => t => `rgba(255, 0, 0, ${1 - t})`}
      ringMaxRadius={2.5}
      ringPropagationSpeed={1.5}
      ringRepeatPeriod={0}
      htmlElementsData={globeData.htmlElements}
      htmlLat="lat"
      htmlLng="lng"
      htmlElement={(d) => {
        const el = document.createElement('div');
        const isDanger = d.probability > 0.5;
        const isFocused = d.mId === focusedDroneId;
        const pulseClass = 'animate-[pulse_1s_ease-in-out_infinite]';
        const outerPing = isDanger ? `<div class="absolute w-8 h-8 rounded-full border border-red-500/80 animate-ping"></div>` : '';
        const zIndexVal = isFocused ? 999 : (isDanger ? 10 : 1);

        el.innerHTML = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: ${zIndexVal};">
            ${outerPing}
            <div class="${pulseClass}" style="position: relative; width: ${isFocused ? '16px' : '12px'}; height: ${isFocused ? '16px' : '12px'}; border-radius: 50%; background-color: ${d.color}; box-shadow: 0 0 15px ${d.color}; border: ${isFocused ? '2px solid white' : '1px solid white'};"></div>
            <div class="absolute -top-6 text-[10px] whitespace-nowrap px-1 border font-bold ${isFocused ? 'bg-white text-black border-white z-50' : 'bg-black/80 border-gray-700'}" style="${!isFocused ? `color: ${d.color};` : ''}">
              ID:${d.mId} [${(d.probability * 100).toFixed(0)}%]
            </div>
          </div>
        `;
        return el;
      }}
      autoRotate={isAutoRotate}
      autoRotateSpeed={0.5}
    />
  </div>
);

const ActiveTargetsList = ({ activeDrones, focusedDroneId, handleLockOnTarget }) => (
  <div className="pointer-events-auto bg-black/70 border border-green-500/30 backdrop-blur-md p-3 rounded-sm shadow-[0_0_15px_rgba(16,185,129,0.12)] flex flex-col gap-2 w-[300px] max-h-[350px] overflow-hidden">
    <div className="flex justify-between items-center border-b border-gray-800 pb-1">
      <h3 className="text-[11px] font-bold text-gray-400 tracking-widest">ACTIVE TARGETS / FLEET</h3>
      <span className="text-[10px] bg-gray-800 px-1.5 rounded text-gray-400">{activeDrones.length} ONLINE</span>
    </div>
    <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
      {activeDrones.length === 0 ? (
        <span className="text-[11px] text-gray-400 tracking-widest uppercase py-2 text-center">Awaiting Connection...</span>
      ) : (
        activeDrones.map(drone => {
          const isDanger = drone.probability > 0.5;
          return (
            <div 
              key={drone.mId}
              onClick={() => handleLockOnTarget(drone.mId)}
              className={`flex justify-between items-center p-1.5 cursor-crosshair border-l-2 transition-all ${focusedDroneId === drone.mId ? 'bg-gray-800/80 border-white' : 'hover:bg-gray-900/50'} ${isDanger ? 'border-red-500' : 'border-green-500'}`}
            >
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-gray-300">ID: {drone.mId}</span>
                <span className="text-[10px] text-gray-500">LAT: {drone.lat?.toFixed(3)} | LNG: {drone.lng?.toFixed(3)}</span>
              </div>
              <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDanger ? 'bg-red-900/30 text-red-500 animate-[pulse_1s_ease-in-out_infinite]' : 'bg-green-900/30 text-green-500'}`}>
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
  <div className="pointer-events-auto flex flex-col gap-2 bg-black/60 p-2 border border-green-900/40 rounded-sm backdrop-blur-sm">
    <button 
      onClick={() => setIsAutoRotate(!isAutoRotate)}
      className={`p-2 rounded-sm border transition-all flex items-center gap-2 text-xs ${isAutoRotate ? 'bg-green-900/40 border-green-500 text-green-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-gray-900/50 border-gray-700 text-gray-500 hover:border-gray-600'}`}
    >
      <RefreshCw size={14} className={isAutoRotate ? "animate-spin-slow" : ""} /> [ROTOR]
    </button>
    <button 
      onClick={() => setFocusedDroneId(null)}
      className={`p-2 rounded-sm border transition-all flex items-center gap-2 text-xs ${focusedDroneId ? 'bg-green-900/40 border-green-500 text-green-400' : 'bg-gray-900/50 border-gray-700 text-gray-500 hover:border-gray-600'}`}
    >
      <Crosshair size={14} /> [UNLOCK]
    </button>
  </div>
);

// ==========================================
// SEKCJA 3: STATYSTYKI (ZOPTYMALIZOWANA)
// ==========================================
const StatsSection = ({ alerts, chartData, handleLockOnTarget }) => (
  <div className="w-full flex justify-center pointer-events-none pb-6 relative z-20">
    <div className="w-full max-w-[1400px] flex flex-col gap-3 pointer-events-auto h-[320px]">
      
      {/* HORIZONTAL ALERTS BAR */}
      <div className="w-full bg-black/80 border border-green-500/30 backdrop-blur-md p-3 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.8)] h-[90px] shrink-0">
        <div className="flex justify-between items-center  px-100px">
          <h3 className="text-xs font-bold text-red-500 tracking-[0.2em] flex items-center gap-2 p-3">
            <ShieldAlert size={14} /> RECENT COMPROMISED SIGNATURES
          </h3>
          <div className="text-[11px] w-240px text-gray-400 font-bold bg-gray-900/50 px-2 py-0.5 rounded border border-gray-800">
            LATEST THREATS: <span className="text-red-500">{alerts.length}/5</span>
          </div>
        </div>
        
        <div className="flex-1 w-full px-2">
          {alerts.length === 0 ? (
            <div className="flex justify-center items-center w-full h-full gap-2 border border-dashed border-green-900/30 bg-green-900/5 rounded-sm uppercase tracking-widest text-[11px] text-green-600">
              <ShieldCheck size={16} /> Awaiting Threat Signatures...
            </div>
          ) : (
            <div className={`grid gap-3 h-full ${alerts.length < 5 ? 'grid-cols-' + alerts.length : 'grid-cols-5'}`}>
              {alerts.map(alert => (
                <div 
                  key={alert.id}
                  onClick={() => handleLockOnTarget(alert.mId)}
                  className="h-full bg-[#0a0a0a] border border-red-500/30 p-2 rounded-sm flex flex-col justify-between hover:bg-[#111111] hover:border-red-500/60 transition-all relative group cursor-crosshair box-border"
                >
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-red-500/80 animate-[pulse_1s_ease-in-out_infinite]"></div>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col min-w-0">
                      <div className="text-[10px] text-gray-400 tracking-widest truncate">ID: {alert.mId}</div>
                      <div className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0"></span> 
                        <span className="truncate">SPOOF {(alert.probability * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="text-[9px] text-gray-400 bg-[#161616] px-1 py-0.5 border border-gray-800 font-mono shrink-0 ml-1">
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
      <div className="grid grid-cols-10 gap-3 flex-1 w-full bg-black/80 border border-green-500/30 backdrop-blur-md p-3">
        
        {/* WYKRES 1: THREAT PROBABILITY — col-span-3 */}
        <div className="col-span-3 bg-gray-900/40 p-2 rounded-sm border border-gray-800/50 flex flex-col min-h-0">
          <h3 className="text-[11px] text-gray-300 font-bold tracking-wider mb-1 flex justify-between items-center shrink-0">
            <span>THREAT PROBABILITY</span>
            <span className="text-[10px] text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded border border-red-900/30">SPOOF LEVEL</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 1]} />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend iconType="square" wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                <Line 
                  name="Spoof Prob" 
                  type="monotone" 
                  dataKey="probability" 
                  stroke="#EF4444" 
                  strokeWidth={2} 
                  dot={false} 
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* WYKRES 2: ALTITUDE TRACKING — col-span-3 */}
        <div className="col-span-3 bg-gray-900/40 p-2 rounded-sm border border-gray-800/50 flex flex-col min-h-0">
          <h3 className="text-[11px] text-gray-300 font-bold tracking-wider mb-1 shrink-0">
            ALTITUDE TRACKING
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="#4b5563" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                {/* monotone dla płynnego lotu drona */}
                <Line 
                  name="Real Alt (GPS)" 
                  type="monotone" 
                  dataKey="alt" 
                  stroke="#3B82F6" 
                  strokeWidth={1.5} 
                  dot={false} 
                  isAnimationActive={false} 
                />
                {/* step + dashed dla sztywnego setpointu barometru */}
                <Line 
                  name="Baro Setpoint" 
                  type="step" 
                  dataKey="altSetpoint" 
                  stroke="#10B981" 
                  strokeWidth={1.5} 
                  strokeDasharray="4 3" 
                  dot={false} 
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* WYKRES 3: CONSTELLATION HEALTH — col-span-4 */}
        <div className="col-span-4 bg-gray-900/40 p-2 rounded-sm border border-gray-800/50 flex flex-col min-h-0">
          <h3 className="text-[11px] text-gray-300 font-bold tracking-wider mb-1 shrink-0">
            CONSTELLATION HEALTH
          </h3>
          <div className="flex-1 w-full min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                {/* domain z marginesem, żeby małe wahania były widoczne */}
                <YAxis yAxisId="left" stroke="#4b5563" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="#4b5563" 
                  tick={{ fontSize: 10, fill: '#ef4444' }} 
                  axisLine={false} 
                  tickLine={false} 
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                />
                <RechartsTooltip contentStyle={tooltipStyle} labelStyle={labelStyle} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                <Bar 
                  name="Sat Count" 
                  yAxisId="left" 
                  dataKey="satCount" 
                  fill="#059669" 
                  isAnimationActive={false} 
                  radius={[2, 2, 0, 0]} 
                />
                <Line 
                  name="HDOP Noise" 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="gpsHdop" 
                  stroke="#EF4444" 
                  strokeWidth={2} 
                  dot={false} 
                  isAnimationActive={false} 
                />
              </BarChart>
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
          id: latest.mId,
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
    <div className="relative w-screen h-screen bg-[#050505] text-green-500 font-mono overflow-hidden selection:bg-green-900">
      
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
