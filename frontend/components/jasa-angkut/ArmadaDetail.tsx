import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from 'react-native';
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
    PlusCircle
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
    const [submittingExpense, setSubmittingExpense] = useState(false);
    const [expenseForm, setExpenseForm] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        deskripsi: '',
        jumlah: '',
        catatan: '',
        metode_bayar: 'TUNAI'
    });
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string }[]>([]);

    const totalSplitAmount = payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0);

    const addPaymentRow = () => {
        setPayments([...payments, { id: Date.now(), metode: 'TUNAI', nominal: '' }]);
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
            setPayments([{ id: Date.now(), metode: expenseForm.metode_bayar, nominal: expenseForm.jumlah }]);
        } else {
            setExpenseForm(prev => ({ ...prev, jumlah: formatNumber(totalSplitAmount.toString()) }));
        }
        setIsSplitPayment(!isSplitPayment);
    };

    const handleAddExpense = async () => {
        if (!expenseForm.deskripsi || !expenseForm.jumlah) return;
        try {
            setSubmittingExpense(true);
            const finalAmount = isSplitPayment ? totalSplitAmount : parseNumber(expenseForm.jumlah);
            await jasaAngkutService.addArmadaExpense(id, {
                ...expenseForm,
                jumlah: finalAmount,
                payments: isSplitPayment ? payments.map(p => ({
                    metode: p.metode,
                    nominal: parseNumber(p.nominal)
                })).filter(p => p.nominal > 0) : []
            });
            setShowExpenseModal(false);
            setExpenseForm({
                tanggal: new Date().toISOString().split('T')[0],
                deskripsi: '',
                jumlah: '',
                catatan: '',
                metode_bayar: 'TUNAI'
            });
            setPayments([]);
            setIsSplitPayment(false);
            refetch();
        } catch (error) {
            console.error(error);
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

    if (!detailData) {
        return (
            <View className="p-10 items-center justify-center">
                <Typography className="text-gray-400">Data tidak tersedia</Typography>
            </View>
        );
    }

    const { armada, stats, muatan_history = [], perbaikan_history = [], general_expenses = [] } = detailData || {};

    if (!armada || !stats) {
        return (
            <View className="p-10 items-center justify-center">
                <Typography className="text-gray-400">Data armada tidak lengkap</Typography>
            </View>
        );
    }

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
                    <TouchableOpacity
                        onPress={() => setActiveTab('trips')}
                        className={`flex-1 py-3 rounded-xl items-center flex-row justify-center space-x-2 ${activeTab === 'trips' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Clock size={16} color={activeTab === 'trips' ? '#023C69' : '#94A3B8'} />
                        <Typography weight={activeTab === 'trips' ? 'bold' : 'medium'} className={activeTab === 'trips' ? 'text-primary' : 'text-gray-400'}>
                            Riwayat Trip
                        </Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('repairs')}
                        className={`flex-1 py-3 rounded-xl items-center flex-row justify-center space-x-2 ${activeTab === 'repairs' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Wrench size={16} color={activeTab === 'repairs' ? '#023C69' : '#94A3B8'} />
                        <Typography weight={activeTab === 'repairs' ? 'bold' : 'medium'} className={activeTab === 'repairs' ? 'text-primary' : 'text-gray-400'}>
                            Perbaikan
                        </Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('expenses')}
                        className={`flex-1 py-3 rounded-xl items-center flex-row justify-center space-x-2 ${activeTab === 'expenses' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <DollarSign size={16} color={activeTab === 'expenses' ? '#023C69' : '#94A3B8'} />
                        <Typography weight={activeTab === 'expenses' ? 'bold' : 'medium'} className={activeTab === 'expenses' ? 'text-primary' : 'text-gray-400'}>
                            Biaya Ops
                        </Typography>
                    </TouchableOpacity>
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
                                            <View key={trip.id} className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm flex-row items-center">
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
                                            </View>
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
                                            <View key={item.id} className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm">
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
                                            </View>
                                        ))
                                    )}
                                </View>
                            );
                        case 'expenses':
                            return (
                                <View className="space-y-4 pb-10">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Typography weight="bold" className="text-gray-500">Daftar Biaya Operasional</Typography>
                                        <TouchableOpacity
                                            onPress={() => setShowExpenseModal(true)}
                                            className="bg-primary px-3 py-1.5 rounded-xl flex-row items-center"
                                        >
                                            <Plus size={14} color="white" />
                                            <Typography variant="caption" weight="bold" className="text-white ml-1.5">Tambah</Typography>
                                        </TouchableOpacity>
                                    </View>

                                    {general_expenses.length === 0 ? (
                                        <View className="py-20 items-center">
                                            <Typography className="text-gray-400 italic">Belum ada biaya operasional tercatat</Typography>
                                        </View>
                                    ) : (
                                        general_expenses.map((expense: any) => (
                                            <View key={expense.id} className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm flex-row items-center">
                                                <View className="w-10 h-10 bg-orange-50 rounded-xl items-center justify-center mr-4">
                                                    <TrendingDown size={20} color="#F59E0B" />
                                                </View>
                                                <View className="flex-1">
                                                    <View className="flex-row justify-between items-start">
                                                        <Typography weight="bold" className="text-textMain flex-1 mr-2">{expense.deskripsi}</Typography>
                                                        <Typography weight="bold" className="text-orange-600">{formatCurrency(expense.jumlah)}</Typography>
                                                    </View>
                                                    <Typography variant="caption" className="text-textGray mt-0.5">
                                                        {formatDate(expense.created_at)}
                                                    </Typography>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            );
                        default:
                            return null;
                    }
                })()}
            </View>

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
                            <TouchableOpacity
                                onPress={toggleSplitPayment}
                                className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                            >
                                <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                                    {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                                </Typography>
                            </TouchableOpacity>
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
                                            <TouchableOpacity onPress={addPaymentRow} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-xl">
                                                <PlusCircle size={14} color="#023C69" />
                                                <Typography className="text-primary text-[10px] ml-1.5 font-bold uppercase">Tambah</Typography>
                                            </TouchableOpacity>
                                        </View>

                                        {payments.map((p, idx) => (
                                            <View key={p.id} className="mb-3 p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                                                <View className="flex-row justify-between items-center mb-3">
                                                    <Typography variant="caption" weight="bold" className="text-primary">Metode #{idx + 1}</Typography>
                                                    <TouchableOpacity onPress={() => removePaymentRow(p.id)} className="w-6 h-6 items-center justify-center bg-red-50 rounded-full">
                                                        <Trash2 size={12} color="#EF4444" />
                                                    </TouchableOpacity>
                                                </View>

                                                <View className="flex-row flex-wrap gap-2 mb-3">
                                                    {['TUNAI', 'TRANSFER'].map((m) => (
                                                        <TouchableOpacity
                                                            key={m}
                                                            onPress={() => updatePaymentRow(p.id, 'metode', m)}
                                                            className={`px-3 py-1.5 rounded-xl border ${p.metode === m ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'}`}
                                                        >
                                                            <Typography variant="caption" weight={p.metode === m ? 'bold' : 'medium'} className={p.metode === m ? 'text-primary' : 'text-textGray'}>{m}</Typography>
                                                        </TouchableOpacity>
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
                                            <Typography variant="caption" className="text-textGray mb-2 font-medium ml-1">Metode Bayar</Typography>
                                            <View className="flex-row flex-wrap gap-2">
                                                {['TUNAI', 'TRANSFER'].map((m) => (
                                                    <TouchableOpacity
                                                        key={m}
                                                        onPress={() => setExpenseForm(prev => ({ ...prev, metode_bayar: m }))}
                                                        className={`px-4 py-2 rounded-xl border ${expenseForm.metode_bayar === m ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'}`}
                                                    >
                                                        <Typography variant="caption" weight="bold" className={expenseForm.metode_bayar === m ? 'text-primary' : 'text-gray-400'}>{m}</Typography>
                                                    </TouchableOpacity>
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
                                    disabled={submittingExpense || !expenseForm.deskripsi || (isSplitPayment ? totalSplitAmount <= 0 : !expenseForm.jumlah)}
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
