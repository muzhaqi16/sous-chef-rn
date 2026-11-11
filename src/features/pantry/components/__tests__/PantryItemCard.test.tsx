'use no memo';
import React from 'react';
import { makeCache } from '#/apollo/cache';
import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  renderWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import { PantryItemCard } from '../PantryItemCard';
import { StatusLine } from '#components/atoms/StatusLine';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { gql, type ApolloClient } from '@apollo/client';
import { t } from '#/i18n';
import {
  PantryItemCard_PantryItemFragmentDoc,
  type PantryItemCard_PantryItemFragment,
} from '../PantryItemCard.generated';
import {
  PantryActionsProvider,
  type PantryItemActions,
} from '../PantryActionsContext';
import {
  EntryImageSource,
  StorageState,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { toDateKey } from '#/utils/dateUtils';
import { changeLanguage } from '#/i18n';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';

// Its midnight timer re-arms itself, so a mounted watch never drains.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));

const defaultActions = {
  onItemPress: jest.fn(),
  onItemEdit: jest.fn(),
};

/** What holds the row's accessibility actions, which a swipe offers too. */
const actionsHostOf = () => {
  let node = screen.getByText('Milk').parent;
  while (node && !node.props.accessibilityActions) node = node.parent;
  return node;
};
const actionsHost = () => {
  const host = actionsHostOf();
  if (!host) throw new Error('the row offers no actions');
  return host;
};
const rowActions = (): string[] =>
  (actionsHostOf()?.props.accessibilityActions ?? []).map(
    (action: { name: string }) => action.name,
  );

/** Less of a row than the card reads. */
const PantryItem_PartialTestFragmentDoc = gql`
  fragment PantryItemCardTestPartial on PantryItem {
    id
    itemName
  }
`;

/**
 * Resolves once the cache's watchers read the user's system as `system`: a
 * cache write reaches a watching query a task later (`scheduleNotify`).
 */
async function settingsRead(client: ApolloClient, system: UnitSystem) {
  const watch = client.watchQuery({
    query: GetUserSettingsDocument,
    fetchPolicy: 'cache-only',
  });
  let subscription: { unsubscribe: () => void } | undefined;
  await new Promise<void>(resolve => {
    subscription = watch.subscribe(({ data }) => {
      if (data?.me?.settings?.preferredUnitSystem === system) resolve();
    });
  });
  subscription?.unsubscribe();
}

interface BuildItemOverrides {
  id?: string;
  itemName?: string;
  quantity?: number;
  heldQuantity?: number;
  isLowStock?: boolean;
  /** The server's display amount; the held amount in the tracking unit if absent. */
  shown?: { quantity: number; symbol: string };
  unitSymbol?: string;
  storageLocationName?: string | null;
  expiresOn?: string | null;
  imageUrl?: string | null;
  image?: PantryItemCard_PantryItemFragment['image'];
  packageBreakdown?: {
    count: number;
    contentUnit: { id: string; name: string; symbol: string };
    perUnitNetWeight?: number | null;
    perUnitNetWeightUnit?: { id: string; name: string; symbol: string } | null;
    totalNetWeight?: number | null;
  } | null;
  quantityBreakdown?: {
    fullPackages: number;
    looseContentUnits: number;
    contentUnit: { id: string; name: string; symbol: string } | null;
    totalContentUnits: number;
    remainingWeight: number | null;
    remainingWeightUnit: { id: string; name: string; symbol: string } | null;
  } | null;
  activeBatchCount?: number;
  remainingPortions?: number | null;
  portionUnit?: { id: string; name: string; symbol: string } | null;
  /** The server's readings; the shown amount in both systems unless stated. */
  amountLeft?: PantryItemCard_PantryItemFragment['amountLeft'];
}

const unitRead = (id: string, symbol: string) =>
  readingAsAbbreviation({
    unitId: id,
    symbol,
    displayAsFraction: false,
    type: UnitType.Weight,
  });

/** A count that reads the same in both systems. */
function readsAs(
  value: number,
  symbol: string,
): PantryItemCard_PantryItemFragment['amountLeft'] {
  const reading = {
    __typename: 'MeasureReading',
    value,
    ...unitRead(`unit-${symbol}`, symbol),
    type: UnitType.Count,
  } as const;
  return {
    __typename: 'Measure',
    value,
    unitId: reading.unitId,
    metric: reading,
    imperial: reading,
  };
}

function buildItem(
  overrides: BuildItemOverrides = {},
): PantryItemCard_PantryItemFragment {
  return {
    __typename: 'PantryItem',
    id: overrides.id ?? 'pantry-1',
    image: overrides.image ?? null,
    itemName: overrides.itemName ?? 'Milk',
    quantity: overrides.quantity ?? 2,
    heldQuantity: overrides.heldQuantity ?? overrides.quantity ?? 2,
    isLowStock: overrides.isLowStock ?? false,
    displayAmount: {
      __typename: 'DisplayAmount',
      quantity:
        overrides.shown?.quantity ??
        overrides.heldQuantity ??
        overrides.quantity ??
        2,
      localizedSymbol: overrides.shown?.symbol ?? overrides.unitSymbol ?? 'gal',
      fraction: null,
      unit: asAbbreviation({
        __typename: 'Unit',
        id: overrides.shown ? 'unit-shown' : 'unit-1',
        symbol: overrides.shown?.symbol ?? overrides.unitSymbol ?? 'gal',
      }),
    },
    amountLeft:
      overrides.amountLeft ??
      readsAs(
        overrides.shown?.quantity ??
          overrides.heldQuantity ??
          overrides.quantity ??
          2,
        overrides.shown?.symbol ?? overrides.unitSymbol ?? 'gal',
      ),
    portionUnitId: overrides.portionUnit?.id ?? null,
    portionUnit: overrides.portionUnit
      ? asAbbreviation({ __typename: 'Unit', ...overrides.portionUnit })
      : null,
    remainingPortions: overrides.remainingPortions ?? null,
    expiresOn: overrides.expiresOn ?? null,
    storageState: StorageState.Refrigerated,
    lastUsedAt: null,
    netWeight: null,
    remainingNetWeight: null,
    activeBatchCount: overrides.activeBatchCount ?? 1,
    updatedAt: '2025-01-01',
    item: {
      __typename: 'Item',
      id: `item-${overrides.id ?? 'pantry-1'}`,
      imageUrl: overrides.imageUrl ?? null,
      images: [] as PantryItemCard_PantryItemFragment['item']['images'],
    },
    unit: asAbbreviation({
      __typename: 'Unit',
      id: 'unit-1',
      symbol: overrides.unitSymbol ?? 'gal',
    }),
    netWeightUnit: null,
    storageLocation:
      overrides.storageLocationName == null
        ? null
        : {
            __typename: 'StorageLocation',
            id: 'loc-1',
            name: overrides.storageLocationName,
          },
    packageBreakdown: overrides.packageBreakdown
      ? {
          __typename: 'PackageBreakdown',
          count: overrides.packageBreakdown.count,
          perUnitNetWeight: overrides.packageBreakdown.perUnitNetWeight ?? null,
          totalNetWeight: overrides.packageBreakdown.totalNetWeight ?? null,
          contentUnit: asAbbreviation({
            __typename: 'Unit',
            ...overrides.packageBreakdown.contentUnit,
          }),
          perUnitNetWeightUnit: overrides.packageBreakdown.perUnitNetWeightUnit
            ? asAbbreviation({
                __typename: 'Unit',
                ...overrides.packageBreakdown.perUnitNetWeightUnit,
              })
            : null,
        }
      : null,
    quantityBreakdown: overrides.quantityBreakdown
      ? {
          __typename: 'QuantityBreakdown',
          fullPackages: overrides.quantityBreakdown.fullPackages,
          looseContentUnits: overrides.quantityBreakdown.looseContentUnits,
          totalContentUnits: overrides.quantityBreakdown.totalContentUnits,
          remainingWeight: overrides.quantityBreakdown.remainingWeight,
          contentUnit: overrides.quantityBreakdown.contentUnit
            ? asAbbreviation({
                __typename: 'Unit',
                ...overrides.quantityBreakdown.contentUnit,
              })
            : null,
          remainingWeightUnit: overrides.quantityBreakdown.remainingWeightUnit
            ? asAbbreviation({
                __typename: 'Unit',
                ...overrides.quantityBreakdown.remainingWeightUnit,
              })
            : null,
        }
      : null,
  };
}

function buildCache(item: PantryItemCard_PantryItemFragment) {
  const cache = makeCache();
  seedFragment(cache, {
    id:
      cache.identify({ __typename: item.__typename, id: item.id }) ??
      `PantryItem:${item.id}`,
    fragment: PantryItemCard_PantryItemFragmentDoc,
    fragmentName: 'PantryItemCard_pantryItem',
    data: item,
  });
  return cache;
}

/** Caches the user's settings, as a signed-in session holds them. */
function renderCard(
  overrides: BuildItemOverrides = {},
  actions: PantryItemActions = defaultActions,
  settings?: { preferred: UnitSystem; device: UnitSystem },
) {
  const item = buildItem(overrides);
  const cache = buildCache(item);
  if (settings)
    writeUnitSystemSettings(cache, settings.preferred, settings.device);
  return renderWithApollo(
    <PantryActionsProvider actions={actions}>
      <PantryItemCard pantryItemId={item.id} />
    </PantryActionsProvider>,
    { cache },
  );
}

// A test that queues a write leaves none behind.
afterEach(() => {
  queueStore.clearQueueForUser('user-1');
});

describe('PantryItemCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders item name', () => {
    renderCard();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders quantity in right slot', () => {
    renderCard();
    expect(screen.getByText('2 gal')).toBeTruthy();
  });

  it('shows the stack as the server shows it: 12 pc as 1 doz', () => {
    renderCard({
      quantity: 12,
      unitSymbol: 'pc',
      shown: { quantity: 1, symbol: 'doz' },
    });
    expect(screen.getByText('1 doz')).toBeTruthy();
    expect(screen.queryByText('12 pc')).toBeNull();
  });

  it('renders custom storage location when provided', () => {
    renderCard({ storageLocationName: 'Kitchen Cabinet' });
    expect(screen.getByText('Kitchen Cabinet')).toBeTruthy();
  });

  it('shows the storage location whether or not there is an expiry', () => {
    renderCard({ storageLocationName: 'Freezer' });
    expect(screen.getByText('Freezer')).toBeTruthy();
  });

  it('keeps every slot with its own owner when several values compete', () => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 3);
    renderCard({
      expiresOn: toDateKey(expires),
      storageLocationName: 'Freezer',
      quantityBreakdown: {
        fullPackages: 2,
        looseContentUnits: 0,
        contentUnit: { id: 'gal', name: 'gallon', symbol: 'gal' },
        totalContentUnits: 2,
        remainingWeight: null,
        remainingWeightUnit: null,
      },
    });
    // The status slot takes the expiry and the location keeps its own; the
    // breakdown has no slot on the row and belongs to the detail screen. No
    // value displaces another.
    expect(screen.getAllByText(/day/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Freezer')).toBeTruthy();
    expect(screen.queryByText(/gallon/i)).toBeNull();
  });

  it('does not render default storage tab labels as location', () => {
    renderCard({ storageLocationName: null });
    expect(screen.queryByText('Fridge')).toBeNull();
    expect(screen.queryByText('Freezer')).toBeNull();
    expect(screen.queryByText('Pantry')).toBeNull();
  });

  // The image placeholder is an icon: derived by RNGH's button, its glyph
  // led the label.
  it('names the row by what it shows, in reading order', () => {
    renderCard({ quantity: 0, storageLocationName: 'Kitchen Cabinet' });
    expect(
      screen.getByLabelText('Milk, Out of stock, 0 gal, Kitchen Cabinet'),
    ).toBeTruthy();
  });

  it('renders "Out of stock" text when quantity is zero', () => {
    renderCard({ quantity: 0 });
    expect(screen.getByText('Out of stock')).toBeTruthy();
  });

  it('renders expiration text when expiresOn is set', () => {
    // Three days from "now" — getExpirationStatus returns a warning text
    const expires = new Date();
    expires.setDate(expires.getDate() + 3);
    renderCard({ expiresOn: toDateKey(expires) });
    // getExpirationStatus may emit "Expires in 3 days" or similar — assert on
    // a stable substring so the test isn't tied to copy.
    expect(screen.getAllByText(/day/i).length).toBeGreaterThan(0);
  });

  // A compiled row re-runs a label helper only when one of its arguments
  // changes, so the helper takes the row's own `t`.
  it('re-reads its expiry text when the language changes', async () => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 3);
    renderCard({ expiresOn: toDateKey(expires) });
    expect(screen.getByText('Expires in 3 days')).toBeTruthy();

    await act(() => changeLanguage('es'));
    const inSpanish = screen.queryByText('Caduca en 3 días');
    await act(() => changeLanguage('en'));

    expect(inSpanish).toBeTruthy();
  });

  it('hides expiration text for items expiring far in the future', () => {
    // Well beyond the ~10-day display window — "113 days left" is noise on the
    // list row and must not render.
    const expires = new Date();
    expires.setDate(expires.getDate() + 113);
    renderCard({ expiresOn: toDateKey(expires) });
    expect(screen.queryByText(/day/i)).toBeNull();
  });

  it('shows expiration text at the edge of the display window', () => {
    const expires = new Date();
    expires.setDate(expires.getDate() + 10);
    renderCard({ expiresOn: toDateKey(expires) });
    expect(screen.getAllByText(/day/i).length).toBeGreaterThan(0);
  });

  it('leads with the item photo', () => {
    renderCard({ imageUrl: 'https://example.com/milk.jpg' });
    expect(screen.UNSAFE_getByType(CachedImage).props.uri).toBe(
      'https://example.com/milk.jpg',
    );
  });

  // The household overrides the item photo on its own entries.
  it("shows the household's photo over the catalog's", () => {
    renderCard({
      imageUrl: 'https://example.com/catalog-milk.jpg',
      image: {
        __typename: 'EntryImage',
        url: 'https://example.com/our-milk.jpg',
        source: EntryImageSource.Household,
        catalogImageId: null,
      },
    });
    expect(screen.UNSAFE_getByType(CachedImage).props.uri).toBe(
      'https://example.com/our-milk.jpg',
    );
  });

  // Its photo or nothing: no placeholder tile, no stand-in icon.
  it('shows nothing in place of a photo it does not have', () => {
    renderCard();
    expect(screen.UNSAFE_queryByType(CachedImage)).toBeNull();
  });

  it('opens its detail on a press', () => {
    renderCard();

    fireEvent.press(screen.getByText('Milk'));

    expect(defaultActions.onItemPress).toHaveBeenCalledWith('pantry-1');
  });

  it.each([
    { offered: 'none', actions: {}, names: [] },
    {
      offered: 'every one the screen allows',
      actions: {
        onItemEdit: jest.fn(),
        onItemConsume: jest.fn(),
        onItemWaste: jest.fn(),
        onItemRestock: jest.fn(),
        onItemDelete: jest.fn(),
      },
      names: ['consume', 'waste', 'restock', 'edit', 'delete'],
    },
  ])('offers $offered of the row actions', ({ actions, names }) => {
    renderCard({}, { onItemPress: jest.fn(), ...actions });

    expect(rowActions().sort()).toEqual([...names].sort());
  });

  it('runs a row action on this stack', () => {
    const onItemRestock = jest.fn();
    renderCard({}, { onItemPress: jest.fn(), onItemRestock });

    fireEvent(actionsHost(), 'accessibilityAction', {
      nativeEvent: { actionName: 'restock' },
    });

    expect(onItemRestock).toHaveBeenCalledWith('pantry-1');
  });

  it("shows a screen's own action beside the amount", () => {
    const item = buildItem();
    renderWithApollo(
      <PantryActionsProvider actions={defaultActions}>
        <PantryItemCard
          pantryItemId={item.id}
          accessory={<Text>Add to cart</Text>}
        />
      </PantryActionsProvider>,
      { cache: buildCache(item) },
    );

    expect(screen.getByText('Add to cart')).toBeTruthy();
  });

  it('says a row with a write waiting to reach the server is syncing', () => {
    queueStore.setCurrentUserId('user-1');
    queueStore.addMutation(
      makeQueuedMutation({
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: { input: { id: 'pantry-1' } },
      }),
    );
    renderCard();

    expect(screen.getByText(t('status.syncing'))).toBeTruthy();
  });

  // A row whose fields are not all held would show what it does not have.
  it('shows nothing of a row the cache holds only part of', () => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: PantryItem_PartialTestFragmentDoc,
      data: { __typename: 'PantryItem', id: 'pantry-1', itemName: 'Milk' },
    });
    renderWithApollo(
      <PantryActionsProvider actions={defaultActions}>
        <PantryItemCard pantryItemId="pantry-1" />
      </PantryActionsProvider>,
      { cache },
    );

    expect(screen.queryByText('Milk')).toBeNull();
  });

  describe('row status', () => {
    const inDays = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return toDateKey(date);
    };
    // The status line is the row's only status signal.
    const statusTone = () => screen.UNSAFE_queryByType(StatusLine)?.props.tone;

    // The header badge counts today through seven days on; a row it counts
    // must be marked, or the badge names items the list does not show.
    it.each([
      [0, 'warning'],
      [5, 'warning'],
      [7, 'warning'],
      [8, 'neutral'],
      [-1, 'error'],
    ])('an item expiring in %s days reads in the %s tone', (days, tone) => {
      renderCard({ expiresOn: inDays(days) });
      expect(statusTone()).toBe(tone);
    });

    it('shows no status line when nothing is due and stock is fine', () => {
      renderCard({ expiresOn: inDays(30) });
      expect(statusTone()).toBeUndefined();
    });

    it('marks a low item and says so', () => {
      renderCard({ isLowStock: true });
      expect(statusTone()).toBe('info');
      expect(screen.getByText('Running low')).toBeTruthy();
    });

    it('lets expiry outrank low stock', () => {
      renderCard({ isLowStock: true, expiresOn: inDays(2) });
      expect(statusTone()).toBe('warning');
      expect(screen.queryByText('Running low')).toBeNull();
    });

    it('reads an empty stack as low stock whatever its date', () => {
      renderCard({ quantity: 0, isLowStock: true, expiresOn: inDays(-3) });
      expect(statusTone()).toBe('info');
      expect(screen.getByText('Out of stock')).toBeTruthy();
    });
  });

  // The server reads what is left in each unit system; the row shows the user's.
  describe('the held amount in the user\u2019s unit system', () => {
    const honey = {
      shown: { quantity: 1360.78, symbol: 'g' },
      amountLeft: {
        __typename: 'Measure',
        value: 1360.78,
        unitId: 'unit-shown',
        metric: {
          __typename: 'MeasureReading',
          value: 1.36,
          ...unitRead('unit-kg', 'kg'),
        },
        imperial: {
          __typename: 'MeasureReading',
          value: 3,
          ...unitRead('unit-lb', 'lb'),
        },
      },
    } satisfies BuildItemOverrides;

    it('reads it in pounds on an imperial device', () => {
      renderCard(honey, defaultActions, {
        preferred: UnitSystem.System,
        device: UnitSystem.Imperial,
      });
      expect(screen.getByText('3 lb')).toBeTruthy();
    });

    it('reads it in kilograms for a metric user', () => {
      renderCard(honey, defaultActions, {
        preferred: UnitSystem.Metric,
        device: UnitSystem.Imperial,
      });
      expect(screen.getByText('1.36 kg')).toBeTruthy();
    });

    // The settings screen writes the change to the cache at once, offline
    // too; the row follows it with nothing fetched.
    it('follows a change of setting at once, with no request', async () => {
      const item = buildItem(honey);
      const cache = buildCache(item);
      writeUnitSystemSettings(cache, UnitSystem.Imperial, UnitSystem.Imperial);
      const { client } = renderWithApollo(
        <PantryActionsProvider actions={defaultActions}>
          <PantryItemCard pantryItemId={item.id} />
        </PantryActionsProvider>,
        { cache, operationMocks: [] },
      );
      expect(screen.getByText('3 lb')).toBeTruthy();

      await act(async () => {
        const changed = settingsRead(client, UnitSystem.Metric);
        writeUnitSystemSettings(cache, UnitSystem.Metric, UnitSystem.Metric);
        await changed;
      });

      expect(screen.getByText('1.36 kg')).toBeTruthy();
    });
  });
});
