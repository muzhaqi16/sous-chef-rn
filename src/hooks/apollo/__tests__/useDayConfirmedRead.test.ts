import { act, renderHook } from '@testing-library/react-native';
import { useDayConfirmedRead } from '../useDayConfirmedRead';

const render = (initialKey: string | null) =>
  renderHook(({ key }: { key: string | null }) => useDayConfirmedRead(key), {
    initialProps: { key: initialKey },
  });

const ASKS_THE_NETWORK = {
  fetchPolicy: 'cache-and-network',
  nextFetchPolicy: 'cache-first',
};
const HOLDS = { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' };

describe('useDayConfirmedRead', () => {
  it('asks the network until the read answers for its key, then holds', () => {
    const { result } = render('p1:2026-03-10');
    expect(result.current.policy).toEqual(ASKS_THE_NETWORK);

    act(() => result.current.markAnswered('p1:2026-03-10'));

    expect(result.current.policy).toEqual(HOLDS);
  });

  it('asks again on a new day', () => {
    const { result, rerender } = render('p1:2026-03-10');
    act(() => result.current.markAnswered('p1:2026-03-10'));

    rerender({ key: 'p1:2026-03-11' });

    expect(result.current.policy).toEqual(ASKS_THE_NETWORK);
  });

  it('does not count an answer for another key, or no answer', () => {
    const { result } = render('p1:2026-03-10');

    act(() => result.current.markAnswered('p1:2026-03-09'));
    act(() => result.current.markAnswered(null));

    expect(result.current.policy).toEqual(ASKS_THE_NETWORK);
  });

  it('holds at the policy the caller stands down to', () => {
    const { result } = renderHook(() =>
      useDayConfirmedRead('p1:2026-03-10', 'cache-only'),
    );
    expect(result.current.policy).toEqual({
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-only',
    });

    act(() => result.current.markAnswered('p1:2026-03-10'));

    expect(result.current.policy).toEqual({
      fetchPolicy: 'cache-only',
      nextFetchPolicy: 'cache-only',
    });
  });
});
