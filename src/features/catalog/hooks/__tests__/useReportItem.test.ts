import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { MarkItemForReviewDocument } from '#operations/item/item.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useReportItem } from '#features/catalog/hooks/useReportItem';
import { alertService } from '#/services/alertService';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

// Passthrough auto-mock — real behavior, but overridable per test to force the
// `false` return that a genuine throw produces. errorPolicy: 'all' means Apollo
// resolves rather than throws, so it can't be provoked through a mocked link.
jest.mock('#/utils/finallyHelpers');

const REASON = 'The photo shows a completely different product.';

const renderHook = (operationMocks: MockedResponse[]) =>
  renderHookWithApollo(() => useReportItem(), { operationMocks });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useReportItem', () => {
  it('sends the trimmed reason and reports success', async () => {
    const { mock, fired } = recordMock(MarkItemForReviewDocument, {
      data: {
        markItemForReview: {
          __typename: 'MarkItemForReviewPayload',
          item: { __typename: 'Item', id: 'item-1' },
        },
      },
    });
    const { result } = renderHook([mock]);

    const succeeded = await result.current.reportItem('item-1', `  ${REASON} `);

    expect(succeeded).toBe(true);
    expect(fired).toContainEqual({
      input: { itemId: 'item-1', reason: REASON },
    });
    expect(alertService.alert).toHaveBeenCalledWith(
      'Report sent',
      expect.stringContaining('admin'),
    );
  });

  // The item is already flagged and waiting on an admin. Nothing went wrong and
  // a retry can't improve on it, so this counts as sent — reporting a failure
  // would invite the user to keep re-sending something that already landed.
  it('treats an already-flagged item as sent rather than failed', async () => {
    const { mock } = recordMock(MarkItemForReviewDocument, {
      data: {
        markItemForReview: {
          __typename: 'ConflictError',
          code: ErrorCode.Conflict,
          message: 'Item already flagged',
        },
      },
    });
    const { result } = renderHook([mock]);

    const succeeded = await result.current.reportItem('item-1', REASON);

    expect(succeeded).toBe(true);
    expect(alertService.alert).toHaveBeenCalledWith(
      'Already reported',
      expect.stringContaining('waiting'),
    );
  });

  it("routes a refusal to localized copy, never the server's text", async () => {
    const { mock } = recordMock(MarkItemForReviewDocument, {
      data: {
        markItemForReview: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'Reason is too long',
          field: 'reason',
        },
      },
    });
    const { result } = renderHook([mock]);

    const succeeded = await result.current.reportItem('item-1', REASON);

    expect(succeeded).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      "Couldn't send that",
      // Not 'Reason is too long' — the server's text is English by
      // construction (no `Accept-Language`, no locale on the token), so
      // displaying it puts English in front of every es/it/sq reader. With no
      // `errors.field.reason` to resolve, this falls back to the caller's own
      // copy: vaguer, but in the reader's language, and the precise sentence is
      // still in the log.
      'Something went wrong sending your report. Please try again.',
    );
    expect(alertService.alert).not.toHaveBeenCalledWith(
      expect.any(String),
      'Reason is too long',
    );
  });

  it('distinguishes a missing item from a generic failure', async () => {
    const { mock } = recordMock(MarkItemForReviewDocument, {
      data: {
        markItemForReview: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
          message: 'No such item',
        },
      },
    });
    const { result } = renderHook([mock]);

    const succeeded = await result.current.reportItem('item-1', REASON);

    expect(succeeded).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      'Item not found',
      expect.stringContaining('catalog'),
    );
  });

  // Per-operation limits arrive as a top-level GraphQL error, not a union
  // member — without the isRateLimitError branch this falls through to the
  // generic copy and loses the retryAfter the server sent.
  it('recognises the rate limit even though it is not a union member', async () => {
    const { result } = renderHook([
      {
        request: { query: MarkItemForReviewDocument, variables: () => true },
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

    const succeeded = await result.current.reportItem('item-1', REASON);

    expect(succeeded).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      'Slow down a moment',
      expect.stringContaining('10 minute'),
    );
  });

  it('falls back to the generic failure for an unexpected member', async () => {
    const { mock } = recordMock(MarkItemForReviewDocument, {
      data: {
        markItemForReview: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'Not allowed',
        },
      },
    });
    const { result } = renderHook([mock]);

    const succeeded = await result.current.reportItem('item-1', REASON);

    expect(succeeded).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      "Couldn't send that",
      'Something went wrong sending your report. Please try again.',
    );
  });
});
