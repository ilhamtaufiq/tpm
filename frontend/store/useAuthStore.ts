import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
            logout: () => set({
                user: null,
                token: null,
                isAuthenticated: false,
                isImpersonating: false,
                impersonatorUser: null,
                originalUser: null,
                originalToken: null,
            }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state, error) => {
                if (error) {
                    console.error('[Auth Store] Hydration error:', error);
                } else {
                    state?.setHasHydrated(true);
                    console.log('[Auth Store] Hydration complete:', state?.isAuthenticated ? 'Authenticated' : 'Not authenticated');
                }
            },
        }
    )
);
