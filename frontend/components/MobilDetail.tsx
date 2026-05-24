import React, { useState, useEffect } from 'react';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { View, ScrollView, Image, Pressable, Alert, ActivityIndicator, FlatList, Dimensions, StatusBar, Modal, TextInput, TouchableOpacity, Platform, Share, Linking } from 'react-native';
import { Typography } from './ui/Typography';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import {
    Calendar,
    GaugeCircle,
    Palette,
    Settings,
    FileText,
    CircleDollarSign,
    Edit,
    X,
    Plus,
    Trash2,
    PlayCircle,
    TrendingUp,
    Image as ImageIcon,
    CreditCard,
    Banknote,
    CheckCircle2,
    Clock,
    Wallet,
    Ban,
    AlertTriangle,
    ArrowDownLeft,
    Info,
    Share2,
    Link
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { useMobilDetail, useUploadMedia, useDeleteMedia, usePenjualanMobilList, usePayPenjualanMobil, useCancelBookingMobil } from '../hooks/useMobil';
import { onlineManager } from '@tanstack/react-query';
import { useHutangList } from '../hooks/useKeuangan';
import { FILE_URL } from '../utils/api';
import { formatCurrency, parseNumber, formatNumber, formatDate } from '../utils/format';
import { RelatedBengkelTransactions } from './RelatedBengkelTransactions';
import { PaymentModal } from './PaymentModal';
import { AlertDialog } from './ui/AlertDialog';

const { width } = Dimensions.get('window');

interface MobilDetailProps {
    unit: any;
    onClose: () => void;
    onEdit?: () => void;
    onSell?: (unit: any) => void;
}

export const MobilDetail = ({ unit: initialUnit, onClose, onEdit, onSell }: MobilDetailProps) => {
    const { data: unit, isLoading: isRefetching } = useMobilDetail(initialUnit?.id);
    const uploadMediaAction = useUploadMedia();
    const deleteMediaAction = useDeleteMedia();

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        console.log('[DEBUG] MobilDetail mounted for unit:', initialUnit?.id);
        return () => console.log('[DEBUG] MobilDetail unmounted');
    }, []);

    const [deleteDialog, setDeleteDialog] = useState<{
        visible: boolean;
        mediaId: number | null;
    }>({
        visible: false,
        mediaId: null
    });


    // Cancel booking modal state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelPenalti, setCancelPenalti] = useState('');
    const [useRefundSplit, setUseRefundSplit] = useState(false);
    const [refundSplits, setRefundSplits] = useState<{ metode: string; nominal: string }[]>([
        { metode: 'TUNAI', nominal: '' },
        { metode: 'TRANSFER', nominal: '' }
    ]);
    const [cancelAlasan, setCancelAlasan] = useState('');
    const [cancelSuccess, setCancelSuccess] = useState(false);
    const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [hutangModalVisible, setHutangModalVisible] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);

    const activeUnit = unit || initialUnit;
    const isBooking = activeUnit?.status?.toUpperCase() === 'BOOKING';
    const isTerjual = activeUnit?.status?.toUpperCase() === 'TERJUAL';

    // Fetch penjualan data as fallback if not pre-joined (e.g. from general list)
    const { data: penjualanData } = usePenjualanMobilList(
        (isBooking || isTerjual) && !activeUnit?.penjualan ? { mobil_id: activeUnit?.id } : undefined
    );

    // The active transaction is pre-joined by backend OR fallback to manual fetch
    const activeTx = activeUnit?.penjualan || penjualanData?.data?.find(
        (tx: any) => tx.mobil_id === activeUnit?.id && tx.status_bayar !== 'BATAL'
    );
    const cancelMutation = useCancelBookingMobil();

    // Fetch purchase debt if any
    const { data: hutangData } = useHutangList(
        activeUnit?.kode ? { search: activeUnit.kode } : undefined
    );

    const activeHutang = hutangData?.data?.find(
        (h: any) => h.nomor_referensi === activeUnit?.kode && h.status !== 'LUNAS'
    );

    if (!activeUnit) return null;

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'tersedia': return '#023C69';
            case 'booking': return '#FF9500';
            case 'terjual': return '#8E8E93';
            default: return '#EE2737';
        }
    };

    const handlePickMedia = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsMultipleSelection: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            const files = result.assets.map((asset) => ({
                uri: asset.uri,
                name: asset.fileName || `media_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg',
                blob: (asset as any).file, // On web, the actual File/Blob object is here
            }));

            try {
                if (!onlineManager.isOnline()) {
                    uploadMediaAction.mutate({ id: activeUnit.id, files });
                    Alert.alert('Offline Mode', 'Media akan diunggah saat koneksi tersedia.');
                    return;
                }
                await uploadMediaAction.mutateAsync({ id: activeUnit.id, files });
                Alert.alert('Berhasil', 'Media berhasil diunggah');
            } catch (error) {
                console.error('Upload error:', error);
                Alert.alert('Gagal Upload', 'Terjadi kesalahan saat mengunggah media. Silakan coba lagi.');
            }
        }
    };

    const handleShareGallery = async () => {
        const galleryUrl = `${(FILE_URL || 'https://tpm.cianjur.space')}/api/v1/public/gallery/mobil/${activeUnit.id}/view`;
        const shareTitle = `${activeUnit.merek} ${activeUnit.model} ${activeUnit.tahun}`;
        const shareMessage = `${shareTitle} - ${activeUnit.nomor_plat}\n\nLihat foto & video unit ini:\n${galleryUrl}`;

        try {
            if (Platform.OS === 'web') {
                // Web: Try native share first, fallback to clipboard
                if (navigator.share) {
                    await navigator.share({
                        title: shareTitle,
                        text: shareMessage,
                        url: galleryUrl,
                    });
                } else {
                    await navigator.clipboard.writeText(galleryUrl);
                    setShareSuccess(true);
                    setTimeout(() => setShareSuccess(false), 2000);
                }
            } else {
                // Native: Use React Native Share API
                await Share.share({
                    title: shareTitle,
                    message: shareMessage,
                    url: galleryUrl, // iOS only
                });
            }
        } catch (error: any) {
            if (error?.message !== 'Share dismissed') {
                console.error('Share error:', error);
                Alert.alert('Gagal', 'Tidak dapat membagikan galeri');
            }
        }
    };

    const handleShareReceipt = async () => {
        if (!activeUnit?.id) return;
        
        const baseUrl = (FILE_URL || 'https://tpm.cianjur.space').replace(/\/$/, '');
        const shareUrl = `${baseUrl}/api/v1/public/receipt/view/mobil/${activeUnit.id}`;
        const shareMessage = `Halo, ini adalah faktur penjualan unit mobil ${activeUnit.merek} ${activeUnit.model} Anda: ${shareUrl}`;
        
        try {
            if (Platform.OS === 'web') {
                if (navigator && navigator.clipboard) {
                    await navigator.clipboard.writeText(shareMessage);
                }
                // Open in new tab so user can see it
                window.open(shareUrl, '_blank');
                return;
            }

            await Share.share({
                message: shareMessage,
                url: shareUrl,
                title: 'Bagikan Faktur Penjualan'
            });
        } catch (error: any) {
            console.error('Error sharing link:', error);
            if (Platform.OS === 'web') {
                window.open(shareUrl, '_blank');
            } else {
                Alert.alert('Info', 'Faktur dapat dilihat pada: ' + shareUrl);
            }
        }
    };

    const confirmDeleteMedia = async () => {
        if (!deleteDialog.mediaId) return;

        try {
            if (!onlineManager.isOnline()) {
                deleteMediaAction.mutate({
                    id: activeUnit.id,
                    mediaId: deleteDialog.mediaId
                });
                Alert.alert('Offline Mode', 'Penghapusan media telah dijadwalkan.');
                setDeleteDialog({ visible: false, mediaId: null });
                return;
            }
            await deleteMediaAction.mutateAsync({
                id: activeUnit.id,
                mediaId: deleteDialog.mediaId
            });

            // Reset index if we deleted the last item
            if (activeIndex >= (activeUnit.media?.length || 0) - 1) {
                setActiveIndex(Math.max(0, (activeUnit.media?.length || 0) - 2));
            }

            setDeleteDialog({ visible: false, mediaId: null });
        } catch (error) {
            console.error('Delete error:', error);
            setDeleteDialog({ visible: false, mediaId: null });
        }
    };

    const renderMediaItem = (item: any) => {
        // Construct URL safely, avoiding double slashes
        const baseUrl = (FILE_URL || '').replace(/\/$/, '');
        const filePath = item.file_path.replace(/^\//, '');
        const fullUrl = `${baseUrl}/uploads/${filePath}`;

        console.log('[MobilDetail] Rendering media:', item.id, item.file_type, fullUrl);

        return (
            <View
                className="relative"
                style={{ width }}
            >
                <View className="h-96 bg-gray-100 overflow-hidden">
                    {item.file_type === 'video' ? (
                        <View className="flex-1 bg-black">
                            <Video
                                source={{ uri: fullUrl }}
                                rate={1.0}
                                volume={1.0}
                                isMuted={false}
                                resizeMode={ResizeMode.CONTAIN}
                                shouldPlay={false}
                                isLooping={false}
                                useNativeControls
                                style={{ width: '100%', height: '100%' }}
                                onError={(error) => console.log('[Video Error]:', error)}
                            />
                        </View>
                    ) : (
                        <Pressable
                            onPress={() => setSelectedImage(fullUrl)}
                            className="flex-1"
                        >
                            <Image
                                source={{ uri: fullUrl }}
                                className="w-full h-full"
                                resizeMode="cover"
                            />
                        </Pressable>
                    )}
                </View>

                {/* Delete Button - Glass Style */}
                <Pressable
                    onPress={() => {
                        console.log('[MobilDetail] Delete pressed for media:', item.id);
                        setDeleteDialog({ visible: true, mediaId: item.id });
                    }}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    className="absolute left-6 bg-red-500/80 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-lg z-50"
                    style={{ bottom: 64, elevation: 5 }}
                >
                    <Trash2 size={18} color="white" />
                </Pressable>
            </View>
        );
    };

        const ContentWrapper = Platform.OS === 'web' ? ScrollView : BottomSheetScrollView;

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="light-content" />
            <ContentWrapper showsVerticalScrollIndicator={false} className="flex-1">
                {/* Fixed Header Overlay (Mobile Style) */}
                <View className="absolute top-6 left-6 right-6 z-10 flex-row justify-between items-center">
                    <Pressable
                        onPress={onClose}
                        className="w-11 h-11 bg-black/40 backdrop-blur-md rounded-2xl items-center justify-center border border-white/20"
                    >
                        <X size={20} color="white" />
                    </Pressable>
                    <View className="flex-row gap-2">
                        <View style={{ backgroundColor: getStatusColor(activeUnit.status) + 'E6' }} className="backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-lg">
                            <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                {activeUnit.status}
                            </Typography>
                        </View>
                        {activeUnit.status_bayar_beli !== 'LUNAS' && (
                            <View className="bg-rose-600/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-lg">
                                <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                    HUTANG
                                </Typography>
                            </View>
                        )}
                        {activeUnit.status === 'booking' && (
                            <View className="bg-amber-500/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-lg">
                                <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                                    PIUTANG
                                </Typography>
                            </View>
                        )}
                    </View>
                </View>

                {/* Media Gallery Section */}
                <View className="bg-gray-100 relative">
                    {activeUnit.media && activeUnit.media.length > 0 ? (
                        <FlatList
                            data={activeUnit.media}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                setActiveIndex(index);
                            }}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item }) => renderMediaItem(item)}
                        />
                    ) : (
                        <View className="h-80 bg-emerald-50 items-center justify-center">
                            <ImageIcon size={80} color="#10B981" opacity={0.1} />
                            <Typography className="text-emerald-900/30 font-bold mt-4 uppercase tracking-[4px]">No Media</Typography>
                        </View>
                    )}

                    {/* Pagination Dots */}
                    {activeUnit.media && activeUnit.media.length > 1 && (
                        <View className="absolute flex-row self-center space-x-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5" style={{ bottom: 64 }}>
                            {activeUnit.media.map((_: any, i: number) => (
                                <View
                                    key={i}
                                    className={`h-1.5 rounded-full ${i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                                />
                            ))}
                        </View>
                    )}

                    {/* Media Quick Actions */}
                    <View className="absolute right-6 flex-row gap-2" style={{ bottom: 64 }}>
                        {activeUnit.media && activeUnit.media.length > 0 && (
                            <Pressable
                                onPress={handleShareGallery}
                                className="w-14 h-14 bg-emerald-500 rounded-2xl items-center justify-center shadow-2xl border border-emerald-400/30"
                            >
                                {shareSuccess ? (
                                    <CheckCircle2 size={22} color="white" />
                                ) : (
                                    <Share2 size={22} color="white" />
                                )}
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handlePickMedia}
                            disabled={uploadMediaAction.isPending}
                            className="w-14 h-14 bg-white rounded-2xl items-center justify-center shadow-2xl border border-gray-100"
                        >
                            {uploadMediaAction.isPending ? (
                                <ActivityIndicator size="small" color="#023C69" />
                            ) : (
                                <Plus size={24} color="#023C69" strokeWidth={3} />
                            )}
                        </Pressable>
                    </View>
                </View>

                <View className="bg-white -mt-8 rounded-t-[48px] px-6 pt-10">
                    {/* Badge & Title */}
                    <View className="items-center mb-10">
                        <View className="bg-primary/10 px-4 py-1.5 rounded-full mb-3 border border-primary/5">
                            <Typography variant="caption" weight="bold" className="text-primary text-[10px] uppercase tracking-widest">
                                {activeUnit.tahun} • {activeUnit.nomor_plat}
                            </Typography>
                        </View>
                        <Typography variant="h1" weight="bold" className="text-3xl tracking-tighter text-textMain text-center mb-2">
                            {activeUnit.merek} {activeUnit.model}
                        </Typography>

                        <View className="mt-4 bg-emerald-50/50 px-8 py-5 rounded-[36px] border border-emerald-100 items-center w-full">
                            <Typography variant="caption" className="text-emerald-600 font-bold uppercase tracking-[2px] mb-1 text-[10px]">Estimasi Modal Unit</Typography>
                            <Typography variant="h1" weight="bold" className="text-primary text-4xl">
                                {formatCurrency(Number(activeUnit.harga_beli || 0) + Number(activeUnit.total_biaya || 0) + Number(activeUnit.total_part_service || 0))}
                            </Typography>
                        </View>
                    </View>

                    {/* Bento Specs Grid - PREMIUM DESIGN */}
                    <View className="flex-row justify-between mb-8">
                        <SpecCard icon={Calendar} label="Tahun" value={activeUnit.tahun} color="#3B82F6" />
                        <SpecCard icon={GaugeCircle} label="Kilometer" value={`${activeUnit.kilometer?.toLocaleString()} KM`} color="#F59E0B" />
                    </View>
                    <View className="flex-row justify-between mb-10">
                        <SpecCard icon={Settings} label="Transmisi" value={activeUnit.transmisi} color="#10B981" />
                        <SpecCard icon={Palette} label="Warna" value={activeUnit.warna} color="#6366F1" />
                    </View>

                    {/* Extended Info Cards */}
                    <Typography variant="h3" weight="bold" className="mb-6 text-textMain tracking-tight">Data Teknis & Investasi</Typography>

                    <Card variant="outlined" className="p-0 border-gray-100 rounded-[32px] overflow-hidden bg-gray-50/30 mb-8">
                        <DetailRow icon={FileText} label="Kepemilikan" value={activeUnit.tipe_kepemilikan} />
                        <DetailRow icon={Palette} label="Nama Investor" value={activeUnit.nama_investor || 'TPM'} />
                        {Number(activeUnit.nominal_investor || 0) > 0 && (
                            <DetailRow icon={Wallet} label="Nominal Modal Investor" value={formatCurrency(activeUnit.nominal_investor)} />
                        )}
                        <DetailRow icon={Settings} label="Nomor Rangka" value={activeUnit.nomor_rangka} />
                        <DetailRow icon={Settings} label="Nomor Mesin" value={activeUnit.nomor_mesin} last />
                    </Card>

                    {/* Finance Breakdown Card */}
                    <Typography variant="h3" weight="bold" className="mb-6 text-textMain tracking-tight">Rincian Finansial</Typography>
                    <Card className="p-6 rounded-[36px] bg-white border border-gray-100 shadow-xl shadow-black/5 mb-10">
                        <View className="flex-row justify-between items-center mb-5 pb-5 border-b border-gray-50">
                            <View>
                                <Typography variant="caption" className="text-textGray mb-1">Harga Beli Awal</Typography>
                                <Typography variant="h3" weight="bold" className="text-textMain">{formatCurrency(activeUnit.harga_beli)}</Typography>
                            </View>
                            <View className="w-12 h-12 bg-emerald-50 rounded-2xl items-center justify-center">
                                <CircleDollarSign size={20} color="#10B981" />
                            </View>
                        </View>

                        {Number(activeUnit.nominal_investor || 0) > 0 && (
                            <View className="flex-row justify-between items-center mb-5 pb-5 border-b border-gray-50">
                                <View>
                                    <Typography variant="caption" className="text-textGray mb-1">Nominal Modal Investor</Typography>
                                    <Typography variant="h3" weight="bold" className="text-indigo-600">{formatCurrency(activeUnit.nominal_investor)}</Typography>
                                </View>
                                <View className="w-12 h-12 bg-indigo-50 rounded-2xl items-center justify-center">
                                    <Wallet size={20} color="#4F46E5" />
                                </View>
                            </View>
                        )}

                        <View className="flex-row justify-between items-center mb-5 pb-5 border-b border-gray-50">
                            <View>
                                <Typography variant="caption" className="text-textGray mb-1">Total Biaya & Sparepart</Typography>
                                <Typography variant="h3" weight="bold" className="text-orange-500">{formatCurrency(Number(activeUnit.total_biaya || 0) + Number(activeUnit.total_part_service || 0))}</Typography>
                            </View>
                            <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                                <Settings size={20} color="#F97316" />
                            </View>
                        </View>

                        {activeUnit.harga_jual > 0 && (
                            <>
                                <View className="flex-row justify-between items-center">
                                    <View>
                                        <Typography variant="caption" className="text-blue-500 font-bold mb-1">Terjual Seharga</Typography>
                                        <Typography variant="h2" weight="bold" className="text-blue-600">{formatCurrency(activeUnit.harga_jual)}</Typography>
                                    </View>
                                    <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center">
                                        <TrendingUp size={20} color="#2563EB" />
                                    </View>
                                </View>
                                
                                {activeTx && (
                                    <View className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100/50 mt-4">
                                        <Typography className="text-blue-700 text-[10px] font-black uppercase tracking-wider mb-3">Detail Transaksi Penjualan</Typography>
                                        
                                        <View className="space-y-2">
                                            {activeTx.nomor_transaksi && (
                                                <View className="flex-row justify-between py-0.5">
                                                    <Typography className="text-textGray/60 text-xs font-semibold">No. Transaksi</Typography>
                                                    <Typography className="text-textMain text-xs font-bold">{activeTx.nomor_transaksi}</Typography>
                                                </View>
                                            )}
                                            {(activeTx.tanggal || activeTx.created_at) && (
                                                <View className="flex-row justify-between py-0.5">
                                                    <Typography className="text-textGray/60 text-xs font-semibold">Tanggal Terjual</Typography>
                                                    <Typography className="text-textMain text-xs font-bold">{formatDate(activeTx.tanggal || activeTx.created_at)}</Typography>
                                                </View>
                                            )}
                                            {activeTx.nama_pembeli && (
                                                <View className="flex-row justify-between py-0.5">
                                                    <Typography className="text-textGray/60 text-xs font-semibold">Pembeli</Typography>
                                                    <Typography className="text-textMain text-xs font-bold">{activeTx.nama_pembeli}</Typography>
                                                </View>
                                            )}
                                            {activeTx.metode_bayar && (
                                                <View className="flex-row justify-between py-0.5">
                                                    <Typography className="text-textGray/60 text-xs font-semibold">Metode Pembayaran</Typography>
                                                    <Typography className="text-textMain text-xs font-bold uppercase">{activeTx.metode_bayar}</Typography>
                                                </View>
                                            )}
                                            {activeTx.status_bayar && (
                                                <View className="flex-row justify-between py-0.5">
                                                    <Typography className="text-textGray/60 text-xs font-semibold">Status Pembayaran</Typography>
                                                    <Typography className={`text-xs font-bold uppercase ${
                                                        activeTx.status_bayar === 'LUNAS' ? 'text-emerald-600' :
                                                        activeTx.status_bayar === 'PARTIAL' ? 'text-amber-600' : 'text-rose-600'
                                                    }`}>{activeTx.status_bayar}</Typography>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}
                            </>
                        )}
                    </Card>

                    {/* PURCHASE Debt Section */}
                    {activeHutang && (
                        <View className="mb-10">
                            <Typography variant="h3" weight="bold" className="mb-6 text-textMain tracking-tight">Status Hutang Pembelian</Typography>
                            <Card className="p-0 rounded-[36px] overflow-hidden border-2 border-rose-200 bg-rose-50/30 shadow-xl shadow-rose-900/5">
                                {/* Header */}
                                <View className="bg-rose-500 px-6 py-4 flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <Wallet size={18} color="white" />
                                        <Typography weight="bold" className="text-white ml-2 uppercase tracking-wider text-xs">Hutang Belum Lunas</Typography>
                                    </View>
                                    <View className="bg-white/20 px-3 py-1 rounded-full">
                                        <Typography className="text-white text-xs font-bold">{activeHutang.nomor_hutang}</Typography>
                                    </View>
                                </View>

                                {/* Debt Info */}
                                <View className="p-6">
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-rose-100">
                                        <Typography className="text-gray-500">Harga Beli</Typography>
                                        <Typography weight="bold" className="text-textMain">{formatCurrency(activeHutang.nominal_hutang)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-rose-100">
                                        <Typography className="text-gray-500">Total Terbayar</Typography>
                                        <Typography weight="bold" className="text-emerald-600">{formatCurrency(activeHutang.total_dibayar)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-6">
                                        <Typography className="text-gray-500">Sisa Hutang</Typography>
                                        <Typography variant="h3" weight="bold" className="text-red-500">{formatCurrency(activeHutang.sisa_hutang)}</Typography>
                                    </View>

                                    <Button
                                        title="Pelunasan Hutang Unit"
                                        onPress={() => setHutangModalVisible(true)}
                                        className="rounded-2xl h-14 bg-rose-600 mb-0 shadow-lg shadow-rose-900/20"
                                        icon={<TrendingUp size={20} color="white" />}
                                    />
                                </View>
                            </Card>
                        </View>
                    )}

                    {/* BOOKING Payment Section */}
                    {isBooking && activeTx && (
                        <View className="mb-10">
                            <Typography variant="h3" weight="bold" className="mb-6 text-textMain tracking-tight">Status Booking</Typography>
                            <Card className="p-0 rounded-[36px] overflow-hidden border-2 border-amber-200 bg-amber-50/30 shadow-xl shadow-amber-900/5">
                                {/* Header */}
                                <View className="bg-amber-500 px-6 py-4 flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <Clock size={18} color="white" />
                                        <Typography weight="bold" className="text-white ml-2 uppercase tracking-wider text-xs">Menunggu Pelunasan</Typography>
                                    </View>
                                    <View className="bg-white/20 px-3 py-1 rounded-full">
                                        <Typography className="text-white text-xs font-bold">{activeTx.nomor_transaksi}</Typography>
                                    </View>
                                </View>

                                {/* Payment Info */}
                                <View className="p-6">
                                    {(activeTx.tanggal || activeTx.created_at) && (
                                        <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-amber-100">
                                            <Typography className="text-gray-500">Tanggal Booking</Typography>
                                            <Typography weight="bold" className="text-textMain">{formatDate(activeTx.tanggal || activeTx.created_at)}</Typography>
                                        </View>
                                    )}
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-amber-100">
                                        <Typography className="text-gray-500">Pembeli</Typography>
                                        <Typography weight="bold" className="text-textMain">{activeTx.nama_pembeli}</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-amber-100">
                                        <Typography className="text-gray-500">Harga Jual</Typography>
                                        <Typography weight="bold" className="text-textMain">{formatCurrency(activeTx.harga_jual)}</Typography>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-amber-100">
                                        <Typography className="text-gray-500">DP Terbayar</Typography>
                                        <Typography weight="bold" className="text-emerald-600">{formatCurrency(activeTx.dp)}</Typography>
                                    </View>
                                    {activeTx.metode_bayar && (
                                        <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-amber-100">
                                            <Typography className="text-gray-500">Metode Bayar DP</Typography>
                                            <Typography weight="bold" className="text-textMain uppercase">{activeTx.metode_bayar}</Typography>
                                        </View>
                                    )}
                                    {activeTx.status_bayar && (
                                        <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-amber-100">
                                            <Typography className="text-gray-500">Status Pembayaran</Typography>
                                            <Typography weight="bold" className={`uppercase ${
                                                activeTx.status_bayar === 'LUNAS' ? 'text-emerald-600' :
                                                activeTx.status_bayar === 'PARTIAL' ? 'text-amber-600' : 'text-rose-600'
                                            }`}>{activeTx.status_bayar}</Typography>
                                        </View>
                                    )}
                                    <View className="flex-row justify-between items-center mb-6">
                                        <Typography className="text-gray-500">Sisa Bayar</Typography>
                                        <Typography variant="h3" weight="bold" className="text-red-500">{formatCurrency(activeTx.sisa_bayar)}</Typography>
                                    </View>

                                    <View className="bg-white/50 border border-amber-200 py-4 rounded-2xl items-center mb-6">
                                        <Info size={18} color="#D97706" />
                                        <Typography weight="bold" className="text-amber-700 text-xs ml-2 text-center px-4">Pastikan nominal yang diterima sesuai dengan sisa pelunasan</Typography>
                                    </View>

                                    {activeTx.piutang_id && (
                                        <Button
                                            title="Pelunasan / Bayar Cicilan"
                                            onPress={() => setPaymentModalVisible(true)}
                                            className="rounded-2xl h-14 bg-emerald-600 mb-3 shadow-lg shadow-emerald-900/20"
                                            icon={<TrendingUp size={20} color="white" />}
                                        />
                                    )}

                                    {/* Cancel Booking Button */}
                                    <Pressable
                                        onPress={() => {
                                            setCancelPenalti('');
                                            setCancelAlasan('');
                                            setRefundSplits([{ metode: 'TUNAI', nominal: String(activeTx.dp) }]);
                                            setCancelSuccess(false);
                                            setShowCancelModal(true);
                                        }}
                                        className="bg-white flex-row items-center justify-center py-4 rounded-2xl border-2 border-red-200"
                                    >
                                        <Ban size={18} color="#EF4444" />
                                        <Typography weight="bold" className="text-red-500 text-base ml-2">Batalkan Booking</Typography>
                                    </Pressable>
                                </View>
                            </Card>
                        </View>
                    )}

                    {/* Related Workshop Transactions */}
                    {activeUnit && <RelatedBengkelTransactions mobil_id={activeUnit.id} />}

                    {/* Notes Section with Style */}
                    {activeUnit.catatan && (
                        <View className="mb-10">
                            <Typography variant="h3" weight="bold" className="mb-4 text-textMain">Catatan Unit</Typography>
                            <View className="bg-orange-50/50 p-6 rounded-[32px] border border-orange-100 border-dashed">
                                <Typography variant="body1" className="text-orange-900 leading-relaxed italic opacity-80">
                                    "{activeUnit.catatan}"
                                </Typography>
                            </View>
                        </View>
                    )}

                    {/* Primary Support Action */}
                    <View className="flex-row space-x-3 mb-6">
                        {activeUnit.status?.toUpperCase() === 'TERSEDIA' && (
                            <Pressable
                                onPress={() => onSell?.(activeUnit)}
                                className="flex-1 bg-emerald-600 flex-row items-center justify-center py-5 rounded-[28px] shadow-2xl shadow-emerald-900/20"
                            >
                                <CircleDollarSign size={20} color="white" />
                                <Typography weight="bold" className="text-white text-lg ml-3">Jual Unit</Typography>
                            </Pressable>
                        )}
                        {activeUnit.status?.toUpperCase() !== 'TERJUAL' && (
                            <Pressable
                                onPress={onEdit}
                                className={`flex-1 bg-primary flex-row items-center justify-center py-5 rounded-[28px] shadow-2xl shadow-primary/40 ${!(activeUnit.status?.toLowerCase() === 'tersedia' || activeUnit.status?.toLowerCase() === 'booking') ? 'w-full' : ''}`}
                            >
                                <Edit size={20} color="white" />
                                <Typography weight="bold" className="text-white text-lg ml-3">Edit Data</Typography>
                            </Pressable>
                        )}

                        {activeUnit.status?.toUpperCase() === 'TERJUAL' && (
                            <Pressable
                                onPress={handleShareReceipt}
                                className="flex-1 bg-blue-600 flex-row items-center justify-center py-5 rounded-[28px] shadow-2xl shadow-blue-900/20 w-full"
                            >
                                <Share2 size={20} color="white" />
                                <Typography weight="bold" className="text-white text-lg ml-3">Bagikan Faktur</Typography>
                            </Pressable>
                        )}
                    </View>

                    {/* Extra Bottom Padding */}
                    <View className="h-10" />
                </View>
            </ContentWrapper>

            <AlertDialog
                visible={deleteDialog.visible}
                type="confirm"
                variant="error"
                title="Hapus Media"
                message="Apakah Anda yakin ingin menghapus media ini? Tindakan ini tidak dapat dibatalkan."
                confirmText="Hapus"
                cancelText="Batal"
                loading={deleteMediaAction.isPending}
                onClose={() => setDeleteDialog({ visible: false, mediaId: null })}
                onConfirm={confirmDeleteMedia}
            />

            {/* Image Detail Viewer (Full Screen Modal) */}
            <Modal
                visible={!!selectedImage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedImage(null)}
            >
                <View className="flex-1 bg-black/95 items-center justify-center">
                    <Pressable
                        onPress={() => setSelectedImage(null)}
                        className="absolute top-12 right-6 z-20 w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-white/20"
                    >
                        <X size={24} color="white" />
                    </Pressable>

                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage }}
                            className="w-full h-[70%]"
                            resizeMode="contain"
                        />
                    )}

                    <View className="absolute bottom-12">
                        <Typography className="text-white/50 text-xs font-bold uppercase tracking-widest text-center">
                            Ketuk untuk menutup
                        </Typography>
                    </View>
                </View>
            </Modal>


            {/* Cancel Booking Modal */}
            <Modal
                visible={showCancelModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCancelModal(false)}
            >
                <View className="flex-1 bg-black/60 justify-end">
                    <View className="bg-white rounded-t-[36px] px-6 pt-8 pb-10">
                        {/* Modal Header */}
                        <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Typography variant="h2" weight="bold" className="text-red-600">Batalkan Booking</Typography>
                                <Typography variant="caption" className="text-gray-400 mt-1">{activeTx?.nomor_transaksi}</Typography>
                            </View>
                            <Pressable
                                onPress={() => {
                                    setShowCancelModal(false);
                                    setCancelSuccess(false);
                                }}
                                className="w-10 h-10 bg-gray-100 rounded-2xl items-center justify-center"
                            >
                                <X size={18} color="#6B7280" />
                            </Pressable>
                        </View>

                        {!activeTx && !cancelSuccess ? (
                            <View className="items-center py-20">
                                <ActivityIndicator size="large" color="#EF4444" />
                                <Typography className="text-gray-400 mt-6 text-center px-10">
                                    Mengambil data transaksi...{'\n'}Silakan tunggu sebentar.
                                </Typography>
                            </View>
                        ) : cancelSuccess ? (
                            <View className="items-center py-8">
                                <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-4">
                                    <Ban size={40} color="#EF4444" />
                                </View>
                                <Typography variant="h3" weight="bold" className="text-red-600 mb-2">Booking Dibatalkan</Typography>
                                <Typography className="text-gray-400 text-center">Mobil kembali ke status TERSEDIA</Typography>
                                <Pressable
                                    onPress={() => {
                                        setShowCancelModal(false);
                                        setCancelSuccess(false);
                                    }}
                                    className="mt-6 bg-gray-800 px-8 py-4 rounded-2xl"
                                >
                                    <Typography weight="bold" className="text-white">Tutup</Typography>
                                </Pressable>
                            </View>
                        ) : (
                            <View className="h-full max-h-[600px]">
                                {cancelError && (
                                    <View className="bg-red-50 p-4 rounded-xl mb-4 border border-red-200">
                                        <Typography className="text-red-600 text-sm">{cancelError}</Typography>
                                    </View>
                                )}
                                <ScrollView showsVerticalScrollIndicator={false} className="flex-1 pb-4">
                                    {/* Warning Card */}
                                    <View className="bg-red-50 p-5 rounded-2xl mb-6 border border-red-100 flex-row items-start">
                                        <AlertTriangle size={20} color="#EF4444" />
                                        <View className="ml-3 flex-1">
                                            <Typography weight="bold" className="text-red-600 mb-1">Perhatian</Typography>
                                            <Typography variant="caption" className="text-red-500 leading-relaxed">Pembatalan akan mengembalikan mobil ke status TERSEDIA. Anda bisa menentukan penalti dari DP yang sudah dibayar.</Typography>
                                        </View>
                                    </View>

                                {/* DP Summary */}
                                <View className="bg-amber-50 p-5 rounded-2xl mb-6 border border-amber-100">
                                    <Typography variant="caption" className="text-amber-500 font-bold uppercase tracking-wider text-[10px] mb-1">DP yang sudah dibayar</Typography>
                                    <Typography variant="h2" weight="bold" className="text-amber-600">{formatCurrency(activeTx?.dp || 0)}</Typography>
                                </View>

                                {/* Penalty Input */}
                                <View className="mb-5">
                                    <Typography weight="bold" className="text-textMain mb-2">Penalti Pembatalan</Typography>
                                    <TextInput
                                        className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-lg font-bold text-textMain"
                                        value={formatNumber(cancelPenalti)}
                                        onChangeText={(val) => {
                                            const cleanVal = String(parseNumber(val));
                                            setCancelPenalti(cleanVal);
                                            // Reset refund splits to use new calculated amount if not in split mode
                                            if (!useRefundSplit) {
                                                const dp = parseFloat(String(activeTx?.dp || 0));
                                                const refundVal = Math.max(0, dp - parseFloat(cleanVal));
                                                setRefundSplits([{ metode: refundSplits[0]?.metode || 'TUNAI', nominal: String(refundVal) }]);
                                            }
                                        }}
                                        keyboardType="numeric"
                                        placeholder="0"
                                    />
                                    <Typography variant="caption" className="text-gray-400 mt-2">Maks: {formatCurrency(activeTx?.dp || 0)}</Typography>
                                </View>

                                {/* Refund Preview */}
                                {(() => {
                                    const dp = parseFloat(String(activeTx?.dp || 0));
                                    const penaltiVal = parseFloat(cancelPenalti) || 0;
                                    const refundVal = Math.max(0, dp - penaltiVal);
                                    return (
                                        <View className="bg-gray-50 p-5 rounded-2xl mb-5 border border-gray-100">
                                            <Typography variant="caption" className="text-gray-400 font-bold uppercase tracking-wider text-[10px] mb-3">Rincian Pembatalan</Typography>
                                            <View className="flex-row justify-between items-center mb-2">
                                                <Typography className="text-gray-500">DP Terbayar</Typography>
                                                <Typography weight="bold" className="text-textMain">{formatCurrency(dp)}</Typography>
                                            </View>
                                            <View className="flex-row justify-between items-center mb-2">
                                                <Typography className="text-red-500">Penalti</Typography>
                                                <Typography weight="bold" className="text-red-500">- {formatCurrency(penaltiVal)}</Typography>
                                            </View>
                                            <View className="border-t border-gray-200 mt-2 pt-3 flex-row justify-between items-center">
                                                <View className="flex-row items-center">
                                                    <ArrowDownLeft size={16} color="#10B981" />
                                                    <Typography weight="bold" className="text-emerald-600 ml-1">Refund ke Pembeli</Typography>
                                                </View>
                                                <Typography variant="h3" weight="bold" className="text-emerald-600">{formatCurrency(refundVal)}</Typography>
                                            </View>
                                        </View>
                                    );
                                })()}

                                {/* Split Refund Toggle (only if refund > 0) */}
                                {Math.max(0, parseFloat(String(activeTx?.dp || 0)) - (parseFloat(cancelPenalti) || 0)) > 0 && (
                                    <View className="mb-6 flex-row justify-between items-center bg-gray-50/80 p-5 rounded-[28px] border border-gray-100">
                                        <View className="flex-row items-center">
                                            <View className="w-10 h-10 bg-primary/10 rounded-xl items-center justify-center mr-3">
                                                <ArrowDownLeft size={18} color="#023C69" />
                                            </View>
                                            <View>
                                                <Typography weight="bold" className="text-textMain text-sm">Split Refund</Typography>
                                                <Typography variant="caption" className="text-textGray">Refund dengan beberapa metode</Typography>
                                            </View>
                                        </View>
                                        <Pressable
                                            onPress={() => {
                                                setUseRefundSplit(!useRefundSplit);
                                                if (useRefundSplit) {
                                                    const dp = parseFloat(String(activeTx?.dp || 0));
                                                    const refundVal = Math.max(0, dp - parseFloat(cancelPenalti));
                                                    setRefundSplits([{ metode: 'TUNAI', nominal: String(refundVal) }]);
                                                }
                                            }}
                                            className={`w-12 h-7 rounded-full px-1 justify-center ${useRefundSplit ? 'bg-primary' : 'bg-gray-300'}`}
                                        >
                                            <View className={`w-5 h-5 bg-white rounded-full shadow-sm ${useRefundSplit ? 'self-end' : 'self-start'}`} />
                                        </Pressable>
                                    </View>
                                )}

                                {/* Refund Methods Selection */}
                                {Math.max(0, parseFloat(String(activeTx?.dp || 0)) - (parseFloat(cancelPenalti) || 0)) > 0 && (
                                    !useRefundSplit ? (
                                        <View className="mb-8">
                                            <Typography weight="bold" className="text-textMain mb-3">Metode Refund</Typography>
                                            <View className="flex-row space-x-3">
                                                {['TUNAI', 'TRANSFER'].map((method) => (
                                                    <Pressable
                                                        key={method}
                                                        onPress={() => setRefundSplits([{ metode: method, nominal: String(Math.max(0, parseFloat(String(activeTx?.dp || 0)) - (parseFloat(cancelPenalti) || 0))) }])}
                                                        className={`flex-1 flex-row items-center justify-center py-4 rounded-2xl border-2 ${refundSplits[0]?.metode === method
                                                            ? method === 'TUNAI' ? 'bg-emerald-50 border-emerald-500' : 'bg-blue-50 border-blue-500'
                                                            : 'bg-gray-50 border-gray-200'
                                                            }`}
                                                    >
                                                        {method === 'TUNAI' ? <Banknote size={20} color={refundSplits[0]?.metode === 'TUNAI' ? '#10B981' : '#9CA3AF'} /> : <CreditCard size={20} color={refundSplits[0]?.metode === 'TRANSFER' ? '#3B82F6' : '#9CA3AF'} />}
                                                        <Typography weight="bold" className={`ml-2 ${refundSplits[0]?.metode === method ? (method === 'TUNAI' ? 'text-emerald-600' : 'text-blue-600') : 'text-gray-400'}`}>{method === 'TUNAI' ? 'Tunai' : 'Transfer'}</Typography>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        </View>
                                    ) : (
                                        <View className="mb-8 p-5 bg-gray-50/50 rounded-[32px] border border-gray-100/50">
                                            <Typography weight="bold" className="text-textMain mb-4">Rincian Split Refund</Typography>
                                            {refundSplits.map((split, index) => (
                                                <View key={index} className="mb-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm shadow-black/5">
                                                    <View className="flex-row justify-between items-center mb-3">
                                                        <View className="flex-row items-center">
                                                            {split.metode === 'TUNAI' ? <Banknote size={14} color="#10B981" /> : <CreditCard size={14} color="#3B82F6" />}
                                                            <Typography weight="bold" className="text-textGray text-[10px] ml-1 uppercase">{split.metode}</Typography>
                                                        </View>
                                                        <View className="flex-row space-x-1">
                                                            {['TUNAI', 'TRANSFER'].map((m) => (
                                                                <Pressable
                                                                    key={m}
                                                                    onPress={() => {
                                                                        const next = [...refundSplits];
                                                                        next[index].metode = m;
                                                                        setRefundSplits(next);
                                                                    }}
                                                                    className={`px-3 py-1 rounded-full border ${split.metode === m ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                                                                >
                                                                    <Typography className={`text-[9px] font-bold ${split.metode === m ? 'text-white' : 'text-gray-400'}`}>{m}</Typography>
                                                                </Pressable>
                                                            ))}
                                                        </View>
                                                    </View>
                                                    <TextInput
                                                        className="bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 font-bold text-textMain text-base"
                                                        value={formatNumber(split.nominal)}
                                                        onChangeText={(val) => {
                                                            const cleanVal = String(parseNumber(val));
                                                            const next = [...refundSplits];
                                                            next[index].nominal = cleanVal;
                                                            setRefundSplits(next);
                                                        }}
                                                        keyboardType="numeric"
                                                        placeholder="0"
                                                    />
                                                </View>
                                            ))}
                                        </View>
                                    )
                                )}

                                {/* Reason */}
                                <View className="mb-8">
                                    <Typography weight="bold" className="text-textMain mb-2">Alasan Pembatalan (opsional)</Typography>
                                    <TextInput
                                        className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-base text-textMain"
                                        value={cancelAlasan}
                                        onChangeText={setCancelAlasan}
                                        placeholder="Contoh: Pembeli mengundurkan diri"
                                        multiline
                                        numberOfLines={3}
                                        textAlignVertical="top"
                                        style={{ minHeight: 80 }}
                                    />
                                </View>
                                </ScrollView>

                                {/* Submit Button - Fixed at bottom */}
                                <View className="pt-6 border-t border-gray-100 mt-2">
                                    {isConfirmingCancel && (
                                        <View className="bg-red-50 p-5 rounded-2xl mb-4 border border-red-100">
                                            <View className="flex-row items-center mb-2">
                                                <AlertTriangle size={18} color="#EF4444" />
                                                <Typography weight="bold" className="text-red-600 ml-2">Konfirmasi Terakhir</Typography>
                                            </View>
                                            <Typography variant="caption" className="text-red-500 leading-relaxed">
                                                Anda akan membatalkan booking ini dengan penalti {formatCurrency(parseNumber(cancelPenalti))}. 
                                                Tindakan ini tidak dapat dibatalkan.
                                            </Typography>
                                            <TouchableOpacity 
                                                onPress={() => setIsConfirmingCancel(false)}
                                                className="mt-3"
                                            >
                                                <Typography weight="bold" className="text-gray-500 text-xs">Ubah rincian pembatalan</Typography>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        disabled={cancelMutation.isPending || !activeTx}
                                        onPress={() => {
                                            try {
                                                if (!activeTx) {
                                                    const msg = 'Data transaksi booking tidak ditemukan. Silakan refresh halaman.';
                                                    setCancelError(msg);
                                                    if (Platform.OS === 'web') window.alert(msg);
                                                    else Alert.alert('Error', msg);
                                                    return;
                                                }

                                                const penaltiVal = parseNumber(cancelPenalti) || 0;
                                                const dpVal = Math.round(parseFloat(String(activeTx.dp || 0)));
                                                const totalRefundNeeded = Math.max(0, dpVal - penaltiVal);

                                                const refundPayments = refundSplits
                                                    .filter(p => parseNumber(p.nominal) > 0)
                                                    .map(p => ({
                                                        metode: p.metode,
                                                        nominal: parseNumber(p.nominal)
                                                    }));

                                                const totalRefundInput = refundPayments.reduce((acc, curr) => acc + curr.nominal, 0);

                                                if (totalRefundNeeded > 0 && Math.abs(totalRefundInput - totalRefundNeeded) > 1) {
                                                    const msg = `Total refund (${formatCurrency(totalRefundInput)}) harus sama dengan sisa DP (${formatCurrency(totalRefundNeeded)})`;
                                                    setCancelError(msg);
                                                    if (Platform.OS === 'web') window.alert(msg);
                                                    else Alert.alert('Error', msg);
                                                    return;
                                                }

                                                setCancelError(null);

                                                if (!isConfirmingCancel) {
                                                    setIsConfirmingCancel(true);
                                                } else {
                                                    cancelMutation.mutate(
                                                        {
                                                            id: activeTx.id,
                                                            data: {
                                                                penalti: penaltiVal,
                                                                metode_refund: !useRefundSplit ? refundSplits[0]?.metode : undefined,
                                                                refund_payments: useRefundSplit ? refundPayments : undefined,
                                                                alasan: cancelAlasan,
                                                            },
                                                        },
                                                        {
                                                            onSuccess: () => {
                                                                setCancelSuccess(true);
                                                                setIsConfirmingCancel(false);
                                                            },
                                                            onError: (err: any) => {
                                                                const detail = err?.response?.data?.detail;
                                                                const errorMsg = typeof detail === 'string' ? detail : (detail?.message || JSON.stringify(detail) || 'Gagal membatalkan booking');
                                                                setCancelError(errorMsg);
                                                                if (Platform.OS === 'web') window.alert(errorMsg);
                                                                else Alert.alert('Error', errorMsg);
                                                            },
                                                        },
                                                    );
                                                }
                                            } catch (e: any) {
                                                console.error('[Cancel Error]:', e);
                                                setCancelError(`Terjadi kesalahan sistem: ${e.message || 'Unknown error'}`);
                                            }
                                        }}
                                        className={`flex-row items-center justify-center py-5 rounded-2xl shadow-lg ${(cancelMutation.isPending || !activeTx) ? 'bg-gray-300' : 'bg-red-600 shadow-red-900/20'}`}
                                    >
                                        {cancelMutation.isPending ? (
                                            <ActivityIndicator size="small" color="white" />
                                        ) : (
                                            <>
                                                {isConfirmingCancel ? <CheckCircle2 size={20} color="white" /> : <Ban size={20} color="white" />}
                                                <Typography weight="bold" className="text-white text-base ml-2">
                                                    {isConfirmingCancel ? 'Ya, Batalkan Booking Sekarang' : 'Proses Pembatalan'}
                                                </Typography>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>


            {activeTx && activeTx.piutang_id && (
                <PaymentModal
                    visible={paymentModalVisible}
                    onClose={() => setPaymentModalVisible(false)}
                    onSuccess={() => {
                        setPaymentModalVisible(false);
                        Alert.alert('Sukses', 'Pembayaran berhasil dicatat');
                        onClose();
                    }}
                    id={activeTx.piutang_id}
                    initialAmount={Number(activeTx.sisa_bayar)}
                    title="Pelunasan Unit Mobil"
                    unit="JUAL_BELI_MOBIL"
                    kas_jenis="KAS_UNIT_MOBIL"
                />
            )}

            {activeHutang && (
                <PaymentModal
                    visible={hutangModalVisible}
                    onClose={() => setHutangModalVisible(false)}
                    onSuccess={() => {
                        setHutangModalVisible(false);
                        Alert.alert('Sukses', 'Pelunasan hutang berhasil dicatat');
                        onClose();
                    }}
                    id={activeHutang.id}
                    initialAmount={Number(activeHutang.sisa_hutang)}
                    title="Pelunasan Hutang Unit"
                    type="hutang"
                    unit="JUAL_BELI_MOBIL"
                    kas_jenis="KAS_UNIT_MOBIL"
                />
            )}
        </View>
    );
};

// Helper Component for Premium Specs
const SpecCard = ({ icon: Icon, label, value, color }: any) => (
    <View className="w-[48%] bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
        <View className="w-11 h-11 rounded-2xl self-start mb-4 items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            <Icon size={20} color={color} />
        </View>
        <Typography variant="caption" className="text-textGray font-bold uppercase tracking-wider text-[9px] mb-1">{label}</Typography>
        <Typography variant="h3" weight="bold" className="text-textMain text-lg" numberOfLines={1}>{value || '-'}</Typography>
    </View>
);

const DetailRow = ({ icon: Icon, label, value, last }: { icon: any, label: string, value?: string | number, last?: boolean }) => (
    <View className={`flex-row justify-between items-center px-6 py-5 ${!last ? 'border-b border-gray-50' : ''}`}>
        <View className="flex-row items-center">
            <Icon size={18} color="#9CA3AF" />
            <Typography className="text-textGray font-medium ml-3">{label}</Typography>
        </View>
        <Typography weight="bold" className="text-textMain">{value || '-'}</Typography>
    </View>
);
