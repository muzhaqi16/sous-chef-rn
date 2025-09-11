import {CommonActions, NavigationContainerRef} from '@react-navigation/native';
import {RootStackParamList} from '#navigation/types';

class NavigationService {
  private navigator: NavigationContainerRef<RootStackParamList> | null = null;
  private isReady: boolean = false;

  setNavigator(ref: NavigationContainerRef<RootStackParamList>) {
    this.navigator = ref;
  }

  setIsReady(ready: boolean) {
    this.isReady = ready;
    
    // Execute any pending navigation when navigator becomes ready
    if (ready && this.pendingNavigation) {
      console.log('Navigator ready, executing pending navigation');
      const pending = this.pendingNavigation;
      this.pendingNavigation = null;
      pending();
    }
  }

  // Main navigation methods
  navigateToAuthenticatedState() {
    this.reset([{name: 'HomeStack'}]);
  }

  navigateToOnboarding(initialRoute?: string) {
    this.reset([
      {
        name: 'OnBoardingStack',
        params: {initialRoute},
      },
    ]);
  }

  navigateToVerification(email?: string, password?: string) {
    this.reset([
      {
        name: 'AuthStack',
        params: {
          screen: 'CodeVerification',
          params: {email, password},
        },
      },
    ]);
  }

  navigateToAuth(initialRoute?: string) {
    this.reset([
      {
        name: 'AuthStack',
        params: {initialRoute},
      },
    ]);
  }

  navigateToLogin() {
    this.reset([
      {
        name: 'AuthStack',
        params: {screen: 'Login'},
      },
    ]);
  }

  // Helper to navigate after auth based on user state
  navigatePostAuth(user: any, rememberMe?: boolean) {
    if (!user.emailVerified) {
      this.navigateToVerification(user.email);
    } else if (!user.onBoarded) {
      this.navigateToOnboarding();
    } else {
      this.navigateToAuthenticatedState();
    }
  }

  // Navigation with user context saving
  navigateWithContext(
    routeName: string,
    params?: any,
    saveToHistory: boolean = true,
  ) {
    if (!this.isReady || !this.navigator) {
      console.warn('Navigator not ready');
      return;
    }

    this.navigator.navigate(routeName as any, params);

    if (saveToHistory) {
      // This will be picked up by navigation state listener
      this.saveCurrentRoute(routeName);
    }
  }

  private saveCurrentRoute(routeName: string) {
    // This will be implemented via navigation state listener
    // to save to user-specific storage
  }

  private pendingNavigation: (() => void) | null = null;

  private reset(routes: any[]) {
    if (!this.isReady || !this.navigator) {
      console.warn('Navigator not ready, queueing navigation');
      // Store the pending navigation instead of infinite setTimeout loop
      this.pendingNavigation = () => this.reset(routes);
      return;
    }

    this.navigator.dispatch(
      CommonActions.reset({
        index: 0,
        routes,
      }),
    );
    
    // Clear pending navigation after successful execution
    this.pendingNavigation = null;
  }

  // Direct navigation methods
  navigate(routeName: string, params?: any) {
    if (this.navigator && this.isReady) {
      this.navigator.navigate(routeName as any, params);
    }
  }

  goBack() {
    if (this.navigator && this.isReady && this.navigator.canGoBack()) {
      this.navigator.goBack();
    }
  }

  // Get current route
  getCurrentRoute() {
    if (!this.navigator) return null;
    return this.navigator.getCurrentRoute();
  }
}

export default new NavigationService();
