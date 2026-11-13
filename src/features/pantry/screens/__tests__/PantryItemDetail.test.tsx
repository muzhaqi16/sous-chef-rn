'use no memo';

import React from 'react';
import { GraphQLError } from 'graphql';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import type { ApolloClient, InMemoryCache } from '@apollo/client';
import {
  type MockDataFor,
  type MockFor,
  type QueryDataFor,
  recordMock,
  renderWithApollo,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { screenShows } from '#/test-utils/cacheWaits';
import { homesData } from '#/test-utils/fixtures/homeFixtures';
import {
  pantryItemData,
  type PantryItemFixture,
} from '#/test-utils/fixtures/pantryItemFixtures';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { useStore } from '#store';
import { t } from '#/i18n';
import { toDateKey, todayKey } from '#/utils/dateUtils';
import {
  BatchStatus,
  EntryImageSource,
  ErrorCode,
  ExternalSource,
  ItemCondition,
  ItemImageStatus,
  MembershipRole,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { kitTestIDs } from '#components/testIDs';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { GetHomesDocument } from '#operations/home/home.generated';
import { MyFeatureFlagsDocument } from '#operations/user/featureFlags.generated';
import { GetPantryItemBatchesDocument } from '#features/pantry/graphql/pantry.generated';
import { PantryItem_ListedFragmentDoc } from '#features/pantry/cache/pantryItemListed.generated';
import { CatalogRecipesForItemDocument } from '#features/pantry/hooks/useRecipeSuggestionsForItem.generated';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { GetPantryItemDocument } from '../usePantryItemDetailData.generated';
import { PantryItemDetail } from '../PantryItemDetail';

// The day stays fixed: the hook's midnight timer re-arms itself.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));
jest.mock('#hooks/navigation/useAppNavigation');
// Navigation is the boundary: with no navigator, the screen is focused while
// mounted.
jest.mock('@react-navigation/native', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useMountEffect(effect, [effect]),
  };
});

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

type ItemPhotoFixture = NonNullable<PantryItemFixture['photos']>[number];
type PackageSize = NonNullable<
  NonNullable<
    QueryDataFor<typeof GetPantryItemDocument>['pantryItem']
  >['packageSize']
>;

const milk: PantryItemFixture = {
  id: 'pi1',
  itemName: 'Milk',
  quantity: 2,
  storageState: 'REFRIGERATED',
  brandName: 'Organic Valley',
  categoryName: 'Dairy',
  storageNotes: 'Keep cold',
  tags: ['organic', 'dairy'],
};

const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
};

/** What the member may do in the home: an owner may do everything. */
interface Membership {
  role: MembershipRole;
  canEditPantry?: boolean;
  canAddItems?: boolean;
  canRemoveItems?: boolean;
}
const OWNER: Membership = { role: MembershipRole.Owner };
const EDITS_NOT_REMOVES: Membership = {
  role: MembershipRole.Member,
  canEditPantry: true,
  canAddItems: true,
  canRemoveItems: false,
};
const VIEWER: Membership = {
  role: MembershipRole.Member,
  canEditPantry: false,
  canAddItems: false,
  canRemoveItems: false,
};

function homesWith(
  membership: Membership,
): MockDataFor<typeof GetHomesDocument> {
  const data = homesData([{ id: 'home-1', pantries: [{ id: 'p1' }] }]);
  return {
    ...data,
    homes: {
      ...data.homes,
      edges: data.homes.edges.map(edge => ({
        ...edge,
        node: {
          ...edge.node,
          myMembership: {
            __typename: 'Membership',
            id: 'm-home-1',
            canEditPantry: true,
            canAddItems: true,
            canRemoveItems: true,
            ...membership,
          },
        },
      })),
    },
  };
}

