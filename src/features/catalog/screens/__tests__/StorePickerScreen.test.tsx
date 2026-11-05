import React from 'react';
import { Linking, TextInput } from 'react-native';
import { GraphQLError } from 'graphql';
import type { ApolloLink } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { requirePlatform } from '#/platform/install';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  seedQuery,
  type MockDataFor,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { operationLog } from '#/test-utils/operationLog';
import {
  CreateOutcome,
  ErrorCode,
  UsualStoreSource,
} from '#/graphql/generated/schemaTypes';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { isRecord } from '#/utils/isRecord';
import {
  readUsualStores,
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import { CreateStoreFromPlaceDocument } from '#features/catalog/hooks/useCreateStoreFromPlace.generated';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
} from '#features/catalog/hooks/useUsualStoreWrites.generated';
import { StorePlacesDocument } from '#features/catalog/hooks/useStoreSearch.generated';
import { useStorePickerStore } from '#features/catalog/store/storePickerStore';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { StorePickerScreen } from '../StorePickerScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(),
}));

const route = {
  key: 'StorePicker',
  name: 'StorePicker' as const,
  params: { homeId: 'home-1' },
};

const banksville: NonNullable<UsualStoreEntry['store']> = {
  __typename: 'Store',
  id: 's-ge-b',
  name: 'Giant Eagle Banksville',
  address: '1 Banksville Rd',
  chain: { __typename: 'StoreChain', id: 'chain-ge', name: 'Giant Eagle' },
};

const renderPicker = (
  mocks: ReturnType<typeof recordMock>['mock'][],
  seed?: (cache: ReturnType<typeof makeCache>) => void,
  params: { several?: boolean } = {},
  links: ApolloLink[] = [],
) => {
  const cache = makeCache();
  seed?.(cache);
  writeUsualStores(cache, 'home-1', [
    {
      __typename: 'UsualStore',
      id: 'home-1:s-ge-b',
      addedVia: UsualStoreSource.Receipt,
      pinned: false,
      compared: true,
      lastUsedAt: '2026-10-20T12:00:00.000Z',
      store: banksville,
      chain: banksville.chain,
    },
  ]);
  renderWithApollo(
    <StorePickerScreen
      route={{ ...route, params: { ...route.params, ...params } }}
    />,
    { cache, operationMocks: mocks, links },
  );
  return cache;
};

const searching = (stores: object[]) =>
  recordMock(SearchStoresDocument, {
    data: { stores: { edges: stores.map(node => ({ node })) } },
  });

const adding = () =>
  recordMock(AddUsualStoreDocument, {
    data: { addUsualStore: { __typename: 'AddUsualStorePayload' } },
  });

const type = (text: string) => {
  fireEvent.changeText(
    screen.getByPlaceholderText('Search by store name or address'),
    text,
  );
  act(() => {
    jest.advanceTimersByTime(300);
  });
};

const typeZip = (zip: string) => {
  fireEvent.changeText(screen.getByTestId(catalogTestIDs.storePickerZip), zip);
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  useStore.setState({ isOnline: true, apiReachable: null });
  useStorePickerStore.setState({ lastZip: null });
});

