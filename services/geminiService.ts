import { 
    SensorDataPoint, TuningModification, DiagnosticCode, 
    CopilotResponse, TimelineEvent, TuningGoal, 
    MaintenanceRecord, VehicleConfig, DiagnosticAlert 
} from '../types';

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

export interface MapsGroundingResult {
    text: string;
    places: {
        uri: string;
        title: string;
        snippets: string[];
    }[];
}

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

async function callServerGemini(functionName: string, args: any[] = []): Promise<any> {
    const response = await fetch('/api/gemini/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ functionName, args }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Server returned status ${response.status}`);
    }

    const data = await response.json();

    if (data.isBinary) {
        const binaryString = atob(data.result);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    return data.result;
}

export const generateCopilotResponse = async (
    userQuery: string,
    context: any
): Promise<CopilotResponse> => {
    return callServerGemini('generateCopilotResponse', [userQuery, context]);
};

export const analyzeRaceTelemetry = async (
    mode: 'DRAG' | 'CIRCUIT', 
    stats: any, 
    history: SensorDataPoint[]
): Promise<RaceEngineerReport> => {
    return callServerGemini('analyzeRaceTelemetry', [mode, stats, history]);
};

export const getLiveCoaching = async (
    history: SensorDataPoint[]
): Promise<{ text: string; type: 'info' | 'warning' | 'critical' | 'praise' }> => {
    return callServerGemini('getLiveCoaching', [history]);
};

export const getMapsGroundingResponse = async (
    query: string,
    location?: { lat: number; lng: number }
): Promise<MapsGroundingResult> => {
    return callServerGemini('getMapsGroundingResponse', [query, location]);
};

export const getDiagnosticAnswer = async (
    query: string, 
    context?: any
): Promise<string> => {
    return callServerGemini('getDiagnosticAnswer', [query, context]);
};

export const submitEdgeLearningUpdate = async (
    telemetry: number[], 
    advice: string
): Promise<boolean> => {
    return callServerGemini('submitEdgeLearningUpdate', [telemetry, advice]);
};

export const getARComponentDiagnostic = async (
    componentName: string,
    currentValue: number,
    normalRange: [number, number],
    unit: string,
    description: string,
    recentTelemetry: number[]
): Promise<{ status: string; analysis: string; recommendation: string }> => {
    return callServerGemini('getARComponentDiagnostic', [componentName, currentValue, normalRange, unit, description, recentTelemetry]);
};

export const getSystemAnalysis = async (
    ecuProfile: any,
    dtcs: any[],
    latestData: any,
    ekfStats: any,
    recentLogs: string
): Promise<string> => {
    return callServerGemini('getSystemAnalysis', [ecuProfile, dtcs, latestData, ekfStats, recentLogs]);
};

export const getNeuroCoreCausality = async (
    query: string,
    telemetry: SensorDataPoint[],
    dtcs: DiagnosticCode[]
): Promise<{ report: string, severity: 'Critical' | 'Warning' | 'Info', title: string }> => {
    return callServerGemini('getNeuroCoreCausality', [query, telemetry, dtcs]);
};

export const getPredictiveAnalysis = async (
    telemetry: SensorDataPoint | SensorDataPoint[],
    maintenanceLogs: MaintenanceRecord[],
    diagnostics?: DiagnosticCode[]
): Promise<{ timelineEvents?: TimelineEvent[], error?: string }> => {
    return callServerGemini('getPredictiveAnalysis', [telemetry, maintenanceLogs, diagnostics]);
};

export const generateComponentImage = async (
    label: string
): Promise<string> => {
    return callServerGemini('generateComponentImage', [label]);
};

export const interpretHandsFreeCommand = async (
    command: string,
    currentPath: string,
    telemetry: SensorDataPoint,
    alerts: DiagnosticAlert[]
): Promise<{ action: string, payload?: string, textToSpeak: string }> => {
    return callServerGemini('interpretHandsFreeCommand', [command, currentPath, telemetry, alerts]);
};

export const processTuningCommand = async (
    command: string,
    telemetry: SensorDataPoint,
    config: VehicleConfig
): Promise<TuningModification | { error: string }> => {
    return callServerGemini('processTuningCommand', [command, telemetry, config]);
};

export const analyzeFuelMap = async (
    table: number[][],
    config: VehicleConfig
): Promise<{ summary: string, suggestion: string }> => {
    return callServerGemini('analyzeFuelMap', [table, config]);
};

export const generateAIFactoryMap = async (
    platformId: string, 
    mapType: string, 
    xAxis: number[], 
    yAxis: number[]
): Promise<number[][] | null> => {
    return callServerGemini('generateAIFactoryMap', [platformId, mapType, xAxis, yAxis]);
};

export const parseTuningGoal = async (
    goalInput: string
): Promise<TuningGoal> => {
    return callServerGemini('parseTuningGoal', [goalInput]);
};

export const generateGeminiSpeech = async (
    text: string
): Promise<ArrayBuffer> => {
    return callServerGemini('generateGeminiSpeech', [text]);
};

export const suggestCanMappings = async (
    userQuery: string,
    activeFrames: { id: string; data: string[] }[]
): Promise<SuggestedCanMapping[]> => {
    return callServerGemini('suggestCanMappings', [userQuery, activeFrames]);
};
