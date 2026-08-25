
import React, { useContext } from 'react';
import { AppearanceContext } from '../contexts/AppearanceContext';
import RallyThemeDashboard from './dashboards/RallyThemeDashboard';
import ModernThemeDashboard from './dashboards/ModernThemeDashboard';
import ClassicThemeDashboard from './dashboards/ClassicThemeDashboard';
import HaltechDashboard from './dashboards/HaltechDashboard';
import ApexiDashboard from './dashboards/ApexiDashboard';
import ProTunerDashboard from './dashboards/ProTunerDashboard';
import EliteTunerDashboard from './dashboards/EliteTunerDashboard';
import MotecCosworthDashboard from './dashboards/MotecCosworthDashboard';
import CarbonPurpleDashboard from './dashboards/CarbonPurpleDashboard';
import GenesisOSDashboard from './dashboards/GenesisOSDashboard';
import NismoDashboard from './dashboards/NismoDashboard';

const Dashboard: React.FC = () => {
  const { theme } = useContext(AppearanceContext);

  const renderDashboard = () => {
    switch (theme) {
      case 'rally':
        return <RallyThemeDashboard />;
      case 'modern':
        return <ModernThemeDashboard />;
      case 'classic':
        return <ClassicThemeDashboard />;
      case 'haltech':
        return <HaltechDashboard />;
      case 'minimalist':
        return <ApexiDashboard />;
      case 'pro-tuner':
        return <ProTunerDashboard />;
      case 'apexi':
        return <ApexiDashboard />;
      case 'elite':
        return <EliteTunerDashboard />;
      case 'motec-pro':
        return <MotecCosworthDashboard />;
      case 'carbon-purple':
        return <CarbonPurpleDashboard />;
      case 'genesis-os':
        return <GenesisOSDashboard />;
      case 'nismo':
        return <NismoDashboard />;
      default:
        // Set Genesis OS as the new default
        return <GenesisOSDashboard />;
    }
  };

  return (
    <div className="h-full w-full relative">
      <div className="w-full h-full absolute inset-0">
        {renderDashboard()}
      </div>
    </div>
  );
};

export default Dashboard;