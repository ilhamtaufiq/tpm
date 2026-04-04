import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, TextInput, Modal, Platform, ActivityIndicator } from 'react-native';
import { Typography } from './Typography';
import { Button } from './Button';
import { Card } from './Card';
import { Badge } from './Badge';
import { X, Plus, Trash2, Truck, User, Building2 } from 'lucide-react-native';
import { masterDataService, Customer } from '../../services/masterData';
import { useCreateCustomer } from '../../hooks/useMasterData';
import { getErrorMessage } from '../../utils/error';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomerFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (customer: Customer) => void;
    initialName?: string;
}

export const CustomerFormModal = ({
    visible,
    onClose,
    onSuccess,
    initialName = ''
}: CustomerFormModalProps) => {
    const insets = useSafeAreaInsets();
    const createMutation = useCreateCustomer();

    const [formData, setFormData] = useState<{
        nama: string;
        tipe: string;
        alamat: string;
        kota: string;
        telepon: string;
        email: string;
        vehicles: { plat_nomor: string; jenis_unit: string; catatan?: string }[];
    }>({
        nama: initialName,
        tipe: 'perorangan',
        alamat: '',
        kota: '',
        telepon: '',
        email: '',
        vehicles: [],
    });

    useEffect(() => {
        if (visible && initialName) {
            setFormData(prev => ({ ...prev, nama: initialName }));
        }
    }, [visible, initialName]);

    const handleSubmit = async () => {
        if (!formData.nama) {
            // Should show an error toast here if available
            return;
        }

        try {
            const customer = await createMutation.mutateAsync(formData);
            onSuccess(customer);
            onClose();
        } catch (error) {
            console.error('Failed to create customer:', error);
            // Error handled by mutation or global alert
        }
    };

    const addVehicle = () => {
        setFormData({
            ...formData,
            vehicles: [...formData.vehicles, { plat_nomor: '', jenis_unit: '', catatan: '' }]
        });
    };

    const removeVehicle = (index: number) => {
        const newVehicles = [...formData.vehicles];
        newVehicles.splice(index, 1);
        setFormData({ ...formData, vehicles: newVehicles });
    };

    const updateVehicle = (index: number, field: string, value: string) => {
        const newVehicles = [...formData.vehicles];
        newVehicles[index] = { ...newVehicles[index], [field]: value };
        setFormData({ ...formData, vehicles: newVehicles });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <Pressable
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    onPress={onClose}
                />
                <View
                    className="bg-white rounded-t-[32px] h-[90%]"
                    style={{
                        width: '100%',
                        maxWidth: 640,
                        alignSelf: 'center',
                        paddingBottom: insets.bottom + 20
                    }}
                >
                    <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center my-4" />
                    
                    <View className="flex-row justify-between items-center px-6 mb-6">
                        <Typography variant="h2" weight="bold">Tambah Customer</Typography>
                        <Pressable onPress={onClose} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                            <X size={20} color="#6B7280" />
                        </Pressable>
                    </View>

                    <ScrollView className="flex-1 px-6">
                        <View className="space-y-4">
                            <View>
                                <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Customer *</Typography>
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                                    placeholder="Contoh: Budi Santoso"
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.nama}
                                    onChangeText={(text) => setFormData({ ...formData, nama: text })}
                                />
                            </View>

                            <View>
                                <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Tipe Entitas</Typography>
                                <View className="flex-row space-x-2">
                                    {['perorangan', 'perusahaan'].map((tipe) => (
                                        <Pressable
                                            key={tipe}
                                            onPress={() => setFormData({ ...formData, tipe })}
                                            className={`flex-1 py-3.5 rounded-2xl border ${formData.tipe === tipe ? 'bg-primary border-primary' : 'bg-white border-gray-100'}`}
                                        >
                                            <Typography
                                                className={`text-center font-bold text-sm ${formData.tipe === tipe ? 'text-white' : 'text-gray-500'}`}
                                            >
                                                {tipe === 'perusahaan' ? 'Perusahaan' : 'Perorangan'}
                                            </Typography>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View className="flex-row space-x-4">
                                <View className="flex-1">
                                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Telepon</Typography>
                                    <TextInput
                                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                                        placeholder="08xxxxxxxxxx"
                                        placeholderTextColor="#9CA3AF"
                                        value={formData.telepon}
                                        onChangeText={(text) => setFormData({ ...formData, telepon: text })}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Kota</Typography>
                                    <TextInput
                                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5"
                                        placeholder="Jakarta"
                                        placeholderTextColor="#9CA3AF"
                                        value={formData.kota}
                                        onChangeText={(text) => setFormData({ ...formData, kota: text })}
                                    />
                                </View>
                            </View>

                            <View>
                                <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Alamat Lengkap</Typography>
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary focus:bg-primary/5 min-h-[80px]"
                                    placeholder="Masukan alamat lengkap..."
                                    placeholderTextColor="#9CA3AF"
                                    value={formData.alamat}
                                    onChangeText={(text) => setFormData({ ...formData, alamat: text })}
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>

                            {/* Vehicle Management Section */}
                            <View className="pt-4 border-t border-gray-100">
                                <View className="flex-row justify-between items-center mb-4">
                                    <Typography weight="bold" className="text-base">Data Kendaraan</Typography>
                                    <Pressable
                                        onPress={addVehicle}
                                        className="flex-row items-center px-3 py-2 rounded-xl bg-blue-50"
                                    >
                                        <Plus size={16} color="#3B82F6" />
                                        <Typography className="font-bold text-xs ml-1 text-blue-600">Tambah</Typography>
                                    </Pressable>
                                </View>

                                {formData.vehicles.map((vehicle, index) => (
                                    <View key={index} className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
                                        <View className="flex-row justify-between items-center mb-3">
                                            <Typography className="text-[10px] font-bold text-gray-400 uppercase">Kendaraan #{index + 1}</Typography>
                                            <Pressable onPress={() => removeVehicle(index)}>
                                                <X size={16} color="#EF4444" />
                                            </Pressable>
                                        </View>
                                        <View className="space-y-3">
                                            <View>
                                                <TextInput
                                                    className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-textMain font-medium focus:border-primary"
                                                    placeholder="Plat Nomor (B 1234 ABC)"
                                                    placeholderTextColor="#9CA3AF"
                                                    value={vehicle.plat_nomor}
                                                    onChangeText={(text) => updateVehicle(index, 'plat_nomor', text)}
                                                    autoCapitalize="characters"
                                                />
                                            </View>
                                            <View>
                                                <TextInput
                                                    className="bg-white border border-gray-100 rounded-xl px-3 py-2 text-textMain font-medium focus:border-primary"
                                                    placeholder="Jenis Unit (Avanza, Xenia, dsb)"
                                                    placeholderTextColor="#9CA3AF"
                                                    value={vehicle.jenis_unit}
                                                    onChangeText={(text) => updateVehicle(index, 'jenis_unit', text)}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    <View className="px-6 pt-4">
                        <Button
                            title={createMutation.isPending ? 'Menambahkan...' : 'Simpan Customer Baru'}
                            onPress={handleSubmit}
                            disabled={createMutation.isPending || !formData.nama}
                            loading={createMutation.isPending}
                            className="shadow-lg"
                            size="lg"
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};
