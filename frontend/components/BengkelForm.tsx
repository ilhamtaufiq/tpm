import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Platform, Dimensions, StyleSheet, KeyboardAvoidingView, TextInput, FlatList, SectionList, TouchableOpacity, Pressable, GestureResponderEvent, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Plus, Trash2, Wrench, Package, Truck, Car, Info, Search, X, ChevronRight, QrCode, Banknote, Wallet, Building2, Printer, CheckCircle2, Circle } from 'lucide-react-native';
import { BarcodeScannerModal } from './ui/BarcodeScannerModal';
import { BottomSheetContainer } from './ui/BottomSheetContainer';
import { useCreateTransaksiBengkel, useUpdateTransaksiBengkel, useSparePartsList } from '../hooks/useBengkel';
import { useMuatanList } from '../hooks/useJasaAngkut';
import { useKasBankBalances } from '../hooks/useKeuangan';
import { useMobilList } from '../hooks/useMobil';
import { useDebounce } from '../hooks/useDebounce';
import { onlineManager } from '@tanstack/react-query';
import { MasterDataSelector } from './ui/MasterDataSelector';
import { ArmadaSelector } from './ui/ArmadaSelector';
import { Customer, Vehicle } from '../services/masterData';
import { AlertDialog } from './ui/AlertDialog';
import { getErrorMessage } from '../utils/error';
import { printReceipt, PrintReceiptData } from '../utils/printReceipt';
import { printSettingsService, PrintSettings } from '../utils/printSettings';
import { useJasaList } from '../hooks/useJasaServis';
import { getCustomTabBarBottomPadding } from './ui/CustomTabBar';
import { isBengkelTransactionLocked } from '../utils/bengkelTransaction';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type BengkelKategori = 'umum' | 'jasa_angkut' | 'jual_beli_mobil';

interface BengkelFormProps {
    onSuccess: () => void;
    initialData?: any;
    isPage?: boolean;
}

