import {
  createNavigationContainerRef,
  CommonActions,
  StackActions,
} from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

class NavigationServiceClass {
  navigate(name: string, params?: object) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(CommonActions.navigate(name, params));
    }
  }

  goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
      navigationRef.goBack();
    }
  }

  reset(routes: any[]) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes,
        }),
      );
    }
  }

  push(name: string, params?: object) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.push(name, params));
    }
  }

  replace(name: string, params?: object) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.replace(name, params));
    }
  }

  popToTop() {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.popToTop());
    }
  }

  preload(name: string) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(CommonActions.preload(name));
    }
  }
}

const NavigationService = new NavigationServiceClass();
export default NavigationService;
