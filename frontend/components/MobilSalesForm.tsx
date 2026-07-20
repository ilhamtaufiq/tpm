import React, { useState, useEffect } from 'react';
import { View, ScrollView, TextInput, ActivityIndicator, Platform, StyleSheet, Pressable } from 'react-native';
// import { Pressable } from '@gorhom/bottom-sheet'; // Reverted for web compatibility
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { User, CreditCard, Tag, Calculator, TrendingUp, Wallet, Trash2, PlusCircle, Info } from 'lucide-react-native';
import { useCreatePenjualanMobil, useMobilDetail } from '../hooks/useMobil';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AlertDialog } from './ui/AlertDialog';
import { getErrorMessage } from '../utils/error';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useQueryClient } from '@tanstack/react-query';
import { offlineAwareWrite } from '../services/offlineQueue';

interface MobilSalesFormProps {
    unit: any;
    onSuccess?: () => void;
}

export const MobilSalesForm = ({ unit, onSuccess }: MobilSalesFormProps) => {
    const queryClient = useQueryClient();
    const { data: detailUnit, isLoading: isDetailLoading } = useMobilDetail(unit?.id);
    const activeUnit = detailUnit || unit;

    const { mutate, isPending } = useCreatePenjualanMobil();
    const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
    const [namaPembeli, setNamaPembeli] = useState('');
    const [teleponPembeli, setTeleponPembeli] = useState('');
    const [hargaJual, setHargaJual] = useState('');
    const [dp, setDp] = useState('0');
    const [metodeBayar, setMetodeBayar] = useState<string | null>(null);
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; jumlah: string }[]>([]);
    const [catatan, setCatatan] = useState('');

    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info'
    });

    // Dynamic Costs (like MuatanForm)
    const [operationalCosts, setOperationalCosts] = useState<{ deskripsi: string; jumlah: string }[]>([]);

    // Calculations
    const [labaKotor, setLabaKotor] = useState(0);
    const [labaInvestor, setLabaInvestor] = useState(0);
    const [labaTpm, setLabaTpm] = useState(0);
    const [sisaBayar, setSisaBayar] = useState(0);
    const [totalCostsAtSale, setTotalCostsAtSale] = useState(0);

    const totalSplitAmount = payments.reduce((acc, p) => acc + parseNumber(p.jumlah), 0);

    useEffect(() => {
        // Parse removing all non-digits (handling '10.000.000' -> 10000000)
        const parseRaw = parseNumber;

        const jual = parseRaw(hargaJual);
        const downpayment = isSplitPayment ? totalSplitAmount : parseRaw(dp);
        const modalAwal = Number(activeUnit.total_modal) || 0;

        // Calculate dynamic costs added during sale
        const opCostTotal = operationalCosts.reduce((acc, item) => acc + parseRaw(item.jumlah), 0);
        const currentTotalCosts = opCostTotal;
        setTotalCostsAtSale(currentTotalCosts);

        const adjustedModal = modalAwal + currentTotalCosts;
        const profitTotal = jual - adjustedModal;

        setLabaKotor(profitTotal);
        setSisaBayar(jual - downpayment);

        const isInvestor = activeUnit.tipe_kepemilikan?.toString().toLowerCase() === 'investor';

        if (isInvestor && profitTotal > 0) {
            const persentase = parseFloat(String(activeUnit.persentase_investor)) || 0;
            const forInvestor = (profitTotal * persentase) / 100;
            setLabaInvestor(forInvestor);
            setLabaTpm(profitTotal - forInvestor);
        } else {
            setLabaInvestor(0);
            setLabaTpm(profitTotal);
        }
    }, [hargaJual, dp, activeUnit, operationalCosts, isSplitPayment, totalSplitAmount]);

    // Cost Management Helpers
    const addOpCost = () => setOperationalCosts([...operationalCosts, { deskripsi: '', jumlah: '' }]);
    const removeOpCost = (index: number) => {
        const newCosts = [...operationalCosts];
        newCosts.splice(index, 1);
        setOperationalCosts(newCosts);
    };
    const updateOpCost = (index: number, key: 'deskripsi' | 'jumlah', value: string) => {
        const newCosts = [...operationalCosts];
        if (key === 'jumlah') {
            newCosts[index][key] = formatNumber(value);
        } else {
            newCosts[index][key] = value;
        }
        setOperationalCosts(newCosts);
    };

    // Split Payment Helpers
    const addPaymentRow = () => {
        setPayments([...payments, { id: Date.now() + Math.random(), metode: '', jumlah: '' }]);
    };

    const removePaymentRow = (id: number) => {
        setPayments(payments.filter(p => p.id !== id));
    };

    const updatePaymentRow = (id: number, field: string, value: string) => {
        setPayments(payments.map(p => {
            if (p.id === id) {
                return { ...p, [field]: field === 'jumlah' ? formatNumber(value) : value };
            }
            return p;
        }));
    };

    const toggleSplitPayment = () => {
        if (!isSplitPayment) {
            setPayments([{ id: Date.now() + Math.random(), metode: metodeBayar || '', jumlah: dp }]);
        } else {
            setDp(formatNumber(totalSplitAmount.toString()));
        }
        setIsSplitPayment(!isSplitPayment);
    };

    const handleSubmit = () => {
        try {
            if (!namaPembeli || !hargaJual) {
                setDialogConfig({
                    visible: true,
                    title: 'Validasi',
                    message: 'Mohon lengkapi Nama Pembeli dan Harga Jual',
                    variant: 'warning'
                });
                return;
            }

            const finalDp = isSplitPayment ? totalSplitAmount : parseNumber(dp);

            if (!isSplitPayment && !metodeBayar) {
                // If 100% Credit (DP = 0), we don't force Tunai/Transfer
                if (finalDp > 0) {
                    setDialogConfig({
                        visible: true,
                        title: 'Validasi',
                        message: 'Silakan pilih metode pembayaran untuk DP (Tunai atau Transfer)',
                        variant: 'warning'
                    });
                    return;
                }
            }

            if (isSplitPayment) {
                const hasEmptyMethod = payments.some(p => !p.metode || parseNumber(p.jumlah) <= 0);
                if (hasEmptyMethod) {
                    setDialogConfig({
                        visible: true,
                        title: 'Validasi',
                        message: 'Silakan pilih metode pembayaran dan isi nominal untuk setiap baris split payment',
                        variant: 'warning'
                    });
                    return;
                }
            }


            const payload = {
                tanggal,
                mobil_id: activeUnit.id,
                nama_pembeli: namaPembeli,
                telepon_pembeli: teleponPembeli || null,
                harga_jual: parseNumber(hargaJual),
                dp: finalDp,
                metode_bayar: (isSplitPayment ? 'SPLIT' : (finalDp === 0 ? 'KREDIT' : (metodeBayar || ''))).toUpperCase(),
                payments: isSplitPayment ? payments.map(p => ({
                    metode: p.metode.toUpperCase(),
                    nominal: parseNumber(p.jumlah),
                    kas_jenis: p.metode.toUpperCase() === 'TUNAI' ? 'KAS_UNIT_MOBIL' : undefined
                })).filter(p => p.nominal > 0) : (finalDp > 0 ? [{
                    metode: (metodeBayar || '').toUpperCase(),
                    nominal: finalDp,
                    kas_jenis: (metodeBayar || '').toUpperCase() === 'TUNAI' ? 'KAS_UNIT_MOBIL' : undefined
                }] : []),
                catatan: catatan || null,
                biaya_operasional: operationalCosts
                    .filter(c => c.deskripsi && c.jumlah)
                    .map(c => ({
                        deskripsi: c.deskripsi,
                        jumlah: parseNumber(c.jumlah)
                    })),
            };

            void (async () => {
                try {
                    const result = await offlineAwareWrite(queryClient, {
                        type: 'mobil.createPenjualan',
                        payload,
                        label: 'Penjualan mobil',
                        description: String(payload.nama_pembeli || unit?.nomor_plat || ''),
                        onlineFn: () =>
                            new Promise((resolve, reject) => {
                                mutate(payload, { onSuccess: resolve, onError: reject });
                            }),
                    });
                    if (result.mode === 'offline') {
                        setDialogConfig({
                            visible: true,
                            title: 'Offline Mode',
                            message: 'Transaksi penjualan tersimpan di antrean offline (perangkat).',
                            variant: 'info',
                        });
                        setTimeout(() => onSuccess?.(), 1500);
                        return;
                    }
                    setDialogConfig({
                        visible: true,
                        title: 'Sukses',
                        message: 'Penjualan berhasil dicatat',
                        variant: 'success',
                    });
                    setTimeout(() => onSuccess?.(), 1500);
                } catch (err: any) {
                    console.error('Mutation Error:', err);
                    setDialogConfig({
                        visible: true,
                        title: 'Eror Pencatatan',
                        message: getErrorMessage(err, 'Gagal menyimpan transaksi'),
                        variant: 'error',
                    });
                }
            })();
        } catch (error) {
            console.error("Submit Error:", error);
            setDialogConfig({
                visible: true,
                title: 'Kesalahan Sistem',
                message: getErrorMessage(error, 'Terjadi kesalahan saat memproses data'),
                variant: 'error'
            });
        }
    };

    const renderFormContent = () => (
        <View className="px-6 pb-12 pt-4">
            {/* Unit Info Summary */}
            <Card className="bg-gray-50 border-gray-100 p-4 mb-6">
                <View className="flex-row items-center mb-2">
                    <TrendingUp size={16} color="#023C69" />
                    <Typography weight="bold" className="ml-2 text-primary text-xs uppercase">Informasi Modal Unit</Typography>
                </View>
                <Typography variant="h3" weight="bold">{activeUnit.merek} {activeUnit.model}</Typography>
                <Typography variant="caption" className="text-gray-500 mb-3">{activeUnit.nomor_plat}</Typography>

                <View className="flex-row justify-between border-t border-gray-100 pt-3">
                    <View>
                        <Typography variant="caption" className="text-gray-400">Total Modal</Typography>
                        <Typography weight="bold" className="text-sm">{formatCurrency(activeUnit.total_modal)}</Typography>
                    </View>
                    <View className="items-end">
                        <Typography variant="caption" className="text-gray-400">Tipe Unit</Typography>
                        <Typography weight="bold" className="text-sm capitalize">{activeUnit.tipe_kepemilikan}</Typography>
                    </View>
                </View>
                {isDetailLoading && <ActivityIndicator color="#023C69" size="small" className="mt-2" />}
            </Card>

            {/* Buyer Details */}
            <View className="mb-6">
                <View className="flex-row items-center mb-4">
                    <User size={18} color="#023C69" />
                    <Typography weight="bold" className="ml-2 text-primary">DATA PEMBELI</Typography>
                </View>
                <Input label="Nama Pembeli" placeholder="Masukkan nama lengkap" value={namaPembeli} onChangeText={setNamaPembeli} />
                <Input label="Nomor Telepon" placeholder="0812..." keyboardType="phone-pad" value={teleponPembeli} onChangeText={setTeleponPembeli} />
            </View>

            {/* Transaction details */}
            <View className="mb-6">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center">
                        <Tag size={18} color="#023C69" />
                        <Typography weight="bold" className="ml-2 text-primary uppercase">Transaksi</Typography>
                    </View>
                    <Pressable
                        onPress={toggleSplitPayment}
                        className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                    >
                        <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                            {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                        </Typography>
                    </Pressable>
                </View>

                <Input label="Harga Jual (Rp)" placeholder="0" keyboardType="numeric" value={hargaJual} onChangeText={(v) => setHargaJual(formatNumber(v))} />

                {isSplitPayment ? (
                    <View className="mb-4">
                        <View className="flex-row justify-between items-center mb-3">
                            <Typography variant="caption" weight="bold" className="text-gray-400 uppercase tracking-widest pl-2">Alokasi DP/Bayar</Typography>
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
                                    {['TUNAI', 'TRANSFER'].map((m) => (
                                        <Pressable
                                            key={m}
                                            onPress={() => updatePaymentRow(p.id, 'metode', m)}
                                            className={`flex-1 py-1.5 items-center rounded-xl border ${p.metode === m ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'}`}
                                        >
                                            <Typography variant="caption" weight={p.metode === m ? 'bold' : 'medium'} className={p.metode === m ? 'text-primary' : 'text-textGray'}>{m}</Typography>
                                        </Pressable>
                                    ))}
                                </View>

                                <Input
                                    placeholder="Nominal DP Rp"
                                    keyboardType="numeric"
                                    value={p.jumlah}
                                    containerClassName="mb-0"
                                    onChangeText={(t) => updatePaymentRow(p.id, 'jumlah', t)}
                                />
                            </View>
                        ))}

                        <View className="flex-row justify-between items-center p-4 bg-primary/5 rounded-[24px] border border-primary/10 mt-2">
                            <View>
                                <Typography variant="caption" weight="bold" className="text-primary text-[10px]">TOTAL DP / TERBAYAR</Typography>
                                <Typography weight="bold" className="text-primary text-lg">{formatCurrency(totalSplitAmount)}</Typography>
                            </View>
                            <View className="items-end">
                                {sisaBayar > 0 ? (
                                    <>
                                        <Typography variant="caption" weight="bold" className="text-amber-600 text-[10px]">SISA PIUTANG</Typography>
                                        <Typography weight="bold" className="text-amber-600 text-lg">{formatCurrency(sisaBayar)}</Typography>
                                    </>
                                ) : (
                                    <>
                                        <Typography variant="caption" weight="bold" className="text-emerald-600 text-[10px]">STATUS</Typography>
                                        <Typography weight="bold" className="text-emerald-600 text-lg">LUNAS</Typography>
                                    </>
                                )}
                            </View>
                        </View>

                        {sisaBayar > 0 && (
                            <View className="p-4 bg-amber-50 rounded-[24px] border border-amber-100 mt-3 flex-row items-center">
                                <Info size={16} color="#D97706" />
                                <Typography className="ml-2 text-amber-700 text-xs font-medium flex-1">
                                    Sisa {formatCurrency(sisaBayar)} akan otomatis dicatat sebagai <Typography weight="bold">Piutang Usaha</Typography>.
                                </Typography>
                            </View>
                        )}
                    </View>
                ) : (
                    <>
                        <Input 
                            label={parseNumber(dp) >= parseNumber(hargaJual) && parseNumber(hargaJual) > 0 ? "Pembayaran (Lunas) (Rp)" : "DP / Tanda Jadi (Rp)"} 
                            placeholder="0" 
                            keyboardType="numeric" 
                            value={dp} 
                            onChangeText={(v) => setDp(formatNumber(v))} 
                        />
                        <Typography variant="body2" className="text-textGray mb-2 font-medium pl-1">Metode Pembayaran</Typography>
                        <View className="flex-row space-x-2 mb-4">
                            <Pressable
                                onPress={() => setMetodeBayar('TUNAI')}
                                className={`flex-1 py-3.5 items-center rounded-2xl border-2 ${metodeBayar === 'TUNAI' ? 'border-primary bg-primary/10 shadow-sm' : 'border-gray-100'}`}
                            >
                                <Typography weight="bold" className={`uppercase ${metodeBayar === 'TUNAI' ? 'text-primary' : 'text-gray-400'}`}>Tunai</Typography>
                            </Pressable>
                            <Pressable
                                onPress={() => setMetodeBayar('TRANSFER')}
                                className={`flex-1 py-3.5 items-center rounded-2xl border-2 ${metodeBayar === 'TRANSFER' ? 'border-primary bg-primary/10 shadow-sm' : 'border-gray-100'}`}
                            >
                                <Typography weight="bold" className={`uppercase ${metodeBayar === 'TRANSFER' ? 'text-primary' : 'text-gray-400'}`}>Transfer</Typography>
                            </Pressable>
                        </View>

                        {sisaBayar > 0 && (
                            <View className="p-4 bg-amber-50 rounded-[24px] border border-amber-100 mb-6 flex-row items-center">
                                <Info size={16} color="#D97706" />
                                <Typography className="ml-2 text-amber-700 text-xs font-medium flex-1">
                                    Akan dicatat sebagai <Typography weight="bold">Piutang Usaha</Typography> sebesar {formatCurrency(sisaBayar)}.
                                </Typography>
                            </View>
                        )}
                    </>
                )}
            </View>

            {/* Additional Costs Section (MuatanForm style) */}
            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-4">
                    <View className="flex-row items-center">
                        <TrendingUp size={18} color="#023C69" />
                        <Typography weight="bold" className="ml-2 text-primary">BIAYA TAMBAHAN PENJUALAN / KOMISI</Typography>
                    </View>
                    <Pressable onPress={addOpCost}>
                        <Typography variant="caption" weight="bold" className="text-primary">+ Tambah</Typography>
                    </Pressable>
                </View>

                {operationalCosts.length === 0 && (
                    <Typography variant="caption" className="text-gray-400 italic mb-4">Tidak ada biaya tambahan operasional.</Typography>
                )}

                {operationalCosts.map((item, index) => (
                    <View key={index} className="flex-row space-x-2 items-center mb-3">
                        <View className="flex-[2]">
                            <Input
                                placeholder="Ket: Komisi Karyawan / Penjualan, dll"
                                value={item.deskripsi}
                                onChangeText={v => updateOpCost(index, 'deskripsi', v)}
                                containerClassName="mb-0"
                            />
                        </View>
                        <View className="flex-1">
                            <Input
                                placeholder="Rp 0"
                                keyboardType="numeric"
                                value={item.jumlah}
                                onChangeText={v => updateOpCost(index, 'jumlah', v)}
                                containerClassName="mb-0"
                            />
                        </View>
                        <Pressable
                            onPress={() => removeOpCost(index)}
                            className="p-2 bg-red-50 rounded-full"
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            style={{
                                padding: 8,
                                zIndex: 100,
                                cursor: Platform.OS === 'web' ? 'pointer' : undefined
                            }}
                        >
                            <Trash2 size={18} color="#EE2737" />
                        </Pressable>
                    </View>
                ))}
            </View>

            <Input label="Catatan Transaksi" placeholder="..." value={catatan} onChangeText={setCatatan} multiline numberOfLines={3} />

            {/* Profit Calculation Summary */}
            <Card className="bg-primary/5 border-primary/10 p-5 mb-8">
                <View className="flex-row items-center mb-4">
                    <Calculator size={18} color="#023C69" />
                    <Typography weight="bold" className="ml-2 text-primary">ESTIMASI LABA</Typography>
                </View>

                <View className="space-y-4">
                    <View className="flex-row justify-between">
                        <Typography variant="body2" className="text-gray-600">Harga Jual</Typography>
                        <Typography weight="bold" className="text-gray-800">{formatCurrency(parseNumber(hargaJual) || 0)}</Typography>
                    </View>

                    <View className="flex-row justify-between">
                        <Typography variant="body2" className="text-gray-600">Harga Beli Unit</Typography>
                        <Typography weight="bold" className="text-gray-800">{formatCurrency(Number(activeUnit.harga_beli) || 0)}</Typography>
                    </View>

                    <View className="flex-row justify-between">
                        <Typography variant="body2" className="text-gray-600">Biaya Pengeluaran (Pajak, BBN, dll)</Typography>
                        <Typography weight="bold" className="text-gray-800">{formatCurrency(Number(activeUnit.total_biaya) || 0)}</Typography>
                    </View>

                    <View className="flex-row justify-between">
                        <Typography variant="body2" className="text-gray-600">Biaya Sparepart dan Servis</Typography>
                        <Typography weight="bold" className="text-gray-800">{formatCurrency(Number(activeUnit.total_part_service) || 0)}</Typography>
                    </View>

                    {totalCostsAtSale > 0 && (
                        <View className="flex-row justify-between">
                            <Typography variant="body2" className="text-gray-600 italic">Biaya Operasional Tambahan</Typography>
                            <Typography weight="bold" className="text-gray-800">{formatCurrency(totalCostsAtSale)}</Typography>
                        </View>
                    )}

                    <View className="h-[1px] bg-primary/10 w-full my-1" />

                    <View className="flex-row justify-between items-center bg-primary/5 p-3 rounded-2xl">
                        <Typography variant="h3" weight="bold" className="text-primary">Estimasi Laba</Typography>
                        <Typography variant="h3" weight="bold" className={labaKotor >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {formatCurrency(labaKotor)}
                        </Typography>
                    </View>

                    <View className="h-[1px] bg-primary/10 w-full my-1" />

                    <View className="flex-row justify-between">
                        <Typography variant="body2" className="text-gray-600">
                            { (isSplitPayment ? totalSplitAmount : parseNumber(dp)) >= (parseNumber(hargaJual) || 0) && parseNumber(hargaJual) > 0 ? "Pembayaran (Lunas)" : "DP / Terbayar" }
                        </Typography>
                        <Typography weight="bold" className="text-emerald-600">{formatCurrency(isSplitPayment ? totalSplitAmount : parseNumber(dp))}</Typography>
                    </View>

                    {sisaBayar > 0 && (
                        <View className="flex-row justify-between">
                            <Typography variant="body2" className="text-rose-600 font-bold">Sisa Piutang</Typography>
                            <Typography weight="bold" className="text-rose-600">{formatCurrency(sisaBayar)}</Typography>
                        </View>
                    )}

                    {activeUnit.tipe_kepemilikan?.toString().toLowerCase() === 'investor' && (
                        <>
                            <View className="flex-row justify-between">
                                <Typography variant="body2" className="text-gray-600">Modal Investor</Typography>
                                <Typography weight="bold" className="text-gray-800">{formatCurrency(Number(activeUnit.nominal_investor) || 0)}</Typography>
                            </View>
                            <View className="flex-row justify-between">
                                <Typography variant="body2" className="text-gray-600">Bagian Laba Investor ({activeUnit.persentase_investor}%)</Typography>
                                <Typography weight="bold" className="text-gray-800">{formatCurrency(labaInvestor)}</Typography>
                            </View>
                            <View className="flex-row justify-between bg-emerald-50 p-2.5 rounded-2xl border border-emerald-100/50 mb-1">
                                <Typography variant="caption" weight="bold" className="text-emerald-700">PENGEMBALIAN NILAI INVESTOR</Typography>
                                <Typography weight="bold" className="text-emerald-700">
                                    {formatCurrency((Number(activeUnit.nominal_investor) || 0) + labaInvestor)}
                                </Typography>
                            </View>
                            <View className="h-[1px] bg-primary/10 w-full my-1" />
                        </>
                    )}

                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center">
                            <Wallet size={16} color="#023C69" />
                            <Typography weight="bold" className="ml-1.5 text-primary">Net Profit TPM</Typography>
                        </View>
                        <Typography variant="h3" weight="bold" className="text-primary">{formatCurrency(labaTpm)}</Typography>
                    </View>
                </View>
            </Card>

            <Button
                title={isPending ? "Memproses..." : "Selesaikan Penjualan"}
                variant="primary"
                size="lg"
                onPress={handleSubmit}
                disabled={isPending}
            />
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <View style={styles.webContainer}>
                <View style={styles.header}>
                    <Typography variant="h3" weight="bold">Konfirmasi Penjualan</Typography>
                    <Typography variant="caption" className="text-gray-400">Pencatatan transaksi penjualan unit mobil</Typography>
                </View>
                <ScrollView style={styles.flex1} showsVerticalScrollIndicator={true}>
                    {renderFormContent()}
                </ScrollView>
                <AlertDialog
                    visible={dialogConfig.visible}
                    title={dialogConfig.title}
                    message={dialogConfig.message}
                    variant={dialogConfig.variant}
                    onClose={() => setDialogConfig((prev: any) => ({ ...prev, visible: false }))}
                />
            </View>
        );
    }

    // Keyboard handled by parent BottomSheet (keyboardBehavior="interactive").
    // Do not wrap BottomSheetScrollView in KeyboardAvoidingView — it blocks scroll.
    return (
        <View style={styles.mobileContainer}>
            <View style={styles.header}>
                <Typography variant="h3" weight="bold">Konfirmasi Penjualan</Typography>
                <Typography variant="caption" className="text-gray-400">Pencatatan transaksi penjualan unit mobil</Typography>
            </View>
            <BottomSheetScrollView
                style={styles.flex1}
                contentContainerStyle={{ paddingBottom: 48 }}
                showsVerticalScrollIndicator
                bounces
                keyboardShouldPersistTaps="handled"
            >
                {renderFormContent()}
            </BottomSheetScrollView>
            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => setDialogConfig((prev: any) => ({ ...prev, visible: false }))}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    flex1: {
        flex: 1,
    },
    webContainer: {
        flex: 1,
        backgroundColor: 'white',
        height: '80vh' as any,
    },
    mobileContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        backgroundColor: 'white',
    },
});
