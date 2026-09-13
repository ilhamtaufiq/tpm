import { QueryClient } from '@tanstack/react-query';

/**
 * Single app-wide QueryClient.
 * Lives in its own module so stores (auth logout) can clear the cache
 * without importing the root layout.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Avoid network storm when switching menus: cache is "fresh" for 60s.
            // Realtime WS + pull-to-refresh still update sooner when needed.
            staleTime: 1000 * 60,
            // 24 hours until garbage collected from storage
            gcTime: 1000 * 60 * 60 * 24,
            // Only refetch focused queries if data is actually stale
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchOnMount: true,
            networkMode: 'offlineFirst',
            // Standard retry logic
            retry: (failureCount, error: any) => {
                if (error?.message?.includes('network')) return false;
                return failureCount < 2;
            },
        },
        mutations: {
            // Paused mutations are a fallback; durable queue is source of truth for offline writes
            networkMode: 'online',
            retry: 0,
        },
    },
});
