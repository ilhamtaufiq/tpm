import React from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar, Search, X } from 'lucide-react-native';
import { Typography } from '../ui/Typography';
import { REPORT_FILTER_LABELS, ReportFilterType } from './types';

interface ReportDateControlsProps {
    filterType: ReportFilterType;
    onFilterTypeChange: (type: ReportFilterType) => void;
    formattedDate: string;
    onPrev: () => void;
    onNext: () => void;
    search?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    showFilterTabs?: boolean;
    className?: string;
}

export function ReportDateControls({
    filterType,
    onFilterTypeChange,
    formattedDate,
    onPrev,
    onNext,
    search,
    onSearchChange,
    searchPlaceholder = 'Cari data laporan...',
    showFilterTabs = true,
    className = 'mb-4',
}: ReportDateControlsProps) {
    return (
        <View className={`bg-white border border-gray-100 rounded-2xl p-4 ${className}`}>
            {showFilterTabs && (
                <View className="flex-row bg-gray-50 p-1 rounded-2xl mb-4">
                    {(['daily', 'monthly', 'yearly'] as ReportFilterType[]).map((type) => {
                        const isActive = filterType === type;
                        return (
                            <Pressable
                                key={type}
                                onPress={() => onFilterTypeChange(type)}
                                className={`flex-1 py-2.5 items-center rounded-xl ${isActive ? 'bg-white border border-gray-100' : ''}`}
                            >
                                <Typography
                                    variant="caption"
                                    weight="bold"
                                    className={isActive ? 'text-primary' : 'text-gray-400'}
                                >
                                    {REPORT_FILTER_LABELS[type]}
                                </Typography>
                            </Pressable>
                        );
                    })}
                </View>
            )}

            <View className="flex-row justify-between items-center">
                <Pressable
                    onPress={onPrev}
                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                >
                    <ChevronLeft size={20} color="#1C1C1C" />
                </Pressable>

                <View className="flex-row items-center">
                    <Calendar size={16} color="#023C69" />
                    <Typography variant="body2" weight="bold" className="text-textMain ml-2 capitalize">
                        {formattedDate}
                    </Typography>
                </View>

                <Pressable
                    onPress={onNext}
                    className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center border border-gray-100"
                >
                    <ChevronRight size={20} color="#1C1C1C" />
                </Pressable>
            </View>

            {onSearchChange !== undefined && (
                <View className="mt-4 flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 h-12">
                    <Search size={18} color="#9CA3AF" />
                    <TextInput
                        placeholder={searchPlaceholder}
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 ml-3 text-sm font-medium text-textMain"
                        value={search}
                        onChangeText={onSearchChange}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {search && search.length > 0 && (
                        <Pressable onPress={() => onSearchChange('')} className="p-1">
                            <X size={16} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}