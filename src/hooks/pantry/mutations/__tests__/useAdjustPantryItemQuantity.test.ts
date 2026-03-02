import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAdjustPantryItemQuantity } from '../useAdjustPantryItemQuantity';

const mockAdjustMutation = jest.fn();

jest.mock('#generated', () => ({
  useAdjustPantryItemQuantityMutation: jest.fn(() => [
    mockAdjustMutation,
    { loading: false },
  ]),
  PantryItemDisplayFragmentDoc: {},
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Adjust error' })),
  }),
}));

let mockHandleVersionConflict = false;
jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => mockHandleVersionConflict),
  getVersionConflictMessage: jest.fn(() => 'Version conflict message'),
}));

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleVersionConflict = false;
});

describe('useAdjustPantryItemQuantity', () => {
  it('returns adjustQuantity function and loading state', () => {
    const { result } = renderHook(() => useAdjustPantryItemQuantity());

    expect(typeof result.current.adjustQuantity).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('returns true and calls onSuccess on successful adjustment', async () => {
    const onSuccess = jest.fn();
    mockAdjustMutation.mockResolvedValue({
      data: {
        adjustPantryItemQuantity: {
          pantryItem: { id: 'item-1', quantity: 5 },
        },
      },
    });

    const { result } = renderHook(() =>
      useAdjustPantryItemQuantity({ onSuccess }),
    );

    let success: boolean;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Physical count');
    });

    expect(success!).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
    expect(mockAdjustMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          id: 'item-1',
          input: { newQuantity: 5, reason: 'Physical count' },
        },
      }),
    );
  });

  it('includes version when provided', async () => {
    mockAdjustMutation.mockResolvedValue({
      data: {
        adjustPantryItemQuantity: {
          pantryItem: { id: 'item-1', quantity: 3 },
        },
      },
    });

    const { result } = renderHook(() => useAdjustPantryItemQuantity());

    await act(async () => {
      await result.current.adjustQuantity('item-1', 3, 'Counted', 7);
    });

    expect(mockAdjustMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          id: 'item-1',
          input: { newQuantity: 3, reason: 'Counted', version: 7 },
        },
      }),
    );
  });

  it('includes remainingNetWeight when provided', async () => {
    mockAdjustMutation.mockResolvedValue({
      data: {
        adjustPantryItemQuantity: {
          pantryItem: { id: 'item-1', quantity: 2 },
        },
      },
    });

    const { result } = renderHook(() => useAdjustPantryItemQuantity());

    await act(async () => {
      await result.current.adjustQuantity('item-1', 2, 'Weighed', 5, 250);
    });

    expect(mockAdjustMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          id: 'item-1',
          input: {
            newQuantity: 2,
            reason: 'Weighed',
            version: 5,
            remainingNetWeight: 250,
          },
        },
      }),
    );
  });

  it('omits version and remainingNetWeight when undefined', async () => {
    mockAdjustMutation.mockResolvedValue({
      data: {
        adjustPantryItemQuantity: {
          pantryItem: { id: 'item-1', quantity: 1 },
        },
      },
    });

    const { result } = renderHook(() => useAdjustPantryItemQuantity());

    await act(async () => {
      await result.current.adjustQuantity('item-1', 1, 'Adjusted');
    });

    const calledInput = mockAdjustMutation.mock.calls[0][0].variables.input;
    expect(calledInput).not.toHaveProperty('version');
    expect(calledInput).not.toHaveProperty('remainingNetWeight');
  });

  it('shows version conflict alert on version error', async () => {
    mockHandleVersionConflict = true;
    mockAdjustMutation.mockResolvedValue({
      data: null,
      error: { message: 'version conflict' },
    });

    const { result } = renderHook(() => useAdjustPantryItemQuantity());

    let success: boolean;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count');
    });

    expect(success!).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Item Updated', 'Version conflict message');
  });

  it('shows generic error alert on non-conflict error', async () => {
    mockAdjustMutation.mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    });

    const { result } = renderHook(() => useAdjustPantryItemQuantity());

    let success: boolean;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count');
    });

    expect(success!).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Adjust error');
  });

  it('returns false when no pantryItem returned', async () => {
    mockAdjustMutation.mockResolvedValue({
      data: { adjustPantryItemQuantity: { pantryItem: null } },
    });

    const { result } = renderHook(() => useAdjustPantryItemQuantity());

    let success: boolean;
    await act(async () => {
      success = await result.current.adjustQuantity('item-1', 5, 'Count');
    });

    expect(success!).toBe(false);
  });
});
