import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const ALASAN_BATAL_MIN_LEN = 5;

interface BatalkanKasModalProps {
    visible: boolean;
    judul: string;
    ringkasan?: string;
    loading?: boolean;
    onClose: () => void;
    onConfirm: (alasan: string) => void;
}

// Pembatalan tidak menghapus data: alasan wajib dan tercatat di Riwayat Pembatalan.
export const BatalkanKasModal = ({ visible, judul, ringkasan, loading = false, onClose, onConfirm }: BatalkanKasModalProps) => {
    const [alasan, setAlasan] = useState('');

    useEffect(() => {
        if (!visible) setAlasan('');
    }, [visible]);

    const bersih = alasan.trim();
    const valid = bersih.length >= ALASAN_BATAL_MIN_LEN;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/40 justify-center px-6">
                <View className="bg-surface rounded-[28px] p-6">
                    <Typography variant="h3" weight="bold" className="text-textMain mb-2">{judul}</Typography>
                    {ringkasan ? <Typography className="text-textGray text-sm mb-3">{ringkasan}</Typography> : null}
                    <Typography className="text-textGray text-xs mb-4">
                        Transaksi tidak dihapus. Jurnal dibalik dan tercatat di Riwayat Pembatalan.
                    </Typography>
                    <Input
                        label="Alasan pembatalan"
                        value={alasan}
                        onChangeText={setAlasan}
                        placeholder="Contoh: salah input nominal"
                        multiline
                        editable={!loading}
                    />
                    {alasan.length > 0 && !valid ? (
                        <Typography className="text-rose-600 text-xs mt-2">
                            Alasan minimal {ALASAN_BATAL_MIN_LEN} karakter
                        </Typography>
                    ) : null}
                    <View className="flex-row mt-6">
                        <View className="flex-1 mr-3">
                            <Button title="Tutup" variant="outline" onPress={onClose} disabled={loading} />
                        </View>
                        <View className="flex-1">
                            <Button
                                title="Batalkan"
                                variant="danger"
                                onPress={() => onConfirm(bersih)}
                                disabled={!valid}
                                loading={loading}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
