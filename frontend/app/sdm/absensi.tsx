import { appAlert } from '../../utils/appAlert';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator, FlatList } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import {
    Calendar as CalendarIcon,
    User,
    Save,
    Search,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { sdmService, Karyawan, AttendanceStatus } from '../../services/sdm';
import { useActiveKaryawan, useBulkClockIn, useAbsensiBulanan } from '../../hooks/useSDM';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import { BaseModal } from '../../components/ui/BaseModal';
import { Input } from '../../components/ui/Input';
import { onlineManager } from '@tanstack/react-query';
import { Header } from '../../components/ui/Header';

const STATUS_META: Record<AttendanceStatus, { label: string; color: string; bg: string; text: string }> = {
    HADIR: { label: 'Hadir', color: '#023C69', bg: 'bg-blue-50', text: 'text-blue-700' },
    SETENGAH_HARI: { label: 'Setengah Hari', color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700' },
    IZIN: { label: 'Izin', color: '#06B6D4', bg: 'bg-cyan-50', text: 'text-cyan-700' },
    SAKIT: { label: 'Sakit', color: '#8B5CF6', bg: 'bg-violet-50', text: 'text-violet-700' },
    ALPHA: { label: 'Alpha', color: '#EF4444', bg: 'bg-rose-50', text: 'text-rose-700' },
    CUTI: { label: 'Cuti', color: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    LIBUR: { label: 'Libur', color: '#6B7280', bg: 'bg-gray-50', text: 'text-gray-700' },
};

export default function AbsensiScreen() {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(null);
    const [selectedDates, setSelectedDates] = useState<Record<string, any>>({});
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [isFetchingAttendance, setIsFetchingAttendance] = useState(false);
    const [timeModalVisible, setTimeModalVisible] = useState(false);
    const [tempDate, setTempDate] = useState('');
    const [tempStatus, setTempStatus] = useState<AttendanceStatus>('HADIR');
    const [jamMasuk, setJamMasuk] = useState('08:00');
    const [jamKeluar, setJamKeluar] = useState('17:00');

    const [dialogConfig, setDialogConfig] = useState<{
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

    const { data: karyawanList, isLoading: isLoadingKaryawan, refetch: refetchKaryawan } = useActiveKaryawan();
    const bulkClockInMutation = useBulkClockIn();
    const { data: monthlySummary } = useAbsensiBulanan(selectedKaryawan?.id || 0, currentYear, currentMonth);

    // Fetch existing attendance when karyawan or month/year changes
    useEffect(() => {
        const fetchExistingAttendance = async () => {
            if (!selectedKaryawan) return;

            setIsFetchingAttendance(true);
            try {
                // Get all attendance for the current month view
                const lastDay = new Date(currentYear, currentMonth, 0).getDate();
                const startDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
                const endDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

                const response = await sdmService.getAbsensiList({
                    karyawan_id: selectedKaryawan.id,
                    tanggal_dari: startDate,
                    tanggal_sampai: endDate,
                    limit: 100
                });

                const attendanceMap: Record<string, any> = {};
                if (response && Array.isArray(response.data)) {
                    response.data.forEach((abs: any) => {
                        const dateStr = abs.tanggal.split('T')[0];
                        const status = abs.status as AttendanceStatus;
                        const color = STATUS_META[status]?.color || STATUS_META.HADIR.color;
                        attendanceMap[dateStr] = {
                            selected: true,
                            marked: true,
                            status,
                            color,
                            customStyles: {
                                container: {
                                    backgroundColor: color,
                                    borderRadius: 999,
                                },
                                text: {
                                    color: '#FFFFFF',
                                    fontWeight: '700',
                                }
                            },
                            jam_masuk: abs.jam_masuk?.substring(0, 5) || '08:00',
                            jam_keluar: abs.jam_keluar?.substring(0, 5) || '17:00'
                        };
                    });
                }
                setSelectedDates(attendanceMap);
            } catch (error) {
                console.error('Failed to fetch attendance:', error);
            } finally {
                setIsFetchingAttendance(false);
            }
        };

        fetchExistingAttendance();
    }, [selectedKaryawan, currentMonth, currentYear]);

    const filteredKaryawan = useMemo(() => {
        if (!karyawanList) return [];
        if (!searchQuery) return karyawanList;
        const lower = searchQuery.toLowerCase();
        return karyawanList.filter((k: Karyawan) =>
            k.nama.toLowerCase().includes(lower) ||
            k.jabatan.toLowerCase().includes(lower)
        );
    }, [karyawanList, searchQuery]);

    const handleDayPress = (day: any) => {
        const dateString = day.dateString;
        const existing = selectedDates[dateString];

        setTempDate(dateString);
        setTempStatus(existing?.status || 'HADIR');
        if (existing) {
            setJamMasuk(existing.jam_masuk || '08:00');
            setJamKeluar(existing.jam_keluar || '17:00');
        } else {
            setJamMasuk('08:00');
            setJamKeluar('17:00');
        }
        setTimeModalVisible(true);
    };

    const calculateStatus = (outTime: string): AttendanceStatus => {
        const [hour, minute] = outTime.split(':').map(Number);
        const timeVal = hour + minute / 60;

        if (timeVal >= 12 && timeVal <= 14) {
            return 'SETENGAH_HARI';
        }
        return 'HADIR';
    };

    const handleConfirmTime = () => {
        const resolvedStatus = tempStatus === 'HADIR' || tempStatus === 'SETENGAH_HARI'
            ? calculateStatus(jamKeluar)
            : tempStatus;
        const color = STATUS_META[resolvedStatus].color;
        const usesTime = resolvedStatus === 'HADIR' || resolvedStatus === 'SETENGAH_HARI';

        setSelectedDates(prev => ({
            ...prev,
            [tempDate]: {
                selected: true,
                marked: true,
                status: resolvedStatus,
                color,
                customStyles: {
                    container: {
                        backgroundColor: color,
                        borderRadius: 999,
                    },
                    text: {
                        color: '#FFFFFF',
                        fontWeight: '700',
                    }
                },
                jam_masuk: usesTime ? jamMasuk : undefined,
                jam_keluar: usesTime ? jamKeluar : undefined
            }
        }));
        setTimeModalVisible(false);
    };

    const handleRemoveAttendance = () => {
        setSelectedDates(prev => {
            const next = { ...prev };
            delete next[tempDate];
            return next;
        });
        setTimeModalVisible(false);
    };

    const handleMonthChange = (month: any) => {
        setCurrentMonth(month.month);
        setCurrentYear(month.year);
    };

    const handleSaveAbsensi = async () => {
        if (!selectedKaryawan) return;
        const dates = Object.keys(selectedDates);

        if (dates.length === 0) {
            setDialogConfig({
                visible: true,
                title: 'Peringatan',
                message: 'Silakan pilih minimal satu tanggal',
                variant: 'warning'
            });
            return;
        }

        try {
            const attendanceRecords = Object.entries(selectedDates).map(([date, info]: [string, any]) => ({
                date,
                status: info.status || 'HADIR',
                jam_masuk: info.jam_masuk,
                jam_keluar: info.jam_keluar
            }));

            if (!onlineManager.isOnline()) {
                bulkClockInMutation.mutate({
                    karyawanId: selectedKaryawan.id,
                    dates: attendanceRecords
                });
                appAlert('Offline Mode', `Data absensi ${selectedKaryawan.nama} telah disimpan di antrean offline.`);
                setSelectedKaryawan(null);
                setSelectedDates({});
                return;
            }

            await bulkClockInMutation.mutateAsync({
                karyawanId: selectedKaryawan.id,
                dates: attendanceRecords
            });
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: `Berhasil mencatat absensi untuk ${attendanceRecords.length} hari`,
                variant: 'success'
            });
            setSelectedKaryawan(null);
            setSelectedDates({});
        } catch (error: any) {
            setDialogConfig({
                visible: true,
                title: 'Error',
                message: getErrorMessage(error, 'Gagal menyimpan absensi'),
                variant: 'error'
            });
        }
    };

    const handleGoBack = () => {
        if (selectedKaryawan) {
            setSelectedKaryawan(null);
            setSelectedDates({});
        } else if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/sdm');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetchKaryawan();
        setRefreshing(false);
    }, [refetchKaryawan]);

    const today = new Date().toISOString().split('T')[0];
    const markedDates = useMemo(() => {
        const merged = { ...selectedDates };
        const todayEntry = merged[today];

        merged[today] = {
            ...todayEntry,
            customStyles: {
                container: {
                    ...(todayEntry?.customStyles?.container || {}),
                    borderWidth: 2,
                    borderColor: '#10B981',
                    borderRadius: 999,
                },
                text: {
                    ...(todayEntry?.customStyles?.text || {}),
                    color: todayEntry?.customStyles?.text?.color || '#023C69',
                    fontWeight: '800',
                }
            }
        };

        return merged;
    }, [selectedDates, today]);

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            <Header 
                title="Absensi Karyawan"
                subtitle={selectedKaryawan ? `Input Kehadiran: ${selectedKaryawan.nama}` : 'Pilih Karyawan untuk Mulai'}
                showBackButton={true}
                onBackButtonPress={handleGoBack}
            >
                {!selectedKaryawan && (
                    <View className="bg-white/10 px-5 py-3 rounded-2xl border border-white/10 flex-row items-center">
                        <Search size={18} color="white" opacity={0.6} />
                        <Typography className="flex-1 ml-3 text-white/40 text-sm">Cari karyawan...</Typography>
                    </View>
                )}
            </Header>

            <View className="flex-1 -mt-14 z-10 px-6">
                {!selectedKaryawan ? (
                    <FlatList
                        data={filteredKaryawan}
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => setSelectedKaryawan(item)}
                                
                                className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center"
                            >
                                <View className="w-14 h-14 bg-gray-50 rounded-2xl items-center justify-center mr-4 border border-gray-100 shadow-inner">
                                    <User size={28} color="#023C69" />
                                </View>
                                <View className="flex-1 mr-3">
                                    <Typography variant="body1" weight="bold" className="text-textMain tracking-tight" numberOfLines={1}>
                                        {item.nama}
                                    </Typography>
                                    <Typography variant="caption" className="text-textGray/60 font-medium">
                                        {item.jabatan}
                                    </Typography>
                                </View>
                                <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100">
                                    <CalendarIcon size={18} color="#D1D5DB" />
                                </View>
                            </Pressable>
                        )}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={{ paddingTop: 10, paddingBottom: 120 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#023C69" />}
                        ListEmptyComponent={
                            isLoadingKaryawan ? (
                                <View className="py-20"><ActivityIndicator size="large" color="#023C69" /></View>
                            ) : (
                                <View className="items-center py-20">
                                    <Typography className="text-gray-400 font-medium text-center">Tidak ada karyawan aktif</Typography>
                                </View>
                            )
                        }
                    />
                ) : (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingTop: 10, paddingBottom: 150 }}
                    >
                        <Card className="rounded-[32px] overflow-hidden border border-gray-100 shadow-xl mb-6">
                            <View className="p-5 border-b border-gray-50 bg-gray-50/50 flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <CalendarIcon size={20} color="#023C69" className="mr-2" />
                                    <Typography weight="bold" className="text-textMain">Seleksi Tanggal Masuk</Typography>
                                </View>
                                <Badge label={`${Object.keys(selectedDates).length} Hari`} variant="success" />
                            </View>

                            <Calendar
                                markingType={'custom'}
                                markedDates={markedDates}
                                onDayPress={handleDayPress}
                                onMonthChange={handleMonthChange}
                                displayLoadingIndicator={isFetchingAttendance}
                                theme={{
                                    calendarBackground: '#ffffff',
                                    textSectionTitleColor: '#b6c1cd',
                                    selectedDayBackgroundColor: '#023C69',
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: '#10B981',
                                    dayTextColor: '#2d4150',
                                    textDisabledColor: '#d9e1e8',
                                    arrowColor: '#023C69',
                                    monthTextColor: '#023C69',
                                    indicatorColor: '#023C69',
                                    textDayFontWeight: '500',
                                    textMonthFontWeight: 'bold',
                                    textDayHeaderFontWeight: 'bold',
                                    textDayFontSize: 14,
                                    textMonthFontSize: 16,
                                    textDayHeaderFontSize: 12,
                                }}
                                style={{
                                    borderRadius: 16,
                                    paddingBottom: 10
                                }}
                            />
                        </Card>

                        <View className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm mb-6">
                            <Typography className="text-textGray/40 text-[10px] font-black uppercase tracking-[2px] mb-4">Ringkasan Bulan Ini</Typography>
                            <View className="flex-row flex-wrap -m-1">
                                {[
                                    { label: 'Hadir', value: monthlySummary?.jumlah_hadir || 0, color: 'text-blue-700', bg: 'bg-blue-50' },
                                    { label: '1/2 Hari', value: monthlySummary?.jumlah_setengah_hari || 0, color: 'text-amber-700', bg: 'bg-amber-50' },
                                    { label: 'Izin', value: monthlySummary?.jumlah_izin || 0, color: 'text-cyan-700', bg: 'bg-cyan-50' },
                                    { label: 'Sakit', value: monthlySummary?.jumlah_sakit || 0, color: 'text-violet-700', bg: 'bg-violet-50' },
                                    { label: 'Alpha', value: monthlySummary?.jumlah_alpha || 0, color: 'text-rose-700', bg: 'bg-rose-50' },
                                    { label: 'Cuti', value: monthlySummary?.jumlah_cuti || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                                ].map((item) => (
                                    <View key={item.label} className="w-1/3 p-1">
                                        <View className={`${item.bg} rounded-2xl p-3 border border-white`}>
                                            <Typography className="text-[9px] text-textGray/50 font-black uppercase tracking-wider">{item.label}</Typography>
                                            <Typography weight="bold" className={`${item.color} text-lg mt-1`}>{item.value}</Typography>
                                        </View>
                                    </View>
                                ))}
                            </View>
                            <View className="mt-4 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <Typography className="text-[10px] text-textGray/50 font-black uppercase tracking-wider">Persentase Kehadiran</Typography>
                                <Typography weight="bold" className="text-textMain text-xl mt-1">{monthlySummary?.persentase_kehadiran || 0}%</Typography>
                            </View>
                        </View>

                        <View className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 mb-6">
                            <Typography className="text-amber-700/60 text-[10px] font-black uppercase tracking-[2px] mb-3">Petunjuk Status</Typography>
                            <View className="flex-row flex-wrap -m-1 mb-4">
                                {(['HADIR', 'SETENGAH_HARI', 'IZIN', 'SAKIT', 'CUTI', 'ALPHA'] as AttendanceStatus[]).map((status) => (
                                    <View key={status} className="w-1/2 p-1">
                                        <View className={`${STATUS_META[status].bg} rounded-2xl p-3 border border-white flex-row items-center`}>
                                            <View style={{ backgroundColor: STATUS_META[status].color }} className="w-3 h-3 rounded-full mr-2" />
                                            <Typography className={`${STATUS_META[status].text} text-xs font-bold`}>{STATUS_META[status].label}</Typography>
                                        </View>
                                    </View>
                                ))}
                            </View>
                            <Typography className="text-amber-900 text-xs leading-relaxed">
                                Hari ini diberi garis hijau. Klik tanggal untuk pilih status kehadiran atau ubah jam masuk dan jam keluar.
                            </Typography>
                        </View>

                        <View className="flex-row space-x-4">
                            <Pressable
                                onPress={() => setSelectedKaryawan(null)}
                                className="flex-1 bg-gray-100 h-16 rounded-2xl items-center justify-center border border-gray-200"
                            >
                                <Typography weight="bold" className="text-textGray">Batal</Typography>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveAbsensi}
                                disabled={bulkClockInMutation.isPending}
                                className="flex-[2] bg-primary h-16 rounded-2xl items-center justify-center shadow-xl shadow-primary/30 flex-row"
                            >
                                {bulkClockInMutation.isPending ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Save size={20} color="white" className="mr-2" />
                                        <Typography weight="bold" className="text-white">Simpan Absensi</Typography>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    </ScrollView>
                )}
            </View>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
            />

            <BaseModal
                visible={timeModalVisible}
                onClose={() => setTimeModalVisible(false)}
                title={`Atur Absensi: ${tempDate}`}
            >
                <View className="space-y-4">
                    <View>
                        <Typography className="text-textGray/50 text-[10px] font-black uppercase tracking-[2px] mb-3">Status Kehadiran</Typography>
                        <View className="flex-row flex-wrap -m-1">
                            {(['HADIR', 'SETENGAH_HARI', 'IZIN', 'SAKIT', 'CUTI', 'ALPHA'] as AttendanceStatus[]).map((status) => {
                                const active = tempStatus === status;
                                return (
                                    <View key={status} className="w-1/2 p-1">
                                        <Pressable
                                            onPress={() => setTempStatus(status)}
                                            className={`rounded-2xl p-3 border ${active ? 'border-transparent' : 'border-gray-100 bg-gray-50'}`}
                                            style={active ? { backgroundColor: STATUS_META[status].color } : undefined}
                                        >
                                            <Typography weight="bold" className={active ? 'text-white text-center' : `${STATUS_META[status].text} text-center`}>
                                                {STATUS_META[status].label}
                                            </Typography>
                                        </Pressable>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {(tempStatus === 'HADIR' || tempStatus === 'SETENGAH_HARI') && (
                        <>
                            <Input
                                label="Jam Masuk"
                                value={jamMasuk}
                                onChangeText={setJamMasuk}
                                placeholder="08:00"
                                innerContainerClassName="rounded-full px-6"
                            />
                            <Input
                                label="Jam Keluar"
                                value={jamKeluar}
                                onChangeText={setJamKeluar}
                                placeholder="17:00"
                                innerContainerClassName="rounded-full px-6"
                            />

                            <Typography className="text-gray-500 text-xs italic mt-2">
                                * Keluar antara 12:00 - 14:00 otomatis dihitung Setengah Hari
                            </Typography>

                            <View className="flex-row space-x-2 mt-4">
                                <Pressable 
                                    onPress={() => {
                                        setTempStatus('HADIR');
                                        setJamMasuk('08:00');
                                        setJamKeluar('17:00');
                                    }}
                                    className={`flex-1 py-3 rounded-full border items-center justify-center ${jamMasuk === '08:00' && jamKeluar === '17:00' && tempStatus === 'HADIR' ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100'}`}
                                >
                                    <Typography variant="caption" weight="bold" className={jamMasuk === '08:00' && jamKeluar === '17:00' && tempStatus === 'HADIR' ? 'text-primary' : 'text-textGray'}>Full Day</Typography>
                                    <Typography className="text-[10px] text-gray-400">08:00 - 17:00</Typography>
                                </Pressable>
                                <Pressable 
                                    onPress={() => {
                                        setTempStatus('SETENGAH_HARI');
                                        setJamMasuk('08:00');
                                        setJamKeluar('12:00');
                                    }}
                                    className={`flex-1 py-3 rounded-full border items-center justify-center ${jamMasuk === '08:00' && jamKeluar === '12:00' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}
                                >
                                    <Typography variant="caption" weight="bold" className={jamMasuk === '08:00' && jamKeluar === '12:00' ? 'text-amber-700' : 'text-textGray'}>1/2 Day</Typography>
                                    <Typography className="text-[10px] text-gray-400">08:00 - 12:00</Typography>
                                </Pressable>
                            </View>
                        </>
                    )}

                    <View className="flex-row space-x-3 mt-6">
                        {selectedDates[tempDate] && (
                            <Pressable
                                onPress={handleRemoveAttendance}
                                className="flex-1 bg-red-50 h-14 rounded-full items-center justify-center border border-red-100"
                            >
                                <Typography weight="bold" className="text-red-600">Hapus</Typography>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={handleConfirmTime}
                            className="flex-[2] bg-primary h-14 rounded-full items-center justify-center shadow-lg"
                        >
                            <Typography weight="bold" className="text-white">Simpan</Typography>
                        </Pressable>
                    </View>
                </View>
            </BaseModal>
        </View>
    );
}
