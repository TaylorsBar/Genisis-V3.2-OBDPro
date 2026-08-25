
import React from 'react';
import { motion } from 'motion/react';

interface DataTileProps {
    label: string;
    value: string | number;
    unit: string;
    color?: string;
    border?: boolean;
    warning?: boolean;
}

const DataTile: React.FC<DataTileProps> = React.memo(({ label, value, unit, color = "text-white", border = false, warning = false }) => (
    <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
        flex flex-col justify-center p-3 md:p-4 
        bg-gradient-to-br from-[#151515] via-[#0a0a0a] to-[#1a051a]
        border border-white/5 
        ${border ? 'border-l-4 !border-l-[var(--theme-color)]' : ''} 
        ${warning 
            ? 'bg-red-900/10 border-red-500/50 shadow-glow-red animate-pulse' 
            : 'shadow-[0_0_20px_rgba(188,19,254,0.15)]'
        } 
        rounded-lg min-w-[80px] md:min-w-[120px] h-full transition-all duration-300 group
    `}>
        <div className="flex justify-between items-start mb-1">
            <span className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate group-hover:text-brand-purple transition-colors">{label}</span>
            {warning && <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>}
        </div>
        
        <div className="flex items-baseline gap-1.5 mt-1">
            <span className={`text-2xl md:text-3xl font-mono font-semibold ${warning ? 'text-red-500' : color} tracking-tight drop-shadow-md`}>{value}</span>
            <span className="text-[9px] md:text-[10px] text-gray-500 font-medium font-sans uppercase">{unit}</span>
        </div>
        
        {/* Subtle Bottom Highlight */}
        <div className={`w-full h-px mt-2 bg-gradient-to-r from-transparent via-brand-purple/50 to-transparent ${warning ? 'via-red-500/50' : ''}`}></div>
    </motion.div>
));

export default DataTile;
