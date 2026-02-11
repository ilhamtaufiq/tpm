/**
 * Receipt template types
 */
export type ReceiptTemplate = 'simple' | 'standard' | 'detailed' | 'premium';

export interface ReceiptTemplateConfig {
    id: ReceiptTemplate;
    name: string;
    description: string;
    features: {
        showLogo: boolean;
        showQRCode: boolean;
        showItemDetails: boolean; // qty x price breakdown
        showNotes: boolean;
        showPaidChange: boolean; // uang dibayar & kembalian
        showCompanyInfo: boolean; // alamat & telepon
        fontSize: 'small' | 'medium' | 'large';
        spacing: 'compact' | 'normal' | 'spacious';
    };
}

/**
 * Available receipt templates
 */
export const RECEIPT_TEMPLATES: Record<ReceiptTemplate, ReceiptTemplateConfig> = {
    simple: {
        id: 'simple',
        name: 'Simpel',
        description: 'Struk minimalis dengan info penting saja',
        features: {
            showLogo: false,
            showQRCode: false,
            showItemDetails: false,
            showNotes: false,
            showPaidChange: false,
            showCompanyInfo: false,
            fontSize: 'small',
            spacing: 'compact'
        }
    },

    standard: {
        id: 'standard',
        name: 'Standard',
        description: 'Struk standar untuk kebutuhan umum',
        features: {
            showLogo: true,
            showQRCode: false,
            showItemDetails: true,
            showNotes: true,
            showPaidChange: true,
            showCompanyInfo: true,
            fontSize: 'medium',
            spacing: 'normal'
        }
    },

    detailed: {
        id: 'detailed',
        name: 'Lengkap',
        description: 'Struk lengkap dengan semua detail transaksi',
        features: {
            showLogo: true,
            showQRCode: true,
            showItemDetails: true,
            showNotes: true,
            showPaidChange: true,
            showCompanyInfo: true,
            fontSize: 'medium',
            spacing: 'normal'
        }
    },

    premium: {
        id: 'premium',
        name: 'Premium',
        description: 'Struk premium dengan QR code dan spacing luas',
        features: {
            showLogo: true,
            showQRCode: true,
            showItemDetails: true,
            showNotes: true,
            showPaidChange: true,
            showCompanyInfo: true,
            fontSize: 'large',
            spacing: 'spacious'
        }
    }
};

/**
 * Font size mapping
 */
export const TEMPLATE_FONT_SIZES = {
    small: {
        company: 14,
        header: 10,
        info: 9,
        label: 9,
        value: 9,
        item: 9,
        itemDetails: 8,
        total: 11,
        footer: 9
    },
    medium: {
        company: 16,
        header: 12,
        info: 10,
        label: 10,
        value: 10,
        item: 10,
        itemDetails: 9,
        total: 12,
        footer: 10
    },
    large: {
        company: 18,
        header: 14,
        info: 11,
        label: 11,
        value: 11,
        item: 11,
        itemDetails: 10,
        total: 14,
        footer: 11
    }
};

/**
 * Spacing mapping
 */
export const TEMPLATE_SPACING = {
    compact: {
        section: 4,
        item: 3,
        divider: 6
    },
    normal: {
        section: 6,
        item: 4,
        divider: 8
    },
    spacious: {
        section: 8,
        item: 6,
        divider: 10
    }
};
