import { useAppNavigation } from '#hooks/navigation/useAppNavigation';

/** Moves within the auth stack; signing in and out go through `authService`. */
export function useAuthNavigation() {
  const { toLogin, toSignUp, toForgotPassword, replaceWithLogin } =
    useAppNavigation();

  return {
    navigateToForgotPassword: toForgotPassword,
    navigateToLogin: toLogin,
    navigateToSignUp: toSignUp,
    replaceWithLogin,
  };
}
