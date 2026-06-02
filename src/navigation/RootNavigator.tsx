import React, { Suspense, useEffect, useRef } from 'react';
import { View } from 'react-native';
import {
  createStaticNavigation,
  DefaultTheme,
  DarkTheme,
  StaticParamList,
  Theme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  createNativeStackScreen,
} from '@react-navigation/native-stack';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useIsHydrated, useUser, usePostLoginState } from '#store/useAppStore';
import type { NavigationState } from '#store/slices/appSlice';
import { SplashScreen } from '#screens/SplashScreen';
import { NotFoundScreen } from '#screens/NotFoundScreen';
import { AuthStack } from './stacks/AuthStack';
import { OnboardingStack } from './stacks/OnboardingStack';
import { HomeTabs } from './stacks/HomeTabs';
import { BarcodeStack } from './stacks/BarcodeStack';
import { NotificationStack } from './stacks/NotificationStack';
import { ProfileScreen } from '#features/profile/screens/ProfileScreen';
import { HomeManagement } from '#screens/home/HomeManagement';
import { HomeDetailScreen } from '#screens/home/HomeDetailScreen';
import { StorageLocationsScreen } from '#screens/home/StorageLocationsScreen';
import { CodeVerificationScreen } from '#screens/auth/CodeVerificationScreen';
import { EmailVerificationDeepLinkScreen } from '#screens/auth/EmailVerificationDeepLinkScreen';
import { ResetPasswordScreen } from '#screens/auth/ResetPasswordScreen';
import { AcceptInvite } from '#features/shoppingList/screens/AcceptInvite';
import { JoinByShareCodeScreen } from '#features/shoppingList/screens/JoinByShareCodeScreen';

// Lazy-loaded screens (infrequently visited, reduces cold start JS parsing)
const ProfilePhotoUploadScreen = React.lazy(
  () => import('#features/profile/screens/ProfilePhotoUploadScreen'),
);
const ImageCropScreen = React.lazy(
  () => import('#features/profile/screens/ImageCropScreen'),
);
const DeleteAccountScreen = React.lazy(
  () => import('#features/profile/screens/DeleteAccountScreen'),
);
const DietaryProfileScreen = React.lazy(
  () => import('#features/profile/screens/DietaryProfileScreen'),
);
const AppSettingsScreen = React.lazy(
  () => import('#features/profile/screens/AppSettingsScreen'),
);
const PersonalInformationScreen = React.lazy(
  () => import('#features/profile/screens/PersonalInformationScreen'),
);
const PerformanceDashboard = React.lazy(
  () => import('#features/profile/screens/PerformanceDashboard'),
);
const DebugInfo = React.lazy(
  () => import('#features/profile/screens/DebugInfo'),
);
const ChangePasswordScreen = React.lazy(
  () => import('#features/profile/screens/ChangePasswordScreen'),
);
const NotificationSettingsScreen = React.lazy(
  () => import('#features/notifications/screens/NotificationSettingsScreen'),
);
const AppearanceScreen = React.lazy(
  () => import('#features/profile/screens/AppearanceScreen'),
);

import {
  NavigationErrorBoundary,
  AuthErrorBoundary,
} from '#components/providers/ErrorBoundary';
import { PostLoginBiometricScreen } from '#screens/auth/PostLoginBiometricScreen';
import { useDeepLinkRouter } from '#hooks/deepLink/useDeepLinkRouter';
import {
  useIsAuth,
  useIsVerification,
  useIsBiometricSetup,
  useIsOnboarding,
  useIsMainApp,
} from '#hooks/navigation/useNavigationGuards';
import { navigationRef } from '#services/NavigationService';
import { Telemetry } from '#services/telemetry';
import { SousChefLoader } from '#/components/base/SousChefLoader';
import { appConfig } from '#/config/appConfig';

const DEEP_LINK_PREFIXES = [
  `${appConfig.identity.deepLink.scheme}://`,
  ...appConfig.identity.deepLink.hosts.map(h => `https://${h}`),
];

function RootLayout({ children }: { children: React.ReactNode }) {
  useDeepLinkRouter();
  return <>{children}</>;
}

