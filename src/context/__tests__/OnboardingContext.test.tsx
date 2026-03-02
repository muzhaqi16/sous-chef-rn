import { renderHook } from '@testing-library/react-native';
import {
  useOnboardingContext,
  useOnboardingContextSafe,
} from '../OnboardingContext';

// OnboardingProvider depends on useSharedValue and useOnboardingNavigation.
// We test consumer hooks' behavior outside the provider.
describe('OnboardingContext', () => {
  describe('useOnboardingContext', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => useOnboardingContext());
      }).toThrow(
        'useOnboardingContext must be used within an OnboardingProvider',
      );
    });
  });

  describe('useOnboardingContextSafe', () => {
    it('returns null when used outside provider', () => {
      const { result } = renderHook(() => useOnboardingContextSafe());
      expect(result.current).toBeNull();
    });
  });
});
