import React from 'react';
import type { DocumentNode } from 'graphql';
import type { ApolloClient } from '@apollo/client';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  type MockDataFor,
  recordMock,
  renderWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { pantryData } from '#/test-utils/fixtures/pantryFixtures';
import { t } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';
import {
  ErrorCode,
  PantrySuggestionSource,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import {
  AutocompleteItemsDocument,
  MarkSuggestionDismissedDocument,
} from '#operations/item/item.generated';
import {
  CreatePantryItemDocument,
  GetPantryDocument,
  GetPantryItemSuggestionsDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { AddToPantrySheet } from '../AddToPantrySheet';

type Props = React.ComponentProps<typeof AddToPantrySheet>;
type Sections = NonNullable<
  NonNullable<
    MockDataFor<typeof GetPantryItemSuggestionsDocument>['pantry']
  >['suggestions']
>;
type SuggestionRow = NonNullable<Sections['popular']>[number];
type Found = NonNullable<
  NonNullable<
    MockDataFor<typeof AutocompleteItemsDocument>['autocompleteItems']
  >['suggestions']
>[number];

const PANTRY_ID = 'pantry-1';
const PREFIX = pantryTestIDs.addItemSheetPrefix;
const PANTRY_READ = {
  id: PANTRY_ID,
  itemsFirst: 50,
  storageLocationsFirst: 20,
  today: todayKey(),
};

/** A row the pantry suggests; `pantryItemId` is the stack a row names. */
const suggestion = (
  source: PantrySuggestionSource,
  itemId: string,
  name: string,
  over: Partial<SuggestionRow> = {},
): SuggestionRow => ({
  __typename: 'PantryItemSuggestion',
  id: `${source}-${itemId}`,
  itemId,
  name,
  source,
  category: null,
  imageUrl: null,
  defaultUnitId: null,
  pantryItemId: null,
  ...over,
});
const popular = (itemId: string, name = itemId) =>
  suggestion(PantrySuggestionSource.Popular, itemId, name);

/** A catalog item the search finds, created in `unitId` by a one-tap add. */
const found = (id: string, name: string, unitId: string | null): Found => ({
  __typename: 'ItemSuggestion',
  id,
  name,
  imageUrl: null,
  brands: [],
  defaultUnit: unitId ? { __typename: 'ItemUnitSuggestion', id: unitId } : null,
});

/** One stack of milk, counted in pieces of `unitType`, and a freezer. */
function stockedPantry(unitType = UnitType.Count, totalItems?: number) {
  const cache = makeCache();
  const data = pantryData({
    id: PANTRY_ID,
    items: [{ id: 'pi-1', itemName: 'Milk', quantity: 3 }],
    storageLocations: [{ id: 'loc-1', name: 'Chest freezer' }],
    totalItems,
  });
  for (const edge of data.pantry!.itemsConnection.edges) {
    edge.node.unit = { ...edge.node.unit, type: unitType };
  }
  seedQuery(cache, { query: GetPantryDocument, variables: PANTRY_READ, data });
  return cache;
}
const STOCKED_ITEM = 'item-pi-1';
const STOCKED_UNIT = 'unit-piece';

const pantryRead = (cache: ReturnType<typeof makeCache>) =>
  cache.readQuery({
    query: GetPantryDocument,
    variables: PANTRY_READ,
    optimistic: true,
  })?.pantry;

const created = (
  over: { match?: (vars: unknown) => boolean; held?: boolean } = {},
) =>
  recordMock(CreatePantryItemDocument, {
    data: {
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: { id: 'pi-new' },
      },
    },
    ...over,
  });

const forbidden = {
  __typename: 'ForbiddenError',
  code: ErrorCode.Forbidden,
  message: 'No add-items access',
} as const;

const restocked = (pantryItemId: string, over: { held?: boolean } = {}) =>
  recordMock(RestockPantryItemDocument, {
    data: {
      restockPantryItem: {
        __typename: 'RestockPantryItemPayload',
        pantryItemUsage: { id: 'usage-1', pantryItem: { id: pantryItemId } },
      },
    },
    ...over,
  });

const refusedRestock = () =>
  recordMock(RestockPantryItemDocument, {
    data: { restockPantryItem: forbidden },
  });

let log = operationLog();

const answered = (document: DocumentNode, nth = 1) =>
  act(async () => {
    await log.answered(document, nth);
  });

// Fresh per test: a write still on its way when a test ends calls the
// callbacks it was rendered with.
let onClose = jest.fn();
let onItemAdded = jest.fn();

interface Setup {
  props?: Partial<Props>;
  sections?: Partial<Sections>;
  answers?: ReturnType<typeof recordMock>[];
  cache?: ReturnType<typeof makeCache>;
  searchFinds?: Found[];
}

/** The sheet as the pantry opens it, with its suggestions in. */
async function openSheet({
  props = {},
  sections = {},
  answers = [],
  cache = makeCache(),
  searchFinds = [],
}: Setup = {}) {
  const suggestions = recordMock(GetPantryItemSuggestionsDocument, {
    data: {
      pantry: {
        __typename: 'Pantry',
        id: PANTRY_ID,
        suggestions: {
          __typename: 'PantrySuggestions',
          lowStock: [],
          expiringSoon: [],
          recentlyDeleted: [],
          frequentlyAdded: [],
          popular: [],
          ...sections,
        },
      },
    },
  });
  const view = renderWithApollo(
    <AddToPantrySheet
      visible
      pantryId={PANTRY_ID}
      onClose={onClose}
      onItemAdded={onItemAdded}
      {...props}
    />,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        suggestions.mock,
        recordMock(AutocompleteItemsDocument, {
          data: { autocompleteItems: { suggestions: searchFinds } },
        }).mock,
      ],
    },
  );
  await log.requested(GetPantryItemSuggestionsDocument);
  await answered(GetPantryItemSuggestionsDocument);
  return { ...view, cache, suggestions };
}

