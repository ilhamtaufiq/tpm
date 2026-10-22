import api from '../utils/api';

export interface HutangFolderRingkas {
    id: number;
    nama: string;
    catatan: string | null;
    jumlah_struk: number;
    total_hutang: number;
    total_sisa: number;
    belum_lunas: number;
}

export interface StrukHutang {
    id: number;
    nomor_hutang: string;
    tanggal: string;
    nama_kreditur: string;
    nominal_hutang: number;
    total_dibayar: number;
    sisa_hutang: number;
    status: 'BELUM_LUNAS' | 'SEBAGIAN' | 'LUNAS' | 'BATAL';
    pembayaran: { tanggal: string; nominal: number; metode: string | null }[];
}

export interface FolderDetail {
    id: number;
    nama: string;
    catatan: string | null;
    total_hutang: number;
    total_sisa: number;
    hutang: StrukHutang[];
}

export const hutangFolderService = {
    daftar: async (): Promise<HutangFolderRingkas[]> => (await api.get('/hutang-folder')).data,
    buat: async (nama: string) => (await api.post('/hutang-folder', { nama })).data,
    detail: async (id: number): Promise<FolderDetail> => (await api.get(`/hutang-folder/${id}`)).data,
    hapus: async (id: number) => (await api.delete(`/hutang-folder/${id}`)).data,
    pindahkan: async (hutangId: number, folderId: number | null) =>
        (await api.put(`/hutang-folder/hutang/${hutangId}`, { folder_id: folderId })).data,
    bayar: async (
        id: number,
        payload: { tanggal: string; metode: 'TUNAI' | 'TRANSFER'; nominal: number; catatan?: string },
    ) => (await api.post(`/hutang-folder/${id}/bayar`, payload)).data,
};
