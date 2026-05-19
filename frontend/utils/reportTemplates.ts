import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { formatCurrency } from './format';
import { NeracaReport, LabaRugiReport, CapitalReport } from '../types/reports';

/**
 * Shared CSS for all reports to ensure consistency
 */
const reportStyles = `
    body { font-family: 'Helvetica', sans-serif; font-size: 10.5px; color: #1e293b; padding: 40px 35px; line-height: 1.4; background-color: #fff; }
    .header { text-align: center; border-bottom: 2.5px solid #4f46e5; padding-bottom: 20px; margin-bottom: 25px; }
    .title { font-size: 20px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
    .subtitle { font-size: 13px; color: #4f46e5; font-weight: 600; margin-bottom: 3px; }
    .date { font-size: 11px; color: #64748b; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #f1f5f9; }
    
    .amount { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; font-size: 11.5px; }
    .section-title { background-color: #f8fafc; font-weight: 800; color: #4f46e5; text-transform: uppercase; font-size: 10.5px; letter-spacing: 1.5px; border-top: 1.5px solid #e2e8f0; }
    .unit-header { background-color: #4f46e5; color: #ffffff; font-weight: 800; padding: 12px 10px; font-size: 11px; }
    .total-row { font-weight: 800; background-color: #f1f5f9; color: #1e293b; border-top: 2px solid #cbd5e1; }
    .grand-total { font-weight: 800; background-color: #1e293b; color: #ffffff; font-size: 13px; }
    
    .sub-item { color: #64748b; padding-left: 25px; font-size: 9.5px; font-style: italic; }
    .negative { color: #e11d48; }
    .positive { color: #059669; }
    
    .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #f1f5f9; font-size: 9px; color: #94a3b8; text-align: center; font-style: italic; }
    
    .recap-box { border-radius: 12px; padding: 20px; background-color: #0f172a; color: #ffffff; margin-top: 30px; }
    .recap-title { font-weight: 900; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
    .info-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; background-color: #fafafa; }
    .info-card-title { font-weight: 800; font-size: 10px; color: #475569; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
`;