export const BengkelForm = ({ onSuccess, initialData, isPage = false }: BengkelFormProps) => {
    const insets = useSafeAreaInsets();
    const isLocked = isBengkelTransactionLocked(initialData);
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
    const [showDiscountOnPrint, setShowDiscountOnPrint] = useState(true);

    const [services, setServices] = useState<{ id: number; service_id: number; nama_jasa: string; harga: string | number; qty: number }[]>([{ id: Date.now() + Math.random(), service_id: 0, nama_jasa: '', harga: 0, qty: 1 }]);
    const [parts, setParts] = useState<{ id: number; spare_part_id: number; nama: string; harga: string | number; qty: number; stok?: number; kode?: string }[]>([{ id: Date.now() + Math.random(), spare_part_id: 0, nama: '', harga: 0, qty: 1 }]);
    const [total, setTotal] = useState(0); // Subtotal
    const [diskon, setDiskon] = useState('0');
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; metode: string; nominal: string; catatan: string }[]>([{ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }]);
    const [grandTotal, setGrandTotal] = useState(0);
    const [catatan, setCatatan] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerMode, setScannerMode] = useState<'sparepart' | 'plate' | 'vessel'>('sparepart');
    const [scanLog, setScanLog] = useState<{ id: string; title: string; subtitle?: string; timestamp: number }[]>([]);
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
    const [isPrintingOrderSlip, setIsPrintingOrderSlip] = useState(false);
    const [isSelectionSheetOpen, setIsSelectionSheetOpen] = useState(false);
    const [selectionSheetSearch, setSelectionSheetSearch] = useState('');
    const debouncedSelectionSheetSearch = useDebounce(selectionSheetSearch, 500);
    const selectionSheetQuery = debouncedSelectionSheetSearch.trim();

    const { data: balancesData } = useKasBankBalances();
    const bankUtamaBengkel = balancesData?.bank_utama?.sub_balances?.bengkel || 0;

    // API Hooks
    const { data: sparePartsData } = useSparePartsList({
        limit: 5000,
        search: selectionSheetQuery || undefined,
    });
    const { data: jasaData } = useJasaList({
        limit: 5000,
        search: selectionSheetQuery || undefined,
    });
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

    const availableParts = useMemo(() => {
        return sparePartsData?.pages.flatMap(page => (page as any).data || []) || [];
    }, [sparePartsData]);
    const availableServices = useMemo(() => {
        const raw = jasaData?.data || [];
        return Array.isArray(raw) ? raw : [];
    }, [jasaData]);
    const filteredPartChoices = useMemo(() => {
        const q = selectionSheetQuery.toLowerCase();
        if (!q) return availableParts.slice(0, 20);
        return availableParts.filter((part: any) =>
            String(part.nama || '').toLowerCase().includes(q) ||
            String(part.kode || '').toLowerCase().includes(q) ||
            String(part.kode_part || '').toLowerCase().includes(q) ||
            String(part.kategori || '').toLowerCase().includes(q) ||
            String(part.merek || '').toLowerCase().includes(q)
        );
    }, [availableParts, selectionSheetQuery]);
    const filteredServiceChoices = useMemo(() => {
        const q = selectionSheetQuery.toLowerCase();
        if (!q) return availableServices.slice(0, 20);
        return availableServices.filter((service: any) =>
            String(service.nama || '').toLowerCase().includes(q) ||
            String(service.kategori || '').toLowerCase().includes(q) ||
            String(service.deskripsi || '').toLowerCase().includes(q)
        );
    }, [availableServices, selectionSheetQuery]);

    useEffect(() => {
        let mounted = true;
        printSettingsService.getSettings()
            .then((settings) => {
                if (mounted) setPrintSettings(settings);
            })
            .catch((error) => {
                console.error('Failed to load print settings:', error);
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const serviceTotal = services.reduce((acc, s) => acc + (Number(parseNumber(s.harga.toString())) * (Number(s.qty) || 1)), 0);
        const partTotal = parts.reduce((acc, p) => acc + ((Number(parseNumber(p.harga.toString())) || 0) * (Number(p.qty) || 0)), 0);
        const subtotal = serviceTotal + partTotal;
        setTotal(subtotal);

        const discAmount = Number(parseNumber(diskon)) || 0;
        const calculatedGrandTotal = Math.max(0, subtotal - discAmount);
        setGrandTotal(calculatedGrandTotal);

        // Auto-sync payment for Jasa Angkut
        if (kategori === 'jasa_angkut' && !isSplitPayment) {
            setPayments([{
                id: payments[0]?.id || (Date.now() + Math.random()),
                metode: 'Transfer',
                nominal: formatNumber(calculatedGrandTotal.toString()),
                catatan: payments[0]?.catatan || ''
            }]);
        }
    }, [services, parts, diskon, kategori, isSplitPayment]);

    const selectedPartsForDisplay = useMemo(() => parts.filter((part) => part.spare_part_id !== 0 || part.nama.trim().length > 0), [parts]);
    const selectedServicesForDisplay = useMemo(() => services.filter((service) => service.service_id !== 0 || service.nama_jasa.trim().length > 0), [services]);
    const hasBillableItems = selectedPartsForDisplay.length > 0 || selectedServicesForDisplay.length > 0;

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
                        id: Date.now() + Math.random(),
                        metode: initialData.metode_bayar === 'SPLIT' ? 'Tunai' : (initialData.metode_bayar?.charAt(0).toUpperCase() + initialData.metode_bayar?.slice(1).toLowerCase() || ''),
                        nominal: formatNumber(initialData.jumlah_bayar.toString()),
                        catatan: initialData.catatan_pembayaran || ''
                    }]);
                }
            } else {
                // If no payment data, reset to default empty state
                setPayments([{ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }]);
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
                setServices([{ id: Date.now() + Math.random(), service_id: 0, nama_jasa: '', harga: '', qty: 1 }]);
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
                setParts([{ id: Date.now() + Math.random(), spare_part_id: 0, nama: '', harga: '', qty: 1 }]);
            }

            // Note: Customer, Muatan, Mobil selection restoration would require full object match / re-fetch
            // For now, we rely on the manual fields (Plat, Name) which are auto-populated
        }
    }, [initialData]);

    const openSelectionSheet = () => {
        setSelectionSheetSearch('');
        setIsSelectionSheetOpen(true);
    };

    const togglePartSelection = (part: any) => {
        setParts(prev => {
            const existing = prev.find(item => item.spare_part_id === part.id);
            if (existing) {
                return prev.filter(item => item.id !== existing.id);
            }
            return [
                ...prev,
                {
                    id: Date.now() + Math.random(),
                    spare_part_id: part.id,
                    nama: part.nama,
                    harga: formatNumber(Math.floor(Number(part.harga_jual || 0)).toString()),
                    qty: 1,
                    stok: part.stok,
                    kode: part.kode,
                } as any,
            ];
        });
    };

    const toggleServiceSelection = (service: any) => {
        setServices(prev => {
            const existing = prev.find(item => item.service_id === service.id);
            if (existing) {
                return prev.filter(item => item.id !== existing.id);
            }
            return [
                ...prev,
                {
                    id: Date.now() + Math.random(),
                    service_id: service.id,
                    nama_jasa: service.nama,
                    harga: formatNumber(Math.floor(Number(service.harga || 0)).toString()),
                    qty: 1,
                } as any,
            ];
        });
    };

    const updatePartQty = (id: number, qty: number) => {
        setParts(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, qty) } : item));
    };

    const updateServiceQty = (id: number, qty: number) => {
        setServices(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(1, qty) } : item));
    };

    const resolveWorkOrderIdentity = () => {
        const isJasaAngkutInternal = kategori === 'jasa_angkut' && !!selectedArmada;
        const isMobilInternal = kategori === 'jual_beli_mobil' && !!selectedMobil;

        let finalPlat = nomorPlat;
        let finalCustomer = selectedCustomer ? selectedCustomer.nama : guestName;
        let finalJenis = jenisKendaraan;

        if (isJasaAngkutInternal) {
            finalPlat = selectedArmada?.nopol || finalPlat;
            finalCustomer = `Armada ${selectedArmada?.nama || selectedArmada?.nopol || ''}`.trim();
            finalJenis = 'Armada Jasa Angkut';
        }

        if (isMobilInternal) {
            finalPlat = selectedMobil?.nomor_plat || finalPlat;
            finalCustomer = 'TPM (Internal)';
            finalJenis = `${selectedMobil?.merek || ''} ${selectedMobil?.model || ''}`.trim() || 'Mobil';
        }

        return {
            finalPlat,
            finalCustomer,
            finalJenis,
        };
    };

    const buildOrderSlipData = (): PrintReceiptData => {
        const { finalPlat, finalCustomer, finalJenis } = resolveWorkOrderIdentity();
        const slipNumber = initialData?.nomor_transaksi || initialData?.nomor_antrian || `SLIP-${Date.now()}`;
        const detailServices = services
            .filter(s => s.nama_jasa.trim().length >= 2)
            .map(s => ({
                description: s.nama_jasa.substring(0, 150),
                quantity: Number(s.qty) || 1,
                unitPrice: Number(parseNumber(s.harga.toString())) || 0,
                subtotal: (Number(parseNumber(s.harga.toString())) || 0) * (Number(s.qty) || 1),
            }));
        const detailParts = parts
            .filter(p => p.spare_part_id !== 0)
            .map(p => ({
                description: p.nama || 'Sparepart',
                quantity: Number(p.qty) || 1,
                unitPrice: Number(parseNumber(p.harga.toString())) || 0,
                subtotal: (Number(parseNumber(p.harga.toString())) || 0) * (Number(p.qty) || 1),
            }));

        return {
            type: 'bengkel',
            transactionNumber: slipNumber.toString(),
            antrian: initialData?.nomor_antrian || '-',
            date: new Date(initialData?.tanggal || new Date()),
            customerName: (finalCustomer || 'Guest').toString(),
            status: 'ANTRE',
            vehiclePlate: finalPlat || '-',
            vehicleType: finalJenis || '-',
            services: detailServices,
            parts: detailParts,
            subtotal: total,
            discount: Number(parseNumber(diskon)) || 0,
            total: grandTotal,
            paid: 0,
            paymentMethod: 'ORDER SLIP',
            notes: catatan || undefined,
            showDiscount: showDiscountOnPrint,
        };
    };

    const handlePrintOrderSlip = async () => {
        if (!printSettings) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: 'Pengaturan cetak belum dimuat',
                variant: 'error'
            });
            return;
        }

        try {
            setIsPrintingOrderSlip(true);
            const latestSettings = await printSettingsService.getSettings();
            setPrintSettings(latestSettings);
            await printReceipt(buildOrderSlipData(), latestSettings);
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: 'Order Slip berhasil dicetak',
                variant: 'success'
            });
        } catch (error) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal mencetak Order Slip'),
                variant: 'error'
            });
        } finally {
            setIsPrintingOrderSlip(false);
        }
    };

    const handleScanSparePart = (scannedData: string): boolean => {
        const cleanData = scannedData.trim();

        // Try exact match on internal kode or manufacturer kode_part
        let part = availableParts.find((p: any) => p.kode === cleanData || p.kode_part === cleanData);

        // If not found, try matching without leading zeros (common in some barcode systems)
        if (!part) {
            const strippedData = cleanData.replace(/^0+/, '');
            part = availableParts.find((p: any) =>
                (p.kode || '').replace(/^0+/, '') === strippedData ||
                (p.kode_part || '').replace(/^0+/, '') === strippedData
            );
        }

        if (part) {
            // Success vibration if available or just proceed
            // NOTE: We don't close the scanner immediately to allow continuous scanning of multiple parts
            // unless the user clicks "Selesai" in the modal

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
                        id: Date.now() + Math.random(),
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
                        id: Date.now() + Math.random(),
                        spare_part_id: part.id,
                        nama: part.nama,
                        harga: formatNumber(Math.floor(Number(part.harga_jual)).toString()),
                        qty: 1,
                        stok: part.stok,
                        kode: part.kode
                    } as any]);
                }
            }

            // Add to scan log
            setScanLog(prev => [{
                id: Math.random().toString(),
                title: part.nama,
                subtitle: `Kode: ${part.kode} • ${part.stok === 999 ? 'Always Ready' : `Stok: ${part.stok}`}`,
                timestamp: Date.now()
            }, ...prev]);

            setDialogConfig({
                visible: true,
                title: 'Part Ditemukan',
                message: `${part.nama} berhasil ditambahkan ke daftar.`,
                variant: 'success'
            });
            setTimeout(() => setDialogConfig(prev => ({ ...prev, visible: false })), 1200);
            return true;
        }

        setDialogConfig({
            visible: true,
            title: 'Tidak Ditemukan',
            message: `Kode "${scannedData}" tidak terdaftar sebagai Kode Part Pabrik maupun Kode Stok Internal.`,
            variant: 'warning'
        });
        setTimeout(() => setDialogConfig(prev => ({ ...prev, visible: false })), 2000);
        return false;
    };

    const handleScanPlate = (scannedData: string): boolean => {
        const cleanData = scannedData.trim().toUpperCase();
        setIsScannerOpen(false);

        // If it's the jasa_angkut category, try to match with Armada
        if (kategori === 'jasa_angkut') {
            const armada = muatanList.find((m: any) => m.nopol === cleanData || (m.nomor_transaksi === cleanData));
            if (armada) {
                // If we found a muatan/armada, select it
                setSelectedArmada({ id: armada.armada_id, nopol: armada.nopol, nama: armada.armada?.nama } as any);
                setNomorPlat(armada.nopol);
                setJenisKendaraan(armada.info_kendaraan || '');
                return true;
            }
        }

        // If it's jual_beli_mobil, try to match with Mobil
        if (kategori === 'jual_beli_mobil') {
            const mobil = mobilList.find((m: any) => m.nomor_plat === cleanData);
            if (mobil) {
                setSelectedMobil(mobil);
                setNomorPlat(mobil.nomor_plat);
                setJenisKendaraan(`${mobil.merek} ${mobil.model}`);
                return true;
            }
        }

        // Default: just set the plate number
        setNomorPlat(cleanData);

        // Try to find if this plate belongs to an existing vehicle in customer's list
        if (selectedCustomer && selectedCustomer.vehicles) {
            const v = selectedCustomer.vehicles.find(v => v.plat_nomor === cleanData);
            if (v) {
                setSelectedVehicle(v);
                setJenisKendaraan(v.jenis_unit);
            }
        }

        // Add to scan log
        setScanLog(prev => [{
            id: Math.random().toString(),
            title: `Plat: ${cleanData}`,
            subtitle: 'Data kendaraan diperbarui',
            timestamp: Date.now()
        }, ...prev]);
        return true;
    };

    const handleSubmit = async () => {
        if (isLocked) return;
        const isJasaAngkutInternal = kategori === 'jasa_angkut' && !!selectedArmada;
        const isMobilInternal = kategori === 'jual_beli_mobil' && !!selectedMobil;
        const { finalPlat, finalCustomer, finalJenis } = resolveWorkOrderIdentity();
        const detailServices = services
            .filter(s => s.nama_jasa.trim().length >= 2)
            .map(s => ({
                nama_jasa: s.nama_jasa.substring(0, 150),
                harga: Number(parseNumber(s.harga.toString())) || 0,
                qty: Number(s.qty) || 1
            }));
        const detailParts = parts
            .filter(p => p.spare_part_id !== 0)
            .map(p => ({
                spare_part_id: p.spare_part_id,
                qty: Number(p.qty) || 1,
                harga_jual: Number(parseNumber(p.harga.toString())) || 0
            }));

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

        const validatedPlat = finalPlat.substring(0, 15);
        const validatedCustomerName = finalCustomer.substring(0, 100);

        const paymentItems = kategori === 'umum'
            ? payments
                .map((payment) => ({
                    metode: (payment.metode || 'Tunai').toUpperCase(),
                    jumlah: Number(parseNumber(payment.nominal)) || 0,
                    catatan: payment.catatan || '',
                }))
                .filter((payment) => payment.jumlah > 0)
            : [];
        const totalPaid = paymentItems.reduce((acc, payment) => acc + payment.jumlah, 0);

        const metodeBayarFinal = paymentItems.length > 1
            ? 'SPLIT'
            : (paymentItems[0]?.metode || 'KREDIT');

        const payload: any = {
            ...(initialData ? { tanggal: initialData.tanggal } : {}),
            nomor_plat: validatedPlat,
            jenis_kendaraan: finalJenis.substring(0, 50),
            nama_customer: validatedCustomerName,
            customer_id: kategori === 'umum' && selectedCustomer ? selectedCustomer.id : null,
            kategori: kategori,
            muatan_id: kategori === 'jasa_angkut' ? selectedMuatan?.id : null,
            armada_id: kategori === 'jasa_angkut' ? selectedArmada?.id : null,
            mobil_id: kategori === 'jual_beli_mobil' ? selectedMobil?.id : null,
            metode_bayar: kategori === 'umum' ? metodeBayarFinal : 'KREDIT',
            detail_services: detailServices,
            detail_parts: detailParts,
            diskon: 0,
            payments: kategori === 'umum' ? paymentItems : [],
            jumlah_bayar: kategori === 'umum' ? totalPaid : 0,
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
                        <Pressable
                            key={cat.key}
                            onPress={() => {
                                setKategori(cat.key);
                                if (cat.key === 'jasa_angkut') {
                                    setIsSplitPayment(false);
                                    // Auto-set to Transfer and full amount for Jasa Angkut
                                    setPayments([{
                                        id: Date.now() + Math.random(),
                                        metode: 'Transfer',
                                        nominal: formatNumber(grandTotal.toString()),
                                        catatan: ''
                                    }]);
                                } else if (cat.key === 'umum' || cat.key === 'jual_beli_mobil') {
                                    setIsSplitPayment(false);
                                    setPayments([{
                                        id: Date.now() + Math.random(),
                                        metode: '',
                                        nominal: '',
                                        catatan: ''
                                    }]);
                                }
                                if (cat.key !== 'jasa_angkut') {
                                    setSelectedMuatan(null);
                                    setSelectedArmada(null);
                                }
                                if (cat.key !== 'umum') {
                                    setSelectedCustomer(null);
                                    setSelectedVehicle(null);
                                    setGuestName('');
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
                        </Pressable>
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

                </View>
            )}
            {/* ===== MOBIL PICKER (Jual Beli Mobil) ===== */}
            {kategori === 'jual_beli_mobil' && (
                <View className="mb-6">
                    <Typography variant="body2" weight="semibold" className="mb-3 text-blue-600">
                        Pilih Mobil
                    </Typography>

                    {/* Search Trigger Button */}
                    <Pressable onPress={() => { setMobilSearchQuery(''); setMobilSearchOpen(true); }}>
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
                                <Pressable onPress={(e: GestureResponderEvent) => { e.stopPropagation(); setSelectedMobil(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <X size={18} color="#EF4444" />
                                </Pressable>
                            ) : (
                                <ChevronRight size={18} color="#9CA3AF" />
                            )}
                        </View>
                    </Pressable>

                    {/* Search Overlay using Modal (Fixes clipping in ScrollViews on Android) */}
                    <Modal
                        visible={mobilSearchOpen}
                        animationType="slide"
                        onRequestClose={() => setMobilSearchOpen(false)}
                        statusBarTranslucent
                    >
                        <View style={{ flex: 1, backgroundColor: 'white' }}>
                            <View style={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, flex: 1 }}>
                                <View className="items-center mb-2">
                                    <View className="w-10 h-1 bg-gray-300 rounded-full" />
                                </View>
                                <View className="flex-row justify-between items-center mb-4">
                                    <Typography variant="h3" weight="bold">Cari Mobil</Typography>
                                    <Pressable onPress={() => setMobilSearchOpen(false)}>
                                        <X size={24} color="#6B7280" />
                                    </Pressable>
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
                                            <Pressable
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
                                            </Pressable>
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
                    </Modal>
                </View>
            )}
            {/* Pelanggan — hidden for jasa_angkut & jual_beli_mobil */}
            {kategori !== 'jasa_angkut' && kategori !== 'jual_beli_mobil' && (
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
                                    <Pressable
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
                                    </Pressable>
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
                        <View className="flex-1 relative">
                            <Input
                                label="Nomor Plat"
                                placeholder="B 1234 ABC"
                                containerClassName="mb-0"
                                value={nomorPlat}
                                onChangeText={setNomorPlat}
                                editable={!selectedCustomer || (selectedCustomer?.vehicles && selectedCustomer.vehicles.length === 0)}
                                autoCapitalize="characters"
                            />
                            {(!selectedCustomer || (selectedCustomer?.vehicles && selectedCustomer.vehicles.length === 0)) && (
                                <Pressable
                                    onPress={() => { setScannerMode('plate'); setIsScannerOpen(true); }}
                                    className="absolute right-3 top-9"
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <QrCode size={18} color="#023C69" />
                                </Pressable>
                            )}
                        </View>
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

            <View className="mb-6">
                <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-row items-center">
                        <Package size={18} color="#2563EB" />
                        <View className="ml-2">
                            <Typography variant="body2" weight="semibold">Sparepart & Servis</Typography>
                            <Typography style={{ fontSize: 9, color: '#94A3B8' }}>Tambah item lewat satu daftar pilihan</Typography>
                        </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <Pressable onPress={openSelectionSheet} className="flex-row items-center bg-primary/10 px-3 py-2 rounded-xl border border-primary/10">
                            <Plus size={14} color="#023C69" />
                            <Typography className="text-primary text-[10px] ml-1 font-bold">Tambah Sparepart / Servis</Typography>
                        </Pressable>
                    </View>
                </View>

                {selectedPartsForDisplay.length === 0 && selectedServicesForDisplay.length === 0 ? (
                    <View className="bg-gray-50 border border-dashed border-gray-200 rounded-[24px] px-4 py-6">
                        <Typography className="text-center text-gray-400 text-sm">Belum ada sparepart atau servis dipilih.</Typography>
                        <Typography className="text-center text-gray-400 text-[11px] mt-1">Tekan tombol tambah untuk membuka daftar lalu centang item yang dibutuhkan.</Typography>
                    </View>
                ) : (
                    <>
                        {selectedPartsForDisplay.length > 0 && (
                            <View className="mb-5">
                                <View className="flex-row items-center mb-3">
                                    <Package size={16} color="#2563EB" />
                                    <Typography variant="body2" weight="semibold" className="ml-2">Daftar Sparepart</Typography>
                                </View>
                                {selectedPartsForDisplay.map((part) => (
                                    <Card key={part.id} variant="outlined" className="p-3 mb-3 border-gray-100">
                                        <View className="flex-row items-start justify-between mb-3">
                                            <View className="flex-1 pr-3">
                                                <Typography weight="bold" className="text-textMain">{part.nama || 'Sparepart'}</Typography>
                                                <Typography variant="caption" className="text-gray-400">
                                                    {part.kode ? `Kode: ${part.kode}` : 'Pilih dari daftar sparepart'}
                                                </Typography>
                                                <Typography variant="caption" className="text-gray-400">
                                                    {part.stok !== undefined ? `Stok: ${part.stok}` : ''}
                                                </Typography>
                                            </View>
                                            <Pressable
                                                onPress={() => setParts(prev => prev.filter(p => p.id !== part.id))}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                className="bg-red-50 rounded-xl p-2"
                                            >
                                                <Trash2 size={18} color="#EE2737" />
                                            </Pressable>
                                        </View>

                                        <View className="flex-row space-x-3">
                                            <View className="w-20 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100">
                                                <Typography variant="caption" className="text-textGray mb-1">Qty</Typography>
                                                <TextInput
                                                    keyboardType="numeric"
                                                    value={part.qty.toString()}
                                                    onChangeText={(val) => updatePartQty(part.id, Number(val) || 0)}
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
                                            <View className="flex-1 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100">
                                                <Typography variant="caption" className="text-textGray mb-1">Harga</Typography>
                                                <TextInput
                                                    keyboardType="numeric"
                                                    value={String(part.harga || '')}
                                                    onChangeText={(val) => {
                                                        const newP = [...parts];
                                                        const index = newP.findIndex((item) => item.id === part.id);
                                                        if (index !== -1) {
                                                            newP[index].harga = formatNumber(val);
                                                            setParts(newP);
                                                        }
                                                    }}
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: '700',
                                                        color: '#111827',
                                                        width: '100%',
                                                        padding: 0,
                                                    }}
                                                />
                                            </View>
                                        </View>
                                    </Card>
                                ))}
                            </View>
                        )}

                        {selectedServicesForDisplay.length > 0 && (
                            <View className="mb-2">
                                <View className="flex-row items-center mb-3">
                                    <Wrench size={16} color="#023C69" />
                                    <Typography variant="body2" weight="semibold" className="ml-2">Daftar Servis</Typography>
                                </View>
                                {selectedServicesForDisplay.map((service) => (
                                    <Card key={service.id} variant="outlined" className="p-3 mb-3 border-gray-100">
                                        <View className="flex-row items-start justify-between mb-3">
                                            <View className="flex-1 pr-3">
                                                <Typography weight="bold" className="text-textMain">{service.nama_jasa || 'Jasa'}</Typography>
                                                <Typography variant="caption" className="text-gray-400">
                                                    {service.service_id ? `ID: ${service.service_id}` : 'Pilih dari daftar jasa'}
                                                </Typography>
                                            </View>
                                            <Pressable
                                                onPress={() => setServices(prev => prev.filter(s => s.id !== service.id))}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                className="bg-red-50 rounded-xl p-2"
                                            >
                                                <Trash2 size={18} color="#EE2737" />
                                            </Pressable>
                                        </View>

                                        <View className="flex-row space-x-3">
                                            <View className="w-20 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100">
                                                <Typography variant="caption" className="text-textGray mb-1">Qty</Typography>
                                                <TextInput
                                                    keyboardType="numeric"
                                                    value={service.qty.toString()}
                                                    onChangeText={(val) => updateServiceQty(service.id, Number(val) || 0)}
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
                                            <View className="flex-1 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100">
                                                <Typography variant="caption" className="text-textGray mb-1">Harga</Typography>
                                                <TextInput
                                                    keyboardType="numeric"
                                                    value={String(service.harga || '')}
                                                    onChangeText={(val) => {
                                                        const newS = [...services];
                                                        const index = newS.findIndex((item) => item.id === service.id);
                                                        if (index !== -1) {
                                                            newS[index].harga = formatNumber(val);
                                                            setServices(newS);
                                                        }
                                                    }}
                                                    style={{
                                                        fontSize: 15,
                                                        fontWeight: '700',
                                                        color: '#111827',
                                                        width: '100%',
                                                        padding: 0,
                                                    }}
                                                />
                                            </View>
                                        </View>
                                    </Card>
                                ))}
                            </View>
                        )}
                    </>
                )}
                </View>

            {/* Total Summary */}
            <View className="mb-6">
                <Card className="bg-white border border-gray-100 p-6 rounded-[32px] shadow-sm">

                    {/* Jual Beli Mobil: Internal Deferred Payment */}
                    {(kategori === 'jual_beli_mobil' && selectedMobil) && (
                        <View className="mb-4">
                            <View className="flex-row items-center bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                <Info size={18} color="#D97706" />
                                <View className="ml-3 flex-1">
                                    <Typography variant="body2" weight="bold" className="text-amber-800">Internal Jual Beli</Typography>
                                    <Typography variant="caption" className="text-amber-600 mt-1">
                                        Dicatat sebagai hutang internal Mobil → Bengkel. Dompet unit tidak dipotong; biaya masuk HPP. Pelunasan buku saat mobil terjual.
                                    </Typography>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Jasa Angkut: Internal Unit Spent (Visible Payment Method) */}
                    {(kategori === 'jasa_angkut' && selectedArmada) && (
                        <View className="mb-4">
                            <View className="flex-row items-center bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                <Info size={18} color="#10B981" />
                                <View className="ml-3 flex-1">
                                    <Typography variant="body2" weight="bold" className="text-emerald-800">Biaya Internal Jasa Angkut</Typography>
                                    <Typography variant="caption" className="text-emerald-600 mt-1">
                                        Dicatat sebagai hutang internal JA → Bengkel. Dompet unit tidak dipotong; biaya masuk laporan trip/armada.
                                    </Typography>
                                </View>
                            </View>
                        </View>
                    )}

                    <View className="flex-row space-x-3 mb-4">
                        <View className={`flex-1 justify-end items-end pb-2 ${kategori === 'jasa_angkut' ? 'items-start' : ''}`}>
                            <Typography variant="caption" className="text-gray-500 font-medium">Subtotal: {formatCurrency(total)}</Typography>
                        </View>
                    </View>

                    <View className="h-[1px] bg-primary/10 mb-4" />

                    <View className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                        <View className="flex-row justify-between items-center mb-1">
                            <View className="flex-row items-center flex-1">
                                <Typography variant="body2" weight="bold" className="text-slate-500 uppercase tracking-wider text-[10px]">
                                    {hasBillableItems ? 'Rincian Order' : 'Ringkasan Antrian'}
                                </Typography>
                                {hasBillableItems && (
                                    <Pressable
                                        onPress={handlePrintOrderSlip}
                                        className="ml-2 bg-primary/10 rounded-full p-1.5"
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Printer size={12} color="#023C69" />
                                    </Pressable>
                                )}
                            </View>
                            {kategori === 'jasa_angkut' && selectedArmada ? (
                                <View className="bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                                    <Typography className="text-orange-600 font-bold text-[9px]">POTONG LABA UNIT</Typography>
                                </View>
                            ) : kategori === 'jual_beli_mobil' && selectedMobil ? (
                                <View className="bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">
                                    <Typography className="text-orange-600 font-bold text-[9px]">CAPITAL HPP MOBIL</Typography>
                                </View>
                            ) : null}
                        </View>

                        <View className="flex-row justify-between items-end">
                            <View className="flex-1">
                                {false && hasBillableItems && !(kategori === 'jasa_angkut' || kategori === 'jual_beli_mobil') && (
                                    <View>
                                        {(() => {
                                            const totalPaid = payments.reduce((acc, p) => acc + (Number(parseNumber(p.nominal)) || 0), 0);
                                            if (grandTotal > totalPaid) {
                                                return (
                                                    <View className="bg-rose-50 self-start px-2 py-1 rounded-lg border border-rose-100 mt-1">
                                                        <Typography variant="caption" className="text-rose-600 font-bold text-[10px]">
                                                            {totalPaid === 0 ? 'PIUTANG 100%' : `SISA PIUTANG: ${formatCurrency(grandTotal - totalPaid)}`}
                                                        </Typography>
                                                    </View>
                                                );
                                            } else if (totalPaid > grandTotal) {
                                                return (
                                                    <View className="bg-emerald-50 self-start px-3 py-1.5 rounded-2xl flex-row items-center mt-2 border border-emerald-100 shadow-sm">
                                                        <Banknote size={14} color="#10B981" />
                                                        <Typography variant="caption" className="text-emerald-700 font-bold ml-2 text-[11px]">
                                                            KEMBALIAN: {formatCurrency(totalPaid - grandTotal)}
                                                        </Typography>
                                                    </View>
                                                );
                                            }
                                            return <View className="bg-emerald-50 self-start px-2 py-1 rounded-lg border border-emerald-100 mt-1">
                                                <Typography variant="caption" className="text-emerald-600 font-bold text-[10px]">LUNAS</Typography>
                                            </View>;
                                        })()}
                                    </View>
                                )}
                                <Typography variant="caption" className="text-slate-400 mt-1">
                                    {hasBillableItems ? 'Pembayaran diproses setelah pekerjaan selesai.' : 'Belum ada servis/sparepart. Simpan sebagai antrian dulu.'}
                                </Typography>
                            </View>

                            <View className="items-end">
                                <Typography variant="caption" className="text-slate-400 line-through mb-1">{diskon !== '0' ? formatCurrency(total) : ''}</Typography>
                                <Typography variant="h2" weight="bold" className="text-primary text-2xl tracking-tighter">
                                    {formatCurrency(grandTotal)}
                                </Typography>
                            </View>
                        </View>
                    </View>
                </Card>
            </View>

            {/* DP / Uang Muka — muncul di bawah total */}
            {kategori === 'umum' && (
                <View className="mb-6">
                    <Card className="bg-white border border-gray-100 p-6 rounded-[32px] shadow-sm">
                        <>
                            <View className="flex-row justify-between items-center mb-4">
                                <Typography weight="semibold">Uang Muka / DP (Opsional)</Typography>
                                <Pressable
                                        onPress={() => {
                                            setIsSplitPayment(!isSplitPayment);
                                            if (isSplitPayment) {
                                                setPayments([{ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }]);
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-white border border-white'}`}
                                    >
                                        <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                                            {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                                        </Typography>
                                    </Pressable>
                            </View>

                            {/* Basic Mode: Single Payment */}
                            {!isSplitPayment && (
                                <View className="mb-4">
                                    <Typography variant="caption" weight="semibold" className="text-gray-600 mb-2 ml-1">Sumber Pembayaran</Typography>
                                    <View className="flex-row space-x-2 mb-3">
                                        {[
                                            { label: 'Dompet', value: 'Tunai', icon: <Wallet size={12} color={payments[0]?.metode === 'Tunai' ? 'white' : '#64748b'} /> },
                                            { label: 'Bank', value: 'Transfer', icon: <Building2 size={12} color={payments[0]?.metode === 'Transfer' ? 'white' : '#64748b'} /> }
                                        ].map((m) => (
                                            <Pressable
                                                key={m.value}
                                                onPress={() => {
                                                    const newP = [...payments];
                                                    if (newP.length === 0) newP.push({ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' });
                                                    newP[0].metode = newP[0].metode === m.value ? '' : m.value;
                                                    setPayments(newP);
                                                }}
                                                className={`flex-1 py-2.5 rounded-2xl items-center justify-center border shadow-sm ${payments[0]?.metode === m.value ? 'bg-primary border-primary' : 'bg-slate-50 border-slate-100'}`}
                                            >
                                                <View className="flex-row items-center">
                                                    {m.icon}
                                                    <Typography className={`ml-1.5 ${payments[0]?.metode === m.value ? 'text-white text-[10px] font-bold' : 'text-slate-600 text-[10px] font-semibold'}`}>{m.label}</Typography>
                                                </View>
                                            </Pressable>
                                        ))}
                                    </View>
                                    <View className="flex-row items-center justify-between mb-2 ml-1">
                                        <Typography variant="caption" weight="bold" className="text-primary">DP / Bayar (Rp)</Typography>
                                        <Pressable
                                            onPress={() => {
                                                const newP = [...payments];
                                                if (newP.length === 0) newP.push({ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' });
                                                newP[0].nominal = formatNumber(grandTotal.toString());
                                                setPayments(newP);
                                            }}
                                        >
                                            <Typography className="text-[9px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">BAYAR PAS</Typography>
                                        </Pressable>
                                    </View>
                                    <Input
                                        placeholder="0"
                                        keyboardType="numeric"
                                        containerClassName="mb-0"
                                        innerContainerClassName="!bg-white border-gray-100"
                                        className="h-10 text-sm font-bold"
                                        value={payments[0]?.nominal || ''}
                                        onChangeText={(val) => {
                                            const newP = [...payments];
                                            if (newP.length === 0) newP.push({ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' });
                                            newP[0].nominal = formatNumber(val);
                                            setPayments(newP);
                                        }}
                                    />
                                </View>
                            )}

                            {/* Split Mode: Multiple Payments */}
                            {isSplitPayment && (
                                <View className="mb-4">
                                    {payments.map((p, idx) => (
                                        <View key={p.id} className="flex-row space-x-2 items-end mb-3">
                                            <View className="flex-1">
                                                {idx === 0 && <Typography variant="caption" weight="medium" className="text-textGray mb-1">Metode</Typography>}
                                                <View className="flex-row bg-white border border-white rounded-xl overflow-hidden h-10">
                                                    {['Tunai', 'Trf'].map((m) => {
                                                        const longM = m === 'Trf' ? 'Transfer' : 'Tunai';
                                                        return (
                                                            <Pressable
                                                                key={m}
                                                                onPress={() => {
                                                                    const newP = [...payments];
                                                                    newP[idx].metode = newP[idx].metode === longM ? '' : longM;
                                                                    setPayments(newP);
                                                                }}
                                                                className={`flex-1 items-center justify-center ${p.metode === longM ? 'bg-primary' : 'bg-transparent'}`}
                                                            >
                                                                <Typography className={`text-[10px] font-bold ${p.metode === longM ? 'text-white' : 'text-gray-600'}`}>{m}</Typography>
                                                            </Pressable>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center justify-between mb-1">
                                                    {idx === 0 ? <Typography variant="caption" weight="medium" className="text-textGray px-1">Nominal</Typography> : <View />}
                                                    <Pressable
                                                        onPress={() => {
                                                            const newP = [...payments];
                                                            const otherPayments = newP.filter((_, i) => i !== idx).reduce((acc, cr) => acc + (Number(parseNumber(cr.nominal)) || 0), 0);
                                                            newP[idx].nominal = formatNumber(Math.max(0, grandTotal - otherPayments).toString());
                                                            setPayments(newP);
                                                        }}
                                                        className="px-1"
                                                    >
                                                        <Typography className="text-[8px] text-primary font-bold">LUNASKAN</Typography>
                                                    </Pressable>
                                                </View>
                                                <Input
                                                    placeholder="0"
                                                    keyboardType="numeric"
                                                    containerClassName="mb-0"
                                                    innerContainerClassName="!bg-white border-gray-100"
                                                    className="h-10 text-sm font-bold"
                                                    value={p.nominal}
                                                    onChangeText={(val) => {
                                                        const newP = [...payments];
                                                        newP[idx].nominal = formatNumber(val);
                                                        setPayments(newP);
                                                    }}
                                                />
                                            </View>
                                            <Pressable
                                                onPress={() => {
                                                    if (payments.length > 1) {
                                                        setPayments(payments.filter(pay => pay.id !== p.id));
                                                    } else {
                                                        setIsSplitPayment(false);
                                                        setPayments([{ id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }]);
                                                    }
                                                }}
                                                className="h-10 w-8 items-center justify-center bg-rose-50 rounded-xl"
                                            >
                                                <Trash2 size={14} color="#F43F5E" />
                                            </Pressable>
                                        </View>
                                    ))}
                                    <Pressable
                                        onPress={() => setPayments([...payments, { id: Date.now() + Math.random(), metode: '', nominal: '', catatan: '' }])}
                                        className="flex-row items-center justify-center py-2 bg-white border border-dashed border-primary/30 rounded-xl mt-1"
                                    >
                                        <Plus size={14} color="#023C69" />
                                        <Typography className="text-primary text-[10px] font-bold ml-1 text-center">Tambah Metode Pembayaran</Typography>
                                    </Pressable>
                                </View>
                            )}
                        </>
                    </Card>
                </View>
            )}

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

            <View className="mb-2 flex-row items-center justify-between">
                <Typography variant="caption" weight="semibold" className="text-slate-500 uppercase tracking-widest text-[10px]">Opsi Cetak Struk</Typography>
                <Pressable
                    onPress={() => setShowDiscountOnPrint(prev => !prev)}
                    className={`px-3 py-1.5 rounded-full border ${showDiscountOnPrint ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}
                >
                    <Typography className={`text-[10px] font-bold ${showDiscountOnPrint ? 'text-emerald-700' : 'text-gray-500'}`}>
                        {showDiscountOnPrint ? 'Diskon tampil' : 'Diskon disembunyikan'}
                    </Typography>
                </Pressable>
            </View>

            <View className="mb-3">
                <Button
                    title="Cetak Order Slip"
                    variant="outline"
                    icon={<Printer size={16} color="#023C69" />}
                    onPress={handlePrintOrderSlip}
                    className="rounded-2xl"
                    loading={isPrintingOrderSlip}
                />
            </View>

                    {/* Submit Button */}
                    <View className="mb-8">
                        <Button
                            title={initialData ? "Update Antrian" : "Buat Antrian Bengkel"}
                    onPress={handleSubmit}
                    className="rounded-2xl"
                    disabled={isLocked}
                    loading={createTransaksiMutation.isPending || updateTransaksiMutation.isPending}
                />
            </View>
        </View>
    );

    const renderSelectionSheet = () => {
        if (!isSelectionSheetOpen) return null;

        const hasSearchQuery = selectionSheetSearch.trim().length > 0;
        const sections = hasSearchQuery
            ? [
                {
                    key: 'search',
                    title: 'Hasil Pencarian',
                    subtitle: 'Semua hasil yang cocok dari sparepart dan servis.',
                    data: [
                        ...filteredPartChoices.map((item) => ({ ...item, itemType: 'part' as const })),
                        ...filteredServiceChoices.map((item) => ({ ...item, itemType: 'service' as const })),
                    ],
                },
            ]
            : [
                {
                    key: 'part',
                    title: 'Daftar Sparepart',
                    subtitle: 'Centang sparepart yang ingin ditambahkan ke transaksi.',
                    data: filteredPartChoices.map((item) => ({ ...item, itemType: 'part' as const })),
                },
                {
                    key: 'service',
                    title: 'Daftar Servis',
                    subtitle: 'Centang jasa servis yang ingin ditambahkan ke transaksi.',
                    data: filteredServiceChoices.map((item) => ({ ...item, itemType: 'service' as const })),
                },
            ];

        return (
            <Modal
                visible
                transparent
                animationType="slide"
                onRequestClose={() => setIsSelectionSheetOpen(false)}
                statusBarTranslucent
            >
                <BottomSheetContainer
                    onClose={() => setIsSelectionSheetOpen(false)}
                    insets={insets}
                    maxHeight={720}
                    backdropColor="rgba(0,0,0,0.45)"
                    panelStyle={{ paddingHorizontal: 0, paddingTop: 0 }}
                >
                        <View className="px-6 pt-6 pb-4">
                            <View className="items-center mb-2">
                                <View className="w-10 h-1 bg-gray-300 rounded-full" />
                            </View>
                            <View className="flex-row justify-between items-start mb-2">
                                <View className="flex-1 pr-3">
                                    <Typography variant="h3" weight="bold">Pilih Sparepart & Servis</Typography>
                                    <Typography variant="caption" className="text-gray-400 mt-1">
                                        Centang item dari daftar sparepart dan servis dalam satu bottomsheet.
                                    </Typography>
                                </View>
                                <View className="flex-row items-center gap-2">
                                    <Pressable
                                        onPress={() => {
                                            setScannerMode('sparepart');
                                            setIsScannerOpen(true);
                                        }}
                                        className="flex-row items-center bg-blue-50 px-3 py-2 rounded-full border border-blue-100"
                                    >
                                        <QrCode size={14} color="#2563EB" />
                                        <Typography className="text-blue-600 text-[10px] ml-1 font-bold">Scan</Typography>
                                    </Pressable>
                                    <Pressable onPress={() => setIsSelectionSheetOpen(false)} className="bg-gray-100 rounded-full p-2">
                                        <X size={20} color="#6B7280" />
                                    </Pressable>
                                </View>
                            </View>

                            <View className="flex-row items-center bg-gray-100 rounded-2xl px-4 py-3 mb-4">
                                <Search size={18} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 ml-3 text-base text-text font-outfit"
                                    placeholder="Cari sparepart atau servis..."
                                    value={selectionSheetSearch}
                                    onChangeText={setSelectionSheetSearch}
                                    autoFocus
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <Pressable
                                onPress={() => {
                                    setScannerMode('sparepart');
                                    setIsScannerOpen(true);
                                }}
                                className="flex-row items-center justify-center bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4"
                            >
                                <QrCode size={16} color="#2563EB" />
                                <Typography className="text-blue-600 text-xs ml-2 font-bold">
                                    Shortcut Scan Sparepart
                                </Typography>
                            </Pressable>

                            {(() => {
                                const renderSelectableItem = (item: any, isPartSheet: boolean, showTypeBadge = false) => {
                                    const isSelected = isPartSheet
                                        ? parts.some((part) => part.spare_part_id === item.id)
                                        : services.some((service) => service.service_id === item.id);

                                    return (
                                        <Pressable
                                            key={`${item.id}-${isPartSheet ? 'part' : 'service'}`}
                                            onPress={() => isPartSheet ? togglePartSelection(item) : toggleServiceSelection(item)}
                                            className={`mb-3 rounded-2xl border p-4 flex-row items-center ${isSelected ? 'bg-primary/5 border-primary/20' : 'bg-white border-gray-100'}`}
                                        >
                                            <View className="flex-1 pr-3">
                                                <View className="flex-row items-center flex-wrap">
                                                    <Typography weight="bold" className="text-textMain">
                                                        {item.nama || (isPartSheet ? 'Sparepart' : 'Jasa Servis')}
                                                    </Typography>
                                                    {showTypeBadge && (
                                                        <View className={`ml-2 px-2 py-0.5 rounded-full ${isPartSheet ? 'bg-blue-50' : 'bg-primary/10'}`}>
                                                            <Typography className={`text-[9px] font-bold ${isPartSheet ? 'text-blue-600' : 'text-primary'}`}>
                                                                {isPartSheet ? 'Sparepart' : 'Servis'}
                                                            </Typography>
                                                        </View>
                                                    )}
                                                </View>
                                                <Typography variant="caption" className="text-gray-400 mt-0.5">
                                                    {isPartSheet
                                                        ? `${item.kode || item.kode_part || '-'} • ${item.kategori || 'Umum'} • Stok ${item.stok ?? 0}`
                                                        : `${item.kategori || 'Servis'} • ${formatCurrency(item.harga || 0)}`}
                                                </Typography>
                                            </View>
                                            <View className={`w-7 h-7 rounded-full items-center justify-center ${isSelected ? 'bg-primary' : 'bg-gray-100'}`}>
                                                {isSelected ? <CheckCircle2 size={16} color="white" /> : <Circle size={16} color="#94A3B8" />}
                                            </View>
                                        </Pressable>
                                    );
                                };

                                return hasSearchQuery ? (
                                    <View style={{ maxHeight: 420 }}>
                                        <Typography variant="body2" weight="semibold" className="mb-1">Hasil Pencarian</Typography>
                                        <Typography variant="caption" className="text-gray-400 mb-4">
                                            Hasil dibagi per kategori, tetap dalam satu section pencarian.
                                        </Typography>

                                        <View className="mb-5">
                                            <View className="flex-row items-center justify-between mb-2">
                                                <Typography variant="body2" weight="semibold">Daftar Sparepart</Typography>
                                                <Typography variant="caption" className="text-gray-400">{filteredPartChoices.length} item</Typography>
                                            </View>
                                            {filteredPartChoices.length === 0 ? (
                                                <View className="py-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 mb-3">
                                                    <Typography className="text-center text-gray-400 text-sm">Tidak ada sparepart yang cocok</Typography>
                                                </View>
                                            ) : (
                                                filteredPartChoices.map((item) => renderSelectableItem(item, true, true))
                                            )}
                                        </View>

                                        <View>
                                            <View className="flex-row items-center justify-between mb-2">
                                                <Typography variant="body2" weight="semibold">Daftar Servis</Typography>
                                                <Typography variant="caption" className="text-gray-400">{filteredServiceChoices.length} item</Typography>
                                            </View>
                                            {filteredServiceChoices.length === 0 ? (
                                                <View className="py-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                    <Typography className="text-center text-gray-400 text-sm">Tidak ada servis yang cocok</Typography>
                                                </View>
                                            ) : (
                                                filteredServiceChoices.map((item) => renderSelectableItem(item, false, true))
                                            )}
                                        </View>
                                    </View>
                                ) : (
                            <SectionList
                                sections={sections as any}
                                keyExtractor={(item: any, index: number) => `${item.id}-${index}`}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                style={{ maxHeight: 420 }}
                                renderSectionHeader={({ section }: any) => (
                                    <View className="mb-3 mt-1">
                                        <View className="flex-row items-center justify-between mb-1">
                                            <Typography variant="body2" weight="semibold">{section.title}</Typography>
                                            <Typography variant="caption" className="text-gray-400">
                                                {section.data.length} item
                                            </Typography>
                                        </View>
                                        <Typography variant="caption" className="text-gray-400">
                                            {section.subtitle}
                                        </Typography>
                                        {section.data.length === 0 && (
                                            <View className="mt-3 py-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                <Typography className="text-center text-gray-400 text-sm">
                                                    {hasSearchQuery ? 'Data tidak ditemukan' : 'Belum ada data untuk dipilih'}
                                                </Typography>
                                            </View>
                                        )}
                                    </View>
                                )}
                                renderItem={({ item, section }: any) => {
                                    const isPartSheet = item.itemType === 'part' || section.key === 'part';
                                    const isSelected = isPartSheet
                                        ? parts.some((part) => part.spare_part_id === item.id)
                                        : services.some((service) => service.service_id === item.id);

                                    return (
                                        <Pressable
                                            onPress={() => isPartSheet ? togglePartSelection(item) : toggleServiceSelection(item)}
                                            className={`mb-3 rounded-2xl border p-4 flex-row items-center ${isSelected ? 'bg-primary/5 border-primary/20' : 'bg-white border-gray-100'}`}
                                        >
                                            <View className="flex-1 pr-3">
                                                <View className="flex-row items-center flex-wrap">
                                                    <Typography weight="bold" className="text-textMain">
                                                        {item.nama || (isPartSheet ? 'Sparepart' : 'Jasa Servis')}
                                                    </Typography>
                                                    {hasSearchQuery && (
                                                        <View className={`ml-2 px-2 py-0.5 rounded-full ${isPartSheet ? 'bg-blue-50' : 'bg-primary/10'}`}>
                                                            <Typography className={`text-[9px] font-bold ${isPartSheet ? 'text-blue-600' : 'text-primary'}`}>
                                                                {isPartSheet ? 'Sparepart' : 'Servis'}
                                                            </Typography>
                                                        </View>
                                                    )}
                                                </View>
                                                <Typography variant="caption" className="text-gray-400 mt-0.5">
                                                    {isPartSheet
                                                        ? `${item.kode || item.kode_part || '-'} • ${item.kategori || 'Umum'} • Stok ${item.stok ?? 0}`
                                                        : `${item.kategori || 'Servis'} • ${formatCurrency(item.harga || 0)}`}
                                                </Typography>
                                            </View>
                                            <View className={`w-7 h-7 rounded-full items-center justify-center ${isSelected ? 'bg-primary' : 'bg-gray-100'}`}>
                                                {isSelected ? <CheckCircle2 size={16} color="white" /> : <Circle size={16} color="#94A3B8" />}
                                            </View>
                                        </Pressable>
                                    );
                                }}
                                ListFooterComponent={<View className="h-4" />}
                            />
                                );
                            })()}
                        </View>
                </BottomSheetContainer>
            </Modal>
        );
    };

    // Web version with regular ScrollView
    if (Platform.OS === 'web' || isPage) {
        return (
            <View style={isPage ? { flex: 1, backgroundColor: 'white' } : styles.webContainer}>
                {/* Header */}
                {!isPage && (
                    <View style={styles.header}>
                        <Typography variant="h3" weight="bold">{initialData ? 'Edit Antrian' : 'Buat Antrian Bengkel'}</Typography>
                        <Badge label={initialData ? initialData.nomor_transaksi : "Antre"} variant={initialData ? "info" : "neutral"} />
                    </View>
                )}

                <ScrollView
                    style={isPage ? { flex: 1 } : styles.webScrollView}
                    contentContainerStyle={isPage ? { flexGrow: 1, paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 24) } : styles.webScrollContent}
                    showsVerticalScrollIndicator={true}
                >
                    {renderFormContent()}
                </ScrollView>
                {renderSelectionSheet()}
                <BarcodeScannerModal
                    visible={isScannerOpen}
                    onClose={() => {
                        setIsScannerOpen(false);
                    }}
                    onScan={(data) => scannerMode === 'sparepart' ? handleScanSparePart(data) : handleScanPlate(data)}
                    scanLog={scanLog}
                    continuous={scannerMode === 'sparepart'}
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
    }

    // Mobile version with BottomSheetScrollView
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.mobileContainer}>
                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="h3" weight="bold">{initialData ? 'Edit Antrian' : 'Buat Antrian Bengkel'}</Typography>
                    <Badge label={initialData ? initialData.nomor_transaksi : "Antre"} variant={initialData ? "info" : "neutral"} />
                </View>

                {/* Scrollable Content for BottomSheet (using specialised scroll view for native mobile) */}
                <BottomSheetScrollView
                    style={styles.mobileScrollView}
                    contentContainerStyle={styles.mobileScrollContent}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                >
                    {renderFormContent()}
                </BottomSheetScrollView>
                {renderSelectionSheet()}
                <BarcodeScannerModal
                    visible={isScannerOpen}
                    onClose={() => {
                        setIsScannerOpen(false);
                    }}
                    onScan={(data) => scannerMode === 'sparepart' ? handleScanSparePart(data) : handleScanPlate(data)}
                    scanLog={scanLog}
                    continuous={scannerMode === 'sparepart'}
                />
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
