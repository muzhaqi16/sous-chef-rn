import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  SuggestItemEditDocument,
  UpdateItemDocument,
} from '../useSuggestItemEdit.generated';
import { useSuggestItemEdit } from '../useSuggestItemEdit';
import {
  ItemType,
  StorageState,
  Visibility,
} from '#/graphql/generated/schemaTypes';
import type { EditableItemSnapshot } from '#utils/items/suggestItemChanges';
import type { AddItemSubmitPayload } from '#components/organisms/AddItemForm/AddItemForm';
import { alertService } from '#/services/alertService';
import { useIsAdminUser } from '#store/useAppStore';
import { executeMutation } from '#/utils/compilerSafeWrappers';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// Passthrough auto-mock — real behavior, but overridable per test to force the
// `false` return that a genuine throw produces. errorPolicy: 'all' means Apollo
// resolves rather than throws, so it can't be provoked through a mocked link.
jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#store/useAppStore', () => ({
  useIsAdminUser: jest.fn(() => false),
}));

const mockUploadItemImages = jest.fn().mockResolvedValue([]);
jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({ uploadItemImages: mockUploadItemImages }),
}));

const NOTE = 'The net weight on the label is 500g, not 5g.';

const snapshot = (
  overrides: Partial<EditableItemSnapshot> = {},
): EditableItemSnapshot => ({
  id: 'item-1',
  visibility: Visibility.Public,
  name: 'Whole Milk',
  type: ItemType.Food,
  storageState: StorageState.Ambient,
  tags: [],
  ...overrides,
});

const form = (
  overrides: Partial<AddItemSubmitPayload> = {},
): AddItemSubmitPayload =>
  ({
    name: 'Skim Milk',
    type: ItemType.Food,
    storageState: StorageState.Ambient,
    tags: [],
    editReason: NOTE,
    selectedImages: [],
    ...overrides,
  } as AddItemSubmitPayload);

const suggestionPayload = (note: string) => ({
  suggestItemEdit: {
    __typename: 'SuggestItemEditPayload' as const,
    suggestion: {
      __typename: 'ItemEditSuggestion' as const,
      id: 'sug-1',
      status: 'PENDING',
      note,
    },
  },
});

const renderHook = (operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useSuggestItemEdit(), { operationMocks });

beforeEach(() => {
  jest.clearAllMocks();
  (useIsAdminUser as jest.Mock).mockReturnValue(false);
});

