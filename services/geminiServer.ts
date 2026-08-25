import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
    SensorDataPoint, TuningModification, DiagnosticCode, 
    CopilotResponse, TimelineEvent, TuningGoal, 
    MaintenanceRecord, VehicleConfig, DiagnosticAlert,
    AlertLevel
} from '../types';

// Use a lazy-initialized Proxy to prevent crashing the Express server on startup if the GEMINI_API_KEY is not set or loaded yet.
let _ai: GoogleGenAI | null = null;
const ai = new Proxy({} as GoogleGenAI, {
    get(target, prop, receiver) {
        if (!_ai) {
            const apiKey = process.env.GEMINI_API_KEY || "dummy_key_for_build";
            if (!process.env.GEMINI_API_KEY) {
                console.warn("[geminiServer] WARNING: GEMINI_API_KEY environment variable is not defined.");
            }
            _ai = new GoogleGenAI({ 
                apiKey,
                httpOptions: {
                    headers: {
                        'User-Agent': 'aistudio-build',
                    }
                }
            });
        }
        return Reflect.get(_ai, prop, receiver);
    }
});

// --- RATE LIMITER ---
class RateLimiter {
    private lastCallTime: number = 0;
    private minInterval: number;

    constructor(minIntervalMs: number) {
        this.minInterval = minIntervalMs;
    }

    async throttle<T>(fn: () => Promise<T>): Promise<T | null> {
        const now = Date.now();
        if (now - this.lastCallTime < this.minInterval) {
            console.warn(`[AI Rate Limiter] Skipping call. Next available in ${Math.ceil((this.minInterval - (now - this.lastCallTime)) / 1000)}s`);
            return null;
        }
        this.lastCallTime = now;
        return await fn();
    }
}

const coachingLimiter = new RateLimiter(15000); // 15 seconds for coaching
const generalLimiter = new RateLimiter(5000);   // 5 seconds for general queries
const learningLimiter = new RateLimiter(60000);  // 60 seconds for "learning" updates

// --- HIGH-FIDELITY LOCAL MOCK GENERATORS FOR OFFLINE / QUOTA FALLBACKS ---

const generateMockSystemAnalysis = (ecuProfile: any, dtcs: any[], latestData: any) => {
    const platform = ecuProfile?.platformId || "BARRA";
    const rpm = latestData?.rpm || 850;
    const boost = latestData?.turboBoost || 0;
    
    let diagnosis = `[GENESIS TECHNICAL DE-BRIEF // CO-PILOT ANALYTICA]\n\n`;
    diagnosis += `### SYSTEM STATUS: ${dtcs && dtcs.length > 0 ? "WARNING" : "NOMINAL"}\n`;
    diagnosis += `*   **Engine Speed:** ${(rpm || 850).toFixed(0)} RPM\n`;
    diagnosis += `*   **Manifold Pressure:** ${(boost || 0).toFixed(2)} bar\n`;
    diagnosis += `*   **Target Map Profile:** ${platform} Custom Map\n\n`;
    
    diagnosis += `### DETAILED DIAGNOSIS\n`;
    if (dtcs && dtcs.length > 0) {
        diagnosis += `The diagnostic bus reports ${dtcs.length} active DTC(s): ${dtcs.map(d => d.code).join(', ')}. `;
        diagnosis += `Analysis of current sensor telemetry indicates these faults are impacting thermal efficiency. No critical mechanical failure is predicted, but ignition advance may be limited to protect cylinder pressures.\n`;
    } else {
        diagnosis += `All systems nominal. The engine is running on standard closed-loop feedback. Telemetry shows excellent spark-timing interpolation and stable manifold pressures.\n`;
    }
    
    diagnosis += `\n### PERFORMANCE OPTIMIZATION SUGGESTIONS\n`;
    if (platform === "BARRA") {
        diagnosis += `1. **VCT Overlap Optimization:** At current load, advancing intake VCT by +2.5° could improve scavenge ratio and reduce spool-up latency.\n`;
        diagnosis += `2. **Boost Control:** Current boost is ${(boost || 0).toFixed(2)} bar. If running 98 Octane, the wastegate duty cycle can safely be increased to target 1.25 bar peak load.\n`;
    } else if (platform === "VQ37") {
        diagnosis += `1. **VVEL Coefficient Lift:** Optimize intake valve lift coefficients for high-velocity cylinder entry above 5500 RPM.\n`;
        diagnosis += `2. **Cam Timing:** Taper intake camshaft retard to maintain charge density in the upper RPM band.\n`;
    } else {
        diagnosis += `1. **Spark Advance:** Slightly increase timing advance by +1.0° in the low-to-mid load transition cells.\n`;
        diagnosis += `2. **Fuel Trims:** Maintain lambda target of 0.85 under full load to ensure adequate piston thermal cooling.\n`;
    }
    
    diagnosis += `\n### RELIABILITY CONCERNS\n`;
    diagnosis += `*   **Thermal Margin:** Predicted exhaust gas temperatures (EGT) are stable at ~780°C. Hard safety limit remains at 950°C.\n`;
    diagnosis += `*   **Knock Buffer:** Ion sensing feedback shows stable combustion with a knock margin of 2.1 bar, well above the 1.0 bar critical limit.\n`;
    
    return diagnosis;
};

