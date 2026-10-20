import { toastService } from '#/services/toastService';
import { act } from '@testing-library/react-native';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  ErrorCode,
  RecipeCaptureStatus,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import { CreateRecipeCaptureDocument } from '../useRecipeCapture.generated';
import { useRecipeCapture, type CaptureStart } from '../useRecipeCapture';
import { useRecipeCaptureStore } from '#features/recipes/store/recipeCaptureStore';

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#/utils/generateEntityId', () => ({
  generateEntityId: () => 'capture-1',
}));
jest.mock('#/utils/deviceLocale', () => ({
  getDeviceLocale: () => 'en-AU',
}));
// A resend waits a backoff first; the wait itself is not under test.
jest.mock('#/utils/backoff', () => ({
  ...jest.requireActual('#/utils/backoff'),
  sleep: () => Promise.resolve(),
}));

const mockToastSuccess = jest.mocked(toastService.success);

beforeEach(() => {
  jest.clearAllMocks();
  useRecipeCaptureStore.getState().reset();
});

const accepted = (status = RecipeCaptureStatus.Pending) =>
  recordMock(CreateRecipeCaptureDocument, {
    data: {
      createRecipeCapture: {
        __typename: 'CreateRecipeCapturePayload',
        capture: {
          id: 'capture-1',
          status,
          alreadySaved: false,
          recipe:
            status === RecipeCaptureStatus.Saved
              ? { id: 'recipe-1', name: 'Miso salmon' }
              : null,
        },
      },
    },
  });

async function startWith(
  mocks: ReturnType<typeof recordMock>[],
  request: Parameters<ReturnType<typeof useRecipeCapture>['start']>[0] = {
    source: 'url',
    url: 'https://www.example-cooking.com/miso-salmon/',
  },
) {
  const { result } = renderHookWithApollo(() => useRecipeCapture(), {
    operationMocks: mocks.map(mock => mock.mock),
  });
  let outcome: CaptureStart | undefined;
  await act(async () => {
    outcome = await result.current.start(request);
  });
  return outcome;
}

describe('useRecipeCapture', () => {
  it('sends the minted id with the device locale and remembers the capture', async () => {
    const create = accepted();

    const outcome = await startWith([create]);

    expect(outcome).toEqual({ kind: 'started' });
    expect(create.fired).toEqual([
      {
        input: {
          id: 'capture-1',
          url: 'https://www.example-cooking.com/miso-salmon/',
          locale: 'en-AU',
        },
      },
    ]);
    expect(useRecipeCaptureStore.getState().entries).toEqual([
      expect.objectContaining({
        id: 'capture-1',
        source: 'url',
        label: 'example-cooking.com',
        state: 'reading',
        // The create was answered, so a poll that finds nothing is a loss.
        answered: true,
      }),
    ]);
  });

  it('sends a caption with its post as the source', async () => {
    const create = accepted();

    await startWith([create], {
      source: 'text',
      text: 'Miso salmon for two\n2 tbsp white miso',
      sourceUrl: 'https://www.instagram.com/p/post/',
    });

    expect(create.fired[0]).toEqual({
      input: {
        id: 'capture-1',
        text: 'Miso salmon for two\n2 tbsp white miso',
        sourceUrl: 'https://www.instagram.com/p/post/',
        locale: 'en-AU',
      },
    });
  });

  it('resends a lost answer under the same id', async () => {
    const lost = recordMock(CreateRecipeCaptureDocument, {
      error: new Error('Network request failed'),
      maxUsageCount: 1,
    });
    const create = accepted();

    const outcome = await startWith([lost, create]);

    expect(outcome).toEqual({ kind: 'started' });
    // Every attempt names the one capture, so the server queues it once.
    const ids = [...lost.fired, ...create.fired].map(
      vars => (vars.input as { id: string }).id,
    );
    expect(new Set(ids)).toEqual(new Set(['capture-1']));
    expect(create.fired.length).toBeGreaterThan(0);
  });

  it('hands a refusal on the link back to the sheet, and forgets the capture', async () => {
    const refused = recordMock(CreateRecipeCaptureDocument, {
      data: {
        createRecipeCapture: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'url',
        },
      },
    });

    const outcome = await startWith([refused]);

    expect(outcome).toEqual({ kind: 'refused', field: 'url' });
    expect(useRecipeCaptureStore.getState().entries).toEqual([]);
  });

  it('says the daily allowance is spent', async () => {
    const limited = recordMock(CreateRecipeCaptureDocument, {
      error: new CombinedGraphQLErrors({
        errors: [
          {
            message: 'limited',
            extensions: {
              code: TopLevelErrorCode.RateLimitExceeded,
              retryAfter: 3600,
            },
          },
        ],
      }),
    });

    expect(await startWith([limited])).toEqual({ kind: 'limited' });
    expect(useRecipeCaptureStore.getState().entries).toEqual([]);
  });

  it('reports a capture a replay found already saved', async () => {
    await startWith([accepted(RecipeCaptureStatus.Saved)]);

    expect(mockToastSuccess).toHaveBeenCalledWith(
      '“Miso salmon” is saved to your recipes as a draft.',
      expect.objectContaining({
        action: expect.objectContaining({ label: 'Open' }),
      }),
    );
    expect(useRecipeCaptureStore.getState().held).toEqual([
      expect.objectContaining({ captureId: 'capture-1', recipeId: 'recipe-1' }),
    ]);
  });
});
