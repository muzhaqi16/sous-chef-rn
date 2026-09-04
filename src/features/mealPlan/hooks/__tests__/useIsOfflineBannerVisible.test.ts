import { renderHook } from '@testing-library/react-native';
import { useIsOfflineBannerVisible } from '#features/mealPlan/hooks/useIsOfflineBannerVisible';
import type { OfflineBannerCause } from '#store/slices/networkSlice';

// Break circular dependency chain (matches useOfflineMode.test.ts).
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

let mockCause: OfflineBannerCause | null = null;

jest.mock('#store/useAppStore', () => {
  const getState = () => ({ offlineBannerCause: mockCause });
  return {
    useAppStore: <T>(selector: (state: ReturnType<typeof getState>) => T) =>
      selector(getState()),
  };
});

beforeEach(() => {
  mockCause = null;
});

describe('useIsOfflineBannerVisible', () => {
  it.each<OfflineBannerCause>([
    'device-offline',
    'api-unreachable',
    'offline-mode',
  ])('is visible for cause %s', cause => {
    mockCause = cause;
    const { result } = renderHook(() => useIsOfflineBannerVisible());
    expect(result.current).toBe(true);
  });

  it('is hidden when no offline cause is showing', () => {
    const { result } = renderHook(() => useIsOfflineBannerVisible());
    expect(result.current).toBe(false);
  });
});