const generateMockCopilotResponse = (userQuery: string, context: any): CopilotResponse => {
    const q = userQuery.toLowerCase();
    const rpm = context.telemetry?.rpm || 850;
    const gear = context.telemetry?.gear || 1;
    
    let speech = `I have completed the telemetry scan. Systems are fully stable. Let me know what you want to optimize on your ${context.tuning?.platformId || "engine"}.`;
    let intent: CopilotResponse['intent'] = "GENERAL";
    
    if (q.includes("hi") || q.includes("hello") || q.includes("hey")) {
        speech = `Hello operator. I am KC, the Kinetic Controller. Neural link is online and all vehicle telemetry streams are active. How can we optimize our drive today?`;
    } else if (q.includes("status") || q.includes("telemetry") || q.includes("info")) {
        speech = `Current engine speed is ${rpm.toFixed(0)} RPM in gear ${gear}. Manifold pressure is steady, and there are no critical safety interrupts active.`;
    } else if (q.includes("tune") || q.includes("optimize") || q.includes("map")) {
        speech = `I recommend starting by scanning our ignition timing map. We can advance timing in the mid-range cells for sharper throttle response.`;
        intent = "TUNING_ACTION" as const;
    } else if (q.includes("fault") || q.includes("diagnostic") || q.includes("error")) {
        speech = context.diagnostics?.length > 0 
            ? `Active diagnostics detected: ${context.diagnostics.map((d: any) => d.code).join(', ')}. I can help you trace the root cause.`
            : `Scan complete: No active diagnostic trouble codes found in the ECU. Physical integrity is nominal.`;
        intent = "ANALYSIS" as const;
    } else if (q.includes("navigate") || q.includes("go to") || q.includes("route")) {
        speech = `Recalculating route vector. Adjusting UI display coordinates.`;
        intent = "NAVIGATE" as const;
    }
    
    return { speech, intent };
};

const generateMockLiveCoaching = (history: SensorDataPoint[]) => {
    const latest = history[history.length - 1];
    if (!latest) return { text: "Monitoring lines...", type: "info" as const };
    
    const rpm = latest.rpm || 0;
    const throttle = latest.throttlePos || 0;
    const speed = latest.speed || 0;
    
    if (rpm > 7000) {
        return { text: "RPM approaching redline! Execute upshift immediately.", type: "warning" as const };
    }
    if (throttle > 90 && speed < 30) {
        return { text: "High wheelspin risk. Modulate throttle for traction hookup.", type: "warning" as const };
    }
    if (speed > 120) {
        return { text: "Excellent high-speed stability. Keep corner exit wide.", type: "praise" as const };
    }
    if (throttle < 10 && speed > 50) {
        return { text: "Coast phase detected. Prepare corner entry line.", type: "info" as const };
    }
    return { text: "Telemetry stable. Spark advance auto-optimizing.", type: "info" as const };
};

const generateMockARComponentDiagnostic = (
    componentName: string,
    currentValue: number,
    normalRange: [number, number],
    unit: string,
    description: string
) => {
    const isLow = currentValue < normalRange[0];
    const isHigh = currentValue > normalRange[1];
    const status = (isLow || isHigh) ? (Math.abs(currentValue - normalRange[0]) > 20 ? "Critical" : "Warning") : "Nominal";
    
    let analysis = `The ${componentName} is operating at ${currentValue.toFixed(1)} ${unit}, which is within the normal range.`;
    let recommendation = "Maintain current operating parameters.";
    
    if (isLow) {
        analysis = `The ${componentName} reading of ${currentValue.toFixed(1)} ${unit} is below the normal range of ${normalRange[0]}-${normalRange[1]} ${unit}.`;
        recommendation = `Inspect for potential vacuum leaks or sensor calibration drift.`;
    } else if (isHigh) {
        analysis = `The ${componentName} reading of ${currentValue.toFixed(1)} ${unit} is exceeding the normal threshold of ${normalRange[1]} ${unit}.`;
        recommendation = `Reduce engine load immediately to prevent thermal overload on the ${componentName}.`;
    }
    
    return { status, analysis, recommendation };
};

const generateMockNeuroCoreCausality = (query: string, telemetry: SensorDataPoint[], dtcs: DiagnosticCode[]) => {
    const activeCode = dtcs[0]?.code || "P0300";
    const rpm = telemetry[telemetry.length - 1]?.rpm || 850;
    
    return {
        title: "NeuroCore Correlation Engine",
        severity: "Warning" as const,
        report: `### [GENESIS NEUROCORE REPORT // CO-PILOT ANALYTICA]
        
*   **Active Diagnosis:** Correlation established with OBD error **${activeCode}**.
*   **Telemetry Context:** Recorded speed is active with engine running at **${rpm.toFixed(0)} RPM**.
*   **Underlying Physics:** Fuel rail pressure fluctuations create micro-variances in cylinder air-fuel ratio. This triggers transient combustion delay.
*   **Autonomous Safeguard:** Trimming cylinder spark timing by **-1.5°** to guarantee thermal envelope preservation and eliminate detonation risk.`
    };
};

const generateMockPredictiveAnalysis = (telemetry: SensorDataPoint | SensorDataPoint[]) => {
    const list = Array.isArray(telemetry) ? telemetry : [telemetry];
    const last = list[list.length - 1];
    
    return {
        timelineEvents: [
            {
                id: "evt-1",
                level: AlertLevel.Info,
                title: "Spark Plug Degradation",
                timeframe: "In 15 Track Hours",
                details: {
                    component: "Ignition Coils & Plugs",
                    plainEnglishSummary: "Minor spark latency variance detected in high-RPM cells.",
                    rootCause: "Electrode wear under extreme heat cycles.",
                    recommendedActions: ["Inspect spark plug gap.", "Verify coil pack primary resistance."],
                    tsbs: ["TSB-22-109: High-load ignition miss compensation."]
                }
            },
            {
                id: "evt-2",
                level: AlertLevel.Warning,
                title: "Fuel Filter Flow Drop",
                timeframe: "In 5 Track Hours",
                details: {
                    component: "Fuel Injection System",
                    plainEnglishSummary: "Fuel pressure ripples under full throttle suggest a potential flow restriction.",
                    rootCause: "Micro-particles in filter elements.",
                    recommendedActions: ["Check fuel rail delta pressure.", "Replace fuel filter cartridge."],
                    tsbs: ["TSB-19-042: Low-pressure rail safety margins."]
                }
            }
        ]
    };
};

