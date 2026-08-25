import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
    title?: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    iconType?: 'info' | 'question';
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({ 
    title, 
    content, 
    position = 'top',
    iconType = 'info'
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Dynamic position styling
    const getPositionClasses = () => {
        switch (position) {
            case 'bottom':
                return 'top-full left-1/2 -translate-x-1/2 mt-2';
            case 'left':
                return 'right-full top-1/2 -translate-y-1/2 mr-2';
            case 'right':
                return 'left-full top-1/2 -translate-y-1/2 ml-2';
            case 'top':
            default:
                return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
        }
    };

    // Close on click outside for mobile usability
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setIsVisible(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const IconComponent = iconType === 'info' ? Info : HelpCircle;

    return (
        <div 
            ref={tooltipRef}
            className="relative inline-flex items-center justify-center shrink-0"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsVisible(!isVisible);
                }}
                className="w-4 h-4 rounded-full flex items-center justify-center text-zinc-500 hover:text-brand-cyan transition-colors focus:outline-none focus:ring-1 focus:ring-brand-cyan/50"
                style={{ minWidth: '16px', minHeight: '16px' }}
                aria-label="More information"
            >
                <IconComponent size={14} />
            </button>

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 4 : position === 'bottom' ? -4 : 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={`absolute z-[100] w-64 p-3 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl pointer-events-none md:pointer-events-auto ${getPositionClasses()}`}
                    >
                        {title && (
                            <h5 className="text-[10px] font-mono font-black text-brand-cyan uppercase tracking-wider mb-1">
                                {title}
                            </h5>
                        )}
                        <p className="text-[10px] text-zinc-300 font-mono tracking-normal leading-relaxed break-words">
                            {content}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HelpTooltip;
