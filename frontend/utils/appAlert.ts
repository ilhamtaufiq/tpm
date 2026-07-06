export type AlertVariant = 'success' | 'error' | 'warning' | 'info';
export type AlertType = 'alert' | 'confirm';

export interface AppAlertOptions {
    title: string;
    message: string;
    variant?: AlertVariant;
    type?: AlertType;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onClose?: () => void;
}

type AlertHandler = (options: AppAlertOptions) => void;

let alertHandler: AlertHandler | null = null;

export function setAppAlertHandler(handler: AlertHandler | null) {
    alertHandler = handler;
}

export function inferAlertVariant(title: string): AlertVariant {
    const t = title.toLowerCase();
    if (t.includes('sukses') || t.includes('berhasil') || t.includes('terupdate')) return 'success';
    if (t.includes('error') || t.includes('gagal') || t.includes('kesalahan') || t.includes('tidak ditemukan')) return 'error';
    if (t.includes('peringatan') || t.includes('izin') || t.includes('offline') || t.includes('eits')) return 'warning';
    return 'info';
}

export function appAlert(title: string, message: string, options?: Partial<Omit<AppAlertOptions, 'title' | 'message'>>) {
    const payload: AppAlertOptions = {
        title,
        message,
        variant: options?.variant ?? inferAlertVariant(title),
        type: options?.type ?? 'alert',
        ...options,
    };

    if (alertHandler) {
        alertHandler(payload);
        return;
    }

    if (typeof globalThis.alert === 'function') {
        globalThis.alert(`${title}\n\n${message}`);
    }
}

export function appConfirm(
    title: string,
    message: string,
    onConfirm: () => void,
    options?: Partial<Omit<AppAlertOptions, 'title' | 'message' | 'type' | 'onConfirm'>>
) {
    appAlert(title, message, {
        type: 'confirm',
        confirmText: options?.confirmText ?? 'Hapus',
        variant: options?.variant ?? 'warning',
        onConfirm,
        ...options,
    });
}