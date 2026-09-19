import React, { useState } from 'react';
import { View, ScrollView, Pressable, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCustomTabBarBottomPadding } from '../../components/ui/CustomTabBar';
import { RotateCcw, Paintbrush, Camera, Trash2, Image as ImageIcon, Check, Sun, Moon, Pencil, X } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { Header } from '../../components/ui/Header';
import { router } from 'expo-router';
import { useUIStore, colorPalettes, findPaletteId, ColorPalette, ThemeColors } from '../../store/useUIStore';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../../services/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { getFileUrl } from '../../utils/image';
import { ActivityIndicator, Image } from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';

/** Palet gelap/terang ditentukan dari luminance latarnya, untuk memilih ikon. */
const isDarkPalette = (palette: ColorPalette) => {
    const hex = palette.colors.background.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

const PRESET_SWATCHES = [
    '#023C69', '#EE2737', '#F9F9F9', '#FFFFFF', '#1C1C1C', '#767676',
    '#0369A1', '#06B6D4', '#047857', '#F59E0B', '#4338CA', '#EC4899',
    '#6D28D9', '#C2410C', '#BE123C', '#334155', '#1E1B4B', '#18181B',
    '#0F172A', '#121212', '#E5E7EB', '#64748B', '#A1A1AA', '#38BDF8',
];

export default function ThemeSettingsScreen() {
    const { themeColors, setPalette, setThemeColor, resetTheme } = useUIStore();
    const { user, setAuth, token } = useAuthStore();
    const insets = useSafeAreaInsets();
    const [isUploading, setIsUploading] = useState(false);

    // Custom color edit state
    const [editingColorKey, setEditingColorKey] = useState<keyof ThemeColors | null>(null);
    const [hexInput, setHexInput] = useState('');

    const activePaletteId = findPaletteId(themeColors);
    const isDefault = activePaletteId === 'tpm';
    const activePaletteName = colorPalettes.find((p) => p.id === activePaletteId)?.name;

    const handleOpenColorEditor = (key: keyof ThemeColors) => {
        setEditingColorKey(key);
        setHexInput(themeColors[key] || '#000000');
    };

    const handleSaveCustomColor = () => {
        if (!editingColorKey) return;
        let cleanHex = hexInput.trim();
        if (!cleanHex.startsWith('#')) {
            cleanHex = `#${cleanHex}`;
        }
        if (!/^#([A-Fa-f0-9]{6})$/.test(cleanHex)) {
            appAlert("Format Warna Salah", "Masukkan kode warna hex valid 6 digit (contoh: #023C69).");
            return;
        }
        setThemeColor(editingColorKey, cleanHex.toUpperCase());
        setEditingColorKey(null);
    };

    const pickBackground = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            appAlert("Izin Ditolak", "Maaf, kami memerlukan izin galeri untuk mengganti latar belakang.");
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
            appAlert("Sukses", "Latar belakang beranda berhasil diperbarui.");
        } catch (error) {
            console.error('Failed to upload background:', error);
            appAlert("Gagal Upload", "Terjadi kesalahan saat mengunggah latar belakang.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveBackground = () => {
        appConfirm(
            "Hapus Latar Belakang",
            "Anda yakin ingin menghapus latar belakang kustom dan kembali ke default?",
            async () => {
                setIsUploading(true);
                try {
                    const updatedUser = await authService.updateMe({ home_background: null });
                    setAuth(updatedUser, token || '');
                } catch (error) {
                    console.error('Failed to remove background:', error);
                } finally {
                    setIsUploading(false);
                }
            },
            { confirmText: 'Hapus', variant: 'warning' }
        );
    };

    const handleResetTheme = () => {
        if (isDefault) {
            appAlert("Sudah Default", "Tema saat ini sudah memakai palet TPM Default.");
            return;
        }
        appConfirm(
            "Reset ke Default",
            "Semua warna akan dikembalikan ke palet TPM Default. Lanjutkan?",
            () => {
                resetTheme();
                appAlert("Berhasil", "Tema dikembalikan ke TPM Default.");
            },
            { confirmText: 'Reset', variant: 'warning' }
        );
    };

    return (
        <View className="flex-1 bg-background">
            <View className="flex-1">
                <Header
                    title="Tampilan"
                    subtitle={activePaletteName ? `Palet: ${activePaletteName}` : 'Palet: Kustom'}
                    showBackButton
                    onBackButtonPress={() => router.back()}
                    showProfile={false}
                    showBell={false}
                    rightElement={
                        <Pressable
                            onPress={handleResetTheme}
                            disabled={isDefault}
                            className={`w-10 h-10 items-center justify-center rounded-2xl border border-border shadow-sm ${isDefault ? 'bg-background opacity-40' : 'bg-surface'}`}
                        >
                            <RotateCcw size={20} color={isDefault ? themeColors.textGray : themeColors.secondary} />
                        </Pressable>
                    }
                />

                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{
                        paddingHorizontal: 24,
                        paddingTop: 16,
                        paddingBottom: getCustomTabBarBottomPadding(insets.bottom, 40),
                    }}
                    showsVerticalScrollIndicator={false}
                >
                    <View className="bg-surface p-6 rounded-[32px] mb-8 items-center border border-border shadow-sm">
                        <View className="w-16 h-16 bg-primary rounded-full items-center justify-center mb-4 shadow-lg">
                            <Paintbrush size={32} color="white" />
                        </View>
                        <Typography variant="h4" weight="bold" className="text-text text-center">Kustomisasi Tema</Typography>
                        <Typography variant="caption" className="text-textGray text-center mt-1">
                            Pilih palet warna atau sesuaikan warna individual — seluruh aplikasi langsung menyesuaikan
                        </Typography>
                    </View>

                    <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-[2px] ml-4 mb-4">
                        Palet Warna Preset
                    </Typography>

                    <View className="flex-row flex-wrap justify-between">
                        {colorPalettes.map((palette) => {
                            const selected = palette.id === activePaletteId;
                            const dark = isDarkPalette(palette);
                            return (
                                <Pressable
                                    key={palette.id}
                                    onPress={() => setPalette(palette)}
                                    className="w-[48%] mb-4 rounded-[28px] overflow-hidden border shadow-sm"
                                    style={{
                                        borderColor: selected ? palette.colors.primary : '#E5E7EB',
                                        borderWidth: selected ? 2 : 1,
                                        backgroundColor: palette.colors.surface,
                                    }}
                                >
                                    {/* Pratinjau mini: latar + kartu + baris teks + aksen */}
                                    <View
                                        style={{ backgroundColor: palette.colors.background }}
                                        className="h-20 justify-center px-3"
                                    >
                                        <View style={{ backgroundColor: palette.colors.surface }} className="rounded-xl p-2">
                                            <View
                                                style={{ backgroundColor: palette.colors.text, width: '62%' }}
                                                className="h-1.5 rounded-full opacity-80"
                                            />
                                            <View
                                                style={{ backgroundColor: palette.colors.textGray, width: '42%' }}
                                                className="h-1.5 rounded-full mt-1.5 opacity-60"
                                            />
                                        </View>
                                        <View className="flex-row mt-2 gap-1.5">
                                            <View style={{ backgroundColor: palette.colors.primary }} className="flex-1 h-4 rounded-lg" />
                                            <View style={{ backgroundColor: palette.colors.secondary }} className="w-8 h-4 rounded-lg" />
                                        </View>
                                    </View>

                                    <View className="flex-row items-center justify-between px-3 py-2.5">
                                        <View className="flex-row items-center flex-1 mr-2">
                                            {dark ? (
                                                <Moon size={13} color={palette.colors.textGray} />
                                            ) : (
                                                <Sun size={13} color={palette.colors.textGray} />
                                            )}
                                            <Typography
                                                variant="caption"
                                                weight="bold"
                                                className="ml-1.5 flex-1"
                                                style={{ color: palette.colors.text }}
                                                numberOfLines={1}
                                            >
                                                {palette.name}
                                            </Typography>
                                        </View>
                                        <View
                                            className="w-5 h-5 rounded-full items-center justify-center"
                                            style={{
                                                backgroundColor: selected ? palette.colors.primary : 'transparent',
                                                borderWidth: selected ? 0 : 1.5,
                                                borderColor: '#D1D5DB',
                                            }}
                                        >
                                            {selected && <Check size={12} color="#FFFFFF" />}
                                        </View>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View className="mt-2 p-5 bg-surface rounded-[28px] border border-border shadow-sm mb-8">
                        <View className="flex-row justify-between items-center mb-3">
                            <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-[1.5px]">
                                Pratinjau & Kustom Warna Active
                            </Typography>
                            <Typography variant="caption" className="text-primary text-[11px] italic">
                                Ketik/Klik warna untuk edit
                            </Typography>
                        </View>
                        <View className="flex-row items-center gap-2">
                            {(['primary', 'secondary', 'background', 'surface', 'text', 'textGray'] as const).map((key) => (
                                <Pressable
                                    key={key}
                                    onPress={() => handleOpenColorEditor(key)}
                                    className="flex-1 items-center active:opacity-70"
                                >
                                    <View
                                        style={{ backgroundColor: themeColors[key] }}
                                        className="w-full h-11 rounded-xl border border-border items-center justify-center relative shadow-sm"
                                    >
                                        <View className="bg-black/20 rounded-full p-1">
                                            <Pencil size={11} color="white" />
                                        </View>
                                    </View>
                                    <Typography variant="caption" weight="medium" className="text-textGray text-[9px] mt-1.5">
                                        {key === 'textGray' ? 'gray' : key}
                                    </Typography>
                                </Pressable>
                            ))}
                        </View>
                        <Typography variant="caption" className="text-textGray mt-4 text-center">
                            Tekan warna di atas untuk mengubah kode warna HEX secara custom.
                        </Typography>
                    </View>

                    <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-[2px] ml-4 mb-4">
                        Latar Belakang Beranda
                    </Typography>

                    <View className="bg-surface p-5 rounded-[32px] border border-border shadow-sm overflow-hidden">
                        <View className="w-full h-40 bg-background rounded-2xl mb-4 overflow-hidden items-center justify-center relative">
                            {user?.home_background ? (
                                <Image
                                    source={{ uri: getFileUrl(user.home_background) as string }}
                                    className="w-full h-full"
                                    resizeMode="cover"
                                />
                            ) : (
                                <View className="items-center">
                                    <ImageIcon size={40} color={themeColors.textGray} />
                                    <Typography variant="caption" className="text-textGray mt-2">Default Gradient</Typography>
                                </View>
                            )}

                            {isUploading && (
                                <View className="absolute inset-0 bg-black/20 items-center justify-center">
                                    <ActivityIndicator color="white" />
                                </View>
                            )}
                        </View>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={pickBackground}
                                disabled={isUploading}
                                className="flex-1 bg-primary h-12 rounded-2xl flex-row items-center justify-center"
                            >
                                <Camera size={18} color="white" />
                                <Typography weight="bold" className="text-white ml-2">Pilih Gambar</Typography>
                            </Pressable>

                            {user?.home_background && (
                                <Pressable
                                    onPress={handleRemoveBackground}
                                    disabled={isUploading}
                                    className="w-12 h-12 bg-rose-50 rounded-2xl items-center justify-center border border-rose-100"
                                >
                                    <Trash2 size={18} color="#EF4444" />
                                </Pressable>
                            )}
                        </View>
                        <Typography variant="caption" className="text-textGray mt-4 px-2 text-center">
                            Gunakan gambar dengan orientasi lanskap (16:9) untuk hasil terbaik di halaman beranda.
                        </Typography>
                    </View>
                </ScrollView>
            </View>

            {/* Modal Kustomisasi Warna */}
            <Modal
                visible={!!editingColorKey}
                transparent
                animationType="fade"
                onRequestClose={() => setEditingColorKey(null)}
            >
                <View className="flex-1 bg-black/50 justify-center items-center p-6">
                    <View className="bg-surface w-full max-w-sm rounded-[32px] p-6 border border-border shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Typography variant="h4" weight="bold" className="text-text">
                                Edit Warna: {editingColorKey === 'textGray' ? 'gray' : editingColorKey}
                            </Typography>
                            <Pressable onPress={() => setEditingColorKey(null)} className="p-2 rounded-full bg-background">
                                <X size={18} color={themeColors.textGray} />
                            </Pressable>
                        </View>

                        {/* Custom Hex Preview */}
                        <View className="flex-row items-center gap-4 mb-6 bg-background p-4 rounded-2xl border border-border">
                            <View
                                style={{ backgroundColor: /^#([A-Fa-f0-9]{6})$/.test(hexInput.trim()) ? hexInput.trim() : (editingColorKey ? themeColors[editingColorKey] : '#000') }}
                                className="w-14 h-14 rounded-2xl border border-border shadow-md justify-center items-center"
                            />
                            <View className="flex-1">
                                <Typography variant="caption" weight="bold" className="text-textGray mb-1 uppercase tracking-wider">
                                    Kode Hex
                                </Typography>
                                <TextInput
                                    value={hexInput}
                                    onChangeText={setHexInput}
                                    placeholder="#000000"
                                    placeholderTextColor={themeColors.textGray}
                                    autoCapitalize="characters"
                                    maxLength={7}
                                    className="bg-surface text-text font-outfit-bold text-base px-3 py-2 rounded-xl border border-border"
                                />
                            </View>
                        </View>

                        {/* Quick Presets */}
                        <Typography variant="caption" weight="bold" className="text-textGray mb-3 uppercase tracking-wider">
                            Pilihan Warna Cepat
                        </Typography>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {PRESET_SWATCHES.map((color) => (
                                <Pressable
                                    key={color}
                                    onPress={() => setHexInput(color)}
                                    style={{ backgroundColor: color }}
                                    className="w-8 h-8 rounded-full border border-border justify-center items-center"
                                >
                                    {hexInput.toUpperCase() === color.toUpperCase() && (
                                        <Check size={14} color={color === '#FFFFFF' || color === '#F9F9F9' ? '#000000' : '#FFFFFF'} />
                                    )}
                                </Pressable>
                            ))}
                        </View>

                        {/* Modal Action Buttons */}
                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setEditingColorKey(null)}
                                className="flex-1 bg-background h-12 rounded-2xl items-center justify-center border border-border"
                            >
                                <Typography weight="bold" className="text-textGray">Batal</Typography>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveCustomColor}
                                className="flex-1 bg-primary h-12 rounded-2xl items-center justify-center"
                            >
                                <Typography weight="bold" className="text-white">Simpan Warna</Typography>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
