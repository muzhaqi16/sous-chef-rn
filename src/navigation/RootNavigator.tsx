import React, { Suspense, useEffect, useRef, useMemo } from 'react';
import { View } from 'react-native';
import {
  createStaticNavigation,
  DefaultTheme,
  DarkTheme,
  StaticParamList,
  Theme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useUnistyles } from 'react-native-unistyles';
import { useShallow } from 'zustand/shallow';
import {
  useAppStore,
  selectHydrated,
  selectUser,
  selectPostLoginState,
} from '#store/useAppStore';
import { useAuth } from '#hooks/auth/useAuth';
import { SplashScreen } from '#screens/SplashScreen';
import { NotFoundScreen } from '#screens/NotFoundScreen';
import { AuthStack } from './stacks/AuthStack';
import { OnboardingStack } from './stacks/OnboardingStack';
import { HomeTabs } from './stacks/HomeTabs';
import { BarcodeStack } from './stacks/BarcodeStack';
import { NotificationStack } from './stacks/NotificationStack';
import { HomeManagement } from '#screens/home/HomeManagement';
import { HomeDetailScreen } from '#screens/home/HomeDetailScreen';
import { StorageLocationsScreen } from '#screens/home/StorageLocationsScreen';
import { CodeVerificationScreen } from '#screens/auth/CodeVerificationScreen';
import { EmailVerificationDeepLinkScreen } from '#screens/auth/EmailVerificationDeepLinkScreen';
import { ResetPasswordScreen } from '#screens/auth/ResetPasswordScreen';
import { AcceptInvite } from '#screens/shoppingList/AcceptInvite';

// Lazy-loaded screens (infrequently visited, reduces cold start JS parsing)
const ProfilePhotoUploadScreen = React.lazy(
  () => import('#screens/profile/ProfilePhotoUploadScreen'),
);
const ImageCropScreen = React.lazy(
  () => import('#screens/profile/ImageCropScreen'),
);
const DeleteAccountScreen = React.lazy(
  () => import('#screens/profile/DeleteAccountScreen'),
);
const DietaryProfileScreen = React.lazy(
  () => import('#screens/profile/DietaryProfileScreen'),
);
const AppSettingsScreen = React.lazy(
  () => import('#screens/profile/AppSettingsScreen'),
);
const PersonalInformationScreen = React.lazy(
  () => import('#screens/profile/PersonalInformationScreen'),
);
const PerformanceDashboard = React.lazy(
  () => import('#screens/profile/PerformanceDashboard'),
);
const DebugInfo = React.lazy(() => import('#screens/profile/DebugInfo'));
const ChangePasswordScreen = React.lazy(
  () => import('#screens/profile/ChangePasswordScreen'),
);
const NotificationSettingsScreen = React.lazy(
  () => import('#screens/notifications/NotificationSettingsScreen'),
);

import {
  NavigationErrorBoundary,
  AuthErrorBoundary,
} from '#components/providers/ErrorBoundary';
import { PostLoginBiometricPrompt } from '#components/organisms/PostLoginBiometricPrompt';
import { useDeepLinkRouter } from '#hooks/deepLink/useDeepLinkRouter';
import {
  useIsAuth,
  useIsVerification,
  useIsOnboarding,
  useIsMainApp,
} from '#hooks/navigation/useNavigationGuards';
import { navigationRef } from '#services/NavigationService';

function RootLayout({ children }: { children: React.ReactNode }) {
  useDeepLinkRouter();
  return <>{children}</>;
}

