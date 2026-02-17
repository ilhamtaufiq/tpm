import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Platform, Dimensions, StyleSheet, KeyboardAvoidingView, TouchableOpacity, Modal, TextInput, FlatList, SectionList } from 'react-native';
// import { TouchableOpacity } from '@gorhom/bottom-sheet'; // Reverted for web compatibility
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Plus, Trash2, Wrench, Package, Truck, Car, Info, Search, X, ChevronRight } from 'lucide-react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCreateTransaksiBengkel, useSparePartsList } from '../hooks/useBengkel';
import { useMuatanList } from '../hooks/useJasaAngkut';
import { useMobilList } from '../hooks/useMobil';
import { MasterDataSelector } from './ui/MasterDataSelector';
import { SparePartSelector } from './ui/SparePartSelector';
import { JasaSelector } from './ui/JasaSelector';
import { ArmadaSelector } from './ui/ArmadaSelector';
import { Customer, Vehicle } from '../services/masterData';
import { AlertDialog } from './ui/AlertDialog';
import { getErrorMessage } from '../utils/error';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type BengkelKategori = 'umum' | 'jasa_angkut' | 'jual_beli_mobil';

interface BengkelFormProps {
    onSuccess: () => void;
}

export const BengkelForm = ({ onSuccess }: BengkelFormProps) => {
    // Category selection
    const [kategori, setKategori] = useState<BengkelKategori>('umum');
    const [selectedMuatan, setSelectedMuatan] = useState<any>(null);
    const [selectedMobil, setSelectedMobil] = useState<any>(null);
    const [selectedArmada, setSelectedArmada] = useState<any>(null);

    // Search modal states
    const [muatanSearchOpen, setMuatanSearchOpen] = useState(false);
    const [muatanSearchQuery, setMuatanSearchQuery] = useState('');
    const [mobilSearchOpen, setMobilSearchOpen] = useState(false);
    const [mobilSearchQuery, setMobilSearchQuery] = useState('');

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
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; jumlah: string }[]>([{ id: Date.now(), metode: 'Tunai', jumlah: '' }]);
    const [grandTotal, setGrandTotal] = useState(0);

    // API Hooks
    const { data: sparePartsData } = useSparePartsList();
    const createTransaksiMutation = useCreateTransaksiBengkel();

    // Load muatan & mobil data for category pickers
    const { data: muatanData } = useMuatanList({ limit: 100 });
    const { data: mobilData } = useMobilList({ status: 'TERSEDIA' });

    const muatanList = muatanData?.data || [];
    const mobilList = mobilData?.data || mobilData || [];

    // Filtered lists for search
    const filteredMuatan = useMemo(() => {
        let list = muatanList;

        // Stage 1: Filter by selected armada if exists
        if (selectedArmada) {
            list = list.filter((m: any) => m.armada_id === selectedArmada.id || m.nopol === selectedArmada.nopol);
        }

        // Stage 2: Filter by global search query
        if (!muatanSearchQuery.trim()) return list;
        const q = muatanSearchQuery.toLowerCase();
        return list.filter((m: any) =>
            (m.tujuan || '').toLowerCase().includes(q) ||
            (m.asal || '').toLowerCase().includes(q) ||
            (m.supir_nama || '').toLowerCase().includes(q) ||
            (m.nomor_transaksi || '').toLowerCase().includes(q) ||
            (m.nopol || '').toLowerCase().includes(q)
        );
    }, [muatanList, muatanSearchQuery, selectedArmada]);

    const muatanSections = useMemo(() => {
        const groups: { [key: string]: any[] } = {};
        filteredMuatan.forEach((m: any) => {
            const armadaName = m.armada?.nama || m.nopol || 'Armada Luar / Lainnya';
            if (!groups[armadaName]) {
                groups[armadaName] = [];
            }
            groups[armadaName].push(m);
        });

        return Object.keys(groups).sort().map(name => ({
            title: name,
            data: groups[name]
        }));
    }, [filteredMuatan]);

    const filteredMobil = useMemo(() => {
        if (!mobilSearchQuery.trim()) return mobilList;
        const q = mobilSearchQuery.toLowerCase();
        return mobilList.filter((mob: any) =>
            (mob.nomor_plat || '').toLowerCase().includes(q) ||
            (mob.merek || '').toLowerCase().includes(q) ||
            (mob.model || '').toLowerCase().includes(q) ||
            (mob.tahun?.toString() || '').includes(q)
        );
    }, [mobilList, mobilSearchQuery]);

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
        let finalPlat = nomorPlat;
        let finalCustomer = selectedCustomer ? selectedCustomer.nama : guestName;
        let finalJenis = jenisKendaraan;

        // Auto-fill from selectedMuatan if category is jasa_angkut
        if (kategori === 'jasa_angkut' && selectedMuatan) {
            finalPlat = selectedMuatan.nopol || finalPlat;
            finalCustomer = selectedMuatan.supir_nama || selectedMuatan.supir?.nama || finalCustomer;
            finalJenis = 'Armada Jasa Angkut';
        }

        // Auto-fill from selectedMobil if category is jual_beli_mobil
        if (kategori === 'jual_beli_mobil' && selectedMobil) {
            finalPlat = selectedMobil.nomor_plat || finalPlat;
            finalCustomer = 'TPM (Internal)';
            finalJenis = `${selectedMobil.merek || ''} ${selectedMobil.model || ''}`.trim() || 'Mobil';
        }

        if (!finalPlat) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Nomor plat harus diisi', variant: 'warning' });
            return;
        }

        if (!finalCustomer) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Nama pelanggan harus diisi', variant: 'warning' });
            return;
        }

        // Category-specific validation
        if (kategori === 'jasa_angkut' && !selectedMuatan) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Pilih transaksi muatan untuk kategori Jasa Angkut', variant: 'warning' });
            return;
        }
        if (kategori === 'jual_beli_mobil' && !selectedMobil) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Pilih mobil untuk kategori Jual Beli Mobil', variant: 'warning' });
            return;
        }

        const validatedPlat = finalPlat.substring(0, 15);
        const validatedCustomerName = finalCustomer.substring(0, 100);

        // For jasa_angkut or jual_beli_mobil: auto-set internal payment (no cash involved)
        const isInternalJasaAngkut = (kategori === 'jasa_angkut' && selectedMuatan) || (kategori === 'jual_beli_mobil' && selectedMobil);

        const payload: any = {
            tanggal: new Date().toISOString().split('T')[0],
            nomor_plat: validatedPlat,
            jenis_kendaraan: finalJenis.substring(0, 50),
            nama_customer: validatedCustomerName,
            customer_id: selectedCustomer ? selectedCustomer.id : null,
            kategori: kategori,
            muatan_id: kategori === 'jasa_angkut' ? selectedMuatan?.id : null,
            mobil_id: kategori === 'jual_beli_mobil' ? selectedMobil?.id : null,
            metode_bayar: isInternalJasaAngkut ? 'INTERNAL' : metodeBayar.toUpperCase(),
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
            diskon: Number(parseNumber(diskon)) || 0,
            payments: isInternalJasaAngkut
                ? [{ metode: 'INTERNAL', jumlah: grandTotal }]
                : payments
                    .filter(p => Number(parseNumber(p.jumlah)) > 0)
                    .map(p => ({
                        metode: p.metode.toUpperCase(),
                        jumlah: Number(parseNumber(p.jumlah))
                    })),
            jumlah_bayar: isInternalJasaAngkut
                ? grandTotal
                : payments.reduce((acc, p) => acc + (Number(parseNumber(p.jumlah)) || 0), 0)
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

            {/* ===== CATEGORY SELECTOR ===== */}
            <View className="mb-6">
                <Typography variant="body2" weight="semibold" className="mb-3 text-primary">Kategori Bengkel</Typography>
                <View className="flex-row space-x-2">
                    {([
                        { key: 'umum', label: 'Umum', icon: Wrench, color: '#023C69' },
                        { key: 'jasa_angkut', label: 'Jasa Angkut', icon: Truck, color: '#10B981' },
                        { key: 'jual_beli_mobil', label: 'Jual Beli Mobil', icon: Car, color: '#3B82F6' },
                    ] as const).map((cat) => (
                        <TouchableOpacity
                            key={cat.key}
                            onPress={() => {
                                setKategori(cat.key);
                                if (cat.key !== 'jasa_angkut') {
                                    setSelectedMuatan(null);
                                    setSelectedArmada(null);
                                }
                                if (cat.key !== 'jual_beli_mobil') setSelectedMobil(null);
                            }}
                            className={`flex-1 p-3 rounded-2xl border items-center ${kategori === cat.key
                                ? 'bg-primary/10 border-primary'
                                : 'bg-gray-50 border-gray-100'
                                }`}
                        >
                            <cat.icon size={20} color={kategori === cat.key ? cat.color : '#9CA3AF'} />
                            <Typography
                                weight={kategori === cat.key ? 'bold' : 'medium'}
                                className={`text-[10px] mt-1 ${kategori === cat.key ? 'text-primary' : 'text-textGray'}`}
                            >
                                {cat.label}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* ===== MUATAN PICKER (Jasa Angkut) ===== */}
            {kategori === 'jasa_angkut' && (
                <View className="mb-6">
                    <Typography variant="body2" weight="semibold" className="mb-3 text-emerald-600">
                        Informasi Armada & Muatan
                    </Typography>

                    {/* Step 1: Select Armada */}
                    <ArmadaSelector
                        label="Pilih Armada"
                        value={selectedArmada}
                        onSelect={(armada) => {
                            setSelectedArmada(armada);
                            setSelectedMuatan(null); // Reset muatan if armada changes
                        }}
                    />

                    {/* Step 2: Select Muatan (only if armada selected) */}
                    <View className={`mt-2 ${!selectedArmada ? 'opacity-50' : ''}`}>
                        <Typography variant="caption" weight="bold" className="mb-2 text-emerald-700/60 uppercase">
                            Daftar Transaksi Muatan
                        </Typography>
                        <TouchableOpacity
                            disabled={!selectedArmada}
                            onPress={() => {
                                setMuatanSearchQuery('');
                                setMuatanSearchOpen(true);
                            }}
                        >
                            <View className={`rounded-2xl px-4 py-3 border-2 flex-row items-center ${selectedMuatan ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-transparent'
                                }`}>
                                {selectedMuatan ? (
                                    <Truck size={20} color="#10B981" />
                                ) : (
                                    <Search size={20} color={selectedArmada ? "#10B981" : "#9CA3AF"} />
                                )}
                                <View className="flex-1 ml-3">
                                    {selectedMuatan ? (
                                        <>
                                            <Typography weight="bold" className="text-emerald-700 text-sm">
                                                {selectedMuatan.asal} → {selectedMuatan.tujuan}
                                            </Typography>
                                            <Typography variant="caption" className="text-emerald-600/70">
                                                {selectedMuatan.supir_nama || '-'} • {selectedMuatan.nopol} • {formatCurrency(selectedMuatan.pendapatan_kotor || 0)}
                                            </Typography>
                                        </>
                                    ) : (
                                        <Typography className="text-gray-400 text-sm">
                                            {selectedArmada ? `Pilih muatan untuk ${selectedArmada.nama}...` : 'Pilih armada terlebih dahulu'}
                                        </Typography>
                                    )}
                                </View>
                                {selectedMuatan ? (
                                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSelectedMuatan(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <X size={18} color="#EF4444" />
                                    </TouchableOpacity>
                                ) : (
                                    <ChevronRight size={18} color="#9CA3AF" />
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Search Modal */}
                    <Modal visible={muatanSearchOpen} transparent animationType="slide" onRequestClose={() => setMuatanSearchOpen(false)} statusBarTranslucent>
                        <View className="flex-1 justify-end bg-black/50">
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => setMuatanSearchOpen(false)} activeOpacity={1} />
                            <View className="bg-white rounded-t-[32px] h-[80%] overflow-hidden">
                                <View style={{ padding: 24, flex: 1 }}>
                                    <View className="items-center mb-2">
                                        <View className="w-10 h-1 bg-gray-300 rounded-full" />
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Typography variant="h3" weight="bold">Cari Muatan</Typography>
                                        <TouchableOpacity onPress={() => setMuatanSearchOpen(false)}>
                                            <X size={24} color="#6B7280" />
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-4">
                                        <Search size={20} color="#9CA3AF" />
                                        <TextInput
                                            className="flex-1 ml-3 text-base text-text font-outfit"
                                            placeholder="Ketik tujuan, supir, atau no. transaksi..."
                                            value={muatanSearchQuery}
                                            onChangeText={setMuatanSearchQuery}
                                            autoFocus
                                            placeholderTextColor="#9CA3AF"
                                        />
                                    </View>
                                    {muatanList.length === 0 ? (
                                        <View className="items-center py-8">
                                            <Typography className="text-gray-400 italic">Tidak ada data muatan</Typography>
                                        </View>
                                    ) : (
                                        <SectionList
                                            sections={muatanSections}
                                            keyExtractor={(item: any) => item.id.toString()}
                                            showsVerticalScrollIndicator={false}
                                            stickySectionHeadersEnabled={true}
                                            renderSectionHeader={({ section: { title } }) => (
                                                <View className="bg-white py-2 mb-1 border-b border-gray-100 flex-row items-center">
                                                    <View className="w-1 h-4 bg-emerald-500 rounded-full mr-2" />
                                                    <Typography weight="bold" className="text-emerald-700 uppercase tracking-wider text-[10px]">
                                                        {title}
                                                    </Typography>
                                                </View>
                                            )}
                                            renderItem={({ item }: { item: any }) => (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setSelectedMuatan(item);
                                                        setMuatanSearchOpen(false);
                                                    }}
                                                    className="mb-3"
                                                >
                                                    <Card className={`p-4 border flex-row items-center justify-between ${selectedMuatan?.id === item.id ? 'border-emerald-400 bg-emerald-50' : 'border-gray-50 bg-white'
                                                        }`}>
                                                        <View className="flex-1">
                                                            <View className="flex-row justify-between items-start mb-1">
                                                                <Typography weight="bold" className="text-sm text-textMain flex-1 mr-2">
                                                                    {item.asal} → {item.tujuan}
                                                                </Typography>
                                                                <Typography variant="caption" weight="bold" className="text-emerald-600">
                                                                    {formatCurrency(item.pendapatan_kotor || 0)}
                                                                </Typography>
                                                            </View>

                                                            <View className="flex-row items-center mb-1">
                                                                <Typography variant="caption" className="text-gray-500">
                                                                    Supir: <Typography variant="caption" weight="semibold" className="text-textGray">{item.supir_nama || '-'}</Typography>
                                                                </Typography>
                                                                <View className="mx-2 w-1 h-1 bg-gray-300 rounded-full" />
                                                                <Typography variant="caption" className="text-gray-400">
                                                                    {item.nomor_transaksi}
                                                                </Typography>
                                                            </View>

                                                            {item.nopol && (
                                                                <View className="flex-row items-center mt-1">
                                                                    <Truck size={12} color="#9CA3AF" />
                                                                    <Typography className="text-gray-400 text-[10px] ml-1">
                                                                        {item.nopol} {item.armada?.nama ? `(${item.armada.nama})` : ''}
                                                                    </Typography>
                                                                </View>
                                                            )}
                                                        </View>
                                                        {selectedMuatan?.id === item.id && (
                                                            <View className="bg-emerald-500 rounded-full p-1 ml-3">
                                                                <Info size={14} color="#fff" />
                                                            </View>
                                                        )}
                                                    </Card>
                                                </TouchableOpacity>
                                            )}
                                            ListEmptyComponent={
                                                muatanSearchQuery.length > 0 ? (
                                                    <Typography className="text-center text-gray-400 mt-8">Tidak ditemukan</Typography>
                                                ) : null
                                            }
                                        />
                                    )}
                                </View>
                            </View>
                        </View>
                    </Modal>
                </View>
            )}

            {/* ===== MOBIL PICKER (Jual Beli Mobil) ===== */}
            {kategori === 'jual_beli_mobil' && (
                <View className="mb-6">
                    <Typography variant="body2" weight="semibold" className="mb-3 text-blue-600">
                        Pilih Mobil
                    </Typography>

                    {/* Search Trigger Button */}
                    <TouchableOpacity onPress={() => { setMobilSearchQuery(''); setMobilSearchOpen(true); }}>
                        <View className={`rounded-2xl px-4 py-3 border-2 flex-row items-center ${selectedMobil ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-transparent'
                            }`}>
                            {selectedMobil ? (
                                <Car size={20} color="#3B82F6" />
                            ) : (
                                <Search size={20} color="#9CA3AF" />
                            )}
                            <View className="flex-1 ml-3">
                                {selectedMobil ? (
                                    <>
                                        <Typography weight="bold" className="text-blue-700 text-sm">
                                            {selectedMobil.nomor_plat || '-'}
                                        </Typography>
                                        <Typography variant="caption" className="text-blue-600/70">
                                            {selectedMobil.merek} {selectedMobil.model} • {selectedMobil.tahun || ''} • {formatCurrency(selectedMobil.harga_beli || 0)}
                                        </Typography>
                                    </>
                                ) : (
                                    <Typography className="text-gray-400 text-sm">Cari mobil (plat, merek, model)...</Typography>
                                )}
                            </View>
                            {selectedMobil ? (
                                <TouchableOpacity onPress={(e) => { e.stopPropagation(); setSelectedMobil(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <X size={18} color="#EF4444" />
                                </TouchableOpacity>
                            ) : (
                                <ChevronRight size={18} color="#9CA3AF" />
                            )}
                        </View>
                    </TouchableOpacity>

                    {/* Search Modal */}
                    <Modal visible={mobilSearchOpen} transparent animationType="slide" onRequestClose={() => setMobilSearchOpen(false)} statusBarTranslucent>
                        <View className="flex-1 justify-end bg-black/50">
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => setMobilSearchOpen(false)} activeOpacity={1} />
                            <View className="bg-white rounded-t-[32px] h-[80%] overflow-hidden">
                                <View style={{ padding: 24, flex: 1 }}>
                                    <View className="items-center mb-2">
                                        <View className="w-10 h-1 bg-gray-300 rounded-full" />
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Typography variant="h3" weight="bold">Cari Mobil</Typography>
                                        <TouchableOpacity onPress={() => setMobilSearchOpen(false)}>
                                            <X size={24} color="#6B7280" />
                                        </TouchableOpacity>
                                    </View>
                                    <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3 mb-4">
                                        <Search size={20} color="#9CA3AF" />
                                        <TextInput
                                            className="flex-1 ml-3 text-base text-text font-outfit"
                                            placeholder="Ketik plat, merek, atau model..."
                                            value={mobilSearchQuery}
                                            onChangeText={setMobilSearchQuery}
                                            autoFocus
                                            placeholderTextColor="#9CA3AF"
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                    {mobilList.length === 0 ? (
                                        <View className="items-center py-8">
                                            <Typography className="text-gray-400 italic">Tidak ada data mobil tersedia</Typography>
                                        </View>
                                    ) : (
                                        <FlatList
                                            data={filteredMobil}
                                            keyExtractor={(item: any) => item.id.toString()}
                                            showsVerticalScrollIndicator={false}
                                            renderItem={({ item }: { item: any }) => (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setSelectedMobil(item);
                                                        if (item.nomor_plat) setNomorPlat(item.nomor_plat);
                                                        if (item.merek && item.model) setJenisKendaraan(`${item.merek} ${item.model}`);
                                                        setMobilSearchOpen(false);
                                                    }}
                                                >
                                                    <Card className={`mb-3 p-4 border flex-row items-center justify-between ${selectedMobil?.id === item.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100'
                                                        }`}>
                                                        <View className="flex-1">
                                                            <Typography weight="bold" className="text-sm">
                                                                {item.nomor_plat || '-'}
                                                            </Typography>
                                                            <Typography variant="caption" className="text-gray-500 mt-0.5">
                                                                {item.merek} {item.model} • {item.tahun || ''}
                                                            </Typography>
                                                            <Typography weight="bold" className="text-xs text-blue-600 mt-1">
                                                                {formatCurrency(item.harga_beli || 0)}
                                                            </Typography>
                                                        </View>
                                                        {selectedMobil?.id === item.id && (
                                                            <View className="bg-blue-500 rounded-full p-1">
                                                                <Info size={14} color="#fff" />
                                                            </View>
                                                        )}
                                                    </Card>
                                                </TouchableOpacity>
                                            )}
                                            ListEmptyComponent={
                                                mobilSearchQuery.length > 0 ? (
                                                    <Typography className="text-center text-gray-400 mt-8">Tidak ditemukan</Typography>
                                                ) : null
                                            }
                                        />
                                    )}
                                </View>
                            </View>
                        </View>
                    </Modal>
                </View>
            )}

            {/* Pelanggan — hidden for jasa_angkut & jual_beli_mobil */}
            {!(kategori === 'jasa_angkut' && selectedMuatan) && !(kategori === 'jual_beli_mobil' && selectedMobil) && (
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
                                        <Truck size={14} color={selectedVehicle?.id === v.id ? '#023C69' : '#6B7280'} />
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
            )}

            {/* Kendaraan */}
            {!(kategori === 'jasa_angkut' && selectedMuatan) && !(kategori === 'jual_beli_mobil' && selectedMobil) && (
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
            )}

            {/* Jasa Section */}
            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center">
                        <Wrench size={18} color="#023C69" />
                        <Typography variant="body2" weight="semibold" className="ml-2">Daftar Jasa (Service)</Typography>
                    </View>
                    <TouchableOpacity onPress={addService} className="flex-row items-center">
                        <Plus size={16} color="#023C69" />
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

                    {/* Jasa Angkut Internal Banner */}
                    {(kategori === 'jasa_angkut' && selectedMuatan) || (kategori === 'jual_beli_mobil' && selectedMobil) ? (
                        <View className="mb-4">
                            <View className="flex-row items-start bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                <Info size={18} color="#10B981" style={{ marginTop: 2 }} />
                                <View className="ml-3 flex-1">
                                    <Typography variant="body2" weight="bold" className="text-emerald-800 mb-1">Pembayaran Internal</Typography>
                                    <Typography variant="caption" className="text-emerald-600 leading-5">
                                        {kategori === 'jasa_angkut'
                                            ? `Biaya bengkel ini akan otomatis mengurangi Laba TPM (50%) dari trip muatan ${selectedMuatan?.nomor_transaksi}. Tidak ada pembayaran tunai/transfer.`
                                            : `Biaya bengkel ini akan otomatis ditambahkan ke HPP mobil ${selectedMobil?.nomor_plat}. Tidak ada pembayaran tunai/transfer.`
                                        }
                                    </Typography>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <>
                            <View className="flex-row justify-between items-center mb-4">
                                <Typography weight="semibold">Metode Pembayaran</Typography>
                                <TouchableOpacity
                                    onPress={() => setIsSplitPayment(!isSplitPayment)}
                                    className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                                >
                                    <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                                        {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                                    </Typography>
                                </TouchableOpacity>
                            </View>

                            {/* Basic Mode: Single Payment */}
                            {!isSplitPayment && (
                                <View className="flex-row space-x-3 mb-4">
                                    <View className="flex-[1.5]">
                                        <Typography variant="caption" weight="medium" className="text-textGray mb-2 ml-1">Metode</Typography>
                                        <View className="flex-row space-x-1">
                                            {['Tunai', 'Transfer'].map((m) => (
                                                <TouchableOpacity
                                                    key={m}
                                                    onPress={() => {
                                                        const newP = [...payments];
                                                        newP[0].metode = m;
                                                        setPayments(newP);
                                                    }}
                                                    className={`flex-1 py-2 rounded-xl items-center border ${payments[0]?.metode === m ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                                                >
                                                    <Typography className={payments[0]?.metode === m ? 'text-white text-[10px] font-bold' : 'text-textGray text-[10px]'}>{m}</Typography>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                    <View className="flex-1">
                                        <Typography variant="caption" weight="medium" className="text-primary mb-2 ml-1">DP / Bayar (Rp)</Typography>
                                        <Input
                                            placeholder="0"
                                            keyboardType="numeric"
                                            containerClassName="mb-0"
                                            className="h-10 text-sm border-primary/30"
                                            value={payments[0]?.jumlah || ''}
                                            onChangeText={(val) => {
                                                const newP = [...payments];
                                                newP[0].jumlah = formatNumber(val);
                                                setPayments(newP);
                                            }}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Split Mode: Multiple Payments */}
                            {isSplitPayment && (
                                <View className="mb-4">
                                    {payments.map((p, idx) => (
                                        <View key={p.id} className="flex-row space-x-2 items-end mb-3">
                                            <View className="flex-1">
                                                {idx === 0 && <Typography variant="caption" weight="medium" className="text-textGray mb-1">Metode</Typography>}
                                                <View className="flex-row bg-white border border-gray-200 rounded-xl overflow-hidden h-10">
                                                    {['Tunai', 'Trf'].map((m, mIdx) => {
                                                        const longM = m === 'Trf' ? 'Transfer' : 'Tunai';
                                                        return (
                                                            <TouchableOpacity
                                                                key={m}
                                                                onPress={() => {
                                                                    const newP = [...payments];
                                                                    newP[idx].metode = longM;
                                                                    setPayments(newP);
                                                                }}
                                                                className={`flex-1 items-center justify-center ${p.metode === longM ? 'bg-primary' : 'bg-transparent'}`}
                                                            >
                                                                <Typography className={`text-[9px] font-bold ${p.metode === longM ? 'text-white' : 'text-textGray'}`}>{m}</Typography>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                            <View className="flex-1">
                                                {idx === 0 && <Typography variant="caption" weight="medium" className="text-textGray mb-1">Nominal</Typography>}
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
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (payments.length > 1) {
                                                        setPayments(payments.filter(pay => pay.id !== p.id));
                                                    } else {
                                                        setIsSplitPayment(false);
                                                    }
                                                }}
                                                className="h-10 w-8 items-center justify-center bg-rose-50 rounded-xl"
                                            >
                                                <Trash2 size={14} color="#F43F5E" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <TouchableOpacity
                                        onPress={() => setPayments([...payments, { id: Date.now(), metode: 'Tunai', jumlah: '' }])}
                                        className="flex-row items-center justify-center py-2 bg-white border border-dashed border-primary/30 rounded-xl mt-1"
                                    >
                                        <Plus size={14} color="#023C69" />
                                        <Typography className="text-primary text-[10px] font-bold ml-1 text-center">Tambah Metode Pembayaran</Typography>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}

                    <View className="flex-row space-x-3 mb-4">
                        <View className="flex-1">
                            <Typography variant="caption" weight="medium" className="text-textGray mb-1 ml-1">Diskon Total (Rp)</Typography>
                            <Input
                                placeholder="0"
                                keyboardType="numeric"
                                containerClassName="mb-0"
                                className="h-10 text-sm"
                                value={diskon}
                                onChangeText={(val) => setDiskon(formatNumber(val))}
                            />
                        </View>
                        <View className="flex-1 justify-end items-end pb-2">
                            <Typography variant="caption" className="text-textGray">Subtotal: {formatCurrency(total)}</Typography>
                        </View>
                    </View>

                    <View className="h-[1px] bg-primary/10 mb-4" />

                    <View className="flex-row justify-between items-center">
                        <View>
                            <Typography variant="body2" weight="bold">Total Akhir</Typography>
                            {(kategori === 'jasa_angkut' && selectedMuatan) || (kategori === 'jual_beli_mobil' && selectedMobil) ? (
                                <Typography variant="caption" className="text-emerald-500 font-medium">{kategori === 'jasa_angkut' ? 'Potong dari Laba TPM' : 'Masuk HPP Mobil'}</Typography>
                            ) : (() => {
                                const totalPaid = payments.reduce((acc, p) => acc + (Number(parseNumber(p.jumlah)) || 0), 0);
                                if (grandTotal > totalPaid) {
                                    return (
                                        <Typography variant="caption" className="text-rose-600 font-bold">
                                            Sisa: {formatCurrency(grandTotal - totalPaid)}
                                        </Typography>
                                    );
                                } else if (totalPaid > grandTotal) {
                                    return (
                                        <Typography variant="caption" className="text-emerald-600 font-bold">
                                            Kembalian: {formatCurrency(totalPaid - grandTotal)}
                                        </Typography>
                                    );
                                }
                                return <Typography variant="caption" className="text-emerald-500 font-medium">Pas / Lunas</Typography>;
                            })()}
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
