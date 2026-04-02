import React, { useState } from 'react';
import { View, ScrollView, TextInput, Alert, ActivityIndicator, Platform, StyleSheet, KeyboardAvoidingView, Pressable } from 'react-native';
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
import { onlineManager } from '@tanstack/react-query';

interface MobilFormProps {
    initialData?: any;
    onSuccess?: () => void;
}


import { Badge } from './ui/Badge';

export const MobilForm = ({ initialData, onSuccess }: MobilFormProps) => {
    const isEdit = !!initialData;
    const createMutation = useCreateMobil();
    const updateMutation = useUpdateMobil();

    const mutation = isEdit ? updateMutation : createMutation;
    const isPending = mutation.isPending;

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
    const [metodeBayar, setMetodeBayar] = useState(initialData?.metode_bayar_beli || '');
    const [statusBayar, setStatusBayar] = useState(initialData?.status_bayar_beli || 'LUNAS');
    const [dp, setDp] = useState(formatNumber(String(initialData?.dp_beli || '0')));

    const [payments, setPayments] = useState<{ id: number; metode: string; jumlah: string }[]>([
        { id: Date.now(), metode: '', jumlah: '' }
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
            if (!metodeBayar) {
                setDialogConfig({ visible: true, title: 'Validasi', message: 'Silakan pilih metode pembayaran', variant: 'warning' });
                return;
            }
            if (metodeBayar === 'SPLIT') {
                const hasEmptyMethod = payments.some(p => !p.metode || parseNumber(p.jumlah) <= 0);
                if (hasEmptyMethod) {
                    setDialogConfig({ visible: true, title: 'Validasi', message: 'Silakan pilih metode pembayaran untuk semua nominal', variant: 'warning' });
                    return;
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
        };

        if (!isEdit) {
            payload.harga_beli = parseNumber(hargaBeli);
            payload.metode_bayar = metodeBayar;
            payload.status_bayar = statusBayar;
            payload.dp = parseNumber(dp) || 0;
            payload.tanggal_masuk = new Date().toISOString().split('T')[0];

            if (metodeBayar === 'SPLIT') {
                payload.payments = payments
                    .filter(p => parseNumber(p.jumlah) > 0)
                    .map(p => ({
                        metode: p.metode.toUpperCase(),
                        jumlah: parseNumber(p.jumlah)
                    }));
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

        if (!onlineManager.isOnline()) {
            if (isEdit) {
                updateMutation.mutate({ id: initialData.id, data: payload });
            } else {
                createMutation.mutate(payload);
            }

            setDialogConfig({
                visible: true,
                title: 'Offline Mode',
                message: isEdit ? 'Update data mobil telah disimpan di antrean offline.' : 'Mobil baru telah disimpan di antrean offline.',
                variant: 'info'
            });

            setTimeout(() => {
                onSuccess?.();
            }, 1500);
            return;
        }

        if (isEdit) {
            updateMutation.mutate({ id: initialData.id, data: payload }, mutateOptions);
        } else {
            createMutation.mutate(payload, mutateOptions);
        }
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
                                <View className="flex-[1.5]">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-tight">Metode Pembayaran</Typography>
                                        {metodeBayar === 'SPLIT' && (
                                            <Badge label="SPLIT AKTIF" variant="warning" />
                                        )}
                                    </View>
                                    <View className="flex-row bg-gray-100 rounded-2xl p-1 border border-gray-200/50 space-x-1">
                                        {[
                                            { label: 'Cash', value: 'TUNAI' },
                                            { label: 'Transfer', value: 'TRANSFER' },
                                            { label: 'Split', value: 'SPLIT' }
                                        ].map((m) => (
                                            <Pressable
                                                key={m.value}
                                                onPress={() => {
                                                    setMetodeBayar(m.value);
                                                }}
                                                className={`flex-1 py-2.5 rounded-xl items-center justify-center ${metodeBayar === m.value ? 'bg-white shadow-sm' : ''}`}
                                            >
                                                <Typography variant="caption" weight="bold" className={`text-center ${metodeBayar === m.value ? 'text-primary' : 'text-gray-400'}`}>
                                                    {m.label}
                                                </Typography>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>

                                {metodeBayar !== 'SPLIT' && (
                                    statusBayar !== 'LUNAS' ? (
                                        <Input
                                            label="Uang Muka / DP (Rp)"
                                            placeholder="0"
                                            containerClassName="flex-1 mb-0"
                                            keyboardType="numeric"
                                            value={dp}
                                            onChangeText={(v) => setDp(formatNumber(v))}
                                        />
                                    ) : (
                                        <View className="flex-1 items-center justify-center p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                            <Typography variant="caption" weight="bold" className="text-emerald-600 text-[10px] uppercase">Lunas Terbayar</Typography>
                                        </View>
                                    )
                                )}
                            </View>

                            {/* Split Payment Editor */}
                            {metodeBayar === 'SPLIT' && (
                                <View className="mt-6 p-4 bg-gray-50/50 rounded-3xl border border-gray-100">
                                    <Typography variant="caption" weight="bold" className="text-primary mb-4 ml-1">RINCIAN PEMBAYARAN MULTI</Typography>

                                    {/* Split Payment Rows */}
                                    {payments.map((p, idx) => (
                                        <View key={p.id} className="flex-row space-x-3 items-end mb-4">
                                            {/* Column: Metode */}
                                            <View className="flex-1">
                                                {idx === 0 && (
                                                    <Typography variant="caption" weight="medium" className="text-textGray mb-1 ml-1">Metode</Typography>
                                                )}
                                                <View className="flex-row bg-white border border-gray-200 rounded-xl overflow-hidden h-10">
                                                    {['Tunai', 'Trf'].map((m) => {
                                                        const longM = m === 'Trf' ? 'Transfer' : 'Tunai';
                                                        return (
                                                            <Pressable
                                                                key={m}
                                                                onPress={() => {
                                                                    const newP = [...payments];
                                                                    newP[idx].metode = longM;
                                                                    setPayments(newP);
                                                                }}
                                                                className={`flex-1 items-center justify-center ${p.metode === longM ? 'bg-primary' : 'bg-transparent'}`}
                                                            >
                                                                <Typography
                                                                    weight="bold"
                                                                    className={`text-[9px] ${p.metode === longM ? 'text-white' : 'text-textGray'}`}
                                                                >
                                                                    {m}
                                                                </Typography>
                                                            </Pressable>
                                                        );
                                                    })}
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
                                        onPress={() => setPayments([...payments, { id: Date.now(), metode: '', jumlah: '' }])}
                                        className="flex-row items-center justify-center py-2 bg-white border border-dashed border-primary/30 rounded-xl mt-1"
                                    >
                                        <Plus size={14} color="#023C69" />
                                        <Typography weight="bold" className="text-primary text-[10px] ml-1 text-center">Tambah Metode Pembayaran</Typography>
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

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex1}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.mobileContainer}>
                <View style={styles.header}>
                    <Typography variant="h3" weight="bold">{isEdit ? 'Edit Data Unit' : 'Tambah Unit Baru'}</Typography>
                    <Typography variant="caption" className="text-gray-400">Pastikan data unit sesuai dengan STNK/BPKB</Typography>
                </View>
                <BottomSheetScrollView
                    style={styles.flex1}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
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
        </KeyboardAvoidingView>
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
