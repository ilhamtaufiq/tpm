import React, { useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { CheckCircle2, Download, Share2, ArrowLeft } from 'lucide-react-native';
import { formatCurrency } from '../../../utils/format';
import api from '../../../utils/api';

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
        // Trigger PDF download
        // Implementation depends on backend API
    };

    const handleShare = async () => {
        if (!receipt) return;

        if (Platform.OS === 'web') {
            // Web share
            if (navigator.share) {
                await navigator.share({
                    title: `Struk ${receipt.transactionNumber}`,
                    text: `Lihat struk transaksi ${type.toUpperCase()} #${receipt.transactionNumber}`,
                    url: window.location.href
                });
            }
        } else {
            // Mobile share
            // Use expo-sharing
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
                <ActivityIndicator size="large" color="#00AA13" />
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

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            {/* Header */}
            <View className="bg-white px-6 py-4 border-b border-gray-100">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                        <Typography variant="h3" weight="bold">Struk Digital</Typography>
                        <Typography variant="caption" className="text-textGray mt-1">
                            {type === 'bengkel' ? 'Bengkel' : 'Jasa Angkut'} • {receipt.transactionNumber}
                        </Typography>
                    </View>
                    <View className="w-12 h-12 bg-emerald-50 rounded-full items-center justify-center">
                        <CheckCircle2 size={24} color="#00AA13" />
                    </View>
                </View>
            </View>

            <ScrollView className="flex-1 px-6 py-6" showsVerticalScrollIndicator={false}>
                {/* Status Card */}
                <Card className="p-6 mb-6 rounded-[24px] bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
                    <View className="items-center">
                        <View className="w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-3">
                            <CheckCircle2 size={32} color="#00AA13" />
                        </View>
                        <Typography variant="h4" weight="bold" className="text-emerald-700 mb-1">
                            Transaksi Berhasil
                        </Typography>
                        <Typography variant="caption" className="text-emerald-600">
                            {formatDate(receipt.date)}
                        </Typography>
                    </View>
                </Card>

                {/* Company Info */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4 text-center">
                        {receipt.companyName || 'TPM Business'}
                    </Typography>
                    <Typography variant="caption" className="text-center text-textGray mb-1">
                        {receipt.companyAddress || 'Jl. Contoh No. 123, Jakarta'}
                    </Typography>
                    <Typography variant="caption" className="text-center text-textGray">
                        {receipt.companyPhone || '(021) 1234-5678'}
                    </Typography>
                </Card>

                {/* Customer Info */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">
                        Informasi Pelanggan
                    </Typography>

                    <View className="space-y-3">
                        <View className="flex-row justify-between">
                            <Typography variant="body2" className="text-textGray">Nama</Typography>
                            <Typography variant="body2" weight="semibold">{receipt.customerName}</Typography>
                        </View>

                        {type === 'bengkel' && (
                            <>
                                <View className="flex-row justify-between">
                                    <Typography variant="body2" className="text-textGray">No. Polisi</Typography>
                                    <Typography variant="body2" weight="semibold">{receipt.vehiclePlate}</Typography>
                                </View>
                                <View className="flex-row justify-between">
                                    <Typography variant="body2" className="text-textGray">Kendaraan</Typography>
                                    <Typography variant="body2" weight="semibold">{receipt.vehicleType}</Typography>
                                </View>
                            </>
                        )}

                        {type === 'jasa_angkut' && receipt.origin && (
                            <>
                                <View className="flex-row justify-between">
                                    <Typography variant="body2" className="text-textGray">Rute</Typography>
                                    <Typography variant="body2" weight="semibold">
                                        {receipt.origin} → {receipt.destination}
                                    </Typography>
                                </View>
                                {receipt.driverName && (
                                    <View className="flex-row justify-between">
                                        <Typography variant="body2" className="text-textGray">Supir</Typography>
                                        <Typography variant="body2" weight="semibold">{receipt.driverName}</Typography>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </Card>

                {/* Items */}
                <Card className="p-6 mb-6 rounded-[24px]">
                    <Typography variant="h4" weight="bold" className="mb-4">
                        Rincian
                    </Typography>

                    {receipt.items.map((item: any, index: number) => (
                        <View key={index} className="mb-4 pb-4 border-b border-gray-100 last:border-b-0">
                            <View className="flex-row justify-between items-start mb-1">
                                <Typography variant="body2" weight="semibold" className="flex-1 mr-4">
                                    {item.description}
                                </Typography>
                                <Typography variant="body2" weight="bold">
                                    {formatCurrency(item.subtotal)}
                                </Typography>
                            </View>
                            {item.quantity && item.unitPrice && (
                                <Typography variant="caption" className="text-textGray">
                                    {item.quantity} × {formatCurrency(item.unitPrice)}
                                </Typography>
                            )}
                        </View>
                    ))}
                </Card>

                {/* Total */}
                <Card className="p-6 mb-6 rounded-[24px] bg-gradient-to-br from-primary/5 to-white border border-primary/20">
                    <View className="flex-row justify-between items-center mb-3">
                        <Typography variant="body2" className="text-textGray">Subtotal</Typography>
                        <Typography variant="body2">{formatCurrency(receipt.subtotal)}</Typography>
                    </View>

                    {receipt.tax > 0 && (
                        <View className="flex-row justify-between items-center mb-3">
                            <Typography variant="body2" className="text-textGray">Pajak</Typography>
                            <Typography variant="body2">{formatCurrency(receipt.tax)}</Typography>
                        </View>
                    )}

                    {receipt.discount > 0 && (
                        <View className="flex-row justify-between items-center mb-3">
                            <Typography variant="body2" className="text-textGray">Diskon</Typography>
                            <Typography variant="body2" className="text-red-500">-{formatCurrency(receipt.discount)}</Typography>
                        </View>
                    )}

                    <View className="h-[1px] bg-gray-200 my-3" />

                    <View className="flex-row justify-between items-center">
                        <Typography variant="h3" weight="bold">Total</Typography>
                        <Typography variant="h3" weight="bold" className="text-primary">
                            {formatCurrency(receipt.total)}
                        </Typography>
                    </View>

                    {receipt.paymentMethod && (
                        <View className="mt-4 pt-4 border-t border-gray-200">
                            <View className="flex-row justify-between items-center">
                                <Typography variant="body2" className="text-textGray">Metode Pembayaran</Typography>
                                <Typography variant="body2" weight="semibold" className="text-primary">
                                    {receipt.paymentMethod.toUpperCase()}
                                </Typography>
                            </View>
                        </View>
                    )}
                </Card>

                {/* Notes */}
                {receipt.notes && (
                    <Card className="p-6 mb-6 rounded-[24px] bg-blue-50 border border-blue-100">
                        <Typography variant="caption" weight="semibold" className="text-blue-700 mb-2">
                            Catatan
                        </Typography>
                        <Typography variant="body2" className="text-blue-900 italic">
                            {receipt.notes}
                        </Typography>
                    </Card>
                )}

                {/* Footer Info */}
                <Card className="p-4 mb-6 rounded-[20px] bg-gray-50">
                    <Typography variant="caption" className="text-center text-textGray">
                        Struk digital ini valid dan dapat digunakan sebagai bukti transaksi
                    </Typography>
                </Card>

                {/* Action Buttons */}
                <View className="mb-8" style={{ gap: 12 }}>
                    <Button
                        title="Download PDF"
                        onPress={handleDownloadPDF}
                        icon={<Download size={20} color="white" />}
                        className="h-14 rounded-2xl"
                    />
                    <Button
                        variant="outline"
                        title="Bagikan Struk"
                        onPress={handleShare}
                        icon={<Share2 size={20} color="#00AA13" />}
                        className="h-14 rounded-2xl"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
