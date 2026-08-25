import { create } from 'zustand';
import { LapTime } from '../types';
import { DatabaseService } from '../services/DatabaseService';
import { useVehicleStore } from './vehicleStore';

export interface LapSessionRecord {
    id: string;
    trackName: string;
    timestamp: number;
    laps: LapTime[];
    bestLapTime: number;
}

export interface LapTimerState {
    currentSessionId: string | null;
    trackName: string;
    isActive: boolean;
    startTimeAbsolute: number | null; // Absolute Date.now() timestamp of session start
    startTimeRelative: number | null; // high-precision performance.now() of session start
    lapStartTimeRelative: number | null; // high-precision performance.now() of current lap start
    lapTimes: LapTime[];
    currentSplit1: number | null; // Split 1 elapsed time (relative to lap start, in seconds)
    currentSplit2: number | null; // Split 2 elapsed time (relative to lap start, in seconds)
    
    // Historical optimal sector times (in seconds)
    bestSector1: number | null;
    bestSector2: number | null;
    bestSector3: number | null;
    
    // Actions
    startSession: (trackName?: string) => void;
    stopSession: () => Promise<void>;
    resetSession: () => void;
    startLap: (timestamp?: number) => void;
    markSector: (timestamp?: number) => void;
    calculateLiveDelta: (currentSector: 1 | 2 | 3) => number | null;
}

