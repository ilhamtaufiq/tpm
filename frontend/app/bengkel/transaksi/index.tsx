import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Share, StatusBar, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Barcode as BarcodeIcon, Calendar, Car, Check, CheckCircle2, ChevronLeft, ClipboardList, Info, Package, Percent, Plus, Printer, Search, Share2, Truck, User, Wallet, Wrench, X } from 'lucide-react-native';

import { Typography } from '../../../components/ui/Typography';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { BarcodeScannerModal } from '../../../components/ui/BarcodeScannerModal';
import { MasterDataSelector } from '../../../components/ui/MasterDataSelector';
import { useCreateTransaksiBengkel, useSparePartsList, useTransaksiBengkelDetail, useTransaksiBengkelList, useUpdateTransaksiBengkel } from '../../../hooks/useBengkel';
import { useDebounce } from '../../../hooks';
import { useJasaList } from '../../../hooks/useJasaServis';
import { useActiveArmada } from '../../../hooks/useJasaAngkut';
import { useMobilList } from '../../../hooks/useMobil';
import { formatCurrency, formatNumber, parseNumber } from '../../../utils/format';
import { isBengkelTransactionLocked } from '../../../utils/bengkelTransaction';
import { getCustomTabBarHeight } from '../../../components/ui/CustomTabBar';
import { printReceipt, saveReceiptPDF, PrintReceiptData } from '../../../utils/printReceipt';
import { printSettingsService, PrintSettings } from '../../../utils/printSettings';
import { buildPublicReceiptUrl } from '../../../utils/publicReceiptUrl';
import api from '../../../utils/api';
import { useScanSound } from '../../../utils/sounds';

type BengkelKategori = 'umum' | 'jasa_angkut' | 'jual_beli_mobil';
type PaymentMode = 'TUNAI' | 'TRANSFER' | 'SPLIT';
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

