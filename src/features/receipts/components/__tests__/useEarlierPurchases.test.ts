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
import {
  EarlierPurchasesOfStackDocument,
  HeldStacksOfItemDocument,
} from '../useEarlierPurchases.generated';

jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => ({
    pantry: { id: 'P1', name: 'Kitchen' },
    currentHome: { id: 'H1' },
  }),
}));

const IN_04 = examples['IN-04'];
const ME = 'actor-A';

const stacks = () =>
  recordMock(HeldStacksOfItemDocument, {
    data: {
      pantry: {
        id: 'P1',
        itemsConnection: { edges: [{ node: { id: 'P1-eggs' } }] },
      },
    },
  });

const purchase = (
  id: string,
  purchaseDate: string,
  buyer: string,
  quantity = 12,
) => ({
  node: {
    id: `batch-${id}`,
    purchase: {
      id,
      version: 3,
      purchaseDate,
      quantity,
      unitSymbol: 'pc',
      purchasedBy: { id: buyer },
    },
  },
});

const batches = () =>
  recordMock(EarlierPurchasesOfStackDocument, {
    data: {
      pantryItemBatchesConnection: {
        edges: [
          purchase('older', '2026-11-10T15:00:00.000Z', ME, 6),
          purchase(IN_04.purchaseId, '2026-11-15T15:00:00.000Z', ME),
          purchase('another-member', '2026-11-15T16:00:00.000Z', 'actor-B'),
          purchase('last-month', '2026-10-20T15:00:00.000Z', ME),
        ],
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
    const { result } = renderHookWithApollo(
      () => useEarlierPurchases('item-eggs'),
      { operationMocks: [stacks().mock, batches().mock] },
    );
    await drainTimers();

    expect(result.current.map(({ id, version }) => ({ id, version }))).toEqual([
      { id: IN_04.purchaseId, version: 3 },
      { id: 'older', version: 3 },
    ]);
    expect(result.current[0]?.amount).toBe('12 pc');
  });

  it('offers none for a line naming no product', async () => {
    const held = stacks();
    const { result } = renderHookWithApollo(() => useEarlierPurchases(null), {
      operationMocks: [held.mock, batches().mock],
    });
    await drainTimers();

    expect(result.current).toEqual([]);
    expect(held.fired).toHaveLength(0);
  });
});
