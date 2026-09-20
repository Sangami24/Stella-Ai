import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import useStore from '../store/useStore';

export default function WhatsAppDispatchToast() {
  const notice = useStore((state) => state.whatsappNotice);
  const setWhatsAppNotice = useStore((state) => state.setWhatsAppNotice);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setWhatsAppNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice, setWhatsAppNotice]);

  return <AnimatePresence>
    {notice && <motion.aside
      className="fixed bottom-5 right-5 z-[120] w-[min(380px,calc(100vw-2.5rem))] rounded-xl border border-emerald-400/30 bg-[#101b22]/95 p-4 shadow-2xl shadow-emerald-950/30 backdrop-blur"
      initial={{ opacity: 0, x: 24, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 24, y: 10 }}
      role="status"
    >
      <div className="flex gap-3">
        <div className="rounded-lg bg-emerald-400/15 p-2 text-emerald-300"><MessageCircle className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-200"><CheckCircle2 className="h-4 w-4" />WhatsApp {notice.delivery === 'simulated' ? 'demo delivered' : 'dispatch sent'}</div>
          <p className="mt-1 text-xs text-slate-300">To: {notice.recipient} · {notice.to}</p>
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-slate-400">{notice.body}</p>
        </div>
      </div>
    </motion.aside>}
  </AnimatePresence>;
}
