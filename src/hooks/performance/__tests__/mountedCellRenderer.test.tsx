import React from 'react';
import { render } from '@testing-library/react-native';
import {
  createMountedCellRenderer,
  MountedCellRegistry,
} from '../mountedCellRenderer';

describe('createMountedCellRenderer', () => {
  it('registers a cell on commit, re-keys it when FlashList recycles it to another index, and removes it on unmount', () => {
    const registry = new MountedCellRegistry();
    const Cell = createMountedCellRenderer(registry);

    const { rerender, unmount } = render(<Cell index={3} />);
    expect(registry.values()).toEqual([3]);

    rerender(<Cell index={7} />);
    expect(registry.values()).toEqual([7]);

    unmount();
    expect(registry.size).toBe(0);

    // The unmount scheduled a flush; drop it so no frame fires after the test.
    registry.dispose();
  });

  // The registry's CONTENTS are updated synchronously on commit — that is what
  // the assertions above check. The listener is not: it is a whole
  // visible-range computation, and calling it once per registration made a
  // commit's instrumentation cost quadratic in the cells it touched.
  it('coalesces the listener to one call per frame however many cells changed', () => {
    jest.useFakeTimers();
    try {
      const registry = new MountedCellRegistry();
      const onChange = jest.fn();
      registry.setOnChange(onChange);
      const Cell = createMountedCellRenderer(registry);

      const { unmount } = render(
        <>
          {Array.from({ length: 12 }, (_, i) => (
            <Cell key={i} index={i} />
          ))}
        </>,
      );

      // Twelve registrations, no evaluation yet.
      expect(registry.size).toBe(12);
      expect(onChange).not.toHaveBeenCalled();

      jest.runOnlyPendingTimers();
      expect(onChange).toHaveBeenCalledTimes(1);

      unmount();
      registry.dispose();
    } finally {
      jest.useRealTimers();
    }
  });

  it('drops a pending evaluation when the list goes away', () => {
    jest.useFakeTimers();
    try {
      const registry = new MountedCellRegistry();
      const onChange = jest.fn();
      registry.setOnChange(onChange);
      const Cell = createMountedCellRenderer(registry);

      render(<Cell index={0} />);
      registry.dispose();

      jest.runOnlyPendingTimers();
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps one entry per cell instance, so two cells at one index count as one rendered row', () => {
    const registry = new MountedCellRegistry();
    const Cell = createMountedCellRenderer(registry);

    render(
      <>
        <Cell index={2} />
        <Cell index={2} />
      </>,
    );

    expect(registry.size).toBe(2);
    expect(registry.countMountedInRange(0, 5)).toBe(1);
  });

  it('ignores a cell rendered without an index', () => {
    const registry = new MountedCellRegistry();
    const onChange = jest.fn();
    registry.setOnChange(onChange);
    const Cell = createMountedCellRenderer(registry);

    render(<Cell />);

    expect(registry.size).toBe(0);
    registry.dispose();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('MountedCellRegistry.countMountedInRange', () => {
  it('counts distinct indices inside the inclusive range', () => {
    const registry = new MountedCellRegistry();
    registry.set(1, 4);
    registry.set(2, 5);
    registry.set(3, 5);
    registry.set(4, 9);
    expect(registry.countMountedInRange(4, 8)).toBe(2);
    expect(registry.countMountedInRange(5, 5)).toBe(1);
    expect(registry.countMountedInRange(0, 3)).toBe(0);
    expect(new MountedCellRegistry().countMountedInRange(0, 10)).toBe(0);
  });
});
