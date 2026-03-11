import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useConvertExpiredToWaste } from '../useConvertExpiredToWaste';

const mockConvertMutation = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useConvertExpiredToWasteMutation: jest.fn(() => [
    mockConvertMutation,
    { loading: false },
  ]),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Test error message' })),
  }),
}));

jest.spyOn(Alert, 'alert');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useConvertExpiredToWaste', () => {
  it('returns convertExpiredToWaste function and loading state', () => {
    const { result } = renderHook(() => useConvertExpiredToWaste());

    expect(typeof result.current.convertExpiredToWaste).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('returns true and calls onSuccess on successful mutation', async () => {
    const onSuccess = jest.fn();
    mockConvertMutation.mockResolvedValue({
      data: {
        convertExpiredToWaste: {
          pantryItem: { id: 'item-1', quantity: 0, condition: 'SPOILED' },
        },
      },
    });

    const { result } = renderHook(() =>
      useConvertExpiredToWaste({ onSuccess }),
    );

    let success: boolean;
    await act(async () => {
      success = await result.current.convertExpiredToWaste('item-1');
    });

    expect(success!).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
    expect(mockConvertMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { pantryItemId: 'item-1' },
      }),
    );
  });

  it('returns false and shows alert on error', async () => {
    mockConvertMutation.mockResolvedValue({
      data: null,
      error: { message: 'Something went wrong' },
    });

    const { result } = renderHook(() => useConvertExpiredToWaste());

    let success: boolean;
    await act(async () => {
      success = await result.current.convertExpiredToWaste('item-1');
    });

    expect(success!).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Test error message');
  });

  it('returns false when mutation returns no pantryItem', async () => {
    mockConvertMutation.mockResolvedValue({
      data: { convertExpiredToWaste: { pantryItem: null } },
    });

    const { result } = renderHook(() => useConvertExpiredToWaste());

    let success: boolean;
    await act(async () => {
      success = await result.current.convertExpiredToWaste('item-1');
    });

    expect(success!).toBe(false);
  });

  it('does not call onSuccess when mutation fails', async () => {
    const onSuccess = jest.fn();
    mockConvertMutation.mockResolvedValue({
      data: null,
      error: { message: 'fail' },
    });

    const { result } = renderHook(() =>
      useConvertExpiredToWaste({ onSuccess }),
    );

    await act(async () => {
      await result.current.convertExpiredToWaste('item-1');
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});
