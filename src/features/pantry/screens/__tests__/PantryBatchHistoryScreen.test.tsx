'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { GetPantryItemBatchHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { PantryBatchHistoryScreen } from '../PantryBatchHistoryScreen';

jest.mock('#hooks/navigation/useAppNavigation');

const route = {
  params: { pantryItemId: 'pi1', itemName: 'oregano', unitSymbol: 'bunch' },
};

/** The server returns newest first; active batches are NOT already grouped. */
function historyMock(
  batches: Array<{
    id: string;
    batchNumber: number;
    quantity: number;
    status: BatchStatus;
    expiresAt?: string | null;
    depletedAt?: string | null;
  }>,
  page?: { totalCount?: number; hasNextPage?: boolean },
) {
  return recordMock(GetPantryItemBatchHistoryDocument, {
    data: {
      pantryItemBatchesConnection: {
        __typename: 'PantryItemBatchConnection' as const,
        totalCount: page?.totalCount ?? batches.length,
        pageInfo: {
          __typename: 'PageInfo' as const,
          hasNextPage: page?.hasNextPage ?? false,
          endCursor: page?.hasNextPage ? 'c1' : null,
        },
        edges: batches.map(b => ({
          __typename: 'PantryItemBatchEdge' as const,
          node: {
            __typename: 'PantryItemBatch' as const,
            id: b.id,
            batchNumber: b.batchNumber,
            quantity: b.quantity,
            status: b.status,
            expiresAt: b.expiresAt ?? null,
            depletedAt: b.depletedAt ?? null,
            costPerUnit: null,
            totalCost: null,
          },
        })),
      },
    },
  }).mock;
}

describe('PantryBatchHistoryScreen', () => {
  it('counts the active batches, which a masked edge cannot answer', async () => {
    // `edge.node` arrives MASKED, so reading `.status` off it yields undefined
    // and every batch counts as inactive. The screen materializes first.
    renderWithApollo(<PantryBatchHistoryScreen route={route} />, {
      operationMocks: [
        historyMock([
          { id: 'b3', batchNumber: 3, quantity: 1, status: BatchStatus.Wasted },
          { id: 'b2', batchNumber: 2, quantity: 3, status: BatchStatus.Active },
          { id: 'b1', batchNumber: 1, quantity: 5, status: BatchStatus.Active },
        ]),
      ],
    });

    expect(await screen.findByText('2 active of 3')).toBeTruthy();
  });

  it('does not report a loaded-window count against the whole total', async () => {
    // 2 of the 3 loaded are active, but 40 batches exist. "2 active of 40" is a
    // claim about the pantry that would climb as the reader scrolls it.
    renderWithApollo(<PantryBatchHistoryScreen route={route} />, {
      operationMocks: [
        historyMock(
          [
            {
              id: 'b3',
              batchNumber: 3,
              quantity: 1,
              status: BatchStatus.Wasted,
            },
            {
              id: 'b2',
              batchNumber: 2,
              quantity: 3,
              status: BatchStatus.Active,
            },
            {
              id: 'b1',
              batchNumber: 1,
              quantity: 5,
              status: BatchStatus.Active,
            },
          ],
          { totalCount: 40, hasNextPage: true },
        ),
      ],
    });

    expect(await screen.findByText('40 batches')).toBeTruthy();
    expect(screen.queryByText('2 active of 40')).toBeNull();
  });

  it('orders active batches by expiry, as the detail section does', async () => {
    // `BatchSection` shows active batches FIFO. Ordering by batchNumber here
    // reorders the rows the reader was looking at when they tapped View all.
    renderWithApollo(<PantryBatchHistoryScreen route={route} />, {
      operationMocks: [
        historyMock([
          {
            id: 'b1',
            batchNumber: 1,
            quantity: 5,
            status: BatchStatus.Active,
            expiresAt: '2026-12-01T00:00:00Z',
          },
          {
            id: 'b2',
            batchNumber: 2,
            quantity: 3,
            status: BatchStatus.Active,
            expiresAt: '2026-09-01T00:00:00Z',
          },
        ]),
      ],
    });

    await screen.findByText('2 active of 2');
    const rows = screen.getAllByText(/Batch #/);

    // #2 expires first, so it leads despite the lower batch number on #1.
    expect(rows.map(r => r.props.children)).toEqual(['Batch #2', 'Batch #1']);
  });

  it('names the event that emptied the batch, not always depletion', async () => {
    // `depletedAt` is when the batch reached zero, whichever way — so a WASTED
    // batch carries one too. Hardcoding the "Depleted" label put that word
    // directly under a "Wasted" badge on the same row.
    renderWithApollo(<PantryBatchHistoryScreen route={route} />, {
      operationMocks: [
        historyMock([
          {
            id: 'b1',
            batchNumber: 1,
            quantity: 0,
            status: BatchStatus.Wasted,
            depletedAt: '2026-08-31T00:00:00Z',
          },
        ]),
      ],
    });

    // Date rendered in the runner's zone, so match the LABEL, not the day.
    expect(await screen.findByText(/^Wasted \w+ \d+$/)).toBeTruthy();
    expect(screen.queryByText(/^Depleted /)).toBeNull();
  });

  it('still says depleted for a batch that was used up', async () => {
    renderWithApollo(<PantryBatchHistoryScreen route={route} />, {
      operationMocks: [
        historyMock([
          {
            id: 'b1',
            batchNumber: 1,
            quantity: 0,
            status: BatchStatus.Depleted,
            depletedAt: '2026-08-31T00:00:00Z',
          },
        ]),
      ],
    });

    expect(await screen.findByText(/^Depleted \w+ \d+$/)).toBeTruthy();
  });

  it('shows the empty state when the item has no batches', async () => {
    renderWithApollo(<PantryBatchHistoryScreen route={route} />, {
      operationMocks: [historyMock([])],
    });

    expect(await screen.findByText('No batches yet')).toBeTruthy();
  });
});
