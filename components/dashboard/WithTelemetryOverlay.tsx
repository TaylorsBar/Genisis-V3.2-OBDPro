import React from 'react';
import { useLongPress } from '../../hooks/useLongPress';
import { useUIStore } from '../../stores/uiStore';

interface Props {
  children: React.ReactNode;
  dataKey: string;
  title: string;
  className?: string;
  delay?: number;
}

export const WithTelemetryOverlay: React.FC<Props> = ({ 
  children, 
  dataKey, 
  title, 
  className = '', 
  delay = 500 
}) => {
  const showDataOverlay = useUIStore(state => state.showDataOverlay);

  const onLongPress = () => {
    showDataOverlay(dataKey, title);
  };

  const longPressEvents = useLongPress(onLongPress, delay);

  return (
    <div {...longPressEvents} className={`relative cursor-pointer select-none ${className}`}>
      {children}
    </div>
  );
};
