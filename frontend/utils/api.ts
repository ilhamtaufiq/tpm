import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/useAuthStore';
import { useMonitorStore } from '../store/useMonitorStore';

// For physical devices, use your computer's IP address instead of localhost
const debuggerHost = Constants.expoConfig?.hostUri?.split(`:`)[0];

const getBaseUrl = () => {
    // Check if running in web browser
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;

        // Auto-detect for .cianjur.space domains (tpm.cianjur.space, tpmv1.cianjur.space, etc)
        if (hostname.includes('cianjur.space')) {
            return `${protocol}//${hostname}`;
        }

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `${protocol}//${hostname}:8000`;
        }

        // For local development with tpm.test pointing to Laragon
        if (hostname === 'tpm.test') {
            return 'http://tpm.test:8000';
        }
    }

    // Default fallback (Standalone/Mobile)
    return 'https://tpm.cianjur.space';
};

export const FILE_URL = getBaseUrl();
export const BASE_URL = FILE_URL ? `${FILE_URL}/api/v1` : '/api/v1';

console.log('[TPM API] Environment:', __DEV__ ? 'Development' : 'Production');
console.log('[TPM API] Base URL:', BASE_URL);
console.log('[TPM API] Debugger Host:', debuggerHost || 'N/A (Production Build)');

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
});

// Add a request interceptor to attach the token and log for monitoring
interface MonitoringConfig extends InternalAxiosRequestConfig {
    _monitorId?: string;
    _startTime?: number;
}

api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const monitoringConfig = config as MonitoringConfig;
        const token = useAuthStore.getState().token;
        
        if (token && monitoringConfig.headers) {
            monitoringConfig.headers.Authorization = `Bearer ${token}`;
        }
        
        // Monitoring start
        monitoringConfig._startTime = Date.now();
        const id = Math.random().toString(36).substring(7);
        monitoringConfig._monitorId = id;
        
        useMonitorStore.getState().logRequest({
            id: id,
            method: monitoringConfig.method?.toUpperCase() || 'GET',
            url: monitoringConfig.url || '/',
            timestamp: Date.now(),
        });
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle token expiration and monitor performance
api.interceptors.response.use(
    (response: AxiosResponse) => {
        const config = response.config as MonitoringConfig;
        const duration = Date.now() - (config._startTime || Date.now());
        const delta = response.data ? JSON.stringify(response.data).length : 0;
        
        if (config._monitorId) {
            useMonitorStore.getState().updateResponse(
                config._monitorId, 
                response.status, 
                duration, 
                delta
            );
        }
        
        return response;
    },
    (error) => {
        const config = error.config as MonitoringConfig | undefined;
        const duration = Date.now() - (config?._startTime || Date.now());
        const status = error.response?.status || 0;
        
        if (config?._monitorId) {
            useMonitorStore.getState().updateResponse(
                config._monitorId, 
                status, 
                duration, 
                0
            );
        }
        
        if (status === 401) {
            const authState = useAuthStore.getState();
            if (authState.isImpersonating && authState.originalToken) {
                authState.stopImpersonation();
            } else {
                authState.logout();
            }
        }
        return Promise.reject(error);
    }
);

export default api;

