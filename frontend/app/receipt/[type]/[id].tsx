import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { CheckCircle2, Download, Share2, ArrowLeft, Image as ImageIcon } from 'lucide-react-native';
import { formatCurrency } from '../../../utils/format';
import api, { FILE_URL } from '../../../utils/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/**
 * Public receipt view page
 * Accessed via QR code: https://tpm.app/receipt/[type]/[id]
 * 
 * Example URLs:
 * - /receipt/bengkel/12345
 * - /receipt/jasa_angkut/67890
 */
export default function PublicReceiptPage() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { type, id } = params as { type: 'bengkel' | 'jasa_angkut', id: string };

    const [receipt, setReceipt] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadReceipt();
    }, [id, type]);

    const loadReceipt = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch receipt data from public API endpoint
            const response = await api.get(`/public/receipt/${type}/${id}`);
            setReceipt(response.data);
        } catch (err: any) {
            console.error('Failed to load receipt:', err);
            setError(err.response?.data?.detail || 'Struk tidak ditemukan atau tidak valid');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (!receipt) return;
 
        try {
            setLoading(true);
            const pdfUrl = `${FILE_URL}/api/v1/public/receipt/${type}/${id}/pdf`;
            
            // Generate Filename (consistently with backend)
            // nomor_transaksi-nama_pelanggan-nomor_polisi-tanggal
            const clean = (str: string) => (str || '').replace(/[^a-zA-Z0-9]/g, '_');
            const datePart = new Date(receipt.date).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).replace(/\//g, '');
            
            const fileName = `${clean(receipt.transactionNumber)}-${clean(receipt.customerName)}-${clean(receipt.vehiclePlate || 'NoPol')}-${datePart}.pdf`;
            const fileUri = FileSystem.cacheDirectory + fileName;
 
            if (Platform.OS === 'web') {
                window.open(pdfUrl, '_blank');
                return;
            }
 
            // Download the PDF from backend
            const downloadRes = await FileSystem.downloadAsync(pdfUrl, fileUri);
 
            if (downloadRes.status !== 200) {
                throw new Error('Gagal mengunduh PDF struk');
            }
 
            // Share the PDF file
            await Sharing.shareAsync(downloadRes.uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Download Struk PDF',
                UTI: 'com.adobe.pdf'
            });
        } catch (err: any) {
            console.error('Download error:', err);
            Alert.alert('Error', 'Gagal mengunduh PDF. Silakan coba lagi nanti.');
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!receipt) return;

        const shareUrl = `${FILE_URL}/receipt/${type}/${id}`;

        if (Platform.OS === 'web') {
            // Web share
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: `Struk Tiga Putra Motor`,
                        text: `Lihat struk transaksi ${type.toUpperCase()} #${receipt.transactionNumber}`,
                        url: shareUrl
                    });
                } catch (err) {
                    console.log('Error sharing:', err);
                }
            } else {
                // Fallback for browsers that don't support navigator.share
                Alert.alert('Copy Link', 'Link struk: ' + shareUrl);
            }
        } else {
            // Mobile share - Share the link directly
            await Sharing.shareAsync(shareUrl, {
                dialogTitle: 'Bagikan Link Struk',
                mimeType: 'text/plain'
            });
        }
    };

    const handleShareAsImage = async () => {
        if (!receipt) return;

        try {
            setSharing(true);
            const imageUrl = `${FILE_URL}/api/v1/public/receipt/image/${type}/${id}`;
            const fileName = `Struk_TPM_${receipt.transactionNumber}.png`;
            const fileUri = FileSystem.cacheDirectory + fileName;

            if (Platform.OS === 'web') {
                window.open(imageUrl, '_blank');
                return;
            }

            // Download the image from backend
            const downloadRes = await FileSystem.downloadAsync(imageUrl, fileUri);

            if (downloadRes.status !== 200) {
                throw new Error('Gagal mengunduh gambar struk');
            }

            // Share the image file
            await Sharing.shareAsync(downloadRes.uri, {
                mimeType: 'image/png',
                dialogTitle: 'Bagikan Gambar Struk',
                UTI: 'public.png'
            });
        } catch (err) {
            console.error('Error sharing image:', err);
            Alert.alert('Gagal Berbagi', 'Maaf, terjadi kesalahan saat menyiapkan gambar struk.');
        } finally {
            setSharing(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color="#023C69" />
                <Typography variant="body2" className="mt-4 text-textGray">
                    Memuat struk...
                </Typography>
            </SafeAreaView>
        );
    }

    if (error || !receipt) {
        return (
            <SafeAreaView className="flex-1 bg-background">
                <View className="flex-1 items-center justify-center px-6">
                    <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
                        <Typography variant="h1" className="text-red-500">❌</Typography>
                    </View>
                    <Typography variant="h3" weight="bold" className="text-center mb-2">
                        Struk Tidak Ditemukan
                    </Typography>
                    <Typography variant="body2" className="text-center text-textGray mb-6">
                        {error || 'Nomor transaksi tidak valid atau sudah tidak tersedia'}
                    </Typography>
                    <Button
                        title="Kembali"
                        onPress={() => router.back()}
                        icon={<ArrowLeft size={20} color="white" />}
                        className="w-48"
                    />
                </View>
            </SafeAreaView>
        );
    }

    const receiptStyles = {
        paper: {
            backgroundColor: '#fff',
            padding: 20,
            width: '100%' as const,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        mono: {
            fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        },
        divider: {
            borderBottomWidth: 1,
            borderBottomColor: '#000',
            borderStyle: 'dashed' as const,
            marginVertical: 15,
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-100" edges={['top']}>
            {/* Header */}
            <View className="bg-white px-6 py-4 border-b border-gray-200 flex-row items-center">
                <Button 
                    variant="ghost" 
                    onPress={() => router.back()}
                    icon={<ArrowLeft size={24} color="#374151" />}
                    className="mr-2 p-0 w-10"
                />
                <Typography variant="h3" weight="bold">Struk Digital</Typography>
            </View>
 
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <View style={receiptStyles.paper}>
                    {/* Header Info */}
                    <View className="items-center mb-2">
                        <Typography weight="bold" style={[{ fontSize: 18, textAlign: 'center' }, receiptStyles.mono]}>
                            {receipt.companyName}
                        </Typography>
                        <Typography style={[{ fontSize: 12, textAlign: 'center', marginTop: 4 }, receiptStyles.mono]}>
                            {receipt.companyAddress}
                        </Typography>
                        <Typography style={[{ fontSize: 12, textAlign: 'center' }, receiptStyles.mono]}>
                            Telp: {receipt.companyPhone}
                        </Typography>
                    </View>
 
                    <View style={receiptStyles.divider} />
 
                    {/* Transaction Info */}
                    <View>
                        <View className="flex-row justify-between mb-1">
                            <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>No. Nota:</Typography>
                            <Typography style={[{ fontSize: 12, fontWeight: 'bold' }, receiptStyles.mono]}>{receipt.transactionNumber}</Typography>
                        </View>
                        <View className="flex-row justify-between mb-1">
                            <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>Tanggal:</Typography>
                            <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>{formatDate(receipt.date)}</Typography>
                        </View>
                        <View className="flex-row justify-between mb-1">
                            <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>Pelanggan:</Typography>
                            <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>{receipt.customerName}</Typography>
                        </View>
                        {receipt.vehiclePlate && (
                            <View className="flex-row justify-between mb-1">
                                <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>No. Polisi:</Typography>
                                <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>{receipt.vehiclePlate}</Typography>
                            </View>
                        )}
                    </View>
 
                    <View style={receiptStyles.divider} />
 
                    {/* Items List */}
                    <View>
                        {receipt.items.map((item: any, index: number) => (
                            <View key={index} className="mb-4">
                                <Typography style={[{ fontSize: 13, fontWeight: 'bold' }, receiptStyles.mono]}>
                                    {item.description.toUpperCase()}
                                </Typography>
                                <View className="flex-row justify-between mt-1">
                                    <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>
                                        {item.quantity} x {formatCurrency(item.unitPrice).replace('Rp', '').trim()}
                                    </Typography>
                                    <Typography style={[{ fontSize: 12, fontWeight: 'bold' }, receiptStyles.mono]}>
                                        {formatCurrency(item.subtotal).replace('Rp', '').trim()}
                                    </Typography>
                                </View>
                            </View>
                        ))}
                    </View>
 
                    <View style={receiptStyles.divider} />
 
                    {/* Summary */}
                    <View>
                        <View className="flex-row justify-between mb-1">
                            <Typography style={[{ fontSize: 13 }, receiptStyles.mono]}>SUBTOTAL</Typography>
                            <Typography style={[{ fontSize: 13 }, receiptStyles.mono]}>{formatCurrency(receipt.subtotal).replace('Rp', '').trim()}</Typography>
                        </View>
                        
                        {receipt.tax > 0 && (
                            <View className="flex-row justify-between mb-1">
                                <Typography style={[{ fontSize: 13 }, receiptStyles.mono]}>PAJAK</Typography>
                                <Typography style={[{ fontSize: 13 }, receiptStyles.mono]}>{formatCurrency(receipt.tax).replace('Rp', '').trim()}</Typography>
                            </View>
                        )}
 
                        {receipt.discount > 0 && (
                            <View className="flex-row justify-between mb-1">
                                <Typography style={[{ fontSize: 13 }, receiptStyles.mono]}>DISKON</Typography>
                                <Typography style={[{ fontSize: 13, color: '#EF4444' }, receiptStyles.mono]}>-{formatCurrency(receipt.discount).replace('Rp', '').trim()}</Typography>
                            </View>
                        )}
 
                        <View className="my-2" style={{ borderTopWidth: 1, borderTopColor: '#000' }} />
                        
                        <View className="flex-row justify-between items-center py-1">
                            <Typography style={[{ fontSize: 16, fontWeight: 'bold' }, receiptStyles.mono]}>TOTAL</Typography>
                            <Typography style={[{ fontSize: 16, fontWeight: 'bold' }, receiptStyles.mono]}>
                                {formatCurrency(receipt.total).replace('Rp', '').trim()}
                            </Typography>
                        </View>
 
                        {receipt.total - receipt.paid > 0 ? (
                            <>
                                <View className="flex-row justify-between mb-1 mt-2">
                                    <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>DIBAYAR</Typography>
                                    <Typography style={[{ fontSize: 12 }, receiptStyles.mono]}>{formatCurrency(receipt.paid).replace('Rp', '').trim()}</Typography>
                                </View>
                                <View className="flex-row justify-between mb-1">
                                    <Typography style={[{ fontSize: 12, fontWeight: 'bold', color: '#EF4444' }, receiptStyles.mono]}>SISA</Typography>
                                    <Typography style={[{ fontSize: 12, fontWeight: 'bold', color: '#EF4444' }, receiptStyles.mono]}>
                                        {formatCurrency(receipt.total - receipt.paid).replace('Rp', '').trim()}
                                    </Typography>
                                </View>
                            </>
                        ) : (
                            <Typography style={[{ fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginTop: 10 }, receiptStyles.mono]}>
                                *** LUNAS ***
                            </Typography>
                        )}
 
                        <View className="flex-row justify-between mt-4">
                            <Typography style={[{ fontSize: 11 }, receiptStyles.mono]}>Metode Bayar:</Typography>
                            <Typography style={[{ fontSize: 11, fontWeight: 'bold' }, receiptStyles.mono]}>{String(receipt.paymentMethod || '-').toUpperCase()}</Typography>
                        </View>
                    </View>
 
                    <View style={receiptStyles.divider} />
 
                    {/* Footer */}
                    <View className="items-center">
                        <Typography style={[{ fontSize: 11, textAlign: 'center' }, receiptStyles.mono]}>
                            TERIMA KASIH ATAS KUNJUNGANNYA
                        </Typography>
                        <Typography style={[{ fontSize: 10, textAlign: 'center', marginTop: 4, color: '#6B7280' }, receiptStyles.mono]}>
                            Bukti pembayaran sah {receipt.companyName}
                        </Typography>
                        {receipt.notes && (
                            <Typography style={[{ fontSize: 11, textAlign: 'center', marginTop: 10, fontStyle: 'italic' }, receiptStyles.mono]}>
                                "{receipt.notes}"
                            </Typography>
                        )}
                    </View>
                </View>
 
                {/* Action Buttons */}
                <View className="mt-8 mb-10" style={{ gap: 12 }}>
                    <Button
                        title={sharing ? "Menyiapkan Gambar..." : "Bagikan Gambar Struk"}
                        onPress={handleShareAsImage}
                        disabled={sharing}
                        loading={sharing}
                        icon={<ImageIcon size={20} color="white" />}
                        className="h-14 rounded-2xl"
                    />
                    <Button
                        variant="outline"
                        title="Download PDF"
                        onPress={handleDownloadPDF}
                        icon={<Download size={20} color="#023C69" />}
                        className="h-14 rounded-2xl"
                    />
                    <Button
                        variant="outline-neutral"
                        title="Bagikan Link Struk"
                        onPress={handleShare}
                        icon={<Share2 size={20} color="#6B7280" />}
                        className="h-14 rounded-2xl"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
