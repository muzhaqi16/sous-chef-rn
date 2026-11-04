import { ApolloLink } from '@apollo/client';
import { Observable } from 'rxjs';
import { renderHook } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { FeedPokesDocument } from '#/apollo/feed/feed.generated';
import { feedEngine } from '#/apollo/feed/feedEngine';
import { clearPositions, holdPosition } from '#/apollo/feed/feedPositions';
import type { FeatureFlag } from '#/config/featureFlags';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useChangeFeed, useFeedKeeps } from '../useChangeFeed';

jest.mock('#/apollo/feed/feedEngine', () => ({
  feedEngine: { start: jest.fn(), stop: jest.fn(), receivePoke: jest.fn() },
}));
jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => true),
}));

const switchedOff = (...off: FeatureFlag[]) =>
  jest.mocked(useFeatureFlag).mockImplementation(flag => !off.includes(flag));

/** The `kinds` each poke subscription asked for; it never answers. */
function recordPokes(): { link: ApolloLink; kinds: unknown[] } {
  const kinds: unknown[] = [];
  const link = new ApolloLink(operation => {
    if (operation.operationName === operationNameOf(FeedPokesDocument)) {
      kinds.push(operation.variables.kinds);
    }
    return new Observable(() => undefined);
  });
  return { link, kinds };
}

beforeEach(() => {
  clearPositions();
  jest.clearAllMocks();
  switchedOff();
});

describe('the kinds the feed asks for', () => {
  it('asks for lists, pantries and homes with every kind on', () => {
    const pokes = recordPokes();

    renderHookWithApollo(() => useChangeFeed('user-1'), {
      operationMocks: [],
      links: [pokes.link],
    });

    const all = [
      SyncScopeKind.ShoppingList,
      SyncScopeKind.Pantry,
      SyncScopeKind.Home,
    ];
    expect(feedEngine.start).toHaveBeenCalledWith(all);
    expect(pokes.kinds).toContainEqual(all);
  });

  it('asks for no home with the home kind off', () => {
    switchedOff('homeChangeFeed');
    const pokes = recordPokes();

    renderHookWithApollo(() => useChangeFeed('user-1'), {
      operationMocks: [],
      links: [pokes.link],
    });

    const named = [SyncScopeKind.ShoppingList, SyncScopeKind.Pantry];
    expect(feedEngine.start).toHaveBeenCalledWith(named);
    expect(pokes.kinds).toContainEqual(named);
  });
});

describe('whether the feed keeps a home', () => {
  const HOME = 'home-1';
  const hold = () =>
    holdPosition(HOME, {
      kind: SyncScopeKind.Home,
      cursor: 'c',
      snapshotAt: Date.now(),
    });

  it('keeps a home it holds a position for', () => {
    hold();

    const { result } = renderHook(() => useFeedKeeps(SyncScopeKind.Home));

    expect(result.current(HOME)).toBe(true);
  });

  it('keeps no home it holds no position for', () => {
    const { result } = renderHook(() => useFeedKeeps(SyncScopeKind.Home));

    expect(result.current(HOME)).toBe(false);
  });

  // The list flag once stood in for every kind but pantries.
  it('keeps no home with the home kind off, whatever the list flag says', () => {
    switchedOff('homeChangeFeed');
    hold();

    const { result } = renderHook(() => useFeedKeeps(SyncScopeKind.Home));

    expect(result.current(HOME)).toBe(false);
  });
});
