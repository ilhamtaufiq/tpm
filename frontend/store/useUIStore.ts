import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeColors {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textGray: string;
}

interface UIState {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
    themeColors: ThemeColors;
    setThemeColor: (key: keyof ThemeColors, color: string) => void;
    resetTheme: () => void;
    appLogo: string | null;
    appName: string;
    setBranding: (branding: { logo?: string | null; name?: string }) => void;
}

export const defaultColors: ThemeColors = {
    primary: "#023C69",
    secondary: "#EE2737",
    background: "#F9F9F9",
    surface: "#FFFFFF",
    text: "#1C1C1C",
    textGray: "#767676",
};

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isDarkMode: false,
            toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
            isLoading: false,
            setLoading: (loading) => set({ isLoading: loading }),
            themeColors: defaultColors,
            setThemeColor: (key, color) =>
                set((state) => ({
                    themeColors: { ...state.themeColors, [key]: color }
                })),
            resetTheme: () => set({ themeColors: defaultColors }),
            appLogo: null,
            appName: 'TPM',
            setBranding: (branding) => set((state) => ({
                appLogo: branding.logo !== undefined ? branding.logo : state.appLogo,
                appName: branding.name !== undefined ? branding.name : state.appName,
            })),
        }),
        {
            name: 'ui-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
