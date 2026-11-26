import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { useStore } from '#store';
import { pantryTrackingExamples as examples } from '#/test-utils/fixtures/pantryTrackingFixtures';
import { seedDraft } from '../../__tests__/helpers/receiptFixtures';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { useEarlierPurchases } from '../useEarlierPurchases';
import { EarlierPurchasesOfItemDocument } from '../useEarlierPurchases.generated';

jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => ({
    pantry: { id: 'P1', name: 'Kitchen' },
    currentHome: { id: 'H1' },
  }),
}));

const IN_04 = examples['IN-04'];
const ME = 'actor-A';

const purchase = (
  id: string,
  purchaseDate: string,
  buyer: string,
  quantity = 12,
) => ({
  node: {
    id,
    version: 3,
    purchaseDate,
    quantity,
    unitSymbol: 'pc',
    purchasedBy: { id: buyer },
  },
});

// Whichever pantry each stocked: the household's purchases of the item.
const purchases = () =>
  recordMock(EarlierPurchasesOfItemDocument, {
    data: {
      home: {
        id: 'H1',
        purchasesConnection: {
          edges: [
            purchase('older', '2026-11-10T15:00:00.000Z', ME, 6),
            purchase(IN_04.purchaseId, '2026-11-15T15:00:00.000Z', ME),
            purchase('another-member', '2026-11-15T16:00:00.000Z', 'actor-B'),
            purchase('last-month', '2026-10-20T15:00:00.000Z', ME),
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  });

beforeEach(() => {
  jest.useFakeTimers();
  useStore.setState({
    user: {
      id: ME,
      email: 'a@example.com',
      emailVerified: true,
      onBoarded: true,
    },
  });
  seedDraft({ purchasedOn: '2026-11-15' });
});

afterEach(() => {
  jest.useRealTimers();
  useStore.setState({ user: null });
  useReceiptDraftStore.setState({ draft: null });
});

describe('useEarlierPurchases', () => {
  // Only the buyer attaches a receipt, and only to a purchase near its day.
  it("offers the user's own purchases of the item before the receipt's day, newest first", async () => {
    const asked = purchases();
    const { result } = renderHookWithApollo(
      () => useEarlierPurchases('item-eggs'),
      { operationMocks: [asked.mock] },
    );
    await drainTimers();

    expect(asked.fired[0]).toMatchObject({ homeId: 'H1', itemId: 'item-eggs' });
    expect(result.current.state).toBe('ready');
    expect(
      result.current.purchases.map(({ id, version }) => ({ id, version })),
    ).toEqual([
      { id: IN_04.purchaseId, version: 3 },
      { id: 'older', version: 3 },
    ]);
    expect(result.current.purchases[0]?.amount).toBe('12 pc');
  });

  // Until the API filters by buyer, the user's own may sit past the first page.
  it('reads every page before offering any', async () => {
    const asked = recordMock(EarlierPurchasesOfItemDocument, {
      dataFor: vars => ({
        home: {
          id: 'H1',
          purchasesConnection: vars.after
            ? {
                edges: [
                  purchase(IN_04.purchaseId, '2026-11-15T15:00:00.000Z', ME),
                ],
                pageInfo: { hasNextPage: false, endCursor: 'c2' },
              }
            : {
                edges: [
                  purchase('another', '2026-11-14T15:00:00.000Z', 'actor-B'),
                ],
                pageInfo: { hasNextPage: true, endCursor: 'c1' },
              },
        },
      }),
    });
    const { result } = renderHookWithApollo(
      () => useEarlierPurchases('item-eggs'),
      { operationMocks: [asked.mock] },
    );
    await drainTimers();

    expect(asked.fired.map(vars => vars.after ?? null)).toEqual([null, 'c1']);
    expect(result.current.state).toBe('ready');
    expect(result.current.purchases.map(({ id }) => id)).toEqual([
      IN_04.purchaseId,
    ]);
  });

  // Offering none would read as "you bought none".
  it('says it could not check, offline or not', async () => {
    const failed = recordMock(EarlierPurchasesOfItemDocument, {
      error: new Error('Network request failed'),
    });
    useStore.setState({ isOnline: false });
    const offline = renderHookWithApollo(
      () => useEarlierPurchases('item-eggs'),
      { operationMocks: [failed.mock] },
    );
    await drainTimers();
    expect(offline.result.current).toEqual({ purchases: [], state: 'offline' });
    offline.unmount();

    useStore.setState({ isOnline: true, apiReachable: true });
    const online = renderHookWithApollo(
      () => useEarlierPurchases('item-eggs'),
      { operationMocks: [failed.mock] },
    );
    await drainTimers();
    expect(online.result.current).toEqual({ purchases: [], state: 'error' });
  });

  it('offers none for a line naming no product', async () => {
    const asked = purchases();
    const { result } = renderHookWithApollo(() => useEarlierPurchases(null), {
      operationMocks: [asked.mock],
    });
    await drainTimers();

    expect(result.current).toEqual({ purchases: [], state: 'empty' });
    expect(asked.fired).toHaveLength(0);
  });
});
