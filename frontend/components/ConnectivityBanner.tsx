import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { WifiOff, CloudSync } from 'lucide-react-native';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export const ConnectivityBanner = () => {
    const isFetching = useIsFetching();
    const isMutating = useIsMutating();
    const isSyncing = isFetching > 0 || isMutating > 0;
    const [isOffline, setIsOffline] = React.useState(false);

    React.useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsOffline(!(state.isConnected && state.isInternetReachable));
        });

        return () => unsubscribe();
    }, []);

    if (!isOffline && !isSyncing) return null;

    return (
        <View style={[
            styles.container,
            isOffline ? styles.offlineContainer : styles.syncingContainer
        ]}>
            <View style={styles.content}>
                {isOffline ? (
                    <>
                        <WifiOff size={14} color="#fff" />
                        <Text style={styles.text}>Mode Offline: Data yang ditampilkan berasal dari penyimpanan lokal.</Text>
                    </>
                ) : (
                    <>
                        <CloudSync size={14} color="#fff" />
                        <Text style={styles.text}>Internet Tersambung. Mensinkronkan data terbaru...</Text>
                    </>
                )}
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
    syncingContainer: {
        backgroundColor: '#3b82f6', // Blue
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
