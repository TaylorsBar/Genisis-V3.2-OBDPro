import React from 'react';
import { motion } from 'motion/react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    glowColor?: string;
    variant?: 'default' | 'tech' | 'cyber';
    skew?: 'left' | 'right' | 'none';
}

const GlassCard: React.FC<GlassCardProps> = ({ 
    children, 
    className = "", 
    glowColor = "rgba(0, 240, 255, 0.05)", 
    variant = 'default',
    skew = 'none'
}) => {
    const skewClass = skew === 'left' ? 'skew-x-[-6deg]' : skew === 'right' ? 'skew-x-[6deg]' : '';
    const innerSkewClass = skew === 'left' ? 'skew-x-[6deg]' : skew === 'right' ? 'skew-x-[-6deg]' : '';

    return (
        <div className={`relative bg-surface-dark/95 backdrop-blur-2xl border border-white/5 rounded-2xl overflow-hidden group shadow-glass ${skewClass} ${className}`}>
            {/* Top highlight for 3D feel */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"></div>

            {/* Base Glow */}
            <div className="absolute inset-0 opacity-40 pointer-events-none transition-opacity duration-700 ease-out group-hover:opacity-100" style={{ boxShadow: `inset 0 0 60px ${glowColor}` }}></div>
            
            {/* Soft background gradient */}
            <div className="absolute inset-0 bg-glass-gradient pointer-events-none mix-blend-overlay"></div>

            {/* Tech Corner Accents */}
            {variant !== 'default' && (
                <>
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-[1.5px] border-l-[1.5px] border-white/10 pointer-events-none rounded-tl-2xl transition-all duration-500 ease-out group-hover:w-8 group-hover:h-8 group-hover:border-white/30"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[1.5px] border-r-[1.5px] border-white/10 pointer-events-none rounded-br-2xl transition-all duration-500 ease-out group-hover:w-8 group-hover:h-8 group-hover:border-white/30"></div>
                </>
            )}

            {/* Cyber Variant Grid */}
            {variant === 'cyber' && (
                <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[length:12px_12px]" style={{ mixBlendMode: 'overlay' }}></div>
            )}

            {/* Moving Scanline on Hover */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 group-hover:opacity-15 transition-opacity duration-1000 ease-in-out mix-blend-overlay">
                <motion.div 
                    initial={{ y: '-100%' }}
                    animate={{ y: '200%' }}
                    transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                    className="w-full h-1/2 bg-gradient-to-b from-transparent via-white to-transparent"
                />
            </div>
            
            <div className={`relative z-10 w-full h-full ${innerSkewClass}`}>
                {children}
            </div>
        </div>
    );
};

export default GlassCard;
