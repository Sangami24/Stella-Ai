import React from 'react';
import { motion } from 'framer-motion';
import { CircleGauge, Droplets, GitBranch, Radio, Wrench, Zap } from 'lucide-react';

const faultHighlight = {
  color: '#ff3b4d',
  fill: 'rgba(239, 48, 62, 0.58)',
};

const systems = [
  // The source image is cropped vertically by object-cover. These coordinates
  // are therefore anchored to the visible car, not to the empty ground plane.
  { id: 'engine', label: 'Engine', icon: Wrench, position: { left: '22%', top: '41%', width: '23%', height: '18%' } },
  { id: 'coolant', label: 'Cooling', icon: Droplets, position: { left: '15%', top: '41%', width: '18%', height: '18%' } },
  { id: 'electrical', label: 'Electrical', icon: Zap, position: { left: '9%', top: '12%', width: '82%', height: '66%' } },
  // Rear axle/underbody in this fixed front-three-quarter view.
  { id: 'transmission', label: 'Transmission', icon: GitBranch, position: { left: '74%', top: '55%', width: '16%', height: '16%' } },
  // Front wheel: the larger, visible wheel in this view.
  { id: 'brake', label: 'Braking', icon: CircleGauge, position: { left: '55%', top: '62%', width: '18%', height: '18%' } },
];

export function inferVehicleSystem(diagnosis, telemetry) {
  const text = `${diagnosis?.affectedSystem || ''} ${diagnosis?.rootCause || ''}`.toLowerCase();
  if (text.includes('cool') || text.includes('thermostat')) return 'coolant';
  if (text.includes('electrical') || text.includes('battery') || text.includes('circuit')) return 'electrical';
  if (text.includes('transmission') || text.includes('gear') || text.includes('clutch')) return 'transmission';
  if (text.includes('brak') || text.includes('abs')) return 'brake';
  if (text.includes('engine') || text.includes('powertrain') || text.includes('oil')) return 'engine';
  if (!telemetry) return null;
  if (telemetry.brakeTemp > 240 || telemetry.brakePressure < 75 || telemetry.absErrorCount > 0) return 'brake';
  if (telemetry.transmissionTemp > 100 || telemetry.gearSlip > 6 || telemetry.transmissionPressure < 55) return 'transmission';
  if (telemetry.coolantTemp > 100 || telemetry.coolantPressure < 10 || telemetry.coolantFlowRate < 5) return 'coolant';
  if (telemetry.voltage < 12 || telemetry.current > 40 || telemetry.batterySoc < 50) return 'electrical';
  if (telemetry.rpm > 1200 || telemetry.oilPressure < 25 || telemetry.vibration > 1.5) return 'engine';
  return null;
}

export default function VehicleSystemMap({ diagnosis, telemetry, vehicleProfile }) {
  const activeSystem = inferVehicleSystem(diagnosis, telemetry);
  const active = systems.find((system) => system.id === activeSystem);
  const vehicle = vehicleProfile || {
    brand: 'Stellantis', model: 'STLA Medium demo vehicle', vin: 'STELLA2400AI', modelYear: '2026', curbWeightKg: 'Not configured',
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700/70 bg-[#080e19] shadow-xl shadow-slate-950/30">
      <div className="flex items-start justify-between p-5 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Vehicle overview</p>
          <h3 className="mt-1 text-base font-semibold text-white">Live system topology</h3>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${active ? 'border-red-400/35 bg-red-500/10 text-red-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
          {active ? `${active.label} anomaly` : 'Telemetry nominal'}
        </div>
      </div>

      <div className="relative mx-4 overflow-hidden rounded-xl border border-slate-800 bg-[#050b14]">
        <img src="/assets/stella-vehicle-overview-wordmark-lower.png" alt="Dark metallic Stellantis vehicle viewed from the front" className="aspect-[16/10] w-full object-cover object-center" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,0.26),transparent_38%,rgba(3,7,18,0.08)),linear-gradient(0deg,rgba(3,7,18,0.42),transparent_34%)]" />
        {active && <FaultOverlay system={active} />}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg border border-slate-500/20 bg-slate-950/65 px-3 py-2 backdrop-blur-sm">
          <span className="text-[10px] uppercase tracking-[0.15em] text-slate-400">Live TCU correlation</span>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: active ? faultHighlight.color : '#6ee7b7' }}><Radio className="h-3 w-3 animate-pulse" />{active ? `${active.label} signal cluster` : 'All systems tracked'}</span>
        </div>
      </div>

      <div className="mx-4 mt-3 grid grid-cols-2 divide-x divide-y divide-slate-700/60 overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/35 text-center sm:grid-cols-4 sm:divide-y-0">
        <VehicleMeta label="Brand" value={vehicle.brand} />
        <VehicleMeta label="Model" value={vehicle.model} />
        <VehicleMeta label="VIN" value={vehicle.vin} />
        <VehicleMeta label="Curb weight" value={vehicle.curbWeightKg === 'Not configured' ? 'Configure profile' : `${vehicle.curbWeightKg} kg`} />
      </div>

      <div className="m-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {systems.map((system) => {
          const Icon = system.icon;
          const selected = system.id === activeSystem;
          return <div key={system.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${selected ? 'border-current bg-white/5' : 'border-slate-700/70 bg-slate-950/25'}`} style={selected ? { color: faultHighlight.color, boxShadow: `inset 0 0 18px ${faultHighlight.fill}` } : undefined}>
            <Icon className="h-3.5 w-3.5" style={{ color: selected ? faultHighlight.color : '#94a3b8' }} />
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${selected ? '' : 'text-slate-300'}`}>{system.label}</span>
            <span className={`ml-auto h-1.5 w-1.5 rounded-full ${selected ? 'animate-pulse' : 'bg-emerald-400'}`} style={selected ? { backgroundColor: faultHighlight.color } : undefined} />
          </div>;
        })}
      </div>
      <p className="mx-5 mb-4 flex items-center gap-1.5 text-[10px] text-slate-500"><Radio className="h-3 w-3 text-blue-300" /> Fault focus is inferred from the live TCU stream—not from the selected demo control.</p>
    </section>
  );
}

