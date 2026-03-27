import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StatusBar, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
    ChevronLeft,
    Receipt,
    Plus,
    X,
    Wallet,
    ArrowRightLeft,
    Wrench,
    Package,
    Info,
    Calendar,
    TrendingDown,
    Search,
    Split,
    Trash2,
    Truck,
    Car,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePengeluaranList, useCreatePengeluaran, usePengeluaranSummary } from '../../../hooks/useBengkel';
import { onlineManager } from '@tanstack/react-query';
import { formatNumber, parseNumber, formatCurrency, formatDate } from '../../../utils/format';
import { ArmadaSelector } from '../../../components/ui/ArmadaSelector';
import { MobilSelector } from '../../../components/ui/MobilSelector';

const CATEGORIES = [
    { label: 'Prive', value: 'PRIVE', icon: Wallet, color: '#F59E0B' },
    { label: 'Biaya Operasional', value: 'BIAYA_OPERASIONAL', icon: Wrench, color: '#023C69' },
    { label: 'Biaya Lainnya', value: 'BIAYA_LAINNYA', icon: Info, color: '#6B7280' },
];

const BISNIS_KATEGORI = [
    { label: 'Umum', value: 'umum', icon: Info, color: '#6B7280' },
    { label: 'Jasa Angkut', value: 'jasa_angkut', icon: Truck, color: '#10B981' },
    { label: 'Jual Beli Mobil', value: 'jual_beli_mobil', icon: Car, color: '#3B82F6' },
];

