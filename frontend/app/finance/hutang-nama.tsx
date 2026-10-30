import React, { useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, Share } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns/format';
import { id as localeID } from 'date-fns/locale/id';
import { Header } from '../../components/ui/Header';
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { namaGrupService, StrukNama } from '../../services/namaGrup';
import { formatCurrency, formatNumber, parseNumber, getTodayString, tanggalLokal } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';
import { buildRincianNamaPesan } from '../../utils/rincianNama';

const STATUS_LABEL: Record<StrukNama['status'], { text: string; cls: string }> = {
    LUNAS: { text: 'Lunas', cls: 'bg-emerald-50 text-emerald-700' },
    SEBAGIAN: { text: 'Sebagian', cls: 'bg-amber-50 text-amber-700' },
    BELUM_LUNAS: { text: 'Belum lunas', cls: 'bg-rose-50 text-rose-700' },
    BATAL: { text: 'Batal', cls: 'bg-background text-textGray' },
};

const TANGGAL_VALID = /^\d{4}-\d{2}-\d{2}$/;

const SUMBER_LABEL: Record<string, string> = {
    PEMBELIAN_PART: 'Pembelian Part',
    PEMBELIAN_MOBIL: 'Pembelian Mobil',
    JUAL_BELI_MOBIL: 'Jual Mobil',
    UANG_MUKA_PENJUALAN: 'Uang Muka Penjualan',
    LAINNYA: 'Lainnya',
    BENGKEL: 'Bengkel',
    JASA_ANGKUT: 'Jasa Angkut',
};

