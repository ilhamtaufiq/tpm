import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Typography } from './Typography';
import { Input } from './Input';
import { Button } from './Button';

export const MIN_ALASAN_BATAL = 5;

interface AlasanBatalDialogProps {
    visible: boolean;
    title: string;
    message: string;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (alasan: string) => void;
}

// Dialog pembatalan transaksi bengkel: alasan wajib diisi (minimal 5 karakter).
export const AlasanBatalDialog = ({ visible, title, message, loading = false, onClose, onSubmit }: AlasanBatalDialogProps) => {
    const [alasan, setAlasan] = useState('');

    useEffect(() => {
        if (visible) setAlasan('');
    }, [visible]);

    const valid = alasan.trim().length >= MIN_ALASAN_BATAL;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/40 items-center justify-center px-6" onPress={onClose}>
                <Pressable className="w-full max-w-md bg-surface rounded-3xl p-5 gap-3" onPress={() => undefined}>
                    <Typography weight="bold" className="text-textMain text-base">{title}</Typography>
                    <Typography className="text-textGray text-sm">{message}</Typography>
                    <Input
                        label="Alasan pembatalan (wajib)"
                        value={alasan}
                        onChangeText={setAlasan}
                        placeholder="Contoh: salah input jenis part"
                        maxLength={255}
                        multiline
                    />
                    {alasan.length > 0 && !valid && (
                        <Typography className="text-rose-600 text-xs">Alasan minimal {MIN_ALASAN_BATAL} karakter.</Typography>
                    )}
                    <View className="flex-row gap-2">
                        <Button title="Kembali" variant="outline" className="flex-1" onPress={onClose} />
                        <Button
                            title="Batalkan Transaksi"
                            variant="danger"
                            className="flex-1"
                            disabled={!valid || loading}
                            loading={loading}
                            onPress={() => onSubmit(alasan.trim())}
                        />
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};
