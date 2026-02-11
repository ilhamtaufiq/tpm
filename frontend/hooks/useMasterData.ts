import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '../services/masterData';

// =============================================
// CUSTOMER
// =============================================
export const useCustomerList = (params?: any) => {
    return useQuery({
        queryKey: ['customers', params],
        queryFn: () => masterDataService.getCustomerList(params),
    });
};

export const useSearchCustomers = (q: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['customers_search', q],
        queryFn: () => masterDataService.searchCustomers(q),
        enabled: enabled && q.length > 0,
    });
};

export const useCustomerCities = () => {
    return useQuery({
        queryKey: ['customer_cities'],
        queryFn: () => masterDataService.getCustomerCities(),
    });
};

export const useCustomer = (id: number) => {
    return useQuery({
        queryKey: ['customer', id],
        queryFn: () => masterDataService.getCustomer(id),
        enabled: !!id,
    });
};

export const useCustomerSummary = (id: number) => {
    return useQuery({
        queryKey: ['customer_summary', id],
        queryFn: () => masterDataService.getCustomerSummary(id),
        enabled: !!id,
    });
};

export const useCreateCustomer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: masterDataService.createCustomer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });
};

export const useUpdateCustomer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            masterDataService.updateCustomer(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });
};

export const useDeleteCustomer = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => masterDataService.deleteCustomer(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });
};

// =============================================
// SUPPLIER
// =============================================
export const useSupplierList = (params?: any) => {
    return useQuery({
        queryKey: ['suppliers', params],
        queryFn: () => masterDataService.getSupplierList(params),
    });
};

export const useSearchSuppliers = (q: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['suppliers_search', q],
        queryFn: () => masterDataService.searchSuppliers(q),
        enabled: enabled && q.length > 0,
    });
};

export const useSupplierCities = () => {
    return useQuery({
        queryKey: ['supplier_cities'],
        queryFn: () => masterDataService.getSupplierCities(),
    });
};

export const useSupplier = (id: number) => {
    return useQuery({
        queryKey: ['supplier', id],
        queryFn: () => masterDataService.getSupplier(id),
        enabled: !!id,
    });
};

export const useCreateSupplier = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: masterDataService.createSupplier,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        },
    });
};

export const useUpdateSupplier = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) =>
            masterDataService.updateSupplier(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        },
    });
};

export const useDeleteSupplier = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => masterDataService.deleteSupplier(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        },
    });
};
