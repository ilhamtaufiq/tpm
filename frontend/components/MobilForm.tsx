import React, { useState } from 'react';
import { View, ScrollView, TextInput, Alert, ActivityIndicator, Platform, StyleSheet, KeyboardAvoidingView } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Info, User, DollarSign, Calendar, Car, ShieldCheck, Trash2 } from 'lucide-react-native';
import { useCreateMobil } from '../hooks/useMobil';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AlertDialog } from './ui/AlertDialog';
import { getErrorMessage } from '../utils/error';

interface MobilFormProps {
    onSuccess?: () => void;
}
import { formatNumber, parseNumber } from '../utils/format';

export const MobilForm = ({ onSuccess }: MobilFormProps) => {
    const { mutate, isPending } = useCreateMobil();

    // Basic Info
    const [merek, setMerek] = useState('');
    const [model, setModel] = useState('');
    const [tahun, setTahun] = useState('');
    const [nomorPlat, setNomorPlat] = useState('');
    const [warna, setWarna] = useState('');

    // Technical Info
    const [nomorRangka, setNomorRangka] = useState('');
    const [nomorMesin, setNomorMesin] = useState('');
    const [transmisi, setTransmisi] = useState('AT');
    const [kilometer, setKilometer] = useState('');

    // Financial & Ownership
    const [hargaBeli, setHargaBeli] = useState('');
    const [namaInvestor, setNamaInvestor] = useState('');
    const [nominalInvestor, setNominalInvestor] = useState('');
    const [persentaseInvestor, setPersentaseInvestor] = useState('0');

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

        const payload = {
            merek,
            model,
            tahun: parseInt(tahun) || 0,
            nomor_plat: nomorPlat,
            warna,
            nomor_rangka: nomorRangka,
            nomor_mesin: nomorMesin,
            transmisi,
            kilometer: parseNumber(kilometer) || 0,
            harga_beli: parseNumber(hargaBeli),
            tipe_kepemilikan: namaInvestor ? 'investor' : 'tpm',
            nama_investor: namaInvestor || null,
            nominal_investor: parseNumber(nominalInvestor) || 0,
            persentase_investor: parseFloat(persentaseInvestor) || 0,
            tanggal_masuk: new Date().toISOString().split('T')[0] // Default to today
        };

        mutate(payload, {
            onSuccess: () => {
                setDialogConfig({
                    visible: true,
                    title: 'Sukses',
                    message: 'Data mobil berhasil disimpan',
                    variant: 'success'
                });
                setTimeout(() => {
                    onSuccess?.();
                }, 1500);
            },
            onError: (err: any) => {
                setDialogConfig({
                    visible: true,
                    title: 'Gagal Menyimpan',
                    message: getErrorMessage(err, 'Gagal menyimpan data'),
                    variant: 'error'
                });
            }
        });
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
                            {['AT', 'MT'].map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setTransmisi(t)}
                                    className={`flex-1 py-2 rounded-lg items-center ${transmisi === t ? 'bg-white shadow-sm' : ''}`}
                                >
                                    <Typography weight={transmisi === t ? 'bold' : 'medium'} className={transmisi === t ? 'text-primary' : 'text-gray-400'}>{t}</Typography>
                                </TouchableOpacity>
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

                <Input label="Harga Beli (Rp)" placeholder="0" keyboardType="numeric" value={hargaBeli} onChangeText={(v) => setHargaBeli(formatNumber(v))} />

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
                                <Typography variant="body2" className="mb-1 font-medium">Atau Bagi Hasil (%)</Typography>
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

                        <Typography variant="caption" className="text-gray-400 mt-3 italic">
                            *Jika nominal diisi, bagi hasil (%) akan dihitung otomatis dari (Nominal / Total Modal). Jika persentase diisi manual, itu akan menjadi acuan bagi hasil.
                        </Typography>
                    </Card>
                </View>
            </View>

            <Button
                title={isPending ? "Menyimpan..." : "Simpan Unit"}
                variant="primary"
                size="lg"
                onPress={handleSubmit}
                disabled={isPending}
            />

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => setDialogConfig(p => ({ ...p, visible: false }))}
            />
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <View style={styles.webContainer}>
                <View style={styles.header}>
                    <Typography variant="h3" weight="bold">Tambah Unit Baru</Typography>
                    <Typography variant="caption" className="text-gray-400">Pastikan data unit sesuai dengan STNK/BPKB</Typography>
                </View>
                <ScrollView style={styles.flex1} showsVerticalScrollIndicator={true}>
                    {renderFormContent()}
                </ScrollView>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flex1}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.mobileContainer}>
                <View style={styles.header}>
                    <Typography variant="h3" weight="bold">Tambah Unit Baru</Typography>
                    <Typography variant="caption" className="text-gray-400">Pastikan data unit sesuai dengan STNK/BPKB</Typography>
                </View>
                <BottomSheetScrollView
                    style={styles.flex1}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                >
                    {renderFormContent()}
                </BottomSheetScrollView>
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
