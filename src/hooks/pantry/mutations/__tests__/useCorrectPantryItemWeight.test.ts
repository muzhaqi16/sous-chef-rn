import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useCorrectPantryItemWeight } from '../useCorrectPantryItemWeight';

const mockCorrectMutation = jest.fn();

jest.mock('#generated', () => ({
  useCorrectPantryItemWeightMutation: jest.fn(() => [
    mockCorrectMutation,
    { loading: false },
  ]),
  PantryItemDisplayFragmentDoc: {},
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Test error' })),
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

describe('useCorrectPantryItemWeight', () => {
  it('returns correctWeight function and loading state', () => {
    const { result } = renderHook(() => useCorrectPantryItemWeight());

    expect(typeof result.current.correctWeight).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('returns true and calls onSuccess on successful mutation', async () => {
    const onSuccess = jest.fn();
    mockCorrectMutation.mockResolvedValue({
      data: {
        correctPantryItemWeight: {
          pantryItem: { id: 'item-1', netWeight: { netWeight: 500 } },
        },
      },
    });

    const { result } = renderHook(() =>
      useCorrectPantryItemWeight({ onSuccess }),
    );

    let success: boolean;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Measured with scale', 2);
    });

    expect(success!).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
    expect(mockCorrectMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          id: 'item-1',
          input: { netWeight: 500, reason: 'Measured with scale', version: 2 },
        },
      }),
    );
  });

  it('includes netWeightUnitId when provided', async () => {
    mockCorrectMutation.mockResolvedValue({
      data: {
        correctPantryItemWeight: {
          pantryItem: { id: 'item-1' },
        },
      },
    });

    const { result } = renderHook(() => useCorrectPantryItemWeight());

    await act(async () => {
      await result.current.correctWeight('item-1', 500, 'Reason', 3, 'unit-g');
    });

    expect(mockCorrectMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          id: 'item-1',
          input: {
            netWeight: 500,
            reason: 'Reason',
            version: 3,
            netWeightUnitId: 'unit-g',
          },
        },
      }),
    );
  });

  it('returns false and shows version conflict alert', async () => {
    mockHandleVersionConflict = true;
    mockCorrectMutation.mockResolvedValue({
      data: null,
      error: { message: 'version conflict' },
    });

    const { result } = renderHook(() => useCorrectPantryItemWeight());

    let success: boolean;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Reason', 1);
    });

    expect(success!).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Item Updated', 'Version conflict message');
  });

  it('returns false and shows generic error on non-conflict error', async () => {
    mockCorrectMutation.mockResolvedValue({
      data: null,
      error: { message: 'Network error' },
    });

    const { result } = renderHook(() => useCorrectPantryItemWeight());

    let success: boolean;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Reason', 1);
    });

    expect(success!).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Test error');
  });

  it('returns false when mutation returns no pantryItem', async () => {
    mockCorrectMutation.mockResolvedValue({
      data: { correctPantryItemWeight: { pantryItem: null } },
    });

    const { result } = renderHook(() => useCorrectPantryItemWeight());

    let success: boolean;
    await act(async () => {
      success = await result.current.correctWeight('item-1', 500, 'Reason', 1);
    });

    expect(success!).toBe(false);
  });
});