export const useLapTimerStore = create<LapTimerState>((set, get) => ({
    currentSessionId: null,
    trackName: 'Grand Loop',
    isActive: false,
    startTimeAbsolute: null,
    startTimeRelative: null,
    lapStartTimeRelative: null,
    lapTimes: [],
    currentSplit1: null,
    currentSplit2: null,
    bestSector1: null,
    bestSector2: null,
    bestSector3: null,

    startSession: (trackName = 'Grand Loop') => {
        const nowAbs = Date.now();
        const nowRel = performance.now();
        const sessionId = 'lap_sess_' + nowAbs.toString();

        set({
            currentSessionId: sessionId,
            trackName,
            isActive: true,
            startTimeAbsolute: nowAbs,
            startTimeRelative: nowRel,
            lapStartTimeRelative: nowRel,
            lapTimes: [],
            currentSplit1: null,
            currentSplit2: null,
            bestSector1: null,
            bestSector2: null,
            bestSector3: null
        });

        // Sync state to vehicleStore raceSession
        useVehicleStore.setState(state => ({
            raceSession: {
                ...state.raceSession,
                mode: 'CIRCUIT',
                isActive: true,
                startTime: nowAbs,
                lapTimes: [],
                currentDelta: 0
            }
        }));

        DatabaseService.writeSystemLog('Info', 'LapTimer', `Circuit timing session started for: ${trackName}`);
    },

    stopSession: async () => {
        const { currentSessionId, trackName, startTimeAbsolute, lapTimes } = get();
        if (!currentSessionId || !startTimeAbsolute) return;

        const bestLapTime = lapTimes.length > 0 
            ? Math.min(...lapTimes.map(l => l.time)) 
            : 0;

        const sessionRecord: LapSessionRecord = {
            id: currentSessionId,
            trackName,
            timestamp: startTimeAbsolute,
            laps: lapTimes,
            bestLapTime
        };

        // Persist to local cache and Firestore
        await DatabaseService.saveLapSession(sessionRecord);

        set({ isActive: false });

        // Sync vehicleStore
        useVehicleStore.setState(state => ({
            raceSession: {
                ...state.raceSession,
                isActive: false
            }
        }));

        DatabaseService.writeSystemLog('Info', 'LapTimer', `Circuit timing session stopped. Best Lap: ${bestLapTime.toFixed(3)}s`);
    },

    resetSession: () => {
        set({
            currentSessionId: null,
            isActive: false,
            startTimeAbsolute: null,
            startTimeRelative: null,
            lapStartTimeRelative: null,
            lapTimes: [],
            currentSplit1: null,
            currentSplit2: null,
            bestSector1: null,
            bestSector2: null,
            bestSector3: null
        });

        useVehicleStore.setState(state => ({
            raceSession: {
                ...state.raceSession,
                isActive: false,
                startTime: null,
                lapTimes: [],
                currentDelta: 0
            }
        }));
    },

    startLap: (timestamp) => {
        const { isActive, lapStartTimeRelative, lapTimes, currentSplit1, currentSplit2 } = get();
        if (!isActive) return;

        const nowRel = timestamp || performance.now();

        // If there was a previous running lap, complete it and calculate its sectors
        if (lapStartTimeRelative !== null) {
            const totalLapTime = (nowRel - lapStartTimeRelative) / 1000;
            const newLapNumber = lapTimes.length + 1;

            const newLap: LapTime = {
                lap: newLapNumber,
                time: totalLapTime,
                split1: currentSplit1 !== null ? currentSplit1 : undefined,
                split2: currentSplit2 !== null ? currentSplit2 : undefined
            };

            const updatedLaps = [...lapTimes, newLap];

            // Update optimal sectors
            const s1 = currentSplit1;
            const s2 = (currentSplit1 !== null && currentSplit2 !== null) ? (currentSplit2 - currentSplit1) : null;
            const s3 = (currentSplit2 !== null) ? (totalLapTime - currentSplit2) : null;

            set(state => ({
                lapTimes: updatedLaps,
                lapStartTimeRelative: nowRel,
                currentSplit1: null,
                currentSplit2: null,
                bestSector1: s1 !== null && (state.bestSector1 === null || s1 < state.bestSector1) ? s1 : state.bestSector1,
                bestSector2: s2 !== null && (state.bestSector2 === null || s2 < state.bestSector2) ? s2 : state.bestSector2,
                bestSector3: s3 !== null && (state.bestSector3 === null || s3 < state.bestSector3) ? s3 : state.bestSector3
            }));

            // Sync with vehicleStore
            useVehicleStore.setState(state => ({
                raceSession: {
                    ...state.raceSession,
                    lapTimes: updatedLaps,
                    currentSplit1: undefined,
                    currentSplit2: undefined
                }
            }));

            // Direct auto-save on lap completion for robust persistence
            const { currentSessionId, trackName, startTimeAbsolute } = get();
            if (currentSessionId && startTimeAbsolute) {
                const bestLapTime = Math.min(...updatedLaps.map(l => l.time));
                DatabaseService.saveLapSession({
                    id: currentSessionId,
                    trackName,
                    timestamp: startTimeAbsolute,
                    laps: updatedLaps,
                    bestLapTime
                }).catch(e => console.warn("Failed to auto-save lap session:", e));
            }

            DatabaseService.writeSystemLog('Info', 'LapTimer', `Lap ${newLapNumber} Completed: ${totalLapTime.toFixed(3)}s`);
        } else {
            set({
                lapStartTimeRelative: nowRel,
                currentSplit1: null,
                currentSplit2: null
            });
        }
    },

    markSector: (timestamp) => {
        const { isActive, lapStartTimeRelative, currentSplit1, currentSplit2 } = get();
        if (!isActive || lapStartTimeRelative === null) return;

        const nowRel = timestamp || performance.now();
        const elapsedSeconds = (nowRel - lapStartTimeRelative) / 1000;

        if (currentSplit1 === null) {
            // Mark Split 1
            set({ currentSplit1: elapsedSeconds });

            useVehicleStore.setState(state => ({
                raceSession: {
                    ...state.raceSession,
                    currentSplit1: elapsedSeconds
                }
            }));

            DatabaseService.writeSystemLog('Info', 'LapTimer', `Sector 1 Marked: ${elapsedSeconds.toFixed(3)}s`);
        } else if (currentSplit2 === null) {
            // Mark Split 2
            set({ currentSplit2: elapsedSeconds });

            useVehicleStore.setState(state => ({
                raceSession: {
                    ...state.raceSession,
                    currentSplit2: elapsedSeconds
                }
            }));

            DatabaseService.writeSystemLog('Info', 'LapTimer', `Sector 2 Marked: ${(elapsedSeconds - currentSplit1).toFixed(3)}s`);
        }
    },

    calculateLiveDelta: (currentSector) => {
        const { lapStartTimeRelative, currentSplit1, currentSplit2, bestSector1, bestSector2, bestSector3 } = get();
        if (lapStartTimeRelative === null) return null;

        const nowRel = performance.now();
        const lapElapsed = (nowRel - lapStartTimeRelative) / 1000;

        if (currentSector === 1) {
            if (bestSector1 === null) return 0;
            return lapElapsed - bestSector1;
        } else if (currentSector === 2) {
            if (currentSplit1 === null || bestSector2 === null) return 0;
            const sector2Elapsed = lapElapsed - currentSplit1;
            return sector2Elapsed - bestSector2;
        } else if (currentSector === 3) {
            if (currentSplit2 === null || bestSector3 === null) return 0;
            const sector3Elapsed = lapElapsed - currentSplit2;
            return sector3Elapsed - bestSector3;
        }
        return 0;
    }
}));
