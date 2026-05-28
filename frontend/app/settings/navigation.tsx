import React, { useState } from 'react';
import { View, ScrollView, Pressable, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, RotateCcw, ChevronRight, Sliders, Check, Home, ShieldCheck, Wrench, CarFront, Truck, BarChart3, History, Receipt, User, Plus, X } from 'lucide-react-native';
import { Typography } from '../../components/ui/Typography';
import { router } from 'expo-router';
import { useUIStore } from '../../store/useUIStore';
import { useNavigationStore, defaultSlots } from '../../store/useNavigationStore';
import { APP_ROUTES } from '../../constants/NavigationRoutes';

const CATEGORY_STYLE: Record<string, { color: string; bgColor: string }> = {
    Utama: { color: '#3B82F6', bgColor: '#E8F0FE' },
    Bengkel: { color: '#023C69', bgColor: '#E2EFFC' },
    Logistik: { color: '#6366F1', bgColor: '#E0E7FF' },
    Mobil: { color: '#F43F5E', bgColor: '#FFE4E6' },
    Master: { color: '#0F766E', bgColor: '#CCFBF1' },
    SDM: { color: '#10B981', bgColor: '#E6F4EA' },
    Laporan: { color: '#8B5CF6', bgColor: '#EDE9FE' },
    Finance: { color: '#F59E0B', bgColor: '#FEF3C7' },
    Sistem: { color: '#374151', bgColor: '#F3F4F6' },
};

const NAV_OPTIONS = [
    ...APP_ROUTES.map((route) => {
        const style = CATEGORY_STYLE[route.category] || CATEGORY_STYLE.Sistem;
        return {
            id: route.id,
            label: route.label,
            description: route.description,
            icon: route.icon,
            color: style.color,
            bgColor: style.bgColor,
            path: route.path,
        };
    }),
    { id: 'fab-plus', label: 'FAB+ (Tambah)', description: 'Floating Button aksi cepat', icon: Plus, color: '#EE2737', bgColor: '#FEE2E2', path: '#fab' },
];

