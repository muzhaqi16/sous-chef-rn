import React from 'react';
import { render } from '@testing-library/react-native';
import {
  createMountedCellRenderer,
  MountedCellRegistry,
} from '../mountedCellRenderer';

describe('createMountedCellRenderer', () => {
  it('registers a cell on commit, re-keys it when FlashList recycles it to another index, and removes it on unmount', () => {
    const registry = new MountedCellRegistry();
    const onChange = jest.fn();
    registry.setOnChange(onChange);
    const Cell = createMountedCellRenderer(registry);

    const { rerender, unmount } = render(<Cell index={3} />);
    expect(registry.values()).toEqual([3]);

    rerender(<Cell index={7} />);
    expect(registry.values()).toEqual([7]);

    unmount();
    expect(registry.size).toBe(0);

    // set(3), cleanup(3), set(7), cleanup(7)
    expect(onChange).toHaveBeenCalledTimes(4);
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
