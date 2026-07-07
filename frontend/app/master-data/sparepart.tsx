import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Pressable, RefreshControl, StatusBar, FlatList, ActivityIndicator, Image, Platform, TextInput } from 'react-native';

const escapeHtml = (str: any) => String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Header } from '../../components/ui/Header';
import {
    Plus,
    Search,
    Trash2,
    Package,
    FileUp,
    Sparkles,
    AlertTriangle,
    RefreshCw,
    QrCode,
    Barcode,
    Printer,
    Check,
    CheckCircle2,
    XCircle,
    Upload,
    Circle,
    Download,
    Eye,
    Coins
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { BaseModal } from '../../components/ui/BaseModal';
import {
    useSparePartsList,
    useDeleteSparePart,
    useImportSpareParts,
    useDebounce,
    useBulkDeleteSpareParts,
    useExportSpareParts,
    useSparePartStockValue,
    useLowStockParts
} from '../../hooks';
import { onlineManager } from '@tanstack/react-query';
import { appAlert, appConfirm } from '../../utils/appAlert';
import api, { FILE_URL } from '../../utils/api';
import { bengkelService } from '../../services/bengkel';
import { downloadXlsxBlob } from '../../utils/downloadXlsx';
import { BarcodeScannerModal } from '../../components/ui/BarcodeScannerModal';
import {
    findSparePartByBarcode,
    getSparePartSearchDisplayQuery,
    getBarcodeSearchQuery,
    parseBarcodeScan,
    pickBestSparePartMatch,
} from '../../utils/barcodeScan';

export default function SparePartMasterScreen() {
    const router = useRouter();
    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const debouncedSearch = useDebounce(searchQuery, 500);
    const [isShowingAll, setIsShowingAll] = useState(false);

    // Queries
    const {
        data: sparePartsData,
        isLoading,
        refetch,
        isRefetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useSparePartsList({
        search: debouncedSearch,
        limit: isShowingAll ? 5000 : 20
    });

    const sparePartsList = useMemo(() =>
        sparePartsData?.pages.flatMap((page: any) => page.data) || [],
        [sparePartsData]);

    // Modal Stats
    const { data: stockValueData, refetch: refetchStockValue } = useSparePartStockValue();
    const { data: lowStockData, refetch: refetchLowStock } = useLowStockParts();

    // Stats Calculation
    const stats = useMemo(() => {
        const totalCount = sparePartsData?.pages[0]?.total || 0;
        const lowStock = lowStockData?.length || 0;
        return { total: totalCount, lowStock };
    }, [sparePartsData, lowStockData]);

    const handleRefresh = async () => {
        refetch();
        refetchStockValue();
        refetchLowStock();
    };

    // Mutations
    const deleteMutation = useDeleteSparePart();
    const importMutation = useImportSpareParts();

    const [isPrintModalVisible, setIsPrintModalVisible] = useState(false);
    const [isImportModalVisible, setIsImportModalVisible] = useState(false);
    const [isExportModalVisible, setIsExportModalVisible] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const handleScanSearch = async (scannedData: string): Promise<boolean> => {
        const parsed = parseBarcodeScan(scannedData);
        let part = findSparePartByBarcode(sparePartsList, scannedData);
        const queries = [...new Set([getBarcodeSearchQuery(scannedData), ...parsed.candidates])];

        if (!part) {
            for (const candidate of queries) {
                if (!candidate) continue;
                try {
                    const res = await api.get('/spare-parts', { params: { limit: 20, search: candidate } });
                    const rows = res.data?.data;
                    if (!Array.isArray(rows) || rows.length === 0) continue;
                    const found = pickBestSparePartMatch(rows, scannedData);
                    if (found) {
                        part = found;
                        break;
                    }
                } catch {
                    // try next candidate
                }
            }
        }

        setSearchQuery(getSparePartSearchDisplayQuery(scannedData, part));
        setIsScannerOpen(false);
        return Boolean(part);
    };

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/master-data');
        }
    };

    const handleDelete = (id: number) => {
        const confirmDelete = () => {
            if (!onlineManager.isOnline()) {
                deleteMutation.mutate(id);
                appAlert('Offline Mode', 'Barang telah dijadwalkan untuk dihapus saat online.');
                return;
            }
            deleteMutation.mutate(id);
        };

        appConfirm(
            'Hapus Barang',
            'Apakah Anda yakin ingin menghapus barang ini?',
            confirmDelete,
            { confirmText: 'Hapus', variant: 'warning' }
        );
    };

    // Import Progress States
    const [isImportProgressVisible, setIsImportProgressVisible] = useState(false);
    const [importStep, setImportStep] = useState<'picking' | 'uploading' | 'processing' | 'done' | 'error'>('picking');
    const [importProgress, setImportProgress] = useState(0);
    const [importResult, setImportResult] = useState<any>(null);
    const [importError, setImportError] = useState<string>('');
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<'stok_format' | 'standard' | null>(null);
    const importProgressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const importProcessingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearImportTimers = () => {
        if (importProgressInterval.current) {
            clearInterval(importProgressInterval.current);
            importProgressInterval.current = null;
        }
        if (importProcessingTimeout.current) {
            clearTimeout(importProcessingTimeout.current);
            importProcessingTimeout.current = null;
        }
    };

    const handleDownloadImportTemplate = async (format: 'stok_format' | 'standard') => {
        try {
            setIsDownloadingTemplate(format);
            const data = await bengkelService.downloadSparePartImportTemplate(format);
            const suffix = format === 'stok_format' ? 'stok' : 'standar';
            await downloadXlsxBlob(data, `template_import_sparepart_${suffix}.xlsx`);
        } catch {
            appAlert('Error', 'Gagal mengunduh format import.');
        } finally {
            setIsDownloadingTemplate(null);
        }
    };

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];
            const formData = new FormData();
            const mimeType = file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const fileName = file.name || 'import_sparepart.xlsx';

            if (Platform.OS === 'web') {
                const webFile = (file as { file?: File }).file;
                if (webFile) {
                    formData.append('file', webFile);
                } else {
                    const blob = await fetch(file.uri).then((response) => response.blob());
                    formData.append('file', blob, fileName);
                }
            } else {
                // @ts-ignore — React Native FormData file upload
                formData.append('file', {
                    uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
                    name: fileName,
                    type: mimeType,
                });
            }

            // Show progress modal
            setIsImportProgressVisible(true);
            setImportStep('uploading');
            setImportProgress(0);
            setImportResult(null);
            setImportError('');

            let progress = 0;
            importProgressInterval.current = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 85) progress = 85;
                setImportProgress(Math.round(progress));
            }, 200);

            importProcessingTimeout.current = setTimeout(() => {
                setImportStep((prev) => (prev === 'uploading' ? 'processing' : prev));
            }, 800);

            const response = await importMutation.mutateAsync(formData);

            clearImportTimers();
            setImportProgress(100);
            setImportResult(response);
            setImportStep('done');
        } catch (error: any) {
            clearImportTimers();
            const errorMsg = error?.response?.data?.detail || error?.message || 'Terjadi kesalahan saat mengimpor data.';
            setImportError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
            setImportStep('error');
            setIsImportProgressVisible(true);
        }
    };

    const handleImportPress = () => {
        appConfirm(
            'Import Sparepart',
            'Import akan mengganti seluruh data sparepart dengan isi file Excel. Disarankan unduh backup/export terlebih dahulu. Lanjutkan?',
            () => {
                setIsImportModalVisible(false);
                handleImport();
            },
            { confirmText: 'Import', variant: 'warning' },
        );
    };

    const handleCloseImportProgress = () => {
        const wasSuccessful = importStep === 'done';
        setIsImportProgressVisible(false);
        setImportStep('picking');
        setImportProgress(0);
        setImportResult(null);
        setImportError('');
        clearImportTimers();
        if (wasSuccessful) {
            handleRefresh();
        }
    };

    const handleBulkPrint = async (type: 'QR' | 'BARCODE') => {
        const listToPrint = selectedIds.length > 0
            ? sparePartsList.filter((item: any) => selectedIds.includes(item.id))
            : sparePartsList;

        if (!listToPrint || listToPrint.length === 0) {
            appAlert('Info', 'Tidak ada data untuk dicetak.');
            return;
        }

        try {
            const itemsHtml = listToPrint.map((item: any) => {
                const imageSource = type === 'QR'
                    ? `https://api.qrserver.com/v1/create-qr-code/?data=${escapeHtml(item.kode)}&size=200x200`
                    : `https://bwipjs-api.metafloor.com/?bcid=code128&text=${escapeHtml(item.kode)}&scale=2&rotate=N&includetext`;

                return `
                    <div class="sticker">
                        <img src="${escapeHtml(imageSource)}" />
                        <div class="code-text">${escapeHtml([item.kode_part, item.kode_ean].filter(Boolean).join(' / ') || item.kode)}</div>
                        <div class="name-text">${escapeHtml(item.nama)}</div>
                    </div>
                `;
            }).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Cetak Label Sparepart</title>
                        <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-wrap: wrap; gap: 15px; padding: 20px; background: white; margin: 0; }
                            .sticker {
                                width: 140px;
                                border: 1px solid #e2e8f0;
                                border-radius: 12px;
                                padding: 12px;
                                text-align: center;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                page-break-inside: avoid;
                                margin-bottom: 10px;
                                background: white;
                            }
                            img { max-width: 100%; height: auto; }
                            .code-text { font-size: 10px; font-weight: bold; margin-top: 10px; color: #023C69; text-transform: uppercase; letter-spacing: 0.5px; }
                            .name-text { font-size: 11px; margin-top: 4px; font-weight: 600; color: #1e293b; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.4; }
                            @media print {
                                body { padding: 0; }
                                .sticker { border-color: #eee; }
                            }
                        </style>
                    </head>
                    <body>
                        ${itemsHtml}
                    </body>
                </html>
            `;

            if (Platform.OS === 'web') {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'fixed';
                iframe.style.right = '0';
                iframe.style.bottom = '0';
                iframe.style.width = '0';
                iframe.style.height = '0';
                iframe.style.border = '0';
                document.body.appendChild(iframe);

                const doc = iframe.contentWindow?.document || iframe.contentDocument;
                if (doc) {
                    // @ts-ignore - write exists on Document
                    doc.open();
                    // @ts-ignore - write exists on Document
                    doc.write(html);
                    // @ts-ignore - write exists on Document
                    doc.close();

                    // Give images a moment to start loading
                    setTimeout(() => {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                        }, 500);
                    }, 500);
                }
            } else {
                await Print.printAsync({ html });
            }
        } catch (error) {
            console.error('Print error:', error);
            appAlert('Error', 'Gagal mencetak label.');
        }
    };

    const handleBulkDelete = () => {
        if (selectedIds.length === 0) return;

        const executeDelete = async () => {
            try {
                await bulkDeleteMutation.mutateAsync(selectedIds);
                setSelectedIds([]);
                appAlert('Sukses', 'Item berhasil dihapus.');
            } catch (error) {
                appAlert('Error', 'Gagal menghapus item.');
            }
        };

        appConfirm(
            'Hapus Masal',
            `Apakah Anda yakin ingin menghapus ${selectedIds.length} item terpilih?`,
            executeDelete,
            { confirmText: 'Hapus', variant: 'warning' }
        );
    };

    const handleBulkExport = async (ids?: number[]) => {
        try {
            const data = await exportMutation.mutateAsync(ids);
            await downloadXlsxBlob(data, `spare_parts_export_${Date.now()}.xlsx`);
        } catch (error) {
            appAlert('Error', 'Gagal mengekspor data.');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === sparePartsList.length && sparePartsList.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(sparePartsList.map((item: any) => item.id));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const bulkDeleteMutation = useBulkDeleteSpareParts();
    const exportMutation = useExportSpareParts();

    const renderItem = ({ item }: { item: any }) => {
        const isAlwaysReady = item.stok === 999;
        const isLowStock = !isAlwaysReady && item.stok <= item.stok_minimum;
        const imageUrl = item.gambar ? `${FILE_URL}/uploads/${item.gambar}` : null;
        const isSelected = selectedIds.includes(item.id);

        return (
            <View className="flex-row items-center space-x-3 mb-4">
                <Pressable
                    onPress={() => toggleSelect(item.id)}
                    className="p-1"
                >
                    {isSelected ? (
                        <View className="bg-primary rounded-lg p-1">
                            <Check size={16} color="white" />
                        </View>
                    ) : (
                        <Circle size={24} color="#CBD5E1" strokeWidth={1} />
                    )}
                </Pressable>

                <Pressable
                    onPress={() => router.push(`/master-data/sparepart/edit/${item.id}`)}
                    className="flex-1"
                >
                    <View className={`p-4 rounded-[28px] shadow-sm flex-row items-center ${isLowStock ? 'bg-red-50/50 border border-red-200' : 'bg-white border border-gray-100'}`}>
                        <View className={`w-20 h-20 rounded-2xl items-center justify-center mr-4 overflow-hidden border ${isLowStock ? 'bg-red-100 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                            {imageUrl ? (
                                <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <Package size={28} color={isLowStock ? '#EF4444' : '#9CA3AF'} strokeWidth={1.5} />
                            )}
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center justify-between mb-1">
                                <View className="flex-1 mr-2">
                                    <Typography variant="caption" weight="bold" className="text-primary/60 text-[10px] uppercase mb-0.5">
                                        {[item.kode_part, item.kode_ean].filter(Boolean).join(' • ') || item.kode}
                                    </Typography>
                                    <Typography variant="body1" weight="bold" className="text-textMain text-base" numberOfLines={1}>{item.nama}</Typography>
                                </View>
                                {isLowStock && (
                                    <View className="bg-red-100 px-2 py-1 rounded-lg flex-row items-center">
                                        <AlertTriangle size={10} color="#EF4444" className="mr-1" />
                                        <Typography className="text-red-600 text-[10px] font-bold uppercase">Stok Rendah</Typography>
                                    </View>
                                )}
                            </View>

                            <View className="flex-row items-center mb-1">
                                <Typography className="text-primary font-bold text-base mr-2">
                                    Rp {Number(item.harga_jual).toLocaleString('id-ID')}
                                </Typography>
                                <Typography className="text-gray-400 text-xs">/ {item.satuan}</Typography>
                            </View>

                            <View className="flex-row items-center pt-2 mt-2 border-t border-gray-100/50 border-dashed">
                                {isAlwaysReady ? (
                                    <Badge
                                        label="Always Ready"
                                        variant="infinity"
                                        className="mr-2 px-3"
                                    />
                                ) : (
                                    <Typography className="text-textGray text-xs font-semibold px-2 py-1 bg-gray-100 rounded-lg mr-2">
                                        Stok: {item.stok}
                                    </Typography>
                                )}
                                <Typography className="text-textGray/60 text-xs italic">
                                    Rak: {item.lokasi_rak || '-'}
                                </Typography>
                            </View>
                        </View>
                    </View>
                </Pressable>
            </View>
        );
    };

    const renderListHeader = () => (
        <View className="pt-2">
            {/* Compact Dashboard Stats */}
            <View className="mb-4">
                <View className="flex-row space-x-3 mb-3">
                    <View className="flex-1 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex-row items-center">
                        <View className="bg-primary/10 p-2 rounded-xl mr-3">
                            <Package size={14} color="#023C69" />
                        </View>
                        <View>
                            <Typography className="text-textGray text-[10px] font-bold uppercase">Total</Typography>
                            <Typography variant="h3" weight="bold" className="text-textMain text-lg leading-tight">{stats.total}</Typography>
                        </View>
                    </View>
                    <View className="flex-1 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex-row items-center">
                        <View className="bg-indigo-50 p-2 rounded-xl mr-3">
                            <Coins size={14} color="#4F46E5" />
                        </View>
                        <View className="flex-1">
                            <Typography className="text-textGray text-[10px] font-bold uppercase">Modal Stok</Typography>
                            <Typography variant="h3" weight="bold" className="text-primary text-sm leading-tight" numberOfLines={1}>
                                {Number(stockValueData?.total_value || 0).toLocaleString('id-ID')}
                            </Typography>
                        </View>
                    </View>
                </View>

                {stats.lowStock > 0 ? (
                    <View className="bg-red-50 p-3 rounded-2xl border border-red-100 flex-row items-center">
                        <AlertTriangle size={14} color="#EF4444" className="mr-3 ml-1" />
                        <Typography className="text-red-700 font-bold text-xs flex-1">{stats.lowStock} Barang Stok Menipis</Typography>
                        <View className="bg-red-200/50 px-2 py-0.5 rounded-lg">
                            <Typography className="text-red-800 text-[10px] font-bold">PERHATIKAN</Typography>
                        </View>
                    </View>
                ) : (
                    <View className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 flex-row items-center">
                        <CheckCircle2 size={14} color="#10B981" className="mr-3 ml-1" />
                        <Typography className="text-emerald-800 font-bold text-xs">Stok Semua Barang Aman</Typography>
                    </View>
                )}
            </View>

            {/* Load All Button Trigger */}
            <View className="mb-4">
                {hasNextPage && !isShowingAll ? (
                    <Pressable
                        onPress={() => {
                            setIsShowingAll(true);
                            setSelectedIds([]);
                        }}
                        className="bg-primary/5 p-3 rounded-2xl border border-primary/20 flex-row items-center justify-center"
                    >
                        <Sparkles size={16} color="#023C69" className="mr-2" />
                        <Typography className="text-primary font-bold text-xs">Tampilkan Semua ({stats.total} item)</Typography>
                    </Pressable>
                ) : isShowingAll ? (
                    <View className="flex-row items-center justify-between bg-amber-50 p-2.5 rounded-2xl border border-amber-100">
                        <View className="flex-row items-center">
                            <Sparkles size={14} color="#D97706" className="mr-2 ml-1" />
                            <Typography className="text-amber-800 font-bold text-[10px]">Mode Semua Data Aktif</Typography>
                        </View>
                        <Pressable
                            onPress={() => {
                                setIsShowingAll(false);
                                setSelectedIds([]);
                            }}
                            className="bg-white px-3 py-1 rounded-xl border border-amber-200"
                        >
                            <Typography className="text-amber-700 font-bold text-[10px]">Halaman</Typography>
                        </Pressable>
                    </View>
                ) : null}
            </View>

            {/* Bulk Actions Header */}
            <View className="mb-2">
                <View className="flex-row items-center justify-between px-1">
                    <View className="flex-row items-center">
                        <Pressable
                            onPress={toggleSelectAll}
                            className="flex-row items-center mr-3"
                        >
                            <View className={`w-5 h-5 rounded border items-center justify-center ${selectedIds.length === sparePartsList.length && sparePartsList.length > 0 ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                {selectedIds.length === sparePartsList.length && sparePartsList.length > 0 && <Check size={12} color="white" />}
                            </View>
                            <Typography className="ml-2 text-[11px] font-bold text-textGray">Pilih Semua</Typography>
                        </Pressable>

                        {selectedIds.length > 0 && (
                            <Typography className="text-[10px] font-bold text-white px-2 py-0.5 bg-primary rounded-full">
                                {selectedIds.length}
                            </Typography>
                        )}
                    </View>

                    <View className="flex-row space-x-2">
                        {selectedIds.length > 0 ? (
                            <View className="flex-row items-center space-x-2">
                                <Pressable
                                    onPress={() => setIsPrintModalVisible(true)}
                                    className="w-10 h-10 bg-indigo-50 items-center justify-center rounded-2xl border border-indigo-100"
                                >
                                    <Printer size={18} color="#4F46E5" />
                                </Pressable>
                                <Pressable
                                    onPress={handleBulkDelete}
                                    className="w-10 h-10 bg-red-50 rounded-2xl items-center justify-center border border-red-100"
                                >
                                    <Trash2 size={18} color="#EF4444" />
                                </Pressable>
                                <Pressable
                                    onPress={() => setIsExportModalVisible(true)}
                                    className="w-10 h-10 bg-emerald-50 rounded-2xl items-center justify-center border border-emerald-100"
                                >
                                    <Download size={18} color="#10B981" />
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                onPress={() => setIsExportModalVisible(true)}
                                className="px-3 py-2 bg-gray-50 rounded-xl flex-row items-center border border-gray-100"
                            >
                                <Download size={14} color="#4B5563" className="mr-2" />
                                <Typography className="text-[10px] font-bold text-gray-600">Download XLS</Typography>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-surface" style={{ position: 'relative' }}>
            <StatusBar barStyle="light-content" />

            <Header
                title="Sparepart"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
                showProfile={true}
            >
                <View className="flex-row items-center bg-gray-50 h-11 rounded-2xl border border-gray-100">
                    <Search size={18} color="#9CA3AF" className="ml-4" />
                    <TextInput
                        placeholder="Cari sparepart..."
                        className="flex-1 ml-3 text-sm font-medium text-textMain"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#9CA3AF"
                        showSoftInputOnFocus={true}
                    />
                    <Pressable
                        onPress={() => setIsScannerOpen(true)}
                        className="w-10 h-10 mr-1 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 active:bg-indigo-100"
                    >
                        <QrCode size={18} color="#4F46E5" />
                    </Pressable>
                </View>
                <View className="flex-row justify-end mt-2">
                    <Pressable
                        onPress={() => setIsImportModalVisible(true)}
                        className="w-10 h-10 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 mr-2"
                    >
                        <FileUp size={16} color="#023C69" />
                    </Pressable>
                    <Pressable
                        onPress={() => setIsPrintModalVisible(true)}
                        className="w-10 h-10 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100"
                    >
                        <Printer size={16} color="#023C69" />
                    </Pressable>
                </View>
            </Header>

            {/* List */}
            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#16A34A" />
                </View>
            ) : (
                <FlatList
                    data={sparePartsList}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    ListHeaderComponent={renderListHeader}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 6 }}
                    onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                    onEndReachedThreshold={0.5}
                    refreshControl={
                        <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#16A34A" />
                    }
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <Package size={64} color="#E5E7EB" strokeWidth={1} />
                            <Typography className="text-textGray mt-4">Tidak ada data sparepart</Typography>
                        </View>
                    }
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <ActivityIndicator size="small" color="#16A34A" className="py-4" />
                        ) : null
                    }
                />
            )}

            {/* Floating Action Button */}
            <Pressable
                onPress={() => router.push('/master-data/sparepart/create')}
                style={{ position: 'absolute', right: 24, bottom: 100, elevation: 5, zIndex: 999, width: 64, height: 64 }}
                className="bg-primary rounded-[24px] items-center justify-center shadow-2xl elevation-8"
            >
                <Plus size={32} color="white" />
            </Pressable>

            {/* Print Selection Modal */}
            <BaseModal
                visible={isPrintModalVisible}
                onClose={() => setIsPrintModalVisible(false)}
                title="Cetak Label"
            >
                <View className="p-4">
                    <Typography className="text-textGray mb-6 text-center">
                        {selectedIds.length > 0
                            ? `Cetak label untuk ${selectedIds.length} item terpilih.`
                            : 'Pilih jenis label yang akan dicetak untuk semua data yang tampil di layar saat ini.'}
                    </Typography>

                    <View className="space-y-4">
                        <Pressable
                            onPress={() => {
                                setIsPrintModalVisible(false);
                                setTimeout(() => handleBulkPrint('QR'), 300);
                            }}
                            className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex-row items-center"
                        >
                            <View className="bg-primary/10 p-3 rounded-xl mr-4">
                                <QrCode size={24} color="#023C69" />
                            </View>
                            <View>
                                <Typography variant="body1" weight="bold" className="text-primary">QR Code</Typography>
                                <Typography variant="caption" className="text-textGray">Format kotak, cepat dipindai</Typography>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                setIsPrintModalVisible(false);
                                setTimeout(() => handleBulkPrint('BARCODE'), 300);
                            }}
                            className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex-row items-center"
                        >
                            <View className="bg-emerald-100 p-3 rounded-xl mr-4">
                                <Barcode size={24} color="#059669" />
                            </View>
                            <View>
                                <Typography variant="body1" weight="bold" className="text-emerald-700">Barcode</Typography>
                                <Typography variant="caption" className="text-textGray">Format garis standar (Code 128)</Typography>
                            </View>
                        </Pressable>

                        <Button
                            title="Tutup"
                            variant="outline"
                            onPress={() => setIsPrintModalVisible(false)}
                            className="mt-4"
                        />
                    </View>
                </View>
            </BaseModal>
            {/* Import & Bulk Update Modal */}
            <BaseModal
                visible={isImportModalVisible}
                onClose={() => setIsImportModalVisible(false)}
                title="Kelola Data Massal (XLS)"
            >
                <View className="p-4">
                    <Typography className="text-textGray mb-6 text-center">
                        Pilih jenis aksi massal yang ingin Anda lakukan menggunakan file Excel.
                    </Typography>

                    <View className="space-y-4">
                        <Typography className="text-textGray text-[11px] text-center">
                            Unduh template, isi data, lalu import. Format terdeteksi otomatis dari header baris pertama.
                        </Typography>

                        <Pressable
                            onPress={() => handleDownloadImportTemplate('stok_format')}
                            disabled={isDownloadingTemplate !== null}
                            className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex-row items-center"
                        >
                            <View className="bg-indigo-100 p-3 rounded-xl mr-4">
                                {isDownloadingTemplate === 'stok_format'
                                    ? <ActivityIndicator size="small" color="#4F46E5" />
                                    : <Download size={24} color="#4F46E5" />}
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-indigo-700">Download Format Import Stok</Typography>
                                <Typography variant="caption" className="text-textGray">Urutan, Nama, Kode Part, Harga, Stok, Satuan, Total Modal, Always Ready.</Typography>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => handleDownloadImportTemplate('standard')}
                            disabled={isDownloadingTemplate !== null}
                            className="bg-sky-50 p-4 rounded-2xl border border-sky-100 flex-row items-center"
                        >
                            <View className="bg-sky-100 p-3 rounded-xl mr-4">
                                {isDownloadingTemplate === 'standard'
                                    ? <ActivityIndicator size="small" color="#0284C7" />
                                    : <Download size={24} color="#0284C7" />}
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-sky-700">Download Format Standar</Typography>
                                <Typography variant="caption" className="text-textGray">Kode, Nama, Kode Part, Kategori, Stok, Harga, Rak, Catatan, Kode EAN.</Typography>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={handleImportPress}
                            className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex-row items-center"
                        >
                            <View className="bg-emerald-100 p-3 rounded-xl mr-4">
                                <FileUp size={24} color="#059669" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-emerald-700">Import File Excel</Typography>
                                <Typography variant="caption" className="text-textGray">Upload file .xlsx hasil template atau export. Mengganti seluruh data sparepart.</Typography>
                            </View>
                        </Pressable>

                        <View className="bg-amber-50/80 p-3 rounded-2xl border border-amber-100 flex-row items-start">
                            <AlertTriangle size={14} color="#D97706" className="mr-2 mt-0.5" />
                            <Typography className="text-amber-800 text-[11px] leading-relaxed flex-1">
                                Untuk update harga/stok: export data → edit di Excel → import ulang. Baris contoh di template bisa dihapus sebelum upload.
                            </Typography>
                        </View>

                        <Button
                            title="Tutup"
                            variant="outline"
                            onPress={() => setIsImportModalVisible(false)}
                            className="mt-4"
                        />
                    </View>
                </View>
            </BaseModal>
            {/* Export Selection Modal */}
            <BaseModal
                visible={isExportModalVisible}
                onClose={() => setIsExportModalVisible(false)}
                title="Download Excel"
            >
                <View className="p-4">
                    <Typography className="text-textGray mb-6 text-center">
                        Pilih cakupan data yang ingin Anda unduh dalam format Excel.
                    </Typography>

                    <View className="space-y-4">
                        <Pressable
                            onPress={() => {
                                setIsExportModalVisible(false);
                                handleBulkExport(undefined);
                            }}
                            className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex-row items-center"
                        >
                            <View className="bg-primary/10 p-3 rounded-xl mr-4">
                                <Package size={24} color="#023C69" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-primary">Download Seluruh Data</Typography>
                                <Typography variant="caption" className="text-textGray">Ekspor seluruh data di database ({stats.total} item).</Typography>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => {
                                setIsExportModalVisible(false);
                                handleBulkExport(sparePartsList.map((i: any) => i.id));
                            }}
                            className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex-row items-center"
                        >
                            <View className="bg-emerald-100 p-3 rounded-xl mr-4">
                                <Eye size={24} color="#059669" />
                            </View>
                            <View className="flex-1">
                                <Typography variant="body1" weight="bold" className="text-emerald-700">Download Yang Tampil</Typography>
                                <Typography variant="caption" className="text-textGray">Hanya item yang sudah dimuat di layar ({sparePartsList.length} item).</Typography>
                            </View>
                        </Pressable>

                        {selectedIds.length > 0 && (
                            <Pressable
                                onPress={() => {
                                    setIsExportModalVisible(false);
                                    handleBulkExport(selectedIds);
                                }}
                                className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex-row items-center"
                            >
                                <View className="bg-amber-100 p-3 rounded-xl mr-4">
                                    <Check size={24} color="#D97706" />
                                </View>
                                <View className="flex-1">
                                    <Typography variant="body1" weight="bold" className="text-amber-700">Download Data Terpilih</Typography>
                                    <Typography variant="caption" className="text-textGray">Ekspor {selectedIds.length} item yang telah Anda centang.</Typography>
                                </View>
                            </Pressable>
                        )}

                        <Button
                            title="Tutup"
                            variant="outline"
                            onPress={() => setIsExportModalVisible(false)}
                            className="mt-4"
                        />
                    </View>
                </View>
            </BaseModal>

            {/* Import Progress Modal */}
            <BaseModal
                visible={isImportProgressVisible}
                onClose={importStep === 'done' || importStep === 'error' ? handleCloseImportProgress : () => {}}
                title="Import Sparepart"
            >
                <View className="p-6">
                    {/* Step Indicators */}
                    <View className="flex-row items-center justify-center mb-8">
                        {[
                            { key: 'uploading', label: 'Upload' },
                            { key: 'processing', label: 'Proses' },
                            { key: 'done', label: 'Selesai' },
                        ].map((step, i) => {
                            const isActive = step.key === importStep ||
                                (step.key === 'done' && importStep === 'error');
                            const isCompleted =
                                (step.key === 'uploading' && ['processing', 'done', 'error'].includes(importStep)) ||
                                (step.key === 'processing' && ['done'].includes(importStep));
                            const isFailed = step.key === 'done' && importStep === 'error';

                            return (
                                <React.Fragment key={step.key}>
                                    <View className="items-center">
                                        <View className={`w-10 h-10 rounded-full items-center justify-center ${
                                            isFailed ? 'bg-red-500' :
                                            isCompleted ? 'bg-emerald-500' :
                                            isActive ? 'bg-primary' : 'bg-gray-200'
                                        }`}>
                                            {isFailed ? (
                                                <XCircle size={20} color="white" />
                                            ) : isCompleted ? (
                                                <CheckCircle2 size={20} color="white" />
                                            ) : isActive ? (
                                                <ActivityIndicator size="small" color="white" />
                                            ) : (
                                                <Typography className="text-gray-400 font-bold text-xs">{i + 1}</Typography>
                                            )}
                                        </View>
                                        <Typography className={`text-[10px] font-bold mt-1.5 ${
                                            isFailed ? 'text-red-500' :
                                            isCompleted ? 'text-emerald-600' :
                                            isActive ? 'text-primary' : 'text-gray-400'
                                        }`}>{step.label}</Typography>
                                    </View>
                                    {i < 2 && (
                                        <View className={`flex-1 h-0.5 mx-2 mt-[-12px] rounded-full ${
                                            isCompleted ? 'bg-emerald-400' : 'bg-gray-200'
                                        }`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </View>

                    {/* Upload/Processing State */}
                    {(importStep === 'uploading' || importStep === 'processing') && (
                        <View className="items-center">
                            <View className="w-24 h-24 bg-primary/5 rounded-full items-center justify-center mb-6 border-2 border-primary/10">
                                {importStep === 'uploading' ? (
                                    <Upload size={36} color="#023C69" />
                                ) : (
                                    <RefreshCw size={36} color="#023C69" />
                                )}
                            </View>
                            <Typography variant="h3" weight="bold" className="text-textMain mb-2">
                                {importStep === 'uploading' ? 'Mengunggah File...' : 'Memproses Data...'}
                            </Typography>
                            <Typography className="text-textGray text-center text-sm mb-6">
                                {importStep === 'uploading'
                                    ? 'File sedang diunggah ke server.'
                                    : 'Membaca Excel dan menyimpan ke database. Harap tunggu...'}
                            </Typography>

                            {/* Progress Bar */}
                            <View className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
                                <View
                                    className="bg-primary h-full rounded-full"
                                    style={{ width: `${importProgress}%` }}
                                />
                            </View>
                            <Typography className="text-primary font-bold text-sm">{importProgress}%</Typography>
                        </View>
                    )}

                    {/* Success State */}
                    {importStep === 'done' && importResult && (
                        <View>
                            <View className="items-center mb-6">
                                <View className="w-20 h-20 bg-emerald-50 rounded-full items-center justify-center mb-4 border-2 border-emerald-100">
                                    <CheckCircle2 size={40} color="#10B981" />
                                </View>
                                <Typography variant="h3" weight="bold" className="text-emerald-700">Import Berhasil!</Typography>
                                <Typography className="text-textGray text-sm mt-1">
                                    Format: {importResult.format_detected === 'stok_format' ? 'Import Stok' : 'Format Standar'}
                                </Typography>
                            </View>

                            {/* Result Stats */}
                            <View className="space-y-3">
                                <View className="flex-row justify-between items-center bg-gray-50 p-3 rounded-2xl">
                                    <Typography className="text-textGray text-sm">Total Baris Diproses</Typography>
                                    <Typography weight="bold" className="text-textMain text-lg">{importResult.total}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                                    <Typography className="text-emerald-700 text-sm">✨ Produk Baru</Typography>
                                    <Typography weight="bold" className="text-emerald-700 text-lg">{importResult.success}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center bg-blue-50 p-3 rounded-2xl border border-blue-100">
                                    <Typography className="text-blue-700 text-sm">🔄 Diperbarui</Typography>
                                    <Typography weight="bold" className="text-blue-700 text-lg">{importResult.updated}</Typography>
                                </View>
                                {importResult.duplicates > 0 && (
                                    <View className="flex-row justify-between items-center bg-amber-50 p-3 rounded-2xl border border-amber-100">
                                        <Typography className="text-amber-700 text-sm">🔗 Digabung (Duplikat)</Typography>
                                        <Typography weight="bold" className="text-amber-700 text-lg">{importResult.duplicates}</Typography>
                                    </View>
                                )}
                                {importResult.failed > 0 && (
                                    <View className="bg-red-50 p-3 rounded-2xl border border-red-100">
                                        <View className="flex-row justify-between items-center mb-2">
                                            <Typography className="text-red-600 text-sm">❌ Gagal</Typography>
                                            <Typography weight="bold" className="text-red-600 text-lg">{importResult.failed}</Typography>
                                        </View>
                                        {importResult.errors && importResult.errors.length > 0 && (
                                            <View className="bg-red-100/50 p-2 rounded-xl">
                                                {importResult.errors.slice(0, 3).map((err: string, idx: number) => (
                                                    <Typography key={idx} className="text-red-500 text-[10px] mb-0.5">
                                                        {err.length > 100 ? err.substring(0, 100) + '...' : err}
                                                    </Typography>
                                                ))}
                                                {importResult.errors.length > 3 && (
                                                    <Typography className="text-red-400 text-[10px] italic">...dan {importResult.errors.length - 3} error lainnya</Typography>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Modal Validation */}
                                {importResult.total_modal_db !== undefined && (
                                    <View className={`p-3 rounded-2xl border ${importResult.modal_verified ? 'bg-emerald-50 border-emerald-100' : importResult.modal_warning ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Typography className={`text-sm font-bold ${importResult.modal_verified ? 'text-emerald-700' : importResult.modal_warning ? 'text-red-700' : 'text-indigo-700'}`}>
                                                {importResult.modal_verified ? '✅ Modal Terverifikasi' : importResult.modal_warning ? '⚠️ Selisih Modal' : '💰 Total Modal'}
                                            </Typography>
                                        </View>
                                        <View className="flex-row justify-between items-center">
                                            <Typography className="text-[11px] text-gray-600">Modal di Database</Typography>
                                            <Typography weight="bold" className="text-[11px]">
                                                Rp {Number(importResult.total_modal_db || 0).toLocaleString('id-ID')}
                                            </Typography>
                                        </View>
                                        {importResult.total_fix_excel !== undefined && (
                                            <>
                                                <View className="flex-row justify-between items-center mt-0.5">
                                                    <Typography className="text-[11px] text-gray-600">Total Fix (Excel)</Typography>
                                                    <Typography weight="bold" className="text-[11px]">
                                                        Rp {Number(importResult.total_fix_excel || 0).toLocaleString('id-ID')}
                                                    </Typography>
                                                </View>
                                                {importResult.modal_diff > 0 && (
                                                    <View className="flex-row justify-between items-center mt-0.5">
                                                        <Typography className="text-[11px] text-red-600 font-bold">Selisih</Typography>
                                                        <Typography weight="bold" className="text-[11px] text-red-600">
                                                            Rp {Number(importResult.modal_diff || 0).toLocaleString('id-ID')}
                                                        </Typography>
                                                    </View>
                                                )}
                                            </>
                                        )}
                                        {importResult.modal_warning && (
                                            <Typography className="text-[10px] text-red-500 mt-2 italic">
                                                {importResult.modal_warning}
                                            </Typography>
                                        )}
                                    </View>
                                )}
                            </View>

                            <Button
                                title="Selesai"
                                onPress={handleCloseImportProgress}
                                className="mt-6"
                                size="lg"
                            />
                        </View>
                    )}

                    {/* Error State */}
                    {importStep === 'error' && (
                        <View className="items-center">
                            <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4 border-2 border-red-100">
                                <XCircle size={40} color="#EF4444" />
                            </View>
                            <Typography variant="h3" weight="bold" className="text-red-600 mb-2">Import Gagal</Typography>
                            <Typography className="text-textGray text-center text-sm mb-4">
                                Terjadi kesalahan saat mengimpor data.
                            </Typography>
                            <View className="bg-red-50 p-4 rounded-2xl border border-red-100 w-full mb-6">
                                <Typography className="text-red-600 text-xs">
                                    {importError || 'Unknown error'}
                                </Typography>
                            </View>
                            <Button
                                title="Tutup"
                                variant="danger"
                                onPress={handleCloseImportProgress}
                                size="lg"
                            />
                        </View>
                    )}
                </View>
            </BaseModal>

            <BarcodeScannerModal
                visible={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScanSearch}
            />
        </View>
    );
}