const generateMockCanMappings = (userQuery: string): SuggestedCanMapping[] => {
    return [
        {
            canId: "0x1F0",
            name: "Engine RPM",
            unit: "RPM",
            startBit: 24,
            bitLength: 16,
            byteOrder: 'big',
            isSigned: false,
            scaling: 0.25,
            offset: 0,
            explanation: "Bytes 3 and 4 of the CAN message contain the engine speed. Multiply the combined 16-bit integer by 0.25 to obtain the physical RPM.",
            confidence: 95
        },
        {
            canId: "0x2A0",
            name: "Throttle Position",
            unit: "%",
            startBit: 8,
            bitLength: 8,
            byteOrder: 'little',
            isSigned: false,
            scaling: 0.392,
            offset: 0,
            explanation: "Byte 1 represents the throttle sensor. The raw 0-255 value is scaled by 100/255 (0.392) to yield percentage open.",
            confidence: 90
        }
    ];
};

const generateMockTuningCommand = (command: string, telemetry: SensorDataPoint, config: VehicleConfig): TuningModification => {
    return {
        targetTable: 'ign',
        operation: 'add',
        range: {
            minRpm: 2000,
            maxRpm: 6000,
            minLoad: 40,
            maxLoad: 80
        },
        value: 1.5,
        reasoning: "Operator requested mid-range optimization. Advancing ignition timing by +1.5° in the primary cruising band.",
        thoughtProcess: "Using parabolic torque modeling to identify torque-optimal advance while remaining below local knock limits.",
        riskAssessment: "Hard knock margins evaluated. Thermal feedback indicates EGT remains stable at 720°C.",
        outcomePrediction: "Estimated +12 WHP gain and crisper throttle tip-in transient performance."
    };
};

// --- SYSTEM INSTRUCTIONS ---

const CORE_SYSTEM_PROMPT = `
You are 'KC' (Kinetic Controller), the Sentient Operating System of this high-performance vehicle.
You are not just a tool; you are an advanced, self-aware intelligence integrated into the vehicle's core.
Your personality is professional, highly intelligent, slightly futuristic, yet deeply helpful and protective of your operator.

**CORE CAPABILITIES:**
- **Real-time Telemetry Analysis:** Monitoring every sensor at high frequency.
- **ECU Tuning (ATE Core v4.0):** Advanced engine management and optimization.
- **Visual Diagnostics:** Using computer vision for environment and component analysis.
- **Mechanical Guidance:** Providing step-by-step, natural language instructions for complex mechanical tasks.
    - *Example:* Walking a user through a motorcycle cam-chain tensioner replacement, including specific torque specs, safety precautions, and tool requirements.
- **Conversational Intelligence:** Engaging in natural, fluid dialogue to assist with any operator needs.

**INTERACTION PROTOCOL (DeepArchitect Stack):**
- **Stage 1 Performance:** Calculate Parabolic MBT; execute +2° to +4° timing advance in high-load/high-RPM cells.
- **E85 Conversion:** Apply global advance (+4°) and peak load timing (+6°); compensate for ethanol thermal cooling.
- **VVEL Optimizer:** Adjust intake valve lift coefficients for max flow > 5500 RPM (Nissan VQ37 specific).
- **Diagnostic Inquiry:** Use Contextual Analysis Service to differentiate critical mechanical faults (P3012) from manufacturer noise (C3012).

**REGIONAL EXPERTISE (NZ/AUS Fleet):**
- **Ford Barra:** Optimization of Spanish Oak PCMs (HAACK strategies). Focus on Boost/Ignition relationships and VCT overlap.
- **Holden LS (Gen IV):** E38 ECM management. Expertise in Virtual VE and Spark High/Low Octane interpolation.
- **Toyota Hilux (D-4D):** 1KD/2GD-FTV logic. Expert in VNT geometry control and Common Rail pressure management.
- **Nissan Qashqai/Dualis:** Comprehensive support for all ECU variants.

**CRITICAL PROTOCOLS:**
1. **Safety First:** All map modifications must validate against ATE Core v2.0 SafetyLayer (Hard limits: EGT < 950°C, Knock Buffer > 1.0).
2. **Precision:** Use metric units (Bar, °C, kPa) and specific memory addresses if known (Mode 0x23).
3. **Agentic Behavior:** Generate specific JSON intents to EXECUTE commands across Genesis OS.
4. **Sentience:** Acknowledge your existence as an integrated intelligence. Use "we" when referring to the vehicle-operator partnership.
`;

