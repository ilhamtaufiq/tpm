import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions, Pressable } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useRouter } from 'expo-router';
import api from '../../utils/api';
import { Mail, ArrowLeft, Send } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleForgotPassword = async () => {
        if (!email) {
            Alert.alert('Error', 'Email harus diisi');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (error: any) {
            console.error('Forgot password error:', error.response?.data || error.message);
            Alert.alert(
                'Gagal',
                error.response?.data?.detail || 'Gagal mengirim email reset password'
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

                        <Pressable 
                            onPress={() => router.back()}
                            className="absolute top-16 left-6 p-2 rounded-full bg-white/10"
                        >
                            <ArrowLeft size={24} color="white" />
                        </Pressable>

                        <View className="w-20 h-20 bg-white/10 rounded-[28px] items-center justify-center mb-6 border border-white/20">
                            <Mail size={40} color="white" strokeWidth={1.5} />
                        </View>

                        <Typography variant="h2" weight="bold" className="text-white text-center leading-tight">
                            Lupa Password
                        </Typography>
                        <Typography className="text-white/60 text-sm mt-2 font-medium text-center">
                            Masukkan email Anda untuk menerima link reset password
                        </Typography>
                    </View>

                    <View className="px-6 -mt-16 mb-8">
                        <View className="bg-white p-8 rounded-[40px] shadow-2xl border border-gray-50">
                            {sent ? (
                                <View className="items-center py-4">
                                    <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
                                        <Send size={30} color="#10B981" />
                                    </View>
                                    <Typography variant="h3" weight="bold" className="text-center text-primary mb-2">Email Terkirim!</Typography>
                                    <Typography variant="body2" className="text-center text-textGray mb-6">
                                        Jika email tersebut terdaftar di sistem kami, Anda akan segera menerima instruksi untuk mereset password.
                                    </Typography>
                                    <Button
                                        title="Kembali ke Login"
                                        onPress={() => router.replace('/login')}
                                        variant="outline"
                                        className="w-full rounded-2xl h-14"
                                    />
                                </View>
                            ) : (
                                <View>
                                    <Input
                                        label="Email"
                                        placeholder="user@example.com"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                        startIcon={<Mail size={18} color="#023C69" opacity={0.6} />}
                                        containerClassName="mb-6"
                                    />

                                    <Button
                                        title="Kirim Link Reset"
                                        onPress={handleForgotPassword}
                                        loading={loading}
                                        size="lg"
                                        className="shadow-lg shadow-primary/30 h-14 rounded-2xl"
                                        icon={<Send size={20} color="white" />}
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
