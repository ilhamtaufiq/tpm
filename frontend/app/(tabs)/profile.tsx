import { appAlert } from '../../utils/appAlert';
import React from 'react';
import { View, ScrollView, Pressable, Platform, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleUser, User, Trash2, LogOut, ChevronRight, Settings, Printer, Bluetooth, ShieldCheck, Palette, Mail, Lock, Fingerprint, Scan, Type, Database, MonitorOff, RefreshCw, SlidersHorizontal, UserPlus, Bell } from 'lucide-react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { Typography } from '../../components/ui/Typography';
import { Header } from '../../components/ui/Header';
import { useUIStore } from '../../store/useUIStore';
import { useResetTransactions } from '../../hooks/useMaintenance';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { router, useLocalSearchParams } from 'expo-router';
import { useSecurityStore } from '../../store/useSecurityStore';
import { BaseModal } from '../../components/ui/BaseModal';
import { Switch } from 'react-native';
import { useUpdateSecuritySettings } from '../../hooks/useSecurityAPI';

import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/auth';
import { getFileUrl } from '../../utils/image';
import api from '../../utils/api';
import { useNotificationStore } from '../../store/useNotificationStore';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

export default function ProfileScreen() {
    const { resetConfirm } = useLocalSearchParams<{ resetConfirm?: string }>();
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuthStore();
    const unreadCount = useNotificationStore(state => state.unreadCount);
    const { themeColors } = useUIStore();
    const { isPinEnabled, useBiometrics, protectedFeatures, syncWithBackend } = useSecurityStore();
    const updateSettingsMutation = useUpdateSecuritySettings();
    const { mutate: resetTransactions, isPending: isResetting } = useResetTransactions();
    const [dialogConfig, setDialogConfig] = React.useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        confirmText?: string;
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });
    const [pinActionVisible, setPinActionVisible] = React.useState(false);
    const [isCheckingUpdate, setIsCheckingUpdate] = React.useState(false);

    const handleCheckUpdate = async () => {
        if (__DEV__) {
            appAlert('Info', 'Manual update hanya tersedia pada aplikasi production / standalone.');
            return;
        }

        try {
            setIsCheckingUpdate(true);
            const update = await Updates.checkForUpdateAsync();

            if (update.isAvailable) {
                setDialogConfig({
                    visible: true,
                    title: "Update Tersedia",
                    message: "Aplikasi versi terbaru ditemukan. Download dan update sekarang?",
                    variant: 'info',
                    type: 'confirm',
                    onConfirm: async () => {
                        try {
                            await Updates.fetchUpdateAsync();
                            await Updates.reloadAsync();
                        } catch (error) {
                            appAlert('Gagal Update', 'Terjadi kesalahan saat mendownload update.');
                        }
                    }
                });
            } else {
                appAlert('Aplikasi Terupdate', 'Anda sudah menggunakan versi terbaru.');
            }
        } catch (error) {
            console.error('Update Check Error:', error);
            appAlert('Error', 'Gagal mengecek update ke server');
        } finally {
            setIsCheckingUpdate(false);
        }
    };

    const showResetConfirmDialog = React.useCallback(() => {
        setDialogConfig({
            visible: true,
            title: "Hapus Transaksi & Stok?",
            message: "Tindakan ini akan menghapus SELURUH riwayat transaksi dan Stok Mobil (Inventory). Data master (Karyawan, Pelanggan, Sparepart) tetap tersimpan tetapi stok sparepart akan di-nol-kan. Tindakan ini tidak dapat dibatalkan!",
            variant: 'error',
            type: 'confirm',
            confirmText: 'Hapus',
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
    }, [resetTransactions]);

    React.useEffect(() => {
        if (resetConfirm === '1') {
            showResetConfirmDialog();
            router.setParams({ resetConfirm: undefined });
        }
    }, [resetConfirm, showResetConfirmDialog]);

    const handleReset = () => {
        // Require PIN re-authentication before allowing destructive reset
        if (isPinEnabled) {
            router.push({
                pathname: '/(security)/pin',
                params: { mode: 'verify', action: 'reset_transactions' }
            });
            return;
        }
        showResetConfirmDialog();
    };

    const handleToggleWebAccess = async (enabled: boolean) => {
        // Optimistic update
        const originalFeatures = { ...protectedFeatures };
        syncWithBackend(isPinEnabled, { ...protectedFeatures, disable_web_access: enabled });

        try {
            const serverFeatures = await updateSettingsMutation.mutateAsync({ disable_web_access: enabled });
            syncWithBackend(isPinEnabled, serverFeatures);
        } catch (error) {
            console.error('Failed to update web access setting', error);
            // Revert on failure
            syncWithBackend(isPinEnabled, originalFeatures);
            appAlert('Error', 'Gagal memperbarui pengaturan ke server');
        }
    };

    const handleLogout = () => {
        setDialogConfig({
            visible: true,
            title: "Keluar Sesi",
            message: "Anda yakin ingin mengakhiri sesi dan keluar dari aplikasi?",
            variant: 'warning',
            type: 'confirm',
            onConfirm: async () => {
                await authService.clearPushToken().catch((error) => {
                    console.warn('[Profile] Failed to clear push token before logout', error);
                });
                // Server-side logout to invalidate session token
                await api.post('/auth/logout').catch((error) => {
                    console.warn('[Profile] Server-side logout failed', error);
                });
                setDialogConfig(prev => ({ ...prev, visible: false }));
                logout();
                router.replace('/(auth)/login');
            }
        });
    };

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';
    const isSuperAdmin = user?.role === 'ADMIN';

    return (
        <View className="flex-1 bg-background overflow-hidden">
            <StatusBar barStyle="dark-content" />

            {/* Background Image (User Custom) */}
            {user?.home_background && (
                <Image
                    source={{ uri: getFileUrl(user.home_background) as string }}
                    className="absolute inset-0 w-full h-full opacity-10"
                    resizeMode="cover"
                />
            )}

            <Header
                title="Pengaturan"
                subtitle="Konfigurasi & Manajemen Sistem"
                showProfile={false}
                leftElement={
                    <View className="w-11 h-11 bg-gray-50 rounded-2xl p-0.5 border border-gray-100 overflow-hidden relative">
                        <View className="w-full h-full bg-white rounded-2xl items-center justify-center overflow-hidden">
                            {user?.profile_picture ? (
                                <Image source={{ uri: getFileUrl(user.profile_picture) as string }} className="w-full h-full" />
                            ) : (
                                <User size={22} color={themeColors.primary} strokeWidth={2.5} />
                            )}
                        </View>
                    </View>
                }
                rightElement={
                    <Pressable
                        onPress={() => router.push('/settings/profile')}
                        className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 active:bg-gray-100"
                    >
                        <Settings size={20} color="#1F2937" />
                    </Pressable>
                }
            />


            <ScrollView
                className="flex-1 mt-4"
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 88) }}
                showsVerticalScrollIndicator={false}
            >
                {/* ACCOUNT & SECURITY - BENTO GRID ROW */}
                <View className="flex-row gap-4 mb-4">
                    <Pressable
                        className="flex-1 bg-surface p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                        onPress={() => router.push('/settings/profile')}
                    >
                        <View className="w-10 h-10 bg-blue-50 rounded-[14px] items-center justify-center mb-3">
                            <User size={20} color="#3B82F6" />
                        </View>
                        <View>
                            <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Ubah Profil</Typography>
                            <Typography variant="caption" className="text-text/40 text-[10px]">Nama & Biodata</Typography>
                        </View>
                    </Pressable>

                    {isAdmin && (
                        <Pressable
                            className="flex-1 bg-surface p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                            onPress={() => {
                                if (isPinEnabled) {
                                    setPinActionVisible(true);
                                } else {
                                    router.push('/(security)/pin?mode=setup');
                                }
                            }}
                        >
                            <View className={`w-10 h-10 ${isPinEnabled ? 'bg-emerald-50' : 'bg-rose-50'} rounded-[14px] items-center justify-center mb-3`}>
                                <Lock size={20} color={isPinEnabled ? '#10B981' : '#EF4444'} />
                            </View>
                            <View>
                                <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">
                                    PIN {isPinEnabled ? 'Aktif' : 'Nonaktif'}
                                </Typography>
                                <Typography variant="caption" className="text-text/40 text-[10px]">
                                    {isPinEnabled ? 'Ubah atau Matikan' : 'Kunci Aplikasi'}
                                </Typography>
                            </View>
                        </Pressable>
                    )}
                </View>

                {isAdmin && (
                    <>
                        {/* ACCESSIBILITY - BENTO GRID ROW */}
                        <View className="flex-row gap-4 mb-4">
                            <Pressable
                                className="flex-1 bg-surface p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                                onPress={() => router.push('/settings/print')}
                            >
                                <View className="w-10 h-10 bg-emerald-50 rounded-[14px] items-center justify-center mb-3">
                                    <Printer size={20} color="#10B981" />
                                </View>
                                <View>
                                    <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Struk</Typography>
                                    <Typography variant="caption" className="text-text/40 text-[10px]">Konfigurasi Printer</Typography>
                                </View>
                            </Pressable>

                            <Pressable
                                className="flex-1 bg-surface p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                                onPress={() => router.push('/settings/scanner')}
                            >
                                <View className="w-10 h-10 bg-indigo-50 rounded-[14px] items-center justify-center mb-3">
                                    <Scan size={20} color="#6366F1" />
                                </View>
                                <View>
                                    <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Scanner</Typography>
                                    <Typography variant="caption" className="text-text/40 text-[10px]">Barcode 2D</Typography>
                                </View>
                            </Pressable>

                            <Pressable
                                className="flex-1 bg-surface p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                                onPress={() => router.push('/settings/bluetooth')}
                            >
                                <View className="w-10 h-10 bg-blue-50 rounded-[14px] items-center justify-center mb-3">
                                    <Bluetooth size={20} color="#3B82F6" />
                                </View>
                                <View>
                                    <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Pairing</Typography>
                                    <Typography variant="caption" className="text-text/40 text-[10px]">Sync Perangkat</Typography>
                                </View>
                            </Pressable>
                        </View>

                        {/* THEME SETTINGS - NEW SECTION */}
                        <View className="flex-row gap-4 mb-8">
                            <Pressable
                                className="flex-1 bg-surface p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                                onPress={async () => {
                                    if (!isPinEnabled) {
                                        appAlert('Peringatan', 'Aktifkan PIN terlebih dahulu untuk menggunakan Biometrik');
                                        return;
                                    }
                                    // Always require PIN verification before toggling biometrics for safety
                                    router.push({
                                        pathname: '/(security)/pin',
                                        params: {
                                            mode: 'verify',
                                            redirect: '/(tabs)/profile' // Optional: simplified for now, usually just toggle works
                                        }
                                    });
                                }}
                            >
                                <View className={`w-10 h-10 ${useBiometrics ? 'bg-blue-50' : 'bg-gray-50'} rounded-[14px] items-center justify-center mb-3`}>
                                    <Fingerprint size={20} color={useBiometrics ? '#3B82F6' : '#9CA3AF'} />
                                </View>
                                <View>
                                    <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Biometrik</Typography>
                                    <Typography variant="caption" className="text-text/40 text-[10px]">{useBiometrics ? 'Aktif' : 'Klik Aktifkan'}</Typography>
                                </View>
                            </Pressable>

                            <Pressable
                                className="flex-1 bg-surface p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                                onPress={() => router.push('/settings/branding')}
                            >
                                <View className="w-10 h-10 bg-rose-50 rounded-[14px] items-center justify-center mb-3">
                                    <Type size={20} color="#F43F5E" />
                                </View>
                                <View>
                                    <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Branding</Typography>
                                    <Typography variant="caption" className="text-text/40 text-[10px]">Logo & Nama App</Typography>
                                </View>
                            </Pressable>

                            <Pressable
                                className="flex-1 bg-surface p-5 rounded-[32px] border border-gray-50 shadow-sm items-start justify-between min-h-[140px]"
                                onPress={() => router.push('/settings/theme')}
                            >
                                <View className="w-10 h-10 bg-indigo-50 rounded-[14px] items-center justify-center mb-3">
                                    <Palette size={20} color="#6366F1" />
                                </View>
                                <View>
                                    <Typography weight="bold" className="text-text text-[15px] leading-tight mb-1">Tampilan</Typography>
                                    <Typography variant="caption" className="text-text/40 text-[10px]">Kustom UI</Typography>
                                </View>
                            </Pressable>
                        </View>

                        {isSuperAdmin && (
                            <>
                                {/* BOTTOM NAVIGATION SETTINGS - DYNAMIC NAV SLOT */}
                                <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] ml-4 mb-4">Navigasi Utama</Typography>

                                <Pressable
                                    className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm flex-row items-center mb-8"
                                    onPress={() => router.push('/settings/navigation')}
                                >
                                    <View className="w-12 h-12 bg-blue-50 rounded-[20px] items-center justify-center mr-4">
                                        <SlidersHorizontal size={24} color="#3B82F6" />
                                    </View>
                                    <View className="flex-1">
                                        <Typography variant="body1" weight="bold" className="text-text mb-0.5">Bottom Navigasi</Typography>
                                        <Typography variant="caption" className="text-text/40">Kustomisasi 5 slot menu utama, FAB, dan ikon halaman</Typography>
                                    </View>
                                    <ChevronRight size={20} color={themeColors.textGray} />
                                </Pressable>
                            </>
                        )}

                        {/* FEATURE PROTECTION SETTINGS - NEW SECTION */}
                        <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] ml-4 mb-4">Pengaturan Keamanan</Typography>

                        <Pressable
                            className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm flex-row items-center mb-8"
                            onPress={() => router.push('/settings/security-features')}
                        >
                            <View className="w-12 h-12 bg-blue-50 rounded-[20px] items-center justify-center mr-4">
                                <ShieldCheck size={24} color="#3B82F6" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">Keamanan Halaman</Typography>
                                <Typography variant="caption" className="text-text/40">Atur proteksi PIN per menu</Typography>
                            </View>
                            <ChevronRight size={20} color={themeColors.textGray} />
                        </Pressable>

                        <Pressable
                            className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm flex-row items-center mb-8"
                            onPress={() => router.push('/settings/smtp')}
                        >
                            <View className="w-12 h-12 bg-indigo-50 rounded-[20px] items-center justify-center mr-4">
                                <Mail size={24} color="#6366F1" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">Server Email (SMTP)</Typography>
                                <Typography variant="caption" className="text-text/40">Konfigurasi Gmail Server</Typography>
                            </View>
                            <ChevronRight size={20} color={themeColors.textGray} />
                        </Pressable>

                        <View className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm flex-row items-center mb-8">
                            <View className="w-12 h-12 bg-rose-50 rounded-[20px] items-center justify-center mr-4">
                                <MonitorOff size={24} color="#F43F5E" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">Batasi Akses Web</Typography>
                                <Typography variant="caption" className="text-text/40">Paksa akses hanya dari Mobile</Typography>
                            </View>
                            <Switch
                                value={protectedFeatures.disable_web_access}
                                onValueChange={handleToggleWebAccess}
                                trackColor={{ false: "#E2E8F0", true: "#FDA4AF" }}
                                thumbColor={protectedFeatures.disable_web_access ? "#F43F5E" : "#94A3B8"}
                                disabled={updateSettingsMutation.isPending}
                            />
                        </View>


                        {/* USER MANAGEMENT & ACCESS - NEW SECTION */}
                        <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] ml-4 mb-4">Pengguna & Akses</Typography>

                        <Pressable
                            className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm flex-row items-center mb-8"
                            onPress={() => router.push('/settings/users')}
                        >
                            <View className="w-12 h-12 bg-blue-50 rounded-[20px] items-center justify-center mr-4">
                                <UserPlus size={24} color="#3B82F6" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">Manajemen Pengguna</Typography>
                                <Typography variant="caption" className="text-text/40">Kelola akun, role, dan hak akses staf</Typography>
                            </View>
                            <ChevronRight size={20} color={themeColors.textGray} />
                        </Pressable>


                        {/* DANGER ZONE & SESSION */}
                        <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[4px] ml-4 mb-4">Sesi & Data</Typography>

                        <Pressable
                            className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm flex-row items-center mb-4"
                            onPress={() => router.push('/settings/backup')}
                        >
                            <View className="w-12 h-12 bg-indigo-50 rounded-[24px] items-center justify-center mr-4">
                                <Database size={24} color="#6366F1" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">Backup & Restore</Typography>
                                <Typography variant="caption" className="text-text/40">Amankan data sistem ke ZIP/SQL</Typography>
                            </View>
                            <ChevronRight size={20} color={themeColors.textGray} />
                        </Pressable>

                        <Pressable
                            className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm flex-row items-center mb-4"
                            onPress={() => router.push('/settings/trash')}
                        >
                            <View className="w-12 h-12 bg-red-50 rounded-[24px] items-center justify-center mr-4">
                                <Trash2 size={24} color="#EF4444" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-text mb-0.5">Tempat Sampah</Typography>
                                <Typography variant="caption" className="text-text/40">Restore atau hapus permanen data</Typography>
                            </View>
                            <ChevronRight size={20} color={themeColors.textGray} />
                        </Pressable>

                        <Pressable
                            className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm flex-row items-center mb-4"
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
                        </Pressable>
                    </>
                )}

                <Pressable
                    className="bg-surface/50 p-5 rounded-[32px] border border-gray-100 flex-row items-center mb-4"
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
                </Pressable>

                <Pressable
                    className="bg-surface/50 p-5 rounded-[32px] border border-gray-100 flex-row items-center mb-8"
                    onPress={handleCheckUpdate}
                    disabled={isCheckingUpdate}
                >
                    <View className="w-12 h-12 bg-gray-100 rounded-[18px] items-center justify-center mr-4">
                        <RefreshCw size={22} color="#374151" className={isCheckingUpdate ? 'animate-spin' : ''} />
                    </View>
                    <View className="flex-1">
                        <Typography variant="body1" weight="bold" className="text-text">Cek Update Sistem</Typography>
                        <Typography variant="caption" className="text-text/40">Paksa update manual ke server</Typography>
                    </View>
                    <ChevronRight size={18} color="#9CA3AF" />
                </Pressable>

                <View className="items-center pb-24">
                    <Typography variant="caption" className="text-text/20">Versi Aplikasi {Constants.expoConfig?.version || '1.0.0'} • TPM Super App Mobile</Typography>
                </View>
            </ScrollView>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                confirmText={dialogConfig.confirmText}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={dialogConfig.onConfirm}
                loading={isResetting}
            />

            <BaseModal
                visible={pinActionVisible}
                onClose={() => setPinActionVisible(false)}
                title="PIN Keamanan"
            >
                <View className="gap-y-4">
                    <Typography className="text-gray-500 mb-2 leading-relaxed">
                        Pilih tindakan untuk pengaturan PIN keamanan Anda.
                    </Typography>

                    <Pressable
                        onPress={() => {
                            setPinActionVisible(false);
                            router.push({
                                pathname: '/(security)/pin',
                                params: { mode: 'verify', action: 'change_pin' }
                            });
                        }}
                        className="flex-row items-center p-5 bg-blue-50/50 rounded-[28px] border border-blue-100/50"
                    >
                        <View className="w-12 h-12 bg-blue-100/50 rounded-[18px] items-center justify-center mr-4">
                            <Lock size={22} color="#3B82F6" />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-blue-700 text-base mb-0.5">Ubah PIN</Typography>
                            <Typography variant="caption" className="text-blue-600/60 uppercase tracking-widest font-bold text-[9px]">Ganti PIN Lama</Typography>
                        </View>
                        <View className="w-8 h-8 bg-white rounded-full items-center justify-center shadow-sm">
                            <ChevronRight size={16} color="#3B82F6" />
                        </View>
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            setPinActionVisible(false);
                            router.push({
                                pathname: '/(security)/pin',
                                params: { mode: 'verify', action: 'disable_pin' }
                            });
                        }}
                        className="flex-row items-center p-5 bg-rose-50/50 rounded-[28px] border border-rose-100/50"
                    >
                        <View className="w-12 h-12 bg-rose-100/50 rounded-[18px] items-center justify-center mr-4">
                            <ShieldCheck size={22} color="#EF4444" />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-rose-700 text-base mb-0.5">Nonaktifkan</Typography>
                            <Typography variant="caption" className="text-rose-600/60 uppercase tracking-widest font-bold text-[9px]">Matikan Keamanan</Typography>
                        </View>
                        <View className="w-8 h-8 bg-white rounded-full items-center justify-center shadow-sm">
                            <ChevronRight size={16} color="#EF4444" />
                        </View>
                    </Pressable>
                </View>
            </BaseModal>

            {/* Notification Button - Fixed placement outside PIN modal */}
            <Pressable
                className="absolute bottom-6 right-6 w-14 h-14 bg-amber-500 rounded-full items-center justify-center shadow-lg shadow-amber-500/30"
                onPress={() => router.push('/settings/notifications')}
            >
                <Bell size={24} color="#FFF" />
                {unreadCount > 0 && (
                    <View className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 items-center justify-center border-2 border-white">
                        <Typography className="text-white text-[10px] font-black">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Typography>
                    </View>
                )}
            </Pressable>
        </View>
    );
}

