import api from '../utils/api';

export interface PiutangFolderRingkas {
    id: number;
    nama: string;
    catatan: string | null;
    jumlah_struk: number;
    total_piutang: number;
    total_sisa: number;
    belum_lunas: number;
}

export interface StrukFolder {
    id: number;
    nomor_piutang: string;
    tanggal: string;
    nama_debitur: string;
    nominal_piutang: number;
    total_dibayar: number;
    sisa_piutang: number;
    status: 'BELUM_LUNAS' | 'SEBAGIAN' | 'LUNAS' | 'BATAL';
    pembayaran: { tanggal: string; nominal: number; metode: string | null }[];
}

export interface FolderDetail {
    id: number;
    nama: string;
    catatan: string | null;
    total_piutang: number;
    total_sisa: number;
    piutang: StrukFolder[];
}

export const piutangFolderService = {
    daftar: async (): Promise<PiutangFolderRingkas[]> => (await api.get('/piutang-folder')).data,
    buat: async (nama: string) => (await api.post('/piutang-folder', { nama })).data,
    detail: async (id: number): Promise<FolderDetail> => (await api.get(`/piutang-folder/${id}`)).data,
    hapus: async (id: number) => (await api.delete(`/piutang-folder/${id}`)).data,
    pindahkan: async (piutangId: number, folderId: number | null) =>
        (await api.put(`/piutang-folder/piutang/${piutangId}`, { folder_id: folderId })).data,
    bayar: async (
        id: number,
        payload: { tanggal: string; metode: 'TUNAI' | 'TRANSFER'; nominal: number; catatan?: string },
    ) => (await api.post(`/piutang-folder/${id}/bayar`, payload)).data,
};
