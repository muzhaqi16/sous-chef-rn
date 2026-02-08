import { useAppStore } from '#store/useAppStore';

export function useIsAuth(): boolean {
  return useAppStore(state => state.navigationState === 'auth');
}

export function useIsVerification(): boolean {
  return useAppStore(state => state.navigationState === 'verification');
}

export function useIsOnboarding(): boolean {
  return useAppStore(state => state.navigationState === 'onboarding');
}

export function useIsMainApp(): boolean {
  return useAppStore(state => state.navigationState === 'main_app');
}