const RootStack = createNativeStackNavigator({
  layout: RootLayout,
  screenOptions: {
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 200,
    // Keep stacked screens active so Unistyles theme updates reach every
    // mounted screen, not just the top one. See unistyles issue #1183.
    inactiveBehavior: 'none',
  },
  groups: {
    Auth: {
      if: useIsAuth,
      screenLayout: ({ children }) => (
        <AuthErrorBoundary>{children}</AuthErrorBoundary>
      ),
      screens: {
        Auth: createNativeStackScreen({ screen: AuthStack }),
      },
    },
    Verification: {
      if: useIsVerification,
      screenLayout: ({ children }) => (
        <AuthErrorBoundary>{children}</AuthErrorBoundary>
      ),
      screens: {
        Verification: createNativeStackScreen({
          screen: CodeVerificationScreen,
          linking: 'verify/:email?',
        }),
      },
    },
    Onboarding: {
      if: useIsOnboarding,
      screenLayout: ({ children }) => (
        <NavigationErrorBoundary>{children}</NavigationErrorBoundary>
      ),
      screens: {
        Onboarding: createNativeStackScreen({ screen: OnboardingStack }),
      },
    },
    // Post-login biometric enrollment gate for returning users. Its own screen
    // (not a modal over PantryMain) so it appears between auth and the main app
    // — see PostLoginBiometricScreen. New users enroll inside Onboarding.
    BiometricSetup: {
      if: useIsBiometricSetup,
      screenLayout: ({ children }) => (
        <NavigationErrorBoundary>{children}</NavigationErrorBoundary>
      ),
      screens: {
        BiometricSetup: createNativeStackScreen({
          screen: PostLoginBiometricScreen,
        }),
      },
    },
    MainApp: {
      if: useIsMainApp,
      screens: {
        Home: createNativeStackScreen({ screen: HomeTabs }),
        Profile: createNativeStackScreen({
          screen: ProfileScreen,
          options: { animation: 'slide_from_right', animationDuration: 200 },
        }),
        HomeManagement: createNativeStackScreen({
          screen: HomeManagement,
          linking: 'home-management/:selectedHomeId?',
        }),
        HomeDetail: createNativeStackScreen({
          screen: HomeDetailScreen,
          options: {
            presentation: 'card',
            animation: 'slide_from_right',
          },
        }),
        StorageLocations: createNativeStackScreen({
          screen: StorageLocationsScreen,
          options: { presentation: 'card', animation: 'slide_from_right' },
        }),
        Barcode: createNativeStackScreen({ screen: BarcodeStack }),
        Notifications: createNativeStackScreen({ screen: NotificationStack }),
        ProfilePhotoUpload: createNativeStackScreen({
          screen: ProfilePhotoUploadScreen,
          options: {
            presentation: 'card',
            animation: 'slide_from_bottom',
          },
          linking: 'upload-photo',
        }),
        ImageCrop: createNativeStackScreen({
          screen: ImageCropScreen,
          options: {
            presentation: 'modal',
            animation: 'slide_from_bottom',
          },
          linking: 'crop-image',
        }),
        DeleteAccount: createNativeStackScreen({
          screen: DeleteAccountScreen,
          linking: 'delete-account',
        }),
        NotificationSettings: createNativeStackScreen({
          screen: NotificationSettingsScreen,
          options: { animation: 'fade', animationDuration: 150 },
        }),
        DietaryProfile: createNativeStackScreen({
          screen: DietaryProfileScreen,
          options: { animation: 'fade', animationDuration: 150 },
        }),
        PersonalInformation: createNativeStackScreen({
          screen: PersonalInformationScreen,
          options: { animation: 'fade', animationDuration: 150 },
        }),
        AppSettings: createNativeStackScreen({
          screen: AppSettingsScreen,
          options: { animation: 'fade', animationDuration: 150 },
        }),
        PerformanceDashboard: createNativeStackScreen({
          screen: PerformanceDashboard,
          options: { animation: 'fade', animationDuration: 150 },
        }),
        DebugInfo: createNativeStackScreen({
          screen: DebugInfo,
          options: { animation: 'fade', animationDuration: 150 },
        }),
        ChangePassword: createNativeStackScreen({
          screen: ChangePasswordScreen,
          options: { animation: 'fade', animationDuration: 150 },
        }),
        Appearance: createNativeStackScreen({
          screen: AppearanceScreen,
          options: { animation: 'fade', animationDuration: 150 },
        }),
      },
    },
    // Always-available deep link screens — placed last so the active
    // conditional group's first screen is the initial route.
    DeepLinks: {
      screens: {
        // Core deep-link screens (auth lifecycle)
        EmailVerification: createNativeStackScreen({
          screen: EmailVerificationDeepLinkScreen,
          linking: 'verify-email',
        }),
        ResetPassword: createNativeStackScreen({
          screen: ResetPasswordScreen,
          linking: 'reset-password',
        }),
        // Feature-contributed deep-link screens. Declared statically so v8's
        // `StaticParamList` inference picks them up (a runtime spread of the
        // feature registry would erase their typing).
        AcceptInvitation: createNativeStackScreen({
          screen: AcceptInvite,
          linking: 'accept-invitation',
        }),
        JoinByShareCode: createNativeStackScreen({
          screen: JoinByShareCodeScreen,
          linking: 'join-list/:shareCode',
        }),
        // Catch-all (must be last)
        NotFound: createNativeStackScreen({
          screen: NotFoundScreen,
          linking: '*',
        }),
      },
    },
  },
});

