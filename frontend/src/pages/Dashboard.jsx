import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, Battery, Car, CircleGauge, Droplets, Flame,
  Gauge as GaugeIcon, GitBranch, Play, Radio, RotateCcw, Thermometer, Zap,
} from 'lucide-react';
import useStore from '../store/useStore';
import Gauge from '../components/Gauge';
import VehicleSystemMap, { inferVehicleSystem } from '../components/VehicleSystemMap';

const faultTypes = [
  { id: 'engine', label: 'Engine fault', icon: Flame, description: 'Oil pressure, RPM and vibration pattern', tone: 'from-red-500 to-orange-500', active: 'border-red-400/60 bg-red-500/10', iconTone: 'bg-red-500/15 text-red-300' },
  { id: 'coolant', label: 'Cooling fault', icon: Droplets, description: 'Coolant temperature, pressure and flow', tone: 'from-cyan-500 to-blue-500', active: 'border-cyan-400/60 bg-cyan-500/10', iconTone: 'bg-cyan-500/15 text-cyan-300' },
  { id: 'electrical', label: 'Electrical fault', icon: Zap, description: 'Voltage, current draw and battery SOC', tone: 'from-amber-400 to-orange-500', active: 'border-amber-400/60 bg-amber-500/10', iconTone: 'bg-amber-500/15 text-amber-300' },
  { id: 'transmission', label: 'Transmission fault', icon: GitBranch, description: 'Gear slip, pressure and temperature', tone: 'from-violet-500 to-purple-500', active: 'border-violet-400/60 bg-violet-500/10', iconTone: 'bg-violet-500/15 text-violet-300' },
  { id: 'brake', label: 'Brake system fault', icon: CircleGauge, description: 'Brake temperature, pressure and ABS events', tone: 'from-rose-500 to-red-500', active: 'border-rose-400/60 bg-rose-500/10', iconTone: 'bg-rose-500/15 text-rose-300' },
];

const defaultTelemetry = {
  rpm: 800, oilPressure: 40, engineTemp: 90, voltage: 14.2, current: 25,
  batterySoc: 95, coolantTemp: 88, coolantPressure: 15, coolantFlowRate: 8.5,
  speed: 60, vibration: 0.3, throttle: 30, tirePressure: 32, brakeTemp: 150,
  brakePressure: 110, absErrorCount: 0, fuelPressure: 45, transmissionTemp: 85,
  transmissionPressure: 72, gearSlip: 0, canErrorCount: 0,
};

