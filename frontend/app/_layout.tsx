import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import '../global.css';

const queryClient = new QueryClient();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [loaded, error] = useFonts({
        Outfit_400Regular,
        Outfit_500Medium,
        Outfit_600SemiBold,
        Outfit_700Bold,
    });

    const segments = useSegments();
    const [isReady, setIsReady] = useState(false);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);

    useEffect(() => {
        console.log('LAYOUT: Fonts loaded:', loaded, 'Error:', error);
        if (loaded || error) {
            console.log('LAYOUT: Hiding splash screen');
            SplashScreen.hideAsync();
            // Give AsyncStorage time to hydrate
            setTimeout(() => {
                console.log('LAYOUT: Setting isReady to true');
                setIsReady(true);
            }, 500); // Increased from 100ms
        }
    }, [loaded, error]);

    useEffect(() => {
        console.log('LAYOUT: Navigation check - isReady:', isReady, 'loaded:', loaded);
        console.log('LAYOUT: isAuthenticated:', isAuthenticated);
        console.log('LAYOUT: segments:', segments);

        if (!isReady || !loaded) return;

        const inAuthGroup = segments[0] === '(auth)';
        console.log('LAYOUT: inAuthGroup:', inAuthGroup);

        if (!isAuthenticated && !inAuthGroup) {
            // Redirect to login if not authenticated and not in auth group
            router.replace('/(auth)/login');
        } else if (isAuthenticated && inAuthGroup) {
            // Redirect to home if authenticated and trying to access auth pages
            router.replace('/(tabs)/home');
        }
    }, [isAuthenticated, segments, loaded, isReady]);

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
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ErrorBoundary>
                <QueryClientProvider client={queryClient}>
                    <BottomSheetModalProvider>
                        <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="index" options={{ headerShown: false }} />
                            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                            <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
                        </Stack>
                    </BottomSheetModalProvider>
                </QueryClientProvider>
            </ErrorBoundary>
        </GestureHandlerRootView>
    );
}
