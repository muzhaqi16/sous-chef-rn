import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
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
import { StorePickerScreen } from '../StorePickerScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');

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
});

afterEach(() => {
  jest.useRealTimers();
  useStore.setState({ isOnline: true });
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
});
