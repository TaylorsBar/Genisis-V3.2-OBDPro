
import React, { useState } from 'react';
import { TimelineEvent, AlertLevel } from '../types';

// Define styles map with robust string keys
const levelStyles: Record<string, any> = {
    'Critical': {
        bg: 'bg-red-900/10',
        border: 'border-red-500',
        text: 'text-red-400',
        glow: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]',
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
    },
    'Warning': {
        bg: 'bg-yellow-900/10',
        border: 'border-yellow-500',
        text: 'text-yellow-400',
        glow: 'shadow-[0_0_20px_rgba(234,179,8,0.2)]',
        icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-4v4m0 4h.01'
    },
    'Info': {
        bg: 'bg-blue-900/10',
        border: 'border-blue-500',
        text: 'text-blue-400',
        glow: 'shadow-[0_0_20px_rgba(59,130,246,0.1)]',
        icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    },
}

// Helper to safely get styles with a fallback
const getStyles = (level: AlertLevel | string) => {
    if (!level) return levelStyles['Info'];
    
    // Normalize input to handle case sensitivity or unexpected strings from AI
    const inputStr = level.toString().toLowerCase();
    
    if (inputStr.includes('crit')) return levelStyles['Critical'];
    if (inputStr.includes('warn')) return levelStyles['Warning'];
    
    return levelStyles['Info'];
};

const EventModal: React.FC<{ event: TimelineEvent, onClose: () => void }> = ({ event, onClose }) => {
    const styles = getStyles(event.level);
    
    // Robust fallback in case 'details' is missing from the AI response
    const details = event.details || {
        component: 'System',
        plainEnglishSummary: 'No detailed analysis available.',
        rootCause: 'Data insufficient for detailed breakdown.',
        recommendedActions: ['Perform manual inspection.'],
        tsbs: []
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className={`w-full max-w-2xl bg-[#0a0a0a] rounded-2xl border ${styles.border} shadow-2xl relative overflow-hidden`} onClick={(e) => e.stopPropagation()}>
                {/* Top header decoration */}
                <div className={`h-1.5 w-full ${styles.bg.replace('/10', '')}`}></div>
                
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors z-10">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="p-8">
                    <div className="flex items-start mb-8">
                        <div className={`p-4 rounded-2xl mr-6 ${styles.bg} border border-white/10 ${styles.glow}`}>
                            <svg className={`w-10 h-10 ${styles.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={styles.icon} /></svg>
                        </div>
                        <div>
                             <div className="flex flex-wrap items-center gap-3 mb-2">
                                 <h2 className="text-2xl font-display font-black text-white italic tracking-tighter uppercase">{event.title}</h2>
                                 <span className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full border ${styles.border} ${styles.bg} ${styles.text}`}>
                                     {event.level} RISK
                                 </span>
                             </div>
                             <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">{event.timeframe} // {details.component}</p>
                        </div>
                    </div>
                   
                    <div className="space-y-8 text-gray-300">
                        <div className="bg-black/40 p-6 rounded-xl border border-white/5">
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">AI Analysis Narrative</h4>
                            <p className="text-sm leading-relaxed text-gray-200">{details.plainEnglishSummary}</p>
                        </div>
                        
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Telemetry Anomaly Root Cause</h4>
                            <p className="text-xs text-gray-400 leading-relaxed font-mono italic">{details.rootCause}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-brand-cyan uppercase tracking-widest">Recommended Actions</h4>
                                <ul className="space-y-3">
                                    {details.recommendedActions?.map((action: string, i: number) => (
                                        <li key={i} className="flex items-start gap-3 text-xs leading-snug">
                                            <span className="text-brand-cyan font-bold mt-0.5">›</span>
                                            {action}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            
                            {details.tsbs && details.tsbs.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-bold text-brand-purple uppercase tracking-widest">Manufacturer TSBs</h4>
                                    <ul className="space-y-3">
                                        {details.tsbs.map((tsb: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-xs text-brand-purple/80 leading-snug">
                                                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                {tsb}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="bg-[#050505] p-4 border-t border-white/5 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-all rounded">Dismiss Forecast</button>
                </div>
            </div>
        </div>
    );
};

const RiskTimeline: React.FC<{events: TimelineEvent[]}> = ({ events }) => {
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

    const sortedEvents = [...events].sort((a, b) => 
        Object.values(AlertLevel).indexOf(b.level as AlertLevel) - Object.values(AlertLevel).indexOf(a.level as AlertLevel)
    );

    if (events.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-40 p-8">
                <div className="w-20 h-20 border-2 border-dashed border-gray-800 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">Zero Risk Factors</h3>
                <p className="text-[10px] text-gray-600 mt-2 font-mono uppercase">Predictive fabric detects no imminent drift patterns.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-700">
            {sortedEvents.map((event, idx) => {
                const styles = getStyles(event.level);
                return (
                    <div 
                        key={event.id || idx} 
                        onClick={() => setSelectedEvent(event)} 
                        className={`group relative p-5 rounded-xl bg-black/40 border border-white/5 hover:border-${styles.text.split('-')[1]}-500/50 hover:bg-[#111] transition-all cursor-pointer overflow-hidden shadow-lg`}
                    >
                        {/* Status Bar */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.bg.replace('/10', '')} group-hover:w-2 transition-all`}></div>
                        
                        <div className="flex items-center gap-6 pl-2">
                            <div className={`p-3 rounded-xl bg-black border border-white/10 ${styles.text} ${styles.glow}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={styles.icon} /></svg>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`text-sm font-display font-black italic uppercase tracking-wider ${styles.text} truncate`}>{event.title}</h3>
                                    <span className="text-[9px] font-mono text-gray-500 uppercase font-bold tracking-widest">{event.timeframe}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-gray-600 uppercase">SIGNAL:</span>
                                    <p className="text-[10px] text-gray-400 truncate">{event.details?.component || 'System Component'}</p>
                                </div>
                            </div>
                            
                            <div className="text-gray-700 group-hover:text-brand-cyan transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </div>
                        </div>
                    </div>
                )
            })}
            {selectedEvent && <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
        </div>
    );
};

export default RiskTimeline;
