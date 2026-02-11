import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator, FlatList, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Clock,
    Calendar as CalendarIcon,
    User,
    CheckCircle,
    X,
    Save,
    Search,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { sdmService, Karyawan } from '../../services/sdm';
import { useActiveKaryawan, useBulkClockIn } from '../../hooks/useSDM';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';

export default function AbsensiScreen() {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(null);
    const [selectedDates, setSelectedDates] = useState<Record<string, any>>({});
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [isFetchingAttendance, setIsFetchingAttendance] = useState(false);

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
                        attendanceMap[dateStr] = {
                            selected: true,
                            marked: true,
                            selectedColor: '#00AA13',
                            textColor: 'white'
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
        setSelectedDates(prev => {
            const next = { ...prev };
            if (next[dateString]) {
                delete next[dateString];
            } else {
                next[dateString] = {
                    selected: true,
                    marked: true,
                    selectedColor: '#00AA13',
                    textColor: 'white'
                };
            }
            return next;
        });
    };

    const handleMonthChange = (month: any) => {
        setCurrentMonth(month.month);
        setCurrentYear(month.year);
    };

    const handleSaveAbsensi = async () => {
        if (!selectedKaryawan) return;
        const dates = Object.keys(selectedDates);

        // Note: For simplicity, we are just sending all currently selected dates.
        // The backend should handle creating new or updating existing ones.
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
            await bulkClockInMutation.mutateAsync({
                karyawanId: selectedKaryawan.id,
                dates: dates
            });
            setDialogConfig({
                visible: true,
                title: 'Sukses',
                message: `Berhasil mencatat absensi untuk ${dates.length} hari`,
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

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header */}
            <View className="bg-primary pt-14 pb-12 px-6 rounded-b-[48px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={handleGoBack}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center mr-4 border border-white/5"
                        >
                            <ChevronLeft size={24} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Absensi Karyawan</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">
                                {selectedKaryawan ? `Input Kehadiran: ${selectedKaryawan.nama}` : 'Pilih Karyawan untuk Mulai'}
                            </Typography>
                        </View>
                    </View>
                    {!selectedKaryawan && (
                        <TouchableOpacity
                            onPress={onRefresh}
                            className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                        >
                            {refreshing ? <ActivityIndicator size="small" color="white" /> : <Clock size={22} color="white" />}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Search Bar - Only show in list mode */}
                {!selectedKaryawan && (
                    <View className="bg-white/10 px-5 py-3 rounded-2xl border border-white/10 flex-row items-center">
                        <Search size={18} color="white" opacity={0.6} />
                        <Typography className="flex-1 ml-3 text-white/40 text-sm">Cari karyawan...</Typography>
                        {/* Note: In a real app we'd have a TextInput here, but let's keep it clean for now since the focus is the flow */}
                    </View>
                )}
            </View>

            {/* Content Area */}
            <View className="flex-1 -mt-8 z-10 px-6">
                {!selectedKaryawan ? (
                    <FlatList
                        data={filteredKaryawan}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => setSelectedKaryawan(item)}
                                activeOpacity={0.9}
                                className="bg-white p-5 rounded-[32px] mb-4 border border-gray-50 shadow-sm flex-row items-center"
                            >
                                <View className="w-14 h-14 bg-gray-50 rounded-2xl items-center justify-center mr-4 border border-gray-100 shadow-inner">
                                    <User size={28} color="#00AA13" />
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
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={{ paddingTop: 10, paddingBottom: 120 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AA13" />}
                        ListEmptyComponent={
                            isLoadingKaryawan ? (
                                <View className="py-20"><ActivityIndicator size="large" color="#00AA13" /></View>
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
                        {/* Calendar View */}
                        <Card className="rounded-[32px] overflow-hidden border border-gray-100 shadow-xl mb-6">
                            <View className="p-5 border-b border-gray-50 bg-gray-50/50 flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <CalendarIcon size={20} color="#00AA13" className="mr-2" />
                                    <Typography weight="bold" className="text-textMain">Seleksi Tanggal Masuk</Typography>
                                </View>
                                <Badge label={`${Object.keys(selectedDates).length} Hari`} variant="success" />
                            </View>

                            <Calendar
                                markingType={'multi-dot'}
                                markedDates={selectedDates}
                                onDayPress={handleDayPress}
                                onMonthChange={handleMonthChange}
                                displayLoadingIndicator={isFetchingAttendance}
                                theme={{
                                    calendarBackground: '#ffffff',
                                    textSectionTitleColor: '#b6c1cd',
                                    selectedDayBackgroundColor: '#00AA13',
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: '#00AA13',
                                    dayTextColor: '#2d4150',
                                    textDisabledColor: '#d9e1e8',
                                    dotColor: '#00AA13',
                                    selectedDotColor: '#ffffff',
                                    arrowColor: '#00AA13',
                                    monthTextColor: '#00AA13',
                                    indicatorColor: '#00AA13',
                                    textDayFontWeight: '500',
                                    textMonthFontWeight: 'bold',
                                    textDayHeaderFontWeight: 'bold',
                                    textDayFontSize: 14,
                                    textMonthFontSize: 16,
                                    textDayHeaderFontSize: 12,
                                    fontFamily: 'Outfit_500Medium'
                                }}
                                style={{
                                    borderRadius: 16,
                                    paddingBottom: 10
                                }}
                            />
                        </Card>

                        {/* Summary Card */}
                        <View className="bg-amber-50 p-6 rounded-[32px] border border-amber-100 mb-6">
                            <Typography className="text-amber-700/60 text-[10px] font-black uppercase tracking-[2px] mb-2">Petunjuk</Typography>
                            <Typography className="text-amber-900 text-xs leading-relaxed">
                                Klik pada tanggal di kalender untuk menandai kehadiran. Tanggal yang berwarna hijau artinya karyawan tercatat masuk.
                            </Typography>
                        </View>

                        {/* Action Buttons */}
                        <View className="flex-row space-x-4">
                            <TouchableOpacity
                                onPress={() => setSelectedKaryawan(null)}
                                className="flex-1 bg-gray-100 h-16 rounded-2xl items-center justify-center border border-gray-200"
                            >
                                <Typography weight="bold" className="text-textGray">Batal</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
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
                            </TouchableOpacity>
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
        </View>
    );
}
