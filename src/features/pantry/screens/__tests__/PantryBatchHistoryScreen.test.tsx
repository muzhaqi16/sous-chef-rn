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
  }>,
) {
  return recordMock(GetPantryItemBatchHistoryDocument, {
    data: {
      pantryItemBatchesConnection: {
        __typename: 'PantryItemBatchConnection' as const,
        totalCount: batches.length,
        pageInfo: {
          __typename: 'PageInfo' as const,
          hasNextPage: false,
          endCursor: null,
        },
        edges: batches.map(b => ({
          __typename: 'PantryItemBatchEdge' as const,
          node: {
            __typename: 'PantryItemBatch' as const,
            id: b.id,
            batchNumber: b.batchNumber,
            quantity: b.quantity,
            status: b.status,
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

  it('shows the empty state when the item has no batches', async () => {
    renderWithApollo(<PantryBatchHistoryScreen route={route} />, {
      operationMocks: [historyMock([])],
    });

    expect(await screen.findByText('No batches yet')).toBeTruthy();
  });
});
