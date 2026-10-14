import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { RecipeCaptureStatus } from '#/graphql/generated/schemaTypes';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { RecipeCaptureDocument } from '../useRecipeCapture.generated';
import { useRecipeCapturePoll } from '../useRecipeCapturePoll';
import {
  CAPTURE_DEADLINE_MS,
  useRecipeCaptureStore,
  type CaptureEntry,
} from '#features/recipes/store/recipeCaptureStore';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    warning: jest.fn(),
  },
}));

const entry = (createdAt = Date.now()): CaptureEntry => ({
  id: 'capture-1',
  source: 'url',
  label: 'example-cooking.com',
  createdAt: new Date(createdAt).toISOString(),
  state: 'reading',
});

const answering = (
  recipeCapture: Record<string, unknown> | null,
): ReturnType<typeof recordMock> =>
  recordMock(RecipeCaptureDocument, {
    data: {
      recipeCapture: recipeCapture && {
        __typename: 'RecipeCapture',
        id: 'capture-1',
        alreadySaved: false,
        failure: null,
        recipe: null,
        ...recipeCapture,
      },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useIsApiUnavailable).mockReturnValue(false);
  useRecipeCaptureStore.getState().reset();
  const { id, source, label, createdAt } = entry();
  useRecipeCaptureStore.getState().addReading({ id, source, label, createdAt });
});

describe('useRecipeCapturePoll', () => {
  it('tells a saved capture and holds its recipe for review', async () => {
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: [
        answering({
          status: RecipeCaptureStatus.Saved,
          recipe: { __typename: 'Recipe', id: 'recipe-1', name: 'Miso salmon' },
        }).mock,
      ],
    });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(useRecipeCaptureStore.getState()).toMatchObject({
      entries: [],
      held: [expect.objectContaining({ recipeId: 'recipe-1' })],
    });
  });

  it('keeps a partial read as a row to finish', async () => {
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: [
        answering({ status: RecipeCaptureStatus.Incomplete }).mock,
      ],
    });

    await waitFor(() => expect(mockToastInfo).toHaveBeenCalled());
    expect(useRecipeCaptureStore.getState().entries).toEqual([
      expect.objectContaining({ id: 'capture-1', state: 'incomplete' }),
    ]);
  });

  it('says a capture the server does not know could not be read', async () => {
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: [answering(null).mock],
    });

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "Recipe import isn't available right now. Try again later.",
      ),
    );
    expect(useRecipeCaptureStore.getState().entries).toEqual([]);
  });

  it('asks nothing while the API is unreachable', () => {
    jest.mocked(useIsApiUnavailable).mockReturnValue(true);
    const poll = answering({ status: RecipeCaptureStatus.Pending });

    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: [poll.mock],
    });

    expect(poll.fired).toEqual([]);
  });

  it('gives up at the deadline the server keeps', () => {
    jest.useFakeTimers();
    jest.mocked(useIsApiUnavailable).mockReturnValue(true);
    renderHookWithApollo(() => useRecipeCapturePoll(entry()), {
      operationMocks: [],
    });

    act(() => {
      jest.advanceTimersByTime(CAPTURE_DEADLINE_MS);
    });

    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(useRecipeCaptureStore.getState().entries).toEqual([]);
    jest.useRealTimers();
  });
});
