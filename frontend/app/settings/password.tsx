import React, { useState } from 'react';
import { View, ScrollView, Pressable, TextInput, StatusBar, Platform, KeyboardAvoidingView } from 'react-native';
import { ChevronLeft, Lock, Eye, EyeOff, Save, ShieldCheck } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { useRouter } from 'expo-router';
import { AlertDialog } from '../../components/ui/AlertDialog';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { authService } from '../../services/auth';
import { getErrorMessage } from '../../utils/error';

export default function ChangePasswordScreen() {
    const router = useRouter();

    // Form States
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info'
    });

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/profile');
        }
    };

    const handleSave = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setDialogConfig({
                visible: true,
                title: "Data Tidak Lengkap",
                message: "Harap isi semua kolom kata sandi.",
                variant: 'error'
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            setDialogConfig({
                visible: true,
                title: "Password Tidak Cocok",
                message: "Konfirmasi kata sandi baru tidak sesuai.",
                variant: 'error'
            });
            return;
        }

        if (newPassword.length < 6) {
            setDialogConfig({
                visible: true,
                title: "Password Terlalu Pendek",
                message: "Kata sandi baru minimal harus 6 karakter.",
                variant: 'error'
            });
            return;
        }

        setIsSaving(true);

        try {
            await authService.changePassword(currentPassword, newPassword);

            setIsSaving(false);
            setDialogConfig({
                visible: true,
                title: "Berhasil!",
                message: "Kata sandi Anda telah berhasil diperbarui di server.",
                variant: 'success'
            });
        } catch (error) {
            console.error('Failed to change password:', error);
            setIsSaving(false);
            setDialogConfig({
                visible: true,
                title: "Gagal Ganti Password",
                message: getErrorMessage(error, "Terjadi kesalahan saat memperbarui kata sandi. Pastikan password lama benar."),
                variant: 'error'
            });
        }
    };

    return (
        <View className="flex-1 bg-[#F8F9FA]">
            <StatusBar barStyle="light-content" />

            {/* Pattern 1: Premium Curved Header */}
            <View className="bg-primary pt-12 pb-8 px-6 rounded-b-[40px] shadow-2xl relative overflow-hidden">
                {/* Decorative Elements */}
                <View className="absolute top-[-50] right-[-30] w-[200] h-[200] bg-white/10 rounded-full blur-[80px]" />

                <View className="flex-row items-center justify-between mb-8 z-10">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Kata Sandi</Typography>
                            <Typography className="text-white/50 text-[10px] uppercase tracking-widest font-bold mt-0.5">Keamanan Akun</Typography>
                        </View>
                    </View>
                </View>

                {/* Secure Icon Section */}
                <Animated.View entering={FadeInUp.delay(200)} className="items-center z-10">
                    <View className="w-24 h-24 bg-white/10 rounded-[32px] items-center justify-center border border-white/20">
                        <ShieldCheck size={48} color="white" strokeWidth={1.5} />
                    </View>
                </Animated.View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView
                    className="flex-1 -mt-8"
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View entering={FadeInDown.delay(400)} className="space-y-6">

                        {/* Section: Change Password Form */}
                        <View className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-50">
                            <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] mb-6">Ubah Kata Sandi</Typography>

                            {/* Current Password */}
                            <View className="mb-5">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Kata Sandi Saat Ini</Typography>
                                <View className="flex-row items-center bg-gray-50 h-14 rounded-2xl px-4 border border-gray-100">
                                    <Lock size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="••••••••"
                                        secureTextEntry={!showCurrent}
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                    />
                                    <Pressable onPress={() => setShowCurrent(!showCurrent)}>
                                        {showCurrent ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
                                    </Pressable>
                                </View>
                            </View>

                            <View className="h-[1px] bg-gray-100 w-full mb-6" />

                            {/* New Password */}
                            <View className="mb-5">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Kata Sandi Baru</Typography>
                                <View className="flex-row items-center bg-gray-50 h-14 rounded-2xl px-4 border border-gray-100">
                                    <Lock size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="Minimal 6 karakter"
                                        secureTextEntry={!showNew}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                    />
                                    <Pressable onPress={() => setShowNew(!showNew)}>
                                        {showNew ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
                                    </Pressable>
                                </View>
                            </View>

                            {/* Confirm New Password */}
                            <View>
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Konfirmasi Kata Sandi Baru</Typography>
                                <View className="flex-row items-center bg-gray-50 h-14 rounded-2xl px-4 border border-gray-100">
                                    <Lock size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="Ulangi kata sandi baru"
                                        secureTextEntry={!showConfirm}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                    />
                                    <Pressable onPress={() => setShowConfirm(!showConfirm)}>
                                        {showConfirm ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        {/* Security Tips Card */}
                        <View className="bg-blue-50 p-5 rounded-[24px] border border-blue-100 flex-row items-start">
                            <ShieldCheck size={20} color="#3B82F6" className="mt-0.5" />
                            <View className="flex-1 ml-3">
                                <Typography weight="bold" className="text-blue-700 text-sm mb-1">Tips Keamanan</Typography>
                                <Typography className="text-blue-600/70 text-xs leading-5">Gunakan kombinasi huruf, angka, dan simbol untuk kata sandi yang lebih kuat.</Typography>
                            </View>
                        </View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom Floating Action Button */}
            <View className="absolute bottom-10 left-6 right-6">
                <Pressable
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.8}
                    className={`h-16 rounded-3xl flex-row items-center justify-center shadow-xl ${isSaving ? 'bg-primary/60' : 'bg-primary'}`}
                >
                    <Save size={20} color="white" />
                    <Typography weight="bold" className="text-white text-lg ml-3">
                        {isSaving ? 'Memperbarui...' : 'Perbarui Kata Sandi'}
                    </Typography>
                </Pressable>
            </View>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => {
                    setDialogConfig({ ...dialogConfig, visible: false });
                    if (dialogConfig.variant === 'success') {
                        handleBack();
                    }
                }}
            />
        </View>
    );
}
