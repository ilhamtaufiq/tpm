import React from 'react';
import { View, Pressable, Modal } from 'react-native';
import { Download, Eye, Printer, X } from 'lucide-react-native';
import { Typography } from '../ui/Typography';

interface ReportExportSheetProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    onPreview?: () => void;
    onPrint?: () => void;
    onDownload?: () => void;
}

export function ReportExportSheet({
    visible,
    onClose,
    title = 'Ekspor Laporan',
    subtitle = 'Pilih metode ekspor dokumen',
    onPreview,
    onPrint,
    onDownload,
}: ReportExportSheetProps) {
    const actions = [
        { id: 'preview', label: 'Preview', icon: Eye, color: '#4F46E5', bg: 'bg-indigo-50', border: 'border-indigo-100', onPress: onPreview },
        { id: 'print', label: 'Cetak', icon: Printer, color: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-100', onPress: onPrint },
        { id: 'download', label: 'PDF', icon: Download, color: '#D97706', bg: 'bg-amber-50', border: 'border-amber-100', onPress: onDownload },
    ].filter((action) => !!action.onPress);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
                <Pressable onPress={(e) => e.stopPropagation()} className="bg-white rounded-t-[40px] p-6 pb-10">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Typography variant="h3" weight="bold">{title}</Typography>
                            <Typography variant="caption" className="text-gray-500 mt-0.5">{subtitle}</Typography>
                        </View>
                        <Pressable onPress={onClose} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                            <X size={18} color="#64748B" />
                        </Pressable>
                    </View>
                    <View className="flex-row gap-3">
                        {actions.map((action) => {
                            const Icon = action.icon;
                            return (
                                <Pressable
                                    key={action.id}
                                    onPress={() => {
                                        action.onPress?.();
                                    }}
                                    className={`flex-1 ${action.bg} p-5 rounded-[24px] border ${action.border} items-center active:opacity-90`}
                                >
                                    <View
                                        style={{ backgroundColor: action.color }}
                                        className="w-12 h-12 rounded-2xl items-center justify-center mb-3"
                                    >
                                        <Icon size={22} color="white" />
                                    </View>
                                    <Typography weight="bold" className="text-textMain text-sm">
                                        {action.label}
                                    </Typography>
                                </Pressable>
                            );
                        })}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}