const batchesAnswer = (
  batches: Array<{
    id: string;
    quantity: number;
    costPerUnit: number | null;
    totalCost?: number | null;
    createdAt?: string;
  }>,
): MockDataFor<typeof GetPantryItemBatchesDocument> => ({
  pantryItemBatchesConnection: {
    __typename: 'PantryItemBatchConnection',
    edges: batches.map((b, index) => ({
      __typename: 'PantryItemBatchEdge',
      node: {
        __typename: 'PantryItemBatch',
        id: b.id,
        batchNumber: index + 1,
        quantity: b.quantity,
        status: BatchStatus.Active,
        costPerUnit: b.costPerUnit,
        totalCost: b.totalCost ?? null,
        createdAt: b.createdAt ?? '2026-08-01T00:00:00Z',
        expiresOn: null,
        netWeight: null,
      },
    })),
  },
});

const noSuggestions: MockDataFor<typeof CatalogRecipesForItemDocument> = {
  catalogRecipesByIngredients: { edges: [] },
};

let log = operationLog();

interface Open {
  /** The stack the read answers with. */
  item?: PantryItemFixture;
  itemId?: string;
  membership?: Membership;
  system?: UnitSystem;
  cache?: InMemoryCache;
  /** Answers that take precedence over the ones every visit gets. */
  answers?: Array<Pick<ReturnType<typeof recordMock>, 'mock'>>;
}

/** The detail as the pantry opens it, over the homes the app has read. */
function renderDetail({
  item = milk,
  itemId = 'pi1',
  membership = OWNER,
  system = UnitSystem.Metric,
  cache = makeCache(),
  answers = [],
}: Open = {}) {
  seedQuery(cache, { query: GetHomesDocument, data: homesWith(membership) });
  writeUnitSystemSettings(cache, system, system);
  return renderWithApollo(<PantryItemDetail route={{ params: { itemId } }} />, {
    cache,
    links: [log.link],
    operationMocks: [
      ...answers.map(answer => answer.mock),
      recordMock(GetPantryItemDocument, { data: pantryItemData(item) }).mock,
      recordMock(GetPantryItemBatchesDocument, { data: batchesAnswer([]) })
        .mock,
      recordMock(CatalogRecipesForItemDocument, { data: noSuggestions }).mock,
      recordMock(MyFeatureFlagsDocument, { data: { myFeatureFlags: [] } }).mock,
    ],
  }).client;
}

/** The detail once its stack has been read. */
async function openDetail(options: Open = {}) {
  const client = renderDetail(options);
  await log.landed(GetPantryItemDocument);
  return client;
}

/**
 * Resolves once the cache's watchers read the user's system as `system`. A
 * cache write reaches a watching query a task later (`scheduleNotify`), and the
 * screen's watcher, older than this one, is told first.
 */
const settingsRead = (client: ApolloClient, system: UnitSystem) =>
  screenShows(
    client,
    { query: GetUserSettingsDocument },
    () =>
      client.readQuery({ query: GetUserSettingsDocument })?.me?.settings
        ?.preferredUnitSystem,
    seen => seen === system,
  );

/** A header action, in the bar or in the "more" menu it overflowed into. */
const headerAction = (testID: string) => {
  const more = screen.queryByTestId(kitTestIDs.headerMoreButton);
  if (more) fireEvent.press(more);
  return screen.queryByTestId(testID);
};

/**
 * Runs a header action. One in the "more" menu runs once the menu's sheet has
 * closed, so its dismissal is delivered.
 */
const pressHeaderAction = (testID: string) => {
  const action = headerAction(testID);
  if (!action) throw new Error(`no header action ${testID}`);
  fireEvent.press(action);
  fireEvent(action, 'dismiss');
};

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'member@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    selectedHomeId: 'home-1',
    selectedPantryId: 'p1',
    selectedShoppingListId: 'sl-1',
    isHomeSelectionReady: true,
    isOnline: true,
    apiReachable: true,
    budgetAndPrices: true,
  });
});

// The in-flight mark is module state: a failed test must not leave one behind.
afterEach(() => unconfirmedCreates.confirm('pi1'));

