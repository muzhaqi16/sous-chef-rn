import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import type { PendingWrite } from '#/apollo/pendingWrites/types';
import {
  completeSeed,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { seedDraft } from '../../__tests__/helpers/receiptFixtures';
import { CreateReceiptCheckInDocument } from '../../hooks/useReceiptCheckIn.generated';
import {
  checkIn,
  type CheckInInputs,
  type LocalCheckInLine,
} from '../localWrites';

const NOW = '2026-10-30T10:00:00.000Z';
const PANTRY_ID = 'pantry-1';

const PANTRY = gql`
  query LocalWritesPantry {
    pantry(id: "pantry-1") {
      id
      stats {
        totalItems
      }
      itemsConnection(filters: {}, orderBy: {}) {
        totalCount
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

const STOCK = gql`
  fragment LocalWritesStock on PantryItem {
    quantity
    createdAt
  }
`;

type Pantry = {
  pantry: {
    stats: { totalItems: number };
    itemsConnection: { edges: { node: { id: string } }[] };
  };
};

function setup() {
  const cache = makeCache();
  seedQuery(cache, {
    query: PANTRY,
    data: {
      pantry: {
        __typename: 'Pantry',
        id: PANTRY_ID,
        stats: { __typename: 'PantryStats', totalItems: 1 },
        itemsConnection: {
          __typename: 'PantryItemConnection',
          totalCount: 1,
          edges: [
            {
              __typename: 'PantryItemEdge',
              node: { __typename: 'PantryItem', id: 'held' },
            },
          ],
        },
      },
    },
  });
  seedFragment(cache, {
    id: 'PantryItem:held',
    fragment: STOCK,
    data: { __typename: 'PantryItem', id: 'held', quantity: 3, createdAt: NOW },
  });
  const table = { CreateReceiptCheckIn: checkIn };
  return { cache, writes: new PendingWrites(cache, table) };
}

type Setup = ReturnType<typeof setup>;

const shown = ({ cache }: Setup, optimistic = true) => {
  const pantry = cache.readQuery<Pantry>({ query: PANTRY, optimistic })?.pantry;
  return {
    ids: pantry?.itemsConnection.edges.map(({ node }) => node.id),
    total: pantry?.stats.totalItems,
  };
};

const stock = ({ cache }: Setup, id: string, optimistic = true) =>
  cache.readFragment<{ quantity: number; createdAt: string }>({
    id: `PantryItem:${id}`,
    fragment: STOCK,
    optimistic,
  });

const line = (id: string, itemName = 'Milk'): LocalCheckInLine => ({
  stack: { id, row: { pantryId: PANTRY_ID, itemName, quantity: 1 } },
});

const recordOf = (
  { writes }: Setup,
  lines: LocalCheckInLine[],
  id = 'check-in-1',
) => {
  const inputs: CheckInInputs = { pantryId: PANTRY_ID, lines, now: NOW };
  return writes.begin(
    CreateReceiptCheckInDocument,
    {
      input: {
        id,
        pantryId: PANTRY_ID,
        lines: lines.map(({ stack }, index) => ({
          clientId: String(index),
          pantryItemId: stack?.id,
        })),
      },
    },
    inputs,
  );
};

/** The server answers: Apollo writes it to the root, then the write commits. */
function answered(
  { cache, writes }: Setup,
  { id, document, variables }: PendingWrite,
  results: Record<string, unknown>[],
  totalItems: number,
): void {
  const stated = completeSeed(document, variables, {
    createReceiptCheckIn: {
      __typename: 'CreateReceiptCheckInPayload',
      receiptCheckIn: { __typename: 'ReceiptCheckIn', id: 'check-in-1' },
      pantry: {
        __typename: 'Pantry',
        id: PANTRY_ID,
        stats: { __typename: 'PantryStats', totalItems },
      },
      results,
    },
  });
  seedQuery(cache, {
    id: 'ROOT_MUTATION',
    query: document,
    variables,
    data: stated,
  });
  writes.confirm(id, stated);
  writes.rebuild();
}

const recorded = (index: number, id: string, quantity: number) => ({
  __typename: 'ReceiptCheckInLineResult',
  index,
  clientId: String(index),
  success: true,
  pantryItem: { __typename: 'PantryItem', id, quantity },
});

const refused = (index: number) => ({
  __typename: 'ReceiptCheckInLineResult',
  index,
  clientId: String(index),
  success: false,
  failure: {
    __typename: 'ReceiptCheckInLineFailure',
    code: 'VALIDATION_FAILED',
  },
  pantryItem: null,
});

describe('a check-in', () => {
  it('shows every line and counts each once, however often it is rebuilt', () => {
    const screen = setup();

    recordOf(screen, [line('line-a'), line('line-b', 'Eggs')]);
    screen.writes.rebuild();
    screen.writes.rebuild();

    expect(shown(screen)).toEqual({
      ids: ['line-b', 'line-a', 'held'],
      total: 3,
    });
    expect(shown(screen, false)).toEqual({ ids: ['held'], total: 1 });
  });

  it('dates each row when it was made, not when it is rebuilt', () => {
    const screen = setup();

    recordOf(screen, [line('line-a')]);
    screen.writes.rebuild();

    expect(stock(screen, 'line-a')).toMatchObject({ createdAt: NOW });
  });

  it('leaves nothing when refused whole', () => {
    const screen = setup();

    screen.writes.drop(recordOf(screen, [line('line-a')]).id);

    expect(shown(screen)).toEqual({ ids: ['held'], total: 1 });
    expect(screen.cache.extract(true)['PantryItem:line-a']).toBeUndefined();
  });

  it('keeps the lines the server took, with the count it states', () => {
    const screen = setup();

    answered(
      screen,
      recordOf(screen, [line('line-a'), line('line-b', 'Eggs')]),
      [recorded(0, 'line-a', 1), recorded(1, 'line-b', 1)],
      3,
    );

    expect(shown(screen, false)).toEqual({
      ids: ['line-b', 'line-a', 'held'],
      total: 3,
    });
  });

  it('withdraws a line the server refused and keeps the rest', () => {
    const screen = setup();

    answered(
      screen,
      recordOf(screen, [line('line-a'), line('line-b', 'Eggs')]),
      [recorded(0, 'line-a', 1), refused(1)],
      2,
    );

    expect(shown(screen)).toEqual({ ids: ['line-a', 'held'], total: 2 });
    expect(screen.cache.extract(true)['PantryItem:line-b']).toBeUndefined();
  });

  // The count is the server's, so a row that took two lines counts once.
  it('ends two lines of one product on one row, at the amount the server states', () => {
    const screen = setup();

    answered(
      screen,
      recordOf(screen, [line('line-a'), line('line-b')]),
      [recorded(0, 'line-a', 2), recorded(1, 'line-a', 2)],
      2,
    );

    expect(shown(screen, false)).toEqual({ ids: ['line-a', 'held'], total: 2 });
    expect(shown(screen)).toEqual({ ids: ['line-a', 'held'], total: 2 });
    expect(stock(screen, 'line-a')).toMatchObject({ quantity: 2 });
    expect(screen.cache.extract(true)['PantryItem:line-b']).toBeUndefined();
  });

  it('adds a line merged into a held stack to that row, and no count', () => {
    const screen = setup();

    answered(
      screen,
      recordOf(screen, [line('line-a')]),
      [recorded(0, 'held', 4)],
      1,
    );

    expect(shown(screen)).toEqual({ ids: ['held'], total: 1 });
    expect(stock(screen, 'held')).toMatchObject({ quantity: 4 });
  });
});

describe('a queued check-in refused for good', () => {
  beforeEach(() => {
    useReceiptDraftStore.setState({ draft: null });
    seedDraft();
    useReceiptDraftStore.getState().ensureCheckInIds([0], 1);
    useReceiptDraftStore.getState().markAdded([0]);
    useReceiptDraftStore.getState().setCheckInState('queued');
  });

  it('takes its rows back, and puts its lines back to send on the receipt', () => {
    const screen = setup();
    const checkInId = useReceiptDraftStore.getState().draft?.checkIn?.ids[0];

    screen.writes.refuse(recordOf(screen, [line('line-a')], checkInId).id);

    expect(shown(screen)).toEqual({ ids: ['held'], total: 1 });
    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.added).toEqual([]);
    expect(draft?.failed).toEqual({ 0: null });
  });
});
