
import { useVehicleStore } from '../stores/vehicleStore';
import { useMemo } from 'react';
import { getAlertStatus } from '../lib/formatters';

export const useFormattedVehicleData = (customData?: any) => {
    const latestData = useVehicleStore(state => state.latestData);
    const d = customData || latestData;

    const formatted = useMemo(() => {
        return {
            rpm: {
                value: d.rpm ?? 0,
                isRedline: (d.rpm ?? 0) > 7500,
                formatted: (d.rpm ?? 0).toFixed(0)
            },
            speed: {
                value: d.speed ?? 0,
                formatted: (d.speed ?? 0).toFixed(0)
            },
            gear: {
                value: d.gear ?? 0,
                display: d.gear === 0 ? 'N' : d.gear.toString()
            },
            boost: {
                value: d.turboBoost ?? 0,
                formatted: (d.turboBoost ?? 0).toFixed(2),
                barValue: ((d.turboBoost ?? 0) + 1) / 3 * 100
            },
            oilPressure: {
                value: d.oilPressure ?? 0,
                formatted: (d.oilPressure ?? 0).toFixed(1),
                isLow: getAlertStatus(d.oilPressure ?? 0, 1.5, 'less'),
                barValue: ((d.oilPressure ?? 0) / 8) * 100
            },
            engineTemp: {
                value: d.engineTemp ?? 0,
                formatted: (d.engineTemp ?? 0).toFixed(0),
                isHigh: getAlertStatus(d.engineTemp ?? 0, 105, 'greater'),
                barValue: ((d.engineTemp ?? 0) / 120) * 100
            },
            batteryVoltage: {
                value: d.batteryVoltage ?? 0,
                formatted: (d.batteryVoltage ?? 0).toFixed(1),
                isLow: getAlertStatus(d.batteryVoltage ?? 0, 12.0, 'less'),
                barValue: Math.min(100, Math.max(0, ((d.batteryVoltage ?? 0) - 10) / 6 * 100))
            },
            lambda: {
                value: (d.o2SensorVoltage ?? 0) * 0.2 + 0.5,
                formatted: ((d.o2SensorVoltage ?? 0) * 0.2 + 0.5).toFixed(2)
            },
            afr: {
                value: ((d.o2SensorVoltage ?? 0) * 0.2 + 0.5) * 14.7,
                formatted: (((d.o2SensorVoltage ?? 0) * 0.2 + 0.5) * 14.7).toFixed(1)
            },
            fuelPressure: {
                value: d.fuelPressure ?? 0,
                formatted: (d.fuelPressure ?? 0).toFixed(1),
                isLow: getAlertStatus(d.fuelPressure ?? 0, 2.5, 'less'),
                barValue: Math.min(100, Math.max(0, (d.fuelPressure ?? 0) / 6 * 100))
            },
            inletAirTemp: {
                value: d.inletAirTemp ?? 0,
                formatted: (d.inletAirTemp ?? 0).toFixed(0),
                isHigh: getAlertStatus(d.inletAirTemp ?? 0, 60, 'greater'),
                barValue: Math.min(100, Math.max(0, ((d.inletAirTemp ?? 0) / 100) * 100))
            },
            throttlePos: {
                value: d.throttlePos ?? 0,
                formatted: (d.throttlePos ?? 0).toFixed(0),
                barValue: d.throttlePos ?? 0
            },
            throttlePosition: {
                value: d.throttlePos ?? 0,
                formatted: (d.throttlePos ?? 0).toFixed(0),
                barValue: d.throttlePos ?? 0
            },
            timingAdvance: {
                value: d.timingAdvance ?? 0,
                formatted: (d.timingAdvance ?? 0).toFixed(1)
            },
            knockRetard: {
                value: d.knockRetard ?? 0,
                formatted: (d.knockRetard ?? 0).toFixed(1),
                isKnocking: (d.knockRetard ?? 0) > 0
            },
            knockLevel: {
                value: d.knockLevel ?? 0,
                formatted: (d.knockLevel ?? 0).toFixed(2)
            },
            knockCount: {
                value: d.knockCount ?? 0,
                formatted: (d.knockCount ?? 0).toString()
            },
            fuelLevel: {
                value: d.fuelLevel ?? 0,
                formatted: (d.fuelLevel ?? 0).toFixed(0),
                barValue: d.fuelLevel ?? 0
            },
            engineLoad: {
                value: d.engineLoad ?? 0,
                formatted: (d.engineLoad ?? 0).toFixed(1),
                barValue: d.engineLoad ?? 0
            },
            fuelTrim: {
                value: d.shortTermFuelTrim ?? 0,
                formatted: (d.shortTermFuelTrim ?? 0).toFixed(1)
            },
            shortTermFuelTrim: {
                value: d.shortTermFuelTrim ?? 0,
                formatted: (d.shortTermFuelTrim ?? 0).toFixed(1)
            },
            longTermFuelTrim: {
                value: d.longTermFuelTrim ?? 0,
                formatted: (d.longTermFuelTrim ?? 0).toFixed(1)
            }
        };
    }, [d]);

    return formatted;
};
