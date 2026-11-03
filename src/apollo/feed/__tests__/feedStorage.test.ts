import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { storage } from '#/store/deviceStorage';
import { seedFragment } from '#/test-utils/apolloMockProvider';
import { clearPositions, holdPosition, positionOf } from '../feedPositions';
import { feedStorage } from '../feedStorage';

const PANTRY = 'pantry-1';
const PANTRY_ROW = gql`
  fragment StoredPantryRow on Pantry {
    id
    name
  }
`;

const holdingPantry = () => {
  const cache = makeCache();
  seedFragment(cache, {
    fragment: PANTRY_ROW,
    data: { __typename: 'Pantry', id: PANTRY, name: 'Kitchen' },
  });
  return cache;
};

beforeEach(() => {
  storage.clearAll();
  clearPositions();
});

afterEach(() => {
  jest.restoreAllMocks();
  apolloCachePersistence.clear();
});

describe('positions on disk', () => {
  it('are written after what loads at launch, so they never outrun its rows', () => {
    const cache = holdingPantry();
    apolloCachePersistence.attachShards(feedStorage, cache);
    holdPosition(PANTRY, {
      kind: SyncScopeKind.Pantry,
      cursor: 'kept',
      snapshotAt: 0,
    });
    const set = jest.spyOn(storage, 'set');

    apolloCachePersistence.scheduleExtractAndSave(() => cache.extract());
    apolloCachePersistence.flushPending();

    const keys = set.mock.calls.map(([key]) => key);
    expect(keys.indexOf('apollo-shard-positions')).toBeGreaterThan(
      keys.indexOf('apollo-cache-v1'),
    );
  });

  it('bring a pantry back only with its row', () => {
    holdPosition(PANTRY, {
      kind: SyncScopeKind.Pantry,
      cursor: 'kept',
      snapshotAt: 0,
    });
    feedStorage.saved?.();

    clearPositions();
    feedStorage.restore(makeCache());
    expect(positionOf(PANTRY)).toBeUndefined();

    feedStorage.restore(holdingPantry());
    expect(positionOf(PANTRY)?.cursor).toBe('kept');
  });
});
