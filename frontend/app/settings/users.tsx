import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StatusBar, ActivityIndicator, FlatList, TextInput, Platform } from 'react-native';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    ChevronLeft,
    Search,
    Plus,
    User,
    Mail,
    Phone,
    Shield,
    X,
    MoreVertical,
    RefreshCw,
    UserPlus,
    Trash2,
    CheckCircle2,
    XCircle,
    UserCircle2,
    UserSquare2,
    Wrench,
    Wallet,
    Truck,
    Car,
    Warehouse,
    Eye
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { authService, User as UserType, UserCreateData, UserUpdateData } from '../../services/auth';
import { useUserList, useCreateUser, useUpdateUser, useDeleteUser } from '../../hooks/useUsers';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { AlertDialog } from '../../components/ui/AlertDialog';
import { getErrorMessage } from '../../utils/error';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useUIStore } from '../../store/useUIStore';
import { Header } from '../../components/ui/Header';
import { useAuthStore } from '../../store/useAuthStore';

const ROLE_OPTIONS = [
    { label: 'Admin', value: 'ADMIN', color: '#EF4444', icon: Shield },
    { label: 'Manager', value: 'MANAGER', color: '#F59E0B', icon: UserCircle2 },
    { label: 'Kasir', value: 'KASIR', color: '#10B981', icon: Wallet },
    { label: 'Mekanik', value: 'MEKANIK', color: '#3B82F6', icon: Wrench },
    { label: 'Bengkel', value: 'BENGKEL', color: '#8B5CF6', icon: Warehouse },
    { label: 'Jasa Angkut', value: 'JASA_ANGKUT', color: '#F97316', icon: Truck },
    { label: 'Mobil', value: 'MOBIL', color: '#06B6D4', icon: Car },
    { label: 'Staff', value: 'STAFF', color: '#6B7280', icon: UserSquare2 },
    { label: 'Viewer', value: 'VIEWER', color: '#94A3B8', icon: Eye },
];

const UsersIcon = ({ size, color }: { size: number, color: string }) => <UserPlus size={size} color={color} />;

