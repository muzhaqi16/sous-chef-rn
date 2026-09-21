import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import { useStore } from '#store';
import { proactiveTokenRefresh } from '../../links/refreshToken';
import { SessionError } from '#/utils/errors/sessionError';
import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import {
  queuedMutationFor,
  makeQueuedMutation,
} from '#/test-utils/queuedMutation';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { UpdateHomeDocument } from '#operations/home/home.generated';

/**
 * The drain carries the session it started in. A sign-out, a different signed-in
 * user, or a parent that did not land all mean the same thing: stop, rather than
 * spend a credential or send work that belongs to someone else.
 */

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn(),
  },
}));

const mockClient = { mutate: jest.fn(), cache: makeCache() };
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

jest.mock('../../links/refreshToken', () => ({
  proactiveTokenRefresh: jest.fn(),
  clearRefreshState: jest.fn(),
}));

jest.mock('../queueStore', () => ({
  queueStore: {
    updateMutation: jest.fn(() => true),
    removeMutation: jest.fn(() => true),
    incrementRetry: jest.fn(() => true),
    markMutationFailed: jest.fn(() => true),
    getPendingMutationsForUser: jest.fn(() => []),
    resetProcessingToPending: jest.fn(() => 0),
    cleanupTerminal: jest.fn(() => []),
    revivePendingAuthErrors: jest.fn(() => 0),
    expireStalePending: jest.fn(() => 0),
    getQueueStats: jest.fn(() => ({
      total: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      authErrors: 0,
    })),
    invalidateCache: jest.fn(),
  },
}));

const entry = (id: string, itemId: string) =>
  makeQueuedMutation({
    id,
    userId: 'user-1',
    ...queuedMutationFor(UpdatePantryItemDocument),
    variables: { input: { id: itemId, itemName: 'Milk', version: 1 } },
  });

const signedInAs = (userId: string | null, isLoggingOut = false) => {
  (useStore.getState as jest.Mock).mockReturnValue({
    user: userId ? { id: userId } : null,
    isOnline: true,
    apiReachable: true,
    accessToken: 'token',
    isLoggingOut,
    setNeedsTokenRefresh: jest.fn(),
  });
};

describe('a drain meeting a session that is ending', () => {
  let manager: QueueManager;

  beforeEach(() => {
    jest.clearAllMocks();
    signedInAs('user-1');
    manager = new QueueManager();
  });

  it('does not spend a token refresh while signing out', async () => {
    signedInAs('user-1', true);
    const handleMutationError = manager['handleMutationError'].bind(manager);

    await handleMutationError(
      entry('m1', 'item-1'),
      new SessionError(
        TopLevelErrorCode.Unauthenticated,
        'Operation cancelled due to logout process',
      ),
    );

    // Rotating here writes a fresh pair back into storage moments after the
    // teardown cleared them, and re-arms the refresh it just cancelled.
    expect(proactiveTokenRefresh).not.toHaveBeenCalled();
  });

  it('parks the write rather than withdrawing it', async () => {
    signedInAs('user-1', true);
    const failureHandler = jest.fn();
    manager.setFailureHandler(failureHandler);
    const handleMutationError = manager['handleMutationError'].bind(manager);

    await handleMutationError(
      entry('m2', 'item-2'),
      new SessionError(
        TopLevelErrorCode.Unauthenticated,
        'Operation cancelled due to logout process',
      ),
    );

    expect(queueStore.removeMutation).not.toHaveBeenCalled();
    expect(failureHandler).not.toHaveBeenCalled();
  });

  it('still refreshes for an ordinary credential refusal', async () => {
    (proactiveTokenRefresh as jest.Mock).mockResolvedValue(null);
    const handleMutationError = manager['handleMutationError'].bind(manager);

    await handleMutationError(
      entry('m3', 'item-3'),
      new SessionError(TopLevelErrorCode.Unauthenticated, 'token expired'),
    );

    expect(proactiveTokenRefresh).toHaveBeenCalled();
  });
});

describe('a drain outliving the user it started for', () => {
  let manager: QueueManager;

  beforeEach(() => {
    jest.clearAllMocks();
    signedInAs('user-1');
    manager = new QueueManager();
  });

  it('stops replaying when a different user is signed in', async () => {
    (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([
      entry('m1', 'item-1'),
      entry('m2', 'item-2'),
    ]);
    mockClient.mutate.mockResolvedValue({ data: {} });
    // The sign-out completed and someone else signed in mid-drain.
    signedInAs('user-2');

    await manager['_processQueueInternal']('user-1');

    expect(mockClient.mutate).not.toHaveBeenCalled();
  });
});

describe('a queued write whose parent did not land', () => {
  let manager: QueueManager;

  beforeEach(() => {
    jest.clearAllMocks();
    signedInAs('user-1');
    manager = new QueueManager();
  });

  it('is held when its parent parks for re-authentication', async () => {
    // UpdateHome replays as itself, so the drain reaches the server without
    // needing a cache the purge case has already emptied.
    const homeEntry = (id: string) =>
      makeQueuedMutation({
        id,
        userId: 'user-1',
        ...queuedMutationFor(UpdateHomeDocument),
        variables: { input: { id: 'home-1', name: 'Home', version: 1 } },
      });
    const parent = homeEntry('parent');
    const child = homeEntry('child');
    (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue([
      parent,
      child,
    ]);
    // The parent parks: refresh comes back empty, so it is marked AUTH_ERROR
    // and returns unsuccessfully WITHOUT a deferral.
    (proactiveTokenRefresh as jest.Mock).mockResolvedValue(null);
    mockClient.mutate.mockRejectedValue(
      new SessionError(TopLevelErrorCode.Unauthenticated, 'token expired'),
    );

    await manager['_processQueueInternal']('user-1');

    // Replaying the child against a parent the server never saw earns a
    // NotFoundError, which is withdrawn — data loss, not a delay.
    const replayed = mockClient.mutate.mock.calls.length;
    expect(replayed).toBe(1);
  });
});