const RootStack = createNativeStackNavigator({
  layout: RootLayout,
  screenOptions: {
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 250,
  },
  groups: {
    Auth: {
      if: useIsAuth,
      screenLayout: ({ children }) => (
        <AuthErrorBoundary>{children}</AuthErrorBoundary>
      ),
      screens: {
        Auth: { screen: AuthStack },
      },
    },
    Verification: {
      if: useIsVerification,
      screenLayout: ({ children }) => (
        <AuthErrorBoundary>{children}</AuthErrorBoundary>
      ),
      screens: {
        Verification: {
          screen: CodeVerificationScreen,
          linking: 'verify/:email?',
        },
      },
    },
    Onboarding: {
      if: useIsOnboarding,
      screenLayout: ({ children }) => (
        <NavigationErrorBoundary>{children}</NavigationErrorBoundary>
      ),
      screens: {
        Onboarding: { screen: OnboardingStack },
      },
    },
    MainApp: {
      if: useIsMainApp,
      screens: {
        Home: { screen: HomeTabs },
        HomeManagement: {
          screen: HomeManagement,
          linking: 'home-management/:selectedHomeId?',
        },
        HomeDetail: {
          screen: HomeDetailScreen,
          options: {
            presentation: 'modal',
            animation: 'slide_from_bottom',
          },
        },
        StorageLocations: StorageLocationsScreen,
        Barcode: { screen: BarcodeStack },
        Notifications: { screen: NotificationStack },
        ProfilePhotoUpload: {
          screen: ProfilePhotoUploadScreen,
          options: {
            presentation: 'modal',
            animation: 'slide_from_bottom',
          },
          linking: 'upload-photo',
        },
        ImageCrop: {
          screen: ImageCropScreen,
          options: {
            presentation: 'modal',
            animation: 'slide_from_bottom',
          },
          linking: 'crop-image',
        },
        DeleteAccount: {
          screen: DeleteAccountScreen,
          linking: 'delete-account',
        },
        NotificationSettings: NotificationSettingsScreen,
        DietaryProfile: DietaryProfileScreen,
        PersonalInformation: PersonalInformationScreen,
        AppSettings: AppSettingsScreen,
        PerformanceDashboard: PerformanceDashboard,
        DebugInfo: DebugInfo,
        ChangePassword: ChangePasswordScreen,
      },
    },
    // Always-available deep link screens — placed last so the active
    // conditional group's first screen is the initial route.
    DeepLinks: {
      screens: {
        EmailVerification: {
          screen: EmailVerificationDeepLinkScreen,
          linking: 'verify-email/:token',
        },
        ResetPassword: {
          screen: ResetPasswordScreen,
          linking: 'reset-password',
        },
        AcceptInvitation: {
          screen: AcceptInvite,
          linking: 'accept-invitation/:token',
        },
        NotFound: {
          screen: NotFoundScreen,
          linking: '*',
        },
      },
    },
  },
});

export type RootStackParamList = StaticParamList<typeof RootStack>;

// Module augmentation per v8 docs. RootParamList (overload 1) doesn't resolve
// due to a TS limitation with `infer` on intersection types — the conditional
// `RootNavigator extends TypedNavigatorInternal<infer P, …>` yields `{}`.
// Overload 3 `useNavigation('ScreenName')` also fails since navigate() still
// depends on the same unresolved ParamList. Use dispatch(CommonActions.navigate())
// as a workaround until this is fixed in a stable v8 release.
type RootStackType = typeof RootStack;
declare module '@react-navigation/core' {
  interface RootNavigator extends RootStackType {}
}

const StaticNavigation = createStaticNavigation(RootStack);

export function Navigation() {
  const { theme } = useUnistyles();
  const isHydrated = useAppStore(selectHydrated);
  const user = useAppStore(selectUser);
  const {
    navigationState,
    showBiometricSetup,
    postLoginCredentials,
    setNavigationState,
  } = useAppStore(useShallow(selectPostLoginState));
  const { handlePostLoginBiometricComplete } = useAuth();

  // Track initialization
  const hasInitialized = useRef(false);

  // Initialize navigation state after hydration
  useEffect(() => {
    if (isHydrated && !hasInitialized.current) {
      hasInitialized.current = true;

      // Determine initial navigation state based on current store state
      if (user) {
        // User exists in store - determine their state
        if (!user.emailVerified) {
          setNavigationState('verification');
        } else if (!user.onBoarded) {
          setNavigationState('onboarding');
        } else {
          setNavigationState('main_app');
        }
      } else {
        // No user - go directly to auth screen
        setNavigationState('auth');
      }
    }
  }, [isHydrated, user, setNavigationState]);

  // React to user state changes after initialization
  useEffect(() => {
    if (isHydrated && hasInitialized.current) {
      if (user) {
        // Update navigation state when specific user properties change
        if (!user.emailVerified) {
          setNavigationState('verification');
        } else if (!user.onBoarded) {
          setNavigationState('onboarding');
        } else {
          setNavigationState('main_app');
        }
      } else {
        // User logged out or cleared
        setNavigationState('auth');
      }
    }
  }, [user, isHydrated, setNavigationState]);

  // Create navigation theme based on current Unistyles theme
  const navigationTheme: Theme = useMemo(
    () => ({
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
    }),
    [theme],
  );

  // Show splash while app is hydrating or determining navigation state
  if (!isHydrated || navigationState === 'loading') {
    return <SplashScreen />;
  }

  return (
    <NavigationErrorBoundary>
      <Suspense fallback={<View style={{ flex: 1 }} />}>
        <StaticNavigation
          ref={navigationRef}
          theme={navigationTheme}
          linking={{
            enabled: 'auto',
            prefixes: ['souschef://', 'https://app.souschef.dev'],
          }}
        />
      </Suspense>

      {/* Global Biometric Setup Modal - shows on auth screen when triggered */}
      {showBiometricSetup && user && postLoginCredentials && (
        <PostLoginBiometricPrompt
          visible={showBiometricSetup}
          onComplete={handlePostLoginBiometricComplete}
          userEmail={postLoginCredentials.email}
          userPassword={postLoginCredentials.password}
        />
      )}
    </NavigationErrorBoundary>
  );
}
