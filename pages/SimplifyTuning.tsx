
import React, { useState } from 'react';
import { MemoryProtector } from '../services/MemoryProtector';
import { EcuVariant } from '../services/UdsSecurityService';
import { useVehicleStore } from '../stores/vehicleStore';

const SimplifyTuning: React.FC = () => {
    const [idleRpm, setIdleRpm] = useState(750);
    const [launchRpm, setLaunchRpm] = useState(3000);
    const [status, setStatus] = useState<'idle' | 'authorizing' | 'writing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const runTuningSequence = async (featureId: string, value: number) => {
        setStatus('authorizing');
        setMessage('Establishing secure link...');
        
        // 1. Safety Check
        const safeCheck = MemoryProtector.isSafeToWrite(featureId, value);
        if (!safeCheck.safe) {
            setStatus('error');
            setMessage(`Safety Blocked: ${safeCheck.reason}`);
            return;
        }

        // 2. Auth Sequence
        const secured = await useVehicleStore.getState().requestSecurityAccess(EcuVariant.INFINITI_VQ37);
        if (!secured) {
            setStatus('error');
            setMessage('ECU Authorization failed.');
            return;
        }

        // 3. Write Sequence (Simulated)
        setStatus('writing');
        setMessage('Flashing optimized parameters...');
        await new Promise(r => setTimeout(r, 2000)); // Simulate write
        
        setStatus('success');
        setMessage('Tune applied successfully.');
    };

    return (
        <div className="p-6 text-white max-w-lg mx-auto">
            <h1 className="text-2xl font-black italic tracking-widest mb-6">INTUITIVE TUNING</h1>
            
            <div className="bg-[#111] p-6 rounded-xl border border-white/10 space-y-6">
                <div>
                    <label className="block text-sm font-bold mb-2">Idle Stability (Ghost Cam)</label>
                    <input 
                        type="range" min="650" max="950" value={idleRpm}
                        onChange={(e) => setIdleRpm(Number(e.target.value))}
                        className="w-full accent-brand-cyan"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Smooth</span>
                        <span className="text-brand-cyan font-bold">{idleRpm} RPM</span>
                        <span>Aggressive</span>
                    </div>
                </div>

                <button 
                    onClick={() => runTuningSequence('GHOST_CAM', idleRpm)}
                    disabled={status === 'authorizing' || status === 'writing'}
                    className="w-full py-3 bg-brand-cyan text-black font-bold uppercase tracking-widest rounded transition-all hover:bg-white"
                >
                    Apply Idle Tune
                </button>
            </div>

            {/* Status Feedback */}
            {status !== 'idle' && (
                <div className={`mt-4 p-4 rounded text-xs font-mono uppercase ${status === 'error' ? 'bg-red-950 text-red-200' : 'bg-white/5'}`}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default SimplifyTuning;
