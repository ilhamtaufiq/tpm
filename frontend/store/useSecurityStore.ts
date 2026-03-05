import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export interface ProtectedFeatures {
    app_lock: boolean;      // Lock entire app on background/restart
    finance: boolean;       // Access to /finance
    bengkel: boolean;       // Access to /bengkel
    jasa_angkut: boolean;   // Access to /jasa-angkut
    laporan: boolean;       // Access to /laporan
    master_data: boolean;   // Access to /master-data
    mobil: boolean;         // Access to /mobil
    sdm: boolean;           // Access to /sdm (HR)
    settings: boolean;      // Access to /settings
}

// Map route segments to feature keys
export const SEGMENT_TO_FEATURE: Record<string, keyof ProtectedFeatures> = {
    'finance': 'finance',
    'bengkel': 'bengkel',
    'jasa-angkut': 'jasa_angkut',
    'laporan': 'laporan',
    'master-data': 'master_data',
    'mobil': 'mobil',
    'sdm': 'sdm',
    'settings': 'settings',
};

export const DEFAULT_PROTECTED_FEATURES: ProtectedFeatures = {
    app_lock: true,
    finance: true,
    bengkel: false,
    jasa_angkut: false,
    laporan: true,
    master_data: false,
    mobil: false,
    sdm: false,
    settings: false,
};

interface SecurityState {
    // Session State (Memory)
    isLocked: boolean;
    unlockedFeatures: string[];

    // Synced with Backend
    isPinEnabled: boolean;
    protectedFeatures: ProtectedFeatures;

    // Device preference (Persisted Locally)
    useBiometrics: boolean;

    // Actions
    syncWithBackend: (isPinEnabled: boolean, protectedFeatures: ProtectedFeatures) => void;
    enableBiometrics: (enabled: boolean) => Promise<void>;
    lock: () => void;
    unlock: () => void;
    unlockFeature: (feature: string) => void;
    isFeatureUnlocked: (feature: string) => boolean;
    clearUnlockedFeatures: () => void;
    resetSession: () => void;
}

export const useSecurityStore = create<SecurityState>()(
    persist(
        (set, get) => ({
            isLocked: false,
            unlockedFeatures: [],

            isPinEnabled: false,
            protectedFeatures: DEFAULT_PROTECTED_FEATURES,

            useBiometrics: false,

            syncWithBackend: (isPinEnabled, protectedFeatures) => {
                set({ isPinEnabled, protectedFeatures });
            },

            enableBiometrics: async (enabled: boolean) => {
                if (enabled) {
                    const hasHardware = await LocalAuthentication.hasHardwareAsync();
                    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                    if (hasHardware && isEnrolled) {
                        set({ useBiometrics: true });
                    } else {
                        throw new Error('Biometrics not available or not enrolled');
                    }
                } else {
                    set({ useBiometrics: false });
                }
            },

            lock: () => {
                const { isPinEnabled } = get();
                if (isPinEnabled) {
                    // Lock the app AND clear all unlocked features
                    set({ isLocked: true, unlockedFeatures: [] });
                }
            },

            unlock: () => {
                set({ isLocked: false });
            },

            unlockFeature: (feature: string) => {
                const { unlockedFeatures } = get();
                if (!unlockedFeatures.includes(feature)) {
                    set({ unlockedFeatures: [...unlockedFeatures, feature] });
                }
            },

            isFeatureUnlocked: (feature: string) => {
                return get().unlockedFeatures.includes(feature);
            },

            clearUnlockedFeatures: () => {
                set({ unlockedFeatures: [] });
            },

            resetSession: () => {
                set({
                    isLocked: false,
                    unlockedFeatures: []
                });
            }
        }),
        {
            name: 'security-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                useBiometrics: state.useBiometrics,
                // We keep a backup of backend sync locally so app can boot immediately with last known state
                isPinEnabled: state.isPinEnabled,
                protectedFeatures: state.protectedFeatures
            }),
        }
    )
);

