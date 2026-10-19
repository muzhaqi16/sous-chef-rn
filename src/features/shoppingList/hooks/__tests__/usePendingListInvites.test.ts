import { act, waitFor } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type QueryDataFor,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import {
  CollaboratorRole,
  CollaboratorStatus,
  ErrorCode,
} from '#/graphql/generated/schemaTypes';
import {
  AcceptShoppingListInviteDocument,
  DeclineShoppingListInviteDocument,
} from '#features/shoppingList/graphql/collaboration.generated';
import { GetShoppingListsLiteDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { SHOPPING_LISTS_PAGE_SIZE } from '#features/shoppingList/hooks/useShoppingListsQuery';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { GetPendingListInvitesDocument } from '../usePendingListInvites.generated';
import { usePendingListInvites } from '../usePendingListInvites';

const USER_ID = 'user-1';
const PAGE = { first: 20 };
const LISTS = { first: SHOPPING_LISTS_PAGE_SIZE };

type PendingNode = NonNullable<
  QueryDataFor<typeof GetPendingListInvitesDocument>['me']
>['pendingCollaborationInvitesConnection']['edges'][number]['node'];

const invite = (id: string, listId: string, name: string): PendingNode => ({
  __typename: 'ShoppingListCollaborator',
  id,
  role: CollaboratorRole.Editor,
  inviterName: 'Alice',
  shoppingList: { __typename: 'ShoppingList', id: listId, name },
});

const pendingAnswer = (
  ...nodes: PendingNode[]
): { data: MockDataFor<typeof GetPendingListInvitesDocument> } => ({
  data: {
    me: {
      __typename: 'User',
      id: USER_ID,
      pendingCollaborationInvitesConnection: {
        edges: nodes.map(node => ({ node })),
      },
    },
  },
});

const requireVerifiedEmail = jest.fn(() => true);

const GROCERIES = invite('inv-1', 'list-1', 'Weekly groceries');
const PARTY = invite('inv-2', 'list-2', 'Party');

const refusedAccept = (refusal: {
  __typename: 'NotFoundError' | 'ValidationError' | 'ForbiddenError';
  code: ErrorCode;
  field?: string;
}) =>
  recordMock(AcceptShoppingListInviteDocument, {
    data: { acceptShoppingListInvite: refusal },
  });

/**
 * The hook over a cache holding both invites and one list of the reader's
 * own. The first pending read answers both invites; a refetch answers `later`.
 */
async function withPendingInvites(
  write: RecordedMock,
  later = pendingAnswer(GROCERIES, PARTY),
) {
  const cache = makeCache();
  const pending = recordMock(GetPendingListInvitesDocument, {
    ...pendingAnswer(GROCERIES, PARTY),
    maxUsageCount: 1,
  });
  const refetched = recordMock(GetPendingListInvitesDocument, later);
  const lists = recordMock(GetShoppingListsLiteDocument, {
    data: {
      shoppingLists: {
        edges: [
          {
            node: {
              __typename: 'ShoppingList',
              id: 'list-own',
              homeId: null,
              home: null,
            },
          },
        ],
        totalCount: 1,
      },
    },
  });
  const onAccepted = jest.fn();
  const { result } = renderHookWithApollo(
    () => ({
      client: useApolloClient(),
      pending: usePendingListInvites({ onAccepted, requireVerifiedEmail }),
    }),
    {
      cache,
      operationMocks: [pending.mock, refetched.mock, lists.mock, write.mock],
    },
  );
  await act(async () => {
    await result.current.client.query({
      query: GetShoppingListsLiteDocument,
      variables: LISTS,
    });
  });
  await waitFor(() => expect(result.current.pending.invites).toHaveLength(2));
  return { cache, result, onAccepted, refetched };
}

const pendingIds = (cache: InMemoryCache) =>
  cache
    .readQuery({ query: GetPendingListInvitesDocument, variables: PAGE })
    ?.me?.pendingCollaborationInvitesConnection.edges.map(edge => edge.node.id);

const listIds = (cache: InMemoryCache) =>
  cache
    .readQuery({ query: GetShoppingListsLiteDocument, variables: LISTS })
    ?.shoppingLists.edges.map(edge => edge.node.id);

const holdsInvite = (cache: InMemoryCache, id: string) =>
  Object.keys(cache.extract()).includes(
    cache.identify({ __typename: 'ShoppingListCollaborator', id }) ?? '',
  );

/** Presses the decline alert's destructive button. */
const confirmDecline = async () => {
  const [, , buttons] = jest.mocked(alertService.alert).mock.calls.at(-1) ?? [];
  await act(async () => {
    buttons?.find(button => button.style === 'destructive')?.onPress?.();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({
    user: {
      id: USER_ID,
      email: 'invitee@example.com',
      emailVerified: true,
      onBoarded: true,
    },
  });
});

afterEach(() => {
  useStore.setState({ user: null });
});

describe('usePendingListInvites', () => {
  it('lists each invite with its list, sender and role', async () => {
    const { result } = await withPendingInvites(
      refusedAccept({ __typename: 'NotFoundError', code: ErrorCode.NotFound }),
    );

    expect(result.current.pending.invites).toEqual([
      {
        id: 'inv-1',
        listName: 'Weekly groceries',
        inviterName: 'Alice',
        role: CollaboratorRole.Editor,
      },
      {
        id: 'inv-2',
        listName: 'Party',
        inviterName: 'Alice',
        role: CollaboratorRole.Editor,
      },
    ]);
  });

  it('moves an accepted list into the lists and its invite out', async () => {
    const accept = recordMock(AcceptShoppingListInviteDocument, {
      data: {
        acceptShoppingListInvite: {
          __typename: 'AcceptShoppingListInvitePayload',
          collaborator: {
            __typename: 'ShoppingListCollaborator',
            id: 'inv-1',
            status: CollaboratorStatus.Active,
          },
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            name: 'Weekly groceries',
            homeId: null,
            home: null,
          },
        },
      },
    });
    const { cache, result, onAccepted } = await withPendingInvites(accept);
    const [groceries] = result.current.pending.invites;
    if (!groceries) throw new Error('no invite listed');

    act(() => result.current.pending.accept(groceries));
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith('list-1'));

    expect(accept.fired).toEqual([{ input: { inviteId: 'inv-1' } }]);
    expect(pendingIds(cache)).toEqual(['inv-2']);
    expect(listIds(cache)).toEqual(
      expect.arrayContaining(['list-own', 'list-1']),
    );
    // The invite record is the active collaborator now, so it stays cached.
    expect(holdsInvite(cache, 'inv-1')).toBe(true);
    expect(toastService.success).toHaveBeenCalledWith(
      'You can now collaborate on Weekly groceries',
    );
    expect(result.current.pending.answering).toBeNull();
  });

  it('removes a declined invite and leaves the lists alone', async () => {
    const decline = recordMock(DeclineShoppingListInviteDocument, {
      data: {
        declineShoppingListInvite: {
          __typename: 'DeclineShoppingListInvitePayload',
          collaborator: { __typename: 'ShoppingListCollaborator', id: 'inv-1' },
          shoppingList: null,
        },
      },
    });
    const { cache, result } = await withPendingInvites(decline);
    const [groceries] = result.current.pending.invites;
    if (!groceries) throw new Error('no invite listed');

    act(() => result.current.pending.decline(groceries));
    expect(decline.fired).toEqual([]);
    await confirmDecline();
    await waitFor(() => expect(toastService.success).toHaveBeenCalled());

    expect(decline.fired).toEqual([{ input: { inviteId: 'inv-1' } }]);
    expect(toastService.success).toHaveBeenCalledWith(
      'Declined invitation to Weekly groceries',
    );
    expect(pendingIds(cache)).toEqual(['inv-2']);
    expect(holdsInvite(cache, 'inv-1')).toBe(false);
    expect(listIds(cache)).toEqual(['list-own']);
  });

  it('drops an invite no longer pending, says so, and re-reads the rest', async () => {
    const { cache, result, refetched } = await withPendingInvites(
      refusedAccept({ __typename: 'NotFoundError', code: ErrorCode.NotFound }),
      pendingAnswer(PARTY),
    );
    const [groceries] = result.current.pending.invites;
    if (!groceries) throw new Error('no invite listed');

    act(() => result.current.pending.accept(groceries));
    await waitFor(() => expect(refetched.fired).toHaveLength(1));

    expect(toastService.error).toHaveBeenCalledWith(
      'This invitation is no longer available. It may have been used, declined, or expired.',
    );
    expect(pendingIds(cache)).toEqual(['inv-2']);
    expect(holdsInvite(cache, 'inv-1')).toBe(false);
  });

  it('drops an expired invite and says it expired', async () => {
    const { cache, result, refetched } = await withPendingInvites(
      refusedAccept({
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        field: 'inviteId',
      }),
    );
    const [groceries] = result.current.pending.invites;
    if (!groceries) throw new Error('no invite listed');

    act(() => result.current.pending.accept(groceries));
    await waitFor(() =>
      expect(toastService.error).toHaveBeenCalledWith(
        'This invitation has expired',
      ),
    );

    // Dropped by the answer itself: nothing was re-read.
    expect(refetched.fired).toEqual([]);
    expect(pendingIds(cache)).toEqual(['inv-2']);
    expect(holdsInvite(cache, 'inv-1')).toBe(false);
  });

  // Signed in as somebody else: the invite is still there for its invitee.
  it('keeps a forbidden invite and explains the account mismatch', async () => {
    const { cache, result } = await withPendingInvites(
      refusedAccept({
        __typename: 'ForbiddenError',
        code: ErrorCode.Forbidden,
      }),
    );
    const [groceries] = result.current.pending.invites;
    if (!groceries) throw new Error('no invite listed');

    act(() => result.current.pending.accept(groceries));
    await waitFor(() => expect(alertService.alert).toHaveBeenCalled());

    expect(alertService.alert).toHaveBeenCalledWith(
      'Signed in as a different account',
      'This invitation was sent to someone else. Sign in with the invited account to accept it.',
    );
    expect(pendingIds(cache)).toEqual(['inv-1', 'inv-2']);
    expect(holdsInvite(cache, 'inv-1')).toBe(true);
  });

  it('keeps the invite when the accept never reaches the server', async () => {
    const { cache, result } = await withPendingInvites(
      recordMock(AcceptShoppingListInviteDocument, {
        error: new Error('Network request failed'),
      }),
    );
    const [groceries] = result.current.pending.invites;
    if (!groceries) throw new Error('no invite listed');

    act(() => result.current.pending.accept(groceries));
    await waitFor(() => expect(toastService.error).toHaveBeenCalled());

    expect(pendingIds(cache)).toEqual(['inv-1', 'inv-2']);
    expect(listIds(cache)).toEqual(['list-own']);
  });

  it.each<['accept' | 'decline', () => RecordedMock]>([
    ['accept', () => recordMock(AcceptShoppingListInviteDocument)],
    ['decline', () => recordMock(DeclineShoppingListInviteDocument)],
  ])(
    'answers nothing by id while the email is unverified: %s',
    async (answer, writeMock) => {
      const write = writeMock();
      const { result } = await withPendingInvites(write);
      const [groceries] = result.current.pending.invites;
      if (!groceries) throw new Error('no invite listed');
      // The gate offers verification itself.
      requireVerifiedEmail.mockReturnValueOnce(false);

      act(() => result.current.pending[answer](groceries));

      expect(requireVerifiedEmail).toHaveBeenCalled();
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(write.fired).toEqual([]);
    },
  );
});
