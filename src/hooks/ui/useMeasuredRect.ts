import { useRef } from 'react';
import type { View } from 'react-native';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';

/**
 * A view's on-screen rect, for a spotlight to point at. Attach `ref` to a view
 * with `collapsable={false}` (Android flattens it away otherwise) and call
 * `measure` from its `onLayout`. Without `onMeasure`, `measure` does nothing.
 */
export function useMeasuredRect(
  onMeasure: ((rect: TargetRect) => void) | undefined,
) {
  const ref = useRef<View>(null);

  const measure = () => {
    if (!onMeasure) return;
    // Android's native layout settles a frame after `onLayout` fires.
    requestAnimationFrame(() => {
      ref.current?.measure((_x, _y, width, height, pageX, pageY) => {
        // A view not laid out yet reports zero; a spotlight on it is invisible.
        if (width > 0 && height > 0) {
          onMeasure({ x: pageX, y: pageY, width, height });
        }
      });
    });
  };

  return { ref, measure };
}
