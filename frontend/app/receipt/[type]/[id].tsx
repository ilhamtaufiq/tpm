import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    ScrollView,
    ActivityIndicator,
    Platform,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Button } from '../../../components/ui/Button';
import {
    Download,
    Share2,
    ArrowLeft,
    Image as ImageIcon,
    Printer,
    Link2,
    ShieldCheck,
    RefreshCw,
} from 'lucide-react-native';
import api from '../../../utils/api';
import { printSettingsService, PrintSettings } from '../../../utils/printSettings';
import {
    exportPublicReceiptPdf,
    exportPublicReceiptImage,
    prepareReceiptCapture,
    PUBLIC_RECEIPT_CAPTURE_ROOT_ID,
} from '../../../utils/exportPublicReceipt';
import { printReceipt, PrintReceiptData, ensureLogoBase64 } from '../../../utils/printReceipt';
import { PublicReceiptCard, PublicReceiptData } from '../../../components/receipt/PublicReceiptCard';
import { getErrorMessage } from '../../../utils/error';
import { PublicReceiptType } from '../../../utils/publicReceiptUrl';
import {
    buildPublicReceiptShareUrl,
    copyPublicReceiptLink,
    sharePublicReceiptLink,
    writeReceiptImageDataUriToCache,
} from '../../../utils/sharePublicReceipt';

type ReceiptType = 'bengkel' | 'jasa_angkut' | 'mobil';

function buildPrintData(type: ReceiptType, id: string, receipt: PublicReceiptData): PrintReceiptData {
    const receiptType = type === 'mobil' ? 'bengkel' : type;
    return {
        type: receiptType as 'bengkel' | 'jasa_angkut',
        transactionNumber: receipt.transactionNumber,
        publicReceiptToken: id,
        date: new Date(receipt.date),
        customerName: receipt.customerName || '-',
        items: receipt.items,
        services: receipt.services,
        parts: receipt.parts,
        subtotal: receipt.subtotal || 0,
        discount: receipt.discount || 0,
        total: receipt.total || 0,
        paid: receipt.paid,
        paymentMethod: receipt.paymentMethod,
        notes: receipt.notes,
        showDiscount: receipt.showDiscount !== false,
        vehiclePlate: receipt.vehiclePlate,
        vehicleType: receipt.vehicleType,
        origin: receipt.origin,
        destination: receipt.destination,
        driverName: receipt.driverName,
    };
}

function buildPrintSettingsFromReceipt(
    receipt: PublicReceiptData,
    fallback: PrintSettings,
): PrintSettings {
    return {
        ...fallback,
        companyName: receipt.companyName || fallback.companyName,
        companyAddress: receipt.companyAddress || fallback.companyAddress,
        companyPhone: receipt.companyPhone || fallback.companyPhone,
        header: receipt.customHeader || fallback.header,
        footer: receipt.customFooter || fallback.footer,
        logoUri: receipt.customLogo || fallback.logoUri || 'tpm_default',
        showQRCode: receipt.showQRCode !== false,
        paperSize: receipt.paperSize === '58mm' ? '58mm' : '80mm',
    };
}

