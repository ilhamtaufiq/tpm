import { appAlert } from '../../utils/appAlert';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, ScrollView, Pressable, RefreshControl, Platform, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
    Wallet,
    CreditCard,
    Banknote,
    RefreshCw,
    Info,
    TrendingUp,
    TrendingDown,
    Calendar,
    FileText,
    X,
    Building2,
    Wrench,
    Truck,
    Car,
    History,
    Landmark
} from 'lucide-react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { keuanganService, KasBankAllBalances, KasBankBalance, KasBankJenis } from '../../services/keuangan';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { formatCurrency } from '../../utils/format';
import { Header } from '../../components/ui/Header';
import { useAuthStore } from '../../store/useAuthStore';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { useUIStore } from '../../store/useUIStore';
import { useSheetChrome } from '../../utils/themeStyles';

const ACCOUNT_ICONS: Record<string, any> = {
    CASH: Wallet,
    BANK_BCA: CreditCard,
    BANK_MANDIRI: CreditCard,
    BANK_BRI: CreditCard,
    BANK_LAINNYA: Banknote,
    KAS_UTAMA: Building2,
    BANK_UTAMA: CreditCard,
    KAS_UNIT_BENGKEL: Wrench,
    KAS_UNIT_JASA_ANGKUT: Truck,
    KAS_UNIT_MOBIL: Car,
};

const ACCOUNT_LABELS: Record<string, string> = {
    CASH: 'Kas Tunai (Lama)',
    BANK_BCA: 'BCA (Lama)',
    BANK_MANDIRI: 'Mandiri (Lama)',
    BANK_BRI: 'BRI (Lama)',
    BANK_LAINNYA: 'Lainnya (Lama)',
    PIUTANG: 'Piutang Usaha',
    HUTANG: 'Hutang Usaha',
    KAS_UTAMA: 'Kas Kantor Utama',
    BANK_UTAMA: 'Bank Utama (BCA)',
    KAS_UNIT_BENGKEL: 'Bengkel (Cash)',
    KAS_UNIT_JASA_ANGKUT: 'Jasa Angkut (Cash)',
    KAS_UNIT_MOBIL: 'Mobil (Cash)',
};

const ACTIVE_ACCOUNTS: KasBankJenis[] = [
    'KAS_UTAMA',
    'BANK_UTAMA',
    'KAS_UNIT_BENGKEL',
    'KAS_UNIT_JASA_ANGKUT',
    'KAS_UNIT_MOBIL',
];

const LEGACY_ACCOUNTS: KasBankJenis[] = [
    'CASH',
    'BANK_BCA',
    'BANK_MANDIRI',
    'BANK_BRI',
    'BANK_LAINNYA',
];

