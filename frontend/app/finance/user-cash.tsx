import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, StatusBar, FlatList, ActivityIndicator, RefreshControl, Platform, TextInput, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    ChevronLeft,
    Wallet,
    History,
    Search,
    Edit3,
    ArrowUpCircle,
    ArrowDownCircle,
    CheckCircle2,
    Calendar,
    User,
    ArrowRightLeft,
    Shield,
    Plus,
    PlusCircle
} from 'lucide-react-native';
import { router } from 'expo-router';
import { Header } from '../../components/ui/Header';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { formatCurrency, formatNumber, parseNumber } from '../../utils/format';
import { useUserCashList, useAdjustUserCash, useSetUserCash, useUserCashHistory } from '../../hooks/useKeuangan';
import { useAuthStore } from '../../store/useAuthStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { Image } from 'react-native';
import { getFileUrl } from '../../utils/image';

interface AdjustmentForm {
    type: 'adjust' | 'set';
    userId: number;
    userName: string;
    nominal: string;
    keterangan: string;
}

export default function UserCashManagementScreen() {
    const currentUser = useAuthStore(state => state.user);
    const isAdmin = currentUser?.role === 'ADMIN';

    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');
    
    // Adjustment Form State
    const [form, setForm] = useState<AdjustmentForm | null>(null);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['60%', '80%'], []);

    // Alert Dialog State
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info'
    });

    // API Hooks
    const { data: users, isLoading: isLoadingUsers, refetch: refetchUsers } = useUserCashList();
    const { data: history, isLoading: isLoadingHistory, refetch: refetchHistory } = useUserCashHistory();
    
    const adjustMutation = useAdjustUserCash();
    const setMutation = useSetUserCash();

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter((u: any) => 
            u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.username.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [users, searchQuery]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchUsers(), refetchHistory()]);
        setRefreshing(false);
    }, [refetchUsers, refetchHistory]);

    const handleOpenForm = (targetUser: any, type: 'adjust' | 'set') => {
        Keyboard.dismiss();
        setForm({
            type,
            userId: targetUser.id,
            userName: targetUser.full_name,
            nominal: '',
            keterangan: ''
        });
        bottomSheetRef.current?.expand();
    };

    const showAlert = (title: string, message: string, variant: 'success' | 'error' | 'warning' | 'info') => {
        setAlertConfig({ visible: true, title, message, variant });
    };

    const handleSubmit = async () => {
        if (!form) return;
        
        Keyboard.dismiss();
        try {
            const nominalValue = parseNumber(form.nominal);
            if (form.type === 'adjust') {
                await adjustMutation.mutateAsync({
                    userId: form.userId,
                    data: { nominal: nominalValue, keterangan: form.keterangan }
                });
            } else {
                await setMutation.mutateAsync({
                    userId: form.userId,
                    params: { nominal: nominalValue, keterangan: form.keterangan }
                });
            }
            
            bottomSheetRef.current?.close();
            // Note: form is cleared by BottomSheet.onClose callback automatically
            showAlert('Berhasil', 'Saldo user berhasil diperbarui', 'success');
        } catch (error) {
            showAlert('Gagal', getErrorMessage(error), 'error');
        }
    };

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    const renderUserItem = ({ item }: { item: any }) => (
        <View className="flex-row items-center px-6 py-4 border-b border-slate-50">
            <View className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center mr-4 overflow-hidden">
                {item.profile_picture ? (
                    <Image source={{ uri: getFileUrl(item.profile_picture) as string }} className="w-full h-full" />
                ) : (
                    <User size={24} color="#64748b" />
                )}
            </View>
            <View className="flex-1">
                <Typography variant="body1" weight="bold" className="text-text">{item.full_name}</Typography>
                <Typography variant="caption" className="text-text-secondary">@{item.username} • {item.role}</Typography>
            </View>
            <View className="items-end">
                <Typography variant="body1" weight="bold" className="text-gopayBlue">
                    {formatCurrency(item.cash_balance)}
                </Typography>
                {isAdmin && (
                    <View className="flex-row items-center mt-2 gap-x-3">
                        <Pressable 
                            onPress={() => handleOpenForm(item, 'adjust')}
                            className="bg-blue-50 px-3 py-1.5 rounded-lg flex-row items-center"
                        >
                            <Plus size={12} color="#3b82f6" />
                            <Typography weight="bold" className="text-blue-600 text-[10px] ml-1">Sesuaikan</Typography>
                        </Pressable>
                        <Pressable 
                            onPress={() => handleOpenForm(item, 'set')}
                            className="bg-slate-50 px-3 py-1.5 rounded-lg flex-row items-center"
                        >
                            <Edit3 size={12} color="#64748b" />
                            <Typography weight="bold" className="text-slate-600 text-[10px] ml-1">Set</Typography>
                        </Pressable>
                    </View>
                )}
            </View>
        </View>
    );

    const renderHistoryItem = ({ item }: { item: any }) => {
        const isPositive = item.nominal > 0;
        return (
            <View className="px-6 py-4 border-b border-slate-50 flex-row items-start">
                <View className={`p-2 rounded-full mr-4 ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
                    {isPositive ? <ArrowUpCircle size={20} color="#10b981" /> : <ArrowDownCircle size={20} color="#ef4444" />}
                </View>
                <View className="flex-1">
                    <View className="flex-row justify-between mb-1">
                        <View>
                            <Typography variant="body2" weight="bold" className="text-text">{item.target_user_name || `User ID: ${item.user_id}`}</Typography>
                            <Typography variant="caption" className="text-text-secondary">
                                {format(new Date(item.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                            </Typography>
                        </View>
                        <Typography variant="body2" weight="bold" className={isPositive ? 'text-green-600' : 'text-red-600'}>
                            {isPositive ? '+' : ''}{formatCurrency(item.nominal)}
                        </Typography>
                    </View>
                    <Typography variant="caption" className="text-text-secondary leading-4 italic">
                        {item.keterangan || 'Tanpa keterangan'}
                    </Typography>
                    <View className="flex-row items-center mt-2">
                        <Shield size={10} color="#94a3b8" />
                        <Typography variant="caption" className="text-text-disabled ml-1 text-[10px]">
                            Oleh: {item.admin_name || `Admin ID: ${item.admin_id}`}
                        </Typography>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-background">
            <StatusBar barStyle="dark-content" />
            
            <AlertDialog
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                variant={alertConfig.variant}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />

            <Header
                title="Catatan Cash User"
                showBackButton
                onBackButtonPress={() => router.back()}
            />

            {/* Tabs */}
            <View className="px-6 mt-4 z-10">
                <View className="bg-white p-2 rounded-[24px] shadow-sm flex-row items-center border border-gray-100">
                    <Pressable 
                        onPress={() => setActiveTab('list')}
                        className={`flex-1 flex-row h-12 items-center justify-center rounded-2xl ${activeTab === 'list' ? 'bg-primary shadow-sm' : 'bg-transparent'}`}
                    >
                        <User size={18} color={activeTab === 'list' ? 'white' : '#9CA3AF'} />
                        <Typography className={`ml-2 text-sm font-bold ${activeTab === 'list' ? 'text-white' : 'text-gray-400'}`}>Daftar User</Typography>
                    </Pressable>
                    <Pressable 
                        onPress={() => setActiveTab('history')}
                        className={`flex-1 flex-row h-12 items-center justify-center rounded-2xl ${activeTab === 'history' ? 'bg-primary shadow-sm' : 'bg-transparent'}`}
                    >
                        <History size={18} color={activeTab === 'history' ? 'white' : '#9CA3AF'} />
                        <Typography className={`ml-2 text-sm font-bold ${activeTab === 'history' ? 'text-white' : 'text-gray-400'}`}>Riwayat</Typography>
                    </Pressable>
                </View>
            </View>

            {activeTab === 'list' ? (
                <>
                    {/* Search Bar */}
                    <View className="px-6 mt-4">
                        <View className="bg-white p-2 rounded-[24px] flex-row items-center border border-gray-100 shadow-sm">
                            <View className="flex-1 flex-row items-center px-4 h-12 rounded-2xl bg-gray-50">
                                <Search size={18} color="#9CA3AF" />
                                <TextInput 
                                    placeholder="Cari nama atau username..." 
                                    className="flex-1 ml-3 text-sm font-semibold text-textMain"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>
                    </View>

                    <FlatList
                        data={filteredUsers}
                        renderItem={renderUserItem}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00ADEF" />}
                        ListEmptyComponent={
                            isLoadingUsers ? (
                                <View className="mt-8 px-6"><SkeletonCard /></View>
                            ) : (
                                <EmptyState title="User tidak ditemukan" description="Coba kata kunci pencarian lain" />
                            )
                        }
                    />
                </>
            ) : (
                <FlatList
                    data={history}
                    renderItem={renderHistoryItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#00ADEF" />}
                    ListEmptyComponent={
                        isLoadingHistory ? (
                            <View className="mt-8 px-10 gap-y-4"><SkeletonCard /><SkeletonCard /></View>
                        ) : (
                            <EmptyState title="Belum ada riwayat" description="Riwayat perubahan saldo akan muncul di sini" icon={History} />
                        )
                    }
                />
            )}

            {/* Adjustment Sheet */}
            <BottomSheet
                ref={bottomSheetRef}
                index={-1}
                snapPoints={snapPoints}
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: '#e2e8f0', width: 40 }}
                onClose={() => setForm(null)}
            >
                <BottomSheetScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
                    {form && (
                        <>
                            <Typography variant="h3" weight="bold" className="mb-1">
                                {form.type === 'adjust' ? 'Sesuaikan Saldo' : 'Atur Saldo Baru'}
                            </Typography>
                            <Typography variant="body2" className="text-text-secondary mb-6">
                                {form.type === 'adjust' 
                                    ? `Tambah atau kurangi saldo cash untuk ${form.userName}` 
                                    : `Atur nominal saldo cash tetap untuk ${form.userName}`}
                            </Typography>

                            <View className="gap-y-6">
                                <View>
                                    <Typography variant="caption" weight="bold" className="text-text-secondary mb-2 ml-1">
                                        {form.type === 'adjust' ? 'NOMINAL ADJUSTMENT (Cth: 10.000 atau -5.000)' : 'SALDO AKHIR BARU'}
                                    </Typography>
                                    <Input
                                        placeholder="0"
                                        value={form.nominal}
                                        onChangeText={(val) => {
                                            const isNegative = form.type === 'adjust' && val.startsWith('-');
                                            const formatted = formatNumber(val);
                                            setForm(f => f ? { ...f, nominal: isNegative ? `-${formatted}` : formatted } : null);
                                        }}
                                        keyboardType="numeric"
                                        startIcon={<Wallet size={20} color="#94a3b8" />}
                                    />
                                </View>

                                <View>
                                    <Typography variant="caption" weight="bold" className="text-text-secondary mb-2 ml-1">KETERANGAN / PESAN</Typography>
                                    <Input
                                        placeholder="Berikan alasan perubahan saldo..."
                                        value={form.keterangan}
                                        onChangeText={(val) => setForm(f => f ? { ...f, keterangan: val } : null)}
                                        multiline
                                        numberOfLines={3}
                                    />
                                </View>

                                <Button
                                    title={form.type === 'adjust' ? 'Simpan Perubahan' : 'Update Saldo'}
                                    onPress={handleSubmit}
                                    loading={adjustMutation.isPending || setMutation.isPending}
                                    className="mt-4"
                                />
                                
                                <Button
                                    title="Batal"
                                    variant="secondary"
                                    onPress={() => bottomSheetRef.current?.close()}
                                />
                            </View>
                        </>
                    )}
                </BottomSheetScrollView>
            </BottomSheet>
        </View>
    );
}
