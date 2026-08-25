import React, { useState, useEffect, useRef } from 'react';
import { VehicleDynamics, TireDynamicsModel } from '../../services/ATEngine';
import { getLiveCoaching } from '../../services/geminiService';
import { edgeAICoach } from '../../services/EdgeAICoach';
import { SensorDataPoint } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useVehicleStore } from '../../stores/vehicleStore';
import { ObdConnectionState } from '../../types';

interface LiveAICoachProps {
    history?: SensorDataPoint[];
}

interface CoachMessage {
    id: string;
    text: string;
    type: 'info' | 'warning' | 'critical' | 'praise';
    timestamp: number;
    isAI?: boolean;
}

const LiveAICoach: React.FC<LiveAICoachProps> = () => {
    const [messages, setMessages] = useState<CoachMessage[]>([]);
    const lastMessageTimeRef = useRef<number>(0);
    const lastMessageTypeRef = useRef<string>('');
    const lastAIAnalysisTimeRef = useRef<number>(0);

    const addMessage = React.useCallback((text: string, type: CoachMessage['type'], isAI = false) => {
        const now = Date.now();
        // Prevent spamming the same message type within 3 seconds (unless it's AI)
        if (!isAI && lastMessageTypeRef.current === text && (now - lastMessageTimeRef.current < 3000)) {
            return;
        }
        
        if (!isAI) {
            lastMessageTimeRef.current = now;
            lastMessageTypeRef.current = text;
        }

        setMessages(prev => {
            // Prevent exact duplicates in the current list
            if (prev.some(m => m.text === text && now - m.timestamp < 10000)) {
                return prev;
            }
            
            const newMsg = { id: Math.random().toString(36).substr(2, 9), text, type, timestamp: now, isAI };
            // Filter out old AI messages if we have a new one
            const filtered = isAI ? prev.filter(m => !m.isAI) : prev;
            return [newMsg, ...filtered].slice(0, 4); // Keep last 4 messages
        });
    }, []);

    // Rule-based & ML Analysis (Immediate)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastMessageTimeRef.current < 500) return;

            const state = useVehicleStore.getState();
            const d = state.latestData;
            const ml = state.mlInsights;
            
            const speed = d.speed || 0;
            const throttle = d.throttlePos || 0;
            const brake = d.brakeTemp ? (d.brakeTemp > 100 ? 50 : 0) : 0;
            const latG = d.gForceX || 0;
            const lonG = d.gForceY || 0;

            const dynamicLimit = TireDynamicsModel.getDynamicFrictionLimit(speed);
            const gripUtil = VehicleDynamics.getGripUtilization(latG, lonG, dynamicLimit);
            const slipAngle = VehicleDynamics.estimateSlipAngle(latG, speed);

            const estimatedBrake = brake > 0 ? brake : (lonG < -0.2 ? Math.min(100, Math.abs(lonG) * 80) : 0);

            // ML Insights
            if (ml.anomalies.knock) {
                addMessage("CRITICAL: Engine Knock Anomaly Detected!", "critical");
            } else if (ml.anomalies.o2) {
                addMessage("WARNING: O2 Sensor Variance Anomaly.", "warning");
            } else if (ml.slipProbability > 0.8) {
                addMessage("High Traction Loss Probability Detected (ML).", "critical");
            } else if (ml.driverScore < 50) {
                addMessage(`Aggressive inputs detected. Smooth out. (Score: ${ml.driverScore.toFixed(0)})`, "warning");
            } else if (gripUtil > 98) {
                addMessage("At grip limit! Smooth inputs.", "warning");
            } else if (gripUtil > 85 && Math.abs(latG) > 0.8 && throttle > 80) {
                addMessage("High lateral load. Careful on throttle.", "warning");
            } else if (Math.abs(slipAngle) > 8) {
                addMessage("High slip angle detected. Counter-steer ready.", "critical");
            } else if (estimatedBrake > 80 && Math.abs(lonG) > 1.0) {
                if (Math.abs(latG) < 0.2) {
                    addMessage("Excellent threshold braking.", "praise");
                } else {
                    addMessage("Trail braking deep. Watch rear stability.", "info");
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [addMessage]);

    // Edge AI Analysis (Local, Low Latency)
    useEffect(() => {
        const runEdgeAnalysis = async () => {
            const state = useVehicleStore.getState();
            // Only run if we are actually moving or connected
            if (state.obdState !== ObdConnectionState.Connected && state.latestData.speed === 0) return;

            const d = state.latestData;
            const telemetry = [d.speed || 0, d.gForceX || 0, d.gForceY || 0, d.throttlePos || 0, d.brakeTemp ? (d.brakeTemp > 100 ? 50 : 0) : 0, d.rpm || 0, d.gear || 0];
            const advice = await edgeAICoach.predictCoachingAction(telemetry);
            
            // Filter out generic/spammy messages
            if (advice === "Maintaining optimal pace." || advice === "Focus on consistency.") {
                return;
            }

            // Only add if it's different from the last rule-based message
            if (advice && advice !== lastMessageTypeRef.current) {
                addMessage(advice, "info", true);
                // Update ref so we don't spam the exact same AI message
                lastMessageTypeRef.current = advice;
                lastMessageTimeRef.current = Date.now();
                
                // Only learn from significant events
                edgeAICoach.learnFromHabit(telemetry, advice);
            }
        };

        const interval = setInterval(runEdgeAnalysis, 5000); // Local AI every 5 seconds instead of 2
        return () => clearInterval(interval);
    }, [addMessage]);

    // AI-based Analysis (Periodic, Cloud)
    useEffect(() => {
        const runAIAnalysis = async () => {
            const history = useVehicleStore.getState().data;
            if (history.length < 20) return;
            
            const now = Date.now();
            if (now - lastAIAnalysisTimeRef.current < 20000) return; // Every 20 seconds (increased from 8)

            lastAIAnalysisTimeRef.current = now;
            const result = await getLiveCoaching(history);
            if (result && result.text && result.text !== "Analyzing telemetry...") {
                addMessage(result.text, result.type, true);
            }
        };

        const interval = setInterval(runAIAnalysis, 5000); // Check every 5 seconds if we should run analysis
        return () => clearInterval(interval);
    }, [addMessage]);

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2 whitespace-nowrap">
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 animate-pulse" />
                Live AI Telemetry Coach
            </div>
            <div className="h-[140px] overflow-hidden relative flex flex-col justify-end">
                <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1 - (i * 0.2), y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                            className={`p-3 rounded-md mb-2 border-l-4 text-sm font-mono backdrop-blur-md relative ${
                                msg.type === 'critical' ? 'bg-red-900/40 border-red-500 text-red-100' :
                                msg.type === 'warning' ? 'bg-yellow-900/40 border-yellow-500 text-yellow-100' :
                                msg.type === 'praise' ? 'bg-green-900/40 border-green-500 text-green-100' :
                                'bg-blue-900/40 border-blue-500 text-blue-100'
                            }`}
                        >
                            {msg.isAI && (
                                <div className="absolute -top-2 -right-2 bg-blue-600 text-[8px] px-1 rounded-sm font-black uppercase tracking-tighter">AI</div>
                            )}
                            {msg.text}
                        </motion.div>
                    ))}
                </AnimatePresence>
                {messages.length === 0 && (
                    <div className="text-gray-600 text-xs font-mono italic p-3">
                        Analyzing telemetry...
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveAICoach;
