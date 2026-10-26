import React, { useEffect, useMemo, useState } from 'react';
import { View, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns/format';
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { BottomSheetContainer, BoundedSheetScrollView } from './ui/BottomSheetContainer';
import { formatCurrency } from '../utils/format';
import { getErrorMessage } from '../utils/error';
import { useReturPembelianList, useReturPembelianPreview, useCreateReturPembelian } from '../hooks/useBengkel';

interface ReturPembelianModalProps {
    visible: boolean;
    pembelian: any | null;
    onClose: () => void;
    onSuccess: () => void;
}

const METODE_REFUND = ['TUNAI', 'TRANSFER'] as const;
type SelisihSebagai = 'KAS' | 'PIUTANG';

/**
 * Retur barang pembelian ke supplier. Qty per baris dibatasi sisa yang belum
 * diretur. Pembagian nilai (potong hutang vs kembali ke kas) diambil dari
 * server lewat pratinjau, supaya angka yang tampil sama dengan yang disimpan.
 */
export function ReturPembelianModal({ visible, pembelian, onClose, onSuccess }: ReturPembelianModalProps) {
    const insets = useSafeAreaInsets();
    const { data: returList = [] } = useReturPembelianList(pembelian?.id);
    const createMutation = useCreateReturPembelian();

    const [qtyInput, setQtyInput] = useState<Record<number, string>>({});
    const [metodeRefund, setMetodeRefund] = useState<(typeof METODE_REFUND)[number]>('TUNAI');
    const [selisihSebagai, setSelisihSebagai] = useState<SelisihSebagai>('KAS');
    const [catatan, setCatatan] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (visible) {
            setQtyInput({});
            setMetodeRefund('TUNAI');
            setSelisihSebagai('KAS');
            setCatatan('');
            setError('');
        }
    }, [visible, pembelian?.id]);

    // Qty yang sudah diretur (retur aktif) per baris pembelian.
    const sudahDiretur = useMemo(() => {
        const map: Record<number, number> = {};
        for (const r of returList) {
            if (r.dibatalkan) continue;
            for (const d of r.detail || []) {
                map[d.detail_pembelian_id] = (map[d.detail_pembelian_id] || 0) + Number(d.qty || 0);
            }
        }
        return map;
    }, [returList]);

    const sisaPerBaris = (detailId: number, qtyBeli: number) => Math.max(0, qtyBeli - (sudahDiretur[detailId] || 0));

    const items = useMemo(
        () =>
            Object.entries(qtyInput)
                .map(([id, q]) => ({ detail_pembelian_id: Number(id), qty: Number(q.replace(',', '.')) || 0 }))
                .filter((it) => it.qty > 0),
        [qtyInput]
    );

    const tanggal = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [visible]);
    const requestBody = useMemo(
        () => ({ tanggal, detail: items, selisih_sebagai: selisihSebagai }),
        [tanggal, items, selisihSebagai]
    );

    const preview = useReturPembelianPreview(pembelian?.id, requestBody, items.length > 0);
    const previewError = preview.error ? getErrorMessage(preview.error, 'Pratinjau retur gagal') : '';

    const adaBarisMelebihiSisa = (pembelian?.detail || []).some((d: any) => {
        const q = Number((qtyInput[d.id] || '0').replace(',', '.')) || 0;
        return q > sisaPerBaris(d.id, Number(d.qty));
    });

    const nilaiKas = Number(preview.data?.nilai_kas || 0);
    const nilaiPiutang = Number(preview.data?.nilai_piutang || 0);
    const adaSelisih = nilaiKas + nilaiPiutang > 0;
    const bisaSimpan = items.length > 0 && !!preview.data && !previewError && !adaBarisMelebihiSisa && !createMutation.isPending;

    const handleSave = async () => {
        if (!pembelian) return;
        setError('');
        try {
            await createMutation.mutateAsync({
                pembelianId: pembelian.id,
                data: {
                    ...requestBody,
                    metode_refund: nilaiKas > 0 ? metodeRefund : undefined,
                    catatan: catatan.trim() || undefined,
                },
            });
            onSuccess();
        } catch (err) {
            setError(getErrorMessage(err, 'Gagal menyimpan retur'));
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <BottomSheetContainer
                onClose={onClose}
                insets={insets}
                maxHeight="90%"
                footer={
                    <View className="flex-row space-x-3">
                        <Button title="Batal" variant="outline" className="flex-1" onPress={onClose} />
                        <Button
                            title={createMutation.isPending ? 'Menyimpan...' : 'Simpan Retur'}
                            className="flex-1"
                            onPress={handleSave}
                            disabled={!bisaSimpan}
                        />
                    </View>
                }
            >
                <View className="p-5">
                    <Typography variant="h3" weight="bold" className="text-textMain mb-1">Retur Pembelian</Typography>
                    <Typography variant="caption" className="text-textGray mb-4">Nota {pembelian?.nomor_transaksi || '-'}</Typography>

                    <BoundedSheetScrollView maxHeightRatio={0.6} headerReserve={180} bottomInset={insets.bottom} showsVerticalScrollIndicator={false}>
                        <Typography weight="bold" className="text-primary text-xs uppercase mb-2 tracking-widest">Barang yang diretur</Typography>
                        {(pembelian?.detail || []).map((d: any) => {
                            const sisa = sisaPerBaris(d.id, Number(d.qty));
                            const nama = d.spare_part?.nama || d.spare_part_nama || `Part #${d.spare_part_id}`;
                            return (
                                <View key={d.id} className="mb-3">
                                    <Input
                                        label={`${nama} · ${formatCurrency(d.harga_satuan)} (sisa ${sisa} dari ${d.qty})`}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        editable={sisa > 0}
                                        value={qtyInput[d.id] ?? ''}
                                        onChangeText={(v) => setQtyInput((prev) => ({ ...prev, [d.id]: v }))}
                                        error={
                                            (Number((qtyInput[d.id] || '0').replace(',', '.')) || 0) > sisa
                                                ? `Melebihi sisa (${sisa})`
                                                : undefined
                                        }
                                    />
                                </View>
                            );
                        })}

                        {items.length > 0 && (
                            <View className="mt-2 p-4 bg-surface border border-transparent rounded-2xl">
                                <Typography variant="caption" className="text-textGray font-bold uppercase text-[10px] mb-2">Pembagian nilai</Typography>
                                {preview.isFetching && <Typography variant="caption" className="text-textGray">Menghitung...</Typography>}
                                {previewError ? (
                                    <Typography className="text-secondary text-xs">{previewError}</Typography>
                                ) : preview.data ? (
                                    <View>
                                        <View className="flex-row justify-between mb-1">
                                            <Typography className="text-textMain text-sm">Total retur</Typography>
                                            <Typography weight="bold" className="text-textMain text-sm">{formatCurrency(preview.data.total_retur)}</Typography>
                                        </View>
                                        <View className="flex-row justify-between mb-1">
                                            <Typography className="text-textGray text-sm">Mengurangi hutang</Typography>
                                            <Typography className="text-textMain text-sm">{formatCurrency(preview.data.nilai_hutang)}</Typography>
                                        </View>
                                        <View className="flex-row justify-between mb-1">
                                            <Typography className="text-textGray text-sm">Dikembalikan supplier ke kas</Typography>
                                            <Typography className="text-textMain text-sm">{formatCurrency(preview.data.nilai_kas)}</Typography>
                                        </View>
                                        <View className="flex-row justify-between">
                                            <Typography className="text-textGray text-sm">Jadi piutang ke supplier</Typography>
                                            <Typography className="text-textMain text-sm">{formatCurrency(preview.data.nilai_piutang)}</Typography>
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        )}

                        {adaSelisih && (
                            <View className="mt-4">
                                <Typography variant="caption" className="text-textGray font-medium mb-2">Selisih setelah hutang dipotong</Typography>
                                <View className="flex-row space-x-2">
                                    {(['KAS', 'PIUTANG'] as const).map((opsi) => (
                                        <Pressable
                                            key={opsi}
                                            onPress={() => setSelisihSebagai(opsi)}
                                            className={`flex-1 px-4 py-3 rounded-xl border ${selisihSebagai === opsi ? 'bg-primary border-primary' : 'bg-surface border-transparent'}`}
                                        >
                                            <Typography weight="bold" className={`${selisihSebagai === opsi ? 'text-white' : 'text-textMain'} text-xs text-center`}>
                                                {opsi === 'KAS' ? 'Langsung ke kas/bank' : 'Jadikan piutang supplier'}
                                            </Typography>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        {nilaiKas > 0 && (
                            <View className="mt-4">
                                <Typography variant="caption" className="text-textGray font-medium mb-2">Metode pengembalian dana</Typography>
                                <View className="flex-row space-x-2">
                                    {METODE_REFUND.map((m) => (
                                        <Pressable
                                            key={m}
                                            onPress={() => setMetodeRefund(m)}
                                            className={`px-4 py-2 rounded-xl border ${metodeRefund === m ? 'bg-primary border-primary' : 'bg-surface border-transparent'}`}
                                        >
                                            <Typography weight="bold" className={metodeRefund === m ? 'text-white text-xs' : 'text-textMain text-xs'}>{m}</Typography>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View className="mt-4">
                            <Input label="Catatan (opsional)" placeholder="Alasan retur" value={catatan} onChangeText={setCatatan} />
                        </View>

                        {error ? <Typography className="text-secondary text-xs mt-3">{error}</Typography> : null}
                    </BoundedSheetScrollView>
                </View>
            </BottomSheetContainer>
        </Modal>
    );
}
