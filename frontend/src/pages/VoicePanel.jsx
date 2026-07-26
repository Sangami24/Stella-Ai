import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, PhoneCall, Mic, Bot,
  User, Brain, Shield, CheckCircle
} from 'lucide-react';
import useStore from '../store/useStore';
export default function VoicePanel() {
  const callStatus = useStore((s) => s.callStatus);
  const transcript = useStore((s) => s.transcript);
  const diagnosis = useStore((s) => s.diagnosis);
  const incident = useStore((s) => s.incident);
  const transcriptEndRef = useRef(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);
  const isCallActive = callStatus === 'connected' || callStatus === 'ringing' || callStatus === 'in-progress';
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {}
      <div className="lg:col-span-2 space-y-6">
        {}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm tracking-wider text-dash-text font-semibold flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-dash-accent" />
              VOICE CALL STATUS
            </h3>
            <CallStatusBadge status={callStatus} />
          </div>
          {}
          <div className="flex items-center justify-center h-16 gap-1 my-4">
            {isCallActive ? (
              Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="waveform-bar"
                  style={{
                    animationDelay: `${i * 0.05}s`,
                    animationDuration: `${0.5 + Math.random() * 0.5}s`,
                  }}
                />
              ))
            ) : callStatus === 'completed' ? (
              <div className="flex items-center gap-2 text-dash-success">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Call Completed</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-dash-muted">
                <Phone className="w-5 h-5" />
                <span className="text-sm">Waiting for call...</span>
              </div>
            )}
          </div>
          {}
          {callStatus && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-dash-border/50">
              <div className="text-center">
                <div className="text-xs text-dash-muted mb-1">Calling</div>
                <div className="text-sm font-medium text-dash-text text-center w-full truncate max-w-full">
                  {incident?.callRecipient || 'Connecting...'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-dash-muted mb-1">Mode</div>
                <div className="text-sm font-medium text-dash-text">Two-Way Voice</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-dash-muted mb-1">AI Model</div>
                <div className="text-sm font-medium text-dash-accent">Gemini</div>
              </div>
            </div>
          )}
        </div>
        {}
        <div className="glass-card p-6">
          <h3 className="font-display text-sm tracking-wider text-dash-text font-semibold flex items-center gap-2 mb-4">
            <Mic className="w-4 h-4 text-dash-accent" />
            LIVE TRANSCRIPT
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {transcript.length === 0 ? (
              <div className="text-center py-8 text-dash-muted text-sm">
                Transcript will appear here when the call begins...
              </div>
            ) : (
              <AnimatePresence>
                {transcript.map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${
                      line.speaker === 'AI' ? '' : 'flex-row-reverse'
                    }`}
                  >
                    {}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      line.speaker === 'AI'
                        ? 'bg-dash-accent/20 text-dash-accent'
                        : 'bg-green-500/20 text-green-400'
                    }`}>
                      {line.speaker === 'AI' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    {}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      line.speaker === 'AI'
                        ? 'bg-dash-accent/10 border border-dash-accent/20 rounded-tl-sm'
                        : 'bg-green-500/10 border border-green-500/20 rounded-tr-sm'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                          line.speaker === 'AI' ? 'text-dash-accent' : 'text-green-400'
                        }`}>
                          {line.speaker === 'AI' ? 'Stella AI' : 'Engineer'}
                        </span>
                        <span className="text-[10px] text-dash-muted font-mono">
                          {line.timestamp ? new Date(line.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </div>
                      <p className="text-sm text-dash-text leading-relaxed">{line.text}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>
      {}
      <div className="space-y-6">
        {}
        <div className="glass-card p-6">
          <h3 className="font-display text-sm tracking-wider text-dash-text font-semibold flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-dash-accent" />
            AI REASONING
          </h3>
          {diagnosis ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-dash-muted mb-1">Root Cause</div>
                <p className="text-sm text-dash-text font-medium">{diagnosis.rootCause}</p>
              </div>
              <div>
                <div className="text-xs text-dash-muted mb-1">Affected System</div>
                <p className="text-sm text-dash-accent font-semibold">{diagnosis.affectedSystem}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-dash-bg/50 rounded-lg p-3 text-center border border-dash-border">
                  <div className="text-xl font-display font-bold text-dash-accent">
                    {diagnosis.primaryConfidence}%
                  </div>
                  <div className="text-[9px] text-dash-muted uppercase tracking-wider mt-1">ML Confidence</div>
                </div>
                <div className="bg-dash-bg/50 rounded-lg p-3 text-center border border-dash-border">
                  <div className="text-xl font-display font-bold text-purple-400">
                    {diagnosis.contextualConfidence}%
                  </div>
                  <div className="text-[9px] text-dash-muted uppercase tracking-wider mt-1">AI Confidence</div>
                </div>
                <div className="bg-dash-bg/50 rounded-lg p-3 text-center border border-dash-border">
                  <div className="text-xl font-display font-bold text-dash-danger">
                    {diagnosis.severity}/5
                  </div>
                  <div className="text-[9px] text-dash-muted uppercase tracking-wider mt-1">Severity</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-dash-muted mb-1">Risk Assessment</div>
                <p className="text-xs text-dash-text/80 leading-relaxed">{diagnosis.riskAssessment}</p>
              </div>
              <div>
                <div className="text-xs text-dash-muted mb-1">Recommendation</div>
                <p className="text-xs text-dash-text/80 leading-relaxed">{diagnosis.recommendedAction}</p>
              </div>
              <div className="pt-3 border-t border-dash-border/50">
                <div className="text-xs text-dash-muted mb-2">Resolution Path</div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                  diagnosis.isAutoFixable
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  {diagnosis.isAutoFixable ? (
                    <>
                      <Shield className="w-4 h-4" />
                      Auto-Fix Available
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4" />
                      Mechanic Required
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-dash-muted text-sm">
              AI reasoning will appear after diagnosis...
            </div>
          )}
        </div>
        {}
        {incident?.resolution && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 border-l-4 border-green-500"
          >
            <h3 className="font-display text-sm tracking-wider text-green-400 font-semibold mb-3">
              DECISION EXTRACTED
            </h3>
            <p className="text-sm text-dash-text">{incident.resolution.reasoning}</p>
            <div className="mt-3 text-xs text-dash-muted">
              Confidence: <span className="text-green-400 font-semibold">{incident.resolution.confidence}%</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
function CallStatusBadge({ status }) {
  if (!status) {
    return (
      <span className="px-3 py-1 text-xs rounded-full bg-dash-border/20 text-dash-muted">
        Idle
      </span>
    );
  }
  const config = {
    ringing: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'RINGING', icon: Phone },
    connected: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'CONNECTED', icon: PhoneCall },
    'in-progress': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'IN PROGRESS', icon: PhoneCall },
    completed: { bg: 'bg-dash-border/20', text: 'text-dash-muted', border: 'border-dash-border', label: 'COMPLETED', icon: PhoneOff },
  };
  const c = config[status] || config.completed;
  const Icon = c.icon;
  return (
    <span className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}
