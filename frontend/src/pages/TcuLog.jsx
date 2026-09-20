import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Server, Wifi, Clock, ChevronRight, Cpu } from 'lucide-react';
import useStore from '../store/useStore';

export default function TcuLog() {
  const tcuLogs = useStore((s) => s.tcuLogs);
  const scrollRef = useRef(null);
  const [followTail, setFollowTail] = React.useState(true);

  useEffect(() => {
    if (followTail && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tcuLogs, followTail]);

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 24;
    setFollowTail((wasFollowing) => wasFollowing === isAtBottom ? wasFollowing : isAtBottom);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Radio className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white tracking-wide">
                TCU Data Transmission Log
              </h2>
              <p className="text-xs text-dash-muted mt-0.5">
                Real-time Telematics Control Unit → Backend data packets
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dash-bg/50 border border-dash-border">
              <span className={`w-2 h-2 rounded-full ${tcuLogs.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-dash-muted'}`} />
              <span className="text-xs font-medium text-dash-muted">
                {tcuLogs.length > 0 ? 'STREAMING' : 'IDLE'}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-dash-bg/50 border border-dash-border">
              <span className="text-xs font-mono font-medium text-cyan-400">
                {tcuLogs.length} packets
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Protocol Info Bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Server, label: 'Protocol', value: 'CAN-FD', color: 'text-indigo-400' },
          { icon: Wifi, label: 'Network', value: '4G-LTE', color: 'text-green-400' },
          { icon: Cpu, label: 'Gateway', value: 'GW-BLR-001', color: 'text-cyan-400' },
          { icon: Clock, label: 'Interval', value: '10,000ms', color: 'text-amber-400' },
        ].map((item) => (
          <div key={item.label} className="glass rounded-lg p-3 flex items-center gap-2.5">
            <item.icon className={`w-4 h-4 ${item.color}`} />
            <div>
              <div className="text-[10px] text-dash-muted uppercase tracking-wider">{item.label}</div>
              <div className={`text-xs font-mono font-semibold ${item.color}`}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Log Entries */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-3 border-b border-dash-border/50 flex items-center justify-between">
          <span className="text-xs text-dash-muted font-medium uppercase tracking-wider">Packet Log</span>
          <span className={`text-[10px] ${followTail ? 'text-emerald-300' : 'text-amber-300'}`}>{followTail ? 'Following live packets' : 'Auto-scroll paused'}</span>
        </div>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[520px] overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-dash-border"
        >
          {tcuLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-dash-muted">
              <Radio className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No TCU packets received yet</p>
              <p className="text-xs mt-1 opacity-60">Start a fault simulation to see live data</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {tcuLogs.map((log, idx) => (
                <motion.div
                  key={log.packetId || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`group rounded-lg border p-3 transition-colors ${
                    log.abnormalFields?.length
                      ? 'border-red-500/35 bg-red-500/[0.045] hover:border-red-400/60'
                      : 'border-dash-border/30 bg-dash-bg/40 hover:border-cyan-500/30'
                  }`}
                >
                  {/* Packet Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {log.abnormalFields?.length > 0 && (
                        <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
                          {log.abnormalFields.length} ABNORMAL
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-mono font-bold">
                        {log.packetId}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono">
                        {log.sourceEcu}
                      </span>
                      <ChevronRight className="w-3 h-3 text-dash-muted" />
                      <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-mono">
                        BACKEND
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.transmissionStatus === 'SENT'
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}>
                        {log.transmissionStatus === 'SENT' ? '✓ SENT' : '✗ FAIL'}
                      </span>
                    </div>
                  </div>

                  {/* Payload */}
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {log.payload && Object.entries(log.payload).filter(([, value]) => value !== undefined).map(([key, value]) => {
                      const abnormal = log.abnormalFields?.find((field) => field.parameter === key);
                      return (
                      <div key={key} className={`rounded px-2 py-1.5 ${abnormal ? 'bg-red-500/15 ring-1 ring-red-500/30' : 'bg-dash-bg/60'}`}>
                        <div className="text-[9px] text-dash-muted uppercase tracking-wider truncate">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className={`text-xs font-mono font-semibold ${abnormal ? 'text-red-300' : 'text-dash-text'}`}>
                          {typeof value === 'number' ? value.toFixed(1) : value || '--'}
                        </div>
                      </div>
                    )})}
                  </div>

                  {log.abnormalFields?.length > 0 && (
                    <div className="mb-2 rounded bg-red-950/30 px-2.5 py-2 text-[11px] text-red-200">
                      <span className="font-semibold uppercase tracking-wider text-red-300">Telemetry alert: </span>
                      {log.abnormalFields.map((field) => field.message).join(' · ')}
                    </div>
                  )}

                  {/* Metadata Footer */}
                  <div className="flex items-center gap-3 text-[10px] text-dash-muted">
                    <span className="font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    {log.metadata && (
                      <>
                        <span>Signal: {log.metadata.signalStrength}</span>
                        <span>Latency: {log.metadata.latency}</span>
                        <span>{log.metadata.networkType}</span>
                      </>
                    )}
                    <span>Seq: #{log.sequenceNumber}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
