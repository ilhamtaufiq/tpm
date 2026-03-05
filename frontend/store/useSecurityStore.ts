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

interface SecurityState {
    isLocked: boolean;
    isPinEnabled: boolean;
    useBiometrics: boolean;
    pinCode: string | null;
    protectedFeatures: ProtectedFeatures;
    // Track which features have been unlocked in the current session
    unlockedFeatures: string[];
    setIsPinEnabled: (enabled: boolean) => void;
    setPin: (pin: string) => Promise<void>;
    verifyPin: (pin: string) => Promise<boolean>;
    enableBiometrics: (enabled: boolean) => Promise<void>;
    lock: () => void;
    unlock: () => void;
    unlockFeature: (feature: string) => void;
    isFeatureUnlocked: (feature: string) => boolean;
    clearUnlockedFeatures: () => void;
    resetSecurity: () => Promise<void>;
    toggleFeatureProtection: (feature: keyof ProtectedFeatures) => void;
}

export const useSecurityStore = create<SecurityState>()(
    persist(
        (set, get) => ({
            isLocked: false,
            isPinEnabled: false,
            useBiometrics: false,
            pinCode: null,
            protectedFeatures: {
                app_lock: true,
                finance: true,
                bengkel: false,
                jasa_angkut: false,
                laporan: true,
                master_data: false,
                mobil: false,
                sdm: false,
                settings: false,
            },
            unlockedFeatures: [],

            setIsPinEnabled: (enabled) => set({ isPinEnabled: enabled }),

            setPin: async (pin: string) => {
                set({
                    pinCode: pin,
                    isPinEnabled: true,
                    isLocked: false
                });
            },

            verifyPin: async (pin: string) => {
                const { pinCode } = get();
                if (pinCode === pin) {
                    set({ isLocked: false });
                    return true;
                }
                return false;
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

            resetSecurity: async () => {
                set({
                    isPinEnabled: false,
                    isLocked: false,
                    useBiometrics: false,
                    pinCode: null,
                    unlockedFeatures: []
                });
            },

            toggleFeatureProtection: (feature) => {
                set((state) => ({
                    protectedFeatures: {
                        ...state.protectedFeatures,
                        [feature]: !state.protectedFeatures[feature]
                    }
                }));
            }
        }),
        {
            name: 'security-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                isPinEnabled: state.isPinEnabled,
                useBiometrics: state.useBiometrics,
                pinCode: state.pinCode,
                protectedFeatures: state.protectedFeatures
                // unlockedFeatures is NOT persisted — resets on app restart
            }),
        }
    )
);
