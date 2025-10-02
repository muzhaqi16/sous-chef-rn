import {LinkingOptions} from '@react-navigation/native';
import {Linking} from 'react-native';
import type {RootStackParamList} from './RootNavigator';

export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['souschef://', 'https://app.souschef.dev'],
  config: {
    screens: {
      Auth: {
        screens: {
          LandingAuth: 'welcome',
          Login: 'login',
          SignUp: 'signup',
          ForgotPassword: 'forgot-password',
          CodeVerification: 'verify/:email?',
        },
      },
      Verification: 'verify/:email?',
      Onboarding: {
        screens: {
          CreateHome: 'onboarding/home',
          CreateShoppingList: 'onboarding/shopping-list',
          SelectPantryItems: 'onboarding/pantry-items',
          ProfilePictureUpload: 'onboarding/profile-picture',
          InviteMembers: 'onboarding/invite',
          OnboardingComplete: 'onboarding/complete',
        },
      },
      Home: {
        screens: {
          Pantry: {
            screens: {
              PantryMain: 'pantry',
              PantryItem: 'pantry/item/:itemId?',
              PantryItemDetail: 'pantry/detail/:itemId',
            },
          },
          ShoppingList: {
            screens: {
              ShoppingListMain: 'shopping',
              AddItem: 'shopping/add',
              EditItem: 'shopping/edit/:itemId',
            },
          },
          Profile: 'profile',
        },
      },
      HomeManagement: 'home-management/:selectedHomeId?',
      Barcode: {
        screens: {
          BarcodeScanner: 'scan',
          SearchResults: 'scan/result',
        },
      },
      Notifications: {
        screens: {
          NotificationList: 'notifications',
          NotificationDetail: 'notifications/:id',
          NotificationSettings: 'notifications/settings',
        },
      },
      ProfilePhotoUpload: 'upload-photo',
      ImageCrop: 'crop-image',
      DeleteAccount: 'delete-account',
      EmailVerification: 'verify-email/:token',
      ResetPassword: 'reset-password/:token',
      AcceptInvitation: 'accept-invitation/:token',
      NotFound: '*',
    },
  },
  async getInitialURL() {
    return Linking.getInitialURL();
  },
  subscribe(listener) {
    const onReceiveURL = ({url}: {url: string}) => listener(url);
    const subscription = Linking.addEventListener('url', onReceiveURL);

    return () => {
      subscription.remove();
    };
  },
};
