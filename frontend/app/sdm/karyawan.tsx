import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, KeyboardAvoidingView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Search,
    Plus,
    User,
    Phone,
    Mail,
    Briefcase,
    Calendar,
    MoreVertical,
    X,
    FileText,
    RefreshCw,
    Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Platform, Modal } from 'react-native';

import { sdmService, Karyawan, EmployeeStatus } from '../../services/sdm';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { onlineManager } from '@tanstack/react-query';
import { useCreateKaryawan, useUpdateKaryawan } from '../../hooks/useSDM';

const STATUS_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'AKTIF', label: 'Aktif' },
    { key: 'CUTI', label: 'Cuti' },
    { key: 'RESIGN', label: 'Resign' },
];

const getStatusBadge = (status: EmployeeStatus) => {
    const statusMap: Record<EmployeeStatus, { variant: 'success' | 'warning' | 'error' | 'neutral'; label: string }> = {
        'AKTIF': { variant: 'success', label: 'Aktif' },
        'CUTI': { variant: 'warning', label: 'Cuti' },
        'RESIGN': { variant: 'error', label: 'Resign' },
        'TIDAK_AKTIF': { variant: 'neutral', label: 'Tidak Aktif' },
    };
    return statusMap[status] || { variant: 'neutral', label: status };
};

