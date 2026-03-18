import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform, Modal, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
    Wallet,
    CreditCard,
    Banknote,
    Plus,
    RefreshCw,
    Info,
    ArrowRightLeft,
    TrendingUp,
    TrendingDown,
    Calendar,
    FileText,
    BarChart3,
    X
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

const ACCOUNT_ICONS: Record<string, any> = {
    CASH: Wallet,
    BANK_BCA: CreditCard,
    BANK_MANDIRI: CreditCard,
    BANK_BRI: CreditCard,
    BANK_LAINNYA: Banknote,
};

const ACCOUNT_LABELS: Record<string, string> = {
    CASH: 'Kas Tunai',
    BANK_BCA: 'Bank BCA',
    BANK_MANDIRI: 'Bank Mandiri',
    BANK_BRI: 'Bank BRI',
    BANK_LAINNYA: 'Bank Lainnya',
    PIUTANG: 'Piutang Usaha',
    HUTANG: 'Hutang Usaha',
};

const REPORT_CATEGORIES: Record<string, string> = {
    CASH: 'Neraca: Aktiva Lancar',
    BANK_BCA: 'Neraca: Aktiva Lancar',
    BANK_MANDIRI: 'Neraca: Aktiva Lancar',
    BANK_BRI: 'Neraca: Aktiva Lancar',
    BANK_LAINNYA: 'Neraca: Aktiva Lancar',
    PIUTANG: 'Neraca: Aktiva Lancar',
    HUTANG: 'Neraca: Kewajiban',
};

const STATEMENT_LABELS: Record<string, string> = {
    CASH: 'Kas & Setara Kas',
    BANK_BCA: 'Bank & Simpanan',
    BANK_MANDIRI: 'Bank & Simpanan',
    BANK_BRI: 'Bank & Simpanan',
    BANK_LAINNYA: 'Bank & Simpanan',
    PIUTANG: 'Tagihan Pelanggan',
    HUTANG: 'Kewajiban Supplier',
};

const ACCOUNT_CATEGORIES: Record<string, string> = {
    CASH: 'Kas & Setara Kas',
    BANK_BCA: 'Perbankan',
    BANK_MANDIRI: 'Perbankan',
    BANK_BRI: 'Perbankan',
    BANK_LAINNYA: 'Perbankan',
};

const DUMMY_ACCOUNTS: KasBankJenis[] = ['CASH', 'BANK_BCA', 'BANK_MANDIRI', 'BANK_BRI', 'BANK_LAINNYA'];

