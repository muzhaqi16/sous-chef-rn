import {createNativeStackNavigator} from '@react-navigation/native-stack';
import { CreateHomeScreen } from '#screens/onBoarding/createHome/CreateHomeScreen';
import { CreateShoppingListScreen } from '#screens/onBoarding/CreateShoppingListScreen';
import { SelectPantryItems } from '#screens/onBoarding/SelectPantryItems';
import { ProfilePictureUploadScreen } from '#screens/onBoarding/ProfilePictureUploadScreen';
import { InviteMemberScreen } from '#screens/onBoarding/InviteMemberScreen';
import { OnboardingCompleteScreen } from '#screens/onBoarding/OnboardingCompleteScreen';
import { BiometricSetupScreen } from '#screens/onBoarding/BiometricSetupScreen';
import { ImageCropScreen } from '#screens/profile/ImageCropScreen';
import {ImageFile} from '#components/molecules/ImagePicker';

export type OnboardingStackParamList = {
  CreateHome: undefined;
  CreateShoppingList: undefined;
  SelectPantryItems: undefined;
  ProfilePictureUpload: undefined;
  ImageCrop: { imageFile: ImageFile };
  InviteMembers: undefined;
  OnboardingComplete: undefined;
  BiometricSetup: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
    }}>
    <Stack.Screen name="CreateHome" component={CreateHomeScreen} />
    <Stack.Screen
      name="CreateShoppingList"
      component={CreateShoppingListScreen}
    />
    <Stack.Screen name="SelectPantryItems" component={SelectPantryItems} />
    <Stack.Screen
      name="ProfilePictureUpload"
      component={ProfilePictureUploadScreen}
    />
    <Stack.Screen name="ImageCrop" component={ImageCropScreen} />
    <Stack.Screen name="InviteMembers" component={InviteMemberScreen} />
    <Stack.Screen
      name="OnboardingComplete"
      component={OnboardingCompleteScreen}
    />
    <Stack.Screen
      name="BiometricSetup"
      component={BiometricSetupScreen}
    />
  </Stack.Navigator>
);
