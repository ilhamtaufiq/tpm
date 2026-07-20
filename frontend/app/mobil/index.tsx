import React, { Suspense, lazy } from 'react';
import { UnitScreenSkeleton } from '../../components/ui/UnitScreenSkeleton';

// @ts-expect-error project tsc module target is older; Metro supports import()
const MobilHomeContent = lazy(() => import('./MobilHomeContent'));

export default function MobilInventoryScreen() {
    return (
        <Suspense fallback={<UnitScreenSkeleton title="Jual Beli Mobil" />}>
            <MobilHomeContent />
        </Suspense>
    );
}