const SUGGESTIONS_READ = {
  pantryId: PANTRY_ID,
  limit: 20,
  today: todayKey(),
};

/** The item ids the pantry suggests, every section in order. */
const listed = (
  data: MockDataFor<typeof GetPantryItemSuggestionsDocument> | null | undefined,
) => {
  const sections = data?.pantry?.suggestions;
  return [
    ...(sections?.lowStock ?? []),
    ...(sections?.expiringSoon ?? []),
    ...(sections?.recentlyDeleted ?? []),
    ...(sections?.frequentlyAdded ?? []),
    ...(sections?.popular ?? []),
  ].map(row => row?.itemId);
};

/** What the cache suggests now, as the sheet will show it. */
const suggested = (cache: ReturnType<typeof makeCache>) =>
  listed(
    cache.readQuery({
      query: GetPantryItemSuggestionsDocument,
      variables: SUGGESTIONS_READ,
      optimistic: true,
    }),
  );

/**
 * Resolves once the sheet's suggestions hold `itemId` again. A cache write
 * reaches a watching query a task later (`scheduleNotify`), and the sheet's
 * watcher, older than this one, is told first.
 */
async function suggestedAgain(client: ApolloClient, itemId: string) {
  const watch = client.watchQuery({
    query: GetPantryItemSuggestionsDocument,
    variables: SUGGESTIONS_READ,
    fetchPolicy: 'cache-only',
  });
  let subscription: { unsubscribe: () => void } | undefined;
  await new Promise<void>(resolve => {
    subscription = watch.subscribe(({ data }) => {
      if (listed(data).includes(itemId)) resolve();
    });
  });
  subscription?.unsubscribe();
}

/**
 * Resolves once the pantry, as its screen watches it, counts `total`. A
 * confirmed write's layer is rebuilt after a short window, not on its answer.
 */
async function pantryCounts(client: ApolloClient, total: number) {
  const watch = client.watchQuery({
    query: GetPantryDocument,
    variables: PANTRY_READ,
    fetchPolicy: 'cache-only',
  });
  let subscription: { unsubscribe: () => void } | undefined;
  await new Promise<void>(resolve => {
    subscription = watch.subscribe(({ data }) => {
      if (data?.pantry?.stats?.totalItems === total) resolve();
    });
  });
  subscription?.unsubscribe();
}

