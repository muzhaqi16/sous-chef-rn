import { extractNodes, getConnectionTotalCount } from '../connectionUtils';

describe('extractNodes', () => {
  it('extracts nodes from edges', () => {
    const connection = {
      edges: [
        { node: { id: '1', name: 'A' } },
        { node: { id: '2', name: 'B' } },
      ],
    };
    expect(extractNodes(connection)).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
  });

  it('filters out null edges', () => {
    const connection = {
      edges: [{ node: { id: '1' } }, null, { node: { id: '2' } }],
    };
    expect(extractNodes(connection)).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('filters out null nodes', () => {
    const connection = {
      edges: [{ node: { id: '1' } }, { node: null }, { node: { id: '2' } }],
    };
    expect(extractNodes(connection)).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('returns empty array for null connection', () => {
    expect(extractNodes(null)).toEqual([]);
  });

  it('returns empty array for undefined connection', () => {
    expect(extractNodes(undefined)).toEqual([]);
  });

  it('returns empty array for connection with null edges', () => {
    expect(extractNodes({ edges: null })).toEqual([]);
  });

  it('returns empty array for connection with empty edges', () => {
    expect(extractNodes({ edges: [] })).toEqual([]);
  });
});

describe('getConnectionTotalCount', () => {
  it('returns totalCount when available', () => {
    const connection = { totalCount: 42, edges: [] };
    expect(getConnectionTotalCount(connection)).toBe(42);
  });

  it('returns 0 for totalCount of 0', () => {
    const connection = { totalCount: 0, edges: [] };
    expect(getConnectionTotalCount(connection)).toBe(0);
  });

  it('falls back to node count when totalCount is null', () => {
    const connection = {
      totalCount: null,
      edges: [{ node: { id: '1' } }, { node: { id: '2' } }],
    };
    expect(getConnectionTotalCount(connection)).toBe(2);
  });

  it('falls back to node count when totalCount is undefined', () => {
    const connection = {
      edges: [{ node: { id: '1' } }],
    };
    expect(getConnectionTotalCount(connection)).toBe(1);
  });

  it('returns 0 for null connection', () => {
    expect(getConnectionTotalCount(null)).toBe(0);
  });
});
