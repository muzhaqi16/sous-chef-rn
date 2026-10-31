import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { createLocalWritePrecedenceLink } from '#/apollo/links/localWritePrecedenceLink';
import { useStore } from '#store';
import { toastService } from '#/services/toastService';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
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
    // As in production: a read in flight never undoes the screen's writes.
    links: [createLocalWritePrecedenceLink()],
  });
};

const answering = (usualStores: UsualStoreEntry[]) =>
  recordMock(UsualStoresDocument, { data: { usualStores } });

const rowOf = (name: string) => screen.getByLabelText(new RegExp(`^${name}`));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('UsualStoresScreen', () => {
  // The screen reads cache-and-network, so each open shows the server's list.
  it('shows a store another member added once the server answers', async () => {
    const aldi = entry('s3', 'ALDI Wilkinsburg', {
      addedVia: UsualStoreSource.Picked,
    });
    renderScreen([answering([banksville, marketDistrict, aldi]).mock]);

    await drainTimers();
    expect(screen.getByText('Giant Eagle Banksville')).toBeTruthy();
    await drainTimers();
    expect(screen.getByText('ALDI Wilkinsburg')).toBeTruthy();
    expect(screen.getByText(/Added by your household/)).toBeTruthy();
  });

  it('says how each store came and when it was last used', async () => {
    renderScreen([answering([banksville]).mock]);

    await drainTimers();
    expect(screen.getByText('From a receipt · Last used Oct 20')).toBeTruthy();
  });

  it('marks a store unused for 90 days as not compared', async () => {
    renderScreen([
      answering([entry('s1', 'Giant Eagle Banksville', { compared: false })])
        .mock,
    ]);

    await drainTimers();
    expect(screen.getByText('Not compared: unused for 90 days')).toBeTruthy();
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
    await drainTimers();
    expect(screen.getByText('Giant Eagle Market District')).toBeTruthy();

    fireEvent.press(
      screen.getByTestId(catalogTestIDs.usualStorePin('store:s2')),
    );

    await drainTimers();
    expect(screen.getByText('Pinned')).toBeTruthy();
    expect(pin.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: true } },
    ]);
  });

  it('keeps a pin made while the list is refreshing, and one more tap unpins it', async () => {
    const refresh = recordMock(UsualStoresDocument, {
      data: { usualStores: [banksville, marketDistrict] },
      held: true,
      maxUsageCount: 1,
    });
    // Asked again after the pin, so the server's answer holds it.
    const reread = answering([{ ...marketDistrict, pinned: true }, banksville]);
    const pinTo = (pinned: boolean) =>
      recordMock(UpdateUsualStoreDocument, {
        match: vars => (vars.input as { pinned?: boolean }).pinned === pinned,
        data: {
          updateUsualStore: {
            __typename: 'UpdateUsualStorePayload',
            usualStores: [{ ...marketDistrict, pinned }, banksville],
          },
        },
      });
    const pin = pinTo(true);
    const unpin = pinTo(false);
    renderScreen([refresh.mock, reread.mock, pin.mock, unpin.mock]);
    await drainTimers();
    expect(screen.getByText('Giant Eagle Market District')).toBeTruthy();
    await drainTimers();
    expect(refresh.fired).toHaveLength(1);

    fireEvent.press(
      screen.getByTestId(catalogTestIDs.usualStorePin('store:s2')),
    );
    await drainTimers();
    expect(screen.getByText('Pinned')).toBeTruthy();

    await act(async () => {
      refresh.release();
    });
    await drainTimers();
    expect(reread.fired).toHaveLength(1);
    expect(screen.getByText('Pinned')).toBeTruthy();

    fireEvent.press(
      screen.getByTestId(catalogTestIDs.usualStorePin('store:s2')),
    );
    await drainTimers();
    expect(screen.queryByText('Pinned')).toBeNull();
    expect(pin.fired).toHaveLength(1);
    expect(unpin.fired).toEqual([
      { input: { homeId: 'home-1', target: { storeId: 's2' }, pinned: false } },
    ]);
  });

  it('removes a store, and Undo brings it back', async () => {
    const remove = recordMock(RemoveUsualStoreDocument, {
      data: {
        removeUsualStore: {
          __typename: 'RemoveUsualStorePayload',
          usualStores: [{ id: banksville.id }],
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
    await drainTimers();
    expect(screen.getByText('Giant Eagle Market District')).toBeTruthy();

    fireEvent(rowOf('Giant Eagle Market District'), 'accessibilityAction', {
      nativeEvent: { actionName: 'remove' },
    });

    await drainTimers();
    expect(screen.queryByText('Giant Eagle Market District')).toBeNull();
    expect(mockSuccess).toHaveBeenCalledWith(
      'Removed Giant Eagle Market District',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Undo' }),
      }),
    );

    act(() => {
      mockSuccess.mock.calls[0][1].action.onPress();
    });

    await drainTimers();
    expect(screen.getByText('Giant Eagle Market District')).toBeTruthy();
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

    await drainTimers();
    expect(screen.getByText('Giant Eagle Banksville')).toBeTruthy();
    expect(screen.getByText('Giant Eagle Market District')).toBeTruthy();
    useStore.setState({ isOnline: true });
  });

  it('says where stores come from while there are none', async () => {
    renderScreen([answering([]).mock], null);

    await drainTimers();
    expect(screen.getByText('No stores yet')).toBeTruthy();
    expect(
      screen.getByText(
        "Stores show here once you scan a receipt, shop in store mode or set a list's store.",
      ),
    ).toBeTruthy();
  });
});
