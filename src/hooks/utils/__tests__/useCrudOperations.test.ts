'use no memo';

import { renderHook } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { useCrudOperations } from '../useCrudOperations';

const mockClient = {
  readFragment: jest.fn(),
  writeFragment: jest.fn(),
  cache: { identify: jest.fn() },
};

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: jest.fn(() => mockClient),
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
  getErrorMessage: jest.fn((e: any) => e?.message || 'An error occurred'),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/utils/errorHandlers', () => ({
  handleVersionConflictAlert: jest.fn(() => false),
  handleMutationErrorAlert: jest.fn(),
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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        parentId: () => 'parent-123',
      });

      const data = await addOp({ name: 'test' });

      expect(data).toEqual({ id: '1' });
    });

    it('handles GraphQL errors returned in result.errors', async () => {
      const mockMutation = jest.fn().mockResolvedValue({
        data: null,
        errors: [{ message: 'Duplicate entry' }],
      });

      const { result } = renderHook(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
      });

      const data = await addOp({ name: 'test' });

      expect(data).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Duplicate entry',
      );
    });

    it('shows error when result has no data', async () => {
      const mockMutation = jest.fn().mockResolvedValue({});

      const { result } = renderHook(() => useCrudOperations());

      const addOp = result.current.createAddOperation({
        mutation: mockMutation,
        operationName: 'Create Item',
      });

      const data = await addOp({ name: 'test' });

      expect(data).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to create item',
      );
    });
  });

  describe('createUpdateOperation', () => {
    it('calls mutation with id and input on success', async () => {
      const mockMutation = jest
        .fn()
        .mockResolvedValue({ data: { id: '1', name: 'Updated' } });
      const onSuccess = jest.fn();

      const { result } = renderHook(() => useCrudOperations());

      const updateOp = result.current.createUpdateOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        onSuccess,
      });

      const data = await updateOp({ name: 'Updated' });

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { id: 'item-1', input: { name: 'Updated' } },
      });
      expect(onSuccess).toHaveBeenCalledWith({ id: '1', name: 'Updated' });
      expect(data).toEqual({ id: '1', name: 'Updated' });
    });

    it('includes version for optimistic concurrency', async () => {
      const mockMutation = jest.fn().mockResolvedValue({ data: { id: '1' } });
      const getFragmentData = jest.fn().mockReturnValue({ version: 5 });

      const { result } = renderHook(() => useCrudOperations());

      const updateOp = result.current.createUpdateOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        getFragmentData,
        includeVersion: true,
      });

      await updateOp({ name: 'Updated' });

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { id: 'item-1', input: { name: 'Updated', version: 5 } },
      });
    });

    it('validates input and rejects invalid', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHook(() => useCrudOperations());

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
  });

  describe('createRemoveOperation', () => {
    it('calls mutation with item id', async () => {
      const mockMutation = jest
        .fn()
        .mockResolvedValue({ data: { id: '1', deleted: true } });
      const onSuccess = jest.fn();

      const { result } = renderHook(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        onSuccess,
      });

      const data = await removeOp();

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { id: 'item-1' },
      });
      expect(onSuccess).toHaveBeenCalledWith({ id: '1', deleted: true });
      expect(data).toEqual({ id: '1', deleted: true });
    });

    it('shows confirmation dialog when confirmMessage is provided', async () => {
      const mockMutation = jest.fn().mockResolvedValue({ data: { id: '1' } });

      const { result } = renderHook(() => useCrudOperations());

      const removeOp = result.current.createRemoveOperation({
        mutation: mockMutation,
        itemId: 'item-1',
        confirmMessage: 'Are you sure you want to delete {name}?',
        itemName: 'My Item',
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
      const buttons = alertCalls[alertCalls.length - 1][2];
      const deleteButton = buttons.find((b: any) => b.text === 'Delete');

      await deleteButton.onPress();
      const data = await deletePromise;

      expect(mockMutation).toHaveBeenCalledWith({
        variables: { id: 'item-1' },
      });
      expect(data).toEqual({ id: '1' });
    });

    it('returns false when parentId is required but empty string', async () => {
      const mockMutation = jest.fn();

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

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

      const { result } = renderHook(() => useCrudOperations());

      const simpleOp = result.current.createSimpleOperation({
        operation: mockOperation,
        operationName: 'My Operation',
      });

      const data = await simpleOp();

      expect(data).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to my operation',
      );
    });
  });
});
