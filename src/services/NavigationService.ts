import {
  createNavigationContainerRef,
  CommonActions,
  StackActions,
} from '@react-navigation/native';
import type {RootStackParamList} from '#/navigation/RootNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

class NavigationServiceClass {
  navigate<T extends keyof RootStackParamList>(
    name: T,
    params?: RootStackParamList[T],
  ) {
    if (navigationRef.isReady()) {
      navigationRef.navigate(name as any, params);
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

  push<T extends keyof RootStackParamList>(
    name: T,
    params?: RootStackParamList[T],
  ) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.push(name as string, params));
    }
  }

  replace<T extends keyof RootStackParamList>(
    name: T,
    params?: RootStackParamList[T],
  ) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.replace(name as string, params));
    }
  }

  popToTop() {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.popToTop());
    }
  }

  preload(name: keyof RootStackParamList) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(CommonActions.preload(name as string));
    }
  }

  setIsReady(ready: boolean) {
    // This is handled automatically by the Navigation component
  }

  setNavigator(ref: any) {
    // This is handled automatically by the Navigation component
  }
}

const NavigationService = new NavigationServiceClass();
export default NavigationService;
