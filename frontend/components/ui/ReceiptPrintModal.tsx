import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, ActivityIndicator } from 'react-native';
import { Printer, Share2, CheckCircle2, XCircle } from 'lucide-react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { usePrintReceipt } from '../../hooks/usePrintReceipt';
import { PrintReceiptData } from '../../utils/printReceipt';

interface ReceiptPrintModalProps {
    visible: boolean;
    onClose: () => void;
    data: PrintReceiptData | null;
    onSuccess?: () => void;
}

export default function ReceiptPrintModal({ visible, onClose, data, onSuccess }: ReceiptPrintModalProps) {
    const { loading, error, success, handlePrint, handleShare, clearMessages } = usePrintReceipt();

    useEffect(() => {
        if (visible) clearMessages();
    }, [visible]);

    const onPrint = async () => {
        if (!data) return;
        await handlePrint(data);
    };

    const onShare = async () => {
        if (!data) return;
        await handleShare(data);
    };

    const handleClose = () => {
        if (success && onSuccess) onSuccess();
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <Pressable className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }} onPress={handleClose}>
                <Pressable className="bg-white rounded-3xl w-[85%] max-w-sm p-6 items-center" onPress={() => {}}>
                    <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mb-4">
                        <Printer size={28} color="#023C69" />
                    </View>

                    <Typography variant="h3" weight="bold" className="text-textMain mb-1">Cetak Struk</Typography>
                    <Typography className="text-gray-400 text-sm text-center mb-6">Pilih aksi untuk struk transaksi ini</Typography>

                    {loading && (
                        <View className="items-center mb-4">
                            <ActivityIndicator size="large" color="#023C69" />
                            <Typography className="text-gray-500 text-xs mt-2">Memproses...</Typography>
                        </View>
                    )}

                    {success && (
                        <View className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4 w-full items-center">
                            <CheckCircle2 size={24} color="#059669" />
                            <Typography className="text-emerald-700 font-bold text-sm mt-2">{success}</Typography>
                        </View>
                    )}

                    {error && (
                        <View className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-4 w-full items-center">
                            <XCircle size={24} color="#EF4444" />
                            <Typography className="text-red-600 font-bold text-sm mt-2">{error}</Typography>
                        </View>
                    )}

                    {!loading && !success && !error && (
                        <View className="w-full space-y-3">
                            <Button title="Cetak Struk" onPress={onPrint} className="w-full" icon={<Printer size={16} color="white" />} />
                            <Button title="Bagikan Struk" variant="outline" onPress={onShare} className="w-full" icon={<Share2 size={16} color="#023C69" />} />
                        </View>
                    )}

                    {(success || error) && (
                        <Pressable onPress={handleClose} className="mt-4 p-2">
                            <Typography className="text-gray-400 text-sm font-bold">{success ? 'Selesai' : 'Tutup'}</Typography>
                        </Pressable>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}
