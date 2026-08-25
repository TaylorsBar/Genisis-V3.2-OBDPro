import React from 'react';
import { Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

interface MapProps {
  lat: number;
  lon: number;
}

const Map: React.FC<MapProps> = ({ lat, lon }) => {
  const position = { lat, lng: lon };

  return (
    <div className="w-full h-full bg-[#030312] rounded-lg overflow-hidden relative border border-brand-cyan/20 group-hover:border-brand-cyan/40 transition-all duration-500 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
      
      {/* 1. GOOGLE MAPS LAYER */}
      <div className="absolute inset-0 z-0">
          <GoogleMap
            defaultCenter={position}
            defaultZoom={15}
            mapId="bf146f610ad74843"
            disableDefaultUI={true}
            gestureHandling={'none'}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <AdvancedMarker position={position}>
                <Pin background={'#00F0FF'} borderColor={'#00F0FF'} glyphColor={'#000'} />
            </AdvancedMarker>
          </GoogleMap>
      </div>

      {/* 2. ATMOSPHERIC OVERLAYS */}
      {/* Vignette for depth */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_30%,#030312_100%)] opacity-70"></div>
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none z-20 opacity-10" 
           style={{ 
               backgroundImage: 'linear-gradient(#00F0FF 1px, transparent 1px), linear-gradient(90deg, #00F0FF 1px, transparent 1px)',
               backgroundSize: '30px 30px'
           }}>
      </div>

      {/* Scanning Line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-brand-cyan/10 blur-[1px] animate-[scan_6s_linear_infinite] z-30 pointer-events-none"></div>

      {/* 3. TACTICAL HUD ELEMENTS */}
      {/* Center Reticle */}
      <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center">
          {/* Inner Circle */}
          <div className="w-12 h-12 border border-brand-cyan/40 rounded-full animate-pulse"></div>
          
          {/* Brackets */}
          <div className="absolute w-20 h-20">
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-brand-cyan/60"></div>
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-brand-cyan/60"></div>
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-brand-cyan/60"></div>
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-brand-cyan/60"></div>
          </div>

          {/* Compass Markers */}
          <div className="absolute top-2 font-mono text-[8px] text-brand-cyan font-bold tracking-widest opacity-50 uppercase">N_000</div>
          <div className="absolute bottom-2 font-mono text-[8px] text-brand-cyan font-bold tracking-widest opacity-50 uppercase">S_180</div>
      </div>

      {/* 4. COORDINATE READOUT (Static Decoration) */}
      <div className="absolute bottom-2 left-3 z-40 font-mono text-[8px] text-brand-cyan/60 uppercase tracking-widest pointer-events-none">
          LAT: {lat.toFixed(6)} <br />
          LON: {lon.toFixed(6)}
      </div>

      {/* 5. STATUS INDICATOR */}
      <div className="absolute top-3 right-3 z-40 flex items-center gap-2 pointer-events-none">
          <span className="text-[7px] font-mono text-brand-cyan font-bold uppercase tracking-widest bg-black/40 px-2 py-0.5 border border-brand-cyan/20">GPS_LOCKED</span>
          <div className="w-1.5 h-1.5 bg-brand-cyan rounded-full animate-ping"></div>
      </div>

      <style>{`
          @keyframes scan {
              0% { top: -10%; opacity: 0; }
              10% { opacity: 0.3; }
              90% { opacity: 0.3; }
              100% { top: 110%; opacity: 0; }
          }
      `}</style>
    </div>
  );
};

export default Map;
