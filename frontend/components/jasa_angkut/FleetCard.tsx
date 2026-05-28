import React from 'react';
import { View, Pressable } from 'react-native';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { Badge } from '../ui/Badge';
import { Armada } from '../../services/jasaAngkut';
import { Truck, Info } from 'lucide-react-native';

interface FleetCardProps {
    armada: Armada;
    onPress?: () => void;
}

export const FleetCard = ({ armada, onPress }: FleetCardProps) => {
    return (
        <Pressable 
            onPress={onPress} 
            style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1
            })}
        >
            <Card className="mb-3">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                            <Typography variant="body1" weight="bold" className="mr-2">
                                {armada.nama}
                            </Typography>
                            <View className="bg-primary/10 px-2 py-0.5 rounded">
                                <Typography variant="caption" weight="bold" className="text-primary">
                                    {armada.nopol}
                                </Typography>
                            </View>
                        </View>

                        <View className="flex-row items-center mt-1">
                            <Badge
                                variant={armada.is_active ? 'success' : 'error'}
                                label={armada.is_active ? 'Aktif' : 'Non-Aktif'}
                            />
                            {armada.jenis && (
                                <Typography variant="caption" className="text-gray-500 ml-3">
                                    Tipe: {armada.jenis}
                                </Typography>
                            )}
                        </View>
                    </View>
                    <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center">
                        <Truck size={20} color="#6B7280" />
                    </View>
                </View>

                {armada.catatan && (
                    <View className="mt-4 pt-3 border-t border-gray-50 flex-row items-start">
                        <Info size={14} color="#9CA3AF" className="mt-0.5" />
                        <Typography variant="caption" className="text-gray-500 ml-2 italic flex-1">
                            {armada.catatan}
                        </Typography>
                    </View>
                )}
            </Card>
        </Pressable>
    );
};
