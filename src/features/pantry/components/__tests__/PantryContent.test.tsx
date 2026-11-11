'use no memo';

import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { renderWithApollo, seedQuery } from '#/test-utils/apolloMockProvider';
import {
  pantryData,
  type PantryItemFixture,
} from '#/test-utils/fixtures/pantryFixtures';
import { t } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';
import {
  PantrySortDirection,
  PantrySortOption,
} from '#store/slices/preferenceTypes';
import { kitTestIDs } from '#components/testIDs';
import {
  OverlayBackdropProvider,
  useBackdropClaim,
} from '#components/providers/OverlayBackdropProvider';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { pantryTestIDs } from '#features/pantry/testIDs';
import type { PantryListNode } from '../pantryDisplay/renderItem';
import type { PantryContentProps } from '../pantryDisplay/types';
import { sortOptionLabelKey } from '../PantrySortModal';
import { PantryContent } from '../PantryContent';

const PANTRY_READ = {
  id: 'p1',
  itemsFirst: 50,
  storageLocationsFirst: 20,
  today: todayKey(),
};

/** The rows the screen hands over, each readable by its card from the cache. */
function stocked(rows: PantryItemFixture[]) {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetPantryDocument,
    variables: PANTRY_READ,
    data: pantryData({ id: 'p1', items: rows }),
  });
  const items: PantryListNode[] =
    cache
      .readQuery({ query: GetPantryDocument, variables: PANTRY_READ })
      ?.pantry?.itemsConnection.edges.map(edge => edge.node) ?? [];
  return { cache, items };
}

/** A sheet's claim on the backdrop, as every sheet makes it. */
function Sheet({ open }: { open: boolean }) {
  useBackdropClaim(open);
  return null;
}

const props = (over: Partial<PantryContentProps> = {}): PantryContentProps => ({
  pantryName: 'Kitchen',
  items: [],
  locationFilter: 'all',
  onLocationFilterChange: jest.fn(),
  locationCounts: { all: 0 },
  searchQuery: '',
  onSearchChange: jest.fn(),
  onItemPress: jest.fn(),
  ...over,
});

/** The content as the pantry tab mounts it, under the app's backdrop. */
function renderContent(
  over: Partial<PantryContentProps> = {},
  rows: PantryItemFixture[] = [],
) {
  const { cache, items } = stocked(rows);
  const ui = (next: Partial<PantryContentProps>, sheetOpen = false) => (
    <OverlayBackdropProvider>
      <Sheet open={sheetOpen} />
      <PantryContent {...props({ items, ...over, ...next })} />
    </OverlayBackdropProvider>
  );
  const view = renderWithApollo(ui({}), { cache });
  return {
    items,
    /** The same content with props the screen has since changed. */
    update: (next: Partial<PantryContentProps>, sheetOpen = false) => {
      view.rerender(ui(next, sheetOpen));
    },
  };
}

const MILK: PantryItemFixture[] = [{ id: 'i1', itemName: 'Milk' }];

const shownNames = () =>
  screen
    .queryAllByText(/^(Milk|Rice|Beans|Apples)$/)
    .map(node => node.props.children);

const skeletonShown = () =>
  screen.queryByTestId(pantryTestIDs.listSkeletonOverlay) !== null ||
  screen.queryByTestId(pantryTestIDs.loading) !== null;

const tab = (id: string) =>
  screen.getByTestId(kitTestIDs.filterTab(pantryTestIDs.locationTabPrefix, id));

