import React from 'react';
import { View } from 'react-native';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { formatCurrency } from '../../utils/format';

interface ProfitSplitCardProps {
    revenue: number;
    totalCosts: number;
    percentageTPM?: number; // default 50
}

export const ProfitSplitCard = ({
    revenue,
    totalCosts,
    percentageTPM = 50
}: ProfitSplitCardProps) => {
    // Old logic: Split calculated on Net Profit (Revenue - Costs)
    // const grossProfit = Math.max(0, revenue - totalCosts);
    // const tpmShare = (grossProfit * percentageTPM) / 100;
    // const supirShare = grossProfit - tpmShare;

    // New logic: Operational costs charged to TPM
    // Driver Share = Gross Revenue * Driver %
    const supirShare = (revenue * (100 - percentageTPM)) / 100;

    // TPM Share = Revenue - Driver Share - Costs
    const tpmShare = revenue - supirShare - totalCosts;

    // Gross Profit (Total Laba Kotor)
    const grossProfit = revenue - totalCosts;

    return (
        <Card className="bg-white">
            <Typography variant="caption" weight="medium" className="mb-2 text-gray-500">
                Simulasi Bagi Hasil
            </Typography>

            {/* Summary Row */}
            <View className="flex-row justify-between mb-4 pb-4 border-b border-gray-100">
                <View>
                    <Typography variant="caption" className="text-gray-400">Total Pendapatan</Typography>
                    <Typography variant="body2" weight="bold">{formatCurrency(revenue)}</Typography>
                </View>
                <View className="items-end">
                    <Typography variant="caption" className="text-gray-400">Net Profit (Laba Kotor)</Typography>
                    <Typography variant="body2" weight="bold" className="text-green-600">{formatCurrency(grossProfit)}</Typography>
                </View>
            </View>

            {/* The Split Visual */}
            <View className="flex-row rounded-lg overflow-hidden h-3 mb-3 bg-gray-100">
                <View style={{ flex: percentageTPM, backgroundColor: '#0ea5e9' }} />
                <View style={{ flex: 100 - percentageTPM, backgroundColor: '#f59e0b' }} />
            </View>

            {/* Split Details */}
            <View className="flex-row justify-between">
                <View className="bg-sky-50 p-3 rounded-lg flex-1 mr-2 border border-sky-100">
                    <Typography variant="caption" weight="bold" className="text-sky-600 mb-1">
                        TPM ({percentageTPM}%)
                    </Typography>
                    <Typography variant="h3" weight="bold" className="text-sky-700">
                        {formatCurrency(tpmShare)}
                    </Typography>
                    <Typography variant="caption" className="text-sky-400 mt-1" style={{ fontSize: 10 }}>
                        Masuk ke Kas Perusahaan
                    </Typography>
                </View>

                <View className="bg-amber-50 p-3 rounded-lg flex-1 ml-2 border border-amber-100">
                    <Typography variant="caption" weight="bold" className="text-amber-600 mb-1">
                        Supir ({100 - percentageTPM}%)
                    </Typography>
                    <Typography variant="h3" weight="bold" className="text-amber-700">
                        {formatCurrency(supirShare)}
                    </Typography>
                    <Typography variant="caption" className="text-amber-400 mt-1" style={{ fontSize: 10 }}>
                        Hak Supir
                    </Typography>
                </View>
            </View>

            {/* Costs Info */}
            <View className="mt-3 pt-2 border-t border-dashed border-gray-200">
                <Typography variant="caption" className="text-gray-400 text-center">
                    *Biaya operasional dibebankan ke TPM (tidak mengurangi hak supir)
                </Typography>
                <Typography variant="caption" className="text-gray-400 text-center mt-1">
                    Total Biaya: {formatCurrency(totalCosts)}
                </Typography>
            </View>
        </Card>
    );
};
