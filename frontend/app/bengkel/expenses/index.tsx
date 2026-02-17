import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import {
    ChevronLeft,
    Receipt,
    Plus
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePengeluaranList, useCreatePengeluaran, usePengeluaranSummary } from '../../../hooks/useBengkel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { formatNumber, parseNumber } from '../../../utils/format';

const CATEGORIES = [
    { label: 'Biaya Operasional', value: 'biaya_operasional' },
    { label: 'Biaya Lainnya', value: 'biaya_lainnya' },
    { label: 'Prive', value: 'prive' },
];

export default function ExpensesScreen() {
    const router = useRouter(); const [showForm, setShowForm] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Form State
    const [kategori, setKategori] = useState('biaya_operasional');
    const [jumlah, setJumlah] = useState('');
    const [deskripsi, setDeskripsi] = useState('');
    const [payMetode, setPayMetode] = useState('tunai');

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

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handleSave = async () => {
        if (!jumlah || !deskripsi) return;

        try {
            await createExpenseMutation.mutateAsync({
                tanggal: new Date().toISOString().split('T')[0],
                kategori,
                jumlah: parseNumber(jumlah),
                deskripsi,
                metode_bayar: payMetode,
            });
            setShowForm(false);
            setJumlah('');
            setDeskripsi('');
        } catch (error: any) {
            console.error('Failed to save expense:', error);
            Alert.alert(
                'Gagal',
                error?.response?.data?.detail || 'Terjadi kesalahan saat menyimpan data'
            );
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F8F9FA]" edges={['bottom', 'left', 'right']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View className="bg-[#121212] pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl mb-6">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={handleBack} className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5">
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Biaya Operasional</Typography>
                            <Typography className="text-white/50 text-[10px] uppercase font-bold tracking-widest mt-0.5">Kelola Pengeluaran Bengkel</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowForm(!showForm)}
                        className={`px-4 py-2.5 rounded-2xl flex-row items-center border ${showForm ? 'bg-white/10 border-white/20' : 'bg-secondary border-secondary shadow-lg shadow-secondary/50'}`}
                    >
                        <Plus size={16} color="white" />
                        <Typography weight="bold" className="text-white text-xs ml-1.5">{showForm ? 'Tutup' : 'Input'}</Typography>
                    </TouchableOpacity>
                </View>

                {/* Summary Stat */}
                <View className="bg-white/10 p-5 rounded-[24px] border border-white/5">
                    <Typography className="text-white/40 text-[10px] uppercase font-bold mb-1 tracking-wider">Total Pengeluaran Bulan Ini</Typography>
                    <View className="flex-row items-baseline">
                        <Typography weight="bold" className="text-white/60 text-sm mr-1">Rp</Typography>
                        <Typography weight="bold" className="text-white text-3xl tracking-tighter">
                            {formatNumber(summaryData?.total_jumlah || 0)}
                        </Typography>
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
                {showForm && (
                    <Card className="mb-6 p-5 border border-secondary/10 bg-secondary/5">
                        <Typography variant="body2" weight="bold" className="mb-6 text-secondary tracking-widest">TAMBAH BIAYA BARU</Typography>

                        <View className="mb-4">
                            <Typography variant="caption" className="text-textGray mb-2 px-1">KATEGORI PENGELUARAN</Typography>
                            <View className="flex-row space-x-2">
                                {CATEGORIES.map((c) => (
                                    <TouchableOpacity
                                        key={c.value}
                                        onPress={() => setKategori(c.value)}
                                        className={`flex-1 py-3 px-1 items-center rounded-xl border ${kategori === c.value ? 'border-secondary bg-secondary/10' : 'border-gray-100 bg-gray-50'}`}
                                    >
                                        <Typography
                                            className={kategori === c.value ? 'text-secondary text-[10px]' : 'text-gray-400 text-[10px]'}
                                            weight="bold"
                                        >
                                            {c.label.toUpperCase()}
                                        </Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View className="flex-row space-x-3 mb-4">
                            <View className="flex-1">
                                <Input
                                    label="Jumlah"
                                    placeholder="0"
                                    keyboardType="numeric"
                                    startIcon={<Typography weight="bold" className="text-gray-400">Rp</Typography>}
                                    value={jumlah}
                                    onChangeText={(val) => setJumlah(formatNumber(val))}
                                    className="font-bold text-lg"
                                />
                            </View>
                        </View>

                        <View className="mb-6">
                            <Typography variant="caption" className="text-textGray mb-2 px-1">METODE PEMBAYARAN</Typography>
                            <View className="flex-row space-x-2">
                                {['tunai', 'transfer'].map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        onPress={() => setPayMetode(m)}
                                        className={`flex-1 py-3 items-center rounded-xl border ${payMetode === m ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50'}`}
                                    >
                                        <Typography
                                            className={payMetode === m ? 'text-primary text-[10px]' : 'text-gray-400 text-[10px]'}
                                            weight="bold"
                                        >
                                            {m.toUpperCase()}
                                        </Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <Input
                            label="Keterangan"
                            placeholder="Contoh: Bayar sewa ruko"
                            containerClassName="mb-6"
                            value={deskripsi}
                            onChangeText={setDeskripsi}
                        />

                        <View className="flex-row space-x-3">
                            <Button
                                title="Batal"
                                variant="ghost"
                                onPress={() => setShowForm(false)}
                                className="flex-1"
                            />
                            <Button
                                title="Simpan"
                                variant="danger"
                                onPress={handleSave}
                                className="flex-1"
                                loading={createExpenseMutation.isPending}
                            />
                        </View>
                    </Card>
                )}

                <Typography variant="h3" weight="bold" className="mb-4">Riwayat Pengeluaran</Typography>

                {isLoading ? (
                    <>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </>
                ) : expenses.length === 0 ? (
                    <EmptyState
                        title="Belum ada data"
                        description="Belum ada riwayat pengeluaran operasional."
                        icon={Receipt}
                    />
                ) : (
                    expenses.map((item: any) => (
                        <TouchableOpacity key={item.id} activeOpacity={0.7} className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                            <View className="w-14 h-14 bg-secondary/5 rounded-2xl items-center justify-center mr-4 border border-secondary/5">
                                <Receipt size={24} color="#EE2737" />
                            </View>

                            <View className="flex-1">
                                <View className="flex-row items-center justify-between mb-1">
                                    <Typography variant="body2" weight="bold">
                                        {CATEGORIES.find(c => c.value === item.kategori || c.label === item.kategori)?.label || item.kategori}
                                    </Typography>
                                    <Typography variant="body2" weight="bold" className="text-secondary">
                                        -Rp {formatNumber(item.jumlah)}
                                    </Typography>
                                </View>
                                <Typography variant="caption" className="text-textGray opacity-60 mb-2">
                                    {format(new Date(item.tanggal), 'dd MMM yyyy', { locale: localeID })}
                                </Typography>
                                <View className="flex-row items-center">
                                    <View className="bg-gray-100 px-2 py-0.5 rounded-md mr-2">
                                        <Typography className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">{item.metode_bayar || 'Tunai'}</Typography>
                                    </View>
                                    <Typography variant="caption" className="text-textGray flex-1" numberOfLines={1}>{item.deskripsi}</Typography>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
