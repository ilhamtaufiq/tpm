// Ported from frontend/types/reports.ts — same backend contracts.
export interface KasJenisDetail {
  jenis: string;
  saldo: number;
}

export interface KasArusJenis {
  jenis: string;
  masuk: number;
  keluar: number;
  net: number;
}

export interface NeracaAset {
  kas_tunai: number;
  kas_bank: number;
  unit_cash: number;
  unit_details?: Record<string, number>;
  unit_cash_details?: Array<{ unit: string; total_cash: number }>;
  kas_jenis_details?: KasJenisDetail[];
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
  stok_mobil_detail?: Array<{
    id: number;
    nama: string;
    harga_beli: number;
    biaya_persiapan: number;
    perbaikan_external: number;
    perbaikan_internal: number;
    total: number;
  }>;
  total_aktiva_lancar: number;
}

export interface NeracaAsetTetap {
  total_aktiva_tetap: number;
  detail_aset: Array<{ kode: string; nama: string; harga_beli: number }>;
}

export interface NeracaModal {
  setoran_modal: number;
  setoran_modal_kas: number;
  modal_non_kas: number;
  modal_persediaan: number;
  modal_stok_mobil: number;
  modal_aset_tetap: number;
  laba_ditahan: number;
  penyesuaian_harga_beli_sparepart?: number;
  prive: number;
  total_modal: number;
  selisih_modal?: number;
  modal_komponen?: number;
  equity_identity?: number;
}

export interface NeracaHutang {
  hutang_part: number;
  hutang_mobil: number;
  hutang_investor: number;
  hutang_lainnya: number;
  hutang_jasa_angkut?: number;
  hutang_internal?: number;
  uang_muka_penjualan?: number;
  piutang_booking?: number;
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
  };
  info?: {
    units: {
      bengkel: { total_laba_kotor?: number; total_laba_tpm: number };
      jasa_angkut: { total_laba_kotor?: number; total_laba_tpm: number };
      mobil: { total_laba_kotor?: number; total_laba_tpm: number };
    };
  };
}

export interface LabaRugiUnit {
  revenue: number;
  hpp: number;
  laba_kotor: number;
  laba_penyesuaian_harga_beli?: number;
  beban_operasional: number;
  beban_gaji?: number;
  beban_lembur?: number;
  beban_umum?: number;
  maintenance?: number;
  sharing_investor?: number;
  pendapatan_lainnya?: number;
  dana_penalti?: number;
  laba_bersih: number;
}

export interface LabaRugiReport {
  kas_per_jenis?: KasArusJenis[];
  summary: {
    total_revenue: number;
    total_hpp: number;
    total_laba_kotor: number;
    total_beban_operasional: number;
    total_beban_umum: number;
    internal_elimination?: number;
    internal_profit_elimination?: number;
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
  mobil_details?: {
    total_biaya_bengkel?: number;
    total_biaya_bengkel_all?: number;
    total_biaya_bengkel_unsold?: number;
    total_biaya_persiapan?: number;
    biaya_bengkel?: number;
  };
}

export interface CapitalReport {
  modal_awal: number;
  penambahan?: {
    setoran_modal: number;
    penyesuaian_harga_beli_sparepart?: number;
    investor_funding?: number;
    modal_non_kas?: { total: number; aset_tetap?: number; stok_part?: number; stok_mobil?: number };
  };
  pengurangan?: {
    prive: number;
    pengembalian_modal: number;
    pembayaran_investor: number;
    total: number;
  };
  modal_akhir: number;
  info?: {
    laba_bersih: number;
    laba_investor: number;
    diskon_penjualan_bengkel?: number;
    validasi?: { modal_teoritis?: number; modal_aktual?: number; selisih?: number; status: string };
    aset?: { kas_bank: number; kas_jenis_details?: KasJenisDetail[] };
  };
  selisih?: number;
  is_balanced?: boolean;
}
