import React from 'react';
import { TextInput } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
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
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreateOutcome,
  UsualStoreSource,
} from '#/graphql/generated/schemaTypes';
import { SearchStoresDocument } from '#operations/store/store.generated';
import {
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { CreateStoreDocument } from '#features/catalog/hooks/useCreateStore.generated';
import { AddUsualStoreDocument } from '#features/catalog/hooks/useUsualStoreWrites.generated';
import { NearbyStoresDocument } from '#features/catalog/hooks/useStoreSearch.generated';
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

const renderPicker = (mocks: ReturnType<typeof recordMock>['mock'][]) => {
  const cache = makeCache();
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
  return renderWithApollo(<StorePickerScreen route={route} />, {
    cache,
    operationMocks: mocks,
  });
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

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  useStore.setState({ isOnline: true });
  useStorePickerStore.setState({ lastZip: null });
});

describe('StorePickerScreen', () => {
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
    fireEvent.press(
      await screen.findByText("Not listed? Add “Pete's Corner Market”"),
    );

    await waitFor(() => expect(add.fired).toHaveLength(1));
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
    fireEvent.press(await screen.findByText('ALDI (any store)'));

    await waitFor(() =>
      expect(add.fired).toEqual([
        { input: { homeId: 'home-1', target: { chainId: 'chain-aldi' } } },
      ]),
    );
    await waitFor(() =>
      expect(toastService.success).toHaveBeenCalledWith('Added to your stores'),
    );
    expect(useAppNavigation().goBack).toHaveBeenCalled();
  });

  it("marks a store the household has, and doesn't add it twice", async () => {
    const add = adding();
    renderPicker([searching([banksville]).mock, add.mock]);

    type('giant');
    fireEvent.press(await screen.findByText('Giant Eagle Banksville'));

    expect(screen.getByText('Added')).toBeTruthy();
    expect(add.fired).toEqual([]);
  });

  it("says finding stores needs a connection, and lists the household's", () => {
    useStore.setState({ isOnline: false });
    renderPicker([]);

    expect(screen.getByText('Finding stores needs a connection')).toBeTruthy();
    expect(screen.getByText('Giant Eagle Banksville')).toBeTruthy();
    expect(
      screen.queryByPlaceholderText('Search by store name or address'),
    ).toBeNull();
  });

  it('searches a store name as typed, never autocorrected', () => {
    renderPicker([]);

    expect(
      screen.getByPlaceholderText('Search by store name or address').props,
    ).toMatchObject({ autoCorrect: false });
  });

  describe('the prices mark', () => {
    // Mt. Lebanon has shelf prices of its own, Dormont a nearby branch's, and
    // Kroger Banksville neither. Asked without prices, the answer has none.
    const nearby = () =>
      recordMock(NearbyStoresDocument, {
        dataFor: (vars): MockDataFor<typeof NearbyStoresDocument> => {
          const row = (
            id: string,
            name: string,
            own: boolean,
            standIn: boolean,
          ): NonNullable<
            MockDataFor<typeof NearbyStoresDocument>['nearbyStores']
          >[number] => ({
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
            nearbyStores: [
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
      await screen.findByText('Kroger Banksville');
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
      expect(await screen.findByText('Find stores near you')).toBeTruthy();
      expect(requestAccess).not.toHaveBeenCalled();

      fireEvent.press(screen.getByText('Not now'));

      await waitFor(() => expect(focus.mock.contexts).toContainEqual(zipField));
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
      fireEvent.press(
        await screen.findByTestId(catalogTestIDs.storePickerNearMeContinue),
      );

      await waitFor(() => expect(focus.mock.contexts).toContainEqual(zipField));
      expect(screen.queryByText('Stores near me')).toBeNull();
      expect(requestAccess).toHaveBeenCalledTimes(1);
    });
  });
});
