import { create } from 'zustand';
import { Platform } from 'react-native';

const sendClientLogToBackend = (entry: Partial<AppLogEntry>) => {
    try {
        const platform = Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web';
        fetch('/api/v1/monitor/client-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: entry.type || 'ERROR',
                title: entry.title || 'Client Log',
                message: entry.message || '',
                platform,
                duration: entry.duration || 0,
                status: entry.status || 0,
                stack: entry.stack,
                url: entry.url
            })
        }).catch(() => {});
    } catch (e) {}
};

export interface RequestLog {
    id: string;
    method: string;
    url: string;
    status?: number;
    duration?: number;
    timestamp: number;
    delta?: number; // Size of payload if any
}

export interface AppLogEntry {
    id: string;
    type: 'API' | 'LAG' | 'BUG' | 'ERROR';
    title: string;
    message: string;
    duration?: number;
    status?: number;
    url?: string;
    stack?: string;
    timestamp: number;
}

interface MonitorState {
    requestCount: number;
    errorCount: number;
    lagCount: number;
    bugCount: number;
    avgLatency: number;
    totalPayloadSize: number; // In bytes
    logs: RequestLog[];
    appLogs: AppLogEntry[];
    serverStats: any; // Data from backend

    // Actions
    logRequest: (log: RequestLog) => void;
    updateResponse: (id: string, status: number, duration: number, delta?: number) => void;
    logLag: (title: string, duration: number, details?: string) => void;
    logBug: (title: string, errorMsg: string, stack?: string) => void;
    logCustomError: (title: string, message: string, status?: number) => void;
    setServerStats: (stats: any) => void;
    clearLogs: () => void;
}

export const useMonitorStore = create<MonitorState>((set) => ({
    requestCount: 0,
    errorCount: 0,
    lagCount: 0,
    bugCount: 0,
    avgLatency: 0,
    totalPayloadSize: 0,
    logs: [],
    appLogs: [],
    serverStats: null,

    logRequest: (newLog) => set((state) => {
        const newLogs = [newLog, ...state.logs].slice(0, 100);

        return {
            requestCount: state.requestCount + 1,
            logs: newLogs,
        };
    }),

    setServerStats: (serverStats) => set({ serverStats }),

    updateResponse: (id, status, duration, delta = 0) => set((state) => {
        const logs = state.logs.map(log =>
            log.id === id ? { ...log, status, duration, delta } : log
        );

        const isError = status >= 400;
        const totalLatency = (state.avgLatency * (state.requestCount - 1)) + duration;
        const newAvg = state.requestCount > 0 ? totalLatency / state.requestCount : duration;

        // Auto log lag if API response took > 1000ms
        const newAppLogs = [...state.appLogs];
        let extraLagCount = 0;
        let extraBugCount = 0;

        const targetLog = state.logs.find(l => l.id === id);
        if (duration > 1000 && targetLog) {
            extraLagCount = 1;
            newAppLogs.unshift({
                id: Math.random().toString(36).substring(7),
                type: 'LAG',
                title: `API High Latency (${duration}ms)`,
                message: `${targetLog.method} ${targetLog.url} merespons dalam ${duration}ms`,
                duration,
                status,
                url: targetLog.url,
                timestamp: Date.now()
            });
        }

        if (isError && targetLog) {
            extraBugCount = 1;
            newAppLogs.unshift({
                id: Math.random().toString(36).substring(7),
                type: 'ERROR',
                title: `HTTP ${status} Error`,
                message: `${targetLog.method} ${targetLog.url} gagal dengan status ${status}`,
                status,
                url: targetLog.url,
                timestamp: Date.now()
            });
        }

        return {
            logs,
            appLogs: newAppLogs.slice(0, 200),
            errorCount: isError ? state.errorCount + 1 : state.errorCount,
            lagCount: state.lagCount + extraLagCount,
            bugCount: state.bugCount + extraBugCount,
            avgLatency: newAvg,
            totalPayloadSize: state.totalPayloadSize + delta
        };
    }),

    logLag: (title, duration, details = '') => set((state) => {
        const entry: AppLogEntry = {
            id: Math.random().toString(36).substring(7),
            type: 'LAG',
            title,
            message: details || `Terdeteksi delay ${duration}ms`,
            duration,
            timestamp: Date.now()
        };
        return {
            lagCount: state.lagCount + 1,
            appLogs: [entry, ...state.appLogs].slice(0, 200)
        };
    }),

    logBug: (title, errorMsg, stack) => set((state) => {
        const entry: AppLogEntry = {
            id: Math.random().toString(36).substring(7),
            type: 'BUG',
            title,
            message: errorMsg,
            stack,
            timestamp: Date.now()
        };
        return {
            bugCount: state.bugCount + 1,
            appLogs: [entry, ...state.appLogs].slice(0, 200)
        };
    }),

    logCustomError: (title, message, status) => set((state) => {
        const entry: AppLogEntry = {
            id: Math.random().toString(36).substring(7),
            type: 'ERROR',
            title,
            message,
            status,
            timestamp: Date.now()
        };
        return {
            errorCount: state.errorCount + 1,
            appLogs: [entry, ...state.appLogs].slice(0, 200)
        };
    }),

    clearLogs: () => set({
        requestCount: 0,
        errorCount: 0,
        lagCount: 0,
        bugCount: 0,
        avgLatency: 0,
        totalPayloadSize: 0,
        logs: [],
        appLogs: []
    })
}));
