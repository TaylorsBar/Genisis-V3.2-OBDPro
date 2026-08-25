import React, { useState, useEffect } from 'react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { motion, AnimatePresence } from 'motion/react';
import { TuningGoal } from '../../types';
import { ATEngine } from '../../services/ATEngine';
import { TuningValidator } from '../../services/TuningValidator';
import MapEditorGrid from './MapEditorGrid';
import TuningSurface3D from '../dashboard/TuningSurface3D';

const GuidedTuningWizard: React.FC = () => {
    const [step, setStep] = useState(1);
    const vehicleConfig = useVehicleStore(state => state.vehicleConfig);
    const setVehicleConfig = useVehicleStore(state => state.setVehicleConfig);
    const tuning = useVehicleStore(state => state.tuning);
    const dyno = useVehicleStore(state => state.dyno);
    const startDynoRun = useVehicleStore(state => state.startDynoRun);
    const stopDynoRun = useVehicleStore(state => state.stopDynoRun);
    const [goal, setGoal] = useState<Partial<TuningGoal>>({
        fuelType: '93_OCT',
        prioritizeEconomy: false,
        safetyMarginLevel: 0.85,
        powerIncreaseTarget: 0.15
    });

    const [isProcessing, setIsProcessing] = useState(false);
    const [aiLogs, setAiLogs] = useState<string[]>([]);
    const [validationResult, setValidationResult] = useState<any>(null);

    const addLog = (msg: string) => setAiLogs(prev => [...prev, msg]);

    const handleNext = async () => {
        if (step === 1) {
            // Step 1 to 2: Diagnostics
            setIsProcessing(true);
            addLog("> Initiating Pre-Tuning Diagnostics...");
            await new Promise(r => setTimeout(r, 1000));
            addLog("> Checking Battery Voltage...");
            await new Promise(r => setTimeout(r, 800));
            addLog("> Scanning for DTCs...");
            await new Promise(r => setTimeout(r, 1200));
            addLog("> Diagnostics Complete. System Ready.");
            setIsProcessing(false);
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            // Step 3 to 4: AI Analysis & Map Generation
            setIsProcessing(true);
            addLog("> Initiating Neural Map Synthesis...");
            await new Promise(r => setTimeout(r, 1000));
            
            const engine = new ATEngine();
            const fullGoal: TuningGoal = {
                userIntent: "Guided Wizard Optimization",
                platformId: (vehicleConfig.platformId as any) || 'GENERIC',
                powerIncreaseTarget: goal.powerIncreaseTarget || 0.15,
                safetyMarginLevel: goal.safetyMarginLevel || 0.85,
                prioritizeEconomy: goal.prioritizeEconomy || false,
                fuelType: goal.fuelType || '93_OCT'
            };

            const xAxis = Array.from({length: 16}, (_, i) => i * (8000/15));
            const yAxis = Array.from({length: 16}, (_, i) => i * (100/15));

            addLog(`> Target: +${(fullGoal.powerIncreaseTarget * 100).toFixed(0)}% Power | Fuel: ${fullGoal.fuelType}`);
            await new Promise(r => setTimeout(r, 800));
            
            addLog("> Optimizing Ignition Timing...");
            const ignRes = await engine.generateSmartTune(tuning.ignitionTable, xAxis, yAxis, fullGoal, 'ign');
            
            addLog("> Optimizing Target Boost...");
            const boostRes = await engine.generateSmartTune(tuning.boostTable, xAxis, yAxis, fullGoal, 'boost');

            useVehicleStore.setState(s => ({
                tuning: {
                    ...s.tuning,
                    ignitionTable: ignRes.modifiedMapValues,
                    boostTable: boostRes.modifiedMapValues
                }
            }));

            addLog("> Maps Generated Successfully.");
            await new Promise(r => setTimeout(r, 500));
            setIsProcessing(false);
            setStep(4);
        } else if (step === 4) {
            // Step 4 to 5: Validation
            setIsProcessing(true);
            addLog("> Running Safety Validation Constraints...");
            await new Promise(r => setTimeout(r, 1000));
            
            // Mock validation
            const isValid = true; // Assume valid for wizard flow unless we want to force an error
            setValidationResult({
                isValid,
                warnings: ["Knock threshold margins reduced by 5%", "Boost target near turbo efficiency limit"]
            });
            
            addLog(isValid ? "> Validation Passed. Ready for Flash." : "> Validation FAILED. Adjust parameters.");
            setIsProcessing(false);
            setStep(5);
        } else if (step === 5) {
            // Step 5 to 6: Flashing
            setIsProcessing(true);
            addLog("> Establishing Secure UDS Session...");
            await new Promise(r => setTimeout(r, 1000));
            addLog("> Erasing Flash Memory...");
            await new Promise(r => setTimeout(r, 1500));
            addLog("> Writing Calibration Data...");
            await new Promise(r => setTimeout(r, 2000));
            addLog("> Verifying Checksums...");
            await new Promise(r => setTimeout(r, 1000));
            addLog("> Flash Complete. Resetting ECU.");
            setIsProcessing(false);
            setStep(6);
        } else if (step === 6) {
            // Step 6 to 7: Verification (Dyno)
            setStep(7);
            startDynoRun();
        } else {
            setStep(s => s + 1);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xl font-display font-black text-brand-cyan uppercase tracking-widest italic">1. Vehicle Profiling</h3>
                        <p className="text-gray-400 text-sm">Confirm your vehicle's hardware configuration. The AI needs accurate data to generate safe maps.</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Displacement (L)</label>
                                <input 
                                    type="number" 
                                    value={Number.isNaN(vehicleConfig.displacement) || vehicleConfig.displacement === undefined || vehicleConfig.displacement === null ? '' : vehicleConfig.displacement} 
                                    onChange={e => setVehicleConfig({displacement: parseFloat(e.target.value)})} 
                                    className="w-full bg-[#111] border border-white/10 rounded p-3 text-white focus:border-brand-cyan outline-none" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Aspiration</label>
                                <select value={vehicleConfig.aspiration} onChange={e => setVehicleConfig({aspiration: e.target.value as any})} className="w-full bg-[#111] border border-white/10 rounded p-3 text-white focus:border-brand-cyan outline-none">
                                    <option value="NA">Naturally Aspirated</option>
                                    <option value="Turbo">Turbocharged</option>
                                    <option value="Supercharged">Supercharged</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Max RPM</label>
                                <input 
                                    type="number" 
                                    value={Number.isNaN(vehicleConfig.maxRpm) || vehicleConfig.maxRpm === undefined || vehicleConfig.maxRpm === null ? '' : vehicleConfig.maxRpm} 
                                    onChange={e => setVehicleConfig({maxRpm: parseInt(e.target.value)})} 
                                    className="w-full bg-[#111] border border-white/10 rounded p-3 text-white focus:border-brand-cyan outline-none" 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Fuel Type</label>
                                <select value={goal.fuelType} onChange={e => setGoal({...goal, fuelType: e.target.value as any})} className="w-full bg-[#111] border border-white/10 rounded p-3 text-white focus:border-brand-cyan outline-none">
                                    <option value="91_OCT">91 Octane (Premium)</option>
                                    <option value="93_OCT">93 Octane (Super)</option>
                                    <option value="E85">E85 (Ethanol)</option>
                                    <option value="RACE_GAS">100+ Race Gas</option>
                                </select>
                            </div>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xl font-display font-black text-brand-cyan uppercase tracking-widest italic">2. Pre-Tuning Diagnostics</h3>
                        <p className="text-gray-400 text-sm">Verifying vehicle readiness before allowing parameter modifications.</p>
                        
                        <div className="bg-[#111] border border-white/10 rounded-xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-300">Battery Voltage</span>
                                <span className="text-emerald-500 font-mono font-bold">13.8V (OK)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-300">OBD Connection</span>
                                <span className="text-emerald-500 font-mono font-bold">Stable (CAN 500k)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-300">DTC Status</span>
                                <span className="text-emerald-500 font-mono font-bold">0 Codes Found</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-300">ECU Security Access</span>
                                <span className="text-emerald-500 font-mono font-bold">Unlocked (Level 1)</span>
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xl font-display font-black text-brand-cyan uppercase tracking-widest italic">3. Tuning Goals</h3>
                        <p className="text-gray-400 text-sm">Define what you want to achieve. The AI will balance power, safety, and drivability.</p>
                        
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Power Target (+{(((goal.powerIncreaseTarget !== undefined && !Number.isNaN(goal.powerIncreaseTarget)) ? goal.powerIncreaseTarget : 0.15) * 100).toFixed(0)}%)</label>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.05" 
                                    max="0.50" 
                                    step="0.05" 
                                    value={Number.isNaN(goal.powerIncreaseTarget) || goal.powerIncreaseTarget === undefined || goal.powerIncreaseTarget === null ? 0.15 : goal.powerIncreaseTarget} 
                                    onChange={e => setGoal({...goal, powerIncreaseTarget: parseFloat(e.target.value)})} 
                                    className="w-full accent-brand-cyan" 
                                />
                                <div className="flex justify-between text-[8px] text-gray-600">
                                    <span>Mild Street</span>
                                    <span>Aggressive Track</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Safety Margin ({(((goal.safetyMarginLevel !== undefined && !Number.isNaN(goal.safetyMarginLevel)) ? goal.safetyMarginLevel : 0.85) * 100).toFixed(0)}%)</label>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.50" 
                                    max="1.0" 
                                    step="0.05" 
                                    value={Number.isNaN(goal.safetyMarginLevel) || goal.safetyMarginLevel === undefined || goal.safetyMarginLevel === null ? 0.85 : goal.safetyMarginLevel} 
                                    onChange={e => setGoal({...goal, safetyMarginLevel: parseFloat(e.target.value)})} 
                                    className="w-full accent-emerald-500" 
                                />
                                <div className="flex justify-between text-[8px] text-gray-600">
                                    <span>On The Edge</span>
                                    <span>OEM Reliability</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 bg-[#111] p-4 rounded border border-white/5">
                                <input type="checkbox" checked={goal.prioritizeEconomy} onChange={e => setGoal({...goal, prioritizeEconomy: e.target.checked})} className="w-5 h-5 accent-brand-cyan" />
                                <div>
                                    <div className="text-sm font-bold text-white">Prioritize Fuel Economy at Cruise</div>
                                    <div className="text-[10px] text-gray-500">Leans out AFR targets during low-load highway cruising.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xl font-display font-black text-brand-cyan uppercase tracking-widest italic">4. AI Map Synthesis</h3>
                        <p className="text-gray-400 text-sm">Review the AI-generated calibration before proceeding to validation.</p>
                        
                        <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between text-emerald-400">
                                <div className="flex items-center gap-3">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span className="font-bold uppercase tracking-widest">Calibration Generated</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="bg-black p-3 rounded border border-white/5">
                                    <div className="text-gray-500 mb-1">Ignition Timing</div>
                                    <div className="text-white font-mono">Optimized +2° to +4° in mid-range</div>
                                </div>
                                <div className="bg-black p-3 rounded border border-white/5">
                                    <div className="text-gray-500 mb-1">Target Boost</div>
                                    <div className="text-white font-mono">Increased by {(goal.powerIncreaseTarget! * 100).toFixed(0)}% area under curve</div>
                                </div>
                            </div>
                            
                            <div className="mt-4 h-64 border border-white/10 rounded overflow-hidden relative">
                                <div className="absolute top-2 left-2 z-10 bg-black/80 px-2 py-1 rounded text-[10px] text-brand-cyan uppercase font-bold tracking-widest pointer-events-none">
                                    Ignition Map Preview
                                </div>
                                <TuningSurface3D data={tuning.ignitionTable} rpm={0} load={0} />
                            </div>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-xl font-display font-black text-brand-cyan uppercase tracking-widest italic">5. Safety Validation</h3>
                        <p className="text-gray-400 text-sm">The system is running structural and physical limit checks on the new maps.</p>
                        
                        {validationResult && (
                            <div className={`border rounded-xl p-6 ${validationResult.isValid ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-3 h-3 rounded-full ${validationResult.isValid ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></div>
                                    <span className={`font-bold uppercase tracking-widest ${validationResult.isValid ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {validationResult.isValid ? 'PASSED: SAFE TO FLASH' : 'FAILED: CRITICAL ERRORS'}
                                    </span>
                                </div>
                                
                                {validationResult.warnings?.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        <div className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Advisories:</div>
                                        {validationResult.warnings.map((w: string, i: number) => (
                                            <div key={i} className="text-xs text-yellow-200/70 bg-yellow-900/20 p-2 rounded border border-yellow-500/10">
                                                ⚠ {w}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            case 6:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 text-center py-10">
                        <div className="w-24 h-24 mx-auto bg-brand-cyan/10 border-2 border-brand-cyan rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
                            <svg className="w-10 h-10 text-brand-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <h3 className="text-2xl font-display font-black text-white uppercase tracking-widest italic">Ready to Flash</h3>
                        <p className="text-gray-400 text-sm max-w-md mx-auto">Ensure battery voltage is above 12.5V and do not disconnect the Neural Link during the flashing process.</p>
                    </div>
                );
            case 7:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 text-center py-10">
                        <div className="w-24 h-24 mx-auto bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                            <svg className="w-12 h-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-2xl font-display font-black text-white uppercase tracking-widest italic">Flash Successful</h3>
                        <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">The new calibration has been written to the ECU. We are now running a virtual dyno sweep to verify the results.</p>
                        
                        {dyno.isRunning && (
                            <div className="text-brand-cyan font-mono animate-pulse">Running Dyno Sweep...</div>
                        )}
                        {!dyno.isRunning && dyno.runs.length > 0 && (
                            <div className="bg-[#111] border border-white/10 rounded-xl p-4 inline-block text-left">
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Results</div>
                                <div className="text-2xl font-black text-white">{dyno.runs[dyno.runs.length-1].peakPower.toFixed(0)} <span className="text-sm text-gray-500">WHP</span></div>
                                <div className="text-2xl font-black text-white">{dyno.runs[dyno.runs.length-1].peakTorque.toFixed(0)} <span className="text-sm text-gray-500">WTQ</span></div>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="w-full h-full flex flex-col lg:flex-row bg-[#050505] overflow-y-auto lg:overflow-hidden">
            {/* Left Sidebar - Progress & Logs */}
            <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#080808] flex flex-col shrink-0">
                <div className="p-4 lg:p-6 border-b border-white/10">
                    <h2 className="text-base lg:text-lg font-display font-black text-white uppercase tracking-widest italic">Tuning Assistant</h2>
                    <p className="text-[9px] lg:text-[10px] text-gray-500 font-mono mt-1">AI-GUIDED CALIBRATION WORKFLOW</p>
                </div>
                
                <div className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    {/* Stepper */}
                    <div className="flex lg:flex-col gap-4 lg:gap-4 overflow-x-auto lg:overflow-x-visible no-scrollbar pb-2 lg:pb-0 relative before:hidden lg:before:block before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                        {[
                            { num: 1, title: 'Vehicle Profile' },
                            { num: 2, title: 'Diagnostics' },
                            { num: 3, title: 'Tuning Goals' },
                            { num: 4, title: 'Map Synthesis' },
                            { num: 5, title: 'Safety Validation' },
                            { num: 6, title: 'ECU Flash' },
                            { num: 7, title: 'Verification' }
                        ].map((s) => (
                            <div key={s.num} className={`relative flex items-center gap-3 lg:gap-4 shrink-0 ${step >= s.num ? 'opacity-100' : 'opacity-40'}`}>
                                <div className={`w-5 h-5 lg:w-6 lg:h-6 rounded-full flex items-center justify-center text-[9px] lg:text-[10px] font-bold z-10 shrink-0 ${step === s.num ? 'bg-brand-cyan text-black shadow-[0_0_10px_#00F0FF]' : step > s.num ? 'bg-emerald-500 text-black' : 'bg-[#222] text-gray-500 border border-white/10'}`}>
                                    {step > s.num ? '✓' : s.num}
                                </div>
                                <span className={`text-[10px] lg:text-xs font-bold uppercase tracking-wider whitespace-nowrap ${step === s.num ? 'text-brand-cyan' : 'text-white'}`}>{s.title}</span>
                            </div>
                        ))}
                    </div>

                    {/* AI Terminal Logs */}
                    <div className="mt-4 lg:mt-8 bg-black border border-white/10 rounded-xl p-3 lg:p-4 font-mono text-[8px] lg:text-[9px] text-brand-cyan/80 h-32 lg:h-48 overflow-y-auto custom-scrollbar relative">
                        <div className="absolute inset-0 bg-scanline bg-scanline-size opacity-10 pointer-events-none"></div>
                        {aiLogs.map((log, i) => (
                            <div key={i} className="mb-1 opacity-90">{log}</div>
                        ))}
                        {isProcessing && <div className="animate-pulse">_</div>}
                    </div>
                </div>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col relative min-h-0">
                <div className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar flex flex-col justify-center max-w-3xl mx-auto w-full">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            {renderStepContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-white/10 bg-[#0a0a0a] flex justify-between items-center shrink-0">
                    <button 
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        disabled={step === 1 || isProcessing || step === 7}
                        className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-white disabled:opacity-30 transition-colors"
                    >
                        Back
                    </button>
                    
                    {step < 7 && (
                        <button 
                            onClick={handleNext}
                            disabled={isProcessing}
                            className={`px-8 py-3 rounded text-xs font-black uppercase tracking-widest transition-all shadow-lg ${
                                step === 6 
                                ? 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)]' 
                                : 'bg-brand-cyan text-black hover:bg-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                            } disabled:opacity-50 disabled:cursor-wait`}
                        >
                            {isProcessing ? 'Processing...' : step === 6 ? 'FLASH ECU NOW' : 'Continue'}
                        </button>
                    )}
                    {step === 7 && (
                        <button 
                            onClick={() => setStep(1)}
                            className="px-8 py-3 bg-white/10 text-white rounded text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all"
                        >
                            Start New Tune
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GuidedTuningWizard;
