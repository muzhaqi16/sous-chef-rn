import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { toastService } from '#/services/toastService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  DietarySharingHomesDocument,
  UpdateDietarySharingDocument,
} from '../useDietarySharing.generated';
import { useDietarySharing } from '../useDietarySharing';

/** The homes as the server holds them: home-1 unshared, home-2 shared. */
// Each answers once, so a re-read after a refusal is the next one's.
const homesMock = (server = { 'home-1': false, 'home-2': true }) =>
  recordMock(DietarySharingHomesDocument, {
    maxUsageCount: 1,
    data: {
      homes: {
        edges: [
          {
            node: {
              id: 'home-1',
              name: 'Test Home',
              myMembership: {
                id: 'm-1',
                sharesDietaryNeeds: server['home-1'],
              },
            },
          },
          {
            node: {
              id: 'home-2',
              name: 'Beach House',
              myMembership: {
                id: 'm-2',
                sharesDietaryNeeds: server['home-2'],
              },
            },
          },
        ],
      },
    },
  });

const sharedOf = (
  homes: ReturnType<typeof useDietarySharing>['homes'],
  id: string,
) => homes.find(home => home.id === id)?.shared;

async function renderSharing(
  update: ReturnType<typeof recordMock>,
  ...more: ReturnType<typeof recordMock>[]
) {
  const rendered = renderHookWithApollo(() => useDietarySharing(), {
    operationMocks: [homesMock().mock, update.mock, ...more.map(m => m.mock)],
  });
  await waitFor(() => expect(rendered.result.current.homes).toHaveLength(2));
  return rendered;
}

describe('useDietarySharing', () => {
  it('lists each home with the caller’s own switch', async () => {
    const { result } = await renderSharing(
      recordMock(UpdateDietarySharingDocument, {}),
    );

    expect(result.current.homes).toEqual([
      { id: 'home-1', name: 'Test Home', shared: false },
      { id: 'home-2', name: 'Beach House', shared: true },
    ]);
  });

  it('flips the switch before the server answers, and sends the home', async () => {
    const update = recordMock(UpdateDietarySharingDocument, {
      held: true,
      data: {
        updateDietarySharing: {
          __typename: 'UpdateDietarySharingPayload',
          membership: { id: 'm-1', sharesDietaryNeeds: true },
        },
      },
    });
    const { result } = await renderSharing(update);

    let settled: Promise<void> | undefined;
    act(() => {
      settled = result.current.setShared('home-1', true);
    });

    await waitFor(() =>
      expect(sharedOf(result.current.homes, 'home-1')).toBe(true),
    );
    expect(update.fired).toEqual([
      {
        input: {
          homeId: 'home-1',
          shared: true,
          idempotencyKey: expect.any(String),
        },
      },
    ]);
    update.release();
    await act(async () => {
      await settled;
    });
    expect(sharedOf(result.current.homes, 'home-1')).toBe(true);
  });

  it('keeps the switch when the write queues offline', async () => {
    const update = recordMock(UpdateDietarySharingDocument, {
      data: { updateDietarySharing: null },
      partial: true,
    });
    const { result } = await renderSharing(update);

    await act(async () => {
      await result.current.setShared('home-2', false);
    });

    expect(sharedOf(result.current.homes, 'home-2')).toBe(false);
  });

  it('shows the server’s state and says why when the home refuses', async () => {
    const toast = jest.spyOn(toastService, 'error').mockImplementation();
    const update = recordMock(UpdateDietarySharingDocument, {
      data: {
        updateDietarySharing: {
          __typename: 'ForbiddenError',
          code: ErrorCode.HomeAccessDenied,
          message: 'Not a member',
        },
      },
    });
    const reread = homesMock();
    const { result } = await renderSharing(update, reread);

    await act(async () => {
      await result.current.setShared('home-1', true);
    });

    await waitFor(() =>
      expect(sharedOf(result.current.homes, 'home-1')).toBe(false),
    );
    expect(reread.fired).toHaveLength(1);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  // Off, on, off: the first toggle's refusal lands after the third was taken.
  // Flipping the refused value back would turn the switch on over the
  // server's off.
  it('never undoes a later toggle when an earlier one is refused last', async () => {
    jest.spyOn(toastService, 'error').mockImplementation();
    const applied = (shared: boolean) =>
      recordMock(UpdateDietarySharingDocument, {
        maxUsageCount: 1,
        data: {
          updateDietarySharing: {
            __typename: 'UpdateDietarySharingPayload',
            membership: { id: 'm-2', sharesDietaryNeeds: shared },
          },
        },
      });
    const refusedLate = recordMock(UpdateDietarySharingDocument, {
      held: true,
      maxUsageCount: 1,
      data: {
        updateDietarySharing: {
          __typename: 'ConflictError',
          code: ErrorCode.Conflict,
          message: 'busy',
        },
      },
    });
    const on = applied(true);
    const off = applied(false);
    const reread = homesMock({ 'home-1': false, 'home-2': false });
    const { result } = await renderSharing(refusedLate, on, off, reread);

    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.setShared('home-2', false);
    });
    await waitFor(() => expect(refusedLate.fired).toHaveLength(1));
    await act(async () => {
      await result.current.setShared('home-2', true);
    });
    await act(async () => {
      await result.current.setShared('home-2', false);
    });
    refusedLate.release();
    await act(async () => {
      await first;
    });

    await waitFor(() => expect(reread.fired).toHaveLength(1));
    await waitFor(() =>
      expect(sharedOf(result.current.homes, 'home-2')).toBe(false),
    );
  });
});
