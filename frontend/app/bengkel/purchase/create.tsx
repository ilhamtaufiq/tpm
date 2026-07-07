import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, TextInput, StatusBar, Modal, ActivityIndicator } from 'react-native';
import { appAlert } from '../../../utils/appAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomTabBarBottomPadding } from '../../../components/ui/CustomTabBar';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import {
    AlertCircle,
    Check,
    ChevronLeft,
    Plus,
    Trash2,
    Calendar,
    Search,
    Package,
    X,
    CheckCircle2,
    Barcode as BarcodeIcon,
    Info,
    Wallet,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BarcodeScannerModal } from '../../../components/ui/BarcodeScannerModal';
import { BottomSheetContainer, CenterModalContainer } from '../../../components/ui/BottomSheetContainer';
import { onlineManager } from '@tanstack/react-query';
import { MasterDataSelector } from '../../../components/ui/MasterDataSelector';
import { useCreatePembelianParts, useSparePartsList, useUpdatePembelianParts } from '../../../hooks/useBengkel';
import { formatNumber, parseNumber, formatCurrency } from '../../../utils/format';
import { findSparePartByBarcode } from '../../../utils/barcodeScan';
import { bengkelService } from '../../../services/bengkel';
import { useDebounce } from '../../../hooks';

type NoticeType = 'error' | 'success' | 'info';

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isValidDateString = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export default function PurchaseScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const insets = useSafeAreaInsets();
    const editId = params.id ? Number(params.id) : null;
    const isEditMode = Number.isFinite(editId) && !!editId;

    // Step management
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Form State
    const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
    const [nomorFaktur, setNomorFaktur] = useState('');
    const [tanggal, setTanggal] = useState(new Date());
    const [tanggalText, setTanggalText] = useState(() => formatLocalDate(new Date()));
    const [tanggalError, setTanggalError] = useState('');
    const [tanggalPickerOpen, setTanggalPickerOpen] = useState(false);
    const [tempTanggalText, setTempTanggalText] = useState(() => formatLocalDate(new Date()));
    const [items, setItems] = useState<any[]>([]);
    const [catatan, setCatatan] = useState('');
    const [statusBayar, setStatusBayar] = useState('LUNAS');
    const [metodeBayar, setMetodeBayar] = useState<string | null>(null);
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [payments, setPayments] = useState<{ id: number; sumber: string; nominal: string }[]>([
        { id: Date.now() + Math.random(), sumber: 'BENGKEL_TUNAI', nominal: '' }
    ]);

    // UI State — transaksi pattern
    const [showPartSearch, setShowPartSearch] = useState(false);
    const [partSearch, setPartSearch] = useState('');
    const debouncedPartSearch = useDebounce(partSearch, 300);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scanLog, setScanLog] = useState<{ id: string; title: string; subtitle?: string; timestamp: number }[]>([]);
    const [notice, setNotice] = useState<{ type: NoticeType; title: string; message: string } | null>(null);
    const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [submitWithPayment, setSubmitWithPayment] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [createdTransaction, setCreatedTransaction] = useState<any | null>(null);

    // Hooks
    const createPembelianMutation = useCreatePembelianParts();
    const updatePembelianMutation = useUpdatePembelianParts();
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const {
        data: partsData,
        isLoading: isLoadingParts,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useSparePartsList({ limit: 20, search: debouncedPartSearch || undefined });
    const spareParts = useMemo(() =>
        partsData?.pages.flatMap((page: any) => page.data || []) || [],
        [partsData]
    );

    // Preload parts
    useEffect(() => {
        if (!showPartSearch && items.length > 0) return;
        if (partSearch.trim()) return;
        if (isLoadingParts || isFetchingNextPage || !hasNextPage) return;
        fetchNextPage();
    }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoadingParts, showPartSearch, partSearch, items.length]);

    // Edit mode detail loading
    useEffect(() => {
        if (!isEditMode || !editId) return;

        const loadDetail = async () => {
            setIsLoadingDetail(true);
            try {
                const detail = await bengkelService.getDetailPembelianPart(editId);
                setSelectedSupplier(detail.supplier || {
                    id: detail.supplier_id,
                    nama: detail.supplier_nama,
                });
                setNomorFaktur(detail.nomor_faktur && detail.nomor_faktur !== '-' ? detail.nomor_faktur : '');
                setTanggal(detail.tanggal ? new Date(detail.tanggal) : new Date());
                setTanggalText(detail.tanggal ? formatLocalDate(new Date(detail.tanggal)) : formatLocalDate(new Date()));
                setCatatan(detail.catatan || '');
                setItems((detail.detail || []).map((item: any) => ({
                    id: item.id || Date.now() + Math.random(),
                    spare_part_id: item.spare_part_id,
                    name: item.spare_part?.nama || item.spare_part_nama || '',
                    qty: String(item.qty || 1),
                    price: formatNumber(Number(item.harga_satuan ?? 0)),
                })));

                const hydratedPayments = Array.isArray(detail.payments) && detail.payments.length > 0
                    ? detail.payments.map((payment: any, index: number) => ({
                        id: Date.now() + index + Math.random(),
                        sumber: payment.kas_jenis === 'BANK_UTAMA'
                            ? 'UTAMA_TRANSFER'
                            : payment.kas_jenis === 'KAS_UTAMA'
                                ? 'UTAMA_TUNAI'
                                : 'BENGKEL_TUNAI',
                        nominal: formatNumber(Number(payment.jumlah ?? 0)),
                    }))
                    : [{ id: Date.now() + Math.random(), sumber: 'BENGKEL_TUNAI', nominal: '' }];

                setPayments(hydratedPayments);
                setIsSplitPayment(hydratedPayments.length > 1 || detail.metode_bayar === 'SPLIT');
                setStatusBayar(detail.status_bayar || 'BELUM_LUNAS');
                if (detail.metode_bayar === 'KREDIT' || (detail.status_bayar !== 'LUNAS' && hydratedPayments.every((p: any) => !parseNumber(p.nominal)))) {
                    setMetodeBayar('KREDIT');
                } else if (hydratedPayments[0]?.sumber) {
                    setMetodeBayar(hydratedPayments[0].sumber);
                }
            } catch (error: any) {
                const errorDetail = error.response?.data?.detail;
                const message = typeof errorDetail === 'string' ? errorDetail : 'Gagal memuat detail pembelian';
                appAlert('Error', message);
                handleBack();
            } finally {
                setIsLoadingDetail(false);
            }
        };

        loadDetail();
    }, [editId, isEditMode]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    // Calculations
    const total = useMemo(() => {
        return items.reduce((acc, item) => acc + (Number(parseNumber(item.price) || 0) * Number(item.qty || 0)), 0);
    }, [items]);

    const totalSplitAmount = useMemo(() => {
        return payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0);
    }, [payments]);

    const getPaymentDetails = (sumber: string) => {
        if (sumber === 'BENGKEL_TUNAI') return { metode: 'TUNAI', kas_jenis: 'KAS_UNIT_BENGKEL' };
        if (sumber === 'UTAMA_TUNAI') return { metode: 'TUNAI', kas_jenis: 'KAS_UTAMA' };
        if (sumber === 'UTAMA_TRANSFER') return { metode: 'TRANSFER', kas_jenis: 'BANK_UTAMA' };
        return { metode: 'TUNAI', kas_jenis: 'KAS_UNIT_BENGKEL' };
    };

    // Item handlers
    const handleRemoveItem = (id: number) => {
        setItems(items.filter(item => item.id !== id));
    };

    const setItemQty = (index: number, qty: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], qty: String(Math.max(1, qty)) };
        setItems(newItems);
    };

    const setItemPrice = (index: number, val: string) => {
        const newItems = [...items];
        // Pastikan konversi string ke number aman sebelum format
        const numericVal = parseNumber(val);
        newItems[index] = { ...newItems[index], price: formatNumber(numericVal) };
        setItems(newItems);
    };

    // Payment handlers
    const handleAddPaymentRow = () => {
        setPayments([...payments, { id: Date.now() + Math.random(), sumber: 'BENGKEL_TUNAI', nominal: '' }]);
    };

    const handleRemovePaymentRow = (id: number) => {
        setPayments(payments.filter(p => p.id !== id));
    };

    const handleUpdatePaymentRow = (id: number, field: string, value: string) => {
        const nextPayments = payments.map(p => {
            if (p.id === id) {
                return { ...p, [field]: field === 'nominal' ? formatNumber(value) : value };
            }
            return p;
        });
        setPayments(nextPayments);

        if (field === 'nominal') {
            const totalPaid = nextPayments.reduce((acc, p) => acc + parseNumber(p.nominal), 0);
            setStatusBayar(totalPaid >= total ? 'LUNAS' : 'BELUM_LUNAS');
        }
    };

    // Part selection — inline (no bottom sheet)
    const toggleItem = (part: any) => {
        const exists = items.find(i => i.spare_part_id === part.id);
        if (exists) {
            // Remove
            setItems(items.filter(i => i.id !== exists.id));
        } else {
            // Add
            setItems([...items, {
                id: Date.now() + Math.random(),
                spare_part_id: part.id,
                name: part.nama,
                qty: '1',
                price: formatNumber(Number(part.harga_beli ?? 0)),
            }]);
        }
    };

    // Scan handler
    const handleScanPart = (data: string): boolean => {
        const availableParts = spareParts || [];
        const part = findSparePartByBarcode(availableParts, data);

        if (part) {
            const existingIndex = items.findIndex(i => i.spare_part_id === part.id);
            if (existingIndex !== -1) {
                const newItems = [...items];
                newItems[existingIndex].qty = (Number(newItems[existingIndex].qty) + 1).toString();
                setItems(newItems);
            } else {
                setItems([...items, {
                    id: Date.now() + Math.random(),
                    spare_part_id: part.id,
                    name: part.nama,
                    qty: '1',
                    price: formatNumber(Number(part.harga_beli ?? 0))
                }]);
            }
            setScannerOpen(false);
            setScanLog(prev => [{
                id: Math.random().toString(),
                title: part.nama,
                subtitle: `Kode: ${part.kode || '-'}`,
                timestamp: Date.now(),
            }, ...prev]);
            return true;
        }

        setScannerOpen(false);
        setScanLog(prev => [{ id: Math.random().toString(), title: 'Tidak ditemukan', subtitle: `Kode: ${data}`, timestamp: Date.now() }, ...prev]);
        showNotice('error', 'Tidak Ditemukan', `Part dengan kode "${data}" tidak ditemukan.`);
        return false;
    };

    // Navigation
    const handlePartsScroll = (event: any) => {
        if (!hasNextPage || isFetchingNextPage) return;

        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const paddingToBottom = 320;
        const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);

        if (distanceFromBottom < paddingToBottom) {
            fetchNextPage();
        }
    };

    const next = () => {
        if (step === 1 && items.length === 0) {
            showNotice('error', 'Validasi', 'Pilih minimal satu sparepart.');
            return;
        }
        if (step === 2) {
            if (!selectedSupplier) {
                showNotice('error', 'Validasi', 'Pilih supplier terlebih dahulu.');
                return;
            }
            if (!isValidDateString(tanggalText)) {
                showNotice('error', 'Validasi', 'Format tanggal tidak valid (YYYY-MM-DD).');
                return;
            }
            // Sync tanggal from tanggalText
            const [y, m, d] = tanggalText.split('-').map(Number);
            setTanggal(new Date(y, m - 1, d));
        }
        setNotice(null);
        setStep(prev => Math.min(3, prev + 1) as 1 | 2 | 3);
    };

    const confirmSubmit = (withPayment = false) => {
        if (withPayment && isSplitPayment) {
            const totalSplit = payments.reduce((acc, p) => acc + parseNumber(p.nominal), 0);
            if (totalSplit !== total) {
                showNotice('error', 'Validasi', 'Total split payment harus sama dengan total pembelian.');
                return;
            }
        }
        setSubmitWithPayment(withPayment);
        setNotice(null);
        setConfirmSubmitOpen(true);
    };

    const handleSubmit = async () => {
        if (!selectedSupplier) {
            showNotice('error', 'Validasi', 'Mohon pilih supplier terlebih dahulu.');
            return;
        }
        if (items.length === 0 || items.some(i => !i.spare_part_id || !i.qty || Number(i.qty) <= 0)) {
            showNotice('error', 'Validasi', 'Mohon lengkapi data barang dengan jumlah yang valid (> 0).');
            return;
        }

        if (!isSplitPayment && !metodeBayar) {
            showNotice('error', 'Validasi', 'Mohon pilih metode pembayaran');
            return;
        }

        const payload = {
            tanggal: tanggal.toISOString().split('T')[0],
            supplier_id: selectedSupplier.id,
            nomor_faktur: nomorFaktur || '-',
            catatan: catatan,
            status_bayar: isSplitPayment ? (totalSplitAmount >= total ? 'LUNAS' : 'BELUM_LUNAS') : statusBayar,
            metode_bayar: isSplitPayment ? 'SPLIT' : (metodeBayar === 'KREDIT' ? 'KREDIT' : getPaymentDetails(metodeBayar || 'BENGKEL_TUNAI').metode),
            kas_jenis: isSplitPayment ? undefined : (metodeBayar === 'KREDIT' ? undefined : getPaymentDetails(metodeBayar || 'BENGKEL_TUNAI').kas_jenis),
            payments: isSplitPayment ? payments.map(p => ({
                metode: getPaymentDetails(p.sumber).metode,
                jumlah: parseNumber(p.nominal),
                kas_jenis: getPaymentDetails(p.sumber).kas_jenis
            })).filter(p => p.jumlah > 0) : [
                {
                    metode: metodeBayar === 'KREDIT' ? 'KREDIT' : getPaymentDetails(metodeBayar || 'BENGKEL_TUNAI').metode,
                    jumlah: statusBayar === 'LUNAS' ? total : parseNumber(payments[0]?.nominal || '0'),
                    kas_jenis: metodeBayar === 'KREDIT' ? undefined : getPaymentDetails(metodeBayar || 'BENGKEL_TUNAI').kas_jenis
                }
            ],
            diskon: 0,
            detail: items.map(item => ({
                spare_part_id: item.spare_part_id,
                qty: Number(item.qty),
                harga_satuan: Number(parseNumber(item.price))
            }))
        };

        const isOnline = onlineManager.isOnline();

        if (!isOnline) {
            createPembelianMutation.mutate(payload);
            showNotice('success', 'Mode Offline', 'Transaksi telah disimpan di antrian.');
            handleBack();
            return;
        }

        try {
            setConfirmSubmitOpen(false);
            setPaymentSheetOpen(false);
            if (isEditMode && editId) {
                await updatePembelianMutation.mutateAsync({ id: editId, data: payload });
            } else {
                const result = await createPembelianMutation.mutateAsync(payload);
                setCreatedTransaction(result);
            }
            setSuccessModalOpen(true);
        } catch (error: any) {
            console.error(error);
            const errorDetail = error.response?.data?.detail;
            const message = typeof errorDetail === 'string' ? errorDetail : 'Gagal menyimpan transaksi pembelian. Pastikan semua data valid dan saldo mencukupi.';
            showNotice('error', 'Error', message);
        }
    };

    const closeAfterSubmit = () => {
        setSuccessModalOpen(false);
        if (router.canGoBack()) router.back();
        else router.replace('/bengkel');
    };

    const showNotice = (type: NoticeType, title: string, message: string) => {
        setNotice({ type, title, message });
    };

    const openTanggalPicker = () => {
        setTempTanggalText(tanggalText);
        setTanggalError('');
        setTanggalPickerOpen(true);
    };

    const applyTanggalPicker = () => {
        if (!isValidDateString(tempTanggalText)) {
            setTanggalError('Format tanggal tidak valid. Gunakan YYYY-MM-DD.');
            return;
        }
        setTanggalText(tempTanggalText);
        const [y, m, d] = tempTanggalText.split('-').map(Number);
        setTanggal(new Date(y, m - 1, d));
        setTanggalPickerOpen(false);
        setTanggalError('');
    };

    const selectTodayTanggal = () => {
        const today = formatLocalDate(new Date());
        setTempTanggalText(today);
        setTanggalText(today);
        setTanggal(new Date());
        setTanggalPickerOpen(false);
        setTanggalError('');
    };

    // --- RENDER ---

    const tabBarBottom = getCustomTabBarBottomPadding(insets.bottom, 24);
    const tabBarHeight = 60;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                    <Pressable onPress={handleBack} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3">
                        <ChevronLeft size={20} color="#475569" />
                    </Pressable>
                    <View>
                        <Typography variant="h3" weight="bold">{isEditMode ? 'Edit Restock' : 'Restock (Pembelian)'}</Typography>
                        <Typography className="text-gray-400 text-xs mt-0.5">Pembelian Sparepart</Typography>
                    </View>
                </View>
            </View>

            {/* Step 1 Action Bar */}
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
                            icon={<BarcodeIcon size={20} color="#023C69" />}
                            label="Scan"
                            onPress={() => { setScanLog([]); setScannerOpen(true); }}
                        />
                    </View>
                    {showPartSearch && (
                        <View className="mt-3">
                            <SearchBox
                                value={partSearch}
                                onChange={setPartSearch}
                                placeholder="Cari sparepart..."
                            />
                        </View>
                    )}
                    {scanLog.length > 0 && (
                        <View className="mt-2">
                            {scanLog.slice(0, 3).map(log => (
                                <View key={log.id} className="flex-row items-center bg-blue-50 rounded-xl px-3 py-2 mb-1 border border-blue-100">
                                    <CheckCircle2 size={14} color="#2563EB" />
                                    <Typography className="text-blue-700 text-xs font-semibold ml-2 flex-1" numberOfLines={1}>{log.title}</Typography>
                                    {log.subtitle ? (
                                        <Typography className="text-blue-600/70 text-[10px] ml-2">{log.subtitle}</Typography>
                                    ) : null}
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {isLoadingDetail && (
                <View className="py-10 items-center justify-center">
                    <ActivityIndicator color="#023C69" />
                    <Typography className="text-gray-500 mt-3">Memuat data pembelian...</Typography>
                </View>
            )}

            {notice && <NoticeBanner type={notice.type} title={notice.title} message={notice.message} onClose={() => setNotice(null)} />}

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight + 140 }}
                showsVerticalScrollIndicator={false}
                onScroll={handlePartsScroll}
                scrollEventThrottle={16}
            >
                {/* STEP 1: Item Selection — inline picker like transaksi */}
                {step === 1 && (
                    <View>
                        {/* Part catalog — always visible */}
                        <View className="w-full">
                            <View className="flex-row items-center justify-between mb-3 px-1">
                                <View className="flex-row items-center">
                                    <Package size={18} color="#023C69" />
                                    <Typography weight="bold" className="ml-2 text-primary uppercase">Katalog Sparepart</Typography>
                                </View>
                                {items.length > 0 && <Typography className="text-gray-400 text-xs font-bold">{items.length} item dipilih</Typography>}
                            </View>

                            {isLoadingParts ? (
                                <ActivityIndicator color="#023C69" />
                            ) : (
                                spareParts.map((part: any) => {
                                    const itemIdx = items.findIndex(i => i.spare_part_id === part.id);
                                    const selected = itemIdx >= 0;
                                    const currentItem = selected ? items[itemIdx] : null;

                                    return (
                                        <View
                                            key={part.id}
                                            className={`mb-3 p-3 rounded-2xl border ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}
                                        >
                                            <Pressable onPress={() => toggleItem(part)} className="flex-row items-start">
                                                <View className={`w-7 h-7 rounded-lg border items-center justify-center mr-3 ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                                    {selected && <Check size={16} color="white" />}
                                                </View>
                                                <View className="flex-1">
                                                    <View className="flex-row items-center">
                                                        <Package size={18} color={selected ? '#2563EB' : '#94A3B8'} />
                                                        <Typography weight="bold" className="text-sm ml-2 flex-1 text-textMain" numberOfLines={1}>
                                                            {part.nama}
                                                        </Typography>
                                                    </View>
                                                    <Typography className="text-gray-400 text-[11px] mt-1">
                                                        {part.kode || '-'} • Stok: {part.stok === 999 ? 'Always Ready' : Number(part.stok || 0)}
                                                    </Typography>
                                                    {!selected && (
                                                        <Typography className="text-primary text-xs font-bold mt-1">
                                                            {formatCurrency(part.harga_beli)}
                                                        </Typography>
                                                    )}
                                                </View>
                                            </Pressable>

                                            {selected && currentItem && (
                                                <View className="mt-3 pt-3 border-t border-blue-100">
                                                    <View className="flex-row items-center space-x-3">
                                                        <View className="flex-1">
                                                            <Typography className="text-gray-500 text-[10px] font-bold uppercase mb-1">Qty</Typography>
                                                            <QtyControl
                                                                value={Number(currentItem.qty)}
                                                                color="blue"
                                                                onMinus={() => setItemQty(itemIdx, Number(currentItem.qty) - 1)}
                                                                onPlus={() => setItemQty(itemIdx, Number(currentItem.qty) + 1)}
                                                                onChangeQty={(qty) => setItemQty(itemIdx, qty)}
                                                            />
                                                        </View>
                                                        <View className="flex-1">
                                                            <Typography className="text-gray-500 text-[10px] font-bold uppercase mb-1">Harga Beli</Typography>
                                                            <View className="flex-row items-center bg-white rounded-xl border border-blue-100 px-3 h-9">
                                                                <Typography className="text-blue-600 text-xs font-bold mr-1">Rp</Typography>
                                                                <TextInput
                                                                    value={currentItem.price}
                                                                    onChangeText={(val) => setItemPrice(itemIdx, val)}
                                                                    keyboardType="number-pad"
                                                                    className="flex-1 text-blue-600 text-xs font-bold p-0"
                                                                />
                                                            </View>
                                                        </View>
                                                    </View>
                                                    <View className="flex-row justify-end mt-2">
                                                        <Typography className="text-blue-700 text-[10px] font-bold">
                                                            Subtotal: {formatCurrency((Number(currentItem.qty) || 0) * (Number(parseNumber(currentItem.price)) || 0))}
                                                        </Typography>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                            {isFetchingNextPage && (
                                <View className="py-4">
                                    <ActivityIndicator color="#023C69" />
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* STEP 2: Supplier Info */}
                {step === 2 && (
                    <View>
                        <Card variant="outlined" className="p-4 mb-6 border-gray-100 bg-gray-50/30">
                            <MasterDataSelector
                                type="supplier"
                                label="Informasi Supplier"
                                value={selectedSupplier}
                                onSelect={setSelectedSupplier}
                                placeholder="Pilih Supplier..."
                            />
                        </Card>

                        <Input
                            label="Nomor Faktur"
                            placeholder="INV/2024/001"
                            value={nomorFaktur}
                            onChangeText={setNomorFaktur}
                            containerClassName="mb-6"
                        />

                        <View className="mb-6">
                            <Typography variant="body2" className="text-textGray text-sm mb-1 font-medium">Tanggal Pembelian</Typography>
                            <Pressable
                                onPress={openTanggalPicker}
                                className="bg-gray-100 rounded-2xl px-4 h-[52px] justify-center border-2 border-transparent"
                            >
                                <View className="flex-row items-center">
                                    <Calendar size={18} color="#767676" />
                                    <Typography className="ml-2 font-medium">
                                        {tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </Typography>
                                </View>
                            </Pressable>
                        </View>

                        <Input
                            label="Catatan (Opsional)"
                            placeholder="Contoh: Pengiriman via JNE"
                            value={catatan}
                            onChangeText={setCatatan}
                            multiline
                            numberOfLines={2}
                            containerClassName="mt-2"
                        />
                    </View>
                )}

                {/* STEP 3: Review & Payment */}
                {step === 3 && (
                    <View>
                        <Typography variant="body1" weight="bold" className="text-textMain mb-4">Review Transaksi</Typography>

                        <View className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-5">
                            <SummaryRow label="Supplier" value={selectedSupplier?.nama || '-'} />
                            {nomorFaktur && <SummaryRow label="Faktur" value={nomorFaktur} />}
                            <SummaryRow label="Tanggal" value={tanggalText} />
                            <View className="h-[1px] bg-slate-200 my-3" />
                            <SummaryRow label="Sparepart" value={`${items.length} item`} />
                            {items.map(item => (
                                <SummaryRow
                                    key={`review-${item.id}`}
                                    label={`${item.name} x${item.qty}`}
                                    value={`${formatCurrency(Number(parseNumber(item.price)) || 0)}/pcs`}
                                    muted
                                />
                            ))}
                            <View className="h-[1px] bg-slate-200 my-1 mx-2" />
                            {items.map(item => (
                                <SummaryRow
                                    key={`review-subtotal-${item.id}`}
                                    label={`Subtotal ${item.name}`}
                                    value={formatCurrency(Number(item.qty || 0) * Number(parseNumber(item.price) || 0))}
                                    muted
                                />
                            ))}
                            {catatan && <SummaryRow label="Catatan" value={catatan} />}
                            <View className="h-[1px] bg-slate-200 my-3" />
                            <View className="flex-row justify-between items-center">
                                <Typography weight="bold" className="text-textMain">Total</Typography>
                                <Typography variant="h3" weight="bold" className="text-primary">{formatCurrency(total)}</Typography>
                            </View>
                        </View>

                        <Input label="Catatan" placeholder="Catatan transaksi..." value={catatan} onChangeText={setCatatan} multiline />
                    </View>
                )}
            </ScrollView>

            {/* Bottom Bar */}
            <View className="absolute left-0 right-0 bg-white border-t border-gray-100 px-5 py-4" style={{ bottom: tabBarBottom }}>
                <View className="flex-row items-center justify-between mb-3">
                    <Typography className="text-gray-400 text-xs font-bold uppercase">{step === 3 ? 'Total Pembelian' : ''}</Typography>
                    {step === 3 && (
                        <Typography weight="bold" className="text-primary text-lg">{formatCurrency(total)}</Typography>
                    )}
                </View>
                <View className="flex-row space-x-3">
                    {step > 1 && (
                        <Button title="Kembali" variant="outline" className="flex-1" onPress={() => setStep(prev => Math.max(1, prev - 1) as 1 | 2 | 3)} />
                    )}
                    {step < 3 ? (
                        <Button
                            title="Lanjut"
                            className="flex-1"
                            onPress={next}
                        />
                    ) : (
                        <Button
                            title="Lanjut Pembayaran"
                            className="flex-1"
                            onPress={() => setPaymentSheetOpen(true)}
                            icon={<Wallet size={16} color="white" />}
                        />
                    )}
                </View>
            </View>

            {/* Tanggal Modal */}
            <Modal visible={tanggalPickerOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTanggalPickerOpen(false)}>
                <CenterModalContainer onClose={() => setTanggalPickerOpen(false)} insets={insets}>
                    <View className="p-5">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center flex-1">
                                <View className="w-11 h-11 rounded-2xl bg-teal-50 items-center justify-center border border-teal-100 mr-3">
                                    <Calendar size={20} color="#0F766E" />
                                </View>
                                <View className="flex-1">
                                    <Typography variant="h3" weight="bold" className="text-textMain">Pilih Tanggal</Typography>
                                    <Typography className="text-gray-400 text-xs mt-0.5">Tanggal pembelian</Typography>
                                </View>
                            </View>
                            <Pressable onPress={() => setTanggalPickerOpen(false)} className="w-9 h-9 bg-gray-100 rounded-full items-center justify-center">
                                <X size={17} color="#475569" />
                            </Pressable>
                        </View>

                        <Typography className="text-gray-500 text-[10px] font-bold uppercase mb-1">Tanggal</Typography>
                        <TextInput
                            value={tempTanggalText}
                            onChangeText={(value) => {
                                setTempTanggalText(value);
                                if (tanggalError) setTanggalError('');
                            }}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                            keyboardType="numbers-and-punctuation"
                            className="bg-gray-50 rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-200"
                        />
                        {tanggalError ? (
                            <Typography className="text-rose-500 text-xs mt-2">{tanggalError}</Typography>
                        ) : null}

                        <View className="flex-row gap-3 mt-5">
                            <Button title="Hari Ini" variant="outline" className="flex-1" onPress={selectTodayTanggal} />
                            <Button title="Terapkan" className="flex-1" onPress={applyTanggalPicker} />
                        </View>
                    </View>
                </CenterModalContainer>
            </Modal>

            {/* Payment Sheet */}
            <Modal visible={paymentSheetOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setPaymentSheetOpen(false)}>
                <BottomSheetContainer
                    onClose={() => setPaymentSheetOpen(false)}
                    insets={insets}
                    maxHeight="82%"
                    footer={
                        <Button
                            title="Simpan & Proses Pembayaran"
                            onPress={() => confirmSubmit(true)}
                            loading={createPembelianMutation.isPending || updatePembelianMutation.isPending}
                        />
                    }
                >
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-5" />
                        <View className="flex-row items-center justify-between mb-4">
                            <View>
                                <Typography variant="h3" weight="bold">Pembayaran</Typography>
                                <Typography className="text-gray-400 text-xs mt-0.5">Total {formatCurrency(total)}</Typography>
                            </View>
                            <Pressable onPress={() => setPaymentSheetOpen(false)} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                                <X size={18} color="#475569" />
                            </Pressable>
                        </View>

                        <ScrollView
                            style={{ flexShrink: 1 }}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 16 }}
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled
                        >
                            {/* Metode Pembayaran */}
                            <View className="mb-6">
                                <Typography variant="caption" weight="bold" className="text-gray-500 mb-2 uppercase">Metode Pembayaran</Typography>
                                <View className="flex-row flex-wrap space-x-2">
                                    {[
                                        { label: 'Tunai Bengkel', value: 'BENGKEL_TUNAI' },
                                        { label: 'Tunai Utama', value: 'UTAMA_TUNAI' },
                                        { label: 'Transfer', value: 'UTAMA_TRANSFER' },
                                        { label: 'Hutang Penuh', value: 'KREDIT' }
                                    ].map((m) => (
                                        <Pressable
                                            key={m.value}
                                            onPress={() => {
                                                setMetodeBayar(m.value);
                                                setStatusBayar(m.value === 'KREDIT' ? 'BELUM_LUNAS' : 'LUNAS');
                                            }}
                                            className={`flex-1 min-w-[45%] mb-2 py-3 rounded-2xl border items-center ${metodeBayar === m.value ? 'bg-primary border-primary' : 'bg-white border-gray-100'}`}
                                        >
                                            <Typography weight="bold" className={metodeBayar === m.value ? 'text-white' : 'text-gray-500'}>{m.label}</Typography>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {/* Nominal (non-KREDIT) */}
                            {metodeBayar && metodeBayar !== 'KREDIT' && (
                                <View className="bg-primary/5 border border-primary/10 p-4 rounded-2xl mb-4">
                                    <View className="flex-row justify-between items-center mb-2">
                                        <Typography variant="caption" weight="bold" className="text-primary uppercase">Jumlah Bayar (Rp)</Typography>
                                        <Pressable onPress={() => {
                                            handleUpdatePaymentRow(payments[0].id, 'nominal', formatNumber(total));
                                            setStatusBayar('LUNAS');
                                        }}>
                                            <Typography className="text-primary text-[10px] font-bold">BAYAR PAS</Typography>
                                        </Pressable>
                                    </View>
                                    <TextInput
                                        value={payments[0]?.nominal || ''}
                                        onChangeText={(v) => {
                                            const nominal = parseNumber(v);
                                            handleUpdatePaymentRow(payments[0].id, 'nominal', v);
                                            setStatusBayar(nominal >= total ? 'LUNAS' : 'BELUM_LUNAS');
                                        }}
                                        placeholder="0"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="number-pad"
                                        inputMode="numeric"
                                        className="bg-white rounded-2xl px-4 h-12 text-base text-textMain border border-primary/20"
                                    />
                                    <View className="flex-row justify-between items-center mt-2 px-1">
                                        <Typography
                                            variant="caption"
                                            weight="bold"
                                            className={parseNumber(payments[0]?.nominal || '0') >= total ? 'text-emerald-600' : 'text-amber-600'}
                                        >
                                            {parseNumber(payments[0]?.nominal || '0') >= total ? 'Lunas' : 'Titip / DP'}
                                        </Typography>
                                        {parseNumber(payments[0]?.nominal || '0') > total && (
                                            <Typography variant="caption" weight="bold" className="text-primary">
                                                Kembalian: {formatCurrency(parseNumber(payments[0]?.nominal || '0') - total)}
                                            </Typography>
                                        )}
                                    </View>
                                    {parseNumber(payments[0]?.nominal || '0') < total && (
                                        <Typography className="text-amber-600 text-xs mt-1">
                                            Sisa {formatCurrency(Math.max(0, total - parseNumber(payments[0]?.nominal || '0')))} akan dicatat sebagai Hutang.
                                        </Typography>
                                    )}
                                </View>
                            )}

                            {metodeBayar === 'KREDIT' && (
                                <View className="bg-amber-50 border border-amber-100 p-5 rounded-2xl flex-row items-center mb-4">
                                    <View className="w-10 h-10 bg-amber-100 rounded-full items-center justify-center mr-4">
                                        <Package size={20} color="#D97706" />
                                    </View>
                                    <View className="flex-1">
                                        <Typography variant="caption" weight="bold" className="text-amber-800 uppercase tracking-widest text-[10px] mb-1">Status: HUTANG PENUH</Typography>
                                        <Typography className="text-amber-700 font-medium">
                                            Transaksi dicatat sebagai hutang sebesar {formatCurrency(total)}.
                                        </Typography>
                                    </View>
                                </View>
                            )}

                            {/* Split Payment Toggle */}
                            <View className="mb-4">
                                <Pressable
                                    onPress={() => setIsSplitPayment(!isSplitPayment)}
                                    className={`self-end px-3 py-1.5 rounded-full ${isSplitPayment ? 'bg-amber-100 border border-amber-200' : 'bg-gray-100 border border-gray-200'}`}
                                >
                                    <Typography className={`text-[10px] font-bold ${isSplitPayment ? 'text-amber-700' : 'text-gray-500'}`}>
                                        {isSplitPayment ? 'SPLIT AKTIF' : 'SPLIT PAYMENT?'}
                                    </Typography>
                                </Pressable>
                            </View>

                            {isSplitPayment && (
                                <View className="space-y-3 mb-4">
                                    {payments.map((p, idx) => (
                                        <View key={p.id} className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                                            <View className="flex-row flex-wrap bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
                                                {[
                                                    { label: 'Tunai Bengkel', value: 'BENGKEL_TUNAI' },
                                                    { label: 'Tunai Utama', value: 'UTAMA_TUNAI' },
                                                    { label: 'Transfer Utama', value: 'UTAMA_TRANSFER' }
                                                ].map((m) => (
                                                    <Pressable
                                                        key={m.value}
                                                        onPress={() => handleUpdatePaymentRow(p.id, 'sumber', m.value)}
                                                        className={`flex-1 min-w-[30%] py-2 items-center justify-center border-r border-gray-100 ${p.sumber === m.value ? 'bg-primary' : 'bg-transparent'}`}
                                                    >
                                                        <Typography weight="bold" className={`text-[9px] ${p.sumber === m.value ? 'text-white' : 'text-textGray'}`}>{m.label}</Typography>
                                                    </Pressable>
                                                ))}
                                            </View>
                                            <View className="flex-row items-center space-x-2">
                                                <View className="flex-1">
                                                    <Typography className="text-gray-500 text-[10px] font-bold uppercase mb-1">Nominal (Rp)</Typography>
                                                    <TextInput
                                                        value={p.nominal}
                                                        onChangeText={(v) => handleUpdatePaymentRow(p.id, 'nominal', v)}
                                                        placeholder="0"
                                                        placeholderTextColor="#94A3B8"
                                                        keyboardType="number-pad"
                                                        inputMode="numeric"
                                                        className="bg-white rounded-xl px-3 h-10 text-sm text-textMain border border-gray-200"
                                                    />
                                                </View>
                                                <Pressable
                                                    onPress={() => handleRemovePaymentRow(p.id)}
                                                    className="h-10 w-10 items-center justify-center bg-rose-50 rounded-xl mt-5"
                                                >
                                                    <Trash2 size={16} color="#F43F5E" />
                                                </Pressable>
                                            </View>
                                        </View>
                                    ))}
                                    <Pressable
                                        onPress={handleAddPaymentRow}
                                        className="flex-row items-center justify-center py-2.5 bg-white border border-dashed border-primary/30 rounded-xl"
                                    >
                                        <Plus size={14} color="#023C69" />
                                        <Typography weight="bold" className="text-primary text-[10px] ml-1.5 uppercase">Tambah Metode</Typography>
                                    </Pressable>
                                </View>
                            )}

                            {/* Total Payment Summary */}
                            <View className="flex-row justify-between items-center p-4 bg-primary/5 rounded-2xl border border-primary/10">
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-primary text-[10px]">TOTAL TERBAYAR</Typography>
                                    <Typography weight="bold" className="text-primary text-lg">{formatCurrency(totalSplitAmount)}</Typography>
                                </View>
                                <View className="items-end">
                                    {totalSplitAmount < total ? (
                                        <>
                                            <Typography variant="caption" weight="bold" className="text-amber-600 text-[10px]">SISA HUTANG</Typography>
                                            <Typography weight="bold" className="text-amber-600 text-lg">{formatCurrency(total - totalSplitAmount)}</Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Typography variant="caption" weight="bold" className="text-emerald-600 text-[10px]">STATUS</Typography>
                                            <Typography weight="bold" className="text-emerald-600 text-lg">LUNAS</Typography>
                                        </>
                                    )}
                                </View>
                            </View>
                        </ScrollView>
                </BottomSheetContainer>
            </Modal>

            {/* Confirm Submit Modal */}
            <Modal visible={confirmSubmitOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setConfirmSubmitOpen(false)}>
                <CenterModalContainer onClose={() => setConfirmSubmitOpen(false)} insets={insets}>
                    <ScrollView
                        bounces={false}
                        showsVerticalScrollIndicator={false}
                        style={{ flexShrink: 1 }}
                        contentContainerStyle={{ padding: 20, paddingBottom: 12 }}
                    >
                        <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center mb-4">
                            <Wallet size={22} color="#023C69" />
                        </View>
                        <Typography variant="h3" weight="bold" className="text-textMain">{isEditMode ? 'Simpan Perubahan?' : 'Simpan Pembelian?'}</Typography>
                        <Typography className="text-gray-500 text-sm mt-2">
                            {submitWithPayment
                                ? 'Pastikan detail barang, supplier, dan pembayaran sudah benar.'
                                : 'Transaksi akan disimpan tanpa memproses pembayaran.'}
                        </Typography>
                        <View className="bg-slate-50 rounded-2xl p-4 mt-4 border border-slate-100">
                            <SummaryRow label="Sparepart" value={`${items.length} item`} />
                            <SummaryRow label="Supplier" value={selectedSupplier?.nama || '-'} />
                            <SummaryRow label="Metode" value={submitWithPayment ? (metodeBayar === 'KREDIT' ? 'Hutang' : (metodeBayar || '-')) : 'Belum diproses'} />
                            <View className="h-[1px] bg-slate-200 my-2" />
                            <SummaryRow label="Total" value={formatCurrency(total)} />
                        </View>
                    </ScrollView>
                    <View className="flex-row gap-3 px-5 pb-5 pt-3 border-t border-gray-100">
                        <Button title="Batal" variant="outline" size="sm" className="flex-1 min-w-0" onPress={() => setConfirmSubmitOpen(false)} />
                        <Button title={isEditMode ? 'Update' : 'Simpan'} size="sm" className="flex-1 min-w-0" onPress={handleSubmit} loading={createPembelianMutation.isPending || updatePembelianMutation.isPending} />
                    </View>
                </CenterModalContainer>
            </Modal>

            {/* Success Modal */}
            <Modal visible={successModalOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => { setSuccessModalOpen(false); closeAfterSubmit(); }}>
                <CenterModalContainer onClose={() => { setSuccessModalOpen(false); closeAfterSubmit(); }} insets={insets}>
                    <ScrollView
                        bounces={false}
                        showsVerticalScrollIndicator={false}
                        style={{ flexShrink: 1 }}
                        contentContainerStyle={{ padding: 24, paddingBottom: 12, alignItems: 'center' }}
                        className="w-full"
                    >
                        <View className="w-16 h-16 rounded-full bg-emerald-50 items-center justify-center border border-emerald-100 mb-4">
                            <CheckCircle2 size={34} color="#10B981" />
                        </View>
                        <Typography variant="h3" weight="bold" className="text-textMain text-center">
                            {isEditMode ? 'Pembelian Berhasil Diupdate' : 'Pembelian Berhasil'}
                        </Typography>
                        <Typography className="text-gray-500 text-sm mt-2 text-center">
                            {submitWithPayment
                                ? 'Transaksi pembelian dan pembayaran berhasil diproses.'
                                : 'Data pembelian sparepart berhasil disimpan.'}
                        </Typography>
                    </ScrollView>
                    <View className="w-full px-6 pb-6 pt-2 border-t border-gray-100">
                        <Button
                            title="OK"
                            variant="outline"
                            className="w-full"
                            onPress={closeAfterSubmit}
                        />
                    </View>
                </CenterModalContainer>
            </Modal>

            <BarcodeScannerModal
                visible={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={handleScanPart}
            />
        </SafeAreaView>
    );
}

// --- Helper Components ---

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

function ActionIcon({ active, icon, label, onPress }: { active?: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
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
    const isError = type === 'error';
    const isSuccess = type === 'success';
    const IconComp = isError ? AlertCircle : isSuccess ? CheckCircle2 : Info;
    const iconColor = isSuccess ? '#059669' : isError ? '#E11D48' : '#2563EB';
    const container = isSuccess
        ? 'bg-emerald-50 border-emerald-100'
        : isError
            ? 'bg-rose-50 border-rose-100'
            : 'bg-blue-50 border-blue-100';
    const titleColor = isSuccess ? 'text-emerald-800' : isError ? 'text-rose-800' : 'text-blue-800';
    const messageColor = isSuccess ? 'text-emerald-700' : isError ? 'text-rose-700' : 'text-blue-700';

    return (
        <View className={`mx-5 mt-3 p-3 rounded-2xl border flex-row items-start ${container}`}>
            <IconComp size={18} color={iconColor} />
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

function QtyControl({ value, color, onMinus, onPlus, onChangeQty }: {
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
        <View className={`flex-row items-center self-start bg-white rounded-xl border ${borderColor} overflow-hidden`}>
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
