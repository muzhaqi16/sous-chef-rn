'use no memo';

import { renderHook } from '@testing-library/react-native';
import {
  usePreservedConnection,
  usePreservedNodes,
} from '../usePreservedConnection';

type Node = { id: string };
type Conn = {
  edges: Array<{ node: Node }>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount?: number | null;
};

const conn = (ids: string[], totalCount?: number): Conn => ({
  edges: ids.map(id => ({ node: { id } })),
  pageInfo: { hasNextPage: false, endCursor: null },
  totalCount,
});

describe('usePreservedConnection', () => {
  it('extracts nodes + totalCount + pageInfo from a defined connection', () => {
    const c = conn(['a', 'b'], 2);
    const { result } = renderHook(() => usePreservedConnection(c));

    expect(result.current.nodes).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.pageInfo).toEqual({
      hasNextPage: false,
      endCursor: null,
    });
  });

  it('PRESERVES nodes + totalCount when the connection becomes undefined (network blip)', () => {
    const c = conn(['a', 'b', 'c'], 3);
    const { result, rerender } = renderHook(
      ({ connection }: { connection: Conn | undefined }) =>
        usePreservedConnection(connection),
      { initialProps: { connection: c as Conn | undefined } },
    );

    expect(result.current.nodes).toHaveLength(3);
    expect(result.current.totalCount).toBe(3);

    // errorPolicy:'ignore' / failed refetch → data undefined → connection undefined.
    rerender({ connection: undefined });

    // The list survives the blip — this is the bug fix.
    expect(result.current.nodes).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
    expect(result.current.totalCount).toBe(3);
  });

  it('honors a DEFINED empty connection (e.g. last item deleted) by clearing', () => {
    const populated = conn(['a'], 1);
    const empty = conn([], 0);
    const { result, rerender } = renderHook(
      ({ connection }: { connection: Conn | undefined }) =>
        usePreservedConnection(connection),
      { initialProps: { connection: populated as Conn | undefined } },
    );

    expect(result.current.nodes).toHaveLength(1);

    rerender({ connection: empty });
    expect(result.current.nodes).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('recovers when fresh data arrives after a blip', () => {
    const first = conn(['a'], 1);
    const second = conn(['a', 'b'], 2);
    const { result, rerender } = renderHook(
      ({ connection }: { connection: Conn | undefined }) =>
        usePreservedConnection(connection),
      { initialProps: { connection: first as Conn | undefined } },
    );

    rerender({ connection: undefined });
    expect(result.current.nodes).toHaveLength(1); // preserved

    rerender({ connection: second });
    expect(result.current.nodes).toHaveLength(2); // recovered
  });
});

describe('usePreservedNodes', () => {
  it('returns just the preserved node array and survives an undefined blip', () => {
    const c = conn(['x', 'y']);
    const { result, rerender } = renderHook(
      ({ connection }: { connection: Conn | undefined }) =>
        usePreservedNodes(connection),
      { initialProps: { connection: c as Conn | undefined } },
    );

    expect(result.current).toEqual([{ id: 'x' }, { id: 'y' }]);

    rerender({ connection: undefined });
    expect(result.current).toEqual([{ id: 'x' }, { id: 'y' }]); // preserved
  });
});
