import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, TextInput, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Scan, Keyboard, Info, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ScannerSettingsScreen() {
    const [isEnabled, setIsEnabled] = useState(true);
    const [testResult, setTestResult] = useState<string[]>([]);
    const [isKeyboardMode, setIsKeyboardMode] = useState(true);
    const testInputRef = useRef<TextInput>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const saved = await AsyncStorage.getItem('@scanner_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                setIsEnabled(settings.enabled ?? true);
                setIsKeyboardMode(settings.keyboardMode ?? true);
            }
        } catch (error) {
            console.error('Error loading scanner settings:', error);
        }
    };

    const saveSettings = async (newState: any) => {
        try {
            await AsyncStorage.setItem('@scanner_settings', JSON.stringify(newState));
        } catch (error) {
            console.error('Error saving scanner settings:', error);
        }
    };

    const toggleEnabled = (value: boolean) => {
        setIsEnabled(value);
        saveSettings({ enabled: value, keyboardMode: isKeyboardMode });
    };

    const handleTestScan = (text: string) => {
        if (text) {
            setTestResult(prev => [text, ...prev].slice(0, 5));
            // In HID mode, scanners usually send 'Enter' at the end.
            // We can clear the input for the next test.
            setTimeout(() => testInputRef.current?.clear(), 100);
        }
    };

    const clearHistory = () => setTestResult([]);

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            {/* Header */}
            <View className="p-6 bg-surface pb-8 rounded-b-[32px] shadow-sm">
                <View className="flex-row items-center mb-6">
                    <Pressable
                        onPress={() => router.back()}
                        className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center mr-4"
                    >
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </Pressable>
                    <View className="flex-1">
                        <Typography variant="h2" weight="bold">Barcode Scanner</Typography>
                        <Typography variant="caption" className="text-textGray mt-1">
                            Integrasi Hardware Scanner 2D / Barcode
                        </Typography>
                    </View>
                    <View className="w-12 h-12 bg-indigo-50 rounded-2xl items-center justify-center text-indigo-600">
                        <Scan size={24} color="#4F46E5" />
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                {/* Connection Status */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-1 mr-4">
                            <Typography variant="h4" weight="bold">Status Aktif</Typography>
                            <Typography variant="caption" className="text-textGray mt-1">
                                Aktifkan pendengar scanner di seluruh aplikasi
                            </Typography>
                        </View>
                        <Switch
                            value={isEnabled}
                            onValueChange={toggleEnabled}
                            trackColor={{ false: '#D1D5DB', true: '#4F46E5' }}
                        />
                    </View>

                    <View className="p-4 bg-blue-50 rounded-2xl flex-row items-start">
                        <Info size={20} color="#1D4ED8" className="mr-3 mt-0.5" />
                        <Typography variant="caption" className="text-blue-700 flex-1 leading-5">
                            Hubungkan hardware scanner Anda melalui pengaturan Bluetooth sistem Android/iOS sebagai **Keyboard (HID)** sebelum menggunakannya di aplikasi.
                        </Typography>
                    </View>
                </Card>

                {/* Test Area */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">Test Area</Typography>
                    <Typography variant="caption" className="text-textGray mb-3">
                        Klik kolom di bawah dan lakukan scan untuk mencoba
                    </Typography>

                    <View className="mb-6">
                        <TextInput
                            ref={testInputRef}
                            className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-bold text-lg text-primary"
                            placeholder="Klik di sini sblm scan"
                            placeholderTextColor="#9CA3AF"
                            showSoftInputOnFocus={false} // Prevent soft keyboard from popping up
                            onSubmitEditing={(e) => handleTestScan(e.nativeEvent.text)}
                        />
                        <Typography variant="caption" className="text-center text-textGray/60 mt-2 italic">
                            Soft keyboard dinonaktifkan di area test ini
                        </Typography>
                    </View>

                    <View>
                        <View className="flex-row justify-between items-center mb-3">
                            <Typography variant="caption" weight="bold" className="text-textGray uppercase">Riwayat Scan</Typography>
                            {testResult.length > 0 && (
                                <Pressable onPress={clearHistory}>
                                    <Typography variant="caption" className="text-red-500 font-bold">Hapus</Typography>
                                </Pressable>
                            )}
                        </View>

                        {testResult.length === 0 ? (
                            <View className="py-8 items-center justify-center border border-dashed border-gray-200 rounded-2xl">
                                <Typography className="text-textGray/40 italic">Belum ada data scan</Typography>
                            </View>
                        ) : (
                            <View className="space-y-2">
                                {testResult.map((code, index) => (
                                    <View key={index} className="bg-gray-50 p-3 rounded-xl flex-row justify-between items-center border border-gray-100">
                                        <Typography weight="bold" className="text-primary">{code}</Typography>
                                        <CheckCircle2 size={16} color="#10B981" />
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </Card>

                {/* Guide */}
                <Typography variant="h4" weight="bold" className="mb-4">Panduan Penggunaan</Typography>
                <View className="space-y-3 mb-8">
                    {[
                        { icon: <RefreshCw size={18} color="#6B7280" />, text: "Gunakan mode 'HID' atau 'Keyboard Mode' pada scanner Anda." },
                        { icon: <Keyboard size={18} color="#6B7280" />, text: "App akan mendeteksi scanner sebagai input eksternal." },
                        { icon: <CheckCircle2 size={18} color="#6B7280" />, text: "Scanner harus mengirimkan 'Enter' (Carriage Return) setelah setiap scan." }
                    ].map((item, i) => (
                        <View key={i} className="flex-row items-center space-x-3 bg-white p-4 rounded-2xl border border-gray-100">
                            {item.icon}
                            <Typography variant="body2" className="text-textGray flex-1">{item.text}</Typography>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
