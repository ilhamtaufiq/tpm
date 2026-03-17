import React, { useState, useMemo, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, Platform, Modal, StyleSheet } from 'react-native';
import { Typography } from './ui/Typography';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Plus, Trash2, X, Banknote, CreditCard, Wallet, CircleDollarSign } from 'lucide-react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useProcessPaymentSplit, useProcessHutangPaymentSplit } from '../hooks/useKeuangan';
import { getErrorMessage } from '../utils/error';

interface PaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    id: number;
    initialAmount: number;
    title?: string;
    allowedMethods?: string[];
    type?: 'piutang' | 'hutang';
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    visible,
    onClose,
    onSuccess,
    id,
    initialAmount,
    title = 'Catat Pembayaran',
    allowedMethods,
    type = 'piutang'
}) => {
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([
        { id: Date.now(), metode: '', nominal: formatNumber(initialAmount.toString()), catatan: '' }
    ]);
    const [paymentNote, setPaymentNote] = useState('');
    const [loading, setLoading] = useState(false);

    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const piutangMutation = useProcessPaymentSplit();
    const hutangMutation = useProcessHutangPaymentSplit();

    const currentMutation = type === 'piutang' ? piutangMutation : hutangMutation;

    const totalBayar = useMemo(() =>
        payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0)
        , [payments]);

    const sisaSetelahBayar = initialAmount - totalBayar;

    const addPayment = () => {
        setPayments([...payments, { id: Date.now(), metode: '', nominal: '', catatan: '' }]);
        setIsSplitPayment(true);
    };

    const removePayment = (id: number) => {
        const newPayments = payments.filter(p => p.id !== id);
        setPayments(newPayments);
        if (newPayments.length <= 1) setIsSplitPayment(false);
    };

    const updatePayment = (id: number, field: string, value: any) => {
        setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleSubmit = async () => {
        const validatedPayments = payments
            .map(p => ({
                metode: p.metode as any,
                nominal: parseNumber(p.nominal),
                catatan: p.catatan || undefined
            }))
            .filter(p => p.nominal > 0);

        const hasEmptyMethod = payments.some(p => !p.metode && parseNumber(p.nominal) > 0);
        if (hasEmptyMethod) {
            alert('Silakan pilih metode pembayaran untuk semua nominal yang diinput');
            return;
        }

        if (validatedPayments.length === 0) {
            return;
        }

        try {
            setLoading(true);
            const payload: any = {
                tanggal: new Date().toISOString().split('T')[0],
                payments: validatedPayments,
                catatan: paymentNote || undefined,
            };

            if (type === 'piutang') {
                payload.piutang_id = id;
            } else {
                payload.hutang_id = id;
            }

            await currentMutation.mutateAsync(payload);
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            alert(getErrorMessage(error, 'Gagal mencatat pembayaran'));
        } finally {
            setLoading(false);
        }
    };

    const renderContent = () => (
        <View className="px-8 py-4">
            <View className="flex-row justify-between items-center mb-6">
                <View>
                    <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">{title}</Typography>
                    <Typography variant="caption" className="text-gray-500 font-medium">Selesaikan kewajiban pembayaran</Typography>
                </View>
                <TouchableOpacity
                    onPress={() => setIsSplitPayment(!isSplitPayment)}
                    className={`px-4 py-2 rounded-2xl border ${isSplitPayment ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
                >
                    <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'} uppercase tracking-widest`}>
                        {isSplitPayment ? 'Split On' : 'Split Off'}
                    </Typography>
                </TouchableOpacity>
            </View>

            <Card variant="outlined" className="p-6 mb-8 border-primary/20 bg-primary/5 rounded-[32px]">
                <View className="flex-row items-center mb-4">
                    <View className="w-12 h-12 bg-primary/10 rounded-2xl items-center justify-center mr-4">
                        <Banknote size={24} color="#023C69" />
                    </View>
                    <View className="flex-1">
                        <Typography variant="caption" className="text-primary/60 font-bold uppercase tracking-[2px] text-[9px] mb-1">Tagihan Tersisa</Typography>
                        <Typography variant="h2" weight="bold" className="text-primary text-2xl tracking-tighter">{formatCurrency(initialAmount)}</Typography>
                    </View>
                </View>
                
                {totalBayar > 0 && (
                    <View className="mt-4 pt-4 border-t border-primary/10">
                        <View className="flex-row justify-between items-center mb-2">
                            <Typography variant="caption" className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Total Input</Typography>
                            <Typography variant="body2" weight="bold" className="text-textMain">{formatCurrency(totalBayar)}</Typography>
                        </View>
                        <View className="flex-row justify-between items-center">
                            <Typography variant="caption" className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">Sisa Akhir</Typography>
                            <Typography variant="body1" weight="bold" className={sisaSetelahBayar < 0 ? "text-rose-600" : "text-primary"}>
                                {formatCurrency(Math.max(0, sisaSetelahBayar))}
                            </Typography>
                        </View>
                    </View>
                )}
            </Card>

            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-4 px-1">
                    <Typography variant="caption" weight="bold" className="text-gray-400 uppercase tracking-widest text-[10px]">Rincian Pembayaran</Typography>
                    {isSplitPayment && (
                        <TouchableOpacity 
                            onPress={addPayment} 
                            className="bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10 flex-row items-center"
                        >
                            <Plus size={14} color="#023C69" />
                            <Typography className="text-primary text-[10px] ml-1.5 font-bold uppercase">Tambah</Typography>
                        </TouchableOpacity>
                    )}
                </View>

                {payments.map((p, idx) => (
                    <Card key={p.id} variant="outlined" className="p-6 mb-4 border-gray-100 rounded-[28px]">
                        <View className="flex-row items-center justify-between mb-5">
                            <View className="bg-gray-100 px-3 py-1 rounded-lg">
                                <Typography weight="bold" className="text-gray-500 text-[9px] uppercase tracking-widest">Entry #{idx + 1}</Typography>
                            </View>
                            {payments.length > 1 && (
                                <TouchableOpacity 
                                    onPress={() => removePayment(p.id)} 
                                    className="w-9 h-9 items-center justify-center bg-rose-50 rounded-xl"
                                >
                                    <Trash2 size={16} color="#EF4444" strokeWidth={2.5} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View className="flex-row space-x-2 gap-2 mb-5">
                            {(allowedMethods || ['TUNAI', 'TRANSFER', 'DEBIT', 'KREDIT']).map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => updatePayment(p.id, 'metode', m)}
                                    className={`flex-1 py-3.5 items-center rounded-2xl border ${p.metode === m ? 'border-primary bg-primary shadow-md shadow-primary/20' : 'border-gray-50 bg-gray-50'}`}
                                >
                                    <Typography 
                                        variant="caption" 
                                        weight="bold" 
                                        className={p.metode === m ? 'text-white' : 'text-gray-400'}
                                    >
                                        {m}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Input
                            label="Nominal Pembayaran (Rp)"
                            placeholder="0"
                            keyboardType="numeric"
                            containerClassName="mb-4"
                            value={p.nominal}
                            onChangeText={(t) => updatePayment(p.id, 'nominal', formatNumber(t))}
                            startIcon={<CircleDollarSign size={18} color="#9CA3AF" />}
                        />

                        {isSplitPayment && (
                            <Input
                                label="Catatan Kecil"
                                placeholder="..."
                                value={p.catatan}
                                onChangeText={(t) => updatePayment(p.id, 'catatan', t)}
                                containerClassName="mb-0"
                                startIcon={<X size={14} color="#9CA3AF" />}
                            />
                        )}
                    </Card>
                ))}

                {!isSplitPayment && (
                    <TouchableOpacity
                        onPress={addPayment}
                        className="w-full py-5 border-2 border-dashed border-gray-200 rounded-3xl items-center justify-center flex-row bg-gray-50/30"
                    >
                        <Plus size={18} color="#9CA3AF" />
                        <Typography className="text-gray-400 font-bold ml-2 text-xs uppercase tracking-widest">Gunakan Split Payment</Typography>
                    </TouchableOpacity>
                )}
            </View>

            <Input
                label="Catatan Pembayaran"
                placeholder="Tambahkan keterangan transaksi (opsional)..."
                value={paymentNote}
                onChangeText={setPaymentNote}
                multiline
                numberOfLines={2}
                style={{ height: 60, textAlignVertical: 'top' }}
                containerClassName="mb-10"
            />

            <View className="flex-row gap-4 mb-10">
                <Button
                    variant="outline"
                    title="Batal"
                    onPress={onClose}
                    className="flex-1 h-14 rounded-2xl border-gray-200"
                />
                <Button
                    title={loading ? 'Memproses...' : 'Konfirmasi & Simpan'}
                    onPress={handleSubmit}
                    disabled={loading || totalBayar <= 0}
                    loading={loading}
                    className="flex-[2] h-14 rounded-2xl bg-primary shadow-xl shadow-primary/30"
                />
            </View>
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
                <View className="flex-1 justify-end bg-black/40">
                    <TouchableOpacity className="absolute inset-0" onPress={onClose} />
                    <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[85%] self-center p-0 overflow-hidden shadow-2xl relative">
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                        <ScrollView className="flex-1">
                            {renderContent()}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <BottomSheet
            ref={sheetRef}
            index={visible ? 0 : -1}
            snapPoints={snapPoints}
            enablePanDownToClose
            onClose={onClose}
            backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
        >
            <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                {renderContent()}
            </BottomSheetScrollView>
        </BottomSheet>
    );
};