describe('useSuggestItemEdit', () => {
  it('sends a minimal structured diff for a public item', async () => {
    const { mock, fired } = recordMock(SuggestItemEditDocument, {
      data: suggestionPayload(NOTE),
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(snapshot(), form());

    expect(outcome).toEqual({ status: 'suggested' });
    await waitFor(() =>
      expect(fired).toContainEqual({
        input: { itemId: 'item-1', note: NOTE, changes: { name: 'Skim Milk' } },
      }),
    );
  });

  // The server collapses a byte-identical pending suggestion onto the existing
  // one and drops the new note — the echoed note is the only way to tell.
  it('detects the idempotent duplicate collapse via the echoed note', async () => {
    const { mock } = recordMock(SuggestItemEditDocument, {
      data: suggestionPayload('An older note the server kept'),
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(snapshot(), form());

    expect(outcome).toEqual({ status: 'duplicate' });
  });

  it('blocks a no-op before it reaches the network', async () => {
    const { mock, fired } = recordMock(SuggestItemEditDocument, {
      data: suggestionPayload(NOTE),
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(
      snapshot({ name: 'Skim Milk' }),
      form(),
    );

    expect(outcome).toEqual({ status: 'noChanges' });
    expect(fired).toHaveLength(0);
  });

  it('uploads photos without a mutation when only images changed', async () => {
    const { mock, fired } = recordMock(SuggestItemEditDocument, {
      data: suggestionPayload(NOTE),
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(
      snapshot({ name: 'Skim Milk' }),
      form({ selectedImages: [{ uri: 'file://a.jpg', perspective: 'front' }] }),
    );

    expect(outcome).toEqual({ status: 'imagesOnly' });
    expect(fired).toHaveLength(0);
    expect(mockUploadItemImages).toHaveBeenCalled();
  });

  it('reports the 5-pending cap distinctly from other failures', async () => {
    const { mock } = recordMock(SuggestItemEditDocument, {
      data: {
        suggestItemEdit: {
          __typename: 'ConflictError',
          code: 'CONFLICT',
          message: 'Too many pending',
        },
      },
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(snapshot(), form());

    expect(outcome).toEqual({ status: 'failed' });
    // Distinct from the rate limit: a state you can clear, not a clock to wait out.
    expect(alertService.alert).toHaveBeenCalledWith(
      '5 suggestions pending',
      expect.stringContaining('waiting for review'),
    );
  });

  // A non-PUBLIC target answers ValidationError, never ForbiddenError.
  it('surfaces the server message on a validation failure', async () => {
    const { mock } = recordMock(SuggestItemEditDocument, {
      data: {
        suggestItemEdit: {
          __typename: 'ValidationError',
          code: 'VALIDATION_FAILED',
          message: 'Item is not public',
          field: 'itemId',
        },
      },
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(snapshot(), form());

    expect(outcome).toEqual({ status: 'failed' });
    expect(alertService.alert).toHaveBeenCalledWith(
      "Couldn't send that",
      'Item is not public',
    );
  });

  // A throw escaping errorPolicy leaves no union member and no result.error to
  // read, so it has to alert from the default branch — returning `failed`
  // silently would leave the sheet open with no explanation at all.
  it('still tells the user when the suggestion throws outright', async () => {
    (executeMutation as jest.Mock).mockResolvedValueOnce(false);
    const { mock } = recordMock(SuggestItemEditDocument, {
      data: suggestionPayload(NOTE),
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(snapshot(), form());

    expect(outcome).toEqual({ status: 'failed' });
    expect(alertService.alert).toHaveBeenCalledWith(
      "Couldn't send that",
      'Something went wrong sending your suggestion. Please try again.',
    );
  });

  it('still tells the user when a direct write throws outright', async () => {
    (executeMutation as jest.Mock).mockResolvedValueOnce(false);
    const { mock } = recordMock(UpdateItemDocument, { data: {} });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(
      snapshot({ visibility: Visibility.Private }),
      form(),
    );

    expect(outcome).toEqual({ status: 'failed' });
    expect(alertService.alert).toHaveBeenCalledWith(
      "Couldn't send that",
      'Something went wrong sending your suggestion. Please try again.',
    );
  });

  // The 10/hour limit is a top-level GraphQL error, not a union member.
  it('recognises the rate limit even though it is not a union member', async () => {
    const { result } = renderHook([
      {
        request: { query: SuggestItemEditDocument, variables: () => true },
        error: Object.assign(new Error('rate limited'), {
          errors: [
            {
              message: 'Too many requests',
              extensions: { code: 'OPERATION_RATE_LIMITED', retryAfter: 600 },
            },
          ],
        }),
      },
    ]);

    const outcome = await result.current.submitEdit(snapshot(), form());

    expect(outcome).toEqual({ status: 'failed' });
    // Proves OPERATION_RATE_LIMITED is in RATE_LIMIT_CODES — without it this
    // would fall through to the generic failure copy and lose the retryAfter.
    expect(alertService.alert).toHaveBeenCalledWith(
      'Slow down a moment',
      expect.stringContaining('10 minute'),
    );
  });

  describe('routing', () => {
    // Exposed so the form can word itself the same way submitEdit will act,
    // without a second component re-deriving `isAdmin` to ask the same question.
    it('exposes the same route submitEdit will take', () => {
      const { result } = renderHook([]);

      expect(result.current.resolveRoute(Visibility.Public)).toBe('suggest');
      expect(result.current.resolveRoute(Visibility.Private)).toBe('direct');
    });

    it('exposes an admin-aware route', () => {
      (useIsAdminUser as jest.Mock).mockReturnValue(true);
      const { result } = renderHook([]);

      expect(result.current.resolveRoute(Visibility.Public)).toBe('direct');
    });

    it('writes a non-public item straight through', async () => {
      const { mock, fired } = recordMock(UpdateItemDocument, {
        data: {
          updateItem: {
            __typename: 'UpdateItemPayload',
            item: {
              __typename: 'Item',
              id: 'item-1',
              name: 'Skim Milk',
              description: null,
              type: ItemType.Food,
              storageState: StorageState.Ambient,
              tags: [],
              primaryUpc: null,
              shelfLifeDays: null,
              shelfLifeOpenedDays: null,
              netWeight: null,
              baseDimension: null,
              imageUrl: null,
              visibility: Visibility.Private,
              displayUnit: null,
              brands: [],
            },
          },
        },
      });
      const { result } = renderHook([mock]);

      const outcome = await result.current.submitEdit(
        snapshot({ visibility: Visibility.Private }),
        form(),
      );

      expect(outcome).toEqual({ status: 'updated' });
      await waitFor(() =>
        expect(fired).toContainEqual({
          input: { id: 'item-1', name: 'Skim Milk', editReason: NOTE },
        }),
      );
    });

    // A stale/incorrect visibility guess is absorbed: updateItem's Forbidden
    // explicitly tells the client to use suggestItemEdit, so do that.
    it('falls back to a suggestion when a direct write is forbidden', async () => {
      const update = recordMock(UpdateItemDocument, {
        data: {
          updateItem: {
            __typename: 'ForbiddenError',
            code: 'AUTHZ_FORBIDDEN',
            message: 'Use suggestItemEdit',
          },
        },
      });
      const suggest = recordMock(SuggestItemEditDocument, {
        data: suggestionPayload(NOTE),
      });
      const { result } = renderHook([update.mock, suggest.mock]);

      const outcome = await result.current.submitEdit(
        snapshot({ visibility: Visibility.Private }),
        form(),
      );

      expect(outcome).toEqual({ status: 'suggested' });
      await waitFor(() => expect(suggest.fired).toHaveLength(1));
    });

    it('lets an admin write through to a public item', async () => {
      (useIsAdminUser as jest.Mock).mockReturnValue(true);
      const { mock, fired } = recordMock(UpdateItemDocument, {
        data: {
          updateItem: {
            __typename: 'UpdateItemPayload',
            item: {
              __typename: 'Item',
              id: 'item-1',
              name: 'Skim Milk',
              description: null,
              type: ItemType.Food,
              storageState: StorageState.Ambient,
              tags: [],
              primaryUpc: null,
              shelfLifeDays: null,
              shelfLifeOpenedDays: null,
              netWeight: null,
              baseDimension: null,
              imageUrl: null,
              visibility: Visibility.Public,
              displayUnit: null,
              brands: [],
            },
          },
        },
      });
      const { result } = renderHook([mock]);

      const outcome = await result.current.submitEdit(
        snapshot({ visibility: Visibility.Public }),
        form(),
      );

      expect(outcome).toEqual({ status: 'updated' });
      await waitFor(() => expect(fired).toHaveLength(1));
    });
  });
});
