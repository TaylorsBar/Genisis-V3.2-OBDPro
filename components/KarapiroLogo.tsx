
import React from 'react';

interface KarapiroLogoProps {
    className?: string;
    variant?: 'full' | 'monochrome' | 'icon-only';
    style?: React.CSSProperties;
    text1Style?: React.CSSProperties;
    text2Style?: React.CSSProperties;
    text3Style?: React.CSSProperties;
}

export const KarapiroLogo: React.FC<KarapiroLogoProps> = ({ 
  className, 
  variant = 'full', 
  style, 
  text1Style, 
  text2Style, 
  text3Style 
}) => {
  if (variant === 'icon-only') {
    return (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 100 100" 
        className={className}
        aria-label="Karapiro Cartel Emblem"
      >
        <defs>
          <linearGradient id="chromeEmblem" x1="0" y1="0" x2="0" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor="#d0d0d0" />
            <stop offset="50%" stopColor="#1a1a1a" />
            <stop offset="55%" stopColor="#909090" />
            <stop offset="100%" stopColor="#f5f5f5" />
          </linearGradient>
          <filter id="glowEmblem">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="shadowEmblem" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="3" stdDeviation="1.5" floodColor="black" floodOpacity="0.8"/>
          </filter>
        </defs>

        {/* Speed stripes (aggressive slanted wing marks) */}
        <g transform="translate(0, 0)">
          {/* Left Wing Slants */}
          <path d="M 5,45 L 25,45 L 22,48 L 2,48 Z" fill="#D32F2F" opacity="0.9" />
          <path d="M 10,54 L 28,54 L 25,57 L 7,57 Z" fill="#D32F2F" opacity="0.9" />
          <path d="M 15,63 L 31,63 L 28,66 L 12,66 Z" fill="#D32F2F" opacity="0.9" />

          {/* Right Wing Slants */}
          <path d="M 95,45 L 75,45 L 78,48 L 98,48 Z" fill="#D32F2F" opacity="0.9" />
          <path d="M 90,54 L 72,54 L 75,57 L 93,57 Z" fill="#D32F2F" opacity="0.9" />
          <path d="M 85,63 L 69,63 L 72,66 L 88,66 Z" fill="#D32F2F" opacity="0.9" />
        </g>

        {/* Slanted racing polygon background */}
        <polygon 
          points="35,20 68,20 62,80 29,80" 
          fill="#050505" 
          stroke="#222" 
          strokeWidth="1.5" 
        />

        {/* Stylized dynamic sharp "K" inside polygon */}
        <g filter="url(#shadowEmblem)" transform="translate(2, 0)">
          {/* Vertical core bar of K */}
          <path d="M 41,28 L 47,28 L 43,72 L 37,72 Z" fill="url(#chromeEmblem)" stroke="#000" strokeWidth="0.5" />
          
          {/* Top prong of K */}
          <path d="M 45,46 L 61,28 L 68,28 L 49,49 Z" fill="url(#chromeEmblem)" stroke="#000" strokeWidth="0.5" />
          
          {/* Bottom prong of K */}
          <path d="M 47,47 L 51,47 L 62,72 L 55,72 Z" fill="url(#chromeEmblem)" stroke="#000" strokeWidth="0.5" />
        </g>

        {/* Glowing speed lights */}
        <circle cx="48" cy="49" r="1.5" fill="#00F0FF" filter="url(#glowEmblem)" />
      </svg>
    );
  }

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 300 90" 
      className={className}
      aria-label="Karapiro Cartel Speed Shop"
      style={style}
    >
      <defs>
        <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#c5c5c5" />
          <stop offset="50%" stopColor="#252525" />
          <stop offset="55%" stopColor="#ababab" />
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
          <feDropShadow dx="2" dy="2.5" stdDeviation="1.5" floodColor="black" floodOpacity="0.8"/>
        </filter>
      </defs>

      {/* Top text */}
      <text x="150" y="24" textAnchor="middle" fill={variant === 'monochrome' ? 'currentColor' : '#777'} fontFamily="'Orbitron', sans-serif" fontSize="10.5" letterSpacing="8" fontWeight="bold" opacity={variant === 'monochrome' ? 0.75 : 1} style={text1Style}>
        KARTEL CO.
      </text>

      {/* Main text */}
      <text x="150" y="58" textAnchor="middle" fill={variant === 'monochrome' ? 'currentColor' : "url(#chrome)"} stroke={variant === 'monochrome' ? 'none' : "#000"} strokeWidth="0.5" fontFamily="'Orbitron', sans-serif" fontSize="28" fontWeight="900" letterSpacing="1" filter={variant === 'monochrome' ? '' : "url(#shadow)"} style={{ ...text2Style, fontStyle: 'italic' }}>
        KC SPEEDSHOP
      </text>
      
      {/* Subtext */}
      <text x="150" y="78" textAnchor="middle" fill={variant === 'monochrome' ? 'currentColor' : "#999"} fontFamily="monospace" fontSize="8" letterSpacing="2.5" fontWeight="bold" opacity={0.65} style={text3Style}>
        EST. 2026 • CALIBRATION DEPT
      </text>

      {/* Icon/Stripes - Fixed coordinates that remain perfectly within viewBox boundings */}
      <g>
        {/* Left Side slant stripes */}
        <polygon points="12,43 32,43 28,47 8,47" fill={variant === 'monochrome' ? 'currentColor' : "#D32F2F"} />
        <polygon points="26,51 38,51 34,55 22,55" fill={variant === 'monochrome' ? 'currentColor' : "#D32F2F"} />
        
        {/* Right Side slant stripes */}
        <polygon points="262,43 274,43 270,47 258,47" fill={variant === 'monochrome' ? 'currentColor' : "#D32F2F"} />
        <polygon points="268,51 288,51 284,55 264,55" fill={variant === 'monochrome' ? 'currentColor' : "#D32F2F"} />
      </g>
    </svg>
  );
};
