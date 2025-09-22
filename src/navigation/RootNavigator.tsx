import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '#store';
import { useAuthState } from '#hooks/navigation/useAuthState';
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
  const { isHydrated } = useStore();
  const authState = useAuthState();

  // Don't render navigation until store is hydrated
  if (!isHydrated) {
    return null;
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