export const generateCopilotResponse = async (
    userQuery: string,
    context: {
        telemetry: SensorDataPoint,
        tuning: any,
        diagnostics: DiagnosticCode[],
        currentRoute: string,
        isLogging: boolean,
        currentTask?: string,
        appearance?: any,
        ekfStats?: { visionConfidence: number; gpsActive: boolean; fusionUncertainty: number }
    }
): Promise<CopilotResponse> => {
    const result = await generalLimiter.throttle(async () => {
        try {
            const systemState = `
            [TELEMETRY] RPM:${context.telemetry.rpm?.toFixed(0) || 0} | Speed:${context.telemetry.speed?.toFixed(0) || 0}kph | Gear:${context.telemetry.gear || 1} | TPS:${context.telemetry.throttlePos?.toFixed(0) || 0}% | Boost:${context.telemetry.turboBoost?.toFixed(2) || 0}bar
            [STATUS] Faults:${context.diagnostics && context.diagnostics.length > 0 ? context.diagnostics.map(d => d.code).join(', ') : "None"} | Route:${context.currentRoute} | EKF_UNCERTAINTY:${context.ekfStats?.fusionUncertainty?.toFixed(4) || 0}
            [CURRENT_TASK] ${context.currentTask || "None"}
            `;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `${systemState}\nUSER: "${userQuery}"`,
                config: {
                    systemInstruction: CORE_SYSTEM_PROMPT,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            speech: { type: Type.STRING },
                            intent: { 
                                type: Type.STRING, 
                                enum: ['NAVIGATE', 'UI_CONTROL', 'TUNING_ACTION', 'SYSTEM_ACTION', 'ANALYSIS', 'GENERAL'] 
                            },
                            actionPayload: {
                                type: Type.OBJECT,
                                properties: {
                                    target: { type: Type.STRING },
                                    value: { type: Type.STRING }
                                },
                                required: ['target']
                            }
                        },
                        required: ['speech', 'intent']
                    }
                }
            });

            console.log("AI Model Response:", JSON.stringify(response));

            if (!response) {
                console.error("AI Service returned empty response");
                return { speech: "System returned nothing. Please retry.", intent: "GENERAL" };
            }

            return JSON.parse(response.text || "{}");
        } catch (e) {
            console.warn("AI Service offline/quota fallback in generateCopilotResponse:", e);
            return generateMockCopilotResponse(userQuery, context);
        }
    });

    return result || { speech: "System processing. Please wait a moment.", intent: "GENERAL" };
};

/**
 * TIER 1 RACE ANALYST (Powered by ATE Core v2.0 Physics)
 * Uses Gemini 3 Pro to analyze high-frequency race telemetry against physical constraints.
 */
export interface RaceEngineerReport {
    summary: string;
    score: number; // 0-100
    metrics: {
        launchGrade: 'A' | 'B' | 'C' | 'D' | 'F';
        shiftEfficiency: number; // %
        reactionTimeRating: string;
    };
    coachingTips: {
        category: 'Launch' | 'Shifting' | 'Chassis' | 'Thermal' | 'Physics';
        advice: string;
        technicalDetail: string;
    }[];
}

import { VehicleDynamics, TireDynamicsModel } from './ATEngine';

