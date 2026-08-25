import React from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { CheckCircle2, XCircle, AlertCircle, Cpu, ShieldCheck, Activity, Wifi } from 'lucide-react';
import { ObdConnectionState } from '../../types';

export const ECUReadyStatus: React.FC = () => {
    const obdState = useVehicleStore(state => state.obdState);
    const uds = useVehicleStore(state => state.uds);
    const hardwareLink = useVehicleStore(state => state.hardwareLink);
    const ecuProfile = useVehicleStore(state => state.ecuProfile);
    const calibrationStatus = useVehicleStore(state => state.calibrationStatus);
    const isCalibrating = useVehicleStore(state => state.isCalibrating);

    const systems = [
        {
            name: 'OBD II LINK',
            status: obdState === ObdConnectionState.Connected ? 'LIVE' : obdState === ObdConnectionState.Connecting ? 'PENDING' : 'OFFLINE',
            icon: Wifi,
            color: obdState === ObdConnectionState.Connected ? 'text-brand-cyan' : obdState === ObdConnectionState.Connecting ? 'text-yellow-500' : 'text-zinc-600',
            glow: obdState === ObdConnectionState.Connected ? 'shadow-[0_0_10px_rgba(0,240,255,0.3)]' : '',
            details: obdState === ObdConnectionState.Connected ? 'Neural Bridge Stable' : 'Awaiting physical link'
        },
        {
            name: 'UDS SECURITY',
            status: uds.securityAccess ? 'GRANTED' : 'RESTRICTED',
            icon: ShieldCheck,
            color: uds.securityAccess ? 'text-brand-purple' : 'text-zinc-600',
            glow: uds.securityAccess ? 'shadow-[0_0_10px_rgba(188,19,254,0.3)]' : '',
            details: uds.securityAccess ? 'Service 0x27 Seed/Key Valid' : 'Unlocking required for 0x2E'
        },
        {
            name: 'UDS SESSION',
            status: uds.session === 1 ? 'DEFAULT' : uds.session === 3 ? 'EXTENDED' : uds.session === 2 ? 'PROGRAM' : 'UNKNOWN',
            icon: Cpu,
            color: uds.session > 1 ? 'text-orange-400' : 'text-zinc-600',
            glow: uds.session > 1 ? 'shadow-[0_0_10px_rgba(251,146,60,0.3)]' : '',
            details: `Active Session: 0x${uds.session.toString(16).padStart(2, '0')}`
        },
        {
            name: 'PHYSICAL SAFETY',
            status: useVehicleStore.getState().latestData.rpm > 500 ? 'ENGINE_RUN' : 'SECURE',
            icon: AlertCircle,
            color: useVehicleStore.getState().latestData.rpm > 500 ? 'text-brand-red' : 'text-emerald-400',
            glow: useVehicleStore.getState().latestData.rpm <= 500 ? 'shadow-[0_0_10px_rgba(16,185,129,0.3)]' : '',
            details: useVehicleStore.getState().latestData.rpm > 500 ? 'Write Inhibit Active (RPM > 500)' : 'Safe for RAM writing'
        }
    ];

    return (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/5 blur-[50px] -mr-16 -mt-16 rounded-full pointer-events-none"></div>
            
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex flex-col">
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic flex items-center gap-2">
                        System Readiness Report
                    </h3>
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                        Detected: {ecuProfile?.platformId || 'GENERIC'} ECU
                    </span>
                </div>
                {obdState === ObdConnectionState.Connected && uds.securityAccess && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand-cyan/10 border border-brand-cyan/30 rounded text-[8px] font-black text-brand-cyan animate-pulse shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                        <ShieldCheck size={10} />
                        VERIFIED LIVE
                    </div>
                )}
                {obdState === ObdConnectionState.Connected && !uds.securityAccess && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 rounded text-[8px] font-black text-yellow-500">
                        <AlertCircle size={10} />
                        READY (RESTRICTED)
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systems.map((s, i) => (
                    <div key={i} className={`p-4 rounded-xl border bg-black/60 flex flex-col gap-3 transition-all group hover:border-white/20 ${s.status === 'LIVE' || s.status === 'GRANTED' || s.status === 'READY' || s.status === 'VERIFIED' ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                                <span className="text-[9px] font-black text-zinc-400 tracking-widest uppercase">{s.name}</span>
                            </div>
                            <span className={`text-[9px] font-mono font-black ${s.color} italic ${s.glow}`}>{s.status}</span>
                        </div>
                        <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full bg-current transition-all duration-1000 ${s.color}`} style={{ width: s.status === 'OFFLINE' || s.status === 'RESTRICTED' || s.status === 'IDLE' ? '10%' : '100%' }}></div>
                        </div>
                        <span className="text-[8px] font-medium text-zinc-600 truncate uppercase tracking-wider">{s.details}</span>
                    </div>
                ))}
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${obdState === ObdConnectionState.Connected ? 'bg-brand-cyan animate-pulse' : 'bg-zinc-800'}`}></div>
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Neural Link: {obdState}</span>
                </div>
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest italic opacity-50">v5.5.0-STABLE</span>
            </div>
        </div>
    );
};
