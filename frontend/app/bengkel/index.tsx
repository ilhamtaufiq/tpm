import React, { Suspense, lazy } from 'react';
import { UnitScreenSkeleton } from '../../components/ui/UnitScreenSkeleton';

/**
 * Thin entry: navigate from Home is cheap (this file is tiny).
 * Heavy UI/hooks load async via React.lazy after route transition starts.
 */
// @ts-expect-error project tsc module target is older; Metro supports import()
const BengkelHomeContent = lazy(() => import('./BengkelHomeContent'));

export default function BengkelScreen() {
    return (
        <Suspense fallback={<UnitScreenSkeleton title="Bengkel" />}>
            <BengkelHomeContent />
        </Suspense>
    );
}
