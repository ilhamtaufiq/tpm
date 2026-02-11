import React, { useState, useEffect } from 'react';
import { View, Image, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function LoginScreen() {
    const router = useRouter();
    const { isAuthenticated, setAuth } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/(tabs)/home');
        }
    }, [isAuthenticated]);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert('Error', 'Username dan password harus diisi');
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

            const { access_token, user } = response.data;
            setAuth(user, access_token);

            router.replace('/(tabs)/home');
        } catch (error: any) {
            console.error('Login error:', error.response?.data || error.message);
            Alert.alert(
                'Gagal Masuk',
                error.response?.data?.detail || 'Username atau password salah'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-surface">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                    <View className="flex-1 px-6 justify-center">
                        <View className="items-center mb-10">
                            <View className="w-20 h-20 bg-primary rounded-3xl items-center justify-center shadow-lg">
                                <Typography variant="h1" className="text-white font-bold">T</Typography>
                            </View>
                            <Typography variant="h1" weight="bold" className="mt-4 text-primary">Tiga Putra Motor</Typography>
                            <Typography variant="body2" className="text-textGray">Manajemen Bisnis dalam Satu Genggaman</Typography>
                        </View>

                        <Card className="p-6">
                            <Typography variant="h2" weight="bold" className="mb-6">Masuk</Typography>

                            <Input
                                label="Username"
                                placeholder="Masukkan username Anda"
                                autoCapitalize="none"
                                value={username}
                                onChangeText={setUsername}
                            />

                            <Input
                                label="Password"
                                placeholder="Masukkan password Anda"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />

                            <Button
                                title="Masuk Sekarang"
                                onPress={handleLogin}
                                loading={loading}
                                className="mt-4"
                            />
                        </Card>

                        <View className="mt-8 items-center">
                            <Typography variant="caption">Belum punya akun? Hubungi Admin</Typography>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
