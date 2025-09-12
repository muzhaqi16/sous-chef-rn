import {useCallback} from 'react';
import {useStore} from '#store';
import type {LoginMutation, RegisterMutation} from '#generated';

export type AuthResponse =
  | LoginMutation['login']
  | RegisterMutation['register'];

export const useAuthFlow = () => {
  const {
    completeAuthentication,
    setUserNavigationState,
    getUserNavigationState,
  } = useStore();

  const handleLogin = useCallback(
    async (loginResponse: LoginMutation['login'], rememberMe?: boolean) => {
      if (!loginResponse?.user) return;

      const {user} = loginResponse;

      // Save user preferences
      if (user.id) {
        setUserNavigationState(user.id, {
          lastLoginTimestamp: Date.now(),
          rememberMeChoice: rememberMe,
        });
      }

      // Complete authentication
      await completeAuthentication(loginResponse, rememberMe);
    },
    [completeAuthentication, setUserNavigationState],
  );

  const handleRegistration = useCallback(
    async (
      registerResponse: RegisterMutation['register'],
      rememberMe?: boolean,
    ) => {
      if (!registerResponse?.user) return;

      const {user} = registerResponse;

      // Mark as new user and save preferences
      if (user.id) {
        setUserNavigationState(user.id, {
          lastLoginTimestamp: Date.now(),
          rememberMeChoice: rememberMe,
          isNewUser: true,
        });
      }

      // Complete authentication
      await completeAuthentication(registerResponse, rememberMe);

      // The navigation will be handled by AppNavigator listening to state changes
    },
    [completeAuthentication, setUserNavigationState],
  );

  const checkRememberMePreference = useCallback(
    (userId: string): boolean | undefined => {
      const userState = getUserNavigationState(userId);
      return userState?.rememberMeChoice;
    },
    [getUserNavigationState],
  );

  return {
    handleLogin,
    handleRegistration,
    checkRememberMePreference,
  };
};
