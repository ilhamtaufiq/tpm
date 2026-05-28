import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions, Pressable } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../utils/api';
import { Lock, Eye, EyeOff, Save, CheckCircle } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { token } = useLocalSearchParams();
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleResetPassword = async () => {
        if (!password || !confirmPassword) {
            Alert.alert('Error', 'Semua field harus diisi');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Password konfirmasi tidak cocok');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password minimal 6 karakter');
            return;
        }

        if (!token) {
            Alert.alert('Error', 'Token tidak valid atau tidak ditemukan');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/reset-password', {
                token: Array.isArray(token) ? token[0] : token,
                new_password: password
            });
            setSuccess(true);
        } catch (error: any) {
            console.error('Reset password error:', error.response?.data || error.message);
            Alert.alert(
                'Gagal',
                error.response?.data?.detail || 'Gagal mereset password. Token mungkin sudah kadaluarsa.'
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
                    <View className="bg-primary pt-24 pb-32 px-8 rounded-b-[48px] shadow-2xl items-center relative overflow-hidden">
                        <View className="absolute top-[-50] right-[-50] w-64 h-64 bg-white/5 rounded-full" />
                        <View className="absolute bottom-[-30] left-[-30] w-48 h-48 bg-white/5 rounded-full" />

                        <View className="w-20 h-20 bg-white/10 rounded-[28px] items-center justify-center mb-6 border border-white/20">
                            <Lock size={40} color="white" strokeWidth={1.5} />
                        </View>

                        <Typography variant="h2" weight="bold" className="text-white text-center leading-tight">
                            Atur Ulang Password
                        </Typography>
                        <Typography className="text-white/60 text-sm mt-2 font-medium text-center px-4">
                            Silakan masukkan password baru Anda untuk mengamankan kembali akun Anda.
                        </Typography>
                    </View>

                    <View className="px-6 -mt-16 mb-8">
                        <View className="bg-white p-8 rounded-[40px] shadow-2xl border border-gray-50">
                            {success ? (
                                <View className="items-center py-4">
                                    <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
                                        <CheckCircle size={30} color="#10B981" />
                                    </View>
                                    <Typography variant="h3" weight="bold" className="text-center text-primary mb-2">Password Diperbarui!</Typography>
                                    <Typography variant="body2" className="text-center text-textGray mb-6">
                                        Password Anda telah berhasil diperbarui. Silakan login kembali dengan password baru Anda.
                                    </Typography>
                                    <Button
                                        title="Kembali ke Login"
                                        onPress={() => router.replace('/login')}
                                        className="w-full rounded-2xl h-14"
                                    />
                                </View>
                            ) : (
                                <View>
                                    <Input
                                        label="Password Baru"
                                        placeholder="Masukkan password baru"
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

                                    <Input
                                        label="Konfirmasi Password"
                                        placeholder="Masukkan kembali password baru"
                                        secureTextEntry={!showPassword}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        startIcon={<Lock size={18} color="#023C69" opacity={0.6} />}
                                        containerClassName="mb-8"
                                    />

                                    <Button
                                        title="Simpan Password Baru"
                                        onPress={handleResetPassword}
                                        loading={loading}
                                        size="lg"
                                        className="shadow-lg shadow-primary/30 h-14 rounded-2xl"
                                        icon={<Save size={20} color="white" />}
                                    />
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
