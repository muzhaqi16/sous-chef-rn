import React, { forwardRef, useLayoutEffect, useState } from 'react';
import type { ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

let nextCellId = 0;
// Module-level so the component body holds no mutation of a global (the
// React Compiler skips a component that increments one directly).
const allocateCellId = () => nextCellId++;

/**
 * Which list indices currently have a committed cell (cell id → index). An
 * imperative side channel, read only from effects and event handlers — NEVER
 * during render, so nothing rendered depends on it. `setOnChange` is re-pointed
 * each render, which is how the once-created renderer reaches the latest check.
 */
export class MountedCellRegistry {
  private readonly cells = new Map<number, number>();

  private onChange: () => void = () => {};

  private pendingFlush: number | null = null;

  /** Called once per frame in which registrations changed. */
  setOnChange(listener: () => void): void {
    this.onChange = listener;
  }

  /**
   * One listener call per frame: the listener is a whole visible-range
   * computation, so calling it per registration is quadratic in the cells a
   * commit touched. A FRAME, not a microtask — a microtask runs inside the
   * commit, before the layout table the listener reads has settled.
   */
  private scheduleFlush(): void {
    if (this.pendingFlush !== null) return;
    this.pendingFlush = requestAnimationFrame(() => {
      this.pendingFlush = null;
      this.onChange();
    });
  }

  set(cellId: number, index: number): void {
    this.cells.set(cellId, index);
    this.scheduleFlush();
  }

  delete(cellId: number): void {
    this.cells.delete(cellId);
    this.scheduleFlush();
  }

  /** Drop a pending frame, so a flush cannot land after the list unmounts. */
  dispose(): void {
    if (this.pendingFlush === null) return;
    cancelAnimationFrame(this.pendingFlush);
    this.pendingFlush = null;
  }

  get size(): number {
    return this.cells.size;
  }

  values(): number[] {
    return [...this.cells.values()];
  }

  /**
   * Distinct list indices in `[startIndex, endIndex]` holding a committed cell.
   * Distinct because FlashList can briefly hold two cells at one index (a sticky
   * header's copy, a recycle in flight), which is still one rendered row.
   */
  countMountedInRange(startIndex: number, endIndex: number): number {
    const seen = new Set<number>();
    this.cells.forEach(index => {
      if (index >= startIndex && index <= endIndex) seen.add(index);
    });
    return seen.size;
  }
}

/**
 * The `CellRendererComponent` handed to FlashList. Cells are RECYCLED, so one
 * instance moves between indices; the layout effect keeps `registry` current and
 * fires `onChange`, so the blank check runs on the commit rather than whenever
 * viewability next reports. The `Animated.View` is what keeps cell animations.
 */
export function createMountedCellRenderer(registry: MountedCellRegistry) {
  const MountedCellRenderer = forwardRef<
    React.ComponentRef<typeof Animated.View>,
    ViewProps & { index?: number }
  >(({ index, ...props }, ref) => {
    const [cellId] = useState(allocateCellId);

    useLayoutEffect(() => {
      if (index === undefined) return undefined;
      registry.set(cellId, index);
      return () => {
        registry.delete(cellId);
      };
    }, [cellId, index]);

    return <Animated.View ref={ref} {...props} />;
  });
  MountedCellRenderer.displayName = 'MountedCellRenderer';
  return MountedCellRenderer;
}

export type MountedCellRenderer = ReturnType<typeof createMountedCellRenderer>;

/**
 * The UNSAMPLED session's cell renderer: the `Animated.View` without the
 * measurement. The wrapper is NOT instrumentation — handing FlashList
 * `undefined` drops it to a plain-View container and every cell layout animation
 * stops. Only the registry and its per-cell layout effect are sampled.
 */
export const PlainAnimatedCellRenderer = forwardRef<
  React.ComponentRef<typeof Animated.View>,
  ViewProps & { index?: number }
>(function PlainAnimatedCell({ index: _index, ...props }, ref) {
  return <Animated.View ref={ref} {...props} />;
});
