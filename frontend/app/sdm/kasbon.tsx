import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Platform, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
    ChevronLeft,
    Plus,
    Wallet,
    User,
    Calendar,
    Check,
    X,
    AlertTriangle,
    RefreshCw,
    Trash2,
    Search,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { sdmService, Kasbon, KasbonSummary, PaymentStatus, Karyawan } from '../../services/sdm';
import { formatCurrency, formatDate, formatNumber, parseNumber } from '../../utils/format';
import { useAlert } from '../../context/AlertContext';
import { getErrorMessage } from '../../utils/error';
import { PaymentModal } from '../../components/PaymentModal';
import { Header } from '../../components/ui/Header';
import { useAuthStore } from '../../store/useAuthStore';

const STATUS_FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'BELUM_LUNAS', label: 'Belum Lunas' },
    { key: 'LUNAS', label: 'Lunas' },
];

export default function KasbonScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [kasbonList, setKasbonList] = useState<Kasbon[]>([]);
    const [summary, setSummary] = useState<KasbonSummary | null>(null);
    const [selectedFilter, setSelectedFilter] = useState<PaymentStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);

    // Form state (New Kasbon)
    const [formData, setFormData] = useState({
        karyawan_id: 0,
        karyawan_nama: '',
        jumlah: '',
        metode_bayar: 'tunai',
        keterangan: '',
    });
    const [showKaryawanPicker, setShowKaryawanPicker] = useState(false);
    const [isSplitDisbursement, setIsSplitDisbursement] = useState(false);
    const [disbursements, setDisbursements] = useState<{ id: number; metode: string; nominal: string }[]>([
        { id: Date.now() + Math.random(), metode: 'tunai', nominal: '' }
    ]);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedKasbon, setSelectedKasbon] = useState<Kasbon | null>(null);

    // Filtered List
    const filteredKasbonList = useMemo(() => {
        let list = kasbonList;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            list = list.filter(item =>
                item.karyawan_nama?.toLowerCase().includes(query) ||
                item.nomor_kasbon?.toLowerCase().includes(query)
            );
        }
        return list;
    }, [kasbonList, searchQuery]);

    // Sheet State
    const [activeSheet, setActiveSheet] = useState<'none' | 'create' | 'detail'>('none');

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    const { showAlert } = useAlert();

    const createSheetRef = useRef<BottomSheet>(null);
    const detailSheetRef = useRef<BottomSheet>(null);

    const createSnapPoints = useMemo(() => ['75%', '90%'], []);
    const detailSnapPoints = useMemo(() => ['70%', '85%'], []);

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/sdm');
        }
    };

    const loadData = useCallback(async () => {
        try {
            const params: any = { limit: 100 };
            if (selectedFilter !== 'all') {
                params.status = selectedFilter;
            }
            const [listRes, summaryRes, karyawanRes] = await Promise.all([
                sdmService.getKasbonList(params),
                sdmService.getKasbonSummary(),
                sdmService.getActiveKaryawan(),
            ]);
            setKasbonList(listRes.data || []);
            setSummary(summaryRes);
            setKaryawanList(karyawanRes);
        } catch (error) {
            console.error('Failed to load kasbon:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const openAddForm = () => {
        setFormData({ 
            karyawan_id: 0, 
            karyawan_nama: '', 
            jumlah: '', 
            metode_bayar: 'tunai', 
            keterangan: '' 
        });
        setDisbursements([{ id: Date.now() + Math.random(), metode: 'tunai', nominal: '' }]);
        setIsSplitDisbursement(false);
        setActiveSheet('create');
        if (Platform.OS !== 'web') {
            createSheetRef.current?.expand();
        }
    };

    const handleOpenDetail = (kasbon: Kasbon) => {
        setSelectedKasbon(kasbon);
        setActiveSheet('detail');
        if (Platform.OS === 'web') {
            // Handled by state
        } else {
            detailSheetRef.current?.expand();
        }
    };

    const handleCloseSheet = useCallback(() => {
        setActiveSheet('none');
        if (Platform.OS !== 'web') {
            createSheetRef.current?.close();
            detailSheetRef.current?.close();
        }
        setSelectedKasbon(null);
        // setEditData(null); // Assuming setEditData might be added later, commenting out for now
    }, []);

    const closeSheets = handleCloseSheet;

    const handleSubmitCreate = async () => {
        if (!formData.karyawan_id || !formData.jumlah) {
            showAlert({ title: 'Validasi', message: 'Karyawan dan Jumlah wajib diisi', variant: 'warning' });
            return;
        }

        try {
            const nominalTotal = parseNumber(formData.jumlah);
            const isBengkelUser = user?.role === 'BENGKEL';
            const unit = isBengkelUser ? 'BENGKEL' : 'LAINNYA';
            const cashAccount = formData.metode_bayar === 'transfer'
                ? 'BANK_UTAMA'
                : isBengkelUser
                    ? 'KAS_UNIT_BENGKEL'
                    : 'KAS_UTAMA';

            await sdmService.createKasbon({
                karyawan_id: formData.karyawan_id,
                tanggal: new Date().toISOString().split('T')[0],
                nominal: nominalTotal,
                metode_bayar: formData.metode_bayar as any,
                unit,
                keterangan: formData.keterangan || undefined,
                payments: isSplitDisbursement 
                    ? disbursements.map(d => ({ 
                        metode: d.metode.toUpperCase(), 
                        nominal: parseNumber(d.nominal),
                        kas_jenis: d.metode === 'transfer' ? 'BANK_UTAMA' : isBengkelUser ? 'KAS_UNIT_BENGKEL' : 'KAS_UTAMA'
                      }))
                    : [{
                        metode: formData.metode_bayar.toUpperCase(),
                        nominal: nominalTotal,
                        kas_jenis: cashAccount
                      }]
            });
            closeSheets();
            setTimeout(() => {
                showAlert({ title: 'Sukses', message: 'Kasbon berhasil ditambahkan', variant: 'success' });
            }, 400);
            loadData();
        } catch (error) {
            console.error('Failed to create kasbon:', error);
            showAlert({ title: 'Error', message: getErrorMessage(error, 'Gagal menambahkan kasbon'), variant: 'error' });
        }
    };


    const handleDelete = async (kasbon: Kasbon) => {
        showAlert({
            title: 'Hapus Kasbon',
            message: `Yakin ingin menghapus kasbon ${kasbon.karyawan_nama} senilai ${formatCurrency(kasbon.nominal)}? Data tidak dapat dikembalikan.`,
            variant: 'warning',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await sdmService.deleteKasbon(kasbon.id);
                    showAlert({ title: 'Sukses', message: 'Kasbon berhasil dihapus', variant: 'success' });
                    loadData();
                } catch (error) {
                    console.error('Failed to delete kasbon:', error);
                    showAlert({ title: 'Error', message: getErrorMessage(error, 'Gagal menghapus kasbon'), variant: 'error' });
                }
            }
        });
    };

    // ... render methods ...
    const renderDetailContent = () => (
        selectedKasbon && (
            <View className="p-8">
                <View className="flex-row justify-between items-start mb-6">
                    <View className="flex-1">
                        <Typography variant="h2" weight="bold" className="text-2xl tracking-tighter">{selectedKasbon.karyawan_nama}</Typography>
                        <Typography variant="caption" className="text-textGray mt-1 uppercase tracking-widest font-bold">
                            #{selectedKasbon.nomor_kasbon} • {formatDate(selectedKasbon.tanggal)}
                        </Typography>
                    </View>
                    <Badge
                        label={selectedKasbon.status?.toUpperCase() === 'LUNAS' ? 'LUNAS' : 'OUTSTANDING'}
                        variant={selectedKasbon.status?.toUpperCase() === 'LUNAS' ? 'success' : 'warning'}
                    />
                </View>

                <Card variant="outlined" className="p-6 mb-8 border-gray-100 bg-gray-50/50 rounded-[32px]">
                    <View className="flex-row justify-between mb-4">
                        <Typography variant="caption" className="text-textGray font-bold uppercase tracking-widest">Total Pinjaman</Typography>
                        <Typography variant="body1" weight="bold" className="text-textMain">{formatCurrency(selectedKasbon.nominal)}</Typography>
                    </View>
                    <View className="flex-row justify-between mb-4">
                        <Typography variant="caption" className="text-textGray font-bold uppercase tracking-widest">Sudah Dibayar</Typography>
                        <Typography variant="body1" weight="bold" className="text-emerald-600">{formatCurrency(selectedKasbon.jumlah_bayar || 0)}</Typography>
                    </View>
                    <View className="h-[1px] bg-gray-200 my-4" />
                    <View className="flex-row justify-between">
                        <Typography variant="caption" weight="bold" className="text-textMain font-bold uppercase tracking-widest">Sisa Kasbon</Typography>
                        <Typography variant="h3" weight="bold" className="text-rose-600">
                            {formatCurrency(Number(selectedKasbon.nominal) - Number(selectedKasbon.jumlah_bayar || 0))}
                        </Typography>
                    </View>
                </Card>

                {selectedKasbon.keterangan && (
                    <View className="mb-8">
                        <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-widest mb-3 ml-1">Keterangan / Alasan</Typography>
                        <View className="bg-gray-50 p-6 rounded-[24px] border border-gray-100">
                            <Typography className="text-textMain leading-relaxed italic">"{selectedKasbon.keterangan}"</Typography>
                        </View>
                    </View>
                )}

                <View className="space-y-4">
                    {selectedKasbon.status?.toUpperCase() !== 'LUNAS' && (
                        <Button
                            title="Catat Pelunasan"
                            onPress={() => setPaymentModalVisible(true)}
                            className="h-14 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-200"
                            icon={<Wallet size={20} color="white" />}
                        />
                    )}
                    <View className="flex-row gap-4">
                        {selectedKasbon.status?.toUpperCase() !== 'LUNAS' && (
                            <Button
                                variant="outline"
                                title="Hapus"
                                onPress={() => {
                                    handleCloseSheet();
                                    handleDelete(selectedKasbon);
                                }}
                                className="flex-1 h-14 rounded-2xl border-rose-100 bg-rose-50"
                                icon={<Trash2 size={20} color="#E11D48" />}
                            >
                                <Typography weight="bold" className="text-rose-600">Hapus</Typography>
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            title="Tutup"
                            onPress={handleCloseSheet}
                            className="flex-1 h-14 rounded-2xl"
                        />
                    </View>
                </View>
            </View>
        )
    );

    const renderCreateForm = () => (
        <View className="pb-10">
            <View className="flex-row justify-between items-center mb-10">
                <View className="flex-row items-center">
                    <View className="w-1 h-6 bg-primary rounded-full mr-3" />
                    <Typography variant="h2" weight="bold" className="text-2xl tracking-tight">Buat Kasbon Baru</Typography>
                </View>
                <Pressable onPress={closeSheets} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                    <X size={20} color="#6B7280" />
                </Pressable>
            </View>

            <View className="space-y-6">
                <View className="mb-6">
                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Karyawan Penerima *</Typography>
                    <Pressable
                        onPress={() => setShowKaryawanPicker(!showKaryawanPicker)}
                        className="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 flex-row items-center justify-between"
                    >
                        <View className="flex-row items-center">
                            <User size={18} color={formData.karyawan_nama ? "#023C69" : "#9CA3AF"} />
                            <Typography className={`ml-3 font-medium ${formData.karyawan_nama ? 'text-textMain' : 'text-textGray/40'}`}>
                                {formData.karyawan_nama || 'Pilih Karyawan'}
                            </Typography>
                        </View>
                        <ChevronLeft size={18} color="#9CA3AF" style={{ transform: [{ rotate: showKaryawanPicker ? '90deg' : '270deg' }] }} />
                    </Pressable>

                    {showKaryawanPicker && (
                        <View className="mt-2 bg-white border border-gray-100 rounded-2xl shadow-lg max-h-48 overflow-hidden z-20">
                            <ScrollView nestedScrollEnabled>
                                {karyawanList.map((k) => (
                                    <Pressable
                                        key={k.id}
                                        onPress={() => {
                                            setFormData({ ...formData, karyawan_id: k.id, karyawan_nama: k.nama });
                                            setShowKaryawanPicker(false);
                                        }}
                                        className="px-5 py-4 border-b border-gray-50 flex-row items-center"
                                    >
                                        <View className="w-8 h-8 bg-primary/5 rounded-full items-center justify-center mr-3">
                                            <Typography className="text-primary font-bold text-[10px]">{k.nama.charAt(0)}</Typography>
                                        </View>
                                        <View>
                                            <Typography weight="bold" className="text-textMain text-sm">{k.nama}</Typography>
                                            <Typography className="text-textGray text-[9px] uppercase tracking-tighter">{k.jabatan}</Typography>
                                        </View>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                <Input
                    label="Nominal Pinjaman *"
                    keyboardType="numeric"
                    placeholder="0"
                    value={formData.jumlah}
                    onChangeText={(text) => setFormData({ ...formData, jumlah: formatNumber(text) })}
                    containerClassName="mb-6"
                />

                <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-3">
                        <Typography className="text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Sumber Dana / Pencairan *</Typography>
                        <Pressable
                            onPress={() => {
                                if (!isSplitDisbursement) {
                                    setDisbursements([{ id: Date.now() + Math.random(), metode: 'tunai', nominal: formData.jumlah }]);
                                }
                                setIsSplitDisbursement(!isSplitDisbursement);
                            }}
                            className="bg-primary/10 px-3 py-1.5 rounded-full"
                        >
                            <Typography className="text-primary text-[10px] font-bold">
                                {isSplitDisbursement ? 'Gunakan Tunggal' : 'Gunakan Split'}
                            </Typography>
                        </Pressable>
                    </View>

                    {isSplitDisbursement ? (
                        <View className="space-y-6 gap-6">
                            {disbursements.map((d, index) => (
                                <View key={d.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
                                    <View className="flex-row justify-between items-center mb-5">
                                        <Typography className="text-primary font-bold text-xs tracking-tight">Pembayaran #{index + 1}</Typography>
                                        {disbursements.length > 1 && (
                                            <Pressable
                                                onPress={() => {
                                                    const newD = disbursements.filter(item => item.id !== d.id);
                                                    setDisbursements(newD);
                                                    const total = newD.reduce((acc, curr) => acc + parseNumber(curr.nominal), 0);
                                                    setFormData(prev => ({ ...prev, jumlah: formatNumber(total.toString()) }));
                                                }}
                                                className="w-8 h-8 bg-rose-50 rounded-full items-center justify-center p-0"
                                            >
                                                <Trash2 size={14} color="#E11D48" />
                                            </Pressable>
                                        )}
                                    </View>

                                    <View className="flex-row gap-3 mb-6">
                                        {['tunai', 'transfer'].map((m) => (
                                            <Pressable
                                                key={m}
                                                onPress={() => {
                                                    const newD = [...disbursements];
                                                    newD[index].metode = m;
                                                    setDisbursements(newD);
                                                }}
                                                className={`flex-1 py-4 items-center rounded-[20px] border ${d.metode === m ? 'bg-primary border-primary shadow-lg shadow-primary/20' : 'bg-white border-gray-100'}`}
                                            >
                                                <Typography
                                                    className={`text-[10px] font-bold tracking-widest ${d.metode === m ? 'text-white' : 'text-textGray/40'}`}
                                                >
                                                    {m.toUpperCase()}
                                                </Typography>
                                            </Pressable>
                                        ))}
                                    </View>

                                    <View>
                                        <Typography className="text-textGray/60 text-[10px] font-bold uppercase tracking-widest mb-2.5 ml-1">Nominal (Rp)</Typography>
                                        <View className="bg-gray-50/80 rounded-2xl border border-gray-100/50 px-5 py-4">
                                            <TextInput
                                                className="font-bold text-textMain text-base h-7 p-0"
                                                placeholder="0"
                                                keyboardType="numeric"
                                                value={d.nominal}
                                                onChangeText={(v) => {
                                                    const newD = [...disbursements];
                                                    newD[index].nominal = formatNumber(v);
                                                    setDisbursements(newD);

                                                    // Update total nominal
                                                    const total = newD.reduce((acc, curr) => acc + parseNumber(curr.nominal), 0);
                                                    setFormData(prev => ({ ...prev, jumlah: formatNumber(total.toString()) }));
                                                }}
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}
                            <Pressable
                                onPress={() => setDisbursements([...disbursements, { id: Date.now() + Math.random(), metode: 'tunai', nominal: '' }])}
                                className="flex-row items-center justify-center py-6 border border-dashed border-gray-300 rounded-[32px] bg-gray-50/30"
                            >
                                <Plus size={18} color="#9CA3AF" />
                                <Typography className="text-textGray/40 font-bold text-xs ml-2 tracking-wide">Tambah Metode Pembayaran Lain</Typography>
                            </Pressable>
                        </View>
                    ) : (
                        <View className="flex-row space-x-3 gap-2">
                            {['tunai', 'transfer'].map((m) => (
                                <Pressable
                                    key={m}
                                    onPress={() => setFormData({ ...formData, metode_bayar: m })}
                                    className={`flex-1 py-4 items-center rounded-2xl border ${formData.metode_bayar === m ? 'border-primary bg-primary shadow-lg shadow-primary/20' : 'border-gray-200 bg-white'}`}
                                >
                                    <Typography
                                        className={formData.metode_bayar === m ? 'text-white' : 'text-textGray'}
                                        weight="bold"
                                    >
                                        {m.toUpperCase()}
                                    </Typography>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>

                <Input
                    label="Alasan / Keterangan"
                    placeholder="Tulis alasan kasbon..."
                    value={formData.keterangan}
                    onChangeText={(text) => setFormData({ ...formData, keterangan: text })}
                    multiline
                    numberOfLines={3}
                    style={{ height: 100, textAlignVertical: 'top' }}
                    containerClassName="mb-8"
                />

                <Button
                    title="Konfirmasi Pinjaman"
                    onPress={handleSubmitCreate}
                    disabled={!formData.karyawan_id || !formData.jumlah}
                    className="h-16 rounded-2xl shadow-xl shadow-primary/30"
                />
            </View>
        </View>
    );


    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            <Header 
                title="Kasbon HR"
                subtitle="Pinjaman & Kasbon Karyawan"
                showBackButton={true}
                onBackButtonPress={handleGoBack}
            >
                {/* Main Insight Card (Primary Background) */}
                <View className="bg-primary p-6 rounded-[32px] shadow-xl shadow-primary/20">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="bg-rose-500/20 px-3 py-1.5 rounded-full border border-rose-500/20">
                            <Typography className="text-rose-400 text-[10px] font-bold uppercase tracking-widest">Outstanding</Typography>
                        </View>
                        <Typography className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Stats Saat Ini</Typography>
                    </View>
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Typography variant="h1" weight="bold" className="text-white text-3xl tracking-tighter">
                                {formatCurrency(summary?.total_belum_lunas || 0)}
                            </Typography>
                            <Typography className="text-white/60 text-xs mt-1">Total Belum Tertagih</Typography>
                        </View>
                        <View className="bg-white/10 p-4 rounded-2xl border border-white/10">
                            <Wallet size={24} color="white" />
                        </View>
                    </View>

                    {/* Bento Stats Inside Header */}
                    <View className="h-[1px] bg-white/10 my-6" />
                    <View className="flex-row justify-between">
                        <View className="flex-1">
                            <Typography className="text-white/50 text-[9px] uppercase font-bold mb-1 tracking-widest">Total Record</Typography>
                            <Typography weight="bold" className="text-white text-lg">{summary?.count_total || 0}</Typography>
                        </View>
                        <View className="flex-1 items-center border-x border-white/5">
                            <Typography className="text-white/50 text-[9px] uppercase font-bold mb-1 tracking-widest">Tertagih</Typography>
                            <Typography weight="bold" className="text-emerald-400 text-lg">{formatCurrency(summary?.total_lunas || 0)}</Typography>
                        </View>
                        <View className="flex-1 items-end">
                            <Typography className="text-white/50 text-[9px] uppercase font-bold mb-1 tracking-widest">Aktif</Typography>
                            <Typography weight="bold" className="text-amber-400 text-lg">{summary?.count_belum_lunas || 0}</Typography>
                        </View>
                    </View>
                </View>
            </Header>

            {/* Filter & Search — pull up to sit tighter under header stats */}
            <View className="px-6 -mt-14 z-10">
                <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50 flex-col">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 p-1">
                        {STATUS_FILTERS.map((filter) => (
                            <Pressable
                                key={filter.key}
                                onPress={() => {
                                    setSelectedFilter(filter.key as any);
                                    // loadData is called in useEffect when filter changes
                                }}
                                className={`px-5 py-2.5 rounded-2xl mr-2 ${selectedFilter === filter.key ? 'bg-primary border border-white/10 shadow-md shadow-primary/20' : 'bg-gray-50 border border-gray-100'}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight="bold"
                                    className={selectedFilter === filter.key ? 'text-white' : 'text-textGray/60'}
                                >
                                    {filter.label}
                                </Typography>
                            </Pressable>
                        ))}
                    </ScrollView>

                    <View className="flex-row items-center px-4 bg-gray-50 h-14 rounded-2xl border border-gray-100">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-3 text-sm text-textMain font-medium h-full"
                            placeholder="Cari nama karyawan atau nomor kasbon..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#9CA3AF"
                            clearButtonMode="while-editing"
                        />
                    </View>
                </View>
            </View>

            {loading && !refreshing ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#023C69" />
                </View>
            ) : (
                <FlatList
                    data={filteredKasbonList}
                    renderItem={({ item }) => {
                        const isLunas = item.status?.toUpperCase() === 'LUNAS';
                        const sisa = Number(item.nominal) - Number(item.jumlah_bayar || 0);
                        const progressPercent = (Number(item.jumlah_bayar || 0) / Number(item.nominal)) * 100;

                        return (
                            <Pressable
                                
                                onPress={() => handleOpenDetail(item)}
                                className="bg-white p-6 rounded-[32px] mb-6 border border-gray-50 shadow-sm"
                            >
                                <View className="flex-row items-center justify-between mb-4">
                                    <View className="flex-row items-center flex-1">
                                        <View className={`w-12 h-12 ${isLunas ? 'bg-emerald-50' : 'bg-primary/5'} rounded-2xl items-center justify-center mr-4 border ${isLunas ? 'border-emerald-100/50' : 'border-primary/5'}`}>
                                            <User size={24} color={isLunas ? '#10B981' : '#023C69'} />
                                        </View>
                                        <View className="flex-1">
                                            <Typography variant="body1" weight="bold" className="text-textMain tracking-tight" numberOfLines={1}>
                                                {item.karyawan_nama}
                                            </Typography>
                                            <Typography className="text-textGray/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                                {formatDate(item.tanggal)} • {item.nomor_kasbon}
                                            </Typography>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Badge
                                            label={isLunas ? 'LUNAS' : 'OUTSTANDING'}
                                            variant={isLunas ? 'success' : 'warning'}
                                        />
                                    </View>
                                </View>

                                <View className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex-row justify-between mb-4">
                                    <View>
                                        <Typography className="text-textGray/60 text-[9px] font-bold uppercase tracking-widest mb-1">Pinjaman</Typography>
                                        <Typography weight="semibold" className="text-textMain text-sm">{formatCurrency(item.nominal)}</Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-rose-600/60 text-[9px] font-bold uppercase tracking-widest mb-1">Sisa</Typography>
                                        <Typography weight="bold" className="text-rose-600 text-sm">{formatCurrency(sisa)}</Typography>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                <View>
                                    <View className="flex-row justify-between items-center mb-1.5">
                                        <Typography className="text-textGray/40 text-[9px] font-bold uppercase tracking-widest">Progress Pelunasan</Typography>
                                        <Typography className="text-primary text-[10px] font-bold">{Math.round(progressPercent)}%</Typography>
                                    </View>
                                    <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <View
                                            className="h-full bg-primary rounded-full"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </View>
                                </View>
                            </Pressable>
                        );
                    }}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 200 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                    ListEmptyComponent={
                        <View className="items-center py-20">
                            <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-6">
                                <Wallet size={40} color="#D1D5DB" />
                            </View>
                            <Typography className="text-gray-400 font-medium">Tidak ada kasbon ditemukan</Typography>
                        </View>
                    }
                />
            )}

            {/* FAB hidden while sheet open so elevation cannot cover the form */}
            {activeSheet === 'none' && (
                <Pressable
                    onPress={openAddForm}
                    style={{ bottom: 100, right: 24, elevation: 5, zIndex: 50 }}
                    className="absolute bg-primary w-16 h-16 rounded-full items-center justify-center shadow-xl border-4 border-white/20 active:scale-95 transition-transform"
                >
                    <Plus size={32} color="white" strokeWidth={2.5} />
                </Pressable>
            )}

            {/* Bottom Sheet UI */}
            {Platform.OS === 'web' ? (
                <>
                    <Modal visible={activeSheet == 'create'} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <Pressable className="absolute inset-0" onPress={handleCloseSheet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[90%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                <ScrollView style={{ flex: 1 }} className="px-8" showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                    {renderCreateForm()}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>

                    <Modal visible={activeSheet == 'detail'} transparent animationType="slide" onRequestClose={handleCloseSheet}>
                        <View className="flex-1 justify-end bg-black/40">
                            <Pressable className="absolute inset-0" onPress={handleCloseSheet} />
                            <View className="bg-white rounded-t-[48px] w-full max-w-[640px] h-[80%] self-center p-0 overflow-hidden shadow-2xl relative">
                                <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-6" />
                                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                    {renderDetailContent()}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                </>
            ) : (
                <>
                    <BottomSheet
                        ref={createSheetRef}
                        index={-1}
                        snapPoints={createSnapPoints}
                        enablePanDownToClose
                        enableContentPanningGesture
                        keyboardBehavior="interactive"
                        keyboardBlurBehavior="restore"
                        android_keyboardInputMode="adjustResize"
                        backdropComponent={renderBackdrop}
                        backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                        // List cards use shadow (Android elevation); raise sheet above them.
                        containerStyle={{ zIndex: 1000, elevation: 24 }}
                        style={{ zIndex: 1000, elevation: 24 }}
                        topInset={insets.top}
                        onClose={() => setActiveSheet('none')}
                    >
                        <BottomSheetScrollView
                            className="px-8"
                            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 48 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator
                        >
                            {renderCreateForm()}
                        </BottomSheetScrollView>
                    </BottomSheet>

                    <BottomSheet
                        ref={detailSheetRef}
                        index={-1}
                        snapPoints={detailSnapPoints}
                        enablePanDownToClose
                        enableContentPanningGesture
                        keyboardBehavior="interactive"
                        keyboardBlurBehavior="restore"
                        android_keyboardInputMode="adjustResize"
                        backdropComponent={renderBackdrop}
                        backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                        containerStyle={{ zIndex: 1000, elevation: 24 }}
                        style={{ zIndex: 1000, elevation: 24 }}
                        topInset={insets.top}
                        onClose={() => setActiveSheet('none')}
                    >
                        <BottomSheetScrollView
                            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 48 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator
                        >
                            {renderDetailContent()}
                        </BottomSheetScrollView>
                    </BottomSheet>
                </>
            )}


            {selectedKasbon && selectedKasbon.piutang_id && (
                <PaymentModal
                    visible={paymentModalVisible}
                    onClose={() => setPaymentModalVisible(false)}
                    onSuccess={() => {
                        setPaymentModalVisible(false);
                        setTimeout(() => {
                            showAlert({
                                title: 'Sukses',
                                message: 'Pembayaran kasbon berhasil dicatat',
                                variant: 'success',
                                type: 'alert'
                            });
                        }, 400);
                        loadData();
                    }}
                    id={selectedKasbon.piutang_id}
                    initialAmount={Number(selectedKasbon.nominal) - Number(selectedKasbon.jumlah_bayar || 0)}
                    unit={selectedKasbon.unit || 'LAINNYA'}
                    type="piutang"
                    title={`Pelunasan Kasbon: ${selectedKasbon.karyawan_nama}`}
                />
            )}
        </View>
    );
}
