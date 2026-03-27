import React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
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

    const categoryMap: Record<string, string> = {
        umum: 'Umum',
        jasa_angkut: 'Jasa Angkut',
        jual_beli_mobil: 'Jual Beli Mobil'
    };

    return (
        <View className="mb-6">
            <Typography variant="h3" weight="bold" className="mb-4 text-textMain tracking-tight">Riwayat Bengkel Terkait</Typography>
            <View className="space-y-3">
                {transactions.map((item: any) => (
                    <Card key={item.id} className="p-4 border-gray-100 bg-gray-50/50 rounded-[24px]">
                        <View className="flex-row justify-between items-start mb-2">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-blue-100/50 rounded-2xl items-center justify-center mr-3">
                                    <Wrench size={18} color="#3B82F6" />
                                </View>
                                <View>
                                    <View className="flex-row items-center">
                                        <Typography variant="body2" weight="bold">{item.nomor_transaksi}</Typography>
                                        <View className="ml-2 px-1.5 py-0.5 rounded-md bg-gray-200/50">
                                            <Typography className="text-[8px] font-bold text-gray-500 uppercase">
                                                {categoryMap[item.kategori] || item.kategori}
                                            </Typography>
                                        </View>
                                    </View>
                                    <Typography variant="caption" className="text-textGray">{formatDate(item.tanggal)}</Typography>
                                </View>
                            </View>
                            <Typography weight="bold" className="text-primary">
                                {formatCurrency(item.grand_total || item.total_biaya)}
                            </Typography>
                        </View>

                        {/* Details List */}
                        <View className="ml-1 mr-2 mt-3 p-3 bg-white/50 rounded-2xl border border-gray-100/50">
                            {(item.detail_services || []).map((s: any, idx: number) => (
                                <View key={`s-${idx}`} className="flex-row items-center mb-1.5">
                                    <View className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2.5" />
                                    <Typography variant="caption" className="text-textGray flex-1">{s.nama_jasa}</Typography>
                                    {s.harga > 0 && (
                                        <Typography variant="caption" className="text-textGray font-bold">{formatCurrency(s.harga)}</Typography>
                                    )}
                                </View>
                            ))}
                            {(item.detail_parts || []).map((p: any, idx: number) => (
                                <View key={`p-${idx}`} className="flex-row items-center mb-1.5">
                                    <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2.5" />
                                    <Typography variant="caption" className="text-textGray flex-1">
                                        {p.spare_part_nama || 'Part'} (x{p.qty})
                                    </Typography>
                                    {p.harga_jual > 0 && (
                                        <Typography variant="caption" className="text-textGray font-bold">{formatCurrency(p.harga_jual * p.qty)}</Typography>
                                    )}
                                </View>
                            ))}
                        </View>

                        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100/50">
                            {item.mekanik_nama ? (
                                <View className="flex-row items-center">
                                    <User size={12} color="#9CA3AF" />
                                    <Typography variant="caption" className="ml-1.5 text-textGray font-medium">Mekanik: {item.mekanik_nama}</Typography>
                                </View>
                            ) : <View />}
                            <View className="flex-row items-center">
                                <View className={`w-2 h-2 rounded-full mr-1.5 ${item.status_bayar === 'LUNAS' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <Typography variant="caption" weight="bold" className={item.status_bayar === 'LUNAS' ? 'text-emerald-600' : 'text-amber-600'}>
                                    {item.status_bayar}
                                </Typography>
                            </View>
                        </View>
                    </Card>
                ))}
            </View>
        </View>
    );
};
