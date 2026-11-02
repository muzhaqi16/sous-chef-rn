import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drained, drainTimers } from '#/test-utils/drainTimers';
import { useStore } from '#store';
import { useOnboardingInvites } from '../useOnboardingInvites';
import { GetMyPendingInvitesDocument } from '../useOnboardingInvites.generated';

beforeEach(() => {
  jest.useFakeTimers();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'maya@example.com',
      emailVerified: true,
      onBoarded: false,
    },
  });
});

afterEach(() => {
  jest.useRealTimers();
  useStore.setState({ user: null });
});

const answer = (ids: string[]) =>
  recordMock(GetMyPendingInvitesDocument, {
    data: {
      me: {
        id: 'user-1',
        pendingHomeInvitesConnection: {
          edges: ids.map(id => ({ node: { id } })),
        },
      },
    },
  });

describe('useOnboardingInvites', () => {
  it('tells a failed read from no invitations', async () => {
    const failed = recordMock(GetMyPendingInvitesDocument, {
      error: new Error('network down'),
      maxUsageCount: 1,
    });
    const { result } = renderHookWithApollo(() => useOnboardingInvites(), {
      operationMocks: [failed.mock, answer(['invite-1']).mock],
    });

    await drainTimers();
    expect(result.current.state).toBe('error');
    expect(result.current.invites).toEqual([]);

    await drained(() => result.current.refetch());
    expect(result.current.state).toBe('ready');
    expect(result.current.invites).toHaveLength(1);
  });

  it('reads as none when the server says so', async () => {
    const { result } = renderHookWithApollo(() => useOnboardingInvites(), {
      operationMocks: [answer([]).mock],
    });

    await drainTimers();
    expect(result.current.state).toBe('empty');
  });
});
