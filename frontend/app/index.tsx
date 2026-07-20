import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useSecurityStore } from '../store/useSecurityStore';
import { Platform } from 'react-native';

export default function Index() {
    const [forceNav, setForceNav] = useState(false);
    // Prefer store flag (layout also force-sets this after 5s if SecureStore hangs)
    const hasHydrated = useAuthStore((state) => state.hasHydrated);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const { themeColors } = useUIStore();

    // Local gate + race-safe hydration listen + hard timeout (was the splash stuck bug)
    const [localHydrated, setLocalHydrated] = useState(() => {
        try {
            return !!useAuthStore.persist?.hasHydrated?.() || useAuthStore.getState().hasHydrated;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        if (hasHydrated || localHydrated) {
            setLocalHydrated(true);
            return;
        }

        let done = false;
        const mark = () => {
            if (done) return;
            done = true;
            setLocalHydrated(true);
            if (!useAuthStore.getState().hasHydrated) {
                useAuthStore.getState().setHasHydrated(true);
            }
        };

        // Already finished before effect ran (race)
        if (useAuthStore.persist?.hasHydrated?.()) {
            mark();
            return;
        }

        const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
            mark();
        });

        // Hard failsafe — never block entry forever (SecureStore can hang on some devices)
        const timeout = setTimeout(() => {
            console.warn('[INDEX] Hydration timeout — continuing');
            mark();
        }, 2500);

        return () => {
            unsub?.();
            clearTimeout(timeout);
        };
    }, [hasHydrated, localHydrated]);

    const isHydrated = hasHydrated || localHydrated || forceNav;

    // Emergency escape hatch for debugging
    const handleForceLogin = () => {
        console.log('INDEX: Force navigation to login');
        useAuthStore.getState().setHasHydrated(true);
        setForceNav(true);
        setLocalHydrated(true);
    };

    // Show loading screen while waiting for hydration
    if (!isHydrated) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    padding: 24,
                }}
            >
                <View
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: themeColors.primary,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 24,
                        shadowColor: themeColors.primary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 16,
                        elevation: 8,
                    }}
                >
                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#ffffff' }}>TPM</Text>
                </View>
                <ActivityIndicator size="large" color={themeColors.primary} />
                <Text
                    style={{
                        marginTop: 16,
                        fontSize: 16,
                        color: '#374151',
                        fontWeight: '600',
                    }}
                >
                    Memuat TPM Super App
                </Text>
                <Text
                    style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: '#9CA3AF',
                    }}
                >
                    Mohon tunggu sebentar...
                </Text>

                <Pressable
                    onPress={handleForceLogin}
                    style={{
                        marginTop: 32,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        backgroundColor: '#F3F4F6',
                        borderRadius: 8,
                    }}
                >
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>Tap if stuck (Debug)</Text>
                </Pressable>
            </View>
        );
    }

    // After hydration, redirect to appropriate page
    const user = useAuthStore.getState().user;
    const { protectedFeatures } = useSecurityStore.getState();
    const isWeb = Platform.OS === 'web';
    const isEnvDisabled = process.env.EXPO_PUBLIC_DISABLE_WEB_ACCESS === 'true';

    // MOBILE ONLY CHECK (Override by User Setting or ENV)
    if (isWeb && (protectedFeatures.disable_web_access || isEnvDisabled)) {
        return <Redirect href="/landing?reason=mobile_only" />;
    }

    if (isAuthenticated) {
        if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
            return <Redirect href="/(tabs)/home" />;
        }
        if (user?.role === 'BENGKEL') {
            return <Redirect href="/bengkel" />;
        }
        if (user?.role === 'JASA_ANGKUT') {
            return <Redirect href="/jasa-angkut" />;
        }
        if (user?.role === 'MOBIL') {
            return <Redirect href="/mobil" />;
        }
        return <Redirect href="/(tabs)/home" />;
    }

    return <Redirect href="/(auth)/login" />;
}
