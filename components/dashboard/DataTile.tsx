
import React from 'react';

interface DataTileProps {
    label: string;
    value: string | number;
    unit: string;
    color?: string;
    border?: boolean;
    warning?: boolean;
}

const DataTile: React.FC<DataTileProps> = React.memo(({ label, value, unit, color = "text-white", border = false, warning = false }) => (
    <div className={`flex flex-col justify-center p-2 md:p-4 bg-surface-panel backdrop-blur-sm border border-white/5 ${border ? 'border-l-4 !border-l-[var(--theme-color)]' : ''} ${warning ? 'bg-red-900/20 border-red-500 animate-pulse' : ''} rounded-md min-w-[80px] md:min-w-[120px] shadow-md h-full transition-colors`}>
        <span className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 truncate">{label}</span>
        <div className="flex items-baseline gap-1">
            <span className={`text-2xl md:text-3xl font-mono font-bold ${warning ? 'text-red-500' : color} tracking-tight`}>{value}</span>
            <span className="text-[8px] md:text-[10px] text-gray-600 font-bold">{unit}</span>
        </div>
    </div>
));

export default DataTile;
