import React from 'react';
import { View, ScrollView, Pressable, Switch, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeft,
    ShieldCheck,
    Wallet,
    Wrench,
    Truck,
    FileBarChart,
    Database,
    Car,
    Users,
    Settings as SettingsIcon,
    Lock
} from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { useSecurityStore, ProtectedFeatures } from '../../store/useSecurityStore';
import { useUIStore } from '../../store/useUIStore';
import { useUpdateSecuritySettings } from '../../hooks/useSecurityAPI';

export default function SecurityFeaturesScreen() {
    const router = useRouter();
    const { themeColors } = useUIStore();
    const { isPinEnabled, protectedFeatures, syncWithBackend } = useSecurityStore();
    const updateSettingsMutation = useUpdateSecuritySettings();

    const handleToggle = async (id: keyof ProtectedFeatures) => {
        const newValue = !protectedFeatures[id];

        // Optimistic update
        const updatedFeatures = { ...protectedFeatures, [id]: newValue };
        syncWithBackend(isPinEnabled, updatedFeatures);

        try {
            const serverFeatures = await updateSettingsMutation.mutateAsync({ [id]: newValue });
            syncWithBackend(isPinEnabled, serverFeatures);
        } catch (error) {
            console.error('Failed to update security settings', error);
            // Revert on failure
            syncWithBackend(isPinEnabled, protectedFeatures);
        }
    };

    const featureList = [
        {
            id: 'app_lock',
            label: 'Kunci Internal Aplikasi',
            desc: 'Tampilkan PIN setiap kali aplikasi dibuka',
            icon: ShieldCheck,
            color: 'bg-blue-50',
            iconColor: '#3B82F6'
        },
        {
            id: 'finance',
            label: 'Buku Kas & Keuangan',
            desc: 'Proteksi akses menu akun dan saldo',
            icon: Wallet,
            color: 'bg-emerald-50',
            iconColor: '#10B981'
        },
        {
            id: 'bengkel',
            label: 'Transaksi Bengkel',
            desc: 'Proteksi penjualan jasa dan part',
            icon: Wrench,
            color: 'bg-orange-50',
            iconColor: '#F59E0B'
        },
        {
            id: 'jasa_angkut',
            label: 'Logistik Jasa Angkut',
            desc: 'Proteksi muatan dan rute supir',
            icon: Truck,
            color: 'bg-indigo-50',
            iconColor: '#6366F1'
        },
        {
            id: 'laporan',
            label: 'Laporan Keuangan',
            desc: 'Proteksi Laba Rugi dan Neraca',
            icon: FileBarChart,
            color: 'bg-rose-50',
            iconColor: '#F43F5E'
        },
        {
            id: 'mobil',
            label: 'Stok Mobil & Aset',
            desc: 'Proteksi inventaris kendaraan',
            icon: Car,
            color: 'bg-purple-50',
            iconColor: '#A855F7'
        },
        {
            id: 'sdm',
            label: 'SDM & Penggajian',
            desc: 'Proteksi data karyawan dan gaji',
            icon: Users,
            color: 'bg-amber-50',
            iconColor: '#D97706'
        },
        {
            id: 'master_data',
            label: 'Data Master',
            desc: 'Proteksi Supplier, Customer, & Part',
            icon: Database,
            color: 'bg-cyan-50',
            iconColor: '#0891B2'
        },
        {
            id: 'settings',
            label: 'Pengaturan Sistem',
            desc: 'Proteksi printer dan konfigurasi',
            icon: SettingsIcon,
            color: 'bg-slate-50',
            iconColor: '#475569'
        },
    ];

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* Header */}
            <View className="px-6 pt-4 pb-6 flex-row items-center justify-between border-b border-gray-100 bg-white">
                <Pressable
                    onPress={() => router.back()}
                    className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center"
                >
                    <ChevronLeft size={24} color="#1E293B" />
                </Pressable>
                <Typography variant="h3" weight="bold" className="text-slate-800">Keamanan Halaman</Typography>
                <View className="w-10" />
            </View>

            <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
                <View className="mb-6">
                    <Typography variant="h4" weight="bold" className="text-slate-800 mb-2">Granular PIN Protection</Typography>
                    <Typography className="text-slate-500 text-xs">
                        Pilih halaman mana saja yang ingin Anda lindungi dengan PIN. Fitur ini memungkinkan Anda memberikan akses terbatas pada bagian tertentu.
                    </Typography>
                </View>

                {!isPinEnabled && (
                    <View className="bg-amber-50 p-4 rounded-2xl mb-8 border border-amber-100">
                        <Typography className="text-amber-800 text-[11px] font-bold text-center">
                            ⚠️ PIN aplikasi belum diaktifkan. Aktifkan PIN terlebih dahulu di halaman Profil untuk menggunakan fitur ini.
                        </Typography>
                    </View>
                )}

                <View className="bg-white rounded-[32px] overflow-hidden border border-gray-100 mb-20 shadow-sm relative">
                    {updateSettingsMutation.isPending && (
                        <View className="absolute inset-0 z-10 bg-white/50 items-center justify-center">
                            <ActivityIndicator size="large" color={themeColors.primary} />
                        </View>
                    )}
                    {featureList.map((item, index) => (
                        <View
                            key={item.id}
                            className={`p-5 flex-row items-center justify-between ${index !== featureList.length - 1 ? 'border-b border-gray-50' : ''}`}
                        >
                            <View className="flex-row items-center flex-1">
                                <View className={`w-10 h-10 ${item.color} rounded-xl items-center justify-center mr-4`}>
                                    <item.icon size={20} color={item.iconColor} />
                                </View>
                                <View className="flex-1 pr-4">
                                    <Typography weight="bold" className="text-[14px] text-slate-800 mb-0.5">{item.label}</Typography>
                                    <Typography numberOfLines={1} className="text-[10px] text-slate-400">{item.desc}</Typography>
                                </View>
                            </View>

                            <Switch
                                value={protectedFeatures[item.id as keyof ProtectedFeatures]}
                                onValueChange={() => handleToggle(item.id as keyof ProtectedFeatures)}
                                trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : '#FFFFFF'}
                                disabled={!isPinEnabled || updateSettingsMutation.isPending}
                            />
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Bottom Insight */}
            <View className="p-8 bg-slate-50 rounded-t-[48px] items-center">
                <View className="w-10 h-1bg-slate-200 rounded-full mb-6" />
                <Typography className="text-slate-400 text-center text-[10px] leading-relaxed">
                    Perubahan akan langsung diterapkan pada navigasi berikutnya.{"\n"}Halaman yang diproteksi tidak akan menampilkan data sebelum PIN dimasukkan.
                </Typography>
            </View>
        </SafeAreaView>
    );
}

