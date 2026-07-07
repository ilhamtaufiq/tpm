import React from 'react';
import { Pressable, View } from 'react-native';
import { Smartphone, MonitorSmartphone, RotateCw } from 'lucide-react-native';
import { Typography } from './Typography';
import { type OrientationLockMode } from '../../store/useUIStore';
import { useOrientationLock } from '../../hooks/useOrientationLock';
import { useResponsive } from '../../hooks/useResponsive';

const OPTIONS: { id: OrientationLockMode; label: string; hint: string }[] = [
    { id: 'auto', label: 'Auto', hint: 'Ikuti rotasi perangkat' },
    { id: 'portrait', label: 'Portrait', hint: 'Kunci vertikal' },
    { id: 'landscape', label: 'Landscape', hint: 'Kunci horizontal' },
];

interface OrientationControlProps {
    compact?: boolean;
}

export const OrientationControl = ({ compact = false }: OrientationControlProps) => {
    const { orientationLock, setOrientationLock, cycleOrientation } = useOrientationLock();
    const { orientation, isLandscape } = useResponsive();

    if (compact) {
        return (
            <Pressable
                onPress={cycleOrientation}
                className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100 active:bg-gray-100"
            >
                <View className="w-10 h-10 bg-indigo-50 rounded-xl items-center justify-center mr-3">
                    <RotateCw size={20} color="#6366F1" />
                </View>
                <View className="flex-1">
                    <Typography variant="body2" weight="bold" className="text-text">
                        Orientasi: {OPTIONS.find((o) => o.id === orientationLock)?.label}
                    </Typography>
                    <Typography variant="caption" className="text-text/40">
                        Saat ini {isLandscape ? 'landscape' : 'portrait'} • Ketuk untuk ganti
                    </Typography>
                </View>
            </Pressable>
        );
    }

    return (
        <View className="bg-surface p-5 rounded-[40px] border border-gray-50 shadow-sm">
            <View className="flex-row items-center mb-4">
                <View className="w-12 h-12 bg-indigo-50 rounded-[20px] items-center justify-center mr-4">
                    <MonitorSmartphone size={24} color="#6366F1" />
                </View>
                <View className="flex-1">
                    <Typography variant="body1" weight="bold" className="text-text mb-0.5">
                        Orientasi Layar
                    </Typography>
                    <Typography variant="caption" className="text-text/40">
                        Aktif: {orientation === 'landscape' ? 'Landscape' : 'Portrait'}
                    </Typography>
                </View>
            </View>

            <View className="flex-row gap-2">
                {OPTIONS.map((option) => {
                    const active = orientationLock === option.id;
                    return (
                        <Pressable
                            key={option.id}
                            onPress={() => setOrientationLock(option.id)}
                            className={`flex-1 rounded-2xl px-3 py-3 border items-center ${
                                active ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'
                            }`}
                        >
                            <View style={option.id === 'landscape' ? { transform: [{ rotate: '90deg' }] } : undefined}>
                                <Smartphone size={18} color={active ? '#6366F1' : '#9CA3AF'} />
                            </View>
                            <Typography
                                variant="caption"
                                weight={active ? 'bold' : 'medium'}
                                className={`mt-1.5 ${active ? 'text-indigo-600' : 'text-text/50'}`}
                            >
                                {option.label}
                            </Typography>
                        </Pressable>
                    );
                })}
            </View>

            <Typography variant="caption" className="text-text/30 mt-3 text-center">
                {OPTIONS.find((o) => o.id === orientationLock)?.hint}
            </Typography>
        </View>
    );
};