import { gql } from '@apollo/client';
import { createApolloClient, restorePersistedCache } from '#/apollo/client';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { LogoutCleanup } from '#/apollo/logoutCleanup';
import { storage } from '#/store/deviceStorage';

const ROWS = gql`
  query SessionRows {
    probeRows {
      id
      name
    }
  }
`;

jest.mock('#/apollo/links/index', () => {
  const apollo =
    jest.requireActual<typeof import('@apollo/client')>('@apollo/client');
  return {
    createLink: () => apollo.ApolloLink.empty(),
  };
});

jest.mock('#/apollo/pendingWrites/localWriteRegistry', () => ({
  LOCAL_WRITES: {
    AddSessionRow: {
      apply: (
        cache: { writeQuery: (options: Record<string, unknown>) => void },
        write: { inputs: { name: string } },
      ) => {
        cache.writeQuery({
          query: mockRows(),
          data: {
            probeRows: [
              {
                __typename: 'ProbeItem',
                id: 'row-1',
                name: write.inputs.name,
              },
            ],
          },
        });
      },
    },
  },
}));

const mockRows = () => ROWS;

describe('a pending write across sessions', () => {
  beforeEach(() => {
    jest.spyOn(storage, 'isReady').mockReturnValue(true);
    jest.spyOn(apolloCachePersistence, 'load').mockReturnValue(null);
    queueStore.setCurrentUserId('user-1');
    jest.spyOn(queueStore, 'getPendingWrites').mockReturnValue([
      {
        id: 'write-1',
        operationName: 'AddSessionRow',
        document: ROWS,
        variables: { input: { id: 'row-1' } },
        inputs: { name: 'Stored' },
      },
    ]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows on a fresh client whose cache is empty, from the queue alone', () => {
    const client = createApolloClient();
    restorePersistedCache();

    expect(client.cache.readQuery({ query: ROWS, optimistic: true })).toEqual({
      probeRows: [{ __typename: 'ProbeItem', id: 'row-1', name: 'Stored' }],
    });
    expect(client.cache.extract()).not.toHaveProperty(['ProbeItem:row-1']);
  });

  it('leaves no layer after a session ends, and returns with the same user', async () => {
    const client = createApolloClient();
    const pending = pendingWritesOf(client.cache);
    pending.restore(queueStore.getPendingWrites());

    await LogoutCleanup.performLogoutCleanup();
    LogoutCleanup.completeLogout();

    expect(pending.get('write-1')).toBeUndefined();
    expect(
      client.cache.readQuery({ query: ROWS, optimistic: true }),
    ).toBeNull();

    queueManager.onUserChange('user-1', null);

    expect(pending.get('write-1')).toBeDefined();
  });
});