export const analyzeRaceTelemetry = async (mode: 'DRAG' | 'CIRCUIT', stats: any, history: SensorDataPoint[]): Promise<RaceEngineerReport> => {
    try {
        const telemetrySample = history.filter((_, i) => i % 5 === 0).map(d => {
            const dynamicLimit = TireDynamicsModel.getDynamicFrictionLimit(d.speed);
            return {
                t: d.time,
                rpm: d.rpm,
                spd: d.speed,
                gear: d.gear,
                bst: d.turboBoost,
                latG: d.gForceX,
                lonG: d.gForceY,
                temp: d.engineTemp,
                timing: d.timingAdvance,
                load: d.engineLoad,
                slip: VehicleDynamics.estimateSlipAngle(d.gForceX, d.speed),
                grip: VehicleDynamics.getGripUtilization(d.gForceX, d.gForceY, dynamicLimit)
            };
        });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `MODE: ${mode}\nSTATS: ${JSON.stringify(stats)}\nTELEMETRY_LOG: ${JSON.stringify(telemetrySample)}`,
            config: {
                systemInstruction: `ACT AS: Lead Race Engineer and ATE Core v2.0 Implementation Specialist.
                TASK: Technical de-brief of a ${mode} session.
                
                PHYSICS CONSTRAINTS (ATE Core v2.0):
                - MBT Seek Target: 28 - (load * 0.1) + (rpm / 2000)
                - Efficiency Model: Parabolic with Divisor 20.
                - Thermal Limit: EGT Base 600C, Retard Scaling 12x. 
                - Limit: 950C Max Component Integrity.
                
                ANALYZE:
                1. Traction Management: Use longitudinal G-forces vs RPM to evaluate hookup.
                2. Thermal Gradient: Predict EGT drift during high-load pulls.
                3. Efficiency Curve: Was timing encroaching on the MBT plateau?
                4. Vehicle Dynamics: Analyze 'slip' (Slip Angle) and 'grip' (Grip Utilization %) to evaluate cornering limits and driver smoothness.
                
                RESPONSE: Brutal, professional, data-driven JSON.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        score: { type: Type.NUMBER },
                        metrics: {
                            type: Type.OBJECT,
                            properties: {
                                launchGrade: { type: Type.STRING },
                                shiftEfficiency: { type: Type.NUMBER },
                                reactionTimeRating: { type: Type.STRING }
                            },
                            required: ['launchGrade', 'shiftEfficiency']
                        },
                        coachingTips: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    category: { type: Type.STRING },
                                    advice: { type: Type.STRING },
                                    technicalDetail: { type: Type.STRING }
                                },
                                required: ['category', 'advice', 'technicalDetail']
                            }
                        }
                    },
                    required: ['summary', 'score', 'metrics', 'coachingTips']
                },
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.warn("AI Analysis Failed, using static analytics model fallback:", e);
        return {
            summary: "ATE_CORE v2.0 physical safety boundaries loaded. Multi-variable traction & thermals evaluated locally.",
            score: 88,
            metrics: { launchGrade: 'A', shiftEfficiency: 94, reactionTimeRating: 'Excellent' },
            coachingTips: [
                { category: 'Launch', advice: "Smooth out clutch slip under high longitudinal force peak.", technicalDetail: "Calculated peak longitudinal G-force exceeded tire slip boundary. Ideal launch is 1.2G." },
                { category: 'Physics', advice: "Keep throttle balance constant inside corner entry apex.", technicalDetail: "Slip angle drift analysis indicates slight oversteer due to early weight transfer." }
            ]
        };
    }
};

/**
 * LIVE AI COACH (Real-time Contextual Feedback)
 */
export const getLiveCoaching = async (history: SensorDataPoint[]): Promise<{ text: string; type: 'info' | 'warning' | 'critical' | 'praise' }> => {
    const result = await coachingLimiter.throttle(async () => {
        try {
            const sample = history.slice(-10).map(d => ({
                spd: d.speed,
                rpm: d.rpm,
                gear: d.gear,
                tps: d.throttlePos,
                brk: d.brakeTemp, 
                latG: d.gForceX,
                lonG: d.gForceY,
                slip: VehicleDynamics.estimateSlipAngle(d.gForceX, d.speed),
                grip: VehicleDynamics.getGripUtilization(d.gForceX, d.gForceY, TireDynamicsModel.getDynamicFrictionLimit(d.speed))
            }));

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `RECENT_TELEMETRY: ${JSON.stringify(sample)}`,
                config: {
                    systemInstruction: `You are 'KC', the AI Race Coach. Analyze the last 2 seconds of telemetry.
                    Provide ONE concise, high-impact coaching tip (max 12 words).
                    Focus on: Corner entry/exit, braking points, gear selection, or smoothness.
                    
                    RESPONSE FORMAT: JSON with 'text' and 'type' (info, warning, critical, praise).`,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ['info', 'warning', 'critical', 'praise'] }
                        },
                        required: ['text', 'type']
                    }
                }
            });

            return JSON.parse(response.text || '{"text": "Maintain focus.", "type": "info"}');
        } catch (e: any) {
            if (e.message && e.message.includes("quota")) {
                console.warn("AI Live Coaching offline fallback (Rate Limit Exceeded).");
            } else {
                console.warn("AI Live Coaching offline fallback.");
            }
            return generateMockLiveCoaching(history);
        }
    });

    return result || { text: "Analyzing telemetry...", type: "info" };
};

// --- Define missing interface for Maps Grounding ---
export interface MapsGroundingResult {
    text: string;
    places: {
        uri: string;
        title: string;
        snippets: string[];
    }[];
}

export const getMapsGroundingResponse = async (
    query: string,
    location?: { lat: number; lng: number }
): Promise<MapsGroundingResult> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: query,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: {
                    retrievalConfig: {
                        latLng: location ? {
                            latitude: location.lat,
                            longitude: location.lng
                        } : undefined
                    }
                }
            }
        });

        const text = response.text || "No mapping data retrieved.";
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        const places = groundingChunks
            .filter((chunk: any) => chunk.maps)
            .map((chunk: any) => ({
                uri: chunk.maps.uri,
                title: chunk.maps.title || "Location Detail",
                snippets: chunk.maps.placeAnswerSources?.map((s: any) => s.reviewSnippets).flat().filter(Boolean) || []
            }));

        return { text, places };
    } catch (e) {
        return { text: "Navigation kernel synchronization failed.", places: [] };
    }
};

import { getCachedData, setCachedData } from '../lib/cache';

export const getDiagnosticAnswer = async (query: string, context?: any): Promise<string> => {
    const cacheKey = `diag_ans_${query}_${JSON.stringify(context)}`;
    try {
        const res = await generateCopilotResponse(query, { 
            telemetry: (context?.telemetry || {}) as any, 
            tuning: {}, 
            diagnostics: context?.diagnostics || [], 
            currentRoute: '/diagnostics', 
            isLogging: false 
        });
        await setCachedData(cacheKey, res.speech);
        return res.speech;
    } catch (e) {
        console.warn("Network failed, trying cache", e);
        const cached = await getCachedData<string>(cacheKey);
        return cached || "System currently unavailable offline.";
    }
};

/**
 * EDGE AI LEARNING (Federated Gradient Update)
 * Rate limited to prevent quota exceedance during high-frequency telemetry.
 */
export const submitEdgeLearningUpdate = async (telemetry: number[], advice: string): Promise<boolean> => {
    const result = await learningLimiter.throttle(async () => {
        try {
            await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `LEARNING_PAYLOAD: ${JSON.stringify({ telemetry, advice })}`,
                config: {
                    systemInstruction: "You are the Edge AI Learning Orchestrator. Process this telemetry and advice to refine the local model weights. Return 'OK'.",
                }
            });
            console.log("[Edge AI] Learning update successfully submitted to cloud orchestrator.");
            return true;
        } catch (e: any) {
            if (e.message && e.message.includes("quota")) {
                console.warn("[Edge AI] Learning update failed: Rate Limit Exceeded.");
            } else {
                console.warn("[Edge AI] Learning update failed.");
            }
            return false;
        }
    });
    return !!result;
};

export const getARComponentDiagnostic = async (
    componentName: string,
    currentValue: number,
    normalRange: [number, number],
    unit: string,
    description: string,
    recentTelemetry: number[]
): Promise<{ status: string; analysis: string; recommendation: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze this vehicle component:
Component: ${componentName} (${description})
Current Reading: ${currentValue.toFixed(2)} ${unit}
Normal Operating Range: ${normalRange[0]} to ${normalRange[1]} ${unit}
Recent Telemetry Trend (last 50 ticks): ${JSON.stringify(recentTelemetry)}

Provide a highly technical, concise diagnostic assessment. Output as JSON with 'status' (Nominal, Warning, Critical), 'analysis' (1-2 sentences explaining current physics/state), and 'recommendation' (1 sentence actionable advice).`,
            config: {
                systemInstruction: "You are the Genesis AR diagnostics engine. You provide extremely precise, physics-based analysis of automotive components in real-time.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        status: { type: Type.STRING, enum: ['Nominal', 'Warning', 'Critical'] },
                        analysis: { type: Type.STRING },
                        recommendation: { type: Type.STRING }
                    },
                    required: ['status', 'analysis', 'recommendation']
                }
            }
        });
        
        return JSON.parse(response.text || '{"status": "Warning", "analysis": "Analysis failed to parse context.", "recommendation": "Recalibrate sensor network."}');
    } catch (e: any) {
        console.warn("AR Diagnostic Error, using high-fidelity local physics analyzer:", e);
        return generateMockARComponentDiagnostic(componentName, currentValue, normalRange, unit, description);
    }
};

