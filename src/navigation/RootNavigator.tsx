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
import { VerificationGateScreen } from '#features/auth/screens/CodeVerificationScreen';
import { EmailVerificationDeepLinkScreen } from '#features/auth/screens/EmailVerificationDeepLinkScreen';
import { ResetPasswordScreen } from '#features/auth/screens/ResetPasswordScreen';
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
import { catalogScreens } from '#features/catalog/screens/registration';

import {
  NavigationErrorBoundary,
  AuthErrorBoundary,
} from '#components/providers/ErrorBoundary';
import {
  topInsetScreenLayout,
  topInsetWith,
  noInsetScreenLayout,
} from '#navigation/layouts/TopInsetLayout';
import { PostLoginBiometricScreen } from '#features/auth/screens/PostLoginBiometricScreen';
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
import { motion } from '#/theme/foundations/motion';

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
    animationDuration: motion.timing.STANDARD,
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
      // A per-screen/group layout REPLACES rather than nests a parent one in
      // react-navigation v8, so the inset and the boundary must be one function.
      screenLayout: topInsetWith(AuthErrorBoundary),
      screens: {
        Verification: createNativeStackScreen({
          screen: VerificationGateScreen,
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
    // Its own screen, not a modal over PantryMain, so it sits between auth and the
    // main app. New users enroll inside Onboarding instead.
    BiometricSetup: {
      if: useIsBiometricSetup,
      screenLayout: ({ children }) => (
        <NavigationErrorBoundary>{children}</NavigationErrorBoundary>
      ),
      screens: {
        BiometricSetup: createNativeStackScreen({
          screen: PostLoginBiometricScreen,
          // A gate the app decides to show, never a destination a URL asks for.
          linking: null,
        }),
      },
    },
    MainApp: {
      if: useIsMainApp,
      // Nested navigators opt out with `noInsetScreenLayout`, or they double-inset.
      screenLayout: topInsetScreenLayout,
      screens: {
        Home: createNativeStackScreen({
          screen: HomeTabs,
          layout: noInsetScreenLayout,
          // Keeps the tab subtree's effects alive under a pushed detail screen
          // instead of re-running every layout effect in one commit on pop. Only
          // bites from the second push down.
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
        // Siblings of `Home`, so a pushed detail screen covers the tab navigator
        // and the floating tab bar is structurally absent. The object spread keeps
        // `StaticParamList` inference, so `navigate` stays type-checked. One
        // registration per screen, even for ones reachable from several tabs.
        ...pantryDetailScreens,
        ...shoppingListDetailScreens,
        ...recipeDetailScreens,
        ...mealPlanDetailScreens,
        ...profileScreens,
        ...homeManagementScreens,
        ...catalogScreens,
      },
    },
    // Last, so the active conditional group's first screen is the initial route.
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
        // Resolves the code's type via resolveShareLink, then replaces itself with
        // the matching join screen.
        JoinByLink: createNativeStackScreen({
          screen: JoinByLinkScreen,
          linking: 'join/:code',
        }),
        // Must be last.
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
 * The navigation state implied by the current user plus their stored decision to
 * defer email verification. The post-login `biometric_setup` gate is NOT derivable
 * from either — it depends on device capability and stored credentials, so
 * `authService.handleLogin` sets it and the effect below must not clobber it.
 */

/**
 * States that wait on the user, so `app_fully_drawn_ms` is suppressed for a launch
 * that hits one — the interval would otherwise include however long they took.
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
  // `verificationSkipped` lets an unverified account past this gate; re-opening
  // the verification screen clears it, so this derive agrees with where the user
  // already is in both directions.
  if (!user.emailVerified && !verificationSkipped) return 'verification';
  if (!user.onBoarded) return 'onboarding';
  return 'main_app';
}

export function Navigation() {
  const { t } = useTranslation();
  // React Navigation's `theme` prop must be a plain object, so `useUnistyles()` is
  // required. Reads are narrowed to `theme.colors.*` so its Proxy subscriptions
  // fire on color changes only, not on every runtime tick.
  const { theme, rt } = useUnistyles();
  const isHydrated = useIsHydrated();
  const user = useUser();
  const { navigationState, postLoginCredentials, setNavigationState } =
    usePostLoginState();
  const verificationSkipped = useVerificationSkipped();

  // Emits only when the route NAME changes; animation, gesture and params-only
  // state ticks are filtered out.
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

  // A cold start never enters the post-login biometric gate — only an interactive
  // login sets it — so deriving straight from the user is correct here.
  useEffect(() => {
    if (isHydrated && !hasInitialized.current) {
      hasInitialized.current = true;
      const target = resolveNavTarget(user, verificationSkipped);

      // Read from THIS launch's resolved target, never from `navigationState`:
      // that is persisted and rehydrates before the launch resolves its own, so
      // reading it sees the PREVIOUS session's screen — and `noteInteractiveGate()`
      // is a one-way process latch, so one such read suppresses the metric for
      // good. A gate entered later by an interactive login is not a launch gate and
      // is deliberately not noted; the startup window's own bound covers it.
      if (INTERACTIVE_GATES.has(target)) {
        NativePerformanceService.noteInteractiveGate();
      }

      setNavigationState(target);
    }
  }, [isHydrated, user, verificationSkipped, setNavigationState]);

  useEffect(() => {
    if (!isHydrated || !hasInitialized.current) return;
    const target = resolveNavTarget(user, verificationSkipped);
    // A user-prop change must not yank the user out of a pending post-login gate
    // into main_app — biometric enrollment and the RememberMe prompt each own that
    // transition. setAuth fires before the gate commits, so without this the main
    // app briefly mounts behind it.
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

  const base = rt.themeName === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
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
