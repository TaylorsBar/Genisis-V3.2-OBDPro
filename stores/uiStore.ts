import { create } from 'zustand';

export interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
}

interface UIStore {
    // Tuning Page State
    tuningActiveTab: string;
    tuningViewMode: 'manual' | 'learned';
    tuningThrottleMode: string;
    tuningShiftMode: string;
    
    setTuningActiveTab: (tab: string) => void;
    setTuningViewMode: (mode: 'manual' | 'learned') => void;
    setTuningThrottleMode: (mode: string) => void;
    setTuningShiftMode: (mode: string) => void;

    // Data Overlay State
    overlayActiveDataKey: string | null;
    overlayActiveTitle: string | null;
    overlayVisible: boolean;
    overlayPosition: { x: number, y: number } | null;
    hpTunersVisible: boolean;
    
    showDataOverlay: (dataKey: string, title: string, x?: number, y?: number) => void;
    hideDataOverlay: () => void;
    setHpTunersVisible: (visible: boolean) => void;

    // Toast Notification System State
    toasts: ToastMessage[];
    showToast: (message: string, type?: ToastMessage['type'], duration?: number) => void;
    dismissToast: (id: string) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
    tuningActiveTab: 'guided',
    tuningViewMode: 'manual',
    tuningThrottleMode: 'LINEAR',
    tuningShiftMode: 'NORMAL',
    
    setTuningActiveTab: (tab) => set({ tuningActiveTab: tab }),
    setTuningViewMode: (mode) => set({ tuningViewMode: mode }),
    setTuningThrottleMode: (mode) => set({ tuningThrottleMode: mode }),
    setTuningShiftMode: (mode) => set({ tuningShiftMode: mode }),

    overlayActiveDataKey: null,
    overlayActiveTitle: null,
    overlayVisible: false,
    overlayPosition: null,
    hpTunersVisible: false,

    showDataOverlay: (dataKey, title, x = window.innerWidth / 2, y = window.innerHeight / 2) => set({ 
        overlayActiveDataKey: dataKey, 
        overlayActiveTitle: title,
        overlayVisible: true,
        overlayPosition: { x, y }
    }),
    hideDataOverlay: () => set({ overlayVisible: false }),
    setHpTunersVisible: (visible) => set({ hpTunersVisible: visible }),

    toasts: [],
    showToast: (message, type = 'info', duration = 4000) => {
        const currentToasts = get().toasts;
        
        // Prevent exact duplicate active messages to avoid cluttering and spam
        if (currentToasts.some((t) => t.message === message)) {
            return;
        }

        const id = Math.random().toString(36).substring(2, 9);
        const newToast: ToastMessage = { id, message, type, duration };
        
        set((state) => {
            let nextToasts = [...state.toasts, newToast];
            // Cap the total number of simultaneous toasts to a maximum of 3
            if (nextToasts.length > 3) {
                nextToasts = nextToasts.slice(-3);
            }
            return { toasts: nextToasts };
        });
        
        if (duration > 0) {
            setTimeout(() => {
                get().dismissToast(id);
            }, duration);
        }
    },
    dismissToast: (id) => set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
    })),
}));
