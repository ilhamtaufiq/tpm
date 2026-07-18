import { appAlert } from '../utils/appAlert';
import React, { useState, useMemo, useRef } from 'react';
import { View, Pressable, ScrollView, Platform, Modal, StyleSheet } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { Typography } from './ui/Typography';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Plus, Trash2, X, Banknote, CreditCard, Wallet, CircleDollarSign, Building2, Store, ArrowUpRight } from 'lucide-react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useProcessPaymentSplit, useProcessHutangPaymentSplit } from '../hooks/useKeuangan';
import { getErrorMessage } from '../utils/error';
import { keuanganService } from '../services/keuangan';
import { ModalFlexBackdrop } from './ui/BottomSheetContainer';
import { ModalThemeView } from './ui/ModalThemeView';

interface PaymentModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    id: number;
    initialAmount: number;
    title?: string;
    allowedMethods?: string[];
    type?: 'piutang' | 'hutang';
    kas_jenis?: string;
    unit?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    visible,
    onClose,
    onSuccess,
    id,
    initialAmount,
    title = 'Catat Pembayaran',
    allowedMethods,
    type = 'piutang',
    kas_jenis,
    unit
}) => {
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([
        { id: Date.now() + Math.random(), metode: '', nominal: formatNumber(Number(initialAmount ?? 0)), catatan: '' }
    ]);
    const [paymentNote, setPaymentNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [allBalances, setAllBalances] = useState<any>(null);

    React.useEffect(() => {
        if (visible) {
            keuanganService.getKasBankBalances()
                .then(setAllBalances)
                .catch(console.error);
        }
    }, [visible]);

    // Unit label mapping for display
    const unitLabel = useMemo(() => {
        const labels: Record<string, string> = {
            'BENGKEL': 'Bengkel',
            'JASA_ANGKUT': 'Jasa Angkut',
            'JUAL_BELI_MOBIL': 'Jual Beli Mobil',
        };
        return unit ? (labels[unit] || unit) : 'Unit';
    }, [unit]);

    const balancesInfo = useMemo(() => {
        if (!allBalances) return { cashPusat: 0, cashUnit: 0, bank: 0 };
        
        // Map unit key to account keys
        const unitCashMapping: Record<string, string> = {
            'BENGKEL': 'kas_unit_bengkel',
            'JASA_ANGKUT': 'kas_unit_jasa_angkut',
            'JUAL_BELI_MOBIL': 'kas_unit_mobil',
        };
        
        const cashPusat = allBalances.kas_utama?.saldo || 0;
        const cashUnit = unit && unitCashMapping[unit] ? (allBalances[unitCashMapping[unit]]?.saldo || 0) : 0;
        
        let bankBalance = 0;
        if (allBalances.bank_utama) {
            bankBalance = allBalances.bank_utama.saldo || 0;
        }
        
        return { cashPusat, cashUnit, bank: bankBalance };
    }, [allBalances, unit]);

    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['75%', '90%'], []);

    const piutangMutation = useProcessPaymentSplit();
    const hutangMutation = useProcessHutangPaymentSplit();

    const totalBayar = useMemo(() =>
        payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0)
        , [payments]);

    const sisaSetelahBayar = initialAmount - totalBayar;

    const addPayment = () => {
        setPayments([...payments, { id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }]);
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
            .map(p => {
                // Map UI method to backend metode + kas_jenis
                let backendMetode = p.metode;
                let targetKas = kas_jenis || undefined;

                if (p.metode === 'TUNAI_PUSAT') {
                    backendMetode = 'TUNAI';
                    targetKas = 'KAS_UTAMA';
                } else if (p.metode === 'TUNAI_UNIT') {
                    backendMetode = 'TUNAI';
                    // Keep the kas_jenis from parent (e.g. KAS_UNIT_BENGKEL)
                    targetKas = kas_jenis || undefined;
                } else if (p.metode === 'TRANSFER') {
                    backendMetode = 'TRANSFER';
                    targetKas = 'BANK_UTAMA';
                }

                return {
                    metode: backendMetode as any,
                    nominal: parseNumber(p.nominal),
                    catatan: p.catatan || undefined,
                    kas_jenis: targetKas
                };
            })
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

            if (!onlineManager.isOnline()) {
                if (type === 'piutang') {
                    piutangMutation.mutate(payload);
                } else {
                    hutangMutation.mutate(payload);
                }
                appAlert('Offline Mode', 'Pembayaran telah disimpan di antrean offline.');
                onSuccess();
                onClose();
                return;
            }

            if (type === 'piutang') {
                await piutangMutation.mutateAsync(payload);
            } else {
                await hutangMutation.mutateAsync(payload);
            }
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
                <Pressable
                    onPress={() => setIsSplitPayment(!isSplitPayment)}
                    className={`px-4 py-2 rounded-2xl border ${isSplitPayment ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
                >
                    <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'} uppercase tracking-widest`}>
                        {isSplitPayment ? 'Split On' : 'Split Off'}
                    </Typography>
                </Pressable>
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
                        <Pressable 
                            onPress={addPayment} 
                            className="bg-primary/10 px-3 py-1.5 rounded-xl border border-primary/10 flex-row items-center"
                        >
                            <Plus size={14} color="#023C69" />
                            <Typography className="text-primary text-[10px] ml-1.5 font-bold uppercase">Tambah</Typography>
                        </Pressable>
                    )}
                </View>

                {payments.map((p, idx) => (
                    <Card key={p.id} variant="outlined" className="p-6 mb-4 border-gray-100 rounded-[28px]">
                        <View className="flex-row items-center justify-between mb-5">
                            <View className="bg-gray-100 px-3 py-1 rounded-lg">
                                <Typography weight="bold" className="text-gray-500 text-[9px] uppercase tracking-widest">Entry #{idx + 1}</Typography>
                            </View>
                            {payments.length > 1 && (
                                <Pressable 
                                    onPress={() => removePayment(p.id)} 
                                    className="w-9 h-9 items-center justify-center bg-rose-50 rounded-xl"
                                >
                                    <Trash2 size={16} color="#EF4444" strokeWidth={2.5} />
                                </Pressable>
                            )}
                        </View>

                        <View className="space-y-2 mb-5">
                            {(allowedMethods || ['TUNAI_PUSAT', 'TUNAI_UNIT', 'TRANSFER']).map((m) => {
                                const methodConfig: Record<string, { label: string; sublabel: string; icon: React.ReactNode; activeBg: string; activeBorder: string }> = {
                                    'TUNAI_PUSAT': {
                                        label: 'Tunai ke Pusat',
                                        sublabel: 'Cash masuk ke Kas Utama',
                                        icon: <Building2 size={16} color={p.metode === m ? '#FFFFFF' : '#023C69'} />,
                                        activeBg: 'bg-primary',
                                        activeBorder: 'border-primary'
                                    },
                                    'TUNAI_UNIT': {
                                        label: `Tunai ke ${unitLabel}`,
                                        sublabel: `Cash masuk ke Kas Unit ${unitLabel}`,
                                        icon: <Store size={16} color={p.metode === m ? '#FFFFFF' : '#059669'} />,
                                        activeBg: 'bg-emerald-600',
                                        activeBorder: 'border-emerald-600'
                                    },
                                    'TRANSFER': {
                                        label: 'Transfer',
                                        sublabel: 'Transfer ke Bank Pusat',
                                        icon: <ArrowUpRight size={16} color={p.metode === m ? '#FFFFFF' : '#2563EB'} />,
                                        activeBg: 'bg-blue-600',
                                        activeBorder: 'border-blue-600'
                                    },
                                    // Fallback for legacy methods
                                    'TUNAI': {
                                        label: 'Tunai',
                                        sublabel: 'Pembayaran tunai',
                                        icon: <Banknote size={16} color={p.metode === m ? '#FFFFFF' : '#059669'} />,
                                        activeBg: 'bg-emerald-600',
                                        activeBorder: 'border-emerald-600'
                                    },
                                };
                                const cfg = methodConfig[m] || { label: m, sublabel: '', icon: <Banknote size={16} color="#9CA3AF" />, activeBg: 'bg-primary', activeBorder: 'border-primary' };
                                const isActive = p.metode === m;

                                return (
                                    <Pressable
                                        key={m}
                                        onPress={() => updatePayment(p.id, 'metode', m)}
                                        className={`flex-row items-center py-3.5 px-4 rounded-2xl border ${
                                            isActive ? `${cfg.activeBg} ${cfg.activeBorder} shadow-md` : 'border-gray-100 bg-gray-50'
                                        }`}
                                    >
                                        <View className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${
                                            isActive ? 'bg-white/20' : 'bg-white'
                                        }`}>
                                            {cfg.icon}
                                        </View>
                                        <View className="flex-1">
                                            <Typography
                                                variant="caption"
                                                weight="bold"
                                                className={isActive ? 'text-white text-xs' : 'text-gray-700 text-xs'}
                                            >
                                                {cfg.label}
                                            </Typography>
                                            <Typography
                                                className={`text-[9px] font-medium ${isActive ? 'text-white/70' : 'text-gray-400'}`}
                                            >
                                                {cfg.sublabel}
                                            </Typography>
                                        </View>
                                        {isActive && (
                                            <View className="w-5 h-5 bg-white/30 rounded-full items-center justify-center">
                                                <View className="w-2.5 h-2.5 bg-white rounded-full" />
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>

                        {p.metode === 'TRANSFER' && (
                            <View className="flex-row items-center mb-5 bg-blue-50/50 p-3 rounded-xl border border-blue-100/30">
                                <Wallet size={12} color="#2563EB" />
                                <Typography variant="caption" className="text-blue-700/70 ml-2 text-[10px] uppercase font-bold tracking-widest">
                                    Saldo Bank Pusat: <Typography variant="caption" weight="bold" className="text-blue-700">{formatCurrency(balancesInfo.bank)}</Typography>
                                </Typography>
                            </View>
                        )}

                        {p.metode === 'TUNAI_PUSAT' && (
                            <View className="flex-row items-center mb-5 bg-primary/5 p-3 rounded-xl border border-primary/10">
                                <Wallet size={12} color="#023C69" />
                                <Typography variant="caption" className="text-primary/70 ml-2 text-[10px] uppercase font-bold tracking-widest">
                                    Saldo Kas Pusat: <Typography variant="caption" weight="bold" className="text-primary">{formatCurrency(balancesInfo.cashPusat)}</Typography>
                                </Typography>
                            </View>
                        )}

                        {p.metode === 'TUNAI_UNIT' && (
                            <View className="flex-row items-center mb-5 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/30">
                                <Wallet size={12} color="#059669" />
                                <Typography variant="caption" className="text-emerald-700/70 ml-2 text-[10px] uppercase font-bold tracking-widest">
                                    Saldo Kas {unitLabel}: <Typography variant="caption" weight="bold" className="text-emerald-700">{formatCurrency(balancesInfo.cashUnit)}</Typography>
                                </Typography>
                            </View>
                        )}

                        {p.metode === 'TUNAI' && (
                            <View className="flex-row items-center mb-5 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/30">
                                <Wallet size={12} color="#059669" />
                                <Typography variant="caption" className="text-emerald-700/70 ml-2 text-[10px] uppercase font-bold tracking-widest">
                                    Saldo Kas: <Typography variant="caption" weight="bold" className="text-emerald-700">{formatCurrency(balancesInfo.cashUnit || balancesInfo.cashPusat)}</Typography>
                                </Typography>
                            </View>
                        )}

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
                    <Pressable
                        onPress={addPayment}
                        className="w-full py-5 border-2 border-dashed border-gray-200 rounded-3xl items-center justify-center flex-row bg-gray-50/30"
                    >
                        <Plus size={18} color="#9CA3AF" />
                        <Typography className="text-gray-400 font-bold ml-2 text-xs uppercase tracking-widest">Gunakan Split Payment</Typography>
                    </Pressable>
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
            <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
                <ModalThemeView style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
                    <ModalFlexBackdrop onPress={onClose} />
                    <View
                        className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[85%] self-center p-0 overflow-hidden shadow-2xl relative"
                        style={{ flexShrink: 0, zIndex: 2, elevation: 16 }}
                    >
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                        <ScrollView
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingBottom: 32 }}
                        >
                            {renderContent()}
                        </ScrollView>
                    </View>
                </ModalThemeView>
            </Modal>
        );
    }

    return (
        <BottomSheet
            ref={sheetRef}
            index={visible ? 0 : -1}
            snapPoints={snapPoints}
            enablePanDownToClose
            enableContentPanningGesture
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            onClose={onClose}
            backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
        >
            <BottomSheetScrollView
                showsVerticalScrollIndicator
                contentContainerStyle={{ paddingBottom: 48 }}
                keyboardShouldPersistTaps="handled"
            >
                {renderContent()}
            </BottomSheetScrollView>
        </BottomSheet>
    );
};
