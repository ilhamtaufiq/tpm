import api, { BASE_URL } from '../utils/api';
import { useAuthStore } from '../store/useAuthStore';
import { Platform } from 'react-native';

export type ImportSheetResult = {
    rows: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
};

export type ImportResult = {
    batch_id: string;
    dry_run: boolean;
    ok: boolean;
    sheets: Record<string, ImportSheetResult>;
};

async function authHeaders(): Promise<Record<string, string>> {
    const token = useAuthStore.getState().token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export const dataImportService = {
    async downloadTemplate(): Promise<Blob | ArrayBuffer> {
        const response = await api.get('/data-import/template', {
            responseType: 'blob',
        });
        return response.data;
    },

    async preview(file: File | { uri: string; name: string; type: string }): Promise<ImportResult> {
        const form = new FormData();
        if (Platform.OS === 'web') {
            form.append('file', file as File);
        } else {
            form.append('file', file as any);
        }
        const headers = await authHeaders();
        const response = await api.post('/data-import/preview', form, {
            headers: {
                ...headers,
                'Content-Type': 'multipart/form-data',
            },
            timeout: 120000,
        });
        return response.data;
    },

    async commit(file: File | { uri: string; name: string; type: string }): Promise<ImportResult> {
        const form = new FormData();
        if (Platform.OS === 'web') {
            form.append('file', file as File);
        } else {
            form.append('file', file as any);
        }
        const headers = await authHeaders();
        const response = await api.post('/data-import/commit', form, {
            headers: {
                ...headers,
                'Content-Type': 'multipart/form-data',
            },
            timeout: 180000,
        });
        return response.data;
    },
};

/** Helper for web download of blob */
export function downloadBlobWeb(blob: Blob, filename: string) {
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export { BASE_URL };
