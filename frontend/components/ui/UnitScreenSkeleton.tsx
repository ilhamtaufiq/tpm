import React from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from './Typography';

/** Instant placeholder while lazy unit screens (bengkel/mobil/angkut) load. */
export function UnitScreenSkeleton({ title = 'Memuat…' }: { title?: string }) {
    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <View className="px-5 pt-4 pb-3 border-b border-gray-100">
                <Typography weight="bold" className="text-lg text-gray-900">
                    {title}
                </Typography>
                <Typography className="text-xs text-gray-400 mt-0.5">Menyiapkan layar…</Typography>
            </View>
            <View className="px-5 mt-4 flex-row flex-wrap gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <View key={i} className="w-[30%] h-20 rounded-2xl bg-gray-100" />
                ))}
            </View>
            <View className="mx-5 mt-6 h-28 rounded-3xl bg-gray-100" />
            <View className="mx-5 mt-4 h-16 rounded-2xl bg-gray-50" />
            <View className="mx-5 mt-3 h-16 rounded-2xl bg-gray-50" />
            <View className="flex-1 items-center justify-center pb-20">
                <ActivityIndicator size="large" color="#023C69" />
            </View>
        </SafeAreaView>
    );
}
