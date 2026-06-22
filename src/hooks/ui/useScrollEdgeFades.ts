import { useRef, useState } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

// A resting position within this many px of an edge doesn't fade an item that
// is essentially fully visible.
const EDGE_DEADZONE = 12;

interface EdgeState {
  left: boolean;
  right: boolean;
}

export interface ScrollMetrics {
  scrollX: number;
  viewportW: number;
  contentW: number;
}

/**
 * Tracks a horizontal scroller's metrics and reports which edges still have
 * content scrolled out of view, so the caller can render a soft fade there
 * (signalling "more to scroll" instead of a hard clip). The metrics live in a
 * ref written only by the returned handlers; `edges` re-renders only when a
 * fade actually toggles on or off.
 *
 * Wire the handlers onto the `ScrollView` and set `scrollEventThrottle={16}`.
 * `metrics` is exposed for callers that already need the viewport/content
 * widths for other work (e.g. centering an active tab) so they don't have to
 * track the same numbers twice.
 *
 * Pass `enabled = false` to keep tracking `metrics` (so a consumer can still
 * read the live scroll position) while never flipping `edges` — used when a row
 * wants the metrics but not the fade overlay.
 */
export function useScrollEdgeFades(enabled = true) {
  const [edges, setEdges] = useState<EdgeState>({ left: false, right: false });
  const metrics = useRef<ScrollMetrics>({
    scrollX: 0,
    viewportW: 0,
    contentW: 0,
  });

  const recompute = () => {
    if (!enabled) return;
    const { scrollX, viewportW, contentW } = metrics.current;
    const left = scrollX > EDGE_DEADZONE;
    const right = scrollX + viewportW < contentW - EDGE_DEADZONE;
    setEdges(prev =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    metrics.current.scrollX = e.nativeEvent.contentOffset.x;
    recompute();
  };

  const onContentSizeChange = (w: number) => {
    metrics.current.contentW = w;
    recompute();
  };

  const onLayout = (e: LayoutChangeEvent) => {
    metrics.current.viewportW = e.nativeEvent.layout.width;
    recompute();
  };

  return { edges, metrics, onScroll, onContentSizeChange, onLayout };
}
