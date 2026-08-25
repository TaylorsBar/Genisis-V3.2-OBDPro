import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useUIStore } from '../stores/uiStore';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export const GlobalToastNotification: React.FC = () => {
    const { toasts, dismissToast } = useUIStore();

    const icons = {
        success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
        info: <Info className="w-4 h-4 text-brand-cyan shrink-0" />,
        warning: <AlertTriangle className="w-4 h-4 text-brand-yellow shrink-0" />,
        error: <XCircle className="w-4 h-4 text-brand-red shrink-0" />,
    };

    const borders = {
        success: 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] bg-emerald-950/15',
        info: 'border-brand-cyan/30 shadow-[0_0_15px_rgba(0,240,255,0.1)] bg-brand-cyan/5',
        warning: 'border-brand-yellow/30 shadow-[0_0_15px_rgba(252,238,10,0.1)] bg-brand-yellow/5',
        error: 'border-brand-red/30 shadow-[0_0_15px_rgba(255,42,77,0.1)] bg-brand-red/5',
    };

    return (
        <div id="global-toast-container" className="fixed bottom-20 md:bottom-24 right-4 md:right-8 z-[99999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
            <AnimatePresence>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className={`pointer-events-auto flex items-start gap-3 p-4 bg-[#08080c]/95 backdrop-blur-md border rounded-xl shadow-2xl ${borders[toast.type]}`}
                    >
                        <div className="mt-0.5">{icons[toast.type]}</div>
                        <div className="flex-1 flex flex-col min-w-0">
                            <span className="text-[11px] font-black tracking-widest text-zinc-500 uppercase font-mono mb-1">
                                {toast.type} notification
                            </span>
                            <p className="text-xs text-white/90 font-mono font-medium leading-relaxed break-words">
                                {toast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => dismissToast(toast.id)}
                            className="text-zinc-600 hover:text-white transition-colors p-0.5 rounded-full hover:bg-white/5"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
