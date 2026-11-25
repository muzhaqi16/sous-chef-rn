import { CommonActions, type NavigationAction } from '@react-navigation/native';
import { STATIC_FEATURE_REGISTRY } from '#features/registry.static';
import { rootNavigate } from '#navigation/rootNavigate';

/** Where tapping a notification leads: the same from a push as from the list. */
export type NotificationDestination =
  | { kind: 'feature'; tab: string; screen: string }
  | { kind: 'detail'; id: string }
  | { kind: 'feed' };

/**
 * A category a feature claims opens that feature's screen. Any other opens the
 * notification's own detail when its id is known, else the feed: a summary
 * push stands for several and names no one notification.
 */
export function notificationDestination(
  category: string | null | undefined,
  id: string | null | undefined,
): NotificationDestination {
  const route = STATIC_FEATURE_REGISTRY.find(
    feature => feature.pushRoute?.category === category?.toUpperCase(),
  )?.pushRoute;
  if (route) return { kind: 'feature', tab: route.tab, screen: route.screen };
  return id ? { kind: 'detail', id } : { kind: 'feed' };
}

/**
 * The one action that opens a destination, dispatched by a tapped push and by
 * the list. `pop` returns to a screen already open beneath instead of stacking
 * a second one. A feature's tab and screen are its manifest's strings, which
 * the navigator types cannot see; `HomeTabs.test.tsx` holds them to the
 * feature's tab.
 */
export function notificationDestinationAction(
  destination: NotificationDestination,
): NavigationAction {
  switch (destination.kind) {
    case 'feature':
      return CommonActions.navigate(
        'Home',
        { screen: destination.tab, params: { screen: destination.screen } },
        { pop: true },
      );
    case 'detail':
      return rootNavigate(
        'Notifications',
        { screen: 'NotificationDetail', params: { id: destination.id } },
        { pop: true },
      );
    case 'feed':
      return rootNavigate('Notifications', undefined, { pop: true });
  }
}
