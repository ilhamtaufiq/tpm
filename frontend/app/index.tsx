import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useSecurityStore } from '../store/useSecurityStore';
import { Platform } from 'react-native';

export default function Index() {
    const [isHydrated, setIsHydrated] = useState(false);
    const [forceNav, setForceNav] = useState(false);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    const { themeColors } = useUIStore();

    useEffect(() => {
        console.log('===== INDEX: Component mounted =====');
        console.log('INDEX: isAuthenticated (initial):', isAuthenticated);

        // Wait for Zustand store to hydrate from AsyncStorage
        const timer = setTimeout(() => {
            console.log('INDEX: Hydration timeout complete');
            console.log('INDEX: isAuthenticated (after hydration):', isAuthenticated);
            setIsHydrated(true);
        }, 2000); // 2 seconds for very slow devices

        // Fallback: Force navigation after 5 seconds
        const forceTimer = setTimeout(() => {
            console.warn('INDEX: Force navigation timeout (app stuck?)');
            setForceNav(true);
            setIsHydrated(true);
        }, 5000);

        return () => {
            console.log('INDEX: Component unmounting');
            clearTimeout(timer);
            clearTimeout(forceTimer);
        };
    }, []);

    // Emergency escape hatch for debugging
    const handleForceLogin = () => {
        console.log('INDEX: Force navigation to login');
        setForceNav(true);
        setIsHydrated(true);
    };

    // Show loading screen while waiting for hydration
    if (!isHydrated && !forceNav) {
        return (
            <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                padding: 24
            }}>
                <View style={{
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
                }}>
                    <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#ffffff' }}>
                        TPM
                    </Text>
                </View>
                <ActivityIndicator size="large" color={themeColors.primary} />
                <Text style={{
                    marginTop: 16,
                    fontSize: 16,
                    color: '#374151',
                    fontWeight: '600'
                }}>
                    Memuat TPM Super App
                </Text>
                <Text style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: '#9CA3AF'
                }}>
                    Mohon tunggu sebentar...
                </Text>

                {/* Debug button - only shows after 3 seconds */}
                {forceNav === false && (
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
                        <Text style={{ fontSize: 12, color: '#6B7280' }}>
                            Tap if stuck (Debug)
                        </Text>
                    </Pressable>
                )}
            </View>
        );
    }

    // After hydration, redirect to appropriate page
    const user = useAuthStore.getState().user;
    const { protectedFeatures } = useSecurityStore.getState();
    const isWeb = Platform.OS === 'web';
    const isEnvDisabled = process.env.EXPO_PUBLIC_DISABLE_WEB_ACCESS === 'true';

    console.log('INDEX: Redirecting...', isAuthenticated ? 'to appropriate page for ' + (user?.role || 'unknown') : 'to Login');

    // MOBILE ONLY CHECK (Override by User Setting or ENV)
    if (isWeb && (protectedFeatures.disable_web_access || isEnvDisabled)) {
        console.log('INDEX: Web access disabled (Setting or ENV), redirecting to landing');
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
