import { act, waitFor } from '@testing-library/react-native';
import { gql, type TypedDocumentNode } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { useFragmentList } from '../useFragmentList';

type Batch = {
  __typename: 'PantryItemBatch';
  id: string;
  batchNumber: number;
  notes: string | null;
};

const BATCH: TypedDocumentNode<Batch> = gql`
  fragment UseFragmentListTest_batch on PantryItemBatch {
    id
    batchNumber
    notes
  }
`;

const batch = (id: string, batchNumber: number): Batch => ({
  __typename: 'PantryItemBatch',
  id,
  batchNumber,
  notes: null,
});

const key = (id: string) => ({ __typename: 'PantryItemBatch', id });

function renderList(ids: string[], seeded: Batch[]) {
  const cache = seedCache(
    seeded.map(data => ({
      data,
      fragment: BATCH,
      fragmentName: 'UseFragmentListTest_batch',
    })),
  );
  const rendered = renderHookWithApollo(
    () =>
      useFragmentList({
        fragment: BATCH,
        fragmentName: 'UseFragmentListTest_batch',
        from: ids.map(key),
      }),
    { cache },
  );
  return { cache, ...rendered };
}

describe('useFragmentList', () => {
  it('reads one entry per ref, in order', () => {
    const { result } = renderList(
      ['b2', 'b1'],
      [batch('b1', 1), batch('b2', 2)],
    );

    expect(result.current.map(b => b?.batchNumber)).toEqual([2, 1]);
  });

  it("re-renders when one entry's own field changes", async () => {
    const { cache, result } = renderList(
      ['b1', 'b2'],
      [batch('b1', 1), batch('b2', 2)],
    );

    await act(async () => {
      cache.modify({
        id: cache.identify(key('b2')),
        fields: { batchNumber: () => 7 },
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.map(b => b?.batchNumber)).toEqual([1, 7]),
    );
  });

  // Counted rather than dropped: the caller decides what an unreadable entry
  // means for its totals.
  it('holds null in the place of an entry not completely cached', () => {
    const { result } = renderList(['b1', 'b2'], [batch('b1', 1)]);

    expect(result.current).toHaveLength(2);
    expect(result.current[0]?.batchNumber).toBe(1);
    expect(result.current[1]).toBeNull();
  });

  it('turns an entry null when a field it reads leaves the cache', async () => {
    const { cache, result } = renderList(
      ['b1', 'b2'],
      [batch('b1', 1), batch('b2', 2)],
    );

    await act(async () => {
      cache.evict({ id: cache.identify(key('b1')), fieldName: 'notes' });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current[0]).toBeNull());
    expect(result.current[1]?.batchNumber).toBe(2);
  });
});
