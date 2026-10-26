import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Pressable, TextInput, StatusBar, ActivityIndicator, FlatList, RefreshControl, Platform, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheetBase, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import BottomSheet from '../../components/ui/BottomSheetWithBack';
import { format } from 'date-fns/format';
import { id as localeID } from 'date-fns/locale/id';
import Search from 'lucide-react-native/dist/esm/icons/search.js';
import Plus from 'lucide-react-native/dist/esm/icons/plus.js';
import X from 'lucide-react-native/dist/esm/icons/x.js';
import Shield from 'lucide-react-native/dist/esm/icons/shield.js';
import UserCircle2 from 'lucide-react-native/dist/esm/icons/circle-user-round.js';
import Wallet from 'lucide-react-native/dist/esm/icons/wallet.js';
import Wrench from 'lucide-react-native/dist/esm/icons/wrench.js';
import Warehouse from 'lucide-react-native/dist/esm/icons/warehouse.js';
import Truck from 'lucide-react-native/dist/esm/icons/truck.js';
import Car from 'lucide-react-native/dist/esm/icons/car.js';
import UserSquare2 from 'lucide-react-native/dist/esm/icons/square-user-round.js';
import Eye from 'lucide-react-native/dist/esm/icons/eye.js';
import Mail from 'lucide-react-native/dist/esm/icons/mail.js';
import Phone from 'lucide-react-native/dist/esm/icons/phone.js';
import Clock from 'lucide-react-native/dist/esm/icons/clock.js';
import Trash2 from 'lucide-react-native/dist/esm/icons/trash-2.js';
import Power from 'lucide-react-native/dist/esm/icons/power.js';
import PencilLine from 'lucide-react-native/dist/esm/icons/pencil-line.js';
import LogIn from 'lucide-react-native/dist/esm/icons/log-in.js';
import AlertTriangle from 'lucide-react-native/dist/esm/icons/triangle-alert.js';
import ShieldCheck from 'lucide-react-native/dist/esm/icons/shield-check.js';
import Users from 'lucide-react-native/dist/esm/icons/users.js';
import { Typography } from '../../components/ui/Typography';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { Header } from '../../components/ui/Header';
import { authService, User as UserType, UserCreateData, UserUpdateData } from '../../services/auth';
import { useUserList, useCreateUser, useUpdateUser, useDeleteUser, useDeleteCheck } from '../../hooks/useUsers';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import { getErrorMessage } from '../../utils/error';
import { usePlaceholderColor, useSheetChrome } from '../../utils/themeStyles';

const ROLE_META: Record<string, { label: string; color: string; icon: any }> = {
    ADMIN: { label: 'Admin', color: '#EF4444', icon: Shield },
    MANAGER: { label: 'Manager', color: '#F59E0B', icon: UserCircle2 },
    KASIR: { label: 'Kasir', color: '#10B981', icon: Wallet },
    MEKANIK: { label: 'Mekanik', color: '#3B82F6', icon: Wrench },
    BENGKEL: { label: 'Bengkel', color: '#8B5CF6', icon: Warehouse },
    JASA_ANGKUT: { label: 'Jasa Angkut', color: '#F97316', icon: Truck },
    MOBIL: { label: 'Mobil', color: '#06B6D4', icon: Car },
    STAFF: { label: 'Staff', color: '#6B7280', icon: UserSquare2 },
    VIEWER: { label: 'Viewer', color: '#94A3B8', icon: Eye },
};
const ROLE_ORDER = Object.keys(ROLE_META);

// Nama tampilan untuk tabel yang masih menunjuk ke user (ringkasan hapus permanen).
const LABEL_TABEL: Record<string, string> = {
    transaksi_penjualan_bengkel: 'transaksi bengkel',
    transaksi_penjualan_mobil: 'penjualan mobil',
    pembelian_spare_parts: 'pembelian sparepart',
    pengeluaran_bengkel: 'pengeluaran',
    kas_bank: 'mutasi kas/bank',
    hutang_usaha: 'hutang',
    piutang_usaha: 'piutang',
    pembayaran_piutang: 'pembayaran piutang',
    pembayaran_hutang: 'pembayaran hutang',
    muatan_jasa_angkut: 'muatan jasa angkut',
    mobil: 'data mobil',
    aset: 'aset',
    slip_gaji: 'slip gaji',
    kasbon_karyawan: 'kasbon karyawan',
    investor_withdrawal: 'penarikan investor',
    investor_disbursement_detail: 'pencairan investor',
    user_cash_adjustments: 'penyesuaian kas user',
    retur_pembelian_spare_parts: 'retur pembelian',
};
const labelTabel = (t: string) => LABEL_TABEL[t] || t.replace(/_/g, ' ');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inisial = (nama: string) =>
    nama.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

