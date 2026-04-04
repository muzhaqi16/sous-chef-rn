import React, { Suspense, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { ViewStyle } from 'react-native';
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
import { useUnistyles } from 'react-native-unistyles';
import { useShallow } from 'zustand/shallow';
import {
  useAppStore,
  selectHydrated,
  selectUser,
  selectPostLoginState,
} from '#store/useAppStore';
import { useBiometricPrompting } from '#hooks/auth/useBiometricPrompting';
import { useUserPreferences } from '#hooks/navigation/useUserPreferences';
import { SplashScreen } from '#screens/SplashScreen';
import { NotFoundScreen } from '#screens/NotFoundScreen';
import { AuthStack } from './stacks/AuthStack';
import { OnboardingStack } from './stacks/OnboardingStack';
import { HomeTabs } from './stacks/HomeTabs';
import { BarcodeStack } from './stacks/BarcodeStack';
import { NotificationStack } from './stacks/NotificationStack';
import { ProfileScreen } from '#screens/profile/ProfileScreen';
import { HomeManagement } from '#screens/home/HomeManagement';
import { HomeDetailScreen } from '#screens/home/HomeDetailScreen';
import { StorageLocationsScreen } from '#screens/home/StorageLocationsScreen';
import { CodeVerificationScreen } from '#screens/auth/CodeVerificationScreen';
import { EmailVerificationDeepLinkScreen } from '#screens/auth/EmailVerificationDeepLinkScreen';
import { ResetPasswordScreen } from '#screens/auth/ResetPasswordScreen';
import { AcceptInvite } from '#screens/shoppingList/AcceptInvite';
import { JoinByShareCodeScreen } from '#screens/shoppingList/JoinByShareCodeScreen';

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
import { SousChefLoader } from '#/components/base/SousChefLoader';

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
      },
    },
    // Always-available deep link screens — placed last so the active
    // conditional group's first screen is the initial route.
    DeepLinks: {
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

export function Navigation() {
  const { theme } = useUnistyles();
  const isHydrated = useAppStore(selectHydrated);
  const user = useAppStore(selectUser);
  const {
    navigationState,
    showBiometricSetup,
    postLoginCredentials,
    setNavigationState,
    setShowBiometricSetup,
    setPostLoginCredentials,
  } = useAppStore(useShallow(selectPostLoginState));
  const { recordBiometricPromptResponse } = useBiometricPrompting();
  const { markBiometricDeclined, markBiometricEnabled } = useUserPreferences();

  const handlePostLoginBiometricComplete = (
    enabled: boolean,
    declined?: boolean,
  ) => {
    setShowBiometricSetup(false);

    recordBiometricPromptResponse(enabled, declined);

    if (enabled) {
      markBiometricEnabled();
    } else if (declined) {
      markBiometricDeclined();
    }

    setNavigationState('main_app');
    setPostLoginCredentials(null);
  };

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

  // Stable style object for Suspense fallback
  const suspenseFallbackStyle: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  };

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
          <View style={suspenseFallbackStyle}>
            <SousChefLoader size="small" showBrand={false} message="Loading" />
          </View>
        }
      >
        <StaticNavigation
          ref={navigationRef}
          theme={navigationTheme}
          linking={{
            prefixes: ['souschef://', 'https://app.souschef.dev'],
          }}
        />
      </Suspense>

      {/* Global Biometric Setup Modal - shows on auth screen when triggered */}
      {!!showBiometricSetup && !!user && !!postLoginCredentials && (
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
