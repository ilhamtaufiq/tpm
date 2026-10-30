import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Pressable, TextInput, Switch, Platform } from 'react-native';
import Scan from 'lucide-react-native/dist/esm/icons/scan.js';
import Keyboard from 'lucide-react-native/dist/esm/icons/keyboard.js';
import Info from 'lucide-react-native/dist/esm/icons/info.js';
import CheckCircle2 from 'lucide-react-native/dist/esm/icons/circle-check.js';
import AlertCircle from 'lucide-react-native/dist/esm/icons/circle-alert.js';
import RefreshCw from 'lucide-react-native/dist/esm/icons/refresh-cw.js';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2.js';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUIStore, findPaletteBorder } from '../../store/useUIStore';

export default function ScannerSettingsScreen() {
    const themeColors = useUIStore((s) => s.themeColors);
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
        <View className="flex-1 bg-background">
            <Header
                title="Barcode Scanner"
                subtitle="Integrasi Hardware Scanner 2D / Barcode"
                showBackButton
                showProfile={false}
                showBell={false}
                rightElement={
                    <View className="w-12 h-12 bg-indigo-50 rounded-2xl items-center justify-center text-indigo-600">
                        <Scan size={24} color="#4F46E5" />
                    </View>
                }
            />

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
                            trackColor={{ false: findPaletteBorder(themeColors), true: '#4F46E5' }}
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
                            className="bg-background border border-transparent rounded-2xl px-4 py-4 text-center font-bold text-lg text-primary"
                            placeholder="Klik di sini sblm scan"
                            placeholderTextColor={themeColors.textGray}
                            showSoftInputOnFocus={false} // Prevent soft keyboard from popping up
                            onSubmitEditing={(e) => handleTestScan(e.nativeEvent.text)}
                        />
                        <Typography variant="caption" className="text-center text-textGray mt-2 italic">
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
                            <View className="py-8 items-center justify-center border border-dashed border-transparent rounded-2xl">
                                <Typography className="text-textGray italic">Belum ada data scan</Typography>
                            </View>
                        ) : (
                            <View className="space-y-2">
                                {testResult.map((code, index) => (
                                    <View key={index} className="bg-background p-3 rounded-xl flex-row justify-between items-center border border-transparent">
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
                        { icon: <RefreshCw size={18} color={themeColors.textGray} />, text: "Gunakan mode 'HID' atau 'Keyboard Mode' pada scanner Anda." },
                        { icon: <Keyboard size={18} color={themeColors.textGray} />, text: "App akan mendeteksi scanner sebagai input eksternal." },
                        { icon: <CheckCircle2 size={18} color={themeColors.textGray} />, text: "Scanner harus mengirimkan 'Enter' (Carriage Return) setelah setiap scan." }
                    ].map((item, i) => (
                        <View key={i} className="flex-row items-center space-x-3 bg-surface p-4 rounded-2xl border border-transparent">
                            {item.icon}
                            <Typography variant="body2" className="text-textGray flex-1">{item.text}</Typography>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
