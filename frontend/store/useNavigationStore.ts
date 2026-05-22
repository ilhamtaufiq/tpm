import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NavigationState {
    activeSlots: string[]; // Length 5, e.g. ['home', 'sdm-absensi', 'fab-plus', 'bengkel', 'profile']
    updateSlot: (index: number, routeId: string) => void;
    resetSlots: () => void;
}

export const defaultSlots = ['home', 'bengkel', 'fab-plus', 'angkut', 'mobil'];

export const useNavigationStore = create<NavigationState>()(
    persist(
        (set) => ({
            activeSlots: defaultSlots,
            updateSlot: (index, routeId) => set((state) => {
                const newSlots = [...state.activeSlots];
                newSlots[index] = routeId;
                return { activeSlots: newSlots };
            }),
            resetSlots: () => set({ activeSlots: defaultSlots }),
        }),
        {
            name: 'navigation-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
