export async function printHtmlInBrowser(html: string): Promise<void> {
    if (typeof document === 'undefined') {
        throw new Error('Browser print tidak tersedia di platform ini');
    }

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    let printed = false;
    const cleanup = () => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
    };

    const triggerPrint = () => {
        if (printed) return;
        printed = true;
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(cleanup, 2000);
    };

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
        cleanup();
        throw new Error('Gagal menyiapkan frame print browser');
    }

    iframe.onload = triggerPrint;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    setTimeout(() => {
        if (document.body.contains(iframe)) {
            triggerPrint();
        }
    }, 800);
}