/** Lets a refused write's answer land, and its suggestion come back. */
const refusedBack = (
  client: ApolloClient,
  document: DocumentNode,
  itemId: string,
) =>
  act(async () => {
    const back = suggestedAgain(client, itemId);
    await log.answered(document);
    await back;
  });

/** A suggestion's add control, as a screen reader offers it. */
const tile = (name: string) =>
  screen.getAllByLabelText(t('labels.addNamed', { name }))[0]!;
const shown = (name: string) =>
  screen.queryAllByLabelText(t('labels.addNamed', { name })).length > 0;

let searches = 0;

/** Types a search and lets its answer render. */
async function search(text: string) {
  searches += 1;
  fireEvent.changeText(
    screen.getByTestId(catalogTestIDs.addItemSheetSearchInput(PREFIX)),
    text,
  );
  await log.requested(AutocompleteItemsDocument, searches);
  await answered(AutocompleteItemsDocument, searches);
}
const result = (name: string) =>
  screen.getByLabelText(t('a11y.quickAdd', { name }));

beforeEach(() => {
  jest.clearAllMocks();
  onClose = jest.fn();
  onItemAdded = jest.fn();
  log = operationLog();
  searches = 0;
});

describe('opening', () => {
  it('lists what the pantry suggests', async () => {
    await openSheet({ sections: { popular: [popular('item-b', 'Bread')] } });

    expect(screen.getByText(t('addItemSheet.addToPantry'))).toBeTruthy();
    expect(shown('Bread')).toBe(true);
  });

  it('opens on the details form when asked to', async () => {
    await openSheet({ props: { startStep: 'details' } });

    expect(screen.getByTestId(pantryTestIDs.addDetailsNameInput)).toBeTruthy();
  });

  it('searches for what it was opened with', async () => {
    await openSheet({
      props: { initialSearchQuery: 'Oats' },
      searchFinds: [found('item-oats', 'Oats', null)],
    });
    searches += 1;
    await log.requested(AutocompleteItemsDocument);
    await answered(AutocompleteItemsDocument);

    expect(result('Oats')).toBeTruthy();
  });
});

describe('a suggestion', () => {
  it('leaves the list at once and is added, with a toast', async () => {
    const create = created();
    const { cache } = await openSheet({
      sections: { popular: [popular('item-b', 'Bread')] },
      answers: [create],
    });

    fireEvent.press(tile('Bread'));

    expect(suggested(cache)).toEqual([]);
    expect(toastService.success).toHaveBeenCalledWith(
      t('addItemSheet.added', { name: 'Bread' }),
    );
    await log.requested(CreatePantryItemDocument);
    expect(create.fired[0]).toMatchObject({
      input: { item: { id: 'item-b' } },
    });
    await answered(CreatePantryItemDocument);
    expect(onItemAdded).toHaveBeenCalledTimes(1);
  });

  it('sends one add for a double tap', async () => {
    const create = created();
    await openSheet({
      sections: { popular: [popular('item-b', 'Bread')] },
      answers: [create],
    });
    const bread = tile('Bread');

    fireEvent.press(bread);
    fireEvent.press(bread);
    await answered(CreatePantryItemDocument);

    expect(create.fired).toHaveLength(1);
  });

  it('puts back only a refused one, at its old place, and says so', async () => {
    const names = (itemId: string) => (vars: unknown) =>
      JSON.stringify(vars).includes(`"${itemId}"`);
    const refused = recordMock(CreatePantryItemDocument, {
      data: { createPantryItem: forbidden },
      match: names('apples'),
    });
    const accepted = created({ match: names('bread') });
    const { cache } = await openSheet({
      sections: {
        popular: [popular('apples'), popular('bread'), popular('cheese')],
      },
      answers: [refused, accepted],
    });

    fireEvent.press(tile('apples'));
    fireEvent.press(tile('bread'));
    await answered(CreatePantryItemDocument, 2);

    expect(suggested(cache)).toEqual(['apples', 'cheese']);
    expect(toastService.error).toHaveBeenCalledWith(t('errors.addItemFailed'));
    expect(onItemAdded).toHaveBeenCalledTimes(1);
  });

  it('restocks a stack the pantry holds instead of adding a second', async () => {
    const create = created();
    const restock = restocked('pi-1');
    await openSheet({
      cache: stockedPantry(),
      sections: {
        popular: [
          suggestion(PantrySuggestionSource.Popular, STOCKED_ITEM, 'Milk', {
            defaultUnitId: STOCKED_UNIT,
          }),
        ],
      },
      answers: [create, restock],
    });

    fireEvent.press(tile('Milk'));
    await log.requested(RestockPantryItemDocument);
    await answered(RestockPantryItemDocument);

    expect(restock.fired[0]).toMatchObject({ input: { id: 'pi-1' } });
    expect(create.fired).toEqual([]);
    expect(toastService.success).toHaveBeenCalledTimes(1);
    expect(toastService.success).toHaveBeenCalledWith(
      t('addToPantry.restocked', { name: 'Milk' }),
    );
    expect(onItemAdded).toHaveBeenCalledTimes(1);
  });

  it('dismisses with its ✕', async () => {
    const { cache } = await openSheet({
      sections: { popular: [popular('item-b', 'Bread')] },
      answers: [
        recordMock(MarkSuggestionDismissedDocument, {
          data: {
            markSuggestionDismissed: {
              __typename: 'MarkSuggestionDismissedPayload',
              itemId: 'item-b',
              dismissed: true,
            },
          },
        }),
      ],
    });

    fireEvent.press(
      screen.getByLabelText(t('labels.dismissNamed', { name: 'Bread' })),
    );
    await log.requested(MarkSuggestionDismissedDocument);
    await answered(MarkSuggestionDismissedDocument);

    expect(suggested(cache)).toEqual([]);
  });
});

