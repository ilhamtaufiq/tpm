import React, { useState, useEffect } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { Typography } from '../../components/ui/Typography';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldCheck, User, Lock, LogIn, Eye, EyeOff } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useUIStore } from '../../store/useUIStore';
import { Image } from 'react-native';

const navigateByRole = (router: ReturnType<typeof useRouter>, role?: string) => {
    switch (role) {
        case 'ADMIN':
        case 'MANAGER':
            router.replace('/(tabs)/home');
            break;
        case 'BENGKEL':
            router.replace('/bengkel');
            break;
        case 'JASA_ANGKUT':
            router.replace('/jasa-angkut');
            break;
        case 'MOBIL':
            router.replace('/mobil');
            break;
        default:
            router.replace('/(tabs)/home');
    }
};

const getSafeErrorMessage = (error: any, fallback: string): string => {
    if (__DEV__) {
        return error?.response?.data?.detail || fallback;
    }
    return fallback;
};

export default function LoginScreen() {
    const router = useRouter();
    const { isAuthenticated, setAuth } = useAuthStore();
    const { appLogo, appName } = useUIStore();

    useEffect(() => {
        if (isAuthenticated) {
            const user = useAuthStore.getState().user;
            navigateByRole(router, user?.role);
        }
    }, [isAuthenticated]);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            appAlert('Error', 'Username dan password harus diisi');
            return;
        }

        setLoading(true);
        try {
            // Backend uses OAuth2 password flow which expects form data
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await api.post('/auth/login', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const { access_token, user, otp_required, user_id, email } = response.data;

            if (otp_required) {
                router.push({
                    pathname: '/(auth)/otp' as any,
                    params: { user_id, email }
                });
                return;
            }

            setAuth(user, access_token);
            navigateByRole(router, user?.role);
        } catch (error: any) {
            if (__DEV__) {
                console.error('Login error:', error.response?.data || error.message);
            }
            appAlert(
                'Gagal Masuk',
                getSafeErrorMessage(error, 'Username atau password salah')
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-[#F8F9FA]">
            <StatusBar style="light" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Premium Header - Bento Style Rounding */}
                    <View className="bg-primary pt-24 pb-32 px-8 rounded-b-[48px] shadow-2xl items-center justify-center relative overflow-hidden">
                        {/* Decorative Background Elements */}
                        <View className="absolute top-[-50] right-[-50] w-64 h-64 bg-white/5 rounded-full" />
                        <View className="absolute bottom-[-30] left-[-30] w-48 h-48 bg-white/5 rounded-full" />

                        <View className="w-24 h-24 bg-white/10 rounded-[32px] items-center justify-center mb-6 border border-white/20 overflow-hidden">
                            {appLogo ? (
                                <Image source={{ uri: appLogo }} className="w-full h-full" resizeMode="contain" />
                            ) : (
                                <ShieldCheck size={48} color="white" strokeWidth={1.5} />
                            )}
                        </View>

                        <Typography variant="h1" weight="bold" className="text-white text-center leading-tight">
                            {appName}
                        </Typography>
                        <Typography className="text-white/60 text-sm mt-2 font-medium tracking-wide">
                            Manajemen Sistem Terpadu
                        </Typography>
                    </View>

                    {/* Login Card - Bento Style Overlap */}
                    <View className="px-6 -mt-16 mb-8">
                        <View className="bg-white p-8 rounded-[40px] shadow-2xl border border-gray-50">
                            <View className="mb-8">
                                <Typography variant="h2" weight="bold" className="text-primary">Masuk</Typography>
                                <Typography variant="body2" className="text-textGray mt-1">
                                    Akses dashboard manajemen Anda
                                </Typography>
                            </View>

                            <Input
                                label="Username"
                                placeholder="Masukkan username"
                                autoCapitalize="none"
                                value={username}
                                onChangeText={setUsername}
                                startIcon={<User size={18} color="#023C69" opacity={0.6} />}
                                containerClassName="mb-1"
                            />

                            <Input
                                label="Password"
                                placeholder="Masukkan password"
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                                startIcon={<Lock size={18} color="#023C69" opacity={0.6} />}
                                endIcon={
                                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                                        {showPassword ? (
                                            <EyeOff size={18} color="#023C69" opacity={0.6} />
                                        ) : (
                                            <Eye size={18} color="#023C69" opacity={0.6} />
                                        )}
                                    </Pressable>
                                }
                                containerClassName="mb-1"
                            />

                            <Pressable 
                                onPress={() => router.push('/(auth)/forgot-password')}
                                className="items-end mb-4 pr-1"
                            >
                                <Typography variant="caption" weight="medium" className="text-primary/70">
                                    Lupa Password?
                                </Typography>
                            </Pressable>

                            <Button
                                title="Masuk Sekarang"
                                onPress={handleLogin}
                                loading={loading}
                                size="lg"
                                className="mt-4 shadow-lg shadow-primary/30 h-14 rounded-2xl"
                                icon={<LogIn size={20} color="white" />}
                            />
                        </View>
                    </View>

                    {/* Footer */}
                    <View className="flex-1 justify-end pb-10 items-center">
                        <View className="flex-row items-center">
                            <Typography variant="caption" className="text-textGray">BELUM PUNYA AKUN? </Typography>
                            <Typography variant="caption" weight="bold" className="text-primary">HUBUNGI ADMIN</Typography>
                        </View>
                        <Typography variant="caption" className="text-gray-300 mt-2 text-[10px] tracking-normal">v1.0.0 © 2025 TPM GROUP</Typography>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

