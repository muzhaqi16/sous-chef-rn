import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import {
  ChangePantryItemUnitDocument,
  PreviewPantryItemUnitChangeDocument,
} from '../usePantryUnitChange.generated';
import {
  usePantryUnitChange,
  type ChangeOutcome,
  type PreviewOutcome,
} from '../usePantryUnitChange';

const mockApiUnavailable = jest.fn(() => false);
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => mockApiUnavailable(),
}));
jest.mock('#/services/errorService');

beforeEach(() => {
  jest.clearAllMocks();
  mockApiUnavailable.mockReturnValue(false);
});

const request = { pantryItemId: 'pi-1', unitId: 'u-lb' };

async function previewWith(
  mocks: Parameters<typeof renderHookWithApollo>[1],
): Promise<PreviewOutcome | undefined> {
  const { result } = renderHookWithApollo(() => usePantryUnitChange(), mocks);
  let outcome: PreviewOutcome | undefined;
  await act(async () => {
    outcome = await result.current.preview(request);
  });
  return outcome;
}

async function changeWith(
  member: Record<string, unknown>,
): Promise<ChangeOutcome | undefined> {
  const m = recordMock(ChangePantryItemUnitDocument, {
    data: { changePantryItemUnit: member },
  });
  const { result } = renderHookWithApollo(() => usePantryUnitChange(), {
    operationMocks: [m.mock],
  });
  let outcome: ChangeOutcome | undefined;
  await act(async () => {
    outcome = await result.current.change({ ...request, version: 3 });
  });
  return outcome;
}

describe('preview', () => {
  it('asks nothing of a server it cannot reach', async () => {
    mockApiUnavailable.mockReturnValue(true);
    await expect(previewWith({ operationMocks: [] })).resolves.toEqual({
      status: 'offline',
    });
  });

  it("returns the server's before and after", async () => {
    const m = recordMock(PreviewPantryItemUnitChangeDocument, {
      data: {
        previewPantryItemUnitChange: {
          version: 3,
          quantityBefore: 2,
          quantityAfter: 1.1,
        },
      },
    });
    const outcome = await previewWith({ operationMocks: [m.mock] });

    expect(outcome?.status).toBe('ready');
    expect(outcome?.status === 'ready' && outcome.preview).toEqual(
      expect.objectContaining({ version: 3, quantityAfter: 1.1 }),
    );
    expect(m.fired).toEqual([{ input: request }]);
  });
});

describe('change', () => {
  it('reports a change the server made', async () => {
    await expect(
      changeWith({ __typename: 'ChangePantryItemUnitPayload' }),
    ).resolves.toEqual({ status: 'changed' });
  });

  it('reports a stack that moved on since the preview, to preview again', async () => {
    await expect(
      changeWith({
        __typename: 'ConflictError',
        code: ErrorCode.VersionConflict,
      }),
    ).resolves.toEqual({ status: 'conflict' });
  });

  it('names the refused input in its own copy', async () => {
    await expect(
      changeWith({
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'raw server words',
        field: 'quantity',
      }),
    ).resolves.toEqual({
      status: 'failed',
      field: 'quantity',
      message: t('errors.field.quantity'),
    });
  });
});
