import React, { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';
import { BatalkanKasModal } from './BatalkanKasModal';
import { useBatalkanBaris } from '../../hooks/usePembatalan';
import { formatCurrency } from '../../utils/format';
import { getErrorMessage } from '../../utils/error';

interface BatalkanBarisButtonProps {
    item: any;
}

// Tombol kecil di baris riwayat dompet unit. Pembatalan lewat modal alasan, tanpa hapus.
export const BatalkanBarisButton = ({ item }: BatalkanBarisButtonProps) => {
    const [open, setOpen] = useState(false);
    const mutation = useBatalkanBaris();

    const handleConfirm = async (alasan: string) => {
        try {
            await mutation.mutateAsync({ item, alasan });
            setOpen(false);
            Alert.alert('Dibatalkan', 'Transaksi dibatalkan. Jurnal dibalik dan tercatat di Riwayat Pembatalan.');
        } catch (error) {
            setOpen(false);
            Alert.alert('Gagal Membatalkan', getErrorMessage(error, 'Transaksi tidak bisa dibatalkan'));
        }
    };

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                className="mt-2 px-3 py-1 rounded-xl border border-rose-200 self-end"
            >
                <Typography weight="bold" className="text-rose-600 text-[10px] uppercase tracking-widest">Batalkan</Typography>
            </Pressable>
            <BatalkanKasModal
                visible={open}
                judul="Batalkan Transaksi"
                ringkasan={`${item.keterangan || item.sumber} • ${formatCurrency(Number(item.nominal))}`}
                loading={mutation.isPending}
                onClose={() => setOpen(false)}
                onConfirm={handleConfirm}
            />
        </>
    );
};
