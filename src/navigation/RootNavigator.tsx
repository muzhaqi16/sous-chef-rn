import React, { Suspense, useEffect, useRef } from 'react';
import { useTranslation } from '#/i18n';
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
import {
  useIsHydrated,
  useUser,
  usePostLoginState,
  useVerificationSkipped,
} from '#store/useAppStore';
import type { NavigationState } from '#store/slices/appSlice';
import { SplashScreen } from '#screens/SplashScreen';
import { NotFoundScreen } from '#screens/NotFoundScreen';
import { AuthStack } from './stacks/AuthStack';
import { OnboardingStack } from './stacks/OnboardingStack';
import { HomeTabs } from './stacks/HomeTabs';
import { BarcodeStack } from './stacks/BarcodeStack';
import { NotificationStack } from './stacks/NotificationStack';
import { CodeVerificationScreen } from '#screens/auth/CodeVerificationScreen';
import { EmailVerificationDeepLinkScreen } from '#screens/auth/EmailVerificationDeepLinkScreen';
import { ResetPasswordScreen } from '#screens/auth/ResetPasswordScreen';
import { AcceptInvite } from '#features/shoppingList/screens/AcceptInvite';
import { JoinByShareCodeScreen } from '#features/shoppingList/screens/JoinByShareCodeScreen';
import { JoinHomeByCodeScreen } from '#features/home/screens/JoinHomeByCodeScreen';
import { JoinByLinkScreen } from '#features/home/screens/JoinByLinkScreen';
import { pantryDetailScreens } from '#features/pantry/screens/registration';
import { recipeDetailScreens } from '#features/recipes/screens/registration';
import { shoppingListDetailScreens } from '#features/shoppingList/screens/registration';
import { mealPlanDetailScreens } from '#features/mealPlan/screens/registration';
import { profileScreens } from '#features/profile/screens/registration';
import { homeManagementScreens } from '#features/home/screens/registration';

