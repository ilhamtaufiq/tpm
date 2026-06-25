import React, { useState, useMemo } from 'react';
import { View, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { X, Banknote, Wallet, ChevronRight, CheckCircle2, Calculator } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';

export interface PaymentItem {
    metode: 'TUNAI' | 'TRANSFER' | 'INTERNAL' | 'KREDIT';
    jumlah: number;
    kas_jenis?: string;
}

interface BengkelPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (data: {
        jumlah_bayar: number;
        metode_bayar: string;
        diskon: number | null;
        payments: PaymentItem[];
        willBeLunas: boolean;
    }) => Promise<void>;
    loading?: boolean;
    grandTotal: number;
    existingDp?: number;
    nomorTransaksi?: string;
    isInternalja?: boolean;
    isInternalMobil?: boolean;
}

export const BengkelPaymentModal: React.FC<BengkelPaymentModalProps> = ({
    visible,
    onClose,
    onConfirm,
    loading = false,
    grandTotal,
    existingDp = 0,
    nomorTransaksi,
    isInternalja = false,
    isInternalMobil = false,
}) => {
    const [paymentMode, setPaymentMode] = useState<'TUNAI' | 'TRANSFER' | 'SPLIT'>('TUNAI');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [splitTunai, setSplitTunai] = useState('');
    const [splitTransfer, setSplitTransfer] = useState('');
    const [diskonValue, setDiskonValue] = useState('');
    const [showDiskonInReceipt, setShowDiskonInReceipt] = useState(true);

    // Reset state when modal opens
    React.useEffect(() => {
        if (visible) {
            setPaymentMode('TUNAI');
            setPaymentAmount('');
            setSplitTunai('');
            setSplitTransfer('');
            setDiskonValue('');
            setShowDiskonInReceipt(true);
        }
    }, [visible]);

    const diskonAmt = useMemo(() => parseNumber(diskonValue), [diskonValue]);

    const sisaSetelahDiskon = useMemo(() =>
        Math.max(0, grandTotal - diskonAmt),
        [grandTotal, diskonAmt]
    );

    const sisaTagihan = useMemo(() =>
        Math.max(0, sisaSetelahDiskon - existingDp),
        [sisaSetelahDiskon, existingDp]
    );

    const splitTotal = useMemo(() =>
        parseNumber(splitTunai) + parseNumber(splitTransfer),
        [splitTunai, splitTransfer]
    );

    const isLunas = useMemo(() => {
        if (isInternalMobil) return false;
        if (isInternalja) return true;
        if (paymentMode === 'SPLIT') return splitTotal >= sisaTagihan;
        return parseNumber(paymentAmount) >= sisaTagihan;
    }, [paymentMode, paymentAmount, splitTotal, sisaTagihan, isInternalja, isInternalMobil]);

    const kembalian = useMemo(() => {
        if (paymentMode === 'SPLIT') return Math.max(0, splitTotal - sisaTagihan);
        return Math.max(0, parseNumber(paymentAmount) - sisaTagihan);
    }, [paymentMode, paymentAmount, splitTotal, sisaTagihan]);

    const handleConfirm = async () => {
        const currentGrandTotal = sisaSetelahDiskon;

        if (currentGrandTotal < 0) return;

        let paymentItems: PaymentItem[] = [];
        let totalBayarBaru = 0;

        if (isInternalja) {
            totalBayarBaru = sisaSetelahDiskon + existingDp;
        } else if (isInternalMobil) {
            totalBayarBaru = 0;
        } else if (paymentMode === 'SPLIT') {
            const tunaiAmt = parseNumber(splitTunai);
            const trfAmt = parseNumber(splitTransfer);
            if (tunaiAmt > 0) paymentItems.push({ metode: 'TUNAI', jumlah: tunaiAmt });
            if (trfAmt > 0) paymentItems.push({ metode: 'TRANSFER', jumlah: trfAmt });
            totalBayarBaru = tunaiAmt + trfAmt;
        } else {
            const amt = parseNumber(paymentAmount);
            paymentItems.push({
                metode: paymentMode as 'TUNAI' | 'TRANSFER',
                jumlah: amt,
                kas_jenis: paymentMode === 'TUNAI' ? 'KAS_UNIT_BENGKEL' : undefined,
            });
            totalBayarBaru = amt;
        }

        await onConfirm({
            jumlah_bayar: totalBayarBaru,
            metode_bayar: isInternalja ? 'INTERNAL' : isInternalMobil ? 'KREDIT' : (paymentMode === 'SPLIT' ? 'SPLIT' : paymentMode),
            diskon: diskonAmt > 0 ? diskonAmt : null,
            payments: paymentItems,
            willBeLunas: isLunas,
        });
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View className="flex-1 justify-end bg-black/50">
                <Pressable
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    onPress={onClose}
                />
                <View className="bg-white rounded-t-[48px] p-6 max-h-[90%] overflow-hidden">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-5">
                        <View>
                            <Typography variant="h3" weight="bold">
                                Pembayaran
                            </Typography>
                            {nomorTransaksi && (
                                <Typography variant="caption" className="text-gray-400 mt-0.5">
                                    #{nomorTransaksi}
                                </Typography>
                            )}
                        </View>
                        <Pressable
                            onPress={onClose}
                            className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
                        >
                            <X size={18} color="#4B5563" />
                        </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                        {/* Summary Card */}
                        <Card
                            variant="outlined"
                            className="p-5 border-emerald-100 mb-5 bg-emerald-50/60 rounded-3xl"
                        >
                            <View className="flex-row items-center justify-between mb-2">
                                <Typography className="text-emerald-700 text-xs font-semibold uppercase tracking-wider">
                                    Total Tagihan
                                </Typography>
                                <Typography variant="h3" weight="bold" className="text-emerald-800">
                                    {formatCurrency(grandTotal)}
                                </Typography>
                            </View>

                            {existingDp > 0 && (
                                <View className="flex-row justify-between mt-1">
                                    <Typography className="text-emerald-600 text-xs">
                                        Sudah Dibayar
                                    </Typography>
                                    <Typography className="text-emerald-600 text-xs font-bold">
                                        -{formatCurrency(existingDp)}
                                    </Typography>
                                </View>
                            )}

                            {diskonAmt > 0 && (
                                <View className="flex-row justify-between mt-1">
                                    <Typography className="text-amber-600 text-xs">
                                        Diskon
                                    </Typography>
                                    <Typography className="text-amber-600 text-xs font-bold">
                                        -{formatCurrency(diskonAmt)}
                                    </Typography>
                                </View>
                            )}

                            <View className="flex-row justify-between mt-3 pt-3 border-t border-emerald-200">
                                <Typography variant="body1" weight="bold" className="text-emerald-900">
                                    Sisa Bayar
                                </Typography>
                                <Typography variant="h3" weight="bold" className="text-emerald-900">
                                    {formatCurrency(sisaTagihan)}
                                </Typography>
                            </View>
                        </Card>

                        {!isInternalja && !isInternalMobil && (
                            <>
                                {/* Diskon */}
                                <View className="mb-5">
                                    <View className="flex-row items-center justify-between mb-1.5">
                                        <Typography
                                            variant="caption"
                                            weight="semibold"
                                            className="text-gray-600 ml-1"
                                        >
                                            Diskon (Rp)
                                        </Typography>
                                        <Pressable
                                            onPress={() =>
                                                setShowDiskonInReceipt(!showDiskonInReceipt)
                                            }
                                            className="flex-row items-center"
                                        >
                                            <View
                                                className={`w-4 h-4 rounded border-2 items-center justify-center mr-1 ${
                                                    showDiskonInReceipt
                                                        ? 'bg-primary border-primary'
                                                        : 'border-gray-300'
                                                }`}
                                            >
                                                {showDiskonInReceipt && (
                                                    <CheckCircle2 size={12} color="white" />
                                                )}
                                            </View>
                                            <Typography className="text-gray-500 text-[10px]">
                                                Cetak di struk
                                            </Typography>
                                        </Pressable>
                                    </View>
                                    <View className="bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 flex-row items-center">
                                        <Typography className="text-gray-400 mr-2 font-bold">
                                            Rp
                                        </Typography>
                                        <TextInput
                                            placeholder="0"
                                            keyboardType="number-pad"
                                            className="flex-1 text-sm font-bold text-textMain"
                                            value={diskonValue}
                                            onChangeText={(t) => {
                                                const cleaned = t.replace(/[^0-9]/g, '');
                                                setDiskonValue(
                                                    cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                                                );
                                            }}
                                        />
                                    </View>
                                </View>

                                {/* Method Selector */}
                                <Typography
                                    variant="caption"
                                    weight="semibold"
                                    className="text-gray-600 mb-2.5 ml-1"
                                >
                                    Metode Pembayaran
                                </Typography>
                                <View className="flex-row space-x-2 mb-5">
                                    {[
                                        { id: 'TUNAI', label: 'Tunai', icon: Banknote },
                                        { id: 'TRANSFER', label: 'Transfer', icon: Wallet },
                                        { id: 'SPLIT', label: 'Split', icon: ChevronRight },
                                    ].map((mode) => {
                                        const Icon = mode.icon;
                                        const active = paymentMode === mode.id;
                                        return (
                                            <Pressable
                                                key={mode.id}
                                                onPress={() =>
                                                    setPaymentMode(mode.id as any)
                                                }
                                                className={`flex-1 py-4 rounded-2xl border items-center justify-center ${
                                                    active
                                                        ? 'bg-primary border-primary shadow-sm shadow-primary/20'
                                                        : 'bg-white border-gray-100'
                                                }`}
                                            >
                                                <Icon
                                                    size={20}
                                                    color={active ? 'white' : '#64748B'}
                                                />
                                                <Typography
                                                    weight="bold"
                                                    className={`text-[10px] mt-1.5 ${
                                                        active ? 'text-white' : 'text-gray-500'
                                                    }`}
                                                >
                                                    {mode.label}
                                                </Typography>
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {/* Amount Input */}
                                {paymentMode === 'SPLIT' ? (
                                    <View className="space-y-4 mb-4">
                                        <View>
                                            <Typography
                                                variant="caption"
                                                weight="semibold"
                                                className="text-gray-600 mb-1.5 ml-1"
                                            >
                                                Tunai (Rp)
                                            </Typography>
                                            <View className="bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 flex-row items-center">
                                                <TextInput
                                                    placeholder="0"
                                                    keyboardType="number-pad"
                                                    className="flex-1 text-sm font-bold text-textMain"
                                                    value={splitTunai}
                                                    onChangeText={(t) => {
                                                        const cleaned = t.replace(/[^0-9]/g, '');
                                                        setSplitTunai(
                                                            cleaned.replace(
                                                                /\B(?=(\d{3})+(?!\d))/g,
                                                                '.'
                                                            )
                                                        );
                                                    }}
                                                />
                                            </View>
                                        </View>
                                        <View>
                                            <Typography
                                                variant="caption"
                                                weight="semibold"
                                                className="text-gray-600 mb-1.5 ml-1"
                                            >
                                                Transfer (Rp)
                                            </Typography>
                                            <View className="bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 flex-row items-center">
                                                <TextInput
                                                    placeholder="0"
                                                    keyboardType="number-pad"
                                                    className="flex-1 text-sm font-bold text-textMain"
                                                    value={splitTransfer}
                                                    onChangeText={(t) => {
                                                        const cleaned = t.replace(/[^0-9]/g, '');
                                                        setSplitTransfer(
                                                            cleaned.replace(
                                                                /\B(?=(\d{3})+(?!\d))/g,
                                                                '.'
                                                            )
                                                        );
                                                    }}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                ) : (
                                    <View className="mb-5">
                                        <Typography
                                            variant="caption"
                                            weight="semibold"
                                            className="text-gray-600 mb-1.5 ml-1"
                                        >
                                            Nominal Pembayaran
                                        </Typography>
                                        <View className="bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12 flex-row items-center">
                                            <Typography className="text-gray-400 mr-2 font-bold">
                                                Rp
                                            </Typography>
                                            <TextInput
                                                placeholder={formatNumber(
                                                    sisaTagihan.toString()
                                                )}
                                                keyboardType="number-pad"
                                                className="flex-1 text-sm font-bold text-textMain"
                                                value={paymentAmount}
                                                onChangeText={(t) => {
                                                    const cleaned = t.replace(/[^0-9]/g, '');
                                                    setPaymentAmount(
                                                        cleaned.replace(
                                                            /\B(?=(\d{3})+(?!\d))/g,
                                                            '.'
                                                        )
                                                    );
                                                }}
                                            />
                                            <Pressable
                                                onPress={() => {
                                                    setPaymentAmount(
                                                        formatNumber(sisaTagihan.toString())
                                                    );
                                                }}
                                                className="bg-emerald-100 px-3 py-1.5 rounded-lg active:bg-emerald-200"
                                            >
                                                <Typography
                                                    variant="caption"
                                                    weight="bold"
                                                    className="text-emerald-700"
                                                >
                                                    PAS
                                                </Typography>
                                            </Pressable>
                                        </View>
                                    </View>
                                )}

                                {/* Kembalian Info */}
                                {kembalian > 0 && (
                                    <View className="bg-blue-50 p-4 rounded-2xl mb-5 border border-blue-100 flex-row justify-between items-center">
                                        <View className="flex-row items-center">
                                            <Calculator size={16} color="#1D4ED8" />
                                            <Typography className="text-blue-700 text-xs font-bold ml-2">
                                                Uang Kembalian
                                            </Typography>
                                        </View>
                                        <Typography
                                            variant="body1"
                                            weight="bold"
                                            className="text-blue-800"
                                        >
                                            {formatCurrency(kembalian)}
                                        </Typography>
                                    </View>
                                )}

                                {/* Warning Kurang */}
                                {!isLunas && parseNumber(paymentAmount) > 0 && (
                                    <View className="bg-amber-50 p-3 rounded-2xl mb-4 border border-amber-100 flex-row items-center">
                                        <Typography className="text-amber-700 text-xs flex-1">
                                            Jumlah pembayaran kurang{' '}
                                            {formatCurrency(sisaTagihan - parseNumber(paymentAmount))}
                                        </Typography>
                                    </View>
                                )}
                            </>
                        )}

                        {isInternalja && (
                            <View className="bg-blue-50 p-5 rounded-3xl border border-blue-100 items-center justify-center my-4">
                                <CheckCircle2 size={32} color="#2563EB" />
                                <Typography weight="bold" className="text-blue-800 mt-2 text-center">
                                    Jasa Angkut Internal
                                </Typography>
                                <Typography variant="caption" className="text-blue-600 text-center mt-1">
                                    Biaya akan dibukukan ke unit Jasa Angkut.
                                </Typography>
                            </View>
                        )}

                        {isInternalMobil && (
                            <View className="bg-blue-50 p-5 rounded-3xl border border-blue-100 items-center justify-center my-4">
                                <CheckCircle2 size={32} color="#2563EB" />
                                <Typography weight="bold" className="text-blue-800 mt-2 text-center">
                                    Jual Beli Mobil Internal
                                </Typography>
                                <Typography variant="caption" className="text-blue-600 text-center mt-1">
                                    Biaya akan dikapitalisasi ke HPP mobil.
                                </Typography>
                            </View>
                        )}
                    </ScrollView>

                    <Button
                        title={
                            loading
                                ? 'Memproses...'
                                : `Bayar ${formatCurrency(sisaTagihan)}`
                        }
                        disabled={loading}
                        loading={loading}
                        onPress={handleConfirm}
                        className="mb-2 h-14 rounded-2xl"
                    />
                    <Pressable onPress={onClose} className="py-3 items-center">
                        <Typography
                            weight="bold"
                            className="text-gray-400 text-xs uppercase tracking-widest"
                        >
                            Batal
                        </Typography>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};
