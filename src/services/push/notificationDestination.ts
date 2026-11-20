import { STATIC_FEATURE_REGISTRY } from '#features/registry.static';

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
