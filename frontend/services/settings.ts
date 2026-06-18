import api from '../utils/api';

export interface SMTPSettings {
    server: string;
    port: number;
    username: string;
    password?: string;
    use_tls: boolean;
    sender_name: string;
}

export interface PrintSettings {
    company_name: string;
    company_address: string;
    company_phone: string;
    header?: string;
    footer?: string;
    logo_uri?: string;
    show_qr_code?: boolean;
    paper_size?: string;
    print_method?: 'browser' | 'qz';
}

export interface SystemSettings {
    smtp?: SMTPSettings;
    print?: PrintSettings;
}

export const settingsService = {
    getSettings: async (): Promise<SystemSettings> => {
        const response = await api.get('/settings');
        return response.data;
    },
    updateSettings: async (data: SystemSettings) => {
        const response = await api.put('/settings', data);
        return response.data;
    },
    testSMTP: async (config: SMTPSettings) => {
        const response = await api.post('/settings/test-smtp', config);
        return response.data;
    }
};
