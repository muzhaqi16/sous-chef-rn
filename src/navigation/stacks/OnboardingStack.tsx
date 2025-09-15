import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  CreateHomeScreen,
  CreateShoppingListScreen,
  SelectPantryItems,
  ProfilePictureUploadScreen,
  InviteMembersScreen,
  OnboardingCompleteScreen,
} from '#screens/onBoarding';

export type OnboardingStackParamList = {
  CreateHome: undefined;
  CreateShoppingList: undefined;
  SelectPantryItems: undefined;
  ProfilePictureUpload: undefined;
  InviteMembers: undefined;
  OnboardingComplete: undefined;
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
    <Stack.Screen name="InviteMembers" component={InviteMembersScreen} />
    <Stack.Screen
      name="OnboardingComplete"
      component={OnboardingCompleteScreen}
    />
  </Stack.Navigator>
);
