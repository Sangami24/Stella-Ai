import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrainCircuit, FileBarChart2, ShieldCheck, X } from 'lucide-react';
import useStore from '../store/useStore';

export default function AiDecisionModal() {
  const notice = useStore((state) => state.decisionNotice);
  const setDecisionNotice = useStore((state) => state.setDecisionNotice);
  const setActiveTab = useStore((state) => state.setActiveTab);

  const diagnosis = notice?.diagnosis;
  const close = () => setDecisionNotice(null);

  return (
    <AnimatePresence>
      {diagnosis && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-decision-title"
        >
          <motion.section
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-blue-400/30 bg-[#101828] shadow-2xl shadow-blue-950/50"
          >
            <div className="flex items-start justify-between border-b border-slate-700/70 bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-transparent p-5">
              <div className="flex gap-3">
                <div className="rounded-xl border border-blue-400/30 bg-blue-500/15 p-2.5">
                  <BrainCircuit className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Live AI decision</p>
                  <h2 id="ai-decision-title" className="mt-1 text-lg font-semibold text-white">{diagnosis.affectedSystem}</h2>
                </div>
              </div>
              <button onClick={close} aria-label="Close decision" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Assessment</p>
                <p className="mt-1 text-base font-medium leading-relaxed text-slate-100">{diagnosis.rootCause}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Confidence" value={`${diagnosis.confidence ?? diagnosis.contextualConfidence ?? '--'}%`} color="text-cyan-300" />
                <Stat label="Severity" value={`${diagnosis.severity ?? '--'}/5`} color="text-red-300" />
                <Stat label="Evidence" value={`${diagnosis.affectedParameters?.length ?? 0} signals`} color="text-violet-300" />
              </div>
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3.5">
                <div className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">Recommended action</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-200">{diagnosis.recommendedAction}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-700/70 bg-slate-950/30 p-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => { setActiveTab('tcu'); close(); }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/5"
              >
                <FileBarChart2 className="h-4 w-4" />
                Inspect TCU evidence
              </button>
              <button onClick={close} className="rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400">
                Continue live response
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
