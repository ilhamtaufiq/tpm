import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl, StatusBar, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    ChevronRight,
    Clock,
    LogIn,
    LogOut,
    Calendar,
    User,
    CheckCircle,
    XCircle,
    AlertCircle,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { sdmService, DailyAttendance, AttendanceStatus } from '../../services/sdm';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';

const getStatusBadge = (status: AttendanceStatus | null) => {
    if (!status) return { variant: 'neutral' as const, label: 'Belum Absen', icon: AlertCircle };
    const statusMap: Record<AttendanceStatus, { variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; label: string; icon: any }> = {
        'HADIR': { variant: 'success', label: 'Hadir', icon: CheckCircle },
        'IZIN': { variant: 'info', label: 'Izin', icon: AlertCircle },
        'SAKIT': { variant: 'warning', label: 'Sakit', icon: AlertCircle },
        'ALPHA': { variant: 'error', label: 'Alpha', icon: XCircle },
        'LIBUR': { variant: 'neutral', label: 'Libur', icon: Calendar },
        'CUTI': { variant: 'info', label: 'Cuti', icon: Calendar },
    };
    return statusMap[status] || { variant: 'neutral', label: status, icon: AlertCircle };
};

const formatTime = (time: string | null | undefined) => {
    if (!time) return '-';
    return time.substring(0, 5);
};

