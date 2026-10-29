import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  recordMock,
} from '#/test-utils/apolloMockProvider';
import { EnableHomeJoinLinkDocument } from '#operations/home/home.generated';
import { useHouseholdInvite } from '../useHouseholdInvite';

const enabled = (joinCode: string | null, universal: string | null) =>
  recordMock(EnableHomeJoinLinkDocument, {
    data: {
      enableHomeJoinLink: {
        __typename: 'UpdateHomePayload',
        home: {
          __typename: 'Home',
          id: 'home-1',
          joinCode,
          joinLink: universal ? { __typename: 'ShareLink', universal } : null,
        },
      },
    },
  });

async function linkFrom(mock: ReturnType<typeof enabled>) {
  const { result } = renderHookWithApollo(() => useHouseholdInvite('home-1'), {
    operationMocks: [mock.mock],
  });
  let link: string | null = null;
  await act(async () => {
    link = await result.current.inviteLink();
  });
  return link;
}

describe('useHouseholdInvite', () => {
  it("shares the server's link once the home's join link is on", async () => {
    const mock = enabled('ABC123', 'https://app.souschef.dev/join-home/ABC123');

    expect(await linkFrom(mock)).toBe(
      'https://app.souschef.dev/join-home/ABC123',
    );
    expect(mock.fired).toEqual([{ input: { id: 'home-1' } }]);
  });

  it('builds the link from the code when the server sent none', async () => {
    expect(await linkFrom(enabled('XYZ789', null))).toBe(
      'https://app.souschef.dev/join-home/XYZ789',
    );
  });

  it('has no link without a join code', async () => {
    expect(await linkFrom(enabled(null, null))).toBeNull();
  });
});
