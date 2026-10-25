import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, TextInput, StatusBar, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import Server from 'lucide-react-native/dist/esm/icons/server.js';
import Mail from 'lucide-react-native/dist/esm/icons/mail.js';
import Lock from 'lucide-react-native/dist/esm/icons/lock.js';
import User from 'lucide-react-native/dist/esm/icons/user.js';
import Save from 'lucide-react-native/dist/esm/icons/save.js';
import Send from 'lucide-react-native/dist/esm/icons/send.js';
import ShieldCheck from 'lucide-react-native/dist/esm/icons/shield-check.js';
import Info from 'lucide-react-native/dist/esm/icons/info.js';
import Eye from 'lucide-react-native/dist/esm/icons/eye.js';
import EyeOff from 'lucide-react-native/dist/esm/icons/eye-off.js';
import CheckCircle2 from 'lucide-react-native/dist/esm/icons/circle-check.js';
import XCircle from 'lucide-react-native/dist/esm/icons/circle-x.js';
import AlertTriangle from 'lucide-react-native/dist/esm/icons/triangle-alert.js';
import Clock from 'lucide-react-native/dist/esm/icons/clock.js';
import { format } from 'date-fns/format';
import { id as localeID } from 'date-fns/locale/id';
import { Typography } from '../../components/ui/Typography';
import { Header } from '../../components/ui/Header';
import { useUIStore } from '../../store/useUIStore';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { settingsService, SMTPErrorCode, SMTPStatus } from '../../services/settings';
import { getErrorMessage } from '../../utils/error';

type PresetKey = 'gmail' | 'outlook' | 'custom';

const PRESETS: Record<Exclude<PresetKey, 'custom'>, { label: string; server: string; port: string; tls: boolean; hint: string }> = {
    gmail: {
        label: 'Gmail',
        server: 'smtp.gmail.com',
        port: '587',
        tls: true,
        hint: 'Pakai App Password 16 digit dari Akun Google (verifikasi 2 langkah harus aktif). Password Gmail biasa tidak diterima.',
    },
    outlook: {
        label: 'Outlook / Office 365',
        server: 'smtp.office365.com',
        port: '587',
        tls: true,
        hint: 'Pakai password akun. Jika akun memakai verifikasi 2 langkah, buat App Password di pengaturan keamanan Microsoft.',
    },
};

// Saran tindakan per penyebab, supaya admin tahu harus memperbaiki apa.
const SARAN: Record<SMTPErrorCode, string> = {
    OK: '',
    NOT_CONFIGURED: 'Isi form di bawah, lalu tekan Simpan & Tes.',
    AUTH_FAILED: 'Periksa username dan App Password. Server email tidak menerima password akun biasa untuk Gmail.',
    CONNECTION_FAILED: 'Periksa alamat server dan port. Pastikan server ini bisa dijangkau dari jaringan aplikasi.',
    TLS_FAILED: 'Coba port 587 dengan TLS aktif.',
    SEND_FAILED: 'Periksa alamat pengirim dan batas kirim akun email.',
};

type TestOutcome = { ok: boolean; code: SMTPErrorCode | null; message: string };

const formatWaktu = (iso: string | null) => {
    if (!iso) return '';
    try {
        return format(new Date(iso), 'dd MMM yyyy, HH:mm', { locale: localeID });
    } catch {
        return '';
    }
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <View className="mb-5">
            <Typography variant="caption" className="text-textGray mb-2 ml-1">{label}</Typography>
            {children}
            {hint ? <Typography variant="caption" className="text-textGray/70 mt-1.5 ml-1">{hint}</Typography> : null}
        </View>
    );
}

function InputRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <View className="flex-row items-center bg-background h-14 rounded-2xl px-4 border border-transparent">
            {icon}
            {children}
        </View>
    );
}

