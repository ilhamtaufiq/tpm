import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { Badge } from '../ui/Badge';
import { Supir } from '../../services/jasaAngkut';
import { Phone, FileText } from 'lucide-react-native';

interface DriverCardProps {
    supir: Supir;
    onPress?: () => void;
}

export const DriverCard = ({ supir, onPress }: DriverCardProps) => {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <Card className="mb-3">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                            <Typography variant="body1" weight="bold" className="mr-2">
                                {supir.nama}
                            </Typography>
                            {supir.kode && (
                                <View className="bg-gray-100 px-1.5 py-0.5 rounded">
                                    <Typography variant="caption" className="text-gray-500">
                                        {supir.kode}
                                    </Typography>
                                </View>
                            )}
                        </View>

                        <View className="flex-row items-center mt-1">
                            <Badge
                                variant={supir.is_active ? 'success' : 'error'}
                                label={supir.is_active ? 'Aktif' : 'Non-Aktif'}
                            />
                            <Typography variant="caption" className="text-gray-500 ml-3">
                                Bergabung: {new Date(supir.tanggal_bergabung).toLocaleDateString('id-ID')}
                            </Typography>
                        </View>
                    </View>
                </View>

                <View className="flex-row mt-4 pt-4 border-t border-gray-100">
                    <View className="flex-row items-center mr-4">
                        <Phone size={14} color="#6B7280" />
                        <Typography variant="caption" className="text-gray-600 ml-1.5">
                            {supir.telepon || '-'}
                        </Typography>
                    </View>
                    <View className="flex-row items-center">
                        <FileText size={14} color="#6B7280" />
                        <Typography variant="caption" className="text-gray-600 ml-1.5">
                            SIM: {supir.jenis_sim || '-'}
                        </Typography>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );
};
