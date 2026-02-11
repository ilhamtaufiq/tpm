/**
 * Utility to parse error messages from API responses
 */
export const getErrorMessage = (error: any, fallback: string = 'Terjadi kesalahan sistem'): string => {
    if (!error) return fallback;

    // Handle Axios error structure
    if (error.response?.data) {
        const data = error.response.data;

        // Handle FastAPI detail field
        if (data.detail) {
            if (typeof data.detail === 'string') {
                return data.detail;
            }

            // Handle validation errors (array of objects)
            if (Array.isArray(data.detail)) {
                return data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ');
            }

            return JSON.stringify(data.detail);
        }

        // Handle error field (alternative format)
        if (data.error) {
            return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        }

        // Handle message field
        if (data.message) {
            return data.message;
        }
    }

    // Handle string error
    if (typeof error === 'string') {
        return error;
    }

    // Fallback to error initials
    return error.message || fallback;
};