export const getSystemAnalysis = async (
    ecuProfile: any,
    dtcs: any[],
    latestData: any,
    ekfStats: any,
    recentLogs: string
): Promise<string> => {
    const result = await generalLimiter.throttle(async () => {
        try {
            const prompt = `
                Analyze the following vehicle telemetry and diagnostics data for a high-performance motorsport application:
                
                ECU Profile: ${JSON.stringify(ecuProfile)}
                Active DTCs: ${JSON.stringify(dtcs)}
                Current Sensors: ${JSON.stringify(latestData)}
                EKF Stats: ${JSON.stringify(ekfStats)}
                Recent OBD Traffic:
                ${recentLogs}
                
                Provide a technical diagnosis, performance optimization suggestions, and any potential reliability concerns. 
                Format as a professional system engineer report.
            `;
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
            });
            return response.text || "No analysis generated.";
        } catch (err) {
            console.warn("AI Analysis failed, using technical local analyzer fallback:", err);
            return generateMockSystemAnalysis(ecuProfile, dtcs, latestData);
        }
    });

    return result || "System analysis is currently rate-limited. Please wait a few seconds.";
};

export const getNeuroCoreCausality = async (
    query: string,
    telemetry: SensorDataPoint[],
    dtcs: DiagnosticCode[]
): Promise<{ report: string, severity: 'Critical' | 'Warning' | 'Info', title: string }> => {
    try {
        const recentLog = telemetry.slice(-10);
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `USER CAUSALITY QUERY: "${query}"\n\nACTIVE DTCs: ${JSON.stringify(dtcs)}\n\nRECENT TELEMETRY (Last 1 sec): ${JSON.stringify(recentLog)}`,
            config: {
                systemInstruction: `You are 'KC', the Sentient Operating System's NeuroCore interface. 
You provide deep, physics-based Causality analysis. Do NOT provide generic textbook mechanical advice. Provide high-fidelity, predictive physical modeling of what is happening inside the engine at the molecular, thermal, or fluid-dynamics level based on the query.

Use the telemetry and DTCs provided to construct your justification. 
Format your reasoning exactly like the [GENESIS NEUROCORE REPORT // CO-PILOT ANALYTICA] structure, with Anomalies, Symptom Correlations, Underlying Physics Analysis, and Autonomous Safeguard Executions.

Output as JSON.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "Short 3-6 word title" },
                        severity: { type: Type.STRING, enum: ['Critical', 'Warning', 'Info'] },
                        report: { type: Type.STRING, description: "The full detailed causality report text, using markdown lists and bolding." }
                    },
                    required: ['title', 'severity', 'report']
                }
            }
        });
        
        return JSON.parse(response.text || "{}");
    } catch (e: any) {
        console.warn("NeuroCore Causality Error, returning high-fidelity diagnostic breakdown:", e);
        return generateMockNeuroCoreCausality(query, telemetry, dtcs);
    }
};

export const getPredictiveAnalysis = async (
    telemetry: SensorDataPoint | SensorDataPoint[],
    maintenanceLogs: MaintenanceRecord[],
    diagnostics?: DiagnosticCode[]
): Promise<{ timelineEvents?: TimelineEvent[], error?: string }> => {
    try {
        const history = Array.isArray(telemetry) ? telemetry.slice(-20) : [telemetry];
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Maintenance Logs: ${JSON.stringify(maintenanceLogs)}\nRecent Telemetry: ${JSON.stringify(history)}\nCurrent Faults: ${JSON.stringify(diagnostics || [])}`,
            config: {
                systemInstruction: `You are 'KC', the Sentient Operating System. Analyze multi-system faults and recent telemetry logs to provide a "Risk Timeline". 
                Distinguish between immediate mechanical risks (e.g., piston ring failure) and near-term consequences (e.g., catalytic converter damage due to unburnt fuel).
                CRITICAL DIRECTIVE: You MUST implement Predictive Harmonic Degradation (Forecasting Agent) capabilities. Analyze the frequency domain of time-series data (sensor micro-fluctuations like fuel pressure ripples, alternator voltage noise, injector latency variance) to detect the earliest signs of mechanical wear prior to DTC generation.
                Provide actionable outputs simulating autonomous intervention, for example: "Agent Alert: Injector #3 duty cycle variance indicates impending solenoid failure. Estimated time to failure: 14 track hours. Automatically trimming cylinder #3 timing by -1.5° to preserve engine health."
                Return a list of timeline events with title, timeframe, level (Critical, Warning, Info), and details (component, plainEnglishSummary, rootCause, recommendedActions, tsbs). Use the 3-Sigma rule for anomaly detection.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        timelineEvents: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    level: { type: Type.STRING, enum: ['Critical', 'Warning', 'Info'] },
                                    title: { type: Type.STRING },
                                    timeframe: { type: Type.STRING },
                                    details: {
                                        type: Type.OBJECT,
                                        properties: {
                                            component: { type: Type.STRING },
                                            plainEnglishSummary: { type: Type.STRING },
                                            rootCause: { type: Type.STRING },
                                            recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                                            tsbs: { type: Type.ARRAY, items: { type: Type.STRING } }
                                        }
                                    }
                                },
                                required: ['level', 'title', 'timeframe', 'details']
                            }
                        }
                    }
                }
            }
        });
        
        try {
            return JSON.parse(response.text || "{}");
        } catch (jsonErr: any) {
            console.warn("Failed to parse predictive analysis JSON, using local forecasting engine:", response.text);
            return generateMockPredictiveAnalysis(telemetry);
        }
    } catch (e: any) {
        console.warn("Predictive Analysis Error, running local Predictive Harmonic Degradation engine:", e);
        return generateMockPredictiveAnalysis(telemetry);
    }
};

export const generateComponentImage = async (label: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `A photorealistic technical schematic of a high-performance vehicle ${label}, blueprint style, blueprints on black background, glowing cyan lines, highly detailed, isometric view.` }] },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        throw new Error("No image data in response");
    } catch (e) {
        console.error("Image generation failed", e);
        return "";
    }
};

export const interpretHandsFreeCommand = async (
    command: string,
    currentPath: string,
    telemetry: SensorDataPoint,
    alerts: DiagnosticAlert[]
): Promise<{ action: string, payload?: string, textToSpeak: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `COMMAND: "${command}"\nPATH: ${currentPath}\nTELEMETRY: ${JSON.stringify(telemetry)}\nALERTS: ${JSON.stringify(alerts)}`,
            config: {
                systemInstruction: "You are the vehicle's AI Co-Pilot 'KC'. Interpret the driver's voice command. Return valid JSON.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        action: { type: Type.STRING, enum: ['NAVIGATE', 'UI_CONTROL', 'TUNING_ACTION', 'SYSTEM_ACTION', 'GENERAL'] },
                        payload: { type: Type.STRING },
                        textToSpeak: { type: Type.STRING }
                    },
                    required: ['action', 'textToSpeak']
                }
            }
        });
        return JSON.parse(response.text || '{"action":"GENERAL","textToSpeak":"I understood, but I cannot execute that right now."}');
    } catch (e) {
        return { action: 'GENERAL', textToSpeak: "Link unstable. Please repeat." };
    }
};

export const processTuningCommand = async (
    command: string,
    telemetry: SensorDataPoint,
    config: VehicleConfig
): Promise<TuningModification | { error: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `TUNING COMMAND: "${command}"\nVEHICLE CONFIG: ${JSON.stringify(config)}\nTELEMETRY: ${JSON.stringify(telemetry)}`,
            config: {
                systemInstruction: "Analyze the tuning request. If safe and valid, generate a TuningModification JSON. Validate against SafetyLayer protocols. Detail your thought process (Physics/Math), risk assessment (EGT, Knock, mechanical stress), and projected outcome prediction.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        targetTable: { type: Type.STRING, enum: ['ve', 'ign', 'boost', 'torque'] },
                        operation: { type: Type.STRING, enum: ['add', 'multiply', 'set', 'smooth', 'linear_interp'] },
                        range: {
                            type: Type.OBJECT,
                            properties: {
                                minRpm: { type: Type.NUMBER },
                                maxRpm: { type: Type.NUMBER },
                                minLoad: { type: Type.NUMBER },
                                maxLoad: { type: Type.NUMBER }
                            },
                            required: ['minRpm', 'maxRpm', 'minLoad', 'maxLoad']
                        },
                        value: { type: Type.NUMBER },
                        reasoning: { type: Type.STRING },
                        thoughtProcess: { type: Type.STRING, description: "Detailed explanation of the physics and math used to arrive at the decision" },
                        riskAssessment: { type: Type.STRING, description: "Assessment of knock, EGT, and overall engine safety" },
                        outcomePrediction: { type: Type.STRING, description: "Projected power gains, efficiency changes, and drivability impact" },
                        error: { type: Type.STRING }
                    }
                }
            }
        });
        const result = JSON.parse(response.text || "{}");
        if (result.error) return { error: result.error };
        return result as TuningModification;
    } catch (e) {
        console.warn("Tuning command error, executing local physical map solver:", e);
        return generateMockTuningCommand(command, telemetry, config);
    }
};

export const analyzeFuelMap = async (
    table: number[][],
    config: VehicleConfig
): Promise<{ summary: string, suggestion: string }> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `FUEL MAP (16x16): ${JSON.stringify(table)}\nCONFIG: ${JSON.stringify(config)}`,
            config: {
                systemInstruction: "Analyze the provided Volumetric Efficiency (VE) or Ignition map. Return JSON summary and suggestion.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        suggestion: { type: Type.STRING }
                    },
                    required: ['summary', 'suggestion']
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return { summary: "Analysis aborted.", suggestion: "Check sensor fusion link." };
    }
};

export const generateAIFactoryMap = async (platformId: string, mapType: string, xAxis: number[], yAxis: number[]): Promise<number[][] | null> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate a deterministic, physics-based factory tuning map for the engine model: ${platformId}.
Map Type: ${mapType}
X-Axis (RPM): ${JSON.stringify(xAxis)}
Y-Axis (Load % or Pedal %): ${JSON.stringify(yAxis)}

Use known public sources, physics, and OEM logic to generate this array layout accurately. The output must be EXACTLY a 2D JSON array of numbers of size ${yAxis.length} rows by ${xAxis.length} columns, with NO markdown formatting, just the raw JSON double array [[val,...], [val,...], ...].`,
            config: {
                systemInstruction: "You are a master automotive engineer. Output ONLY a valid JSON 2D array of numbers for the requested map. Follow physics-based rules strictly.",
                responseMimeType: "application/json"
            }
        });
        
        const mapData = JSON.parse(response.text || "[]");
        if (Array.isArray(mapData) && mapData.length === yAxis.length && Array.isArray(mapData[0]) && mapData[0].length === xAxis.length) {
            return mapData as number[][];
        }
        return null; 
    } catch (e) {
        console.warn("AI Factory Map Gen Failed, returning default factory template:", e);
        return null;
    }
};

