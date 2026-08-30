import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode, ItemImageStatus } from '#/graphql/generated/schemaTypes';
import { MarkPrimaryItemImageDocument } from '#features/catalog/hooks/useMarkPrimaryItemImage.generated';
import { useMarkPrimaryItemImage } from '#features/catalog/hooks/useMarkPrimaryItemImage';
import { alertService } from '#/services/alertService';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// Passthrough auto-mock — real behavior, but overridable per test to force the
// `false` return that a genuine throw produces. errorPolicy: 'all' means Apollo
// resolves rather than throws, so it can't be provoked through a mocked link.
jest.mock('#/utils/finallyHelpers');

const renderHook = (operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useMarkPrimaryItemImage(), { operationMocks });

/** A photo complete for `ItemPhotoCarousel_itemPhoto`, which the payload spreads. */
const photo = (id: string, isPrimary: boolean) => ({
  __typename: 'ItemPhoto' as const,
  id,
  url: `https://cdn.test/${id}.jpg`,
  perspective: null,
  isPrimary,
  status: ItemImageStatus.Approved,
  variants: [],
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMarkPrimaryItemImage', () => {
  it('sends the image id and reports success', async () => {
    const { mock, fired } = recordMock(MarkPrimaryItemImageDocument, {
      data: {
        markPrimaryItemImage: {
          __typename: 'MarkPrimaryItemImagePayload',
          item: {
            __typename: 'Item',
            id: 'item-1',
            imageUrl: 'https://cdn.test/photo-2.jpg',
            photos: [photo('photo-2', true), photo('photo-1', false)],
          },
        },
      },
    });
    const { result } = renderHook([mock]);

    const succeeded = await result.current.markPrimary('photo-2');

    expect(succeeded).toBe(true);
    // The input takes the ItemImage row id, NOT the item's — passing the item
    // id is the mistake the API docs call out, and it returns a ValidationError.
    expect(fired).toContainEqual({ input: { imageId: 'photo-2' } });
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  // A stale cached `canEdit` (the item was published, or ownership moved) is
  // the realistic way this fires, and it must not fail silently — the user
  // tapped an affordance that then did nothing.
  it('alerts and reports failure on ForbiddenError', async () => {
    const { mock } = recordMock(MarkPrimaryItemImageDocument, {
      data: {
        markPrimaryItemImage: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'You cannot edit this item.',
        },
      },
    });
    const { result } = renderHook([mock]);

    const succeeded = await result.current.markPrimary('photo-2');

    expect(succeeded).toBe(false);
    expect(alertService.alert).toHaveBeenCalled();
  });

  // The server refuses a size rendition or a non-APPROVED photo. It authors the
  // most specific copy available, so the alert body is its message.
  it("routes a refusal to localized copy, never the server's text", async () => {
    const { mock } = recordMock(MarkPrimaryItemImageDocument, {
      data: {
        markPrimaryItemImage: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'That photo is not approved.',
          field: 'imageId',
        },
      },
    });
    const { result } = renderHook([mock]);

    const succeeded = await result.current.markPrimary('photo-2');

    expect(succeeded).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      // Not 'That photo is not approved.' — the server's text is English by
      // construction (no `Accept-Language`, no locale on the token), so
      // displaying it puts English in front of every es/it/sq reader. With no
      // `errors.field.imageId` to resolve, this falls back to the caller's own
      // copy: vaguer, but in the reader's language, and the precise sentence is
      // still in the log.
      'Something went wrong updating the main photo. Please try again.',
    );
    expect(alertService.alert).not.toHaveBeenCalledWith(
      expect.any(String),
      'That photo is not approved.',
    );
  });

  // Apollo normalizes ItemPhoto by id, so the reordered gallery in the payload
  // is what flips isPrimary for every screen reading the cache — no `update`
  // callback and no refetch. Seeded with the incumbent hero so this asserts the
  // demotion too, not just that something was written.
  it('flips the primary flag on both photos in the cache', async () => {
    const cache = seedCache([
      { __typename: 'ItemPhoto', id: 'photo-1', isPrimary: true },
      { __typename: 'ItemPhoto', id: 'photo-2', isPrimary: false },
    ]);
    const { mock } = recordMock(MarkPrimaryItemImageDocument, {
      data: {
        markPrimaryItemImage: {
          __typename: 'MarkPrimaryItemImagePayload',
          item: {
            __typename: 'Item',
            id: 'item-1',
            imageUrl: 'https://cdn.test/photo-2.jpg',
            photos: [photo('photo-2', true), photo('photo-1', false)],
          },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useMarkPrimaryItemImage(), {
      operationMocks: [mock],
      cache,
    });

    await result.current.markPrimary('photo-2');

    const extracted = cache.extract() as Record<
      string,
      { isPrimary?: boolean } | undefined
    >;
    expect(extracted['ItemPhoto:photo-2']?.isPrimary).toBe(true);
    expect(extracted['ItemPhoto:photo-1']?.isPrimary).toBe(false);
  });
});
