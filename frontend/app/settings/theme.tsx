import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, RotateCcw, Palette, Paintbrush, Camera, Trash2, Image as ImageIcon } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { router } from 'expo-router';
import { useUIStore, defaultColors } from '../../store/useUIStore';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../../services/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { getFileUrl } from '../../utils/image';
import { Alert, ActivityIndicator, Image } from 'react-native';

export default function ThemeSettingsScreen() {
    const { themeColors, setThemeColor, resetTheme } = useUIStore();
    const { user, setAuth, token } = useAuthStore();
    const [isUploading, setIsUploading] = useState(false);

    const pickBackground = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Izin Ditolak", "Maaf, kami memerlukan izin galeri untuk mengganti latar belakang.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            handleUploadBackground(result.assets[0].uri);
        }
    };

    const handleUploadBackground = async (uri: string) => {
        setIsUploading(true);
        try {
            const updatedUser = await authService.uploadHomeBackground(uri);
            setAuth(updatedUser, token || '');
            Alert.alert("Sukses", "Latar belakang beranda berhasil diperbarui.");
        } catch (error) {
            console.error('Failed to upload background:', error);
            Alert.alert("Gagal Upload", "Terjadi kesalahan saat mengunggah latar belakang.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveBackground = async () => {
        Alert.alert(
            "Hapus Latar Belakang",
            "Anda yakin ingin menghapus latar belakang kustom dan kembali ke default?",
            [
                { text: "Batal", style: "cancel" },
                { 
                    text: "Hapus", 
                    style: "destructive",
                    onPress: async () => {
                        setIsUploading(true);
                        try {
                            const updatedUser = await authService.updateMe({ home_background: null });
                            setAuth(updatedUser, token || '');
                        } catch (error) {
                            console.error('Failed to remove background:', error);
                        } finally {
                            setIsUploading(false);
                        }
                    }
                }
            ]
        );
    };

    const colorOptions = [
        { label: 'Warna Utama (Primary)', key: 'primary', description: 'Warna untuk header dan tombol utama' },
        { label: 'Warna Sekunder (Secondary)', key: 'secondary', description: 'Warna untuk aksen dan highlight' },
        { label: 'Warna Latar (Background)', key: 'background', description: 'Warna latar belakang aplikasi' },
        { label: 'Warna Kartu (Surface)', key: 'surface', description: 'Warna untuk kartu dan elemen di atas latar' },
        { label: 'Warna Teks Utama', key: 'text', description: 'Warna teks konten utama' },
        { label: 'Warna Teks Abu', key: 'textGray', description: 'Warna teks keterangan atau detail' },
    ];

    const presets = [
        '#023C69', '#EE2737', '#10B981', '#F59E0B', '#3B82F6', '#6366F1',
        '#8B5CF6', '#EC4899', '#111827', '#F9F9F9', '#FFFFFF', '#767676'
    ];

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1">
                {/* Header */}
                <View className="flex-row items-center px-6 py-4">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-gray-100 shadow-sm"
                    >
                        <ChevronLeft size={24} color={themeColors.text} />
                    </TouchableOpacity>
                    <View className="flex-1 ml-4">
                        <Typography variant="h3" weight="bold">Tampilan</Typography>
                    </View>
                    <TouchableOpacity
                        onPress={resetTheme}
                        className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-gray-100 shadow-sm"
                    >
                        <RotateCcw size={20} color={themeColors.secondary} />
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
                    <View className="bg-primary/5 p-6 rounded-[32px] mb-8 items-center border border-primary/10">
                        <View className="w-16 h-16 bg-primary rounded-full items-center justify-center mb-4 shadow-lg">
                            <Paintbrush size={32} color="white" />
                        </View>
                        <Typography variant="h4" weight="bold" className="text-primary text-center">Kustomisasi Tema</Typography>
                        <Typography variant="caption" className="text-primary/60 text-center mt-1">Ubah palet warna aplikasi sesuai keinginan Anda</Typography>
                    </View>

                    <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[2px] ml-4 mb-4">Warna UI</Typography>

                    {colorOptions.map((option) => (
                        <View key={option.key} className="bg-surface p-5 rounded-[32px] mb-4 border border-gray-100 shadow-sm">
                            <View className="flex-row items-center justify-between mb-4">
                                <View className="flex-1 mr-4">
                                    <Typography weight="bold" className="text-[15px]">{option.label}</Typography>
                                    <Typography variant="caption" className="text-text/40">{option.description}</Typography>
                                </View>
                                <View
                                    style={{ backgroundColor: (themeColors as any)[option.key] }}
                                    className="w-12 h-12 rounded-2xl border border-gray-100 shadow-inner"
                                />
                            </View>

                            {/* Presets */}
                            <View className="flex-row flex-wrap gap-3 mb-5">
                                {presets.map((color) => (
                                    <TouchableOpacity
                                        key={color}
                                        onPress={() => setThemeColor(option.key as any, color)}
                                        className="w-8 h-8 rounded-full border border-gray-100 shadow-sm"
                                        style={{
                                            backgroundColor: color,
                                            borderWidth: (themeColors as any)[option.key] === color ? 2 : 1,
                                            borderColor: (themeColors as any)[option.key] === color ? themeColors.primary : '#E5E7EB'
                                        }}
                                    />
                                ))}
                            </View>

                            {/* Hex Input */}
                            <View className="flex-row items-center bg-background rounded-2xl px-4 py-3 border border-gray-50">
                                <Typography className="text-text/30 mr-2 font-bold">#</Typography>
                                <TextInput
                                    className="flex-1 text-text font-outfit-medium"
                                    value={(themeColors as any)[option.key].replace('#', '')}
                                    onChangeText={(text) => {
                                        // Allow only hex characters
                                        const cleanHex = text.replace(/[^0-9A-Fa-f]/g, '');
                                        if (cleanHex.length <= 6) {
                                            setThemeColor(option.key as any, `#${cleanHex}`);
                                        }
                                    }}
                                    maxLength={6}
                                    placeholder="HEX"
                                    placeholderTextColor="#9CA3AF"
                                />
                                <Palette size={18} color={themeColors.textGray} opacity={0.5} />
                            </View>
                        </View>
                    ))}

                    <View className="mt-4 p-6 bg-secondary/5 rounded-[32px] border border-secondary/10 mb-10">
                        <Typography variant="caption" className="text-secondary/60 text-center">
                            Perubahan akan langsung diterapkan ke seluruh halaman aplikasi.
                        </Typography>
                    </View>

                    <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[2px] ml-4 mb-4">Latar Belakang Beranda</Typography>
                    
                    <View className="bg-surface p-5 rounded-[32px] mb-8 border border-gray-100 shadow-sm overflow-hidden">
                        <View className="w-full h-40 bg-gray-100 rounded-2xl mb-4 overflow-hidden items-center justify-center relative">
                            {user?.home_background ? (
                                <Image 
                                    source={{ uri: getFileUrl(user.home_background) as string }} 
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="items-center">
                                    <ImageIcon size={40} color="#9CA3AF" />
                                    <Typography variant="caption" className="text-text/30 mt-2">Default Gradient</Typography>
                                </View>
                            )}
                            
                            {isUploading && (
                                <View className="absolute inset-0 bg-black/20 items-center justify-center">
                                    <ActivityIndicator color="white" />
                                </View>
                            )}
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={pickBackground}
                                disabled={isUploading}
                                className="flex-1 bg-primary h-12 rounded-2xl flex-row items-center justify-center"
                            >
                                <Camera size={18} color="white" />
                                <Typography weight="bold" className="text-white ml-2">Pilih Gambar</Typography>
                            </TouchableOpacity>

                            {user?.home_background && (
                                <TouchableOpacity
                                    onPress={handleRemoveBackground}
                                    disabled={isUploading}
                                    className="w-12 h-12 bg-rose-50 rounded-2xl items-center justify-center border border-rose-100"
                                >
                                    <Trash2 size={18} color="#EF4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                        <Typography variant="caption" className="text-text/30 mt-4 px-2 text-center">
                            Gunakan gambar dengan orientasi lanskap (16:9) untuk hasil terbaik di halaman beranda.
                        </Typography>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
