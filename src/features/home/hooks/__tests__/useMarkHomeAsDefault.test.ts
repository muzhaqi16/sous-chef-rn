import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import type { Settled } from '#/apollo/utils/settleMutation';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useMarkHomeAsDefault } from '#features/home/hooks/useMarkHomeAsDefault';
import type { CreateHomeInputs } from '#features/home/offline/localWrites';
import { useDefaultHomeSyncStore } from '#features/home/store/useDefaultHomeSyncStore';
import { CreateHomeDocument } from '#operations/home/home.generated';

const home = { id: 'home-new', name: 'Cabin' };

describe('marking a home default while its create is on its way', () => {
  afterEach(() => {
    useDefaultHomeSyncStore.getState().clearPending();
  });

  // The default is refused with the create, so its own settling never runs.
  it('leaves no pending default when the create is refused', async () => {
    const cache = makeCache();
    let refuse: (settled: Settled<unknown>) => void = () => undefined;
    const answer = new Promise<Settled<unknown>>(resolve => {
      refuse = resolve;
    });
    const inputs: CreateHomeInputs = { home, now: '2026-11-01T12:00:00.000Z' };
    const creating = pendingWritesOf(cache).send(
      CreateHomeDocument,
      { input: home },
      () => answer,
      inputs,
    );
    const { result } = renderHookWithApollo(useMarkHomeAsDefault, {
      cache,
      operationMocks: [],
    });

    await act(async () => {
      const marking = result.current.markAsDefault(home.id);
      expect(useDefaultHomeSyncStore.getState().pendingDefaultHomeId).toBe(
        home.id,
      );
      refuse({
        status: 'failed',
        data: undefined,
        failure: { code: null, field: null, title: 'Error', body: 'No' },
      });
      await creating;
      await expect(marking).resolves.toMatchObject({ status: 'failed' });
    });

    expect(useDefaultHomeSyncStore.getState().pendingDefaultHomeId).toBeNull();
  });
});
