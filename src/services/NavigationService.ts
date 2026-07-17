import {
  createNavigationContainerRef,
  CommonActions,
  StackActions,
} from '@react-navigation/native';
import type { ParamListBase, Route } from '@react-navigation/native';

// Typed as ParamListBase because createStaticNavigation's ref prop expects it.
export const navigationRef = createNavigationContainerRef<ParamListBase>();

class NavigationServiceClass {
  // Latest navigate() requested before the container was ready (single slot,
  // last-wins). Cold-launch notification taps land here — Notifee's buffered
  // PRESS and the consumed iOS initial tap both fire before onReady — and are
  // dispatched by flushPendingNavigation() instead of being dropped. Only
  // navigate() defers; replaying a stale goBack/reset after startup is more
  // dangerous than dropping it.
  private pendingNavigation: { name: string; params?: object } | null = null;

  navigate(name: string, params?: object) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(CommonActions.navigate(name, params));
    } else {
      this.pendingNavigation = { name, params };
    }
  }

  /** Dispatch the pending navigate, if any. Wired to the container's onReady. */
  flushPendingNavigation = () => {
    const pending = this.pendingNavigation;
    this.pendingNavigation = null;
    if (pending && navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.navigate(pending.name, pending.params),
      );
    }
  };

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
