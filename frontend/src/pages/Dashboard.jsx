import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Zap, Thermometer, Car,
  Play, RotateCcw, Flame, Battery, Droplets
} from 'lucide-react';
import useStore from '../store/useStore';
import Gauge from '../components/Gauge';

const faultTypes = [
  {
    id: 'engine',
    label: 'Engine Fault',
    icon: Flame,
    description: 'RPM & Oil Pressure Anomaly',
    color: 'from-red-600 to-orange-600',
    borderColor: 'border-red-500/30',
    hoverBg: 'hover:bg-red-500/10',
  },
  {
    id: 'electrical',
    label: 'Electrical Short',
    icon: Zap,
    description: 'Voltage & Current Irregularity',
    color: 'from-yellow-500 to-amber-600',
    borderColor: 'border-yellow-500/30',
    hoverBg: 'hover:bg-yellow-500/10',
  },
  {
    id: 'coolant',
    label: 'Coolant Breakdown',
    icon: Droplets,
    description: 'Temperature & Flow Failure',
    color: 'from-cyan-500 to-blue-600',
    borderColor: 'border-cyan-500/30',
    hoverBg: 'hover:bg-cyan-500/10',
  },
];

export default function Dashboard() {
  const telemetry = useStore((s) => s.telemetry);
  const incident = useStore((s) => s.incident);
  const diagnosis = useStore((s) => s.diagnosis);
  const activeFault = useStore((s) => s.activeFault);
  const simulateFault = async (type) => {
    await useStore.getState().simulateFault(type);
  };
  const startDemo = useStore((s) => s.startDemo);
  const resetDemo = useStore((s) => s.resetDemo);
  const isDemoRunning = useStore((s) => s.isDemoRunning);
  const isSimulating = useStore((s) => s.isSimulating);
  const recoveryProgress = useStore((s) => s.recoveryProgress);

  // Default/baseline telemetry
  const t = telemetry || {
    rpm: 800, oilPressure: 40, engineTemp: 90,
    voltage: 14.2, current: 25, batterySoc: 95,
    coolantTemp: 88, coolantPressure: 15, coolantFlowRate: 8.5,
    speed: 60, vibration: 0.3, throttle: 30,
  };

  return (
    <div className="space-y-6">
      {/* ── Instrument Cluster ────────────────────────── */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Car className="w-5 h-5 text-dash-accent" />
          <h2 className="font-display text-sm tracking-wider text-dash-text font-semibold">
            VEHICLE INSTRUMENT CLUSTER
          </h2>
          {activeFault && incident?.status !== 'resolving' && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="ml-auto px-3 py-1 text-xs font-semibold rounded-full bg-dash-danger/20 text-dash-danger border border-dash-danger/30"
            >
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              FAULT ACTIVE: {activeFault.toUpperCase()}
            </motion.span>
          )}
          {incident?.status === 'resolving' && recoveryProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-auto flex flex-col gap-1 min-w-[200px]"
            >
              <div className="flex justify-between text-xs text-green-400 font-semibold tracking-wider">
                <span>{recoveryProgress.step}</span>
                <span>{recoveryProgress.progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-dash-bg rounded-full overflow-hidden border border-dash-border">
                <div 
                  className="h-full bg-green-500 transition-all duration-500 ease-out" 
                  style={{ width: `${recoveryProgress.progress}%` }} 
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Gauges Grid */}
        <div className="flex flex-wrap justify-center items-end gap-4 lg:gap-6">
          {/* Speedometer - larger */}
          <Gauge
            value={t.speed}
            min={0}
            max={240}
            label="Speed"
            unit="km/h"
            warningThreshold={75}
            dangerThreshold={90}
            size={180}
          />

          {/* RPM */}
          <Gauge
            value={t.rpm}
            min={0}
            max={8000}
            label="RPM"
            unit="rev/min"
            warningThreshold={60}
            dangerThreshold={80}
            size={160}
          />

          {/* Coolant Temp */}
          <Gauge
            value={t.coolantTemp}
            min={40}
            max={140}
            label="Coolant Temp"
            unit="°C"
            warningThreshold={70}
            dangerThreshold={85}
            size={160}
          />

          {/* Battery Voltage */}
          <Gauge
            value={t.voltage}
            min={8}
            max={16}
            label="Voltage"
            unit="V"
            warningThreshold={30}
            dangerThreshold={15}
            reverse={true}
            size={160}
          />

          {/* Oil Pressure */}
          <Gauge
            value={t.oilPressure}
            min={0}
            max={80}
            label="Oil Pressure"
            unit="psi"
            warningThreshold={30}
            dangerThreshold={15}
            reverse={true}
            size={150}
          />

          {/* Engine Temp */}
          <Gauge
            value={t.engineTemp}
            min={50}
            max={150}
            label="Engine Temp"
            unit="°C"
            warningThreshold={70}
            dangerThreshold={85}
            size={150}
          />
        </div>

        {/* Secondary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-dash-border/50">
          <MetricPill label="Battery SOC" value={`${Math.round(t.batterySoc)}%`} warn={t.batterySoc < 50} danger={t.batterySoc < 30} />
          <MetricPill label="Current" value={`${t.current}A`} warn={t.current > 40} danger={t.current > 60} />
          <MetricPill label="Vibration" value={`${t.vibration}g`} warn={t.vibration > 1.5} danger={t.vibration > 3} />
          <MetricPill label="Coolant Flow" value={`${t.coolantFlowRate} L/m`} warn={t.coolantFlowRate < 5} danger={t.coolantFlowRate < 3} />
        </div>
      </div>

      {/* ── Diagnosis Card (shows when available) ─────── */}
      {diagnosis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 border-l-4 border-dash-accent"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-display text-sm tracking-wider text-dash-accent font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4" />
                AI DIAGNOSIS
              </h3>
              <p className="text-lg font-semibold text-white mt-1">{diagnosis.rootCause}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold text-dash-accent">
                {diagnosis.confidence}%
              </div>
              <div className="text-xs text-dash-muted">CONFIDENCE</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-dash-bg/50 rounded-lg p-3">
              <div className="text-xs text-dash-muted mb-1">Affected System</div>
              <div className="text-sm font-semibold text-dash-text">{diagnosis.affectedSystem}</div>
            </div>
            <div className="bg-dash-bg/50 rounded-lg p-3">
              <div className="text-xs text-dash-muted mb-1">Severity</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`w-5 h-2 rounded-full ${
                      i <= diagnosis.severity ? 'bg-dash-danger' : 'bg-dash-border'
                    }`}
                  />
                ))}
                <span className="text-sm font-semibold text-dash-text ml-2">{diagnosis.severity}/5</span>
              </div>
            </div>
            <div className="bg-dash-bg/50 rounded-lg p-3">
              <div className="text-xs text-dash-muted mb-1">Auto-Fixable</div>
              <div className={`text-sm font-semibold ${diagnosis.isAutoFixable ? 'text-dash-success' : 'text-dash-danger'}`}>
                {diagnosis.isAutoFixable ? '✓ Yes — Remote Fix Possible' : '✗ No — Physical Inspection Needed'}
              </div>
            </div>
          </div>

          <div className="mt-4 bg-dash-bg/50 rounded-lg p-3">
            <div className="text-xs text-dash-muted mb-1">AI Reasoning</div>
            <p className="text-sm text-dash-text leading-relaxed">{diagnosis.reasoning}</p>
          </div>
        </motion.div>
      )}

      {/* ── Fault Trigger Buttons ─────────────────────── */}
      <div className="glass-card p-6">
        <h3 className="font-display text-sm tracking-wider text-dash-muted font-semibold mb-4">
          FAULT SIMULATION
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {faultTypes.map((fault) => {
            const Icon = fault.icon;
            const isActive = activeFault === fault.id;
            return (
              <motion.button
                key={fault.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => simulateFault(fault.id)}
                disabled={isSimulating || isDemoRunning}
                className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all
                  ${isActive
                    ? `${fault.borderColor} fault-active bg-gradient-to-r ${fault.color} bg-opacity-10`
                    : `border-dash-border ${fault.hoverBg}`
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${fault.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-dash-text">{fault.label}</div>
                  <div className="text-xs text-dash-muted">{fault.description}</div>
                </div>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-2 h-2 rounded-full bg-dash-danger animate-pulse"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Demo Controls ─────────────────────────────── */}
      <div className="glass-card p-6">
        <h3 className="font-display text-sm tracking-wider text-dash-muted font-semibold mb-4">
          DEMO CONTROLS
        </h3>
        <div className="flex flex-wrap gap-4">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startDemo}
            disabled={isDemoRunning || isSimulating}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-dash-accent to-blue-600
              text-white font-semibold text-sm shadow-lg shadow-blue-500/20
              hover:shadow-blue-500/40 transition-shadow
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Test Demo
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={resetDemo}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-dash-border
              text-dash-text font-semibold text-sm
              hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Demo
          </motion.button>

          {incident?.status && (
            <div className="flex items-center gap-2 ml-auto px-4 py-2 rounded-lg bg-dash-bg/50 text-xs text-dash-muted">
              Status: <span className="text-dash-text font-semibold">{incident.status.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricPill({ label, value, warn, danger }) {
  const color = danger ? 'text-dash-danger' : warn ? 'text-dash-warning' : 'text-dash-success';
  return (
    <div className="flex items-center justify-between bg-dash-bg/50 rounded-lg px-3 py-2">
      <span className="text-xs text-dash-muted">{label}</span>
      <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
    </div>
  );
}
