import React from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Star, Clock, Phone, Wrench,
  Navigation, CheckCircle, Car, AlertTriangle
} from 'lucide-react';
import useStore from '../store/useStore';

export default function MechanicView() {
  const mechanics = useStore((s) => s.mechanics);
  const incident = useStore((s) => s.incident);
  const diagnosis = useStore((s) => s.diagnosis);

  if (!mechanics || mechanics.length === 0) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <Wrench className="w-12 h-12 text-dash-border mb-4" />
        <h3 className="font-display text-lg text-dash-muted tracking-wider">NO MECHANIC DISPATCH</h3>
        <p className="text-sm text-dash-muted/70 mt-2 max-w-md">
          This view activates when an incident cannot be auto-resolved and requires physical mechanic dispatch.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Escalation Banner ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-l-4 border-yellow-500"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-yellow-500/10">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="font-display text-base tracking-wider text-yellow-400 font-bold">
              MECHANIC DISPATCH REQUIRED
            </h2>
            <p className="text-sm text-dash-text mt-1">
              Remote auto-fix is not possible for this issue. A certified mechanic has been dispatched.
            </p>
            {diagnosis && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="px-2 py-1 text-[10px] rounded bg-dash-bg/50 text-dash-muted border border-dash-border">
                  Issue: {diagnosis.affectedSystem}
                </span>
                <span className="px-2 py-1 text-[10px] rounded bg-dash-bg/50 text-dash-muted border border-dash-border">
                  Severity: {diagnosis.severity}/5
                </span>
                <span className="px-2 py-1 text-[10px] rounded bg-dash-bg/50 text-dash-muted border border-dash-border">
                  Root Cause: {diagnosis.rootCause}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Mechanic List ──────────────────────────────── */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="w-5 h-5 text-dash-accent" />
          <h3 className="font-display text-sm tracking-wider text-dash-text font-semibold">
            NEARBY CERTIFIED MECHANICS
          </h3>
          <span className="ml-auto text-xs text-dash-muted">
            Sorted by distance
          </span>
        </div>

        <div className="space-y-4">
          {mechanics.map((mech, index) => (
            <motion.div
              key={mech.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-xl border p-5 transition-all ${
                index === 0
                  ? 'border-green-500/40 bg-green-500/5'
                  : 'border-dash-border bg-dash-bg/30 hover:bg-dash-bg/50'
              }`}
            >
              {index === 0 && (
                <div className="absolute -top-2 left-4 px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded uppercase tracking-wider">
                  Nearest — Dispatched
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-dash-text">{mech.name}</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                      <Star className="w-3 h-3 fill-yellow-400" />
                      {mech.rating}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-dash-muted">
                      <Navigation className="w-3 h-3" />
                      {mech.distance}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-dash-muted">
                      <Wrench className="w-3 h-3" />
                      {mech.specialty}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-dash-muted mt-2">
                    <MapPin className="w-3 h-3" />
                    {mech.address}
                  </div>
                </div>

                {/* ETA */}
                <div className="text-right">
                  <div className={`text-2xl font-display font-bold ${
                    index === 0 ? 'text-green-400' : 'text-dash-text'
                  }`}>
                    {mech.eta}
                  </div>
                  <div className="text-[10px] text-dash-muted uppercase tracking-wider">ETA</div>
                  {index === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="flex items-center gap-1 mt-2 text-green-400 text-xs"
                    >
                      <CheckCircle className="w-3 h-3" />
                      En Route
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Contact */}
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-dash-border/30">
                <a className="flex items-center gap-1.5 text-xs text-dash-accent hover:text-dash-glow transition-colors">
                  <Phone className="w-3 h-3" />
                  {mech.phone}
                </a>
                {index === 0 && (
                  <span className="flex items-center gap-1 text-xs text-dash-muted ml-auto">
                    <Car className="w-3 h-3" />
                    Mechanic has been notified of vehicle location
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Driver Instructions ────────────────────────── */}
      <div className="glass-card p-6 border-l-4 border-dash-accent">
        <h3 className="font-display text-sm tracking-wider text-dash-accent font-semibold mb-3">
          DRIVER INSTRUCTIONS
        </h3>
        <div className="space-y-2 text-sm text-dash-text">
          <div className="flex items-start gap-2">
            <span className="text-dash-accent font-bold">1.</span>
            <p>Safely pull over and turn on hazard lights.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-dash-accent font-bold">2.</span>
            <p>Keep the engine running in idle mode to allow continued telemetry monitoring.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-dash-accent font-bold">3.</span>
            <p>The nearest certified mechanic ({mechanics[0]?.name}) has been dispatched and will arrive in approximately <strong className="text-green-400">{mechanics[0]?.eta}</strong>.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-dash-accent font-bold">4.</span>
            <p>STLA Guardian AI will continue monitoring your vehicle until the mechanic arrives.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
