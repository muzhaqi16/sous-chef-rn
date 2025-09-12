import type {LinkingOptions} from '@react-navigation/native';
import type {RootStackParamList} from './types';

export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['souchef://', 'https://souschef.dev'],
  config: {
    screens: {
      AuthStack: {
        screens: {
          LandingAuth: 'welcome',
          Login: 'login',
          SignUp: 'signup',
          ForgotPassword: 'forgot-password',
          CodeVerification: {
            path: 'verify/:email?',
            parse: {
              email: (email: string) => decodeURIComponent(email),
            },
          },
        },
      },
      OnBoardingStack: {
        screens: {
          CreateHome: 'onboarding/home',
          CreateShoppingList: 'onboarding/shopping-list',
          SelectPantryItems: 'onboarding/pantry-items',
          ProfilePictureUpload: 'onboarding/profile-picture',
          InviteMembers: 'onboarding/invite',
          OnboardingComplete: 'onboarding/complete',
        },
      },
      HomeStack: {
        screens: {
          Main: 'home',
          ShoppingList: 'shopping',
          Recipes: 'recipes',
          Profile: 'profile',
        },
      },
      HomeManagementStack: {
        path: 'home-management',
      },
      BarcodeStack: {
        screens: {
          BarcodeScanner: 'scan',
          SearchResults: 'scan/result',
        },
      },
      NotificationStack: {
        screens: {
          NotificationList: 'notifications',
          NotificationDetail: 'notifications/:id',
          NotificationSettings: 'notifications/settings',
        },
      },
      ProfilePhotoUpload: 'upload-photo',
      ImageCrop: 'crop-image',
      NotFound: '*',
    },
  },

  // Custom getInitialURL for handling deep links on app launch
  async getInitialURL() {
    // Check if app was opened from a deep link
    const url = await import('react-native').then(RN =>
      RN.Linking.getInitialURL(),
    );
    return url;
  },

  // Subscribe to incoming links
  subscribe(listener) {
    const onReceiveURL = ({url}: {url: string}) => listener(url);

    // Listen to incoming links from deep linking
    let subscription: any;
    import('react-native').then(RN => {
      subscription = RN.Linking.addEventListener('url', onReceiveURL);
    });

    return () => {
      if (subscription?.remove) {
        subscription.remove();
      }
    };
  },
};
