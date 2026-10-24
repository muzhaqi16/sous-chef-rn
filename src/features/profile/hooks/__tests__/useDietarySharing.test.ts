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

const homesMock = () =>
  recordMock(DietarySharingHomesDocument, {
    data: {
      homes: {
        edges: [
          {
            node: {
              id: 'home-1',
              name: 'Test Home',
              myMembership: { id: 'm-1', sharesDietaryNeeds: false },
            },
          },
          {
            node: {
              id: 'home-2',
              name: 'Beach House',
              myMembership: { id: 'm-2', sharesDietaryNeeds: true },
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

async function renderSharing(update: ReturnType<typeof recordMock>) {
  const rendered = renderHookWithApollo(() => useDietarySharing(), {
    operationMocks: [homesMock().mock, update.mock],
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

  it('flips back and says why when the home refuses', async () => {
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
    const { result } = await renderSharing(update);

    await act(async () => {
      await result.current.setShared('home-1', true);
    });

    await waitFor(() =>
      expect(sharedOf(result.current.homes, 'home-1')).toBe(false),
    );
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
