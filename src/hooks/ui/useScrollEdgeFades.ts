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
 * Which edges of a horizontal scroller still have content out of view, so the
 * caller can fade them. `edges` re-renders only when a fade toggles. Wire the
 * handlers onto the `ScrollView` with `scrollEventThrottle={16}`;
 * `enabled = false` keeps `metrics` live while never flipping `edges`.
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
