import React from 'react';
import { motion } from 'framer-motion';
import {
  MapPin, Star, Clock, Phone, Wrench,
  Navigation, CheckCircle, Car, AlertTriangle,
  ExternalLink, Map, MessageCircle
} from 'lucide-react';
import useStore from '../store/useStore';

export default function MechanicView() {
  const mechanics = useStore((s) => s.mechanics);
  const incident = useStore((s) => s.incident);
  const diagnosis = useStore((s) => s.diagnosis);
  const trackingUrl = useStore((s) => s.trackingUrl);

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

  const dispatchedRole = mechanics[0]?.specialty?.includes('Towing') ? 'tow truck' : 'mechanic';

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-l-4 border-yellow-500"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-yellow-500/10">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h2 className={`font-display text-base tracking-wider ${dispatchedRole === 'tow truck' ? 'text-red-400' : 'text-green-400'} font-bold uppercase`}>
              {dispatchedRole === 'tow truck' ? 'TOW TRUCK DISPATCHED' : 'MECHANIC DISPATCHED'}
            </h2>
            <p className="text-sm text-dash-text mt-1">
              Remote auto-fix is not possible for this issue. The nearest {dispatchedRole} has been dispatched and is reaching your location soon.
            </p>
            {diagnosis && (
              <div className="mt-4 space-y-2">
                <div className="text-sm font-semibold text-dash-text border-b border-dash-border pb-1">AI Final Prediction</div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <span className="block text-[10px] text-dash-muted uppercase tracking-wider">Affected System</span>
                    <span className="text-sm text-dash-text">{diagnosis.affectedSystem}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-dash-muted uppercase tracking-wider">ML Confidence</span>
                    <span className="text-sm text-dash-accent font-bold">{diagnosis.primaryConfidence}%</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-dash-muted uppercase tracking-wider">AI Confidence</span>
                    <span className="text-sm text-purple-400 font-bold">{diagnosis.contextualConfidence}%</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-dash-muted uppercase tracking-wider">Severity</span>
                    <span className="text-sm text-dash-danger font-bold">{diagnosis.severity} / 5</span>
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] text-dash-muted uppercase tracking-wider mt-2">Identified Root Cause</span>
                  <span className="text-sm text-dash-text">{diagnosis.rootCause}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-dash-muted uppercase tracking-wider mt-2">Recommended Solution</span>
                  <span className="text-sm text-dash-success">{diagnosis.recommendedAction}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Live Tracking Link Card */}
      {trackingUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-6 border border-indigo-500/30 bg-indigo-500/5"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <Map className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-display text-sm tracking-wider text-indigo-400 font-bold">
                LIVE TRACKING ACTIVE
              </h3>
              <p className="text-xs text-dash-muted mt-0.5">
                Driver can view the {dispatchedRole} approaching in real-time
              </p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          </div>

          <div className="bg-dash-bg/60 rounded-lg p-4 border border-dash-border/30 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="w-3.5 h-3.5 text-dash-muted" />
              <span className="text-[10px] text-dash-muted uppercase tracking-wider font-semibold">Tracking URL</span>
            </div>
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-indigo-400 hover:text-indigo-300 transition-colors break-all underline underline-offset-2"
            >
              {trackingUrl}
            </a>
          </div>

          <div className="flex gap-3">
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm font-semibold hover:bg-indigo-500/30 transition-colors"
            >
              <Map className="w-4 h-4" />
              Open Live Map
            </a>
            <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold">
              <MessageCircle className="w-4 h-4" />
              WhatsApp Sent ✓
            </div>
          </div>
        </motion.div>
      )}

      {/* Mechanic Cards */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="w-5 h-5 text-dash-accent" />
          <h3 className="font-display text-sm tracking-wider text-dash-text font-semibold">
            DISPATCHED SERVICE PROVIDER
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
                  Dispatched — En Route
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
                {}
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
              {}
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-dash-border/30">
                <a className="flex items-center gap-1.5 text-xs text-dash-accent hover:text-dash-glow transition-colors">
                  <Phone className="w-3 h-3" />
                  {mech.phone}
                </a>
                {index === 0 && (
                  <span className="flex items-center gap-1 text-xs text-dash-muted ml-auto">
                    <Car className="w-3 h-3" />
                    {dispatchedRole === 'tow truck' ? 'Tow truck' : 'Mechanic'} notified via WhatsApp + Call
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Driver Instructions */}
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
            <p>The nearest certified {dispatchedRole} ({mechanics[0]?.name}) has been dispatched and will arrive in approximately <strong className="text-green-400">{mechanics[0]?.eta}</strong>.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-dash-accent font-bold">4.</span>
            <p>A WhatsApp message with a <strong className="text-indigo-400">live tracking link</strong> has been sent to you. You can watch the {dispatchedRole} approaching on the map.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-dash-accent font-bold">5.</span>
            <p>Stella AI will continue monitoring your vehicle until the {dispatchedRole} arrives.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
