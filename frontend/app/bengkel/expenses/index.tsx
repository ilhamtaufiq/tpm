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
import { usePengeluaranList, useCreatePengeluaran } from '../../../hooks/useBengkel';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

const CATEGORIES = [
    { label: 'Biaya Operasional', value: 'biaya_operasional' },
    { label: 'Biaya Lainnya', value: 'biaya_lainnya' },
    { label: 'Prive', value: 'prive' },
];

export default function ExpensesScreen() {
    const router = useRouter();    const [showForm, setShowForm] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Form State
    const [kategori, setKategori] = useState('biaya_operasional');
    const [jumlah, setJumlah] = useState('');
    const [deskripsi, setDeskripsi] = useState('');
    const [payMetode, setPayMetode] = useState('tunai');

    // API Hooks
    const { data: expensesData, isLoading, refetch } = usePengeluaranList();
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
                jumlah: parseInt(jumlah),
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
        <SafeAreaView className="flex-1 bg-surface">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={handleBack} className="mr-4">
                        <ChevronLeft size={24} color="#1C1C1C" />
                    </TouchableOpacity>
                    <Typography variant="h2" weight="bold">Biaya Operasional</Typography>
                </View>
                <TouchableOpacity
                    onPress={() => setShowForm(!showForm)}
                    className="bg-secondary/10 px-3 py-1.5 rounded-full flex-row items-center"
                >
                    <Plus size={16} color="#EE2737" />
                    <Typography className="text-secondary text-xs font-bold ml-1">Input Biaya</Typography>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                {showForm && (
                    <Card className="mb-6 p-5 border border-secondary/10 bg-secondary/5">
                        <Typography variant="body2" weight="bold" className="mb-4 text-secondary">TAMBAH BIAYA BARU</Typography>

                        <View className="flex-row space-x-3 mb-4">
                            <View className="flex-1">
                                <Typography variant="body2" className="text-textGray text-sm mb-1 font-medium">Kategori</Typography>
                                <TouchableOpacity
                                    className="bg-white border border-gray-200 rounded-xl px-4 h-12 justify-center"
                                    onPress={() => {
                                        const currentIndex = CATEGORIES.findIndex(c => c.value === kategori);
                                        const nextIndex = (currentIndex + 1) % CATEGORIES.length;
                                        setKategori(CATEGORIES[nextIndex].value);
                                    }}
                                >
                                    <Typography>{CATEGORIES.find(c => c.value === kategori)?.label || kategori}</Typography>
                                </TouchableOpacity>
                            </View>
                            <Input
                                label="Jumlah (Rp)"
                                placeholder="0"
                                keyboardType="numeric"
                                containerClassName="flex-1"
                                value={jumlah}
                                onChangeText={setJumlah}
                            />
                        </View>

                        <View className="mb-4">
                            <Typography variant="body2" className="text-textGray text-sm mb-2 font-medium">Metode Pembayaran *</Typography>
                            <View className="flex-row space-x-2">
                                {['tunai', 'transfer'].map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        onPress={() => setPayMetode(m)}
                                        className={`flex-1 py-2.5 items-center rounded-xl border ${payMetode === m ? 'border-secondary bg-secondary/10' : 'border-gray-200 bg-white'}`}
                                    >
                                        <Typography
                                            className={payMetode === m ? 'text-secondary' : 'text-gray-500'}
                                            weight={payMetode === m ? 'semibold' : 'normal'}
                                        >
                                            {m.charAt(0).toUpperCase() + m.slice(1)}
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
                        <Card key={item.id} className="mb-4 p-4 flex-row items-center">
                            <View className="w-12 h-12 bg-secondary/10 rounded-2xl items-center justify-center mr-4">
                                <Receipt size={24} color="#EE2737" />
                            </View>

                            <View className="flex-1">
                                <Typography variant="body2" weight="bold">
                                    {CATEGORIES.find(c => c.value === item.kategori || c.label === item.kategori)?.label || item.kategori}
                                </Typography>
                                <Typography variant="caption" className="text-gray-400">
                                    {format(new Date(item.tanggal), 'dd MMM yyyy', { locale: localeID })}
                                </Typography>
                                <Typography variant="caption" className="mt-1">{item.deskripsi}</Typography>
                            </View>

                            <View className="items-end">
                                <Typography variant="body2" weight="bold" className="text-secondary">
                                    -Rp {(item.jumlah || 0).toLocaleString()}
                                </Typography>
                            </View>
                        </Card>
                    ))
                )}
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
