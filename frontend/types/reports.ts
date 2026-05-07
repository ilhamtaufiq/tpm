export interface NeracaAset {
    kas_tunai: number;
    kas_bank: number;
    unit_cash: number;
    unit_details?: Record<string, number>;
    total_kas_bank: number;
    piutang_lainnya: number;
    piutang_mobil: number;
    piutang_part_mobil: number;
    piutang_jasa_angkut: number;
    piutang_karyawan: number;
    piutang_usaha: number;
    total_piutang: number;
    persediaan_sparepart: number;
    stok_mobil: number;
    total_aktiva_lancar: number;
}

export interface NeracaAsetTetap {
    total_aktiva_tetap: number;
    detail_aset: Array<{
        kode: string;
        nama: string;
        harga_beli: number;
    }>;
}

export interface NeracaModal {
    setoran_modal: number;
    setoran_modal_kas: number;
    modal_non_kas: number;
    modal_persediaan: number;
    modal_stok_mobil: number;
    modal_aset_tetap: number;
    laba_ditahan: number;
    prive: number;
    total_modal: number;
    selisih_modal?: number;
}

export interface NeracaHutang {
    hutang_part: number;
    hutang_mobil: number;
    hutang_investor: number;
    hutang_lainnya: number;
    total_hutang: number;
}

export interface NeracaReport {
    aktiva_lancar: NeracaAset;
    aktiva_tetap: NeracaAsetTetap;
    total_aktiva: number;
    modal: NeracaModal;
    hutang: NeracaHutang;
    total_pasiva: number;
    is_balanced: boolean;
    selisih: number;
    cross_validation: {
        equity_from_components: number;
        equity_from_identity: number;
        selisih_equity: number;
        retained_earnings: number;
        laba_bersih_from_base: number;
        piutang_internal?: number;
        hutang_internal?: number;
        selisih_internal?: number;
        mismatches?: Array<{
            ref: string;
            gap: number;
            piutang: number;
            hutang: number;
        }>;
    };
}

export interface LabaRugiUnit {
    revenue: number;
    hpp: number;
    laba_kotor: number;
    beban_operasional: number;
    beban_gaji?: number;
    beban_umum?: number;
    maintenance?: number;
    sharing_investor?: number;
    laba_bersih: number;
}

export interface LabaRugiReport {
    summary: {
        total_revenue: number;
        total_hpp: number;
        total_laba_kotor: number;
        total_beban_operasional: number;
        total_beban_umum: number;
        laba_operasional: number;
        prive: number;
        laba_bersih: number;
    };
    units: {
        bengkel: LabaRugiUnit;
        jasa_angkut: LabaRugiUnit;
        mobil: LabaRugiUnit;
    };
    bengkel_details?: {
        total_parts: number;
        total_jasa: number;
        total_diskon: number;
        total_subtotal: number;
    };
}

export interface CapitalReport {
    modal_awal: number;
    modal_akhir: number;
    penambahan?: {
        setoran_modal: number;
        modal_non_kas?: {
            total: number;
            details?: any[];
        };
        investor_funding?: number;
    };
    pengurangan?: {
        prive: number;
        pengembalian_modal?: number;
    };
    info?: {
        laba_bersih: number;
        laba_bengkel?: number;
        laba_mobil?: number;
        laba_jasa_angkut?: number;
        aset?: {
            kas_bank: number;
            stok_mobil: { total: number };
            stok_part: number;
            piutang: { total: number };
            hutang: { total: number };
        };
        validasi?: {
            status: string;
        };
    };
}