describe('what the stack is', () => {
  it('names it, with its brand, category, place, notes and tags', async () => {
    await openDetail();

    expect(screen.getAllByText('Milk').length).toBeGreaterThan(0);
    expect(screen.getByText('Organic Valley')).toBeTruthy();
    expect(screen.getByText(/Dairy/)).toBeTruthy();
    expect(screen.getByText(/Fridge/)).toBeTruthy();
    expect(screen.getByText('Keep cold')).toBeTruthy();
    expect(screen.getByText('organic')).toBeTruthy();
  });

  it('reads a fractional amount as a cooking fraction', async () => {
    await openDetail({
      item: {
        ...milk,
        quantity: 1.25,
        unitSymbol: 'cup',
        unitDisplayAsFraction: true,
      },
    });

    expect(screen.getAllByText('1 1/4 cup').length).toBeGreaterThan(0);
  });

  it('keeps decimals, to three places, for a unit that opts out of fractions', async () => {
    await openDetail({ item: { ...milk, quantity: 177.4412 } });

    expect(screen.getAllByText('177.441 L').length).toBeGreaterThan(0);
  });
});

describe('the states it can be in', () => {
  it('shows the screen, not the stack, while it is read', () => {
    renderDetail({
      answers: [
        recordMock(GetPantryItemDocument, {
          data: pantryItemData(milk),
          held: true,
        }),
      ],
    });

    expect(screen.getByTestId(pantryTestIDs.itemDetail)).toBeTruthy();
    expect(screen.queryByText('Milk')).toBeNull();
  });

  it('says a stack the server holds nothing for is gone, not that it failed', async () => {
    await openDetail({
      answers: [
        recordMock(GetPantryItemDocument, { data: { pantryItem: null } }),
      ],
    });

    expect(screen.getByTestId(pantryTestIDs.itemRemoved)).toBeTruthy();
    expect(screen.queryByTestId(kitTestIDs.stateError)).toBeNull();
  });

  // A refusal, not a failed load: retrying cannot show it.
  it('says a stack the viewer may no longer see is hidden, with no retry', async () => {
    const refused: MockFor<typeof GetPantryItemDocument> = {
      request: { query: GetPantryItemDocument, variables: () => true },
      result: {
        errors: [
          new GraphQLError('Not a member', {
            extensions: { code: ErrorCode.Forbidden },
          }),
        ],
      },
    };
    await openDetail({ answers: [{ mock: refused }] });

    expect(screen.getByTestId(pantryTestIDs.itemHidden)).toBeTruthy();
    expect(screen.queryByTestId(kitTestIDs.stateError)).toBeNull();
  });

  // Its read is held back until the create lands: the server has no row yet.
  it('waits on a stack still being created, then opens it', async () => {
    unconfirmedCreates.mark('pi1');
    renderDetail();

    expect(screen.getByTestId(kitTestIDs.stateLoading)).toBeTruthy();

    act(() => unconfirmedCreates.confirm('pi1'));
    await log.landed(GetPantryItemDocument);
    expect(screen.getAllByText('Milk').length).toBeGreaterThan(0);
  });

  it('shows the survivor in place of a stack merged into it', async () => {
    await openDetail({ itemId: 'pi-merged' });

    expect(mockNav.replaceWithPantryItemDetail).toHaveBeenCalledWith({
      itemId: 'pi1',
    });
  });

  it('stays put when the answer is the stack it asked for', async () => {
    await openDetail();

    expect(mockNav.replaceWithPantryItemDetail).not.toHaveBeenCalled();
  });

  describe('offline', () => {
    const noServer = () =>
      recordMock(GetPantryItemDocument, {
        error: new Error('offline: no cached data'),
      });

    beforeEach(() => useStore.setState({ apiReachable: false }));

    it('says a stack the device does not hold needs a connection, never spinning', async () => {
      await openDetail({ answers: [noServer()] });

      expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();
    });

    /** A row the list holds, never opened on this device. */
    const heldRow = () => {
      const cache = makeCache();
      seedFragment(cache, {
        fragment: PantryItem_ListedFragmentDoc,
        fragmentName: 'pantryItem_listed',
        data: {
          __typename: 'PantryItem',
          id: 'pi1',
          itemName: 'Oat milk',
          expiresOn: null,
          storageLocation: { id: 'loc-1', name: 'Fridge door' },
        },
      });
      return cache;
    };

    it('shows what the list holds of a row, and says the rest needs a connection', async () => {
      await openDetail({ cache: heldRow(), answers: [noServer()] });

      expect(screen.getAllByText('Oat milk').length).toBeGreaterThan(0);
      expect(screen.getByText('Fridge door')).toBeTruthy();
      expect(screen.getByTestId(pantryTestIDs.itemPartial)).toBeTruthy();
    });

    it.each([
      { who: 'someone who may edit', membership: OWNER, offered: true },
      { who: 'a viewer', membership: VIEWER, offered: false },
    ])(
      'offers Edit on a held row to $who: $offered',
      async ({ membership, offered }) => {
        await openDetail({
          cache: heldRow(),
          membership,
          answers: [noServer()],
        });

        expect(headerAction(pantryTestIDs.itemEditButton) !== null).toBe(
          offered,
        );
      },
    );
  });
});