describe('a row that names its stack', () => {
  it.each([
    PantrySuggestionSource.LowStock,
    PantrySuggestionSource.ExpiringSoon,
  ])(
    'restocks that stack by one package, even past the loaded window (%s)',
    async source => {
      const create = created();
      const restock = restocked('pi-held');
      const section =
        source === PantrySuggestionSource.LowStock
          ? 'lowStock'
          : 'expiringSoon';
      await openSheet({
        sections: {
          [section]: [
            suggestion(source, 'item-m', 'Milk', { pantryItemId: 'pi-held' }),
          ],
        },
        answers: [create, restock],
      });

      fireEvent.press(tile('Milk'));
      await log.requested(RestockPantryItemDocument);
      await answered(RestockPantryItemDocument);

      expect(restock.fired[0]).toMatchObject({
        input: { id: 'pi-held', amount: { packages: { count: 1 } } },
      });
      expect(create.fired).toEqual([]);
    },
  );

  it('adds an Add Again row, never restocking the removed stack it names', async () => {
    const create = created();
    const restock = restocked('pi-old');
    await openSheet({
      sections: {
        recentlyDeleted: [
          suggestion(PantrySuggestionSource.RecentlyDeleted, 'item-m', 'Milk', {
            pantryItemId: 'pi-old',
          }),
        ],
      },
      answers: [create, restock],
    });

    fireEvent.press(tile('Milk'));
    await log.requested(CreatePantryItemDocument);
    await answered(CreatePantryItemDocument);

    expect(restock.fired).toEqual([]);
  });

  describe('when the server cannot size the package', () => {
    const unsized = () =>
      recordMock(RestockPantryItemDocument, {
        data: {
          restockPantryItem: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'state how much one package holds',
            field: 'amount.packages.size',
          },
        },
      });
    const expiring = {
      expiringSoon: [
        suggestion(PantrySuggestionSource.ExpiringSoon, 'item-m', 'Milk', {
          pantryItemId: 'pi-held',
        }),
      ],
    };

    it('asks for the amount on the restock form, with no toast', async () => {
      const onRestockNeedsAmount = jest.fn(() => true);
      await openSheet({
        props: { onRestockNeedsAmount },
        sections: expiring,
        answers: [unsized()],
      });

      fireEvent.press(tile('Milk'));
      await log.requested(RestockPantryItemDocument);
      await answered(RestockPantryItemDocument);

      expect(onRestockNeedsAmount).toHaveBeenCalledWith(
        'pi-held',
        t('errors.field.amountPackagesSize'),
      );
      expect(toastService.success).not.toHaveBeenCalled();
      expect(toastService.error).not.toHaveBeenCalled();
      expect(onItemAdded).not.toHaveBeenCalled();
    });

    it('says why, and puts the row back, when no form can ask', async () => {
      const { client } = await openSheet({
        props: { onRestockNeedsAmount: () => false },
        sections: expiring,
        answers: [unsized()],
      });

      fireEvent.press(tile('Milk'));
      await log.requested(RestockPantryItemDocument);
      await refusedBack(client, RestockPantryItemDocument, 'item-m');

      expect(toastService.error).toHaveBeenCalledWith(
        t('errors.field.amountPackagesSize'),
      );
      expect(shown('Milk')).toBe(true);
    });
  });

  it('can be tapped again once its restock is refused', async () => {
    const restock = refusedRestock();
    const { client } = await openSheet({
      sections: {
        lowStock: [
          suggestion(PantrySuggestionSource.LowStock, 'item-m', 'Milk', {
            pantryItemId: 'pi-held',
          }),
        ],
      },
      answers: [restock],
    });
    fireEvent.press(tile('Milk'));
    await log.requested(RestockPantryItemDocument);
    await refusedBack(client, RestockPantryItemDocument, 'item-m');
    expect(toastService.error).toHaveBeenCalledWith(
      t('addToPantry.restockFailed'),
    );

    fireEvent.press(tile('Milk'));
    await log.requested(RestockPantryItemDocument, 2);
    await answered(RestockPantryItemDocument, 2);

    expect(restock.fired).toHaveLength(2);
  });
});

