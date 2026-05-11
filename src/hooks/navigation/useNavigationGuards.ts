import { useNavigationState } from '#store/useAppStore';

export function useIsAuth(): boolean {
  return useNavigationState() === 'auth';
}

export function useIsVerification(): boolean {
  return useNavigationState() === 'verification';
}

export function useIsOnboarding(): boolean {
  return useNavigationState() === 'onboarding';
}

export function useIsMainApp(): boolean {
  return useNavigationState() === 'main_app';
}
