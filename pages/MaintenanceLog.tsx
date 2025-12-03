
import React from 'react';
import { MaintenanceRecord } from '../types';
import VerifiedIcon from '../components/icons/VerifiedIcon';
import { useVehicleStore } from '../stores/vehicleStore';

export const MOCK_LOGS: MaintenanceRecord[] = [
  { id: '1', date: '2024-07-15', service: 'Oil & Filter Change', notes: 'Performed by KC SpeedShop. Used Mobil 1 5W-30.', verified: true, isAiRecommendation: false },
  { id: '2', date: '2024-06-28', service: 'Replace Air Filter', notes: 'Airflow sensor detected reduced intake. Recommended replacement.', verified: true, isAiRecommendation: true },
  { id: '3', date: '2024-06-01', service: 'Tire Rotation', notes: 'Standard 5,000-mile service.', verified: true, isAiRecommendation: false },
  { id: '4', date: '2024-05-20', service: 'Inspect O2 Sensor', notes: 'System predicted potential O2 sensor degradation based on response times.', verified: false, isAiRecommendation: true },
  { id: '5', date: '2024-03-10', service: 'Brake Fluid Flush', notes: 'Completed at dealer.', verified: false, isAiRecommendation: false },
];


const MaintenanceLog: React.FC = () => {
  const { primeFuelSystem, isPriming, latestData } = useVehicleStore();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
            <h1 className="text-2xl font-bold text-white font-display tracking-tight">Service Database</h1>
            <p className="text-gray-500 text-sm mt-1">Immutable Maintenance Records // VIN: JN1AZ00Z9ZT000123</p>
        </div>
        <button className="bg-white/5 hover:bg-white/10 text-brand-cyan border border-brand-cyan/50 font-semibold px-6 py-2 rounded uppercase text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(0,240,255,0.1)]">
            + Log Entry
        </button>
      </div>
      
      {/* Service Functions / Active Tests */}
      <div className="bg-[#111] p-4 rounded-lg border border-brand-cyan/20">
          <h2 className="text-sm font-bold text-brand-cyan uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              Service Functions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-black border border-gray-800 rounded p-4 flex flex-col justify-between">
                  <div>
                      <h3 className="text-white font-bold text-sm">Diesel Fuel Prime</h3>
                      <p className="text-gray-500 text-xs mt-1">Activates LPFP to purge air from lines (Duratorq/TDCi).</p>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                      <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 font-bold uppercase">Rail Pressure</span>
                          <span className="text-xl font-mono text-brand-cyan">{latestData.fuelRailPressure.toFixed(0)} <span className="text-xs text-gray-600">kPa</span></span>
                      </div>
                      <button 
                        onClick={primeFuelSystem}
                        disabled={isPriming}
                        className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${isPriming ? 'bg-green-500 text-black animate-pulse' : 'bg-brand-red text-white hover:bg-red-600'}`}
                      >
                          {isPriming ? 'PRIMING SYSTEM...' : 'START PRIME'}
                      </button>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[#111] border border-gray-800 p-4 rounded">
              <div className="text-xs text-gray-500 uppercase font-bold">Total Services</div>
              <div className="text-2xl font-mono text-white mt-1">14</div>
          </div>
          <div className="bg-[#111] border border-gray-800 p-4 rounded">
              <div className="text-xs text-gray-500 uppercase font-bold">Verified</div>
              <div className="text-2xl font-mono text-green-500 mt-1">12</div>
          </div>
          <div className="bg-[#111] border border-gray-800 p-4 rounded">
              <div className="text-xs text-gray-500 uppercase font-bold">Pending</div>
              <div className="text-2xl font-mono text-yellow-500 mt-1">2</div>
          </div>
          <div className="bg-[#111] border border-gray-800 p-4 rounded">
              <div className="text-xs text-gray-500 uppercase font-bold">Health Score</div>
              <div className="text-2xl font-mono text-brand-cyan mt-1">98%</div>
          </div>
      </div>

      <div className="bg-[#0a0a0a] rounded-lg border border-gray-800 overflow-hidden">
        <div className="grid grid-cols-12 bg-[#151515] p-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800">
            <div className="col-span-2">Date</div>
            <div className="col-span-4">Service Type</div>
            <div className="col-span-4">Notes</div>
            <div className="col-span-2 text-right">Verification</div>
        </div>
        <div className="divide-y divide-gray-800">
            {MOCK_LOGS.map((log) => (
                <div key={log.id} className="grid grid-cols-12 p-4 items-center hover:bg-white/5 transition-colors group">
                    <div className="col-span-2 font-mono text-sm text-gray-300">{log.date}</div>
                    <div className="col-span-4 font-semibold text-white flex items-center">
                        {log.isAiRecommendation && <span className="text-[10px] bg-brand-cyan/20 text-brand-cyan px-1.5 py-0.5 rounded mr-2 border border-brand-cyan/30">AI</span>}
                        {log.service}
                    </div>
                    <div className="col-span-4 text-sm text-gray-500 group-hover:text-gray-400 transition-colors">{log.notes}</div>
                    <div className="col-span-2 flex justify-end">
                        {log.verified ? (
                            <div className="flex items-center text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                                <VerifiedIcon className="w-4 h-4 mr-1.5" />
                                <span className="text-xs font-bold uppercase tracking-wide">Verified</span>
                            </div>
                        ) : (
                            <div className="flex items-center text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                                <span className="text-xs font-bold uppercase tracking-wide">Pending</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default MaintenanceLog;