export type RootStackParamList = StaticParamList<typeof RootStack>;

type RootStackType = typeof RootStack;
declare module '@react-navigation/core' {
  interface RootNavigator extends RootStackType {}
}

const StaticNavigation = createStaticNavigation(RootStack);

/**
 * Derive the navigation state implied purely by the current user. The
 * post-login `biometric_setup` gate is NOT derivable from `user` (it depends on
 * device capability + stored credentials), so it's set explicitly by
 * `authService.handleLogin` and must not be clobbered here — see the guard in
 * the user-change effect below.
 */
function resolveNavTarget(user: ReturnType<typeof useUser>): NavigationState {
  if (!user) return 'auth';
  if (!user.emailVerified) return 'verification';
  if (!user.onBoarded) return 'onboarding';
  return 'main_app';
}

export function Navigation() {
  // `useUnistyles()` is required here because the React Navigation `theme`
  // prop must be a plain object (not a Unistyles StyleSheet). Read access is
  // narrowed to `theme.colors.*` so Unistyles' Proxy-tracked subscriptions
  // only fire on color-token changes, not on every runtime tick (insets,
  // screen size, IME).
  const { theme } = useUnistyles();
  const isHydrated = useIsHydrated();
  const user = useUser();
  const { navigationState, postLoginCredentials, setNavigationState } =
    usePostLoginState();

  // Track focused-route changes for screen-view analytics + crash breadcrumbs.
  // Only emits when the route name actually changes; intermediate state ticks
  // (animation, gesture, params-only updates) are filtered out.
  useEffect(() => {
    let lastRouteName: string | undefined;
    const unsubscribe = navigationRef.addListener('state', () => {
      if (!navigationRef.isReady()) return;
      const route = navigationRef.getCurrentRoute();
      if (route && route.name !== lastRouteName) {
        lastRouteName = route.name;
        Telemetry.trackScreen(route.name);
      }
    });
    return unsubscribe;
  }, []);

  // Track initialization
  const hasInitialized = useRef(false);

  // Initialize navigation state after hydration. Cold start never enters the
  // post-login biometric gate (that's only set by an interactive login), so a
  // straight derive-from-user is correct here.
  useEffect(() => {
    if (isHydrated && !hasInitialized.current) {
      hasInitialized.current = true;
      setNavigationState(resolveNavTarget(user));
    }
  }, [isHydrated, user, setNavigationState]);

  // React to user state changes after initialization.
  useEffect(() => {
    if (!isHydrated || !hasInitialized.current) return;
    const target = resolveNavTarget(user);
    // Don't let a user-prop change yank the user out of a pending post-login
    // gate into main_app. Two gates own that transition themselves:
    //   • biometric enrollment — its own `biometric_setup` screen, and
    //   • the RememberMe prompt — still on the auth screen, signalled by
    //     pending `postLoginCredentials` (LoginScreen clears it + routes to
    //     main_app once the user responds).
    // (setAuth fires before the gate is committed; without this the main app
    // would briefly mount behind the gate.)
    if (
      target === 'main_app' &&
      (navigationState === 'biometric_setup' || postLoginCredentials != null)
    ) {
      return;
    }
    setNavigationState(target);
  }, [
    user,
    isHydrated,
    navigationState,
    postLoginCredentials,
    setNavigationState,
  ]);

  // Create navigation theme based on current Unistyles theme
  const navigationTheme: Theme = {
    ...(theme.colors.background === '#FFFFFF' ? DefaultTheme : DarkTheme),
    colors: {
      ...(theme.colors.background === '#FFFFFF'
        ? DefaultTheme.colors
        : DarkTheme.colors),
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.error,
    },
  };

  // Show splash while app is hydrating or determining navigation state
  if (!isHydrated || navigationState === 'loading') {
    return <SplashScreen />;
  }

  return (
    <NavigationErrorBoundary>
      <Suspense
        fallback={
          <View style={styles.suspenseFallback}>
            <SousChefLoader size="small" showBrand={false} message="Loading" />
          </View>
        }
      >
        <StaticNavigation
          ref={navigationRef}
          theme={navigationTheme}
          linking={{
            prefixes: DEEP_LINK_PREFIXES,
          }}
        />
      </Suspense>
    </NavigationErrorBoundary>
  );
}

const styles = StyleSheet.create(theme => ({
  suspenseFallback: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
