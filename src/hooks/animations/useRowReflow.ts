import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ScrollViewProps, ViewProps } from 'react-native';
import type { CSSTransitionProperties } from 'react-native-reanimated';
import type { FlashListRef } from '@shopify/flash-list';
import { motion } from '#/theme/foundations/motion';
import { createValueContext } from '#hooks/utils/createValueContext';
import { useMotionEnabled } from './useMotionEnabled';

/**
 * Whether a list's cells animate their `top` right now. A list without the
 * provider never reflows.
 */
export const RowReflowContext =
  createValueContext<boolean>('RowReflowProvider');

const REFLOW_TRANSITION: CSSTransitionProperties = {
  transitionProperty: 'top',
  transitionDuration: motion.timing.MODERATE,
  transitionTimingFunction: motion.cssEasing.standard,
};

// The transition runs from the removal's commit; ending it sooner snaps the
// rows the rest of the way.
const REFLOW_WINDOW_MS = motion.timing.MODERATE + motion.timing.INSTANT;

/** A FlashList cell's style, with the `top` transition while its list reflows. */
export const useReflowCellStyle = (style: ViewProps['style']) =>
  RowReflowContext.useOptionalValue() ? [style, REFLOW_TRANSITION] : style;

type ReflowingList = Pick<
  FlashListRef<unknown>,
  'prepareForLayoutAnimationRender'
>;

/**
 * Slides the rows below a removed row up into its gap. `removeRow(commit)`
 * attaches the cells' `top` transition and runs `commit` only in the effect of
 * THAT commit: attached in the same commit as the change, it animates nothing.
 * Verified: #reanimated-css-transitions-need-a-baseline-commit.
 * The returned `onScrollBeginDrag` detaches it — while attached, every cell
 * FlashList recycles animates across the viewport.
 */
export function useRowReflow(
  listRef: RefObject<ReflowingList | null>,
  onScrollBeginDrag?: ScrollViewProps['onScrollBeginDrag'],
) {
  const motionEnabled = useMotionEnabled();
  const [reflowing, setReflowing] = useState(false);
  const [removals, setRemovals] = useState(0);
  const pendingRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    const commits = pendingRef.current.splice(0);
    if (commits.length === 0) return undefined;
    listRef.current?.prepareForLayoutAnimationRender();
    commits.forEach(commit => commit());
    const timer = setTimeout(() => setReflowing(false), REFLOW_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [removals, listRef]);

  // A list unmounted in the arming commit never runs the effect above; the
  // removal still has to happen.
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      pending.splice(0).forEach(commit => commit());
    };
  }, []);

  const removeRow = (commit: () => void) => {
    // Reanimated's CSS transitions ignore reduce motion.
    // Verified: #reanimated-css-transitions-ignore-reduce-motion.
    if (!motionEnabled) {
      listRef.current?.prepareForLayoutAnimationRender();
      commit();
      return;
    }
    pendingRef.current.push(commit);
    setReflowing(true);
    setRemovals(count => count + 1);
  };

  const handleScrollBeginDrag: ScrollViewProps['onScrollBeginDrag'] = event => {
    setReflowing(false);
    onScrollBeginDrag?.(event);
  };

  return {
    reflowing,
    removeRow,
    onScrollBeginDrag: handleScrollBeginDrag,
  };
}
