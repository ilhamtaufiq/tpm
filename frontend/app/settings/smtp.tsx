import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { ChevronLeft, Server, Mail, Lock, User, Save, Send, ShieldCheck, Info } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { useRouter } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';
import { AlertDialog } from '../../components/ui/AlertDialog';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { settingsService } from '../../services/settings';
import { getErrorMessage } from '../../utils/error';

export default function SMTPSettingsScreen() {
    const router = useRouter();
    const { themeColors } = useUIStore();

    // Form States
    const [server, setServer] = useState('smtp.gmail.com');
    const [port, setPort] = useState('587');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [senderName, setSenderName] = useState('TPM Business');
    const [useTLS, setUseTLS] = useState(true);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const data = await settingsService.getSettings();
            if (data.smtp) {
                setServer(data.smtp.server);
                setPort(data.smtp.port.toString());
                setUsername(data.smtp.username);
                setPassword(data.smtp.password || '');
                setSenderName(data.smtp.sender_name);
                setUseTLS(data.smtp.use_tls);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/profile');
        }
    };

    const handleSave = async () => {
        if (!username || !password || !server || !port) {
            setDialogConfig({
                visible: true,
                title: "Validasi Gagal",
                message: "Mohon lengkapi semua data server SMTP.",
                variant: 'warning'
            });
            return;
        }

        setIsSaving(true);
        try {
            await settingsService.updateSettings({
                smtp: {
                    server,
                    port: parseInt(port),
                    username,
                    password,
                    sender_name: senderName,
                    use_tls: useTLS
                }
            });

            setDialogConfig({
                visible: true,
                title: "Berhasil!",
                message: "Pengaturan SMTP telah disimpan.",
                variant: 'success'
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: "Gagal Menyimpan",
                message: getErrorMessage(error, "Terjadi kesalahan saat menyimpan pengaturan."),
                variant: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        if (!username || !password) {
            setDialogConfig({
                visible: true,
                title: "Data Tidak Lengkap",
                message: "Lengkapi username dan password sebelum melakukan tes.",
                variant: 'warning'
            });
            return;
        }

        setIsTesting(true);
        try {
            const result = await settingsService.testSMTP({
                server,
                port: parseInt(port),
                username,
                password,
                sender_name: senderName,
                use_tls: useTLS
            });

            setDialogConfig({
                visible: true,
                title: "Koneksi Berhasil",
                message: result.message || "Email percobaan telah dikirim ke email Anda.",
                variant: 'success'
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: "Koneksi Gagal",
                message: getErrorMessage(error, "Gagal terhubung ke SMTP server."),
                variant: 'error'
            });
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-background">
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View className="bg-primary pt-12 pb-8 px-6 rounded-b-[40px] shadow-2xl relative overflow-hidden">
                <View className="absolute top-[-50] right-[-30] w-[200] h-[200] bg-white/10 rounded-full blur-[80px]" />

                <View className="flex-row items-center justify-between z-10">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Server Email</Typography>
                            <Typography className="text-white/50 text-[10px] uppercase tracking-widest font-bold mt-0.5">Pengaturan SMTP Gmail</Typography>
                        </View>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1 -mt-8"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 150 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View entering={FadeInDown.delay(200)} className="pt-4">
                        
                        {/* SMTP Config Card */}
                        <View className="bg-surface p-6 rounded-[32px] shadow-sm border border-gray-50 mb-6">
                            <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] mb-6">Konfigurasi Server</Typography>

                            <View className="mb-5">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">SMTP Server</Typography>
                                <View className="flex-row items-center bg-background h-14 rounded-2xl px-4 border border-gray-100">
                                    <Server size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="smtp.gmail.com"
                                        value={server}
                                        onChangeText={setServer}
                                    />
                                </View>
                            </View>

                            <View className="flex-row gap-x-4 mb-5">
                                <View className="flex-1">
                                    <Typography variant="caption" className="text-text/40 mb-2 ml-1">Port</Typography>
                                    <View className="flex-row items-center bg-background h-14 rounded-2xl px-4 border border-gray-100">
                                        <TextInput
                                            className="flex-1 text-text font-bold text-center"
                                            placeholder="587"
                                            keyboardType="numeric"
                                            value={port}
                                            onChangeText={setPort}
                                        />
                                    </View>
                                </View>
                                <View className="flex-[2] justify-center">
                                    <TouchableOpacity 
                                        onPress={() => setUseTLS(!useTLS)}
                                        className={`h-14 rounded-2xl flex-row items-center justify-center border ${useTLS ? 'bg-emerald-50 border-emerald-100' : 'bg-background border-gray-100'}`}
                                    >
                                        <ShieldCheck size={18} color={useTLS ? '#10B981' : '#9CA3AF'} />
                                        <Typography weight="bold" className={`ml-2 ${useTLS ? 'text-emerald-700' : 'text-text/40'}`}>
                                            {useTLS ? 'TLS Aktif' : 'Non-TLS'}
                                        </Typography>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="mb-5">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Username (Email Gmail)</Typography>
                                <View className="flex-row items-center bg-background h-14 rounded-2xl px-4 border border-gray-100">
                                    <Mail size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="email@gmail.com"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={username}
                                        onChangeText={setUsername}
                                    />
                                </View>
                            </View>

                            <View className="mb-5">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">App Password</Typography>
                                <View className="flex-row items-center bg-background h-14 rounded-2xl px-4 border border-gray-100">
                                    <Lock size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="xxxx xxxx xxxx xxxx"
                                        secureTextEntry
                                        autoCapitalize="none"
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                </View>
                            </View>

                            <View className="mb-2">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Nama Pengirim</Typography>
                                <View className="flex-row items-center bg-background h-14 rounded-2xl px-4 border border-gray-100">
                                    <User size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="TPM Business"
                                        value={senderName}
                                        onChangeText={setSenderName}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Guide Card */}
                        <View className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100/50 flex-row mb-8">
                            <Info size={20} color="#3B82F6" className="mt-1" />
                            <View className="flex-1 ml-4">
                                <Typography weight="bold" className="text-blue-700 mb-1">Cara Menggunakan Gmail SMTP</Typography>
                                <Typography variant="caption" className="text-blue-600/80 leading-relaxed">
                                    1. Aktifkan Verifikasi 2 Langkah di akun Google Anda.{"\n"}
                                    2. Buat "App Password" dari Google Security Settings.{"\n"}
                                    3. Gunakan password 16 digit tersebut di sini.{"\n"}
                                    4. JANGAN gunakan password utama Gmail Anda.
                                </Typography>
                            </View>
                        </View>

                        <View className="flex-row gap-x-4">
                            <TouchableOpacity
                                onPress={handleTest}
                                disabled={isTesting || isSaving}
                                className={`flex-1 h-16 rounded-[24px] flex-row items-center justify-center border border-primary/20 bg-white shadow-sm ${isTesting ? 'opacity-50' : ''}`}
                            >
                                {isTesting ? <ActivityIndicator size="small" color="#023C69" /> : <Send size={18} color="#023C69" />}
                                <Typography weight="bold" className="text-primary ml-3">Test Konf</Typography>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={isSaving || isTesting}
                                className={`flex-[1.5] h-16 rounded-[24px] flex-row items-center justify-center bg-primary shadow-xl ${isSaving ? 'opacity-50' : ''}`}
                            >
                                {isSaving ? <ActivityIndicator size="small" color="white" /> : <Save size={18} color="white" />}
                                <Typography weight="bold" className="text-white ml-3">Simpan</Typography>
                            </TouchableOpacity>
                        </View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}
