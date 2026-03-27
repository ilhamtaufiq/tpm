import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Platform, Modal } from 'react-native';
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
    MapPin,
    Building2,
    X,
    MoreVertical,
    RefreshCw,
    Filter,
    Truck,
    Trash2,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { masterDataService, Customer } from '../../services/masterData';
import { useCustomerList, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../../hooks/useMasterData';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useUIStore } from '../../store/useUIStore';
import { onlineManager } from '@tanstack/react-query';

const TYPE_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'perorangan', label: 'Perorangan' },
    { key: 'perusahaan', label: 'Perusahaan' },
];

export default function CustomerScreen() {
    const router = useRouter(); const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilter, setSelectedFilter] = useState<string>('all');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'form'>('detail');
    const [refreshing, setRefreshing] = useState(false);
    const { themeColors } = useUIStore();

    // API Hooks
    const { data: listData, isLoading, refetch } = useCustomerList({
        limit: 100,
        tipe: selectedFilter === 'all' ? undefined : selectedFilter,
        search: searchQuery,
    });
    const createMutation = useCreateCustomer();
    const updateMutation = useUpdateCustomer();
    const deleteMutation = useDeleteCustomer();

    const customerList = listData?.data || [];

    // Stats Calculation
    const stats = useMemo(() => {
        const total = customerList.length;
        const perorangan = customerList.filter((c: Customer) => c.tipe === 'perorangan').length;
        const perusahaan = customerList.filter((c: Customer) => c.tipe === 'perusahaan').length;
        return { total, perorangan, perusahaan };
    }, [customerList]);

    // Form state
    const [formData, setFormData] = useState<{
        nama: string;
        tipe: string;
        alamat: string;
        kota: string;
        telepon: string;
        email: string;
        vehicles: { plat_nomor: string; jenis_unit: string; catatan?: string }[];
    }>({
        nama: '',
        tipe: 'perorangan',
        alamat: '',
        kota: '',
        telepon: '',
        email: '',
        vehicles: [],
    });

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

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['85%', '90%'], []);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/master-data');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const [sheetVisible, setSheetVisible] = useState(false);

    const handleOpenSheet = useCallback(() => {
        // Set visible for both platforms
        setSheetVisible(true);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.expand();
        }
    }, []);

    const handleCloseSheet = useCallback(() => {
        setSheetVisible(false);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.close();
        }
    }, []);

    const openDetail = (customer: Customer) => {
        setSelectedCustomer(customer);
        setViewMode('detail');
        handleOpenSheet();
    };

    const openAddForm = () => {
        setSelectedCustomer(null);
        setFormData({
            nama: '',
            tipe: 'perorangan',
            alamat: '',
            kota: '',
            telepon: '',
            email: '',
            vehicles: [],
        });
        setViewMode('form');
        handleOpenSheet();
    };

    const openEditForm = (customer: Customer) => {
        setSelectedCustomer(customer);
        setFormData({
            nama: customer.nama,
            tipe: customer.tipe,
            alamat: customer.alamat || '',
            kota: customer.kota || '',
            telepon: customer.telepon || '',
            email: customer.email || '',
            vehicles: customer.vehicles?.map(v => ({
                plat_nomor: v.plat_nomor,
                jenis_unit: v.jenis_unit,
                catatan: v.catatan || '',
            })) || [],
        });
        setViewMode('form');
        handleOpenSheet();
    };

    const handleSubmit = async () => {
        if (!formData.nama) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Nama customer wajib diisi', variant: 'warning' });
            return;
        }

        // Validate vehicles
        for (const v of formData.vehicles) {
            if (!v.plat_nomor || !v.jenis_unit) {
                setDialogConfig({ visible: true, title: 'Validasi', message: 'Plat Nomor dan Jenis Unit kendaraan wajib diisi', variant: 'warning' });
                return;
            }
        }

        try {
            if (!onlineManager.isOnline()) {
                if (selectedCustomer) {
                    updateMutation.mutate({ id: selectedCustomer.id, data: formData });
                } else {
                    createMutation.mutate(formData);
                }
                setDialogConfig({ visible: true, title: 'Offline Mode', message: 'Data customer telah disimpan di antrean offline.', variant: 'info' });
                handleCloseSheet();
                return;
            }

            if (selectedCustomer) {
                await updateMutation.mutateAsync({ id: selectedCustomer.id, data: formData });
                setDialogConfig({ visible: true, title: 'Sukses', message: 'Customer berhasil diupdate', variant: 'success' });
            } else {
                await createMutation.mutateAsync(formData);
                setDialogConfig({ visible: true, title: 'Sukses', message: 'Customer baru berhasil ditambahkan', variant: 'success' });
            }
            handleCloseSheet();
        } catch (error) {
            console.error('Failed to save customer:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menyimpan customer'), variant: 'error' });
        }
    };

    const addVehicle = () => {
        setFormData({
            ...formData,
            vehicles: [...formData.vehicles, { plat_nomor: '', jenis_unit: '', catatan: '' }]
        });
    };

    const removeVehicle = (index: number) => {
        const newVehicles = [...formData.vehicles];
        newVehicles.splice(index, 1);
        setFormData({ ...formData, vehicles: newVehicles });
    };

    const updateVehicle = (index: number, field: string, value: string) => {
        const newVehicles = [...formData.vehicles];
        newVehicles[index] = { ...newVehicles[index], [field]: value };
        setFormData({ ...formData, vehicles: newVehicles });
    };

    const handleDelete = async () => {
        if (!selectedCustomer) return;

        setDialogConfig({
            visible: true,
            title: 'Hapus Customer',
            message: `Yakin ingin menghapus ${selectedCustomer.nama}?`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    if (!onlineManager.isOnline()) {
                        deleteMutation.mutate(selectedCustomer.id);
                        setDialogConfig({ visible: true, title: 'Offline Mode', message: 'Customer telah dijadwalkan untuk dihapus saat online.', variant: 'info' });
                        handleCloseSheet();
                        return;
                    }

                    await deleteMutation.mutateAsync(selectedCustomer.id);
                    setDialogConfig({ visible: true, title: 'Sukses', message: 'Customer berhasil dihapus', variant: 'success' });
                    handleCloseSheet();
                } catch (error) {
                    console.error('Failed to delete:', error);
                    setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menghapus customer'), variant: 'error' });
                }
            }
        });
    };

    const renderCustomerItem = ({ item }: { item: Customer }) => (
        <Pressable onPress={() => openDetail(item)}>
            <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                <View className={`w-16 h-16 rounded-[20px] items-center justify-center mr-4 ${item.tipe === 'perusahaan' ? 'bg-blue-50 border border-blue-100/50' : 'bg-emerald-50 border border-emerald-100/50'}`}>
                    {item.tipe === 'perusahaan' ? (
                        <Building2 size={32} color="#3B82F6" />
                    ) : (
                        <User size={32} color="#10B981" />
                    )}
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-1">
                        <Typography variant="body1" weight="bold" className="text-textMain text-lg">{item.nama}</Typography>
                        <View className={`px-2 py-1 rounded-lg ${item.tipe === 'perusahaan' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                            <Typography className={`${item.tipe === 'perusahaan' ? 'text-blue-600' : 'text-emerald-600'} text-[10px] font-bold uppercase`}>
                                {item.tipe}
                            </Typography>
                        </View>
                    </View>

                    <Typography className="text-textGray text-xs">{item.kota || 'Tidak ada lokasi'}</Typography>

                    {item.telepon && (
                        <View className="flex-row items-center mt-2 pt-2 border-t border-gray-50">
                            <Phone size={12} color="#9CA3AF" />
                            <Typography variant="caption" className="text-gray-500 ml-1.5">{item.telepon}</Typography>
                        </View>
                    )}
                </View>
                <View className="ml-2 w-8 h-8 rounded-full bg-gray-50 items-center justify-center">
                    <MoreVertical size={16} color="#9CA3AF" />
                </View>
            </View>
        </Pressable>
    );

    const renderSheetContent = () => {
        if (viewMode === 'detail' && selectedCustomer) {
            return (
                <View className="p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Typography variant="h2" weight="bold">Detail Customer</Typography>
                        <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                            <X size={20} color="#6B7280" />
                        </Pressable>
                    </View>

                    <View className="items-center mb-8">
                        <View className={`w-24 h-24 rounded-[32px] items-center justify-center mb-4 ${selectedCustomer.tipe === 'perusahaan' ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                            {selectedCustomer.tipe === 'perusahaan' ? (
                                <Building2 size={48} color="#3B82F6" />
                            ) : (
                                <User size={48} color="#10B981" />
                            )}
                        </View>
                        <Typography variant="h2" weight="bold" className="text-center mb-1">{selectedCustomer.nama}</Typography>
                        <Badge
                            label={selectedCustomer.tipe === 'perusahaan' ? 'Perusahaan' : 'Perorangan'}
                            variant={selectedCustomer.tipe === 'perusahaan' ? 'info' : 'success'}
                        />
                    </View>

                    <Card className="p-5 mb-6 border border-gray-100 rounded-[24px]">
                        <Typography variant="h3" weight="bold" className="mb-4 text-base">Informasi Kontak</Typography>

                        {selectedCustomer.telepon && (
                            <View className="flex-row items-center mb-4 bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <Phone size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Telepon</Typography>
                                    <Typography weight="semibold">{selectedCustomer.telepon}</Typography>
                                </View>
                            </View>
                        )}

                        {selectedCustomer.email && (
                            <View className="flex-row items-center mb-4 bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <Mail size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Email</Typography>
                                    <Typography weight="semibold">{selectedCustomer.email}</Typography>
                                </View>
                            </View>
                        )}

                        {(selectedCustomer.alamat || selectedCustomer.kota) && (
                            <View className="flex-row items-center bg-gray-50 p-3 rounded-2xl">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                    <MapPin size={20} color="#6B7280" />
                                </View>
                                <View className="flex-1">
                                    <Typography className="text-xs text-gray-400 font-bold uppercase">Alamat</Typography>
                                    <Typography weight="semibold" className="flex-wrap">
                                        {selectedCustomer.alamat ? `${selectedCustomer.alamat}, ` : ''}{selectedCustomer.kota}
                                    </Typography>
                                </View>
                            </View>
                        )}
                    </Card>

                    {selectedCustomer.vehicles && selectedCustomer.vehicles.length > 0 && (
                        <Card className="p-5 mb-6 border border-gray-100 rounded-[24px]">
                            <Typography variant="h3" weight="bold" className="mb-4 text-base">Data Kendaraan</Typography>
                            {selectedCustomer.vehicles.map((vehicle, index) => (
                                <View key={index} className={`flex-row items-center p-3 rounded-2xl bg-gray-50 ${index !== 0 ? 'mt-3' : ''}`}>
                                    <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                                        <Truck size={20} color="#6B7280" />
                                    </View>
                                    <View className="flex-1">
                                        <Typography weight="bold" className="text-primary">{vehicle.plat_nomor}</Typography>
                                        <Typography variant="caption" className="text-gray-500 uppercase font-bold">{vehicle.jenis_unit}</Typography>
                                        {vehicle.catatan && (
                                            <Typography variant="caption" className="text-gray-400 italic mt-0.5">{vehicle.catatan}</Typography>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </Card>
                    )}

                    <View className="flex-row space-x-3">
                        <Button
                            title="Edit"
                            onPress={() => openEditForm(selectedCustomer)}
                            variant="outline"
                            className="flex-1"
                        />
                        <Button
                            title="Hapus"
                            onPress={handleDelete}
                            variant="danger"
                            className="flex-1"
                        />
                    </View>
                </View>
            );
        }

        return (
            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Typography variant="h2" weight="bold">
                        {selectedCustomer ? 'Edit Customer' : 'Tambah Customer'}
                    </Typography>
                    <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </Pressable>
                </View>

                <View className="space-y-4">
                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Customer *</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="Contoh: Budi Santoso"
                            placeholderTextColor="#9CA3AF"
                            value={formData.nama}
                            onChangeText={(text) => setFormData({ ...formData, nama: text })}
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Tipe Entitas</Typography>
                        <View className="flex-row space-x-2">
                            {['perorangan', 'perusahaan'].map((tipe) => (
                                <Pressable
                                    key={tipe}
                                    onPress={() => setFormData({ ...formData, tipe })}
                                    className={`flex-1 py-3.5 rounded-2xl border ${formData.tipe === tipe ? 'bg-primary border-primary' : 'bg-white border-gray-100'}`}
                                >
                                    <Typography
                                        className={`text-center font-bold text-sm ${formData.tipe === tipe ? 'text-white' : 'text-gray-500'}`}
                                    >
                                        {tipe === 'perusahaan' ? 'Perusahaan' : 'Perorangan'}
                                    </Typography>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Telepon</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="08xxxxxxxxxx"
                            placeholderTextColor="#9CA3AF"
                            value={formData.telepon}
                            onChangeText={(text) => setFormData({ ...formData, telepon: text })}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Email (Opsional)</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="email@example.com"
                            placeholderTextColor="#9CA3AF"
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            keyboardType="email-address"
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Kota</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="Contoh: Jakarta Selatan"
                            placeholderTextColor="#9CA3AF"
                            value={formData.kota}
                            onChangeText={(text) => setFormData({ ...formData, kota: text })}
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Alamat Lengkap</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 min-h-[100px]"
                            placeholder="Masukan alamat lengkap..."
                            placeholderTextColor="#9CA3AF"
                            value={formData.alamat}
                            onChangeText={(text) => setFormData({ ...formData, alamat: text })}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Vehicle Management Section */}
                    <View className="pt-4 border-t border-gray-100">
                        <View className="flex-row justify-between items-center mb-4">
                            <Typography weight="bold" className="text-base">Daftar Kendaraan</Typography>
                                <Pressable
                                    onPress={addVehicle}
                                    style={{ backgroundColor: `${themeColors.primary}15` }}
                                    className="flex-row items-center px-3 py-2 rounded-xl"
                                >
                                    <Plus size={16} color={themeColors.primary} />
                                    <Typography style={{ color: themeColors.primary }} className="font-bold text-xs ml-1">Tambah</Typography>
                                </Pressable>
                        </View>

                        {formData.vehicles.map((vehicle, index) => (
                            <View key={index} className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
                                <View className="flex-row justify-between items-center mb-3">
                                    <Typography className="text-[10px] font-bold text-gray-400 uppercase">Kendaraan #{index + 1}</Typography>
                                    <Pressable onPress={() => removeVehicle(index)}>
                                        <Trash2 size={16} color="#EF4444" />
                                    </Pressable>
                                </View>
                                <View className="space-y-3">
                                    <View>
                                        <Typography className="mb-1.5 text-textGray font-bold text-[9px] uppercase tracking-wider ml-1">Plat Nomor</Typography>
                                        <TextInput
                                            className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-textMain font-medium focus:border-primary"
                                            placeholder="Contoh: B 1234 ABC"
                                            placeholderTextColor="#9CA3AF"
                                            value={vehicle.plat_nomor}
                                            onChangeText={(text) => updateVehicle(index, 'plat_nomor', text)}
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                    <View>
                                        <Typography className="mb-1.5 text-textGray font-bold text-[9px] uppercase tracking-wider ml-1">Jenis Unit</Typography>
                                        <TextInput
                                            className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-textMain font-medium focus:border-primary"
                                            placeholder="Contoh: Toyota Avanza"
                                            placeholderTextColor="#9CA3AF"
                                            value={vehicle.jenis_unit}
                                            onChangeText={(text) => updateVehicle(index, 'jenis_unit', text)}
                                        />
                                    </View>
                                    <View>
                                        <Typography className="mb-1.5 text-textGray font-bold text-[9px] uppercase tracking-wider ml-1">Catatan (Opsional)</Typography>
                                        <TextInput
                                            className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-textMain font-medium focus:border-primary"
                                            placeholder="Warna, tahun, dll..."
                                            placeholderTextColor="#9CA3AF"
                                            value={vehicle.catatan}
                                            onChangeText={(text) => updateVehicle(index, 'catatan', text)}
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}

                        {formData.vehicles.length === 0 && (
                            <View className="items-center py-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <Truck size={32} color="#D1D5DB" />
                                <Typography className="text-gray-400 mt-2 text-xs">Belum ada data kendaraan</Typography>
                            </View>
                        )}
                    </View>

                    <Button
                        title={selectedCustomer ? (updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan') : (createMutation.isPending ? 'Menambahkan...' : 'Tambah Customer')}
                        onPress={handleSubmit}
                        disabled={updateMutation.isPending || createMutation.isPending}
                        loading={updateMutation.isPending || createMutation.isPending}
                        className="mt-4 shadow-lg shadow-primary/30"
                        size="lg"
                    />
                </View>
            </View>
        );
    };


    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
            <View className="bg-primary pt-14 pb-20 px-6 rounded-b-[48px] shadow-2xl z-0">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Customer</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Database Pelanggan</Typography>
                        </View>
                    </View>
                    <Pressable
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {refreshing ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={22} color="white" />}
                    </Pressable>
                </View>

                {/* Dashboard Stats (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <View className="bg-white/20 p-2 rounded-xl mr-3">
                                <User size={16} color="white" />
                            </View>
                            <Typography className="text-white/90 text-sm font-bold">Total Pelanggan</Typography>
                        </View>
                        <Typography variant="h2" weight="bold" className="text-white text-3xl tracking-tight">{stats.total}</Typography>
                    </View>

                    <View className="flex-row space-x-3">
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Perorangan</Typography>
                            <Typography className="text-emerald-300 font-bold text-lg">{stats.perorangan}</Typography>
                        </View>
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Perusahaan</Typography>
                            <Typography className="text-blue-300 font-bold text-lg">{stats.perusahaan}</Typography>
                        </View>
                    </View>
                </View>
            </View>

            {/* Floating Search & Filter Overlay - Hide when form is open */}
            {!sheetVisible && (
                <View className="px-6 -mt-10 z-10 mb-2">
                    <View className="bg-white p-2 rounded-[24px] shadow-xl flex-row items-center border border-gray-50">
                        <View className="flex-1 flex-row items-center px-4 bg-gray-50 h-12 rounded-2xl border border-gray-100">
                            <Search size={18} color="#9CA3AF" />
                            <TextInput
                                placeholder="Cari nama atau telepon..."
                                className="flex-1 ml-3 text-sm font-medium text-textMain"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>
                    </View>

                    {/* Filter Chips */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4" contentContainerStyle={{ paddingRight: 20 }}>
                        {TYPE_FILTERS.map((filter) => (
                            <Pressable
                                key={filter.key}
                                onPress={() => setSelectedFilter(filter.key)}
                                className={`mr-3 px-5 py-2.5 rounded-2xl border ${selectedFilter === filter.key ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-white border-gray-100'}`}
                            >
                                <Typography
                                    className={selectedFilter === filter.key ? 'text-white' : 'text-gray-500'}
                                    weight={selectedFilter === filter.key ? 'bold' : 'medium'}
                                    variant="caption"
                                >
                                    {filter.label}
                                </Typography>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* List */}
            <FlatList
                data={customerList}
                renderItem={renderCustomerItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
                ListHeaderComponent={
                    isLoading ? (
                        <View className="mt-4">
                            <SkeletonCard />
                            <SkeletonCard />
                            <SkeletonCard />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    isLoading ? null : (
                        <View className="mt-10">
                            <EmptyState
                                title="Tidak Ada Customer"
                                description={searchQuery ? `Tidak ditemukan customer dengan keyword "${searchQuery}"` : "Belum ada daftar customer."}
                                icon={User}
                            />
                        </View>
                    )
                }
            />

            {/* FAB */}
            <Pressable
                onPress={openAddForm}
                className="absolute bottom-10 right-6 w-16 h-16 bg-primary rounded-full items-center justify-center shadow-2xl shadow-primary/40 border-4 border-white/20"
                activeOpacity={0.8}
            >
                <Plus size={32} color="white" />
            </Pressable>

            {/* UI - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal
                    visible={sheetVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCloseSheet}
                >
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <Pressable
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            onPress={handleCloseSheet}
                            activeOpacity={1}
                        />
                        <View
                            className="bg-white rounded-t-[32px] shadow-2xl h-[90%]"
                            style={{
                                width: '100%',
                                maxWidth: 640,
                                alignSelf: 'center',
                            }}
                        >
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-4" />
                            <ScrollView className="flex-1">
                                {renderSheetContent()}
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
                    backgroundStyle={{ borderRadius: 32, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48 }}
                    onChange={(index) => setSheetVisible(index !== -1)}
                    onClose={() => setSheetVisible(false)}
                >
                    <BottomSheetScrollView>
                        {renderSheetContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
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
