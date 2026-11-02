/**
 * Leaving a home, a write that moved out of a screen into the core, in node
 * with every React Native package unloadable: confirmed through the host's
 * alert presenter, it takes the home out of the cache and moves the selection
 * to the home that is left.
 */
import { act, createElement } from 'react';
// The renderer React Native Testing Library runs every mobile suite on, which
// this project cannot load: it requires React Native.
import { create } from 'react-test-renderer';
import { useApolloClient } from '@apollo/client/react';
import {
  GetHomesDocument,
  LeaveHomeDocument,
} from '#operations/home/home.generated';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import { useHomeMembership } from '#features/home/hooks/useHomeMembership';
import { makeCache } from '#/apollo/cache';
import { alertService } from '#/services/alertService';
import { useStore } from '#store';
import {
  createApolloTestWrapper,
  recordMock,
} from '#/test-utils/apolloMockProvider';

// The mock provider's render helpers are React Native's; this suite renders
// with react-test-renderer and needs only its Apollo wrapper.
jest.mock('@testing-library/react-native', () => ({}));

interface Probe {
  membership: ReturnType<typeof useHomeMembership>;
  client: ReturnType<typeof useApolloClient>;
}

// Called on every render, so each step reads the latest hook.
const rendered = jest.fn<void, [Probe]>();

function MembershipProbe() {
  rendered({
    membership: useHomeMembership('home-1'),
    client: useApolloClient(),
  });
  return null;
}

const current = (): Probe => {
  const [probe] = rendered.mock.lastCall ?? [];
  if (!probe) throw new Error('the probe has not rendered');
  return probe;
};

beforeAll(() => {
  // react-test-renderer reports updates outside `act` unless told it is a test.
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // The host's dialog: every confirmation is confirmed.
  alertService.init(({ buttons }) => {
    buttons.find(button => button.style === 'destructive')?.onPress?.();
  });
});

it('leaves a home and moves the selection on, with no device', async () => {
  useStore.getState().setSelectedHomeId('home-1');
  const homes = recordMock(GetHomesDocument, {
    data: {
      homes: {
        edges: [
          { node: { __typename: 'Home', id: 'home-1', name: 'Beach House' } },
          { node: { __typename: 'Home', id: 'home-2', name: 'City Flat' } },
        ],
      },
    },
  });
  const leave = recordMock(LeaveHomeDocument, {
    data: {
      leaveHome: {
        __typename: 'LeaveHomePayload',
        converged: false,
        membership: { id: 'm-1' },
      },
    },
  });
  let markedDefault = () => {};
  const defaultMarked = new Promise<void>(resolve => {
    markedDefault = resolve;
  });
  const markDefault = recordMock(MarkHomeAsDefaultDocument, {
    dataFor: () => {
      markedDefault();
      return { markHomeAsDefault: { __typename: 'MarkHomeAsDefaultPayload' } };
    },
  });
  const cache = makeCache();
  const Wrapper = createApolloTestWrapper({
    operationMocks: [homes.mock, leave.mock, markDefault.mock],
    cache,
  });

  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      createElement(Wrapper, { children: createElement(MembershipProbe) }),
    );
  });
  await act(async () => {
    await current().client.query({ query: GetHomesDocument });
  });

  let left = false;
  await act(async () => {
    left = await current().membership.leaveHome('Beach House');
  });

  expect(left).toBe(true);
  expect(leave.fired).toEqual([{ input: { homeId: 'home-1' } }]);
  expect('Home:home-1' in cache.extract()).toBe(false);
  expect(useStore.getState().selectedHomeId).toBe('home-2');
  // In the background, the home that remains becomes the account's default.
  await act(() => defaultMarked);
  expect(markDefault.fired).toEqual([
    expect.objectContaining({
      input: expect.objectContaining({ homeId: 'home-2' }),
    }),
  ]);

  await act(async () => {
    renderer?.unmount();
  });
});
