import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Dashboard from './Dashboard';
import Diagnostics from './Diagnostics';
import MaintenanceLog from './MaintenanceLog';
import TuningPage from './TuningPage';
import SimplifyTuning from './SimplifyTuning';
import FlashTuning from './FlashTuning';
import RecalibrationPage from './RecalibrationPage';
import AIEngine from './AIEngine';
import ARAssistant from './ARAssistant';
import Security from './Security';
import Hedera from './Hedera';
import RacePack from './RacePack';
import Accessories from './Accessories';
import Appearance from './Appearance';
import HeadUpDisplay from './HeadUpDisplay';
import LegionNav from './LegionNav';

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/logbook" element={<MaintenanceLog />} />
          <Route path="/tuning" element={<TuningPage />} />
          <Route path="/simplify-tuning" element={<SimplifyTuning />} />
          <Route path="/flash" element={<FlashTuning />} />
          <Route path="/recalibration" element={<RecalibrationPage />} />
          <Route path="/ai-engine" element={<AIEngine />} />
          <Route path="/ar-assistant" element={<ARAssistant />} />
          <Route path="/security" element={<Security />} />
          <Route path="/hedera" element={<Hedera />} />
          <Route path="/race-pack" element={<RacePack />} />
          <Route path="/accessories" element={<Accessories />} />
          <Route path="/appearance" element={<Appearance />} />
          <Route path="/hud" element={<HeadUpDisplay />} />
          <Route path="/navigation" element={<LegionNav />} />
      </Routes>
    </div>
  );
};

export default AnimatedRoutes;
