
import React, { createContext, useState, useEffect, useMemo } from 'react';

export type Theme = 'rally' | 'modern' | 'classic' | 'haltech' | 'minimalist' | 'pro-tuner';
export type ColorPalette = 'cyan' | 'red' | 'green' | 'purple' | 'amber';
export type SurfaceMaterial = 'glass' | 'carbon' | 'brushed-metal' | 'matte';
export type LEDMode = 'solid' | 'pulse' | 'music';
export type CopilotAudioOutput = 'phone' | 'stereo';

export interface LEDSettings {
  isOn: boolean;
  color: string; // hex color
  brightness: number; // 0-100
  mode: LEDMode;
}

interface AppearanceContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorPalette: ColorPalette;
  setColorPalette: (palette: ColorPalette) => void;
  surfaceMaterial: SurfaceMaterial;
  setSurfaceMaterial: (material: SurfaceMaterial) => void;
  ledSettings: LEDSettings;
  setLedSettings: (settings: Partial<LEDSettings>) => void;
  copilotAudioOutput: CopilotAudioOutput;
  setCopilotAudioOutput: (output: CopilotAudioOutput) => void;
}

const defaultLedSettings: LEDSettings = {
    isOn: true,
    color: '#00FFFF',
    brightness: 80,
    mode: 'solid',
};

const PALETTE_COLORS: Record<ColorPalette, string> = {
    'cyan': '#00F0FF',
    'red': '#FF003C',
    'green': '#33FF33',
    'purple': '#BC13FE',
    'amber': '#FCEE0A'
};

const PALETTE_DIMS: Record<ColorPalette, string> = {
    'cyan': '#005555',
    'red': '#550014',
    'green': '#115511',
    'purple': '#440055',
    'amber': '#554400'
};

export const AppearanceContext = createContext<AppearanceContextProps>({
  theme: 'haltech',
  setTheme: () => {},
  colorPalette: 'cyan',
  setColorPalette: () => {},
  surfaceMaterial: 'glass',
  setSurfaceMaterial: () => {},
  ledSettings: defaultLedSettings,
  setLedSettings: () => {},
  copilotAudioOutput: 'phone',
  setCopilotAudioOutput: () => {},
});

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
      return (localStorage.getItem('vehicle-theme') as Theme) || 'haltech';
  });
  const [colorPalette, setColorPaletteState] = useState<ColorPalette>(() => {
      return (localStorage.getItem('vehicle-palette') as ColorPalette) || 'cyan';
  });
  const [surfaceMaterial, setSurfaceMaterialState] = useState<SurfaceMaterial>(() => {
      return (localStorage.getItem('vehicle-material') as SurfaceMaterial) || 'glass';
  });
  const [ledSettings, setLedSettingsState] = useState<LEDSettings>(() => {
      const saved = localStorage.getItem('vehicle-led-settings');
      return saved ? JSON.parse(saved) : defaultLedSettings;
  });
  const [copilotAudioOutput, setCopilotAudioOutputState] = useState<CopilotAudioOutput>(() => {
    return (localStorage.getItem('vehicle-copilot-audio') as CopilotAudioOutput) || 'phone';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vehicle-theme', theme);
  }, [theme]);
  
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', colorPalette);
    localStorage.setItem('vehicle-palette', colorPalette);
    
    // Inject CSS Variables for Dashboards
    const root = document.documentElement;
    const mainColor = PALETTE_COLORS[colorPalette];
    const dimColor = PALETTE_DIMS[colorPalette];
    
    root.style.setProperty('--theme-color', mainColor);
    root.style.setProperty('--theme-dim', dimColor);
    root.style.setProperty('--theme-accent', mainColor); // alias
    root.style.setProperty('--theme-glow', `0 0 15px ${mainColor}60`);
    
  }, [colorPalette]);
  
  useEffect(() => {
    document.documentElement.setAttribute('data-material', surfaceMaterial);
    localStorage.setItem('vehicle-material', surfaceMaterial);
  }, [surfaceMaterial]);
  
  useEffect(() => {
    localStorage.setItem('vehicle-led-settings', JSON.stringify(ledSettings));
    const { isOn, color, brightness } = ledSettings;
    if (isOn) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const glowColor = `rgba(${r}, ${g}, ${b}, ${brightness / 100 * 0.8})`;
        document.documentElement.style.setProperty('--theme-ambient-glow-color', glowColor);
    } else {
        document.documentElement.style.setProperty('--theme-ambient-glow-color', 'transparent');
    }
  }, [ledSettings]);

  useEffect(() => {
    localStorage.setItem('vehicle-copilot-audio', copilotAudioOutput);
  }, [copilotAudioOutput]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };
  
  const setColorPalette = (newPalette: ColorPalette) => {
    setColorPaletteState(newPalette);
  }
  
  const setSurfaceMaterial = (newMaterial: SurfaceMaterial) => {
    setSurfaceMaterialState(newMaterial);
  };
  
  const setLedSettings = (newSettings: Partial<LEDSettings>) => {
    setLedSettingsState(prev => ({ ...prev, ...newSettings }));
  };
  
  const setCopilotAudioOutput = (newOutput: CopilotAudioOutput) => {
      setCopilotAudioOutputState(newOutput);
  }

  const value = useMemo(() => ({
    theme,
    setTheme,
    colorPalette,
    setColorPalette,
    surfaceMaterial,
    setSurfaceMaterial,
    ledSettings,
    setLedSettings,
    copilotAudioOutput,
    setCopilotAudioOutput
  }), [theme, colorPalette, surfaceMaterial, ledSettings, copilotAudioOutput]);

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
};