export default function UserManagementScreen() {
    const router = useRouter();
    const { user: currentUser, startImpersonation } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
    const [viewMode, setViewMode] = useState<'detail' | 'form'>('detail');
    const [refreshing, setRefreshing] = useState(false);
    const { themeColors } = useUIStore();

    // API Hooks
    const { data: userData, isLoading, refetch } = useUserList();
    const createMutation = useCreateUser();
    const updateMutation = useUpdateUser();
    const deleteMutation = useDeleteUser();

    const stats = useMemo(() => {
        const list = userData || [];
        const active = list.filter((u: UserType) => u.is_active).length;
        const inactive = list.length - active;
        return { total: list.length, active, inactive };
    }, [userData]);

    const userList = useMemo(() => {
        const list = userData || [];
        if (!searchQuery) return list;
        return list.filter((u: UserType) => 
            u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [userData, searchQuery]);

    // Form state
    const [formData, setFormData] = useState<UserCreateData & { is_active?: boolean }>({
        username: '',
        email: '',
        full_name: '',
        phone: '',
        role: 'STAFF',
        password: '',
        is_active: true
    });

    const [dialogConfig, setDialogConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'success' | 'error' | 'warning' | 'info';
        type?: 'alert' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        variant: 'info',
        type: 'alert'
    });

    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ['85%', '90%'], []);
    const [sheetVisible, setSheetVisible] = useState(false);

    const renderBackdrop = useCallback(
        (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
        []
    );

    const handleOpenSheet = useCallback(() => {
        setSheetVisible(true);
        if (Platform.OS !== 'web') bottomSheetRef.current?.expand();
    }, []);

    const handleCloseSheet = useCallback(() => {
        setSheetVisible(false);
        if (Platform.OS !== 'web') bottomSheetRef.current?.close();
    }, []);

    const openDetail = (user: UserType) => {
        setSelectedUser(user);
        setViewMode('detail');
        handleOpenSheet();
    };

    const openAddForm = () => {
        setSelectedUser(null);
        setFormData({
            username: '',
            email: '',
            full_name: '',
            phone: '',
            role: 'STAFF',
            password: '',
            is_active: true
        });
        setViewMode('form');
        handleOpenSheet();
    };

    const openEditForm = (user: UserType) => {
        setSelectedUser(user);
        setFormData({
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            phone: user.phone || '',
            role: user.role,
            password: '', // Empty password means no change
            is_active: user.is_active
        });
        setViewMode('form');
        handleOpenSheet();
    };

    const handleImpersonate = (targetUser: UserType) => {
        setDialogConfig({
            visible: true,
            title: 'Impersonate User',
            message: `Masuk sebagai ${targetUser.full_name}? Sesi admin saat ini akan disimpan agar bisa dikembalikan.`,
            variant: 'warning',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    const response = await authService.impersonateUser(targetUser.id);
                    if (!response.user || !response.access_token) {
                        throw new Error('Response impersonate tidak lengkap');
                    }

                    startImpersonation(response.user, response.access_token, response.impersonator || currentUser);
                    handleCloseSheet();

                    if (response.user.role === 'ADMIN' || response.user.role === 'MANAGER') {
                        router.replace('/(tabs)/home');
                    } else if (response.user.role === 'BENGKEL') {
                        router.replace('/bengkel');
                    } else if (response.user.role === 'JASA_ANGKUT') {
                        router.replace('/jasa-angkut');
                    } else if (response.user.role === 'MOBIL') {
                        router.replace('/mobil');
                    } else {
                        router.replace('/(tabs)/home');
                    }
                } catch (error) {
                    setDialogConfig({
                        visible: true,
                        title: 'Gagal',
                        message: getErrorMessage(error, 'Gagal melakukan impersonate user'),
                        variant: 'error',
                        type: 'alert'
                    });
                }
            }
        });
    };

    const handleDelete = (user: UserType) => {
        setDialogConfig({
            visible: true,
            title: 'Hapus User',
            message: `Apakah Anda yakin ingin menghapus user ${user.full_name}? Tindakan ini tidak dapat dibatalkan.`,
            variant: 'error',
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await deleteMutation.mutateAsync(user.id);
                    setDialogConfig({
                        visible: true,
                        title: 'Sukses',
                        message: 'User berhasil dihapus',
                        variant: 'success',
                        type: 'alert'
                    });
                    handleCloseSheet();
                    refetch();
                } catch (error) {
                    setDialogConfig({
                        visible: true,
                        title: 'Error',
                        message: getErrorMessage(error, 'Gagal menghapus user'),
                        variant: 'error',
                        type: 'alert'
                    });
                }
            }
        });
    };

    const handleSubmit = async () => {
        if (!formData.username || !formData.full_name || !formData.email || (!selectedUser && !formData.password)) {
            setDialogConfig({ visible: true, title: 'Validasi', message: 'Harap isi semua field wajib', variant: 'warning' });
            return;
        }

        try {
            if (selectedUser) {
                const updateData: UserUpdateData = {
                    username: formData.username,
                    email: formData.email,
                    full_name: formData.full_name,
                    phone: formData.phone,
                    role: formData.role,
                    is_active: formData.is_active
                };
                if (formData.password) updateData.password = formData.password;
                
                await updateMutation.mutateAsync({ id: selectedUser.id, data: updateData });
                setDialogConfig({ visible: true, title: 'Sukses', message: 'User berhasil diupdate', variant: 'success' });
            } else {
                await createMutation.mutateAsync(formData);
                setDialogConfig({ visible: true, title: 'Sukses', message: 'User baru berhasil ditambahkan', variant: 'success' });
            }
            handleCloseSheet();
        } catch (error) {
            setDialogConfig({ visible: true, title: 'Error', message: getErrorMessage(error, 'Gagal menyimpan user'), variant: 'error' });
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const renderUserItem = ({ item }: { item: UserType }) => {
        const roleInfo = ROLE_OPTIONS.find(r => r.value === item.role) || ROLE_OPTIONS[4];
        const RoleIcon = roleInfo.icon;

        return (
            <Pressable onPress={() => openDetail(item)}>
                <View className="bg-white p-4 rounded-[24px] mb-4 border border-gray-100 shadow-sm flex-row items-center">
                    <View style={{ backgroundColor: `${roleInfo.color}10` }} className="w-14 h-14 rounded-2xl border border-gray-50 items-center justify-center mr-4">
                        <RoleIcon size={24} color={roleInfo.color} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center justify-between mb-0.5">
                            <Typography variant="body1" weight="bold" className="text-textMain text-[16px] tracking-tight">{item.full_name}</Typography>
                            <View className="px-2 py-0.5 rounded-lg bg-gray-50 flex-row items-center border border-gray-100">
                                <View style={{ backgroundColor: item.is_active ? '#10B981' : '#EF4444' }} className="w-1.5 h-1.5 rounded-full mr-1.5" />
                                <Typography className="text-textGray text-[8px] font-black uppercase tracking-wider">
                                    {item.is_active ? 'Aktif' : 'Mati'}
                                </Typography>
                            </View>
                        </View>
                        <Typography className="text-textGray text-[11px] font-medium mb-2">@{item.username} • {item.email}</Typography>
                        <View className="flex-row items-center">
                            <View style={{ backgroundColor: roleInfo.color }} className="w-1.5 h-1.5 rounded-full mr-1.5" />
                            <Typography variant="caption" style={{ color: roleInfo.color }} className="font-bold tracking-wider uppercase text-[9px]">{roleInfo.label}</Typography>
                        </View>
                    </View>
                    <View className="ml-2 w-9 h-9 rounded-xl bg-gray-50 items-center justify-center border border-gray-100">
                        <MoreVertical size={16} color="#4B5563" />
                    </View>
                </View>
            </Pressable>
        );
    };

    const renderSheetContent = () => {
        if (viewMode === 'detail' && selectedUser) {
            const roleInfo = ROLE_OPTIONS.find(r => r.value === selectedUser.role) || ROLE_OPTIONS[4];
            const RoleIcon = roleInfo.icon;
            
            return (
                <View className="p-6">
                    <View className="flex-row justify-between items-center mb-6">
                        <Typography variant="h2" weight="bold">Profil User</Typography>
                        <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                            <X size={20} color="#6B7280" />
                        </Pressable>
                    </View>

                    <View className="items-center mb-8">
                        <View className="w-24 h-24 rounded-[32px] bg-gray-50 border border-gray-100 items-center justify-center mb-4">
                            <RoleIcon size={48} color={roleInfo.color} />
                        </View>
                        <Typography variant="h2" weight="bold" className="text-center mb-1">{selectedUser.full_name}</Typography>
                        <View className="flex-row space-x-2">
                            <Badge 
                                label={roleInfo.label} 
                                variant="info" 
                                style={{ backgroundColor: `${roleInfo.color}20` }} 
                            />
                            <Badge 
                                label={selectedUser.is_active ? 'AKTIF' : 'NONAKTIF'} 
                                variant={selectedUser.is_active ? 'success' : 'error'} 
                            />
                        </View>
                    </View>

                    <Card className="p-5 mb-8 border border-gray-100 rounded-[32px]">
                        <View className="space-y-4">
                            <View className="flex-row items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-4">
                                    <User size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Username</Typography>
                                    <Typography weight="bold" className="text-textMain">@{selectedUser.username}</Typography>
                                </View>
                            </View>

                            <View className="flex-row items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                                <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-4">
                                    <Mail size={20} color="#6B7280" />
                                </View>
                                <View>
                                    <Typography className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Email Address</Typography>
                                    <Typography weight="bold" className="text-textMain">{selectedUser.email}</Typography>
                                </View>
                            </View>

                            {selectedUser.phone && (
                                <View className="flex-row items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                                    <View className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-sm mr-4">
                                        <Phone size={20} color="#6B7280" />
                                    </View>
                                    <View>
                                        <Typography className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Contact Number</Typography>
                                        <Typography weight="bold" className="text-textMain">{selectedUser.phone}</Typography>
                                    </View>
                                </View>
                            )}
                        </View>
                    </Card>

                    <View className="flex-row space-x-3 mb-3">
                        <Button title="Edit User" onPress={() => openEditForm(selectedUser)} variant="outline" className="flex-1" />
                        <Button 
                            title={selectedUser.is_active ? "Nonaktifkan" : "Aktifkan"} 
                            variant={selectedUser.is_active ? "danger" : "primary"}
                            className="flex-1"
                            onPress={async () => {
                                await updateMutation.mutateAsync({ id: selectedUser.id, data: { is_active: !selectedUser.is_active } });
                                handleCloseSheet();
                            }}
                        />
                    </View>
                    {currentUser?.role === 'ADMIN' && selectedUser.id !== currentUser.id && selectedUser.role !== 'ADMIN' && selectedUser.is_active && (
                        <Button
                            title="Impersonate"
                            onPress={() => handleImpersonate(selectedUser)}
                            variant="secondary"
                            className="mb-3"
                        />
                    )}
                    <Button 
                        title="Hapus User" 
                        onPress={() => handleDelete(selectedUser)}
                        variant="outline-danger"
                        icon={<Trash2 size={18} color="#EF4444" />}
                    />
                </View>
            );
        }

        return (
            <View className="p-6">
                <View className="flex-row justify-between items-center mb-6">
                    <Typography variant="h2" weight="bold">
                        {selectedUser ? 'Edit User' : 'Tambah User'}
                    </Typography>
                    <Pressable onPress={handleCloseSheet} className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center">
                        <X size={20} color="#6B7280" />
                    </Pressable>
                </View>

                <View className="space-y-4 pb-10">
                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Username *</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary"
                            placeholder="username"
                            value={formData.username}
                            onChangeText={(text) => setFormData({ ...formData, username: text.toLowerCase() })}
                            autoCapitalize="none"
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Nama Lengkap *</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary"
                            placeholder="Budi Santoso"
                            value={formData.full_name}
                            onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Password {selectedUser ? '(Kosongkan jika tidak ganti)' : '*'}</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary"
                            placeholder="******"
                            secureTextEntry
                            value={formData.password}
                            onChangeText={(text) => setFormData({ ...formData, password: text })}
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Email *</Typography>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-textMain font-medium focus:border-primary"
                            placeholder="budi@example.com"
                            keyboardType="email-address"
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            autoCapitalize="none"
                        />
                    </View>

                    <View>
                        <Typography className="mb-2 text-textGray font-bold text-[10px] uppercase tracking-widest ml-1">Role / Jabatan</Typography>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {ROLE_OPTIONS.map((role) => (
                                <Pressable
                                    key={role.value}
                                    onPress={() => setFormData({ ...formData, role: role.value })}
                                    style={formData.role === role.value ? { backgroundColor: themeColors.primary, borderColor: themeColors.primary } : {}}
                                    className={`mr-3 px-4 py-3 rounded-2xl border ${formData.role === role.value ? '' : 'bg-gray-50 border-gray-100'}`}
                                >
                                    <View className="flex-row items-center">
                                        <role.icon size={16} color={formData.role === role.value ? 'white' : role.color} />
                                        <Typography className={`ml-2 font-bold ${formData.role === role.value ? 'text-white' : 'text-gray-500'}`}>
                                            {role.label}
                                        </Typography>
                                    </View>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    <Button
                        title={selectedUser ? "Simpan Perubahan" : "Tambah User"}
                        onPress={handleSubmit}
                        loading={createMutation.isPending || updateMutation.isPending}
                        className="mt-6"
                        size="lg"
                    />
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-background">
            <StatusBar barStyle="dark-content" />

            <Header
                title="Daftar Pengguna"
                subtitle="Manajemen Hak Akses Sistem"
                showBackButton={true}
                rightElement={
                    <Pressable 
                        onPress={onRefresh} 
                        className="w-11 h-11 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100 active:bg-gray-100"
                    >
                        {refreshing ? <ActivityIndicator size="small" color="#1F2937" /> : <RefreshCw size={20} color="#1F2937" />}
                    </Pressable>
                }
            />

            {/* Search Bar */}
            <View className="px-6 mt-4">
                <View className="bg-white p-2 rounded-[24px] flex-row items-center border border-gray-100 shadow-sm">
                    <View className="flex-1 flex-row items-center px-4 h-12 rounded-2xl bg-gray-50">
                        <Search size={18} color="#9CA3AF" />
                        <TextInput
                            placeholder="Cari nama, username, atau email..."
                            className="flex-1 ml-3 text-sm font-semibold text-textMain"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                    <Pressable 
                        onPress={openAddForm}
                        style={{ backgroundColor: themeColors.primary }}
                        className="ml-2 w-12 h-12 rounded-2xl items-center justify-center active:scale-95 transition-transform"
                    >
                        <Plus size={24} color="white" />
                    </Pressable>
                </View>
            </View>

            {/* Bento Stats Row */}
            <View className="px-6 mt-4 mb-2 flex-row justify-between">
                <View className="flex-1 bg-white p-4 rounded-[20px] border border-gray-100 shadow-sm mr-3">
                    <Typography className="text-textGray/40 text-[9px] uppercase font-bold tracking-[1.5px] mb-1">Total</Typography>
                    <Typography className="text-primary text-2xl font-black">{stats.total}</Typography>
                </View>
                <View className="flex-1 bg-white p-4 rounded-[20px] border border-gray-100 shadow-sm mr-3">
                    <Typography className="text-textGray/40 text-[9px] uppercase font-bold tracking-[1.5px] mb-1">Aktif</Typography>
                    <Typography className="text-emerald-600 text-2xl font-black">{stats.active}</Typography>
                </View>
                <View className="flex-1 bg-white p-4 rounded-[20px] border border-gray-100 shadow-sm">
                    <Typography className="text-textGray/40 text-[9px] uppercase font-bold tracking-[1.5px] mb-1">Nonaktif</Typography>
                    <Typography className="text-rose-500 text-2xl font-black">{stats.inactive}</Typography>
                </View>
            </View>

            <FlatList
                data={userList}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />}
                ListHeaderComponent={isLoading ? <SkeletonCard /> : null}
                ListEmptyComponent={!isLoading ? <EmptyState title="User Tidak Ditemukan" description="Mulai dengan menambah user baru." icon={UsersIcon} /> : null}
            />


            {/* Bottom Sheet for Detail/Form */}
            {Platform.OS === 'web' ? (
                sheetVisible && (
                    <View className="absolute inset-0 bg-black/50 justify-end z-50">
                        <View className="bg-white rounded-t-[40px] h-[90%] max-w-xl self-center w-full overflow-hidden">
                            <ScrollView
                                style={{ flex: 1 }}
                                showsVerticalScrollIndicator
                                nestedScrollEnabled
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{ paddingBottom: 40 }}
                            >
                                {renderSheetContent()}
                            </ScrollView>
                        </View>
                    </View>
                )
            ) : (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={-1}
                    snapPoints={snapPoints}
                    enablePanDownToClose
                    backgroundStyle={{ borderRadius: 48, backgroundColor: 'white' }}
                    handleIndicatorStyle={{ backgroundColor: '#E5E7EB', width: 48 }}
                    onChange={(index) => setSheetVisible(index !== -1)}
                    onClose={() => setSheetVisible(false)}
                >
                    <BottomSheetScrollView>{renderSheetContent()}</BottomSheetScrollView>
                </BottomSheet>
            )}

            <AlertDialog
                visible={dialogConfig.visible}
                title={dialogConfig.title}
                message={dialogConfig.message}
                variant={dialogConfig.variant}
                type={dialogConfig.type}
                onConfirm={dialogConfig.onConfirm}
                onClose={() => setDialogConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}


