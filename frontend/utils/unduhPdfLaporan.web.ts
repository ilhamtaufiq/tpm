import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Unduh PDF laporan di web tanpa dialog cetak. expo-print di web hanya memanggil window.print().
// Halaman laporan dirender ke gambar (html2canvas), lalu dipasang ke PDF A4 dan dipotong per halaman.
const LEBAR_RENDER_PX = 1000;
const MARGIN_PT = 20;

export async function unduhPdfLaporanWeb(html: string, fileName: string): Promise<void> {
    const host = document.createElement('div');
    // Harus berada di area tampilan (di belakang aplikasi): html2canvas tidak merender elemen di luar layar.
    host.style.position = 'fixed';
    host.style.left = '0';
    host.style.top = '0';
    host.style.width = `${LEBAR_RENDER_PX}px`;
    host.style.background = '#ffffff';
    host.style.zIndex = '-1';
    host.style.pointerEvents = 'none';
    host.innerHTML = html;
    document.body.appendChild(host);
    try {
        const canvas = await html2canvas(host, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            windowWidth: LEBAR_RENDER_PX,
        });

        const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const lebarGambar = pageW - MARGIN_PT * 2;
        const pxPerPt = canvas.width / lebarGambar;
        const tinggiHalamanPx = Math.floor((pageH - MARGIN_PT * 2) * pxPerPt);

        let y = 0;
        let halaman = 0;
        while (y < canvas.height) {
            const tinggi = Math.min(tinggiHalamanPx, canvas.height - y);
            const potongan = document.createElement('canvas');
            potongan.width = canvas.width;
            potongan.height = tinggi;
            const ctx = potongan.getContext('2d');
            if (!ctx) throw new Error('Gagal menyiapkan halaman PDF');
            ctx.drawImage(canvas, 0, y, canvas.width, tinggi, 0, 0, canvas.width, tinggi);
            if (halaman > 0) pdf.addPage();
            pdf.addImage(potongan.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_PT, MARGIN_PT, lebarGambar, tinggi / pxPerPt);
            y += tinggi;
            halaman += 1;
        }

        pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
    } finally {
        host.remove();
    }
}
