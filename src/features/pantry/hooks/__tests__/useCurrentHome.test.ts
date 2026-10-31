import { act } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import {
  completeMockedResponse,
  recordMock,
  renderHookWithApollo,
  seedCache,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import {
  GetHomesDocument,
  type GetHomesQuery,
} from '#operations/home/home.generated';
import { useCurrentHome } from '../useCurrentHome';

jest.mock('#store/useAppStore', () => ({
  useSelectedHomeId: () => 'home-1',
  useIsHomeSelectionReady: () => true,
}));

const homesAnswer = {
  request: { query: GetHomesDocument, variables: {} },
  result: {
    data: {
      homes: { edges: [{ node: { id: 'home-1', name: 'Test Home' } }] },
    },
  },
};

function renderWithCachedHomes() {
  const cache = seedCache([]);
  const completed = completeMockedResponse(homesAnswer).result as (
    vars: Record<string, never>,
  ) => { data: Unmasked<GetHomesQuery> };
  seedQuery(cache, { query: GetHomesDocument, data: completed({}).data });
  const homes = recordMock(GetHomesDocument, homesAnswer.result);
  const rendered = renderHookWithApollo(() => useCurrentHome(), {
    cache,
    operationMocks: [homes.mock],
  });
  return { ...rendered, cache, homes };
}

describe('useCurrentHome', () => {
  it('reads the selected home from the cached homes list', () => {
    const { result, homes } = renderWithCachedHomes();

    expect(result.current.currentHome?.name).toBe('Test Home');
    expect(homes.fired).toEqual([]);
  });

  // `useDefaultHome` owns the fetch; this read only follows it.
  it('asks nothing when the cached homes list goes', async () => {
    const { cache, homes } = renderWithCachedHomes();

    await act(async () => {
      cache.evict({ id: 'ROOT_QUERY', fieldName: 'homes' });
      cache.gc();
      await Promise.resolve();
    });

    expect(homes.fired).toEqual([]);
  });
});