export default function NavigationSettingsScreen() {
    const { themeColors } = useUIStore();
    const { activeSlots, fabSlots, updateSlot, updateFabSlot, resetSlots } = useNavigationStore();
    const [pickerVisible, setPickerVisible] = useState(false);
    const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
    const [pickerMode, setPickerMode] = useState<'bar' | 'fab'>('bar');

    const currentFabSlots = fabSlots || ['bengkel', 'fin-mutasi', 'mobil'];

    // Resolves details for a slot option
    const getOptionDetails = (id: string) => {
        return NAV_OPTIONS.find(o => o.id === id);
    };

    const handleOpenPicker = (slotIndex: number) => {
        setSelectedSlotIndex(slotIndex);
        setPickerMode('bar');
        setPickerVisible(true);
    };

    const handleSelectOption = (optionId: string) => {
        if (selectedSlotIndex !== null) {
            if (pickerMode === 'bar') {
                updateSlot(selectedSlotIndex, optionId);
            } else {
                updateFabSlot(selectedSlotIndex, optionId);
            }
            setPickerVisible(false);
        }
    };

    const handleReset = () => {
        Alert.alert(
            "Reset Navigasi",
            "Apakah Anda yakin ingin mengembalikan bottom navigasi ke pilihan bawaan pabrik?",
            [
                { text: "Batal", style: "cancel" },
                { 
                    text: "Reset", 
                    style: "destructive",
                    onPress: () => {
                        resetSlots();
                        Alert.alert("Sukses", "Bottom navigasi berhasil di-reset ke bawaan default.");
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <View className="flex-1">
                {/* Header */}
                <View className="flex-row items-center px-6 py-4">
                    <Pressable
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-gray-100 shadow-sm"
                    >
                        <ChevronLeft size={24} color={themeColors.text} />
                    </Pressable>
                    <View className="flex-1 ml-4">
                        <Typography variant="h3" weight="bold">Bottom Navigasi</Typography>
                    </View>
                    <Pressable
                        onPress={handleReset}
                        className="w-10 h-10 items-center justify-center rounded-2xl bg-surface border border-gray-100 shadow-sm active:bg-rose-50"
                    >
                        <RotateCcw size={20} color={themeColors.secondary} />
                    </Pressable>
                </View>

                <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    {/* Bento Info banner */}
                    <View className="bg-primary/5 p-6 rounded-[32px] mb-6 items-center border border-primary/10">
                        <View className="w-14 h-14 bg-primary rounded-full items-center justify-center mb-4 shadow-lg">
                            <Sliders size={26} color="white" />
                        </View>
                        <Typography variant="h4" weight="bold" className="text-primary text-center">Kustomisasi Menu Utama</Typography>
                        <Typography variant="caption" className="text-primary/60 text-center mt-1">Sesuaikan 5 tombol di bar bawah layar sesuai kebutuhan operasional harian Anda</Typography>
                    </View>

                    {/* LIVE INTERACTIVE PREVIEW */}
                    <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[2px] ml-4 mb-3">Live Preview Bottom Bar</Typography>
                    
                    <View className="bg-surface rounded-[32px] p-4 border border-gray-100 shadow-sm mb-6 items-center justify-center overflow-hidden">
                        {/* Simulation Bar */}
                        <View className="w-full bg-white border border-gray-100 rounded-2xl p-2 flex-row items-center justify-between shadow-sm relative h-16">
                            {activeSlots.map((slotId, index) => {
                                const details = getOptionDetails(slotId);
                                if (!details) return null;
                                const PreviewIcon = details.icon;
                                const isFab = slotId === 'fab-plus';

                                if (isFab) {
                                    return (
                                        <View key={index} className="flex-1 items-center justify-center relative h-full overflow-visible">
                                            <View 
                                                className="absolute -top-6 w-11 h-11 rounded-full items-center justify-center shadow-lg" 
                                                style={{ backgroundColor: themeColors.primary, elevation: 10, shadowColor: themeColors.primary, shadowOpacity: 0.4 }}
                                            >
                                                <Plus size={22} color="white" strokeWidth={3} />
                                            </View>
                                            <Typography weight="bold" className="text-[8px] text-gray-400 mt-6 uppercase tracking-tighter">
                                                {details.label.split(' ')[0]}
                                            </Typography>
                                        </View>
                                    );
                                }

                                return (
                                    <View key={index} className="flex-1 items-center justify-center">
                                        <View className="opacity-60 mb-0.5">
                                            <PreviewIcon size={16} color={index === 0 ? themeColors.primary : '#6B7280'} strokeWidth={index === 0 ? 2.5 : 2} />
                                        </View>
                                        <Typography weight={index === 0 ? "bold" : "medium"} className={`text-[8px] uppercase tracking-tighter ${index === 0 ? 'text-primary' : 'text-gray-400'}`} numberOfLines={1}>
                                            {details.label.split(' ')[0]}
                                        </Typography>
                                    </View>
                                );
                            })}
                        </View>
                        <Typography variant="caption" className="text-text/30 mt-3 text-center">Tampilan simulasi real-time bottom bar Anda</Typography>
                    </View>

                    {/* SLOT SELECTOR LIST */}
                    <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[2px] ml-4 mb-3">Tata Letak Slot Navigasi</Typography>

                    <View className="gap-y-4">
                        {activeSlots.map((slotId, index) => {
                            const details = getOptionDetails(slotId);
                            if (!details) return null;
                            const SlotIcon = details.icon;

                            return (
                                <Pressable
                                    key={index}
                                    onPress={() => handleOpenPicker(index)}
                                    className="bg-surface p-5 rounded-[28px] border border-gray-100 shadow-sm flex-row items-center justify-between active:bg-gray-50/50"
                                >
                                    <View className="flex-row items-center flex-1">
                                        {/* Slot Badge */}
                                        <View className="w-9 h-9 bg-primary/5 rounded-xl justify-center items-center mr-4 border border-primary/10">
                                            <Typography weight="bold" className="text-primary text-sm font-outfit-bold">{index + 1}</Typography>
                                        </View>

                                        {/* Selected Option Meta */}
                                        <View className="flex-1 mr-4">
                                            <Typography variant="caption" className="text-text/30 uppercase font-bold tracking-widest text-[9px]">Slot {index + 1}</Typography>
                                            <View className="flex-row items-center mt-0.5">
                                                <View style={{ backgroundColor: details.bgColor }} className="w-5 h-5 rounded-md items-center justify-center mr-2 border border-black/5">
                                                    <SlotIcon size={11} color={details.color} strokeWidth={2.5} />
                                                </View>
                                                <Typography weight="bold" className="text-text text-[15px] font-outfit-bold leading-tight">
                                                    {details.label}
                                                </Typography>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Action button */}
                                    <View className="flex-row items-center gap-x-2">
                                        {slotId === 'fab-plus' && (
                                            <View className="bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5">
                                                <Typography variant="caption" weight="bold" className="text-rose-500 text-[8px] uppercase tracking-wider font-bold">FAB+</Typography>
                                            </View>
                                        )}
                                        <View className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 justify-center items-center shadow-sm">
                                            <ChevronRight size={14} color="#9CA3AF" />
                                        </View>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>

                    {/* FAB ACTIONS CUSTOMIZER */}
                    <Typography variant="caption" weight="bold" className="text-text/30 uppercase tracking-[2px] ml-4 mt-8 mb-3">Aksi Cepat FAB+ (Radial)</Typography>

                    <View className="gap-y-4">
                        {currentFabSlots.map((slotId, index) => {
                            const details = getOptionDetails(slotId);
                            if (!details) return null;
                            const SlotIcon = details.icon;
                            const positionLabels = ['Aksi Kiri (←)', 'Aksi Tengah (↑)', 'Aksi Kanan (→)'];

                            return (
                                <Pressable
                                    key={index}
                                    onPress={() => {
                                        setSelectedSlotIndex(index);
                                        setPickerMode('fab');
                                        setPickerVisible(true);
                                    }}
                                    className="bg-surface p-5 rounded-[28px] border border-gray-100 shadow-sm flex-row items-center justify-between active:bg-gray-50/50"
                                >
                                    <View className="flex-row items-center flex-1">
                                        {/* Position Indicator Badge */}
                                        <View className="w-9 h-9 bg-primary/5 rounded-xl justify-center items-center mr-4 border border-primary/10">
                                            <Typography weight="bold" className="text-primary text-sm font-outfit-bold">
                                                {index === 0 ? '←' : index === 1 ? '↑' : '→'}
                                            </Typography>
                                        </View>

                                        {/* Selected Option Meta */}
                                        <View className="flex-1 mr-4">
                                            <Typography variant="caption" className="text-text/30 uppercase font-bold tracking-widest text-[9px]">{positionLabels[index]}</Typography>
                                            <View className="flex-row items-center mt-0.5">
                                                <View style={{ backgroundColor: details.bgColor }} className="w-5 h-5 rounded-md items-center justify-center mr-2 border border-black/5">
                                                    <SlotIcon size={11} color={details.color} strokeWidth={2.5} />
                                                </View>
                                                <Typography weight="bold" className="text-text text-[15px] font-outfit-bold leading-tight">
                                                    {details.label}
                                                </Typography>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Action button */}
                                    <View className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 justify-center items-center shadow-sm">
                                        <ChevronRight size={14} color="#9CA3AF" />
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View className="mt-8 p-5 bg-emerald-50/50 border border-emerald-100/50 rounded-[32px]">
                        <Typography variant="caption" className="text-emerald-700/80 text-center leading-relaxed font-outfit-medium">
                            Semua penyesuaian tersimpan otomatis dan langsung berlaku ke navigasi bawah aplikasi di layar beranda.
                        </Typography>
                    </View>
                </ScrollView>
            </View>

            {/* SELECTION DRAWER / MODAL */}
            <Modal
                visible={pickerVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setPickerVisible(false)}
            >
                <View className="flex-1 justify-end bg-slate-900/30">
                    <View className="bg-white rounded-t-[48px] shadow-2xl max-h-[85%] border-t border-gray-100">
                        {/* Drag Handle */}
                        <View className="items-center pt-4 pb-2">
                            <View className="w-12 h-1 bg-gray-200 rounded-full" />
                        </View>

                        {/* Title */}
                        <View className="px-8 pt-4 pb-4 flex-row justify-between items-center">
                            <View>
                                <Typography variant="h3" weight="bold" className="text-text text-xl">
                                    {pickerMode === 'bar' ? 'Pilih Menu Utama' : 'Pilih Aksi Cepat FAB+'}
                                </Typography>
                                <Typography variant="caption" className="text-textGray">
                                    {pickerMode === 'bar'
                                        ? `Pilih fungsi untuk Slot ${selectedSlotIndex !== null ? selectedSlotIndex + 1 : ''}`
                                        : `Pilih fungsi untuk Aksi ${selectedSlotIndex === 0 ? 'Kiri (←)' : selectedSlotIndex === 1 ? 'Tengah (↑)' : 'Kanan (→)'}`
                                    }
                                </Typography>
                            </View>
                            <Pressable
                                onPress={() => setPickerVisible(false)}
                                className="w-10 h-10 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 active:bg-gray-100"
                            >
                                <X size={18} color="#6B7280" />
                            </Pressable>
                        </View>

                        {/* Options List */}
                        <ScrollView className="px-6 pb-8" showsVerticalScrollIndicator={false}>
                            <View className="gap-y-3 pb-8">
                                {NAV_OPTIONS.filter(opt => pickerMode === 'bar' || opt.id !== 'fab-plus').map((option) => {
                                    const OptionIcon = option.icon;
                                    const isSelected = selectedSlotIndex !== null && 
                                        (pickerMode === 'bar'
                                            ? activeSlots[selectedSlotIndex] === option.id
                                            : currentFabSlots[selectedSlotIndex] === option.id
                                        );

                                    return (
                                        <Pressable
                                            key={option.id}
                                            onPress={() => handleSelectOption(option.id)}
                                            style={{
                                                backgroundColor: isSelected ? themeColors.primary + '08' : 'white',
                                                borderColor: isSelected ? themeColors.primary + '20' : '#F3F4F6'
                                            }}
                                            className="p-4 rounded-[24px] border flex-row items-center justify-between active:bg-gray-50"
                                        >
                                            <View className="flex-row items-center flex-1 mr-4">
                                                {/* Option Icon Container */}
                                                <View
                                                    style={{ backgroundColor: option.bgColor }}
                                                    className="w-11 h-11 rounded-[16px] justify-center items-center mr-4 border border-black/5"
                                                >
                                                    <OptionIcon size={20} color={option.color} strokeWidth={2.2} />
                                                </View>

                                                {/* Text Info */}
                                                <View className="flex-1">
                                                    <Typography weight="bold" className="text-text text-base font-outfit-bold leading-tight">
                                                        {option.label}
                                                    </Typography>
                                                    <Typography variant="caption" className="text-textGray text-xs mt-0.5">
                                                        {option.description}
                                                    </Typography>
                                                </View>
                                            </View>

                                            {/* Selection indicator */}
                                            {isSelected ? (
                                                <View style={{ backgroundColor: themeColors.primary }} className="w-6 h-6 rounded-full justify-center items-center shadow-sm">
                                                    <Check size={12} color="white" strokeWidth={3} />
                                                </View>
                                            ) : (
                                                <View className="w-6 h-6 rounded-full border-2 border-gray-100" />
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
