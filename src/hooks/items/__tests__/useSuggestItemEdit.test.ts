import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  CreateItemSuggestionDocument,
  UpdateItemDocument,
} from '../useSuggestItemEdit.generated';
import { useSuggestItemEdit } from '../useSuggestItemEdit';
import { ItemType, StorageState } from '#/graphql/generated/schemaTypes';
import type { EditableItemSnapshot } from '#utils/items/suggestItemChanges';
import type { AddItemSubmitPayload } from '#components/organisms/AddItemForm/AddItemForm';
import { alertService } from '#/services/alertService';
import { executeMutation } from '#/utils/compilerSafeWrappers';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// Passthrough auto-mock — real behavior, but overridable per test to force the
// `false` return that a genuine throw produces. errorPolicy: 'all' means Apollo
// resolves rather than throws, so it can't be provoked through a mocked link.
jest.mock('#/utils/compilerSafeWrappers');

const mockUploadItemImages = jest
  .fn()
  .mockResolvedValue([{ imageUrl: 'https://cdn.example.com/a.jpg' }]);
// `uploading` is part of the hook's contract, not incidental: the photos-only
// path runs no mutation, so it is the only thing that can gate the submit
// button while bytes are in flight.
let mockUploading = false;
jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    uploadItemImages: mockUploadItemImages,
    get uploading() {
      return mockUploading;
    },
  }),
}));

const NOTE = 'The net weight on the label is 500g, not 5g.';

