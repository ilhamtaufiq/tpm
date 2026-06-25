import React from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';
import { ReportStatItem } from './types';

interface ReportStatsBentoProps {
    stats: ReportStatItem[];
    className?: string;
}

export function ReportStatsBento({ stats, className = 'mb-4' }: ReportStatsBentoProps) {
    if (!stats.length) return null;

    return (
        <View className={`flex-row gap-3 ${className}`}>
            {stats.map((stat) => {
                const StatIcon = stat.icon;
                const bg = stat.bg || 'bg-white';
                return (
                    <View key={stat.label} className={`flex-1 ${bg} rounded-2xl p-3 border border-gray-100`}>
                        <View className="flex-row items-center mb-2">
                            <StatIcon size={14} color={stat.color} />
                            <Typography className="text-[9px] font-bold text-gray-500 ml-1.5 uppercase tracking-wide">
                                {stat.label}
                            </Typography>
                        </View>
                        <Typography weight="bold" className="text-textMain text-sm" numberOfLines={1}>
                            {stat.value}
                        </Typography>
                        {stat.sub ? (
                            <Typography className="text-[9px] text-gray-400 mt-0.5" numberOfLines={1}>
                                {stat.sub}
                            </Typography>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}