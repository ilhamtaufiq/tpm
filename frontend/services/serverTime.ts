import api from '../utils/api';
import { setJamServer } from '../utils/format';

// Menyelaraskan jam perangkat dengan jam server, supaya tanggal "hari ini" tidak meleset
// kalau jam HP/browser salah atau zonanya berbeda.
export const syncJamServer = async (): Promise<void> => {
    try {
        const kirim = Date.now();
        const response = await api.get('/system/server-time');
        const terima = Date.now();
        setJamServer(response.data.epoch_ms, terima - kirim);
    } catch {
        // Tanpa jam server, tanggal memakai jam perangkat seperti sebelumnya.
    }
};
