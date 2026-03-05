import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Vibration } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSecurityStore } from '../../store/useSecurityStore';
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
    const [error, setError] = useState<string | null>(null);
    const [currentMode, setCurrentMode] = useState(mode || 'verify');

    const { verifyPin, setPin: savePin, useBiometrics, unlock, lock, resetSecurity, unlockFeature } = useSecurityStore();

    useEffect(() => {
        if (currentMode === 'verify' && useBiometrics && Platform.OS !== 'web') {
            handleBiometrics();
        }
    }, []);

    // Handle physical keyboard input (for Web/Desktop/Simulator)
    useEffect(() => {
        const handleKeyPress = (e: any) => {
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
    }, [pin, currentMode]);

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
                router.replace('/(tabs)/home');
            }
        } catch (e) {
            console.error('Biometric error:', e);
        }
    };

    const handlePress = (num: string) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            setError(null);

            if (newPin.length === 4) {
                setTimeout(() => handleFullPin(newPin), 200);
            }
        }
    };

    const handleFullPin = async (completedPin: string) => {
        if (currentMode === 'setup') {
            setConfirmPin(completedPin);
            setPin('');
            setCurrentMode('confirm');
        } else if (currentMode === 'confirm') {
            if (completedPin === confirmPin) {
                await savePin(completedPin);
                router.back();
            } else {
                setError('PIN tidak cocok');
                setPin('');
                Vibration.vibrate(200);
            }
        } else {
            const isValid = await verifyPin(completedPin);
            if (isValid) {
                unlock();

                if (action === 'disable_pin') {
                    await resetSecurity();
                    router.back();
                } else if (action === 'change_pin') {
                    setCurrentMode('setup');
                    setPin('');
                } else if (feature) {
                    // Unlock that specific feature, then go back
                    unlockFeature(feature);
                    router.back();
                } else if (redirect) {
                    router.replace(redirect as any);
                } else {
                    router.replace('/(tabs)/home');
                }
            } else {
                setError('PIN salah');
                setPin('');
                Vibration.vibrate(200);
            }
        }
    };

    const handleDelete = () => {
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
            <View className="absolute top-12 left-6">
                {(currentMode === 'setup' || currentMode === 'confirm') && (
                    <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                        <LucideChevronLeft size={28} color="#1e293b" />
                    </TouchableOpacity>
                )}
            </View>

            <View className="mb-12 items-center">
                <Text className="text-2xl font-bold text-slate-800 mb-2">
                    {currentMode === 'setup' ? 'Buat PIN Baru' :
                        currentMode === 'confirm' ? 'Konfirmasi PIN' : 'Masukkan PIN'}
                </Text>
                <Text className="text-slate-500 text-center">
                    {currentMode === 'setup' ? 'Gunakan PIN untuk keamanan aplikasi' :
                        currentMode === 'confirm' ? 'Masukkan PIN sekali lagi' : 'Silakan masukkan PIN Anda'}
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

            <View className="w-full max-w-xs flex-row flex-wrap justify-between">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <TouchableOpacity
                        key={num}
                        onPress={() => handlePress(num.toString())}
                        className="w-20 h-20 items-center justify-center rounded-full mb-4 bg-slate-50 border border-slate-100"
                    >
                        <Text className="text-2xl font-semibold text-slate-800">{num}</Text>
                    </TouchableOpacity>
                ))}

                <TouchableOpacity
                    onPress={() => currentMode === 'verify' && handleBiometrics()}
                    className="w-20 h-20 items-center justify-center rounded-full mb-4"
                >
                    {currentMode === 'verify' && useBiometrics ? (
                        <LucideFingerprint size={32} color="#3b82f6" />
                    ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handlePress('0')}
                    className="w-20 h-20 items-center justify-center rounded-full mb-4 bg-slate-50 border border-slate-100"
                >
                    <Text className="text-2xl font-semibold text-slate-800">0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleDelete}
                    className="w-20 h-20 items-center justify-center rounded-full mb-4"
                >
                    <LucideDelete size={32} color="#64748b" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
