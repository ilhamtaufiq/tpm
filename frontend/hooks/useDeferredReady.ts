import { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';

/**
 * Becomes true after JS interactions (nav animation / paint) settle.
 * Use to defer non-critical queries and heavy subtrees on first open.
 */
export function useDeferredReady(delayMs = 0): boolean {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const task = InteractionManager.runAfterInteractions(() => {
            if (delayMs > 0) {
                timeoutId = setTimeout(() => {
                    if (!cancelled) setReady(true);
                }, delayMs);
            } else if (!cancelled) {
                setReady(true);
            }
        });

        // Fallback if interactions never clear (rare on web)
        const failSafe = setTimeout(() => {
            if (!cancelled) setReady(true);
        }, 1200);

        return () => {
            cancelled = true;
            task.cancel?.();
            if (timeoutId) clearTimeout(timeoutId);
            clearTimeout(failSafe);
        };
    }, [delayMs]);

    return ready;
}
