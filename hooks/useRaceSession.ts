import { useState, useEffect, useRef, useCallback } from 'react';
import { SensorDataPoint, RaceSession, LaunchState, DragStats, DragStripState } from '../types';
import { analyzeRaceTelemetry, RaceEngineerReport } from '../services/geminiService';
import { useVehicleStore } from '../stores/vehicleStore';
import { useLapTimerStore } from '../stores/lapTimerStore';

// Timing Constants for Drag
const METERS_60_FT = 18.288;
const METERS_330_FT = 100.584;
const METERS_1_8_MILE = 201.168;
const METERS_1000_FT = 304.8;
const METERS_1_4_MILE = 402.336;

const CIRCUIT_LAP_DISTANCE = 3500; // Simulated lap distance for circuit

const initialDragStats: DragStats = {
    reactionTime: null,
    sixtyFootTime: null,
    threeThirtyTime: null,
    eighthMileTime: null,
    eighthMileSpeed: null,
    oneThousandTime: null,
    quarterMileTime: null,
    quarterMileSpeed: null,
    zeroToSixtyTime: null,
    zeroToHundredTime: null,
    densityAltitude: 0,
    slope: 0,
    valid: true
};

const initialSessionState: RaceSession = {
    mode: 'DRAG',
    isActive: false,
    dragState: DragStripState.Idle,
    launchState: LaunchState.Idle,
    startTime: null,
    greenLightTime: null,
    elapsedTime: 0,
    data: [],
    lapTimes: [],
    dragStats: initialDragStats,
    currentDelta: 0,
    aiInsights: [],
    bestLapData: []
};

const interpolateTime = (val1: number, time1: number, val2: number, time2: number, targetVal: number): number => {
    if (val2 === val1) return time2;
    const fraction = (targetVal - val1) / (val2 - val1);
    return time1 + (time2 - time1) * fraction;
};