describe('waiting on rows', () => {
  // Offline-first: the stats survive a cold read whose rows have not arrived.
  it('holds skeletons while the stats say rows are coming', () => {
    const { update } = renderContent({ locationCounts: { all: 1 } }, MILK);

    update({ loading: true, items: [] });

    expect(skeletonShown()).toBe(true);
    expect(screen.queryByTestId(pantryTestIDs.emptyState)).toBeNull();
  });

  it('draws one skeleton, the overlay, while it is up', () => {
    const { update } = renderContent({ locationCounts: { all: 1 } }, MILK);

    update({ loading: true, items: [] });

    expect(screen.getByTestId(pantryTestIDs.listSkeletonOverlay)).toBeTruthy();
    expect(screen.queryByTestId(pantryTestIDs.loading)).toBeNull();
  });

  it('settles on the empty state once the read lands, whatever stale stats say', () => {
    const { update } = renderContent({ locationCounts: { all: 1 } }, MILK);

    update({ loading: false, items: [] });

    expect(skeletonShown()).toBe(false);
    expect(screen.getByTestId(pantryTestIDs.emptyState)).toBeTruthy();
  });

  it('says a search found nothing rather than waiting on rows', () => {
    const { update } = renderContent({ locationCounts: { all: 1 } }, MILK);

    update({ loading: true, items: [], searchQuery: 'zzz' });

    expect(skeletonShown()).toBe(false);
    expect(screen.getByTestId(pantryTestIDs.emptyState)).toBeTruthy();
  });

  it('waits on skeletons until a server search answers', () => {
    const { update } = renderContent({ locationCounts: { all: 1 } }, MILK);

    update({ searching: true, items: [], searchQuery: 'mil' });

    expect(skeletonShown()).toBe(true);
    expect(screen.queryByTestId(pantryTestIDs.emptyState)).toBeNull();
  });
});

describe('the order of the rows', () => {
  const unsorted: PantryItemFixture[] = [
    { id: 'i1', itemName: 'Rice' },
    { id: 'i2', itemName: 'Beans' },
    { id: 'i3', itemName: 'Apples' },
  ];
  const byName = {
    initialSortOption: PantrySortOption.NAME,
    initialSortDirection: PantrySortDirection.ASC,
  };

  it('sorts the loaded rows itself', () => {
    renderContent(byName, unsorted);

    expect(shownNames()).toEqual(['Apples', 'Beans', 'Rice']);
  });

  it("keeps the server's order when the server sorts", () => {
    renderContent({ ...byName, useServerSort: true }, unsorted);

    expect(shownNames()).toEqual(['Rice', 'Beans', 'Apples']);
  });

  it('names the sort on the sort button', () => {
    renderContent(byName, unsorted);

    expect(
      screen.getByLabelText(
        t('pantryScreen.sortedBy', {
          field: t(sortOptionLabelKey(PantrySortOption.NAME)),
        }),
      ),
    ).toBeTruthy();
  });
});

// A server-mode switch refetches: the old tab's rows must not pose as the new.
describe('switching what the list shows', () => {
  const counts = { all: 1, fridge: 0, freezer: 0, pantry: 0 };

  it('covers the stale rows while the new tab is fetched, then lifts for good', () => {
    const { update } = renderContent(
      { serverMode: true, locationCounts: counts },
      MILK,
    );

    fireEvent.press(tab('fridge'));
    update({ locationFilter: 'fridge', fetching: true });
    expect(shownNames()).toEqual([]);
    expect(skeletonShown()).toBe(true);

    update({ locationFilter: 'fridge', fetching: false });
    expect(shownNames()).toEqual(['Milk']);

    update({ locationFilter: 'fridge', fetching: true });
    expect(shownNames()).toEqual(['Milk']);
  });

  it('covers the stale order while a new sort is fetched, then lifts', () => {
    const { update } = renderContent(
      { serverMode: true, useServerSort: true, locationCounts: counts },
      MILK,
    );

    fireEvent.press(screen.getByTestId(pantryTestIDs.sortButton));
    fireEvent.press(
      screen.getByTestId(pantryTestIDs.sortOption(PantrySortOption.EXPIRY)),
    );
    update({ fetching: true });
    expect(skeletonShown()).toBe(true);

    update({ fetching: false });
    expect(shownNames()).toEqual(['Milk']);
  });

  // A latch armed in server mode, with the fetch never started, must not blank
  // the rows at the next background fetch once the pantry reads client-side.
  it('drops a pending switch when the list stops fetching per tab', () => {
    const { update } = renderContent(
      { serverMode: true, locationCounts: counts },
      MILK,
    );

    fireEvent.press(tab('fridge'));
    update({ serverMode: false });
    update({ serverMode: false, fetching: true });

    expect(shownNames()).toEqual(['Milk']);
  });
});