export default function BengkelTransaksiScreen() {
    const insets = useSafeAreaInsets();
    const { action, mode, transactionId } = useLocalSearchParams<{ action?: string; mode?: string; transactionId?: string }>();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [partSearch, setPartSearch] = useState('');
    const [serviceSearch, setServiceSearch] = useState('');
    const [showPartSearch, setShowPartSearch] = useState(false);
    const [serviceSheetOpen, setServiceSheetOpen] = useState(false);
    const [partSheetOpen, setPartSheetOpen] = useState(false);
    const [existingSheetOpen, setExistingSheetOpen] = useState(false);
    const [existingSearch, setExistingSearch] = useState('');
    const [existingDate, setExistingDate] = useState(() => formatLocalDate(new Date()));
    const [tempExistingDate, setTempExistingDate] = useState(() => formatLocalDate(new Date()));
    const [existingDatePickerOpen, setExistingDatePickerOpen] = useState(false);
    const [existingDateError, setExistingDateError] = useState('');
    const [showDiscountInput, setShowDiscountInput] = useState(false);
    const [showDiscountInReceipt, setShowDiscountInReceipt] = useState(true);
    const [selectedParts, setSelectedParts] = useState<Record<number, { item: any; qty: number }>>({});
    const [selectedServices, setSelectedServices] = useState<Record<string, { item: any; qty: number }>>({});
    const [kategori, setKategori] = useState<BengkelKategori>('umum');
    const [customerSource, setCustomerSource] = useState<'antrian' | 'customer'>('antrian');
    const [selectedCustomerTransaction, setSelectedCustomerTransaction] = useState<any>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [guestName, setGuestName] = useState('');
    const [manualPlate, setManualPlate] = useState('');
    const [manualVehicleType, setManualVehicleType] = useState('');
    const [customerTransactionSearch, setCustomerTransactionSearch] = useState('');
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
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [submitWithPayment, setSubmitWithPayment] = useState(false);
    const [successWithPayment, setSuccessWithPayment] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [createdTransaction, setCreatedTransaction] = useState<any | null>(null);
    const [printSettings, setPrintSettings] = useState<PrintSettings | null>(null);
    const [printingReceipt, setPrintingReceipt] = useState(false);
    const [sharingReceipt, setSharingReceipt] = useState(false);
    const [receiptActionMessage, setReceiptActionMessage] = useState('');
    useEffect(() => {
        printSettingsService.getSettings()
            .then(setPrintSettings)
            .catch((error) => console.error('Failed to load print settings:', error));
    }, []);

    const debouncedPartSearch = useDebounce(partSearch, 300);
    const debouncedExistingSearch = useDebounce(existingSearch, 300);
    const debouncedCustomerTransactionSearch = useDebounce(customerTransactionSearch, 300);
    const PART_PAGE_SIZE = 40;
    const todayDate = useMemo(() => formatLocalDate(new Date()), []);
    const editTransactionId = transactionId ? Number(transactionId) : null;
    const selectedTransactionId = customerSource === 'antrian' && selectedCustomerTransaction?.id ? Number(selectedCustomerTransaction.id) : null;
    const transactionToUpdateId = editTransactionId || selectedTransactionId;

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
    const { data: mobilStatusData } = useMobilList({ limit: 200 }, {
        enabled: kategori === 'jual_beli_mobil' || Boolean(editTransactionId),
    });
    const { data: existingTransactionsData, isLoading: isExistingTransactionsLoading } = useTransaksiBengkelList({
        limit: 100,
        sort_by: 'tanggal',
        sort_order: 'desc',
        search: debouncedExistingSearch || undefined,
        tanggal_dari: existingDate,
        tanggal_sampai: existingDate,
    }, {
        enabled: existingSheetOpen,
    });
    const { data: openCustomerTransactionsData, isLoading: isOpenCustomerTransactionsLoading } = useTransaksiBengkelList({
        limit: 100,
        sort_by: 'tanggal',
        sort_order: 'desc',
    }, {
        enabled: step === 2 && kategori === 'umum' && !editTransactionId,
    });
    const createMutation = useCreateTransaksiBengkel();
    const updateMutation = useUpdateTransaksiBengkel();
    const { data: editingTransaction, isLoading: isEditingTransactionLoading } = useTransaksiBengkelDetail(editTransactionId);
    const {
        data: selectedOpenTransactionDetail,
        isLoading: isSelectedOpenTransactionLoading,
    } = useTransaksiBengkelDetail(selectedTransactionId, {
        enabled: !!selectedTransactionId && !editTransactionId,
    });
    const hydratedTransactionIdRef = useRef<number | null>(null);
    const paymentActionOpenedRef = useRef<number | null>(null);
    const lockedRedirectRef = useRef(false);
    const { playSuccess, playError } = useScanSound();
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
    const mobilStatusById = useMemo(() => {
        const rows = Array.isArray(mobilStatusData) ? mobilStatusData : (mobilStatusData?.data || []);
        return new Map(rows.map((m: any) => [String(m.id), String(m.status || '').toUpperCase()]));
    }, [mobilStatusData]);
    const activeMobilId = selectedMobil?.id || editingTransaction?.mobil_id || selectedOpenTransactionDetail?.mobil_id;
    const isSelectedMobilSold = useMemo(() => {
        if (!activeMobilId) return false;
        const directStatus = String(selectedMobil?.status || '').toUpperCase();
        if (directStatus === 'TERJUAL') return true;
        return mobilStatusById.get(String(activeMobilId)) === 'TERJUAL';
    }, [activeMobilId, selectedMobil?.status, mobilStatusById]);

    const selectedPartList = useMemo(() => Object.values(selectedParts), [selectedParts]);
    const selectedServiceList = useMemo(() => Object.values(selectedServices), [selectedServices]);
    const hasItems = selectedPartList.length > 0 || selectedServiceList.length > 0;
    const openBillPartList = useMemo(() => {
        if (!selectedOpenTransactionDetail) return [];
        return (selectedOpenTransactionDetail.detail_parts || []).map((detail: any) => {
            const partId = detail.spare_part_id || detail.spare_part?.id;
            return {
                item: {
                    ...(detail.spare_part || {}),
                    id: partId,
                    nama: detail.spare_part_nama || detail.spare_part?.nama || 'Sparepart',
                    harga_jual: Number(detail.harga_jual || detail.harga_satuan || detail.spare_part?.harga_jual || 0),
                    stok: detail.spare_part?.stok ?? 999,
                },
                qty: Number(detail.qty || 1),
            };
        }).filter((row: any) => row.item.id);
    }, [editTransactionId, selectedOpenTransactionDetail]);
    const openBillServiceList = useMemo(() => {
        if (editTransactionId || !selectedOpenTransactionDetail) return [];
        return (selectedOpenTransactionDetail.detail_services || []).map((detail: any) => ({
            item: {
                id: detail.jasa_id || detail.service_id || detail.id,
                nama: detail.nama_jasa || detail.nama || 'Servis',
                harga: Number(detail.harga || 0),
            },
            qty: Number(detail.qty || 1),
        }));
    }, [editTransactionId, selectedOpenTransactionDetail]);
    const billPartList = useMemo(() => {
        const rows = [...openBillPartList, ...selectedPartList];
        const merged = new Map<number, { item: any; qty: number }>();
        rows.forEach(row => {
            const partId = Number(row.item.id);
            if (!partId) return;
            const existing = merged.get(partId);
            merged.set(partId, existing ? { item: { ...existing.item, ...row.item }, qty: existing.qty + row.qty } : row);
        });
        return Array.from(merged.values());
    }, [openBillPartList, selectedPartList]);
    const billServiceList = useMemo(() => {
        const rows = [...openBillServiceList, ...selectedServiceList];
        const merged = new Map<string, { item: any; qty: number }>();
        rows.forEach(row => {
            const name = String(row.item.nama || '').trim().toLowerCase();
            const price = Number(row.item.harga || 0);
            const key = `${name}-${price}`;
            if (!name) return;
            const existing = merged.get(key);
            merged.set(key, existing ? { item: { ...existing.item, ...row.item }, qty: existing.qty + row.qty } : row);
        });
        return Array.from(merged.values());
    }, [openBillServiceList, selectedServiceList]);
    const grossSubtotal = useMemo(() => {
        const partTotal = billPartList.reduce((sum, row) => sum + (Number(row.item.harga_jual || 0) * row.qty), 0);
        const serviceTotal = billServiceList.reduce((sum, row) => sum + (Number(row.item.harga || 0) * row.qty), 0);
        return partTotal + serviceTotal;
    }, [billPartList, billServiceList]);
    const discountAmount = Math.min(parseNumber(discount), grossSubtotal);
    const subtotal = Math.max(0, grossSubtotal - discountAmount);
    const existingDp = editingTransaction?.jumlah_bayar || selectedOpenTransactionDetail?.jumlah_bayar || 0;
    const sisaBayar = Math.max(0, subtotal - existingDp);
    const paymentAmountValue = parseNumber(paymentAmount);
    const hasPaymentAmountInput = paymentAmount.trim().length > 0;
    const receivedAmount = hasPaymentAmountInput ? paymentAmountValue : sisaBayar;
    const changeAmount = paymentMode === 'TUNAI' || paymentMode === 'TRANSFER'
        ? Math.max(0, receivedAmount - sisaBayar)
        : 0;
    const paymentOutstandingAmount = paymentMode === 'TUNAI' || paymentMode === 'TRANSFER'
        ? Math.max(0, sisaBayar - receivedAmount)
        : 0;
    const splitTunaiAmount = parseNumber(splitTunai);
    const splitTransferAmount = parseNumber(splitTransfer);
    const splitTotal = splitTunaiAmount + splitTransferAmount;
    const totalPaidAfterPayment = useMemo(() => {
        if (kategori === 'jasa_angkut') return subtotal;
        if (kategori === 'jual_beli_mobil') return existingDp;
        if (paymentMode === 'SPLIT') return existingDp + splitTotal;
        return existingDp + receivedAmount;
    }, [kategori, subtotal, existingDp, paymentMode, splitTotal, receivedAmount]);
    const willBeLunas = subtotal > 0 && totalPaidAfterPayment >= subtotal;
    const isEditLocked = useMemo(
        () => isBengkelTransactionLocked(editingTransaction || selectedOpenTransactionDetail),
        [editingTransaction, selectedOpenTransactionDetail],
    );

    useEffect(() => {
    }, []);

    useEffect(() => {
        if (!isEditLocked || !transactionToUpdateId || lockedRedirectRef.current) return;
        if (!editingTransaction && !selectedOpenTransactionDetail) return;
        lockedRedirectRef.current = true;
        showNotice('info', 'Tidak Dapat Diedit', 'Transaksi sudah lunas dan selesai.');
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/bengkel/queue');
        }
    }, [isEditLocked, transactionToUpdateId, editingTransaction, selectedOpenTransactionDetail]);

    useEffect(() => {
        if (!editingTransaction || !editTransactionId || hydratedTransactionIdRef.current === editTransactionId) return;
        const existingServiceDetails = editingTransaction.detail_services || [];
        if (existingServiceDetails.length > 0 && services.length === 0) return;

        hydratedTransactionIdRef.current = editTransactionId;
        setKategori(editingTransaction.kategori || 'umum');
        setNote(editingTransaction.catatan || '');
        setDiscount(formatNumber(Number(editingTransaction.diskon || 0) || 0));
        setPaymentMode(editingTransaction.metode_bayar === 'TRANSFER' ? 'TRANSFER' : editingTransaction.metode_bayar === 'SPLIT' ? 'SPLIT' : 'TUNAI');
        setPaymentAmount(Number(editingTransaction.jumlah_bayar || 0) > 0 ? formatNumber(Number(editingTransaction.jumlah_bayar || 0)) : '');

        if (editingTransaction.customer_id) {
            setSelectedCustomerTransaction({
                id: editingTransaction.id,
                customer_id: editingTransaction.customer_id,
                customer_nama: editingTransaction.customer_nama || editingTransaction.nama_customer,
                nama_customer: editingTransaction.nama_customer || editingTransaction.customer_nama,
                nomor_plat: editingTransaction.nomor_plat,
                jenis_kendaraan: editingTransaction.jenis_kendaraan,
                status_pengerjaan: editingTransaction.status_pengerjaan,
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

    useEffect(() => {
        if (action !== 'payment' || !editTransactionId || !editingTransaction) return;
        if (paymentActionOpenedRef.current === editTransactionId) return;
        if (isEditingTransactionLoading || grossSubtotal <= 0) return;

        paymentActionOpenedRef.current = editTransactionId;
        setStep(3);
        setPaymentSheetOpen(true);
    }, [action, editTransactionId, editingTransaction, grossSubtotal, isEditingTransactionLoading]);

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
    const getEditablePaymentStatus = (item: any) => {
        const status = String(item.status_bayar || '').toUpperCase();
        const paidAmount = Number(item.jumlah_bayar || 0);

        if (status === 'LUNAS' || status === 'BATAL') return status;
        if (paidAmount > 0) return 'BELUM_LUNAS';
        return 'BELUM_BAYAR';
    };
    const getEditableWorkStatus = (item: any) => {
        const raw = String(item.status_pengerjaan || 'ANTRE').toUpperCase();
        if (raw.includes('PROSES')) return 'PROSES';
        if (raw.includes('SELESAI')) return 'SELESAI';
        if (raw.includes('BATAL')) return 'BATAL';
        return 'ANTRE';
    };
    const existingTransactions = useMemo(() => {
        const rows = existingTransactionsData?.data || [];
        return rows.filter((item: any) => {
            if (editTransactionId && Number(item.id) === editTransactionId) return false;
            const workStatus = getEditableWorkStatus(item);
            const paymentStatus = getEditablePaymentStatus(item);
            const canEditWorkStatus = workStatus === 'PROSES';
            const canEditPaymentStatus = paymentStatus === 'BELUM_BAYAR' || paymentStatus === 'BELUM_LUNAS';
            return canEditWorkStatus && canEditPaymentStatus;
        });
    }, [editTransactionId, existingTransactionsData]);
    const openCustomerTransactions = useMemo(() => {
        const rows = openCustomerTransactionsData?.data || [];
        const query = debouncedCustomerTransactionSearch.trim().toLowerCase();
        return rows.filter((item: any) => {
            const workStatus = getEditableWorkStatus(item);
            const isGeneralCustomer = String(item.kategori || 'umum').toLowerCase() === 'umum';
            if (!(isGeneralCustomer && (workStatus === 'PROSES'))) return false;
            if (!query) return true;
            return [
                item.customer_nama,
                item.nama_customer,
                item.nomor_transaksi,
                item.nomor_plat,
            ].some((value) => String(value || '').toLowerCase().includes(query));
        });
    }, [debouncedCustomerTransactionSearch, openCustomerTransactionsData]);

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
            const key = String(service.id);
            if (next[key]) delete next[key];
            else next[key] = { item: service, qty: 1 };
            return next;
        });
    };

    const setServiceQty = (serviceId: number, qty: number) => {
        const key = String(serviceId);
        setSelectedServices(prev => prev[key] ? { ...prev, [key]: { ...prev[key], qty: Math.max(1, qty) } } : prev);
    };

    const setServicePrice = (serviceId: number, priceStr: string, fallbackItem?: any) => {
        const key = String(serviceId);
        setSelectedServices(prev => {
            const existing = prev[key];
            if (existing) {
                return {
                    ...prev,
                    [key]: {
                        ...existing,
                        item: { ...existing.item, harga: parseNumber(priceStr) }
                    }
                };
            }
            if (!fallbackItem) return prev;
            return {
                ...prev,
                [key]: {
                    item: { ...fallbackItem, harga: parseNumber(priceStr) },
                    qty: 1
                }
            };
        });
    };

    const addScannedPart = (part: any): boolean => {
        if (part.stok !== 999 && Number(part.stok || 0) <= 0) {
            showNotice('error', 'Stok Habis', `${part.nama} tidak bisa dipilih karena stok kosong.`);
            return false;
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
        return true;
    };

    const handleScan = async (scannedData: string) => {
        const clean = scannedData.trim();
        let part = parts.find((p: any) => p.kode === clean || p.kode_part === clean);
        if (!part) {
            const stripped = clean.replace(/^0+/, '');
            part = parts.find((p: any) =>
                (p.kode || '').replace(/^0+/, '') === stripped ||
                (p.kode_part || '').replace(/^0+/, '') === stripped
            );
        }
        if (part) return addScannedPart(part);
        else {
            // Fallback: query API directly (bypass pagination) — match by kode/kode_part
            try {
                const res = await api.get('/spare-parts', { params: { limit: 5, search: clean } });
                const rows = res.data?.data;
                if (Array.isArray(rows) && rows.length) {
                    const found = rows.find((p: any) =>
                        p.kode === clean || p.kode_part === clean ||
                        (p.kode || '').replace(/^0+/, '') === clean.replace(/^0+/, '') ||
                        (p.kode_part || '').replace(/^0+/, '') === clean.replace(/^0+/, '')
                    ) || rows[0];
                    return addScannedPart(found);
                }
            } catch {}
            showNotice('error', 'Tidak Ditemukan', `Kode "${scannedData}" tidak terdaftar di data sparepart.`);
            setScanLog(prev => [{ id: Math.random().toString(), title: 'Tidak ditemukan', subtitle: `Kode: ${scannedData}`, timestamp: Date.now() }, ...prev]);
            return false;
        }
    };

    const handleSelectExistingTransaction = (item: any) => {
        setExistingSheetOpen(false);
        router.push({
            pathname: '/bengkel/transaksi',
            params: {
                transactionId: String(item.id),
                mode: transaksiMode === 'sparepart' || transaksiMode === 'servis' ? transaksiMode : 'all',
            },
        } as any);
    };

    const openExistingDatePicker = () => {
        setTempExistingDate(existingDate);
        setExistingDateError('');
        setExistingDatePickerOpen(true);
    };

    const applyExistingDate = () => {
        if (!isValidDateString(tempExistingDate)) {
            setExistingDateError('Format tanggal tidak valid. Gunakan YYYY-MM-DD.');
            return;
        }

        setExistingDate(tempExistingDate);
        setExistingDatePickerOpen(false);
        setExistingDateError('');
    };

    const selectTodayExistingDate = () => {
        setTempExistingDate(todayDate);
        setExistingDate(todayDate);
        setExistingDatePickerOpen(false);
        setExistingDateError('');
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
            if (kategori === 'umum' && customerSource === 'antrian' && !(selectedCustomerTransaction || editingTransaction?.nama_customer || editingTransaction?.customer_nama)) {
                showNotice('error', 'Validasi', 'Pilih transaksi customer yang masih proses.');
                return;
            }
            if (kategori === 'umum' && customerSource === 'customer' && !(selectedCustomer || guestName.trim())) {
                showNotice('error', 'Validasi', 'Pilih customer atau isi nama guest.');
                return;
            }
            if (kategori === 'umum' && customerSource === 'customer' && guestName.trim() && !manualPlate.trim()) {
                showNotice('error', 'Validasi', 'Nomor plat harus diisi untuk guest.');
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

    const confirmSubmit = (withPayment = false) => {
        if (isEditLocked) {
            showNotice('info', 'Tidak Dapat Diedit', 'Transaksi sudah lunas dan selesai.');
            return;
        }
        const isJA = kategori === 'jasa_angkut';
        const isMobil = kategori === 'jual_beli_mobil';
        if (withPayment && !isJA && !isMobil && paymentMode === 'SPLIT' && splitTotal !== sisaBayar) {
            showNotice('error', 'Validasi', 'Total split payment harus sama dengan sisa bayar.');
            return;
        }
        setSubmitWithPayment(withPayment);
        setNotice(null);
        setConfirmSubmitOpen(true);
    };

    const openPaymentSheet = () => {
        setPaymentSheetOpen(true);
    };

    const handlePrintCreatedReceipt = async () => {
        if (!createdTransaction) return;
        try {
            setPrintingReceipt(true);
            setReceiptActionMessage('');
            const settings = await printSettingsService.getSettings();
            setPrintSettings(settings);
            await printReceipt(buildReceiptData(createdTransaction), settings);
            setReceiptActionMessage('Struk berhasil dicetak.');
        } catch (error: any) {
            setReceiptActionMessage(error?.message || 'Gagal mencetak struk.');
        } finally {
            setPrintingReceipt(false);
        }
    };

    const handleShareCreatedReceipt = async () => {
        if (!createdTransaction) return;
        try {
            setSharingReceipt(true);
            setReceiptActionMessage('');
            const settings = await printSettingsService.getSettings();
            setPrintSettings(settings);
            await saveReceiptPDF(buildReceiptData(createdTransaction), settings);
            setReceiptActionMessage('Struk siap dibagikan / disimpan.');
        } catch (error: any) {
            const token = createdTransaction?.public_receipt_token;
            if (token) {
                const shareUrl = buildPublicReceiptUrl('bengkel', token);
                if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Struk Tiga Putra Motor',
                            text: `Struk transaksi ${createdTransaction?.nomor_transaksi || ''}`,
                            url: shareUrl,
                        });
                        setReceiptActionMessage('Link struk berhasil dibagikan.');
                        return;
                    } catch {
                        // fall through to clipboard/message fallback
                    }
                }
                if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(shareUrl);
                    setReceiptActionMessage('Link struk disalin ke clipboard.');
                    return;
                }
                await Share.share({ message: shareUrl, url: shareUrl, title: 'Bagikan Struk' });
                setReceiptActionMessage('Link struk berhasil dibagikan.');
                return;
            }
            setReceiptActionMessage(error?.message || 'Gagal membagikan struk.');
        } finally {
            setSharingReceipt(false);
        }
    };

    const buildReceiptData = (transaction: any): PrintReceiptData => ({
        type: 'bengkel',
        transactionNumber: transaction?.nomor_transaksi || transaction?.id?.toString() || '-',
        publicReceiptToken: transaction?.public_receipt_token,
        antrian: transaction?.nomor_antrian || '-',
        date: new Date(transaction?.created_at || new Date()),
        customerName: transaction?.customer_nama || transaction?.nama_customer || selectedCustomerTransaction?.customer_nama || selectedCustomerTransaction?.nama_customer || '-',
        cashierName: transaction?.kasir_nama || '-',
        mechanicName: transaction?.mekanik_nama || '-',
        status: transaction?.status_bayar || 'LUNAS',
        vehiclePlate: transaction?.nomor_plat || '-',
        vehicleType: transaction?.jenis_kendaraan || '-',
        services: billServiceList.map(row => ({
            description: row.item.nama,
            quantity: row.qty,
            unitPrice: Number(row.item.harga || 0),
            subtotal: Number(row.item.harga || 0) * row.qty,
        })),
        parts: billPartList.map(row => ({
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
        showDiscount: showDiscountInReceipt,
    });

    const submit = async () => {
        const isJA = kategori === 'jasa_angkut';
        const isMobil = kategori === 'jual_beli_mobil';
        const shouldPay = submitWithPayment;
        if (selectedTransactionId && !editTransactionId && isSelectedOpenTransactionLoading) {
            showNotice('info', 'Memuat Open Bill', 'Detail transaksi lama sedang dimuat. Coba lagi sebentar.');
            return;
        }
        const customerName = isJA
            ? `Armada ${selectedArmada?.nama || selectedArmada?.nopol || ''}`.trim()
            : isMobil
                ? 'TPM (Internal)'
                : customerSource === 'customer'
                    ? (selectedCustomer?.nama || guestName.trim() || 'Guest')
                    : (selectedCustomerTransaction?.customer_nama || selectedCustomerTransaction?.nama_customer || editingTransaction?.nama_customer || editingTransaction?.customer_nama || 'Guest');
        const nomorPlat = isJA
            ? (selectedArmada?.nopol || editingTransaction?.nomor_plat || '-')
            : isMobil
                ? (selectedMobil?.nomor_plat || editingTransaction?.nomor_plat || '-')
                : customerSource === 'customer'
                    ? (guestName.trim() ? manualPlate : '-')
                    : (selectedCustomerTransaction?.nomor_plat || editingTransaction?.nomor_plat || '-');
        const jenisKendaraan = isJA
            ? 'Armada Jasa Angkut'
            : isMobil
                ? `${selectedMobil?.merek || ''} ${selectedMobil?.model || ''}`.trim() || editingTransaction?.jenis_kendaraan || 'Mobil'
                : customerSource === 'customer'
                    ? (guestName.trim() ? (manualVehicleType || 'Umum') : 'Umum')
                    : (selectedCustomerTransaction?.jenis_kendaraan || editingTransaction?.jenis_kendaraan || 'Umum');

        try {
            const payload = {
                customer_id: kategori === 'umum'
                    ? (customerSource === 'customer'
                        ? (selectedCustomer?.id || null)
                        : (selectedCustomerTransaction?.customer_id || editingTransaction?.customer_id || null))
                    : null,
                nama_customer: customerName,
                nomor_plat: String(nomorPlat).substring(0, 15),
                jenis_kendaraan: String(jenisKendaraan).substring(0, 50),
                kategori,
                armada_id: isJA ? selectedArmada?.id : null,
                mobil_id: isMobil ? (selectedMobil?.id || editingTransaction?.mobil_id || selectedOpenTransactionDetail?.mobil_id) : null,
                detail_parts: billPartList.map(row => ({ spare_part_id: row.item.id, qty: row.qty, harga_jual: Number(row.item.harga_jual || 0) })),
                detail_services: billServiceList.map(row => ({ nama_jasa: row.item.nama, harga: Number(row.item.harga || 0), qty: row.qty })),
                diskon: discountAmount,
                // Jual beli mobil: PROSES selama unit belum TERJUAL; SELESAI otomatis saat unit terjual.
                // Kategori lain: SELESAI hanya ketika pembayaran lunas.
                status_pengerjaan: isMobil
                    ? (isSelectedMobilSold ? 'SELESAI' : 'PROSES')
                    : (shouldPay && willBeLunas ? 'SELESAI' : undefined),
                metode_bayar: shouldPay
                    ? (isJA ? 'INTERNAL' : isMobil ? 'KREDIT' : paymentMode)
                    : (editingTransaction?.metode_bayar || selectedOpenTransactionDetail?.metode_bayar || 'KREDIT'),
                jumlah_bayar: shouldPay
                    ? (isJA ? subtotal : (isMobil ? 0 : paymentMode === 'SPLIT' ? splitTunaiAmount + splitTransferAmount + existingDp : receivedAmount + existingDp))
                    : existingDp, // Preserve existing DP when updating without payment
                payments: !shouldPay
                    ? []
                    : isJA
                    ? [{ metode: 'INTERNAL', jumlah: subtotal }]
                    : isMobil
                        ? []
                        : paymentMode === 'SPLIT'
                            ? [
                                ...(existingDp > 0 ? [{ metode: 'TUNAI', jumlah: existingDp }] : []),
                                ...(splitTunaiAmount > 0 ? [{ metode: 'TUNAI', jumlah: splitTunaiAmount }] : []),
                                ...(splitTransferAmount > 0 ? [{ metode: 'TRANSFER', jumlah: splitTransferAmount }] : []),
                            ]
                            : [
                                ...(existingDp > 0 ? [{ metode: 'TUNAI', jumlah: existingDp }] : []),
                                ...(receivedAmount > 0 ? [{ metode: paymentMode, jumlah: receivedAmount }] : []),
                            ],
                catatan: note || selectedOpenTransactionDetail?.catatan || editingTransaction?.catatan || '',
            };
            const transaction = transactionToUpdateId
                ? await updateMutation.mutateAsync({ id: transactionToUpdateId, data: payload })
                : await createMutation.mutateAsync(payload);
            setCreatedTransaction(transaction);
            setReceiptActionMessage('');
            setConfirmSubmitOpen(false);
            setPaymentSheetOpen(false);
            setSuccessWithPayment(shouldPay);
            setSuccessModalOpen(true);
        } catch {
            setConfirmSubmitOpen(false);
            showNotice('error', 'Error', transactionToUpdateId ? 'Gagal memperbarui transaksi bengkel.' : 'Gagal membuat transaksi bengkel.');
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
                            active={!!editTransactionId}
                            icon={<ClipboardList size={20} color={editTransactionId ? 'white' : '#023C69'} />}
                            label="Open Trx"
                            onPress={() => setExistingSheetOpen(true)}
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
                                onChangeText={(value) => setDiscount(formatNumber(value))}
                                keyboardType="number-pad"
                                inputMode="numeric"
                                className="bg-gray-100 rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-200"
                            />
                        </View>
                    )}
                </View>
            )}

            {notice && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999 }}>
                    <NoticeBanner type={notice.type} title={notice.title} message={notice.message} onClose={() => setNotice(null)} />
                </View>
            )}

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: tabBarHeight + 140 }}
                onScroll={handlePartsScroll}
                scrollEventThrottle={16}
            >
                {step === 1 && (
                    <View className="space-y-6">
                        {showParts && editTransactionId && selectedPartList.length > 0 && (
                        <View>
                            <View className="flex-row items-center justify-between mb-3">
                                <Typography variant="body1" weight="bold" className="text-textMain">Sparepart Transaksi Ini</Typography>
                                <Typography className="text-gray-400 text-xs font-bold">{selectedPartList.length} item</Typography>
                            </View>
                            {selectedPartList.map(row => (
                                <View key={`editing-selected-part-${row.item.id}`} className="mb-3 p-3 rounded-2xl border bg-blue-50 border-blue-100">
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
                                const selected = selectedServices[String(service.id)];
                                return (
                                    <View key={`service-${service.id}`} className={`mb-3 p-3 rounded-2xl border ${selected ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-100'}`}>
                                        <View className="flex-row items-start">
                                            <Pressable onPress={() => toggleService(service)} className={`w-7 h-7 rounded-lg border items-center justify-center mr-3 ${selected ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300'}`}>
                                                {selected && <Check size={16} color="white" />}
                                            </Pressable>
                                            <View className="flex-1">
                                                <View className="flex-row items-center">
                                                    <Wrench size={18} color={selected ? '#059669' : '#94A3B8'} />
                                                    <Typography weight="bold" className="text-sm text-textMain ml-2 flex-1" numberOfLines={1}>{service.nama}</Typography>
                                                </View>
                                                <Typography className="text-gray-400 text-[11px] mt-1">{service.kategori || 'Servis'}</Typography>
                                                {selected ? (
                                                    <View className="flex-row items-center bg-white rounded-lg px-2 py-1 border border-emerald-100 self-start mt-1">
                                                        <Typography className="text-emerald-700 text-xs font-bold mr-1">Rp</Typography>
                                                        <TextInput
                                                            value={formatNumber(Number(selected.item.harga ?? service.harga ?? 0))}
                                                            onChangeText={(val) => setServicePrice(service.id, val)}
                                                            keyboardType="number-pad"
                                                            className="text-emerald-700 text-xs font-bold min-w-[80px] p-0"
                                                        />
                                                    </View>
                                                ) : (
                                                    <Typography className="text-emerald-700 text-xs font-bold mt-1">{formatCurrency(service.harga || 0)}</Typography>
                                                )}
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
                                    </View>
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

                        {!showServiceCatalog && (selectedServiceList.length > 0 || openBillServiceList.length > 0) && (
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
                                        <View className="flex-1 ml-2 mr-2">
                                            <Typography weight="bold" className="text-sm text-textMain" numberOfLines={1}>{row.item.nama}</Typography>
                                            <Typography className="text-gray-500 text-[11px] mt-1 mb-2">{row.item.kategori || 'Servis'}</Typography>
                                            <View className="flex-row items-center bg-white rounded-lg px-2 py-1 border border-emerald-100 self-start">
                                                <Typography className="text-emerald-700 text-xs font-bold mr-1">Rp</Typography>
                                                <TextInput
                                                    value={formatNumber(Number(row.item.harga ?? 0))}
                                                    onChangeText={(val) => setServicePrice(row.item.id, val)}
                                                    keyboardType="number-pad"
                                                    className="text-emerald-700 text-xs font-bold min-w-[80px] p-0"
                                                />
                                            </View>
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
                            {openBillServiceList.filter((obs: any) => !selectedServices[String(obs.item.id)]).map((row: any) => (
                                <View key={`open-service-${row.item.id}`} className="mb-3 p-3 rounded-2xl border bg-amber-50 border-amber-100">
                                    <View className="flex-row items-start">
                                        <Wrench size={18} color="#D97706" />
                                        <View className="flex-1 ml-2 mr-2">
                                            <Typography weight="bold" className="text-sm text-textMain" numberOfLines={1}>{row.item.nama}</Typography>
                                            <Typography className="text-gray-500 text-[11px] mt-1 mb-2">{row.item.kategori || 'Servis'} (dari transaksi)</Typography>
                                            <View className="flex-row items-center bg-white rounded-lg px-2 py-1 border border-amber-100 self-start">
                                                <Typography className="text-amber-700 text-xs font-bold mr-1">Rp</Typography>
                                                <TextInput
                                                    value={formatNumber(Number(row.item.harga ?? 0))}
                                                    onChangeText={(val) => setServicePrice(row.item.id, val, row.item)}
                                                    keyboardType="number-pad"
                                                    className="text-amber-700 text-xs font-bold min-w-[80px] p-0"
                                                />
                                            </View>
                                        </View>
                                    </View>
                                    <QtyControl
                                        value={selectedServices[String(row.item.id)]?.qty || row.qty}
                                        color={"amber" as "blue" | "emerald"}
                                        onMinus={() => setServiceQty(row.item.id, (selectedServices[String(row.item.id)]?.qty || row.qty) - 1)}
                                        onPlus={() => setServiceQty(row.item.id, (selectedServices[String(row.item.id)]?.qty || row.qty) + 1)}
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
                                    <Pressable key={cat.id} onPress={() => { setKategori(cat.id as BengkelKategori); setSelectedCustomerTransaction(null); setSelectedArmada(null); setSelectedMobil(null); }} className="items-center flex-1">
                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center border ${active ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-100'}`}>
                                            <Icon size={20} color={active ? 'white' : '#64748B'} />
                                        </View>
                                        <Typography className={`text-[10px] font-bold mt-1 text-center ${active ? 'text-primary' : 'text-gray-500'}`}>{cat.label}</Typography>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {kategori === 'umum' && (
                            <View>
                                <View className="flex-row bg-gray-100 rounded-2xl p-1 mb-4">
                                    {[
                                        { id: 'antrian', label: 'Antrian' },
                                        { id: 'customer', label: 'Customer Baru' },
                                    ].map(source => {
                                        const active = customerSource === source.id;
                                        return (
                                            <Pressable
                                                key={source.id}
                                                onPress={() => {
                                                    setCustomerSource(source.id as 'antrian' | 'customer');
                                                    setSelectedCustomerTransaction(null);
                                                    setSelectedCustomer(null);
                                                    setGuestName('');
                                                }}
                                                className={`flex-1 py-3 rounded-xl items-center ${active ? 'bg-primary' : 'bg-transparent'}`}
                                            >
                                                <Typography weight="bold" className={`text-xs ${active ? 'text-white' : 'text-gray-500'}`}>{source.label}</Typography>
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {customerSource === 'antrian' ? (
                                    <>
                                <SearchBox
                                    value={customerTransactionSearch}
                                    onChange={setCustomerTransactionSearch}
                                    placeholder="Cari customer, nomor transaksi, atau plat..."
                                />
                                {isOpenCustomerTransactionsLoading ? (
                                    <ActivityIndicator color="#023C69" />
                                ) : openCustomerTransactions.length === 0 ? (
                                    <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                                        <Typography className="text-gray-500 text-sm text-center">Tidak ada transaksi customer dengan status proses.</Typography>
                                    </View>
                                ) : openCustomerTransactions.map((item: any) => {
                                    const active = selectedCustomerTransaction?.id === item.id;
                                    const workStatus = getEditableWorkStatus(item);
                                    const statusClass = workStatus === 'PROSES'
                                        ? 'bg-blue-50 border-blue-100'
                                        : 'bg-amber-50 border-amber-100';
                                    const statusTextClass = workStatus === 'PROSES'
                                        ? 'text-blue-700'
                                        : 'text-amber-700';

                                    return (
                                        <Pressable key={item.id} onPress={() => setSelectedCustomerTransaction(item)} className={`p-4 rounded-2xl border mb-3 ${active ? 'bg-primary/5 border-primary/20' : 'bg-white border-gray-100'}`}>
                                            <View className="flex-row items-start">
                                                <View className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${active ? 'bg-primary' : 'bg-gray-100'}`}>
                                                    <User size={18} color={active ? 'white' : '#64748B'} />
                                                </View>
                                                <View className="flex-1">
                                                    <View className="flex-row items-center justify-between">
                                                        <Typography weight="bold" className="text-textMain flex-1 mr-2" numberOfLines={1}>
                                                            {item.customer_nama || item.nama_customer || 'Guest'}
                                                        </Typography>
                                                        <View className={`px-2 py-1 rounded-full border ${statusClass}`}>
                                                            <Typography className={`text-[10px] font-bold ${statusTextClass}`}>{workStatus}</Typography>
                                                        </View>
                                                    </View>
                                                    <Typography className="text-gray-400 text-xs mt-1" numberOfLines={1}>
                                                        {item.nomor_transaksi || `#${item.id}`} • {item.nomor_plat || '-'}
                                                    </Typography>
                                                    <Typography className="text-primary text-xs font-bold mt-2">
                                                        {formatCurrency(item.total_biaya || item.total_bayar || 0)}
                                                    </Typography>
                                                </View>
                                                {active ? <CheckCircle2 size={20} color="#023C69" /> : null}
                                            </View>
                                        </Pressable>
                                    );
                                })}
                                    </>
                                ) : (
                                    <View>
                                        <MasterDataSelector
                                            type="customer"
                                            value={selectedCustomer}
                                            onSelect={(customer) => {
                                                setSelectedCustomer(customer);
                                                if (customer) {
                                                    setGuestName('');
                                                    setManualPlate('');
                                                    setManualVehicleType('');
                                                }
                                            }}
                                            allowGuest
                                            placeholder="Pilih Customer atau ketik guest"
                                            inlineMode
                                            inlineLimit={10}
                                            hideTrigger
                                            onGuestNameChange={(name) => {
                                                setGuestName(name);
                                                setSelectedCustomer(null);
                                            }}
                                        />
                                        {guestName.trim().length > 0 && !selectedCustomer ? (
                                            <View className="flex-row space-x-3">
                                                <TextInput
                                                    value={manualPlate}
                                                    onChangeText={(value) => setManualPlate(value.toUpperCase())}
                                                    placeholder="Nomor plat guest"
                                                    placeholderTextColor="#94A3B8"
                                                    autoCapitalize="characters"
                                                    className="flex-1 bg-gray-100 rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-200"
                                                />
                                                <TextInput
                                                    value={manualVehicleType}
                                                    onChangeText={setManualVehicleType}
                                                    placeholder="Jenis unit"
                                                    placeholderTextColor="#94A3B8"
                                                    className="flex-1 bg-gray-100 rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-200"
                                                />
                                            </View>
                                        ) : null}
                                    </View>
                                )}
                            </View>
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
                        <Typography variant="body1" weight="bold" className="text-textMain mb-4">Review Transaksi</Typography>
                        <View className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-5">
                            {/* Total Part */}
                            <Typography weight="bold" className="text-textMain text-sm mb-2">- Total part</Typography>
                            {billPartList.map(row => (
                                <View key={`review-part-${row.item.id}`} className="flex-row justify-between items-center pl-4 mb-1">
                                    <Typography className="text-textGray text-sm flex-1" numberOfLines={1}>{row.item.nama}</Typography>
                                    <Typography className="text-textMain text-sm ml-2">{formatCurrency(Number(row.item.harga_jual || 0) * row.qty)}</Typography>
                                </View>
                            ))}
                            {billPartList.length === 0 && (
                                <Typography className="text-gray-400 text-xs pl-4 mb-1">Tidak ada part</Typography>
                            )}
                            <View className="h-[1px] bg-slate-300 my-2 ml-4" />
                            <View className="flex-row justify-end pr-0 mb-4">
                                <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(billPartList.reduce((sum, row) => sum + (Number(row.item.harga_jual || 0) * row.qty), 0))}</Typography>
                            </View>

                            {/* Total Service */}
                            <Typography weight="bold" className="text-textMain text-sm mb-2">- Total service</Typography>
                            {billServiceList.map((row, index) => (
                                <View key={`review-service-${row.item.id}-${index}`} className="flex-row justify-between items-center pl-4 mb-1">
                                    <Typography className="text-textGray text-sm flex-1" numberOfLines={1}>{row.item.nama}</Typography>
                                    <Typography className="text-textMain text-sm ml-2">{formatCurrency(Number(row.item.harga || 0) * row.qty)}</Typography>
                                </View>
                            ))}
                            {billServiceList.length === 0 && (
                                <Typography className="text-gray-400 text-xs pl-4 mb-1">Tidak ada service</Typography>
                            )}
                            <View className="h-[1px] bg-slate-300 my-2 ml-4" />
                            <View className="flex-row justify-end pr-0 mb-4">
                                <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(billServiceList.reduce((sum, row) => sum + (Number(row.item.harga || 0) * row.qty), 0))}</Typography>
                            </View>

                            {/* Grand Total */}
                            <View className="h-[2px] bg-slate-400 my-3" />
                            <View className="flex-row justify-between items-center mb-1">
                                <Typography weight="bold" className="text-textMain">- Total</Typography>
                                <Typography weight="bold" className="text-primary text-base">{formatCurrency(subtotal)}</Typography>
                            </View>
                            {discountAmount > 0 && (
                                <View className="flex-row justify-between items-center mb-1">
                                    <Typography className="text-rose-600 text-sm">  Diskon</Typography>
                                    <Typography className="text-rose-600 text-sm">-{formatCurrency(discountAmount)}</Typography>
                                </View>
                            )}
                            {existingDp > 0 && (
                                <>
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Typography className="text-emerald-700 text-sm">- DP Awal</Typography>
                                        <Typography className="text-emerald-700 text-sm">({formatCurrency(existingDp)})</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center">
                                        <Typography weight="bold" className="text-amber-700">- Sisa bayar</Typography>
                                        <Typography weight="bold" className="text-amber-700">{formatCurrency(sisaBayar)}</Typography>
                                    </View>
                                </>
                            )}
                        </View>

                        {existingDp > 0 ? (
                            <View className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl mb-5">
                                <View className="flex-row items-start">
                                    <CheckCircle2 size={18} color="#059669" className="mt-0.5" />
                                    <View className="ml-3 flex-1">
                                        <Typography weight="bold" className="text-emerald-800">DP {formatCurrency(existingDp)} sudah dibayar</Typography>
                                        <Typography className="text-emerald-700 text-xs mt-1">
                                            Sisa yang perlu dibayar: <Typography weight="bold">{formatCurrency(sisaBayar)}</Typography>
                                        </Typography>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-5">
                                <Typography weight="bold" className="text-blue-800">Pembayaran belum diproses</Typography>
                                <Typography className="text-blue-700 text-xs mt-1">
                                    Pilih Update Transaksi untuk menyimpan sparepart/servis saja, atau Lanjut Pembayaran untuk mengisi metode dan nominal bayar.
                                </Typography>
                            </View>
                        )}

                        <Input label="Catatan" placeholder="Catatan transaksi..." value={note} onChangeText={setNote} multiline />
                    </View>
                )}
            </ScrollView>

            <View className="absolute left-0 right-0 bg-white border-t border-gray-100 px-5 py-4" style={{ bottom: tabBarHeight }}>
                <View className="flex-row items-center justify-between mb-3">
                    <Typography className="text-gray-400 text-xs font-bold uppercase">{existingDp > 0 ? 'Sisa Bayar' : 'Total Transaksi'}</Typography>
                    <View className="items-end">
                        {existingDp > 0 && (
                            <Typography className="text-gray-400 text-[10px]">
                                Total: {formatCurrency(subtotal)} • DP: {formatCurrency(existingDp)}
                            </Typography>
                        )}
                        <Typography weight="bold" className="text-primary text-lg">
                            {existingDp > 0 ? formatCurrency(sisaBayar) : formatCurrency(subtotal)}
                        </Typography>
                    </View>
                </View>
                <View className="flex-row space-x-3">
                    {step > 1 && <Button title="Kembali" variant="outline" className="flex-1" onPress={() => setStep(prev => Math.max(1, prev - 1) as 1 | 2 | 3)} />}
                    {step === 3 ? (
                        isEditLocked ? (
                            <Typography className="flex-1 text-center text-gray-500 text-xs py-3">
                                Transaksi sudah lunas dan selesai. Tidak dapat diedit.
                            </Typography>
                        ) : (
                        <>
                            <Button
                                title={transactionToUpdateId ? 'Update Transaksi' : 'Simpan Transaksi'}
                                variant="secondary"
                                className="flex-1"
                                onPress={() => confirmSubmit(false)}
                                loading={createMutation.isPending || updateMutation.isPending}
                            />
                            <Button
                                title="Lanjut Pembayaran"
                                className="flex-1"
                                onPress={openPaymentSheet}
                                icon={<Wallet size={16} color="white" />}
                            />
                        </>
                        )
                    ) : (
                        <Button
                            title="Lanjut"
                            className="flex-1"
                            onPress={next}
                            loading={createMutation.isPending || updateMutation.isPending}
                        />
                    )}
                </View>
            </View>

            <BarcodeScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} scanLog={scanLog} continuous />
            <Modal visible={paymentSheetOpen} transparent animationType="slide" onRequestClose={() => setPaymentSheetOpen(false)}>
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(15, 23, 42, 0.38)' }}>
                    <Pressable className="absolute inset-0" onPress={() => setPaymentSheetOpen(false)} />
                    <View className="bg-white rounded-t-[32px] px-5 pt-4" style={{ maxHeight: '82%', paddingBottom: insets.bottom + 20 }}>
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-5" />
                        <View className="flex-row items-center justify-between mb-4">
                            <View>
                                <Typography variant="h3" weight="bold">Pembayaran</Typography>
                                <Typography className="text-gray-400 text-xs mt-0.5">Total {formatCurrency(subtotal)}</Typography>
                            </View>
                            <Pressable onPress={() => setPaymentSheetOpen(false)} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                                <X size={18} color="#475569" />
                            </Pressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                            <View className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
                                <SummaryRow label="Subtotal" value={formatCurrency(grossSubtotal)} />
                                <View className="mt-2">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Typography className="text-gray-500 text-[10px] font-bold uppercase">Diskon</Typography>
                                        {discountAmount > 0 ? (
                                            <Pressable onPress={() => setDiscount('')}>
                                                <Typography className="text-rose-500 text-[10px] font-bold">HAPUS</Typography>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                    <TextInput
                                        value={discount}
                                        onChangeText={(value) => setDiscount(formatNumber(value))}
                                        placeholder="0"
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="number-pad"
                                        inputMode="numeric"
                                        className="bg-white rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-100"
                                    />
                                    <Pressable
                                        onPress={() => setShowDiscountInReceipt(prev => !prev)}
                                        className="flex-row items-center mt-3"
                                    >
                                        <View className={`w-5 h-5 rounded border-2 items-center justify-center mr-2 ${showDiscountInReceipt ? 'bg-primary border-primary' : 'border-gray-300 bg-white'}`}>
                                            {showDiscountInReceipt && <CheckCircle2 size={14} color="white" />}
                                        </View>
                                        <Typography className="text-gray-600 text-xs">
                                            Tampilkan diskon di struk
                                        </Typography>
                                    </Pressable>
                                </View>
                                <View className="h-[1px] bg-slate-200 my-3" />
                                <SummaryRow label="Total Setelah Diskon" value={formatCurrency(subtotal)} />
                                {existingDp > 0 && (
                                    <>
                                        <SummaryRow label="DP Sudah Dibayar" value={`-${formatCurrency(existingDp)}`} muted />
                                        <View className="h-[1px] bg-slate-200 my-3" />
                                        <View className="flex-row justify-between items-center">
                                            <Typography weight="bold" className="text-amber-700">Sisa Bayar</Typography>
                                            <Typography variant="h3" weight="bold" className="text-amber-700">{formatCurrency(sisaBayar)}</Typography>
                                        </View>
                                    </>
                                )}
                            </View>

                            {kategori === 'umum' ? (
                                <View>
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
                                                        onChangeText={(value) => setSplitTunai(formatNumber(value))}
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
                                                        onChangeText={(value) => setSplitTransfer(formatNumber(value))}
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
                                            <View className="flex-row items-center justify-between mb-1">
                                                <Typography className="text-gray-500 text-[10px] font-bold uppercase">Nominal Bayar</Typography>
                                                <Pressable onPress={() => setPaymentAmount(formatNumber(sisaBayar))}>
                                                    <Typography className="text-primary text-[10px] font-bold">BAYAR PAS</Typography>
                                                </Pressable>
                                            </View>
                                            <TextInput
                                                value={paymentAmount}
                                                onChangeText={(value) => setPaymentAmount(formatNumber(value))}
                                                placeholder={formatNumber(subtotal)}
                                                placeholderTextColor="#94A3B8"
                                                keyboardType="number-pad"
                                                inputMode="numeric"
                                                className="bg-white rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-100"
                                            />
                                            <View className="flex-row justify-between mt-3 pt-3 border-t border-slate-200">
                                                <Typography className="text-gray-500 text-xs font-bold">Diterima</Typography>
                                                <Typography weight="bold" className={receivedAmount >= sisaBayar ? 'text-emerald-600' : 'text-rose-500'}>
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
                                <View className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                                    <Typography weight="bold" className="text-amber-800">{kategori === 'jasa_angkut' ? 'Internal Jasa Angkut' : 'Internal Jual Beli Mobil'}</Typography>
                                    <Typography className="text-amber-700 text-xs mt-1">{kategori === 'jasa_angkut' ? 'Dicatat sebagai hutang internal JA → Bengkel. Dompet unit tidak dipotong; biaya masuk laporan trip/armada.' : 'Dicatat sebagai hutang internal Mobil → Bengkel. Dompet tidak dipotong; biaya masuk HPP mobil. Pelunasan buku saat mobil terjual.'}</Typography>
                                </View>
                            )}
                        </ScrollView>

                        <Button
                            title="Simpan & Proses Pembayaran"
                            onPress={() => confirmSubmit(true)}
                            loading={createMutation.isPending || updateMutation.isPending}
                        />
                    </View>
                </View>
            </Modal>
            <Modal visible={confirmSubmitOpen} transparent animationType="fade" onRequestClose={() => setConfirmSubmitOpen(false)}>
                <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
                    <View className="bg-white rounded-[28px] p-5 w-full max-w-sm">
                        <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center mb-4">
                            <Wallet size={22} color="#023C69" />
                        </View>
                        <Typography variant="h3" weight="bold" className="text-textMain">{transactionToUpdateId ? 'Update Transaksi?' : 'Simpan Transaksi?'}</Typography>
                        <Typography className="text-gray-500 text-sm mt-2">
                            {submitWithPayment
                                ? 'Pastikan detail sparepart, servis, customer, dan pembayaran sudah benar.'
                                : 'Transaksi akan disimpan tanpa memproses pembayaran.'}
                        </Typography>
                        <View className="bg-slate-50 rounded-2xl p-4 mt-4 border border-slate-100">
                            <SummaryRow label="Sparepart" value={`${billPartList.length} item`} />
                            <SummaryRow label="Servis" value={`${billServiceList.length} item`} />
                            <SummaryRow label="Metode" value={submitWithPayment ? (kategori === 'jasa_angkut' ? 'INTERNAL' : kategori === 'jual_beli_mobil' ? 'KREDIT' : paymentMode) : 'Belum diproses'} />
                            <View className="h-[1px] bg-slate-200 my-2" />
                            <SummaryRow label="Total" value={formatCurrency(subtotal)} />
                            {submitWithPayment && kategori === 'umum' && (paymentMode === 'TUNAI' || paymentMode === 'TRANSFER') && (
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
                            <Button title={transactionToUpdateId ? 'Update' : 'Simpan'} className="flex-1" onPress={submit} loading={createMutation.isPending || updateMutation.isPending} />
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
                        <Typography variant="h3" weight="bold" className="text-textMain text-center">
                            {successWithPayment ? 'Transaksi Berhasil' : 'Transaksi Berhasil Diupdate'}
                        </Typography>
                        <Typography className="text-gray-500 text-sm mt-2 text-center">
                            {successWithPayment
                                ? 'Transaksi dan pembayaran bengkel berhasil diproses.'
                                : 'Detail sparepart/servis berhasil ditambahkan ke transaksi.'}
                        </Typography>
                        {successWithPayment && receiptActionMessage ? (
                            <View className="w-full mt-4 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                                <Typography className="text-gray-600 text-xs text-center font-semibold">
                                    {receiptActionMessage}
                                </Typography>
                            </View>
                        ) : null}
                        {successWithPayment ? (
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
                        ) : null}
                        <Button
                            title="OK"
                            variant="outline"
                            className={`w-full ${successWithPayment ? 'mt-3' : 'mt-6'}`}
                            onPress={() => {
                                setSuccessModalOpen(false);
                                closeAfterSubmit();
                            }}
                        />
                    </View>
                </View>
            </Modal>

            <Modal visible={existingSheetOpen} transparent animationType="slide" onRequestClose={() => setExistingSheetOpen(false)}>
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(15, 23, 42, 0.38)' }}>
                    <Pressable className="absolute inset-0" onPress={() => setExistingSheetOpen(false)} />
                    <View className="bg-white rounded-t-[32px] px-5 pt-4" style={{ maxHeight: '78%', paddingBottom: insets.bottom + 20 }}>
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-5" />
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-1 mr-3">
                                <Typography variant="h3" weight="bold">Pilih Transaksi Existing</Typography>
                                <Typography className="text-gray-400 text-xs mt-0.5">Tambah atau kurangi sparepart dan servis dari transaksi lama.</Typography>
                            </View>
                            <Pressable onPress={() => setExistingSheetOpen(false)} className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                                <X size={18} color="#475569" />
                            </Pressable>
                        </View>
                        <SearchBox value={existingSearch} onChange={setExistingSearch} placeholder="Cari nomor, customer, atau plat..." />
                        <Pressable
                            onPress={openExistingDatePicker}
                            className="flex-row items-center justify-between mb-3 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3"
                        >
                            <View className="flex-row items-center flex-1">
                                <View className="w-9 h-9 rounded-2xl bg-white items-center justify-center border border-gray-100 mr-3">
                                    <Calendar size={16} color="#0F766E" />
                                </View>
                                <View className="flex-1">
                                    <Typography className="text-textGray text-[9px] font-bold uppercase tracking-widest">Tanggal Transaksi</Typography>
                                    <Typography weight="bold" className="text-textMain text-xs mt-0.5">{existingDate}</Typography>
                                </View>
                            </View>
                            <ChevronLeft size={18} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
                        </Pressable>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                            {isExistingTransactionsLoading ? (
                                <View className="py-8">
                                    <ActivityIndicator color="#023C69" />
                                </View>
                            ) : existingTransactions.length === 0 ? (
                                <View className="py-8 items-center">
                                    <ClipboardList size={34} color="#CBD5E1" />
                                    <Typography weight="bold" className="text-gray-500 mt-3">Transaksi tidak ditemukan</Typography>
                                    <Typography className="text-gray-400 text-xs mt-1 text-center">Coba cari nomor transaksi, nama customer, atau nomor plat lain.</Typography>
                                </View>
                            ) : existingTransactions.map((item: any) => {
                                const status = String(item.status_pengerjaan || '').toUpperCase();
                                const statusClass = status === 'SELESAI'
                                    ? 'bg-emerald-50 border-emerald-100'
                                    : status === 'PROSES'
                                        ? 'bg-blue-50 border-blue-100'
                                        : 'bg-amber-50 border-amber-100';
                                const statusTextClass = status === 'SELESAI'
                                    ? 'text-emerald-700'
                                    : status === 'PROSES'
                                        ? 'text-blue-700'
                                        : 'text-amber-700';
                                const customer = item.customer_nama || item.nama_customer || 'Guest';
                                const plate = item.nomor_plat || item.plat_nomor || '-';
                                const dateLabel = item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

                                return (
                                    <Pressable key={`existing-${item.id}`} onPress={() => handleSelectExistingTransaction(item)} className="mb-3 p-3 rounded-2xl border bg-white border-gray-100">
                                        <View className="flex-row items-start">
                                            <View className="w-10 h-10 rounded-2xl bg-primary/10 items-center justify-center mr-3">
                                                <ClipboardList size={19} color="#023C69" />
                                            </View>
                                            <View className="flex-1">
                                                <View className="flex-row items-center justify-between">
                                                    <Typography weight="bold" className="text-sm text-textMain flex-1 mr-2" numberOfLines={1}>{item.nomor_transaksi || `#${item.id}`}</Typography>
                                                    <View className={`px-2 py-1 rounded-full border ${statusClass}`}>
                                                        <Typography className={`text-[10px] font-bold ${statusTextClass}`}>{status || '-'}</Typography>
                                                    </View>
                                                </View>
                                                <Typography className="text-gray-500 text-xs mt-1" numberOfLines={1}>{customer} - {plate}</Typography>
                                                <View className="flex-row items-center justify-between mt-2">
                                                    <Typography className="text-gray-400 text-[11px]">{dateLabel}</Typography>
                                                    <Typography className="text-primary text-xs font-bold">{formatCurrency(item.total_biaya || item.total_bayar || 0)}</Typography>
                                                </View>
                                            </View>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={existingDatePickerOpen} transparent animationType="fade" onRequestClose={() => setExistingDatePickerOpen(false)}>
                <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
                    <View className="bg-white rounded-[28px] p-5 w-full max-w-sm">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center flex-1">
                                <View className="w-11 h-11 rounded-2xl bg-teal-50 items-center justify-center border border-teal-100 mr-3">
                                    <Calendar size={20} color="#0F766E" />
                                </View>
                                <View className="flex-1">
                                    <Typography variant="h3" weight="bold" className="text-textMain">Pilih Tanggal</Typography>
                                    <Typography className="text-gray-400 text-xs mt-0.5">Filter transaksi Open Trx.</Typography>
                                </View>
                            </View>
                            <Pressable onPress={() => setExistingDatePickerOpen(false)} className="w-9 h-9 bg-gray-100 rounded-full items-center justify-center">
                                <X size={17} color="#475569" />
                            </Pressable>
                        </View>

                        <Typography className="text-gray-500 text-[10px] font-bold uppercase mb-1">Tanggal</Typography>
                        <TextInput
                            value={tempExistingDate}
                            onChangeText={(value) => {
                                setTempExistingDate(value);
                                if (existingDateError) setExistingDateError('');
                            }}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#94A3B8"
                            autoCapitalize="none"
                            keyboardType="numbers-and-punctuation"
                            className="bg-gray-50 rounded-2xl px-4 h-11 text-sm text-textMain border border-gray-200"
                        />
                        {existingDateError ? (
                            <Typography className="text-rose-500 text-xs mt-2">{existingDateError}</Typography>
                        ) : null}

                        <View className="flex-row space-x-3 mt-5">
                            <Button title="Hari Ini" variant="outline" className="flex-1" onPress={selectTodayExistingDate} />
                            <Button title="Terapkan" className="flex-1" onPress={applyExistingDate} />
                        </View>
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
                                const selected = selectedServices[String(service.id)];
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
                                                {selected ? (
                                                    <View className="flex-row items-center bg-white rounded-lg px-2 py-1 border border-emerald-100 self-start mt-1">
                                                        <Typography className="text-emerald-700 text-xs font-bold mr-1">Rp</Typography>
                                                        <TextInput
                                                            value={formatNumber(Number(selected.item.harga ?? service.harga ?? 0))}
                                                            onChangeText={(val) => setServicePrice(service.id, val)}
                                                            keyboardType="number-pad"
                                                            className="text-emerald-700 text-xs font-bold min-w-[80px] p-0"
                                                        />
                                                    </View>
                                                ) : (
                                                    <Typography className="text-emerald-700 text-xs font-bold mt-1">{formatCurrency(service.harga || 0)}</Typography>
                                                )}
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
