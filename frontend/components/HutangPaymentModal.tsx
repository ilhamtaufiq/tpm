import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, ScrollView, Platform, Modal } from 'react-native';
import { Typography } from './ui/Typography';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Plus, Trash2, X } from 'lucide-react-native';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useProcessHutangPaymentSplit } from '../hooks/useKeuangan';
import { getErrorMessage } from '../utils/error';

interface HutangPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    hutangId: number;
    initialAmount: number;
    title?: string;
    allowedMethods?: string[];
}

export const HutangPaymentModal: React.FC<HutangPaymentModalProps> = ({
    visible,
    onClose,
    onSuccess,
    hutangId,
    initialAmount,
    title = 'Pelunasan Hutang Unit',
    allowedMethods
}) => {
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([
        { id: Date.now(), metode: 'TUNAI', nominal: formatNumber(initialAmount.toString()), catatan: '' }
    ]);
    const [paymentNote, setPaymentNote] = useState('');
    const [loading, setLoading] = useState(false);

    const paymentMutation = useProcessHutangPaymentSplit();

    const totalBayar = useMemo(() =>
        payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0)
        , [payments]);

    const sisaSetelahBayar = initialAmount - totalBayar;

    const addPayment = () => {
        setPayments([...payments, { id: Date.now(), metode: 'TUNAI', nominal: '', catatan: '' }]);
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

        if (validatedPayments.length === 0) {
            return;
        }

        try {
            setLoading(true);
            await paymentMutation.mutateAsync({
                hutang_id: hutangId,
                tanggal: new Date().toISOString().split('T')[0],
                payments: validatedPayments,
                catatan: paymentNote || undefined,
            });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            alert(getErrorMessage(error, 'Gagal mencatat pembayaran pelunasan'));
        } finally {
            setLoading(false);
        }
    };

    const content = (
        <View className="flex-1 bg-white rounded-t-[40px] p-8">
            <View className="flex-row justify-between items-center mb-6">
                <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">{title}</Typography>
                <TouchableOpacity
                    onPress={() => setIsSplitPayment(!isSplitPayment)}
                    className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                >
                    <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                        {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                    </Typography>
                </TouchableOpacity>
            </View>

            <Card variant="outlined" className="p-6 mb-8 border-primary/10 bg-primary/5 rounded-[32px]">
                <View className="flex-row justify-between mb-2">
                    <Typography variant="caption" className="text-primary/60 font-bold uppercase tracking-widest">Sisa Hutang</Typography>
                    <Typography variant="body2" weight="bold" className="text-rose-600 font-bold">{formatCurrency(initialAmount)}</Typography>
                </View>
                <View className="flex-row justify-between">
                    <Typography variant="caption" className="text-primary/60 font-bold uppercase tracking-widest">Sisa Setelah Bayar</Typography>
                    <Typography variant="body2" weight="bold" className={sisaSetelahBayar < 0 ? "text-rose-600" : "text-primary"}>
                        {formatCurrency(Math.max(0, sisaSetelahBayar))}
                    </Typography>
                </View>
                {totalBayar > 0 && (
                    <View className="mt-4 pt-4 border-t border-primary/10">
                        <View className="flex-row justify-between">
                            <Typography variant="body2" weight="bold" className="text-primary">Total Pelunasan</Typography>
                            <Typography variant="body1" weight="bold" className="text-primary">{formatCurrency(totalBayar)}</Typography>
                        </View>
                    </View>
                )}
            </Card>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <Typography variant="caption" weight="bold" className="text-gray-400 uppercase tracking-widest">Daftar Pembayaran</Typography>
                        {isSplitPayment && (
                            <TouchableOpacity onPress={addPayment} className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10">
                                <Plus size={14} color="#023C69" />
                                <Typography className="text-primary text-[10px] ml-1.5 font-bold uppercase">Tambah</Typography>
                            </TouchableOpacity>
                        )}
                    </View>

                    {payments.map((p, idx) => (
                        <Card key={p.id} variant="outlined" className="p-5 mb-4 border-gray-100 rounded-[24px]">
                            <View className="flex-row items-center justify-between mb-4">
                                <Typography variant="caption" weight="bold" className="text-primary">Pembayaran #{idx + 1}</Typography>
                                {payments.length > 1 && (
                                    <TouchableOpacity onPress={() => removePayment(p.id)} className="w-8 h-8 items-center justify-center bg-rose-50 rounded-xl">
                                        <Trash2 size={16} color="#EF4444" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View className="flex-row space-x-2 mb-4">
                                {(allowedMethods || ['TUNAI', 'TRANSFER', 'DEBIT', 'KREDIT']).map((m) => (
                                    <TouchableOpacity
                                        key={m}
                                        onPress={() => updatePayment(p.id, 'metode', m)}
                                        className={`flex-1 py-3 items-center rounded-2xl border ${p.metode === m ? 'border-primary bg-primary/10' : 'border-gray-100 bg-white'}`}
                                    >
                                        <Typography variant="caption" weight={p.metode === m ? 'bold' : 'medium'} className={p.metode === m ? 'text-primary' : 'text-textGray'}>{m}</Typography>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Input
                                label="Nominal"
                                placeholder="0"
                                keyboardType="numeric"
                                containerClassName="mb-1"
                                value={p.nominal}
                                onChangeText={(t) => updatePayment(p.id, 'nominal', formatNumber(t))}
                            />
                        </Card>
                    ))}
                </View>

                <Input
                    label="Catatan Pembayaran (Opsional)"
                    placeholder="Keterangan tambahan"
                    value={paymentNote}
                    onChangeText={setPaymentNote}
                    multiline
                    numberOfLines={3}
                    style={{ height: 80, textAlignVertical: 'top' }}
                />

                <View className="flex-row gap-4 mt-4 mb-10">
                    <Button
                        variant="outline"
                        title="Batal"
                        onPress={onClose}
                        className="flex-1 h-14 rounded-2xl"
                    />
                    <Button
                        title={loading ? 'Memproses...' : 'Bayar Lunas'}
                        onPress={handleSubmit}
                        disabled={loading || totalBayar <= 0}
                        loading={loading}
                        className="flex-1 h-14 rounded-2xl"
                    />
                </View>
            </ScrollView>
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <Modal visible={visible} transparent animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{ height: '85%', width: '100%', maxWidth: 600, alignSelf: 'center' }}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{ alignSelf: 'center', marginBottom: 10, backgroundColor: 'white', padding: 10, borderRadius: 20 }}
                        >
                            <X size={24} color="black" />
                        </TouchableOpacity>
                        {content}
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ height: '85%' }}>
                    {content}
                </View>
            </View>
        </Modal>
    );
};
