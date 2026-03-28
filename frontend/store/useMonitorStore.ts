import { create } from 'zustand';

interface RequestLog {
    id: string;
    method: string;
    url: string;
    status?: number;
    duration?: number;
    timestamp: number;
    delta?: number; // Size of payload if any
}

interface MonitorState {
    requestCount: number;
    errorCount: number;
    avgLatency: number;
    totalPayloadSize: number; // In bytes
    logs: RequestLog[];
    
    // Actions
    logRequest: (log: RequestLog) => void;
    updateResponse: (id: string, status: number, duration: number, delta?: number) => void;
    clearLogs: () => void;
}

export const useMonitorStore = create<MonitorState>((set) => ({
    requestCount: 0,
    errorCount: 0,
    avgLatency: 0,
    totalPayloadSize: 0,
    logs: [],

    logRequest: (newLog) => set((state) => {
        const newLogs = [newLog, ...state.logs].slice(0, 100); 
        
        return {
            requestCount: state.requestCount + 1,
            logs: newLogs,
        };
    }),

    updateResponse: (id, status, duration, delta = 0) => set((state) => {
        const logs = state.logs.map(log => 
            log.id === id ? { ...log, status, duration, delta } : log
        );
        
        const isError = status >= 400;
        const totalLatency = (state.avgLatency * (state.requestCount - 1)) + duration;
        const newAvg = state.requestCount > 0 ? totalLatency / state.requestCount : duration;

        return {
            logs,
            errorCount: isError ? state.errorCount + 1 : state.errorCount,
            avgLatency: newAvg,
            totalPayloadSize: state.totalPayloadSize + delta
        };
    }),

    clearLogs: () => set({ 
        requestCount: 0, 
        errorCount: 0, 
        avgLatency: 0, 
        totalPayloadSize: 0,
        logs: [] 
    })
}));
