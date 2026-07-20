import React, { Suspense, lazy } from 'react';
import { UnitScreenSkeleton } from '../../components/ui/UnitScreenSkeleton';

// @ts-expect-error project tsc module target is older; Metro supports import()
const JasaAngkutHomeContent = lazy(() => import('./JasaAngkutHomeContent'));

export default function JasaAngkutScreen() {
    return (
        <Suspense fallback={<UnitScreenSkeleton title="Jasa Angkut" />}>
            <JasaAngkutHomeContent />
        </Suspense>
    );
}
