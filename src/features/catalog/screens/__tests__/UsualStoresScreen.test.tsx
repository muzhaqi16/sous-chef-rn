import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import {
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import {
  writeUsualStores,
  type UsualStoreEntry,
} from '#features/catalog/cache/usualStores';
import { UsualStoresDocument } from '#features/catalog/hooks/useUsualStores.generated';
import {
  AddUsualStoreDocument,
  RemoveUsualStoreDocument,
  UpdateUsualStoreDocument,
} from '#features/catalog/hooks/useUsualStoreWrites.generated';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { UsualStoresScreen } from '../UsualStoresScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');

const mockSuccess = toastService.success as jest.Mock;

const entry = (
  storeId: string,
  name: string,
  over: Partial<UsualStoreEntry> = {},
): UsualStoreEntry => ({
  __typename: 'UsualStore',
  id: `home-1:${storeId}`,
  addedVia: UsualStoreSource.Receipt,
  pinned: false,
  compared: true,
  lastUsedAt: '2026-10-20T12:00:00.000Z',
  store: { __typename: 'Store', id: storeId, name, address: null, chain: null },
  chain: null,
  ...over,
});

const banksville = entry('s1', 'Giant Eagle Banksville');
const marketDistrict = entry('s2', 'Giant Eagle Market District', {
  lastUsedAt: '2026-10-10T12:00:00.000Z',
});

const route = {
  key: 'UsualStores',
  name: 'UsualStores' as const,
  params: { homeId: 'home-1' },
};

const renderScreen = (
  mocks: ReturnType<typeof recordMock>['mock'][],
  cached: UsualStoreEntry[] | null = [banksville, marketDistrict],
) => {
  const cache = makeCache();
  if (cached) writeUsualStores(cache, 'home-1', cached);
  return renderWithApollo(<UsualStoresScreen route={route} />, {
    cache,
    operationMocks: mocks,
  });
};

const answering = (usualStores: UsualStoreEntry[]) =>
  recordMock(UsualStoresDocument, { data: { usualStores } });

const rowOf = (name: string) => screen.getByLabelText(new RegExp(`^${name}`));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UsualStoresScreen', () => {
  // The screen reads cache-and-network, so each open shows the server's list.
  it("shows a store another member added once the server answers", async () => {
    const aldi = entry('s3', 'ALDI Wilkinsburg', {
      addedVia: UsualStoreSource.Picked,
    });
    renderScreen([answering([banksville, marketDistrict, aldi]).mock]);

    expect(await screen.findByText('Giant Eagle Banksville')).toBeTruthy();
    expect(await screen.findByText('ALDI Wilkinsburg')).toBeTruthy();
    expect(screen.getByText(/Added by your household/)).toBeTruthy();
  });

  it('says how each store came and when it was last used', async () => {
    renderScreen([answering([banksville]).mock]);

    expect(
      await screen.findByText('From a receipt · Last used Oct 20'),
    ).toBeTruthy();
  });

  it('marks a store unused for 90 days as not compared', async () => {
    renderScreen([
      answering([entry('s1', 'Giant Eagle Banksville', { compared: false })])
        .mock,
    ]);

    expect(
      await screen.findByText('Not compared: unused for 90 days'),
    ).toBeTruthy();
  });

  it('shows a pin at once', async () => {
    const pin = recordMock(UpdateUsualStoreDocument, {
      data: {
        updateUsualStore: {
          __typename: 'UpdateUsualStorePayload',
          usualStores: [{ ...marketDistrict, pinned: true }, banksville],
        },
      },
    });
    renderScreen([answering([banksville, marketDistrict]).mock, pin.mock]);
    await screen.findByText('Giant Eagle Market District');

    fireEvent.press(screen.getByTestId(catalogTestIDs.usualStorePin('store:s2')));

    expect(await screen.findByText('Pinned')).toBeTruthy();
    expect(pin.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true } },
    ]);
  });

  it('removes a store, and Undo brings it back', async () => {
    const remove = recordMock(RemoveUsualStoreDocument, {
      data: {
        removeUsualStore: {
          __typename: 'RemoveUsualStorePayload',
          usualStores: [banksville],
        },
      },
    });
    const add = recordMock(AddUsualStoreDocument, {
      data: {
        addUsualStore: {
          __typename: 'AddUsualStorePayload',
          usualStores: [banksville, marketDistrict],
        },
      },
    });
    renderScreen([
      answering([banksville, marketDistrict]).mock,
      remove.mock,
      add.mock,
    ]);
    await screen.findByText('Giant Eagle Market District');

    fireEvent(rowOf('Giant Eagle Market District'), 'accessibilityAction', {
      nativeEvent: { actionName: 'remove' },
    });

    await waitFor(() =>
      expect(screen.queryByText('Giant Eagle Market District')).toBeNull(),
    );
    expect(mockSuccess).toHaveBeenCalledWith(
      'Removed Giant Eagle Market District',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Undo' }),
      }),
    );

    act(() => {
      mockSuccess.mock.calls[0][1].action.onPress();
    });

    expect(await screen.findByText('Giant Eagle Market District')).toBeTruthy();
    expect(add.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's2' } } },
    ]);
  });

  it('shows the cached stores offline', async () => {
    useStore.setState({ isOnline: false });
    const offline = recordMock(UsualStoresDocument, {
      error: new Error('Network request failed'),
    });
    renderScreen([offline.mock]);

    expect(await screen.findByText('Giant Eagle Banksville')).toBeTruthy();
    expect(screen.getByText('Giant Eagle Market District')).toBeTruthy();
    useStore.setState({ isOnline: true });
  });

  it('says where stores come from while there are none', async () => {
    renderScreen([answering([]).mock], null);

    expect(await screen.findByText('No stores yet')).toBeTruthy();
    expect(
      screen.getByText(
        "Stores show here once you scan a receipt, shop in store mode or set a list's store.",
      ),
    ).toBeTruthy();
  });
});