export default function PublicReceiptPage() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { type, id } = params as { type: ReceiptType; id: string };

    const [receipt, setReceipt] = useState<PublicReceiptData | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const cardRef = useRef<View>(null);
    const [captureMode, setCaptureMode] = useState(false);

    const runCaptureExport = async (action: () => Promise<void>) => {
        setCaptureMode(true);
        try {
            await prepareReceiptCapture();
            await action();
        } finally {
            setCaptureMode(false);
        }
    };

    const [shareUrl, setShareUrl] = useState('');

    useEffect(() => {
        let mounted = true;
        buildPublicReceiptShareUrl(type as PublicReceiptType, id)
            .then((url) => {
                if (mounted) setShareUrl(url);
            })
            .catch(() => {
                if (mounted) setShareUrl('');
            });
        return () => {
            mounted = false;
        };
    }, [type, id]);
    const contentMaxWidth = Math.min(width - 32, 480);

    const loadReceipt = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get(`/public/receipt/${type}/${id}`);
            const data = response.data as PublicReceiptData;
            setReceipt(data);
        } catch (err: any) {
            console.error('Failed to load receipt:', err);
            setError(err.response?.data?.detail || 'Struk tidak ditemukan atau tidak valid');
        } finally {
            setLoading(false);
        }
    }, [id, type]);

    useEffect(() => {
        loadReceipt();
    }, [loadReceipt]);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2800);
    };

    const handlePrint = async () => {
        if (!receipt) return;
        try {
            setActionLoading('print');
            const localSettings = await printSettingsService.getSettings();
            const mergedSettings = buildPrintSettingsFromReceipt(receipt, localSettings);
            const base64Logo = mergedSettings.logoUri
                ? await ensureLogoBase64(mergedSettings.logoUri)
                : null;
            await printReceipt(
                buildPrintData(type, id, receipt),
                { ...mergedSettings, logoUri: base64Logo },
            );
            showToast('Struk dikirim ke printer');
        } catch (err: any) {
            showToast(getErrorMessage(err, 'Gagal mencetak struk'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleDownloadPDF = async () => {
        if (!receipt || !id) return;
        try {
            setActionLoading('pdf');
            // Prefer server PDF (no DOM capture). Capture mode only used on fallback.
            await exportPublicReceiptPdf({
                receipt,
                receiptType: type as PublicReceiptType,
                receiptId: id,
                shareUrl,
                cardRef,
            });
            showToast('PDF struk berhasil diunduh');
        } catch (err: any) {
            showToast(getErrorMessage(err, 'Gagal membuat PDF struk'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleShareLink = async () => {
        if (!receipt || !shareUrl || !id) return;
        try {
            setActionLoading('share');
            // Capture card when possible (native view-shot / web html2canvas).
            // Server OG PNG is fallback via receiptType+receiptId.
            let imageFileUri: string | undefined;
            let imageDataUri: string | undefined;
            try {
                setCaptureMode(true);
                await prepareReceiptCapture();
                if (Platform.OS === 'web' && typeof document !== 'undefined') {
                    // Capture DOM card → data URI for Web Share / download attach
                    const el = document.getElementById(PUBLIC_RECEIPT_CAPTURE_ROOT_ID);
                    if (el) {
                        const html2canvas = (await import('html2canvas')).default;
                        const canvas = await html2canvas(el as HTMLElement, {
                            scale: 2,
                            useCORS: true,
                            allowTaint: false,
                            backgroundColor: '#f8fafc',
                            logging: false,
                        });
                        imageDataUri = canvas.toDataURL('image/png');
                    }
                } else if (cardRef.current) {
                    // Dynamic require: view-shot is native-only.
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const { captureRef } = require('react-native-view-shot') as {
                        captureRef: (
                            ref: unknown,
                            opts: Record<string, unknown>,
                        ) => Promise<string>;
                    };
                    imageDataUri = await captureRef(cardRef, {
                        format: 'png',
                        quality: 1,
                        result: 'data-uri',
                    });
                    imageFileUri = await writeReceiptImageDataUriToCache(
                        imageDataUri,
                        receipt.transactionNumber,
                    );
                }
            } catch (captureErr) {
                console.warn('[Share] card capture failed, using server image:', captureErr);
            } finally {
                setCaptureMode(false);
            }

            const result = await sharePublicReceiptLink({
                shareUrl,
                transactionNumber: receipt.transactionNumber,
                receiptType: type as PublicReceiptType,
                receiptId: id,
                imageFileUri,
                imageDataUri,
                onCopied: () => showToast('Link disalin + gambar diunduh (siap dilampirkan)'),
            });
            if (result === 'shared') {
                showToast(
                    Platform.OS === 'web'
                        ? 'Struk dibagikan / link siap'
                        : 'Struk dibagikan (gambar + link di judul)',
                );
            }
        } catch (err: any) {
            showToast(getErrorMessage(err, 'Gagal membagikan struk'));
        } finally {
            setActionLoading(null);
            setCaptureMode(false);
        }
    };

    const handleCopyLink = async () => {
        if (!receipt || !shareUrl) return;
        try {
            await copyPublicReceiptLink(shareUrl, receipt.transactionNumber);
            showToast('Link struk disalin');
        } catch {
            showToast('Gagal menyalin link');
        }
    };

    const handleShareAsImage = async () => {
        if (!receipt) return;
        try {
            setActionLoading('image');
            await runCaptureExport(() => exportPublicReceiptImage({
                receipt,
                receiptType: type as PublicReceiptType,
                receiptId: id,
                shareUrl,
                cardRef,
            }));
            showToast('Gambar struk berhasil dibuat');
        } catch (err: any) {
            showToast(getErrorMessage(err, 'Gagal membagikan gambar struk'));
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
                <View className="items-center px-8">
                    <ActivityIndicator size="large" color="#023C69" />
                    <Typography variant="body2" className="mt-4 text-textGray text-center">
                        Memuat struk digital...
                    </Typography>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !receipt) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50">
                <View className="flex-1 items-center justify-center px-6">
                    <View className="w-full max-w-sm bg-white rounded-[28px] p-8 items-center border border-gray-100 shadow-sm">
                        <View className="w-16 h-16 bg-rose-50 rounded-full items-center justify-center mb-4">
                            <ShieldCheck size={28} color="#EF4444" />
                        </View>
                        <Typography variant="h3" weight="bold" className="text-center mb-2">
                            Struk Tidak Ditemukan
                        </Typography>
                        <Typography variant="body2" className="text-center text-textGray mb-6">
                            {error || 'Link struk tidak valid atau sudah tidak tersedia.'}
                        </Typography>
                        <Button
                            title="Coba Lagi"
                            onPress={loadReceipt}
                            icon={<RefreshCw size={18} color="white" />}
                            className="w-full mb-3"
                        />
                        <Button
                            variant="outline-neutral"
                            title="Kembali"
                            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                            icon={<ArrowLeft size={18} color="#6B7280" />}
                            className="w-full"
                        />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
            <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
                <Pressable
                    onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                    className="w-10 h-10 rounded-full bg-white border border-gray-100 items-center justify-center"
                >
                    <ArrowLeft size={20} color="#023C69" />
                </Pressable>
                <View className="items-center flex-1 mx-3">
                    <Typography weight="bold" className="text-primary text-sm tracking-tight">
                        Struk Publik
                    </Typography>
                    <Typography className="text-gray-400 text-[10px] uppercase tracking-widest">
                        {receipt.transactionNumber}
                    </Typography>
                </View>
                <Pressable
                    onPress={handleCopyLink}
                    className="w-10 h-10 rounded-full bg-white border border-gray-100 items-center justify-center"
                >
                    <Link2 size={18} color="#023C69" />
                </Pressable>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 32,
                    alignItems: 'center',
                }}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ width: '100%', maxWidth: contentMaxWidth }}>
                    <View
                        ref={cardRef}
                        collapsable={false}
                        nativeID={PUBLIC_RECEIPT_CAPTURE_ROOT_ID}
                        className="bg-slate-50 py-6 px-4 items-center"
                    >
                        <PublicReceiptCard
                            receipt={receipt}
                            receiptType={type}
                            shareUrl={shareUrl}
                            captureMode={captureMode}
                        />
                    </View>

                    <View className="mt-6 bg-white rounded-[24px] p-4 border border-gray-100">
                        <Typography weight="bold" className="text-gray-800 text-sm mb-3">
                            Aksi Struk
                        </Typography>
                        <View style={{ gap: 10 }}>
                            {Platform.OS === 'web' ? (
                                <Button
                                    title="Cetak Struk"
                                    onPress={handlePrint}
                                    loading={actionLoading === 'print'}
                                    icon={<Printer size={18} color="white" />}
                                    className="h-12 rounded-2xl"
                                />
                            ) : null}
                            <View className="flex-row" style={{ gap: 10 }}>
                                <View className="flex-1">
                                    <Button
                                        variant="outline"
                                        title="PDF"
                                        onPress={handleDownloadPDF}
                                        loading={actionLoading === 'pdf'}
                                        icon={<Download size={16} color="#023C69" />}
                                        className="h-12 rounded-2xl"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Button
                                        variant="outline"
                                        title="Gambar"
                                        onPress={handleShareAsImage}
                                        loading={actionLoading === 'image'}
                                        icon={<ImageIcon size={16} color="#023C69" />}
                                        className="h-12 rounded-2xl"
                                    />
                                </View>
                            </View>
                            <Button
                                variant="secondary"
                                title="Bagikan (Gambar + Link)"
                                onPress={handleShareLink}
                                loading={actionLoading === 'share'}
                                icon={<Share2 size={18} color="white" />}
                                className="h-12 rounded-2xl bg-[#00ADEF]"
                            />
                        </View>
                    </View>

                    <Typography className="text-center text-[10px] text-gray-400 mt-5 px-4 leading-4">
                        Struk ini diterbitkan secara digital oleh Tiga Putra Motor. Pastikan nominal dan nomor nota sesuai sebelum melakukan pembayaran.
                    </Typography>
                </View>
            </ScrollView>

            {toast ? (
                <View className="absolute bottom-6 left-4 right-4 items-center pointer-events-none">
                    <View className="bg-gray-900/90 px-4 py-3 rounded-2xl max-w-sm">
                        <Typography className="text-white text-sm text-center">{toast}</Typography>
                    </View>
                </View>
            ) : null}
        </SafeAreaView>
    );
}