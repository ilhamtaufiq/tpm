import { appAlert } from '../../utils/appAlert';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator, Platform, Modal, StyleSheet } from 'react-native';
import { format, startOfMonth, isValid, parse } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import {
    PieChart,
    BarChart3,
    Scale,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    FileText,
    TrendingUp,
    TrendingDown,
    Building2,
    Briefcase,
    Settings,
    ShieldCheck,
    HelpCircle,
    Info,
    X
} from 'lucide-react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Input } from '../../components/ui/Input';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { keuanganService } from '../../services/keuangan';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/format';
import { Header } from '../../components/ui/Header';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSheetChrome } from '../../utils/themeStyles';
import { useUIStore } from '../../store/useUIStore';

type ReportType = 'LABA_RUGI' | 'MODAL' | 'NERACA';

export default function LaporanKeuanganScreen() {
    const themeColors = useUIStore((s) => s.themeColors);
    const insets = useSafeAreaInsets();
    const chrome = useSheetChrome();
    const router = useRouter();
    const [reportType, setReportType] = useState<ReportType>('LABA_RUGI');
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Data states
    const [profitData, setProfitData] = useState<any>(null);
    const [capitalData, setCapitalData] = useState<any>(null);
    const [neracaData, setNeracaData] = useState<any>(null);

    // Filters
    const [dateRange, setDateRange] = useState({
        dari: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        sampai: format(new Date(), 'yyyy-MM-dd')
    });

    // Setup Modal state
    const [isSetupModalVisible, setIsSetupModalVisible] = useState(false);
    const [setupForm, setSetupForm] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        modal_awal: '',
        bca: '',
        kas_tunai: '',
        keterangan: 'Migrasi data awal manual'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');

    // Date Selection Modal
    const [isDateModalVisible, setIsDateModalVisible] = useState(false);
    const [tempDateRange, setTempDateRange] = useState({ ...dateRange });

    // Sheet refs
    const setupSheetRef = useRef<BottomSheet>(null);
    const dateSheetRef = useRef<BottomSheet>(null);
    const setupSnapPoints = useMemo(() => ['75%', '90%'], []);
    const dateSnapPoints = useMemo(() => ['50%', '70%'], []);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    // Sync sheet with visible state
    useEffect(() => {
        if (Platform.OS !== 'web') {
            if (isSetupModalVisible) {
                setupSheetRef.current?.expand();
                setIsSheetOpen(true);
            } else {
                setupSheetRef.current?.close();
            }
        }
    }, [isSetupModalVisible]);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            if (isDateModalVisible) {
                dateSheetRef.current?.expand();
                setIsSheetOpen(true);
            } else {
                dateSheetRef.current?.close();
            }
        }
    }, [isDateModalVisible]);

    const fetchReport = useCallback(async () => {
        setIsLoading(true);
        try {
            if (reportType === 'LABA_RUGI') {
                const data = await keuanganService.getLabaRugiReport({
                    tanggal_dari: dateRange.dari,
                    tanggal_sampai: dateRange.sampai
                });
                setProfitData(data);
            } else if (reportType === 'MODAL') {
                const data = await keuanganService.getModalReport({
                    tanggal_dari: dateRange.dari,
                    tanggal_sampai: dateRange.sampai
                });
                setCapitalData(data);
            } else if (reportType === 'NERACA') {
                const data = await keuanganService.getNeracaReport({
                    as_of_date: dateRange.sampai
                });
                setNeracaData(data);
            }
        } catch (error) {
            console.error('Error fetching report:', error);
            appAlert('Error', 'Gagal memuat laporan');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [reportType, dateRange]);

    const handleSetupSubmit = async () => {
        if (!setupForm.modal_awal && !setupForm.bca && !setupForm.kas_tunai) {
            appAlert('Peringatan', 'Harap isi minimal 1 saldo awal');
            return;
        }

        setIsSubmitting(true);
        try {
            const promises = [];

            // 1. Transaction for Modal Awal
            if (setupForm.modal_awal) {
                promises.push(keuanganService.createTransaction({
                    tanggal: setupForm.tanggal,
                    jenis: 'CASH',
                    tipe: 'MASUK',
                    nominal: parseFloat(setupForm.modal_awal),
                    sumber: 'MODAL',
                    keterangan: setupForm.keterangan || 'Setoran Modal Awal (Migrasi)'
                }));
            }

            // 2. Adjustment for BCA
            if (setupForm.bca) {
                promises.push(keuanganService.adjustBalance({
                    jenis: 'BANK_BCA',
                    nominal: parseFloat(setupForm.bca),
                    tanggal: setupForm.tanggal,
                    keterangan: setupForm.keterangan || 'Saldo Awal Bank BCA'
                }));
            }

            // 3. Adjustment for Kas Tunai
            if (setupForm.kas_tunai) {
                promises.push(keuanganService.adjustBalance({
                    jenis: 'CASH',
                    nominal: parseFloat(setupForm.kas_tunai),
                    tanggal: setupForm.tanggal,
                    keterangan: setupForm.keterangan || 'Saldo Awal Kas Tunai'
                }));
            }

            await Promise.all(promises);

            setIsSetupModalVisible(false);
            setAlertMessage('Berhasil melakukan migrasi data saldo awal keuangan.');
            setShowSuccessAlert(true);
            fetchReport();
        } catch (error) {
            console.error('Error setup financial:', error);
            appAlert('Error', 'Gagal memproses migrasi data');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const onRefresh = () => {
        setIsRefreshing(true);
        fetchReport();
    };

    const handleApplyDate = () => {
        const dariValid = isValid(parse(tempDateRange.dari, 'yyyy-MM-dd', new Date()));
        const sampaiValid = isValid(parse(tempDateRange.sampai, 'yyyy-MM-dd', new Date()));

        if (!dariValid || !sampaiValid) {
            appAlert('Kesalahan', 'Format tanggal tidak valid (Gunakan YYYY-MM-DD)');
            return;
        }

        setDateRange(tempDateRange);
        setIsDateModalVisible(false);
    };

    const renderSetupContent = () => (
        <View className="p-0">
            <View className="bg-blue-50 p-4 rounded-3xl border border-blue-100 mb-6 flex-row items-start">
                <ShieldCheck size={20} color="themeColors.primary" />
                <Typography className="flex-1 ml-3 text-blue-800 text-xs leading-5">
                    Gunakan fitur ini untuk memasukkan saldo dari pembukuan manual Anda sebelumnya. Data ini akan menjadi <Typography weight="bold">titik awal</Typography> laporan keuangan di aplikasi ini.
                </Typography>
            </View>

            <Input
                label="TANGGAL MIGRASI"
                value={setupForm.tanggal}
                onChangeText={(v) => setSetupForm({ ...setupForm, tanggal: v })}
                placeholder="YYYY-MM-DD"
                startIcon={<Calendar size={18} color="#9CA3AF" />}
            />

            <Typography className="text-textGray text-[10px] uppercase font-bold mb-4 mt-2 ml-1">Modal & Ekuitas</Typography>
            <Input
                label="MODAL AWAL / DISETORE"
                value={setupForm.modal_awal}
                onChangeText={(v) => setSetupForm({ ...setupForm, modal_awal: v })}
                keyboardType="numeric"
                placeholder="0"
                startIcon={<Typography weight="bold" className="text-textGray">Rp</Typography>}
            />

            <Typography className="text-textGray text-[10px] uppercase font-bold mb-4 mt-2 ml-1">Asset Lancar (Kas & Bank)</Typography>
            <Input
                label="SALDO BANK BCA"
                value={setupForm.bca}
                onChangeText={(v) => setSetupForm({ ...setupForm, bca: v })}
                keyboardType="numeric"
                placeholder="0"
                startIcon={<Typography weight="bold" className="text-textGray">Rp</Typography>}
            />
            <Input
                label="SALDO KAS TUNAI"
                value={setupForm.kas_tunai}
                onChangeText={(v) => setSetupForm({ ...setupForm, kas_tunai: v })}
                keyboardType="numeric"
                placeholder="0"
                startIcon={<Typography weight="bold" className="text-textGray">Rp</Typography>}
            />

            <Input
                label="KETERANGAN"
                value={setupForm.keterangan}
                onChangeText={(v) => setSetupForm({ ...setupForm, keterangan: v })}
                placeholder="Contoh: Migrasi pembukuan manual 2024"
                startIcon={<FileText size={18} color="#9CA3AF" />}
            />

            <View className="flex-row mt-4 space-x-3 pb-8">
                <View className="flex-1">
                    <Button
                        variant="outline"
                        title="Batal"
                        onPress={() => setIsSetupModalVisible(false)}
                        disabled={isSubmitting}
                    />
                </View>
                <View className="flex-1">
                    <Button
                        title="Proses Migrasi"
                        onPress={handleSetupSubmit}
                        loading={isSubmitting}
                    />
                </View>
            </View>
        </View>
    );

    const renderDateContent = () => (
        <View className="p-0">
            <Typography className="text-textGray text-[10px] uppercase font-bold mb-4 ml-1">Rentang Tanggal</Typography>
            <Input
                label="DARI TANGGAL"
                value={tempDateRange.dari}
                onChangeText={(v) => setTempDateRange({ ...tempDateRange, dari: v })}
                placeholder="YYYY-MM-DD"
                startIcon={<Calendar size={18} color="#9CA3AF" />}
            />
            <Input
                label="SAMPAI TANGGAL"
                value={tempDateRange.sampai}
                onChangeText={(v) => setTempDateRange({ ...tempDateRange, sampai: v })}
                placeholder="YYYY-MM-DD"
                startIcon={<Calendar size={18} color="#9CA3AF" />}
            />

            <View className="flex-row mt-6 space-x-3 pb-8">
                <View className="flex-1">
                    <Button
                        variant="outline"
                        title="Batal"
                        onPress={() => setIsDateModalVisible(false)}
                    />
                </View>
                <View className="flex-1">
                    <Button
                        title="Terapkan"
                        onPress={handleApplyDate}
                    />
                </View>
            </View>
        </View>
    );



    const renderProfitLoss = () => {
        if (!profitData) return null;

        const units = profitData.units || {};
        const summary = profitData.summary || {};
        const bengkel = units.bengkel || {};
        const jasaAngkut = units.jasa_angkut || {};
        const mobil = units.mobil || {};
        // Pakai angka backend apa adanya. Menurunkan ulang dari field per unit
        // ganda-hitung komponen yang sudah masuk HPP (ja.maintenance sudah ada di
        // ja_laba_kotor; b_ops/gaji/lembur sudah ada di laba bersih unit). Backend
        // juga sudah memisahkan beban unit vs overhead pusat.
        const totalRevenue = summary.total_revenue ?? 0;
        const labaKotor = summary.total_laba_kotor ?? 0;
        const totalBeban = (summary.total_beban_operasional || 0) + (summary.total_beban_umum || 0);
        const labaBersih = summary.laba_bersih ?? 0;

        return (
            <View className="space-y-6">
                {/* Net Profit Card */}
                <View className="bg-emerald-600 p-6 rounded-[32px] shadow-lg border border-emerald-400">
                    <Typography className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Total Laba Bersih</Typography>
                    <Typography weight="bold" className="text-white text-3xl">{formatCurrency(labaBersih)}</Typography>
                    <View className="mt-4 pt-4 border-t border-white/10 flex-row justify-between">
                        <View>
                            <Typography className="text-white/40 text-[8px] font-bold uppercase">Margin Profit</Typography>
                            <Typography weight="bold" className="text-white text-sm">
                                {totalRevenue > 0 ? ((labaBersih / totalRevenue) * 100).toFixed(1) : 0}%
                            </Typography>
                        </View>
                        <View className="bg-surface/20 px-3 py-1.5 rounded-full self-center">
                            <Typography className="text-white text-[10px] font-bold">PERIODE INI</Typography>
                        </View>
                    </View>
                </View>

                {/* Pendapatan Section */}
                <View>
                    <Typography variant="h3" weight="bold" className="text-text mb-4 px-1">Pendapatan Operasional</Typography>
                    <View className="bg-surface rounded-[32px] p-2 shadow-sm border border-transparent">
                        {([
                            ['Bengkel', bengkel.revenue || 0],
                            ['Jasa Angkut', jasaAngkut.revenue || 0],
                            ['Jual Beli Mobil', mobil.revenue || 0],
                        ] as Array<[string, number]>).map(([key, value]) => (
                            <View key={key} className="flex-row items-center p-4 border-b border-transparent last:border-b-0">
                                <View className="w-10 h-10 bg-emerald-50 rounded-xl items-center justify-center mr-3">
                                    <ArrowUpRight size={18} color="#059669" />
                                </View>
                                <View className="flex-1">
                                    <Typography weight="bold" className="text-text">{key}</Typography>
                                    <Typography className="text-textGray text-xs">Pendapatan terakui periode ini</Typography>
                                </View>
                                <Typography weight="bold" className="text-emerald-600">{formatCurrency(value)}</Typography>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Laba Kotor Section */}
                <View>
                    <Typography weight="bold" className="text-textGray text-[10px] uppercase mb-4 px-1 tracking-widest">Gross Profit (Laba Kotor)</Typography>
                    <View className="bg-emerald-50/50 rounded-[32px] p-4 flex-row justify-between items-center border border-emerald-100/50">
                        <View className="flex-row items-center">
                            <TrendingUp size={18} color="#059669" />
                            <Typography weight="bold" className="text-emerald-800 ml-2">Total Laba Kotor</Typography>
                        </View>
                        <Typography weight="bold" className="text-emerald-600 text-lg">{formatCurrency(labaKotor)}</Typography>
                    </View>
                </View>

                {/* Pengeluaran Section */}
                <View>
                    <Typography variant="h3" weight="bold" className="text-text mb-4 px-1">Beban & Pengeluaran</Typography>
                    <View className="bg-surface rounded-[32px] p-2 shadow-sm border border-transparent">
                        {([
                            ['Bengkel', (bengkel.beban_operasional || 0) + (bengkel.beban_gaji || 0) + (bengkel.beban_lembur || 0)],
                            ['Jasa Angkut', (jasaAngkut.beban_operasional || 0) + (jasaAngkut.maintenance || 0) + (jasaAngkut.beban_umum || 0)],
                            ['Jual Beli Mobil', (mobil.beban_umum || 0) + (mobil.sharing_investor || 0)],
                            ['Operasional Pusat', summary.total_beban_umum || 0],
                            ['Prive', summary.prive || 0],
                        ] as Array<[string, number]>).map(([key, value]) => (
                            <View key={key} className="flex-row items-center p-4 border-b border-transparent">
                                <View className="w-10 h-10 bg-rose-50 rounded-xl items-center justify-center mr-3">
                                    <ArrowDownRight size={18} color="#E11D48" />
                                </View>
                                <View className="flex-1">
                                    <Typography weight="bold" className="text-text">{key}</Typography>
                                    <View className="flex-row items-center">
                                        <Typography className="text-textGray text-xs">Beban laporan laba rugi</Typography>
                                    </View>
                                </View>
                                <Typography weight="bold" className="text-rose-600">({formatCurrency(value)})</Typography>
                            </View>
                        ))}
                        <View className="p-4 bg-surface/50 rounded-b-[24px] flex-row justify-between items-center">
                            <Typography weight="bold" className="text-textGray text-xs uppercase">TOTAL BEBAN</Typography>
                            <Typography weight="bold" className="text-rose-600 text-lg">{formatCurrency(totalBeban + (summary.prive || 0))}</Typography>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderCapitalReport = () => {
        if (!capitalData) return null;

        const penambahan = capitalData.penambahan || {};
        const pengurangan = capitalData.pengurangan || {};
        // modal_non_kas.total sudah termasuk stok_mobil (ia ringkasan dari
        // setoran_mobil + setoran_piutang − setoran_hutang). Menambahkannya lagi
        // seperti dulu (total + stok_mobil) menghitung stok dua kali.
        const modalNonKas = penambahan.modal_non_kas?.total || 0;
        const labaBersih = capitalData.info?.laba_bersih ?? capitalData.laba_ditahan_periode ?? 0;
        const prive = (pengurangan.prive || 0) + (pengurangan.pengembalian_modal || 0);
        const labaOperasional = capitalData.info?.laba_operasional ?? (labaBersih + prive);
        // Dana & pembayaran investor = hutang, bukan aliran ekuitas (selaras
        // modal_service.raw_theoretical). laba_operasional sudah net dari laba investor.
        const perubahanBersih = (penambahan.setoran_modal || 0) + modalNonKas + labaOperasional - prive;

        return (
            <View className="space-y-6">
                {/* Capital Overview */}
                <View className="bg-primary p-6 rounded-[32px] shadow-lg border border-primary-light">
                    <Typography className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Modal Akhir Estimasi</Typography>
                    <Typography weight="bold" className="text-white text-3xl">{formatCurrency(capitalData.modal_akhir || 0)}</Typography>
                    <Typography className="text-white/40 text-[8px] mt-2">Mengikuti laporan perubahan modal backend</Typography>
                </View>

                {/* Section A & C Group */}
                <View className="bg-surface rounded-[40px] p-6 shadow-sm border border-transparent">
                    <Typography weight="bold" className="text-text mb-6 flex-row items-center">
                        <Briefcase size={16} color="themeColors.primary" />  Mutasi Ekuitas
                    </Typography>

                    <View className="space-y-4">
                        <View className="flex-row justify-between items-center bg-background p-4 rounded-2xl">
                            <Typography className="text-textGray">Setoran Modal</Typography>
                            <Typography weight="bold" className="text-emerald-600">{formatCurrency(penambahan.setoran_modal || 0)}</Typography>
                        </View>
                        <View className="flex-row justify-between items-center bg-background p-4 rounded-2xl">
                            <Typography className="text-textGray">Setoran Non-Kas / Stok</Typography>
                            <Typography weight="bold" className="text-emerald-600">{formatCurrency(modalNonKas)}</Typography>
                        </View>
                        <View className="flex-row justify-between items-center bg-background p-4 rounded-2xl">
                            <Typography className="text-textGray">Laba Operasional Periode</Typography>
                            <Typography weight="bold" className="text-emerald-600">{formatCurrency(labaOperasional)}</Typography>
                        </View>
                        <View className="flex-row justify-between items-center bg-rose-50 p-4 rounded-2xl">
                            <Typography className="text-rose-800">Prive / Penarikan</Typography>
                            <Typography weight="bold" className="text-rose-600">({formatCurrency(prive)})</Typography>
                        </View>
                    </View>
                </View>

                <View className="bg-surface rounded-[40px] p-6 shadow-sm border border-transparent">
                    <Typography weight="bold" className="text-text mb-6 flex-row items-center">
                        <ArrowUpRight size={16} color="#059669" />  Perubahan Bersih Modal
                    </Typography>
                    <Typography weight="bold" className="text-emerald-600 text-2xl mb-4">{formatCurrency(perubahanBersih)}</Typography>
                    <Typography className="text-textGray text-xs">Nilai ini mengikuti komponen penambahan dan pengurangan pada laporan perubahan modal.</Typography>
                </View>
            </View>
        );
    };

    const renderNeraca = () => {
        if (!neracaData) return null;

        const { aktiva_lancar, aktiva_tetap, hutang, modal, total_aktiva, total_pasiva } = neracaData;
        const totalHutang = hutang?.total_hutang || 0;

        return (
            <View className="space-y-6">
                {/* Balancing Bento */}
                <View className="flex-row space-x-4">
                    <View className="flex-1 bg-surface p-5 rounded-[32px] shadow-sm border border-transparent">
                        <Typography className="text-textGray text-[10px] font-bold uppercase mb-1">Total Aktiva</Typography>
                        <Typography weight="bold" className="text-primary text-xl" numberOfLines={1}>{formatCurrency(total_aktiva)}</Typography>
                    </View>
                    <View className="flex-1 bg-surface p-5 rounded-[32px] shadow-sm border border-transparent">
                        <Typography className="text-textGray text-[10px] font-bold uppercase mb-1">Total Pasiva</Typography>
                        <Typography weight="bold" className="text-emerald-600 text-xl" numberOfLines={1}>{formatCurrency(total_pasiva)}</Typography>
                    </View>
                </View>

                {/* Assets Section */}
                <View className="bg-surface rounded-[40px] p-6 shadow-sm border border-transparent">
                    <View className="flex-row items-center mb-6">
                        <View className="w-8 h-8 bg-emerald-100 rounded-full items-center justify-center mr-3">
                            <TrendingUp size={16} color="#059669" />
                        </View>
                        <Typography weight="bold" className="text-text text-lg">AKTIVA (Harta)</Typography>
                    </View>

                    <View className="space-y-6">
                        <View>
                            <Typography weight="bold" className="text-textGray text-[10px] uppercase mb-3 ml-1">Aktiva Lancar</Typography>
                            <View className="space-y-3">
                                <View className="flex-row justify-between items-center py-1">
                                    <Typography className="text-textGray">Kas & Bank</Typography>
                                    <Typography weight="bold" className="text-text">{formatCurrency(aktiva_lancar.total_kas_bank)}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center py-1">
                                    <Typography className="text-textGray">Piutang Usaha</Typography>
                                    <Typography weight="bold" className="text-text">{formatCurrency(aktiva_lancar.total_piutang)}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center py-1">
                                    <Typography className="text-textGray">Persediaan Sparepart</Typography>
                                    <Typography weight="bold" className="text-text">{formatCurrency(aktiva_lancar.persediaan_sparepart)}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center py-1">
                                    <Typography className="text-textGray">Stok Mobil Dagangan</Typography>
                                    <Typography weight="bold" className="text-text">{formatCurrency(aktiva_lancar.stok_mobil)}</Typography>
                                </View>
                            </View>
                        </View>

                        <View className="pt-4 border-t border-transparent text-right">
                            <Typography weight="bold" className="text-textGray text-[10px] uppercase mb-3 ml-1">Aktiva Tetap</Typography>
                            <View className="flex-row justify-between items-center py-1">
                                <Typography className="text-textGray">Aset Tetap (Peralatan/Kendaraan)</Typography>
                                <Typography weight="bold" className="text-text">{formatCurrency(aktiva_tetap.total_aktiva_tetap || 0)}</Typography>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Liabilities & Equity Section */}
                <View className="bg-surface rounded-[40px] p-6 shadow-sm border border-transparent">
                    <View className="flex-row items-center mb-6">
                        <View className="w-8 h-8 bg-rose-100 rounded-full items-center justify-center mr-3">
                            <TrendingDown size={16} color="#B91C1C" />
                        </View>
                        <Typography weight="bold" className="text-text text-lg">PASIVA (Kewajiban & Modal)</Typography>
                    </View>

                    <View className="space-y-6">
                        <View>
                            <Typography weight="bold" className="text-textGray text-[10px] uppercase mb-3 ml-1">Kewajiban (Hutang)</Typography>
                            <View className="space-y-3">
                                <View className="flex-row justify-between items-center py-1">
                                    <Typography className="text-textGray">Hutang Supplier Sparepart</Typography>
                                    <Typography weight="bold" className="text-text">{formatCurrency(hutang.hutang_part)}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center py-1">
                                    <Typography className="text-textGray">Hutang Supplier Mobil</Typography>
                                    <Typography weight="bold" className="text-text">{formatCurrency(hutang.hutang_mobil)}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center py-1">
                                    <Typography className="text-textGray">Hutang Investor</Typography>
                                    <Typography weight="bold" className="text-text">{formatCurrency(hutang.hutang_investor || 0)}</Typography>
                                </View>
                                <View className="flex-row justify-between items-center py-1">
                                    <Typography className="text-textGray">Hutang Lainnya</Typography>
                                    <Typography weight="bold" className="text-text">{formatCurrency(hutang.hutang_lainnya || 0)}</Typography>
                                </View>
                                {(hutang.uang_muka_penjualan || 0) > 0 && (
                                    <View className="flex-row justify-between items-center py-1">
                                        <Typography className="text-textGray">Uang Muka Penjualan</Typography>
                                        <Typography weight="bold" className="text-text">{formatCurrency(hutang.uang_muka_penjualan || 0)}</Typography>
                                    </View>
                                )}
                                {(hutang.piutang_booking || 0) > 0 && (
                                    <View className="flex-row justify-between items-center py-1">
                                        <Typography className="text-textGray">Sisa Kewajiban Booking</Typography>
                                        <Typography weight="bold" className="text-text">{formatCurrency(hutang.piutang_booking || 0)}</Typography>
                                    </View>
                                )}
                                <View className="flex-row justify-between items-center py-1 border-t border-transparent mt-2 pt-3">
                                    <Typography weight="bold" className="text-text">Total Hutang</Typography>
                                    <Typography weight="bold" className="text-rose-600">{formatCurrency(totalHutang)}</Typography>
                                </View>
                            </View>
                        </View>

                        <View className="pt-4 border-t border-transparent">
                            <Typography weight="bold" className="text-textGray text-[10px] uppercase mb-3 ml-1">Ekuitas (Modal)</Typography>
                            <View className="flex-row justify-between items-center py-1">
                                <Typography className="text-textGray">Modal Disetorkan & Laba</Typography>
                                <Typography weight="bold" className="text-emerald-600 text-lg">{formatCurrency(modal.total_modal)}</Typography>
                            </View>
                        </View>
                    </View>
                </View>

                {!neracaData.is_balanced && (
                    <View className="bg-amber-50 p-4 rounded-[24px] border border-amber-100 flex-row items-center">
                        <Scale size={20} color="#D97706" />
                        <Typography className="text-amber-800 text-[10px] font-bold ml-3 flex-1">
                            PERHATIAN: Laporan tidak seimbang (Selisih: {formatCurrency(neracaData.selisih)}). Harap periksa input data.
                        </Typography>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-surface">
            <Header
                title="Laporan Keuangan"
                subtitle="Analisis & Ringkasan Performa"
                showBackButton
                onBackButtonPress={() => router.back()}
                rightElement={
                    <Pressable
                        onPress={() => setIsSetupModalVisible(true)}
                        className="w-11 h-11 bg-background rounded-2xl items-center justify-center border border-transparent active:bg-background"
                    >
                        <Settings size={20} color="#1F2937" />
                    </Pressable>
                }
            />

            {/* Report Selector Tab */}
            <View className="px-6 mt-4">
                <View className="bg-surface p-3 rounded-[24px] border border-transparent shadow-sm flex-row gap-x-2">
                    {(['LABA_RUGI', 'MODAL', 'NERACA'] as ReportType[]).map((type) => (
                        <Pressable
                            key={type}
                            onPress={() => setReportType(type)}
                            className={`flex-1 py-2.5 items-center rounded-xl ${reportType === type ? 'bg-primary shadow-sm' : 'bg-background border border-transparent'}`}
                        >
                            <Typography
                                weight="bold"
                                className={`text-[10px] uppercase tracking-wider ${reportType === type ? 'text-white font-bold' : 'text-textGray'}`}
                            >
                                {type.replace('_', ' ')}
                            </Typography>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* Global Header Integration */}

            <ScrollView
                className="flex-1 px-6 pt-6"
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="themeColors.primary" />
                }
            >
                {/* Date Filter View */}
                <Pressable
                    onPress={() => setIsDateModalVisible(true)}
                    className="flex-row items-center justify-between mb-8 bg-surface p-4 rounded-[24px] shadow-sm border border-transparent"
                >
                    <View className="flex-row items-center">
                        <Calendar size={18} color="themeColors.primary" />
                        <Typography className="text-text text-xs font-bold ml-3">{dateRange.dari} s/d {dateRange.sampai}</Typography>
                    </View>
                    <View className="bg-primary/5 px-2 py-1 rounded-lg">
                        <Typography className="text-primary text-[10px] font-bold">Ubah Periode</Typography>
                    </View>
                </Pressable>

                {isLoading && !isRefreshing ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <ActivityIndicator size="large" color="themeColors.primary" />
                        <Typography className="text-textGray text-xs mt-4">Menyiapkan laporan...</Typography>
                    </View>
                ) : (
                    <>
                        {reportType === 'LABA_RUGI' && renderProfitLoss()}
                        {reportType === 'MODAL' && renderCapitalReport()}
                        {reportType === 'NERACA' && renderNeraca()}
                        <View style={{ height: getCustomTabBarBottomPadding(insets.bottom, 16) }} />
                    </>
                )}
            </ScrollView>

            {/* Modal UI - Platform Specific */}
            {Platform.OS === 'web' ? (
                <>
                    {/* Setup Modal */}
                    <Modal visible={isSetupModalVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <Pressable className="absolute inset-0" onPress={() => setIsSetupModalVisible(false)} />
                            <View className="bg-surface" style={styles.webModalContent}>
                                <View className="flex-row justify-between items-center mb-6">
                                    <Typography variant="h2" weight="bold">Migrasi Data Awal</Typography>
                                    <Pressable onPress={() => setIsSetupModalVisible(false)}>
                                        <X size={24} color="#6B7280" />
                                    </Pressable>
                                </View>
                                <ScrollView
                                    style={{ maxHeight: 480, flexGrow: 0 }}
                                    showsVerticalScrollIndicator
                                    nestedScrollEnabled
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {renderSetupContent()}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>

                    {/* Date Modal */}
                    <Modal visible={isDateModalVisible} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <Pressable className="absolute inset-0" onPress={() => setIsDateModalVisible(false)} />
                            <View className="bg-surface" style={styles.webModalContent}>
                                <View className="flex-row justify-between items-center mb-6">
                                    <Typography variant="h2" weight="bold">Pilih Periode Laporan</Typography>
                                    <Pressable onPress={() => setIsDateModalVisible(false)}>
                                        <X size={24} color="#6B7280" />
                                    </Pressable>
                                </View>
                                {renderDateContent()}
                            </View>
                        </View>
                    </Modal>
                </>
            ) : (
                <>
                    {/* Mobile Bottom Sheets */}
                    <BottomSheet
                        ref={setupSheetRef}
                        index={-1}
                        snapPoints={setupSnapPoints}
                        enablePanDownToClose
                        backgroundStyle={chrome.backgroundStyle}
                    handleIndicatorStyle={chrome.handleIndicatorStyle}
                        onClose={() => {
                            setIsSetupModalVisible(false);
                            setIsSheetOpen(false);
                        }}
                    >
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            <View className="px-6 py-2">
                                <Typography variant="h2" weight="bold" className="mb-6">Migrasi Data Awal</Typography>
                                {renderSetupContent()}
                            </View>
                        </BottomSheetScrollView>
                    </BottomSheet>

                    <BottomSheet
                        ref={dateSheetRef}
                        index={-1}
                        snapPoints={dateSnapPoints}
                        enablePanDownToClose
                        backgroundStyle={chrome.backgroundStyle}
                    handleIndicatorStyle={chrome.handleIndicatorStyle}
                        onClose={() => {
                            setIsDateModalVisible(false);
                            setIsSheetOpen(false);
                        }}
                    >
                        <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                            <View className="px-6 py-2">
                                <Typography variant="h2" weight="bold" className="mb-6">Pilih Periode Laporan</Typography>
                                {renderDateContent()}
                            </View>
                        </BottomSheetScrollView>
                    </BottomSheet>
                </>
            )}

            {/* Success Alert */}
            <AlertDialog
                visible={showSuccessAlert}
                title="Migrasi Berhasil"
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