describe('what a member may do', () => {
  it('offers an owner every action', async () => {
    await openDetail();

    expect(headerAction(pantryTestIDs.itemAddToListButton)).toBeTruthy();
    expect(headerAction(pantryTestIDs.itemAdjustButton)).toBeTruthy();
    expect(headerAction(pantryTestIDs.itemEditButton)).toBeTruthy();
    expect(headerAction(catalogTestIDs.entryPhotoChangeButton)).toBeTruthy();
    expect(headerAction(pantryTestIDs.itemRelinkButton)).toBeTruthy();
    expect(headerAction(pantryTestIDs.itemDeleteButton)).toBeTruthy();
  });

  // The API gates delete and discard on `canRemoveItems`.
  it('offers edit but neither delete nor discard to a member who may not remove', async () => {
    await openDetail({
      membership: EDITS_NOT_REMOVES,
      item: { ...milk, expiresOn: day(-1), earliestBatchExpiresOn: day(-1) },
    });

    expect(headerAction(pantryTestIDs.itemEditButton)).toBeTruthy();
    expect(headerAction(pantryTestIDs.itemDeleteButton)).toBeNull();
    expect(headerAction(pantryTestIDs.itemDiscardButton)).toBeNull();
  });

  it('offers a viewer no change to the stack', async () => {
    await openDetail({ membership: VIEWER });

    expect(headerAction(pantryTestIDs.itemAddToListButton)).toBeNull();
    expect(headerAction(pantryTestIDs.itemEditButton)).toBeNull();
    expect(headerAction(catalogTestIDs.entryPhotoChangeButton)).toBeNull();
    expect(headerAction(pantryTestIDs.itemRelinkButton)).toBeNull();
    expect(headerAction(pantryTestIDs.itemDeleteButton)).toBeNull();
  });

  it('opens the edit form from Edit', async () => {
    await openDetail();

    pressHeaderAction(pantryTestIDs.itemEditButton);
    await act(() => Promise.resolve());

    expect(mockNav.toPantryItem).toHaveBeenCalledWith({ itemId: 'pi1' });
  });
});

// The server's EXPIRED flag can be a day late east of UTC; the date decides.
describe('discarding what has expired', () => {
  it.each([
    {
      why: "the batches' date has passed",
      item: { ...milk, expiresOn: day(-1), earliestBatchExpiresOn: day(-1) },
      offered: true,
    },
    {
      why: 'the server flags it expired',
      item: { ...milk, condition: ItemCondition.Expired },
      offered: true,
    },
    {
      why: 'it expires today',
      item: {
        ...milk,
        expiresOn: todayKey(),
        earliestBatchExpiresOn: todayKey(),
      },
      offered: false,
    },
    {
      // An edit moves only the item's date; the server finds no expired batch.
      why: 'only the item date, not its batches, has passed',
      item: { ...milk, expiresOn: day(-1) },
      offered: false,
    },
    {
      why: 'nothing is left of it',
      item: { ...milk, quantity: 0, condition: ItemCondition.Expired },
      offered: false,
    },
  ])('is offered when $why: $offered', async ({ item, offered }) => {
    await openDetail({ item });

    expect(headerAction(pantryTestIDs.itemDiscardButton) !== null).toBe(
      offered,
    );
  });

  it('is offered when an active batch is past its date', async () => {
    const batches = recordMock(GetPantryItemBatchesDocument, {
      data: {
        pantryItemBatchesConnection: {
          edges: [
            {
              node: {
                __typename: 'PantryItemBatch',
                id: 'b1',
                status: BatchStatus.Active,
                expiresOn: day(-2),
              },
            },
          ],
        },
      },
    });
    await openDetail({ answers: [batches] });
    await log.landed(GetPantryItemBatchesDocument);

    expect(headerAction(pantryTestIDs.itemDiscardButton)).toBeTruthy();
  });
});

