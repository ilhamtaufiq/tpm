import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Share, StatusBar, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Barcode as BarcodeIcon, Car, Check, CheckCircle2, ChevronLeft, Info, Package, Percent, Plus, Printer, Search, Share2, Truck, User, Wallet, Wrench, X } from 'lucide-react-native';

import { Typography } from '../../../components/ui/Typography';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { MasterDataSelector } from '../../../components/ui/MasterDataSelector';
import { BarcodeScannerModal } from '../../../components/ui/BarcodeScannerModal';
import { useCreateTransaksiBengkel, useSparePartsList, useTransaksiBengkelDetail, useUpdateTransaksiBengkel } from '../../../hooks/useBengkel';
import { useDebounce } from '../../../hooks';
import { useJasaList } from '../../../hooks/useJasaServis';
import { useActiveArmada } from '../../../hooks/useJasaAngkut';
import { useMobilList } from '../../../hooks/useMobil';
import { formatCurrency } from '../../../utils/format';
import { getCustomTabBarHeight } from '../../../components/ui/CustomTabBar';
import { printReceipt, PrintReceiptData } from '../../../utils/printReceipt';
import { printSettingsService, PrintSettings } from '../../../utils/printSettings';
import { FILE_URL } from '../../../utils/api';

type BengkelKategori = 'umum' | 'jasa_angkut' | 'jual_beli_mobil';
type PaymentMode = 'TUNAI' | 'TRANSFER' | 'SPLIT';
type NoticeType = 'error' | 'success' | 'info';

