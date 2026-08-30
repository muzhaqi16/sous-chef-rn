import { resetSessionScopedStores } from '#store/sessionScopedStores';
import {
  isDefaultHomeSyncPending,
  useDefaultHomeSyncStore,
} from '../useDefaultHomeSyncStore';

beforeEach(() => {
  useDefaultHomeSyncStore.getState().clearPending();
});

describe('useDefaultHomeSyncStore', () => {
  it('separates a locally written default from a server-confirmed one', () => {
    useDefaultHomeSyncStore.getState().markPending('home-1');
    expect(isDefaultHomeSyncPending('home-1')).toBe(true);

    useDefaultHomeSyncStore.getState().markConfirmed('home-1');
    expect(isDefaultHomeSyncPending('home-1')).toBe(false);
  });

  it('does not let a confirmation settle a different, in-flight switch', () => {
    useDefaultHomeSyncStore.getState().markPending('home-2');
    useDefaultHomeSyncStore.getState().markConfirmed('home-1');

    expect(isDefaultHomeSyncPending('home-2')).toBe(true);
  });

  it('is emptied by a session end', async () => {
    useDefaultHomeSyncStore.getState().markPending('home-1');

    await resetSessionScopedStores();

    expect(useDefaultHomeSyncStore.getState().pendingDefaultHomeId).toBeNull();
  });
});
