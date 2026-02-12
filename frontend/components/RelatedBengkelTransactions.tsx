import React from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Typography } from './ui/Typography';
import { Card } from './ui/Card';
import { Wrench, ChevronRight, Calendar, User } from 'lucide-react-native';
import { useTransaksiBengkelList } from '../hooks/useBengkel';
import { formatCurrency, formatDate } from '../utils/format';

interface RelatedBengkelTransactionsProps {
    muatan_id?: number;
    mobil_id?: number;
}

export const RelatedBengkelTransactions = ({ muatan_id, mobil_id }: RelatedBengkelTransactionsProps) => {
    const { data: bengkelTrx, isLoading } = useTransaksiBengkelList({
        muatan_id,
        mobil_id,
        limit: 5
    }, {
        enabled: !!muatan_id || !!mobil_id
    });

    const transactions = bengkelTrx?.data || [];

    if (isLoading) {
        return <ActivityIndicator className="my-4" color="#023C69" />;
    }

    if (transactions.length === 0) {
        return null;
    }

    return (
        <View className="mb-6">
            <Typography variant="h3" weight="bold" className="mb-4 text-textMain tracking-tight">Riwayat Bengkel Terkait</Typography>
            <View className="space-y-3">
                {transactions.map((item: any) => (
                    <Card key={item.id} className="p-4 border-gray-100 bg-gray-50/50">
                        <View className="flex-row justify-between items-start mb-2">
                            <View className="flex-row items-center">
                                <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mr-3">
                                    <Wrench size={16} color="#3B82F6" />
                                </View>
                                <View>
                                    <Typography variant="body2" weight="bold">{item.nomor_transaksi}</Typography>
                                    <Typography variant="caption" className="text-textGray">Bengkel Category: {item.kategori}</Typography>
                                </View>
                            </View>
                            <Typography weight="bold" className="text-primary">{formatCurrency(item.total_biaya)}</Typography>
                        </View>

                        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-gray-100">
                            <View className="flex-row items-center">
                                <Calendar size={12} color="#9CA3AF" />
                                <Typography variant="caption" className="ml-1 text-textGray">{formatDate(item.tanggal)}</Typography>
                            </View>
                            {item.mekanik_nama && (
                                <View className="flex-row items-center">
                                    <User size={12} color="#9CA3AF" />
                                    <Typography variant="caption" className="ml-1 text-textGray">{item.mekanik_nama}</Typography>
                                </View>
                            )}
                        </View>
                    </Card>
                ))}
            </View>
        </View>
    );
};
