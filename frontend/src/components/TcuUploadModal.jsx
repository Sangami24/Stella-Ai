import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Server, UploadCloud } from 'lucide-react';
import useStore from '../store/useStore';

export default function TcuUploadModal() {
  const notice = useStore((state) => state.tcuUploadNotice);
  const setTcuUploadNotice = useStore((state) => state.setTcuUploadNotice);
  const setActiveTab = useStore((state) => state.setActiveTab);

  useEffect(() => {
    if (!notice) return undefined;
    const handoffTimer = setTimeout(() => {
      setTcuUploadNotice(null);
      setActiveTab('voice');
    }, 1800);
    return () => clearTimeout(handoffTimer);
  }, [notice, setActiveTab, setTcuUploadNotice]);

  return <AnimatePresence>
    {notice && <motion.div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }} className="w-full max-w-md overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#101828] shadow-2xl shadow-cyan-950/40">
        <div className="border-b border-cyan-400/15 bg-gradient-to-r from-cyan-500/15 to-blue-500/5 p-5">
          <div className="flex items-center gap-3"><div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-2.5"><UploadCloud className="h-5 w-5 animate-bounce text-cyan-300" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">TCU transmission</p><h2 className="mt-1 text-base font-semibold text-white">Updating TCU values to backend</h2></div></div>
        </div>
        <div className="space-y-3 p-5"><div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/45 p-3"><Server className="h-4 w-4 text-cyan-300" /><div className="flex-1"><div className="text-xs font-medium text-slate-100">CAN-FD telemetry packet sync</div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700"><motion.div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500" initial={{ width: '5%' }} animate={{ width: '100%' }} transition={{ duration: 1.55, ease: 'easeInOut' }} /></div></div><CheckCircle2 className="h-4 w-4 text-emerald-300" /></div><p className="text-xs leading-relaxed text-slate-400">Abnormal readings are being sent for analysis. Connecting the live call panel next.</p></div>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
