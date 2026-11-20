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
    expect(result.current.map(({ id, version }) => ({ id, version }))).toEqual([
      { id: IN_04.purchaseId, version: 3 },
      { id: 'older', version: 3 },
    ]);
    expect(result.current[0]?.amount).toBe('12 pc');
  });

  it('offers none for a line naming no product', async () => {
    const asked = purchases();
    const { result } = renderHookWithApollo(() => useEarlierPurchases(null), {
      operationMocks: [asked.mock],
    });
    await drainTimers();

    expect(result.current).toEqual([]);
    expect(asked.fired).toHaveLength(0);
  });
});
