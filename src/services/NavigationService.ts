import {
  createNavigationContainerRef,
  CommonActions,
  StackActions,
} from '@react-navigation/native';
import type { ParamListBase, Route } from '@react-navigation/native';

// Typed as ParamListBase because createStaticNavigation's ref prop expects it.
export const navigationRef = createNavigationContainerRef<ParamListBase>();

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

  reset(routes: Omit<Route<string>, 'key'>[]) {
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
