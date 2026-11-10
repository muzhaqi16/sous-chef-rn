import { useEffect, useEffectEvent, useRef } from 'react';
import type { View } from 'react-native';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';

/** A view still moving after this many frames is reported where it is. */
const MAX_SETTLE_FRAMES = 30;

const sameRect = (a: TargetRect, b: TargetRect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * A view's on-screen rect, for a spotlight to point at. Attach `ref` to a view
 * with `collapsable={false}` (Android flattens it away otherwise) and call
 * `measure` from its `onLayout`, and again when it moves without a layout (a
 * swiped row settling). Without `onMeasure`, `measure` does nothing.
 */
export function useMeasuredRect(
  onMeasure: ((rect: TargetRect) => void) | undefined,
  shape?: TargetRect['shape'],
) {
  const ref = useRef<View>(null);

  // Reads the rect a frame from now; `null` for a view not laid out yet, whose
  // zero-size hole would point at nothing.
  const read = (done: (rect: TargetRect | null) => void) => {
    // Android's native layout settles a frame after `onLayout` fires.
    requestAnimationFrame(() => {
      ref.current?.measure((_x, _y, width, height, pageX, pageY) => {
        done(
          width > 0 && height > 0
            ? {
                x: pageX,
                y: pageY,
                width,
                height,
                ...(shape ? { shape } : {}),
              }
            : null,
        );
      });
    });
  };

  const measure = () => {
    if (!onMeasure) return;
    read(rect => {
      if (rect) onMeasure(rect);
    });
  };

  // A receiver that arrives after the view's last layout (a spotlight step
  // starting later) is measured now: `onLayout` will not fire again for it.
  // The view may still be moving with no layout (a tab switching in, a row
  // closing), so it is read each frame until two reads agree.
  const measureSettled = () => {
    if (!onMeasure) return;
    let previous: TargetRect | null = null;
    let frames = 0;
    const next = () => {
      read(rect => {
        if (!rect) return;
        frames += 1;
        if (
          (previous && sameRect(previous, rect)) ||
          frames >= MAX_SETTLE_FRAMES
        ) {
          onMeasure(rect);
          return;
        }
        previous = rect;
        next();
      });
    };
    next();
  };

  const wantsRect = onMeasure !== undefined;
  const hadReceiver = useRef(wantsRect);
  const measureArrival = useEffectEvent(measureSettled);
  useEffect(() => {
    if (wantsRect && !hadReceiver.current) measureArrival();
    hadReceiver.current = wantsRect;
  }, [wantsRect]);

  return { ref, measure };
}
