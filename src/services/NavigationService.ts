import {
  createNavigationContainerRef,
  type NavigationAction,
} from '@react-navigation/native';
import { rootNavigate, type RootNavigateArgs } from '#navigation/rootNavigate';

/** Typed by the root navigator `RootNavigator.tsx` registers. */
export const navigationRef = createNavigationContainerRef();

class NavigationServiceClass {
  // Latest action requested before the container was ready (single slot,
  // last-wins). Cold-launch notification taps land here — Notifee's buffered
  // PRESS and the consumed iOS initial tap both fire before onReady — and are
  // dispatched by flushPendingNavigation() instead of being dropped.
  private pendingAction: NavigationAction | null = null;

  dispatch(action: NavigationAction) {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(action);
    } else {
      this.pendingAction = action;
    }
  }

  navigate(...args: RootNavigateArgs) {
    this.dispatch(rootNavigate(...args));
  }

  /** Dispatch the pending action, if any. Wired to the container's onReady. */
  flushPendingNavigation = () => {
    const pending = this.pendingAction;
    this.pendingAction = null;
    if (pending && navigationRef.isReady()) {
      navigationRef.dispatch(pending);
    }
  };
}

const NavigationService = new NavigationServiceClass();
export default NavigationService;
