import React, { useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { useUIStore } from '../../store/useUIStore';
import { useTrashList, useRestoreItem, usePermanentDelete, useEmptyTrash } from '../../hooks/useTrash';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';

const CATEGORIES = [
    { id: 'sparepart', label: 'Sparepart', icon: 'wrench' },
    { id: 'customer', label: 'Customer', icon: 'users' },
    { id: 'mobil', label: 'Mobil', icon: 'car' },
    { id: 'armada', label: 'Armada', icon: 'truck' },
    { id: 'supir', label: 'Supir', icon: 'user' },
    { id: 'jasa_servis', label: 'Jasa Servis', icon: 'briefcase' },
    { id: 'karyawan', label: 'Karyawan', icon: 'id-card' },
    { id: 'supplier', label: 'Supplier', icon: 'package' },
];

export default function TrashScreen() {
    const insets = useSafeAreaInsets();
    const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
    const { data: items, isLoading, refetch } = useTrashList(activeCategory);
    const restoreMutation = useRestoreItem();
    const permanentDeleteMutation = usePermanentDelete();
    const emptyTrashMutation = useEmptyTrash();
    
    const [dialogConfig, setDialogConfig] = useState<{
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

    const handleRestore = (item: any) => {
        setDialogConfig({
            visible: true,
            title: 'Kembalikan Data',
            message: `Apakah Anda yakin ingin mengembalikan "${item.nama}"? Data akan muncul kembali di menu utama.`,
            variant: 'info',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await restoreMutation.mutateAsync({ category: activeCategory, id: item.id });
                    setDialogConfig({
                        visible: true,
                        title: 'Sukses',
                        message: 'Data berhasil dikembalikan.',
                        variant: 'success',
                        type: 'alert'
                    });
                } catch (error: any) {
                    appAlert('Error', error.response?.data?.detail || 'Gagal mengembalikan data');
                }
            }
        });
    };

    const handlePermanentDelete = (item: any) => {
        setDialogConfig({
            visible: true,
            title: 'Hapus Permanen',
            message: `PERINGATAN: "${item.nama}" akan dihapus selamanya dari database dan tidak bisa dikembalikan lagi. Lanjutkan?`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await permanentDeleteMutation.mutateAsync({ category: activeCategory, id: item.id });
                    setDialogConfig({
                        visible: true,
                        title: 'Sukses',
                        message: 'Data telah dihapus secara permanen.',
                        variant: 'success',
                        type: 'alert'
                    });
                } catch (error: any) {
                    appAlert('Error', error.response?.data?.detail || 'Gagal menghapus data');
                }
            }
        });
    };

    const handleEmptyTrash = () => {
        if (!items || items.length === 0) return;

        const categoryLabel = CATEGORIES.find(c => c.id === activeCategory)?.label;

        setDialogConfig({
            visible: true,
            title: 'Kosongkan Tempat Sampah',
            message: `PERINGATAN: Semua data "${categoryLabel}" di tempat sampah akan dihapus selamanya. Tindakan ini tidak dapat dibatalkan. Kosongkan sekarang?`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await emptyTrashMutation.mutateAsync(activeCategory);
                    setDialogConfig({
                        visible: true,
                        title: 'Sukses',
                        message: 'Tempat sampah telah dikosongkan.',
                        variant: 'success',
                        type: 'alert'
                    });
                } catch (error: any) {
                    appAlert('Error', error.response?.data?.detail || 'Gagal mengosongkan tempat sampah');
                }
            }
        });
    };

    return (
        <View className="flex-1 bg-background">
            <Header
                title="Sampah"
                subtitle="Data yang baru saja dihapus"
                showBackButton
                showProfile={false}
                showBell={false}
                rightElement={
                    <Pressable
                        onPress={handleEmptyTrash}
                        disabled={!items || items.length === 0 || emptyTrashMutation.isPending}
                        className={`w-12 h-12 rounded-2xl items-center justify-center ${
                            (!items || items.length === 0) ? 'bg-surface opacity-50' : 'bg-red-50'
                        }`}
                    >
                        <Trash2 size={24} color={(!items || items.length === 0) ? "#9CA3AF" : "#EF4444"} />
                    </Pressable>
                }
            >
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="flex-grow-0"
                    contentContainerStyle={{ paddingBottom: 8 }}
                >
                    {CATEGORIES.map((cat) => (
                        <Pressable
                            key={cat.id}
                            onPress={() => setActiveCategory(cat.id)}
                            className={`px-4 py-2.5 rounded-xl mr-2 border ${
                                activeCategory === cat.id
                                ? 'bg-primary border-primary'
                                : 'bg-surface border-gray-100'
                            }`}
                        >
                            <Typography
                                weight="bold"
                                className={`text-xs ${
                                    activeCategory === cat.id ? 'text-white' : 'text-textGray'
                                }`}
                            >
                                {cat.label}
                            </Typography>
                        </Pressable>
                    ))}
                </ScrollView>
            </Header>

            <View className="flex-1 px-6 pt-4">
                {isLoading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color="#023C69" />
                    </View>
                ) : items?.length > 0 ? (
                    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                        {items.map((item: any) => (
                            <Card key={item.id} className="p-4 mb-4 rounded-2xl border border-transparent shadow-none bg-surface">
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1 mr-4">
                                        <Typography variant="caption" weight="bold" className="text-primary mb-0.5">
                                            ID: {item.id} • {item.kode !== '-' ? `KODE: ${item.kode}` : 'Data Master'}
                                        </Typography>
                                        <Typography weight="bold" className="text-textMain text-base mb-1">
                                            {item.nama}
                                        </Typography>
                                        <Typography className="text-[10px] text-textGray italic">
                                            Dihapus: {format(new Date(item.deleted_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                                        </Typography>
                                    </View>
                                    <View className="flex-row">
                                        <Pressable
                                            onPress={() => handleRestore(item)}
                                            className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mr-2"
                                            disabled={restoreMutation.isPending}
                                        >
                                            <RotateCcw size={18} color="#2563EB" />
                                        </Pressable>
                                        <Pressable
                                            onPress={() => handlePermanentDelete(item)}
                                            className="w-10 h-10 bg-red-50 rounded-xl items-center justify-center"
                                            disabled={permanentDeleteMutation.isPending}
                                        >
                                            <Trash2 size={18} color="#EF4444" />
                                        </Pressable>
                                    </View>
                                </View>
                            </Card>
                        ))}
                    </ScrollView>
                ) : (
                    <View className="flex-1 items-center justify-center pt-10">
                        <View className="w-20 h-20 bg-background rounded-full items-center justify-center mb-4">
                            <ShieldCheck size={40} color="#9CA3AF" strokeWidth={1.5} />
                        </View>
                        <Typography weight="bold" className="text-textGray">Tempat Sampah Kosong</Typography>
                        <Typography variant="caption" className="text-textGray mt-1 px-10 text-center">
                            Tidak ada data {CATEGORIES.find(c => c.id === activeCategory)?.label} yang telah dihapus baru-baru ini.
                        </Typography>
                    </View>
                )}
            </View>

            <View className="px-6 py-4" style={{ marginBottom: getCustomTabBarBottomPadding(insets.bottom, 16) }}>
               <View className="p-4 bg-amber-50 rounded-2xl flex-row items-center border border-amber-100">
                    <AlertTriangle size={20} color="#D97706" className="mr-3" />
                    <Typography className="text-amber-800 text-[10px] flex-1 leading-4">
                        Data yang dihapus permanen **tidak dapat dikembalikan**. Hapus permanen hanya bisa dilakukan oleh **Administrator**.
                    </Typography>
                </View>
            </View>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={dialogConfig.onConfirm}
                loading={restoreMutation.isPending || permanentDeleteMutation.isPending || emptyTrashMutation.isPending}
            />
        </View>
    );
}
