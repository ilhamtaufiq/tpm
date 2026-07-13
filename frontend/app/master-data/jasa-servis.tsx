import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, FlatList, ActivityIndicator, Platform, Modal, TextInput } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Header } from '../../components/ui/Header';
import {
    ChevronLeft,
    Plus,
    Search,
    Tag,
    RefreshCw,
    X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import {
    useJasaList,
    useCreateJasa,
    useUpdateJasa,
    useDeleteJasa,
    useDebounce
} from '../../hooks';
import { formatNumber, parseNumber } from '../../utils/format';
import { onlineManager } from '@tanstack/react-query';
import { appAlert } from '../../utils/appAlert';

interface JasaServisForm {
    id?: number;
    nama: string;
    harga: string;
    kategori: string;
    deskripsi: string;
}

const INITIAL_FORM: JasaServisForm = {
    nama: '',
    harga: '',
    kategori: 'Servis',
    deskripsi: '',
};

export default function JasaServisScreen() {
    const router = useRouter();
    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearch = useDebounce(searchQuery, 500);

    // Queries
    const {
        data: jasaData,
        isLoading,
        refetch,
        isRefetching
    } = useJasaList({
        search: debouncedSearch,
        limit: 100
    });

    const jasaList = jasaData?.data || [];

    // Stats Calculation
    const stats = useMemo(() => {
        const total = jasaData?.total || 0;
        const loadedCount = jasaList.length;
        const avgPrice = loadedCount > 0
            ? jasaList.reduce((acc: number, curr: any) => acc + Number(curr.harga), 0) / loadedCount
            : 0;
        return { total, avgPrice };
    }, [jasaList, jasaData?.total]);

    // Mutations
    const createMutation = useCreateJasa();
    const updateMutation = useUpdateJasa();
    const deleteMutation = useDeleteJasa();

    // Form State
    const [form, setForm] = useState<JasaServisForm>(INITIAL_FORM);
    const [isEditing, setIsEditing] = useState(false);

    const [sheetVisible, setSheetVisible] = useState(false);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['65%', '85%'], []);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/master-data');
        }
    };

    const handleOpenSheet = (item?: any) => {
        if (item) {
            setIsEditing(true);
            setForm({
                id: item.id,
                nama: item.nama,
                harga: formatNumber(item.harga.toString()),
                kategori: item.kategori || 'Servis',
                deskripsi: item.deskripsi || '',
            });
        } else {
            setIsEditing(false);
            setForm(INITIAL_FORM);
        }

        // Set visible for both platforms
        setSheetVisible(true);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.expand();
        }
    };

    const handleCloseSheet = () => {
        setSheetVisible(false);

        if (Platform.OS !== 'web') {
            bottomSheetRef.current?.close();
        }

        setForm(INITIAL_FORM);
        setIsEditing(false);
    };

    const handleSubmit = async () => {
        if (!form.nama || !form.harga) {
            alert('Nama dan Harga wajib diisi');
            return;
        }

        try {
            const payload = {
                ...form,
                harga: parseNumber(form.harga),
            };

            if (!onlineManager.isOnline()) {
                if (isEditing && form.id) {
                    updateMutation.mutate({ id: form.id, data: payload });
                } else {
                    createMutation.mutate(payload);
                }
                appAlert('Offline Mode', 'Data jasa telah disimpan di antrean offline.');
                handleCloseSheet();
                return;
            }

            if (isEditing && form.id) {
                await updateMutation.mutateAsync({ id: form.id, data: payload });
            } else {
                await createMutation.mutateAsync(payload);
            }
            handleCloseSheet();
        } catch (error) {
            console.error('Failed to save service:', error);
            alert('Gagal menyimpan data jasa. Periksa kembali input Anda.');
        }
    };

    const handleDelete = (id: number) => {
        if (!onlineManager.isOnline()) {
            deleteMutation.mutate(id);
            appAlert('Offline Mode', 'Jasa telah dijadwalkan untuk dihapus saat online.');
            return;
        }
        deleteMutation.mutate(id);
    };

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
            />
        ),
        []
    );

    const renderItem = ({ item }: { item: any }) => {
        return (
            <Pressable onPress={() => handleOpenSheet(item)}>
                <View className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center">
                    <View className="w-16 h-16 bg-purple-50 rounded-[20px] items-center justify-center mr-4 border border-purple-100/50">
                        <Tag size={32} color="#8B5CF6" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-1">
                            <Typography variant="body1" weight="bold" className="text-textMain text-lg flex-1 mr-2" numberOfLines={1}>{item.nama}</Typography>
                            <View className="bg-purple-50 px-2 py-1 rounded-lg">
                                <Typography className="text-purple-600 text-[10px] font-bold uppercase">{item.kategori}</Typography>
                            </View>
                        </View>

                        <View className="flex-row items-center pt-1">
                            <Typography className="text-primary font-bold text-base">
                                Rp {Number(item.harga).toLocaleString('id-ID')}
                            </Typography>
                        </View>

                        {item.deskripsi ? (
                            <Typography className="text-textGray text-xs mt-1" numberOfLines={1}>
                                {item.deskripsi}
                            </Typography>
                        ) : null}
                    </View>
                </View>
            </Pressable>
        );
    };

    const renderFormContent = () => (
        <View className="p-6 pb-12">
            <View className="flex-row justify-between items-center mb-6">
                <Typography variant="h2" weight="bold">
                    {isEditing ? 'Edit Jasa' : 'Tambah Jasa'}
                </Typography>
                <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                    <X size={20} color="#6B7280" />
                </Pressable>
            </View>

            <View className="space-y-4">
                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Jasa *</Typography>
                    <TextInput
                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                        placeholder="Contoh: Ganti Oli"
                        placeholderTextColor="#9CA3AF"
                        value={form.nama}
                        onChangeText={(t) => setForm({ ...form, nama: t })}
                    />
                </View>

                <View className="flex-row space-x-3">
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Harga Jasa *</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={form.harga}
                            onChangeText={(t) => setForm({ ...form, harga: formatNumber(t) })}
                        />
                    </View>
                    <View className="flex-1">
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Kategori</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                            placeholder="Servis"
                            placeholderTextColor="#9CA3AF"
                            value={form.kategori}
                            onChangeText={(t) => setForm({ ...form, kategori: t })}
                        />
                    </View>
                </View>

                <View>
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Deskripsi (Opsional)</Typography>
                    <TextInput
                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 min-h-[80px]"
                        placeholder="Keterangan tambahan jasa..."
                        placeholderTextColor="#9CA3AF"
                        value={form.deskripsi}
                        onChangeText={(t) => setForm({ ...form, deskripsi: t })}
                        multiline
                        textAlignVertical="top"
                    />
                </View>

                <View className="flex-col space-y-3 mt-4">
                    <Button
                        title={isEditing ? "Simpan Perubahan" : "Simpan Jasa"}
                        onPress={handleSubmit}
                        loading={createMutation.isPending || updateMutation.isPending}
                        className="shadow-lg shadow-primary/30"
                        size="lg"
                    />
                    {isEditing && (
                        <Button
                            title="Hapus Jasa"
                            variant="danger"
                            onPress={() => {
                                if (form.id) handleDelete(form.id);
                                handleCloseSheet();
                            }}
                            className="mt-2"
                        />
                    )}
                </View>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-surface" style={{ position: 'relative' }}>
            <StatusBar barStyle="light-content" />

            <Header
                title="Jasa Servis"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
                showProfile={true}
            >
                {!sheetVisible && (
                    <View className="flex-row items-center bg-gray-50 h-11 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" className="ml-4" />
                        <TextInput
                            placeholder="Cari jasa..."
                            className="flex-1 ml-3 text-sm font-medium text-textMain"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                )}
            </Header>

            {/* List */}
            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#023C69" />
                </View>
            ) : (
                <View className="flex-1" style={{ position: 'relative' }}>
                    <FlatList
                        data={jasaList}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
                        refreshControl={
                            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#023C69" />
                        }
                        ListEmptyComponent={
                            <View className="items-center justify-center py-20 mt-10">
                                <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-4">
                                    <Tag size={32} color="#D1D5DB" />
                                </View>
                                <Typography className="text-gray-400 text-center font-medium">
                                    Belum ada data jasa servis.{'\n'}Tap + untuk menambah.
                                </Typography>
                            </View>
                        }
                    />

                    {/* Floating Action Button */}
                    <Pressable
                        onPress={() => handleOpenSheet()}
                        style={{ position: 'absolute', right: 24, bottom: 100, elevation: 5, zIndex: 999, width: 64, height: 64 }}
                        className="bg-primary rounded-[24px] items-center justify-center shadow-2xl elevation-8"
                    >
                        <Plus size={32} color="white" />
                    </Pressable>

                </View>
            )}

            {/* Form UI - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal
                    visible={sheetVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={handleCloseSheet}
                >
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <Pressable
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                            onPress={handleCloseSheet}
                        />
                        <View
                            className="bg-white rounded-t-[32px] shadow-2xl h-[70%]"
                            style={{
                                width: '100%',
                                maxWidth: 640,
                                alignSelf: 'center',
                            }}
                        >
                            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-4" />
                            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                {renderFormContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48, height: 6 }}
                    onChange={(index) => setSheetVisible(index !== -1)}
                    onClose={() => setSheetVisible(false)}
                >
                    <BottomSheetScrollView>
                        {renderFormContent()}
                    </BottomSheetScrollView>
                </BottomSheet>
            )}
        </View>
    );
}
