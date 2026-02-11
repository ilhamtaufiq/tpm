import { create } from 'zustand';

interface UIState {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    isDarkMode: false,
    toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),
}));
