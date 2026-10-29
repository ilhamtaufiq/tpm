import { format } from 'date-fns/format';
import { id as localeID } from 'date-fns/locale/id';
import { formatCurrency, tanggalLokal } from './format';
import type { DetailNama } from '../services/namaGrup';

// Pesan rincian piutang/hutang per nama, siap dibagikan (WhatsApp, SMS, email, dsb.).
// Memuat per struk: tanggal, nominal, status, riwayat bayar, dan tanggal pelunasan.

const LABEL_STATUS: Record<string, string> = {
    LUNAS: 'LUNAS',
    SEBAGIAN: 'SEBAGIAN',
    BELUM_LUNAS: 'BELUM LUNAS',
};

const fmtTanggal = (value: string) => format(tanggalLokal(value), 'dd MMM yyyy', { locale: localeID });

export const buildRincianNamaPesan = (jenis: 'PIUTANG' | 'HUTANG', detail: DetailNama): string => {
    const pihak = jenis === 'PIUTANG' ? 'Piutang' : 'Hutang';
    const lines: string[] = [`Rincian ${pihak} - ${detail.nama}`, ''];

    detail.struk
        .filter((s) => s.status !== 'BATAL')
        .forEach((s) => {
            const bayar = [...(s.pembayaran ?? [])].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
            lines.push(`No. ${s.nomor}`);
            lines.push(`Tanggal ${pihak.toLowerCase()}: ${fmtTanggal(s.tanggal)}`);
            lines.push(`Nominal: ${formatCurrency(s.nominal)}`);
            lines.push(`Status: ${LABEL_STATUS[s.status] ?? s.status}`);
            bayar.forEach((x) => {
                lines.push(`  - Dibayar ${fmtTanggal(x.tanggal)}: ${formatCurrency(x.nominal)}${x.metode ? ` (${x.metode})` : ''}`);
            });
            if (s.status === 'LUNAS' && bayar.length > 0) {
                lines.push(`Tanggal pelunasan: ${fmtTanggal(bayar[bayar.length - 1].tanggal)}`);
            }
            lines.push(`Sisa: ${formatCurrency(s.sisa)}`);
            lines.push('');
        });

    lines.push(`Total sisa: ${formatCurrency(detail.total_sisa)}`);
    return lines.join('\n');
};
