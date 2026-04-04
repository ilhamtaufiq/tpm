import React from 'react';
import { View, ScrollView, Pressable, Image, Platform, Dimensions } from 'react-native';
import { Typography } from '../components/ui/Typography';
import { useUIStore } from '../store/useUIStore';
import { router, useLocalSearchParams } from 'expo-router';
import { Smartphone, ShieldCheck, Zap, BarChart3, ChevronRight, Layout, Moon, MonitorOff } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function LandingPage() {
    const { themeColors } = useUIStore();
    const params = useLocalSearchParams();
    const isMobileOnly = params.reason === 'mobile_only';

    const features = [
        {
            title: "Manajemen Cerdas",
            description: "Kelola bengkel, jasa angkut, dan jual beli mobil dalam satu genggaman.",
            icon: <Layout size={24} color="#6366F1" />,
            bgColor: "bg-indigo-50"
        },
        {
            title: "Keamanan Tinggi",
            description: "Proteksi data dengan enkripsi standar industri dan akses biometrik.",
            icon: <ShieldCheck size={24} color="#10B981" />,
            bgColor: "bg-emerald-50"
        },
        {
            title: "Performa Cepat",
            description: "Arsitektur modern yang memastikan aplikasi tetap responsif di segala kondisi.",
            icon: <Zap size={24} color="#F59E0B" />,
            bgColor: "bg-amber-50"
        },
        {
            title: "Analitik Realtime",
            description: "Pantau omzet dan performa bisnis Anda secara langsung tanpa tunda.",
            icon: <BarChart3 size={24} color="#3B82F6" />,
            bgColor: "bg-blue-50"
        }
    ];

    return (
        <ScrollView className="flex-1 bg-[#FAFAFA]" showsVerticalScrollIndicator={false}>
            {/* HER0 SECTION */}
            <View className="relative overflow-hidden pt-20 pb-32">
                <LinearGradient
                    colors={['#4F46E5', '#312E81']}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: width > 768 ? 600 : 500,
                        borderBottomLeftRadius: 64,
                        borderBottomRightRadius: 64,
                    }}
                />

                <View className="px-6 items-center">
                    <View className="bg-white/10 px-4 py-2 rounded-full border border-white/20 mb-8 backdrop-blur-md">
                        <Typography className="text-white text-xs font-bold tracking-widest uppercase">The Next Gen Super App</Typography>
                    </View>

                    <Typography weight="bold" className="text-white text-center text-4xl md:text-6xl mb-6 tracking-tight">
                        TPM{"\n"}Tiga Putra Motor
                    </Typography>

                    <Typography className="text-white/70 text-center text-lg max-w-2xl mb-10 leading-relaxed">
                        Solusi digital terintegrasi untuk mengelola bisnis Bengkel, Jasa Angkut, dan Jual Beli Mobil dengan standar efisiensi tertinggi.
                    </Typography>

                    {isMobileOnly && (
                        <View className="bg-rose-500/20 border border-rose-500/30 p-6 rounded-[32px] mb-10 max-w-xl flex-row items-center backdrop-blur-xl">
                            <View className="w-14 h-14 bg-rose-500 rounded-2xl items-center justify-center mr-5 shadow-lg shadow-rose-500/50">
                                <MonitorOff size={30} color="white" />
                            </View>
                            <View className="flex-1">
                                <Typography weight="bold" className="text-white text-lg mb-1">Akses Web Dinonaktifkan</Typography>
                                <Typography className="text-white/80 text-sm leading-snug">
                                    Admin telah membatasi akses aplikasi ini hanya melalui perangkat mobile.
                                </Typography>
                            </View>
                        </View>
                    )}

                    <View className="flex-row gap-4">
                        <Pressable
                            onPress={() => router.push('/(auth)/login')}
                            className="bg-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-900/40 flex-row items-center active:scale-95 transition-transform"
                        >
                            <Typography weight="bold" className="text-indigo-700 mr-2">Buka Aplikasi</Typography>
                            <ChevronRight size={18} color="#4338CA" />
                        </Pressable>

                        <Pressable className="bg-white/10 border border-white/20 px-8 py-4 rounded-2xl backdrop-blur-md active:scale-95 transition-transform">
                            <Typography weight="bold" className="text-white">Pelajari Fitur</Typography>
                        </Pressable>
                    </View>
                </View>
            </View>

            {/* FEATURES GRID */}
            <View className="px-6 -mt-16 mb-20">
                <View className="flex-row flex-wrap gap-4 justify-between">
                    {features.map((feature, i) => (
                        <View
                            key={i}
                            style={{ width: width > 768 ? '48%' : '100%' }}
                            className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 mb-2"
                        >
                            <View className={`w-14 h-14 ${feature.bgColor} rounded-2xl items-center justify-center mb-6`}>
                                {feature.icon}
                            </View>
                            <Typography weight="bold" className="text-gray-900 text-xl mb-3">{feature.title}</Typography>
                            <Typography className="text-gray-500 leading-relaxed text-[15px]">
                                {feature.description}
                            </Typography>
                        </View>
                    ))}
                </View>
            </View>

            {/* APP PREVIEW SECTION */}
            <View className="bg-white py-24 px-6 overflow-hidden">
                <View className="max-w-4xl mx-auto items-center">
                    <Typography weight="bold" className="text-gray-900 text-3xl text-center mb-6">Optimalkan Bisnis dari Genggaman</Typography>
                    <Typography className="text-gray-500 text-center mb-16 text-lg max-w-xl">
                        Didesain untuk kecepatan dan kemudahan akses. Nikmati pengalaman bento-style dashboard yang cantik di setiap perangkat Anda.
                    </Typography>

                    <View className="bg-indigo-50/50 p-4 rounded-[64px] border border-indigo-100">
                        {/* We will use the generated image here if it was a real asset, but for now we simulate a premium UI preview */}
                        <View className="w-full aspect-[16/10] bg-white rounded-[44px] shadow-2xl items-center justify-center border border-white overflow-hidden">
                            {/* Simulation of a premium mobile mockup */}
                            <Smartphone size={100} color="#6366F1" opacity={0.1} />
                        </View>
                    </View>
                </View>
            </View>

            {/* FOOTER */}
            <View className="py-20 px-6 items-center">
                <View className="mb-6 items-center flex-row">
                    <Image
                        source={require('../assets/logo_tpm.png')}
                        style={{ width: 60, height: 60 }}
                        resizeMode="contain"
                    />
                </View>
                <Typography weight="bold" className="text-gray-900 text-xl mb-4">Tiga Putra Motor</Typography>
                <Typography className="text-gray-400 text-sm mb-12">© 2026 TPM Super App. All rights reserved.</Typography>

                <View className="flex-row gap-8">
                    <Typography className="text-indigo-600 font-bold">Privacy Policy</Typography>
                    <Typography className="text-indigo-600 font-bold">Terms of Service</Typography>
                </View>
            </View>
        </ScrollView >
    );
}
