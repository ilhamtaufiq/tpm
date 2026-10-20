import React, { useState } from 'react';
import { View, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Typography } from './ui/Typography';
import { Card } from './ui/Card';
import { AlertDialog } from './ui/AlertDialog';
import { perbaikanDataService, PiutangTanpaKas, TanggalMundur } from '../services/perbaikanData';
import { formatCurrency, tanggalLokal } from '../utils/format';

type Aksi =
    | { tipe: 'catat-tunai'; item: PiutangTanpaKas }
    | { tipe: 'catat-transfer'; item: PiutangTanpaKas }
    | { tipe: 'batalkan'; item: PiutangTanpaKas }
    | { tipe: 'tanggal'; item: TanggalMundur; tanggalBaru: string };

const TANGGAL_VALID = /^\d{4}-\d{2}-\d{2}$/;

const pesanError = (err: any) => err?.response?.data?.detail || err?.message || 'Terjadi kesalahan';

export const PerbaikanDataPanel = () => {
    const queryClient = useQueryClient();
    const [aksi, setAksi] = useState<Aksi | null>(null);
    const [tanggalInput, setTanggalInput] = useState<Record<string, string>>({});
    const [hasil, setHasil] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);

    const piutangQuery = useQuery({
        queryKey: ['perbaikan-data', 'piutang-tanpa-kas'],
        queryFn: () => perbaikanDataService.getPiutangTanpaKas(),
    });
    const mundurQuery = useQuery({
        queryKey: ['perbaikan-data', 'tanggal-mundur'],
        queryFn: () => perbaikanDataService.getTanggalMundur(1),
    });

    const mutation = useMutation({
        mutationFn: async (a: Aksi) => {
            if (a.tipe === 'catat-tunai') return perbaikanDataService.catatKasPiutang(a.item.id, 'TUNAI');
            if (a.tipe === 'catat-transfer') return perbaikanDataService.catatKasPiutang(a.item.id, 'TRANSFER');
            if (a.tipe === 'batalkan') return perbaikanDataService.batalkanPiutang(a.item.id);
            return perbaikanDataService.ubahTanggal({
                nomor_referensi: a.item.nomor_referensi,
                tanggal_lama: a.item.tanggal_lama,
                tanggal_baru: a.tanggalBaru,
            });
        },
        onSuccess: () => {
            setHasil({ variant: 'success', message: 'Perbaikan berhasil disimpan.' });
            queryClient.invalidateQueries({ queryKey: ['perbaikan-data'] });
        },
        onError: (err) => setHasil({ variant: 'error', message: String(pesanError(err)) }),
    });

    const judulAksi = (a: Aksi) => {
        if (a.tipe === 'catat-tunai') return `Catat kas keluar TUNAI untuk ${a.item.nomor_piutang}?`;
        if (a.tipe === 'catat-transfer') return `Catat kas keluar TRANSFER untuk ${a.item.nomor_piutang}?`;
        if (a.tipe === 'batalkan') return `Batalkan ${a.item.nomor_piutang}? Gunakan hanya jika tidak ada uang yang keluar.`;
        return `Pindahkan tanggal ${a.item.nomor_referensi} dari ${a.item.tanggal_lama} ke ${a.tanggalBaru}?`;
    };

    const konfirmasi = () => {
        if (!aksi) return;
        const aksiYangDijalankan = aksi;
        setAksi(null);
        mutation.mutate(aksiYangDijalankan);
    };

    return (
        <View>
            {hasil && (
                <Pressable onPress={() => setHasil(null)} className={`p-3 rounded-2xl mb-4 ${hasil.variant === 'success' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                    <Typography className={`text-xs ${hasil.variant === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{hasil.message}</Typography>
                </Pressable>
            )}

            <Typography weight="bold" className="text-white/60 text-[10px] uppercase tracking-widest mb-2">
                Piutang manual tanpa kas
            </Typography>
            <Typography className="text-white/40 text-[11px] mb-3">
                Dibuat tanpa metode pencairan, jadi tidak ada uang keluar yang tercatat dan selisihnya masuk Modal.
            </Typography>
            {piutangQuery.isLoading ? (
                <ActivityIndicator color="#fff" />
            ) : (piutangQuery.data ?? []).length === 0 ? (
                <Typography className="text-emerald-300 text-xs mb-6">Tidak ada.</Typography>
            ) : (
                (piutangQuery.data ?? []).map((p) => (
                    <Card key={p.id} className="bg-surface/5 border border-white/10 p-4 rounded-2xl mb-3">
                        <Typography weight="bold" className="text-white text-sm">{p.nomor_piutang} · {p.nama_debitur}</Typography>
                        <Typography className="text-white/50 text-[11px] mt-0.5">
                            {format(tanggalLokal(p.tanggal), 'dd MMM yyyy', { locale: localeID })} · {formatCurrency(p.nominal_piutang)}
                        </Typography>
                        {p.catatan ? <Typography className="text-white/40 text-[11px] mt-1">{p.catatan}</Typography> : null}
                        <View className="flex-row flex-wrap gap-2 mt-3">
                            <Pressable onPress={() => setAksi({ tipe: 'catat-tunai', item: p })} className="px-3 py-2 rounded-full bg-amber-600">
                                <Typography weight="bold" className="text-white text-[11px]">Catat kas TUNAI</Typography>
                            </Pressable>
                            <Pressable onPress={() => setAksi({ tipe: 'catat-transfer', item: p })} className="px-3 py-2 rounded-full bg-blue-600">
                                <Typography weight="bold" className="text-white text-[11px]">Catat kas TRANSFER</Typography>
                            </Pressable>
                            <Pressable onPress={() => setAksi({ tipe: 'batalkan', item: p })} className="px-3 py-2 rounded-full bg-rose-600/80">
                                <Typography weight="bold" className="text-white text-[11px]">Batalkan</Typography>
                            </Pressable>
                        </View>
                    </Card>
                ))
            )}

            <Typography weight="bold" className="text-white/60 text-[10px] uppercase tracking-widest mt-6 mb-2">
                Tanggal mundur
            </Typography>
            <Typography className="text-white/40 text-[11px] mb-3">
                Kas yang tanggalnya 1 hari sebelum tanggal input. Tanggal yang diusulkan adalah tanggal input. Isi tanggal lain bila perlu (YYYY-MM-DD).
            </Typography>
            {mundurQuery.isLoading ? (
                <ActivityIndicator color="#fff" />
            ) : (mundurQuery.data ?? []).length === 0 ? (
                <Typography className="text-emerald-300 text-xs">Tidak ada.</Typography>
            ) : (
                (mundurQuery.data ?? []).map((g) => {
                    const kunci = `${g.nomor_referensi}|${g.tanggal_lama}`;
                    const tanggalBaru = tanggalInput[kunci] ?? g.tanggal_seharusnya;
                    const valid = TANGGAL_VALID.test(tanggalBaru);
                    return (
                        <Card key={kunci} className="bg-surface/5 border border-white/10 p-4 rounded-2xl mb-3">
                            <Typography weight="bold" className="text-white text-sm">{g.nomor_referensi}</Typography>
                            <Typography className="text-white/50 text-[11px] mt-0.5">
                                Induk: {g.induk ?? 'kas saja'} · {g.jumlah_baris} baris · {formatCurrency(g.total)}
                            </Typography>
                            <Typography className="text-white/50 text-[11px] mt-0.5">
                                Tercatat {g.tanggal_lama} · tanggal input {g.tanggal_seharusnya}
                            </Typography>
                            {g.keterangan ? <Typography className="text-white/40 text-[11px] mt-1">{g.keterangan}</Typography> : null}
                            <View className="flex-row items-center gap-2 mt-3">
                                <TextInput
                                    value={tanggalBaru}
                                    onChangeText={(t) => setTanggalInput((prev) => ({ ...prev, [kunci]: t }))}
                                    placeholder="YYYY-MM-DD"
                                    placeholderTextColor="#ffffff55"
                                    className="flex-1 text-white bg-surface/10 rounded-xl px-3 py-2 text-xs"
                                />
                                <Pressable
                                    disabled={!valid}
                                    onPress={() => setAksi({ tipe: 'tanggal', item: g, tanggalBaru })}
                                    className={`px-3 py-2 rounded-full ${valid ? 'bg-purple-600' : 'bg-white/10'}`}
                                >
                                    <Typography weight="bold" className="text-white text-[11px]">Perbaiki</Typography>
                                </Pressable>
                            </View>
                        </Card>
                    );
                })
            )}

            <AlertDialog
                visible={aksi !== null}
                type="confirm"
                variant="warning"
                title="Konfirmasi perbaikan"
                message={aksi ? judulAksi(aksi) : ''}
                confirmText="Ya, perbaiki"
                onConfirm={konfirmasi}
                onClose={() => setAksi(null)}
                loading={mutation.isPending}
            />
        </View>
    );
};
