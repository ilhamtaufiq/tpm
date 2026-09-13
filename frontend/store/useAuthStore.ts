import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { queryClient } from '../utils/queryClient';
import {
    SECURE_STORE_MAX_BYTES,
    buildSecureSlice,
    extractPersistedToken,
    mergeSecureToken,
} from './authStorageSplit';

interface AuthState {
    user: any | null;
    token: string | null;
    isAuthenticated: boolean;
    hasHydrated: boolean;
    isImpersonating: boolean;
    impersonatorUser: any | null;
    originalUser: any | null;
    originalToken: string | null;
    setHasHydrated: (hasHydrated: boolean) => void;
    setAuth: (user: any, token: string) => void;
    updateUser: (user: any) => void;
    startImpersonation: (user: any, token: string, impersonatorUser?: any | null) => void;
    stopImpersonation: () => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            hasHydrated: false,
            isImpersonating: false,
            impersonatorUser: null,
            originalUser: null,
            originalToken: null,
            setHasHydrated: (hasHydrated) => set({ hasHydrated }),
            setAuth: (user, token) => set({
                user,
                token,
                isAuthenticated: true,
                isImpersonating: false,
                impersonatorUser: null,
                originalUser: null,
                originalToken: null,
            }),
            updateUser: (user) => set((state) => ({
                user,
                impersonatorUser: state.isImpersonating && state.impersonatorUser?.id === user.id
                    ? user
                    : state.impersonatorUser,
                originalUser: state.isImpersonating && state.originalUser?.id === user.id
                    ? user
                    : state.originalUser,
            })),
            startImpersonation: (user, token, impersonatorUser = null) => set((state) => ({
                user,
                token,
                isAuthenticated: true,
                isImpersonating: true,
                impersonatorUser: impersonatorUser || state.user,
                originalUser: state.originalUser || state.user,
                originalToken: state.originalToken || state.token,
            })),
            stopImpersonation: () => {
                const state = get();
                if (!state.originalUser || !state.originalToken) {
                    set({
                        user: null,
                        token: null,
                        isAuthenticated: false,
                        isImpersonating: false,
                        impersonatorUser: null,
                        originalUser: null,
                        originalToken: null,
                    });
                    return;
                }

                set({
                    user: state.originalUser,
                    token: state.originalToken,
                    isAuthenticated: true,
                    isImpersonating: false,
                    impersonatorUser: null,
                    originalUser: null,
                    originalToken: null,
                });
            },
            logout: () => {
                // Drop cached data so the next user never sees the previous one's
                // financials from memory or the 7-day persisted cache.
                queryClient.clear();
                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                    isImpersonating: false,
                    impersonatorUser: null,
                    originalUser: null,
                    originalToken: null,
                });
            },
        }),
        {
            name: 'auth-storage',
            // Never persist runtime gate — restoring hasHydrated:false was stranding splash
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
                isImpersonating: state.isImpersonating,
                impersonatorUser: state.impersonatorUser,
                originalUser: state.originalUser,
                originalToken: state.originalToken,
            }),
            storage: createJSONStorage(() => {
                if (Platform.OS === 'web') {
                    return {
                        getItem: async (key: string) => localStorage.getItem(key),
                        setItem: async (key: string, value: string) => { localStorage.setItem(key, value); },
                        removeItem: async (key: string) => localStorage.removeItem(key),
                    };
                }

                return {
                    getItem: async (key: string) => {
                        let secureValue: string | null = null;
                        try {
                            secureValue = await SecureStore.getItemAsync(key);
                        } catch (error) {
                            console.warn('[Auth Store] SecureStore read failed, falling back to AsyncStorage', error);
                        }

                        const plainValue = await AsyncStorage.getItem(key);

                        if (!plainValue) return secureValue;
                        if (!secureValue) return plainValue;
                        // Both copies exist: SecureStore holds only the token when the
                        // full payload was too large. Take the encrypted token.
                        return mergeSecureToken(secureValue, plainValue);
                    },
                    setItem: async (key: string, value: string) => {
                        if (value.length <= SECURE_STORE_MAX_BYTES) {
                            try {
                                await SecureStore.setItemAsync(key, value);
                                await AsyncStorage.removeItem(key);
                                return;
                            } catch (error) {
                                console.warn('[Auth Store] SecureStore write failed, falling back to AsyncStorage', error);
                                await AsyncStorage.setItem(key, value);
                                return;
                            }
                        }

                        // Too large for SecureStore (the 2048-byte cap is really an
                        // iOS keychain limit). Keep the token encrypted on its own and
                        // spill only the bulky `user` blob to AsyncStorage.
                        const token = extractPersistedToken(value);
                        if (token) {
                            try {
                                // Same shape as the full payload so getItem parses it identically.
                                await SecureStore.setItemAsync(key, buildSecureSlice(token));
                            } catch (error) {
                                console.warn('[Auth Store] SecureStore token write failed; leaving plaintext copy', error);
                                await AsyncStorage.setItem(key, value);
                                return;
                            }
                        }
                        await AsyncStorage.setItem(key, value);
                    },
                    removeItem: async (key: string) => {
                        await Promise.allSettled([
                            SecureStore.deleteItemAsync(key),
                            AsyncStorage.removeItem(key),
                        ]);
                    },
                };
            }),
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.error('[Auth Store] Hydration error:', error);
                } else {
                    console.log('[Auth Store] Hydration complete:', state?.isAuthenticated ? 'Authenticated' : 'Not authenticated');
                }
                // Always clear gate even if state object missing after error
                if (state) {
                    state.setHasHydrated(true);
                } else {
                    useAuthStore.getState().setHasHydrated(true);
                }
            },
        }
    )
);
