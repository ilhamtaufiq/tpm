import React, { useState, useEffect } from 'react';
import { View, ScrollView, Platform, Dimensions, StyleSheet, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
// import { TouchableOpacity } from '@gorhom/bottom-sheet'; // Reverted for web compatibility
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Plus, Trash2, Wrench, Package } from 'lucide-react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCreateTransaksiBengkel, useSparePartsList } from '../hooks/useBengkel';
import { MasterDataSelector } from './ui/MasterDataSelector';
import { SparePartSelector } from './ui/SparePartSelector';
import { JasaSelector } from './ui/JasaSelector';
import { Customer, Vehicle } from '../services/masterData';
import { AlertDialog } from './ui/AlertDialog';
import { getErrorMessage } from '../utils/error';
import { Truck } from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BengkelFormProps {
    onSuccess: () => void;
}

export const BengkelForm = ({ onSuccess }: BengkelFormProps) => {
    const [nomorPlat, setNomorPlat] = useState('');
    const [jenisKendaraan, setJenisKendaraan] = useState('');

    // Customer & Vehicle State
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [guestName, setGuestName] = useState('');

    const [metodeBayar, setMetodeBayar] = useState('Tunai');

    const [services, setServices] = useState<{ id: number; service_id: number; nama_jasa: string; harga: string | number; qty: number }[]>([{ id: Date.now(), service_id: 0, nama_jasa: '', harga: 0, qty: 1 }]);
    const [parts, setParts] = useState<{ id: number; spare_part_id: number; nama: string; harga: string | number; qty: number }[]>([{ id: Date.now(), spare_part_id: 0, nama: '', harga: 0, qty: 1 }]);
    const [total, setTotal] = useState(0); // Subtotal
    const [diskon, setDiskon] = useState('0');
    const [dp, setDp] = useState('0');
    const [grandTotal, setGrandTotal] = useState(0);

    // API Hooks
    const { data: sparePartsData } = useSparePartsList();
    const createTransaksiMutation = useCreateTransaksiBengkel();

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

    const availableParts = sparePartsData?.data || [];

    useEffect(() => {
        const serviceTotal = services.reduce((acc, s) => acc + (Number(parseNumber(s.harga.toString())) * (Number(s.qty) || 1)), 0);
        const partTotal = parts.reduce((acc, p) => acc + ((Number(parseNumber(p.harga.toString())) || 0) * (Number(p.qty) || 0)), 0);
        const subtotal = serviceTotal + partTotal;
        setTotal(subtotal);

        const discAmount = Number(parseNumber(diskon)) || 0;
        setGrandTotal(Math.max(0, subtotal - discAmount));
    }, [services, parts, diskon]);

    const addService = () => setServices([...services, { id: Date.now(), service_id: 0, nama_jasa: '', harga: '', qty: 1 }]);
    const addPart = () => setParts([...parts, { id: Date.now(), spare_part_id: 0, nama: '', harga: '', qty: 1 }]);

    const handleSubmit = async () => {
        if (!nomorPlat) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Nomor plat harus diisi', variant: 'warning' });
            return;
        }
        const finalCustomerName = selectedCustomer ? selectedCustomer.nama : guestName;

        if (!finalCustomerName) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Nama pelanggan harus diisi', variant: 'warning' });
            return;
        }

        const validatedPlat = nomorPlat.substring(0, 15);
        const validatedCustomerName = finalCustomerName.substring(0, 100);

        const payload = {
            tanggal: new Date().toISOString().split('T')[0],
            nomor_plat: validatedPlat,
            jenis_kendaraan: jenisKendaraan.substring(0, 50),
            nama_customer: validatedCustomerName,
            customer_id: selectedCustomer ? selectedCustomer.id : null,
            metode_bayar: metodeBayar.toLowerCase(),
            detail_services: services
                .filter(s => s.nama_jasa.trim().length >= 2)
                .map(s => ({
                    nama_jasa: s.nama_jasa.substring(0, 150),
                    harga: Number(parseNumber(s.harga.toString())) || 0,
                    qty: Number(s.qty) || 1
                })),
            detail_parts: parts
                .filter(p => p.spare_part_id !== 0)
                .map(p => ({
                    spare_part_id: p.spare_part_id,
                    qty: Number(p.qty) || 1,
                    harga_jual: Number(parseNumber(p.harga.toString())) || 0
                })),
            jumlah_bayar: Number(parseNumber(dp)) || 0,
            diskon: Number(parseNumber(diskon)) || 0
        };

        try {
            await createTransaksiMutation.mutateAsync(payload);
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Transaksi bengkel berhasil dibuat',
                variant: 'success'
            });
            setTimeout(() => {
                onSuccess();
            }, 1500);
        } catch (error) {
            console.error('Failed to create transaction:', error);
            setDialogConfig({
                visible: true,
                title: 'Transaksi Gagal',
                message: getErrorMessage(error, 'Gagal membuat transaksi. Cek koneksi dan stok sparepart.'),
                variant: 'error'
            });
        }
    };



    // Form content rendered inside scroll view
    const renderFormContent = () => (
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 10 }}>
            {/* Pelanggan */}
            <View className="mb-6">
                <Typography variant="body2" weight="semibold" className="mb-3 text-primary">Informasi Pelanggan</Typography>
                <MasterDataSelector
                    type="customer"
                    label=""
                    value={selectedCustomer}
                    onSelect={(customer) => {
                        setSelectedCustomer(customer);
                        setSelectedVehicle(null);
                        if (customer) {
                            setGuestName(customer.nama);
                            if (customer.vehicles && customer.vehicles.length === 1) {
                                const v = customer.vehicles[0];
                                setSelectedVehicle(v);
                                setNomorPlat(v.plat_nomor);
                                setJenisKendaraan(v.jenis_unit);
                            }
                        }
                    }}
                    allowGuest={true}
                    placeholder="Pilih Customer atau Ketik Nama..."
                    onGuestNameChange={(name) => {
                        setGuestName(name);
                        setSelectedCustomer(null);
                        setSelectedVehicle(null);
                    }}
                />

                {selectedCustomer && selectedCustomer.vehicles && selectedCustomer.vehicles.length > 0 ? (
                    <View className="mt-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <Typography variant="caption" weight="bold" className="text-gray-400 uppercase mb-3">Kendaraan Terdaftar</Typography>
                        <View className="flex-row flex-wrap gap-2">
                            {selectedCustomer.vehicles.map((v) => (
                                <TouchableOpacity
                                    key={v.id}
                                    onPress={() => {
                                        setSelectedVehicle(v);
                                        setNomorPlat(v.plat_nomor);
                                        setJenisKendaraan(v.jenis_unit);
                                    }}
                                    className={`px-4 py-3 rounded-xl border flex-row items-center ${selectedVehicle?.id === v.id ? 'bg-primary/10 border-primary' : 'bg-white border-gray-100'}`}
                                >
                                    <Truck size={14} color={selectedVehicle?.id === v.id ? '#00AA13' : '#6B7280'} />
                                    <View className="ml-2">
                                        <Typography weight="bold" className={selectedVehicle?.id === v.id ? 'text-primary' : 'text-textMain'}>
                                            {v.plat_nomor}
                                        </Typography>
                                        <Typography className="text-[10px] text-gray-400">{v.jenis_unit}</Typography>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : null}
            </View>

            {/* Kendaraan */}
            <View className="mb-6">
                <Typography variant="body2" weight="semibold" className="mb-3 text-primary">Informasi Kendaraan</Typography>
                <View className="flex-row space-x-3">
                    <Input
                        label="Nomor Plat"
                        placeholder="B 1234 ABC"
                        containerClassName="flex-1"
                        value={nomorPlat}
                        onChangeText={setNomorPlat}
                        editable={!selectedCustomer || (selectedCustomer?.vehicles && selectedCustomer.vehicles.length === 0)}
                        autoCapitalize="characters"
                    />
                    <Input
                        label="Jenis Unit"
                        placeholder="Honda Vario"
                        containerClassName="flex-1"
                        value={jenisKendaraan}
                        onChangeText={setJenisKendaraan}
                        editable={!selectedCustomer || (selectedCustomer?.vehicles && selectedCustomer.vehicles.length === 0)}
                    />
                </View>
            </View>

            {/* Jasa Section */}
            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center">
                        <Wrench size={18} color="#00AA13" />
                        <Typography variant="body2" weight="semibold" className="ml-2">Daftar Jasa (Service)</Typography>
                    </View>
                    <TouchableOpacity onPress={addService} className="flex-row items-center">
                        <Plus size={16} color="#00AA13" />
                        <Typography className="text-primary text-xs ml-1 font-bold">Tambah</Typography>
                    </TouchableOpacity>
                </View>

                {services.map((service, index) => (
                    <Card key={service.id} variant="outlined" className="p-3 mb-3 border-gray-100">
                        <JasaSelector
                            value={service.service_id ? {
                                id: service.service_id,
                                nama: service.nama_jasa,
                                harga: service.harga
                            } : null}
                            onSelect={(js) => {
                                const newS = [...services];
                                if (js) {
                                    newS[index].service_id = js.id;
                                    newS[index].nama_jasa = js.nama;
                                    const cleanPrice = Math.floor(Number(js.harga)).toString();
                                    newS[index].harga = formatNumber(cleanPrice);
                                } else {
                                    newS[index].service_id = 0;
                                    newS[index].nama_jasa = '';
                                    newS[index].harga = '';
                                }
                                setServices(newS);
                            }}
                        />
                        <View className="flex-row gap-2 items-center mt-2 px-1">
                            <View className="flex-1">
                                <Typography variant="caption" className="text-textGray mb-1 ml-1">Penyesuaian Harga</Typography>
                                <Input
                                    placeholder="Harga"
                                    keyboardType="numeric"
                                    containerClassName="mb-0"
                                    className="h-10 text-sm"
                                    value={service.harga.toString()}
                                    onChangeText={(val) => {
                                        const newS = [...services];
                                        newS[index].harga = formatNumber(val);
                                        setServices(newS);
                                    }}
                                />
                            </View>
                            {services.length > 1 ? (
                                <TouchableOpacity
                                    onPress={() => setServices(services.filter(s => s.id !== service.id))}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                    style={{
                                        padding: 8,
                                        marginTop: 20,
                                        zIndex: 100,
                                        cursor: Platform.OS === 'web' ? 'pointer' : undefined
                                    }}
                                    className="items-center justify-center"
                                >
                                    <Trash2 size={20} color="#EE2737" />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </Card>
                ))}
            </View>

            {/* Parts Section */}
            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center">
                        <Package size={18} color="#2563EB" />
                        <Typography variant="body2" weight="semibold" className="ml-2">Daftar Sparepart</Typography>
                    </View>
                    <TouchableOpacity onPress={addPart} className="flex-row items-center">
                        <Plus size={16} color="#2563EB" />
                        <Typography className="text-blue-600 text-xs ml-1 font-bold">Tambah</Typography>
                    </TouchableOpacity>
                </View>

                {parts.map((part, index) => (
                    <Card key={part.id} variant="outlined" className="p-3 mb-3 border-gray-100">
                        <SparePartSelector
                            value={part.spare_part_id ? {
                                id: part.spare_part_id,
                                nama: part.nama,
                                harga_jual: part.harga,
                                stok: (part as any).stok || 0,
                                kode: (part as any).kode || ''
                            } : null}
                            onSelect={(ap) => {
                                const newP = [...parts];
                                if (ap) {
                                    newP[index].spare_part_id = ap.id;
                                    newP[index].nama = ap.nama;
                                    const cleanPrice = Math.floor(Number(ap.harga_jual)).toString();
                                    newP[index].harga = formatNumber(cleanPrice);
                                    (newP[index] as any).stok = ap.stok;
                                    (newP[index] as any).kode = ap.kode;
                                } else {
                                    newP[index].spare_part_id = 0;
                                    newP[index].nama = '';
                                    newP[index].harga = '';
                                }
                                setParts(newP);
                            }}
                        />
                        <View className="flex-row space-x-2 items-center">
                            <Input
                                label="Qty"
                                keyboardType="numeric"
                                containerClassName="flex-1 mb-0"
                                className="h-10 text-sm"
                                value={part.qty.toString()}
                                onChangeText={(val) => {
                                    const newP = [...parts];
                                    newP[index].qty = Number(val);
                                    setParts(newP);
                                }}
                            />
                            <Input
                                label="Harga Unit"
                                keyboardType="numeric"
                                containerClassName="flex-[2] mb-0"
                                className="h-10 text-sm"
                                value={part.harga.toString()}
                                onChangeText={(val) => {
                                    const newP = [...parts];
                                    newP[index].harga = formatNumber(val);
                                    setParts(newP);
                                }}
                            />
                            {parts.length > 1 ? (
                                <TouchableOpacity
                                    onPress={() => setParts(parts.filter(p => p.id !== part.id))}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                    style={{
                                        padding: 8,
                                        marginTop: 24,
                                        zIndex: 100,
                                        cursor: Platform.OS === 'web' ? 'pointer' : undefined
                                    }}
                                >
                                    <Trash2 size={20} color="#EE2737" />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </Card>
                ))}
            </View>

            {/* Total Summary */}
            <View className="mb-6">
                <Card className="bg-primary/5 border border-primary/10 p-5 rounded-3xl">
                    <View className="flex-row justify-between items-center mb-4">
                        <Typography weight="semibold">Metode Bayar</Typography>
                        <View className="flex-row space-x-2">
                            {['Tunai', 'Transfer'].map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    onPress={() => setMetodeBayar(m)}
                                    className={`px-3 py-1.5 rounded-full ${metodeBayar === m ? 'bg-primary' : 'bg-gray-200'}`}
                                >
                                    <Typography className={metodeBayar === m ? 'text-white text-[10px]' : 'text-textGray text-[10px]'}>{m}</Typography>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View className="flex-row space-x-3 mb-4">
                        <View className="flex-1">
                            <Typography variant="caption" weight="medium" className="text-textGray mb-1 ml-1">Diskon (Rp)</Typography>
                            <Input
                                placeholder="0"
                                keyboardType="numeric"
                                containerClassName="mb-0"
                                className="h-10 text-sm"
                                value={diskon}
                                onChangeText={(val) => setDiskon(formatNumber(val))}
                            />
                        </View>
                        <View className="flex-1">
                            <Typography variant="caption" weight="medium" className="text-primary mb-1 ml-1">DP / Bayar (Rp)</Typography>
                            <Input
                                placeholder="0"
                                keyboardType="numeric"
                                containerClassName="mb-0"
                                className="h-10 text-sm border-primary/30"
                                value={dp}
                                onChangeText={(val) => setDp(formatNumber(val))}
                            />
                        </View>
                    </View>

                    <View className="h-[1px] bg-primary/10 mb-4" />

                    <View className="space-y-2 mb-3">
                        <View className="flex-row justify-between items-center">
                            <Typography variant="caption" className="text-textGray">Subtotal</Typography>
                            <Typography variant="caption" weight="semibold">{formatCurrency(total)}</Typography>
                        </View>
                        {Number(parseNumber(diskon)) > 0 ? (
                            <View className="flex-row justify-between items-center">
                                <Typography variant="caption" className="text-rose-500">Diskon</Typography>
                                <Typography variant="caption" weight="semibold" className="text-rose-500">-{formatCurrency(Number(parseNumber(diskon)))}</Typography>
                            </View>
                        ) : null}
                        <View className="flex-row justify-between items-center">
                            <Typography variant="caption" className="text-textGray">Dibayar</Typography>
                            <Typography variant="caption" weight="semibold">{formatCurrency(Number(parseNumber(dp)) || 0)}</Typography>
                        </View>
                    </View>

                    <View className="flex-row justify-between items-center">
                        <View>
                            <Typography variant="body2" weight="bold">Total Akhir</Typography>
                            {grandTotal > (Number(parseNumber(dp)) || 0) ? (
                                <Typography variant="caption" className="text-rose-600 font-bold">
                                    Sisa: {formatCurrency(grandTotal - (Number(parseNumber(dp)) || 0))}
                                </Typography>
                            ) : null}
                        </View>
                        <Typography variant="h2" weight="bold" className="text-primary text-xl">
                            {formatCurrency(grandTotal)}
                        </Typography>
                    </View>
                </Card>
            </View>

            {/* Submit Button */}
            <View className="mb-8">
                <Button
                    title="Buat Transaksi & Masuk Antrian"
                    onPress={handleSubmit}
                    className="rounded-2xl"
                    loading={createTransaksiMutation.isPending}
                />
            </View>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => setDialogConfig(p => ({ ...p, visible: false }))}
            />
        </View>
    );

    // Web version with regular ScrollView
    if (Platform.OS === 'web') {
        return (
            <View style={styles.webContainer}>
                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="h3" weight="bold">Input Order Baru</Typography>
                    <Badge label="Antre" variant="neutral" />
                </View>

                {/* Scrollable Content */}
                <ScrollView
                    style={styles.webScrollView}
                    contentContainerStyle={styles.webScrollContent}
                    showsVerticalScrollIndicator={true}
                >
                    {renderFormContent()}
                </ScrollView>
            </View>
        );
    }

    // Mobile version with BottomSheetScrollView
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.mobileContainer}>
                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="h3" weight="bold">Input Order Baru</Typography>
                    <Badge label="Antre" variant="neutral" />
                </View>

                {/* Scrollable Content for BottomSheet */}
                <BottomSheetScrollView
                    style={styles.mobileScrollView}
                    contentContainerStyle={styles.mobileScrollContent}
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
    webContainer: {
        flex: 1,
        backgroundColor: 'white',
        height: '80vh' as any,
        display: 'flex' as any,
        flexDirection: 'column' as any,
    },
    mobileContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        height: 56,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        backgroundColor: 'white',
    },
    webScrollView: {
        flex: 1,
    },
    webScrollContent: {
        flexGrow: 1,
    },
    mobileScrollView: {
        flex: 1,
    },
    mobileScrollContent: {
        flexGrow: 1,
    },
});
