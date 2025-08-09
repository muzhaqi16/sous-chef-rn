import {useCallback} from 'react';
import {CommonActions} from '@react-navigation/native';
import {useSafeNavigation} from '../useSafeNavigation';
import type {LoginMutation, RegisterMutation} from '#generated';

type AuthUser =
  | NonNullable<LoginMutation['login']>['user']
  | NonNullable<RegisterMutation['register']>['user'];

export const usePostAuthNavigation = () => {
  const {navigation} = useSafeNavigation();

  const navigateAfterAuth = useCallback(
    (
      user: AuthUser,
      rememberMe?: boolean | undefined,
      isRegistration = false,
    ) => {
      // For registration, always go to verification first
      if (isRegistration) {
        // Navigation is handled in the component for verification flow
        return;
      }

      // For login: handle remember me preference
      if (rememberMe === undefined) {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{name: 'AuthStack'}],
          }),
        );
        return;
      }

      // Navigate based on onboarding status
      const targetStack = user.onBoarded ? 'HomeStack' : 'OnBoardingStack';
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{name: targetStack}],
        }),
      );
    },
    [navigation],
  );

  const navigateToEmailVerification = useCallback(
    (email: string, password: string) => {
      navigation.navigate('CodeVerification', {email, password});
    },
    [navigation],
  );

  return {
    navigateAfterAuth,
    navigateToEmailVerification,
  };
};
