import api, { BASE_URL } from '../utils/api';
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

    restoreBackup: async (filename: string, password: string): Promise<{ message: string }> => {
        const response = await api.post(`/backup/restore/${filename}`, { password }, {
            timeout: 300000 // 5 minutes for extracting/restoring
        });
        return response.data;
    },

    downloadBackup: async (filename: string) => {
        const downloadUrl = `${BASE_URL}/backup/download/${filename}`;
        
        if (Platform.OS === 'web') {
            // Standard web download
            const response = await api.get(`/backup/download/${filename}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } else {
            // Mobile download using expo-file-system and sharing
            const fileUri = FileSystem.documentDirectory + filename;
            const authToken = await api.defaults.headers.common['Authorization'];
            
            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                fileUri,
                {
                    headers: {
                        'Authorization': authToken as string
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