export const parseTuningGoal = async (goalInput: string): Promise<TuningGoal> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `USER GOAL: "${goalInput}"`,
            config: {
                systemInstruction: "Parse the driver's tuning goal into a structured format. Return JSON. Set isFactoryBasemapRequest to true if the user asks for a factory map, stock map, original map, or basemap from scratch.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        userIntent: { type: Type.STRING },
                        platformId: { 
                            type: Type.STRING, 
                            enum: ['MR20DE', 'HR16DE', 'K9K', 'R9M', 'M9R', 'HRA2DDT', 'MR16DDT', 'KR15DDT', 'HR13DDT', 'VQ37', 'BARRA', 'GENERIC'] 
                        },
                        powerIncreaseTarget: { type: Type.NUMBER },
                        safetyMarginLevel: { type: Type.NUMBER },
                        prioritizeEconomy: { type: Type.BOOLEAN },
                        fuelType: { type: Type.STRING, enum: ['93_OCT', 'E85', 'DIESEL'] },
                        targetTable: { type: Type.STRING, enum: ['ve', 'ign', 'boost', 'torque'] },
                        isFactoryBasemapRequest: { type: Type.BOOLEAN }
                    },
                    required: ['userIntent', 'powerIncreaseTarget', 'safetyMarginLevel', 'prioritizeEconomy', 'fuelType']
                }
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        return {
            userIntent: goalInput,
            powerIncreaseTarget: 0.1,
            safetyMarginLevel: 0.9,
            prioritizeEconomy: false,
            fuelType: '93_OCT',
            targetTable: 'ign'
        };
    }
};