export default function AbsensiScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyData, setDailyData] = useState<DailyAttendance | null>(null);
    const [processingId, setProcessingId] = useState<number | null>(null);
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

    const handleGoBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/sdm');
        }
    };

    const loadData = useCallback(async () => {
        try {
            const data = await sdmService.getDailyAttendance(selectedDate);
            setDailyData(data);
        } catch (error) {
            console.error('Failed to load attendance:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        setLoading(true);
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const changeDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(date.toISOString().split('T')[0]);
    };

    const handleClockIn = async (karyawanId: number) => {
        setProcessingId(karyawanId);
        try {
            await sdmService.clockIn(karyawanId, selectedDate);
            setDialogConfig({ visible: true, title: 'Sukses', message: 'Clock-in berhasil', variant: 'success' });
            loadData();
        } catch (error: any) {
            console.error('Clock-in failed:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Clock-in gagal'), variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    const handleClockOut = async (karyawanId: number) => {
        setProcessingId(karyawanId);
        try {
            await sdmService.clockOut(karyawanId, selectedDate);
            setDialogConfig({ visible: true, title: 'Sukses', message: 'Clock-out berhasil', variant: 'success' });
            loadData();
        } catch (error: any) {
            console.error('Clock-out failed:', error);
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Clock-out gagal'), variant: 'error' });
        } finally {
            setProcessingId(null);
        }
    };

    const formatDateDisplay = (dateStr: string) => {
        const date = new Date(dateStr);
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    const renderAttendanceItem = ({ item }: { item: DailyAttendance['records'][0] }) => {
        const status = getStatusBadge(item.absensi?.status || null);
        const isProcessing = processingId === item.karyawan_id;

        return (
            <Card className="mb-3 p-4 border border-gray-100">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center mr-3">
                            <User size={20} color="#16A34A" />
                        </View>
                        <View className="flex-1">
                            <Typography weight="semibold">{item.karyawan_nama}</Typography>
                            <View className="flex-row items-center mt-1">
                                <Badge label={status.label} variant={status.variant} />
                                {item.absensi?.jam_masuk && (
                                    <Typography variant="caption" className="text-gray-500 ml-2">
                                        {formatTime(item.absensi.jam_masuk)} - {formatTime(item.absensi.jam_keluar)}
                                    </Typography>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Clock buttons - only show for today or if no record */}
                    {isToday && (
                        <View className="flex-row">
                            {!item.absensi?.jam_masuk ? (
                                <TouchableOpacity
                                    onPress={() => handleClockIn(item.karyawan_id)}
                                    disabled={isProcessing}
                                    className="bg-green-500 px-3 py-2 rounded-lg flex-row items-center"
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <>
                                            <LogIn size={16} color="white" />
                                            <Typography className="text-white text-xs ml-1">In</Typography>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ) : !item.absensi?.jam_keluar ? (
                                <TouchableOpacity
                                    onPress={() => handleClockOut(item.karyawan_id)}
                                    disabled={isProcessing}
                                    className="bg-red-500 px-3 py-2 rounded-lg flex-row items-center"
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <>
                                            <LogOut size={16} color="white" />
                                            <Typography className="text-white text-xs ml-1">Out</Typography>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View className="bg-gray-100 px-3 py-2 rounded-lg">
                                    <Typography className="text-gray-500 text-xs">Selesai</Typography>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </Card>
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-surface items-center justify-center">
                <ActivityIndicator size="large" color="#16A34A" />
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-surface">
            <StatusBar barStyle="light-content" />

            {/* Premium Header (Design System) */}
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
                            <Typography variant="h2" weight="bold" className="text-white text-2xl tracking-tighter">Absensi</Typography>
                            <Typography className="text-white/50 text-xs mt-0.5">Monitoring Kehadiran Harian</Typography>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onRefresh}
                        className="w-11 h-11 bg-white/10 rounded-2xl items-center justify-center border border-white/5"
                    >
                        {refreshing ? <ActivityIndicator size="small" color="white" /> : <Clock size={22} color="white" />}
                    </TouchableOpacity>
                </View>

                {/* Attendance Summary (Glassmorphism) - Inside Header */}
                <View className="bg-white/10 p-6 rounded-[32px] border border-white/10">
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-3">
                                <CheckCircle size={20} color="white" />
                            </View>
                            <Typography className="text-white/60 text-xs font-bold uppercase tracking-widest">Kehadiran Hari Ini</Typography>
                        </View>
                        <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/20">
                            <Typography className="text-emerald-300 text-[10px] font-bold">TOTAL {dailyData?.records.length || 0}</Typography>
                        </View>
                    </View>

                    <View className="flex-row space-x-3">
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Hadir</Typography>
                            <Typography className="text-emerald-400 font-bold text-lg" numberOfLines={1}>{dailyData?.summary.hadir || 0}</Typography>
                        </View>
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Izin/Sakit</Typography>
                            <Typography className="text-amber-400 font-bold text-lg" numberOfLines={1}>{(dailyData?.summary.izin || 0) + (dailyData?.summary.sakit || 0)}</Typography>
                        </View>
                        <View className="flex-1 bg-white/5 p-3 rounded-2xl border border-white/5">
                            <Typography className="text-white/40 text-[9px] font-bold uppercase tracking-tighter mb-1">Alpha</Typography>
                            <Typography className="text-rose-400 font-bold text-lg" numberOfLines={1}>{dailyData?.summary.alpha || 0}</Typography>
                        </View>
                    </View>
                </View>
            </View>

            {/* Date Navigator Overlay */}
            <View className="px-6 -mt-8 z-10">
                <View className="bg-white p-2 rounded-3xl shadow-xl border border-gray-50 flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => changeDate(-1)} className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100">
                        <ChevronLeft size={20} color="#1C1C1C" />
                    </TouchableOpacity>

                    <View className="items-center">
                        <Typography weight="bold" className="text-textMain">{formatDateDisplay(selectedDate)}</Typography>
                        {isToday && (
                            <View className="bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 mt-1">
                                <Typography className="text-emerald-600 text-[8px] font-bold uppercase">Hari Ini</Typography>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity onPress={() => changeDate(1)} className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100">
                        <ChevronRight size={20} color="#1C1C1C" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Attendance List */}
            <FlatList
                data={dailyData?.records || []}
                renderItem={(props) => {
                    const { item } = props;
                    const status = getStatusBadge(item.absensi?.status || null);
                    const isProcessing = processingId === item.karyawan_id;

                    return (
                        <View className="bg-white p-5 rounded-[32px] mb-6 border border-gray-50 shadow-sm flex-row items-center">
                            <View className="w-14 h-14 bg-gray-50 rounded-2xl items-center justify-center mr-4 border border-gray-100 shadow-inner">
                                <User size={28} color="#9CA3AF" />
                            </View>

                            <View className="flex-1 mr-3">
                                <Typography variant="body1" weight="bold" className="text-textMain tracking-tight mb-1" numberOfLines={1}>
                                    {item.karyawan_nama}
                                </Typography>

                                <View className="flex-row items-center">
                                    <View className={`px-2 py-0.5 rounded-lg border mr-2 ${status.variant === 'success' ? 'bg-emerald-50 border-emerald-100' :
                                        status.variant === 'warning' ? 'bg-amber-50 border-amber-100' :
                                            status.variant === 'error' ? 'bg-rose-50 border-rose-100' :
                                                'bg-gray-50 border-gray-100'
                                        }`}>
                                        <Typography className={`text-[8px] font-bold uppercase ${status.variant === 'success' ? 'text-emerald-600' :
                                            status.variant === 'warning' ? 'text-amber-600' :
                                                status.variant === 'error' ? 'text-rose-600' :
                                                    'text-textGray'
                                            }`}>
                                            {status.label}
                                        </Typography>
                                    </View>

                                    {item.absensi?.jam_masuk && (
                                        <Typography variant="caption" className="text-textGray/60 text-[10px] font-medium">
                                            {formatTime(item.absensi.jam_masuk)} - {formatTime(item.absensi.jam_keluar)}
                                        </Typography>
                                    )}
                                </View>
                            </View>

                            {isToday && (
                                <View>
                                    {!item.absensi?.jam_masuk ? (
                                        <TouchableOpacity
                                            onPress={() => handleClockIn(item.karyawan_id)}
                                            disabled={isProcessing}
                                            className="w-12 h-12 bg-emerald-500 rounded-2xl items-center justify-center shadow-lg shadow-emerald-500/30 border border-white/20"
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator size="small" color="white" />
                                            ) : (
                                                <LogIn size={20} color="white" />
                                            )}
                                        </TouchableOpacity>
                                    ) : !item.absensi?.jam_keluar ? (
                                        <TouchableOpacity
                                            onPress={() => handleClockOut(item.karyawan_id)}
                                            disabled={isProcessing}
                                            className="w-12 h-12 bg-rose-500 rounded-2xl items-center justify-center shadow-lg shadow-rose-500/30 border border-white/20"
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator size="small" color="white" />
                                            ) : (
                                                <LogOut size={20} color="white" />
                                            )}
                                        </TouchableOpacity>
                                    ) : (
                                        <View className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100">
                                            <CheckCircle size={20} color="#10B981" />
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                }}
                keyExtractor={(item) => item.karyawan_id.toString()}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00AA13" />}
                ListEmptyComponent={
                    <View className="items-center py-20">
                        <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-6">
                            <Clock size={40} color="#D1D5DB" />
                        </View>
                        <Typography className="text-gray-400 font-medium">Tidak ada data absensi ditemukan</Typography>
                    </View>
                }
            />

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
