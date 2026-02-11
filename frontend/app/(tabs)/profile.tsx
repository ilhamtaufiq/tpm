import React from 'react';
import { View, ScrollView, Alert, TouchableOpacity, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleUser, User, Trash2, LogOut, ChevronRight, Settings, Printer, Bluetooth, ShieldCheck } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { useResetTransactions } from '../../hooks/useMaintenance';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function ProfileScreen() {
    const { user, logout } = useAuthStore();
    const { mutate: resetTransactions, isPending: isResetting } = useResetTransactions();
    const [dialogConfig, setDialogConfig] = React.useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    const handleReset = () => {
        setDialogConfig({
            visible: true,
            title: "Hapus Transaksi?",
            message: "Tindakan ini akan menghapus SELURUH riwayat transaksi. Data master tidak akan terhapus. Tindakan ini tidak dapat dibatalkan!",
            variant: 'error',
            type: 'confirm',
            onConfirm: () => {
                resetTransactions(undefined, {
                    onSuccess: () => {
                        setDialogConfig({
                            visible: true,
                            title: "Sukses",
                            message: "Data transaksi berhasil direset.",
                            variant: 'success',
                            type: 'alert'
                        });
                    },
                    onError: (error) => {
                        setDialogConfig({
                            visible: true,
                            title: "Error",
                            message: getErrorMessage(error, "Gagal mereset data"),
                            variant: 'error',
                            type: 'alert'
                        });
                    }
                });
            }
        });
    };

    const handleLogout = () => {
        setDialogConfig({
            visible: true,
            title: "Keluar Sesi",
            message: "Anda yakin ingin mengakhiri sesi dan keluar dari aplikasi?",
            variant: 'warning',
            type: 'confirm',
            onConfirm: () => {
                logout();
            }
        });
    };

    return (
        <View className="flex-1 bg-[#F8F9FA]">
            {/* Pattern 1: Adaptive Premium Header - Ultra Compact */}
            <View className="bg-primary pt-12 pb-8 px-6 rounded-b-[48px] shadow-xl overflow-hidden z-10">
                {/* Decorative Glass Effect */}
                <View className="absolute top-[-50] right-[-50] w-[200] h-[200] bg-white/10 rounded-full blur-[80px]" />
                <View className="absolute bottom-[-20] left-[-20] w-[100] h-[100] bg-black/5 rounded-full blur-[40px]" />

                <View className="flex-row items-center">
                    {/* Avatar */}
                    <View className="w-14 h-14 bg-white/20 rounded-full p-1 mr-4 border border-white/10">
                        <View className="w-full h-full bg-white rounded-full items-center justify-center overflow-hidden">
                            {user?.profile_picture ? (
                                <Image source={{ uri: user.profile_picture }} className="w-full h-full" />
                            ) : (
                                <CircleUser size={28} color="#00AA13" />
                            )}
                        </View>
                        <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-primary" />
                    </View>

                    {/* Text Info */}
                    <View className="flex-1 justify-center">
                        <Typography className="text-white/60 text-[10px] uppercase tracking-widest font-bold mb-0.5">Profil Saya</Typography>
                        <Typography variant="h3" weight="bold" className="text-white text-lg leading-tight">{user?.name || 'Admin TPM'}</Typography>
                        <Typography className="text-white/80 text-xs">{user?.role || 'Manager'}</Typography>
                    </View>

                    {/* Settings Button */}
                    <TouchableOpacity
                        onPress={() => router.push('/settings/profile')}
                        className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center border border-white/5 active:bg-white/20"
                    >
                        <Settings size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </View>


            <ScrollView
                className="flex-1 -mt-8"
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 60 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ACCOUNT & SECURITY - BENTO GRID ROW */}
                <View className="flex-row gap-4 mb-4">
                    <TouchableOpacity
                        className="flex-1 bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                        onPress={() => router.push('/settings/profile')}
                    >
                        <View className="w-10 h-10 bg-blue-50 rounded-[14px] items-center justify-center mb-3">
                            <User size={20} color="#3B82F6" />
                        </View>
                        <View>
                            <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Ubah Profil</Typography>
                            <Typography variant="caption" className="text-text/40 text-[10px]">Nama & Biodata</Typography>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-1 bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                        onPress={() => router.push('/settings/password')}
                    >
                        <View className="w-10 h-10 bg-amber-50 rounded-[14px] items-center justify-center mb-3">
                            <ShieldCheck size={20} color="#F59E0B" />
                        </View>
                        <View>
                            <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Kata Sandi</Typography>
                            <Typography variant="caption" className="text-text/40 text-[10px]">Keamanan Akun</Typography>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ACCESSIBILITY - BENTO GRID ROW */}
                <View className="flex-row gap-4 mb-6">
                    <TouchableOpacity
                        className="flex-1 bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                        onPress={() => router.push('/settings/print')}
                    >
                        <View className="w-10 h-10 bg-emerald-50 rounded-[14px] items-center justify-center mb-3">
                            <Printer size={20} color="#10B981" />
                        </View>
                        <View>
                            <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Struk</Typography>
                            <Typography variant="caption" className="text-text/40 text-[10px]">Konfigurasi Printer</Typography>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-1 bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                        onPress={() => router.push('/settings/bluetooth')}
                    >
                        <View className="w-10 h-10 bg-blue-50 rounded-[14px] items-center justify-center mb-3">
                            <Bluetooth size={20} color="#3B82F6" />
                        </View>
                        <View>
                            <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Bluetooth</Typography>
                            <Typography variant="caption" className="text-text/40 text-[10px]">Sync Perangkat</Typography>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* DANGER ZONE & SESSION */}
                <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] ml-4 mb-4">Sesi & Data</Typography>

                <TouchableOpacity
                    className="bg-white p-5 rounded-[32px] border border-gray-50 shadow-sm flex-row items-center mb-4"
                    onPress={handleReset}
                    disabled={isResetting}
                >
                    <View className="w-12 h-12 bg-red-50 rounded-[18px] items-center justify-center mr-4">
                        <Trash2 size={22} color="#EF4444" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body1" weight="bold" className="text-red-500 mb-0.5">
                            {isResetting ? "Sedang Memproses..." : "Reset Riwayat Transaksi"}
                        </Typography>
                        <Typography variant="caption" className="text-text/40">Hapus database lokal (Danger)</Typography>
                    </View>
                    <ChevronRight size={18} color="#EF4444" opacity={0.5} />
                </TouchableOpacity>

                <TouchableOpacity
                    className="bg-white/50 p-5 rounded-[32px] border border-gray-100 flex-row items-center mb-8"
                    onPress={handleLogout}
                >
                    <View className="w-12 h-12 bg-gray-100 rounded-[18px] items-center justify-center mr-4">
                        <LogOut size={22} color="#374151" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body1" weight="bold" className="text-text">Keluar Akun</Typography>
                        <Typography variant="caption" className="text-text/40">Akhiri sesi aplikasi</Typography>
                    </View>
                    <ChevronRight size={18} color="#9CA3AF" />
                </TouchableOpacity>

                <View className="items-center pb-10">
                    <Typography variant="caption" className="text-text/20">Version 1.0.0 Alpha • TPM Engine</Typography>
                </View>
            </ScrollView>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={dialogConfig.onConfirm}
                loading={isResetting}
            />
        </View>
    );
}

