
import React from 'react';

interface KarapiroLogoProps {
    className?: string;
    variant?: 'full' | 'monochrome' | 'icon-only';
}

export const KarapiroLogo: React.FC<KarapiroLogoProps> = ({ className, variant = 'full' }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 300 90" 
    className={className}
    aria-label="Karapiro Cartel Speed Shop"
  >
    <defs>
      <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="45%" stopColor="#b0b0b0" />
        <stop offset="50%" stopColor="#404040" />
        <stop offset="55%" stopColor="#b0b0b0" />
        <stop offset="100%" stopColor="#ffffff" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="black" floodOpacity="0.7"/>
      </filter>
    </defs>

    {variant !== 'icon-only' && (
        <>
            {/* Top text */}
            <text x="150" y="25" textAnchor="middle" fill={variant === 'monochrome' ? 'currentColor' : '#666'} fontFamily="'Orbitron', sans-serif" fontSize="12" letterSpacing="8" fontWeight="bold" opacity={variant === 'monochrome' ? 0.7 : 1}>
            KARAPIRO
            </text>

            {/* Main text */}
            <text x="150" y="60" textAnchor="middle" fill={variant === 'monochrome' ? 'currentColor' : "url(#chrome)"} stroke={variant === 'monochrome' ? 'none' : "#000"} strokeWidth="0.5" fontFamily="'Orbitron', sans-serif" fontSize="42" fontWeight="900" letterSpacing="-1" filter={variant === 'monochrome' ? '' : "url(#shadow)"}>
            CARTEL
            </text>
            
            {/* Subtext */}
            <text x="150" y="80" textAnchor="middle" fill={variant === 'monochrome' ? 'currentColor' : "#888"} fontFamily="monospace" fontSize="9" letterSpacing="2" fontWeight="bold" opacity={0.6}>
            STATE HIGHWAY SPEED SHOP
            </text>
        </>
    )}

    {/* Icon/Stripes */}
    <g transform={variant === 'icon-only' ? 'translate(-30, 10) scale(1.5)' : ''}>
        <rect x="20" y="40" width="20" height="4" fill={variant === 'monochrome' ? 'currentColor' : "#D32F2F"} transform="skewX(-20)" />
        <rect x="45" y="40" width="10" height="4" fill={variant === 'monochrome' ? 'currentColor' : "#D32F2F"} transform="skewX(-20)" />
        
        <rect x="245" y="40" width="10" height="4" fill={variant === 'monochrome' ? 'currentColor' : "#D32F2F"} transform="skewX(-20)" />
        <rect x="260" y="40" width="20" height="4" fill={variant === 'monochrome' ? 'currentColor' : "#D32F2F"} transform="skewX(-20)" />
    </g>

  </svg>
);