export default function ExpensesScreen() {
    const router = useRouter();
    const [showForm, setShowForm] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Form State
    const [kategori, setKategori] = useState('BIAYA_OPERASIONAL');
    const [bisnisKategori, setBisnisKategori] = useState('umum');
    const [selectedMuatan, setSelectedMuatan] = useState<any>(null);
    const [selectedMobil, setSelectedMobil] = useState<any>(null);
    const [selectedArmada, setSelectedArmada] = useState<any>(null);
    
    const [jumlah, setJumlah] = useState('');
    const [deskripsi, setDeskripsi] = useState('');
    const [payMetode, setPayMetode] = useState('TUNAI');
    const [splitPayments, setSplitPayments] = useState([
        { metode: 'TUNAI', jumlah: '' },
        { metode: 'TRANSFER', jumlah: '' },
    ]);

    // API Hooks
    const { data: expensesData, isLoading, refetch } = usePengeluaranList();
    const { data: summaryData } = usePengeluaranSummary();
    const createExpenseMutation = useCreatePengeluaran();

    const expenses = expensesData?.data || [];

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetch()]);
        setRefreshing(false);
    }, [refetch]);

    const handleSave = async () => {
        if (!jumlah || !deskripsi) {
            Alert.alert('Validasi', 'Mohon isi jumlah dan keterangan');
            return;
        }

        const totalAmount = parseNumber(jumlah);

        const payload: any = {
            tanggal: new Date().toISOString().split('T')[0],
            kategori,
            bisnis_kategori: bisnisKategori,
            muatan_id: selectedMuatan?.id || null,
            armada_id: selectedArmada?.id || null,
            mobil_id: selectedMobil?.id || null,
            jumlah: totalAmount,
            deskripsi,
            metode_bayar: payMetode,
        };

        if (payMetode === 'SPLIT') {
            const totalSplit = splitPayments.reduce((acc, curr) => acc + parseNumber(curr.jumlah), 0);
            if (totalSplit !== totalAmount) {
                Alert.alert(
                    'Validasi Split Payment',
                    `Total pembayaran split (${formatCurrency(totalSplit)}) harus sama dengan total pengeluaran (${formatCurrency(totalAmount)}).\n\nSelisih: ${formatCurrency(totalAmount - totalSplit)}`
                );
                return;
            }
            // Filter out empty amounts if needed, or strictly require them. Currently strictly checking sum.
            payload.payments = splitPayments.map(p => ({
                metode: p.metode,
                jumlah: parseNumber(p.jumlah)
            }));
        }

        try {
            if (!onlineManager.isOnline()) {
                createExpenseMutation.mutate(payload);
                setShowForm(false);
                setJumlah('');
                setDeskripsi('');
                setBisnisKategori('umum');
                setSelectedMuatan(null);
                setSelectedMobil(null);
                setSelectedArmada(null);
                setPayMetode('TUNAI');
                setSplitPayments([
                    { metode: 'TUNAI', jumlah: '' },
                    { metode: 'TRANSFER', jumlah: '' },
                ]);
                Alert.alert('Offline Mode', 'Pengeluaran telah disimpan dalam antrean offline.');
                return;
            }

            await createExpenseMutation.mutateAsync(payload);
            setShowForm(false);
            setJumlah('');
            setDeskripsi('');
            setBisnisKategori('umum');
            setSelectedMuatan(null);
            setSelectedMobil(null);
            setSelectedArmada(null);
            setPayMetode('TUNAI');
            setSplitPayments([
                { metode: 'TUNAI', jumlah: '' },
                { metode: 'TRANSFER', jumlah: '' },
            ]);
            Alert.alert('Sukses', 'Pengeluaran berhasil dicatat');
        } catch (error: any) {
            console.error('Failed to save expense:', error);
            Alert.alert(
                'Gagal',
                error?.response?.data?.detail || 'Terjadi kesalahan saat menyimpan data'
            );
        }
    };

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (TPM Style) */}
            <View className="bg-primary pt-14 pb-16 px-6 rounded-b-[56px] shadow-2xl z-30">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={handleBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </Pressable>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Biaya Operasional</Typography>
                            <Typography className="text-white/50 text-[10px] font-bold uppercase tracking-[2px]">Workshop Expenses Control</Typography>
                        </View>
                    </View>

                    <Pressable
                        onPress={() => setShowForm(!showForm)}
                        className={`w-11 h-11 rounded-2xl items-center justify-center border ${showForm ? 'bg-white border-white' : 'bg-white/10 border-white/5'}`}
                    >
                        {showForm ? <X size={20} color="#023C69" /> : <Plus size={24} color="white" />}
                    </Pressable>
                </View>

                {/* Main Summary Stat Overlay Card */}
                <View className="bg-white p-6 rounded-[32px] shadow-2xl border border-gray-100 flex-row items-center">
                    <View className="w-14 h-14 bg-primary/5 rounded-[24px] items-center justify-center mr-4 border border-primary/10">
                        <TrendingDown size={28} color="#023C69" />
                    </View>
                    <View className="flex-1">
                        <Typography className="text-textGray/40 text-[9px] font-black uppercase tracking-widest mb-1">Total Pengeluaran Bulan Ini</Typography>
                        <Typography variant="h2" weight="bold" className="text-textMain font-bold text-2xl tracking-tighter">
                            {formatCurrency(summaryData?.total_jumlah || 0)}
                        </Typography>
                    </View>
                    <View className="bg-primary/10 px-3 py-1.5 rounded-full items-center">
                        <Typography className="text-primary text-[10px] font-black">{summaryData?.count || 0}</Typography>
                        <Typography className="text-primary text-[8px] font-bold uppercase">Trans</Typography>
                    </View>
                </View>
            </View>

            <ScrollView
                className="flex-1 mt-4 z-20"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
            >
                {showForm && (
                    <View className="px-6 mb-8">
                        <Card className="p-8 rounded-[48px] shadow-2xl border border-gray-100 bg-white">
                            <Typography variant="h3" weight="bold" className="mb-6 tracking-tight text-primary">Input Pengeluaran Baru</Typography>

                            <View className="space-y-6">
                                {/* Kategori Selection */}
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">Kategori</Typography>
                                    <View className="flex-row space-x-2">
                                        {CATEGORIES.map((cat) => (
                                            <Pressable
                                                key={cat.value}
                                                onPress={() => setKategori(cat.value)}
                                                className={`flex-1 p-3 rounded-2xl border items-center ${kategori === cat.value
                                                    ? 'bg-primary/5 border-primary shadow-sm'
                                                    : 'bg-gray-50 border-gray-100'
                                                    }`}
                                            >
                                                <cat.icon size={18} color={kategori === cat.value ? '#023C69' : '#9CA3AF'} />
                                                <Typography
                                                    weight={kategori === cat.value ? 'bold' : 'medium'}
                                                    className={`text-[9px] mt-2 tracking-tighter ${kategori === cat.value ? 'text-primary' : 'text-textGray'}`}
                                                    numberOfLines={1}
                                                >
                                                    {cat.label.split(' ')[1] || cat.label}
                                                </Typography>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>

                                {/* Kaitan Bisnis */}
                                <View>
                                    <View className="flex-row justify-between items-center mb-3">
                                        <Typography variant="caption" weight="bold" className="text-textGray/40 px-1 uppercase tracking-widest">Kaitan Bisnis</Typography>
                                        <Badge label={bisnisKategori === 'umum' ? 'General' : bisnisKategori.replace('_', ' ')} variant="neutral" className="px-1.5 py-0" />
                                    </View>
                                    <View className="flex-row space-x-2 mb-4">
                                        {BISNIS_KATEGORI.map((cat) => (
                                            <Pressable
                                                key={cat.value}
                                                onPress={() => {
                                                    setBisnisKategori(cat.value);
                                                    if (cat.value === 'umum') {
                                                        setSelectedMuatan(null);
                                                        setSelectedMobil(null);
                                                        setSelectedArmada(null);
                                                    }
                                                }}
                                                className={`flex-1 p-3 rounded-2xl border items-center ${bisnisKategori === cat.value
                                                    ? 'bg-primary border-primary shadow-sm'
                                                    : 'bg-gray-50 border-gray-100'
                                                    }`}
                                            >
                                                <cat.icon size={18} color={bisnisKategori === cat.value ? '#FFFFFF' : '#9CA3AF'} />
                                                <Typography
                                                    weight={bisnisKategori === cat.value ? 'bold' : 'medium'}
                                                    className={`text-[9px] mt-2 tracking-tighter ${bisnisKategori === cat.value ? 'text-white' : 'text-textGray'}`}
                                                    numberOfLines={1}
                                                >
                                                    {cat.label}
                                                </Typography>
                                            </Pressable>
                                        ))}
                                    </View>

                                    {bisnisKategori === 'jasa_angkut' && (
                                        <View className="bg-gray-50 p-4 rounded-3xl border border-gray-100 space-y-2">
                                            <ArmadaSelector
                                                label="ARMADA (TRUK)"
                                                placeholder="Pilih Armada..."
                                                value={selectedArmada}
                                                onSelect={setSelectedArmada}
                                            />
                                        </View>
                                    )}

                                    {bisnisKategori === 'jual_beli_mobil' && (
                                        <View className="bg-gray-50 p-4 rounded-3xl border border-gray-100">
                                            <MobilSelector
                                                label="UNIT MOBIL"
                                                placeholder="Pilih Unit Mobil..."
                                                value={selectedMobil}
                                                onSelect={setSelectedMobil}
                                            />
                                        </View>
                                    )}
                                </View>

                                <Input
                                    label="Keterangan Pengeluaran"
                                    placeholder="Contoh: Listrik, Sparepart, dll"
                                    value={deskripsi}
                                    onChangeText={setDeskripsi}
                                    containerClassName="mb-0"
                                />

                                <Input
                                    label="Jumlah Nominal (Rp)"
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={jumlah}
                                    onChangeText={(val) => setJumlah(formatNumber(val))}
                                    startIcon={<Typography weight="bold" className="text-primary/40 mr-1">Rp</Typography>}
                                    className="font-bold text-xl text-primary"
                                    containerClassName="mb-0"
                                />

                                {/* Metode Pembayaran */}
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-textGray/40 mb-3 px-1 uppercase tracking-widest">Metode Bayar</Typography>
                                    <View className="flex-row space-x-4">
                                        {[
                                            { id: 'TUNAI', label: 'TUNAI', icon: Wallet },
                                            { id: 'TRANSFER', label: 'TRANSFER', icon: ArrowRightLeft },
                                            { id: 'SPLIT', label: 'SPLIT', icon: Split },
                                        ].map((method) => (
                                            <Pressable
                                                key={method.id}
                                                onPress={() => setPayMetode(method.id as any)}
                                                className={`flex-1 flex-row items-center justify-center py-4 rounded-3xl border ${payMetode === method.id
                                                    ? 'bg-primary border-primary shadow-2xl shadow-primary/20'
                                                    : 'bg-gray-50 border-gray-100'
                                                    }`}
                                            >
                                                <method.icon size={14} color={payMetode === method.id ? 'white' : '#9CA3AF'} className="mr-2" />
                                                <Typography weight="bold" className={payMetode === method.id ? 'text-white text-[10px]' : 'text-textGray text-[10px]'}>{method.label}</Typography>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>

                                {payMetode === 'SPLIT' && (
                                    <View className="bg-gray-50 p-4 rounded-3xl border border-gray-100 space-y-3">
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-widest">Detail Pembayaran</Typography>
                                            <Pressable
                                                onPress={() => setSplitPayments([...splitPayments, { metode: 'TUNAI', jumlah: '' }])}
                                                className="bg-white border border-gray-200 p-2 rounded-xl"
                                            >
                                                <Plus size={14} color="#023C69" />
                                            </Pressable>
                                        </View>

                                        {splitPayments.map((split, index) => (
                                            <View key={index} className="flex-row space-x-2 items-center">
                                                <Pressable
                                                    onPress={() => {
                                                        const newSplits = [...splitPayments];
                                                        newSplits[index].metode = newSplits[index].metode === 'TUNAI' ? 'TRANSFER' : 'TUNAI';
                                                        setSplitPayments(newSplits);
                                                    }}
                                                    className="w-28 h-12 bg-white border border-gray-200 rounded-2xl flex-row items-center justify-center px-2"
                                                >
                                                    {split.metode === 'TUNAI' ? <Wallet size={12} color="#023C69" className="mr-2" /> : <ArrowRightLeft size={12} color="#023C69" className="mr-2" />}
                                                    <Typography className="text-[10px] font-bold text-primary">{split.metode}</Typography>
                                                </Pressable>

                                                <Input
                                                    placeholder="0"
                                                    value={split.jumlah}
                                                    onChangeText={(text) => {
                                                        const newSplits = [...splitPayments];
                                                        newSplits[index].jumlah = formatNumber(text);
                                                        setSplitPayments(newSplits);
                                                    }}
                                                    keyboardType="numeric"
                                                    containerClassName="flex-1 mb-0"
                                                    className="h-12 text-sm font-bold"
                                                />

                                                {splitPayments.length > 2 && (
                                                    <Pressable
                                                        onPress={() => {
                                                            const newSplits = splitPayments.filter((_, i) => i !== index);
                                                            setSplitPayments(newSplits);
                                                        }}
                                                        className="w-10 h-10 items-center justify-center bg-red-50 rounded-xl border border-red-100"
                                                    >
                                                        <Trash2 size={14} color="#EF4444" />
                                                    </Pressable>
                                                )}
                                            </View>
                                        ))}

                                        <View className="flex-row justify-between items-center mt-2 pt-3 border-t border-gray-200 border-dashed">
                                            <Typography className="text-xs text-textGray">Total Terinput:</Typography>
                                            <Typography weight="bold" className={`text-sm ${splitPayments.reduce((acc, curr) => acc + parseNumber(curr.jumlah), 0) === parseNumber(jumlah)
                                                    ? 'text-green-600'
                                                    : 'text-orange-500'
                                                }`}>
                                                {formatCurrency(splitPayments.reduce((acc, curr) => acc + parseNumber(curr.jumlah), 0))}
                                            </Typography>
                                        </View>
                                    </View>
                                )}

                                <Button
                                    title="Catat Pengeluaran"
                                    onPress={handleSave}
                                    loading={createExpenseMutation.isPending}
                                    className="h-16 rounded-[28px] shadow-2xl shadow-primary/40"
                                />
                            </View>
                        </Card>
                    </View>
                )}

                {/* List Section Area */}
                <View className="mx-6 bg-white rounded-[40px] shadow-2xl border border-gray-50 overflow-hidden min-h-[500px]">
                    <View className="p-6 border-b border-gray-50 flex-row items-center justify-between">
                        <View>
                            <Typography variant="h3" weight="bold" className="tracking-tighter">Riwayat Aktivitas</Typography>
                            <Typography className="text-textGray/40 text-[10px] font-bold uppercase tracking-widest">Transaksi Terbaru</Typography>
                        </View>
                        <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center">
                            <Search size={20} color="#D1D5DB" />
                        </View>
                    </View>

                    <View className="p-4">
                        {isLoading ? (
                            <View className="py-20 flex-row justify-center items-center">
                                <ActivityIndicator size="large" color="#023C69" />
                            </View>
                        ) : expenses.length === 0 ? (
                            <View className="py-20 items-center">
                                <View className="w-16 h-16 bg-gray-50 rounded-[28px] items-center justify-center mb-6">
                                    <Receipt size={32} color="#D1D5DB" />
                                </View>
                                <Typography className="text-gray-400 font-bold text-center">Belum ada aktivitas</Typography>
                                <Typography className="text-gray-300 text-xs text-center mt-1">Data pengeluaran akan muncul di sini</Typography>
                            </View>
                        ) : (
                            expenses.map((item: any) => {
                                const catInfo = CATEGORIES.find(c => c.value === item.kategori) || CATEGORIES[2];
                                return (
                                    <Card key={item.id} className="mb-4 p-5 border border-gray-50 shadow-sm bg-white rounded-[32px]">
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center flex-1 mr-4">
                                                <View className="w-12 h-12 rounded-2xl items-center justify-center mr-3 bg-gray-50">
                                                    <catInfo.icon size={20} color={catInfo.color} />
                                                </View>
                                                <View className="flex-1">
                                                    <Typography weight="bold" className="text-textMain text-sm mb-0.5" numberOfLines={1}>{item.deskripsi || item.nama}</Typography>
                                                    <View className="flex-row items-center">
                                                        <Typography className="text-textGray/40 text-[9px] font-black uppercase tracking-widest">{catInfo.label}</Typography>
                                                        <Typography className="text-textGray/20 text-[9px] mx-1.5">•</Typography>
                                                        <Typography className="text-textGray/40 text-[9px] font-bold">{formatDate(item.tanggal)}</Typography>
                                                    </View>
                                                    {item.bisnis_kategori !== 'umum' && (
                                                        <View className="flex-row items-center mt-1">
                                                            <View className="w-1.5 h-1.5 rounded-full bg-primary/30 mr-1.5" />
                                                            <Typography className="text-primary/60 text-[8px] font-black uppercase tracking-[1px]">
                                                                Linked to {item.bisnis_kategori.replace('_', ' ')}
                                                            </Typography>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            <View className="items-end">
                                                <Typography weight="bold" className="text-primary text-sm tracking-tight mb-1">-{formatNumber(item.jumlah)}</Typography>
                                                <Badge
                                                    label={item.metode_bayar || 'TUNAI'}
                                                    variant={item.metode_bayar?.toUpperCase() === 'TUNAI' ? 'warning' : 'info'}
                                                    className="px-2 py-0"
                                                />
                                            </View>
                                        </View>
                                    </Card>
                                );
                            })
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