export default function AkunKeuanganScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { themeColors } = useUIStore();
    const chrome = useSheetChrome();
    const user = useAuthStore(state => state.user);
    const role = user?.role;
    const roleAccount = useMemo(() => {
        if (role === 'BENGKEL') return 'KAS_UNIT_BENGKEL' as KasBankJenis;
        if (role === 'JASA_ANGKUT') return 'KAS_UNIT_JASA_ANGKUT' as KasBankJenis;
        if (role === 'MOBIL') return 'KAS_UNIT_MOBIL' as KasBankJenis;
        return undefined;
    }, [role]);
    const roleUnit = useMemo(() => {
        if (role === 'BENGKEL') return 'BENGKEL';
        if (role === 'JASA_ANGKUT') return 'JASA_ANGKUT';
        if (role === 'MOBIL') return 'JUAL_BELI_MOBIL';
        return undefined;
    }, [role]);
    const visibleActiveAccounts = useMemo(() => roleAccount ? [roleAccount] : ACTIVE_ACCOUNTS, [roleAccount]);
    const [balances, setBalances] = useState<KasBankAllBalances | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAllAccounts, setShowAllAccounts] = useState(false);

    // Adjustment Modal State
    const [selectedAccount, setSelectedAccount] = useState<KasBankJenis | null>(null);
    const [isAdjustModalVisible, setIsAdjustModalVisible] = useState(false);
    const [newNominal, setNewNominal] = useState('');
    const [keterangan, setKeterangan] = useState('');
    const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Alert state
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

    // Sheet refs
    const adjustSheetRef = useRef<BottomSheet>(null);
    const adjustSnapPoints = useMemo(() => ['75%', '90%'], []);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // Sync sheet with visible state
    useEffect(() => {
        if (Platform.OS !== 'web') {
            if (isAdjustModalVisible) {
                adjustSheetRef.current?.expand();
                setIsSheetOpen(true);
            } else {
                adjustSheetRef.current?.close();
            }
        }
    }, [isAdjustModalVisible]);

    const fetchData = useCallback(async () => {
        try {
            const balanceData = await keuanganService.getKasBankBalances();
            setBalances(balanceData);
        } catch (error) {
            console.error('Error fetching data:', error);
            appAlert('Error', 'Gagal memuat data keuangan');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchData();
    };

    const handleAdjustClick = (jenis: KasBankJenis) => {
        const currentBalance = balances ? (balances[jenis.toLowerCase() as keyof KasBankAllBalances] as KasBankBalance)?.saldo || 0 : 0;
        setSelectedAccount(jenis);
        setNewNominal(currentBalance.toString());
        setKeterangan('Penyesuaian saldo');
        setIsAdjustModalVisible(true);
    };

    const handleAdjustSubmit = async () => {
        if (!selectedAccount || !newNominal || !keterangan) {
            appAlert('Peringatan', 'Harap isi semua field');
            return;
        }

        setIsSubmitting(true);
        try {
            await keuanganService.adjustBalance({
                jenis: selectedAccount,
                nominal: parseFloat(newNominal),
                tanggal: adjustmentDate,
                keterangan: keterangan
            });

            setIsAdjustModalVisible(false);
            setAlertConfig({
                visible: true,
                title: 'Berhasil',
                message: `Berhasil menyesuaikan saldo ${ACCOUNT_LABELS[selectedAccount]}`,
                variant: 'success'
            });
            fetchData();
        } catch (error: any) {
            console.error('Error adjusting balance:', error);
            setAlertConfig({
                visible: true,
                title: 'Gagal',
                message: error?.response?.data?.detail || 'Gagal menyesuaikan saldo',
                variant: 'error'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderAccountItem = (jenis: KasBankJenis) => {
        const key = jenis.toLowerCase() as keyof KasBankAllBalances;
        const accountData = balances ? (balances[key] as KasBankBalance) : null;
        const Icon = ACCOUNT_ICONS[jenis] || Banknote;
        const currentBalance = accountData?.saldo || 0;

        const isActive = visibleActiveAccounts.includes(jenis);
        const shouldHide = !isActive && currentBalance === 0 && !showAllAccounts;

        if (shouldHide) return null;

        return (
            <View
                key={jenis}
                className="bg-surface p-5 rounded-[24px] mb-4 border border-transparent shadow-sm"
            >
                <View className="flex-row items-center mb-3">
                    <View className="w-11 h-11 bg-primary/5 rounded-2xl items-center justify-center mr-3">
                        <Icon size={22} color="#023C69" />
                    </View>
                    <Typography variant="body1" weight="bold" className="text-text flex-1">
                        {ACCOUNT_LABELS[jenis]}
                    </Typography>
                </View>

                {/* Ringkasan Minimalis: Masuk, Keluar, Saldo */}
                <View className="bg-background p-3.5 rounded-2xl border border-transparent flex-row items-center justify-between">
                    <View className="flex-1 items-center">
                        <Typography className="text-emerald-600 text-[10px] font-bold uppercase mb-0.5">Masuk</Typography>
                        <Typography weight="bold" className="text-emerald-700 text-xs">
                            {formatCurrency(accountData?.total_masuk_bulan_ini || 0)}
                        </Typography>
                    </View>
                    <View className="w-[1px] h-7 bg-gray-200" />
                    <View className="flex-1 items-center">
                        <Typography className="text-rose-600 text-[10px] font-bold uppercase mb-0.5">Keluar</Typography>
                        <Typography weight="bold" className="text-rose-700 text-xs">
                            {formatCurrency(accountData?.total_keluar_bulan_ini || 0)}
                        </Typography>
                    </View>
                    <View className="w-[1px] h-7 bg-gray-200" />
                    <View className="flex-1 items-center">
                        <Typography className="text-primary text-[10px] font-bold uppercase mb-0.5">Saldo</Typography>
                        <Typography weight="bold" className="text-primary text-xs">
                            {formatCurrency(currentBalance)}
                        </Typography>
                    </View>
                </View>
            </View>
        );
    };

    const renderAdjustContent = () => (
        <View className="p-0">
            <View className="bg-amber-50 p-4 rounded-3xl border border-amber-100 mb-6 flex-row items-start">
                <Info size={20} color="#D97706" />
                <Typography className="flex-1 ml-3 text-amber-800 text-xs leading-5">
                    Adjustment akan membuat transaksi <Typography weight="bold">MASUK</Typography> atau <Typography weight="bold">KELUAR</Typography> secara otomatis untuk mencapai saldo target. Gunakan fitur ini hanya untuk koreksi saldo stok opname atau perbaikan data.
                </Typography>
            </View>

            <View className="mb-6">
                <Typography className="text-textGray text-[10px] uppercase font-bold mb-2 ml-1">Akun Terpilih</Typography>
                <View className="bg-background p-4 rounded-2xl border border-transparent flex-row items-center">
                    <View className="w-10 h-10 bg-surface rounded-xl items-center justify-center mr-3 shadow-sm">
                        {selectedAccount && React.createElement(ACCOUNT_ICONS[selectedAccount] || Banknote, { size: 20, color: "#023C69" })}
                    </View>
                    <Typography weight="bold" className="text-text">
                        {selectedAccount ? ACCOUNT_LABELS[selectedAccount] : ''}
                    </Typography>
                    <View className="flex-1" />
                    <View className="items-end">
                        <Typography className="text-textGray text-[8px] uppercase font-bold">Saldo Sekarang</Typography>
                        <Typography weight="bold" className="text-primary text-xs">
                            {formatCurrency(balances ? (balances[selectedAccount?.toLowerCase() as keyof KasBankAllBalances] as any)?.saldo || 0 : 0)}
                        </Typography>
                    </View>
                </View>
            </View>

            <View className="flex-row items-start space-x-4">
                <View className="flex-1">
                    <Input
                        label="SALDO TARGET BARU"
                        value={newNominal}
                        onChangeText={setNewNominal}
                        keyboardType="numeric"
                        placeholder="0"
                        startIcon={<Typography weight="bold" className="text-textGray">Rp</Typography>}
                    />
                </View>
                <View className="w-1/3 pt-8 items-center bg-background rounded-2xl h-14 justify-center border border-dashed border-transparent">
                   <Typography className="text-[10px] text-textGray font-bold uppercase mb-0.5">Selisih</Typography>
                   {(() => {
                       const current = balances ? (balances[selectedAccount?.toLowerCase() as keyof KasBankAllBalances] as any)?.saldo || 0 : 0;
                       const target = parseFloat(newNominal.replace(/[^0-9.-]+/g,"")) || 0;
                       const diff = target - current;
                       return (
                           <Typography weight="bold" className={`text-xs ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                               {diff >= 0 ? '+' : ''}{formatCurrency(diff).replace('Rp', '')}
                           </Typography>
                       );
                   })()}
                </View>
            </View>

            <Input
                label="TANGGAL"
                value={adjustmentDate}
                onChangeText={setAdjustmentDate}
                placeholder="YYYY-MM-DD"
                startIcon={<Calendar size={18} color="#9CA3AF" />}
            />

            <Input
                label="KETERANGAN / ALASAN"
                value={keterangan}
                onChangeText={setKeterangan}
                placeholder="Contoh: Koreksi saldo akhir tahun"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                startIcon={<FileText size={18} color="#9CA3AF" />}
            />

            <View className="flex-row mt-4 space-x-3 pb-8">
                <View className="flex-1">
                    <Button
                        variant="outline"
                        title="Batal"
                        onPress={() => setIsAdjustModalVisible(false)}
                        disabled={isSubmitting}
                    />
                </View>
                <View className="flex-1">
                    <Button
                        title="Simpan"
                        onPress={handleAdjustSubmit}
                        loading={isSubmitting}
                    />
                </View>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-surface">
            <Stack.Screen options={{ headerShown: false }} />

            <Header
                title="Akun Keuangan"
                showBackButton
                onBackButtonPress={() => router.back()}
            >
                {/* Total Balance Bento */}
                <View className="bg-background p-6 rounded-[32px] border border-transparent mt-4">
                    <View className="flex-row items-center mb-1">
                        <Typography className="text-textGray text-[10px] uppercase font-bold tracking-widest">Total Keseluruhan Saldo</Typography>
                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-2 animate-pulse" />
                    </View>
                    <View className="flex-row items-baseline">
                        <Typography className="text-textGray text-lg mr-1 font-bold">Rp</Typography>
                        <Typography weight="bold" className="text-text text-4xl">
                            {formatCurrency(balances?.total_saldo || 0).replace('Rp', '').trim()}
                        </Typography>
                    </View>

                    <View className="flex-row mt-6 pt-6 border-t border-transparent">
                        <View className="flex-1 flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-emerald-400/20 items-center justify-center mr-3">
                                <TrendingUp size={14} color="#10B981" />
                            </View>
                            <View>
                                <Typography className="text-textGray text-[8px] uppercase font-bold">Masuk (Bulan Ini)</Typography>
                                <Typography className="text-emerald-600 text-xs font-bold">
                                    {formatCurrency(
                                        Object.values(balances || {}).reduce((acc: number, curr: any) => {
                                            if (typeof curr === 'object' && curr !== null && 'total_masuk_bulan_ini' in curr) {
                                                return acc + Number(curr.total_masuk_bulan_ini || 0);
                                            }
                                            return acc;
                                        }, 0)
                                    )}
                                </Typography>
                            </View>
                        </View>
                        <View className="flex-1 flex-row items-center ml-4">
                            <View className="w-8 h-8 rounded-full bg-rose-400/20 items-center justify-center mr-3">
                                <TrendingDown size={14} color="#EF4444" />
                            </View>
                            <View>
                                <Typography className="text-textGray text-[8px] uppercase font-bold">Keluar (Bulan Ini)</Typography>
                                <Typography className="text-rose-600 text-xs font-bold">
                                    {formatCurrency(
                                        Object.values(balances || {}).reduce((acc: number, curr: any) => {
                                            if (typeof curr === 'object' && curr !== null && 'total_keluar_bulan_ini' in curr) {
                                                return acc + Number(curr.total_keluar_bulan_ini || 0);
                                            }
                                            return acc;
                                        }, 0)
                                    )}
                                </Typography>
                            </View>
                        </View>
                    </View>
                </View>
            </Header>

            {/* Content */}
            <ScrollView
                className="flex-1 px-6 pt-8"
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                <View className="mb-6 flex-row items-center justify-between">
                    <Typography variant="h3" weight="bold" className="text-text">Daftar Rekening</Typography>
                    <Pressable
                        onPress={() => router.push('/finance/laporan')}
                        className="flex-row items-center bg-primary/5 px-3 py-1.5 rounded-full"
                    >
                        <FileText size={12} color="#023C69" />
                        <Typography className="text-primary text-[10px] font-bold ml-1.5 uppercase">Buka Laporan</Typography>
                    </Pressable>
                </View>

                {isLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                        <View key={i} className="bg-surface p-5 rounded-[32px] mb-4 border border-transparent flex-row items-center">
                            <Skeleton width={64} height={64} borderRadius={20} style={{ marginRight: 16 }} />
                            <View className="flex-1">
                                <Skeleton width="50%" height={24} style={{ marginBottom: 8 }} />
                                <Skeleton width="70%" height={16} style={{ marginBottom: 16 }} />
                                <Skeleton width="100%" height={40} borderRadius={12} />
                            </View>
                        </View>
                    ))
                ) : (
                    <View className="mb-4">
                        <View className="flex-row items-center justify-between mb-4 px-1">
                            <Typography className="text-textGray text-[10px] uppercase font-bold tracking-widest">Kas & Rekening Bank</Typography>
                            {!roleAccount && (
                                <Pressable
                                    onPress={() => setShowAllAccounts(!showAllAccounts)}
                                    className="bg-primary/5 px-2 py-1 rounded-lg"
                                >
                                    <Typography className="text-primary text-[10px] font-bold">
                                        {showAllAccounts ? 'Sembunyikan Saldo 0' : 'Tampilkan Semua'}
                                    </Typography>
                                </Pressable>
                            )}
                        </View>
                        {visibleActiveAccounts.map(renderAccountItem)}

                        {!roleAccount && showAllAccounts && (
                            <View className="mt-4 pt-4 border-t border-transparent">
                                <View className="flex-row items-center mb-4 px-1">
                                    <History size={14} color="#9CA3AF" />
                                    <Typography className="text-textGray text-[10px] uppercase font-bold tracking-widest ml-2">Rekening Legacy / Lama</Typography>
                                </View>
                                {LEGACY_ACCOUNTS.map(renderAccountItem)}
                            </View>
                        )}
                    </View>
                )}

                <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 16) }} />
            </ScrollView>

            {/* Adjustment Modal - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal visible={isAdjustModalVisible} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <Pressable className="absolute inset-0" onPress={() => setIsAdjustModalVisible(false)} />
                        <View className="bg-surface" style={styles.webModalContent}>
                            <View className="flex-row justify-between items-center mb-6">
                                <Typography variant="h2" weight="bold">Penyesuaian Saldo</Typography>
                                <Pressable onPress={() => setIsAdjustModalVisible(false)}>
                                    <X size={24} color="#6B7280" />
                                </Pressable>
                            </View>
                            <ScrollView
                                style={{ maxHeight: 480, flexGrow: 0 }}
                                showsVerticalScrollIndicator
                                nestedScrollEnabled
                                keyboardShouldPersistTaps="handled"
                            >
                                {renderAdjustContent()}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : (
                <BottomSheet
                    ref={adjustSheetRef}
                    index={-1}
                    snapPoints={adjustSnapPoints}
                    enablePanDownToClose
                    enableContentPanningGesture
                    keyboardBehavior="interactive"
                    keyboardBlurBehavior="restore"
                    android_keyboardInputMode="adjustResize"
                    backgroundStyle={chrome.backgroundStyle}
                    handleIndicatorStyle={chrome.handleIndicatorStyle}
                    topInset={insets.top}
                    onClose={() => {
                        setIsAdjustModalVisible(false);
                        setIsSheetOpen(false);
                    }}
                >
                    <BottomSheetScrollView
                        showsVerticalScrollIndicator
                        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 48 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View className="px-6 py-2">
                            <Typography variant="h2" weight="bold" className="mb-6">Penyesuaian Saldo</Typography>
                            {renderAdjustContent()}
                        </View>
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            {/* Alert Dialog */}
            <AlertDialog
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                variant={alertConfig.variant}
                onClose={() => setAlertConfig(p => ({ ...p, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    webModalContent: {
        borderRadius: 32,
        width: '100%',
        maxHeight: '90%',
        maxWidth: 500,
        padding: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    }
});
