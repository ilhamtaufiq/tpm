import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff } from 'lucide-react-native';

export const ConnectivityBanner = () => {
    // Default to true (online) initially to avoid flicker
    const [isOffline, setIsOffline] = React.useState(false);
    
    React.useEffect(() => {
        // Get initial state immediately
        NetInfo.fetch().then(state => {
            setIsOffline(!(state.isConnected));
        });

        const unsubscribe = NetInfo.addEventListener((state) => {
            // Use isConnected only. isInternetReachable is slow (uses pings) and causes delay.
            const offline = !(state.isConnected);
            
            // Add a small 1s debounce for "offline" to avoid flickering on micro-disconnects
            if (offline) {
                const timer = setTimeout(() => setIsOffline(true), 1000);
                return () => clearTimeout(timer);
            } else {
                setIsOffline(false);
            }
        });

        return () => unsubscribe();
    }, []);

    if (!isOffline) return null;

    return (
        <View style={[
            styles.container,
            styles.offlineContainer
        ]}>
            <View style={styles.content}>
                <WifiOff size={14} color="#fff" />
                <Text style={styles.text}>Mode Offline: Data yang ditampilkan berasal dari penyimpanan lokal.</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingVertical: 6,
        paddingHorizontal: 16,
    },
    offlineContainer: {
        backgroundColor: '#f59e0b', // Amber
    },

    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    text: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
});
