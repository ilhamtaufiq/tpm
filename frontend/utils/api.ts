import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/useAuthStore';

// For physical devices, use your computer's IP address instead of localhost
const debuggerHost = Constants.expoConfig?.hostUri?.split(`:`)[0];

const getBaseUrl = () => {
    // Check if running in web browser
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;

        // In production or Docker environment
        if (hostname === 'tpm.cianjur.space') {
            return 'https://tpm.cianjur.space';
        }

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `${protocol}//${hostname}:8000`;
        }

        // For local development with tpm.test pointing to Laragon
        if (hostname === 'tpm.test') {
            return 'http://tpm.test:8000';
        }
    }

    // Default for production build (standalone)
    if (!debuggerHost) {
        return 'https://tpm.cianjur.space';
    }

    // Development mode (Expo Go)
    return `http://${debuggerHost}:8000`;
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

// Add a request interceptor to attach the token
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);

export default api;
