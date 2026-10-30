import api from './api';
import { buildPublicReceiptShareUrl, sharePublicReceiptLink, SharePublicReceiptLinkResult } from './sharePublicReceipt';

export type JenisStrukUtang = 'piutang' | 'hutang';

/** Ambil (atau buat) token struk publik untuk piutang/hutang lalu bagikan link-nya. */
export async function bagikanStrukUtang(
    jenis: JenisStrukUtang,
    id: number,
    nomor: string,
): Promise<SharePublicReceiptLinkResult> {
    const { data } = await api.post(`/${jenis}/${id}/struk-token`);
    const token = String(data.token);
    const shareUrl = await buildPublicReceiptShareUrl(jenis, token);
    return sharePublicReceiptLink({
        shareUrl,
        transactionNumber: nomor,
        receiptType: jenis,
        receiptId: token,
    });
}
