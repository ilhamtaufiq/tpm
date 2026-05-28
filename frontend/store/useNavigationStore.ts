import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NavigationState {
    activeSlots: string[]; // Length 5, e.g. ['home', 'sdm-absensi', 'fab-plus', 'bengkel', 'profile']
    fabSlots: string[]; // Length 3, e.g. ['bengkel', 'fin-mutasi', 'mobil']
    updateSlot: (index: number, routeId: string) => void;
    updateFabSlot: (index: number, routeId: string) => void;
    resetSlots: () => void;
}

export const defaultSlots = ['home', 'bengkel', 'fab-plus', 'angkut', 'mobil'];
export const defaultFabSlots = ['bengkel', 'fin-mutasi', 'mobil'];

export const useNavigationStore = create<NavigationState>()(
    persist(
        (set) => ({
            activeSlots: defaultSlots,
            fabSlots: defaultFabSlots,
            updateSlot: (index, routeId) => set((state) => {
                const newSlots = [...state.activeSlots];
                newSlots[index] = routeId;
                return { activeSlots: newSlots };
            }),
            updateFabSlot: (index, routeId) => set((state) => {
                const newSlots = [...(state.fabSlots || defaultFabSlots)];
                newSlots[index] = routeId;
                return { fabSlots: newSlots };
            }),
            resetSlots: () => set({ activeSlots: defaultSlots, fabSlots: defaultFabSlots }),
        }),
        {
            name: 'navigation-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
