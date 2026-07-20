import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function TabsLayout() {
    const { isAuthenticated, hasHydrated } = useAuthStore();

    if (hasHydrated && !isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { display: 'none' },
                freezeOnBlur: true,
                lazy: true,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: 'History',
                }}
            />
            <Tabs.Screen
                name="finance"
                options={{
                    title: 'Finance',
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                }}
            />
        </Tabs>
    );
}
// // Navigasi NavBar