describe('recipes to try', () => {
  it('opens a suggestion with what its card shows', async () => {
    const suggestions = recordMock(CatalogRecipesForItemDocument, {
      data: {
        catalogRecipesByIngredients: {
          edges: [
            {
              node: {
                __typename: 'CatalogRecipeHit',
                provider: ExternalSource.Spoonacular,
                providerRecipeId: '42',
                name: 'Tomato soup',
                imageUrl: 'https://img.example.com/42.jpg',
              },
            },
          ],
        },
      },
    });
    await openDetail({ answers: [suggestions] });
    await log.landed(CatalogRecipesForItemDocument);

    fireEvent.press(screen.getByText('Tomato soup'));

    expect(mockNav.toRecipeDetail).toHaveBeenCalledWith({
      catalog: {
        provider: ExternalSource.Spoonacular,
        externalId: '42',
        name: 'Tomato soup',
        imageUrl: 'https://img.example.com/42.jpg',
      },
    });
  });

  it('says the suggestions could not be read, never that there are none', async () => {
    await openDetail({
      answers: [
        recordMock(CatalogRecipesForItemDocument, { error: new Error('500') }),
      ],
    });
    await log.landed(CatalogRecipesForItemDocument);

    expect(
      screen.queryByText(t('pantryItemDetail.noRecipeSuggestions')),
    ).toBeNull();
    expect(screen.getByText(t('labels.tryAgain'))).toBeTruthy();
  });
});

describe('nutrition', () => {
  type Facts = NonNullable<PantryItemFixture['nutritionFacts']>;
  const facts = (id: string): Facts => ({
    __typename: 'NutritionFacts',
    id,
    calories: 64,
    totalFat: 3.6,
    saturatedFat: null,
    transFat: null,
    cholesterol: null,
    sodium: null,
    totalCarbs: 4.8,
    dietaryFiber: null,
    totalSugars: null,
    addedSugars: null,
    protein: 3.3,
    vitaminD: null,
    calcium: null,
    iron: null,
    potassium: null,
    servingSize: 100,
    servingUnit: 'ml',
  });

  it("shows the stack's own facts as its nutrition", async () => {
    await openDetail({
      item: { ...milk, nutritionFacts: facts('nf1') },
    });

    expect(screen.getByText(t('pantryItemDetail.nutrition'))).toBeTruthy();
    expect(screen.getByText('64')).toBeTruthy();
  });

  it("titles a concept's values as typical", async () => {
    await openDetail({
      item: {
        ...milk,
        nutritionFacts: facts('nf-concept'),
        typicalOf: 'milk',
      },
    });

    expect(
      screen.getByText(t('labels.typicalFor', { concept: 'milk' })),
    ).toBeTruthy();
    expect(screen.queryByText(t('pantryItemDetail.nutrition'))).toBeNull();
  });
});

