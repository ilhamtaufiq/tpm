import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Platform, Vibration, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSecurityStore } from '../../store/useSecurityStore';
import { useSetupPin, useVerifyPin, useChangePin, useDisablePin } from '../../hooks/useSecurityAPI';
import { LucideDelete, LucideFingerprint, LucideChevronLeft } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function PinScreen() {
    const router = useRouter();
    const { mode, action, redirect, feature } = useLocalSearchParams<{
        mode: 'setup' | 'verify' | 'confirm',
        action?: 'disable_pin' | 'change_pin',
        redirect?: string,
        feature?: string
    }>();

    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [oldPin, setOldPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [currentMode, setCurrentMode] = useState(mode || 'verify');

    // Zustand store for local session unlock state
    const { useBiometrics, unlock, resetSession, unlockFeature } = useSecurityStore();

    // API Hooks
    const setupPinMutation = useSetupPin();
    const verifyPinMutation = useVerifyPin();
    const changePinMutation = useChangePin();
    const disablePinMutation = useDisablePin();

    const isLoading = setupPinMutation.isPending || verifyPinMutation.isPending || changePinMutation.isPending || disablePinMutation.isPending;

    useEffect(() => {
        // Special case: if action is change_pin, we first need to verify the old PIN
        if (action === 'change_pin') {
            setCurrentMode('verify');
        }

        if (currentMode === 'verify' && useBiometrics && Platform.OS !== 'web' && action !== 'change_pin' && action !== 'disable_pin') {
            handleBiometrics();
        }
    }, [action]);

    // Handle physical keyboard input (for Web/Desktop/Simulator)
    useEffect(() => {
        const handleKeyPress = (e: any) => {
            if (isLoading) return;
            const key = e.key;
            if (/^[0-9]$/.test(key)) {
                handlePress(key);
            } else if (key === 'Backspace') {
                handleDelete();
            }
        };

        if (Platform.OS === 'web') {
            window.addEventListener('keydown', handleKeyPress);
            return () => window.removeEventListener('keydown', handleKeyPress);
        }
    }, [pin, currentMode, isLoading]);

    const handleBiometrics = async () => {
        if (Platform.OS === 'web') return;

        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            if (!hasHardware) return;

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock TPM Super App',
                fallbackLabel: 'Use PIN',
            });

            if (result.success) {
                unlock();
                if (feature) {
                    unlockFeature(feature);
                }

                if (redirect) {
                    const targetPath = redirect.startsWith('/') ? redirect : `/${redirect}`;
                    router.replace(targetPath as any);
                } else {
                    router.replace('/(tabs)/home');
                }
            }
        } catch (error) {
            console.error('Biometric authentication error', error);
        }
    };

    const handlePress = (num: string) => {
        if (isLoading) return;

        setError(null);
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);

            if (newPin.length === 4) {
                // Determine whether to proceed based on whether we hit 4 digits
                processCompletePin(newPin);
            }
        }
    };

    const processCompletePin = async (completedPin: string) => {
        if (currentMode === 'setup') {
            setConfirmPin(completedPin);
            setPin('');
            setCurrentMode('confirm');

        } else if (currentMode === 'confirm') {
            if (completedPin === confirmPin) {
                try {
                    if (action === 'change_pin') {
                        // Change PIN API
                        await changePinMutation.mutateAsync({ old_pin: oldPin, new_pin: completedPin });
                        alert('PIN berhasil diubah');
                        router.back();
                    } else {
                        // Setup new PIN API
                        await setupPinMutation.mutateAsync(completedPin);
                        router.back();
                    }
                } catch (err: any) {
                    setError(err.response?.data?.detail || 'Gagal menyimpan PIN');
                    setPin('');
                    setConfirmPin('');
                    setCurrentMode('setup');
                    Vibration.vibrate(200);
                }
            } else {
                setError('PIN Konfirmasi tidak cocok');
                setPin('');
                Vibration.vibrate(200);
            }

        } else {
            // mode = 'verify'
            try {
                if (action === 'change_pin') {
                    // Verify old pin first, then move to setup new pin
                    const isValid = await verifyPinMutation.mutateAsync(completedPin);
                    if (isValid) {
                        setOldPin(completedPin);
                        setCurrentMode('setup');
                        setPin('');
                        return;
                    }
                }
                else if (action === 'disable_pin') {
                    await disablePinMutation.mutateAsync(completedPin);
                    resetSession();
                    alert('PIN berhasil dinonaktifkan');
                    router.back();
                    return;
                }

                // Normal verify
                const isValid = await verifyPinMutation.mutateAsync(completedPin);
                if (isValid) {
                    unlock();

                    if (feature) {
                        unlockFeature(feature);
                    }

                    if (redirect) {
                        // Redirect back to original target path
                        const targetPath = redirect.startsWith('/') ? redirect : `/${redirect}`;
                        router.replace(targetPath as any);
                    } else {
                        router.replace('/(tabs)/home');
                    }
                }
            } catch (err: any) {
                setError(err.response?.data?.detail || 'PIN salah');
                setPin('');
                Vibration.vibrate(200);
            }
        }
    };

    const handleDelete = () => {
        if (isLoading) return;
        setPin(pin.slice(0, -1));
        setError(null);
    };

    const PinDot = ({ active }: { active: boolean }) => {
        const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: withSpring(active ? 1.2 : 1) }],
            backgroundColor: withTiming(active ? '#3b82f6' : '#e2e8f0'),
        }));

        return <Animated.View style={animatedStyle} className="w-4 h-4 rounded-full mx-4" />;
    };

    return (
        <View className="flex-1 bg-white items-center justify-center px-6">
            {isLoading && (
                <View className="absolute inset-0 z-50 bg-white/50 items-center justify-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            )}
            <View className="absolute top-12 left-6">
                {(currentMode === 'setup' || currentMode === 'confirm' || action === 'change_pin' || action === 'disable_pin') && (
                    <Pressable onPress={() => router.back()} className="p-2 -ml-2" disabled={isLoading}>
                        <LucideChevronLeft size={28} color="#1e293b" />

                    </Pressable>
                )}
            </View>

            <View className="mb-12 items-center">
                <Text className="text-2xl font-bold text-slate-800 mb-2">
                    {currentMode === 'setup' 
                        ? (action === 'change_pin' ? 'Buat PIN Baru' : 'Buat PIN Baru') 
                        : currentMode === 'confirm' 
                        ? 'Konfirmasi PIN' 
                        : (action === 'change_pin' ? 'Masukkan PIN Lama' : 
                           action === 'disable_pin' ? 'Verifikasi PIN' : 'Masukkan PIN')}
                </Text>
                <Text className="text-slate-500 text-center">
                    {currentMode === 'setup' 
                        ? (action === 'change_pin' ? 'Masukkan PIN baru Anda' : 'Gunakan PIN untuk keamanan aplikasi') 
                        : currentMode === 'confirm' 
                        ? 'Masukkan PIN baru sekali lagi' 
                        : (action === 'change_pin' ? 'Masukkan PIN lama Anda untuk verifikasi' : 
                           action === 'disable_pin' ? 'Masukkan PIN untuk menonaktifkan keamanan' : 'Silakan masukkan PIN Anda')}
                </Text>
            </View>

            <View className="flex-row mb-8">
                {[0, 1, 2, 3].map((i) => (
                    <PinDot key={i} active={pin.length > i} />
                ))}
            </View>

            {error && (
                <Animated.Text
                    className="text-red-500 font-medium mb-8"
                >
                    {error}
                </Animated.Text>
            )}

            <View className="w-full max-w-sm flex-row flex-wrap justify-between px-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <Pressable
                        key={num}
                        onPress={() => handlePress(num.toString())}
                        className="w-[28%] aspect-square items-center justify-center rounded-full mb-6 bg-slate-50 border border-slate-100"
                    >
                        <Text className="text-3xl font-semibold text-slate-800">{num}</Text>
                    </Pressable>
                ))}

                <View className="w-[28%] aspect-square mb-6 items-center justify-center">
                    {currentMode === 'verify' && useBiometrics && (
                        <Pressable
                            onPress={handleBiometrics}
                            className="w-full h-full items-center justify-center rounded-full"
                        >
                            <LucideFingerprint size={32} color="#3b82f6" />
                        </Pressable>
                    )}
                </View>

                <Pressable
                    onPress={() => handlePress('0')}
                    className="w-[28%] aspect-square items-center justify-center rounded-full mb-6 bg-slate-50 border border-slate-100"
                >
                    <Text className="text-3xl font-semibold text-slate-800">0</Text>
                </Pressable>

                <Pressable
                    onPress={handleDelete}
                    className="w-[28%] aspect-square items-center justify-center rounded-full mb-6"
                >
                    <LucideDelete size={32} color="#64748b" />
                </Pressable>
            </View>
        </View>
    );
}
