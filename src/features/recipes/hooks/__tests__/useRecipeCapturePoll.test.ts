import { toastService } from '#/services/toastService';
import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { RecipeCaptureStatus } from '#/graphql/generated/schemaTypes';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { announceWorkSettled } from '#/services/subscriptions/settledWork';
import { RecipeCaptureDocument } from '../useRecipeCapture.generated';
import { useRecipeCapturePoll } from '../useRecipeCapturePoll';
import {
  CAPTURE_DEADLINE_MS,
  useRecipeCaptureStore,
  type CaptureEntry,
} from '#features/recipes/store/recipeCaptureStore';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));

const mockToastSuccess = jest.mocked(toastService.success);
const mockToastError = jest.mocked(toastService.error);
const mockToastInfo = jest.mocked(toastService.info);

const entry = (createdAt = Date.now(), answered = true): CaptureEntry => ({
  id: 'capture-1',
  source: 'url',
  label: 'example-cooking.com',
  createdAt: new Date(createdAt).toISOString(),
  state: 'reading',
  answered,
});

const answering = (
  recipeCapture: Record<string, unknown> | null,
): ReturnType<typeof recordMock> =>
  recordMock(RecipeCaptureDocument, {
    data: {
      recipeCapture: recipeCapture && {
        id: 'capture-1',
        alreadySaved: false,
        ...recipeCapture,
      },
    },
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useIsApiUnavailable).mockReturnValue(false);
  useRecipeCaptureStore.getState().reset();
  const { id, source, label, createdAt } = entry();
  useRecipeCaptureStore.getState().addReading({ id, source, label, createdAt });
});

const answerAtOnce = (mocks: MockedResponse[]) =>
  mocks.map(mock => ({ ...mock, delay: 0 }));

// Stops where an answer lands: a mounted poll would never drain.
const settle = () => act(() => jest.advanceTimersByTimeAsync(0));

describe('useRecipeCapturePoll', () => {
  it('tells a saved capture and holds its recipe for review', async () => {
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: answerAtOnce([
        answering({
          status: RecipeCaptureStatus.Saved,
          recipe: { id: 'recipe-1', name: 'Miso salmon' },
        }).mock,
      ]),
    });

    await settle();
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(useRecipeCaptureStore.getState()).toMatchObject({
      entries: [],
      held: [expect.objectContaining({ recipeId: 'recipe-1' })],
    });
  });

  // Joined, the refetch would get the poll's answer, read before the capture
  // settled, and wait for the next poll.
  it('asks again when the capture settles while a poll is in flight', async () => {
    const inFlight = recordMock(RecipeCaptureDocument, {
      held: true,
      maxUsageCount: 1,
      data: {
        recipeCapture: {
          id: 'capture-1',
          alreadySaved: false,
          status: RecipeCaptureStatus.Pending,
        },
      },
    });
    const settled = answering({
      status: RecipeCaptureStatus.Saved,
      recipe: { id: 'recipe-1', name: 'Miso salmon' },
    });
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: answerAtOnce([inFlight.mock, settled.mock]),
    });
    await settle();
    expect(inFlight.fired).toHaveLength(1);

    act(() => {
      announceWorkSettled({ kind: 'recipeCapture', id: 'capture-1' });
    });

    await settle();
    expect(mockToastSuccess).toHaveBeenCalled();
    expect(settled.fired).toHaveLength(1);
    inFlight.release();
  });

  it('keeps a partial read as a row to finish', async () => {
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: answerAtOnce([
        answering({ status: RecipeCaptureStatus.Incomplete }).mock,
      ]),
    });

    await settle();
    expect(mockToastInfo).toHaveBeenCalled();
    expect(useRecipeCaptureStore.getState().entries).toEqual([
      expect.objectContaining({ id: 'capture-1', state: 'incomplete' }),
    ]);
  });

  // The entry is kept before its create is sent, so a poll beside it could
  // reach the server first and be told there is no such capture.
  it('asks nothing before its create is answered', () => {
    const poll = answering(null);

    renderHookWithApollo(() => useRecipeCapturePoll(entry(Date.now(), false)), {
      operationMocks: answerAtOnce([poll.mock]),
    });

    expect(poll.fired).toEqual([]);
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('says a capture the server does not know could not be read', async () => {
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: answerAtOnce([answering(null).mock]),
    });

    await settle();
    expect(mockToastError).toHaveBeenCalledWith(
      "Recipe import isn't available right now. Try again later.",
    );
    expect(useRecipeCaptureStore.getState().entries).toEqual([]);
  });

  it('asks nothing while the API is unreachable', () => {
    jest.mocked(useIsApiUnavailable).mockReturnValue(true);
    const poll = answering({ status: RecipeCaptureStatus.Pending });

    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: answerAtOnce([poll.mock]),
    });

    expect(poll.fired).toEqual([]);
  });

  it('gives up at the deadline the server keeps', () => {
    jest.mocked(useIsApiUnavailable).mockReturnValue(true);
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: answerAtOnce([]),
    });

    act(() => {
      jest.advanceTimersByTime(CAPTURE_DEADLINE_MS);
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(useRecipeCaptureStore.getState().entries).toEqual([]);
  });
});