function FaultOverlay({ system }) {
  return <motion.div
    className="pointer-events-none absolute flex items-center justify-center"
    style={system.position}
    initial={{ opacity: 0, scale: 0.82 }}
    animate={{ opacity: [0.38, 1, 0.38], scale: [0.93, 1.07, 0.93] }}
    transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
  >
    <ComponentGraphic system={system.id} />
  </motion.div>;
}

function ComponentGraphic({ system }) {
  const common = {
    fill: 'rgba(255, 59, 77, 0.32)',
    stroke: faultHighlight.color,
    strokeWidth: 2.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  const glow = { filter: `drop-shadow(0 0 12px ${faultHighlight.color})` };

  if (system === 'engine') return <svg viewBox="0 0 100 70" className="h-full w-full max-h-20 max-w-28" style={glow} aria-label="Engine fault highlighted"><path {...common} d="M20 26h11l8-11h22l8 11h11v29H20z" /><path {...common} d="M31 26v-8h12m15 0h11v8M12 34h8m60 0h8M36 39h28v10H36z" /></svg>;
  if (system === 'coolant') return <svg viewBox="0 0 100 70" className="h-full w-full max-h-20 max-w-24" style={glow} aria-label="Cooling system fault highlighted"><path {...common} d="M28 14h44v42H28zM38 14v-7h24v7M38 28c4 5 8 5 12 0s8-5 12 0m-24 13c4 5 8 5 12 0s8-5 12 0" /><path {...common} d="M19 24h9m44 0h9M19 47h9m44 0h9" /></svg>;
  if (system === 'electrical') return <svg viewBox="0 0 1000 620" className="h-full w-full" style={glow} aria-label="Electrical wiring fault highlighted">
    <g fill="none" stroke={faultHighlight.color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M110 400H250l80-58h128l62-58h156l80 48h120" />
      <path d="M210 318h112l72-54h126l62-48h144l86 55" />
      <path d="M372 454l86-48h156l92 30 110-72" />
      <path d="M458 342v64m62-122v58m96-58v76m92-76v48" opacity="0.8" />
    </g>
    <g fill={faultHighlight.color}>
      <circle cx="110" cy="400" r="12" /><circle cx="250" cy="400" r="10" /><circle cx="458" cy="342" r="11" /><circle cx="676" cy="284" r="11" /><circle cx="876" cy="332" r="12" />
    </g>
    <rect x="485" y="314" width="64" height="54" rx="8" fill="rgba(255,59,77,0.28)" stroke={faultHighlight.color} strokeWidth="7" />
    <path d="M510 325v32m14-32v32m-28-17h42" stroke={faultHighlight.color} strokeWidth="6" strokeLinecap="round" />
  </svg>;
  if (system === 'transmission') return <svg viewBox="0 0 100 70" className="h-full w-full max-h-20 max-w-28" style={glow} aria-label="Transmission fault highlighted"><path {...common} d="M19 30h18l9-13h20l9 13h6v20h-6L66 63H46L37 50H19z" /><circle {...common} cx="56" cy="40" r="11" /><path {...common} d="M56 31v18m-9-9h18" /></svg>;
  return <svg viewBox="0 0 100 70" className="h-full w-full max-h-24 max-w-24" style={glow} aria-label="Brake system fault highlighted"><circle {...common} cx="50" cy="35" r="22" /><circle {...common} cx="50" cy="35" r="7" /><path {...common} d="M74 20h11v30H74zM45 14v6m10-6v6m-10 30v6m10-6v6" /></svg>;
}

function VehicleMeta({ label, value }) {
  return <div className="px-2 py-3"><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div><div className="mt-1 font-mono text-xs font-semibold text-slate-100">{value}</div></div>;
}
