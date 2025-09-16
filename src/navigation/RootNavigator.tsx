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

  // Don't render navigation until store is hydrated
  if (!isHydrated) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Auth Group */}
      {useAuthState.isUnauthenticated() && (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}

      {/* Verification Group */}
      {useAuthState.needsVerification() && (
        <Stack.Screen name="Verification" component={CodeVerificationScreen} />
      )}

      {/* Onboarding Group */}
      {useAuthState.needsOnboarding() && (
        <Stack.Screen name="Onboarding" component={OnboardingStack} />
      )}

      {/* Main App Group */}
      {useAuthState.isFullyAuthenticated() && (
        <>
          <Stack.Screen name="Home" component={HomeTabs} />
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
  );
}

export function Navigation() {
  return (
    <NavigationContainer linking={linkingConfig}>
      <RootNavigator />
    </NavigationContainer>
  );
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
