import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { piutangFolderService, StrukFolder } from '../../services/piutangFolder';
import { keuanganService } from '../../services/keuangan';
import { formatCurrency, formatNumber, parseNumber, getTodayString, tanggalLokal } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';

const STATUS_LABEL: Record<StrukFolder['status'], { text: string; cls: string }> = {
    LUNAS: { text: 'Lunas', cls: 'bg-emerald-50 text-emerald-700' },
    SEBAGIAN: { text: 'Sebagian', cls: 'bg-amber-50 text-amber-700' },
    BELUM_LUNAS: { text: 'Belum lunas', cls: 'bg-rose-50 text-rose-700' },
    BATAL: { text: 'Batal', cls: 'bg-slate-100 text-slate-500' },
};

const TANGGAL_VALID = /^\d{4}-\d{2}-\d{2}$/;

export default function PiutangFolderScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const folderId = id ? Number(id) : null;
    const queryClient = useQueryClient();
    const [namaBaru, setNamaBaru] = useState('');
    const [tanggal, setTanggal] = useState(getTodayString());
    const [nominal, setNominal] = useState('');
    const [metode, setMetode] = useState<'TUNAI' | 'TRANSFER'>('TUNAI');
    const [dialog, setDialog] = useState<{ visible: boolean; title: string; message: string; variant: 'success' | 'error' | 'info' }>({
        visible: false, title: '', message: '', variant: 'info',
    });
    const [refreshing, setRefreshing] = useState(false);

    const listQuery = useQuery({
        queryKey: ['piutang-folder', 'daftar'],
        queryFn: () => piutangFolderService.daftar(),
        enabled: folderId === null,
    });
    const detailQuery = useQuery({
        queryKey: ['piutang-folder', 'detail', folderId],
        queryFn: () => piutangFolderService.detail(folderId as number),
        enabled: folderId !== null,
    });
    // Piutang yang belum masuk folder mana pun, untuk ditambahkan ke folder ini.
    const kandidatQuery = useQuery({
        queryKey: ['piutang-folder', 'kandidat'],
        queryFn: () => keuanganService.getPiutangList({ limit: 200 }),
        enabled: folderId !== null,
    });
    const kandidat = useMemo(
        () => (kandidatQuery.data?.data ?? []).filter((p: any) => p.folder_id == null && p.status !== 'LUNAS' && p.status !== 'BATAL'),
        [kandidatQuery.data],
    );

    const tampilkan = (title: string, message: string, variant: 'success' | 'error' | 'info' = 'info') =>
        setDialog({ visible: true, title, message, variant });

    const refreshSemua = async () => {
        await queryClient.invalidateQueries({ queryKey: ['piutang-folder'] });
        await queryClient.invalidateQueries({ queryKey: ['piutang_list'] });
        await queryClient.invalidateQueries({ queryKey: ['piutang_summary'] });
    };

    const buatMutation = useMutation({
        mutationFn: () => piutangFolderService.buat(namaBaru.trim()),
        onSuccess: async () => { setNamaBaru(''); await refreshSemua(); },
        onError: (e) => tampilkan('Gagal', getErrorMessage(e, 'Gagal membuat folder'), 'error'),
    });

    const pindahMutation = useMutation({
        mutationFn: ({ piutangId, folderTujuan }: { piutangId: number; folderTujuan: number | null }) =>
            piutangFolderService.pindahkan(piutangId, folderTujuan),
        onSuccess: refreshSemua,
        onError: (e) => tampilkan('Gagal', getErrorMessage(e, 'Gagal memindahkan piutang'), 'error'),
    });

    const bayarMutation = useMutation({
        mutationFn: () => piutangFolderService.bayar(folderId as number, {
            tanggal,
            metode,
            nominal: parseNumber(nominal),
        }),
        onSuccess: async (hasil: any) => {
            const bagian = (hasil?.dibayar ?? []).length;
            setNominal('');
            await refreshSemua();
            tampilkan('Pembayaran dicatat', `Dibagi ke ${bagian} struk, dimulai dari yang tertua.`, 'success');
        },
        onError: async (e) => {
            await refreshSemua();
            tampilkan('Gagal', getErrorMessage(e, 'Pembayaran folder gagal. Cek rincian: bagian yang sudah tercatat tidak dibatalkan otomatis.'), 'error');
        },
    });

    const hapusMutation = useMutation({
        mutationFn: () => piutangFolderService.hapus(folderId as number),
        onSuccess: () => { refreshSemua(); router.back(); },
        onError: (e) => tampilkan('Gagal', getErrorMessage(e, 'Folder tidak bisa dihapus'), 'error'),
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshSemua();
        setRefreshing(false);
    };

    const nominalValid = parseNumber(nominal) > 0;
    const tanggalValid = TANGGAL_VALID.test(tanggal);

    if (folderId === null) {
        return (
            <View className="flex-1 bg-background">
                <Stack.Screen options={{ headerShown: false }} />
                <Header title="Folder Piutang" subtitle="Kelompokkan piutang per debitur" showBackButton onBackButtonPress={() => router.back()} />
                <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                    <Card className="p-4 gap-3 mb-4">
                        <Typography weight="bold" className="text-textMain text-sm">Buat folder baru</Typography>
                        <Input value={namaBaru} onChangeText={setNamaBaru} placeholder="Nama folder, mis. A" maxLength={100} />
                        <Button title="Buat folder" onPress={() => buatMutation.mutate()} disabled={namaBaru.trim().length < 2 || buatMutation.isPending} loading={buatMutation.isPending} />
                    </Card>
                    {(listQuery.data ?? []).length === 0 && !listQuery.isLoading ? (
                        <EmptyState title="Belum ada folder" description="Buat folder lalu tambahkan piutang ke dalamnya." />
                    ) : (
                        (listQuery.data ?? []).map((f) => (
                            <Pressable key={f.id} onPress={() => router.push({ pathname: '/finance/piutang-folder', params: { id: String(f.id) } })}>
                                <Card className="p-4 mb-3">
                                    <Typography weight="bold" className="text-textMain text-base">{f.nama}</Typography>
                                    <Typography className="text-textGray text-xs mt-1">
                                        {f.jumlah_struk} struk · {f.belum_lunas} belum lunas · sisa {formatCurrency(f.total_sisa)}
                                    </Typography>
                                </Card>
                            </Pressable>
                        ))
                    )}
                </ScrollView>
                <AlertDialog visible={dialog.visible} title={dialog.title} message={dialog.message} variant={dialog.variant} onClose={() => setDialog((d) => ({ ...d, visible: false }))} onConfirm={() => setDialog((d) => ({ ...d, visible: false }))} />
            </View>
        );
    }

    const detail = detailQuery.data;
    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />
            <Header title={detail?.nama ?? 'Folder'} subtitle={detail ? `Sisa ${formatCurrency(detail.total_sisa)}` : 'Memuat…'} showBackButton onBackButtonPress={() => router.back()} />
            <ScrollView className="flex-1 px-6 pt-4" contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                <Card className="p-4 gap-3 mb-4">
                    <Typography weight="bold" className="text-textMain text-sm">Bayar folder</Typography>
                    <Typography className="text-textGray text-xs">Nominal dibagi ke struk paling tua dulu. Setiap bagian tercatat sebagai pembayaran piutang biasa.</Typography>
                    <View className="flex-row gap-2">
                        <View className="flex-1"><Input value={tanggal} onChangeText={setTanggal} placeholder="YYYY-MM-DD" maxLength={10} /></View>
                        <View className="flex-1"><Input value={nominal} onChangeText={(t) => setNominal(formatNumber(t))} placeholder="Nominal" keyboardType="numeric" /></View>
                    </View>
                    <View className="flex-row gap-2">
                        {(['TUNAI', 'TRANSFER'] as const).map((m) => (
                            <Pressable key={m} onPress={() => setMetode(m)} className={`flex-1 py-2 rounded-xl items-center border ${metode === m ? 'bg-primary border-primary' : 'border-transparent bg-surface/50'}`}>
                                <Typography className={`text-xs font-bold ${metode === m ? 'text-white' : 'text-textGray'}`}>{m}</Typography>
                            </Pressable>
                        ))}
                    </View>
                    <Button title="Bayar folder" onPress={() => bayarMutation.mutate()} disabled={!nominalValid || !tanggalValid || bayarMutation.isPending} loading={bayarMutation.isPending} />
                </Card>

                <Typography weight="bold" className="text-textGray text-[10px] uppercase tracking-widest mb-2">Rincian struk</Typography>
                {(detail?.piutang ?? []).map((p) => {
                    const st = STATUS_LABEL[p.status];
                    return (
                        <Card key={p.id} className="p-4 mb-3 gap-1">
                            <View className="flex-row justify-between items-center">
                                <Typography weight="bold" className="text-textMain text-sm">{p.nomor_piutang}</Typography>
                                <View className={`px-2 py-1 rounded-md ${st.cls}`}>
                                    <Typography className="text-[10px] font-bold">{st.text}</Typography>
                                </View>
                            </View>
                            <Typography className="text-textGray text-xs">
                                {format(tanggalLokal(p.tanggal), 'dd MMM yyyy', { locale: localeID })} · {formatCurrency(p.nominal_piutang)} · sisa {formatCurrency(p.sisa_piutang)}
                            </Typography>
                            {p.pembayaran.map((x, i) => (
                                <Typography key={i} className="text-emerald-700 text-[11px]">
                                    Dibayar {formatCurrency(x.nominal)} pada {format(tanggalLokal(x.tanggal), 'dd MMM yyyy', { locale: localeID })}{x.metode ? ` (${x.metode})` : ''}
                                </Typography>
                            ))}
                            <Pressable onPress={() => pindahMutation.mutate({ piutangId: p.id, folderTujuan: null })} className="self-start mt-2">
                                <Typography className="text-rose-600 text-xs font-bold">Keluarkan dari folder</Typography>
                            </Pressable>
                        </Card>
                    );
                })}

                <Typography weight="bold" className="text-textGray text-[10px] uppercase tracking-widest mt-4 mb-2">Tambah piutang ke folder</Typography>
                {kandidat.length === 0 ? (
                    <Typography className="text-textGray text-xs">Tidak ada piutang lepas yang bisa ditambahkan.</Typography>
                ) : kandidat.map((p: any) => (
                    <Card key={p.id} className="p-3 mb-2 flex-row justify-between items-center">
                        <View className="flex-1 mr-2">
                            <Typography weight="bold" className="text-textMain text-xs" numberOfLines={1}>{p.nomor_piutang} · {p.nama_debitur}</Typography>
                            <Typography className="text-textGray text-[11px]">sisa {formatCurrency(p.sisa_piutang)}</Typography>
                        </View>
                        <Button title="Tambah" size="sm" onPress={() => pindahMutation.mutate({ piutangId: p.id, folderTujuan: folderId })} />
                    </Card>
                ))}

                <Pressable onPress={() => hapusMutation.mutate()} className="self-center mt-6">
                    <Typography className="text-rose-600 text-xs font-bold">Hapus folder ini</Typography>
                </Pressable>
            </ScrollView>
            <AlertDialog visible={dialog.visible} title={dialog.title} message={dialog.message} variant={dialog.variant} onClose={() => setDialog((d) => ({ ...d, visible: false }))} onConfirm={() => setDialog((d) => ({ ...d, visible: false }))} />
        </View>
    );
}