export default function HutangNamaScreen() {
    const { nama } = useLocalSearchParams<{ nama?: string }>();
    const namaDebitur = nama ?? '';
    const queryClient = useQueryClient();
    const [tanggal, setTanggal] = useState(getTodayString());
    const [nominal, setNominal] = useState('');
    const [keterangan, setKeterangan] = useState('');
    const [metode, setMetode] = useState<'TUNAI' | 'TRANSFER'>('TUNAI');
    const [strukId, setStrukId] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [dialog, setDialog] = useState<{ visible: boolean; title: string; message: string; variant: 'success' | 'error' | 'info' }>({
        visible: false, title: '', message: '', variant: 'info',
    });

    const detailQuery = useQuery({
        queryKey: ['hutang-nama', 'detail', namaDebitur],
        queryFn: () => namaGrupService.hutangDetail(namaDebitur),
        enabled: namaDebitur.length > 0,
    });

    const tampilkan = (title: string, message: string, variant: 'success' | 'error' | 'info' = 'info') =>
        setDialog({ visible: true, title, message, variant });

    const refreshSemua = async () => {
        await queryClient.invalidateQueries({ queryKey: ['hutang-nama'] });
        await queryClient.invalidateQueries({ queryKey: ['hutang_list'] });
        await queryClient.invalidateQueries({ queryKey: ['hutang_summary'] });
    };

    const bayarMutation = useMutation({
        mutationFn: () => namaGrupService.hutangBayar(namaDebitur, {
            tanggal,
            metode,
            nominal: parseNumber(nominal),
            struk_id: strukId ?? undefined,
            catatan: keterangan.trim() || undefined,
        }),
        onSuccess: async (hasil) => {
            const bagian = hasil?.dibayar?.length ?? 0;
            setNominal('');
            setKeterangan('');
            setStrukId(null);
            await refreshSemua();
            tampilkan('Pembayaran dicatat', `Dibagi ke ${bagian} struk, dimulai dari yang tertua.`, 'success');
        },
        onError: async (e) => {
            await refreshSemua();
            tampilkan('Gagal', getErrorMessage(e, 'Pembayaran gagal. Cek rincian: bagian yang sudah tercatat tidak dibatalkan otomatis.'), 'error');
        },
    });

    const kirimRincian = async () => {
        if (!detailQuery.data) return;
        try {
            await Share.share({ message: buildRincianNamaPesan('HUTANG', detailQuery.data) });
        } catch (e) {
            tampilkan('Gagal', getErrorMessage(e, 'Rincian tidak bisa dibagikan'), 'error');
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshSemua();
        setRefreshing(false);
    };

    const detail = detailQuery.data;
    const strukTerpilih = detail?.struk.find((s) => s.id === strukId);
    const melebihiStruk = !!strukTerpilih && parseNumber(nominal) > strukTerpilih.sisa;
    const nominalValid = parseNumber(nominal) > 0;
    const tanggalValid = TANGGAL_VALID.test(tanggal);

    return (
        <View className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />
            <Header
                title={namaDebitur || 'Hutang'}
                subtitle={detail ? `Sisa ${formatCurrency(detail.total_sisa)}` : 'Memuat…'}
                showBackButton
                onBackButtonPress={() => router.back()}
            />
            <ScrollView
                className="flex-1 px-6 pt-4"
                contentContainerStyle={{ paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <Button
                    title="Kirim Rincian"
                    variant="outline"
                    onPress={kirimRincian}
                    disabled={!detail}
                    className="mb-4"
                />

                <Card className="p-4 gap-3 mb-4">
                    <Typography weight="bold" className="text-textMain text-sm">Bayar hutang {namaDebitur}</Typography>
                    <Typography className="text-textGray text-xs">
                        Nominal dibagi ke struk paling tua dulu. Setiap bagian tercatat sebagai pembayaran hutang biasa.
                    </Typography>
                    <Typography className="text-textGray text-[10px] font-bold uppercase tracking-widest">Bayar ke</Typography>
                    <View className="flex-row flex-wrap gap-2">
                        <Pressable onPress={() => setStrukId(null)} className={`px-3 py-2 rounded-2xl border ${strukId === null ? 'border-primary bg-primary/5' : 'border-transparent bg-surface/50'}`}>
                            <Typography className={`text-xs ${strukId === null ? 'text-primary font-bold' : 'text-textGray'}`}>Otomatis (tertua dulu)</Typography>
                        </Pressable>
                        {(detail?.struk ?? []).filter((s) => s.status !== 'LUNAS' && s.sisa > 0).map((s) => (
                            <Pressable key={s.id} onPress={() => setStrukId(s.id)} className={`px-3 py-2 rounded-2xl border ${strukId === s.id ? 'border-primary bg-primary/5' : 'border-transparent bg-surface/50'}`}>
                                <Typography className={`text-xs ${strukId === s.id ? 'text-primary font-bold' : 'text-textGray'}`}>{s.nomor} · sisa {formatCurrency(s.sisa)}</Typography>
                            </Pressable>
                        ))}
                    </View>
                    {strukTerpilih && (
                        <Typography className={`text-xs ${melebihiStruk ? 'text-rose-600' : 'text-textGray'}`}>
                            {melebihiStruk ? `Melebihi sisa ${strukTerpilih.nomor} (${formatCurrency(strukTerpilih.sisa)}).` : `Nominal hanya masuk ke ${strukTerpilih.nomor}.`}
                        </Typography>
                    )}
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
                    <Input value={keterangan} onChangeText={setKeterangan} placeholder="Keterangan pelunasan (opsional)" maxLength={255} />
                    <Button
                        title="Bayar"
                        onPress={() => bayarMutation.mutate()}
                        disabled={!nominalValid || !tanggalValid || melebihiStruk || bayarMutation.isPending}
                        loading={bayarMutation.isPending}
                    />
                </Card>

                <Typography weight="bold" className="text-textGray text-[10px] uppercase tracking-widest mb-2">Rincian struk</Typography>
                {(detail?.struk ?? []).map((p) => {
                    const st = STATUS_LABEL[p.status];
                    return (
                        <Card key={p.id} className="p-4 mb-3 gap-1">
                            <View className="flex-row justify-between items-center">
                                <Typography weight="bold" className="text-textMain text-sm">{p.nomor}</Typography>
                                <View className={`px-2 py-1 rounded-md ${st.cls}`}>
                                    <Typography className="text-[10px] font-bold">{st.text}</Typography>
                                </View>
                            </View>
                            <Typography className="text-textGray text-xs">
                                {format(tanggalLokal(p.tanggal), 'dd MMM yyyy', { locale: localeID })} · {formatCurrency(p.nominal)} · sisa {formatCurrency(p.sisa)}
                            </Typography>
                            {p.sumber ? (
                                <Typography className="text-textGray text-[11px]">
                                    Dari: {SUMBER_LABEL[p.sumber] || p.sumber}{p.unit ? ` · ${SUMBER_LABEL[p.unit] || p.unit}` : ''}{p.nomor_referensi ? ` · ${p.nomor_referensi}` : ''}
                                </Typography>
                            ) : null}
                            {p.catatan ? (
                                <Typography className="text-textMain text-[11px]">Keterangan: {p.catatan}</Typography>
                            ) : null}
                            {(p.pembayaran ?? []).map((x, i) => (
                                <Typography key={i} className="text-emerald-700 text-[11px]">
                                    Dibayar {formatCurrency(x.nominal)} pada {format(tanggalLokal(x.tanggal), 'dd MMM yyyy', { locale: localeID })}{x.metode ? ` (${x.metode})` : ''}
                                </Typography>
                            ))}
                        </Card>
                    );
                })}
            </ScrollView>
            <AlertDialog
                visible={dialog.visible}
                title={dialog.title}
                message={dialog.message}
                variant={dialog.variant}
                onClose={() => setDialog((d) => ({ ...d, visible: false }))}
                onConfirm={() => setDialog((d) => ({ ...d, visible: false }))}
            />
        </View>
    );
}