const snapshot = (
  overrides: Partial<EditableItemSnapshot> = {},
): EditableItemSnapshot => ({
  id: 'item-1',
  // The default target: a public catalog item this user may propose edits to
  // but not write through — the suggestion path.
  canEdit: false,
  canSuggest: true,
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
  createItemSuggestion: {
    __typename: 'CreateItemSuggestionPayload' as const,
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
  mockUploading = false;
});

describe('useSuggestItemEdit', () => {
  // The submit button's only concurrency guard is this flag. The photos-only
  // path fires no mutation, so without `uploading` folded in the button stays
  // live for the whole upload and a second tap re-uploads the same files as
  // fresh image rows.
  it('reports loading while images are uploading', async () => {
    const { mock } = recordMock(CreateItemSuggestionDocument, {
      data: suggestionPayload(NOTE),
    });

    mockUploading = true;
    const { result } = renderHook([mock]);

    expect(result.current.loading).toBe(true);
  });

  it('sends a minimal structured diff for a public item', async () => {
    const { mock, fired } = recordMock(CreateItemSuggestionDocument, {
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
    const { mock } = recordMock(CreateItemSuggestionDocument, {
      data: suggestionPayload('An older note the server kept'),
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(snapshot(), form());

    expect(outcome).toEqual({ status: 'duplicate' });
  });

  it('blocks a no-op before it reaches the network', async () => {
    const { mock, fired } = recordMock(CreateItemSuggestionDocument, {
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
    const { mock, fired } = recordMock(CreateItemSuggestionDocument, {
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

  // Photos are the whole submission here, so an aborted batch must not close
  // the form behind a "submitted for review" alert the user will believe.
  it('fails the photos-only path when no photo reached the server', async () => {
    mockUploadItemImages.mockResolvedValueOnce([]);
    const { mock } = recordMock(CreateItemSuggestionDocument, {
      data: suggestionPayload(NOTE),
    });
    const { result } = renderHook([mock]);

    const outcome = await result.current.submitEdit(
      snapshot({ name: 'Skim Milk' }),
      form({ selectedImages: [{ uri: 'file://a.jpg', perspective: 'front' }] }),
    );

    expect(outcome).toEqual({ status: 'failed' });
  });

  it('reports the 5-pending cap distinctly from other failures', async () => {
    const { mock } = recordMock(CreateItemSuggestionDocument, {
      data: {
        createItemSuggestion: {
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
    const { mock } = recordMock(CreateItemSuggestionDocument, {
      data: {
        createItemSuggestion: {
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
    const { mock } = recordMock(CreateItemSuggestionDocument, {
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
      snapshot({ canEdit: true }),
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
        request: { query: CreateItemSuggestionDocument, variables: () => true },
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
    it('writes straight through when the user may edit the item', async () => {
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
              canEdit: true,
              canSuggest: true,
              displayUnit: null,
              brands: [],
            },
          },
        },
      });
      const { result } = renderHook([mock]);

      const outcome = await result.current.submitEdit(
        snapshot({ canEdit: true }),
        form(),
      );

      expect(outcome).toEqual({ status: 'updated' });
      await waitFor(() =>
        expect(fired).toContainEqual({
          input: { id: 'item-1', name: 'Skim Milk' },
        }),
      );
    });

    // A stale cached canEdit is absorbed: updateItem's Forbidden explicitly
    // tells the client to use createItemSuggestion, so do that.
    it('falls back to a suggestion when a direct write is forbidden', async () => {
      const update = recordMock(UpdateItemDocument, {
        data: {
          updateItem: {
            __typename: 'ForbiddenError',
            code: 'FORBIDDEN',
            message: 'Use createItemSuggestion',
          },
        },
      });
      const suggest = recordMock(CreateItemSuggestionDocument, {
        data: suggestionPayload(NOTE),
      });
      const { result } = renderHook([update.mock, suggest.mock]);

      const outcome = await result.current.submitEdit(
        snapshot({ canEdit: true }),
        form(),
      );

      expect(outcome).toEqual({ status: 'suggested' });
      await waitFor(() => expect(suggest.fired).toHaveLength(1));
    });

    // canEdit=false does not imply "suggest": a PRIVATE item the user doesn't
    // own — a housemate's pantry entry, a recipe ingredient — reaches the form
    // with both flags false. createItemSuggestion takes PUBLIC items only, so
    // sending one would spend one of just 10 per hour to earn a ValidationError.
    it('sends nothing for an item that accepts neither write path', async () => {
      const suggest = recordMock(CreateItemSuggestionDocument, {
        data: suggestionPayload(NOTE),
      });
      const { result } = renderHook([suggest.mock]);

      const outcome = await result.current.submitEdit(
        snapshot({ canEdit: false, canSuggest: false }),
        form(),
      );

      expect(outcome).toEqual({ status: 'readOnly' });
      expect(suggest.fired).toHaveLength(0);
      expect(alertService.alert).toHaveBeenCalledWith(
        "This item can't be edited",
        expect.stringContaining('public catalog'),
      );
    });

    // The Forbidden fallback is not unconditional. A stale canEdit tells us the
    // cached rights are wrong, which is no reason to assume the item can take a
    // suggestion — burning the same budget on the same guaranteed rejection.
    it('does not fall back to a suggestion the item cannot take', async () => {
      const update = recordMock(UpdateItemDocument, {
        data: {
          updateItem: {
            __typename: 'ForbiddenError',
            code: 'FORBIDDEN',
            message: 'Not yours',
          },
        },
      });
      const suggest = recordMock(CreateItemSuggestionDocument, {
        data: suggestionPayload(NOTE),
      });
      const { result } = renderHook([update.mock, suggest.mock]);

      const outcome = await result.current.submitEdit(
        snapshot({ canEdit: true, canSuggest: false }),
        form(),
      );

      expect(outcome).toEqual({ status: 'readOnly' });
      await waitFor(() => expect(update.fired).toHaveLength(1));
      expect(suggest.fired).toHaveLength(0);
    });

    // The flags are not mutually exclusive — an admin on a public item has both.
    // The direct write wins: there is nothing to review when you can just write.
    it('writes through rather than suggesting when both paths are open', async () => {
      const update = recordMock(UpdateItemDocument, {
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
              canEdit: true,
              canSuggest: true,
              displayUnit: null,
              brands: [],
            },
          },
        },
      });
      const suggest = recordMock(CreateItemSuggestionDocument, {
        data: suggestionPayload(NOTE),
      });
      const { result } = renderHook([update.mock, suggest.mock]);

      const outcome = await result.current.submitEdit(
        snapshot({ canEdit: true, canSuggest: true }),
        form(),
      );

      expect(outcome).toEqual({ status: 'updated' });
      await waitFor(() => expect(update.fired).toHaveLength(1));
      expect(suggest.fired).toHaveLength(0);
    });
  });
});
