import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textGray: string;
}

export type OrientationLockMode = 'auto' | 'portrait' | 'landscape';
export type WebPreviewOrientation = 'portrait' | 'landscape';

interface UIState {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    isLoading: boolean;
    setLoading: (loading: boolean) => void;
    themeColors: ThemeColors;
    setThemeColor: (key: keyof ThemeColors, color: string) => void;
    setPalette: (palette: ColorPalette) => void;
    resetTheme: () => void;
    appLogo: string | null;
    appName: string;
    setBranding: (branding: { logo?: string | null; name?: string }) => void;
    orientationLock: OrientationLockMode;
    setOrientationLock: (mode: OrientationLockMode) => void;
    webPreviewOrientation: WebPreviewOrientation;
    setWebPreviewOrientation: (orientation: WebPreviewOrientation) => void;
    webMobilePreview: boolean;
    setWebMobilePreview: (enabled: boolean) => void;
}

export const defaultColors: ThemeColors = {
    primary: "#023C69",
    secondary: "#EE2737",
    background: "#F9F9F9",
    surface: "#FFFFFF",
    text: "#1C1C1C",
    textGray: "#767676",
};

/** Palet siap pakai — satu pilihan mengubah seluruh warna UI sekaligus. */
export interface ColorPalette {
    id: string;
    name: string;
    colors: ThemeColors;
}

export const colorPalettes: ColorPalette[] = [
    { id: 'tpm', name: 'TPM Default', colors: defaultColors },
    {
        id: 'ocean', name: 'Ocean',
        colors: { primary: '#0369A1', secondary: '#06B6D4', background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A', textGray: '#64748B' },
    },
    {
        id: 'emerald', name: 'Emerald',
        colors: { primary: '#047857', secondary: '#F59E0B', background: '#F7FCF9', surface: '#FFFFFF', text: '#111827', textGray: '#6B7280' },
    },
    {
        id: 'indigo', name: 'Indigo',
        colors: { primary: '#4338CA', secondary: '#EC4899', background: '#F8F9FE', surface: '#FFFFFF', text: '#1E1B4B', textGray: '#71717A' },
    },
    {
        id: 'violet', name: 'Violet',
        colors: { primary: '#6D28D9', secondary: '#F59E0B', background: '#FAF8FE', surface: '#FFFFFF', text: '#2E1065', textGray: '#7C7491' },
    },
    {
        id: 'sunset', name: 'Sunset',
        colors: { primary: '#C2410C', secondary: '#0EA5E9', background: '#FEF9F5', surface: '#FFFFFF', text: '#431407', textGray: '#8C7A70' },
    },
    {
        id: 'rose', name: 'Rose',
        colors: { primary: '#BE123C', secondary: '#0F766E', background: '#FFF8FA', surface: '#FFFFFF', text: '#3F0713', textGray: '#876873' },
    },
    {
        id: 'slate', name: 'Slate',
        colors: { primary: '#334155', secondary: '#0EA5E9', background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A', textGray: '#64748B' },
    },
    {
        id: 'midnight', name: 'Midnight',
        colors: { primary: '#1E1B4B', secondary: '#38BDF8', background: '#0F172A', surface: '#1E293B', text: '#F8FAFC', textGray: '#94A3B8' },
    },
    {
        id: 'graphite', name: 'Graphite',
        colors: { primary: '#18181B', secondary: '#F97316', background: '#121212', surface: '#262626', text: '#FAFAFA', textGray: '#A1A1AA' },
    },
];

/** Cocokkan warna tema saat ini ke sebuah palet (urutan-insensitif). */
export const findPaletteId = (colors: ThemeColors): string | null => {
    const same = (a: ThemeColors, b: ThemeColors) =>
        (Object.keys(a) as (keyof ThemeColors)[]).every(
            (k) => (a[k] ?? '').toUpperCase() === (b[k] ?? '').toUpperCase()
        );
    return colorPalettes.find((p) => same(p.colors, colors))?.id ?? null;
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
            setPalette: (palette) => set({ themeColors: { ...palette.colors } }),
            resetTheme: () => set({ themeColors: { ...defaultColors } }),
            appLogo: null,
            appName: 'TPM',
            setBranding: (branding) => set((state) => ({
                appLogo: branding.logo !== undefined ? branding.logo : state.appLogo,
                appName: branding.name !== undefined ? branding.name : state.appName,
            })),
            orientationLock: 'auto',
            setOrientationLock: (mode) => set({ orientationLock: mode }),
            webPreviewOrientation: 'portrait',
            setWebPreviewOrientation: (orientation) => set({ webPreviewOrientation: orientation }),
            webMobilePreview: true,
            setWebMobilePreview: (enabled) => set({ webMobilePreview: enabled }),
        }),
        {
            name: 'ui-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
