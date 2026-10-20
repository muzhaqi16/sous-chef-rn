import { act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import { GetMyPendingInvitesDocument } from '#features/onboarding/screens/createHome/useCreateHomeFlow.generated';
import type { InvitationData } from '#features/notifications/types';
import { useInvitationActions } from '../useInvitationActions';

const USER_ID = 'user-1';
const TOKEN = 'invite-token';

const invitation: InvitationData = {
  type: 'HOME_INVITE',
  id: 'inv-1',
  entityName: "Alice's Home",
  token: TOKEN,
  payload: {},
};

type Refusal = 'ConflictError' | 'ForbiddenError';

const refusedAccept = (typename: Refusal, code: ErrorCode) =>
  recordMock(AcceptHomeInviteDocument, {
    data: { acceptHomeInvite: { __typename: typename, code } },
  });

const refusedDecline = (typename: Refusal, code: ErrorCode) =>
  recordMock(DeclineHomeInviteDocument, {
    data: { declineHomeInvite: { __typename: typename, code } },
  });

/** The hook over a cache already holding two pending invites, `inv-1` first. */
async function withPendingInvites(write: RecordedMock) {
  const cache = makeCache();
  const pending = recordMock(GetMyPendingInvitesDocument, {
    data: {
      me: {
        __typename: 'User',
        id: USER_ID,
        pendingHomeInvitesConnection: {
          edges: [
            { node: { __typename: 'HomeInvite', id: 'inv-1' } },
            { node: { __typename: 'HomeInvite', id: 'inv-2' } },
          ],
        },
      },
    },
  });
  const { result } = renderHookWithApollo(
    () => ({
      client: useApolloClient(),
      actions: useInvitationActions(invitation, USER_ID),
    }),
    { cache, operationMocks: [pending.mock, write.mock] },
  );
  await act(async () => {
    await result.current.client.query({ query: GetMyPendingInvitesDocument });
  });
  expect(pendingIds(cache)).toEqual(['inv-1', 'inv-2']);
  return { cache, actions: result.current.actions };
}

const pendingIds = (cache: InMemoryCache) =>
  cache
    .readQuery({ query: GetMyPendingInvitesDocument })
    ?.me?.pendingHomeInvitesConnection.edges.map(edge => edge.node.id);

const holdsInvite = (cache: InMemoryCache, id: string) =>
  Object.keys(cache.extract()).includes(
    cache.identify({ __typename: 'HomeInvite', id }) ?? '',
  );

describe('useInvitationActions: a home invite the server refuses', () => {
  it('drops an invite an accept finds already spent', async () => {
    const accept = refusedAccept('ConflictError', ErrorCode.Conflict);
    const { cache, actions } = await withPendingInvites(accept);

    let outcome: Awaited<ReturnType<typeof actions.acceptHome>> | undefined;
    await act(async () => {
      outcome = await actions.acceptHome(TOKEN);
    });

    expect(accept.fired).toEqual([{ input: { token: TOKEN } }]);
    expect(outcome).toEqual({
      status: 'failed',
      failure: expect.objectContaining({ code: ErrorCode.Conflict }),
    });
    expect(pendingIds(cache)).toEqual(['inv-2']);
    expect(holdsInvite(cache, 'inv-1')).toBe(false);
  });

  it('drops an invite a decline finds already spent', async () => {
    const decline = refusedDecline('ConflictError', ErrorCode.Conflict);
    const { cache, actions } = await withPendingInvites(decline);

    let outcome: Awaited<ReturnType<typeof actions.declineHome>> | undefined;
    await act(async () => {
      outcome = await actions.declineHome(TOKEN);
    });

    expect(decline.fired).toEqual([{ input: { token: TOKEN } }]);
    expect(outcome).toEqual({
      status: 'failed',
      failure: expect.objectContaining({ code: ErrorCode.Conflict }),
    });
    expect(pendingIds(cache)).toEqual(['inv-2']);
    expect(holdsInvite(cache, 'inv-1')).toBe(false);
  });

  // Signed in as somebody else: the invite is still there for its invitee.
  it('keeps an invite pending when the accept is forbidden', async () => {
    const { cache, actions } = await withPendingInvites(
      refusedAccept('ForbiddenError', ErrorCode.Forbidden),
    );

    await act(async () => {
      await actions.acceptHome(TOKEN);
    });

    expect(pendingIds(cache)).toEqual(['inv-1', 'inv-2']);
    expect(holdsInvite(cache, 'inv-1')).toBe(true);
  });

  it('keeps an invite pending when the decline is forbidden', async () => {
    const { cache, actions } = await withPendingInvites(
      refusedDecline('ForbiddenError', ErrorCode.Forbidden),
    );

    await act(async () => {
      await actions.declineHome(TOKEN);
    });

    expect(pendingIds(cache)).toEqual(['inv-1', 'inv-2']);
  });

  // The API refuses a seat in a full home as a ConflictError member coded
  // HOME_MEMBER_LIMIT_REACHED and rolls the accept back, so the invite is
  // still PENDING and can be accepted once a member leaves.
  it('keeps an invite pending when the home is full', async () => {
    const { cache, actions } = await withPendingInvites(
      refusedAccept('ConflictError', ErrorCode.HomeMemberLimitReached),
    );

    let outcome: Awaited<ReturnType<typeof actions.acceptHome>> | undefined;
    await act(async () => {
      outcome = await actions.acceptHome(TOKEN);
    });

    expect(outcome).toEqual({
      status: 'failed',
      failure: expect.objectContaining({
        code: ErrorCode.HomeMemberLimitReached,
        body: 'This home has reached its member limit',
      }),
    });
    expect(pendingIds(cache)).toEqual(['inv-1', 'inv-2']);
    expect(holdsInvite(cache, 'inv-1')).toBe(true);
  });
});
