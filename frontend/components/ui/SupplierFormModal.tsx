import React, { useEffect, useState } from 'react';
import { View, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from './Typography';
import { Input } from './Input';
import { Button } from './Button';
import { CenterModalContainer } from './BottomSheetContainer';
import { useCreateSupplier } from '../../hooks/useMasterData';
import { Supplier } from '../../services/masterData';
import { getErrorMessage } from '../../utils/error';

interface SupplierFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (supplier: Supplier) => void;
    initialName?: string;
}

/**
 * Quick-add supplier (nama wajib, telepon & alamat opsional).
 * Dipakai dari MasterDataSelector saat supplier baru belum ada di daftar,
 * supaya user tidak perlu pindah ke Master Data.
 */
export function SupplierFormModal({ visible, onClose, onSuccess, initialName = '' }: SupplierFormModalProps) {
    const insets = useSafeAreaInsets();
    const createMutation = useCreateSupplier();

    const [nama, setNama] = useState(initialName);
    const [telepon, setTelepon] = useState('');
    const [alamat, setAlamat] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (visible) {
            setNama(initialName);
            setTelepon('');
            setAlamat('');
            setError('');
        }
    }, [visible, initialName]);

    const handleSave = async () => {
        const trimmedNama = nama.trim();
        if (trimmedNama.length < 2) {
            setError('Nama supplier minimal 2 karakter.');
            return;
        }
        try {
            const created = await createMutation.mutateAsync({
                nama: trimmedNama,
                telepon: telepon.trim() || undefined,
                alamat: alamat.trim() || undefined,
            });
            onSuccess(created);
        } catch (err) {
            setError(getErrorMessage(err, 'Gagal menyimpan supplier'));
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <CenterModalContainer onClose={onClose} insets={insets}>
                <View className="p-5">
                    <Typography variant="h3" weight="bold" className="text-textMain mb-4">Supplier Baru</Typography>

                    <Input
                        label="Nama Supplier"
                        placeholder="Contoh: Toko Sumber Jaya"
                        value={nama}
                        onChangeText={(val) => { setNama(val); if (error) setError(''); }}
                        error={error || undefined}
                        containerClassName="mb-3"
                    />
                    <Input
                        label="Telepon (Opsional)"
                        placeholder="08xxxxxxxxxx"
                        value={telepon}
                        onChangeText={setTelepon}
                        keyboardType="phone-pad"
                        containerClassName="mb-3"
                    />
                    <Input
                        label="Alamat (Opsional)"
                        placeholder="Alamat supplier"
                        value={alamat}
                        onChangeText={setAlamat}
                        containerClassName="mb-5"
                    />

                    <View className="flex-row space-x-3">
                        <Button title="Batal" variant="outline" className="flex-1" onPress={onClose} />
                        <Button
                            title={createMutation.isPending ? 'Menyimpan...' : 'Simpan Supplier'}
                            className="flex-1"
                            onPress={handleSave}
                            disabled={createMutation.isPending}
                        />
                    </View>
                </View>
            </CenterModalContainer>
        </Modal>
    );
}
