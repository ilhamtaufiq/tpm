import React, { useState } from 'react';
import { View, ScrollView, TextInput, ActivityIndicator, Platform, StyleSheet, Pressable } from 'react-native';
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Info, User, DollarSign, Calendar, Car, ShieldCheck, Trash2, Plus } from 'lucide-react-native';
import { useCreateMobil, useUpdateMobil } from '../hooks/useMobil';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AlertDialog } from './ui/AlertDialog';
import { getErrorMessage } from '../utils/error';
import { formatNumber, parseNumber } from '../utils/format';
import { useQueryClient } from '@tanstack/react-query';
import { offlineAwareWrite, isAppOnline } from '../services/offlineQueue';
import { useKasBankBalances } from '../hooks/useKeuangan';

interface MobilFormProps {
    initialData?: any;
    onSuccess?: () => void;
}


import { Badge } from './ui/Badge';

export const MobilForm = ({ initialData, onSuccess }: MobilFormProps) => {
    const isEdit = !!initialData;
    const queryClient = useQueryClient();
    const createMutation = useCreateMobil();
    const updateMutation = useUpdateMobil();

    const mutation = isEdit ? updateMutation : createMutation;
    const isPending = mutation.isPending;

    const { data: balancesData } = useKasBankBalances();
    const walletBalances: any = balancesData || {};

    // Basic Info
    const [merek, setMerek] = useState(initialData?.merek || '');
    const [model, setModel] = useState(initialData?.model || '');
    const [tahun, setTahun] = useState(String(initialData?.tahun || ''));
    const [nomorPlat, setNomorPlat] = useState(initialData?.nomor_plat || '');
    const [warna, setWarna] = useState(initialData?.warna || '');

    // Technical Info
    const [nomorRangka, setNomorRangka] = useState(initialData?.nomor_rangka || '');
    const [nomorMesin, setNomorMesin] = useState(initialData?.nomor_mesin || '');
    const [transmisi, setTransmisi] = useState(initialData?.transmisi || 'MT');
    const [kilometer, setKilometer] = useState(formatNumber(String(initialData?.kilometer || '')));

    // Financial & Ownership
    const [hargaBeli, setHargaBeli] = useState(formatNumber(String(initialData?.harga_beli || '')));
    const [namaInvestor, setNamaInvestor] = useState(initialData?.nama_investor || '');
    const [nominalInvestor, setNominalInvestor] = useState(formatNumber(String(initialData?.nominal_investor || '')));
    const [persentaseInvestor, setPersentaseInvestor] = useState(String(initialData?.persentase_investor || '0'));
    const [sumberBayar, setSumberBayar] = useState(() => {
        if (initialData) {
            if (initialData.metode_bayar_beli === 'SPLIT') return 'SPLIT';
            return initialData.metode_bayar_beli === 'TRANSFER' ? 'UTAMA_TRANSFER' : 'UNIT_TUNAI';
        }
        return '';
    });
    const [statusBayar, setStatusBayar] = useState(initialData?.status_bayar_beli || 'LUNAS');
    const [dp, setDp] = useState(formatNumber(String(initialData?.dp_beli || '0')));
    const [investorKasJenis, setInvestorKasJenis] = useState(initialData?.investor_kas_jenis || 'BANK_UTAMA');

    const [payments, setPayments] = useState<{ id: number; metode: string; sumber: string; jumlah: string }[]>([
        { id: Date.now() + Math.random(), metode: 'TUNAI', sumber: 'UNIT_TUNAI', jumlah: '' }
    ]);

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

    const checkBalance = (sumber: string, amount: number) => {
        // VERSI 5.0 - THE TRUTH
        if (!isAppOnline()) return true; 
        if (!walletBalances) return true;

        let kasJenis = '';
        if (sumber === 'UNIT_TUNAI') kasJenis = 'kas_unit_mobil';
        else if (sumber === 'UTAMA_TUNAI') kasJenis = 'kas_utama';
        else if (sumber === 'UTAMA_TRANSFER') kasJenis = 'bank_utama';

        if (!kasJenis) return true;

        const baseBalance = Number(walletBalances[kasJenis]?.saldo || 0);
        const investorFund = Number(parseNumber(nominalInvestor));
        
        // Matching murni berdasarkan akun
        const isAccountMatch = (
            (kasJenis === 'kas_utama' && investorKasJenis === 'KAS_UTAMA') ||
            (kasJenis === 'bank_utama' && investorKasJenis === 'BANK_UTAMA') ||
            (kasJenis === 'kas_unit_mobil' && investorKasJenis === 'KAS_UNIT_MOBIL')
        );

        let totalAvailable = baseBalance;
        if (isAccountMatch && investorFund > 0 && !!namaInvestor) {
            totalAvailable = baseBalance + investorFund;
        }

        if (Number(amount) > totalAvailable) {
            const diff = Number(amount) - totalAvailable;
            const hasInv = investorFund > 0 && !!namaInvestor;
            
            setDialogConfig({
                visible: true,
                title: 'Saldo Tidak Cukup',
                message: `Saldo ${kasJenis.replace(/_/g, ' ').toUpperCase()} tidak mencukupi.\n\n` +
                         `Saldo Kas: Rp ${formatNumber(String(baseBalance))}\n` +
                         (totalAvailable > baseBalance ? `Dana Investor: Rp ${formatNumber(String(investorFund))}\n` : '') +
                         `Total Tersedia: Rp ${formatNumber(String(totalAvailable))}\n` +
                         `Kebutuhan: Rp ${formatNumber(String(amount))}\n\n` +
                         `Kurang: Rp ${formatNumber(String(diff))}` +
                         (!isAccountMatch && hasInv ? 
                            `\n\n*Catatan: Akun beda (Pilih: ${kasJenis.replace(/_/g, ' ')})` : 
                            (!hasInv && investorFund > 0 ? '\n\n*Catatan: Nama Investor wajib diisi.' : '')
                         ) + 
                         `\nDEBUG: acct=[${kasJenis}] target=[${investorKasJenis}] invName=[${namaInvestor}] invFund=[${investorFund}]`,
                variant: 'error'
            });
            return false;
        }
        return true;
    };

    const handleSubmit = () => {
        if (!merek || !model || !tahun || !nomorPlat || !hargaBeli) {
            setDialogConfig({
                visible: true,
                title: 'Validasi',
                message: 'Mohon lengkapi data wajib (Merek, Model, Tahun, Plat, Harga Beli)',
                variant: 'warning'
            });
            return;
        }

        if (namaInvestor && (!nominalInvestor || parseNumber(nominalInvestor) <= 0 || !persentaseInvestor || parseFloat(persentaseInvestor) <= 0)) {
            setDialogConfig({
                visible: true,
                title: 'Validasi Investor',
                message: 'Untuk unit investor, Nominal Investasi dan Persentase Bagi Hasil wajib diisi.',
                variant: 'warning'
            });
            return;
        }

        if (!isEdit) {
            const isDebtWithoutDp = statusBayar === 'BELUM_LUNAS' && parseNumber(dp) <= 0;
            
            if (!isDebtWithoutDp) {
                if (!sumberBayar) {
                    setDialogConfig({ visible: true, title: 'Validasi', message: 'Silakan pilih sumber dana', variant: 'warning' });
                    return;
                }
                if (sumberBayar === 'SPLIT') {
                    const hasEmptyMethod = payments.some(p => !p.sumber || parseNumber(p.jumlah) <= 0);
                    if (hasEmptyMethod) {
                        setDialogConfig({ visible: true, title: 'Validasi', message: 'Silakan pilih sumber dana untuk semua nominal split', variant: 'warning' });
                        return;
                    }

                    // Balance check for split
                    for (const p of payments) {
                        if (!checkBalance(p.sumber, parseNumber(p.jumlah))) return;
                    }
                } else {
                    // Balance check for single source
                    const amountToCheck = statusBayar === 'LUNAS' ? parseNumber(hargaBeli) : parseNumber(dp);
                    if (amountToCheck > 0 && !checkBalance(sumberBayar, amountToCheck)) return;
                }
            }
        }

        const payload: any = {
            merek,
            model,
            tahun: parseInt(tahun) || 0,
            nomor_plat: nomorPlat,
            warna,
            nomor_rangka: nomorRangka,
            nomor_mesin: nomorMesin,
            transmisi,
            kilometer: parseNumber(kilometer) || 0,
            tipe_kepemilikan: namaInvestor ? 'investor' : 'tpm',
            nama_investor: namaInvestor || null,
            nominal_investor: parseNumber(nominalInvestor) || 0,
            persentase_investor: parseFloat(persentaseInvestor) || 0,
            investor_kas_jenis: (namaInvestor && parseNumber(nominalInvestor) > 0) ? investorKasJenis : null,
        };

        if (!isEdit) {
            payload.harga_beli = parseNumber(hargaBeli);

            let actualMetode = 'TUNAI';
            let kasJenis = 'KAS_UNIT_MOBIL';

            if (sumberBayar === 'UTAMA_TUNAI') {
                kasJenis = 'KAS_UTAMA';
            } else if (sumberBayar === 'UTAMA_TRANSFER') {
                actualMetode = 'TRANSFER';
                kasJenis = 'BANK_UTAMA';
            } else if (sumberBayar === 'SPLIT') {
                actualMetode = 'SPLIT';
            }

            payload.metode_bayar = actualMetode;
            payload.kas_jenis = kasJenis;
            payload.status_bayar = statusBayar;
            payload.dp = parseNumber(dp) || 0;
            payload.tanggal_masuk = new Date().toISOString().split('T')[0];

            if (sumberBayar === 'SPLIT') {
                payload.payments = payments
                    .filter(p => parseNumber(p.jumlah) > 0)
                    .map(p => {
                        let pMetode = 'TUNAI';
                        let pKasJenis = 'KAS_UNIT_MOBIL';
                        if (p.sumber === 'UTAMA_TUNAI') pKasJenis = 'KAS_UTAMA';
                        else if (p.sumber === 'UTAMA_TRANSFER') { pMetode = 'TRANSFER'; pKasJenis = 'BANK_UTAMA'; }
                        return {
                            metode: pMetode,
                            kas_jenis: pKasJenis,
                            jumlah: parseNumber(p.jumlah)
                        };
                    });
            }
        }

        const mutateOptions = {
            onSuccess: () => {
                setDialogConfig({
                    visible: true,
                    title: 'Sukses',
                    message: isEdit ? 'Data mobil berhasil diperbarui' : 'Data mobil berhasil disimpan',
                    variant: 'success'
                });
                setTimeout(() => {
                    onSuccess?.();
                }, 1500);
            },
            onError: (err: any) => {
                setDialogConfig({
                    visible: true,
                    title: isEdit ? 'Gagal Memperbarui' : 'Gagal Menyimpan',
                    message: getErrorMessage(err, isEdit ? 'Gagal memperbarui data' : 'Gagal menyimpan data'),
                    variant: 'error'
                });
            }
        };

        void (async () => {
            try {
                const result = await offlineAwareWrite(queryClient, {
                    type: isEdit ? 'mobil.update' : 'mobil.create',
                    payload: isEdit ? { id: initialData.id, data: payload } : payload,
                    label: isEdit ? 'Update mobil' : 'Mobil baru',
                    description: String(payload.plat_nomor || ''),
                    onlineFn: () =>
                        isEdit
                            ? updateMutation.mutateAsync({ id: initialData.id, data: payload })
                            : createMutation.mutateAsync(payload),
                });
                if (result.mode === 'offline') {
                    setDialogConfig({
                        visible: true,
                        title: 'Offline Mode',
                        message: isEdit
                            ? 'Update data mobil tersimpan di antrean offline (perangkat).'
                            : 'Mobil baru tersimpan di antrean offline (perangkat).',
                        variant: 'info',
                    });
                    setTimeout(() => onSuccess?.(), 1500);
                    return;
                }
                mutateOptions.onSuccess();
            } catch (err: any) {
                mutateOptions.onError(err);
            }
        })();
    };

    const renderFormContent = () => (
        <View className="px-6 pb-12 pt-4">
            {/* Section: Informasi Kendaraan */}
            <View className="mb-6">
                <View className="flex-row items-center mb-4">
                    <Car size={18} color="#023C69" />
                    <Typography weight="bold" className="ml-2 text-primary">DATA KENDARAAN</Typography>
                </View>

                <View className="flex-row space-x-3 mb-1">
                    <Input label="Merek" placeholder="Toyota" containerClassName="flex-1" value={merek} onChangeText={setMerek} />
                    <Input label="Model" placeholder="Avanza" containerClassName="flex-1" value={model} onChangeText={setModel} />
                </View>

                <View className="flex-row space-x-3 mb-1">
                    <Input label="Tahun" placeholder="2022" containerClassName="flex-1" keyboardType="numeric" value={tahun} onChangeText={(v) => setTahun(v.replace(/[^0-9]/g, '').slice(0, 4))} maxLength={4} />
                    <Input label="Plat Nomor" placeholder="B 1234 ABC" containerClassName="flex-1" value={nomorPlat} onChangeText={setNomorPlat} autoCapitalize="characters" />
                </View>

                <Input label="Warna" placeholder="Putih Metalik" value={warna} onChangeText={setWarna} />
            </View>

            {/* Section: Detail Teknis */}
            <View className="mb-6">
                <View className="flex-row items-center mb-4">
                    <ShieldCheck size={18} color="#023C69" />
                    <Typography weight="bold" className="ml-2 text-primary">DETAIL TEKNIS</Typography>
                </View>

                <Input label="Nomor Rangka" placeholder="Masukkan nomor rangka" value={nomorRangka} onChangeText={setNomorRangka} />
                <Input label="Nomor Mesin" placeholder="Masukkan nomor mesin" value={nomorMesin} onChangeText={setNomorMesin} />

                <View className="flex-row space-x-3 mb-1">
                    <View className="flex-1">
                        <Typography variant="body2" className="text-textGray mb-1 font-medium">Transmisi</Typography>
                        <View className="flex-row bg-gray-100 rounded-xl p-1">
                            {['MT', 'AT'].map((t) => (
                                <Pressable
                                    key={t}
                                    onPress={() => setTransmisi(t)}
                                    className={`flex-1 py-2 rounded-lg items-center ${transmisi === t ? 'bg-white shadow-sm' : ''}`}
                                >
                                    <Typography weight={transmisi === t ? 'bold' : 'medium'} className={transmisi === t ? 'text-primary' : 'text-gray-400'}>{t}</Typography>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                    <Input label="Kilometer" placeholder="15.000" containerClassName="flex-1" keyboardType="numeric" value={kilometer} onChangeText={(v) => setKilometer(formatNumber(v))} />
                </View>
            </View>

            {/* Section: Kepemilikan & Harga */}
            <View className="mb-8">
                <View className="flex-row items-center mb-4">
                    <DollarSign size={18} color="#023C69" />
                    <Typography weight="bold" className="ml-2 text-primary">KEPEMILIKAN & HARGA</Typography>
                </View>

                {!isEdit && (
                    <View className="space-y-6">
                        {/* Harga & Status Row */}
                        <View className="flex-row space-x-3">
                            <Input
                                label="Harga Beli Unit (Rp)"
                                placeholder="0"
                                containerClassName="flex-[1.5]"
                                keyboardType="numeric"
                                value={hargaBeli}
                                onChangeText={(v) => setHargaBeli(formatNumber(v))}
                            />
                            <View className="flex-1">
                                <Typography variant="caption" weight="bold" className="text-textGray mb-2 uppercase tracking-tight">Status Bayar</Typography>
                                <View className="flex-row bg-gray-100 rounded-2xl p-1 border border-gray-200/50 space-x-1">
                                    {[
                                        { label: 'Lunas', value: 'LUNAS' },
                                        { label: 'Hutang', value: 'BELUM_LUNAS' }
                                    ].map((s) => (
                                        <Pressable
                                            key={s.value}
                                            onPress={() => setStatusBayar(s.value)}
                                            className={`flex-1 py-2 rounded-xl items-center justify-center ${statusBayar === s.value ? 'bg-white shadow-sm' : ''}`}
                                        >
                                            <Typography variant="caption" weight="bold" className={`text-center ${statusBayar === s.value ? 'text-primary' : 'text-gray-400'}`}>
                                                {s.label}
                                            </Typography>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Payment Method & Optional DP Row */}
                        <View className="mt-4">
                            <View className="flex-row space-x-3 items-end">
                                {statusBayar !== 'LUNAS' && (
                                    <Input
                                        label="Uang Muka / DP (Rp)"
                                        placeholder="0"
                                        containerClassName="flex-1 mb-0"
                                        keyboardType="numeric"
                                        value={dp}
                                        onChangeText={(v) => {
                                            setDp(formatNumber(v));
                                            // Reset sumberBayar if DP is cleared and it was Split
                                            if (parseNumber(v) <= 0 && statusBayar === 'BELUM_LUNAS') {
                                                // Keep it as is or reset to empty
                                            }
                                        }}
                                    />
                                )}

                                {(statusBayar === 'LUNAS' || parseNumber(dp) > 0) && (
                                    <View className="flex-[1.5]">
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-tight">Sumber Dana</Typography>
                                            {sumberBayar === 'SPLIT' && (
                                                <Badge label="SPLIT AKTIF" variant="warning" />
                                            )}
                                        </View>
                                        <View className="flex-row flex-wrap -m-0.5">
                                            {[
                                                { label: 'Tunai Mobil', value: 'UNIT_TUNAI' },
                                                { label: 'Tunai Utama', value: 'UTAMA_TUNAI' },
                                                { label: 'Transfer', value: 'UTAMA_TRANSFER' },
                                                { label: 'Split', value: 'SPLIT' }
                                            ].map((m) => (
                                                <View key={m.value} className="w-1/2 p-0.5">
                                                    <Pressable
                                                        onPress={() => {
                                                            const amountToCheck = statusBayar === 'LUNAS' ? parseNumber(hargaBeli) : parseNumber(dp);
                                                            if (m.value !== 'SPLIT' && amountToCheck > 0) {
                                                                if (!checkBalance(m.value, amountToCheck)) return;
                                                            }
                                                            setSumberBayar(m.value);
                                                        }}
                                                        className={`py-2 rounded-xl items-center justify-center ${sumberBayar === m.value ? 'bg-blue-600 shadow-sm' : 'bg-gray-100'}`}
                                                    >
                                                        <Typography variant="caption" weight="bold" className={`text-center text-[10px] ${sumberBayar === m.value ? 'text-white' : 'text-gray-500'}`}>
                                                            {m.label}
                                                        </Typography>
                                                    </Pressable>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {(statusBayar === 'LUNAS' && !sumberBayar) && (
                                    <View className="flex-1 items-center justify-center p-3 bg-blue-50 rounded-2xl border border-blue-100 border-dashed">
                                        <Typography variant="caption" weight="bold" className="text-blue-600 text-[10px] uppercase text-center">Pilih Sumber Dana</Typography>
                                    </View>
                                )}
                            </View>

                            {/* Split Payment Editor */}
                            {sumberBayar === 'SPLIT' && (
                                <View className="mt-6 p-4 bg-gray-50/50 rounded-3xl border border-gray-100">
                                    <Typography variant="caption" weight="bold" className="text-primary mb-4 ml-1">RINCIAN PEMBAYARAN MULTI</Typography>

                                    {/* Split Payment Rows */}
                                    {payments.map((p, idx) => (
                                        <View key={p.id} className="flex-row space-x-2 items-end mb-4">
                                            {/* Column: Akun/Sumber */}
                                            <View className="flex-[1.8]">
                                                {idx === 0 && (
                                                    <Typography variant="caption" weight="medium" className="text-textGray mb-1 ml-1 text-[10px]">Sumber Dana</Typography>
                                                )}
                                                <View className="flex-row flex-wrap bg-white border border-gray-200 rounded-xl overflow-hidden h-10 items-center justify-center">
                                                    {[
                                                        { id: 'UNIT_TUNAI', label: 'Unit' },
                                                        { id: 'UTAMA_TUNAI', label: 'Utm Tunai' },
                                                        { id: 'UTAMA_TRANSFER', label: 'Utm Trf' }
                                                    ].map((opt) => (
                                                        <Pressable
                                                            key={opt.id}
                                                            onPress={() => {
                                                                const amount = parseNumber(p.jumlah);
                                                                if (amount > 0 && !checkBalance(opt.id, amount)) return;
                                                                const newP = [...payments];
                                                                newP[idx].sumber = opt.id;
                                                                setPayments(newP);
                                                            }}
                                                            className={`flex-1 h-full items-center justify-center ${p.sumber === opt.id ? 'bg-blue-600' : 'bg-transparent'}`}
                                                        >
                                                            <Typography
                                                                weight="bold"
                                                                className={`text-[8px] ${p.sumber === opt.id ? 'text-white' : 'text-textGray text-center'}`}
                                                            >
                                                                {opt.label}
                                                            </Typography>
                                                        </Pressable>
                                                    ))}
                                                </View>
                                            </View>

                                            {/* Column: Nominal */}
                                            <View className="flex-[1.5]">
                                                {idx === 0 && (
                                                    <Typography variant="caption" weight="medium" className="text-textGray mb-1 ml-1">Nominal (Rp)</Typography>
                                                )}
                                                <Input
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                    containerClassName="mb-0"
                                                    className="h-10 text-sm"
                                                    value={p.jumlah}
                                                    onChangeText={(val) => {
                                                        const newP = [...payments];
                                                        newP[idx].jumlah = formatNumber(val);
                                                        setPayments(newP);
                                                    }}
                                                />
                                            </View>

                                            {/* Column: Action */}
                                            <Pressable
                                                onPress={() => {
                                                    if (payments.length > 1) {
                                                        setPayments(payments.filter(pay => pay.id !== p.id));
                                                    }
                                                }}
                                                className="h-10 w-8 items-center justify-center bg-rose-50 rounded-xl"
                                            >
                                                <Trash2 size={14} color="#F43F5E" />
                                            </Pressable>
                                        </View>
                                    ))}

                                    {/* Add Button */}
                                    <Pressable
                                        onPress={() => setPayments([...payments, { id: Date.now() + Math.random(), metode: 'TUNAI', sumber: 'UNIT_TUNAI', jumlah: '' }])}
                                        className="flex-row items-center justify-center py-2 bg-white border border-dashed border-primary/30 rounded-xl mt-1"
                                    >
                                        <Plus size={14} color="#023C69" />
                                        <Typography weight="bold" className="text-primary text-[10px] ml-1 text-center">Tambah Sumber Dana</Typography>
                                    </Pressable>

                                    {/* Summary Split */}
                                    <View className="mt-6 pt-4 border-t border-gray-100 flex-row justify-between items-center px-1">
                                        <Typography variant="caption" weight="bold" className="text-textGray uppercase">Total Terbayar:</Typography>
                                        <Typography variant="h3" weight="bold" className="text-primary">
                                            Rp {formatNumber(String(payments.reduce((acc, p) => acc + (parseNumber(p.jumlah) || 0), 0)))}
                                        </Typography>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                <View className="mt-4">
                    <Typography weight="bold" className="text-primary mb-4">DATA INVESTOR (OPSIONAL)</Typography>
                    <Card className="bg-primary/5 border border-primary/10 p-4">
                        <Input label="Nama Investor" placeholder="Masukkan nama investor (kosongkan jika unit TPM)" value={namaInvestor} onChangeText={setNamaInvestor} />

                        <View className="flex-row space-x-3 mt-2">
                            <Input
                                label="Nominal Investasi (Rp)"
                                placeholder="0"
                                containerClassName="flex-1"
                                keyboardType="numeric"
                                value={nominalInvestor}
                                onChangeText={(v) => setNominalInvestor(formatNumber(v))}
                            />
                            <View className="flex-1">
                                <Typography variant="body2" className="mb-1 font-medium">Bagi Hasil (%)</Typography>
                                <View className="flex-row items-center bg-white border border-gray-200 rounded-lg h-[46px] px-3">
                                    <TextInput
                                        className="flex-1 font-bold text-primary"
                                        keyboardType="numeric"
                                        value={persentaseInvestor}
                                        onChangeText={setPersentaseInvestor}
                                        placeholder="0"
                                    />
                                    <Typography weight="bold" className="text-primary">%</Typography>
                                </View>
                            </View>
                        </View>

                        {parseNumber(nominalInvestor) > 0 && (
                            <View className="mt-4">
                                <Typography variant="caption" weight="bold" className="text-primary mb-2 uppercase">TUJUAN DANA MASUK INVESTOR</Typography>
                                <View className="flex-row bg-white border border-primary/10 rounded-2xl p-1.5 space-x-1.5">
                                    {[
                                        { label: 'Bank Utama', value: 'BANK_UTAMA' },
                                        { label: 'Cash Utama', value: 'KAS_UTAMA' }
                                    ].map((opt) => (
                                        <Pressable
                                            key={opt.value}
                                            onPress={() => setInvestorKasJenis(opt.value)}
                                            className={`flex-1 py-2.5 rounded-xl items-center justify-center ${investorKasJenis === opt.value ? 'bg-primary shadow-sm' : 'bg-gray-50'}`}
                                        >
                                            <Typography weight="bold" className={`text-[11px] ${investorKasJenis === opt.value ? 'text-white' : 'text-gray-400'}`}>
                                                {opt.label.toUpperCase()}
                                            </Typography>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        <Typography variant="caption" className="text-primary mt-3 italic bg-primary/10 p-3 rounded-2xl border border-primary/20">
                            *Untuk unit investor, Nominal Investasi dan Persentase Bagi Hasil (%) wajib diisi secara manual sebagai acuan perhitungan profit sharing.
                        </Typography>
                    </Card>
                </View>
            </View>

            <Button
                title={isPending ? (isEdit ? "Memperbarui..." : "Menyimpan...") : (isEdit ? "Perbarui Data" : "Simpan Unit")}
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
                    <Typography variant="h3" weight="bold">{isEdit ? 'Edit Data Unit' : 'Tambah Unit Baru'}</Typography>
                    <Typography variant="caption" className="text-gray-400">Pastikan data unit sesuai dengan STNK/BPKB</Typography>
                </View>
                <ScrollView style={styles.flex1} showsVerticalScrollIndicator={true}>
                    {renderFormContent()}
                </ScrollView>
                <AlertDialog
                    visible={dialogConfig.visible}
                    title={dialogConfig.title}
                    message={dialogConfig.message}
                    variant={dialogConfig.variant}
                    onClose={() => setDialogConfig(p => ({ ...p, visible: false }))}
                />
            </View>
        );
    }

    // Keyboard handled by parent BottomSheet (keyboardBehavior="interactive").
    // Do not wrap BottomSheetScrollView in KeyboardAvoidingView — it blocks scroll.
    return (
        <View style={styles.mobileContainer}>
            <View style={styles.header}>
                <Typography variant="h3" weight="bold">{isEdit ? 'Edit Data Unit' : 'Tambah Unit Baru'}</Typography>
                <Typography variant="caption" className="text-gray-400">Pastikan data unit sesuai dengan STNK/BPKB</Typography>
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
                onClose={() => setDialogConfig(p => ({ ...p, visible: false }))}
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
