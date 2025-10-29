import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppStore, selectHydrated, selectUser } from '#store/useAppStore';
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
import { HomeDetailScreen, StorageLocationsScreen } from '#screens/home';
import {
  CodeVerificationScreen,
  EmailVerificationDeepLinkScreen,
  ResetPasswordScreen,
} from '#screens/auth';
import { AcceptInvite } from '#screens/shoppingList/AcceptInvite';
import {
  DeleteAccountScreen,
  DietaryProfileScreen,
  AppSettingsScreen,
  PersonalInformationScreen,
  PerformanceDashboard,
} from '#screens/profile';
import { NotificationSettingsScreen } from '#screens/notifications';
import { linkingConfig } from './linking';
import { ImageFile } from '#components/molecules/ImagePicker';
import {
  NavigationErrorBoundary,
  AuthErrorBoundary,
} from '#components/providers/ErrorBoundary';
import { PostLoginBiometricPrompt } from '#components/organisms';
import { useDeepLinkRouter } from '#hooks/deepLink/useDeepLinkRouter';

export type RootStackParamList = {
  Auth: undefined;
  Verification: undefined;
  Onboarding: undefined;
  Home: undefined;
  HomeManagement: { selectedHomeId?: string };
  HomeDetail: { homeId: string };
  StorageLocations: { homeId: string };
  Barcode: undefined;
  Notifications: undefined;
  ProfilePhotoUpload: undefined;
  ImageCrop: { imageFile: ImageFile };
  EmailVerification: { token: string };
  ResetPassword: { token: string };
  AcceptInvitation: { token: string };
  DeleteAccount: undefined;
  NotificationSettings: undefined;
  DietaryProfile: undefined;
  PersonalInformation: undefined;
  AppSettings: undefined;
  PerformanceDashboard: undefined;
  NotFound: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const isHydrated = useAppStore(selectHydrated);
  const navigationState = useAppStore(state => state.navigationState);
  const showBiometricSetup = useAppStore(state => state.showBiometricSetup);
  const postLoginCredentials = useAppStore(state => state.postLoginCredentials);
  const setNavigationState = useAppStore(state => state.setNavigationState);
  const user = useAppStore(selectUser);
  const { handlePostLoginBiometricComplete } = useAuth();

  // Initialize deep link router for handling URL-based navigation
  useDeepLinkRouter();

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

  // Show splash while app is hydrating or determining navigation state
  if (!isHydrated || navigationState === 'loading') {
    return <SplashScreen />;
  }

  return (
    <>
      <NavigationErrorBoundary>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        >
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
              <Stack.Screen
                name="HomeDetail"
                component={HomeDetailScreen}
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="StorageLocations"
                component={StorageLocationsScreen}
              />
              <Stack.Screen name="Barcode" component={BarcodeStack} />
              <Stack.Screen
                name="Notifications"
                component={NotificationStack}
              />
              <Stack.Screen
                name="ProfilePhotoUpload"
                component={ProfilePhotoUploadScreen}
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="ImageCrop"
                component={ImageCropScreen}
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
              <Stack.Screen
                name="DeleteAccount"
                component={DeleteAccountScreen}
              />
              <Stack.Screen
                name="NotificationSettings"
                component={NotificationSettingsScreen}
              />
              <Stack.Screen
                name="DietaryProfile"
                component={DietaryProfileScreen}
              />
              <Stack.Screen
                name="PersonalInformation"
                component={PersonalInformationScreen}
              />
              <Stack.Screen
                name="PerformanceDashboard"
                component={PerformanceDashboard}
              />
              <Stack.Screen
                name="AppSettings"
                component={AppSettingsScreen}
                options={{
                  animation: 'fade',
                  animationDuration: 200,
                }}
              />
            </>
          )}

          {/* Always available */}
          <Stack.Screen
            name="EmailVerification"
            component={EmailVerificationDeepLinkScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AcceptInvitation"
            component={AcceptInvite}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="NotFound" component={NotFoundScreen} />
        </Stack.Navigator>
      </NavigationErrorBoundary>

      {/* Global Biometric Setup Modal - shows on auth screen when triggered */}
      {showBiometricSetup && user && postLoginCredentials && (
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
