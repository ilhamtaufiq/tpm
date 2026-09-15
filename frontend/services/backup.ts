import api, { BASE_URL } from '../utils/api';
import { useAuthStore } from '../store/useAuthStore';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface BackupFile {
    filename: string;
    size: number;
    created_at: string;
}

export const backupService = {
    getBackups: async (): Promise<BackupFile[]> => {
        const response = await api.get('/backup/list');
        return response.data;
    },

    createBackup: async (): Promise<BackupFile> => {
        const response = await api.post('/backup/create', null, { 
            timeout: 300000 // 5 minutes for zipping/dumping
        });
        return response.data;
    },

    deleteBackup: async (filename: string): Promise<{ message: string }> => {
        const response = await api.delete(`/backup/${filename}`);
        return response.data;
    },

    uploadBackup: async (file: any, onProgress?: (pct: number) => void): Promise<BackupFile> => {
        const formData = new FormData();
        // On web, file is a File object. On mobile, we might need a different approach
        // but for now we focus on the web/generic FormData approach.
        formData.append('file', file);
        const response = await api.post('/backup/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 300000,
            onUploadProgress: (e) => {
                if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
            }
        });
        return response.data;
    },

    restoreBackup: async (filename: string, password: string): Promise<{ message: string }> => {
        const response = await api.post(`/backup/restore/${filename}`, { password }, {
            timeout: 300000 // 5 minutes for extracting/restoring
        });
        return response.data;
    },

    downloadBackup: async (filename: string, onProgress?: (pct: number) => void) => {
        const downloadUrl = `${BASE_URL}/backup/download/${encodeURIComponent(filename)}`;

        if (Platform.OS === 'web') {
            // Standard web download
            const response = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
                responseType: 'blob',
                timeout: 600000, // 10 minutes for large downloads
                onDownloadProgress: (e) => {
                    if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
                }
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } else {
            // Mobile download using expo-file-system and sharing.
            // The token lives in the auth store — `api.defaults.headers.common`
            // is never populated (the request interceptor sets it per-request).
            const fileUri = FileSystem.documentDirectory + filename;
            const authToken = useAuthStore.getState().token;

            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                fileUri,
                {
                    headers: {
                        // Must be the full scheme — the backend's HTTPBearer rejects a bare token.
                        'Authorization': `Bearer ${authToken}`
                    }
                },
                (p) => {
                    if (p.totalBytesExpectedToWrite > 0) {
                        onProgress?.(Math.round((p.totalBytesWritten / p.totalBytesExpectedToWrite) * 100));
                    }
                }
            );

            try {
                const result = await downloadResumable.downloadAsync();
                if (result) {
                    await Sharing.shareAsync(result.uri);
                }
            } catch (e) {
                console.error(e);
                throw e;
            }
        }
    }
};
