import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Platform, Dimensions, StyleSheet, KeyboardAvoidingView, TouchableOpacity, Modal, TextInput, FlatList, SectionList } from 'react-native';
// import { TouchableOpacity } from '@gorhom/bottom-sheet'; // Reverted for web compatibility
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Plus, Trash2, Wrench, Package, Truck, Car, Info, Search, X, ChevronRight, QrCode } from 'lucide-react-native';
import { BarcodeScannerModal } from './ui/BarcodeScannerModal';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useCreateTransaksiBengkel, useUpdateTransaksiBengkel, useSparePartsList } from '../hooks/useBengkel';
import { useMuatanList } from '../hooks/useJasaAngkut';
import { useMobilList } from '../hooks/useMobil';
import { onlineManager } from '@tanstack/react-query';
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
    initialData?: any;
}

export const BengkelForm = ({ onSuccess, initialData }: BengkelFormProps) => {
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

    const [metodeBayar, setMetodeBayar] = useState<string | null>(null);

    const [services, setServices] = useState<{ id: number; service_id: number; nama_jasa: string; harga: string | number; qty: number }[]>([{ id: Date.now(), service_id: 0, nama_jasa: '', harga: 0, qty: 1 }]);
    const [parts, setParts] = useState<{ id: number; spare_part_id: number; nama: string; harga: string | number; qty: number }[]>([{ id: Date.now(), spare_part_id: 0, nama: '', harga: 0, qty: 1 }]);
    const [total, setTotal] = useState(0); // Subtotal
    const [diskon, setDiskon] = useState('0');
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([{ id: Date.now(), metode: '', nominal: '', catatan: '' }]);
    const [grandTotal, setGrandTotal] = useState(0);
    const [catatan, setCatatan] = useState('');
    const [activeTab, setActiveTab] = useState<'service' | 'sparepart'>('service');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // API Hooks
    const { data: sparePartsData } = useSparePartsList();
    const createTransaksiMutation = useCreateTransaksiBengkel();
    const updateTransaksiMutation = useUpdateTransaksiBengkel();

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

    const serviceCount = useMemo(() => services.filter(s => s.nama_jasa.trim().length > 0).length, [services]);
    const partCount = useMemo(() => parts.filter(p => p.spare_part_id !== 0).length, [parts]);

    useEffect(() => {
        if (initialData) {
            setKategori(initialData.kategori);
            setNomorPlat(initialData.plat_nomor || initialData.nomor_plat || '');
            setJenisKendaraan(initialData.jenis_kendaraan || '');
            setGuestName(initialData.customer_nama || initialData.nama_customer || '');
            setDiskon(formatNumber(initialData.diskon?.toString() || '0'));
            setCatatan(initialData.catatan || '');
            
            // Restore IDs for internal linking
            if (initialData.armada_id) setSelectedArmada({ id: initialData.armada_id, nopol: initialData.nomor_plat, nama: initialData.nama_customer?.replace('Armada ', '') } as any);
            if (initialData.mobil_id) setSelectedMobil({ id: initialData.mobil_id, nomor_plat: initialData.nomor_plat } as any);
            if (initialData.muatan_id) setSelectedMuatan({ id: initialData.muatan_id, nomor_transaksi: initialData.muatan_nomor } as any);
            if (initialData.customer_id) setSelectedCustomer({ id: initialData.customer_id, nama: initialData.customer_nama || initialData.nama_customer } as any);

            // Restore payments
            if (initialData.jumlah_bayar > 0) {
                // If initialData has multiple payments, restore them. Otherwise, use a single payment.
                if (initialData.payments && initialData.payments.length > 1) {
                    setIsSplitPayment(true);
                    setPayments(initialData.payments.map((p: any) => ({
                        id: Math.random(), // Use random ID for new payment objects
                        metode: p.metode.charAt(0).toUpperCase() + p.metode.slice(1).toLowerCase(),
                        nominal: formatNumber(p.jumlah.toString()),
                        catatan: p.catatan || ''
                    })));
                } else {
                    setIsSplitPayment(false);
                    setPayments([{ 
                        id: Date.now(), 
                        metode: initialData.metode_bayar === 'SPLIT' ? 'Tunai' : (initialData.metode_bayar?.charAt(0).toUpperCase() + initialData.metode_bayar?.slice(1).toLowerCase() || ''), 
                        nominal: formatNumber(initialData.jumlah_bayar.toString()),
                        catatan: initialData.catatan_pembayaran || ''
                    }]);
                }
            } else {
                // If no payment data, reset to default empty state
                setPayments([{ id: Date.now(), metode: '', nominal: '', catatan: '' }]);
                setIsSplitPayment(false);
            }
            
            // Restore services
            if (initialData.detail_services && initialData.detail_services.length > 0) {
                setServices(initialData.detail_services.map((s: any) => ({
                    id: s.id || Date.now() + Math.random(),
                    service_id: s.service_id || 0,
                    nama_jasa: s.nama_jasa || '',
                    harga: formatNumber(Math.floor(Number(s.harga || 0)).toString()),
                    qty: s.qty || 1,
                })));
            } else {
                setServices([{ id: Date.now(), service_id: 0, nama_jasa: '', harga: '', qty: 1 }]);
            }

            // Restore parts
            if (initialData.detail_parts && initialData.detail_parts.length > 0) {
                setParts(initialData.detail_parts.map((p: any) => ({
                    id: p.id || Date.now() + Math.random(),
                    spare_part_id: p.spare_part_id || 0,
                    nama: p.spare_part_nama || p.spare_part?.nama || p.nama || '',
                    harga: formatNumber(Math.floor(Number(p.harga_jual || p.harga || 0)).toString()),
                    qty: p.qty || 1,
                    stok: p.spare_part?.stok ?? (p as any).stok ?? 0,
                    kode: p.spare_part?.kode || (p as any).kode || '',
                })));
            } else {
                setParts([{ id: Date.now(), spare_part_id: 0, nama: '', harga: '', qty: 1 }]);
            }
            
            // Note: Customer, Muatan, Mobil selection restoration would require full object match / re-fetch
            // For now, we rely on the manual fields (Plat, Name) which are auto-populated
        }
    }, [initialData]);

    const addService = () => setServices([...services, { id: Date.now(), service_id: 0, nama_jasa: '', harga: '', qty: 1 }]);
    const addPart = () => setParts([...parts, { id: Date.now(), spare_part_id: 0, nama: '', harga: '', qty: 1 }]);

    const handleScanSparePart = (scannedData: string) => {
        const availableParts = sparePartsData?.data || [];
        const part = availableParts.find((p: any) => p.kode === scannedData);
        
        if (part) {
            // Success vibration if available or just proceed
            setIsScannerOpen(false);
            
            // Logic to add or increment part
            const existingPartIndex = parts.findIndex(p => p.spare_part_id === part.id);
            
            if (existingPartIndex !== -1) {
                const newParts = [...parts];
                newParts[existingPartIndex].qty += 1;
                setParts(newParts);
            } else {
                // Check if the last part row is empty, if so, use it
                const lastPart = parts[parts.length - 1];
                if (lastPart && lastPart.spare_part_id === 0 && lastPart.nama === '') {
                    const newParts = [...parts];
                    newParts[parts.length - 1] = {
                        id: Date.now(),
                        spare_part_id: part.id,
                        nama: part.nama,
                        harga: formatNumber(Math.floor(Number(part.harga_jual)).toString()),
                        qty: 1,
                        stok: part.stok,
                        kode: part.kode
                    } as any;
                    setParts(newParts);
                } else {
                    setParts([...parts, {
                        id: Date.now(),
                        spare_part_id: part.id,
                        nama: part.nama,
                        harga: formatNumber(Math.floor(Number(part.harga_jual)).toString()),
                        qty: 1,
                        stok: part.stok,
                        kode: part.kode
                    } as any]);
                }
            }

            setDialogConfig({
                visible: true,
                title: 'Part Ditemukan',
                message: `${part.nama} berhasil ditambahkan ke daftar.`,
                variant: 'success'
            });
            setTimeout(() => setDialogConfig(prev => ({ ...prev, visible: false })), 1200);
        } else {
            setIsScannerOpen(false);
            setDialogConfig({
                visible: true,
                title: 'Tidak Ditemukan',
                message: `Sparepart dengan kode "${scannedData}" tidak ditemukan.`,
                variant: 'warning'
            });
        }
    };

    const handleSubmit = async () => {
        let finalPlat = nomorPlat;
        let finalCustomer = selectedCustomer ? selectedCustomer.nama : guestName;
        let finalJenis = jenisKendaraan;

        // Auto-fill from selectedArmada if category is jasa_angkut
        if (kategori === 'jasa_angkut' && selectedArmada) {
            finalPlat = selectedArmada.nopol || finalPlat;
            finalCustomer = `Armada ${selectedArmada.nama || selectedArmada.nopol}`;
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
        if (kategori === 'jasa_angkut' && !selectedArmada) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Pilih Armada untuk kategori Jasa Angkut', variant: 'warning' });
            return;
        }
        if (kategori === 'jual_beli_mobil' && !selectedMobil) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Pilih mobil untuk kategori Jual Beli Mobil', variant: 'warning' });
            return;
        }

        // Payment validation
        const isInternalTransaction = (kategori === 'jasa_angkut' && selectedArmada) || (kategori === 'jual_beli_mobil' && selectedMobil);
        if (!isInternalTransaction) {
            if (!isSplitPayment) {
                if (!payments[0]?.metode || Number(parseNumber(payments[0]?.nominal)) <= 0) {
                    setDialogConfig({ visible: true, title: 'Validasi', message: 'Silakan pilih metode pembayaran dan isi nominal pembayaran.', variant: 'warning' });
                    return;
                }
            } else {
                const hasInvalidSplitPayment = payments.some(p => !p.metode || Number(parseNumber(p.nominal)) <= 0);
                if (hasInvalidSplitPayment) {
                    setDialogConfig({ visible: true, title: 'Validasi', message: 'Silakan pilih metode pembayaran dan isi nominal untuk setiap baris split payment.', variant: 'warning' });
                    return;
                }
            }
        }

        const validatedPlat = finalPlat.substring(0, 15);
        const validatedCustomerName = finalCustomer.substring(0, 100);

        // For jasa_angkut or jual_beli_mobil: auto-set internal payment (no cash involved)
        const isInternalJasaAngkut = (kategori === 'jasa_angkut' && selectedArmada) || (kategori === 'jual_beli_mobil' && selectedMobil);

        const payload: any = {
            tanggal: initialData ? initialData.tanggal : new Date().toISOString().split('T')[0],
            nomor_plat: validatedPlat,
            jenis_kendaraan: finalJenis.substring(0, 50),
            nama_customer: validatedCustomerName,
            customer_id: selectedCustomer ? selectedCustomer.id : null,
            kategori: kategori,
            muatan_id: kategori === 'jasa_angkut' ? selectedMuatan?.id : null,
            armada_id: kategori === 'jasa_angkut' ? selectedArmada?.id : null,
            mobil_id: kategori === 'jual_beli_mobil' ? selectedMobil?.id : null,
            metode_bayar: isInternalJasaAngkut ? 'INTERNAL' : (isSplitPayment ? 'SPLIT' : payments[0]?.metode?.toUpperCase() || ''),
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
                    .filter(p => Number(parseNumber(p.nominal)) > 0)
                    .map(p => ({
                        metode: p.metode.toUpperCase(),
                        jumlah: Number(parseNumber(p.nominal)),
                        catatan: p.catatan || ''
                    })),
            jumlah_bayar: isInternalJasaAngkut
                ? grandTotal
                : payments.reduce((acc, p) => acc + (Number(parseNumber(p.nominal)) || 0), 0),
            catatan: catatan
        };

        try {
            if (!onlineManager.isOnline()) {
                if (initialData) {
                    updateTransaksiMutation.mutate({ id: initialData.id, data: payload });
                } else {
                    createTransaksiMutation.mutate(payload);
                }
                setDialogConfig({
                    visible: true,
                    title: 'Offline Mode',
                    message: 'Transaksi telah disimpan di antrean offline dan akan disinkronisasi otomatis saat internet tersedia.',
                    variant: 'info'
                });
                setTimeout(() => {
                    onSuccess();
                }, 2000);
                return;
            }

            if (initialData) {
                await updateTransaksiMutation.mutateAsync({ id: initialData.id, data: payload });
            } else {
                await createTransaksiMutation.mutateAsync(payload);
            }
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: initialData ? 'Transaksi bengkel berhasil diperbarui' : 'Transaksi bengkel berhasil dibuat',
                variant: 'success'
            });
            setTimeout(() => {
                onSuccess();
            }, 1500);
        } catch (error) {
            console.error('Failed to save transaction:', error);
            setDialogConfig({
                visible: true,
                title: 'Transaksi Gagal',
                message: getErrorMessage(error, initialData ? 'Gagal memperbarui transaksi.' : 'Gagal membuat transaksi.'),
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

            {/* ===== ARMADA PICKER (Jasa Angkut) ===== */}
            {kategori === 'jasa_angkut' && (
                <View className="mb-6">
                    <Typography variant="body2" weight="semibold" className="mb-3 text-emerald-600">
                        Pilih Armada
                    </Typography>

                    <ArmadaSelector
                        label="Pilih Armada"
                        value={selectedArmada}
                        onSelect={(armada) => {
                            setSelectedArmada(armada);
                        }}
                    />

                    <View className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <Typography variant="caption" className="text-emerald-700 italic">
                            * Transaksi ini akan tercatat sebagai biaya operasional armada dan mengurangi Net Profit (Laba TPM).
                        </Typography>
                    </View>
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
                                    <Typography className="text-gray-400 text-sm">Cari mobil (plat, merek, model)</Typography>
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
                                            placeholder="Ketik plat, merek, atau model"
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
            {kategori !== 'jasa_angkut' && !(kategori === 'jual_beli_mobil' && selectedMobil) && (
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
                        placeholder="Pilih Customer atau Ketik Nama"
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
            {kategori !== 'jasa_angkut' && !(kategori === 'jual_beli_mobil' && selectedMobil) && (
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

            {/* TABS SWITCHER */}
            <View className="mb-6 flex-row bg-gray-100 p-1.5 rounded-[22px]">
                <TouchableOpacity
                    onPress={() => setActiveTab('service')}
                    className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-[18px] ${
                        activeTab === 'service' ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                >
                    <Wrench size={16} color={activeTab === 'service' ? '#023C69' : '#9CA3AF'} />
                    <Typography 
                        variant="caption" 
                        weight={activeTab === 'service' ? 'bold' : 'medium'} 
                        className={`ml-2 ${activeTab === 'service' ? 'text-primary' : 'text-gray-400'}`}
                    >
                        Jasa (Service)
                    </Typography>
                    {serviceCount > 0 && (
                        <View className={`ml-2 px-2 py-0.5 rounded-full ${activeTab === 'service' ? 'bg-primary' : 'bg-gray-200'}`}>
                            <Typography variant="caption" weight="bold" style={{ fontSize: 10, color: '#fff' }}>
                                {serviceCount}
                            </Typography>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('sparepart')}
                    className={`flex-1 flex-row items-center justify-center py-3 px-4 rounded-[18px] ${
                        activeTab === 'sparepart' ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                >
                    <Package size={16} color={activeTab === 'sparepart' ? '#2563EB' : '#9CA3AF'} />
                    <Typography 
                        variant="caption" 
                        weight={activeTab === 'sparepart' ? 'bold' : 'medium'} 
                        className={`ml-2 ${activeTab === 'sparepart' ? 'text-blue-600' : 'text-gray-400'}`}
                    >
                        Sparepart
                    </Typography>
                    {partCount > 0 && (
                        <View className={`ml-2 px-2 py-0.5 rounded-full ${activeTab === 'sparepart' ? 'bg-blue-600' : 'bg-gray-200'}`}>
                            <Typography variant="caption" weight="bold" style={{ fontSize: 10, color: '#fff' }}>
                                {partCount}
                            </Typography>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Jasa Section */}
            {activeTab === 'service' && (
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
                            <View className="flex-row items-center space-x-2">
                                <View style={{ flex: 1 }}>
                                    <JasaSelector
                                        value={service.nama_jasa ? {
                                            id: service.service_id || 0,
                                            nama: service.nama_jasa,
                                            harga: service.harga,
                                            kategori: 'Servis',
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
                                </View>
                                {services.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => setServices(services.filter(s => s.id !== service.id))}
                                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                        style={{
                                            padding: 10,
                                            zIndex: 100,
                                            cursor: Platform.OS === 'web' ? 'pointer' : undefined
                                        }}
                                        className="items-center justify-center bg-red-50 rounded-2xl"
                                    >
                                        <Trash2 size={22} color="#EE2737" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </Card>
                    ))}
                </View>
            )}

            {/* Parts Section */}
            {activeTab === 'sparepart' && (
                <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-3">
                        <View className="flex-row items-center">
                            <Package size={18} color="#2563EB" />
                            <Typography variant="body2" weight="semibold" className="ml-2">Daftar Sparepart</Typography>
                        </View>
                        <View className="flex-row items-center">
                            <TouchableOpacity 
                                onPress={() => setIsScannerOpen(true)} 
                                className="flex-row items-center mr-4 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100"
                            >
                                <QrCode size={16} color="#2563EB" />
                                <Typography className="text-blue-600 text-xs ml-1 font-bold">Scan</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={addPart} className="flex-row items-center">
                                <Plus size={16} color="#2563EB" />
                                <Typography className="text-blue-600 text-xs ml-1 font-bold">Tambah</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {parts.map((part, index) => (
                        <Card key={part.id} variant="outlined" className="p-3 mb-3 border-gray-100">
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <SparePartSelector
                                        value={(part.spare_part_id || part.nama) ? {
                                            id: part.spare_part_id,
                                            nama: part.nama,
                                            harga_jual: part.harga,
                                            stok: (part as any).stok ?? 0,
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
                                </View>
                                <View style={{
                                    width: 64,
                                    backgroundColor: '#F3F4F6',
                                    borderRadius: 12,
                                    paddingHorizontal: 8,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    alignSelf: 'stretch',
                                }}>
                                    <Typography variant="caption" className="text-textGray" style={{ fontSize: 10, marginBottom: 2 }}>Qty</Typography>
                                    <TextInput
                                        keyboardType="numeric"
                                        value={part.qty.toString()}
                                        onChangeText={(val) => {
                                            const newP = [...parts];
                                            newP[index].qty = Number(val) || 0;
                                            setParts(newP);
                                        }}
                                        style={{
                                            fontSize: 15,
                                            fontWeight: '700',
                                            color: '#111827',
                                            textAlign: 'center',
                                            width: '100%',
                                            padding: 0,
                                        }}
                                    />
                                </View>
                                {parts.length > 1 && (
                                    <TouchableOpacity
                                        onPress={() => setParts(parts.filter(p => p.id !== part.id))}
                                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                        style={{
                                            padding: 10,
                                            zIndex: 100,
                                            cursor: Platform.OS === 'web' ? 'pointer' : undefined,
                                            backgroundColor: '#FEF2F2',
                                            borderRadius: 12,
                                            alignSelf: 'stretch',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Trash2 size={20} color="#EE2737" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </Card>
                    ))}
                </View>
            )}

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
                                    onPress={() => {
                                        setIsSplitPayment(!isSplitPayment);
                                        // Reset payments to a single empty entry if switching from split to single
                                        if (isSplitPayment) {
                                            setPayments([{ id: Date.now(), metode: '', nominal: '', catatan: '' }]);
                                        }
                                    }}
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
                                                        if (newP.length === 0) newP.push({ id: Date.now(), metode: '', nominal: '', catatan: '' });
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
                                            value={payments[0]?.nominal || ''}
                                            onChangeText={(val) => {
                                                const newP = [...payments];
                                                if (newP.length === 0) newP.push({ id: Date.now(), metode: '', nominal: '', catatan: '' });
                                                newP[0].nominal = formatNumber(val);
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
                                                    value={p.nominal}
                                                    onChangeText={(val) => {
                                                        const newP = [...payments];
                                                        newP[idx].nominal = formatNumber(val);
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
                                                        setPayments([{ id: Date.now(), metode: '', nominal: '', catatan: '' }]); // Reset to single empty payment
                                                    }
                                                }}
                                                className="h-10 w-8 items-center justify-center bg-rose-50 rounded-xl"
                                            >
                                                <Trash2 size={14} color="#F43F5E" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <TouchableOpacity
                                        onPress={() => setPayments([...payments, { id: Date.now(), metode: '', nominal: '', catatan: '' }])}
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
                            {(kategori === 'jasa_angkut' && selectedArmada) || (kategori === 'jual_beli_mobil' && selectedMobil) ? (
                                <Typography variant="caption" className="text-emerald-500 font-medium">{kategori === 'jasa_angkut' ? 'Potong dari Laba TPM' : 'Masuk HPP Mobil'}</Typography>
                            ) : (
                                <View>
                                    {(() => {
                                        const totalPaid = payments.reduce((acc, p) => acc + (Number(parseNumber(p.nominal)) || 0), 0);
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
                            )}
                        </View>
                        <Typography variant="h2" weight="bold" className="text-primary text-xl">
                            {formatCurrency(grandTotal)}
                        </Typography>
                    </View>
                </Card>
            </View>

            <View className="mb-6">
                <Typography variant="body2" weight="semibold" className="mb-3 text-primary">Catatan Tambahan</Typography>
                <Input
                    placeholder="Contoh: Titipan kunci, barang berharga, atau pesan mekanik"
                    multiline
                    numberOfLines={3}
                    className="h-24 py-3"
                    value={catatan}
                    onChangeText={setCatatan}
                />
            </View>

            {/* Submit Button */}
            <View className="mb-8">
                <Button
                    title={initialData ? "Update Transaksi" : "Buat Transaksi & Masuk Antrian"}
                    onPress={handleSubmit}
                    className="rounded-2xl"
                    loading={createTransaksiMutation.isPending || updateTransaksiMutation.isPending}
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
                    <Typography variant="h3" weight="bold">{initialData ? 'Edit Transaksi' : 'Input Order Baru'}</Typography>
                    <Badge label={initialData ? initialData.nomor_transaksi : "Antre"} variant={initialData ? "info" : "neutral"} />
                </View>

                {/* Scrollable Content */}
                <ScrollView
                    style={styles.webScrollView}
                    contentContainerStyle={styles.webScrollContent}
                    showsVerticalScrollIndicator={true}
                >
                    {renderFormContent()}
                </ScrollView>
                <BarcodeScannerModal 
                    visible={isScannerOpen} 
                    onClose={() => setIsScannerOpen(false)} 
                    onScan={handleScanSparePart} 
                />
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
                    <Typography variant="h3" weight="bold">{initialData ? 'Edit Transaksi' : 'Input Order Baru'}</Typography>
                    <Badge label={initialData ? initialData.nomor_transaksi : "Antre"} variant={initialData ? "info" : "neutral"} />
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
                <BarcodeScannerModal 
                    visible={isScannerOpen} 
                    onClose={() => setIsScannerOpen(false)} 
                    onScan={handleScanSparePart} 
                />
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