// Each write behind a sheet would re-render every mounted row unseen.
describe('rows behind a sheet', () => {
  const twoRows: PantryItemFixture[] = [
    { id: 'i1', itemName: 'Milk' },
    { id: 'i2', itemName: 'Rice' },
  ];

  it('hold still while a sheet covers them, and catch up once it closes', () => {
    const { items, update } = renderContent({}, twoRows);
    const [milk] = items;
    if (!milk) throw new Error('no first row');

    update({ items }, true);
    update({ items: [milk] }, true);
    expect(shownNames()).toEqual(['Milk', 'Rice']);

    update({ items: [milk] }, false);
    expect(shownNames()).toEqual(['Milk']);

    update({ items: [milk] }, true);
    expect(shownNames()).toEqual(['Milk']);
  });
});

describe('the chrome', () => {
  it("opens Select pantry from the pantry's name", () => {
    const onSettingsPress = jest.fn();
    renderContent({ onSettingsPress }, MILK);

    fireEvent.press(screen.getByTestId(pantryTestIDs.selectPantryButton));

    expect(onSettingsPress).toHaveBeenCalledTimes(1);
  });

  it("shows each tab's count", () => {
    renderContent({ locationCounts: { all: 3, fridge: 2 } }, MILK);

    expect(screen.getByText('3')).toBeTruthy();
  });

  // A failed read holds no rows: its zeros are unknown, not counts.
  it('counts nothing on the tabs when the read failed', () => {
    renderContent({
      locationCounts: { all: 3, fridge: 2 },
      itemsFailure: { state: 'error', onRetry: jest.fn() },
    });

    expect(screen.queryByText('3')).toBeNull();
  });

  it('offers adding a location as the last tab', () => {
    const onAddLocation = jest.fn();
    renderContent({ onAddLocation }, MILK);

    fireEvent.press(tab('__add__'));

    expect(onAddLocation).toHaveBeenCalledTimes(1);
  });

  it('refreshes on a pull', () => {
    const onRefresh = jest.fn();
    renderContent({ onRefresh }, MILK);

    // Jest cannot pull: the gesture's outcome is the control's `onRefresh`.
    act(() => {
      screen
        .getByTestId(pantryTestIDs.list)
        .props.refreshControl.props.onRefresh();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('a partial list offline', () => {
  it('says a narrowed tab may miss rows the device never loaded', () => {
    renderContent(
      { mayHoldMore: true, onRefresh: jest.fn(), locationFilter: 'fridge' },
      MILK,
    );

    expect(screen.getByTestId(pantryTestIDs.listPartial)).toBeTruthy();
  });

  it('says nothing on the whole pantry, whose rows are all it claims', () => {
    renderContent({ mayHoldMore: true, onRefresh: jest.fn() }, MILK);

    expect(screen.queryByTestId(pantryTestIDs.listPartial)).toBeNull();
  });
});

describe('the rows', () => {
  it('asks for the next page at the end of the list', () => {
    const onEndReached = jest.fn();
    renderContent({ onEndReached }, MILK);

    fireEvent(screen.getByTestId(pantryTestIDs.list), 'endReached');

    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  it('deletes a row once it has slid away', async () => {
    const deleted = new Promise<string>(resolve => {
      renderContent({ onItemDelete: resolve }, MILK);
    });
    let node = screen.getByText('Milk').parent;
    while (node && !node.props.accessibilityActions) node = node.parent;
    if (!node) throw new Error('the row offers no actions');

    fireEvent(node, 'accessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });

    expect(await deleted).toBe('i1');
  });
});
