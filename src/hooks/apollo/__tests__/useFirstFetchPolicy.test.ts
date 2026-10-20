import { renderHook } from '@testing-library/react-native';
import { useFirstFetchPolicy } from '../useFirstFetchPolicy';

interface Props {
  subject: string | null;
  stale: () => boolean;
}

const render = (key: string | null, cachedIsStale: () => boolean) =>
  renderHook(
    ({ subject, stale }: Props) => useFirstFetchPolicy(subject, stale),
    { initialProps: { subject: key, stale: cachedIsStale } },
  );

describe('useFirstFetchPolicy', () => {
  it('reads from the cache when its answer stands', () => {
    const { result } = render('a', () => false);
    expect(result.current).toBe('cache-first');
  });

  it('asks the network when the cached answer is stale', () => {
    const { result } = render('a', () => true);
    expect(result.current).toBe('network-only');
  });

  it('decides once per key, so a stale answer that comes back stale stays', () => {
    const stale = jest.fn(() => true);
    const { result, rerender } = render('a', stale);

    rerender({ subject: 'a', stale });
    rerender({ subject: 'a', stale });

    expect(stale).toHaveBeenCalledTimes(1);
    expect(result.current).toBe('network-only');
  });

  it('decides again for a new key', () => {
    const stale = jest.fn(() => true);
    const { result, rerender } = render('a', stale);

    const fresh = jest.fn(() => false);
    rerender({ subject: 'b', stale: fresh });

    expect(fresh).toHaveBeenCalledTimes(1);
    expect(result.current).toBe('cache-first');
  });

  it('reads nothing while there is nothing to ask', () => {
    const stale = jest.fn(() => true);
    const { result } = render(null, stale);

    expect(stale).not.toHaveBeenCalled();
    expect(result.current).toBe('cache-first');
  });
});
