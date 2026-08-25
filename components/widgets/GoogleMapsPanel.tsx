
import React, { useState, useEffect, useRef } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { getMapsGroundingResponse, MapsGroundingResult } from '../../services/geminiService';
import Map from '../Map';

interface GoogleMapsPanelProps {
    onToggleExpand?: () => void;
    isExpanded?: boolean;
}

const GoogleMapsPanel: React.FC<GoogleMapsPanelProps> = ({ onToggleExpand, isExpanded }) => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<MapsGroundingResult | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [location, setLocation] = useState({ lat: -37.8931, lng: 175.5458 });

    useEffect(() => {
        let rafId: number;
        let frameCount = 0;
        const loop = () => {
            frameCount++;
            if (frameCount % 30 === 0) { // Update location at 2Hz for map
                const state = useVehicleStore.getState();
                const d = state.latestData;
                if (d.latitude && d.longitude) {
                    setLocation({ lat: d.latitude, lng: d.longitude });
                }
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [result]);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim() || isSearching) return;

        setIsSearching(true);
        try {
            const res = await getMapsGroundingResponse(query, location);
            setResult(res);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className={`w-full h-full bg-[#030312]/30 backdrop-blur-3xl border border-white/10 rounded-xl overflow-hidden flex flex-col group transition-all duration-500 hover:border-brand-cyan/60 shadow-2xl relative ${isExpanded ? 'ring-2 ring-brand-cyan/40' : ''}`}>
            {/* Decal Accents */}
            <div className="absolute top-0 left-0 w-24 h-[1px] bg-gradient-to-r from-brand-cyan/80 to-transparent z-30"></div>
            <div className="absolute top-0 left-0 h-24 w-[1px] bg-gradient-to-b from-brand-cyan/80 to-transparent z-30"></div>
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b border-r border-brand-cyan/20 rounded-br-xl pointer-events-none"></div>
            
            <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between bg-black/20 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-brand-cyan rounded-full animate-pulse shadow-[0_0_12px_#00F0FF]"></div>
                    <span className="text-[9px] font-display font-black text-white italic tracking-widest uppercase">TACTICAL_LINK // GEO_SYNC</span>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onToggleExpand}
                        className="text-[9px] font-mono text-brand-cyan/80 hover:text-white uppercase font-bold tracking-widest transition-colors flex items-center gap-1 group/btn"
                    >
                        {isExpanded ? 'COLLAPSE' : 'ENLARGE'}
                        <svg className={`w-3 h-3 transition-transform duration-500 group-hover/btn:translate-y-0.5 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
            </div>

            {/* Map Body */}
            <div className="flex-1 relative overflow-hidden bg-black/40">
                <Map 
                    lat={location.lat} 
                    lon={location.lng} 
                />
                
                {/* Grounding Intel Overlay */}
                {result && (
                    <div 
                        ref={scrollRef}
                        className="absolute inset-2 bg-black/90 backdrop-blur-3xl p-6 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-500 z-40 border border-white/10 rounded-lg shadow-2xl"
                    >
                        <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                            <div>
                                <span className="text-[10px] font-mono text-brand-cyan uppercase tracking-[0.3em] mb-1 block">Satellite Payload Decrypted</span>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider italic">Strategic Analysis</h3>
                            </div>
                            <button 
                                onClick={() => setResult(null)}
                                className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-red-500/20 hover:text-red-400 rounded-full text-gray-400 transition-all border border-white/5"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="bg-brand-cyan/10 border-l-4 border-brand-cyan p-4 mb-8 rounded-r-lg">
                            <p className="text-[12px] text-gray-200 font-mono leading-relaxed italic">
                                {result.text}
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest block px-1">Mapped POI Data</span>
                            {result.places.map((place, i) => (
                                <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-brand-cyan/40 hover:bg-white/10 transition-all group/item">
                                    <a 
                                        href={place.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-xs font-black text-white uppercase tracking-[0.15em] flex items-center justify-between group"
                                    >
                                        <span className="group-hover/item:text-brand-cyan transition-colors">{place.title}</span>
                                        <svg className="w-4 h-4 text-brand-cyan opacity-40 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                    </a>
                                    {place.snippets.length > 0 && (
                                        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                                            {place.snippets.slice(0, 2).map((snip, si) => (
                                                <div key={si} className="text-[9px] text-gray-500 bg-black/60 px-3 py-1.5 rounded border border-white/5 whitespace-nowrap italic font-mono">
                                                    "{snip}"
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Dynamic HUD Loading */}
                {isSearching && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-[45]">
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative w-24 h-24">
                                <div className="absolute inset-0 border-4 border-brand-cyan/10 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-brand-cyan border-t-transparent rounded-full animate-spin"></div>
                                <div className="absolute inset-4 border-2 border-brand-purple/40 border-b-transparent rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-mono text-brand-cyan animate-pulse uppercase tracking-[0.4em] font-black">Link Established</span>
                                <span className="text-[9px] font-mono text-gray-600 uppercase mt-2 tracking-widest">Querying Cloud Neural Fabric...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tactical Command Input */}
            <div className="p-3 bg-[#050512]/60 border-t border-white/10 backdrop-blur-2xl">
                <form onSubmit={handleSearch} className="relative flex gap-3">
                    <div className="relative flex-1 group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-cyan group-focus-within:animate-ping opacity-60"></div>
                        <input 
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="TRANSMIT GEODETIC REQUEST..."
                            className="w-full bg-black/60 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-[10px] font-mono font-bold text-white placeholder:text-gray-700 focus:outline-none focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20 transition-all uppercase tracking-[0.2em] shadow-inner"
                            disabled={isSearching}
                        />
                    </div>
                    <button 
                        type="submit"
                        disabled={isSearching || !query.trim()}
                        className="bg-brand-cyan/90 text-black px-5 rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-30 disabled:grayscale font-black hover:bg-brand-cyan shadow-[0_0_25px_rgba(0,240,255,0.4)] group"
                    >
                        <svg className="w-4 h-4 transition-transform group-hover:scale-125" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default GoogleMapsPanel;
