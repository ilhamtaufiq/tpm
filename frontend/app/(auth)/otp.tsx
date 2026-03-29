import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert, Dimensions, Pressable } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../utils/api';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

export default function OTPScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { setAuth } = useAuthStore();
    
    const { user_id, email } = params;
    
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const handleVerify = async () => {
        if (otp.length < 4) {
            Alert.alert('Error', 'Silakan masukkan kode OTP yang valid');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/verify-otp', {
                user_id: parseInt(user_id as string),
                otp_code: otp,
            });

            const { access_token, user } = response.data;
            setAuth(user, access_token);
            router.replace('/(tabs)/home');
        } catch (error: any) {
            console.error('OTP verification error:', error.response?.data || error.message);
            Alert.alert(
                'Gagal',
                error.response?.data?.detail || 'Kode OTP salah atau sudah kadaluarsa'
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
                            <ShieldAlert size={40} color="white" strokeWidth={1.5} />
                        </View>

                        <Typography variant="h2" weight="bold" className="text-white text-center leading-tight">
                            Verifikasi OTP
                        </Typography>
                        <Typography className="text-white/60 text-sm mt-2 font-medium text-center px-4">
                            Masukkan kode 6 digit yang telah kami kirimkan ke email {email}.
                        </Typography>
                    </View>

                    <View className="px-6 -mt-16 mb-8">
                        <View className="bg-white p-8 rounded-[40px] shadow-2xl border border-gray-50">
                            <Typography variant="body1" weight="bold" className="text-primary mb-6 text-center uppercase tracking-widest">
                                KODE KEAMANAN
                            </Typography>
                            
                            <Input
                                placeholder="000 000"
                                keyboardType="number-pad"
                                autoFocus
                                value={otp}
                                onChangeText={setOtp}
                                className="text-center text-3xl font-bold tracking-[10px]"
                                containerClassName="mb-8"
                                maxLength={6}
                            />

                            <Button
                                title="Verifikasi & Masuk"
                                onPress={handleVerify}
                                loading={loading}
                                size="lg"
                                className="shadow-lg shadow-primary/30 h-14 rounded-2xl"
                                icon={<CheckCircle2 size={20} color="white" />}
                            />
                            
                            <Pressable 
                                onPress={() => router.back()}
                                className="mt-6 items-center"
                            >
                                <Typography variant="caption" weight="bold" className="text-textGray">
                                    BUKAN AKUN ANDA? <Typography variant="caption" weight="bold" className="text-primary">KEMBALI KE LOGIN</Typography>
                                </Typography>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
