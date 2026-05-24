import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { Stack, SplashScreen, useSegments, useRouter, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import { View, Text, ActivityIndicator, AppState, AppStateStatus, Platform, Pressable } from 'react-native';
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
import '../global.css';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '../context/AlertContext';
import { CustomTabBar } from '../components/ui/CustomTabBar';

// Configure online manager to listen to NetInfo
onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
    });
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // "Near Real-time": Data is considered fresh for only 10 seconds.
            // This ensures data stays synced across multiple devices/users with minimal delay.
            staleTime: 1000 * 10, 
            // 24 hours until garbage collected from storage
            gcTime: 1000 * 60 * 60 * 24,
            // Re-sync data automatically when user returns to the app (foregrounding).
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            // Standard retry logic
            retry: (failureCount, error: any) => {
                if (error?.message?.includes('network')) return false;
                return failureCount < 2;
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
    const [isUpdating, setIsUpdating] = useState(false);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    
    // States for Premium Web Mobile Preview Frame
    const [isMobileMode, setIsMobileMode] = useState(true);
    const [windowWidth, setWindowWidth] = useState(Platform.OS === 'web' ? window.innerWidth : 360);

    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // API state fetching
    const { data: securityStatus, isLoading: isLoadingSecurity } = useSecurityStatus();

    const {
        isLocked, isPinEnabled, lock, syncWithBackend,
        protectedFeatures, unlockedFeatures
    } = useSecurityStore();
    const { themeColors } = useUIStore();
    const { updateUser } = useAuthStore();
    const user = useAuthStore(state => state.user);
    const isImpersonating = useAuthStore(state => state.isImpersonating);

    const theme = vars({
        '--color-primary': themeColors.primary,
        '--color-secondary': themeColors.secondary,
        '--color-background': themeColors.background,
        '--color-surface': themeColors.surface,
        '--color-text': themeColors.text,
        '--color-text-gray': themeColors.textGray,
    });

    // Handle OTA Updates on app mount
    useEffect(() => {
        async function onFetchUpdateAsync() {
            if (__DEV__) return; // Skip in development
            try {
                // IMPORTANT: In Expo 51+, we use the new Updates API
                const update = await Updates.checkForUpdateAsync();
                if (update.isAvailable) {
                    setIsUpdating(true);
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync(); // App will restart with new version
                }
            } catch (error) {
                console.log('Update check failed:', error);
            } finally {
                setIsUpdating(false);
            }
        }
        onFetchUpdateAsync();
    }, []);

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
            // Only lock if PIN is enabled AND we are NOT in development mode
            // This avoids annoying locks while developer is testing/switching windows
            if (nextAppState.match(/inactive|background/) && isPinEnabled && !__DEV__) {
                console.log('LAYOUT: App going to background, locking...');
                lock();
            } else if (__DEV__ && nextAppState.match(/inactive|background/)) {
                console.log('LAYOUT: App backgrounded (Locking skipped in DEV mode)');
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
                        updateUser(freshUser);
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

        const isWeb = Platform.OS === 'web';
        const isEnvDisabled = process.env.EXPO_PUBLIC_DISABLE_WEB_ACCESS === 'true';

        if (isWeb && (protectedFeatures.disable_web_access || isEnvDisabled) && segments[0] !== 'landing') {
            console.log('LAYOUT: Web access restricted (Setting or ENV)');
            router.replace('/landing?reason=mobile_only');
            return;
        }

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

    // Show loading indicator while fonts are loading or update is downloading
    if (!loaded || !isReady || isUpdating) {
        const loadingMessage = isUpdating 
            ? "Mendownload versi terbaru..." 
            : "Memuat TPM Super App...";

        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={{ marginTop: 16, fontSize: 14, color: '#666', fontWeight: '600' }}>
                    {loadingMessage}
                </Text>
                {isUpdating && (
                    <Text style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                        Aplikasi akan restart secara otomatis
                    </Text>
                )}
            </View>
        );
    }

    const appContent = (
        <>
            <ConnectivityBanner />
            <ErrorBoundary>
                <BottomSheetModalProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="landing" options={{ headerShown: false }} />
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="(security)" options={{ headerShown: false }} />
                        <Stack.Screen name="bengkel" options={{ headerShown: false }} />
                        <Stack.Screen name="finance" options={{ headerShown: false }} />
                        <Stack.Screen name="jasa-angkut" options={{ headerShown: false }} />
                        <Stack.Screen name="laporan" options={{ headerShown: false }} />
                        <Stack.Screen name="master-data" options={{ headerShown: false }} />
                        <Stack.Screen name="mobil" options={{ headerShown: false }} />
                        <Stack.Screen name="receipt" options={{ headerShown: false }} />
                        <Stack.Screen name="sdm" options={{ headerShown: false }} />
                        <Stack.Screen name="settings" options={{ headerShown: false }} />
                        <Stack.Screen name="monitor" options={{ headerShown: false }} />
                        <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
                    </Stack>
                    
                    {/* Global Custom Bottom Navigation */}
                    {isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'BENGKEL') && segments[0] !== '(auth)' && segments[0] !== 'landing' && segments[0] !== 'index' && segments[0] !== '(security)' && (
                        <CustomTabBar />
                    )}
                </BottomSheetModalProvider>
            </ErrorBoundary>
        </>
    );

    const showMobileFrame = Platform.OS === 'web' && isMobileMode && windowWidth > 640;

    return (
        <SafeAreaProvider>
            <GestureHandlerRootView style={[{ flex: 1 }, theme]}>
                {showMobileFrame ? (
                    <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' }}>
                        {/* Background ambient light */}
                        <View 
                            style={{
                                position: 'absolute',
                                width: 500,
                                height: 500,
                                backgroundColor: themeColors.primary,
                                opacity: 0.12,
                                borderRadius: 250,
                                top: -100,
                                left: -100,
                            }}
                            className="blur-[120px]"
                        />
                        <View 
                            style={{
                                position: 'absolute',
                                width: 500,
                                height: 500,
                                backgroundColor: '#6366f1',
                                opacity: 0.12,
                                borderRadius: 250,
                                bottom: -100,
                                right: -100,
                            }}
                            className="blur-[120px]"
                        />

                        {/* Device Mockup */}
                        <View 
                            style={{
                                width: 390,
                                height: 844,
                                backgroundColor: '#000000',
                                borderRadius: 48,
                                padding: 10,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 24 },
                                shadowOpacity: 0.5,
                                shadowRadius: 36,
                                elevation: 20,
                                borderWidth: 2,
                                borderColor: '#334155',
                                position: 'relative'
                            }}
                        >
                            {/* Speaker Notch */}
                            <View 
                                style={{
                                    position: 'absolute',
                                    top: 14,
                                    left: '50%',
                                    marginLeft: -64,
                                    width: 128,
                                    height: 24,
                                    backgroundColor: 'black',
                                    borderRadius: 12,
                                    zIndex: 9999,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderWidth: 1,
                                    borderColor: '#1e293b'
                                }}
                            >
                                <View className="w-3.5 h-3.5 rounded-full bg-slate-900 border border-slate-700/40 mr-1.5 flex items-center justify-center">
                                    <View className="w-1.5 h-1.5 rounded-full bg-indigo-900/80" />
                                </View>
                                <View className="w-12 h-1 bg-slate-800 rounded-full" />
                            </View>

                            {/* App Screen container */}
                            <View className="flex-1 bg-white rounded-[38px] overflow-hidden relative">
                                {appContent}
                            </View>

                            {/* Android Home Bar Line */}
                            <View 
                                style={{
                                    position: 'absolute',
                                    bottom: 12,
                                    left: '50%',
                                    marginLeft: -72,
                                    width: 144,
                                    height: 4,
                                    backgroundColor: '#475569',
                                    borderRadius: 2,
                                    zIndex: 9999
                                }}
                            />
                        </View>

                        {/* Floating Mode Switcher Button (Mobile mode active) */}
                        <View 
                            style={{
                                position: 'absolute',
                                bottom: 24,
                                left: 24,
                                zIndex: 99999,
                            }}
                            className="bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-gray-200/50 shadow-lg flex-row items-center space-x-2"
                        >
                            <Pressable
                                onPress={() => setIsMobileMode(false)}
                                className="px-4 py-2 rounded-xl flex-row items-center justify-center bg-primary active:scale-95 shadow-md shadow-primary/20"
                            >
                                <Text className="text-xs font-bold text-white">
                                    💻 Mode Desktop
                                </Text>
                            </Pressable>
                            <Text className="text-[10px] text-slate-500 font-bold px-1">TPM Android Mockup</Text>
                        </View>
                    </View>
                ) : (
                    <>
                        {appContent}
                        
                        {/* Floating Mode Switcher Button (Desktop mode active) */}
                        {Platform.OS === 'web' && windowWidth > 640 && (
                            <View 
                                style={{
                                    position: 'absolute',
                                    bottom: 24,
                                    left: 24,
                                    zIndex: 99999,
                                }}
                                className="bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-gray-200/50 shadow-lg flex-row items-center space-x-2"
                            >
                                <Pressable
                                    onPress={() => setIsMobileMode(true)}
                                    className="px-4 py-2 rounded-xl flex-row items-center justify-center bg-slate-100 hover:bg-slate-200 active:scale-95"
                                >
                                    <Text className="text-xs font-bold text-slate-700">
                                        📱 Preview Mobile
                                    </Text>
                                </Pressable>
                            </View>
                        )}
                    </>
                )}
            </GestureHandlerRootView>
        </SafeAreaProvider>
    );
}

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <AlertProvider>
                <RootLayoutContent />
            </AlertProvider>
        </QueryClientProvider>
    );
}
