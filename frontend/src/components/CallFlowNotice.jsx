import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Radar } from 'lucide-react';
import useStore from '../store/useStore';

export default function CallFlowNotice() {
  const notice = useStore((state) => state.callFlowNotice);
  const setCallFlowNotice = useStore((state) => state.setCallFlowNotice);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setCallFlowNotice(null), notice.type === 'driver-helped' ? 4000 : 2200);
    return () => clearTimeout(timer);
  }, [notice, setCallFlowNotice]);

  const isComplete = notice?.type === 'driver-helped';
  return <AnimatePresence>
    {notice && <motion.div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 12 }} className={`w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl ${isComplete ? 'border-emerald-400/35 bg-[#10251f] shadow-emerald-950/40' : 'border-blue-400/35 bg-[#101b30] shadow-blue-950/40'}`} role="status">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${isComplete ? 'bg-emerald-400/15 text-emerald-300' : 'bg-blue-400/15 text-blue-300'}`}>
          {isComplete ? <CheckCircle2 className="h-6 w-6" /> : <Radar className="h-6 w-6 animate-pulse" />}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">{isComplete ? 'Driver has been helped' : 'Searching for the next nearest mechanic'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{isComplete ? notice.message : 'The provider is unavailable. Stella AI is contacting the next nearby service provider.'}</p>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
