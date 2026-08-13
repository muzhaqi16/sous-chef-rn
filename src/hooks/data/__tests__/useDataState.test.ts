import { renderHook } from '@testing-library/react-native';
import { useDataState, type DataState } from '../useDataState';
import { useBlocksCacheMissQueries } from '#hooks/app/useBlocksCacheMissQueries';

jest.mock('#hooks/app/useBlocksCacheMissQueries', () => ({
  useBlocksCacheMissQueries: jest.fn(() => false),
}));

const online = () =>
  (useBlocksCacheMissQueries as jest.Mock).mockReturnValue(false);
const offline = () =>
  (useBlocksCacheMissQueries as jest.Mock).mockReturnValue(true);

const classify = (input: Parameters<typeof useDataState>[0]): DataState =>
  renderHook(() => useDataState(input)).result.current;

beforeEach(online);

describe('useDataState', () => {
  it('is ready when there is something to render', () => {
    expect(classify({ loading: false, hasResult: true, isEmpty: false })).toBe(
      'ready',
    );
  });

  it('keeps rendered data through a failed background refetch', () => {
    // Blanking a list that is on screen and still true, because a revalidation
    // failed, is worse than showing slightly stale data.
    expect(
      classify({
        loading: false,
        error: new Error('refetch failed'),
        hasResult: true,
        isEmpty: false,
      }),
    ).toBe('ready');
  });

  it('is loading while a first fetch is in flight', () => {
    expect(classify({ loading: true, hasResult: false, isEmpty: true })).toBe(
      'loading',
    );
  });

  it('never flashes an error before the request settles', () => {
    expect(
      classify({
        loading: true,
        error: new Error('stale'),
        hasResult: false,
        isEmpty: true,
      }),
    ).toBe('loading');
  });

  describe('the distinction the whole thing exists for', () => {
    it('is empty when the server answered and had nothing', () => {
      expect(classify({ loading: false, hasResult: true, isEmpty: true })).toBe(
        'empty',
      );
    });

    it('is an error when the request failed, not empty', () => {
      // The defect this replaces: a failed fetch rendered "No recipes yet"
      // alongside a button offering to create the recipes you already own.
      expect(
        classify({
          loading: false,
          error: new Error('500'),
          hasResult: false,
          isEmpty: true,
        }),
      ).toBe('error');
    });

    it('is an error when no answer arrived at all', () => {
      // `errorPolicy: 'ignore'` discards the error and leaves data undefined,
      // so absence is the only evidence a failure leaves behind.
      expect(
        classify({ loading: false, hasResult: false, isEmpty: true }),
      ).toBe('error');
    });
  });

  describe('offline is not failure', () => {
    it('reads a cache miss we never attempted as offline', () => {
      offline();
      expect(
        classify({
          loading: false,
          error: new Error('no cached data'),
          hasResult: false,
          isEmpty: true,
        }),
      ).toBe('offline');
    });

    it('reads a swallowed cache miss as offline too', () => {
      offline();
      expect(
        classify({ loading: false, hasResult: false, isEmpty: true }),
      ).toBe('offline');
    });

    it('still reports a genuinely empty result as empty while offline', () => {
      // Cached, answered, and there is nothing — telling this person to
      // reconnect would be a lie.
      offline();
      expect(classify({ loading: false, hasResult: true, isEmpty: true })).toBe(
        'empty',
      );
    });

    it('keeps a failure over cached data reportable', () => {
      offline();
      expect(
        classify({
          loading: false,
          error: new Error('boom'),
          hasResult: true,
          isEmpty: false,
        }),
      ).toBe('ready');
    });
  });
});