export default function SMTPSettingsScreen() {
    const themeColors = useUIStore((s) => s.themeColors);

    const [preset, setPreset] = useState<PresetKey>('gmail');
    const [server, setServer] = useState(PRESETS.gmail.server);
    const [port, setPort] = useState(PRESETS.gmail.port);
    const [useTLS, setUseTLS] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [senderName, setSenderName] = useState('TPM Business');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [status, setStatus] = useState<SMTPStatus | null>(null);
    const [testOutcome, setTestOutcome] = useState<TestOutcome | null>(null);
    const [dialog, setDialog] = useState({ visible: false, title: '', message: '', variant: 'info' as 'success' | 'error' | 'warning' | 'info' });

    const tampilkanDialog = (title: string, message: string, variant: typeof dialog.variant) =>
        setDialog({ visible: true, title, message, variant });

    const muatStatus = async () => {
        try {
            setStatus(await settingsService.getSmtpStatus());
        } catch {
            setStatus(null);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const data = await settingsService.getSettings();
                if (data?.smtp) {
                    setServer(data.smtp.server || PRESETS.gmail.server);
                    setPort(data.smtp.port ? String(data.smtp.port) : '587');
                    setUsername(data.smtp.username || '');
                    setPassword(data.smtp.password || '');
                    setSenderName(data.smtp.sender_name || 'TPM Business');
                    setUseTLS(data.smtp.use_tls ?? true);
                    const cocok = (Object.keys(PRESETS) as Array<keyof typeof PRESETS>).find((k) => PRESETS[k].server === data.smtp?.server);
                    setPreset(cocok ?? 'custom');
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
            } finally {
                setIsLoading(false);
            }
            await muatStatus();
        })();
    }, []);

    const pilihPreset = (key: Exclude<PresetKey, 'custom'>) => {
        setPreset(key);
        setServer(PRESETS[key].server);
        setPort(PRESETS[key].port);
        setUseTLS(PRESETS[key].tls);
        setTestOutcome(null);
    };

    const bisaDiisi = () => {
        const portNum = parseInt(port, 10);
        if (!server.trim() || !username.trim() || !password) {
            tampilkanDialog('Data Belum Lengkap', 'Isi server, username, dan password SMTP.', 'warning');
            return false;
        }
        if (!portNum || portNum < 1 || portNum > 65535) {
            tampilkanDialog('Port Tidak Valid', 'Port harus angka antara 1 sampai 65535.', 'warning');
            return false;
        }
        return true;
    };

    const konfigurasi = () => ({
        server: server.trim(),
        port: parseInt(port, 10),
        username: username.trim(),
        password,
        sender_name: senderName.trim() || 'TPM Business',
        use_tls: useTLS,
    });

    const jalankanTes = async () => {
        setIsTesting(true);
        setTestOutcome(null);
        try {
            const res = await settingsService.testSMTP(konfigurasi());
            setTestOutcome({ ok: res.success, code: res.code, message: res.message });
        } catch (error) {
            setTestOutcome({ ok: false, code: null, message: getErrorMessage(error, 'Tidak bisa menghubungi server aplikasi.') });
        } finally {
            setIsTesting(false);
        }
    };

    const handleTesSaja = async () => {
        if (!bisaDiisi()) return;
        await jalankanTes();
        await muatStatus();
    };

    const handleSimpan = async (laluTes: boolean) => {
        if (!bisaDiisi()) return;
        setIsSaving(true);
        try {
            await settingsService.updateSettings({ smtp: konfigurasi() });
        } catch (error) {
            tampilkanDialog('Gagal Menyimpan', getErrorMessage(error, 'Terjadi kesalahan saat menyimpan pengaturan.'), 'error');
            setIsSaving(false);
            return;
        }
        setIsSaving(false);
        if (laluTes) {
            await jalankanTes();
            await muatStatus();
        } else {
            tampilkanDialog('Tersimpan', 'Pengaturan SMTP disimpan. Tekan Tes Koneksi untuk memastikan email bisa terkirim.', 'success');
            await muatStatus();
        }
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-background items-center justify-center">
                <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
        );
    }

    const bannerTone = status?.ok === true ? 'ok' : status?.ok === false ? 'error' : 'unknown';
    const bannerStyle = {
        ok: { box: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', sub: 'text-emerald-700/80', Icon: CheckCircle2, iconColor: '#10B981', judul: 'Email aktif' },
        error: { box: 'bg-red-50 border-red-100', text: 'text-red-700', sub: 'text-red-700/80', Icon: XCircle, iconColor: '#DC2626', judul: 'Email tidak bisa dikirim' },
        unknown: { box: 'bg-amber-50 border-amber-100', text: 'text-amber-700', sub: 'text-amber-700/80', Icon: AlertTriangle, iconColor: '#D97706', judul: 'Belum pernah diuji' },
    }[bannerTone];

    const saranStatus = status?.code ? SARAN[status.code] : '';

    return (
        <View className="flex-1 bg-background">
            <StatusBar barStyle="dark-content" />

            <Header title="Server Email" showBackButton showProfile={false} showBell={false} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 160 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Status terakhir */}
                    <View className={`p-5 rounded-[24px] border mb-5 ${bannerStyle.box}`}>
                        <View className="flex-row items-center">
                            <bannerStyle.Icon size={20} color={bannerStyle.iconColor} />
                            <Typography weight="bold" className={`ml-2 ${bannerStyle.text}`}>{bannerStyle.judul}</Typography>
                        </View>
                        {status?.message ? (
                            <Typography className={`mt-2 text-sm ${bannerStyle.sub}`}>{status.message}</Typography>
                        ) : (
                            <Typography className={`mt-2 text-sm ${bannerStyle.sub}`}>
                                Tekan Tes Koneksi atau Simpan & Tes. Kode OTP login tidak bisa dikirim sebelum email aktif.
                            </Typography>
                        )}
                        {status?.ok === false && saranStatus ? (
                            <Typography className={`mt-2 text-xs ${bannerStyle.sub}`}>{saranStatus}</Typography>
                        ) : null}
                        {status?.checked_at ? (
                            <View className="flex-row items-center mt-3">
                                <Clock size={12} color="#6B7280" />
                                <Typography variant="caption" className="text-textGray ml-1">Terakhir dicek {formatWaktu(status.checked_at)}</Typography>
                            </View>
                        ) : null}
                    </View>

                    {/* Penyedia */}
                    <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-[3px] mb-3 ml-1">Penyedia email</Typography>
                    <View className="flex-row gap-x-2 mb-6">
                        {(['gmail', 'outlook'] as const).map((key) => (
                            <Pressable
                                key={key}
                                onPress={() => pilihPreset(key)}
                                className={`flex-1 h-11 rounded-2xl items-center justify-center border ${preset === key ? 'bg-primary border-primary' : 'bg-surface border-transparent'}`}
                            >
                                <Typography weight="bold" className={preset === key ? 'text-white text-xs' : 'text-textMain text-xs'}>{PRESETS[key].label}</Typography>
                            </Pressable>
                        ))}
                        <Pressable
                            onPress={() => setPreset('custom')}
                            className={`flex-1 h-11 rounded-2xl items-center justify-center border ${preset === 'custom' ? 'bg-primary border-primary' : 'bg-surface border-transparent'}`}
                        >
                            <Typography weight="bold" className={preset === 'custom' ? 'text-white text-xs' : 'text-textMain text-xs'}>Lainnya</Typography>
                        </Pressable>
                    </View>

                    {/* Server */}
                    <View className="bg-surface p-5 rounded-[28px] mb-5">
                        <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-[3px] mb-4">Server</Typography>
                        <Field label="Alamat SMTP">
                            <InputRow icon={<Server size={18} color="#9CA3AF" />}>
                                <TextInput
                                    className="flex-1 ml-3 text-text font-bold"
                                    placeholder="smtp.contoh.com"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={server}
                                    onChangeText={(v) => { setServer(v); setPreset('custom'); }}
                                />
                            </InputRow>
                        </Field>
                        <View className="flex-row gap-x-3">
                            <View className="flex-1">
                                <Field label="Port">
                                    <InputRow icon={null}>
                                        <TextInput
                                            className="flex-1 text-text font-bold text-center"
                                            placeholder="587"
                                            keyboardType="number-pad"
                                            value={port}
                                            onChangeText={setPort}
                                        />
                                    </InputRow>
                                </Field>
                            </View>
                            <View className="flex-[1.6]">
                                <Field label="Keamanan">
                                    <Pressable
                                        onPress={() => setUseTLS(!useTLS)}
                                        className={`h-14 rounded-2xl flex-row items-center justify-center border ${useTLS ? 'bg-emerald-50 border-emerald-100' : 'bg-background border-transparent'}`}
                                    >
                                        <ShieldCheck size={18} color={useTLS ? '#10B981' : '#9CA3AF'} />
                                        <Typography weight="bold" className={`ml-2 ${useTLS ? 'text-emerald-700' : 'text-textGray'}`}>
                                            {useTLS ? 'TLS aktif' : 'Tanpa TLS'}
                                        </Typography>
                                    </Pressable>
                                </Field>
                            </View>
                        </View>
                    </View>

                    {/* Akun */}
                    <View className="bg-surface p-5 rounded-[28px] mb-5">
                        <Typography variant="caption" weight="bold" className="text-textGray uppercase tracking-[3px] mb-4">Akun pengirim</Typography>
                        <Field label="Username (alamat email)">
                            <InputRow icon={<Mail size={18} color="#9CA3AF" />}>
                                <TextInput
                                    className="flex-1 ml-3 text-text font-bold"
                                    placeholder="email@contoh.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={username}
                                    onChangeText={setUsername}
                                />
                            </InputRow>
                        </Field>
                        <Field label="Password / App Password" hint={preset === 'gmail' ? 'Untuk Gmail, pakai App Password 16 digit.' : undefined}>
                            <InputRow icon={<Lock size={18} color="#9CA3AF" />}>
                                <TextInput
                                    className="flex-1 ml-3 text-text font-bold"
                                    placeholder="Password SMTP"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <Pressable onPress={() => setShowPassword(!showPassword)} className="p-1" hitSlop={8}>
                                    {showPassword ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
                                </Pressable>
                            </InputRow>
                        </Field>
                        <Field label="Nama pengirim" hint="Nama yang tampil di email yang diterima user.">
                            <InputRow icon={<User size={18} color="#9CA3AF" />}>
                                <TextInput
                                    className="flex-1 ml-3 text-text font-bold"
                                    placeholder="TPM Business"
                                    value={senderName}
                                    onChangeText={setSenderName}
                                />
                            </InputRow>
                        </Field>
                    </View>

                    {/* Panduan penyedia */}
                    {preset !== 'custom' ? (
                        <View className="bg-blue-50/60 p-5 rounded-[24px] border border-blue-100/60 flex-row mb-5">
                            <Info size={18} color="#3B82F6" />
                            <Typography className="flex-1 ml-3 text-sm text-blue-700/90 leading-relaxed">{PRESETS[preset].hint}</Typography>
                        </View>
                    ) : null}

                    {/* Hasil tes terakhir dari form ini */}
                    {testOutcome ? (
                        <View className={`p-5 rounded-[24px] border mb-5 ${testOutcome.ok ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                            <View className="flex-row items-center">
                                {testOutcome.ok ? <CheckCircle2 size={18} color="#10B981" /> : <XCircle size={18} color="#DC2626" />}
                                <Typography weight="bold" className={`ml-2 ${testOutcome.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {testOutcome.ok ? 'Tes berhasil' : 'Tes gagal'}
                                </Typography>
                            </View>
                            <Typography className={`mt-2 text-sm ${testOutcome.ok ? 'text-emerald-700/80' : 'text-red-700/80'}`}>{testOutcome.message}</Typography>
                            {!testOutcome.ok && testOutcome.code && SARAN[testOutcome.code] ? (
                                <Typography className="mt-2 text-xs text-red-700/80">{SARAN[testOutcome.code]}</Typography>
                            ) : null}
                        </View>
                    ) : null}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Aksi */}
            <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-background border-t border-transparent">
                <View className="flex-row gap-x-3">
                    <Pressable
                        onPress={handleTesSaja}
                        disabled={isTesting || isSaving}
                        className={`flex-1 h-14 rounded-2xl flex-row items-center justify-center border border-primary/20 bg-surface ${isTesting ? 'opacity-50' : ''}`}
                    >
                        {isTesting ? <ActivityIndicator size="small" color="#023C69" /> : <Send size={17} color="#023C69" />}
                        <Typography weight="bold" className="text-primary ml-2">Tes Koneksi</Typography>
                    </Pressable>
                    <Pressable
                        onPress={() => handleSimpan(true)}
                        disabled={isSaving || isTesting}
                        className={`flex-[1.4] h-14 rounded-2xl flex-row items-center justify-center bg-primary ${isSaving ? 'opacity-50' : ''}`}
                    >
                        {isSaving ? <ActivityIndicator size="small" color="white" /> : <Save size={17} color="white" />}
                        <Typography weight="bold" className="text-white ml-2">Simpan & Tes</Typography>
                    </Pressable>
                </View>
                <Pressable onPress={() => handleSimpan(false)} disabled={isSaving || isTesting} className="self-center mt-3 py-1">
                    <Typography weight="bold" className="text-textGray text-xs">Simpan saja tanpa tes</Typography>
                </Pressable>
            </View>

            <AlertDialog
                visible={dialog.visible}
                title={dialog.title}
                message={dialog.message}
                variant={dialog.variant}
                onClose={() => setDialog((prev) => ({ ...prev, visible: false }))}
            />
        </View>
    );
}