describe('photos', () => {
  const photo = (id: string): ItemPhotoFixture => ({
    __typename: 'ItemPhoto',
    id,
    url: `https://cdn.test/${id}.jpg`,
    perspective: null,
    isPrimary: false,
    status: ItemImageStatus.Approved,
    credit: null,
    variants: [],
  });
  const inUse = (
    catalogImageId: string,
  ): NonNullable<PantryItemFixture['image']> => ({
    __typename: 'EntryImage',
    url: `https://cdn.test/${catalogImageId}.jpg`,
    source: EntryImageSource.Household,
    catalogImageId,
  });

  it("offers to report a public catalog item's photo", async () => {
    await openDetail({
      item: {
        ...milk,
        canSuggest: true,
        imageUrl: 'https://cdn.test/milk.jpg',
      },
    });

    expect(headerAction(pantryTestIDs.itemReportPhotoButton)).toBeTruthy();
  });

  // The household's own upload is nobody else's to review.
  it("offers no report over the household's own upload", async () => {
    await openDetail({
      item: {
        ...milk,
        canSuggest: true,
        imageUrl: 'https://cdn.test/milk.jpg',
        image: { ...inUse('own'), catalogImageId: null },
      },
    });

    expect(headerAction(pantryTestIDs.itemReportPhotoButton)).toBeNull();
  });

  it('offers no report on an item with no photo', async () => {
    await openDetail({ item: { ...milk, canSuggest: true } });

    expect(headerAction(pantryTestIDs.itemReportPhotoButton)).toBeNull();
  });

  /** Opens the photo sheet; whether it offers one of the item's own photos. */
  const pickOffered = async (item: PantryItemFixture) => {
    await openDetail({ item });
    fireEvent.press(headerAction(catalogTestIDs.entryPhotoChangeButton)!);
    await act(() => Promise.resolve());
    expect(screen.getByTestId(catalogTestIDs.entryPhotoSheet)).toBeTruthy();
    return (
      screen.queryByTestId(catalogTestIDs.entryPhotoPickItemPhoto) !== null
    );
  };

  it('offers an item photo while one other than the one in use exists', async () => {
    expect(
      await pickOffered({
        ...milk,
        photos: [photo('front'), photo('back')],
        image: inUse('front'),
      }),
    ).toBe(true);
  });

  it('offers no item photo when the only one is in use', async () => {
    expect(
      await pickOffered({
        ...milk,
        photos: [photo('front')],
        image: inUse('front'),
      }),
    ).toBe(false);
  });
});

// The server values the REMAINING stock; the batches only decide the labels.
describe('what the stock cost', () => {
  const costed = async (
    item: PantryItemFixture,
    batches: Parameters<typeof batchesAnswer>[0],
  ) => {
    await openDetail({
      item,
      answers: [
        recordMock(GetPantryItemBatchesDocument, {
          data: batchesAnswer(batches),
        }),
      ],
    });
    await log.landed(GetPantryItemBatchesDocument);
  };

  it('labels a restocked rate as an average, and names the last purchase', async () => {
    await costed({ ...milk, quantity: 8, costPerUnit: 0.74, totalCost: 5.95 }, [
      { id: 'b1', quantity: 5, costPerUnit: 0.59, totalCost: 2.95 },
      {
        id: 'b2',
        quantity: 3,
        costPerUnit: 1,
        totalCost: 3,
        createdAt: '2026-08-31T00:00:00Z',
      },
    ]);

    expect(screen.getByText('Avg Cost/Unit')).toBeTruthy();
    expect(screen.getByText('$0.74')).toBeTruthy();
    expect(screen.getByText('$5.95')).toBeTruthy();
    expect(screen.getByText('Last purchase')).toBeTruthy();
  });

  it('reads a single purchase plainly', async () => {
    await costed({ ...milk, quantity: 5, costPerUnit: 0.59, totalCost: 2.95 }, [
      { id: 'b1', quantity: 5, costPerUnit: 0.59, totalCost: 2.95 },
    ]);

    expect(screen.getByText('Cost/Unit')).toBeTruthy();
    expect(screen.queryByText('Avg Cost/Unit')).toBeNull();
  });

  it('hides a rate diluted by stock with no recorded cost', async () => {
    await costed({ ...milk, quantity: 8, costPerUnit: 0.37, totalCost: 2.95 }, [
      { id: 'paid', quantity: 5, costPerUnit: 0.59, totalCost: 2.95 },
      { id: 'gifted', quantity: 3, costPerUnit: null },
    ]);

    expect(screen.getByText('Stock value')).toBeTruthy();
    expect(screen.queryByText('$0.37')).toBeNull();
  });

  it('shows no money rows when nothing left has a known cost', async () => {
    await costed({ ...milk, costPerUnit: null, totalCost: null }, [
      { id: 'b1', quantity: 5, costPerUnit: null },
    ]);

    expect(screen.queryByText('Cost/Unit')).toBeNull();
    expect(screen.queryByText('Stock value')).toBeNull();
  });
});

