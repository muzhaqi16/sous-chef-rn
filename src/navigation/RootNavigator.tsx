import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '#store';
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
import {
  NavigationErrorBoundary,
  AuthErrorBoundary,
} from '#components/providers/ErrorBoundary';
import { PostLoginBiometricPrompt } from '#components/organisms';

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
  const {
    isHydrated,
    navigationState,
    showBiometricSetup,
    postLoginCredentials,
    setNavigationState,
    user,
  } = useStore();
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
  }, [user?.emailVerified, user?.onBoarded, isHydrated, setNavigationState]);

  // Show splash while app is hydrating or determining navigation state
  if (!isHydrated || navigationState === 'loading') {
    return <SplashScreen />;
  }

  return (
    <>
      <NavigationErrorBoundary>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* Auth Group */}
          {navigationState === 'auth' && (
            <Stack.Screen name="Auth">
              {() => (
                <AuthErrorBoundary>
                  <AuthStack />
                </AuthErrorBoundary>
              )}
            </Stack.Screen>
          )}

          {/* Verification Group */}
          {navigationState === 'verification' && (
            <Stack.Screen name="Verification">
              {() => (
                <AuthErrorBoundary>
                  <CodeVerificationScreen />
                </AuthErrorBoundary>
              )}
            </Stack.Screen>
          )}

          {/* Biometric Setup State - shows loading while biometric modal is active */}
          {navigationState === 'biometric_setup' && (
            <Stack.Screen name="Auth">
              {() => (
                <AuthErrorBoundary>
                  <AuthStack />
                </AuthErrorBoundary>
              )}
            </Stack.Screen>
          )}

          {/* Onboarding Group */}
          {navigationState === 'onboarding' && (
            <Stack.Screen name="Onboarding">
              {() => (
                <NavigationErrorBoundary>
                  <OnboardingStack />
                </NavigationErrorBoundary>
              )}
            </Stack.Screen>
          )}

          {/* Main App Group */}
          {navigationState === 'main_app' && (
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
              <Stack.Screen
                name="Notifications"
                component={NotificationStack}
              />
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

      {/* Global Biometric Setup Modal - only shows during biometric_setup state */}
      {navigationState === 'biometric_setup' &&
        showBiometricSetup &&
        user &&
        postLoginCredentials && (
          <PostLoginBiometricPrompt
            visible={showBiometricSetup}
            onComplete={handlePostLoginBiometricComplete}
            userEmail={postLoginCredentials.email}
            userPassword={postLoginCredentials.password}
          />
        )}
    </>
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
