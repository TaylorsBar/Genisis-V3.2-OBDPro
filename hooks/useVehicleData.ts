import { useState, useEffect, useRef } from 'react';
import { useVehicleStore } from '../stores/vehicleStore';
import { SensorDataPoint } from '../types';

/**
 * Hook for connection state and system controls (Low frequency).
 * Use this for UI elements like sidebars, settings, or connection buttons.
 * This will NOT trigger re-renders on every sensor update.
 */
export const useVehicleConnection = () => {
    const obdState = useVehicleStore(state => state.obdState);
    const ekfStats = useVehicleStore(state => state.ekfStats);
    const connectObd = useVehicleStore(state => state.connectObd);
    const disconnectObd = useVehicleStore(state => state.disconnectObd);
    const startFusionLoop = useVehicleStore(state => state.startFusionLoop);
    const stopFusionLoop = useVehicleStore(state => state.stopFusionLoop);

    return { 
        obdState, 
        ekfStats, 
        connectObd, 
        disconnectObd, 
        startFusionLoop,
        stopFusionLoop
    };
};

/**
 * Hook to retrieve a specific telemetry field from high-frequency vehicle data.
 * Subscribes to only a single property of latestData to prevent redundant re-renders.
 */
export const useTelemetryField = <K extends keyof SensorDataPoint>(field: K, throttleMs?: number): number => {
    const value = useVehicleStore(state => state.latestData[field]);
    return (value as number) || 0;
};

/**
 * Hook to retrieve full telemetry data and status for dashboard components.
 */
export const useVehicleTelemetry = () => {
    const latestData = useVehicleStore(state => state.latestData);
    const hasActiveFault = useVehicleStore(state => state.hasActiveFault);
    return { latestData, hasActiveFault };
};
