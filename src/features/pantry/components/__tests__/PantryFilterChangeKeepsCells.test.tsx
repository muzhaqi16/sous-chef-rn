'use no memo';
import React from 'react';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { PantrySortOption } from '#store/slices/preferenceTypes';

/**
 * Changing the pantry filter must not re-render every mounted item cell.
 *
 * Verified against the installed `@shopify/flash-list@2.3.2`: `ViewHolder`'s
 * `React.memo` comparator (`src/recyclerview/ViewHolder.tsx`) reads
 *
 *     prevProps.extraData === nextProps.extraData &&
 *     prevProps.renderItem === nextProps.renderItem &&
 *
 * so either one changing is enough on its own. No item cell needs the filter:
 * the renderer reads only `item`, and `PantryItemCard` owns its own cache
 * subscription via `useFragment`. So the renderer lives at module scope and
 * `locationFilter` stays out of `extraData`.
 *
 * This asserts the two props directly rather than counting renders, because
 * these two identities ARE the mechanism — FlashList's own comparator is the
 * thing being satisfied.
 */

const flashListProps: Array<Record<string, unknown>> = [];

// The global mock in `__tests__/setup/mocks/shopify-flash-list` already swaps
// FlashList for FlatList; this wraps that so the props can be inspected without
// pulling in the untransformed ESM dist via `requireActual`.
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  const ReactLocal = require('react');
  return {
    FlashList: (props: Record<string, unknown>) => {
      flashListProps.push(props);
      // FlashList takes `renderScrollComponent` as a component, VirtualizedList
      // as a render function — adapt before handing the props to FlatList.
      const { renderScrollComponent, ...rest } = props;
      return ReactLocal.createElement(FlatList, {
        ...rest,
        renderScrollComponent: renderScrollComponent
          ? (scrollProps: Record<string, unknown>) =>
              ReactLocal.createElement(renderScrollComponent, scrollProps)
          : undefined,
      });
    },
    MasonryFlashList: FlatList,
    useRecyclingState: (initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      () => {},
    ],
    useMappingHelper: () => ({
      getMappingKey: (itemKey: string, index: number) => `${itemKey}_${index}`,
    }),
  };
});

import { PantryContent } from '../PantryContent';

const baseProps = {
  userName: 'John',
  householdName: 'My Kitchen',
  items: [],
  locationFilter: 'all' as const,
  onLocationFilterChange: jest.fn(),
  locationCounts: { all: 3, fridge: 1, freezer: 1, pantry: 1 },
  searchQuery: '',
  onSearchChange: jest.fn(),
  onItemPress: jest.fn(),
};

const lastProps = () => flashListProps[flashListProps.length - 1];

describe('a pantry filter change keeps every mounted cell', () => {
  beforeEach(() => {
    flashListProps.length = 0;
  });

  it('captures FlashList props at all, so the checks below are not vacuous', () => {
    renderWithApollo(<PantryContent {...baseProps} />);
    expect(flashListProps.length).toBeGreaterThan(0);
    expect(lastProps()!.renderItem).toEqual(expect.any(Function));
  });

  it('keeps the same renderItem identity across a filter change', () => {
    const { rerender } = renderWithApollo(<PantryContent {...baseProps} />);
    const before = lastProps()!.renderItem;

    rerender(<PantryContent {...baseProps} locationFilter="fridge" />);
    const after = lastProps()!.renderItem;

    // Module scope, so this holds by construction — and it is exactly what an
    // inline renderer closing over `locationFilter` would break.
    expect(after).toBe(before);
  });

  it('keeps the same extraData across a filter change', () => {
    const { rerender } = renderWithApollo(<PantryContent {...baseProps} />);
    const before = lastProps()!.extraData;

    rerender(<PantryContent {...baseProps} locationFilter="fridge" />);

    expect(lastProps()!.extraData).toBe(before);
  });

  it('still carries the sort in extraData, which is a real invalidation signal', () => {
    // The point is not "never invalidate" — it is "invalidate for the right
    // reason". Without this, deleting `extraData` outright would satisfy the
    // test above while dropping a signal the list does want.
    //
    // Asserted on the composed value rather than by changing the sort, because
    // `initialSortOption` only seeds internal state; the live value moves
    // through the sort control, not through props.
    renderWithApollo(
      <PantryContent
        {...baseProps}
        initialSortOption={PantrySortOption.NAME}
      />,
    );

    const extraData = String(lastProps()!.extraData);
    expect(extraData).toContain(PantrySortOption.NAME);
    // …and the filter is not in it. `locationFilter` is 'all' here, which is
    // distinctive enough that its absence is meaningful.
    expect(extraData).not.toContain('all');
  });
});
