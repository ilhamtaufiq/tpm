import { appAlert } from '../../utils/appAlert';
import React, { useState, useEffect, useRef } from 'react';
import { View, KeyboardAvoidingView, Platform, ScrollView, Dimensions, Pressable } from 'react-native';
import { Typography } from '../../components/ui/Typography';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useRouter, useLocalSearchParams } from 'expo-router';
import api from '../../utils/api';
import { useAuthStore } from '../../store/useAuthStore';
import { getErrorMessage } from '../../utils/error';
import { ShieldAlert, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

export default function OTPScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { setAuth } = useAuthStore();

    const { user_id, email } = params;

    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const startCooldown = () => {
        setCooldown(30);
        intervalRef.current = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleResend = async () => {
        if (cooldown > 0) return;

        const parsedUserId = parseInt(user_id as string, 10);
        if (isNaN(parsedUserId)) {
            appAlert('Error', 'ID pengguna tidak valid');
            return;
        }

        try {
            await api.post('/auth/resend-otp', { user_id: parsedUserId });
            appAlert('Berhasil', 'Kode OTP telah dikirim ulang');
            startCooldown();
        } catch (error: any) {
            if (__DEV__) {
                console.error('Resend OTP error:', error.response?.data || error.message);
            }
            appAlert('Gagal', 'Gagal mengirim ulang kode OTP');
        }
    };

    const handleVerify = async () => {
        if (otp.length !== 6) {
            appAlert('Error', 'Kode OTP harus 6 digit');
            return;
        }

        const parsedUserId = parseInt(user_id as string, 10);
        if (isNaN(parsedUserId)) {
            appAlert('Error', 'ID pengguna tidak valid');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/verify-otp', {
                user_id: parsedUserId,
                otp_code: otp,
            });

            const { access_token, user } = response.data;
            setAuth(user, access_token);
            // `/` saja — app/index.tsx sudah merutekan per-role.
            router.replace('/');
        } catch (error: any) {
            if (__DEV__) {
                console.error('OTP verification error:', error.response?.data || error.message);
            }
            appAlert('Gagal', getErrorMessage(error, 'Kode OTP salah atau sudah kadaluarsa'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-background w-full">
            <StatusBar style="light" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1 w-full"
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                    className="w-full"
                >
                    <View className="w-full bg-primary pt-20 pb-28 px-6 rounded-b-[48px] shadow-2xl items-center relative overflow-hidden">
                        <View className="absolute top-[-50] right-[-50] w-64 h-64 bg-white/5 rounded-full" />
                        <View className="absolute bottom-[-30] left-[-30] w-48 h-48 bg-white/5 rounded-full" />

                        <Pressable
                            onPress={() => router.replace('/(auth)/login')}
                            className="absolute top-12 left-5 p-2.5 rounded-full bg-white/10 border border-white/20 z-10"
                        >
                            <ArrowLeft size={22} color="white" />
                        </Pressable>

                        <View className="w-20 h-20 bg-white/10 rounded-[28px] items-center justify-center mb-4 border border-white/20">
                            <ShieldAlert size={40} color="white" strokeWidth={1.5} />
                        </View>

                        <Typography variant="h2" weight="bold" className="text-white text-center leading-tight">
                            Verifikasi OTP
                        </Typography>
                        <Typography className="text-white/80 text-sm mt-2 font-medium text-center px-4 leading-relaxed">
                            Masukkan 6 digit kode yang telah dikirim ke email:{'\n'}
                            <Typography weight="bold" className="text-white text-sm">
                                {email || 'Anda'}
                            </Typography>
                        </Typography>
                    </View>

                    <View className="w-full px-6 -mt-14 mb-8 items-center">
                        <View className="w-full bg-surface p-7 rounded-[36px] shadow-2xl border border-border/50">
                            <Typography variant="body2" weight="bold" className="text-textGray mb-4 text-center uppercase tracking-widest text-xs">
                                KODE KEAMANAN
                            </Typography>

                            <Input
                                placeholder="000000"
                                keyboardType="number-pad"
                                autoFocus
                                value={otp}
                                onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, ''))}
                                className="text-center text-3xl font-bold text-text"
                                style={[{ letterSpacing: 8, outlineStyle: 'none' } as any]}
                                innerContainerClassName="bg-background border-border py-3 rounded-2xl w-full"
                                containerClassName="mb-6 w-full"
                                maxLength={6}
                            />

                            <Button
                                title="Verifikasi & Masuk"
                                onPress={handleVerify}
                                loading={loading}
                                size="lg"
                                className="shadow-lg shadow-primary/30 h-14 rounded-2xl w-full"
                                icon={<CheckCircle2 size={20} color="white" />}
                            />

                            <View className="mt-6 gap-y-3 items-center w-full">
                                <Pressable
                                    onPress={handleResend}
                                    disabled={cooldown > 0}
                                    className="py-1 items-center"
                                >
                                    <Typography variant="caption" weight="bold" className="text-textGray text-xs text-center">
                                        TIDAK MENERIMA KODE?{' '}
                                        <Typography variant="caption" weight="bold" className={cooldown > 0 ? 'text-textGray/50' : 'text-primary'}>
                                            {cooldown > 0 ? `KIRIM ULANG (${cooldown}s)` : 'KIRIM ULANG'}
                                        </Typography>
                                    </Typography>
                                </Pressable>

                                <Pressable
                                    onPress={() => router.replace('/(auth)/login')}
                                    className="py-1 items-center"
                                >
                                    <Typography variant="caption" weight="bold" className="text-textGray text-xs text-center">
                                        BUKAN AKUN ANDA? <Typography variant="caption" weight="bold" className="text-primary">KEMBALI KE LOGIN</Typography>
                                    </Typography>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
