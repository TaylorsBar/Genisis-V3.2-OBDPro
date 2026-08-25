import { create } from 'zustand';

export interface ObdLogEntry {
    timestamp: number;
    direction: 'TX' | 'RX' | 'SYS' | 'ERR';
    data: string;
}

interface DiagnosticState {
    logs: ObdLogEntry[];
    isRecording: boolean;
    showConsole: boolean;
    addLog: (direction: 'TX' | 'RX' | 'SYS' | 'ERR', data: string) => void;
    clearLogs: () => void;
    toggleRecording: () => void;
    toggleConsole: () => void;
}

export const useDiagnosticStore = create<DiagnosticState>((set) => ({
    logs: [],
    isRecording: true,
    showConsole: false,
    addLog: (direction, data) => set((state) => {
        if (!state.isRecording) return state;
        const newLog = { timestamp: Date.now(), direction, data };
        // Keep last 500 logs to prevent memory leaks
        return { logs: [...state.logs.slice(-499), newLog] };
    }),
    clearLogs: () => set({ logs: [] }),
    toggleRecording: () => set((state) => ({ isRecording: !state.isRecording })),
    toggleConsole: () => set((state) => ({ showConsole: !state.showConsole })),
}));
