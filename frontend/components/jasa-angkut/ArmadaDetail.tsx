import React, { useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal, Alert } from 'react-native';
import { Typography } from '../ui/Typography';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useArmadaDetail } from '../../hooks/useJasaAngkut';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import {
    Truck,
    Calendar,
    ArrowUpRight,
    MapPin,
    Clock,
    CreditCard,
    Wrench,
    TrendingUp,
    TrendingDown,
    Activity,
    ChevronRight,
    Search,
    Plus,
    DollarSign,
    X as CloseIcon,
    Trash2,
    PlusCircle,
    GaugeCircle
} from 'lucide-react-native';
import { SkeletonCard } from '../ui/Skeleton';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { jasaAngkutService } from '../../services/jasaAngkut';

interface ArmadaDetailProps {
    id: number;
    onClose?: () => void;
}

export const ArmadaDetail = ({ id, onClose }: ArmadaDetailProps) => {
    const { data: detailData, isLoading, refetch } = useArmadaDetail(id);
    const [activeTab, setActiveTab] = useState<'trips' | 'repairs' | 'expenses'>('trips');
    const [refreshing, setRefreshing] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
    const [selectedExpense, setSelectedExpense] = useState<any | null>(null);
    const [selectedRepair, setSelectedRepair] = useState<any | null>(null);
    const [submittingExpense, setSubmittingExpense] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        deskripsi: '',
        jumlah: '',
        catatan: '',
        metode_bayar: 'UNIT_TUNAI'
    });
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; sumber: string; nominal: string }[]>([]);

    const totalSplitAmount = payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0);

    const addPaymentRow = () => {
        setPayments([...payments, { id: Date.now() + Math.random(), sumber: 'UNIT_TUNAI', nominal: '' }]);
    };

    const removePaymentRow = (id: number) => {
        setPayments(payments.filter(p => p.id !== id));
    };

    const updatePaymentRow = (id: number, field: string, value: string) => {
        setPayments(payments.map(p => {
            if (p.id === id) {
                return { ...p, [field]: field === 'nominal' ? formatNumber(value) : value };
            }
            return p;
        }));
    };

    const toggleSplitPayment = () => {
        if (!isSplitPayment) {
            setPayments([{ id: Date.now() + Math.random(), sumber: expenseForm.metode_bayar, nominal: expenseForm.jumlah }]);
        } else {
            setExpenseForm(prev => ({ ...prev, jumlah: formatNumber(totalSplitAmount.toString()) }));
        }
        setIsSplitPayment(!isSplitPayment);
    };

    const handleAddExpense = async () => {
        if (!expenseForm.deskripsi || !expenseForm.jumlah) return;
        try {
            setSubmittingExpense(true);

            const getPaymentDetails = (sumber: string) => {
                if (sumber === 'UNIT_TUNAI') return { metode: 'TUNAI', kas_jenis: 'KAS_UNIT_JASA_ANGKUT' };
                if (sumber === 'UTAMA_TUNAI') return { metode: 'TUNAI', kas_jenis: 'KAS_UTAMA' };
                if (sumber === 'UTAMA_TRANSFER') return { metode: 'TRANSFER', kas_jenis: 'BANK_UTAMA' };
                return { metode: 'TUNAI', kas_jenis: 'KAS_UNIT_JASA_ANGKUT' };
            };

            const finalAmount = isSplitPayment ? totalSplitAmount : parseNumber(expenseForm.jumlah);
            await jasaAngkutService.addArmadaExpense(id, {
                ...expenseForm,
                jumlah: finalAmount,
                metode_bayar: isSplitPayment ? 'SPLIT' : getPaymentDetails(expenseForm.metode_bayar).metode,
                kas_jenis: isSplitPayment ? undefined : getPaymentDetails(expenseForm.metode_bayar).kas_jenis,
                payments: isSplitPayment ? payments.map(p => ({
                    ...getPaymentDetails(p.sumber),
                    nominal: parseNumber(p.nominal)
                })).filter(p => p.nominal > 0) : []
            });
            setShowExpenseModal(false);
            setExpenseForm({
                tanggal: new Date().toISOString().split('T')[0],
                deskripsi: '',
                jumlah: '',
                catatan: '',
                metode_bayar: 'UNIT_TUNAI'
            });
            setPayments([]);
            setIsSplitPayment(false);
            refetch();
        } catch (error) {
            console.error(error);
            Alert.alert('Gagal', 'Terjadi kesalahan saat menyimpan biaya operasional');
        } finally {
            setSubmittingExpense(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    if (isLoading && !refreshing) {
        return (
            <View className="p-6 space-y-6">
                <View className="h-20 bg-gray-100 rounded-3xl animate-pulse" />
                <View className="flex-row space-x-4">
                    <View className="flex-1 h-24 bg-gray-100 rounded-3xl animate-pulse" />
                    <View className="flex-1 h-24 bg-gray-100 rounded-3xl animate-pulse" />
                </View>
                <View className="space-y-4">
                    <SkeletonCard className="h-32" />
                    <SkeletonCard className="h-32" />
                    <SkeletonCard className="h-32" />
                </View>
            </View>
        );
    }

    if (!detailData || !detailData.armada) {
        return (
            <View className="p-10 items-center justify-center">
                <Typography className="text-gray-400">Data armada tidak tersedia</Typography>
            </View>
        );
    }

    const {
        armada,
        stats,
        muatan_history = [],
        perbaikan_history = [],
        general_expenses = [],
        workshop_expenses = [],
        pengeluaran_bengkel = []
    } = detailData;

    const actualWorkshopExpenses = [...(workshop_expenses || []), ...(pengeluaran_bengkel || [])];

    return (
        <ScrollView
            className="flex-1 bg-gray-50/30"
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
        >
            <View className="p-6">
                {/* Header Card */}
                <View className="bg-primary p-6 rounded-[32px] mb-6 shadow-lg shadow-primary/20">
                    <View className="flex-row justify-between items-start mb-4">
                        <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center">
                            <Truck size={28} color="#FFFFFF" strokeWidth={2.5} />
                        </View>
                        <Badge
                            variant={armada.is_active ? 'success' : 'neutral'}
                            label={armada.is_active ? 'Aktif' : 'Non-Aktif'}
                            className="bg-white/20 border-white/10"
                        />
                    </View>
                    <Typography variant="h2" weight="bold" className="text-white mb-1">
                        {armada.nama}
                    </Typography>
                    <View className="flex-row items-center">
                        <Typography className="text-white/80 font-bold tracking-widest text-base">
                            {armada.nopol}
                        </Typography>
                        <View className="mx-2 w-1.5 h-1.5 bg-white/30 rounded-full" />
                        <Typography className="text-white/60">
                            {armada.jenis || 'Armada Umum'}
                        </Typography>
                    </View>
                </View>

                {/* Bento Grid Stats */}
                <View className="flex-row flex-wrap -mx-2 mb-6">
                    {/* Trips Count */}
                    <View className="w-1/2 p-2">
                        <View className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
                            <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mb-3">
                                <Activity size={20} color="#3B82F6" />
                            </View>
                            <Typography variant="caption" className="text-textGray mb-0.5">Total Ritase</Typography>
                            <Typography weight="bold" className="text-xl text-textMain">{stats.total_ritase}</Typography>
                        </View>
                    </View>

                    {/* Revenue */}
                    <View className="w-1/2 p-2">
                        <View className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
                            <View className="w-10 h-10 bg-emerald-50 rounded-xl items-center justify-center mb-3">
                                <TrendingUp size={20} color="#10B981" />
                            </View>
                            <Typography variant="caption" className="text-textGray mb-0.5">Pendapatan</Typography>
                            <Typography weight="bold" className="text-xl text-textMain">{formatCurrency(stats.total_pendapatan_kotor)}</Typography>
                        </View>
                    </View>

                    {/* Operational Costs */}
                    <View className="w-1/2 p-2">
                        <View className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
                            <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center mb-3">
                                <TrendingDown size={20} color="#F59E0B" />
                            </View>
                            <Typography variant="caption" className="text-textGray mb-0.5">Biaya Ops</Typography>
                            <Typography weight="bold" className="text-xl text-orange-600">{formatCurrency(stats.total_biaya_operasional)}</Typography>
                        </View>
                    </View>

                    {/* Workshop Repairs */}
                    <View className="w-1/2 p-2">
                        <View className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm">
                            <View className="w-10 h-10 bg-red-50 rounded-xl items-center justify-center mb-3">
                                <Wrench size={20} color="#EF4444" />
                            </View>
                            <Typography variant="caption" className="text-textGray mb-0.5">Perbaikan</Typography>
                            <Typography weight="bold" className="text-xl text-red-600">{formatCurrency(stats.total_perbaikan_bengkel)}</Typography>
                        </View>
                    </View>
                </View>

                {/* Net Profit Summary */}
                <View className="bg-emerald-600 p-5 rounded-[28px] mb-8 shadow-md shadow-emerald-200">
                    <View className="flex-row justify-between items-center">
                        <View>
                            <Typography variant="caption" className="text-emerald-100 opacity-80 uppercase tracking-widest font-bold mb-1">Total Laba TPM (Nett)</Typography>
                            <Typography variant="h3" weight="bold" className="text-white">
                                {formatCurrency(stats.total_pendapatan_kotor - stats.total_biaya_operasional - stats.total_perbaikan_bengkel)}
                            </Typography>
                        </View>
                        <View className="w-12 h-12 bg-white/20 rounded-full items-center justify-center">
                            <ArrowUpRight size={24} color="#FFFFFF" />
                        </View>
                    </View>
                </View>

                {/* Tab Switcher */}
                <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-6">
                    <Pressable
                        onPress={() => setActiveTab('trips')}
                        className={`flex-1 py-3 rounded-xl items-center flex-row justify-center space-x-2 ${activeTab === 'trips' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Clock size={16} color={activeTab === 'trips' ? '#023C69' : '#94A3B8'} />
                        <Typography weight={activeTab === 'trips' ? 'bold' : 'medium'} className={activeTab === 'trips' ? 'text-primary' : 'text-gray-400'}>
                            Riwayat Trip
                        </Typography>
                    </Pressable>
                    <Pressable
                        onPress={() => setActiveTab('repairs')}
                        className={`flex-1 py-3 rounded-xl items-center flex-row justify-center space-x-2 ${activeTab === 'repairs' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Wrench size={16} color={activeTab === 'repairs' ? '#023C69' : '#94A3B8'} />
                        <Typography weight={activeTab === 'repairs' ? 'bold' : 'medium'} className={activeTab === 'repairs' ? 'text-primary' : 'text-gray-400'}>
                            Perbaikan
                        </Typography>
                    </Pressable>
                    <Pressable
                        onPress={() => setActiveTab('expenses')}
                        className={`flex-1 py-3 rounded-xl items-center flex-row justify-center space-x-2 ${activeTab === 'expenses' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <DollarSign size={16} color={activeTab === 'expenses' ? '#023C69' : '#94A3B8'} />
                        <Typography weight={activeTab === 'expenses' ? 'bold' : 'medium'} className={activeTab === 'expenses' ? 'text-primary' : 'text-gray-400'}>
                            Biaya Ops
                        </Typography>
                    </Pressable>
                </View>

                {(() => {
                    switch (activeTab) {
                        case 'trips':
                            return (
                                <View className="space-y-4 pb-10">
                                    {muatan_history.length === 0 ? (
                                        <View className="py-20 items-center">
                                            <Typography className="text-gray-400 italic">Belum ada riwayat trip</Typography>
                                        </View>
                                    ) : (
                                        muatan_history.map((trip: any) => (
                                            <Pressable
                                                key={trip.id}
                                                onPress={() => setSelectedTrip(trip)}
                                                className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm flex-row items-center"
                                                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                                            >
                                                <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mr-4">
                                                    <MapPin size={22} color="#3B82F6" />
                                                </View>
                                                <View className="flex-1">
                                                    <View className="flex-row justify-between mb-1">
                                                        <Typography weight="bold" className="text-textMain flex-1 mr-2" numberOfLines={1}>
                                                            {trip.asal} → {trip.tujuan}
                                                        </Typography>
                                                        <Typography variant="caption" weight="bold" className="text-primary italic">
                                                            {trip.ritase} Rit
                                                        </Typography>
                                                    </View>
                                                    <Typography variant="caption" className="text-textGray mb-2">
                                                        {formatDate(trip.tanggal)} • {trip.supir_nama || 'Supir'} • {trip.jenis_muatan || 'Muatan Umum'}
                                                    </Typography>
                                                    <View className="flex-row justify-between items-center pt-2 border-t border-gray-50">
                                                        <View className="flex-row space-x-2">
                                                            <Badge label={formatCurrency(trip.pendapatan_kotor - trip.laba_supir)} variant="info" className="scale-75 origin-left" />
                                                        </View>
                                                        <Typography weight="bold" className="text-primary text-xs">
                                                            +{formatCurrency(trip.laba_tpm)}
                                                        </Typography>
                                                    </View>
                                                </View>
                                                <ChevronRight size={18} color="#CBD5E1" className="ml-2" />
                                            </Pressable>
                                        ))
                                    )}
                                </View>
                            );
                        case 'repairs':
                            return (
                                <View className="space-y-4 pb-10">
                                    {perbaikan_history.length === 0 ? (
                                        <View className="py-20 items-center">
                                            <Typography className="text-gray-400 italic">Belum ada riwayat perbaikan</Typography>
                                        </View>
                                    ) : (
                                        perbaikan_history.map((item: any) => (
                                            <Pressable
                                                key={item.id}
                                                onPress={() => setSelectedRepair(item)}
                                                className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm"
                                                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                                            >
                                                <View className="flex-row justify-between mb-3">
                                                    <View className="flex-row items-center">
                                                        <View className="w-8 h-8 bg-red-50 rounded-lg items-center justify-center mr-2">
                                                            <Wrench size={16} color="#EF4444" />
                                                        </View>
                                                        <Typography weight="bold" className="text-textMain">{item.nomor_transaksi}</Typography>
                                                    </View>
                                                    <Typography variant="caption" className="text-textGray">{formatDate(item.tanggal)}</Typography>
                                                </View>

                                                <View className="space-y-2 mb-3">
                                                    {item.detail_services?.map((s: any, idx: number) => (
                                                        <View key={idx} className="flex-row justify-between">
                                                            <Typography variant="caption" className="text-textGray flex-1 mr-2">• {s.nama_jasa}</Typography>
                                                            <Typography variant="caption" weight="medium">{formatCurrency(s.subtotal)}</Typography>
                                                        </View>
                                                    ))}
                                                    {item.detail_parts?.map((p: any, idx: number) => (
                                                        <View key={idx} className="flex-row justify-between">
                                                            <Typography variant="caption" className="text-textGray flex-1 mr-2">• {p.spare_part_nama} (x{p.qty})</Typography>
                                                            <Typography variant="caption" weight="medium">{formatCurrency(p.subtotal)}</Typography>
                                                        </View>
                                                    ))}
                                                </View>

                                                <View className="flex-row justify-between items-center pt-3 border-t border-gray-50">
                                                    <Typography variant="caption" weight="bold" className="text-textGray">Total Biaya Perbaikan</Typography>
                                                    <Typography weight="bold" className="text-red-600">
                                                        {formatCurrency(item.grand_total)}
                                                    </Typography>
                                                </View>

                                                {item.muatan_nomor && (
                                                    <View className="mt-2 bg-blue-50 px-3 py-1.5 rounded-lg flex-row items-center self-start">
                                                        <TrendingDown size={12} color="#3B82F6" />
                                                        <Typography className="text-blue-600 text-[10px] ml-1 font-bold">Dibebankan ke: {item.muatan_nomor}</Typography>
                                                    </View>
                                                )}
                                            </Pressable>
                                        ))
                                    )}
                                </View>
                            );
                        case 'expenses':
                            return (
                                <View className="space-y-4 pb-10">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Typography weight="bold" className="text-gray-500">Daftar Biaya Operasional</Typography>
                                        <Pressable
                                            onPress={() => setShowExpenseModal(true)}
                                            className="bg-primary px-3 py-1.5 rounded-xl flex-row items-center"
                                        >
                                            <Plus size={14} color="white" />
                                            <Typography variant="caption" weight="bold" className="text-white ml-1.5">Tambah</Typography>
                                        </Pressable>
                                    </View>

                                    {(() => {
                                        // 1. Costs from linked workshop expenses
                                        const workshopItems = actualWorkshopExpenses.map((we: any) => ({
                                            ...we,
                                            type: 'WORKSHOP',
                                            display_deskripsi: we.deskripsi,
                                            display_sub: `[Bengkel] ${we.nomor_transaksi}`
                                        }));

                                        // 2. Costs from general armada expenses (biaya lainnya)
                                        const generalItems = general_expenses.map((ge: any) => ({
                                            ...ge,
                                            type: 'GENERAL',
                                            display_deskripsi: ge.deskripsi,
                                            display_sub: ge.kategori
                                        }));

                                        // 3. Operational costs entered directly in MuatanForm.
                                        // These are stored as biaya_tambahan with kategori="Operasional".
                                        // Render each item individually so users can verify exactly what
                                        // they entered on the trip form, instead of only seeing one merged total.
                                        const tripItems = muatan_history.flatMap((m: any) =>
                                            (m.biaya_tambahan || [])
                                                .filter((b: any) => String(b.kategori || '').toLowerCase() !== 'perawatan bengkel')
                                                .map((b: any) => ({
                                                    ...b,
                                                    id: `muatan-${m.id}-biaya-${b.id}`,
                                                    tanggal: b.tanggal || m.tanggal,
                                                    jumlah: Number(b.jumlah || 0),
                                                    type: 'TRIP',
                                                    muatan_nomor: m.nomor_transaksi,
                                                    muatan_tujuan: m.tujuan,
                                                    display_deskripsi: b.deskripsi || `Biaya Ops Trip: ${m.tujuan}`,
                                                    display_sub: m.nomor_transaksi
                                                }))
                                        );

                                        const allExpenses = [...workshopItems, ...generalItems, ...tripItems].sort((a, b) =>
                                            new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
                                        );

                                        if (allExpenses.length === 0) {
                                            return (
                                                <View className="py-20 items-center">
                                                    <Typography className="text-gray-400 italic">Belum ada biaya operasional tercatat</Typography>
                                                </View>
                                            );
                                        }

                                        return allExpenses.map((expense: any) => {
                                            const isWorkshop = expense.type === 'WORKSHOP';
                                            const isTrip = expense.type === 'TRIP';

                                            let bgColor = 'bg-orange-50';
                                            let iconColor = '#F59E0B';
                                            let IconComp = TrendingDown;

                                            if (isWorkshop) {
                                                bgColor = 'bg-red-50';
                                                iconColor = '#EF4444';
                                                IconComp = Wrench;
                                            } else if (isTrip) {
                                                bgColor = 'bg-blue-50';
                                                iconColor = '#3B82F6';
                                                IconComp = GaugeCircle;
                                            }

                                            return (
                                                <Pressable
                                                    key={expense.id}
                                                    onPress={() => setSelectedExpense(expense)}
                                                    className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm flex-row items-center"
                                                    style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                                                >
                                                    <View className={`w-10 h-10 ${bgColor} rounded-xl items-center justify-center mr-4`}>
                                                        <IconComp size={20} color={iconColor} />
                                                    </View>
                                                    <View className="flex-1">
                                                        <View className="flex-row justify-between items-start">
                                                            <View className="flex-1 mr-2">
                                                                <Typography weight="bold" className="text-textMain">{expense.display_deskripsi}</Typography>
                                                                <Typography variant="caption" className={`${isWorkshop ? 'text-red-600' : isTrip ? 'text-blue-600' : 'text-textGray'} font-bold text-[10px] uppercase`}>
                                                                    {expense.display_sub}
                                                                </Typography>
                                                            </View>
                                                            <Typography weight="bold" className={`${isWorkshop ? 'text-red-700' : isTrip ? 'text-blue-700' : 'text-orange-600'}`}>
                                                                {formatCurrency(expense.jumlah)}
                                                            </Typography>
                                                        </View>
                                                        <Typography variant="caption" className="text-textGray mt-0.5">
                                                            {formatDate(expense.tanggal)}
                                                        </Typography>
                                                    </View>
                                                    <ChevronRight size={18} color="#CBD5E1" className="ml-2" />
                                                </Pressable>
                                            );
                                        });
                                    })()}
                                </View>
                            );
                        default:
                            return null;
                    }
                })()}
            </View>

            {/* Modal Detail Trip */}
            <Modal
                visible={!!selectedTrip}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedTrip(null)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[85%]">
                        {selectedTrip && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="flex-row justify-between items-start mb-6">
                                    <View className="flex-1 pr-4">
                                        <Typography variant="h3" weight="bold" className="text-textMain">
                                            Detail Trip
                                        </Typography>
                                        <Typography variant="caption" className="text-textGray mt-1">
                                            #{selectedTrip.nomor_transaksi}
                                        </Typography>
                                    </View>
                                    <Pressable
                                        onPress={() => setSelectedTrip(null)}
                                        className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
                                    >
                                        <CloseIcon size={20} color="#475569" />
                                    </Pressable>
                                </View>

                                <Card variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                    <Typography variant="caption" weight="bold" className="text-primary mb-4 uppercase tracking-widest">
                                        Informasi Rute
                                    </Typography>

                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Asal</Typography>
                                        <Typography variant="body2" weight="bold" className="text-right flex-1 ml-4">
                                            {selectedTrip.asal}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Tujuan</Typography>
                                        <Typography variant="body2" weight="bold" className="text-right flex-1 ml-4">
                                            {selectedTrip.tujuan}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Tanggal</Typography>
                                        <Typography variant="body2" weight="medium">
                                            {formatDate(selectedTrip.tanggal)}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Supir</Typography>
                                        <Typography variant="body2" weight="medium">
                                            {selectedTrip.supir_nama || selectedTrip.supir?.nama || selectedTrip.supir_nama_manual || '-'}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Jenis Muatan</Typography>
                                        <Typography variant="body2" weight="medium" className="text-right flex-1 ml-4">
                                            {selectedTrip.jenis_muatan || 'Muatan Umum'}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Typography variant="caption" className="text-textGray">Ritase</Typography>
                                        <Typography variant="body2" weight="medium">
                                            {selectedTrip.ritase || 0} Rit
                                        </Typography>
                                    </View>
                                </Card>

                                <Card variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                    <Typography variant="caption" weight="bold" className="text-slate-500 mb-4 uppercase tracking-widest">
                                        Ringkasan Keuangan
                                    </Typography>

                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Pendapatan Kotor</Typography>
                                        <Typography variant="body2" weight="bold">
                                            {formatCurrency(selectedTrip.pendapatan_kotor || 0)}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Hak Supir</Typography>
                                        <Typography variant="body2" weight="medium" className="text-orange-600">
                                            {formatCurrency(selectedTrip.laba_supir || 0)}
                                        </Typography>
                                    </View>
                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Total Biaya</Typography>
                                        <Typography variant="body2" weight="medium" className="text-red-600">
                                            {formatCurrency(selectedTrip.total_biaya || 0)}
                                        </Typography>
                                    </View>
                                    <View className="h-[1px] bg-gray-100 my-2" />
                                    <View className="flex-row justify-between">
                                        <Typography variant="body2" weight="bold" className="text-primary">Laba TPM</Typography>
                                        <Typography variant="body1" weight="bold" className="text-primary">
                                            {formatCurrency(selectedTrip.laba_tpm || 0)}
                                        </Typography>
                                    </View>
                                </Card>

                                <Card variant="outlined" className="p-5 border-gray-100 rounded-[24px]">
                                    <Typography variant="caption" weight="bold" className="text-slate-500 mb-4 uppercase tracking-widest">
                                        Status
                                    </Typography>
                                    <View className="flex-row gap-2 mb-3">
                                        <Badge
                                            label={(selectedTrip.status || '-').toUpperCase()}
                                            variant={selectedTrip.status === 'SELESAI' ? 'success' : 'info'}
                                        />
                                        <Badge
                                            label={(selectedTrip.status_bayar || '-').toUpperCase()}
                                            variant={selectedTrip.status_bayar === 'LUNAS' ? 'success' : 'warning'}
                                        />
                                    </View>
                                    {selectedTrip.catatan ? (
                                        <View>
                                            <Typography variant="caption" className="text-textGray mb-1">Catatan</Typography>
                                            <Typography variant="body2">{selectedTrip.catatan}</Typography>
                                        </View>
                                    ) : null}
                                </Card>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal Detail Perbaikan */}
            <Modal
                visible={!!selectedRepair}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedRepair(null)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[85%]">
                        {selectedRepair && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="flex-row justify-between items-start mb-6">
                                    <View className="flex-1 pr-4">
                                        <Typography variant="h3" weight="bold" className="text-textMain">
                                            Detail Perbaikan
                                        </Typography>
                                        <Typography variant="caption" className="text-textGray mt-1">
                                            #{selectedRepair.nomor_transaksi}
                                        </Typography>
                                    </View>
                                    <Pressable
                                        onPress={() => setSelectedRepair(null)}
                                        className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
                                    >
                                        <CloseIcon size={20} color="#475569" />
                                    </Pressable>
                                </View>

                                <Card variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                    <Typography variant="caption" weight="bold" className="text-red-500 mb-4 uppercase tracking-widest">
                                        Informasi Perbaikan
                                    </Typography>

                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Tanggal</Typography>
                                        <Typography variant="body2" weight="medium">
                                            {formatDate(selectedRepair.tanggal)}
                                        </Typography>
                                    </View>

                                    {selectedRepair.muatan_nomor && (
                                        <View className="flex-row justify-between mb-3">
                                            <Typography variant="caption" className="text-textGray">Dibebankan ke</Typography>
                                            <Typography variant="body2" weight="medium" className="text-blue-600">
                                                {selectedRepair.muatan_nomor}
                                            </Typography>
                                        </View>
                                    )}

                                    <View className="h-[1px] bg-gray-100 my-2" />
                                    <View className="flex-row justify-between">
                                        <Typography variant="body2" weight="bold" className="text-primary">Total Biaya</Typography>
                                        <Typography variant="body1" weight="bold" className="text-red-600">
                                            {formatCurrency(selectedRepair.grand_total || 0)}
                                        </Typography>
                                    </View>
                                </Card>

                                {selectedRepair.detail_services?.length > 0 && (
                                    <Card variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-4 uppercase tracking-widest">
                                            Jasa
                                        </Typography>
                                        {selectedRepair.detail_services.map((service: any, idx: number) => (
                                            <View key={`service-${idx}`} className="flex-row justify-between py-2 border-b border-gray-50 last:border-b-0">
                                                <Typography variant="body2" className="flex-1 mr-4">
                                                    {service.nama_jasa}
                                                </Typography>
                                                <Typography variant="body2" weight="medium">
                                                    {formatCurrency(service.subtotal || 0)}
                                                </Typography>
                                            </View>
                                        ))}
                                    </Card>
                                )}

                                {selectedRepair.detail_parts?.length > 0 && (
                                    <Card variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-4 uppercase tracking-widest">
                                            Sparepart
                                        </Typography>
                                        {selectedRepair.detail_parts.map((part: any, idx: number) => (
                                            <View key={`part-${idx}`} className="flex-row justify-between py-2 border-b border-gray-50 last:border-b-0">
                                                <View className="flex-1 mr-4">
                                                    <Typography variant="body2">{part.spare_part_nama}</Typography>
                                                    <Typography variant="caption" className="text-textGray">
                                                        {part.qty || 0} x {formatCurrency(part.harga_satuan || 0)}
                                                    </Typography>
                                                </View>
                                                <Typography variant="body2" weight="medium">
                                                    {formatCurrency(part.subtotal || 0)}
                                                </Typography>
                                            </View>
                                        ))}
                                    </Card>
                                )}

                                {selectedRepair.catatan ? (
                                    <Card variant="outlined" className="p-5 border-gray-100 rounded-[24px]">
                                        <Typography variant="caption" weight="bold" className="text-slate-500 mb-3 uppercase tracking-widest">
                                            Catatan
                                        </Typography>
                                        <Typography variant="body2">{selectedRepair.catatan}</Typography>
                                    </Card>
                                ) : null}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal Detail Biaya Operasional */}
            <Modal
                visible={!!selectedExpense}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedExpense(null)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[32px] p-6 pb-10 max-h-[85%]">
                        {selectedExpense && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="flex-row justify-between items-start mb-6">
                                    <View className="flex-1 pr-4">
                                        <Typography variant="h3" weight="bold" className="text-textMain">
                                            Detail Biaya Operasional
                                        </Typography>
                                        <Typography variant="caption" className="text-textGray mt-1">
                                            {selectedExpense.type === 'WORKSHOP'
                                                ? 'Biaya Bengkel'
                                                : selectedExpense.type === 'TRIP'
                                                    ? 'Biaya dari Trip'
                                                    : 'Biaya Umum Armada'}
                                        </Typography>
                                    </View>
                                    <Pressable
                                        onPress={() => setSelectedExpense(null)}
                                        className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
                                    >
                                        <CloseIcon size={20} color="#475569" />
                                    </Pressable>
                                </View>

                                <Card variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                    <Typography variant="caption" weight="bold" className="text-slate-500 mb-4 uppercase tracking-widest">
                                        Informasi Biaya
                                    </Typography>

                                    <View className="mb-4">
                                        <Typography variant="caption" className="text-textGray mb-1">Deskripsi</Typography>
                                        <Typography variant="body1" weight="bold">
                                            {selectedExpense.display_deskripsi}
                                        </Typography>
                                    </View>

                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Tanggal</Typography>
                                        <Typography variant="body2" weight="medium">
                                            {formatDate(selectedExpense.tanggal)}
                                        </Typography>
                                    </View>

                                    <View className="flex-row justify-between mb-3">
                                        <Typography variant="caption" className="text-textGray">Kategori</Typography>
                                        <Typography variant="body2" weight="medium" className="text-right">
                                            {selectedExpense.display_sub || selectedExpense.kategori || '-'}
                                        </Typography>
                                    </View>

                                    <View className="h-[1px] bg-gray-100 my-2" />
                                    <View className="flex-row justify-between">
                                        <Typography variant="body2" weight="bold" className="text-primary">Nominal</Typography>
                                        <Typography variant="body1" weight="bold" className="text-primary">
                                            {formatCurrency(selectedExpense.jumlah || 0)}
                                        </Typography>
                                    </View>
                                </Card>

                                {selectedExpense.type === 'WORKSHOP' && (
                                    <Card variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                        <Typography variant="caption" weight="bold" className="text-red-500 mb-4 uppercase tracking-widest">
                                            Sumber Bengkel
                                        </Typography>
                                        <View className="flex-row justify-between mb-3">
                                            <Typography variant="caption" className="text-textGray">No. Transaksi</Typography>
                                            <Typography variant="body2" weight="medium">
                                                {selectedExpense.nomor_transaksi || '-'}
                                            </Typography>
                                        </View>
                                        {selectedExpense.deskripsi && (
                                            <View>
                                                <Typography variant="caption" className="text-textGray mb-1">Keterangan</Typography>
                                                <Typography variant="body2">{selectedExpense.deskripsi}</Typography>
                                            </View>
                                        )}
                                    </Card>
                                )}

                                {selectedExpense.type === 'TRIP' && (
                                    <Card variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                                        <Typography variant="caption" weight="bold" className="text-blue-500 mb-4 uppercase tracking-widest">
                                            Sumber Trip
                                        </Typography>
                                        <View className="flex-row justify-between mb-3">
                                            <Typography variant="caption" className="text-textGray">No. Muatan</Typography>
                                            <Typography variant="body2" weight="medium">
                                                {selectedExpense.display_sub || '-'}
                                            </Typography>
                                        </View>
                                        {selectedExpense.muatan_tujuan && (
                                            <View className="flex-row justify-between mb-3">
                                                <Typography variant="caption" className="text-textGray">Tujuan</Typography>
                                                <Typography variant="body2" weight="medium">
                                                    {selectedExpense.muatan_tujuan}
                                                </Typography>
                                            </View>
                                        )}
                                        <Typography variant="caption" className="text-textGray">
                                            Biaya ini dicatat langsung dari form muatan sebagai biaya operasional trip.
                                        </Typography>
                                    </Card>
                                )}

                                {selectedExpense.type === 'GENERAL' && (
                                    <Card variant="outlined" className="p-5 border-gray-100 rounded-[24px]">
                                        <Typography variant="caption" weight="bold" className="text-orange-500 mb-4 uppercase tracking-widest">
                                            Catatan
                                        </Typography>
                                        {selectedExpense.catatan ? (
                                            <Typography variant="body2">{selectedExpense.catatan}</Typography>
                                        ) : (
                                            <Typography variant="caption" className="text-textGray italic">Tidak ada catatan tambahan.</Typography>
                                        )}
                                    </Card>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal Tambah Biaya */}
            <Modal
                visible={showExpenseModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowExpenseModal(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-[32px] p-6 pb-12">
                        <View className="flex-row justify-between items-center mb-6">
                            <Typography variant="h3" weight="bold">Input Biaya Operasional</Typography>
                            <Pressable
                                onPress={toggleSplitPayment}
                                className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                            >
                                <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                                    {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                                </Typography>
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[70vh]" showsVerticalScrollIndicator={false}>
                            <View className="space-y-4">
                                <Input
                                    label="Deskripsi"
                                    placeholder="Contoh: Ganti Oli, Pajak, Cuci Mobil"
                                    value={expenseForm.deskripsi}
                                    onChangeText={v => setExpenseForm(prev => ({ ...prev, deskripsi: v }))}
                                />

                                {isSplitPayment ? (
                                    <View className="mb-4">
                                        <View className="flex-row justify-between items-center mb-3">
                                            <Typography variant="caption" weight="bold" className="text-gray-400 uppercase tracking-widest">Alokasi Pembayaran</Typography>
                                            <Pressable onPress={addPaymentRow} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-xl">
                                                <PlusCircle size={14} color="#023C69" />
                                                <Typography className="text-primary text-[10px] ml-1.5 font-bold uppercase">Tambah</Typography>
                                            </Pressable>
                                        </View>

                                        {payments.map((p, idx) => (
                                            <View key={p.id} className="mb-3 p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                                                <View className="flex-row justify-between items-center mb-3">
                                                    <Typography variant="caption" weight="bold" className="text-primary">Metode #{idx + 1}</Typography>
                                                    <Pressable onPress={() => removePaymentRow(p.id)} className="w-6 h-6 items-center justify-center bg-red-50 rounded-full">
                                                        <Trash2 size={12} color="#EF4444" />
                                                    </Pressable>
                                                </View>

                                                <View className="flex-row flex-wrap gap-2 mb-3">
                                                    {[
                                                        { label: 'Tunai Jasa Angkut', value: 'UNIT_TUNAI' },
                                                        { label: 'Tunai Utama', value: 'UTAMA_TUNAI' },
                                                        { label: 'Transfer', value: 'UTAMA_TRANSFER' }
                                                    ].map((m) => (
                                                        <Pressable
                                                            key={m.value}
                                                            onPress={() => updatePaymentRow(p.id, 'sumber', m.value)}
                                                            className={`px-3 py-1.5 rounded-xl border ${p.sumber === m.value ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'}`}
                                                        >
                                                            <Typography variant="caption" weight={p.sumber === m.value ? 'bold' : 'medium'} className={p.sumber === m.value ? 'text-primary' : 'text-textGray'}>{m.label}</Typography>
                                                        </Pressable>
                                                    ))}
                                                </View>

                                                <Input
                                                    placeholder="Nominal Rp"
                                                    keyboardType="numeric"
                                                    value={p.nominal}
                                                    containerClassName="mb-0"
                                                    onChangeText={(t) => updatePaymentRow(p.id, 'nominal', t)}
                                                />
                                            </View>
                                        ))}

                                        <View className="flex-row justify-between items-center p-4 bg-primary/5 rounded-[20px] mt-2 border border-primary/10">
                                            <Typography variant="caption" weight="bold" className="text-primary uppercase tracking-widest">Total Biaya</Typography>
                                            <Typography variant="h3" weight="bold" className="text-primary">{formatCurrency(totalSplitAmount)}</Typography>
                                        </View>
                                    </View>
                                ) : (
                                    <View className="space-y-4">
                                        <View>
                                            <Typography variant="caption" className="text-textGray mb-2 font-medium ml-1">Metode & Akun</Typography>
                                            <View className="flex-row flex-wrap gap-2">
                                                {[
                                                    { label: 'Tunai Jasa Angkut', value: 'UNIT_TUNAI' },
                                                    { label: 'Tunai Utama', value: 'UTAMA_TUNAI' },
                                                    { label: 'Transfer', value: 'UTAMA_TRANSFER' }
                                                ].map((m) => (
                                                    <Pressable
                                                        key={m.value}
                                                        onPress={() => setExpenseForm(prev => ({ ...prev, metode_bayar: m.value }))}
                                                        className={`px-4 py-2 rounded-xl border ${expenseForm.metode_bayar === m.value ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'}`}
                                                    >
                                                        <Typography variant="caption" weight="bold" className={expenseForm.metode_bayar === m.value ? 'text-primary' : 'text-gray-400'}>{m.label}</Typography>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        </View>
                                        <Input
                                            label="Jumlah (Rp)"
                                            keyboardType="numeric"
                                            startIcon={<Typography weight="bold" className="text-gray-400">Rp</Typography>}
                                            value={expenseForm.jumlah}
                                            onChangeText={v => setExpenseForm(prev => ({ ...prev, jumlah: formatNumber(v) }))}
                                        />
                                    </View>
                                )}

                                <Input
                                    label="Tanggal (YYYY-MM-DD)"
                                    value={expenseForm.tanggal}
                                    onChangeText={v => setExpenseForm(prev => ({ ...prev, tanggal: v }))}
                                />
                                <Input
                                    label="Catatan (Opsional)"
                                    multiline
                                    value={expenseForm.catatan}
                                    onChangeText={v => setExpenseForm(prev => ({ ...prev, catatan: v }))}
                                />

                                <Button
                                    title={submittingExpense ? "Menyimpan..." : "Simpan Biaya"}
                                    onPress={handleAddExpense}
                                    disabled={submittingExpense || !expenseForm.deskripsi || (isSplitPayment ? (payments.length === 0 || totalSplitAmount <= 0) : !expenseForm.jumlah)}
                                    className="mt-4"
                                />
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};
