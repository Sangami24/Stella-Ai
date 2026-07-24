import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, AlertTriangle, Info, Zap, Radio, Trash2 } from 'lucide-react';
import useStore from '../store/useStore';

const categoryIcons = {
  telemetry: Radio,
  anomaly: AlertTriangle,
  ai: Zap,
  call: Info,
  system: Info,
  resolution: Info,
  demo: Info,
  error: AlertTriangle,
};

const categoryColors = {
  telemetry: 'text-cyan-400',
  anomaly: 'text-yellow-400',
  ai: 'text-blue-400',
  call: 'text-green-400',
  system: 'text-dash-muted',
  resolution: 'text-emerald-400',
  demo: 'text-purple-400',
  error: 'text-red-400',
};

export default function SystemLogs() {
  const logs = useStore((s) => s.logs);
  const logsEndRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Auto-scroll only if user is near the bottom
      if (scrollHeight - scrollTop - clientHeight < 150) {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [logs]);

  const [filter, setFilter] = React.useState('all');

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(l => l.category === filter);

  const filters = ['all', 'telemetry', 'anomaly', 'ai', 'call', 'resolution', 'system'];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-dash-accent" />
          <h2 className="font-display text-sm tracking-wider text-dash-text font-semibold">
            SYSTEM LOGS
          </h2>
          <span className="text-xs text-dash-muted font-mono">
            {logs.length} entries
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full transition-all ${
              filter === f
                ? 'bg-dash-accent/20 text-dash-accent border border-dash-accent/30'
                : 'bg-dash-bg/50 text-dash-muted border border-dash-border hover:text-dash-text'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Log Stream */}
      <div
        ref={containerRef}
        className="terminal bg-[#080c14] rounded-lg p-4 h-[500px] overflow-y-auto border border-dash-border/30"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-dash-muted text-sm">
            No logs yet. Start a simulation to see system activity...
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredLogs.map((log, i) => {
              const Icon = categoryIcons[log.category] || Info;
              const color = categoryColors[log.category] || 'text-dash-muted';

              return (
                <motion.div
                  key={`${log.timestamp}-${i}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="terminal-line flex items-start gap-2 py-1 hover:bg-white/[0.02] px-2 rounded group"
                >
                  {/* Timestamp */}
                  <span className="text-dash-muted/50 flex-shrink-0 text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>

                  {/* Category */}
                  <span className={`flex-shrink-0 text-[11px] w-20 ${color} uppercase font-semibold flex items-center gap-1`}>
                    <Icon className="w-3 h-3" />
                    {log.category}
                  </span>

                  {/* Message */}
                  <span className="text-dash-text/80 text-[12px] flex-1">
                    {log.message}
                  </span>

                  {/* Expandable data */}
                  {log.data && (
                    <details className="text-[10px] text-dash-muted/50 cursor-pointer group-hover:text-dash-muted">
                      <summary className="select-none">data</summary>
                      <pre className="mt-1 p-2 bg-dash-bg/50 rounded text-[10px] overflow-x-auto max-w-md">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
