import React, { useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Lock, Unlock } from 'lucide-react-native';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { AlasanBatalDialog } from '../../components/ui/AlasanBatalDialog';
import { usePeriodePostingList, usePostingPeriode, useBukaKembaliPeriode } from '../../hooks/usePeriodePosting';
import type { PeriodePosting } from '../../services/periodePosting';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { formatDateTime } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';

type Notice = { visible: boolean; title: string; message: string; variant: 'success' | 'error' | 'warning' | 'info' };

export default function PostingBulananScreen() {
    const themeColors = useUIStore((s) => s.themeColors);
    const role = useAuthStore((s) => s.user?.role);
    const bisaPosting = role === 'ADMIN' || role === 'MANAGER';
    const bisaBuka = role === 'ADMIN';

    const [tahun, setTahun] = useState(new Date().getFullYear());
    const { data, isLoading, isRefetching, refetch } = usePeriodePostingList(tahun);
    const postingMutation = usePostingPeriode();
    const bukaMutation = useBukaKembaliPeriode();

    const [konfirmasi, setKonfirmasi] = useState<PeriodePosting | null>(null);
    const [bukaTarget, setBukaTarget] = useState<PeriodePosting | null>(null);
    const [notice, setNotice] = useState<Notice>({ visible: false, title: '', message: '', variant: 'info' });

    const items = useMemo(() => data?.periode ?? [], [data]);

    const tampilkan = (variant: Notice['variant'], title: string, message: string) =>
        setNotice({ visible: true, title, message, variant });

    const lakukanPosting = async () => {
        if (!konfirmasi) return;
        const target = konfirmasi;
        setKonfirmasi(null);
        try {
            await postingMutation.mutateAsync({ tahun: target.tahun, bulan: target.bulan });
            tampilkan('success', 'Periode Diposting', `${target.label} terkunci. Nota di bulan ini tidak bisa diubah lagi.`);
        } catch (error: any) {
            tampilkan('error', 'Gagal Posting', getErrorMessage(error, 'Periode tidak bisa diposting.'));
        }
    };

    const lakukanBuka = async (alasan: string) => {
        if (!bukaTarget) return;
        const target = bukaTarget;
        setBukaTarget(null);
        try {
            await bukaMutation.mutateAsync({ tahun: target.tahun, bulan: target.bulan, alasan });
            tampilkan('success', 'Periode Dibuka', `${target.label} dibuka kembali dan tercatat di riwayat.`);
        } catch (error: any) {
            tampilkan('error', 'Gagal Membuka', getErrorMessage(error, 'Periode tidak bisa dibuka.'));
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <Header title="Posting Bulanan" showBackButton onBackButtonPress={() => router.back()} />
            <View className="flex-row items-center justify-center px-6 pt-4">
                <Pressable onPress={() => setTahun((t) => t - 1)} className="p-2">
                    <ChevronLeft size={20} color={themeColors.primary} />
                </Pressable>
                <Typography weight="bold" className="text-textMain text-lg mx-6">{tahun}</Typography>
                <Pressable onPress={() => setTahun((t) => t + 1)} className="p-2">
                    <ChevronRight size={20} color={themeColors.primary} />
                </Pressable>
            </View>
            <Typography className="text-textGray text-xs text-center px-8 mt-2">
                Bulan yang diposting terkunci: nota di bulan itu tidak bisa diubah atau dibatalkan. Item susulan otomatis
                menjadi nota tambahan di bulan berjalan.
            </Typography>
            <FlatList
                data={items}
                keyExtractor={(item) => `${item.tahun}-${item.bulan}`}
                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
                ListEmptyComponent={
                    <Typography className="text-textGray text-center mt-10">{isLoading ? 'Memuat...' : 'Tidak ada data'}</Typography>
                }
                renderItem={({ item }) => {
                    const diposting = item.status === 'DIPOSTING';
                    return (
                        <View className="bg-surface rounded-[24px] p-5 mb-4 border border-border">
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    {diposting ? <Lock size={16} color="#E11D48" /> : <Unlock size={16} color={themeColors.textGray} />}
                                    <Typography weight="bold" className="text-textMain ml-2">{item.label}</Typography>
                                </View>
                                <Badge label={diposting ? 'DIPOSTING' : 'TERBUKA'} variant={diposting ? 'error' : 'success'} />
                            </View>
                            {diposting && item.diposting_pada ? (
                                <Typography className="text-textGray text-xs mt-2">
                                    Diposting {formatDateTime(item.diposting_pada)}
                                    {item.catatan ? ` • ${item.catatan}` : ''}
                                </Typography>
                            ) : null}
                            {!diposting && item.alasan_buka ? (
                                <Typography className="text-textGray text-xs mt-2">
                                    Dibuka kembali{item.dibuka_pada ? ` ${formatDateTime(item.dibuka_pada)}` : ''}: {item.alasan_buka}
                                </Typography>
                            ) : null}
                            {!diposting && !item.sudah_berakhir ? (
                                <Typography className="text-textGray text-xs mt-2">Bulan berjalan/mendatang belum bisa diposting.</Typography>
                            ) : null}
                            <View className="flex-row mt-3">
                                {!diposting && bisaPosting ? (
                                    <Button
                                        title="Posting Bulan Ini"
                                        size="sm"
                                        disabled={!item.sudah_berakhir || postingMutation.isPending}
                                        onPress={() => setKonfirmasi(item)}
                                    />
                                ) : null}
                                {diposting && bisaBuka ? (
                                    <Button title="Buka Kembali" size="sm" variant="outline" onPress={() => setBukaTarget(item)} />
                                ) : null}
                            </View>
                        </View>
                    );
                }}
            />

            <AlertDialog
                visible={!!konfirmasi}
                title="Posting Periode?"
                message={
                    konfirmasi
                        ? `${konfirmasi.label} akan terkunci. Nota bertanggal di bulan ini tidak bisa diubah atau dibatalkan, dan item susulan menjadi nota tambahan di bulan berjalan. Lanjutkan?`
                        : ''
                }
                variant="warning"
                type="confirm"
                confirmText="Posting"
                cancelText="Batal"
                loading={postingMutation.isPending}
                onConfirm={lakukanPosting}
                onClose={() => setKonfirmasi(null)}
            />
            <AlasanBatalDialog
                visible={!!bukaTarget}
                title="Buka Kembali Periode"
                message={bukaTarget ? `${bukaTarget.label} akan dibuka kembali. Nota di bulan ini bisa diubah lagi, dan laporan bulan itu bisa bergeser.` : ''}
                labelAlasan="Alasan membuka kembali (wajib)"
                placeholder="Contoh: koreksi harga part nota BGL2610060004"
                submitText="Buka Kembali"
                loading={bukaMutation.isPending}
                onClose={() => setBukaTarget(null)}
                onSubmit={lakukanBuka}
            />
            <AlertDialog
                visible={notice.visible}
                title={notice.title}
                message={notice.message}
                variant={notice.variant}
                type="alert"
                onClose={() => setNotice((n) => ({ ...n, visible: false }))}
            />
        </SafeAreaView>
    );
}
