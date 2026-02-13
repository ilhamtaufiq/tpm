import React, { useState } from 'react';
import { View, ScrollView, TextInput, ActivityIndicator, Alert, Platform, StyleSheet, KeyboardAvoidingView, TouchableOpacity } from 'react-native';
// import { TouchableOpacity } from '@gorhom/bottom-sheet'; // Removed due to web compatibility issues
import { Typography } from './ui/Typography';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { AlertDialog } from './ui/AlertDialog';
import { getErrorMessage } from '../utils/error';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useAddBiaya, useDeleteBiaya, useMobilDetail } from '../hooks/useMobil';

// Import Icons properly
import {
    Receipt,
    Wrench,
    Trash2,
    Calendar,
    FileText,
    PlusCircle
} from 'lucide-react-native';
interface MobilCostFormProps {
    unit: any;
    onSuccess?: () => void;
}

export const MobilCostForm = ({ unit, onSuccess }: MobilCostFormProps) => {
    const { data: detailUnit, isLoading: isDetailLoading } = useMobilDetail(unit?.id);

    const activeUnit = detailUnit || unit;

    // Mutations
    const addBiayaMutation = useAddBiaya();
    const deleteBiayaMutation = useDeleteBiaya();


    // Form States
    const [newLainnya, setNewLainnya] = useState({ kategori: '', deskripsi: '', jumlah: '' });



    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type: 'alert' | 'confirm';
        loading?: boolean;
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert',
        loading: false
    });



    const handleAddBiaya = () => {
        const jumlahNum = parseNumber(newLainnya.jumlah);
        if (isNaN(jumlahNum) || jumlahNum <= 0) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Mohon isi jumlah biaya yang valid', variant: 'warning', type: 'alert' });
            return;
        }

        addBiayaMutation.mutate({
            id: unit.id,
            data: {
                kategori: newLainnya.kategori || 'Admin',
                deskripsi: newLainnya.deskripsi || newLainnya.kategori || 'Biaya Admin & Pajak',
                jumlah: jumlahNum,
                tanggal: new Date().toISOString().split('T')[0],
            }
        }, {
            onSuccess: () => {
                setNewLainnya({ kategori: '', deskripsi: '', jumlah: '' });
                setDialogConfig({
                    visible: true,
                    title: 'Sukses',
                    message: 'Biaya berhasil ditambahkan',
                    variant: 'success',
                    type: 'alert'
                });
            },
            onError: (err: any) => {
                setDialogConfig({
                    visible: true,
                    title: 'Gagal',
                    message: getErrorMessage(err, 'Gagal menambahkan biaya'),
                    variant: 'error',
                    type: 'alert'
                });
            }
        });
    };

    const handleDeleteBiaya = (biayaId: number) => {
        setDialogConfig({
            visible: true,
            title: 'Hapus Biaya',
            message: 'Yakin menghapus biaya ini?',
            variant: 'error',
            type: 'confirm',
            loading: false,
            onConfirm: () => {
                setDialogConfig(prev => ({ ...prev, loading: true }));
                deleteBiayaMutation.mutate({ id: activeUnit.id, biayaId }, {
                    onSuccess: () => {
                        setDialogConfig({ visible: true, title: 'Sukses', message: 'Biaya berhasil dihapus', variant: 'success', type: 'alert', loading: false });
                    },
                    onError: (err: any) => {
                        setDialogConfig({ visible: true, title: 'Gagal', message: getErrorMessage(err, 'Gagal menghapus biaya'), variant: 'error', type: 'alert', loading: false });
                    }
                });
            }
        });
    };




    const calculateTotal = () => {
        const totalLainnya = (activeUnit?.biaya_lainnya || []).reduce((acc: number, curr: any) => acc + (Number(curr.jumlah) || 0), 0);
        const totalPerbaikan = (activeUnit?.part_services || []).reduce((acc: number, curr: any) => acc + (Number(curr.total) || 0), 0);
        return totalLainnya + totalPerbaikan;
    };

    const renderTabs = () => (
        <View className="px-6 pt-4 mb-4">
            <Typography variant="h3" weight="bold">Manajemen Biaya Unit</Typography>
            <Typography variant="caption" className="text-gray-400">{activeUnit?.merek} {activeUnit?.model} ({activeUnit?.nomor_plat})</Typography>

            <View className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <Typography variant="caption" className="text-orange-800 leading-relaxed">
                    Catatan: Biaya perbaikan unit sekarang diinput melalui menu **Bengkel** dengan kategori **Jual Beli Mobil**.
                </Typography>
            </View>
        </View>
    );

    const renderFormContent = () => (
        <View className="px-6 pb-4">
            <Card className="bg-white border border-gray-100 p-6 rounded-[32px] shadow-sm mb-8">
                <View className="flex-row items-center mb-6">
                    <View className="w-8 h-8 bg-primary/10 rounded-full items-center justify-center mr-3">
                        <Receipt size={16} color="#023C69" />
                    </View>
                    <Typography variant="body1" weight="bold" className="text-primary uppercase tracking-wider">Pencatatan Biaya</Typography>
                </View>

                <View className="flex-row space-x-4 mb-4">
                    <View className="flex-1">
                        <Input
                            label="Kategori"
                            placeholder="Pajak / BBN / ADM"
                            value={newLainnya.kategori}
                            onChangeText={(val) => setNewLainnya({ ...newLainnya, kategori: val })}
                            className="font-bold text-primary"
                        />
                    </View>
                    <View className="flex-1">
                        <Input
                            label="Jumlah (Rp)"
                            placeholder="0"
                            keyboardType="numeric"
                            value={newLainnya.jumlah}
                            onChangeText={(val) => setNewLainnya({ ...newLainnya, jumlah: formatNumber(val) })}
                            className="font-bold text-primary"
                        />
                    </View>
                </View>

                <Input
                    label="Keterangan / Deskripsi"
                    placeholder="Contoh: Perpanjang STNK s/d 2025"
                    containerClassName="mb-6"
                    value={newLainnya.deskripsi}
                    onChangeText={(val) => setNewLainnya({ ...newLainnya, deskripsi: val })}
                />

                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleAddBiaya}
                    disabled={addBiayaMutation.isPending}
                    className={`bg-primary flex-row items-center justify-center py-4 rounded-[20px] shadow-lg shadow-primary/20 ${addBiayaMutation.isPending ? 'opacity-70' : ''}`}
                >
                    {addBiayaMutation.isPending ? (
                        <ActivityIndicator color="white" size="small" />
                    ) : (
                        <>
                            <PlusCircle size={18} color="white" />
                            <Typography weight="bold" className="text-white ml-2 text-lg">Tambah Biaya</Typography>
                        </>
                    )}
                </TouchableOpacity>
            </Card>

            <View className="mb-4">
                <Typography variant="caption" weight="bold" className="text-gray-400 uppercase tracking-widest pl-2 mb-4">RIWAYAT BIAYA ADMIN & PAJAK</Typography>
                {(activeUnit?.biaya_lainnya || []).length === 0 && (
                    <View className="py-8 items-center bg-gray-50/50 rounded-[28px] border border-dashed border-gray-200">
                        <Typography className="text-gray-400 italic">Belum ada catatan biaya</Typography>
                    </View>
                )}
                {(activeUnit?.biaya_lainnya || []).map((item: any) => (
                    <Card key={item.id} className="mb-4 p-4 flex-row items-center bg-white border border-gray-50 rounded-[24px]">
                        <View className="w-12 h-12 bg-blue-50/50 rounded-2xl items-center justify-center mr-4">
                            <FileText size={20} color="#023C69" />
                        </View>
                        <View className="flex-1">
                            <Typography weight="bold" className="text-textMain">{item.kategori}</Typography>
                            <Typography variant="caption" className="text-gray-400 mt-0.5">{item.deskripsi || '-'}</Typography>
                        </View>
                        <View className="items-end mr-4">
                            <Typography weight="bold" className="text-primary">{formatCurrency(Number(item.jumlah))}</Typography>
                            <Typography variant="caption" className="text-gray-300 mt-1">{item.tanggal}</Typography>
                        </View>
                        <TouchableOpacity
                            onPress={() => handleDeleteBiaya(item.id)}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            className="w-10 h-10 bg-red-50 rounded-xl items-center justify-center"
                        >
                            <Trash2 size={18} color="#EE2737" />
                        </TouchableOpacity>
                    </Card>
                ))}
            </View>

            {/* Show readonly repairs from workshop if any */}
            {(activeUnit?.part_services || []).length > 0 && (
                <View className="mt-6">
                    <Typography variant="body2" weight="bold" className="text-gray-400 mb-3 uppercase">Daftar Perbaikan (Read Only)</Typography>
                    {(activeUnit?.part_services || []).map((item: any) => (
                        <Card key={item.id} className="mb-3 p-3 flex-row items-center border border-gray-100 opacity-60 bg-gray-50">
                            <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3">
                                <Wrench size={18} color="#9CA3AF" />
                            </View>
                            <View className="flex-1">
                                <Typography weight="bold" className="text-xs text-gray-500">{item.deskripsi}</Typography>
                                <Typography variant="caption" className="text-gray-400">{item.qty} x {formatCurrency(Number(item.harga_satuan))}</Typography>
                            </View>
                            <Typography weight="bold" className="text-xs text-gray-400">{formatCurrency(Number(item.total))}</Typography>
                        </Card>
                    ))}
                </View>
            )}

            {isDetailLoading && <ActivityIndicator color="#023C69" className="my-4" />}
        </View>
    );

    const renderFooter = () => (
        <View className="p-6 border-t border-gray-100 bg-white">
            <View className="flex-row justify-between items-center mb-4">
                <Typography variant="body1" weight="bold">Total Tambahan Biaya</Typography>
                <Typography variant="h3" weight="bold" className="text-primary">{formatCurrency(calculateTotal())}</Typography>
            </View>
            <Button title="Selesai" variant="primary" size="lg" onPress={() => onSuccess?.()} />
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <View style={styles.webContainer}>
                {renderTabs()}
                <ScrollView style={styles.flex1} showsVerticalScrollIndicator={true}>
                    {renderFormContent()}
                </ScrollView>
                {renderFooter()}

                <AlertDialog
                    visible={dialogConfig.visible}
                    title={dialogConfig.title}
                    message={dialogConfig.message}
                    variant={dialogConfig.variant}
                    type={dialogConfig.type}
                    loading={dialogConfig.loading}
                    onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                    onConfirm={dialogConfig.onConfirm}
                />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flex1}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.mobileContainer}>
                {renderTabs()}
                <BottomSheetScrollView
                    style={styles.flex1}
                    showsVerticalScrollIndicator={true}
                    bounces={true}
                >
                    {renderFormContent()}
                </BottomSheetScrollView>
                {renderFooter()}
            </View>

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                loading={dialogConfig.loading}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
                onConfirm={dialogConfig.onConfirm}
            />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    flex1: {
        flex: 1,
    },
    webContainer: {
        flex: 1,
        backgroundColor: 'white',
        height: '85vh' as any,
    },
    mobileContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
});
