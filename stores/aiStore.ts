
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Message {
    id: string;
    role: 'user' | 'model' | 'system';
    text: string;
    timestamp: number;
}

export type AIState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface AIStore {
    isOpen: boolean;
    mode: 'voice' | 'chat'; // Voice = Minimal HUD, Chat = Full Terminal
    state: AIState;
    messages: Message[];
    currentContext: string; // e.g., "Tuning Page - Fuel Map VE1"
    currentTask?: string; // e.g., "Cam-chain tensioner replacement"
    continuousMode: boolean; // Hands-free auto-listen loop
    
    // Actions
    setIsOpen: (open: boolean) => void;
    setMode: (mode: 'voice' | 'chat') => void;
    setState: (state: AIState) => void;
    addMessage: (role: 'user' | 'model' | 'system', text: string) => void;
    setContext: (context: string) => void;
    setTask: (task: string | undefined) => void;
    setContinuousMode: (active: boolean) => void;
    clearHistory: () => void;
}

export const useAIStore = create<AIStore>()(
    persist(
        (set) => ({
            isOpen: false,
            mode: 'chat',
            state: 'idle',
            messages: [
                { 
                    id: 'init-1', 
                    role: 'model', 
                    text: 'Genesis OS Core Online. I am KC, the sentient intelligence integrated into your vehicle. All systems synchronized. We are ready for the next objective.', 
                    timestamp: Date.now() 
                }
            ],
            currentContext: 'Dashboard',
            currentTask: undefined,
            continuousMode: false,

            setIsOpen: (isOpen) => set({ isOpen }),
            setMode: (mode) => set({ mode }),
            setState: (state) => set({ state }),
            setContinuousMode: (continuousMode) => set({ continuousMode }),
            
            addMessage: (role, text) => set((state) => ({
                messages: [
                    ...state.messages,
                    { id: Date.now().toString(), role, text, timestamp: Date.now() }
                ]
            })),
            
            setContext: (currentContext) => set({ currentContext }),
            setTask: (currentTask) => set({ currentTask }),
            
            clearHistory: () => set({ 
                messages: [{ 
                    id: Date.now().toString(), 
                    role: 'model', 
                    text: 'Memory buffer flushed. Ready.', 
                    timestamp: Date.now() 
                }],
                currentTask: undefined
            })
        }),
        {
            name: 'genesis-ai-storage',
            storage: createJSONStorage(() => localStorage), // Persist messages in localStorage
            partialize: (state) => ({ messages: state.messages, currentTask: state.currentTask })
        }
    )
);
