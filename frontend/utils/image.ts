import { FILE_URL } from "./api";

/**
 * Get full URL for a server-side image path.
 * If the path starts with http or file, return as is.
 * Otherwise prefix with base URL.
 */
export const getFileUrl = (path: string | null | undefined): string | null => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('file://') || path.startsWith('data:')) {
        return path;
    }
    
    // Ensure relative paths from server starting with / are handled correctly
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${FILE_URL}${cleanPath}`;
};
