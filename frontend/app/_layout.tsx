import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { Stack, SplashScreen, useSegments, useRouter, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import {
    useFonts,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../services/auth';
import { useSecurityStore, SEGMENT_TO_FEATURE } from '../store/useSecurityStore';
import { useSecurityStatus } from '../hooks/useSecurityAPI';
import { vars } from 'nativewind';
import { useUIStore } from '../store/useUIStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AppState, AppStateStatus } from 'react-native';
import '../global.css';
import { ConnectivityBanner } from '../components/ConnectivityBanner';

// Configure online manager to listen to NetInfo
onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
    });
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data in cache is considered fresh for 10 minutes
            // Increase staleTime to avoid background re-fetching when offline
            staleTime: 1000 * 60 * 10,
            // 24 hours until garbage collected from storage
            gcTime: 1000 * 60 * 60 * 24,
            // Don't retry queries when offline
            retry: (failureCount, error: any) => {
                if (error?.message?.includes('network')) return false;
                return failureCount < 3;
            },
        },
    },
});

// Configure offline persistence
const asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'TPM_OFFLINE_CACHE',
    throttleTime: 1000,
});

persistQueryClient({
    queryClient,
    persister: asyncStoragePersister,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
    const [loaded, error] = useFonts({
        Outfit_400Regular,
        Outfit_500Medium,
        Outfit_600SemiBold,
        Outfit_700Bold,
    });

    const segments = useSegments();
    const [isReady, setIsReady] = useState(false);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);

    // API state fetching
    const { data: securityStatus, isLoading: isLoadingSecurity } = useSecurityStatus();

    const {
        isLocked, isPinEnabled, lock, syncWithBackend,
        protectedFeatures, unlockedFeatures
    } = useSecurityStore();
    const { themeColors } = useUIStore();
    const { setAuth, token } = useAuthStore();

    const theme = vars({
        '--color-primary': themeColors.primary,
        '--color-secondary': themeColors.secondary,
        '--color-background': themeColors.background,
        '--color-surface': themeColors.surface,
        '--color-text': themeColors.text,
        '--color-text-gray': themeColors.textGray,
    });

    // Sync remote API settings to local store
    useEffect(() => {
        if (securityStatus) {
            syncWithBackend(securityStatus.is_pin_enabled, securityStatus.protected_features);
        }
    }, [securityStatus]);

    useEffect(() => {
        console.log('LAYOUT: Initializing app fonts');

        if (loaded || error) {
            console.log('LAYOUT: Hiding splash screen');
            SplashScreen.hideAsync();
            setTimeout(() => {
                setIsReady(true);
            }, 500);
        }
    }, [loaded, error]);

    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState.match(/inactive|background/) && isPinEnabled) {
                console.log('LAYOUT: App going to background, locking...');
                lock();
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, [isPinEnabled]);

    // Sync profile on startup
    useEffect(() => {
        if (isAuthenticated && isReady) {
            const syncProfile = async () => {
                try {
                    const freshUser = await authService.getMe();
                    const currentToken = useAuthStore.getState().token;
                    if (currentToken) {
                        setAuth(freshUser, currentToken);
                    }
                } catch (err) {
                    console.error('LAYOUT: Failed to sync profile:', err);
                }
            };
            syncProfile();
        }
    }, [isAuthenticated, isReady]);

    useEffect(() => {
        if (!isReady || !loaded) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inSecurityGroup = segments[0] === '(security)';

        // 1. Auth guard
        if (!isAuthenticated && !inAuthGroup) {
            router.replace('/(auth)/login');
            return;
        }
        if (isAuthenticated && inAuthGroup) {
            router.replace('/(tabs)/home');
            return;
        }

        // 2. PIN guard — only applies when PIN is enabled
        if (!isPinEnabled || !isAuthenticated || inSecurityGroup || inAuthGroup) return;

        // 2a. Global app lock (after background / restart)
        if (isLocked && protectedFeatures.app_lock) {
            // Get current path to redirect back after unlock
            const path = segments.join('/');
            router.replace(`/(security)/pin?mode=verify&redirect=${path}`);
            return;
        }

        // 2b. Per-feature protection — check on EVERY navigation
        // Find which protected feature the current route maps to
        let currentFeature: string | null = null;
        for (const seg of segments) {
            const feature = SEGMENT_TO_FEATURE[seg as string];
            if (feature && protectedFeatures[feature]) {
                currentFeature = feature;
                break;
            }
        }

        if (currentFeature && !unlockedFeatures.includes(currentFeature)) {
            // This feature is protected and NOT yet unlocked — redirect to PIN
            // Join segments to create the full path (e.g., "(tabs)/finance")
            const path = segments.join('/');
            router.replace({
                pathname: '/(security)/pin',
                params: {
                    mode: 'verify',
                    feature: currentFeature,
                    redirect: path
                }
            } as any);
        }
    }, [isAuthenticated, isLocked, segments, loaded, isReady, isPinEnabled, unlockedFeatures]);

    // Show error message if fonts failed to load
    if (error) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#ef4444' }}>
                    Font Loading Error
                </Text>
                <Text style={{ fontSize: 14, textAlign: 'center', color: '#666' }}>
                    Failed to load fonts. Please restart the app.
                </Text>
                <Text style={{ fontSize: 12, marginTop: 10, color: '#999' }}>
                    {error.message}
                </Text>
            </View>
        );
    }

    // Show loading indicator while fonts are loading
    if (!loaded || !isReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
                    Loading TPM Super App...
                </Text>
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={[{ flex: 1 }, theme]}>
            <ConnectivityBanner />
            <ErrorBoundary>
                <BottomSheetModalProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="(security)" options={{ headerShown: false }} />
                        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
                    </Stack>
                </BottomSheetModalProvider>
            </ErrorBoundary>
        </GestureHandlerRootView>
    );
}

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <RootLayoutContent />
        </QueryClientProvider>
    );
}