export default function BengkelTransaksiScreen() {
    const insets = useSafeAreaInsets();
    const { action, mode, transactionId } = useLocalSearchParams<{ action?: string; mode?: string; transactionId?: string }>();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [partSearch, setPartSearch] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');
    const [showPartSearch, setShowPartSearch] = useState(false);
    const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
    const [partSheetOpen, setPartSheetOpen] = useState(false);
    const [showDiscountInput, setShowDiscountInput] = useState(false);
    const [selectedParts, setSelectedParts] = useState<Record<number, { item: any; qty: number }>>({});
    const [selectedServices, setSelectedServices] = useState<Record<number, { item: any; qty: number }>>({});
    const [kategori, setKategori] = useState<BengkelKategori>('umum');
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [guestName, setGuestName] = useState('');
    const [selectedArmada, setSelectedArmada] = useState<any>(null);
    const [selectedMobil, setSelectedMobil] = useState<any>(null);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('TUNAI');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [splitTunai, setSplitTunai] = useState('');
    const [splitTransfer, setSplitTransfer] = useState('');
    const [note, setNote] = useState('');
    const [discount, setDiscount] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scanLog, setScanLog] = useState<{ id: string; title: string; subtitle?: string; timestamp: number }[]>([]);
    const [notice, setNotice] = useState<{ type: NoticeType; title: string; message: string } | null>(null);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [createdTransaction, setCreatedTransaction] = useState<any | null>(null);
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
    const [printingReceipt, setPrintingReceipt] = useState(false);
    const [sharingReceipt, setSharingReceipt] = useState(false);
    const [receiptActionMessage, setReceiptActionMessage] = useState('');
    const debouncedPartSearch = useDebounce(partSearch, 300);
    const PART_PAGE_SIZE = 40;

    const {
        data: partsData,
        isLoading: isPartsLoading,
        fetchNextPage: fetchNextPartsPage,
        hasNextPage: hasNextPartsPage,
        isFetchingNextPage: isFetchingNextPartsPage,
    } = useSparePartsList({
        limit: PART_PAGE_SIZE,
        sort_by: 'nama',
        sort_order: 'asc',
        search: debouncedPartSearch || undefined,
    });
    const { data: jasaData, isLoading: isJasaLoading } = useJasaList({ limit: 200 });
    const { data: armadaData, isLoading: isArmadaLoading } = useActiveArmada();
    const { data: mobilData } = useMobilList({ status: 'TERSEDIA', limit: 100 });
    const createMutation = useCreateTransaksiBengkel();
    const updateMutation = useUpdateTransaksiBengkel();
    const editTransactionId = transactionId ? Number(transactionId) : null;
    const { data: editingTransaction, isLoading: isEditingTransactionLoading } = useTransaksiBengkelDetail(editTransactionId);
    const hydratedTransactionIdRef = useRef<number | null>(null);
    const tabBarHeight = getCustomTabBarHeight(insets.bottom);
    const transaksiMode = mode === 'sparepart' ? 'sparepart' : mode === 'servis' ? 'servis' : 'all';
    const showParts = transaksiMode !== 'servis';
    const showServices = true;
    const showServiceCatalog = transaksiMode === 'servis';
    const itemModeLabel = transaksiMode === 'sparepart'
        ? 'Sparepart'
        : transaksiMode === 'servis'
            ? 'Servis'
            : 'Sparepart & Servis';

    const parts = useMemo(() => partsData?.pages.flatMap((page: any) => page.data || []) || [], [partsData]);
    const services = jasaData?.data || [];
    const armadaList = Array.isArray(armadaData)
        ? armadaData
        : Array.isArray(armadaData?.data)
            ? armadaData.data
            : Array.isArray(armadaData?.pages)
                ? armadaData.pages.flatMap((page: any) => page.data || [])
                : [];
    const mobilList = Array.isArray(mobilData) ? mobilData : (mobilData?.data || []);

    const selectedPartList = useMemo(() => Object.values(selectedParts), [selectedParts]);
    const selectedServiceList = useMemo(() => Object.values(selectedServices), [selectedServices]);
    const hasItems = selectedPartList.length > 0 || selectedServiceList.length > 0;
    const grossSubtotal = useMemo(() => {
        const partTotal = selectedPartList.reduce((sum, row) => sum + (Number(row.item.harga_jual || 0) * row.qty), 0);
        const serviceTotal = selectedServiceList.reduce((sum, row) => sum + (Number(row.item.harga || 0) * row.qty), 0);
        return partTotal + serviceTotal;
    }, [selectedPartList, selectedServiceList]);
    const discountAmount = Math.min(Number(discount.replace(/[^0-9]/g, '')) || 0, grossSubtotal);
    const subtotal = Math.max(0, grossSubtotal - discountAmount);
    const paymentAmountValue = Number(paymentAmount.replace(/[^0-9]/g, '')) || 0;
    const hasPaymentAmountInput = paymentAmount.trim().length > 0;
    const receivedAmount = hasPaymentAmountInput ? paymentAmountValue : subtotal;
    const changeAmount = paymentMode === 'TUNAI' || paymentMode === 'TRANSFER'
        ? Math.max(0, receivedAmount - subtotal)
        : 0;
    const paymentOutstandingAmount = paymentMode === 'TUNAI' || paymentMode === 'TRANSFER'
        ? Math.max(0, subtotal - receivedAmount)
        : 0;
    const splitTunaiAmount = Number(splitTunai.replace(/[^0-9]/g, '')) || 0;
    const splitTransferAmount = Number(splitTransfer.replace(/[^0-9]/g, '')) || 0;
    const splitTotal = splitTunaiAmount + splitTransferAmount;

    useEffect(() => {
        printSettingsService.getSettings().then(setPrintSettings);
    }, []);

    useEffect(() => {
        if (!editingTransaction || !editTransactionId || hydratedTransactionIdRef.current === editTransactionId) return;
        const existingServiceDetails = editingTransaction.detail_services || [];
        if (existingServiceDetails.length > 0 && services.length === 0) return;

        hydratedTransactionIdRef.current = editTransactionId;
        setKategori(editingTransaction.kategori || 'umum');
        setGuestName(editingTransaction.customer_nama || editingTransaction.nama_customer || '');
        setNote(editingTransaction.catatan || '');
        setDiscount(String(Number(editingTransaction.diskon || 0) || ''));
        setPaymentMode(editingTransaction.metode_bayar === 'TRANSFER' ? 'TRANSFER' : editingTransaction.metode_bayar === 'SPLIT' ? 'SPLIT' : 'TUNAI');
        setPaymentAmount(String(Number(editingTransaction.jumlah_bayar || 0) || 0));

        if (editingTransaction.customer_id) {
            setSelectedCustomer({
                id: editingTransaction.customer_id,
                nama: editingTransaction.customer_nama || editingTransaction.nama_customer,
                vehicles: [{
                    plat_nomor: editingTransaction.nomor_plat,
                    jenis_unit: editingTransaction.jenis_kendaraan,
                }],
            });
        }
        if (editingTransaction.armada_id) {
            setSelectedArmada({
                id: editingTransaction.armada_id,
                nopol: editingTransaction.nomor_plat,
                nama: (editingTransaction.nama_customer || '').replace(/^Armada\s+/i, ''),
            });
        }
        if (editingTransaction.mobil_id) {
            setSelectedMobil({
                id: editingTransaction.mobil_id,
                nomor_plat: editingTransaction.nomor_plat,
                merek: editingTransaction.jenis_kendaraan,
                model: '',
            });
        }

        const existingParts = (editingTransaction.detail_parts || []).reduce((acc: any, detail: any) => {
            const partId = detail.spare_part_id || detail.spare_part?.id;
            if (!partId) return acc;
            acc[partId] = {
                item: {
                    ...(detail.spare_part || {}),
                    id: partId,
                    nama: detail.spare_part_nama || detail.spare_part?.nama || 'Sparepart',
                    harga_jual: Number(detail.harga_jual || detail.harga_satuan || detail.spare_part?.harga_jual || 0),
                    stok: detail.spare_part?.stok ?? 999,
                },
                qty: Number(detail.qty || 1),
            };
            return acc;
        }, {});
        setSelectedParts(existingParts);

        const existingServices = existingServiceDetails.reduce((acc: any, detail: any) => {
            const matchedService = services.find((service: any) => {
                const sameName = String(service.nama || '').toLowerCase() === String(detail.nama_jasa || detail.nama || '').toLowerCase();
                const samePrice = Number(service.harga || 0) === Number(detail.harga || 0);
                return sameName && samePrice;
            });
            const serviceId = detail.jasa_id || detail.service_id || matchedService?.id || detail.id;
            if (!serviceId) return acc;
            acc[serviceId] = {
                item: {
                    ...(matchedService || {}),
                    id: serviceId,
                    nama: matchedService?.nama || detail.nama_jasa || detail.nama || 'Servis',
                    harga: Number(matchedService?.harga || detail.harga || 0),
                    kategori: matchedService?.kategori || detail.kategori,
                    deskripsi: matchedService?.deskripsi || detail.deskripsi,
                },
                qty: Number(detail.qty || 1),
            };
            return acc;
        }, {});
        setSelectedServices(existingServices);
    }, [editTransactionId, editingTransaction, services]);

    const filteredServices = useMemo(() => {
        const q = serviceSearch.trim().toLowerCase();
        if (!q) return services;
        return services.filter((service: any) =>
            (service.nama || '').toLowerCase().includes(q) ||
            (service.kategori || '').toLowerCase().includes(q) ||
            (service.deskripsi || '').toLowerCase().includes(q)
        );
    }, [services, serviceSearch]);
    const visibleParts = parts;
    const visibleServices = serviceSearch.trim() || showServiceCatalog ? filteredServices : filteredServices.slice(0, 10);

    const handlePartsScroll = (event: any) => {
        if (!hasNextPartsPage || isFetchingNextPartsPage) return;

        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const paddingToBottom = 320;
        const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);

        if (distanceFromBottom < paddingToBottom) {
            fetchNextPartsPage();
        }
    };

    const showNotice = (type: NoticeType, title: string, message: string) => {
        setNotice({ type, title, message });
    };

    const closeAfterSubmit = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/bengkel');
    };

    const togglePart = (part: any) => {
        if (part.stok !== 999 && Number(part.stok || 0) <= 0) return;
        setSelectedParts(prev => {
            const next = { ...prev };
            if (next[part.id]) delete next[part.id];
            else next[part.id] = { item: part, qty: 1 };
            return next;
        });
    };

    const setPartQty = (partId: number, qty: number) => {
        setSelectedParts(prev => prev[partId] ? { ...prev, [partId]: { ...prev[partId], qty: Math.max(1, qty) } } : prev);
    };

    const toggleService = (service: any) => {
        setSelectedServices(prev => {
            const next = { ...prev };
            if (next[service.id]) delete next[service.id];
            else next[service.id] = { item: service, qty: 1 };
            return next;
        });
    };

    const setServiceQty = (serviceId: number, qty: number) => {
        setSelectedServices(prev => prev[serviceId] ? { ...prev, [serviceId]: { ...prev[serviceId], qty: Math.max(1, qty) } } : prev);
    };

    const addScannedPart = (part: any) => {
        if (part.stok !== 999 && Number(part.stok || 0) <= 0) {
            showNotice('error', 'Stok Habis', `${part.nama} tidak bisa dipilih karena stok kosong.`);
            return;
        }
        setSelectedParts(prev => {
            const existing = prev[part.id];
            return { ...prev, [part.id]: { item: part, qty: existing ? existing.qty + 1 : 1 } };
        });
        setScanLog(prev => [{
            id: Math.random().toString(),
            title: part.nama,
            subtitle: `Kode: ${part.kode || part.kode_part || '-'} - ${part.stok === 999 ? 'Always Ready' : `Stok: ${part.stok}`}`,
            timestamp: Date.now(),
        }, ...prev]);
    };

    const handleScan = (scannedData: string) => {
        const clean = scannedData.trim();
        let part = parts.find((p: any) => p.kode === clean || p.kode_part === clean);
        if (!part) {
            const stripped = clean.replace(/^0+/, '');
            part = parts.find((p: any) =>
                (p.kode || '').replace(/^0+/, '') === stripped ||
                (p.kode_part || '').replace(/^0+/, '') === stripped
            );
        }
        if (part) addScannedPart(part);
        else {
            showNotice('error', 'Tidak Ditemukan', `Kode "${scannedData}" tidak terdaftar di data sparepart.`);
            setScanLog(prev => [{ id: Math.random().toString(), title: 'Tidak ditemukan', subtitle: `Kode: ${scannedData}`, timestamp: Date.now() }, ...prev]);
        }
    };

    const next = () => {
        if (step === 1 && !hasItems) {
            showNotice('error', 'Validasi', 'Pilih minimal satu sparepart atau jasa servis.');
            return;
        }
        if (step === 1 && editTransactionId) {
            setNotice(null);
            setStep(3);
            return;
        }
        if (step === 2) {
            if (kategori === 'umum' && !(selectedCustomer || guestName.trim() || editingTransaction?.nama_customer || editingTransaction?.customer_nama)) {
                showNotice('error', 'Validasi', 'Pilih customer atau isi nama guest.');
                return;
            }
            if (kategori === 'jasa_angkut' && !(selectedArmada || editingTransaction?.armada_id)) {
                showNotice('error', 'Validasi', 'Pilih armada jasa angkut.');
                return;
            }
            if (kategori === 'jual_beli_mobil' && !(selectedMobil || editingTransaction?.mobil_id)) {
                showNotice('error', 'Validasi', 'Pilih mobil stok.');
                return;
            }
        }
        setNotice(null);
        setStep(prev => Math.min(3, prev + 1) as 1 | 2 | 3);
    };

    const confirmSubmit = () => {
        const isJA = kategori === 'jasa_angkut';
        const isMobil = kategori === 'jual_beli_mobil';
        if (!isJA && !isMobil && paymentMode === 'SPLIT' && splitTotal !== subtotal) {
            showNotice('error', 'Validasi', 'Total split payment harus sama dengan total transaksi.');
            return;
        }
        setNotice(null);
        setConfirmSubmitOpen(true);
    };

    const buildReceiptData = (transaction: any): PrintReceiptData => ({
        type: 'bengkel',
        transactionNumber: transaction?.nomor_transaksi || transaction?.id?.toString() || '-',
        publicReceiptToken: transaction?.public_receipt_token,
        antrian: transaction?.nomor_antrian || '-',
        date: new Date(transaction?.created_at || new Date()),
        customerName: transaction?.customer_nama || transaction?.nama_customer || selectedCustomer?.nama || guestName.trim() || '-',
        cashierName: transaction?.kasir_nama || '-',
        mechanicName: transaction?.mekanik_nama || '-',
        status: transaction?.status_bayar || 'LUNAS',
        vehiclePlate: transaction?.nomor_plat || '-',
        vehicleType: transaction?.jenis_kendaraan || '-',
        services: selectedServiceList.map(row => ({
            description: row.item.nama,
            quantity: row.qty,
            unitPrice: Number(row.item.harga || 0),
            subtotal: Number(row.item.harga || 0) * row.qty,
        })),
        parts: selectedPartList.map(row => ({
            description: row.item.nama || 'Sparepart',
            quantity: row.qty,
            unitPrice: Number(row.item.harga_jual || 0),
            subtotal: Number(row.item.harga_jual || 0) * row.qty,
        })),
        subtotal: grossSubtotal,
        discount: discountAmount,
        total: subtotal,
        paid: paymentMode === 'SPLIT' ? splitTotal : receivedAmount,
        paymentMethod: kategori === 'jasa_angkut' ? 'INTERNAL' : kategori === 'jual_beli_mobil' ? 'KREDIT' : paymentMode,
        notes: note,
    });

    const handlePrintCreatedReceipt = async () => {
        if (!createdTransaction) return;
        if (!printSettings) {
            setReceiptActionMessage('Pengaturan cetak belum dimuat.');
            return;
        }

        try {
            setPrintingReceipt(true);
            setReceiptActionMessage('');
            await printReceipt(buildReceiptData(createdTransaction), printSettings);
            setReceiptActionMessage('Struk berhasil dicetak.');
        } catch {
            setReceiptActionMessage('Gagal mencetak struk.');
        } finally {
            setPrintingReceipt(false);
        }
    };

    const handleShareCreatedReceipt = async () => {
        const receiptToken = createdTransaction?.public_receipt_token;
        if (!receiptToken) {
            setReceiptActionMessage('Token struk belum tersedia. Muat ulang transaksi lalu coba lagi.');
            return;
        }

        const shareUrl = `${FILE_URL}/api/v1/public/receipt/view/bengkel/${receiptToken}`;
        const shareMessage = `Halo, ini adalah struk transaksi Anda di Tiga Putra Motor: ${shareUrl}`;

        try {
            setSharingReceipt(true);
            setReceiptActionMessage('');
            if (Platform.OS === 'web' && !navigator.share) {
                await navigator.clipboard.writeText(shareMessage);
                setReceiptActionMessage('Link struk telah disalin.');
                return;
            }

            await Share.share({
                message: shareMessage,
                url: shareUrl,
                title: 'Bagikan Struk Digital',
            });
            setReceiptActionMessage('Struk berhasil dibagikan.');
        } catch {
            setReceiptActionMessage('Gagal membagikan struk.');
        } finally {
            setSharingReceipt(false);
        }
    };

    const submit = async () => {
        const isJA = kategori === 'jasa_angkut';
        const isMobil = kategori === 'jual_beli_mobil';
        const customerName = isJA
            ? `Armada ${selectedArmada?.nama || selectedArmada?.nopol || ''}`.trim()
            : isMobil
                ? 'TPM (Internal)'
                : (selectedCustomer?.nama || guestName.trim() || editingTransaction?.nama_customer || editingTransaction?.customer_nama || 'Guest');
        const nomorPlat = isJA
            ? (selectedArmada?.nopol || editingTransaction?.nomor_plat || '-')
            : isMobil
                ? (selectedMobil?.nomor_plat || editingTransaction?.nomor_plat || '-')
                : (selectedCustomer?.vehicles?.[0]?.plat_nomor || editingTransaction?.nomor_plat || '-');
        const jenisKendaraan = isJA
            ? 'Armada Jasa Angkut'
            : isMobil
                ? `${selectedMobil?.merek || ''} ${selectedMobil?.model || ''}`.trim() || editingTransaction?.jenis_kendaraan || 'Mobil'
                : (selectedCustomer?.vehicles?.[0]?.jenis_unit || editingTransaction?.jenis_kendaraan || 'Umum');

        try {
            const payload = {
                customer_id: kategori === 'umum' ? selectedCustomer?.id || null : null,
                nama_customer: customerName,
                nomor_plat: String(nomorPlat).substring(0, 15),
                jenis_kendaraan: String(jenisKendaraan).substring(0, 50),
                kategori,
                armada_id: isJA ? selectedArmada?.id : null,
                mobil_id: isMobil ? selectedMobil?.id : null,
                detail_parts: selectedPartList.map(row => ({ spare_part_id: row.item.id, qty: row.qty, harga_jual: Number(row.item.harga_jual || 0) })),
                detail_services: selectedServiceList.map(row => ({ nama_jasa: row.item.nama, harga: Number(row.item.harga || 0), qty: row.qty })),
                diskon: discountAmount,
                metode_bayar: isJA ? 'INTERNAL' : isMobil ? 'KREDIT' : paymentMode,
                jumlah_bayar: isJA ? subtotal : (isMobil ? 0 : paymentMode === 'SPLIT' ? splitTotal : receivedAmount),
                payments: isJA
                    ? [{ metode: 'INTERNAL', jumlah: subtotal }]
                    : isMobil
                        ? []
                        : paymentMode === 'SPLIT'
                            ? [
                                ...(splitTunaiAmount > 0 ? [{ metode: 'TUNAI', jumlah: splitTunaiAmount, kas_jenis: 'KAS_UNIT_BENGKEL' }] : []),
                                ...(splitTransferAmount > 0 ? [{ metode: 'TRANSFER', jumlah: splitTransferAmount }] : []),
                            ]
                            : receivedAmount > 0
                                ? [{ metode: paymentMode, jumlah: receivedAmount, kas_jenis: paymentMode === 'TUNAI' ? 'KAS_UNIT_BENGKEL' : undefined }]
                                : [],
                catatan: note,
            };
            const transaction = editTransactionId
                ? await updateMutation.mutateAsync({ id: editTransactionId, data: payload })
                : await createMutation.mutateAsync(payload);
            setCreatedTransaction(transaction);
            setReceiptActionMessage('');
            setConfirmSubmitOpen(false);
            setSuccessModalOpen(true);
        } catch {
            setConfirmSubmitOpen(false);
            showNotice('error', 'Error', editTransactionId ? 'Gagal memperbarui transaksi bengkel.' : 'Gagal membuat transaksi bengkel.');
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                    <Pressable onPress={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3">
                        <ChevronLeft size={20} color="#475569" />
                    </Pressable>
                    <View>
                        <Typography variant="h3" weight="bold">Transaksi Bengkel</Typography>
                        <Typography className="text-gray-400 text-xs mt-0.5">{itemModeLabel}</Typography>
                    </View>
                </View>
            </View>

            {step === 1 && (
                <View className="px-5 py-3 bg-white border-b border-gray-100">
                    <View className="flex-row items-center justify-between">
                        <ActionIcon
                            active={showPartSearch}
                            icon={<Search size={20} color={showPartSearch ? 'white' : '#023C69'} />}
                            label="Search"
                            onPress={() => {
                                setShowPartSearch(prev => !prev);
                                if (showPartSearch) setPartSearch('');
                            }}
                        />
                        <ActionIcon
                            active={transaksiMode === 'servis' ? selectedPartList.length > 0 : selectedServiceList.length > 0}
                            icon={<Plus size={21} color={(transaksiMode === 'servis' ? selectedPartList.length > 0 : selectedServiceList.length > 0) ? 'white' : '#023C69'} />}
                            label={transaksiMode === 'servis' ? 'Sparepart' : 'Servis'}
                            onPress={() => transaksiMode === 'servis' ? setPartSheetOpen(true) : setServiceSheetOpen(true)}
                        />
                        <ActionIcon
                            icon={<BarcodeIcon size={20} color="#023C69" />}
                            label="Scan"
                            onPress={() => { setScanLog([]); setScannerOpen(true); }}
                        />
                        <ActionIcon
                            active={showDiscountInput || discountAmount > 0}
                            icon={<Percent size={20} color={showDiscountInput || discountAmount > 0 ? 'white' : '#023C69'} />}
                            label="Diskon"
                            onPress={() => setShowDiscountInput(prev => !prev)}
                        />
                    </View>
                    {showPartSearch && (
                        <View className="mt-3">
                            <SearchBox
                                value={transaksiMode === 'servis' ? serviceSearch : partSearch}
                                onChange={transaksiMode === 'servis' ? setServiceSearch : setPartSearch}
                                placeholder={transaksiMode === 'servis' ? 'Cari servis...' : 'Cari sparepart...'}
                            />
                        </View>
                    )}
                    {showDiscountInput && (
                        <View className="mt-3">
                            <TextInput
                                placeholder="Diskon transaksi"
                                placeholderTextColor="#94A3B8"
                                value={discount}
                                onChangeText={(value) => setDiscount(value.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                                inputMode="numeric"
                                className="bg-gray-100 rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-200"
                            />
                        </View>
                    )}
                </View>
            )}

            {notice && <NoticeBanner type={notice.type} title={notice.title} message={notice.message} onClose={() => setNotice(null)} />}

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight + 140 }}
                onScroll={handlePartsScroll}
                scrollEventThrottle={16}
            >
                {step === 1 && (
                    <View className="space-y-6">
                        {showParts && (
                        <View className="w-full">
                            {isPartsLoading ? <ActivityIndicator color="#023C69" /> : visibleParts.map((part: any) => {
                                const selected = selectedParts[part.id];
                                const outOfStock = !selected && part.stok !== 999 && Number(part.stok || 0) <= 0;
                                return (
                                    <Pressable key={part.id} disabled={outOfStock} onPress={() => togglePart(part)} className={`mb-3 p-3 rounded-2xl border ${outOfStock ? 'bg-gray-50 border-gray-100 opacity-60' : selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                                        <View className="flex-row items-start">
                                            <View className={`w-7 h-7 rounded-lg border items-center justify-center mr-3 ${selected ? 'bg-blue-600 border-blue-600' : outOfStock ? 'bg-gray-100 border-gray-200' : 'border-gray-300'}`}>
                                                {selected && <Check size={16} color="white" />}
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center">
                                                    <Package size={18} color={selected ? '#2563EB' : outOfStock ? '#CBD5E1' : '#94A3B8'} />
                                                    <Typography weight="bold" className={`text-sm ml-2 flex-1 ${outOfStock ? 'text-gray-400' : 'text-textMain'}`} numberOfLines={1}>{part.nama}</Typography>
                                                </View>
                                                <Typography className="text-gray-400 text-[11px] mt-1">{part.kode || '-'} - Stok {part.stok === 999 ? 'Always Ready' : Number(part.stok || 0)}</Typography>
                                                {outOfStock && <Typography className="text-rose-500 text-[10px] font-bold mt-1">STOK HABIS</Typography>}
                                                <Typography className="text-primary text-xs font-bold mt-1">{formatCurrency(part.harga_jual || 0)}</Typography>
                                            </View>
                                        </View>
                                        {selected && (
                                            <QtyControl
                                                value={selected.qty}
                                                color="blue"
                                                onMinus={() => setPartQty(part.id, selected.qty - 1)}
                                                onPlus={() => setPartQty(part.id, selected.qty + 1)}
                                                onChangeQty={(qty) => setPartQty(part.id, qty)}
                                            />
                                        )}
                                    </Pressable>
                                );
                            })}
                            {isFetchingNextPartsPage && (
                                <View className="py-4">
                                    <ActivityIndicator color="#023C69" />
                                </View>
                            )}
                        </View>
                        )}

                        {showServiceCatalog && (
                        <View className="w-full">
                            {isJasaLoading ? <ActivityIndicator color="#023C69" /> : visibleServices.map((service: any) => {
                                const selected = selectedServices[service.id];
                                return (
                                    <Pressable key={`service-${service.id}`} onPress={() => toggleService(service)} className={`mb-3 p-3 rounded-2xl border ${selected ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
                                        <View className="flex-row items-start">
                                            <View className={`w-7 h-7 rounded-lg border items-center justify-center mr-3 ${selected ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`}>
                                                {selected && <Check size={16} color="white" />}
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center">
                                                    <Wrench size={18} color={selected ? '#059669' : '#94A3B8'} />
                                                    <Typography weight="bold" className="text-sm text-textMain ml-2 flex-1" numberOfLines={1}>{service.nama}</Typography>
                                                </View>
                                                <Typography className="text-gray-400 text-[11px] mt-1">{service.kategori || 'Servis'}</Typography>
                                                <Typography className="text-emerald-700 text-xs font-bold mt-1">{formatCurrency(service.harga || 0)}</Typography>
                                            </View>
                                        </View>
                                        {selected && (
                                            <QtyControl
                                                value={selected.qty}
                                                color="emerald"
                                                onMinus={() => setServiceQty(service.id, selected.qty - 1)}
                                                onPlus={() => setServiceQty(service.id, selected.qty + 1)}
                                                onChangeQty={(qty) => setServiceQty(service.id, qty)}
                                            />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                        )}

                        {!showParts && selectedPartList.length > 0 && (
                        <View>
                            <View className="flex-row items-center justify-between mb-3">
                                <Typography variant="body1" weight="bold" className="text-textMain">Sparepart Terpilih</Typography>
                                <Pressable onPress={() => setPartSheetOpen(true)} className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-100">
                                    <Typography className="text-blue-700 text-xs font-bold">Tambah</Typography>
                                </Pressable>
                            </View>
                            {selectedPartList.map(row => (
                                <View key={`selected-part-${row.item.id}`} className="mb-3 p-3 rounded-2xl border bg-blue-50 border-blue-100">
                                    <View className="flex-row items-start">
                                        <Package size={18} color="#2563EB" />
                                        <View className="flex-1 ml-2">
                                            <Typography weight="bold" className="text-sm text-textMain" numberOfLines={1}>{row.item.nama}</Typography>
                                            <Typography className="text-gray-500 text-[11px] mt-1">{row.item.kode || '-'}</Typography>
                                            <Typography className="text-primary text-xs font-bold mt-1">{formatCurrency(row.item.harga_jual || 0)}</Typography>
                                        </View>
                                        <Pressable onPress={() => togglePart(row.item)} className="w-8 h-8 rounded-full bg-white items-center justify-center">
                                            <X size={15} color="#64748B" />
                                        </Pressable>
                                    </View>
                                    <QtyControl
                                        value={row.qty}
                                        color="blue"
                                        onMinus={() => setPartQty(row.item.id, row.qty - 1)}
                                        onPlus={() => setPartQty(row.item.id, row.qty + 1)}
                                        onChangeQty={(qty) => setPartQty(row.item.id, qty)}
                                    />
                                </View>
                            ))}
                        </View>
                        )}

                        {!showServiceCatalog && selectedServiceList.length > 0 && (
                        <View>
                            <View className="flex-row items-center justify-between mb-3">
                                <Typography variant="body1" weight="bold" className="text-textMain">Servis Terpilih</Typography>
                                <Pressable onPress={() => setServiceSheetOpen(true)} className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                    <Typography className="text-emerald-700 text-xs font-bold">Tambah</Typography>
                                </Pressable>
                            </View>
                            {selectedServiceList.map(row => (
                                <View key={`selected-service-${row.item.id}`} className="mb-3 p-3 rounded-2xl border bg-emerald-50 border-emerald-100">
                                    <View className="flex-row items-start">
                                        <Wrench size={18} color="#059669" />
                                        <View className="flex-1 ml-2">
                                            <Typography weight="bold" className="text-sm text-textMain" numberOfLines={1}>{row.item.nama}</Typography>
                                            <Typography className="text-gray-500 text-[11px] mt-1">{row.item.kategori || 'Servis'}</Typography>
                                            <Typography className="text-emerald-700 text-xs font-bold mt-1">{formatCurrency(row.item.harga || 0)}</Typography>
                                        </View>
                                        <Pressable onPress={() => toggleService(row.item)} className="w-8 h-8 rounded-full bg-white items-center justify-center">
                                            <X size={15} color="#64748B" />
                                        </Pressable>
                                    </View>
                                    <QtyControl
                                        value={row.qty}
                                        color="emerald"
                                        onMinus={() => setServiceQty(row.item.id, row.qty - 1)}
                                        onPlus={() => setServiceQty(row.item.id, row.qty + 1)}
                                        onChangeQty={(qty) => setServiceQty(row.item.id, qty)}
                                    />
                                </View>
                            ))}
                        </View>
                        )}
                    </View>
                )}

                {step === 2 && (
                    <View>
                        <View className="flex-row items-start justify-between mb-6">
                            {[
                                { id: 'umum', label: 'Umum', icon: User },
                                { id: 'jasa_angkut', label: 'Jasa Angkut', icon: Wrench },
                                { id: 'jual_beli_mobil', label: 'Jual Beli Mobil', icon: Car },
                            ].map(cat => {
                                const Icon = cat.icon;
                                const active = kategori === cat.id;
                                return (
                                    <Pressable key={cat.id} onPress={() => { setKategori(cat.id as BengkelKategori); setSelectedCustomer(null); setGuestName(''); setSelectedArmada(null); setSelectedMobil(null); }} className="items-center flex-1">
                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${active ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-100'}`}>
                                            <Icon size={20} color={active ? 'white' : '#64748B'} />
                                        </View>
                                        <Typography className={`text-[10px] font-bold mt-1 text-center ${active ? 'text-primary' : 'text-gray-500'}`}>{cat.label}</Typography>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {kategori === 'umum' && (
                            <MasterDataSelector
                                type="customer"
                                value={selectedCustomer}
                                onSelect={(customer) => {
                                    setSelectedCustomer(customer);
                                    if (customer) setGuestName('');
                                }}
                                allowGuest
                                placeholder=""
                                onGuestNameChange={(name) => { setGuestName(name); setSelectedCustomer(null); }}
                                inlineMode
                                inlineLimit={5}
                                hideTrigger
                            />
                        )}
                        {kategori === 'jasa_angkut' && (
                            <View>
                                <Typography className="text-gray-500 text-xs font-bold uppercase mb-3">Armada Aktif</Typography>
                                {isArmadaLoading ? (
                                    <ActivityIndicator color="#023C69" />
                                ) : armadaList.map((armada: any) => {
                                    const active = selectedArmada?.id === armada.id;
                                    return (
                                        <Pressable key={armada.id} onPress={() => setSelectedArmada(armada)} className={`p-4 rounded-2xl border mb-3 flex-row items-center ${active ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
                                            <Truck size={22} color={active ? '#10B981' : '#94A3B8'} />
                                            <View className="flex-1 ml-3">
                                                <Typography weight="bold" className="text-textMain">{armada.nama || '-'}</Typography>
                                                <Typography className="text-gray-400 text-xs">{armada.nopol || '-'} {armada.jenis ? `• ${armada.jenis}` : ''}</Typography>
                                            </View>
                                            {active && <CheckCircle2 size={20} color="#10B981" />}
                                        </Pressable>
                                    );
                                })}
                                {!isArmadaLoading && armadaList.length === 0 && (
                                    <Typography className="text-gray-400 text-xs">Tidak ada armada aktif.</Typography>
                                )}
                            </View>
                        )}
                        {kategori === 'jual_beli_mobil' && mobilList.map((mobil: any) => {
                            const active = selectedMobil?.id === mobil.id;
                            return (
                                <Pressable key={mobil.id} onPress={() => setSelectedMobil(mobil)} className={`p-4 rounded-2xl border mb-3 flex-row items-center ${active ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
                                    <Car size={22} color={active ? '#D97706' : '#94A3B8'} />
                                    <View className="flex-1 ml-3">
                                        <Typography weight="bold" className="text-textMain">{mobil.nomor_plat || '-'}</Typography>
                                        <Typography className="text-gray-400 text-xs">{mobil.merek} {mobil.model} {mobil.tahun || ''}</Typography>
                                    </View>
                                    {active && <CheckCircle2 size={20} color="#D97706" />}
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {step === 3 && (
                    <View>
                        <Typography variant="body1" weight="bold" className="text-textMain mb-4">Pembayaran</Typography>
                        <View className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-5">
                            <SummaryRow label="Sparepart" value={`${selectedPartList.length} item`} />
                            {selectedPartList.map(row => (
                                <SummaryRow
                                    key={`payment-part-${row.item.id}`}
                                    label={`${row.item.nama} x${row.qty}`}
                                    value={formatCurrency(Number(row.item.harga_jual || 0) * row.qty)}
                                    muted
                                />
                            ))}
                            <SummaryRow label="Service" value={`${selectedServiceList.length} item`} />
                            {selectedServiceList.map(row => (
                                <SummaryRow
                                    key={`payment-service-${row.item.id}`}
                                    label={`${row.item.nama} x${row.qty}`}
                                    value={formatCurrency(Number(row.item.harga || 0) * row.qty)}
                                    muted
                                />
                            ))}
                            {discountAmount > 0 && <SummaryRow label="Diskon" value={`-${formatCurrency(discountAmount)}`} />}
                            <View className="h-[1px] bg-slate-200 my-3" />
                            <View className="flex-row justify-between items-center">
                                <Typography weight="bold" className="text-textMain">Total</Typography>
                                <Typography variant="h3" weight="bold" className="text-primary">{formatCurrency(subtotal)}</Typography>
                            </View>
                        </View>

                        {kategori === 'umum' ? (
                            <View className="mb-5">
                                <Typography variant="caption" weight="bold" className="text-gray-500 mb-2 uppercase">Metode Pembayaran</Typography>
                                <View className="flex-row space-x-2">
                                    {[
                                        { id: 'TUNAI', label: 'Tunai' },
                                        { id: 'TRANSFER', label: 'Transfer' },
                                        { id: 'SPLIT', label: 'Split' },
                                    ].map(mode => (
                                        <Pressable key={mode.id} onPress={() => setPaymentMode(mode.id as PaymentMode)} className={`flex-1 py-4 rounded-2xl border items-center ${paymentMode === mode.id ? 'bg-primary border-primary' : 'bg-white border-gray-100'}`}>
                                            <Typography weight="bold" className={paymentMode === mode.id ? 'text-white' : 'text-gray-500'}>{mode.label}</Typography>
                                        </Pressable>
                                    ))}
                                </View>
                                {paymentMode === 'SPLIT' && (
                                    <View className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                        <View className="flex-row space-x-3">
                                            <View className="flex-1">
                                                <Typography className="text-gray-500 text-[10px] font-bold uppercase mb-1">Tunai</Typography>
                                                <TextInput
                                                    value={splitTunai}
                                                    onChangeText={(value) => setSplitTunai(value.replace(/[^0-9]/g, ''))}
                                                    placeholder="0"
                                                    placeholderTextColor="#94A3B8"
                                                    keyboardType="number-pad"
                                                    inputMode="numeric"
                                                    className="bg-white rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-100"
                                                />
                                            </View>
                                            <View className="flex-1">
                                                <Typography className="text-gray-500 text-[10px] font-bold uppercase mb-1">Transfer</Typography>
                                                <TextInput
                                                    value={splitTransfer}
                                                    onChangeText={(value) => setSplitTransfer(value.replace(/[^0-9]/g, ''))}
                                                    placeholder="0"
                                                    placeholderTextColor="#94A3B8"
                                                    keyboardType="number-pad"
                                                    inputMode="numeric"
                                                    className="bg-white rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-100"
                                                />
                                            </View>
                                        </View>
                                        <View className="flex-row justify-between mt-3 pt-3 border-t border-slate-200">
                                            <Typography className="text-gray-500 text-xs font-bold">Total Split</Typography>
                                            <Typography weight="bold" className={splitTotal === subtotal ? 'text-emerald-600' : 'text-rose-500'}>
                                                {formatCurrency(splitTotal)}
                                            </Typography>
                                        </View>
                                    </View>
                                )}
                                {(paymentMode === 'TUNAI' || paymentMode === 'TRANSFER') && (
                                    <View className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                        <Typography className="text-gray-500 text-[10px] font-bold uppercase mb-1">Nominal Bayar</Typography>
                                        <TextInput
                                            value={paymentAmount}
                                            onChangeText={(value) => setPaymentAmount(value.replace(/[^0-9]/g, ''))}
                                            placeholder={String(subtotal)}
                                            placeholderTextColor="#94A3B8"
                                            keyboardType="number-pad"
                                            inputMode="numeric"
                                            className="bg-white rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-100"
                                        />
                                        <View className="flex-row justify-between mt-3 pt-3 border-t border-slate-200">
                                            <Typography className="text-gray-500 text-xs font-bold">Diterima</Typography>
                                            <Typography weight="bold" className={receivedAmount >= subtotal ? 'text-emerald-600' : 'text-rose-500'}>
                                                {formatCurrency(receivedAmount)}
                                            </Typography>
                                        </View>
                                        {paymentOutstandingAmount > 0 ? (
                                            <View className="flex-row justify-between mt-1">
                                                <Typography className="text-gray-500 text-xs font-bold">Sisa Piutang</Typography>
                                                <Typography weight="bold" className="text-rose-500">
                                                    {formatCurrency(paymentOutstandingAmount)}
                                                </Typography>
                                            </View>
                                        ) : (
                                            <View className="flex-row justify-between mt-1">
                                                <Typography className="text-gray-500 text-xs font-bold">Kembalian</Typography>
                                                <Typography weight="bold" className="text-primary">
                                                    {formatCurrency(changeAmount)}
                                                </Typography>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-5">
                                <Typography weight="bold" className="text-amber-800">{kategori === 'jasa_angkut' ? 'Internal Jasa Angkut' : 'Internal Jual Beli Mobil'}</Typography>
                                <Typography className="text-amber-700 text-xs mt-1">{kategori === 'jasa_angkut' ? 'Transaksi dicatat sebagai biaya internal armada.' : 'Transaksi dicatat sebagai piutang internal dan menambah HPP mobil.'}</Typography>
                            </View>
                        )}

                        <Input label="Catatan" placeholder="Catatan transaksi..." value={note} onChangeText={setNote} multiline />
                    </View>
                )}
            </ScrollView>

            <View className="absolute left-0 right-0 bg-white border-t border-gray-100 px-5 py-4" style={{ bottom: tabBarHeight }}>
                <View className="flex-row items-center justify-between mb-3">
                    <Typography className="text-gray-400 text-xs font-bold uppercase">Total Transaksi</Typography>
                    <Typography weight="bold" className="text-primary text-lg">{formatCurrency(subtotal)}</Typography>
                </View>
                <View className="flex-row space-x-3">
                    {step > 1 && <Button title="Kembali" variant="outline" className="flex-1" onPress={() => setStep(prev => Math.max(1, prev - 1) as 1 | 2 | 3)} />}
                    <Button
                        title={step === 3 ? (editTransactionId ? 'Update Transaksi' : 'Simpan Transaksi') : 'Lanjut'}
                        className="flex-1"
                        onPress={step === 3 ? confirmSubmit : next}
                        loading={createMutation.isPending || updateMutation.isPending}
                        icon={step === 3 ? <Wallet size={16} color="white" /> : undefined}
                    />
                </View>
            </View>

            <BarcodeScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} scanLog={scanLog} continuous />
            <Modal visible={confirmSubmitOpen} transparent animationType="fade" onRequestClose={() => setConfirmSubmitOpen(false)}>
                <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
                    <View className="bg-white rounded-[28px] p-5 w-full max-w-sm">
                        <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center mb-4">
                            <Wallet size={22} color="#023C69" />
                        </View>
                        <Typography variant="h3" weight="bold" className="text-textMain">{editTransactionId ? 'Update Transaksi?' : 'Simpan Transaksi?'}</Typography>
                        <Typography className="text-gray-500 text-sm mt-2">
                            Pastikan detail sparepart, servis, customer, dan pembayaran sudah benar.
                        </Typography>
                        <View className="bg-slate-50 rounded-2xl p-4 mt-4 border border-slate-100">
                            <SummaryRow label="Sparepart" value={`${selectedPartList.length} item`} />
                            <SummaryRow label="Servis" value={`${selectedServiceList.length} item`} />
                            <SummaryRow label="Metode" value={kategori === 'jasa_angkut' ? 'INTERNAL' : kategori === 'jual_beli_mobil' ? 'KREDIT' : paymentMode} />
                            <View className="h-[1px] bg-slate-200 my-2" />
                            <SummaryRow label="Total" value={formatCurrency(subtotal)} />
                            {kategori === 'umum' && (paymentMode === 'TUNAI' || paymentMode === 'TRANSFER') && (
                                <>
                                    <SummaryRow label="Diterima" value={formatCurrency(receivedAmount)} />
                                    {paymentOutstandingAmount > 0 ? (
                                        <SummaryRow label="Sisa Piutang" value={formatCurrency(paymentOutstandingAmount)} />
                                    ) : (
                                        <SummaryRow label="Kembalian" value={formatCurrency(changeAmount)} />
                                    )}
                                </>
                            )}
                        </View>
                        <View className="flex-row space-x-3 mt-5">
                            <Button title="Batal" variant="outline" className="flex-1" onPress={() => setConfirmSubmitOpen(false)} />
                            <Button title={editTransactionId ? 'Update' : 'Simpan'} className="flex-1" onPress={submit} loading={createMutation.isPending || updateMutation.isPending} />
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={successModalOpen} transparent animationType="fade" onRequestClose={() => { setSuccessModalOpen(false); closeAfterSubmit(); }}>
                <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
                    <View className="bg-white rounded-[28px] p-6 w-full max-w-sm items-center">
                        <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center border border-emerald-100 mb-4">
                            <CheckCircle2 size={34} color="#10B981" />
                        </View>
                        <Typography variant="h3" weight="bold" className="text-textMain text-center">Transaksi Berhasil</Typography>
                        <Typography className="text-gray-500 text-sm mt-2 text-center">
                            Transaksi bengkel berhasil disimpan.
                        </Typography>
                        {receiptActionMessage ? (
                            <View className="w-full mt-4 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                                <Typography className="text-gray-600 text-xs text-center font-semibold">
                                    {receiptActionMessage}
                                </Typography>
                            </View>
                        ) : null}
                        <View className="w-full mt-6 gap-3">
                            <Button
                                title="Cetak Struk"
                                className="w-full"
                                onPress={handlePrintCreatedReceipt}
                                loading={printingReceipt}
                                icon={<Printer size={17} color="white" />}
                            />
                            <Button
                                title="Bagikan Struk"
                                variant="secondary"
                                className="w-full bg-[#00ADEF]"
                                onPress={handleShareCreatedReceipt}
                                loading={sharingReceipt}
                                icon={<Share2 size={17} color="white" />}
                            />
                        </View>
                        <Button
                            title="OK"
                            variant="outline"
                            className="w-full mt-3"
                            onPress={() => {
                                setSuccessModalOpen(false);
                                closeAfterSubmit();
                            }}
                        />
                    </View>
                </View>
            </Modal>

            <Modal visible={partSheetOpen} transparent animationType="slide" onRequestClose={() => setPartSheetOpen(false)}>
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(15, 23, 42, 0.38)' }}>
                    <Pressable className="absolute inset-0" onPress={() => setPartSheetOpen(false)} />
                    <View className="bg-white rounded-t-[32px] px-5 pt-4" style={{ maxHeight: '78%', paddingBottom: insets.bottom + 20 }}>
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-5" />
                        <View className="flex-row items-center justify-between mb-4">
                            <View>
                                <Typography variant="h3" weight="bold">Tambah Sparepart</Typography>
                                <Typography className="text-gray-400 text-xs mt-0.5">{selectedPartList.length} sparepart dipilih</Typography>
                            </View>
                            <Pressable onPress={() => setPartSheetOpen(false)} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                                <X size={18} color="#475569" />
                            </Pressable>
                        </View>
                        <SearchBox value={partSearch} onChange={setPartSearch} placeholder="Cari sparepart..." />
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 16 }}
                            onScroll={handlePartsScroll}
                            scrollEventThrottle={16}
                        >
                            {isPartsLoading ? <ActivityIndicator color="#023C69" /> : visibleParts.map((part: any) => {
                                const selected = selectedParts[part.id];
                                const outOfStock = !selected && part.stok !== 999 && Number(part.stok || 0) <= 0;
                                return (
                                    <Pressable key={`sheet-part-${part.id}`} disabled={outOfStock} onPress={() => togglePart(part)} className={`mb-3 p-3 rounded-2xl border ${outOfStock ? 'bg-gray-50 border-gray-100 opacity-60' : selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                                        <View className="flex-row items-start">
                                            <View className={`w-7 h-7 rounded-lg border items-center justify-center mr-3 ${selected ? 'bg-blue-600 border-blue-600' : outOfStock ? 'bg-gray-100 border-gray-200' : 'border-gray-300'}`}>
                                                {selected && <Check size={16} color="white" />}
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center">
                                                    <Package size={18} color={selected ? '#2563EB' : outOfStock ? '#CBD5E1' : '#94A3B8'} />
                                                    <Typography weight="bold" className={`text-sm ml-2 flex-1 ${outOfStock ? 'text-gray-400' : 'text-textMain'}`} numberOfLines={1}>{part.nama}</Typography>
                                                </View>
                                                <Typography className="text-gray-400 text-[11px] mt-1">{part.kode || '-'} - Stok {part.stok === 999 ? 'Always Ready' : Number(part.stok || 0)}</Typography>
                                                {outOfStock && <Typography className="text-rose-500 text-[10px] font-bold mt-1">STOK HABIS</Typography>}
                                                <Typography className="text-primary text-xs font-bold mt-1">{formatCurrency(part.harga_jual || 0)}</Typography>
                                            </View>
                                        </View>
                                        {selected && (
                                            <QtyControl
                                                value={selected.qty}
                                                color="blue"
                                                onMinus={() => setPartQty(part.id, selected.qty - 1)}
                                                onPlus={() => setPartQty(part.id, selected.qty + 1)}
                                                onChangeQty={(qty) => setPartQty(part.id, qty)}
                                            />
                                        )}
                                    </Pressable>
                                );
                            })}
                            {isFetchingNextPartsPage && (
                                <View className="py-4">
                                    <ActivityIndicator color="#023C69" />
                                </View>
                            )}
                        </ScrollView>
                        <Button title="Selesai" onPress={() => setPartSheetOpen(false)} className="mt-1" />
                    </View>
                </View>
            </Modal>
            <Modal visible={serviceSheetOpen} transparent animationType="slide" onRequestClose={() => setServiceSheetOpen(false)}>
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(15, 23, 42, 0.38)' }}>
                    <Pressable className="absolute inset-0" onPress={() => setServiceSheetOpen(false)} />
                    <View className="bg-white rounded-t-[32px] px-5 pt-4" style={{ maxHeight: '78%', paddingBottom: insets.bottom + 20 }}>
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-5" />
                        <View className="flex-row items-center justify-between mb-4">
                            <View>
                                <Typography variant="h3" weight="bold">Tambah Servis</Typography>
                                <Typography className="text-gray-400 text-xs mt-0.5">{selectedServiceList.length} servis dipilih</Typography>
                            </View>
                            <Pressable onPress={() => setServiceSheetOpen(false)} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                                <X size={18} color="#475569" />
                            </Pressable>
                        </View>
                        <SearchBox value={serviceSearch} onChange={setServiceSearch} placeholder="Cari service..." />
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                            {isJasaLoading ? <ActivityIndicator color="#023C69" /> : visibleServices.map((service: any) => {
                                const selected = selectedServices[service.id];
                                return (
                                    <Pressable key={`sheet-service-${service.id}`} onPress={() => toggleService(service)} className={`mb-3 p-3 rounded-2xl border ${selected ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
                                        <View className="flex-row items-start">
                                            <View className={`w-7 h-7 rounded-lg border items-center justify-center mr-3 ${selected ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`}>
                                                {selected && <Check size={16} color="white" />}
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center">
                                                    <Wrench size={18} color={selected ? '#059669' : '#94A3B8'} />
                                                    <Typography weight="bold" className="text-sm text-textMain ml-2 flex-1" numberOfLines={1}>{service.nama}</Typography>
                                                </View>
                                                <Typography className="text-gray-400 text-[11px] mt-1">{service.kategori || 'Servis'}</Typography>
                                                <Typography className="text-emerald-700 text-xs font-bold mt-1">{formatCurrency(service.harga || 0)}</Typography>
                                            </View>
                                        </View>
                                        {selected && (
                                            <QtyControl
                                                value={selected.qty}
                                                color="emerald"
                                                onMinus={() => setServiceQty(service.id, selected.qty - 1)}
                                                onPlus={() => setServiceQty(service.id, selected.qty + 1)}
                                                onChangeQty={(qty) => setServiceQty(service.id, qty)}
                                            />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        <Button title="Selesai" onPress={() => setServiceSheetOpen(false)} className="mt-1" />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
    return (
        <View className="flex-row items-center bg-gray-100 rounded-2xl px-3 h-11 mb-3 border border-gray-200">
            <Search size={16} color="#94A3B8" />
            <TextInput placeholder={placeholder} placeholderTextColor="#94A3B8" className="flex-1 ml-2 text-sm text-textMain" value={value} onChangeText={onChange} />
            {value.length > 0 && (
                <Pressable onPress={() => onChange('')}>
                    <X size={16} color="#94A3B8" />
                </Pressable>
            )}
        </View>
    );
}

function ActionIcon({
    active,
    icon,
    label,
    onPress,
}: {
    active?: boolean;
    icon: React.ReactNode;
    label: string;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} className="items-center flex-1">
            <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${active ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-100'}`}>
                {icon}
            </View>
            <Typography className={`text-[10px] font-bold mt-1 ${active ? 'text-primary' : 'text-gray-500'}`}>{label}</Typography>
        </Pressable>
    );
}

function NoticeBanner({ type, title, message, onClose }: { type: NoticeType; title: string; message: string; onClose: () => void }) {
    const isSuccess = type === 'success';
    const isInfo = type === 'info';
    const Icon = isSuccess ? CheckCircle2 : isInfo ? Info : AlertCircle;
    const container = isSuccess
        ? 'bg-emerald-50 border-emerald-100'
        : isInfo
            ? 'bg-blue-50 border-blue-100'
            : 'bg-rose-50 border-rose-100';
    const iconColor = isSuccess ? '#059669' : isInfo ? '#2563EB' : '#E11D48';
    const titleColor = isSuccess ? 'text-emerald-800' : isInfo ? 'text-blue-800' : 'text-rose-800';
    const messageColor = isSuccess ? 'text-emerald-700' : isInfo ? 'text-blue-700' : 'text-rose-700';

    return (
        <View className={`mx-5 mt-3 p-3 rounded-2xl border flex-row items-start ${container}`}>
            <Icon size={18} color={iconColor} />
            <View className="flex-1 ml-2">
                <Typography weight="bold" className={`text-sm ${titleColor}`}>{title}</Typography>
                <Typography className={`text-xs mt-0.5 ${messageColor}`}>{message}</Typography>
            </View>
            <Pressable onPress={onClose} className="w-7 h-7 items-center justify-center">
                <X size={16} color={iconColor} />
            </Pressable>
        </View>
    );
}

function QtyControl({
    value,
    color,
    onMinus,
    onPlus,
    onChangeQty,
}: {
    value: number;
    color: 'blue' | 'emerald';
    onMinus: () => void;
    onPlus: () => void;
    onChangeQty: (qty: number) => void;
}) {
    const [text, setText] = useState(String(value));

    useEffect(() => {
        setText(String(value));
    }, [value]);

    const textColor = color === 'blue' ? 'text-blue-600' : 'text-emerald-600';
    const borderColor = color === 'blue' ? 'border-blue-100' : 'border-emerald-100';

    const commitQty = (raw: string) => {
        const cleaned = raw.replace(/[^0-9]/g, '');
        if (cleaned === '') {
            setText('');
            return;
        }

        const nextQty = Math.max(1, parseInt(cleaned, 10) || 1);
        setText(String(nextQty));
        onChangeQty(nextQty);
    };

    return (
        <View className={`flex-row items-center self-end mt-3 bg-white rounded-xl border ${borderColor} overflow-hidden`}>
            <Pressable onPress={(e) => { e.stopPropagation(); onMinus(); }} className="px-3 py-1.5">
                <Typography className={`font-bold ${textColor}`}>-</Typography>
            </Pressable>
            <TextInput
                value={text}
                onChangeText={commitQty}
                onBlur={() => {
                    if (!text || Number(text) < 1) {
                        setText('1');
                        onChangeQty(1);
                    }
                }}
                keyboardType="number-pad"
                inputMode="numeric"
                className="w-14 px-2 py-1 text-xs font-bold text-center text-textMain"
                selectTextOnFocus
            />
            <Pressable onPress={(e) => { e.stopPropagation(); onPlus(); }} className="px-3 py-1.5">
                <Typography className={`font-bold ${textColor}`}>+</Typography>
            </Pressable>
        </View>
    );
}

function SummaryRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
    return (
        <View className="flex-row justify-between mb-2">
            <Typography className={muted ? 'text-gray-400 text-xs flex-1 mr-3' : 'text-gray-500 flex-1 mr-3'} numberOfLines={1}>{label}</Typography>
            <Typography weight="bold" className={muted ? 'text-gray-500 text-xs' : ''}>{value}</Typography>
        </View>
    );
}