export const useRaceSession = () => {
    const startLogging = useVehicleStore(state => state.startLogging);
    const stopLogging = useVehicleStore(state => state.stopLogging);
    const session = useVehicleStore(state => state.raceSession);
    const setSessionState = useCallback((updater: (s: RaceSession) => RaceSession) => {
        useVehicleStore.setState(state => ({ raceSession: updater(state.raceSession) }));
    }, []);
    
    const [aiReport, setAiReport] = useState<RaceEngineerReport | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    
    const sessionUpdateRef = useRef<number | null>(null);
    const treeTimeoutRef = useRef<any>(null);
    const startDataRef = useRef<SensorDataPoint | null>(null);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopLogging(`TrackCam_${Date.now()}`);
            setIsRecording(false);
        } else {
            startLogging();
            setIsRecording(true);
        }
    }, [isRecording, startLogging, stopLogging]);

    const startTreeSequence = useCallback(() => {
        if (treeTimeoutRef.current) clearTimeout(treeTimeoutRef.current);
        setSessionState(s => ({ ...s, dragState: DragStripState.PreStage, isActive: true, data: [] }));
        setAiReport(null);
        
        treeTimeoutRef.current = setTimeout(() => {
            setSessionState(s => ({ ...s, dragState: DragStripState.Stage }));
            const randomDelay = 1200 + Math.random() * 800;
            
            treeTimeoutRef.current = setTimeout(() => {
                setSessionState(s => ({ ...s, dragState: DragStripState.Amber1 }));
                treeTimeoutRef.current = setTimeout(() => {
                    setSessionState(s => ({ ...s, dragState: DragStripState.Amber2 }));
                    treeTimeoutRef.current = setTimeout(() => {
                        setSessionState(s => ({ ...s, dragState: DragStripState.Amber3 }));
                        treeTimeoutRef.current = setTimeout(() => {
                            setSessionState(s => ({ 
                                ...s, 
                                dragState: DragStripState.Green, 
                                greenLightTime: Date.now(),
                                launchState: LaunchState.Go 
                            }));
                        }, 400);
                    }, 400);
                }, 400);
            }, randomDelay);
        }, 1500);
    }, [setSessionState]);

    const resetSession = useCallback(() => {
        if (treeTimeoutRef.current) clearTimeout(treeTimeoutRef.current);
        if (sessionUpdateRef.current) cancelAnimationFrame(sessionUpdateRef.current);
        if (isRecording) {
            stopLogging(`Session_Reset_${Date.now()}`);
            setIsRecording(false);
        }
        useLapTimerStore.getState().resetSession();
        setSessionState(s => ({ ...initialSessionState, mode: s.mode }));
        setAiReport(null);
        setIsAnalyzing(false);
        startDataRef.current = null;
        sessionUpdateRef.current = requestAnimationFrame(updateSession);
    }, [isRecording, stopLogging, setSessionState]);

    const updateSession = useCallback(() => {
        const state = useVehicleStore.getState();
        const prev = state.raceSession;
        if (!prev.isActive) {
            sessionUpdateRef.current = requestAnimationFrame(updateSession);
            return;
        }

        const currentData = state.latestData;
        const prevData = prev.data.length > 0 ? prev.data[prev.data.length-1] : currentData;
        
        let nextSession = { ...prev };

        if (prev.mode === 'DRAG') {
            let dragState = prev.dragState;
            let startTime = prev.startTime;
            let dragStats = { ...prev.dragStats };

            // Foul detection (Red Light)
            if (
                (dragState === DragStripState.Stage || dragState === DragStripState.Amber1 || dragState === DragStripState.Amber2 || dragState === DragStripState.Amber3) 
                && currentData.speed > 0.8
            ) {
                if (treeTimeoutRef.current) clearTimeout(treeTimeoutRef.current);
                setSessionState(s => ({ ...s, dragState: DragStripState.RedLight, launchState: LaunchState.FalseStart, dragStats: { ...s.dragStats, valid: false } }));
                return;
            }

            // Start Detection (1ft rollout equivalence using 0.8 km/h)
            if ((dragState === DragStripState.Green || dragState === DragStripState.RedLight) && !startTime && currentData.speed > 0.8) {
                dragState = DragStripState.Running;
                // Interpolate exact start timestamp for NHRA spec accuracy
                startTime = interpolateTime(prevData.speed, prevData.time, currentData.speed, currentData.time, 0.8);
                startDataRef.current = currentData;
                
                if (prev.greenLightTime && prev.dragState !== DragStripState.RedLight) {
                    dragStats.reactionTime = (startTime - prev.greenLightTime) / 1000;
                }
                if (!isRecording) {
                    startLogging();
                    setIsRecording(true);
                }
            }

            // Split Calculation
            if (dragState === DragStripState.Running && startTime && startDataRef.current) {
                const curDist = currentData.distance - startDataRef.current.distance;
                const prevDist = prevData.distance - startDataRef.current.distance;

                const checkSplit = (dist: number, currentStat: number | null) => {
                    if (currentStat !== null) return currentStat;
                    if (curDist >= dist && prevDist < dist) {
                        return (interpolateTime(prevDist, prevData.time, curDist, currentData.time, dist) - startTime!) / 1000;
                    }
                    return null;
                };

                const checkSpeedSplit = (targetSpeedKph: number, currentStat: number | null) => {
                    if (currentStat !== null) return currentStat;
                    if (currentData.speed >= targetSpeedKph && prevData.speed < targetSpeedKph) {
                        return (interpolateTime(prevData.speed, prevData.time, currentData.speed, currentData.time, targetSpeedKph) - startTime!) / 1000;
                    }
                    return null;
                };

                dragStats.sixtyFootTime = checkSplit(METERS_60_FT, dragStats.sixtyFootTime);
                dragStats.threeThirtyTime = checkSplit(METERS_330_FT, dragStats.threeThirtyTime);
                dragStats.eighthMileTime = checkSplit(METERS_1_8_MILE, dragStats.eighthMileTime);
                if (dragStats.eighthMileTime !== null && dragStats.eighthMileSpeed === null) {
                    dragStats.eighthMileSpeed = interpolateTime(prevDist, prevData.speed, curDist, currentData.speed, METERS_1_8_MILE);
                }
                dragStats.oneThousandTime = checkSplit(METERS_1000_FT, dragStats.oneThousandTime);
                
                dragStats.zeroToSixtyTime = checkSpeedSplit(96.5606, dragStats.zeroToSixtyTime); // 0-60 MPH
                dragStats.zeroToHundredTime = checkSpeedSplit(160.934, dragStats.zeroToHundredTime); // 0-100 MPH

                if (dragStats.quarterMileTime === null && curDist >= METERS_1_4_MILE) {
                    dragStats.quarterMileTime = (interpolateTime(prevDist, prevData.time, curDist, currentData.time, METERS_1_4_MILE) - startTime) / 1000;
                    dragStats.quarterMileSpeed = interpolateTime(prevDist, prevData.speed, curDist, currentData.speed, METERS_1_4_MILE);
                    dragState = DragStripState.Finished;
                    
                    stopLogging(`Drag_1-4_Mile_${dragStats.quarterMileTime.toFixed(2)}s`);
                    setIsRecording(false);

                    // Trigger ATE Core v2.0 Analysis
                    setIsAnalyzing(true);
                    analyzeRaceTelemetry('DRAG', dragStats, [...prev.data, currentData]).then(report => {
                        setAiReport(report);
                        setIsAnalyzing(false);
                    });
                }
            }

            nextSession = {
                ...prev,
                dragState,
                startTime,
                elapsedTime: startTime ? currentData.time - startTime : 0,
                data: [...prev.data, currentData].slice(-5000),
                dragStats
            };
        } else if (prev.mode === 'CIRCUIT') {
            let lapTimes = [...prev.lapTimes];
            let startTime = prev.startTime;
            
            if (!startTime && currentData.speed > 5) {
                startTime = interpolateTime(prevData.speed, prevData.time, currentData.speed, currentData.time, 5);
                startDataRef.current = currentData;
                if (!isRecording) {
                    startLogging();
                    setIsRecording(true);
                }
                // Also trigger startSession in high precision timer
                useLapTimerStore.getState().startSession("Grand Loop");
            }

            if (startTime && startDataRef.current) {
                const curTotalDist = currentData.distance - startDataRef.current.distance;
                const prevTotalDist = prevData.distance - startDataRef.current.distance;

                const lapNumber = Math.floor(curTotalDist / CIRCUIT_LAP_DISTANCE);
                const prevLapNumber = Math.floor(prevTotalDist / CIRCUIT_LAP_DISTANCE);

                if (lapNumber > prevLapNumber) {
                    // Trigger high precision lap transition
                    useLapTimerStore.getState().startLap();
                }
            }

            // Sync elapsed time from high-precision lapTimerStore if available
            const timerState = useLapTimerStore.getState();
            const elapsed = timerState.lapStartTimeRelative !== null 
                ? (performance.now() - timerState.lapStartTimeRelative) 
                : (startTime ? currentData.time - startTime : 0);

            nextSession = {
                ...prev,
                startTime,
                elapsedTime: elapsed,
                lapTimes: timerState.lapTimes.length > 0 ? timerState.lapTimes : prev.lapTimes,
                data: [...prev.data, currentData].slice(-2000),
                currentSplit1: timerState.currentSplit1 || undefined,
                currentSplit2: timerState.currentSplit2 || undefined
            };
        }

        useVehicleStore.setState({ raceSession: nextSession });
        sessionUpdateRef.current = requestAnimationFrame(updateSession);
    }, [isRecording, startLogging, stopLogging, setSessionState]); 

    const setMode = (mode: 'CIRCUIT' | 'DRAG' | 'BENCHMARK') => {
        if (treeTimeoutRef.current) clearTimeout(treeTimeoutRef.current);
        setSessionState(s => ({ ...initialSessionState, mode }));
        setAiReport(null);
    };

    const initLaunchSequence = () => {
        resetSession();
        setSessionState(s => ({ ...s, isActive: true, mode: 'DRAG' }));
        startTreeSequence();
    };

    const startCircuitSession = () => {
        resetSession();
        useLapTimerStore.getState().startSession("Grand Loop");
    };

    const triggerStartLap = useCallback(() => {
        const lapTimer = useLapTimerStore.getState();
        if (!lapTimer.isActive) {
            lapTimer.startSession("Grand Loop");
        }
        lapTimer.startLap();
        if (!isRecording) {
            startLogging();
            setIsRecording(true);
        }
    }, [isRecording, startLogging]);

    const triggerMarkSector = useCallback(() => {
        const lapTimer = useLapTimerStore.getState();
        if (lapTimer.isActive) {
            lapTimer.markSector();
        }
    }, []);

    useEffect(() => {
        sessionUpdateRef.current = requestAnimationFrame(updateSession);
        return () => {
            if (sessionUpdateRef.current) cancelAnimationFrame(sessionUpdateRef.current);
            if (treeTimeoutRef.current) clearTimeout(treeTimeoutRef.current);
        };
    }, [updateSession]);

    return { session, aiReport, isAnalyzing, isRecording, toggleRecording, setMode, initLaunchSequence, startCircuitSession, resetSession, triggerStartLap, triggerMarkSector };
};