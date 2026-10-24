import { heldFetchPolicy } from '../standDownOptions';

describe('heldFetchPolicy', () => {
  it('leaves the client defaults alone when the caller names no policy', () => {
    expect(heldFetchPolicy()).toEqual({});
  });

  // A re-enabled query would otherwise fall back to the client's
  // `nextFetchPolicy`, and a `cache-only` read would fetch.
  it('holds a named policy for the next run too', () => {
    expect(heldFetchPolicy('cache-first')).toEqual({
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first',
    });
  });
});
