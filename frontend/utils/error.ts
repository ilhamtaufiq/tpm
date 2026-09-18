/**
 * Utility to parse error messages from API responses safely as string
 */
export const getErrorMessage = (error: any, fallback: string = 'Terjadi kesalahan sistem'): string => {
    if (!error) return fallback;

    try {
        // Handle Axios error structure
        if (error.response?.data) {
            const data = error.response.data;

            // Handle FastAPI detail field
            if (data.detail !== undefined && data.detail !== null) {
                if (typeof data.detail === 'string') {
                    return data.detail;
                }

                // Handle validation errors (array of objects)
                if (Array.isArray(data.detail)) {
                    return data.detail.map((err: any) => err.msg || err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err))).join(', ');
                }

                // Handle nested errors object { errors: [...] }
                if (typeof data.detail === 'object' && data.detail.errors && Array.isArray(data.detail.errors)) {
                    return data.detail.errors.map((err: any) => err.message || err.msg || (typeof err === 'object' ? JSON.stringify(err) : String(err))).join(', ');
                }

                // Handle detailed error object e.g. { error_type, message, orig }
                if (typeof data.detail === 'object') {
                    if (data.detail.message && typeof data.detail.message === 'string') {
                        return data.detail.message;
                    }
                    if (data.detail.msg && typeof data.detail.msg === 'string') {
                        return data.detail.msg;
                    }
                    return JSON.stringify(data.detail);
                }

                return String(data.detail);
            }

            // Handle message field
            if (data.message !== undefined && data.message !== null) {
                if (typeof data.message === 'string') {
                    return data.message;
                }
                if (typeof data.message === 'object' && data.message.message) {
                    return String(data.message.message);
                }
                return JSON.stringify(data.message);
            }

            // Handle error field (alternative format)
            if (data.error !== undefined && data.error !== null) {
                if (typeof data.error === 'string') {
                    return data.error;
                }
                return JSON.stringify(data.error);
            }
        }

        // Handle string error
        if (typeof error === 'string') {
            return error;
        }

        if (error.message) {
            return typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
        }
    } catch {
        return fallback;
    }

    return fallback;
};
