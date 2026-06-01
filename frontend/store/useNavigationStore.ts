import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PageFabSettingId = 'bengkel' | 'angkut' | 'mobil';

export interface NavigationState {
    activeSlots: string[]; // Length 5, e.g. ['home', 'sdm-absensi', 'fab-plus', 'bengkel', 'profile']
    fabSlots: string[]; // Length 3, e.g. ['bengkel', 'fin-mutasi', 'mobil']
    pageFabSlots: Record<PageFabSettingId, string[]>;
    pageFabSettings: Record<PageFabSettingId, { fabIcon: string; tabIcon: string }>;
    updateSlot: (index: number, routeId: string) => void;
    updateFabSlot: (index: number, routeId: string) => void;
    updatePageFabSlot: (pageId: PageFabSettingId, index: number, routeId: string) => void;
    updatePageFabIcon: (pageId: PageFabSettingId, iconId: string) => void;
    updatePageTabIcon: (pageId: PageFabSettingId, iconId: string) => void;
    resetSlots: () => void;
}

export const defaultSlots = ['home', 'bengkel', 'fab-plus', 'angkut', 'mobil'];
export const defaultFabSlots = ['bengkel', 'fin-mutasi', 'mobil'];
export const defaultPageFabSlots: Record<PageFabSettingId, string[]> = {
    bengkel: ['bengkel-transaksi', 'bengkel-pur', 'bengkel-exp'],
    angkut: ['angkut-muatan-form', 'angkut-armada-form', 'supir-form'],
    mobil: ['mobil', 'fin-mutasi', 'history'],
};
export const defaultPageFabSettings: Record<PageFabSettingId, { fabIcon: string; tabIcon: string }> = {
    bengkel: { fabIcon: 'plus', tabIcon: 'wrench' },
    mobil: { fabIcon: 'plus', tabIcon: 'car-front' },
    angkut: { fabIcon: 'plus', tabIcon: 'truck' },
};

export const useNavigationStore = create<NavigationState>()(
    persist(
        (set) => ({
            activeSlots: defaultSlots,
            fabSlots: defaultFabSlots,
            pageFabSlots: defaultPageFabSlots,
            pageFabSettings: defaultPageFabSettings,
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
            updatePageFabSlot: (pageId, index, routeId) => set((state) => {
                const currentPageSlots = state.pageFabSlots?.[pageId] || defaultPageFabSlots[pageId];
                const newSlots = [...currentPageSlots];
                newSlots[index] = routeId;
                return {
                    pageFabSlots: {
                        ...defaultPageFabSlots,
                        ...(state.pageFabSlots || {}),
                        [pageId]: newSlots,
                    },
                };
            }),
            updatePageFabIcon: (pageId, iconId) => set((state) => ({
                pageFabSettings: {
                    ...defaultPageFabSettings,
                    ...(state.pageFabSettings || {}),
                    [pageId]: {
                        ...defaultPageFabSettings[pageId],
                        ...(state.pageFabSettings?.[pageId] || {}),
                        fabIcon: iconId,
                    },
                },
            })),
            updatePageTabIcon: (pageId, iconId) => set((state) => ({
                pageFabSettings: {
                    ...defaultPageFabSettings,
                    ...(state.pageFabSettings || {}),
                    [pageId]: {
                        ...defaultPageFabSettings[pageId],
                        ...(state.pageFabSettings?.[pageId] || {}),
                        tabIcon: iconId,
                    },
                },
            })),
            resetSlots: () => set({
                activeSlots: defaultSlots,
                fabSlots: defaultFabSlots,
                pageFabSlots: defaultPageFabSlots,
                pageFabSettings: defaultPageFabSettings,
            }),
        }),
        {
            name: 'navigation-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