describe('a search result', () => {
  it('is added, with a toast', async () => {
    const create = created();
    await openSheet({
      answers: [create],
      searchFinds: [found('item-e', 'Eggs', null)],
    });
    await search('Eg');

    fireEvent.press(result('Eggs'));

    expect(toastService.success).toHaveBeenCalledWith(
      t('addItemSheet.added', { name: 'Eggs' }),
    );
    await log.requested(CreatePantryItemDocument);
    await answered(CreatePantryItemDocument);
    expect(onItemAdded).toHaveBeenCalledTimes(1);
  });

  it('is added once while its first add is on its way', async () => {
    const create = created({ held: true });
    await openSheet({
      answers: [create],
      searchFinds: [found('item-e', 'Eggs', null)],
    });
    await search('Eg');
    fireEvent.press(result('Eggs'));
    await log.requested(CreatePantryItemDocument);

    await search('Egg');
    fireEvent.press(result('Eggs'));

    expect(toastService.success).toHaveBeenCalledTimes(1);
    expect(create.fired).toHaveLength(1);
  });

  it('restocks a stack the pantry holds in the unit it would be added in', async () => {
    const create = created();
    const restock = restocked('pi-1');
    await openSheet({
      cache: stockedPantry(),
      answers: [create, restock],
      searchFinds: [found(STOCKED_ITEM, 'Milk', STOCKED_UNIT)],
    });
    await search('Mi');

    fireEvent.press(result('Milk'));
    await log.requested(RestockPantryItemDocument);
    await answered(RestockPantryItemDocument);

    expect(restock.fired[0]).toMatchObject({ input: { id: 'pi-1' } });
    expect(create.fired).toEqual([]);
  });

  it('restocks a stack held by volume by one package, never by one litre', async () => {
    const restock = restocked('pi-1', { held: true });
    const { cache } = await openSheet({
      cache: stockedPantry(UnitType.Volume),
      answers: [restock],
      searchFinds: [found(STOCKED_ITEM, 'Milk', STOCKED_UNIT)],
    });
    await search('Mi');

    fireEvent.press(result('Milk'));
    await log.requested(RestockPantryItemDocument);

    expect(restock.fired[0]).toMatchObject({
      input: { id: 'pi-1', amount: { packages: { count: 1 } } },
    });
    expect(pantryRead(cache)?.itemsConnection.edges[0]?.node.quantity).toBe(3);
  });

  it.each([
    ['held in another unit', 'unit-ml'],
    ['whose unit it cannot know', null],
  ])('leaves an item %s to the server', async (_case, unitId) => {
    const create = created();
    await openSheet({
      cache: stockedPantry(),
      answers: [create, restocked('pi-1')],
      searchFinds: [found(STOCKED_ITEM, 'Milk', unitId)],
    });
    await search('Mi');

    fireEvent.press(result('Milk'));
    await log.requested(CreatePantryItemDocument);
    await answered(CreatePantryItemDocument);

    expect(create.fired).toHaveLength(1);
  });

  it('puts back the suggestion a refused add took, and says so', async () => {
    const refused = recordMock(CreatePantryItemDocument, {
      data: { createPantryItem: forbidden },
    });
    const { client } = await openSheet({
      sections: { popular: [popular('item-m', 'Milk')] },
      answers: [refused],
      searchFinds: [found('item-m', 'Milk', null)],
    });
    await search('Mi');

    fireEvent.press(result('Milk'));
    await log.requested(CreatePantryItemDocument);
    await refusedBack(client, CreatePantryItemDocument, 'item-m');

    expect(shown('Milk')).toBe(true);
    expect(toastService.error).toHaveBeenCalledWith(
      t('errors.addItemFailedRetry'),
    );
    expect(onItemAdded).not.toHaveBeenCalled();
  });

  // The add is forced, so the server joins a held product to its stack and
  // answers with that stack's id: the header count must not stay one up.
  it('leaves the pantry count where it was when the server joins it to a stack', async () => {
    const joined = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: { id: 'pi-1', version: 1 },
          pantry: {
            __typename: 'Pantry',
            id: PANTRY_ID,
            version: 1,
            stats: { totalItems: 70 },
          },
        },
      },
      held: true,
    });
    const { cache, client } = await openSheet({
      cache: stockedPantry(UnitType.Count, 70),
      answers: [joined],
      searchFinds: [found(STOCKED_ITEM, 'Milk', null)],
    });
    await search('Mi');

    fireEvent.press(result('Milk'));
    await log.requested(CreatePantryItemDocument);
    expect(pantryRead(cache)?.stats.totalItems).toBe(71);
    await act(async () => {
      const settled = pantryCounts(client, 70);
      joined.release();
      await log.answered(CreatePantryItemDocument);
      await settled;
    });

    expect(pantryRead(cache)?.stats.totalItems).toBe(70);
    expect(pantryRead(cache)?.itemsConnection.totalCount).toBe(70);
  });
});

