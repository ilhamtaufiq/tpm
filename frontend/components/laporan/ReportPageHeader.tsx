import React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { ChevronLeft, Download } from 'lucide-react-native';
import { Typography } from '../ui/Typography';

interface ReportPageHeaderProps {
    title: string;
    subtitle?: string;
    onBack: () => void;
    onExport?: () => void;
    isExporting?: boolean;
}

export function ReportPageHeader({
    title,
    subtitle,
    onBack,
    onExport,
    isExporting,
}: ReportPageHeaderProps) {
    return (
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 bg-white">
            <View className="flex-row items-center flex-1 mr-3">
                <Pressable onPress={onBack} className="mr-4">
                    <ChevronLeft size={24} color="#1C1C1C" />
                </Pressable>
                <View className="flex-1">
                    <Typography variant="h2" weight="bold" numberOfLines={1}>
                        {title}
                    </Typography>
                    {subtitle ? (
                        <Typography className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
                            {subtitle}
                        </Typography>
                    ) : null}
                </View>
            </View>
            {onExport ? (
                <Pressable
                    onPress={onExport}
                    disabled={isExporting}
                    className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center border border-gray-100 active:opacity-80"
                >
                    {isExporting ? (
                        <ActivityIndicator size="small" color="#023C69" />
                    ) : (
                        <Download size={20} color="#023C69" />
                    )}
                </Pressable>
            ) : null}
        </View>
    );
}