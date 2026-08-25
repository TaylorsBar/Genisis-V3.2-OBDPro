
/**
 * Utility functions for formatting vehicle sensor data.
 */

export const formatNumber = (val: number, decimals: number = 1): string => {
    return (val ?? 0).toFixed(decimals);
};

export const toLambda = (voltage: number): number => {
    // Standard 0-5V to 0.5-1.5 Lambda conversion (example)
    return voltage * 0.2 + 0.5;
};

export const toAFR = (voltage: number, fuelType: 'gasoline' | 'e85' = 'gasoline'): number => {
    const lambda = toLambda(voltage);
    const stoich = fuelType === 'e85' ? 9.76 : 14.7;
    return lambda * stoich;
};

export const formatTimeMS = (ms: number): string => {
    const mins = Math.floor(ms / 60000).toString().padStart(2, '0');
    const secs = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    const milliseconds = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    return `${mins}:${secs}.${milliseconds}`;
};

export const getAlertStatus = (val: number, threshold: number, condition: 'greater' | 'less'): boolean => {
    return condition === 'greater' ? val > threshold : val < threshold;
};
