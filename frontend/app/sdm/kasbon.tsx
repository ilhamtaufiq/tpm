import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Plus,
    Wallet,
    User,
    Calendar,
    Check,
    X,
    AlertTriangle,
    RefreshCw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { sdmService, Kasbon, KasbonSummary, PaymentStatus, Karyawan } from '../../services/sdm';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';

const STATUS_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'BELUM_LUNAS', label: 'Belum Lunas' },
    { key: 'LUNAS', label: 'Lunas' },
];

export default function KasbonScreen() {
    const router = useRouter(); const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [kasbonList, setKasbonList] = useState<Kasbon[]>([]);
    const [summary, setSummary] = useState<KasbonSummary | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<PaymentStatus | 'all'>('all');
    const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);

    // Form state
    const [formData, setFormData] = useState({
        karyawan_id: 0,
        karyawan_nama: '',
        jumlah: '',
        metode_bayar: 'tunai',
        keterangan: '',
    });
    const [showKaryawanPicker, setShowKaryawanPicker] = useState(false);
    const [sheetIndex, setSheetIndex] = useState(-1);
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
    const snapPoints = useMemo(() => ['60%', '80%'], []);

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
            const [listRes, summaryRes, karyawanRes] = await Promise.all([
                sdmService.getKasbonList(params),
                sdmService.getKasbonSummary(),
                sdmService.getActiveKaryawan(),
            ]);
            setKasbonList(listRes.data || []);
            setSummary(summaryRes);
            setKaryawanList(karyawanRes);
        } catch (error) {
            console.error('Failed to load kasbon:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const openAddForm = () => {
        setFormData({ karyawan_id: 0, karyawan_nama: '', jumlah: '', metode_bayar: 'tunai', keterangan: '' });
        bottomSheetRef.current?.expand();
    };

    const handleSubmit = async () => {
        if (!formData.karyawan_id || !formData.jumlah) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Karyawan dan Jumlah wajib diisi', variant: 'warning' });
            return;
        }

        try {
            await sdmService.createKasbon({
                karyawan_id: formData.karyawan_id,
                tanggal: new Date().toISOString().split('T')[0],
                nominal: parseNumber(formData.jumlah),
                metode_bayar: formData.metode_bayar,
                keterangan: formData.keterangan || undefined,
            });
            setDialogConfig({ visible: true, title: 'Sukses', message: 'Kasbon berhasil ditambahkan', variant: 'success' });
            bottomSheetRef.current?.close();
            loadData();
        } catch (error) {
            console.error('Failed to create kasbon:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menambahkan kasbon'), variant: 'error' });
        }
    };

    const handleMarkPaid = async (kasbon: Kasbon) => {
        setDialogConfig({
            visible: true,
            title: 'Konfirmasi',
            message: `Tandai kasbon ${kasbon.karyawan_nama} sebesar ${formatCurrency(kasbon.nominal)} sebagai LUNAS?`,
            variant: 'info',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await sdmService.markKasbonPaid(kasbon.id);
                    setDialogConfig({ visible: true, title: 'Sukses', message: 'Kasbon berhasil dilunaskan', variant: 'success' });
                    loadData();
                } catch (error) {
                    console.error('Failed to mark paid:', error);
                    setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal melunaskan kasbon'), variant: 'error' });
                }
            }
        });
    };

    const renderKasbonItem = ({ item }: { item: Kasbon }) => {
        const isLunas = item.status?.toUpperCase() === 'LUNAS';
        return (
            <Card className="mb-3 p-4 border border-gray-100">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isLunas ? 'bg-green-100' : 'bg-amber-100'}`}>
                            <Wallet size={20} color={isLunas ? '#16A34A' : '#F59E0B'} />
                        </View>
                        <View className="flex-1">
                            <Typography weight="semibold">{item.karyawan_nama}</Typography>
                            <Typography variant="caption" className="text-gray-500">
                                {formatDate(item.tanggal)}
                            </Typography>
                            {item.keterangan && (
                                <Typography variant="caption" className="text-gray-400">
                                    {item.keterangan}
                                </Typography>
                            )}
                        </View>
                    </View>
                    <View className="items-end">
                        <Typography weight="bold" className={isLunas ? 'text-green-600' : 'text-amber-600'}>
                            {formatCurrency(item.nominal)}
                        </Typography>
                        <Badge
                            label={isLunas ? 'Lunas' : 'Belum Lunas'}
                            variant={isLunas ? 'success' : 'warning'}
                        />
                        {!isLunas && (
                            <TouchableOpacity
                                onPress={() => handleMarkPaid(item)}
                                className="mt-2 bg-green-500 px-3 py-1 rounded-lg"
                            >
                                <Typography className="text-white text-xs">Lunaskan</Typography>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Card>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-surface items-center justify-center">
                <ActivityIndicator size="large" color="#00AA13" />
            </View>
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
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Kasbon</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Manajemen Pinjaman Staff</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {refreshing ? <ActivityIndicator size="small" color="white" /> : <RefreshCw size={22} color="white" />}
                    </TouchableOpacity>
                </View>

                {/* Outstanding Kasbon Summary (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-rose-500/20 rounded-xl items-center justify-center mr-3">
                                <AlertTriangle size={20} color="#FDA4AF" />
                            </View>
                            <Typography className="text-white/60 text-xs font-bold uppercase tracking-widest">Pinjaman Berjalan</Typography>
                        </View>
                        <View className="bg-white/10 px-3 py-1 rounded-full border border-white/5">
                            <Typography className="text-white/80 text-[10px] font-bold">{summary?.count_belum_lunas || 0} Trx</Typography>
                        </View>
                    </View>

                    <Typography variant="h1" weight="bold" className="text-white text-3xl mb-1 tracking-tight">
                        {loading ? '...' : formatCurrency(summary?.total_belum_lunas || 0)}
                    </Typography>
                    <Typography className="text-white/30 text-[10px] font-medium">Hutang yang belum dilunasi karyawan</Typography>
                </View>
            </View>

            {/* Filter Navigator Overlay */}
            <View className="px-6 -mt-8 z-10">
                <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="p-1">
                        {STATUS_FILTERS.map((filter) => (
                            <TouchableOpacity
                                key={filter.key}
                                onPress={() => setSelectedFilter(filter.key as PaymentStatus | 'all')}
                                className={`px-6 py-3 rounded-2xl mr-2 ${selectedFilter === filter.key ? 'bg-primary border border-white/10 shadow-md shadow-primary/20' : 'bg-transparent'}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight="bold"
                                    className={selectedFilter === filter.key ? 'text-white' : 'text-textGray/60'}
                                >
                                    {filter.label}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Kasbon List */}
            <FlatList
                data={kasbonList}
                renderItem={(props) => {
                    const { item } = props;
                    const isLunas = item.status?.toUpperCase() === 'LUNAS';
                    return (
                        <View className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm">
                            <View className="flex-row items-center justify-between mb-4">
                                <View className="flex-row items-center flex-1">
                                    <View className={`w-12 h-12 ${isLunas ? 'bg-emerald-50' : 'bg-amber-50'} rounded-2xl items-center justify-center mr-4 border ${isLunas ? 'border-emerald-100/50' : 'border-amber-100/50'}`}>
                                        <Wallet size={24} color={isLunas ? '#10B981' : '#F59E0B'} />
                                    </View>
                                    <View className="flex-1">
                                        <Typography variant="body1" weight="bold" className="text-textMain tracking-tight" numberOfLines={1}>
                                            {item.karyawan_nama}
                                        </Typography>
                                        <Typography className="text-textGray/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                            {formatDate(item.tanggal)}
                                        </Typography>
                                    </View>
                                </View>
                                <View className="items-end">
                                    <Typography variant="body1" weight="bold" className={isLunas ? 'text-emerald-600' : 'text-amber-600'}>
                                        {formatCurrency(item.nominal)}
                                    </Typography>
                                    <View className={isLunas ? "bg-emerald-50 px-2 py-0.5 rounded-lg mt-1" : "bg-amber-50 px-2 py-0.5 rounded-lg mt-1"}>
                                        <Typography className={isLunas ? "text-emerald-600 text-[8px] font-bold" : "text-amber-600 text-[8px] font-bold"}>
                                            {isLunas ? 'LUNAS' : 'OUTSTANDING'}
                                        </Typography>
                                    </View>
                                </View>
                            </View>

                            {item.keterangan && (
                                <View className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-4">
                                    <Typography className="text-textGray italic text-xs leading-relaxed">"{item.keterangan}"</Typography>
                                </View>
                            )}

                            {!isLunas && (
                                <TouchableOpacity
                                    onPress={() => handleMarkPaid(item)}
                                    className="bg-emerald-50 border border-emerald-100 h-12 rounded-2xl items-center justify-center flex-row"
                                >
                                    <Check size={16} color="#059669" className="mr-2" />
                                    <Typography weight="bold" className="text-emerald-700 text-xs">Konfirmasi Pelunasan</Typography>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                }}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AA13" />}
                ListEmptyComponent={
                    <View className="items-center py-20">
                        <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-6">
                            <Wallet size={40} color="#D1D5DB" />
                        </View>
                        <Typography className="text-gray-400 font-medium">Tidak ada kasbon ditemukan</Typography>
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

            {/* Bottom Sheet UI */}
            {Platform.OS === 'web' ? (
                <Modal visible={sheetIndex !== -1} transparent animationType="slide" onRequestClose={() => setSheetIndex(-1)}>
                    <View className="flex-1 justify-end bg-black/40">
                        <TouchableOpacity className="absolute inset-0" onPress={() => setSheetIndex(-1)} />
                        <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[80%] self-center p-0 overflow-hidden shadow-2xl relative">
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                            <ScrollView className="px-8 flex-1">
                                {renderFormContent()}
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
                >
                    <BottomSheetScrollView className="px-8">
                        {renderFormContent()}
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

    function renderFormContent() {
        return (
            <View className="pb-10">
                <View className="flex-row justify-between items-center mb-10">
                    <View className="flex-row items-center">
                        <View className="w-1 h-6 bg-primary rounded-full mr-3" />
                        <Typography variant="h2" weight="bold" className="text-2xl tracking-tight">Voucher Kasbon</Typography>
                    </View>
                    <TouchableOpacity onPress={() => Platform.OS === 'web' ? setSheetIndex(-1) : bottomSheetRef.current?.close()} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <View className="space-y-6">
                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Karyawan Penerima *</Typography>
                        <TouchableOpacity
                            onPress={() => setShowKaryawanPicker(!showKaryawanPicker)}
                            className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center">
                                <User size={18} color={formData.karyawan_nama ? "#00AA13" : "#9CA3AF"} />
                                <Typography className={`ml-3 font-medium ${formData.karyawan_nama ? 'text-textMain' : 'text-textGray/40'}`}>
                                    {formData.karyawan_nama || 'Pilih Karyawan'}
                                </Typography>
                            </View>
                            <ChevronLeft size={18} color="#9CA3AF" style={{ transform: [{ rotate: showKaryawanPicker ? '90deg' : '270deg' }] }} />
                        </TouchableOpacity>

                        {showKaryawanPicker && (
                            <View className="mt-2 bg-white border border-gray-100 rounded-2xl shadow-lg max-h-48 overflow-hidden">
                                <ScrollView nestedScrollEnabled>
                                    {karyawanList.map((k) => (
                                        <TouchableOpacity
                                            key={k.id}
                                            onPress={() => {
                                                setFormData({ ...formData, karyawan_id: k.id, karyawan_nama: k.nama });
                                                setShowKaryawanPicker(false);
                                            }}
                                            className="px-5 py-4 border-b border-gray-50 flex-row items-center"
                                        >
                                            <View className="w-8 h-8 bg-primary/5 rounded-full items-center justify-center mr-3">
                                                <Typography className="text-primary font-bold text-[10px]">{k.nama.charAt(0)}</Typography>
                                            </View>
                                            <View>
                                                <Typography weight="bold" className="text-textMain text-sm">{k.nama}</Typography>
                                                <Typography className="text-textGray text-[9px] uppercase tracking-tighter">{k.jabatan}</Typography>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nominal Pinjaman *</Typography>
                        <View className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 flex-row items-center">
                            <Typography className="text-textGray font-bold mr-2 text-lg">Rp</Typography>
                            <TextInput
                                className="flex-1 text-textMain font-bold text-lg"
                                placeholder="0"
                                placeholderTextColor="#9CA3AF"
                                value={formData.jumlah}
                                onChangeText={(text) => setFormData({ ...formData, jumlah: formatNumber(text) })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Sumber Dana *</Typography>
                        <View className="flex-row space-x-3">
                            {['tunai', 'transfer'].map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => setFormData({ ...formData, metode_bayar: m })}
                                    className={`flex-1 py-4 items-center rounded-2xl border ${formData.metode_bayar === m ? 'border-primary bg-primary shadow-lg shadow-primary/20' : 'border-gray-200 bg-white'}`}
                                >
                                    <Typography
                                        className={formData.metode_bayar === m ? 'text-white' : 'text-textGray'}
                                        weight="bold"
                                    >
                                        {m.toUpperCase()}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Alasan / Keterangan</Typography>
                        <TextInput
                            className="bg-gray-50 rounded-[32px] border border-gray-100 px-6 py-4 text-textMain font-medium h-24"
                            placeholder="Tulis alasan kasbon..."
                            placeholderTextColor="#9CA3AF"
                            value={formData.keterangan}
                            onChangeText={(text) => setFormData({ ...formData, keterangan: text })}
                            multiline
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        className="bg-primary h-16 rounded-2xl items-center justify-center shadow-xl shadow-primary/30 mt-4"
                    >
                        <Typography weight="bold" className="text-white text-lg">Konfirmasi Pinjaman</Typography>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }
}
