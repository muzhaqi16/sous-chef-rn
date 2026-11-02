import { renderHook } from '@testing-library/react-native';
import { feedEngine } from '#/apollo/feed/feedEngine';
import { clearPositions, holdPosition } from '#/apollo/feed/feedPositions';
import { SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { holdListInMemory } from '../../offline/listShards';
import { useListReadPolicy } from '../useListReadPolicy';

jest.mock('#/apollo/feed/feedEngine', () => ({
  feedEngine: { refresh: jest.fn() },
}));
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));
jest.mock('../../offline/listShards', () => ({
  holdListInMemory: jest.fn(),
}));

const LIST = 'list-1';
const DAY_MS = 24 * 60 * 60 * 1000;
const hold = (age: number) =>
  holdPosition(LIST, {
    kind: SyncScopeKind.ShoppingList,
    cursor: 'c',
    snapshotAt: Date.now() - age,
  });

beforeEach(() => {
  clearPositions();
  jest.clearAllMocks();
  jest.mocked(useFeatureFlag).mockReturnValue(true);
});

describe('how a list is read', () => {
  it('reads a held list from the device, asking nothing on resume', () => {
    hold(0);

    const { result } = renderHook(() => useListReadPolicy(LIST));

    expect(result.current).toEqual({
      fetchPolicy: 'cache-first',
      refetchOn: false,
    });
  });

  it('leaves a list the feed does not hold reading as before', () => {
    const { result } = renderHook(() => useListReadPolicy(LIST));

    expect(result.current).toBeUndefined();
  });

  it('reads as before with the feed off, whatever is held', () => {
    jest.mocked(useFeatureFlag).mockReturnValue(false);
    hold(0);

    const { result } = renderHook(() => useListReadPolicy(LIST));

    expect(result.current).toBeUndefined();
  });

  it('brings a stored list into memory before anything reads it', () => {
    renderHook(() => useListReadPolicy(LIST));

    expect(holdListInMemory).toHaveBeenCalledWith(LIST);
  });
});

describe('what the feed omits', () => {
  it('reads a list in full when its last full read is a day old', () => {
    hold(DAY_MS + 1);

    renderHook(() => useListReadPolicy(LIST));

    expect(feedEngine.refresh).toHaveBeenCalledWith(
      SyncScopeKind.ShoppingList,
      LIST,
    );
  });

  it('leaves a list read in full today', () => {
    hold(DAY_MS / 24);

    renderHook(() => useListReadPolicy(LIST));

    expect(feedEngine.refresh).not.toHaveBeenCalled();
  });
});
