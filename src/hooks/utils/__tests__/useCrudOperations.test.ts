'use no memo';

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { alertService, type AlertButton } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { useCrudOperations } from '../useCrudOperations';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/errorService');

// These tests assert WHICH code was looked up, so the lookup has to be visible
// in its result rather than collapsing to the caller's fallback.
jest
  .mocked(errorService.getUserFriendlyMessage)
  .mockImplementation((code: string) => `mapped:${code}`);

const GENERIC = 'Something went wrong. Please try again.';
const alerts = () => (alertService.alert as jest.Mock).mock.calls;
const remove = { document: DeletePantryItemDocument };

describe('useCrudOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRemoveOperation', () => {
    it('calls mutation with item id', async () => {
      const payload = {
        deletePantryItem: { __typename: 'DeletePantryItemPayload' },
      };
      const mockMutation = jest.fn().mockResolvedValue({ data: payload });
      const onSuccess = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        mutation: mockMutation,
        itemId: 'item-1',
        onSuccess,
      });

      const data = await removeOp();

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { input: { id: 'item-1' } },
      });
      expect(onSuccess).toHaveBeenCalledWith(payload);
      expect(data).toEqual(payload);
    });

    it('counts a row that is already gone as removed', async () => {
      const gone = {
        deletePantryItem: {
          __typename: 'NotFoundError',
          code: ErrorCode.NotFound,
        },
      };
      const mockMutation = jest.fn().mockResolvedValue({ data: gone });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        mutation: mockMutation,
        itemId: 'item-1',
      });

      await expect(removeOp()).resolves.toEqual(gone);
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    it('shows confirmation dialog when confirmMessage is provided', async () => {
      const mockMutation = jest.fn().mockResolvedValue({ data: {} });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        mutation: mockMutation,
        itemId: 'item-1',
        confirmTitle: 'Delete Item',
        confirmMessage: 'Are you sure you want to delete My Item?',
      });

      const deletePromise = removeOp();

      expect(alertService.alert).toHaveBeenCalledWith(
        'Delete Item',
        'Are you sure you want to delete My Item?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Delete', style: 'destructive' }),
        ]),
      );

      const buttons = alerts().at(-1)?.[2] as AlertButton[];
      buttons.find(b => b.text === 'Delete')?.onPress?.();
      const data = await deletePromise;

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { input: { id: 'item-1' } },
      });
      expect(data).toEqual({});
    });

    it('returns false when parentId is required but empty string', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        mutation: mockMutation,
        itemId: 'item-1',
        parentId: '',
      });

      const data = await removeOp();

      expect(data).toBe(false);
      expect(mockMutation).not.toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Parent context is required',
      );
    });

    it('returns false when parentId is required but null', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        itemId: 'item-1',
        mutation: mockMutation,
        parentId: null,
      });

      const data = await removeOp();

      expect(data).toBe(false);
      expect(mockMutation).not.toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Parent context is required',
      );
    });

    it('resolves parentId from function', async () => {
      const mockMutation = jest.fn().mockResolvedValue({ data: {} });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        itemId: 'item-1',
        mutation: mockMutation,
        parentId: () => 'parent-123',
      });

      await expect(removeOp()).resolves.toEqual({});
    });

    it("never shows a resolved error's text — the caller's copy stands in", async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: undefined,
        error: new Error('Duplicate entry'),
      });
      const onFailed = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        itemId: 'item-1',
        mutation: mockMutation,
        onFailed,
      });

      const data = await removeOp();

      expect(data).toBe(false);
      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(alerts()).toEqual([['Error', GENERIC]]);
      expect(errorService.reportError).toHaveBeenCalledWith(expect.any(Error), {
        operation: operationNameOf(DeletePantryItemDocument),
      });
    });

    it('routes an errors-as-data ValidationError with a field to errors.field copy', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: {
          deletePantryItem: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'unit is locked',
            field: 'input.unit',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        itemId: 'item-1',
        mutation: mockMutation,
      });

      const data = await removeOp();

      expect(data).toBe(false);
      // The real en.json errors.field.unit string — field wins over code.
      expect(alerts()).toEqual([
        [
          'Error',
          "This item's unit can't be used right now. Deplete its batches first, or pick a unit it converts to — a made-up unit can't be measured against one.",
        ],
      ]);
    });

    it('routes an errors-as-data member without a field through its code', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: {
          deletePantryItem: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'nope',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        itemId: 'item-1',
        mutation: mockMutation,
      });

      await removeOp();

      expect(alerts()).toEqual([['Error', `mapped:${ErrorCode.Forbidden}`]]);
      expect(JSON.stringify(alerts())).not.toContain('nope');
    });

    it('falls back to the caller copy for a member with no code', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: {
          deletePantryItem: {
            __typename: 'ForbiddenError',
            message: 'raw server words',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        itemId: 'item-1',
        mutation: mockMutation,
        fallback: 'Could not remove it.',
      });

      await removeOp();

      expect(alerts()).toEqual([['Error', 'Could not remove it.']]);
    });

    it('treats a queued write as done, with nothing to say', async () => {
      const queued = { deletePantryItem: null };
      const mockMutation = jest.fn().mockResolvedValue({ data: queued });
      const onFailed = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        ...remove,
        itemId: 'item-1',
        mutation: mockMutation,
        onFailed,
      });

      await expect(removeOp()).resolves.toEqual(queued);
      expect(onFailed).not.toHaveBeenCalled();
      expect(alertService.alert).not.toHaveBeenCalled();
    });
  });
});
