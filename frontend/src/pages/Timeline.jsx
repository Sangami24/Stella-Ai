import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Brain, Phone, PhoneOff,
  CheckCircle, WrenchIcon, Clock, ArrowRight,
  Radio, MessageSquare
} from 'lucide-react';
import useStore from '../store/useStore';
const stepIcons = {
  fault_detected: AlertTriangle,
  ai_diagnosing: Brain,
  diagnosis_complete: Brain,
  calling_engineer: Phone,
  in_call: MessageSquare,
  call_completed: PhoneOff,
  auto_resolving: Clock,
  resolved: CheckCircle,
  escalated: WrenchIcon,
};
const statusColors = {
  completed: {
    red: 'border-red-500 bg-red-500/10',
    blue: 'border-blue-500 bg-blue-500/10',
    yellow: 'border-yellow-500 bg-yellow-500/10',
    green: 'border-green-500 bg-green-500/10',
  },
  in_progress: {
    red: 'border-red-500 bg-red-500/20 animate-pulse',
    blue: 'border-blue-500 bg-blue-500/20 animate-pulse',
    yellow: 'border-yellow-500 bg-yellow-500/20 animate-pulse',
    green: 'border-green-500 bg-green-500/20 animate-pulse',
  },
};
const dotColors = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
  green: 'bg-green-500',
};
const lineColors = {
  red: 'from-red-500/50',
  blue: 'from-blue-500/50',
  yellow: 'from-yellow-500/50',
  green: 'from-green-500/50',
};
const textColors = {
  red: 'text-red-400',
  blue: 'text-blue-400',
  yellow: 'text-yellow-400',
  green: 'text-green-400',
};
export default function Timeline() {
  const incident = useStore((s) => s.incident);
  const timeline = incident?.timeline || [];
  if (timeline.length === 0) {
    return (
      <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
        <Clock className="w-12 h-12 text-dash-border mb-4" />
        <h3 className="font-display text-lg text-dash-muted tracking-wider">NO ACTIVE INCIDENT</h3>
        <p className="text-sm text-dash-muted/70 mt-2 max-w-md">
          Trigger a fault simulation from the Dashboard to see the incident timeline unfold in real time.
        </p>
      </div>
    );
  }
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-8">
        <Radio className="w-5 h-5 text-dash-accent" />
        <h2 className="font-display text-sm tracking-wider text-dash-text font-semibold">
          INCIDENT TIMELINE
        </h2>
        <span className="ml-auto text-xs text-dash-muted font-mono">
          ID: {incident?.id?.slice(0, 8)}
        </span>
      </div>
      <div className="relative pl-8">
        {timeline.map((step, index) => {
          const Icon = stepIcons[step.event] || CheckCircle;
          const isLast = index === timeline.length - 1;
          const isActive = step.status === 'in_progress';
          const color = step.color || 'blue';
          return (
            <motion.div
              key={`${step.event}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="relative mb-8 last:mb-0"
            >
              {}
              {!isLast && (
                <div className={`absolute left-[-20px] top-10 w-0.5 h-[calc(100%+12px)] bg-gradient-to-b ${lineColors[color]} to-transparent`} />
              )}
              {}
              <div className={`absolute left-[-26px] top-1 w-[13px] h-[13px] rounded-full border-2
                ${isActive ? `${dotColors[color]} ring-4 ring-${color}-500/20` : `${dotColors[color]}`}`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-full animate-ping bg-current opacity-30" />
                )}
              </div>
              {}
              <div className={`rounded-xl border p-4 transition-all ${
                isActive
                  ? (statusColors.in_progress[color] || 'border-blue-500 bg-blue-500/20')
                  : (statusColors.completed[color] || 'border-dash-border bg-dash-bg/30')
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    isActive ? `${dotColors[color]}` : 'bg-dash-card'
                  }`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : textColors[color]}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-semibold ${textColors[color]}`}>
                        {step.label}
                      </h4>
                      {isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-dash-muted uppercase tracking-wider">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-dash-muted mt-1">{step.description}</p>
                    <p className="text-[10px] text-dash-muted/60 mt-2 font-mono">
                      {new Date(step.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
