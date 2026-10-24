import { useEffect } from 'react';
import { NativePerformanceService } from '#/services/performance/NativePerformanceService';

/**
 * Today is where a launch lands, and it renders no instrumented list, so it
 * marks the first meaningful paint itself: once it shows content, not a
 * spinner. The service latches, so a later list's mark is ignored.
 */
export function useMarkFullyDrawn(drawn: boolean) {
  useEffect(() => {
    if (drawn) NativePerformanceService.markFullyDrawn();
  }, [drawn]);
}
