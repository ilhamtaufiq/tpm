import React, { useEffect, useState, useMemo } from 'react';
import { View, ScrollView, Pressable, StatusBar, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { 
    Activity, 
    Zap, 
    AlertCircle, 
    ArrowLeft, 
    Trash2, 
    Wifi, 
    Cpu, 
    Database,
    Clock,
    Battery
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useMonitorStore } from '../store/useMonitorStore';
import { format } from 'date-fns';
import { useUIStore } from '../store/useUIStore';
import api from '../utils/api';

const StatusBadge = ({ status }: { status?: number }) => {
    if (!status) return <View className="w-2 h-2 rounded-full bg-gray-400" />;
    const color = status < 400 ? 'bg-emerald-500' : 'bg-rose-500';
    return <View className={`w-2 h-2 rounded-full ${color}`} />;
};

export default function MonitorScreen() {
    const { 
        requestCount, 
        errorCount, 
        avgLatency, 
        totalPayloadSize, 
        logs, 
        clearLogs,
        serverStats,
        setServerStats
    } = useMonitorStore();
    
    const { themeColors } = useUIStore();
    const [renderLogs, setRenderLogs] = useState(true);
    const [activeSection, setActiveSection] = useState<'network' | 'database'>('network');

    // Polling server stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/monitor/stats');
                setServerStats(response.data);
            } catch (err) {
                console.log('[Monitor] Failed to fetch server stats');
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    // Calculate Load Index (0-100)
    // Based on many requests in the last 1 minute
    const loadIndex = useMemo(() => {
        const oneMinuteAgo = Date.now() - 60000;
        const recentCount = logs.filter(l => l.timestamp > oneMinuteAgo).length;
        // Assume 20 requests/minute is "high" for a mobile app
        return Math.min(100, (recentCount / 20) * 100);
    }, [logs]);

    const getLoadColor = (index: number) => {
        if (index < 30) return '#10B981'; // Green
        if (index < 70) return '#F59E0B'; // Amber
        return '#EF4444'; // Red
    };

    return (
        <View className="flex-1 bg-black">
            <StatusBar barStyle="light-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between border-b border-white/10">
                    <View className="flex-row items-center">
                        <Pressable 
                            onPress={() => router.back()} 
                            className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4"
                        >
                            <ArrowLeft size={20} color="white" />
                        </Pressable>
                        <View>
                            <Typography weight="bold" className="text-white text-lg tracking-tighter">NETWORK MONITOR</Typography>
                            <View className="flex-row items-center">
                                <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                                <Typography variant="caption" className="text-emerald-500/80 font-bold uppercase text-[8px]">Real-time Sync Active</Typography>
                            </View>
                        </View>
                    </View>
                    <Pressable 
                        onPress={clearLogs}
                        className="bg-rose-500/20 px-3 py-1.5 rounded-lg flex-row items-center border border-rose-500/30"
                    >
                        <Trash2 size={12} color="#FB7185" />
                        <Typography variant="caption" weight="bold" className="text-rose-400 ml-1.5 text-[10px]">RESET</Typography>
                    </Pressable>
                </View>

                {/* Tabs */}
                <View className="flex-row px-6 mt-4">
                    <Pressable 
                        onPress={() => setActiveSection('network')}
                        className={`px-4 py-2 rounded-full mr-2 ${activeSection === 'network' ? 'bg-blue-600' : 'bg-white/5'}`}
                    >
                        <Typography weight="bold" className={`text-xs ${activeSection === 'network' ? 'text-white' : 'text-white/40'}`}>NETWORK</Typography>
                    </Pressable>
                    <Pressable 
                        onPress={() => setActiveSection('database')}
                        className={`px-4 py-2 rounded-full ${activeSection === 'database' ? 'bg-purple-600' : 'bg-white/5'}`}
                    >
                        <Typography weight="bold" className={`text-xs ${activeSection === 'database' ? 'text-white' : 'text-white/40'}`}>DATABASE</Typography>
                    </Pressable>
                </View>

                <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
                    {activeSection === 'network' ? (
                        <>
                            {/* Network Metrics Dashboard */}
                            <View className="flex-row flex-wrap -mx-2">
                                <View className="w-1/2 px-2 mb-4">
                                    <View className="bg-white/5 p-4 rounded-3xl border border-white/10">
                                        <Activity size={16} color="#3B82F6" />
                                        <Typography className="text-white/40 text-[9px] font-bold uppercase mt-2">Requests</Typography>
                                        <Typography weight="bold" className="text-white text-xl">{requestCount}</Typography>
                                    </View>
                                </View>
                                <View className="w-1/2 px-2 mb-4">
                                    <View className="bg-white/5 p-4 rounded-3xl border border-white/10">
                                        <Clock size={16} color="#10B981" />
                                        <Typography className="text-white/40 text-[9px] font-bold uppercase mt-2">Avg Latency</Typography>
                                        <Typography weight="bold" className="text-white text-xl">{Math.round(avgLatency)}<Typography className="text-xs text-white/50">ms</Typography></Typography>
                                    </View>
                                </View>
                            </View>

                            {/* Load Indicator */}
                            <View className="bg-white/5 p-6 rounded-[32px] border border-white/10 mb-6">
                                <View className="flex-row justify-between items-center mb-4">
                                    <View className="flex-row items-center">
                                        <Zap size={18} color={getLoadColor(loadIndex)} />
                                        <Typography weight="bold" className="text-white ml-2">Server Load Index</Typography>
                                    </View>
                                    <Typography weight="bold" style={{ color: getLoadColor(loadIndex) }}>{Math.round(loadIndex)}%</Typography>
                                </View>
                                <View className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <View 
                                        style={{ width: `${loadIndex}%`, backgroundColor: getLoadColor(loadIndex) }} 
                                        className="h-full rounded-full" 
                                    />
                                </View>
                            </View>

                            {/* Logs List */}
                            <View className="bg-white/5 rounded-[32px] border border-white/10 overflow-hidden mb-12">
                                {logs.length === 0 ? (
                                    <View className="py-20 items-center">
                                        <View style={{ opacity: 0.3 }}>
                                            <ActivityIndicator size="small" color="white" />
                                        </View>
                                        <Typography className="text-white/20 mt-4 font-bold text-[10px] tracking-widest uppercase">Watching Traffic...</Typography>
                                    </View>
                                ) : (
                                    logs.map((log, idx) => (
                                        <View key={log.id} className="p-4 flex-row items-center border-b border-white/5">
                                            <View className="mr-3"><StatusBadge status={log.status} /></View>
                                            <View className="flex-1">
                                                <Typography variant="caption" weight="bold" className="text-white/90 font-mono text-[9px]">
                                                    {log.method} <Typography className="text-emerald-400">{log.url.split('?')[0].replace('/api/v1', '')}</Typography>
                                                </Typography>
                                                <Typography className="text-[8px] text-white/30 font-mono mt-0.5">
                                                    STATUS: {log.status} • {log.duration}ms
                                                </Typography>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </>
                    ) : (
                        <>
                            {/* Database Stats Section */}
                            <View className="bg-white/5 p-6 rounded-[32px] border border-purple-500/30 mb-6">
                                <View className="flex-row items-center mb-4">
                                    <Database size={20} color="#A855F7" />
                                    <Typography weight="bold" className="text-white ml-2 text-lg">System Intelligence</Typography>
                                </View>
                                
                                <View className="flex-row justify-between mb-4">
                                    <View>
                                        <Typography className="text-white/40 text-[10px] uppercase font-bold">Storage Use</Typography>
                                        <Typography weight="bold" className="text-white text-2xl">{serverStats?.database?.total_size_mb || '0.0'}<Typography className="text-xs"> MB</Typography></Typography>
                                    </View>
                                    <View className="items-end">
                                        <Typography className="text-white/40 text-[10px] uppercase font-bold">Total Tables</Typography>
                                        <Typography weight="bold" className="text-white text-2xl">{serverStats?.database?.table_count || '0'}</Typography>
                                    </View>
                                </View>

                                <Typography className="text-white/30 text-[10px] mb-4">TABLE DISTRIBUTION (BY ROWS)</Typography>
                                
                                {serverStats?.database?.tables?.map((table: any, idx: number) => (
                                    <View key={table.name} className="mb-4">
                                        <View className="flex-row justify-between items-center mb-1.5">
                                            <Typography weight="bold" className="text-white/90 text-xs">{table.name}</Typography>
                                            <Typography className="text-purple-400 text-[10px] font-bold">{table.rows.toLocaleString()} ROWS</Typography>
                                        </View>
                                        <View className="h-1 bg-white/5 rounded-full overflow-hidden">
                                            <View 
                                                style={{ width: `${Math.min(100, (table.rows / 1000) * 100)}%` }} 
                                                className="h-full bg-purple-500/50 rounded-full" 
                                            />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
