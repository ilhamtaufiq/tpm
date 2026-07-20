import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { useResponsive } from '../hooks/useResponsive';
import { Wrench, CarFront, Truck, Users, BarChart3, Database, History, Wallet, Settings } from 'lucide-react-native';
import { Typography } from './ui/Typography';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchMenu, pathForPrefetch } from '../utils/prefetchMenu';

type MenuItem = {
    id: string;
    label: string;
    icon: any;
    color: string;
    path: string;
};

const ServiceCard = React.memo(function ServiceCard({
    menu,
    columns,
    onOpen,
    onWarm,
}: {
    menu: MenuItem;
    columns: number;
    onOpen: (path: string) => void;
    onWarm: (path: string) => void;
}) {
    const Icon = menu.icon;
    return (
        <View style={{ width: `${100 / columns}%` as any }} className="items-center mb-5 px-1">
            <Pressable
                onPressIn={() => onWarm(menu.path)}
                onPress={() => onOpen(menu.path)}
                android_ripple={{ color: `${menu.color}22`, borderless: false }}
                className="items-center w-full active:opacity-70"
            >
                <View
                    style={{ backgroundColor: 'white', borderRadius: 20 }}
                    className="w-14 h-14 items-center justify-center mb-1.5 border border-gray-100 shadow-sm"
                >
                    <View
                        style={{ backgroundColor: `${menu.color}15` }}
                        className="w-10 h-10 rounded-xl items-center justify-center"
                    >
                        <Icon size={22} color={menu.color} strokeWidth={2} />
                    </View>
                </View>
                <Typography
                    variant="caption"
                    weight="bold"
                    className="text-gray-600 text-[9px] uppercase tracking-tighter text-center"
                    numberOfLines={2}
                >
                    {menu.label}
                </Typography>
            </Pressable>
        </View>
    );
});

export const ServiceGrid = () => {
    const { user } = useAuthStore();
    const { columns } = useResponsive();
    const queryClient = useQueryClient();

    const MENUS: MenuItem[] = useMemo(
        () => [
            { id: 'bengkel', label: 'Bengkel', icon: Wrench, color: '#3b82f6', path: '/bengkel' },
            { id: 'logistik', label: 'Jasa Angkut', icon: Truck, color: '#f97316', path: '/jasa-angkut' },
            { id: 'mobil', label: 'Jual Beli', icon: CarFront, color: '#10b981', path: '/mobil' },
            { id: 'keuangan', label: 'Keuangan', icon: Wallet, color: '#ef4444', path: '/finance' },
            { id: 'master', label: 'Master', icon: Database, color: '#8b5cf6', path: '/master-data' },
            { id: 'sdm', label: 'SDM', icon: Users, color: '#ec4899', path: '/sdm' },
            { id: 'laporan', label: 'Laporan', icon: BarChart3, color: '#14b8a6', path: '/laporan' },
            { id: 'riwayat', label: 'Riwayat', icon: History, color: '#6366f1', path: '/history' },
            { id: 'profil', label: 'Pengaturan', icon: Settings, color: '#4b5563', path: '/(tabs)/profile' },
        ],
        []
    );

    const filteredMenus = useMemo(() => {
        return MENUS.filter((menu) => {
            const role = user?.role;
            const isAdmin = role === 'ADMIN' || role === 'MANAGER';
            if (isAdmin) return true;
            if (['admin', 'keuangan', 'master', 'sdm', 'laporan'].includes(menu.id)) return false;
            if (role === 'BENGKEL') return ['bengkel', 'riwayat', 'profil'].includes(menu.id);
            if (role === 'JASA_ANGKUT') return ['logistik', 'riwayat', 'profil'].includes(menu.id);
            if (role === 'MOBIL') return ['mobil', 'riwayat', 'profil'].includes(menu.id);
            return true;
        });
    }, [MENUS, user?.role]);

    const warm = useCallback(
        (path: string) => {
            prefetchMenu(queryClient, pathForPrefetch(path));
        },
        [queryClient]
    );

    const openMenu = useCallback(
        (path: string) => {
            warm(path);
            // navigate reuses stack when possible (faster than push on repeat visits)
            router.navigate(path as any);
        },
        [warm]
    );

    // Warm data cache + JS chunks for heavy unit menus after Home paints
    useEffect(() => {
        const t = setTimeout(() => {
            warm('/bengkel');
            warm('/jasa-angkut');
            warm('/mobil');
        }, 350);
        return () => clearTimeout(t);
    }, [warm]);

    return (
        <View className="px-5 mt-6">
            <View className="flex-row flex-wrap">
                {filteredMenus.map((menu) => (
                    <ServiceCard
                        key={menu.id}
                        menu={menu}
                        columns={columns}
                        onOpen={openMenu}
                        onWarm={warm}
                    />
                ))}
            </View>
        </View>
    );
};