export default function Dashboard() {
  const telemetry = useStore((state) => state.telemetry);
  const incident = useStore((state) => state.incident);
  const diagnosis = useStore((state) => state.diagnosis);
  const vehicleProfile = useStore((state) => state.vehicleProfile);
  const activeFault = useStore((state) => state.activeFault);
  const isDemoRunning = useStore((state) => state.isDemoRunning);
  const isSimulating = useStore((state) => state.isSimulating);
  const demoError = useStore((state) => state.demoError);
  const recoveryProgress = useStore((state) => state.recoveryProgress);
  const t = { ...defaultTelemetry, ...(telemetry || {}) };
  const inferredSystem = inferVehicleSystem(diagnosis, telemetry);
  const isFaultActive = Boolean(inferredSystem && incident?.status !== 'resolved');

  const startFault = async (type) => useStore.getState().simulateFault(type);
  const startDemo = () => useStore.getState().startDemo();
  const resetDemo = () => useStore.getState().resetDemo();

  return (
    <div className="space-y-6 pb-4">
      <section className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0e1728] p-5 shadow-2xl shadow-slate-950/30 sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-400/25 bg-blue-500/10 p-2.5"><Car className="h-5 w-5 text-blue-300" /></div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Connected vehicle</p>
              <h2 className="mt-0.5 font-display text-base font-semibold tracking-wide text-white">Vehicle instrument cluster</h2>
            </div>
          </div>
          {incident?.status === 'resolving' && recoveryProgress ? (
            <div className="min-w-[220px] rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-2.5">
              <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider text-emerald-200"><span>{recoveryProgress.step}</span><span>{recoveryProgress.progress}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/70"><div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${recoveryProgress.progress}%` }} /></div>
            </div>
          ) : (
            <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${isFaultActive ? 'border-red-400/35 bg-red-500/10 text-red-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
              {isFaultActive ? <AlertTriangle className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
              {isFaultActive ? 'TCU anomaly detected' : 'Live telemetry nominal'}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-1 rounded-xl border border-slate-700/50 bg-slate-950/25 px-2 py-4 sm:gap-x-5">
          <Gauge value={t.speed} min={0} max={240} label="Speed" unit="km/h" warningThreshold={75} dangerThreshold={90} size={172} />
          <Gauge value={t.rpm} min={0} max={8000} label="Engine RPM" unit="rev/min" warningThreshold={60} dangerThreshold={80} size={156} />
          <Gauge value={t.coolantTemp} min={40} max={140} label="Coolant temp" unit="°C" warningThreshold={70} dangerThreshold={85} size={156} />
          <Gauge value={t.voltage} min={8} max={16} label="Voltage" unit="V" warningThreshold={30} dangerThreshold={15} reverse size={156} />
          <Gauge value={t.oilPressure} min={0} max={80} label="Oil pressure" unit="psi" warningThreshold={30} dangerThreshold={15} reverse size={156} />
          <Gauge value={t.engineTemp} min={50} max={150} label="Engine temp" unit="°C" warningThreshold={70} dangerThreshold={85} size={156} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-700/60 pt-4 sm:grid-cols-4">
          <QuickMetric label="Battery SOC" value={`${Math.round(t.batterySoc)}%`} state={t.batterySoc < 30 ? 'danger' : t.batterySoc < 50 ? 'warn' : 'normal'} />
          <QuickMetric label="Current draw" value={`${formatNumber(t.current)} A`} state={t.current > 60 ? 'danger' : t.current > 40 ? 'warn' : 'normal'} />
          <QuickMetric label="Vibration" value={`${formatNumber(t.vibration)} g`} state={t.vibration > 3 ? 'danger' : t.vibration > 1.5 ? 'warn' : 'normal'} />
          <QuickMetric label="Coolant flow" value={`${formatNumber(t.coolantFlowRate)} L/min`} state={t.coolantFlowRate < 3 ? 'danger' : t.coolantFlowRate < 5 ? 'warn' : 'normal'} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <VehicleSystemMap diagnosis={diagnosis} telemetry={telemetry} vehicleProfile={vehicleProfile} />
        <LiveSignals telemetry={t} activeSystem={inferredSystem} />
      </div>

      {diagnosis && <DiagnosisSummary diagnosis={diagnosis} />}

      <section className="rounded-2xl border border-slate-700/80 bg-[#101828] p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Scenario controls</p>
            <h3 className="mt-1 text-base font-semibold text-white">Inject telemetry patterns</h3>
            <p className="mt-1 text-xs text-slate-400">Controls change sensor values only. Stella AI receives the TCU stream and identifies the fault independently.</p>
          </div>
          {activeFault && <span className="rounded-full border border-slate-600 bg-slate-950/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">Input profile running</span>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {faultTypes.map((fault) => {
            const Icon = fault.icon;
            const selected = activeFault === fault.id;
            return <motion.button key={fault.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => startFault(fault.id)} disabled={isSimulating || isDemoRunning} className={`group rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? `${fault.active} fault-active` : 'border-slate-700 bg-slate-950/25 hover:border-slate-500 hover:bg-slate-900/70'}`}>
              <div className="flex items-start gap-3"><div className={`rounded-lg p-2 ${fault.iconTone}`}><Icon className="h-4 w-4" /></div><div><div className="text-sm font-semibold text-slate-100">{fault.label}</div><div className="mt-1 text-[11px] leading-relaxed text-slate-400">{fault.description}</div></div></div>
            </motion.button>;
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-700/70 pt-4">
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startDemo} disabled={isDemoRunning || isSimulating} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 transition hover:from-blue-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"><Play className="h-4 w-4" />Run randomized demo</motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={resetDemo} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"><RotateCcw className="h-4 w-4" />Reset session</motion.button>
          {incident?.status && <span className="ml-auto text-xs text-slate-400">Incident state: <strong className="ml-1 font-medium uppercase tracking-wide text-slate-200">{incident.status.replace('_', ' ')}</strong></span>}
        </div>
        {demoError && <div role="alert" className="mt-3 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">{demoError} Check that the backend is running, then try again.</div>}
      </section>
    </div>
  );
}

function DiagnosisSummary({ diagnosis }) {
  return <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-blue-400/25 bg-gradient-to-r from-blue-500/[0.10] via-[#101828] to-[#101828] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300"><Zap className="h-3.5 w-3.5" />Stella AI assessment</p><h3 className="mt-2 text-lg font-semibold text-white">{diagnosis.rootCause}</h3><p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-300">{diagnosis.engineerExplanation}</p></div><div className="grid grid-cols-2 gap-2"><Score label="Confidence" value={`${diagnosis.confidence ?? diagnosis.contextualConfidence ?? '--'}%`} tone="text-cyan-300" /><Score label="Severity" value={`${diagnosis.severity ?? '--'}/5`} tone="text-red-300" /></div></div>
    <div className="mt-4 grid gap-3 border-t border-slate-700/70 pt-4 md:grid-cols-3"><Info label="Affected system" value={diagnosis.affectedSystem} /><Info label="TCU evidence" value={diagnosis.affectedParameters?.join(' · ') || 'Live parameter correlation'} /><Info label="Recommended response" value={diagnosis.recommendedAction} /></div>
  </motion.section>;
}

function LiveSignals({ telemetry, activeSystem }) {
  const signals = [
    ['Throttle', telemetry.throttle, '%'], ['Tire pressure', telemetry.tirePressure, 'psi'], ['Fuel pressure', telemetry.fuelPressure, 'psi'], ['CAN errors', telemetry.canErrorCount, ''], ['Transmission temp', telemetry.transmissionTemp, '°C'], ['Transmission pressure', telemetry.transmissionPressure, 'psi'], ['Gear slip', telemetry.gearSlip, '%'], ['Brake temp', telemetry.brakeTemp, '°C'], ['Brake pressure', telemetry.brakePressure, 'bar'], ['ABS events', telemetry.absErrorCount, ''],
  ];
  return <section className="rounded-2xl border border-slate-700/70 bg-[#101828] p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">TCU signal inventory</p><h3 className="mt-1 text-base font-semibold text-white">Every live reading</h3></div><Radio className="h-4 w-4 text-blue-300 animate-pulse" /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">{signals.map(([label, value, unit]) => <div key={label} className="rounded-lg border border-slate-700/70 bg-slate-950/35 px-3 py-2.5"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 font-mono text-sm font-semibold text-slate-100">{formatNumber(value)} <span className="text-[10px] text-slate-500">{unit}</span></div></div>)}</div><div className="mt-4 rounded-lg border border-slate-700/70 bg-slate-950/25 px-3 py-2.5 text-xs text-slate-400">{activeSystem ? <>Cross-correlating the highlighted <strong className="capitalize text-slate-200">{activeSystem}</strong> system against the packet stream.</> : 'Monitoring cross-system trends for deviations.'}</div></section>;
}

function QuickMetric({ label, value, state }) { const tone = state === 'danger' ? 'text-red-300' : state === 'warn' ? 'text-amber-300' : 'text-emerald-300'; return <div className="rounded-lg border border-slate-700/60 bg-slate-950/35 px-3 py-2.5"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className={`mt-1 font-mono text-sm font-semibold ${tone}`}>{value}</div></div>; }
function Score({ label, value, tone }) { return <div className="rounded-xl border border-slate-700 bg-slate-950/45 px-3 py-2 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className={`mt-1 font-mono text-base font-bold ${tone}`}>{value}</div></div>; }
function Info({ label, value }) { return <div className="rounded-lg bg-slate-950/35 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 text-xs leading-relaxed text-slate-200">{value || '--'}</div></div>; }
function formatNumber(value) { if (typeof value !== 'number') return '--'; return Number.isInteger(value) ? value.toString() : value.toFixed(1); }