export default function KaryawanScreen() {
    const router = useRouter(); const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState<EmployeeStatus | 'all'>('all');
    const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'form'>('detail');
    const [positions, setPositions] = useState<string[]>([]);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
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

    const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
        visible: boolean;
        karyawan: Karyawan | null;
    }>({
        visible: false,
        karyawan: null
    });


    // Form state
    const [formData, setFormData] = useState({
        nama: '',
        nik: '',
        alamat: '',
        telepon: '',
        email: '',
        jabatan: '',
        gaji_pokok: '',
        tunjangan: '',
        tanggal_lahir: '',
        tanggal_bergabung: '',
        catatan: '',
    });

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/sdm');
        }
    };

    const loadData = useCallback(async () => {
        try {
            const params: any = { limit: 100 };
            if (selectedFilter !== 'all') {
                params.status = selectedFilter;
            }
            if (searchQuery) {
                params.search = searchQuery;
            }
            const response = await sdmService.getKaryawanList(params);
            setKaryawanList(response.data || []);

            const positionsData = await sdmService.getPositions();
            setPositions(positionsData);
        } catch (error) {
            console.error('Failed to load karyawan:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedFilter, searchQuery]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const openDetail = (karyawan: Karyawan) => {
        setSelectedKaryawan(karyawan);
        setViewMode('detail');
        if (Platform.OS === 'web') setIsSheetOpen(true);
        else bottomSheetRef.current?.expand();
    };

    const openAddForm = () => {
        setSelectedKaryawan(null);
        setFormData({
            nama: '',
            nik: '',
            alamat: '',
            telepon: '',
            email: '',
            jabatan: '',
            gaji_pokok: '',
            tunjangan: '',
            tanggal_lahir: '',
            tanggal_bergabung: new Date().toISOString().split('T')[0],
            catatan: '',
        });
        setViewMode('form');
        if (Platform.OS === 'web') setIsSheetOpen(true);
        else bottomSheetRef.current?.expand();
    };

    const openEditForm = (karyawan: Karyawan) => {
        setSelectedKaryawan(karyawan);
        setFormData({
            nama: karyawan.nama,
            nik: karyawan.nik || '',
            alamat: karyawan.alamat || '',
            telepon: karyawan.telepon || '',
            email: karyawan.email || '',
            jabatan: karyawan.jabatan,
            gaji_pokok: formatNumber(karyawan.gaji_pokok.toString()),
            tunjangan: formatNumber(karyawan.tunjangan?.toString() || ''),
            tanggal_lahir: karyawan.tanggal_lahir || '',
            tanggal_bergabung: karyawan.tanggal_bergabung || '',
            catatan: karyawan.catatan || '',
        });
        setViewMode('form');
        if (Platform.OS === 'web') setIsSheetOpen(true);
        else bottomSheetRef.current?.expand();
    };

    const createKaryawanMutation = useCreateKaryawan();
    const updateKaryawanMutation = useUpdateKaryawan();

    const handleSubmit = async () => {
        if (!formData.nama || !formData.jabatan || !formData.gaji_pokok) {
            setDialogConfig({ visible: true, title: 'Error', message: 'Nama, Jabatan, dan Gaji Pokok wajib diisi', variant: 'warning' });
            return;
        }

        try {
            const data: any = {
                nama: formData.nama,
                nik: formData.nik || undefined,
                alamat: formData.alamat || undefined,
                telepon: formData.telepon || undefined,
                email: formData.email || undefined,
                jabatan: formData.jabatan,
                gaji_pokok: parseNumber(formData.gaji_pokok),
                tunjangan: formData.tunjangan ? parseNumber(formData.tunjangan) : 0,
                tanggal_lahir: formData.tanggal_lahir || undefined,
                tanggal_bergabung: formData.tanggal_bergabung,
                catatan: formData.catatan || undefined,
            };

            if (!onlineManager.isOnline()) {
                if (selectedKaryawan) {
                    updateKaryawanMutation.mutate({ id: selectedKaryawan.id, data });
                } else {
                    createKaryawanMutation.mutate({ ...data, status: 'AKTIF' });
                }
                Alert.alert('Offline Mode', `Data ${formData.nama} telah disimpan di antrean offline.`);
                handleCloseSheet();
                return;
            }

            if (selectedKaryawan) {
                await updateKaryawanMutation.mutateAsync({ id: selectedKaryawan.id, data });
                setDialogConfig({ visible: true, title: 'Sukses', message: 'Data karyawan berhasil diupdate', variant: 'success' });
            } else {
                await createKaryawanMutation.mutateAsync({
                    ...data,
                    status: 'AKTIF',
                });
                setDialogConfig({ visible: true, title: 'Sukses', message: 'Karyawan baru berhasil ditambahkan', variant: 'success' });
            }

            handleCloseSheet();
            loadData();
        } catch (error) {
            console.error('Failed to save karyawan:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menyimpan data karyawan'), variant: 'error' });
        }
    };

    const handleCloseSheet = useCallback(() => {
        if (Platform.OS === 'web') setIsSheetOpen(false);
        else bottomSheetRef.current?.close();
    }, []);

    const handleSetStatus = async (status: EmployeeStatus) => {
        if (!selectedKaryawan) return;

        try {
            await sdmService.setKaryawanStatus(selectedKaryawan.id, status);
            setDialogConfig({ visible: true, title: 'Sukses', message: `Status karyawan diubah ke ${status}`, variant: 'success' });
            bottomSheetRef.current?.close();
            loadData();
        } catch (error) {
            console.error('Failed to update status:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal mengubah status karyawan'), variant: 'error' });
        }
    };

    const handleDeleteRequest = (karyawan: Karyawan) => {
        setDeleteConfirmDialog({
            visible: true,
            karyawan: karyawan
        });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmDialog.karyawan) return;

        try {
            await sdmService.deleteKaryawan(deleteConfirmDialog.karyawan.id);
            setDeleteConfirmDialog({ visible: false, karyawan: null });
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: `Karyawan ${deleteConfirmDialog.karyawan.nama} berhasil dihapus`,
                variant: 'success'
            });
            handleCloseSheet();
            loadData();
        } catch (error) {
            console.error('Failed to delete karyawan:', error);
            setDeleteConfirmDialog({ visible: false, karyawan: null });
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal menghapus karyawan'),
                variant: 'error'
            });
        }
    };

    const renderKaryawanItem = ({ item }: { item: Karyawan }) => {
        const statusBadge = getStatusBadge(item.status);
        return (
            <TouchableOpacity onPress={() => openDetail(item)}>
                <View>
                    <Card className="mb-3 p-4 border border-gray-100">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center flex-1">
                                <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mr-3">
                                    <User size={24} color="#16A34A" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center">
                                        <Typography weight="semibold" className="mr-2">{item.nama}</Typography>
                                        <Badge label={statusBadge.label} variant={statusBadge.variant} />
                                    </View>
                                    <Typography variant="caption" className="text-gray-500">{item.jabatan}</Typography>
                                    {item.telepon && (
                                        <Typography variant="caption" className="text-gray-400">{item.telepon}</Typography>
                                    )}
                                </View>
                            </View>
                            <MoreVertical size={20} color="#9CA3AF" />
                        </View>
                    </Card>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-surface items-center justify-center">
                <ActivityIndicator size="large" color="#16A34A" />
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Personalia</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Basis Data Karyawan</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {refreshing ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={22} color="white" />}
                    </TouchableOpacity>
                </View>

                {/* Database Quick Summary (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-5 rounded-[32px] border border-white/10 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center mr-4">
                            <User size={24} color="white" />
                        </View>
                        <View>
                            <Typography variant="body1" weight="bold" className="text-white text-lg tracking-tight">Karyawan Aktif</Typography>
                            <Typography className="text-white/40 text-xs mt-0.5">Total Terdaftar di Bengkel</Typography>
                        </View>
                    </View>
                    <Typography variant="h2" weight="bold" className="text-white text-2xl">{karyawanList.length}</Typography>
                </View>
            </View>

            {/* Filter & Search Navigator Overlay */}
            <View className="px-6 -mt-8 z-10">
                <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50 flex-col">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 p-1">
                        {STATUS_FILTERS.map((filter) => (
                            <TouchableOpacity
                                key={filter.key}
                                onPress={() => setSelectedFilter(filter.key as EmployeeStatus | 'all')}
                                className={`px-5 py-2.5 rounded-2xl mr-2 ${selectedFilter === filter.key ? 'bg-primary border border-white/10 shadow-md shadow-primary/20' : 'bg-gray-50 border border-gray-100'}`}
                            >
                                <View>
                                    <Typography
                                        className={selectedFilter === filter.key ? 'text-white' : 'text-textGray/60'}
                                        variant="caption"
                                        weight="bold"
                                    >
                                        {filter.label}
                                    </Typography>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View className="flex-row items-center px-4 bg-gray-50 h-14 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 text-sm text-textMain font-medium"
                            placeholder="Cari nama karyawan..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>
            </View>

            {/* Karyawan List */}
            <FlatList
                data={karyawanList}
                renderItem={(props: { item: Karyawan }) => {
                    const { item } = props;
                    const statusBadge = getStatusBadge(item.status);
                    return (
                        <TouchableOpacity
                            onPress={() => openDetail(item)}
                            activeOpacity={0.9}
                            className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center"
                        >
                            <View className="w-14 h-14 bg-gray-50 rounded-2xl items-center justify-center mr-4 border border-gray-100/50">
                                <User size={28} color="#023C69" />
                            </View>
                            <View className="flex-1 mr-3">
                                <View className="flex-row items-center mb-1">
                                    <Typography variant="body1" weight="bold" className="text-textMain tracking-tight mr-2" numberOfLines={1}>
                                        {item.nama}
                                    </Typography>
                                    <View className={item.status === 'AKTIF' ? "bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100" : "bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200"}>
                                        <Typography className={item.status === 'AKTIF' ? "text-emerald-600 text-[8px] font-bold" : "text-gray-500 text-[8px] font-bold"}>
                                            {item.status}
                                        </Typography>
                                    </View>
                                </View>
                                <Typography variant="caption" className="text-textGray mb-1">
                                    {item.jabatan}
                                </Typography>
                                <View className="flex-row items-center">
                                    <Phone size={10} color="#9CA3AF" />
                                    <Typography className="text-textGray/60 text-[10px] ml-1.5 font-medium">
                                        {item.telepon || 'No Phone'}
                                    </Typography>
                                </View>
                            </View>
                            <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100">
                                <MoreVertical size={18} color="#D1D5DB" />
                            </View>
                        </TouchableOpacity>
                    );
                }}
                keyExtractor={(item: Karyawan) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                ListEmptyComponent={
                    <View className="items-center py-20">
                        <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-6">
                            <User size={40} color="#D1D5DB" />
                        </View>
                        <Typography className="text-gray-400 font-medium">Tidak ada karyawan ditemukan</Typography>
                    </View>
                }
            />

            {/* Redesigned FAB */}
            <TouchableOpacity
                onPress={openAddForm}
                activeOpacity={0.8}
                className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-[24px] items-center justify-center shadow-2xl elevation-8 border border-white/20"
            >
                <Plus size={32} color="white" strokeWidth={2.5} />
            </TouchableOpacity>

            {/* UI - Platform Specific Bottom Sheets */}
            {Platform.OS === 'web' ? (
                <Modal visible={isSheetOpen} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                    <View className="flex-1 justify-end bg-black/40">
                        <TouchableOpacity className="absolute inset-0" onPress={handleCloseSheet} />
                        <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView className="px-8 flex-1">
                                {viewMode === 'detail' && selectedKaryawan ? renderDetailContent(selectedKaryawan) : renderFormContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    onClose={() => setIsSheetOpen(false)}
                >
                    <BottomSheetScrollView className="px-8">
                        {viewMode === 'detail' && selectedKaryawan ? renderDetailContent(selectedKaryawan) : renderFormContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false } as typeof dialogConfig))}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog
                visible={deleteConfirmDialog.visible}
                title="Konfirmasi Hapus Karyawan"
                message={`Apakah Anda yakin ingin menghapus karyawan ${deleteConfirmDialog.karyawan?.nama || ''}? Data yang sudah dihapus tidak dapat dikembalikan.`}
                variant="error"
                type="confirm"
                confirmText="Hapus"
                cancelText="Batal"
                onConfirm={handleDeleteConfirm}
                onClose={() => setDeleteConfirmDialog({ visible: false, karyawan: null })}
            />
        </View>
    );

    function renderDetailContent(karyawan: Karyawan) {
        return (
            <View className="pb-10">
                <View className="flex-row justify-between items-center mb-10">
                    <View className="flex-row items-center">
                        <View className="w-1 h-6 bg-primary rounded-full mr-3" />
                        <Typography variant="h2" weight="bold" className="text-2xl tracking-tight">Detail Pegawai</Typography>
                    </View>
                    <TouchableOpacity onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <View className="items-center mb-10">
                    <View className="p-1 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
                        <View className="w-24 h-24 bg-primary/10 rounded-full items-center justify-center">
                            <User size={48} color="#023C69" />
                        </View>
                    </View>
                    <Typography variant="h2" weight="bold" className="mt-6 text-xl text-textMain">{karyawan.nama}</Typography>
                    <Typography className="text-textGray mt-1 font-medium">{karyawan.jabatan}</Typography>

                    <View className="flex-row mt-4">
                        <View className={karyawan.status === 'AKTIF' ? "bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100" : "bg-gray-50 px-4 py-1.5 rounded-full border border-gray-100"}>
                            <Typography className={karyawan.status === 'AKTIF' ? "text-emerald-600 font-bold text-[10px] uppercase tracking-widest" : "text-gray-500 font-bold text-[10px] uppercase tracking-widest"}>
                                {karyawan.status}
                            </Typography>
                        </View>
                    </View>
                </View>

                {/* Info Bento Grid */}
                <View className="flex-row flex-wrap justify-between mb-8">
                    <View className="w-[48%] bg-gray-50 p-5 rounded-[32px] mb-4 border border-gray-100/50 shadow-sm">
                        <Typography className="text-textGray/40 text-[9px] font-bold uppercase tracking-widest mb-2">Gaji Pokok</Typography>
                        <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(karyawan.gaji_pokok)}</Typography>
                    </View>
                    <View className="w-[48%] bg-gray-50 p-5 rounded-[32px] mb-4 border border-gray-100/50 shadow-sm">
                        <Typography className="text-textGray/40 text-[9px] font-bold uppercase tracking-widest mb-2">Tunjangan</Typography>
                        <Typography weight="bold" className="text-emerald-600 text-sm">+{formatCurrency(karyawan.tunjangan || 0)}</Typography>
                    </View>
                    <View className="w-full bg-gray-50 p-5 rounded-[32px] border border-gray-100/50 shadow-sm">
                        <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-gray-200/50">
                            <View className="flex-row items-center">
                                <Phone size={16} color="#023C69" />
                                <Typography className="ml-3 text-textMain font-medium text-sm">{karyawan.telepon || '-'}</Typography>
                            </View>
                            <Typography className="text-textGray/40 text-[9px] font-bold uppercase">Telepon</Typography>
                        </View>
                        <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-gray-200/50">
                            <View className="flex-row items-center">
                                <Mail size={16} color="#023C69" />
                                <Typography className="ml-3 text-textMain font-medium text-sm" numberOfLines={1}>{karyawan.email || '-'}</Typography>
                            </View>
                            <Typography className="text-textGray/40 text-[9px] font-bold uppercase">Email</Typography>
                        </View>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <Calendar size={16} color="#023C69" />
                                <Typography className="ml-3 text-textMain font-medium text-sm">{formatDate(karyawan.tanggal_bergabung)}</Typography>
                            </View>
                            <Typography className="text-textGray/40 text-[9px] font-bold uppercase">Bergabung</Typography>
                        </View>
                    </View>
                </View>

                {karyawan.catatan && (
                    <View className="bg-amber-50 p-5 rounded-[32px] border border-amber-100 mb-8">
                        <Typography className="text-amber-700/60 text-[9px] font-bold uppercase tracking-widest mb-2">Catatan Internal</Typography>
                        <Typography className="italic text-amber-900 text-sm leading-relaxed">"{karyawan.catatan}"</Typography>
                    </View>
                )}

                <View className="flex-row space-x-4 mb-4">
                    <TouchableOpacity
                        onPress={() => openEditForm(karyawan)}
                        className="flex-1 bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/20"
                    >
                        <Typography weight="bold" className="text-white">Edit Profil</Typography>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleSetStatus(karyawan.status === 'AKTIF' ? 'TIDAK_AKTIF' : 'AKTIF')}
                        className={`flex-1 ${karyawan.status === 'AKTIF' ? 'bg-rose-50 border border-rose-100' : 'bg-emerald-50 border border-emerald-100'} h-14 rounded-2xl items-center justify-center`}
                    >
                        <Typography weight="bold" className={karyawan.status === 'AKTIF' ? 'text-rose-600' : 'text-emerald-600'}>
                            {karyawan.status === 'AKTIF' ? 'Non-aktifkan' : 'Aktifkan'}
                        </Typography>
                    </TouchableOpacity>
                </View>

                {/* Delete Button */}
                <TouchableOpacity
                    onPress={() => handleDeleteRequest(karyawan)}
                    className="w-full bg-red-50 border border-red-100 h-14 rounded-2xl items-center justify-center flex-row"
                >
                    <Trash2 size={18} color="#DC2626" />
                    <Typography weight="bold" className="text-red-600 ml-2">Hapus Karyawan</Typography>
                </TouchableOpacity>
            </View>
        );
    }

    function renderFormContent() {
        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                className="pb-10"
            >
                <View className="flex-row justify-between items-center mb-10">
                    <View className="flex-row items-center">
                        <View className="w-1 h-6 bg-primary rounded-full mr-3" />
                        <Typography variant="h2" weight="bold" className="text-2xl tracking-tight">
                            {selectedKaryawan ? 'Update Data' : 'Tambah Staff'}
                        </Typography>
                    </View>
                    <TouchableOpacity onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <View className="space-y-6">
                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Lengkap *</Typography>
                        <View className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-4 flex-row items-center">
                            <User size={18} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 text-textMain font-medium"
                                placeholderTextColor="#9CA3AF"
                                placeholder="E.g. Jajang Sukmarat"
                                value={formData.nama}
                                onChangeText={(text: string) => setFormData({ ...formData, nama: text })}
                            />
                        </View>
                    </View>

                    <View className="flex-row justify-between">
                        <View className="w-[48%]">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">NIK</Typography>
                            <TextInput
                                className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-4 text-textMain font-medium"
                                placeholder="16 Digit NIK"
                                placeholderTextColor="#9CA3AF"
                                value={formData.nik}
                                onChangeText={(text: string) => setFormData({ ...formData, nik: text })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View className="w-[48%]">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Telepon</Typography>
                            <TextInput
                                className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-4 text-textMain font-medium"
                                placeholder="08xxxxxxxx"
                                placeholderTextColor="#9CA3AF"
                                value={formData.telepon}
                                onChangeText={(text: string) => setFormData({ ...formData, telepon: text })}
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Jabatan / Peran *</Typography>
                        <TextInput
                            className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-4 text-textMain font-medium"
                            placeholder="E.g. Mekanik Head"
                            placeholderTextColor="#9CA3AF"
                            value={formData.jabatan}
                            onChangeText={(text: string) => setFormData({ ...formData, jabatan: text })}
                        />
                    </View>

                    <View className="flex-row justify-between">
                        <View className="w-[48%]">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Gaji Pokok *</Typography>
                            <TextInput
                                className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-4 text-textMain font-medium"
                                placeholder="Rp 0"
                                placeholderTextColor="#9CA3AF"
                                value={formData.gaji_pokok}
                                onChangeText={(text: string) => setFormData({ ...formData, gaji_pokok: formatNumber(text) })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View className="w-[48%]">
                            <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Tunjangan</Typography>
                            <TextInput
                                className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-4 text-textMain font-medium"
                                placeholder="Rp 0"
                                placeholderTextColor="#9CA3AF"
                                value={formData.tunjangan}
                                onChangeText={(text: string) => setFormData({ ...formData, tunjangan: formatNumber(text) })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Catatan Tambahan</Typography>
                        <TextInput
                            className="bg-gray-50 rounded-[32px] border border-gray-100 px-5 py-4 text-textMain font-medium h-24"
                            placeholder="Keahlian khusus, preferensi shift, dll..."
                            placeholderTextColor="#9CA3AF"
                            value={formData.catatan}
                            onChangeText={(text: string) => setFormData({ ...formData, catatan: text })}
                            multiline
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        className="bg-primary h-16 rounded-2xl items-center justify-center shadow-xl shadow-primary/30 mt-4"
                    >
                        <Typography weight="bold" className="text-white text-lg">
                            {selectedKaryawan ? 'Update Database' : 'Tambahkan Karyawan'}
                        </Typography>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        );
    }
}