export const buildNeracaExportHtml = (data: NeracaReport, date: Date, filterType: string) => {
    const formattedDate = format(date, filterType === 'daily' ? 'd MMMM yyyy' : (filterType === 'monthly' ? 'MMMM yyyy' : 'yyyy'), { locale: localeID });
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>${reportStyles}</style>
        </head>
        <body>
            <div class="header">
                <div class="title">Laporan Neraca</div>
                <div class="subtitle">TIGA PUTRA MOTOR - FINANCIAL POSITION</div>
                <div class="date">Per Tanggal: ${formattedDate}</div>
            </div>

            <table>
                <tr class="unit-header"><td colspan="2">AKTIVA (ASSETS)</td></tr>
                <tr class="section-title"><td colspan="2">I. AKTIVA LANCAR</td></tr>
                <tr><td>Kas Tunai (Utama)</td><td class="amount">${formatCurrency(data.aktiva_lancar.kas_tunai)}</td></tr>
                <tr><td>Kas Bank</td><td class="amount">${formatCurrency(data.aktiva_lancar.kas_bank)}</td></tr>
                <tr><td>Piutang Usaha (All Units)</td><td class="amount">${formatCurrency(data.aktiva_lancar.total_piutang)}</td></tr>
                ${data.cross_validation?.mismatches?.filter(m => m.piutang > 0).map(m => `
                <tr class="sub-item">
                    <td>Tagihan Perbaikan ke ${m.ref}</td>
                    <td class="amount">${formatCurrency(m.piutang)}</td>
                </tr>
                `).join('')}
                <tr><td>Persediaan Sparepart</td><td class="amount">${formatCurrency(data.aktiva_lancar.persediaan_sparepart)}</td></tr>
                <tr><td>Stok Unit Mobil (Inventory)</td><td class="amount">${formatCurrency(data.aktiva_lancar.stok_mobil)}</td></tr>
                <tr class="total-row"><td>TOTAL AKTIVA LANCAR</td><td class="amount">${formatCurrency(data.aktiva_lancar.total_aktiva_lancar)}</td></tr>

                <tr class="section-title"><td colspan="2">II. AKTIVA TETAP</td></tr>
                ${data.aktiva_tetap.detail_aset.map(aset => `
                    <tr><td>${aset.nama}</td><td class="amount">${formatCurrency(aset.harga_beli)}</td></tr>
                `).join('')}
                <tr class="total-row"><td>TOTAL AKTIVA TETAP</td><td class="amount">${formatCurrency(data.aktiva_tetap.total_aktiva_tetap)}</td></tr>
                <tr class="grand-total"><td>TOTAL AKTIVA</td><td class="amount">${formatCurrency(data.total_aktiva)}</td></tr>
            </table>

            <table>
                <tr class="unit-header" style="background-color: #4338ca;"><td colspan="2">PASIVA (LIABILITIES & EQUITY)</td></tr>
                <tr class="section-title"><td colspan="2">I. KEWAJIBAN (HUTANG)</td></tr>
                <tr><td>Hutang Pembelian Mobil</td><td class="amount">${formatCurrency(data.hutang.hutang_mobil)}</td></tr>
                <tr><td>Hutang Pembelian Part</td><td class="amount">${formatCurrency(data.hutang.hutang_part)}</td></tr>
                <tr><td>Hutang Investor</td><td class="amount">${formatCurrency(data.hutang.hutang_investor)}</td></tr>
                <tr><td>Hutang Lainnya</td><td class="amount">${formatCurrency(data.hutang.hutang_lainnya)}</td></tr>
                ${(data.hutang.hutang_jasa_angkut || 0) > 0 ? `<tr><td>Hutang Jasa Angkut</td><td class="amount">${formatCurrency(data.hutang.hutang_jasa_angkut || 0)}</td></tr>` : ''}
                ${(data.hutang.uang_muka_penjualan || 0) > 0 ? `<tr><td>Uang Muka Penjualan</td><td class="amount">${formatCurrency(data.hutang.uang_muka_penjualan || 0)}</td></tr>` : ''}
                ${(data.hutang.piutang_booking || 0) > 0 ? `<tr><td>Sisa Kewajiban Booking Mobil</td><td class="amount">${formatCurrency(data.hutang.piutang_booking || 0)}</td></tr>` : ''}
                ${data.cross_validation?.mismatches?.filter(m => m.hutang > 0).map((m, idx) => `
                <tr><td>Hutang Perbaikan ke ${m.ref}</td><td class="amount">${formatCurrency(m.hutang)}</td></tr>
                `).join('')}
                <tr class="total-row"><td>TOTAL KEWAJIBAN</td><td class="amount">${formatCurrency(data.hutang.total_hutang)}</td></tr>

                <tr class="section-title"><td colspan="2">II. EKUITAS (MODAL)</td></tr>
                <tr><td>Setoran Modal Pemilik</td><td class="amount">${formatCurrency(data.modal.setoran_modal)}</td></tr>
                <tr><td>Laba Ditahan (Retained Earnings)</td><td class="amount">${formatCurrency(data.modal.laba_ditahan)}</td></tr>
                <tr><td>Prive (Pengambilan Pemilik)</td><td class="amount negative">(${formatCurrency(data.modal.prive)})</td></tr>
                <tr class="total-row"><td>TOTAL EKUITAS</td><td class="amount">${formatCurrency(data.modal.total_modal)}</td></tr>
                <tr class="grand-total" style="background-color: #4338ca;"><td>TOTAL PASIVA</td><td class="amount">${formatCurrency(data.total_pasiva)}</td></tr>
            </table>

            <div class="footer">
                Laporan Neraca TPM Finance System<br/>
                Dicetak pada ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeID })}
            </div>
        </body>
        </html>
    `;
};

export const buildLabaRugiExportHtml = (data: LabaRugiReport, date: Date, filterType: string) => {
    const formattedDate = format(date, filterType === 'daily' ? 'd MMMM yyyy' : (filterType === 'monthly' ? 'MMMM yyyy' : 'yyyy'), { locale: localeID });
    const mobilRepairSold = data.units.mobil.maintenance || data.mobil_details?.total_biaya_bengkel || data.mobil_details?.biaya_bengkel || 0;
    const mobilRepairAll = data.mobil_details?.total_biaya_bengkel_all ?? mobilRepairSold;
    const mobilRepairUnsold = data.mobil_details?.total_biaya_bengkel_unsold ?? Math.max(0, mobilRepairAll - mobilRepairSold);
    const mobilPrepSold = data.units.mobil.beban_operasional || 0;
    const mobilPrepAll = data.mobil_details?.total_biaya_persiapan ?? mobilPrepSold;
    const mobilPrepUnsold = Math.max(0, mobilPrepAll - mobilPrepSold);
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>${reportStyles}</style>
        </head>
        <body>
            <div class="header">
                <div class="title">Laporan Laba Rugi</div>
                <div class="subtitle">BENGKEL TPM - ANALISA FINANSIAL</div>
                <div class="date">Periode: ${formattedDate}</div>
            </div>

            <table>
                <tr class="unit-header"><td colspan="2">UNIT BENGKEL & SPAREPART</td></tr>
                <tr class="section-title"><td colspan="2">I. PENDAPATAN</td></tr>
                <tr><td>Penjualan Sparepart (Retail)</td><td class="amount">${formatCurrency(data.bengkel_details?.total_parts || 0)}</td></tr>
                <tr><td>Jasa Servis & Bengkel</td><td class="amount">${formatCurrency(data.bengkel_details?.total_jasa || 0)}</td></tr>
                <tr><td>Diskon Penjualan</td><td class="amount negative">(${formatCurrency(data.bengkel_details?.total_diskon || 0)})</td></tr>
                <tr class="total-row"><td>TOTAL PENDAPATAN BENGKEL</td><td class="amount">${formatCurrency(data.units.bengkel.revenue)}</td></tr>

                <tr class="section-title"><td colspan="2">II. BEBAN POKOK (HPP)</td></tr>
                <tr><td>HPP Sparepart Terjual</td><td class="amount negative">(${formatCurrency(data.units.bengkel.hpp)})</td></tr>
                <tr class="total-row"><td>LABA KOTOR BENGKEL</td><td class="amount">${formatCurrency(data.units.bengkel.laba_kotor)}</td></tr>

                <tr class="section-title"><td colspan="2">III. BEBAN OPERASIONAL UNIT</td></tr>
                <tr><td>Beban Gaji Karyawan</td><td class="amount negative">(${formatCurrency(data.units.bengkel.beban_gaji || 0)})</td></tr>
                <tr><td>Beban Lembur Karyawan</td><td class="amount negative">(${formatCurrency(data.units.bengkel.beban_lembur || 0)})</td></tr>
                <tr><td>Beban Operasional Bengkel</td><td class="amount negative">(${formatCurrency(data.units.bengkel.beban_operasional)})</td></tr>
                <tr class="total-row" style="background-color: #f0fdf4;"><td>LABA BERSIH BENGKEL</td><td class="amount positive">${formatCurrency(data.units.bengkel.laba_bersih)}</td></tr>

                <tr style="height: 25px;"></tr>

                <tr class="unit-header" style="background-color: #059669;"><td colspan="2">UNIT JASA ANGKUT (LOGISTIC)</td></tr>
                <tr class="section-title"><td colspan="2">I. PENDAPATAN JASA</td></tr>
                <tr><td>Total Pendapatan Jasa (Gross)</td><td class="amount">${formatCurrency(data.units.jasa_angkut.revenue)}</td></tr>

                <tr class="section-title"><td colspan="2">II. BIAYA ARMADA & MAINTENANCE</td></tr>
                <tr><td>Biaya Operasional Trip (BBM, Tol, dll)</td><td class="amount negative">(${formatCurrency(data.units.jasa_angkut.beban_operasional)})</td></tr>
                <tr><td>Biaya Perbaikan & Maintenance</td><td class="amount negative">(${formatCurrency(data.units.jasa_angkut.maintenance || 0)})</td></tr>
                
                <tr class="section-title"><td colspan="2">III. BEBAN UMUM UNIT</td></tr>
                <tr><td>Beban Umum Jasa Angkut</td><td class="amount negative">(${formatCurrency(data.units.jasa_angkut.beban_umum || 0)})</td></tr>
                <tr class="total-row" style="background-color: #f0fdf4;"><td>LABA BERSIH JASA ANGKUT</td><td class="amount positive">${formatCurrency(data.units.jasa_angkut.laba_bersih)}</td></tr>

                <tr style="height: 25px;"></tr>

                <tr class="unit-header" style="background-color: #d97706;"><td colspan="2">UNIT JUAL BELI MOBIL</td></tr>
                <tr class="section-title"><td colspan="2">I. PENDAPATAN JUAL BELI</td></tr>
                <tr><td>Total Penjualan Unit Mobil</td><td class="amount">${formatCurrency(data.units.mobil.revenue)}</td></tr>

                <tr class="section-title"><td colspan="2">II. BEBAN POKOK (HPP)</td></tr>
                <tr><td>Harga Beli Unit Mobil</td><td class="amount negative">(${formatCurrency(data.units.mobil.hpp)})</td></tr>
                <tr><td>Biaya Persiapan - Mobil Terjual</td><td class="amount negative">(${formatCurrency(mobilPrepSold)})</td></tr>
                ${mobilPrepUnsold > 0 ? `<tr class="sub-item"><td>Biaya Persiapan - Masuk Stok Mobil</td><td class="amount">${formatCurrency(mobilPrepUnsold)}</td></tr>` : ''}
                <tr><td>Biaya Perbaikan Bengkel - Mobil Terjual</td><td class="amount negative">(${formatCurrency(mobilRepairSold)})</td></tr>
                ${mobilRepairUnsold > 0 ? `<tr class="sub-item"><td>Perbaikan Bengkel - Masuk Stok Mobil</td><td class="amount">${formatCurrency(mobilRepairUnsold)}</td></tr>` : ''}

                <tr class="section-title"><td colspan="2">III. BAGI HASIL & UMUM</td></tr>
                <tr><td>Bagi Hasil Investor (Sharing)</td><td class="amount negative">(${formatCurrency(data.units.mobil.sharing_investor || 0)})</td></tr>
                <tr><td>Beban Umum Unit Mobil</td><td class="amount negative">(${formatCurrency(data.units.mobil.beban_umum || 0)})</td></tr>
                <tr class="total-row" style="background-color: #f0fdf4;"><td>LABA BERSIH MOBIL (TPM)</td><td class="amount positive">${formatCurrency(data.units.mobil.laba_bersih)}</td></tr>
            </table>

            <div class="recap-box">
                <div class="recap-title">REKAPITULASI FINANSIAL</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Total Laba Operasional Seluruh Unit</span>
                    <span class="amount">${formatCurrency(data.summary.laba_operasional)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Beban Umum & Operasional Pusat</span>
                    <span class="amount negative">(${formatCurrency(data.summary.total_beban_umum)})</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span>Pengambilan Prive Pemilik</span>
                    <span class="amount negative">(${formatCurrency(data.summary.prive)})</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 900;">
                    <span>LABA BERSIH AKHIR (TPM)</span>
                    <span class="amount" style="color: #4ade80;">${formatCurrency(data.summary.laba_bersih)}</span>
                </div>
            </div>

            <div class="footer">
                Laporan Laba Rugi TPM Finance System<br/>
                Dicetak pada ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeID })}
            </div>
        </body>
        </html>
    `;
};