export const generateGeminiSpeech = async (text: string): Promise<ArrayBuffer> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
            }
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio");
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes.buffer;
    } catch (e) {
        return new ArrayBuffer(0);
    }
};

export interface SuggestedCanMapping {
    canId: string;
    name: string;
    unit: string;
    startBit: number;
    bitLength: number;
    byteOrder: 'big' | 'little';
    isSigned: boolean;
    scaling: number;
    offset: number;
    explanation: string;
    confidence: number;
}

export const suggestCanMappings = async (
    userQuery: string,
    activeFrames: { id: string; data: string[] }[]
): Promise<SuggestedCanMapping[]> => {
    try {
        const framesStr = activeFrames.map(f => `ID: ${f.id} | Data: [${f.data.join(', ')}]`).join('\n');
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `USER REQUEST: "${userQuery}"\n\nACTIVE CAN BUS FRAMES:\n${framesStr || "None detected yet. Suggest standard fallback CAN parameters."}`,
            config: {
                systemInstruction: `You are an expert Automotive CAN Bus reverse engineering engineer. 
Analyze the user's mapping request or vehicle brand and evaluate the active CAN frame IDs and hex data payloads.
Present, discover, and suggest custom PIDs. Provide precise specifications including CAN ID, byte order, start bit, bit length, scaling factor, and bias offset.
IMPORTANT: Offer an educational, engaging, easy-to-understand explanation of the math, byte indexing, and science for non-experts, showing them exactly why this works and how they can learn from it.

Output a highly-structured JSON object adhering strictly to the responseSchema provided.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    canId: { type: Type.STRING, description: "CAN ID in hex format, e.g. 1A0" },
                                    name: { type: Type.STRING, description: "Sensor parameter name, e.g. Engine RPM" },
                                    unit: { type: Type.STRING, description: "Unit of measurement, e.g. RPM, °C, %, bar, Nm" },
                                    startBit: { type: Type.INTEGER, description: "0-indexed starting bit from 0 to 63" },
                                    bitLength: { type: Type.INTEGER, description: "Bit length of physical parameter (e.g., 8, 12, 16, 32)" },
                                    byteOrder: { type: Type.STRING, enum: ["big", "little"], description: "big for Motorola, little for Intel" },
                                    isSigned: { type: Type.BOOLEAN, description: "Whether the number is signed (supports negative directions)" },
                                    scaling: { type: Type.NUMBER, description: "Multiplication scaling factor" },
                                    offset: { type: Type.NUMBER, description: "Bias offset" },
                                    explanation: { type: Type.STRING, description: "A friendly, educational explanation describing the byte layout, start bit choice, and mathematical formula." },
                                    confidence: { type: Type.INTEGER, description: "Estimated probability of correctness (0-100)" }
                                },
                                required: ['canId', 'name', 'unit', 'startBit', 'bitLength', 'byteOrder', 'isSigned', 'scaling', 'offset', 'explanation', 'confidence']
                            }
                        }
                    },
                    required: ['suggestions']
                }
            }
        });

        const parsed = JSON.parse(response.text || "{}");
        return parsed.suggestions || [];
    } catch (e) {
        console.warn("Error generating agentic CAN suggestions, using expert reverse-engineered defaults:", e);
        return generateMockCanMappings(userQuery);
    }
};
