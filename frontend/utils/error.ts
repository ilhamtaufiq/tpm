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
                return data.detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join(', ');
            }

            // Handle nested errors object { errors: [...] }
            if (typeof data.detail === 'object' && data.detail.errors && Array.isArray(data.detail.errors)) {
                return data.detail.errors.map((err: any) => err.message || err.msg || JSON.stringify(err)).join(', ');
            }

            return JSON.stringify(data.detail);
        }

        // Handle message field
        if (data.message && typeof data.message === 'string') {
            return data.message;
        }

        // Handle error field (alternative format)
        if (data.error) {
            return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        }
    }

    // Handle string error
    if (typeof error === 'string') {
        return error;
    }

    // Fallback to error initials
    return error.message || fallback;
};
