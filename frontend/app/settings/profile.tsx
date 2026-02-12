import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, StatusBar, Platform, KeyboardAvoidingView, Image, ActivityIndicator } from 'react-native';
import { ChevronLeft, Camera, User, Mail, Phone, Briefcase, Save, CheckCircle2 } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { AlertDialog } from '../../components/ui/AlertDialog';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileSettingsScreen() {
    const router = useRouter();
    const { user, setAuth, token } = useAuthStore();

    // Form States
    const [name, setName] = useState(user?.name || 'Admin TPM');
    const [email, setEmail] = useState(user?.email || 'admin@tpm.com');
    const [phone, setPhone] = useState(user?.phone || '081234567890');
    const [jabatan, setJabatan] = useState(user?.role || 'Manager');
    const [image, setImage] = useState<string | null>(user?.profile_picture || null);

    const [isSaving, setIsSaving] = useState(false);
    const [isPicking, setIsPicking] = useState(false);
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

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            setDialogConfig({
                visible: true,
                title: "Izin Ditolak",
                message: "Maaf, kami memerlukan izin galeri untuk mengganti foto profil.",
                variant: 'error'
            });
            return;
        }

        setIsPicking(true);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        setIsPicking(false);

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);

        // Simulating API Call
        setTimeout(() => {
            // Update local store
            const updatedUser = {
                ...user,
                name,
                email,
                phone,
                role: jabatan,
                profile_picture: image
            };

            setAuth(updatedUser, token || '');

            setIsSaving(false);
            setDialogConfig({
                visible: true,
                title: "Berhasil!",
                message: "Profil Anda telah diperbarui secara lokal. (Integrasi backend segera hadir)",
                variant: 'success'
            });
        }, 1500);
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
                        <TouchableOpacity
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Ubah Profil</Typography>
                            <Typography className="text-white/50 text-[10px] uppercase tracking-widest font-bold mt-0.5">Edit Data Akun</Typography>
                        </View>
                    </View>
                </View>

                {/* Avatar Section */}
                <Animated.View entering={FadeInUp.delay(200)} className="items-center z-10">
                    <View className="relative">
                        <View className="w-28 h-28 bg-white rounded-[36px] items-center justify-center shadow-2xl border-4 border-white/20 overflow-hidden">
                            {image ? (
                                <Image source={{ uri: image }} className="w-full h-full" />
                            ) : (
                                <User size={60} color="#023C69" strokeWidth={1.5} />
                            )}
                            {isPicking && (
                                <View className="absolute inset-0 bg-black/20 items-center justify-center">
                                    <ActivityIndicator color="white" />
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={pickImage}
                            disabled={isPicking}
                            className="absolute bottom-0 right-0 w-10 h-10 bg-secondary rounded-2xl items-center justify-center border-2 border-white shadow-lg"
                        >
                            <Camera size={20} color="white" />
                        </TouchableOpacity>
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

                        {/* Section: Personal Info */}
                        <View className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-50">
                            <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] mb-6">Informasi Personal</Typography>

                            {/* Name Input */}
                            <View className="mb-5">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Nama Lengkap</Typography>
                                <View className="flex-row items-center bg-gray-50 h-14 rounded-2xl px-4 border border-gray-100">
                                    <User size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="Nama Lengkap"
                                        value={name}
                                        onChangeText={setName}
                                    />
                                </View>
                            </View>

                            {/* Email Input */}
                            <View className="mb-5">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Alamat Email</Typography>
                                <View className="flex-row items-center bg-gray-50 h-14 rounded-2xl px-4 border border-gray-100">
                                    <Mail size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="email@example.com"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>
                            </View>

                            {/* Phone Input */}
                            <View className="mb-5">
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Nomor Telepon</Typography>
                                <View className="flex-row items-center bg-gray-50 h-14 rounded-2xl px-4 border border-gray-100">
                                    <Phone size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="08xxxxxxxxxx"
                                        keyboardType="phone-pad"
                                        value={phone}
                                        onChangeText={setPhone}
                                    />
                                </View>
                            </View>

                            {/* Role Input */}
                            <View>
                                <Typography variant="caption" className="text-text/40 mb-2 ml-1">Jabatan / Divisi</Typography>
                                <View className="flex-row items-center bg-gray-50 h-14 rounded-2xl px-4 border border-gray-100">
                                    <Briefcase size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 ml-3 text-text font-bold"
                                        placeholder="Contoh: Manager"
                                        value={jabatan}
                                        onChangeText={setJabatan}
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Additional Info / Settings Card */}
                        <View className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-50">
                            <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] mb-4">Informasi Tambahan</Typography>
                            <View className="flex-row items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <View className="flex-row items-center">
                                    <CheckCircle2 size={18} color="#10B981" />
                                    <Typography weight="bold" className="text-emerald-700 ml-3">Akun Terverifikasi</Typography>
                                </View>
                                <Typography variant="caption" className="text-emerald-600/60">ID #29301</Typography>
                            </View>
                        </View>

                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Bottom Floating Action Button */}
            <View className="absolute bottom-10 left-6 right-6">
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.8}
                    className={`h-16 rounded-3xl flex-row items-center justify-center shadow-xl ${isSaving ? 'bg-primary/60' : 'bg-primary'}`}
                >
                    <Save size={20} color="white" />
                    <Typography weight="bold" className="text-white text-lg ml-3">
                        {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </Typography>
                </TouchableOpacity>
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
