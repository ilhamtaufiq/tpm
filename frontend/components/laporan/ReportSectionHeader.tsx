import React from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';

interface ReportSectionHeaderProps {
    title: string;
    count?: number | string;
    countLabel?: string;
}

export function ReportSectionHeader({ title, count, countLabel = 'item' }: ReportSectionHeaderProps) {
    return (
        <View className="flex-row items-center justify-between mb-4 px-1">
            <View className="flex-row items-center">
                <View className="w-1.5 h-5 bg-primary rounded-full mr-3" />
                <Typography variant="h3" weight="bold" className="text-textMain">
                    {title}
                </Typography>
            </View>
            {count !== undefined ? (
                <Typography className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {count} {countLabel}
                </Typography>
            ) : null}
        </View>
    );
}