describe('adding by hand', () => {
  it('carries the search into the form, with the pantry’s locations', async () => {
    await openSheet({
      cache: stockedPantry(),
      searchFinds: [found('item-om', 'Oat milk', null)],
    });
    await search('Oats');

    fireEvent.press(
      screen.getByTestId(catalogTestIDs.addManuallyButton(PREFIX)),
    );

    expect(
      screen.getByTestId(pantryTestIDs.addDetailsNameInput),
    ).toHaveDisplayValue('Oats');
    fireEvent.press(screen.getByRole('tab', { name: t('labels.storage') }));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('addToPantry.storageLocationPlaceholder')),
      'Che',
    );
    expect(screen.getByText('Chest freezer')).toBeTruthy();
  });

  it('closes, says so and refreshes the suggestions once the form adds', async () => {
    const create = created();
    const { suggestions } = await openSheet({
      props: { startStep: 'details' },
      answers: [create],
    });
    const user = userEvent.setup();
    await user.type(
      screen.getByTestId(pantryTestIDs.addDetailsNameInput),
      'Oats',
    );

    await user.press(screen.getByTestId(pantryTestIDs.addDetailsSubmitButton));
    await log.requested(CreatePantryItemDocument);
    await answered(CreatePantryItemDocument);

    expect(toastService.success).toHaveBeenCalledWith(
      t('addToPantry.itemAdded'),
    );
    expect(onItemAdded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(suggestions.fired).toHaveLength(2);
  });
});