import {
  NavigationErrorBoundary,
  AuthErrorBoundary,
} from '#components/providers/ErrorBoundary';
import {
  topInsetScreenLayout,
  topInsetWith,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';
import { PostLoginBiometricScreen } from '#screens/auth/PostLoginBiometricScreen';
import { useDeepLinkRouter } from '#hooks/deepLink/useDeepLinkRouter';
import {
  useIsAuth,
  useIsVerification,
  useIsBiometricSetup,
  useIsOnboarding,
  useIsMainApp,
} from '#hooks/navigation/useNavigationGuards';
import NavigationService, { navigationRef } from '#services/NavigationService';
import { Telemetry } from '#services/telemetry';
import { NativePerformanceService } from '#services/performance/NativePerformanceService';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
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
      // Top inset folded into the boundary: a per-screen/group layout REPLACES
      // (not nests) a parent layout in react-navigation v8, so the inset and
      // the error boundary must be one function.
      screenLayout: topInsetWith(AuthErrorBoundary),
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
          // Not deep-linkable: it is a gate the app decides to show, never a
          // destination a URL asks for.
          linking: null,
        }),
      },
    },
    MainApp: {
      if: useIsMainApp,
      // Nested navigators opt out with `noInsetScreenLayout` — they inset
      // their own screens and would otherwise double-inset.
      screenLayout: topInsetScreenLayout,
      screens: {
        Home: createNativeStackScreen({
          screen: HomeTabs,
          layout: noInsetScreenLayout,
          // Keeps the tab subtree's effects alive while a detail screen is
          // pushed over it, rather than re-running every layout effect in one
          // commit on pop. Only bites from the second push down (native-stack
          // already treats the screen directly under the focused one as
          // active) — i.e. Home > Profile > HomeManagement > HomeDetail.
          options: { inactiveBehavior: 'none' },
        }),
        Barcode: createNativeStackScreen({
          screen: BarcodeStack,
          layout: noInsetScreenLayout,
        }),
        Notifications: createNativeStackScreen({
          screen: NotificationStack,
          layout: noInsetScreenLayout,
        }),
        // Feature-owned detail screens, siblings of `Home` so a pushed screen
        // covers the tab navigator and the floating tab bar is structurally
        // absent on it. Each feature owns its own group; the object spread
        // keeps `StaticParamList` inference, so every `navigate` call site
        // stays type-checked. One registration per screen — screens opened
        // from several tabs (RecipeDetail, HomeDetail) have a single copy.
        ...pantryDetailScreens,
        ...shoppingListDetailScreens,
        ...recipeDetailScreens,
        ...mealPlanDetailScreens,
        ...profileScreens,
        ...homeManagementScreens,
      },
    },
    // Placed last so the active conditional group's first screen is the
    // initial route.
    DeepLinks: {
      screenLayout: topInsetScreenLayout,
      screens: {
        EmailVerification: createNativeStackScreen({
          screen: EmailVerificationDeepLinkScreen,
          linking: 'verify-email',
        }),
        ResetPassword: createNativeStackScreen({
          screen: ResetPasswordScreen,
          linking: 'reset-password',
        }),
        AcceptInvitation: createNativeStackScreen({
          screen: AcceptInvite,
          linking: 'accept-invitation',
        }),
        JoinByShareCode: createNativeStackScreen({
          screen: JoinByShareCodeScreen,
          linking: 'join-list/:shareCode',
        }),
        JoinHomeByCode: createNativeStackScreen({
          screen: JoinHomeByCodeScreen,
          linking: 'join-home/:joinCode?',
        }),
        // Generic anyone-with-link entry: resolves the code's type via
        // resolveShareLink and replaces itself with the matching join screen.
        JoinByLink: createNativeStackScreen({
          screen: JoinByLinkScreen,
          linking: 'join/:code',
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
 * Derive the navigation state implied by the current user plus their stored
 * decision to defer email verification. The post-login `biometric_setup` gate is
 * NOT derivable from either (it depends on device capability + stored
 * credentials), so it's set explicitly by `authService.handleLogin` and must not
 * be clobbered here — see the guard in the user-change effect below.
 */
/**
 * Navigation states that require the user to do something before the app can
 * show content. `app_fully_drawn_ms` is suppressed for a launch that hits one,
 * because the interval would include however long the person took.
 */
const INTERACTIVE_GATES = new Set<NavigationState>([
  'auth',
  'verification',
  'biometric_setup',
  'onboarding',
]);

function resolveNavTarget(
  user: ReturnType<typeof useUser>,
  verificationSkipped: boolean,
): NavigationState {
  if (!user) return 'auth';
  // `verificationSkipped` is what lets an unverified account past this gate.
  // Re-opening the verification screen from the reminder banner clears the
  // flag, so the target agrees with where the user already is and this derive
  // never yanks them back out — no special case needed for either direction.
  if (!user.emailVerified && !verificationSkipped) return 'verification';
  if (!user.onBoarded) return 'onboarding';
  return 'main_app';
}

export function Navigation() {
  const { t } = useTranslation();
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
  const verificationSkipped = useVerificationSkipped();

  // A launch that stops at any of these waits on a person, and that wait would
  // otherwise land inside `app_fully_drawn_ms` — a signed-out cold start
  // reports the sign-in typing time as app startup. Recorded here, at the one
  // place that knows about every gate, rather than in each gate's screen.
  useEffect(() => {
    if (INTERACTIVE_GATES.has(navigationState)) {
      NativePerformanceService.noteInteractiveGate();
    }
  }, [navigationState]);

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

  const hasInitialized = useRef(false);

  // Initialize navigation state after hydration. Cold start never enters the
  // post-login biometric gate (that's only set by an interactive login), so a
  // straight derive-from-user is correct here.
  useEffect(() => {
    if (isHydrated && !hasInitialized.current) {
      hasInitialized.current = true;
      setNavigationState(resolveNavTarget(user, verificationSkipped));
    }
  }, [isHydrated, user, verificationSkipped, setNavigationState]);

  useEffect(() => {
    if (!isHydrated || !hasInitialized.current) return;
    const target = resolveNavTarget(user, verificationSkipped);
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
    verificationSkipped,
    setNavigationState,
  ]);

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

  if (!isHydrated || navigationState === 'loading') {
    return <SplashScreen />;
  }

  return (
    <NavigationErrorBoundary>
      <Suspense
        fallback={
          <View style={styles.suspenseFallback}>
            <SousChefLoader
              size="small"
              showBrand={false}
              message={t('labels.loading')}
            />
          </View>
        }
      >
        <StaticNavigation
          ref={navigationRef}
          theme={navigationTheme}
          onReady={NavigationService.flushPendingNavigation}
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
