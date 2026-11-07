import { Share } from 'react-native';
import { formatCurrency } from './format';
import { buildPublicShortUrl, PublicReceiptType } from './publicReceiptUrl';
import { buildPublicReceiptViewUrl } from './sharePublicReceipt';
import { namaGrupService, type DetailNama } from '../services/namaGrup';

// Rincian piutang/hutang per nama dibagikan sebagai link pendek ke halaman rincian di server.
// Halaman itu memuat semua struk, nominal, sisa, dan status, dan dibaca langsung, jadi selalu terbaru.

export const bagikanRincianNama = async (jenis: 'PIUTANG' | 'HUTANG', detail: DetailNama): Promise<void> => {
    const pihak = jenis === 'PIUTANG' ? 'Piutang' : 'Hutang';
    const tipe: PublicReceiptType = jenis === 'PIUTANG' ? 'rincian_piutang' : 'rincian_hutang';
    const token = await namaGrupService.buatRincianToken(jenis === 'PIUTANG' ? 'piutang' : 'hutang', detail.nama);
    const link = (await buildPublicShortUrl(tipe, token)) ?? buildPublicReceiptViewUrl(tipe, token);
    await Share.share({
        message: `Rincian ${pihak} - ${detail.nama}\nTotal sisa: ${formatCurrency(detail.total_sisa)}\n${link}`,
    });
};
