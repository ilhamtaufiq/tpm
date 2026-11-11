// Native: tidak dipakai. Ekspor PDF native memakai Print.printToFileAsync + Sharing.
export async function unduhPdfLaporanWeb(_html: string, _fileName: string): Promise<void> {
    throw new Error('Unduh PDF langsung hanya tersedia di web');
}
