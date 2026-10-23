import api from '../utils/api';

// Piutang/hutang dikelompokkan otomatis per nama (debitur/kreditur). Tidak ada folder manual.
export interface GrupNama {
    nama: string;
    jumlah_struk: number;
    total_nominal: number;
    total_sisa: number;
    belum_lunas: number;
}

export interface StrukNama {
    id: number;
    nomor: string;
    tanggal: string;
    nominal: number;
    total_dibayar: number;
    sisa: number;
    status: 'BELUM_LUNAS' | 'SEBAGIAN' | 'LUNAS' | 'BATAL';
    pembayaran?: { tanggal: string; nominal: number; metode: string | null }[];
}

export interface DetailNama {
    nama: string;
    total_sisa: number;
    struk: StrukNama[];
}

export interface BayarNamaPayload {
    tanggal: string;
    metode: 'TUNAI' | 'TRANSFER';
    nominal: number;
    catatan?: string;
    struk_id?: number; // kosong = otomatis dari struk tertua
}

export interface HasilBayarNama {
    nama: string;
    dibayar: { nomor: string; nominal: number }[];
    total: number;
}

export const namaGrupService = {
    piutangGrup: async (): Promise<GrupNama[]> => (await api.get('/per-nama/piutang')).data,
    piutangDetail: async (nama: string): Promise<DetailNama> =>
        (await api.get('/per-nama/piutang/detail', { params: { nama } })).data,
    piutangBayar: async (nama: string, payload: BayarNamaPayload): Promise<HasilBayarNama> =>
        (await api.post('/per-nama/piutang/bayar', { nama, ...payload })).data,
    hutangGrup: async (): Promise<GrupNama[]> => (await api.get('/per-nama/hutang')).data,
    hutangDetail: async (nama: string): Promise<DetailNama> =>
        (await api.get('/per-nama/hutang/detail', { params: { nama } })).data,
    hutangBayar: async (nama: string, payload: BayarNamaPayload): Promise<HasilBayarNama> =>
        (await api.post('/per-nama/hutang/bayar', { nama, ...payload })).data,
};
