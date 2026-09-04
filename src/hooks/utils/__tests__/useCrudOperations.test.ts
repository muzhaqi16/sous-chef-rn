'use no memo';

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { alertService, type AlertButton } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { alertVersionConflict } from '#/utils/errorHandlers';
import { useCrudOperations } from '../useCrudOperations';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/errorService');
import { errorService as mockedErrorService } from '#/services/errorService';

// These two tests assert WHICH code was looked up, so the lookup has to be
// visible in its result rather than collapsing to the shared default.
jest
  .mocked(mockedErrorService.getUserFriendlyMessage)
  .mockImplementation((code: string) => `mapped:${code}`);

jest.mock('#/utils/finallyHelpers');

jest.mock('#/utils/errorHandlers', () => ({
  handleVersionConflictAlert: jest.fn(() => false),
  handleMutationErrorAlert: jest.fn(),
  alertVersionConflict: jest.fn(),
}));

describe('useCrudOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAddOperation', () => {
    it('calls mutation with input and returns data on success', async () => {
      const mockMutation = jest
        .fn()
        .mockResolvedValue({ data: { id: '1', name: 'Item' } });
      const onSuccess = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        onSuccess,
        operationName: 'Add Item',
      });

      const data = await addOp({ name: 'Test' });

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { input: { name: 'Test' } },
      });
      expect(onSuccess).toHaveBeenCalledWith({ id: '1', name: 'Item' });
      expect(data).toEqual({ id: '1', name: 'Item' });
    });

    it('transforms input before calling mutation', async () => {
      const mockMutation = jest.fn().mockResolvedValue({ data: { id: '1' } });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        transformInput: (input: { name: string }) => ({
          name: input.name.toUpperCase(),
          extra: true,
        }),
      });

      await addOp({ name: 'test' });

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { input: { name: 'TEST', extra: true } },
      });
    });

    it('validates input and rejects with string message', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        validateInput: (input: { name: string }) =>
          input.name.length === 0 ? 'Name is required' : true,
      });

      const data = await addOp({ name: '' });

      expect(data).toBe(false);
      expect(mockMutation).not.toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Name is required',
      );
    });

    it('validates input and rejects with boolean false', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        validateInput: () => false,
      });

      const data = await addOp({ name: 'test' });

      expect(data).toBe(false);
      expect(mockMutation).not.toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Invalid input',
      );
    });

    it('returns false when parentId is required but null', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        parentId: null,
      });

      const data = await addOp({ name: 'test' });

      expect(data).toBe(false);
      expect(mockMutation).not.toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Parent context is required',
      );
    });

    it('returns false when parentId function resolves to undefined', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        parentId: () => undefined as unknown as string,
      });

      const data = await addOp({ name: 'test' });

      expect(data).toBe(false);
      expect(mockMutation).not.toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Parent context is required',
      );
    });

    it('resolves parentId from function', async () => {
      const mockMutation = jest.fn().mockResolvedValue({ data: { id: '1' } });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        parentId: () => 'parent-123',
      });

      const data = await addOp({ name: 'test' });

      expect(data).toEqual({ id: '1' });
    });

    it('never shows a top-level GraphQL error message — codeless gets the generic line', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: null,
        errors: [{ message: 'Duplicate entry' }],
      });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
      });

      const data = await addOp({ name: 'test' });

      expect(data).toBe(false);
      // 'Duplicate entry' is server-authored English; the user sees copy from
      // the app's own locale files instead.
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Something went wrong. Please try again.',
      );
    });

    it('maps a top-level GraphQL error extensions.code to localized copy', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: null,
        errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }],
      });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
      });

      await addOp({ name: 'test' });

      expect(errorService.getUserFriendlyMessage).toHaveBeenCalledWith(
        'FORBIDDEN',
      );
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'mapped:FORBIDDEN',
      );
    });

    it('routes an errors-as-data ValidationError with a field to errors.field copy', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: {
          createItem: {
            __typename: 'ValidationError',
            code: 'VALIDATION_FIELD_INVALID',
            message: 'unit is locked',
            field: 'input.unit',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
      });

      const data = await addOp({ name: 'test' });

      expect(data).toBe(false);
      // The real en.json errors.field.unit string — field wins over code.
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        "This item's unit can't be used right now. Deplete its batches first, or pick a unit it converts to \u2014 a made-up unit can't be measured against one.",
      );
    });

    it('routes an errors-as-data member without a field through its code', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: {
          createItem: {
            __typename: 'ForbiddenError',
            code: 'FORBIDDEN',
            message: 'nope',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        operationName: 'Create Item',
      });

      await addOp({ name: 'test' });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'mapped:FORBIDDEN',
      );
      // Telemetry keeps the server's raw wording; the user never sees it.
      const reported = (errorService.reportError as jest.Mock).mock
        .calls[0][0] as Error;
      expect(reported.message).toBe('Create Item: nope');
    });

    it('falls back to the generic line for a member with no code', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: {
          createItem: {
            __typename: 'PlainError',
            message: 'raw server words',
          },
        },
      });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
      });

      await addOp({ name: 'test' });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Something went wrong. Please try again.',
      );
    });

    it('shows error when result has no data', async () => {
      const mockMutation = jest.fn().mockResolvedValue({});

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        operationName: 'Create Item',
      });

      const data = await addOp({ name: 'test' });

      expect(data).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Something went wrong. Please try again.',
      );
    });
  });

  describe('createUpdateOperation', () => {
    it('calls mutation with id and input on success', async () => {
      const mockMutation = jest
        .fn()
        .mockResolvedValue({ data: { id: '1', name: 'Updated' } });
      const onSuccess = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const updateOp = result.current.createUpdateOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        onSuccess,
      });

      const data = await updateOp({ name: 'Updated' });

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { input: { id: 'item-1', name: 'Updated' } },
      });
      expect(onSuccess).toHaveBeenCalledWith({ id: '1', name: 'Updated' });
      expect(data).toEqual({ id: '1', name: 'Updated' });
    });

    it('includes version for optimistic concurrency', async () => {
      const mockMutation = jest.fn().mockResolvedValue({ data: { id: '1' } });
      const getFragmentData = jest.fn().mockReturnValue({ version: 5 });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const updateOp = result.current.createUpdateOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        getFragmentData,
        includeVersion: true,
      });

      await updateOp({ name: 'Updated' });

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { input: { id: 'item-1', name: 'Updated', version: 5 } },
      });
    });

    it('validates input and rejects invalid', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const updateOp = result.current.createUpdateOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        validateInput: () => 'Field is required',
      });

      const data = await updateOp({ name: '' });

      expect(data).toBe(false);
      expect(mockMutation).not.toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Field is required',
      );
    });

    it('routes a resolved ConflictError data-member to the version-conflict refresh UX', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: {
          updateItem: {
            __typename: 'ConflictError',
            code: 'VERSION_CONFLICT',
            message: 'Stale write',
          },
        },
      });
      const onVersionConflict = jest.fn();
      const onError = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const updateOp = result.current.createUpdateOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        onVersionConflict,
        onError,
      });

      const data = await updateOp({ name: 'x' });

      // The conflict is surfaced via the refresh alert wired to onVersionConflict,
      // not the generic error alert.
      expect(data).toBe(false);
      expect(alertVersionConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          onRefresh: onVersionConflict,
          customMessage: 'Stale write',
        }),
      );
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('createRemoveOperation', () => {
    it('calls mutation with item id', async () => {
      const mockMutation = jest
        .fn()
        .mockResolvedValue({ data: { id: '1', deleted: true } });
      const onSuccess = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        onSuccess,
      });

      const data = await removeOp();

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { input: { id: 'item-1' } },
      });
      expect(onSuccess).toHaveBeenCalledWith({ id: '1', deleted: true });
      expect(data).toEqual({ id: '1', deleted: true });
    });

    it('shows confirmation dialog when confirmMessage is provided', async () => {
      const mockMutation = jest.fn().mockResolvedValue({ data: { id: '1' } });

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        confirmMessage: 'Are you sure you want to delete My Item?',
        operationName: 'Delete Item',
      });

      const deletePromise = removeOp();

      // alertService.alert should have been called with confirmation dialog
      expect(alertService.alert).toHaveBeenCalledWith(
        'Delete Item',
        'Are you sure you want to delete My Item?',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({ text: 'Delete', style: 'destructive' }),
        ]),
      );

      // Simulate pressing 'Delete' button
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      const buttons = alertCalls[alertCalls.length - 1][2] as AlertButton[];
      const deleteButton = buttons.find(b => b.text === 'Delete');

      await deleteButton?.onPress?.();
      const data = await deletePromise;

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { input: { id: 'item-1' } },
      });
      expect(data).toEqual({ id: '1' });
    });

    it('returns false when parentId is required but empty string', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
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
  });

  describe('createSimpleOperation', () => {
    it('calls operation with args and returns data', async () => {
      const mockOperation = jest
        .fn()
        .mockResolvedValue({ data: { result: 'done' } });
      const onSuccess = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const simpleOp = result.current.createSimpleOperation({
        operation: mockOperation,
        onSuccess,
      });

      const data = await simpleOp('arg1', 'arg2');

      expect(mockOperation).toHaveBeenCalledWith('arg1', 'arg2');
      expect(onSuccess).toHaveBeenCalledWith({ result: 'done' });
      expect(data).toEqual({ result: 'done' });
    });

    it('validates and rejects with string message', async () => {
      const mockOperation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const simpleOp = result.current.createSimpleOperation({
        operation: mockOperation,
        validate: (val: string) => (val === '' ? 'Cannot be empty' : true),
      });

      const data = await simpleOp('');

      expect(data).toBe(false);
      expect(mockOperation).not.toHaveBeenCalled();
      expect(alertService.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Cannot be empty',
      );
    });

    it('validates and rejects with boolean false', async () => {
      const mockOperation = jest.fn();

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const simpleOp = result.current.createSimpleOperation<[string], unknown>({
        operation: mockOperation,
        validate: () => false,
      });

      const data = await simpleOp('anything');

      expect(data).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Invalid operation',
      );
    });

    it('returns false when operation returns no data', async () => {
      const mockOperation = jest.fn().mockResolvedValue({});

      const { result } = renderHookWithApollo(() => useCrudOperations());

      const simpleOp = result.current.createSimpleOperation({
        operation: mockOperation,
        operationName: 'My Operation',
      });

      const data = await simpleOp();

      expect(data).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Something went wrong. Please try again.',
      );
    });
  });
});
