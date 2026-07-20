import React from 'react';
import { useDeferredReady } from '../hooks/useDeferredReady';

/**
 * Renders children only after interactions settle.
 * Keeps first paint of heavy unit screens light (modals, secondary panels).
 */
export function DeferredMount({
    children,
    delayMs = 0,
    fallback = null,
    force = false,
}: {
    children: React.ReactNode;
    delayMs?: number;
    fallback?: React.ReactNode;
    /** When true, mount immediately (e.g. user opened a sheet). */
    force?: boolean;
}) {
    const ready = useDeferredReady(delayMs);
    if (force || ready) return <>{children}</>;
    return <>{fallback}</>;
}
