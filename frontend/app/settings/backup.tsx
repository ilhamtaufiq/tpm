import React, { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Alert, Platform } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    Database,
    Download,
    Trash2,
    RefreshCw,
    ShieldCheck,
    FileArchive,
    History,
    AlertTriangle,
    CheckCircle2,
    Lock,
    X,
    HardDrive,
    Shield
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useBackupList, useCreateBackup, useDeleteBackup, useRestoreBackup } from '../../hooks/useBackups';
import { backupService, BackupFile } from '../../services/backup';
import { Header } from '../../components/ui/Header';
import { useUIStore } from '../../store/useUIStore';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default function BackupScreen() {
    const { themeColors } = useUIStore();
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null);
    const [restorePassword, setRestorePassword] = useState('');

    const { data: backups, isLoading, refetch } = useBackupList();
    const createMutation = useCreateBackup();
    const deleteMutation = useDeleteBackup();
    const restoreMutation = useRestoreBackup();

    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type?: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handleCreateBackup = async () => {
        try {
            await createMutation.mutateAsync();
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Backup data berhasil dibuat di server.',
                variant: 'success'
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal membuat backup'),
                variant: 'error'
            });
        }
    };

    const handleDeleteBackup = (filename: string) => {
        setDialogConfig({
            visible: true,
            title: 'Hapus Backup',
            message: `Apakah Anda yakin ingin menghapus backup ${filename}?`,
            variant: 'warning',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await deleteMutation.mutateAsync(filename);
                } catch (error) {
                    setDialogConfig({
                        visible: true,
                        title: 'Error',
                        message: getErrorMessage(error, 'Gagal menghapus backup'),
                        variant: 'error'
                    });
                }
            }
        });
    };

    const handleDownload = async (filename: string) => {
        try {
            await backupService.downloadBackup(filename);
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Gagal mendownload file backup.',
                variant: 'error'
            });
        }
    };

    const handleRestoreConfirm = async () => {
        if (!selectedBackup) return;
        if (!restorePassword) {
            Alert.alert('Eits!', 'Harap masukkan password admin untuk melanjutkan.');
            return;
        }

        try {
            setIsRestoring(true);
            await restoreMutation.mutateAsync({ 
                filename: selectedBackup.filename, 
                password: restorePassword 
            });
            setIsRestoring(false);
            setSelectedBackup(null);
            setRestorePassword('');
            
            setDialogConfig({
                visible: true,
                title: 'Sistem Direstore',
                message: 'Data berhasil dikembalikan ke kondisi backup. Aplikasi mungkin perlu dimuat ulang.',
                variant: 'success'
            });
        } catch (error) {
            setIsRestoring(false);
            setDialogConfig({
                visible: true,
                title: 'Gagal Restore',
                message: getErrorMessage(error, 'Terjadi kesalahan saat restore data. Pastikan password benar.'),
                variant: 'error'
            });
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const renderBackupItem = ({ item }: { item: BackupFile }) => (
        <View className="p-6 mb-6 rounded-[32px] bg-white border border-slate-100 shadow-sm shadow-slate-200/50">
            <View className="flex-row items-center mb-5">
                <View className="w-14 h-14 rounded-2xl bg-slate-50 items-center justify-center mr-4 border border-slate-100">
                    <FileArchive size={28} color="#64748B" strokeWidth={1.5} />
                </View>
                <View className="flex-1">
                    <Typography weight="bold" className="text-slate-900 text-sm mb-0.5" numberOfLines={1}>
                        {item.filename}
                    </Typography>
                    <Typography className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">
                        {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm', { locale: idLocale })} • {formatSize(item.size)}
                    </Typography>
                </View>

            </View>

            <View className="flex-row pt-4 border-t border-slate-50 space-x-3">
                <Pressable 
                    onPress={() => handleDownload(item.filename)}
                    className="flex-1 bg-emerald-50 h-11 rounded-xl flex-row items-center justify-center border border-emerald-100 active:bg-emerald-100"
                >
                    <Download size={14} color="#059669" />
                    <Typography weight="bold" className="ml-2 text-emerald-700 text-[10px] uppercase tracking-wider">Download</Typography>
                </Pressable>
                <Pressable 
                    onPress={() => setSelectedBackup(item)}
                    className="flex-1 bg-blue-50 h-11 rounded-xl flex-row items-center justify-center border border-blue-100 active:bg-blue-100"
                >
                    <RefreshCw size={14} color={themeColors.primary} />
                    <Typography weight="bold" className="ml-2 text-primary text-[10px] uppercase tracking-wider">Restore</Typography>
                </Pressable>
                <Pressable 
                    onPress={() => handleDeleteBackup(item.filename)}
                    className="w-11 h-11 bg-rose-50 rounded-xl items-center justify-center border border-rose-100 active:bg-rose-100"
                >
                    <Trash2 size={14} color="#E11D48" />
                </Pressable>
            </View>

        </View>
    );

    return (
        <View className="flex-1 bg-[#F9FAFB]">
            <StatusBar barStyle="light-content" />

            <Header
                title="Backup & Restore"
                subtitle="Data Management"
                showBackButton={true}
                rightElement={
                    <Pressable 
                        onPress={onRefresh} 
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {refreshing ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={24} color="white" />}
                    </Pressable>
                }
            />

            {/* Standard Bento Action Overlay */}
            <View className="px-6 -mt-6 z-10">
                <View className="bg-white p-4 rounded-[32px] shadow-xl border border-gray-50 flex-row items-center">
                    <View className="w-14 h-14 bg-primary/10 rounded-2xl items-center justify-center mr-4">
                        <ShieldCheck size={28} color={themeColors.primary} strokeWidth={2} />
                    </View>
                    <View className="flex-1">
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">System Backup</Typography>
                        <Typography variant="caption" className="text-textGray">Amankan data transaksi & file</Typography>
                    </View>
                    <Pressable 
                        onPress={handleCreateBackup}
                        disabled={createMutation.isPending}
                        className={`px-6 py-4 rounded-2xl shadow-lg shadow-primary/30 flex-row items-center ${createMutation.isPending ? 'bg-primary/50' : 'bg-primary'}`}
                    >
                        {createMutation.isPending ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Database size={16} color="white" className="mr-2" />
                                <Typography weight="bold" className="text-white text-xs ml-2">BACKUP</Typography>
                            </>
                        )}
                    </Pressable>
                </View>
            </View>

            <ScrollView 
                className="flex-1 px-6 pt-10" 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
            >
                {/* Metric Row - Bento Style */}
                <View className="flex-row justify-between mb-8">
                    {[
                        { label: 'BACKUPS', value: backups?.length || 0, color: '#F59E0B', icon: FileArchive },
                        { label: 'STORAGE', value: formatSize(backups?.reduce((acc, curr) => acc + curr.size, 0) || 0), color: '#3B82F6', icon: HardDrive },
                        { label: 'STATUS', value: 'SAFE', color: '#10B981', icon: Shield },
                    ].map((stat) => (
                        <View key={stat.label} style={{ width: '31%' }} className="bg-white p-3 rounded-[32px] border border-gray-100 shadow-sm items-center">
                            <View style={{ backgroundColor: stat.color + '15' }} className="w-10 h-10 rounded-2xl items-center justify-center mb-1.5">
                                <stat.icon size={16} color={stat.color} />
                            </View>
                            <Typography weight="bold" style={{ color: stat.color }} className="text-lg leading-tight uppercase" numberOfLines={1}>
                                {stat.value}
                            </Typography>
                            <Typography className="text-textGray/40 text-[7px] font-bold tracking-widest">{stat.label}</Typography>
                        </View>
                    ))}
                </View>


                {/* History List Header */}
                <View className="flex-row items-center justify-between mb-6">
                    <View>
                        <Typography variant="h3" weight="bold" className="text-textMain tracking-tight">Riwayat Pencadangan</Typography>
                        <Typography variant="caption" className="text-textGray">Manajemen arsip data ZIP/SQL</Typography>
                    </View>
                    <Badge label={`${backups?.length || 0} Files`} variant="neutral" />
                </View>


                {isLoading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator size="large" color={themeColors.primary} />
                        <Typography className="mt-4 text-slate-400 font-medium">Memuat riwayat...</Typography>
                    </View>
                ) : backups && backups.length > 0 ? (
                    backups.map((item) => (
                        <View key={item.filename}>{renderBackupItem({ item })}</View>
                    ))
                ) : (
                    <View className="items-center justify-center p-14 bg-white rounded-[40px] border border-dashed border-slate-200">
                        <View className="w-20 h-20 bg-slate-50 rounded-full items-center justify-center mb-6">
                            <Database size={40} color="#CBD5E1" strokeWidth={1} />
                        </View>
                        <Typography weight="bold" className="text-slate-900 text-lg text-center">Belum ada backup</Typography>
                        <Typography className="mt-2 text-slate-400 text-sm text-center px-6">
                            Data cadangan Anda akan muncul di sini setelah Anda membuat backup pertama.
                        </Typography>
                    </View>
                )}
            </ScrollView>


            {/* Restore Password Modal */}
            {selectedBackup && (
                <View className="absolute inset-0 bg-black/60 items-center justify-center p-6 z-[100]">
                    <Card className="w-full max-w-sm p-8 rounded-[40px] bg-white">
                        <View className="items-center mb-6">
                            <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
                                <AlertTriangle size={32} color="#EF4444" />
                            </View>
                            <Typography variant="h2" weight="bold" className="text-center">Konfirmasi Restore</Typography>
                            <Typography className="text-gray-500 text-center text-xs mt-2">
                                Data saat ini akan digantikan oleh backup:
                            </Typography>
                            <Typography weight="bold" className="text-primary text-xs mt-1">
                                {selectedBackup.filename}
                            </Typography>
                        </View>

                        <View className="mb-6">
                            <View className="flex-row items-center mb-2 ml-1">
                                <Lock size={12} color="#9CA3AF" />
                                <Typography className="text-gray-400 font-bold text-[10px] uppercase ml-1.5">Password Verifikasi</Typography>
                            </View>
                            <TextInput
                                className="bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-textMain font-bold"
                                placeholder="Masukkan password admin..."
                                secureTextEntry
                                value={restorePassword}
                                onChangeText={setRestorePassword}
                                autoFocus
                            />
                        </View>

                        <View className="space-y-3">
                            <Pressable 
                                onPress={handleRestoreConfirm}
                                disabled={isRestoring}
                                className={`h-16 rounded-3xl flex-row items-center justify-center shadow-lg ${isRestoring ? 'bg-red-400' : 'bg-red-500'}`}
                            >
                                {isRestoring ? <ActivityIndicator color="white" /> : (
                                    <>
                                        <RefreshCw size={20} color="white" />
                                        <Typography weight="bold" className="text-white text-base ml-3">Ya, Restore Data</Typography>
                                    </>
                                )}
                            </Pressable>
                            
                            <Pressable 
                                onPress={() => {
                                    setSelectedBackup(null);
                                    setRestorePassword('');
                                }}
                                disabled={isRestoring}
                                className="h-14 rounded-2xl items-center justify-center"
                            >
                                <Typography weight="bold" className="text-slate-400 text-sm">Batalkan</Typography>
                            </Pressable>
                        </View>
                    </Card>
                </View>
            )}

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onConfirm={dialogConfig.onConfirm}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}