export const buildCapitalExportHtml = (data: CapitalReport, date: Date, filterType: string) => {
    const formattedDate = format(date, filterType === 'daily' ? 'd MMMM yyyy' : (filterType === 'monthly' ? 'MMMM yyyy' : 'yyyy'), { locale: localeID });
    
    // Theoretical calculation logic from original file
    const laba_bersih = data.info?.laba_bersih || 0;
    const laba_usaha = data.info?.laba_usaha || data.penambahan?.laba_kotor?.total || 0;
    const laba_bengkel = data.info?.laba_bengkel ?? 0;
    const laba_mobil = data.info?.laba_mobil ?? 0;
    const laba_jasa_angkut = data.info?.laba_jasa_angkut ?? 0;
    const beban_ops = data.pengurangan?.beban_operasional?.total || data.info?.overhead_gaji || 0;
    const setoran = (data.penambahan?.setoran_modal || 0) + 
                    (data.penambahan?.modal_non_kas?.total || 0) + 
                    (data.penambahan?.investor_funding || 0);
    const prive = (data.pengurangan?.prive || 0) + (data.pengurangan?.pengembalian_modal || 0);
    const theoretical = data.modal_awal + laba_bersih + setoran - prive;
    const adjustment = data.modal_akhir - theoretical;
    const stokMobil = data.info?.aset?.stok_mobil;
    const totalPerbaikanMobil = stokMobil?.perbaikan_internal || 0;
    const biayaPersiapanMasukStok = data.penambahan?.stok_mobil_baru?.prep || 0;
    const alokasiBiayaPersiapanStok = data.pengurangan?.alokasi_stok?.prep || 0;
    const adjustmentIsPerbaikanMobil = adjustment < 0 && totalPerbaikanMobil > 0 && Math.abs(Math.abs(adjustment) - totalPerbaikanMobil) < 100;
    const adjustmentLabel = adjustmentIsPerbaikanMobil ? 'Perbaikan Unit Bengkel Masuk Stok Mobil' : 'Penyesuaian Snapshot Modal';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>${reportStyles}</style>
        </head>
        <body>
            <div class="header">
                <div class="title">Laporan Perubahan Ekuitas</div>
                <div class="subtitle">BENGKEL TPM - KONSOLIDASI</div>
                <div class="date">Periode: ${formattedDate}</div>
            </div>

            <table>
                <tr class="section-title"><td colspan="2">A. MODAL AWAL</td></tr>
                <tr>
                    <td>Saldo Modal Awal</td>
                    <td class="amount">${formatCurrency(data.modal_awal)}</td>
                </tr>

                <tr class="section-title"><td colspan="2">B. PENAMBAHAN MODAL</td></tr>
                ${laba_usaha > 0 ? `
                <tr class="bold">
                    <td>Laba Usaha (Unit Bisnis)</td>
                    <td class="amount positive">${formatCurrency(laba_usaha)}</td>
                </tr>
                ${laba_bengkel > 0 ? `
                <tr class="sub-item">
                    <td>&nbsp;&nbsp;&nbsp;• Unit Bengkel</td>
                    <td class="amount">${formatCurrency(laba_bengkel)}</td>
                </tr>` : ''}
                ${laba_mobil > 0 ? `
                <tr class="sub-item">
                    <td>&nbsp;&nbsp;&nbsp;• Unit Mobil</td>
                    <td class="amount">${formatCurrency(laba_mobil)}</td>
                </tr>` : ''}
                ${laba_jasa_angkut > 0 ? `
                <tr class="sub-item">
                    <td>&nbsp;&nbsp;&nbsp;• Unit Jasa Angkut</td>
                    <td class="amount">${formatCurrency(laba_jasa_angkut)}</td>
                </tr>` : ''}
                ` : (laba_bersih > 0 ? `
                <tr>
                    <td>Laba Bersih Konsolidasi</td>
                    <td class="amount positive">${formatCurrency(laba_bersih)}</td>
                </tr>` : '')}
                ${data.penambahan?.setoran_modal ? `
                <tr>
                    <td>Setoran Modal Pemilik (Tunai)</td>
                    <td class="amount">${formatCurrency(data.penambahan.setoran_modal)}</td>
                </tr>` : ''}
                ${data.penambahan?.modal_non_kas?.total ? `
                <tr>
                    <td>Setoran Modal Non-Kas (Aset)</td>
                    <td class="amount">${formatCurrency(data.penambahan.modal_non_kas.total)}</td>
                </tr>` : ''}
                ${data.penambahan?.investor_funding ? `
                <tr>
                    <td>Penambahan Modal Investor (Unit)</td>
                    <td class="amount">${formatCurrency(data.penambahan.investor_funding)}</td>
                </tr>` : ''}
                ${biayaPersiapanMasukStok > 0 ? `
                <tr>
                    <td>Penambahan Nilai Stok - Biaya Persiapan</td>
                    <td class="amount">${formatCurrency(biayaPersiapanMasukStok)}</td>
                </tr>` : ''}
                ${adjustment > 0 ? `
                <tr class="sub-item">
                    <td>Bagi Hasil Investor (Belum Dibagikan)</td>
                    <td class="amount">${formatCurrency(adjustment)}</td>
                </tr>` : ''}

                <tr class="section-title"><td colspan="2">C. PENGURANGAN MODAL</td></tr>
                ${laba_usaha < 0 ? `
                <tr class="bold">
                    <td>Rugi Usaha (Unit Bisnis)</td>
                    <td class="amount negative">(${formatCurrency(Math.abs(laba_usaha))})</td>
                </tr>
                ${laba_bengkel < 0 ? `
                <tr class="sub-item">
                    <td>&nbsp;&nbsp;&nbsp;• Unit Bengkel</td>
                    <td class="amount">(${formatCurrency(Math.abs(laba_bengkel))})</td>
                </tr>` : ''}
                ${laba_mobil < 0 ? `
                <tr class="sub-item">
                    <td>&nbsp;&nbsp;&nbsp;• Unit Mobil</td>
                    <td class="amount">(${formatCurrency(Math.abs(laba_mobil))})</td>
                </tr>` : ''}
                ${laba_jasa_angkut < 0 ? `
                <tr class="sub-item">
                    <td>&nbsp;&nbsp;&nbsp;• Unit Jasa Angkut</td>
                    <td class="amount">(${formatCurrency(Math.abs(laba_jasa_angkut))})</td>
                </tr>` : ''}
                ` : (laba_bersih < 0 ? `
                <tr>
                    <td>Rugi Bersih Konsolidasi</td>
                    <td class="amount negative">(${formatCurrency(Math.abs(laba_bersih))})</td>
                </tr>` : '')}
                ${beban_ops > 0 ? `
                <tr>
                    <td>Beban Operasional & Gaji Pusat</td>
                    <td class="amount negative">(${formatCurrency(beban_ops)})</td>
                </tr>` : ''}
                ${prive > 0 ? `
                <tr>
                    <td>Prive & Penarikan Modal</td>
                    <td class="amount negative">(${formatCurrency(prive)})</td>
                </tr>` : ''}
                ${alokasiBiayaPersiapanStok > 0 ? `
                <tr>
                    <td>Alokasi Kas ke Biaya Persiapan Stok</td>
                    <td class="amount negative">(${formatCurrency(alokasiBiayaPersiapanStok)})</td>
                </tr>` : ''}
                ${adjustment < 0 ? `
                <tr class="sub-item">
                    <td>${adjustmentLabel}</td>
                    <td class="amount negative">(${formatCurrency(Math.abs(adjustment))})</td>
                </tr>` : ''}

                <tr class="grand-total">
                    <td>MODAL AKHIR PERIODE</td>
                    <td class="amount">${formatCurrency(data.modal_akhir)}</td>
                </tr>
            </table>

            <div class="info-grid">
                <div class="info-card">
                    <div class="info-card-title">Profitabilitas Unit Usaha</div>
                    <div class="info-row"><span>Bengkel & Sparepart</span><b>${formatCurrency(data.info?.laba_bengkel || 0)}</b></div>
                    <div class="info-row"><span>Jual Beli Mobil</span><b>${formatCurrency(data.info?.laba_mobil || 0)}</b></div>
                    <div class="info-row"><span>Jasa Angkut (JA)</span><b>${formatCurrency(data.info?.laba_jasa_angkut || 0)}</b></div>
                </div>
                <div class="info-card">
                    <div class="info-card-title">Posisi Aset Bersih</div>
                    <div class="info-row"><span>Kas & Bank Aktif</span><b>${formatCurrency(data.info?.aset?.kas_bank || 0)}</b></div>
                    <div class="info-row"><span>Persediaan Unit Mobil</span><b>${formatCurrency(data.info?.aset?.stok_mobil?.total || 0)}</b></div>
                    ${(stokMobil?.unit_hanya || 0) > 0 ? `<div class="info-row sub-item"><span>Harga Beli Unit Mobil</span><b>${formatCurrency(stokMobil?.unit_hanya || 0)}</b></div>` : ''}
                    ${(stokMobil?.biaya_persiapan || 0) > 0 ? `<div class="info-row sub-item"><span>Biaya Persiapan Mobil</span><b>${formatCurrency(stokMobil?.biaya_persiapan || 0)}</b></div>` : ''}
                    ${totalPerbaikanMobil > 0 ? `
                    <div class="info-row"><span>Perbaikan Unit Bengkel Masuk Stok</span><b>${formatCurrency(totalPerbaikanMobil)}</b></div>
                    ` : ''}
                    <div class="info-row"><span>Total Kewajiban</span><b class="negative">${formatCurrency(data.info?.aset?.hutang?.total || 0)}</b></div>
                </div>
            </div>

            <div class="footer">
                Laporan ini dihasilkan otomatis oleh Sistem Keuangan TPM.<br/>
                Dicetak pada ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeID })}
            </div>
        </body>
        </html>
    `;
};
