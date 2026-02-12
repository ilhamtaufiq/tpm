import React, { useState } from 'react';
import { View, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator, FlatList, Dimensions, StatusBar, Modal } from 'react-native';
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
    Image as ImageIcon
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
// import { Video, ResizeMode } from 'expo-av';
import { useMobilDetail, useUploadMedia, useDeleteMedia } from '../hooks/useMobil';
import { FILE_URL } from '../utils/api';
import { formatCurrency } from '../utils/format';
import { RelatedBengkelTransactions } from './RelatedBengkelTransactions';

const { width } = Dimensions.get('window');

interface MobilDetailProps {
    unit: any;
    onClose: () => void;
    onEdit?: () => void;
}

export const MobilDetail = ({ unit: initialUnit, onClose, onEdit }: MobilDetailProps) => {
    const { data: unit, isLoading: isRefetching } = useMobilDetail(initialUnit?.id);
    const uploadMediaAction = useUploadMedia();
    const deleteMediaAction = useDeleteMedia();

    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const activeUnit = unit || initialUnit;
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
                await uploadMediaAction.mutateAsync({ id: activeUnit.id, files });
                Alert.alert('Berhasil', 'Media berhasil diunggah');
            } catch (error) {
                console.error('Upload error:', error);
                Alert.alert('Error', 'Gagal mengunggah media');
            }
        }
    };

    const handleDeleteMedia = (mediaId: number) => {
        Alert.alert(
            'Hapus Media',
            'Apakah Anda yakin ingin menghapus media ini?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteMediaAction.mutateAsync({ id: activeUnit.id, mediaId });
                        } catch (error) {
                            Alert.alert('Error', 'Gagal menghapus media');
                        }
                    }
                }
            ]
        );
    };

    const renderMediaItem = (item: any) => {
        const fullUrl = `${FILE_URL}/uploads/${item.file_path}`;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => item.file_type !== 'video' && setSelectedImage(fullUrl)}
                className="relative"
                style={{ width }}
            >
                <View className="h-96 bg-gray-100 overflow-hidden">
                    {item.file_type === 'video' ? (
                        <View className="flex-1 items-center justify-center bg-slate-900">
                            <PlayCircle size={64} color="white" opacity={0.6} />
                            <Typography className="text-white/50 text-[10px] mt-2 font-bold uppercase tracking-widest">Video Preview</Typography>
                        </View>
                    ) : (
                        <Image
                            source={{ uri: fullUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    )}
                </View>

                {/* Delete Button - Glass Style */}
                <TouchableOpacity
                    onPress={() => handleDeleteMedia(item.id)}
                    className="absolute bottom-10 left-6 bg-red-500/80 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-lg"
                >
                    <Trash2 size={18} color="white" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="light-content" />
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Fixed Header Overlay (Mobile Style) */}
                <View className="absolute top-6 left-6 right-6 z-10 flex-row justify-between items-center">
                    <TouchableOpacity
                        onPress={onClose}
                        className="w-11 h-11 bg-black/40 backdrop-blur-md rounded-2xl items-center justify-center border border-white/20"
                    >
                        <X size={20} color="white" />
                    </TouchableOpacity>
                    <View className="bg-emerald-500/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shadow-lg">
                        <Typography variant="caption" weight="bold" className="text-white uppercase tracking-widest text-[9px]">
                            {activeUnit.status}
                        </Typography>
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
                        <View className="absolute bottom-12 flex-row self-center space-x-1.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                            {activeUnit.media.map((_: any, i: number) => (
                                <View
                                    key={i}
                                    className={`h-1.5 rounded-full ${i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`}
                                />
                            ))}
                        </View>
                    )}

                    {/* Media Quick Action */}
                    <TouchableOpacity
                        onPress={handlePickMedia}
                        disabled={uploadMediaAction.isPending}
                        className="absolute bottom-6 right-6 w-14 h-14 bg-white rounded-2xl items-center justify-center shadow-2xl border border-gray-100"
                    >
                        {uploadMediaAction.isPending ? (
                            <ActivityIndicator size="small" color="#023C69" />
                        ) : (
                            <Plus size={24} color="#023C69" strokeWidth={3} />
                        )}
                    </TouchableOpacity>
                </View>

                <View className="flex-1 bg-white -mt-8 rounded-t-[48px] px-6 pt-10">
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
                                {formatCurrency(activeUnit.total_modal || activeUnit.harga_beli)}
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

                        <View className="flex-row justify-between items-center mb-5 pb-5 border-b border-gray-50">
                            <View>
                                <Typography variant="caption" className="text-textGray mb-1">Total Biaya & Sparepart</Typography>
                                <Typography variant="h3" weight="bold" className="text-orange-500">{formatCurrency((activeUnit.total_biaya || 0) + (activeUnit.total_part_service || 0))}</Typography>
                            </View>
                            <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                                <Settings size={20} color="#F97316" />
                            </View>
                        </View>

                        {activeUnit.harga_jual > 0 && (
                            <View className="flex-row justify-between items-center">
                                <View>
                                    <Typography variant="caption" className="text-blue-500 font-bold mb-1">Terjual Seharga</Typography>
                                    <Typography variant="h2" weight="bold" className="text-blue-600">{formatCurrency(activeUnit.harga_jual)}</Typography>
                                </View>
                                <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center">
                                    <TrendingUp size={20} color="#2563EB" />
                                </View>
                            </View>
                        )}
                    </Card>

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
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={onEdit}
                        className="bg-primary flex-row items-center justify-center py-5 rounded-[28px] shadow-2xl shadow-primary/40 mb-10"
                    >
                        <Edit size={20} color="white" className="mr-3" />
                        <Typography weight="bold" className="text-white text-lg ml-2">Edit Data Unit</Typography>
                    </TouchableOpacity>

                    {/* Extra Bottom Padding */}
                    <View className="h-10" />
                </View>
            </ScrollView>

            {/* Image Detail Viewer (Full Screen Modal) */}
            <Modal
                visible={!!selectedImage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedImage(null)}
            >
                <View className="flex-1 bg-black/95 items-center justify-center">
                    <TouchableOpacity
                        onPress={() => setSelectedImage(null)}
                        className="absolute top-12 right-6 z-20 w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-white/20"
                    >
                        <X size={24} color="white" />
                    </TouchableOpacity>

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
