import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '#store';
import { useAuthState } from '#hooks/navigation/useAuthState';
import { useAuth } from '#hooks/auth/useAuth';
import { SplashScreen } from '#screens';
import {
  AuthStack,
  OnboardingStack,
  HomeTabs,
  BarcodeStack,
  NotificationStack,
} from './stacks';
import {
  HomeManagement,
  ProfilePhotoUploadScreen,
  ImageCropScreen,
  NotFoundScreen,
} from '#screens';
import { CodeVerificationScreen } from '#screens/auth';
import { linkingConfig } from './linking';
import { ImageFile } from '#components/molecules/ImagePicker';
import { NavigationErrorBoundary, AuthErrorBoundary } from '#components/providers/ErrorBoundary';

export type RootStackParamList = {
  Auth: undefined;
  Verification: undefined;
  Onboarding: undefined;
  Home: undefined;
  HomeManagement: { selectedHomeId?: string };
  Barcode: undefined;
  Notifications: undefined;
  ProfilePhotoUpload: undefined;
  ImageCrop: { imageFile: ImageFile };
  NotFound: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { isHydrated, isLoggingOut } = useStore();
  const authState = useAuthState();
  const { autoLogin, isAutoLoggingIn, setIsAutoLoggingIn } = useAuth();

  // Track when user was previously authenticated to detect logout
  const wasAuthenticated = useRef(false);
  const hasInitialized = useRef(false);
  const autoLoginAttempted = useRef(false);

  // Force reset broken auto-login state on component mount
  useEffect(() => {
    if (!hasInitialized.current && isHydrated && !authState.user && isAutoLoggingIn) {
      console.log('🔧 Fixing broken auto-login state on mount');
      setIsAutoLoggingIn(false);
    }
    hasInitialized.current = true;
  }, [isHydrated, authState.user, isAutoLoggingIn, setIsAutoLoggingIn]);

  // Auto-login effect - runs after store hydration, but not after logout
  useEffect(() => {
    if (authState.user) {
      wasAuthenticated.current = true; // Mark that user was authenticated
    }

    if (isHydrated && !authState.user && !isAutoLoggingIn && hasInitialized.current && !autoLoginAttempted.current) {
      if (!wasAuthenticated.current) {
        // Fresh app load - attempt auto-login only once
        console.log('🔄 Fresh app load - attempting auto-login');
        autoLoginAttempted.current = true; // Prevent future attempts
        autoLogin();
      } else {
        // User logged out - don't auto-login, just show auth screens
        console.log('🚪 User logged out - showing auth screens');
      }
    }
  }, [isHydrated, authState.user, autoLogin, isAutoLoggingIn, setIsAutoLoggingIn]);

  // Debug: Log current state during logout scenarios
  console.log('🔍 RootNavigator state:', {
    isHydrated,
    isAutoLoggingIn,
    isLoggingOut,
    hasUser: !!authState.user,
    isUnauthenticated: authState.isUnauthenticated,
    isFullyAuthenticated: authState.isFullyAuthenticated
  });

  // Don't render navigation until store is hydrated
  // Only show splash during active auto-login attempt, not after it's done
  if (!isHydrated || (isAutoLoggingIn && !wasAuthenticated.current && !autoLoginAttempted.current)) {
    console.log('⏳ Showing splash - hydrated:', isHydrated, 'autoLogging:', isAutoLoggingIn, 'wasAuth:', wasAuthenticated.current, 'attempted:', autoLoginAttempted.current);
    return <SplashScreen />;
  }

  return (
    <NavigationErrorBoundary>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Auth Group */}
        {authState.isUnauthenticated && (
          <Stack.Screen name="Auth">
            {() => (
              <AuthErrorBoundary>
                <AuthStack />
              </AuthErrorBoundary>
            )}
          </Stack.Screen>
        )}

        {/* Verification Group */}
        {authState.needsVerification && (
          <Stack.Screen name="Verification">
            {() => (
              <AuthErrorBoundary>
                <CodeVerificationScreen />
              </AuthErrorBoundary>
            )}
          </Stack.Screen>
        )}

        {/* Onboarding Group */}
        {authState.needsOnboarding && (
          <Stack.Screen name="Onboarding">
            {() => (
              <NavigationErrorBoundary>
                <OnboardingStack />
              </NavigationErrorBoundary>
            )}
          </Stack.Screen>
        )}

        {/* Main App Group */}
        {authState.isFullyAuthenticated && (
          <>
            <Stack.Screen name="Home">
              {() => (
                <NavigationErrorBoundary>
                  <HomeTabs />
                </NavigationErrorBoundary>
              )}
            </Stack.Screen>
            <Stack.Screen name="HomeManagement" component={HomeManagement} />
            <Stack.Screen name="Barcode" component={BarcodeStack} />
            <Stack.Screen name="Notifications" component={NotificationStack} />
            <Stack.Screen
              name="ProfilePhotoUpload"
              component={ProfilePhotoUploadScreen}
            />
            <Stack.Screen name="ImageCrop" component={ImageCropScreen} />
          </>
        )}

        {/* Always available */}
        <Stack.Screen name="NotFound" component={NotFoundScreen} />
      </Stack.Navigator>
    </NavigationErrorBoundary>
  );
}

export function Navigation() {
  return (
    <NavigationErrorBoundary>
      <NavigationContainer linking={linkingConfig}>
        <RootNavigator />
      </NavigationContainer>
    </NavigationErrorBoundary>
  );
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
