import api from '../utils/api';

// --- Customer Interfaces ---
export interface Vehicle {
    id?: number;
    plat_nomor: string;
    jenis_unit: string;
    catatan?: string;
}

export interface Customer {
    id: number;
    kode: string;
    nama: string;
    tipe: string; // 'Perorangan' | 'Perusahaan'
    alamat?: string;
    kota?: string;
    telepon?: string;
    email?: string;
    npwp?: string;
    catatan?: string;
    vehicles?: Vehicle[];
    created_at: string;
    updated_at: string;
}

export interface CustomerSummary {
    customer: Customer;
    total_transaksi: number;
    total_piutang: number;
    transaksi_terakhir?: string;
}

// --- Supplier Interfaces ---
export interface Supplier {
    id: number;
    kode: string;
    nama: string;
    alamat?: string;
    kota?: string;
    telepon?: string;
    email?: string;
    npwp?: string;
    rekening?: string;
    bank?: string;
    catatan?: string;
    created_at: string;
    updated_at: string;
}

// --- Asset Interfaces ---
export interface Asset {
    id: number;
    kode: string;
    nama: string;
    kategori: string;
    tanggal_beli: string;
    harga_beli: number;
    nilai_residu: number;
    umur_ekonomis: number;
    status: string;
    lokasi?: string;
    catatan?: string;
    created_at: string;
}

// --- Service ---
export const masterDataService = {
    // =============================================
    // CUSTOMER METHODS
    // =============================================
    getCustomerList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        tipe?: string;
        kota?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }) => {
        const response = await api.get('/customers', { params });
        return response.data;
    },

    searchCustomers: async (q: string, limit: number = 10) => {
        const response = await api.get('/customers/search', { params: { q, limit } });
        return response.data;
    },

    getCustomerCities: async (): Promise<string[]> => {
        const response = await api.get('/customers/cities');
        return response.data;
    },

    getCustomer: async (id: number): Promise<Customer> => {
        const response = await api.get(`/customers/${id}`);
        return response.data;
    },

    getCustomerSummary: async (id: number): Promise<CustomerSummary> => {
        const response = await api.get(`/customers/${id}/summary`);
        return response.data;
    },

    getCustomerPiutang: async (id: number) => {
        const response = await api.get(`/customers/${id}/piutang`);
        return response.data;
    },

    getCustomerTransactions: async (id: number, params?: { skip?: number; limit?: number; source?: string }) => {
        const response = await api.get(`/customers/${id}/transactions`, { params });
        return response.data;
    },

    createCustomer: async (data: Partial<Customer>): Promise<Customer> => {
        const response = await api.post('/customers', data);
        return response.data;
    },

    updateCustomer: async (id: number, data: Partial<Customer>): Promise<Customer> => {
        const response = await api.put(`/customers/${id}`, data);
        return response.data;
    },

    deleteCustomer: async (id: number) => {
        const response = await api.delete(`/customers/${id}`);
        return response.data;
    },

    // =============================================
    // SUPPLIER METHODS
    // =============================================
    getSupplierList: async (params?: {
        skip?: number;
        limit?: number;
        search?: string;
        kota?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
    }) => {
        const response = await api.get('/suppliers', { params });
        return response.data;
    },

    searchSuppliers: async (q: string, limit: number = 10) => {
        const response = await api.get('/suppliers/search', { params: { q, limit } });
        return response.data;
    },

    getSupplierCities: async (): Promise<string[]> => {
        const response = await api.get('/suppliers/cities');
        return response.data;
    },

    getSupplier: async (id: number): Promise<Supplier> => {
        const response = await api.get(`/suppliers/${id}`);
        return response.data;
    },

    createSupplier: async (data: Partial<Supplier>): Promise<Supplier> => {
        const response = await api.post('/suppliers', data);
        return response.data;
    },

    updateSupplier: async (id: number, data: Partial<Supplier>): Promise<Supplier> => {
        const response = await api.put(`/suppliers/${id}`, data);
        return response.data;
    },

    deleteSupplier: async (id: number) => {
        const response = await api.delete(`/suppliers/${id}`);
        return response.data;
    },

    // =============================================
    // MASTER DATA STATS
    // =============================================
    getMasterDataStats: async () => {
        const response = await api.get('/master-data/stats');
        return response.data;
    },

    // =============================================
    // ASSET METHODS
    // =============================================
    getAssetList: async (params?: {
        page?: number;
        size?: number;
        search?: string;
        kategori?: string;
        status?: string;
    }) => {
        const response = await api.get('/assets', { params });
        return response.data;
    },

    getAsset: async (id: number): Promise<Asset> => {
        const response = await api.get(`/assets/${id}`);
        return response.data;
    },

    createAsset: async (data: Partial<Asset>): Promise<Asset> => {
        const response = await api.post('/assets', data);
        return response.data;
    },

    updateAsset: async (id: number, data: Partial<Asset>): Promise<Asset> => {
        const response = await api.put(`/assets/${id}`, data);
        return response.data;
    },

    deleteAsset: async (id: number) => {
        const response = await api.delete(`/assets/${id}`);
        return response.data;
    },

    getAssetStats: async () => {
        const response = await api.get('/assets/summary/stats');
        return response.data;
    },
};