describe('StorePickerScreen', () => {
  describe('a place the search found', () => {
    const CREDIT = '© OpenStreetMap contributors';
    const listed = () =>
      recordMock(StorePlacesDocument, {
        data: {
          storePlaces: [
            {
              placeId: 'osm:node/7',
              store: null,
              name: 'Save-A-Lot',
              address: 'Stoner Way',
              distanceKm: 1.8,
              credit: CREDIT,
            },
          ],
        },
      });

    it('names OpenStreetMap beside the list', async () => {
      renderPicker([listed().mock]);

      typeZip('15221');

      await drainTimers();
      expect(screen.getByText('Save-A-Lot')).toBeTruthy();
      expect(screen.getByText(CREDIT)).toBeTruthy();
    });

    it('opens the data licence from that credit', async () => {
      const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      renderPicker([listed().mock]);

      typeZip('15221');

      await drainTimers();
      fireEvent.press(screen.getByText(CREDIT));
      expect(openURL).toHaveBeenCalledWith(
        'https://www.openstreetmap.org/copyright',
      );
      openURL.mockRestore();
    });

    it('reads a place picked since the list was kept as added', async () => {
      const place = {
        name: banksville.name,
        address: banksville.address,
        distanceKm: 1.8,
        credit: CREDIT,
      };
      const answered = recordMock(StorePlacesDocument, {
        data: { storePlaces: [{ ...place, placeId: null, store: banksville }] },
      });
      renderPicker([answered.mock], cache => {
        seedQuery(cache, {
          query: StorePlacesDocument,
          variables: { input: { near: { zip: '15221' } }, withPrices: false },
          data: {
            storePlaces: [{ ...place, placeId: 'osm:way/9', store: null }],
          },
        });
      });

      typeZip('15221');

      await drainTimers();
      expect(screen.getByText('Added')).toBeTruthy();
    });

    it('becomes a store when picked, and joins the household’s', async () => {
      const create = recordMock(CreateStoreFromPlaceDocument, {
        data: {
          createStoreFromPlace: {
            __typename: 'CreateStorePayload',
            outcome: CreateOutcome.Created,
            store: { id: 's-new', name: 'Save-A-Lot' },
          },
        },
      });
      const add = adding();
      renderPicker([listed().mock, create.mock, add.mock]);
      typeZip('15221');
      await drainTimers();

      fireEvent.press(screen.getByText('Save-A-Lot'));

      await drainTimers();
      expect(inputOf(create.fired[0] ?? {})).toEqual({
        placeId: 'osm:node/7',
      });
      expect(inputOf(add.fired[0] ?? {})).toMatchObject({
        target: { storeId: 's-new' },
      });
    });

    it('is added by its name when the search has lost it', async () => {
      const refused = recordMock(CreateStoreFromPlaceDocument, {
        data: {
          createStoreFromPlace: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            field: 'placeId',
          },
        },
      });
      const create = recordMock(CreateStoreDocument, {
        dataFor: (vars): MockDataFor<typeof CreateStoreDocument> => ({
          createStore: {
            __typename: 'CreateStorePayload',
            outcome: CreateOutcome.Created,
            store: { id: String(inputOf(vars).id), name: 'Save-A-Lot' },
          },
        }),
      });
      const add = adding();
      renderPicker([listed().mock, refused.mock, create.mock, add.mock]);
      typeZip('15221');
      await drainTimers();

      fireEvent.press(screen.getByText('Save-A-Lot'));

      await drainTimers();
      expect(inputOf(create.fired[0] ?? {})).toMatchObject({
        name: 'Save-A-Lot',
        homeId: 'home-1',
      });
      expect(add.fired).toHaveLength(1);
    });
  });

  it("adds a store the app doesn't know as the household's own, by its name", async () => {
    const create = recordMock(CreateStoreDocument, {
      dataFor: (vars): MockDataFor<typeof CreateStoreDocument> => ({
        createStore: {
          __typename: 'CreateStorePayload',
          outcome: CreateOutcome.Created,
          store: { id: String(inputOf(vars).id), name: "Pete's Corner Market" },
        },
      }),
    });
    const add = adding();
    renderPicker([searching([]).mock, create.mock, add.mock]);

    type("Pete's Corner Market");
    await drainTimers();
    fireEvent.press(screen.getByText("Not listed? Add “Pete's Corner Market”"));

    await drainTimers();
    expect(add.fired).toHaveLength(1);
    expect(inputOf(create.fired[0] ?? {})).toMatchObject({
      name: "Pete's Corner Market",
      homeId: 'home-1',
    });
    expect(inputOf(create.fired[0] ?? {}).address).toBeUndefined();
    expect(inputOf(add.fired[0] ?? {})).toEqual({
      homeId: 'home-1',
      target: { storeId: inputOf(create.fired[0] ?? {}).id },
    });
  });

  it('adds a whole chain, and goes back saying so', async () => {
    const add = adding();
    renderPicker([
      searching([
        {
          id: 's-aldi-w',
          name: 'ALDI Wilkinsburg',
          address: '401 Penn Ave',
          chain: { id: 'chain-aldi', name: 'ALDI' },
        },
      ]).mock,
      add.mock,
    ]);

    type('aldi');
    await drainTimers();
    fireEvent.press(screen.getByText('ALDI (any store)'));

    await drainTimers();
    expect(add.fired).toEqual([
      { input: { homeId: 'home-1', target: { chainId: 'chain-aldi' } } },
    ]);
    await drainTimers();
    expect(toastService.success).toHaveBeenCalledWith('Added to your stores');
    expect(useAppNavigation().goBack).toHaveBeenCalled();
    expect(screen.queryByTestId(catalogTestIDs.storePickerDone)).toBeNull();
  });

  describe('several stores in one visit', () => {
    const CREDIT = '© OpenStreetMap contributors';
    const names = new Map([
      [banksville.id, banksville.name],
      ['s-sal', 'Save-A-Lot'],
      ['s-aldi', 'ALDI'],
      ['s-coop', 'East End Food Co-op'],
    ]);
    const heldStore = (id: string) => ({
      placeId: null,
      name: names.get(id) ?? id,
      address: null,
      credit: null,
      distanceKm: 1,
      store: {
        id,
        name: names.get(id) ?? id,
        address: null,
        storeNumber: null,
        chain: null,
      },
    });
    const saveALotPlace = {
      placeId: 'osm:node/7',
      store: null,
      name: 'Save-A-Lot',
      address: 'Stoner Way',
      distanceKm: 1.8,
      credit: CREDIT,
    };
    // Until a typed name asks again, Save-A-Lot is a place; then its store.
    const near15221 = () =>
      recordMock(StorePlacesDocument, {
        dataFor: (vars): MockDataFor<typeof StorePlacesDocument> => ({
          storePlaces: inputOf(vars).search
            ? [heldStore('s-sal')]
            : [saveALotPlace, heldStore('s-aldi'), heldStore('s-coop')],
        }),
      });
    const madeFromPlace = (options: { held?: boolean } = {}) =>
      recordMock(CreateStoreFromPlaceDocument, {
        ...options,
        data: {
          createStoreFromPlace: {
            __typename: 'CreateStorePayload',
            outcome: CreateOutcome.Created,
            store: { id: 's-sal', name: 'Save-A-Lot' },
          },
        },
      });
    const storeIdOf = (vars: Record<string, unknown>) => {
      const { target } = inputOf(vars);
      return isRecord(target) ? String(target.storeId) : '';
    };
    // The household's list as the API keeps it: each write answers it whole.
    const householdApi = () => {
      let held = [banksville.id];
      const entry = (id: string) => ({
        id: `home-1:${id}`,
        store: { id, name: names.get(id) ?? id },
        chain: null,
      });
      return {
        add: recordMock(AddUsualStoreDocument, {
          dataFor: (vars): MockDataFor<typeof AddUsualStoreDocument> => {
            held = [...held, storeIdOf(vars)];
            return {
              addUsualStore: {
                __typename: 'AddUsualStorePayload',
                usualStores: held.map(entry),
              },
            };
          },
        }),
        remove: recordMock(RemoveUsualStoreDocument, {
          dataFor: (vars): MockDataFor<typeof RemoveUsualStoreDocument> => {
            held = held.filter(id => id !== storeIdOf(vars));
            return {
              removeUsualStore: {
                __typename: 'RemoveUsualStorePayload',
                usualStores: held.map(id => ({ id: `home-1:${id}` })),
              },
            };
          },
        }),
      };
    };
    const usualStoreNames = (cache: ReturnType<typeof makeCache>) =>
      readUsualStores(cache, 'home-1')?.map(({ store }) => store?.name);
    const rowOf = (key: string) =>
      screen.getByTestId(catalogTestIDs.storePickerRow(key));
    /** A row that offers no tap: held, or its write still settling. */
    const offersNoTap = (row: ReturnType<typeof rowOf>) =>
      within(row).queryByRole('button') === null;

    // Each step waits on the operation it started, never on a clock.
    let log = operationLog();
    const answered = (document: DocumentNode, nth = 1) =>
      act(async () => {
        await log.answered(document, nth);
      });
    // A typed term asks after a debounce whose update must render first, and
    // inside `act` it would wait for `act` to end: the request is awaited out
    // of it, then its answer in it.
    const searched = async (document: DocumentNode, nth = 1) => {
      await log.requested(document, nth);
      await answered(document, nth);
    };
    const renderSeveral = (mocks: ReturnType<typeof recordMock>['mock'][]) =>
      renderPicker(mocks, undefined, { several: true }, [log.link]);
    const typeTerm = (text: string) => {
      fireEvent.changeText(
        screen.getByPlaceholderText('Search by store name or address'),
        text,
      );
    };
    const listNear15221 = async () => {
      typeZip('15221');
      await answered(StorePlacesDocument);
      expect(screen.getByText('East End Food Co-op')).toBeTruthy();
    };

    beforeEach(() => {
      jest.useRealTimers();
      log = operationLog();
    });

    it('adds each store tapped and stays open, until Done goes back', async () => {
      const api = householdApi();
      const cache = renderSeveral([
        near15221().mock,
        madeFromPlace().mock,
        api.add.mock,
      ]);
      await listNear15221();

      const picks = ['Save-A-Lot', 'ALDI', 'East End Food Co-op'];
      for (const [index, name] of picks.entries()) {
        fireEvent.press(screen.getByText(name));
        await answered(AddUsualStoreDocument, index + 1);
      }

      expect(within(rowOf('place:osm:node/7')).getByText('Added')).toBeTruthy();
      expect(within(rowOf('store:s-aldi')).getByText('Added')).toBeTruthy();
      expect(within(rowOf('store:s-coop')).getByText('Added')).toBeTruthy();
      expect(useAppNavigation().goBack).not.toHaveBeenCalled();
      expect(toastService.success).not.toHaveBeenCalled();

      fireEvent.press(screen.getByTestId(catalogTestIDs.storePickerDone));

      expect(useAppNavigation().goBack).toHaveBeenCalledTimes(1);
      expect(usualStoreNames(cache)).toEqual([
        banksville.name,
        'Save-A-Lot',
        'ALDI',
        'East End Food Co-op',
      ]);
    });

    it('changes nothing when Done is tapped with nothing added', async () => {
      const api = householdApi();
      const cache = renderSeveral([near15221().mock, api.add.mock]);
      await listNear15221();

      fireEvent.press(screen.getByTestId(catalogTestIDs.storePickerDone));

      expect(useAppNavigation().goBack).toHaveBeenCalledTimes(1);
      expect(api.add.fired).toEqual([]);
      expect(usualStoreNames(cache)).toEqual([banksville.name]);
    });

    it('takes back a store added this visit on a second tap', async () => {
      const api = householdApi();
      const cache = renderSeveral([
        near15221().mock,
        api.add.mock,
        api.remove.mock,
      ]);
      await listNear15221();

      fireEvent.press(screen.getByText('ALDI'));
      await answered(AddUsualStoreDocument);
      expect(usualStoreNames(cache)).toContain('ALDI');
      fireEvent.press(screen.getByText('ALDI'));

      await answered(RemoveUsualStoreDocument);
      expect(api.remove.fired.map(storeIdOf)).toEqual(['s-aldi']);
      expect(usualStoreNames(cache)).toEqual([banksville.name]);
      expect(within(rowOf('store:s-aldi')).queryByText('Added')).toBeNull();
    });

    it('takes back a place added this visit, from its place row', async () => {
      const api = householdApi();
      const cache = renderSeveral([
        near15221().mock,
        madeFromPlace().mock,
        api.add.mock,
        api.remove.mock,
      ]);
      await listNear15221();

      fireEvent.press(screen.getByText('Save-A-Lot'));
      await answered(AddUsualStoreDocument);
      fireEvent.press(screen.getByText('Save-A-Lot'));

      await answered(RemoveUsualStoreDocument);
      expect(api.remove.fired.map(storeIdOf)).toEqual(['s-sal']);
      expect(usualStoreNames(cache)).toEqual([banksville.name]);
      expect(within(rowOf('place:osm:node/7')).queryByText('Added')).toBeNull();
    });

    it('takes back a place added this visit once the list names its store', async () => {
      const api = householdApi();
      const cache = renderSeveral([
        near15221().mock,
        madeFromPlace().mock,
        api.add.mock,
        api.remove.mock,
      ]);
      await listNear15221();
      fireEvent.press(screen.getByText('Save-A-Lot'));
      await answered(AddUsualStoreDocument);

      typeTerm('save');
      await searched(StorePlacesDocument, 2);
      expect(within(rowOf('store:s-sal')).getByText('Added')).toBeTruthy();
      fireEvent.press(screen.getByText('Save-A-Lot'));

      await answered(RemoveUsualStoreDocument);
      expect(api.remove.fired.map(storeIdOf)).toEqual(['s-sal']);
      expect(usualStoreNames(cache)).toEqual([banksville.name]);
    });

    it('offers no tap on a store the household had before the visit', async () => {
      renderSeveral([searching([banksville]).mock]);

      typeTerm('giant');
      await searched(SearchStoresDocument);

      const row = rowOf(`store:${banksville.id}`);
      expect(within(row).getByText('Added')).toBeTruthy();
      expect(offersNoTap(row)).toBe(true);
    });

    it('adds a typed name once, and takes it back on a second tap', async () => {
      const api = householdApi();
      const create = recordMock(CreateStoreDocument, {
        dataFor: (vars): MockDataFor<typeof CreateStoreDocument> => {
          const id = String(inputOf(vars).id);
          names.set(id, "Pete's Corner Market");
          return {
            createStore: {
              __typename: 'CreateStorePayload',
              outcome: CreateOutcome.Created,
              store: { id, name: "Pete's Corner Market" },
            },
          };
        },
      });
      renderSeveral([
        searching([]).mock,
        create.mock,
        api.add.mock,
        api.remove.mock,
      ]);
      typeTerm("Pete's Corner Market");
      await searched(SearchStoresDocument);

      fireEvent.press(
        screen.getByText("Not listed? Add “Pete's Corner Market”"),
      );
      await answered(AddUsualStoreDocument);

      const footer = screen.getByTestId(catalogTestIDs.storePickerUnlisted);
      expect(within(footer).getByText("Pete's Corner Market")).toBeTruthy();
      expect(within(footer).getByText('Added')).toBeTruthy();
      expect(create.fired).toHaveLength(1);
      expect(api.add.fired).toHaveLength(1);

      fireEvent.press(within(footer).getByText("Pete's Corner Market"));

      await answered(RemoveUsualStoreDocument);
      expect(api.remove.fired.map(storeIdOf)).toEqual([
        String(inputOf(create.fired[0] ?? {}).id),
      ]);
      expect(
        screen.getByText("Not listed? Add “Pete's Corner Market”"),
      ).toBeTruthy();
    });

    it('sends nothing for a second tap while a place is becoming a store', async () => {
      const api = householdApi();
      const create = madeFromPlace({ held: true });
      renderSeveral([
        near15221().mock,
        create.mock,
        api.add.mock,
        api.remove.mock,
      ]);
      await listNear15221();

      fireEvent.press(screen.getByText('Save-A-Lot'));
      await act(async () => {
        await log.requested(CreateStoreFromPlaceDocument);
      });
      expect(offersNoTap(rowOf('place:osm:node/7'))).toBe(true);
      fireEvent.press(screen.getByText('Save-A-Lot'));

      create.release();
      await answered(AddUsualStoreDocument);
      expect(create.fired).toHaveLength(1);
      expect(api.add.fired.map(storeIdOf)).toEqual(['s-sal']);
      expect(api.remove.fired).toEqual([]);
    });
  });

  it("marks a store the household has, and doesn't add it twice", async () => {
    const add = adding();
    renderPicker([searching([banksville]).mock, add.mock]);

    type('giant');
    await drainTimers();
    fireEvent.press(screen.getByText('Giant Eagle Banksville'));

    expect(screen.getByText('Added')).toBeTruthy();
    expect(add.fired).toEqual([]);
  });

  it.each([
    ['no connection', { isOnline: false, apiReachable: null }],
    ['the API down on working Wi-Fi', { isOnline: true, apiReachable: false }],
  ])(
    "says finding stores needs a connection with %s, and lists the household's",
    (_cause, network) => {
      useStore.setState(network);
      renderPicker([]);

      expect(
        screen.getByText('Finding stores needs a connection'),
      ).toBeTruthy();
      expect(screen.getByText('Giant Eagle Banksville')).toBeTruthy();
      expect(
        screen.queryByPlaceholderText('Search by store name or address'),
      ).toBeNull();
    },
  );

  it('searches a store name as typed, never autocorrected', () => {
    renderPicker([]);

    expect(
      screen.getByPlaceholderText('Search by store name or address').props,
    ).toMatchObject({ autoCorrect: false });
  });

  describe('the zip code', () => {
    it('is remembered once stores near it are listed', async () => {
      const near = recordMock(StorePlacesDocument, {
        data: { storePlaces: [] },
      });
      renderPicker([near.mock]);

      typeZip('15220');

      await drainTimers();
      expect(useStorePickerStore.getState().lastZip).toBe('15220');
    });

    it('says a missing store can be added by typing its name', async () => {
      const near = recordMock(StorePlacesDocument, {
        data: {
          storePlaces: [
            {
              placeId: null,
              name: 'Corner Market',
              address: '2 Penn Ave',
              credit: null,
              distanceKm: 1,
              store: {
                id: 's-near',
                name: 'Corner Market',
                address: '2 Penn Ave',
                storeNumber: null,
                chain: null,
              },
            },
          ],
        },
      });
      renderPicker([near.mock]);

      typeZip('15220');

      await drainTimers();
      expect(screen.getByText('Corner Market')).toBeTruthy();
      expect(
        screen.getByText('Not on the list? Type its name to add it.'),
      ).toBeTruthy();
    });

    it('says so too when nothing is found nearby', async () => {
      const near = recordMock(StorePlacesDocument, {
        data: { storePlaces: [] },
      });
      renderPicker([near.mock]);

      typeZip('15220');

      await drainTimers();
      expect(screen.getByText('No stores found near here.')).toBeTruthy();
      expect(
        screen.getByText('Not on the list? Type its name to add it.'),
      ).toBeTruthy();
    });

    it('is refused on its field alone, and never remembered', async () => {
      const refused: MockFor<typeof StorePlacesDocument> = {
        request: { query: StorePlacesDocument, variables: () => true },
        result: {
          errors: [
            new GraphQLError('That is not a US zip code on file', {
              extensions: {
                code: ErrorCode.ValidationFailed,
                field: 'near.zip',
              },
            }),
          ],
        },
      };
      renderPicker([refused]);

      typeZip('00000');

      await drainTimers();
      expect(
        screen.getByText(
          "That zip code isn't one we know yet. Try another, or search by name.",
        ),
      ).toBeTruthy();
      expect(
        screen.queryByText(
          'Search by name, or enter a zip code to see the stores near it.',
        ),
      ).toBeNull();
      expect(useStorePickerStore.getState().lastZip).toBeNull();
    });
  });

  describe('the prices mark', () => {
    // Mt. Lebanon has shelf prices of its own, Dormont a nearby branch's, and
    // Kroger Banksville neither. Asked without prices, the answer has none.
    const nearby = () =>
      recordMock(StorePlacesDocument, {
        dataFor: (vars): MockDataFor<typeof StorePlacesDocument> => {
          const row = (
            id: string,
            name: string,
            own: boolean,
            standIn: boolean,
          ): NonNullable<
            MockDataFor<typeof StorePlacesDocument>['storePlaces']
          >[number] => ({
            placeId: null,
            name,
            address: null,
            credit: null,
            distanceKm: 1,
            store: {
              id,
              name,
              address: null,
              storeNumber: null,
              chain: null,
              ...(vars.withPrices
                ? {
                    hasCollectedPrices: own,
                    priceStandIn: standIn
                      ? { __typename: 'PriceStandIn' }
                      : null,
                  }
                : {}),
            },
          });
          return {
            storePlaces: [
              row('s-ge-ml', 'Giant Eagle Mt. Lebanon', true, false),
              row('s-ge-d', 'Giant Eagle Dormont', false, true),
              row('s-kr-b', 'Kroger Banksville', false, false),
            ],
          };
        },
      });
    const listNear15220 = async () => {
      fireEvent.changeText(
        screen.getByTestId(catalogTestIDs.storePickerZip),
        '15220',
      );
      await drainTimers();
      expect(screen.getByText('Kroger Banksville')).toBeTruthy();
    };
    const markOn = (storeId: string) =>
      within(
        screen.getByTestId(catalogTestIDs.storePickerRow(`store:${storeId}`)),
      ).queryByText('Has prices');

    it("marks a store priced from its own shelf prices or a nearby branch's", async () => {
      jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
      const near = nearby();
      renderPicker([near.mock]);

      await listNear15220();

      expect(near.fired).toEqual([
        expect.objectContaining({ withPrices: true }),
      ]);
      expect(markOn('s-ge-ml')).toBeTruthy();
      expect(markOn('s-ge-d')).toBeTruthy();
      expect(markOn('s-kr-b')).toBeNull();
    });

    it('marks none, and asks for no prices, with Budget & prices off', async () => {
      const near = nearby();
      renderPicker([near.mock]);

      await listNear15220();

      expect(near.fired).toEqual([
        expect.objectContaining({ withPrices: false }),
      ]);
      expect(screen.queryByText('Has prices')).toBeNull();
    });
  });

  describe('stores near me', () => {
    const location = () => requirePlatform('approximateLocation');
    // The mock's one `focus` is shared by every input; its `this` says which.
    const zipField = expect.objectContaining({
      props: expect.objectContaining({ testID: catalogTestIDs.storePickerZip }),
    });

    it('asks nothing when the picker opens', () => {
      const access = jest.spyOn(location(), 'access');
      renderPicker([]);

      expect(screen.getByText('Stores near me')).toBeTruthy();
      expect(screen.queryByText('Find stores near you')).toBeNull();
      expect(access).not.toHaveBeenCalled();
    });

    it('explains before the OS asks, and a decline leaves the zip code with no second prompt', async () => {
      jest.spyOn(location(), 'access').mockResolvedValue(null);
      const requestAccess = jest.spyOn(location(), 'requestAccess');
      const focus = jest.spyOn(TextInput.prototype, 'focus');
      renderPicker([]);

      fireEvent.press(screen.getByText('Stores near me'));
      await drainTimers();
      expect(screen.getByText('Find stores near you')).toBeTruthy();
      expect(requestAccess).not.toHaveBeenCalled();

      fireEvent.press(screen.getByText('Not now'));

      await drainTimers();
      expect(focus.mock.contexts).toContainEqual(zipField);
      expect(screen.queryByText('Stores near me')).toBeNull();
      expect(requestAccess).not.toHaveBeenCalled();
    });

    it("offers the zip code when the OS prompt is declined, and doesn't ask again", async () => {
      jest.spyOn(location(), 'access').mockResolvedValue(null);
      const requestAccess = jest
        .spyOn(location(), 'requestAccess')
        .mockResolvedValue('denied');
      const focus = jest.spyOn(TextInput.prototype, 'focus');
      renderPicker([]);

      fireEvent.press(screen.getByText('Stores near me'));
      await drainTimers();
      fireEvent.press(
        screen.getByTestId(catalogTestIDs.storePickerNearMeContinue),
      );

      await drainTimers();
      expect(focus.mock.contexts).toContainEqual(zipField);
      expect(screen.queryByText('Stores near me')).toBeNull();
      expect(requestAccess).toHaveBeenCalledTimes(1);
    });

    const nothingNear = () =>
      recordMock(StorePlacesDocument, { data: { storePlaces: [] } }).mock;

    it('keeps a typed zip when the device cannot say where it is', async () => {
      jest.spyOn(location(), 'access').mockResolvedValue('granted');
      jest.spyOn(location(), 'currentPlace').mockResolvedValue(null);
      renderPicker([nothingNear()]);
      typeZip('15221');

      fireEvent.press(screen.getByText('Stores near me'));

      await drainTimers();
      expect(
        screen.getByTestId(catalogTestIDs.storePickerZip),
      ).toHaveDisplayValue('15221');
    });

    it('lists stores near the device in place of the zip once it is found', async () => {
      jest.spyOn(location(), 'access').mockResolvedValue('granted');
      jest
        .spyOn(location(), 'currentPlace')
        .mockResolvedValue({ lat: 40.44, lng: -79.88 });
      renderPicker([nothingNear(), nothingNear()]);
      typeZip('15221');

      fireEvent.press(screen.getByText('Stores near me'));

      await drainTimers();
      expect(
        screen.getByTestId(catalogTestIDs.storePickerZip),
      ).toHaveDisplayValue('');
    });
  });
});