export default function AkunKeuanganScreen() {
    const router = useRouter();
    const [balances, setBalances] = useState<KasBankAllBalances | null>(null);
    const [piutangSummary, setPiutangSummary] = useState<any>(null);
    const [hutangSummary, setHutangSummary] = useState<any>(null);
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

    // Success Alert state
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');

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
            const [balanceData, piutangData, hutangData] = await Promise.all([
                keuanganService.getKasBankBalances(),
                keuanganService.getPiutangSummary(),
                keuanganService.getHutangSummary()
            ]);
            setBalances(balanceData);
            setPiutangSummary(piutangData);
            setHutangSummary(hutangData);
        } catch (error) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Gagal memuat data keuangan');
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
            Alert.alert('Peringatan', 'Harap isi semua field');
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
            setAlertMessage(`Berhasil menyesuaikan saldo ${ACCOUNT_LABELS[selectedAccount]}`);
            setShowSuccessAlert(true);
            fetchData();
        } catch (error: any) {
            console.error('Error adjusting balance:', error);
            Alert.alert('Error', error?.response?.data?.detail || 'Gagal menyesuaikan saldo');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderAccountItem = (jenis: KasBankJenis) => {
        const key = jenis.toLowerCase() as keyof KasBankAllBalances;
        const accountData = balances ? (balances[key] as KasBankBalance) : null;
        const Icon = ACCOUNT_ICONS[jenis] || Banknote;
        const currentBalance = accountData?.saldo || 0;

        // Visibility Logic: Always show CASH and BANK_BCA. Others only if saldo > 0 or showAll is true.
        const isAlwaysVisible = jenis === 'CASH' || jenis === 'BANK_BCA';
        const shouldHide = !isAlwaysVisible && currentBalance === 0 && !showAllAccounts;

        if (shouldHide) return null;

        return (
            <TouchableOpacity
                key={jenis}
                onPress={() => handleAdjustClick(jenis)}
                className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center"
            >
                <View className="w-16 h-16 bg-primary/5 rounded-[20px] items-center justify-center mr-4">
                    <Icon size={28} color="#023C69" />
                </View>

                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-0.5">
                        <Typography className="text-primary text-[8px] font-bold uppercase tracking-widest opacity-60">
                            {REPORT_CATEGORIES[jenis]}
                        </Typography>
                        <Typography className="text-gray-400 text-[8px] font-bold uppercase">
                            {STATEMENT_LABELS[jenis]}
                        </Typography>
                    </View>
                    <View className="flex-row items-center justify-between mb-1">
                        <Typography variant="body1" weight="bold" className="text-gray-800">
                            {ACCOUNT_LABELS[jenis]}
                        </Typography>
                        {currentBalance > 0 ? (
                            <View className="bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                                <Typography className="text-emerald-600 text-[10px] font-bold uppercase">AKTIF</Typography>
                            </View>
                        ) : (
                            <View className="bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                                <Typography className="text-gray-400 text-[10px] font-bold uppercase">KOSONG</Typography>
                            </View>
                        )}
                    </View>

                    <Typography className="text-gray-400 text-xs mb-2">Terakhir diperbarui hari ini</Typography>

                    <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
                        <View>
                            <Typography className="text-gray-400 text-[10px] uppercase font-bold">Saldo Saat Ini</Typography>
                            <Typography variant="h3" weight="bold" className="text-primary mt-0.5">
                                {formatCurrency(currentBalance)}
                            </Typography>
                        </View>
                        <TouchableOpacity
                            onPress={() => handleAdjustClick(jenis)}
                            className="bg-primary/10 px-4 py-2 rounded-xl flex-row items-center"
                        >
                            <RefreshCw size={14} color="#023C69" />
                            <Typography className="text-primary text-xs font-bold ml-2">Ubah</Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSummaryItem = (type: 'PIUTANG' | 'HUTANG') => {
        const isPiutang = type === 'PIUTANG';
        const data = isPiutang ? piutangSummary : hutangSummary;
        const nominal = isPiutang ? data?.total_sisa : data?.total_sisa;
        const Icon = isPiutang ? TrendingUp : TrendingDown;
        const color = isPiutang ? '#059669' : '#DC2626';
        const bgColor = isPiutang ? 'bg-emerald-50' : 'bg-rose-50';

        if (!data) return null;

        return (
            <TouchableOpacity
                key={type}
                onPress={() => router.push(isPiutang ? '/finance/piutang' : '/finance/hutang')}
                className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center"
            >
                <View className={`w-16 h-16 ${bgColor} rounded-[20px] items-center justify-center mr-4`}>
                    <Icon size={28} color={color} />
                </View>

                <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-0.5">
                        <Typography className="text-primary text-[8px] font-bold uppercase tracking-widest opacity-60">
                            {REPORT_CATEGORIES[type]}
                        </Typography>
                        <Typography className="text-gray-400 text-[8px] font-bold uppercase">
                            {STATEMENT_LABELS[type]}
                        </Typography>
                    </View>
                    <View className="flex-row items-center justify-between mb-1">
                        <Typography variant="body1" weight="bold" className="text-gray-800">
                            {ACCOUNT_LABELS[type]}
                        </Typography>
                        <View className="bg-primary/5 px-2 py-1 rounded-full border border-primary/10">
                            <Typography className="text-primary text-[10px] font-bold uppercase">MODAL KERJA</Typography>
                        </View>
                    </View>

                    <Typography className="text-gray-400 text-xs mb-2">Akumulasi dari seluruh transaksi</Typography>

                    <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
                        <View>
                            <Typography className="text-gray-400 text-[10px] uppercase font-bold">Total {isPiutang ? 'Tagihan' : 'Kewajiban'}</Typography>
                            <Typography variant="h3" weight="bold" className={`${isPiutang ? 'text-emerald-600' : 'text-rose-600'} mt-0.5`}>
                                {formatCurrency(nominal || 0)}
                            </Typography>
                        </View>
                        <View className="bg-gray-50 px-4 py-2 rounded-xl flex-row items-center border border-gray-100">
                            <ArrowRightLeft size={14} color="#6B7280" />
                            <Typography className="text-gray-500 text-xs font-bold ml-2">Detail</Typography>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
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
                <Typography className="text-gray-400 text-[10px] uppercase font-bold mb-2 ml-1">Akun Terpilih</Typography>
                <View className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex-row items-center">
                    <View className="w-10 h-10 bg-white rounded-xl items-center justify-center mr-3 shadow-sm">
                        {selectedAccount && React.createElement(ACCOUNT_ICONS[selectedAccount] || Banknote, { size: 20, color: "#023C69" })}
                    </View>
                    <Typography weight="bold" className="text-gray-800">
                        {selectedAccount ? ACCOUNT_LABELS[selectedAccount] : ''}
                    </Typography>
                </View>
            </View>

            <Input
                label="SALDO TARGET BARU"
                value={newNominal}
                onChangeText={setNewNominal}
                keyboardType="numeric"
                placeholder="0"
                startIcon={<Typography weight="bold" className="text-gray-400">Rp</Typography>}
            />

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
                subtitle="Daftar Saldo Kas & Bank"
                showBackButton
                onBackButtonPress={() => router.back()}
                rightElement={
                    <TouchableOpacity
                        onPress={() => router.push('/finance/laporan')}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        <BarChart3 size={24} color="white" />
                    </TouchableOpacity>
                }
            >
                {/* Total Balance Bento */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/5">
                    <View className="flex-row items-center mb-1">
                        <Typography className="text-white/40 text-[10px] uppercase font-bold tracking-widest">Total Keseluruhan Saldo</Typography>
                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-2 animate-pulse" />
                    </View>
                    <View className="flex-row items-baseline">
                        <Typography className="text-white/60 text-lg mr-1 font-bold">Rp</Typography>
                        <Typography weight="bold" className="text-white text-4xl">
                            {formatCurrency(balances?.total_saldo || 0).replace('Rp', '').trim()}
                        </Typography>
                    </View>

                    <View className="flex-row mt-6 pt-6 border-t border-white/5">
                        <View className="flex-1 flex-row items-center">
                            <View className="w-8 h-8 rounded-full bg-emerald-400/20 items-center justify-center mr-3">
                                <TrendingUp size={14} color="#34D399" />
                            </View>
                            <View>
                                <Typography className="text-white/30 text-[8px] uppercase font-bold">Masuk (Bulan Ini)</Typography>
                                <Typography className="text-emerald-400 text-xs font-bold">
                                    {formatCurrency(
                                        Object.values(balances || {}).reduce((acc: number, curr: any) => {
                                            if (typeof curr === 'object' && curr !== null && 'total_masuk_bulan_ini' in curr) {
                                                return acc + (curr.total_masuk_bulan_ini || 0);
                                            }
                                            return acc;
                                        }, 0)
                                    )}
                                </Typography>
                            </View>
                        </View>
                        <View className="flex-1 flex-row items-center ml-4">
                            <View className="w-8 h-8 rounded-full bg-rose-400/20 items-center justify-center mr-3">
                                <TrendingDown size={14} color="#F87171" />
                            </View>
                            <View>
                                <Typography className="text-white/30 text-[8px] uppercase font-bold">Keluar (Bulan Ini)</Typography>
                                <Typography className="text-rose-400 text-xs font-bold">
                                    {formatCurrency(
                                        Object.values(balances || {}).reduce((acc: number, curr: any) => {
                                            if (typeof curr === 'object' && curr !== null && 'total_keluar_bulan_ini' in curr) {
                                                return acc + (curr.total_keluar_bulan_ini || 0);
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
                    <Typography variant="h3" weight="bold" className="text-gray-800">Daftar Rekening</Typography>
                    <TouchableOpacity
                        onPress={() => router.push('/finance/laporan')}
                        className="flex-row items-center bg-primary/5 px-3 py-1.5 rounded-full"
                    >
                        <FileText size={12} color="#023C69" />
                        <Typography className="text-primary text-[10px] font-bold ml-1.5 uppercase">Buka Laporan</Typography>
                    </TouchableOpacity>
                </View>

                {isLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                        <View key={i} className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 flex-row items-center">
                            <Skeleton width={64} height={64} borderRadius={20} style={{ marginRight: 16 }} />
                            <View className="flex-1">
                                <Skeleton width="50%" height={24} style={{ marginBottom: 8 }} />
                                <Skeleton width="70%" height={16} style={{ marginBottom: 16 }} />
                                <Skeleton width="100%" height={40} borderRadius={12} />
                            </View>
                        </View>
                    ))
                ) : (
                    <>
                        {/* Reports & Summaries */}
                        <View className="mb-4">
                            <Typography className="text-gray-400 text-[10px] uppercase font-bold mb-4 ml-1 tracking-widest">Komponen Laporan Keuangan</Typography>
                            {renderSummaryItem('PIUTANG')}
                            {renderSummaryItem('HUTANG')}
                        </View>

                        <View className="mb-4">
                            <View className="flex-row items-center justify-between mb-4 px-1">
                                <Typography className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">Kas & Rekening Bank</Typography>
                                <TouchableOpacity
                                    onPress={() => setShowAllAccounts(!showAllAccounts)}
                                    className="bg-primary/5 px-2 py-1 rounded-lg"
                                >
                                    <Typography className="text-primary text-[10px] font-bold">
                                        {showAllAccounts ? 'Sembunyikan Saldo 0' : 'Tampilkan Semua'}
                                    </Typography>
                                </TouchableOpacity>
                            </View>
                            {DUMMY_ACCOUNTS.map(renderAccountItem)}
                        </View>
                    </>
                )}

                <View className="h-20" />
            </ScrollView>

            {/* Adjustment Modal - Platform Specific */}
            {Platform.OS === 'web' ? (
                <Modal visible={isAdjustModalVisible} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity className="absolute inset-0" onPress={() => setIsAdjustModalVisible(false)} />
                        <View style={styles.webModalContent}>
                            <View className="flex-row justify-between items-center mb-6">
                                <Typography variant="h2" weight="bold">Penyesuaian Saldo</Typography>
                                <TouchableOpacity onPress={() => setIsAdjustModalVisible(false)}>
                                    <X size={24} color="#6B7280" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false}>
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
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    onClose={() => {
                        setIsAdjustModalVisible(false);
                        setIsSheetOpen(false);
                    }}
                >
                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        <View className="px-6 py-2">
                            <Typography variant="h2" weight="bold" className="mb-6">Penyesuaian Saldo</Typography>
                            {renderAdjustContent()}
                        </View>
                    </BottomSheetScrollView>
                </BottomSheet>
            )}

            {/* Success Alert */}
            <AlertDialog
                visible={showSuccessAlert}
                title="Berhasil"
                message={alertMessage}
                variant="success"
                onClose={() => setShowSuccessAlert(false)}
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
        backgroundColor: 'white',
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
