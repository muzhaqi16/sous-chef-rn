import { renderHook, act } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { useOfflineDisabled } from '../useOfflineDisabled';

let mockCanUseNetwork = true;

jest.mock('#hooks/settings/useOfflineMode', () => ({
  useCanUseNetwork: jest.fn(() => mockCanUseNetwork),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCanUseNetwork = true;
});

describe('useOfflineDisabled', () => {
  it('isDisabled is false when network is available', () => {
    const { result } = renderHook(() => useOfflineDisabled());

    expect(result.current.isDisabled).toBe(false);
  });

  it('isDisabled is true when network is not available', () => {
    mockCanUseNetwork = false;

    const { result } = renderHook(() => useOfflineDisabled());

    expect(result.current.isDisabled).toBe(true);
  });

  it('showOfflineMessage shows alert with default message', () => {
    const { result } = renderHook(() => useOfflineDisabled());

    act(() => {
      result.current.showOfflineMessage();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Offline',
      'This feature requires an internet connection',
    );
  });

  it('showOfflineMessage shows alert with custom message', () => {
    const { result } = renderHook(() =>
      useOfflineDisabled('Sharing requires an active internet connection'),
    );

    act(() => {
      result.current.showOfflineMessage();
    });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Offline',
      'Sharing requires an active internet connection',
    );
  });
});
