import React, { forwardRef, useLayoutEffect, useState } from 'react';
import type { ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

let nextCellId = 0;
// Module-level so the component body holds no mutation of a global (the
// React Compiler skips a component that increments one directly).
const allocateCellId = () => nextCellId++;

/**
 * Which list indices currently have a committed cell (cell id → index).
 *
 * An imperative side channel with a stable identity: the hook holds one
 * instance for its lifetime, `MountedCellRenderer`'s layout effects write to
 * it, and the blank check reads it from event handlers and effects — never
 * during render, so nothing rendered depends on its contents. The hook
 * re-points `setOnChange` in an effect on every render, which is how the
 * renderer (created once) reaches the latest check closure.
 */
export class MountedCellRegistry {
  private readonly cells = new Map<number, number>();

  private onChange: () => void = () => {};

  /** Called after every registration change. */
  setOnChange(listener: () => void): void {
    this.onChange = listener;
  }

  set(cellId: number, index: number): void {
    this.cells.set(cellId, index);
    this.onChange();
  }

  delete(cellId: number): void {
    this.cells.delete(cellId);
    this.onChange();
  }

  get size(): number {
    return this.cells.size;
  }

  values(): number[] {
    return [...this.cells.values()];
  }

  /**
   * Number of distinct list indices in `[startIndex, endIndex]` that have a
   * committed cell. Distinct, because FlashList can briefly hold two cells at
   * one index (a sticky header's copy, a recycle in flight) and that is still
   * one rendered row.
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
 * Builds the `CellRendererComponent` a list hands to FlashList.
 *
 * FlashList wraps every cell in this component and passes the cell's `index`;
 * it recycles cells, so one instance moves between indices over time. The
 * layout effect keeps `registry` current — set on commit, re-keyed when the
 * index changes, removed on unmount — and each of those runs the registry's
 * `onChange`, which is what lets the blank check run right after the commit
 * that mounted or moved cells instead of whenever viewability next reports.
 *
 * Renders an `Animated.View` so Reanimated layout animations on cells keep
 * working, as FlashList's Reanimated guide requires of a cell renderer.
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
