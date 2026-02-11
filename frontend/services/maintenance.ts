import api from '../utils/api';

export const maintenanceService = {
    resetTransactions: async () => {
        console.log("SERVICE: Calling /maintenance/reset-transactions");
        const response = await api.post('/maintenance/reset-transactions');
        console.log("SERVICE: Response received", response.status);
        return response.data;
    },
};