// The weights read in the user's system by the API's own readings, whatever
// unit the stack stores them in.
describe('weights in the user’s unit system', () => {
  interface ReadingUnit {
    id: string;
    symbol: string;
  }
  const g = { id: 'unit-g', symbol: 'g' };
  const oz = { id: 'unit-oz', symbol: 'oz' };
  const kg = { id: 'unit-kg', symbol: 'kg' };
  const lb = { id: 'unit-lb', symbol: 'lb' };

  const read = (value: number, { id, symbol }: ReadingUnit) =>
    readingAsAbbreviation({
      __typename: 'MeasureReading',
      value,
      unitId: id,
      symbol,
      displayAsFraction: false,
      type: UnitType.Weight,
    });

  const measure = (
    value: number,
    stored: ReadingUnit,
    metric: [number, ReadingUnit],
    imperial: [number, ReadingUnit],
  ): PackageSize => ({
    __typename: 'Measure',
    value,
    unitId: stored.id,
    metric: read(...metric),
    imperial: read(...imperial),
  });

  /** The stack's read, its package size stored as `value` `stored`. */
  const weighed = (
    value: number,
    stored: ReadingUnit,
    metric: [number, ReadingUnit],
    imperial: [number, ReadingUnit],
  ) => {
    const data = pantryItemData(milk);
    const item = data.pantryItem;
    if (!item) throw new Error('fixture has no item');
    item.netWeight = value;
    item.netWeightUnit = asAbbreviation({
      __typename: 'Unit',
      id: stored.id,
      name: stored.symbol,
      symbol: stored.symbol,
    });
    item.packageSize = measure(value, stored, metric, imperial);
    return recordMock(GetPantryItemDocument, { data });
  };

  it.each([
    { stored: 'grams', value: 1360.78, unit: g },
    { stored: 'ounces', value: 48, unit: oz },
  ])(
    'reads a size stored in $stored as pounds for an imperial user',
    async ({ value, unit }) => {
      await openDetail({
        system: UnitSystem.Imperial,
        answers: [weighed(value, unit, [1.36, kg], [3, lb])],
      });

      expect(screen.getByText('3 lb')).toBeTruthy();
    },
  );

  it('reads it in kilograms for a metric user', async () => {
    await openDetail({
      system: UnitSystem.Metric,
      answers: [weighed(1360.78, g, [1.36, kg], [3, lb])],
    });

    expect(screen.getByText('1.36 kg')).toBeTruthy();
  });

  it('follows a change of setting at once, with no request for it', async () => {
    const client = await openDetail({
      system: UnitSystem.Imperial,
      answers: [weighed(1360.78, g, [1.36, kg], [3, lb])],
    });
    expect(screen.getByText('3 lb')).toBeTruthy();

    await act(async () => {
      const changed = settingsRead(client, UnitSystem.Metric);
      writeUnitSystemSettings(
        client.cache,
        UnitSystem.Metric,
        UnitSystem.Metric,
      );
      await changed;
    });

    expect(screen.getByText('1.36 kg')).toBeTruthy();
  });

  // A "6.35 oz (180 g)" can reads each system in the label's own figure.
  it.each([
    { system: UnitSystem.Imperial, text: '6.35 oz' },
    { system: UnitSystem.Metric, text: '180 g' },
  ])(
    'reads a declared can in $system as its label does',
    async ({ system, text }) => {
      await openDetail({
        system,
        answers: [weighed(180, g, [180, g], [6.35, oz])],
      });

      expect(screen.getByText(text)).toBeTruthy();
    },
  );

  it('reads what it holds in the user’s system, not in stored grams', async () => {
    const data = pantryItemData({
      ...milk,
      quantity: 907.18,
      heldQuantity: 907.18,
      unitSymbol: 'g',
      unitName: 'gram',
    });
    const item = data.pantryItem;
    if (!item) throw new Error('fixture has no item');
    item.amountLeft = measure(907.18, g, [907.18, g], [2, lb]);
    item.amountLeft.unitId = item.unit.id;
    await openDetail({
      system: UnitSystem.Imperial,
      answers: [recordMock(GetPantryItemDocument, { data })],
    });

    expect(screen.getAllByText('2 lb').length).toBeGreaterThan(0);
    expect(screen.queryByText('907.18 g')).toBeNull();
  });
});