const formatWaktu = (iso?: string | null) => {
    if (!iso) return 'Belum pernah';
    try {
        return format(new Date(iso), 'dd MMM yyyy, HH:mm', { locale: localeID });
    } catch {
        return '-';
    }
};

type StatusFilter = 'ALL' | 'AKTIF' | 'NONAKTIF';
type FormState = { username: string; full_name: string; email: string; phone: string; role: string; password: string; is_active: boolean };
const FORM_KOSONG: FormState = { username: '', full_name: '', email: '', phone: '', role: 'STAFF', password: '', is_active: true };

export default function UsersScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const currentUser = useAuthStore((s) => s.user);
    const startImpersonation = useAuthStore((s) => s.startImpersonation);
    const themeColors = useUIStore((s) => s.themeColors);
    const chrome = useSheetChrome();
    const placeholder = usePlaceholderColor();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [refreshing, setRefreshing] = useState(false);

    const [selected, setSelected] = useState<UserType | null>(null);
    const [sheetMode, setSheetMode] = useState<'detail' | 'form' | null>(null);
    const [form, setForm] = useState<FormState>(FORM_KOSONG);
    const [formError, setFormError] = useState<Partial<Record<keyof FormState, string>>>({});

    const [dialog, setDialog] = useState<{
        visible: boolean; title: string; message: string;
        variant: 'success' | 'error' | 'warning' | 'info'; type?: 'alert' | 'confirm'; onConfirm?: () => void;
    }>({ visible: false, title: '', message: '', variant: 'info', type: 'alert' });

    const sheetRef = useRef<any>(null);
    const snapPoints = useMemo(() => ['72%', '94%'], []);

    const { data: userData, isLoading, isError, refetch } = useUserList({ limit: 500 });
    const { data: check, isLoading: checkLoading } = useDeleteCheck(sheetMode === 'detail' ? selected?.id : null);
    const createMutation = useCreateUser();
    const updateMutation = useUpdateUser();
    const deleteMutation = useDeleteUser();
    const saving = createMutation.isPending || updateMutation.isPending;

    const semua: UserType[] = useMemo(() => (Array.isArray(userData) ? userData : []), [userData]);

    const stats = useMemo(() => {
        const aktif = semua.filter((u) => u.is_active).length;
        return { total: semua.length, aktif, nonaktif: semua.length - aktif };
    }, [semua]);

    const roleCount = useMemo(() => {
        const map: Record<string, number> = {};
        semua.forEach((u) => { map[u.role] = (map[u.role] || 0) + 1; });
        return map;
    }, [semua]);

    const daftar = useMemo(() => {
        const q = search.trim().toLowerCase();
        return semua
            .filter((u) => (statusFilter === 'ALL' ? true : statusFilter === 'AKTIF' ? u.is_active : !u.is_active))
            .filter((u) => (roleFilter === 'ALL' ? true : u.role === roleFilter))
            .filter((u) => !q || u.full_name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
            .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.full_name.localeCompare(b.full_name));
    }, [semua, search, statusFilter, roleFilter]);

    const tampilkan = (title: string, message: string, variant: 'success' | 'error' | 'warning' | 'info', extra?: Partial<typeof dialog>) =>
        setDialog({ visible: true, title, message, variant, type: 'alert', ...extra });

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    const bukaDetail = (u: UserType) => {
        setSelected(u);
        setSheetMode('detail');
    };

    const bukaForm = (u?: UserType) => {
        setSelected(u ?? null);
        setFormError({});
        setForm(u
            ? { username: u.username, full_name: u.full_name, email: u.email, phone: u.phone || '', role: u.role, password: '', is_active: u.is_active }
            : FORM_KOSONG);
        setSheetMode('form');
    };

    const tutupSheet = () => sheetRef.current?.close();

    const isSelf = !!selected && selected.id === currentUser?.id;
    const adminTerakhir = !!check?.is_last_admin;

    const bolehBalikStatus = !!selected && !isSelf && !(selected.is_active && adminTerakhir);

    // ---- aksi ----
    const toggleAktif = () => {
        if (!selected) return;
        const aktifkan = !selected.is_active;
        setDialog({
            visible: true,
            title: aktifkan ? 'Aktifkan user?' : 'Nonaktifkan user?',
            message: aktifkan
                ? `${selected.full_name} bisa login kembali.`
                : `${selected.full_name} tidak bisa login sampai diaktifkan lagi. Data dan riwayatnya tetap tersimpan.`,
            variant: aktifkan ? 'info' : 'warning',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await updateMutation.mutateAsync({ id: selected.id, data: { is_active: aktifkan } });
                    tutupSheet();
                    tampilkan('Berhasil', `${selected.full_name} ${aktifkan ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
                } catch (error) {
                    tampilkan('Gagal', getErrorMessage(error, 'Gagal mengubah status user'), 'error');
                }
            },
        });
    };

    const hapusPermanen = () => {
        if (!selected) return;
        setDialog({
            visible: true,
            title: 'Hapus permanen?',
            message: `${selected.full_name} akan dihapus dari database. Tindakan ini tidak bisa dibatalkan.`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await deleteMutation.mutateAsync({ id: selected.id, permanent: true });
                    tutupSheet();
                    tampilkan('Terhapus', 'User dihapus permanen.', 'success');
                } catch (error) {
                    tampilkan('Gagal menghapus', getErrorMessage(error, 'Gagal menghapus user'), 'error');
                }
            },
        });
    };

    const impersonate = (target: UserType) => {
        setDialog({
            visible: true,
            title: 'Masuk sebagai user?',
            message: `Anda akan masuk sebagai ${target.full_name}. Sesi admin disimpan dan bisa dikembalikan.`,
            variant: 'warning',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    const res = await authService.impersonateUser(target.id);
                    if (!res.user || !res.access_token) throw new Error('Respons impersonate tidak lengkap');
                    startImpersonation(res.user, res.access_token, res.impersonator || currentUser);
                    tutupSheet();
                    const rute: Record<string, string> = { BENGKEL: '/bengkel', JASA_ANGKUT: '/jasa-angkut', MOBIL: '/mobil' };
                    router.replace((rute[res.user.role] || '/(tabs)/home') as any);
                } catch (error) {
                    tampilkan('Gagal', getErrorMessage(error, 'Gagal melakukan impersonate user'), 'error');
                }
            },
        });
    };

    const validasiForm = () => {
        const err: Partial<Record<keyof FormState, string>> = {};
        if (form.username.trim().length < 3) err.username = 'Minimal 3 karakter';
        if (!form.full_name.trim()) err.full_name = 'Wajib diisi';
        if (!EMAIL_RE.test(form.email.trim())) err.email = 'Format email belum benar';
        if (!selected && form.password.length < 6) err.password = 'Minimal 6 karakter';
        if (selected && form.password && form.password.length < 6) err.password = 'Minimal 6 karakter';
        setFormError(err);
        return Object.keys(err).length === 0;
    };

    const simpanForm = async () => {
        if (!validasiForm()) return;
        try {
            if (selected) {
                const data: UserUpdateData = {
                    username: form.username.trim(),
                    full_name: form.full_name.trim(),
                    email: form.email.trim(),
                    phone: form.phone.trim() || undefined,
                    role: form.role,
                    is_active: form.is_active,
                };
                if (form.password) data.password = form.password;
                await updateMutation.mutateAsync({ id: selected.id, data });
                tutupSheet();
                tampilkan('Tersimpan', 'Data user diperbarui.', 'success');
            } else {
                const data: UserCreateData = {
                    username: form.username.trim(),
                    full_name: form.full_name.trim(),
                    email: form.email.trim(),
                    phone: form.phone.trim() || undefined,
                    role: form.role,
                    password: form.password,
                };
                await createMutation.mutateAsync(data);
                tutupSheet();
                tampilkan('Berhasil', 'User baru ditambahkan.', 'success');
            }
        } catch (error) {
            tampilkan('Gagal menyimpan', getErrorMessage(error, 'Gagal menyimpan user'), 'error');
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    // ---- komponen kecil ----
    const Chip = ({ active, onPress, children, color }: { active: boolean; onPress: () => void; children: React.ReactNode; color?: string }) => (
        <Pressable
            onPress={onPress}
            style={active ? { backgroundColor: color || themeColors.primary, borderColor: color || themeColors.primary } : undefined}
            className={`mr-2 px-4 h-10 rounded-full border flex-row items-center ${active ? '' : 'bg-surface border-transparent'}`}
        >
            {children}
        </Pressable>
    );

    const renderUser = ({ item }: { item: UserType }) => {
        const meta = ROLE_META[item.role] || ROLE_META.STAFF;
        const RoleIcon = meta.icon;
        const self = item.id === currentUser?.id;
        return (
            <Pressable onPress={() => bukaDetail(item)} className="mb-3">
                <View className={`bg-surface p-4 rounded-[24px] flex-row items-center ${item.is_active ? '' : 'opacity-70'}`}>
                    <View style={{ backgroundColor: `${meta.color}1A` }} className="w-12 h-12 rounded-2xl items-center justify-center mr-3">
                        <Typography weight="bold" style={{ color: meta.color }}>{inisial(item.full_name)}</Typography>
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center">
                            <Typography weight="bold" className="text-textMain flex-shrink" numberOfLines={1}>{item.full_name}</Typography>
                            {self ? (
                                <View className="ml-2 px-2 py-0.5 rounded-md bg-primary/10">
                                    <Typography className="text-[9px] font-bold text-primary">ANDA</Typography>
                                </View>
                            ) : null}
                        </View>
                        <Typography variant="caption" className="text-textGray" numberOfLines={1}>@{item.username} · {item.email}</Typography>
                        <View className="flex-row items-center mt-1.5">
                            <RoleIcon size={12} color={meta.color} />
                            <Typography className="ml-1 text-[11px] font-bold" style={{ color: meta.color }}>{meta.label}</Typography>
                            <View className="mx-2 w-1 h-1 rounded-full bg-gray-300" />
                            <View style={{ backgroundColor: item.is_active ? '#10B981' : '#9CA3AF' }} className="w-1.5 h-1.5 rounded-full mr-1" />
                            <Typography className="text-[11px] font-semibold text-textGray">{item.is_active ? 'Aktif' : 'Nonaktif'}</Typography>
                        </View>
                    </View>
                    <Typography className="text-textGray text-lg ml-2">›</Typography>
                </View>
            </Pressable>
        );
    };

    const renderDetail = () => {
        if (!selected) return null;
        const meta = ROLE_META[selected.role] || ROLE_META.STAFF;
        const RoleIcon = meta.icon;
        const adaReferensi = !!check && !check.bisa_hapus_permanen;
        return (
            <View className="px-6 pb-6">
                <View className="flex-row items-center mb-5">
                    <View style={{ backgroundColor: `${meta.color}1A` }} className="w-16 h-16 rounded-3xl items-center justify-center mr-4">
                        <Typography variant="h2" weight="bold" style={{ color: meta.color }}>{inisial(selected.full_name)}</Typography>
                    </View>
                    <View className="flex-1">
                        <Typography variant="h3" weight="bold" className="text-textMain" numberOfLines={1}>{selected.full_name}</Typography>
                        <Typography variant="caption" className="text-textGray">@{selected.username}</Typography>
                        <View className="flex-row items-center mt-1">
                            <RoleIcon size={12} color={meta.color} />
                            <Typography className="ml-1 text-xs font-bold" style={{ color: meta.color }}>{meta.label}</Typography>
                            <Typography className="mx-2 text-textGray">·</Typography>
                            <Typography className={`text-xs font-bold ${selected.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                                {selected.is_active ? 'Aktif' : 'Nonaktif'}
                            </Typography>
                        </View>
                    </View>
                </View>

                <View className="bg-background rounded-[20px] p-4 mb-5">
                    <View className="flex-row items-center mb-3">
                        <Mail size={15} color="#6B7280" />
                        <Typography className="ml-2 text-sm text-textMain flex-1" numberOfLines={1}>{selected.email}</Typography>
                    </View>
                    <View className="flex-row items-center mb-3">
                        <Phone size={15} color="#6B7280" />
                        <Typography className="ml-2 text-sm text-textMain">{selected.phone || 'Tidak diisi'}</Typography>
                    </View>
                    <View className="flex-row items-center">
                        <Clock size={15} color="#6B7280" />
                        <Typography className="ml-2 text-sm text-textMain">Login terakhir: {formatWaktu(selected.last_login)}</Typography>
                    </View>
                </View>

                {isSelf ? (
                    <View className="bg-primary/5 rounded-[20px] p-4 mb-4 flex-row">
                        <ShieldCheck size={16} color="#023C69" />
                        <Typography className="flex-1 ml-2 text-xs text-primary">Ini akun Anda sendiri. Status dan penghapusannya tidak bisa diubah dari sini.</Typography>
                    </View>
                ) : null}
                {!isSelf && selected.is_active && adminTerakhir ? (
                    <View className="bg-amber-50 rounded-[20px] p-4 mb-4 flex-row">
                        <AlertTriangle size={16} color="#D97706" />
                        <Typography className="flex-1 ml-2 text-xs text-amber-700">Admin aktif terakhir. Tambahkan admin lain sebelum menonaktifkan akun ini.</Typography>
                    </View>
                ) : null}

                <View className="flex-row gap-x-3 mb-3">
                    <Button title="Edit" variant="outline" className="flex-1" icon={<PencilLine size={16} color={themeColors.primary} />} onPress={() => bukaForm(selected)} />
                    <Button
                        title={selected.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        variant={selected.is_active ? 'outline-danger' : 'primary'}
                        className="flex-1"
                        icon={<Power size={16} color={selected.is_active ? '#EF4444' : 'white'} />}
                        disabled={!bolehBalikStatus || checkLoading}
                        onPress={toggleAktif}
                    />
                </View>

                {currentUser?.role === 'ADMIN' && !isSelf && selected.role !== 'ADMIN' && selected.is_active ? (
                    <Button title="Masuk sebagai user ini" variant="secondary" className="mb-3" icon={<LogIn size={16} color="white" />} onPress={() => impersonate(selected)} />
                ) : null}

                {!isSelf ? (
                    <View className="mt-4 p-4 rounded-[20px] border border-red-100 bg-red-50/40">
                        <Typography weight="bold" className="text-red-700 text-sm mb-1">Hapus permanen</Typography>
                        {checkLoading || !check ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                        ) : adaReferensi ? (
                            <>
                                <Typography className="text-xs text-red-700/80 mb-2">
                                    Tidak bisa dihapus permanen karena masih terhubung dengan {check.total_referensi} catatan:
                                </Typography>
                                {check.referensi.slice(0, 6).map((r) => (
                                    <Typography key={`${r.tabel}-${r.kolom}`} className="text-xs text-red-700/80">
                                        • {r.jumlah} {labelTabel(r.tabel)}
                                    </Typography>
                                ))}
                                <Typography className="text-xs text-red-700/80 mt-2">Nonaktifkan saja agar user tidak bisa login.</Typography>
                            </>
                        ) : selected.is_active ? (
                            <Typography className="text-xs text-red-700/80">
                                Nonaktifkan user ini dulu jika ingin menghapusnya permanen.
                            </Typography>
                        ) : (
                            <>
                                <Typography className="text-xs text-red-700/80 mb-3">
                                    User ini belum punya catatan. Menghapusnya tidak mengubah data lain.
                                </Typography>
                                <Button
                                    title="Hapus permanen"
                                    variant="outline-danger"
                                    icon={<Trash2 size={16} color="#EF4444" />}
                                    loading={deleteMutation.isPending}
                                    onPress={hapusPermanen}
                                />
                            </>
                        )}
                    </View>
                ) : null}
            </View>
        );
    };

    const renderForm = () => {
        const roleAktif = form.role;
        const fieldErr = (k: keyof FormState) => (formError[k] ? <Typography className="text-xs text-red-500 mt-1 ml-1">{formError[k]}</Typography> : null);
        const input = (k: keyof FormState, placeholderText: string, extra?: any) => (
            <View className="mb-4">
                <TextInput
                    className={`bg-background rounded-2xl px-4 h-14 text-textMain font-medium ${formError[k] ? 'border border-red-300' : ''}`}
                    placeholder={placeholderText}
                    placeholderTextColor={placeholder}
                    value={String(form[k] ?? '')}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, [k]: k === 'username' ? t.toLowerCase().replace(/\s/g, '') : t }))}
                    {...extra}
                />
                {fieldErr(k)}
            </View>
        );
        const label = (t: string) => <Typography className="mb-2 text-textGray font-bold text-[11px] uppercase tracking-widest ml-1">{t}</Typography>;
        const lockStatus = !selected || isSelf || (selected.is_active && adminTerakhir);

        return (
            <View className="px-6 pb-6">
                <View className="flex-row items-center justify-between mb-5">
                    <Typography variant="h3" weight="bold">{selected ? 'Edit user' : 'Tambah user'}</Typography>
                    <Pressable onPress={tutupSheet} className="w-10 h-10 bg-background rounded-full items-center justify-center">
                        <X size={18} color="#6B7280" />
                    </Pressable>
                </View>

                {label('Nama lengkap')}
                {input('full_name', 'Contoh: Budi Santoso')}
                {label('Username')}
                {input('username', 'huruf kecil, tanpa spasi', { autoCapitalize: 'none', autoCorrect: false })}
                {label('Email')}
                {input('email', 'nama@contoh.com', { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}
                {label('Telepon (opsional)')}
                {input('phone', '08xxxxxxxxxx', { keyboardType: 'phone-pad' })}

                {label('Peran')}
                <View className="flex-row flex-wrap mb-4">
                    {ROLE_ORDER.map((r) => {
                        const m = ROLE_META[r];
                        const aktif = roleAktif === r;
                        const Ic = m.icon;
                        return (
                            <Pressable
                                key={r}
                                onPress={() => setForm((prev) => ({ ...prev, role: r }))}
                                style={aktif ? { backgroundColor: m.color, borderColor: m.color } : undefined}
                                className={`w-[31%] mr-[2%] mb-2 py-3 rounded-2xl border items-center ${aktif ? '' : 'bg-background border-transparent'}`}
                            >
                                <Ic size={16} color={aktif ? 'white' : m.color} />
                                <Typography className={`mt-1 text-[11px] font-bold ${aktif ? 'text-white' : 'text-textMain'}`}>{m.label}</Typography>
                            </Pressable>
                        );
                    })}
                </View>

                {label(selected ? 'Password baru (kosongkan jika tidak diganti)' : 'Password')}
                {input('password', selected ? 'minimal 6 karakter' : 'minimal 6 karakter', { secureTextEntry: true, autoCapitalize: 'none' })}

                {selected ? (
                    <View className="flex-row items-center justify-between bg-background rounded-2xl px-4 h-14 mb-2">
                        <View className="flex-1 mr-3">
                            <Typography weight="bold" className="text-textMain">Akun aktif</Typography>
                            <Typography variant="caption" className="text-textGray">
                                {lockStatus ? (isSelf ? 'Tidak bisa mengubah status akun sendiri' : 'Admin aktif terakhir tidak bisa dinonaktifkan') : 'Nonaktif = tidak bisa login'}
                            </Typography>
                        </View>
                        <Switch
                            value={form.is_active}
                            disabled={lockStatus}
                            onValueChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))}
                            trackColor={{ true: themeColors.primary, false: '#D1D5DB' }}
                        />
                    </View>
                ) : null}

                <Button
                    title={selected ? 'Simpan perubahan' : 'Tambah user'}
                    onPress={simpanForm}
                    loading={saving}
                    className="mt-4"
                    size="lg"
                />
            </View>
        );
    };

    return (
        <View className="flex-1 bg-background">
            <StatusBar barStyle="dark-content" />

            <Header
                title="Pengguna"
                subtitle="Akun dan hak akses"
                showBackButton
                rightElement={
                    <Pressable onPress={onRefresh} className="w-11 h-11 bg-surface rounded-2xl items-center justify-center">
                        {refreshing ? <ActivityIndicator size="small" color="#1F2937" /> : <Users size={20} color="#1F2937" />}
                    </Pressable>
                }
            />

            {/* Ringkasan: tap untuk memfilter status */}
            <View className="flex-row px-5 gap-x-3 mt-2 mb-4">
                {([
                    { key: 'ALL' as StatusFilter, label: 'Total', value: stats.total, color: '#023C69' },
                    { key: 'AKTIF' as StatusFilter, label: 'Aktif', value: stats.aktif, color: '#10B981' },
                    { key: 'NONAKTIF' as StatusFilter, label: 'Nonaktif', value: stats.nonaktif, color: '#9CA3AF' },
                ]).map((s) => {
                    const aktif = statusFilter === s.key;
                    return (
                        <Pressable
                            key={s.key}
                            onPress={() => setStatusFilter(s.key)}
                            style={aktif ? { borderColor: s.color } : undefined}
                            className={`flex-1 bg-surface rounded-[20px] p-3 border ${aktif ? '' : 'border-transparent'}`}
                        >
                            <Typography className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.label}</Typography>
                            <Typography variant="h3" weight="bold" className="text-textMain mt-1">{s.value}</Typography>
                        </Pressable>
                    );
                })}
            </View>

            <View className="px-5">
                <View className="flex-row items-center bg-surface rounded-2xl px-4 h-12 mb-3">
                    <Search size={18} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-3 text-sm font-medium text-textMain"
                        placeholder="Cari nama, username, atau email"
                        placeholderTextColor={placeholder}
                        value={search}
                        onChangeText={setSearch}
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {search.length > 0 ? (
                        <Pressable onPress={() => setSearch('')} className="p-1">
                            <X size={16} color="#9CA3AF" />
                        </Pressable>
                    ) : null}
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 px-5" style={{ flexGrow: 0 }}>
                <Chip active={roleFilter === 'ALL'} onPress={() => setRoleFilter('ALL')}>
                    <Typography weight="bold" className={`text-xs ${roleFilter === 'ALL' ? 'text-white' : 'text-textMain'}`}>Semua peran</Typography>
                </Chip>
                {ROLE_ORDER.filter((r) => roleCount[r]).map((r) => {
                    const m = ROLE_META[r];
                    const aktif = roleFilter === r;
                    return (
                        <Chip key={r} active={aktif} onPress={() => setRoleFilter(r)} color={m.color}>
                            <Typography weight="bold" className={`text-xs ${aktif ? 'text-white' : 'text-textMain'}`}>
                                {m.label} · {roleCount[r]}
                            </Typography>
                        </Chip>
                    );
                })}
            </ScrollView>

            {isLoading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={themeColors.primary} />
                </View>
            ) : isError ? (
                <View className="flex-1 items-center justify-center px-8">
                    <EmptyState icon="error" title="Daftar user gagal dimuat" description="Periksa koneksi lalu tarik ke bawah untuk mencoba lagi." />
                </View>
            ) : (
                <FlatList
                    data={daftar}
                    keyExtractor={(u) => String(u.id)}
                    renderItem={renderUser}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110, flexGrow: 1 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
                    ListEmptyComponent={
                        <EmptyState
                            icon={search || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? 'search' : 'empty'}
                            title={search || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? 'Tidak ada user yang cocok' : 'Belum ada user'}
                            description={search ? `Tidak ada hasil untuk "${search}"` : undefined}
                        />
                    }
                />
            )}

            <Pressable
                onPress={() => bukaForm()}
                style={{ backgroundColor: themeColors.primary, bottom: insets.bottom + 24 }}
                className="absolute right-6 h-14 px-5 rounded-2xl flex-row items-center shadow-lg"
            >
                <Plus size={20} color="white" strokeWidth={2.5} />
                <Typography weight="bold" className="text-white ml-2">Tambah user</Typography>
            </Pressable>

            {sheetMode ? (
                <BottomSheet
                    ref={sheetRef}
                    index={0}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backdropComponent={renderBackdrop}
                    backgroundStyle={chrome.backgroundStyle}
                    handleIndicatorStyle={chrome.handleIndicatorStyle}
                    topInset={insets.top}
                    onClose={() => setSheetMode(null)}
                >
                    <BottomSheetScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
                        {sheetMode === 'detail' ? renderDetail() : renderForm()}
                    </BottomSheetScrollView>
                </BottomSheet>
            ) : null}

            <AlertDialog
                visible={dialog.visible}
                title={dialog.title}
                message={dialog.message}
                variant={dialog.variant}
                type={dialog.type}
                onConfirm={dialog.onConfirm}
                onClose={() => setDialog((prev) => ({ ...prev, visible: false }))}
            />
        </View>
    );
}
