import { navigationRef } from '#services/NavigationService';

/**
 * The home tab on screen, for the resync to leave the hidden ones: its route
 * name; null under a screen pushed over the tabs; undefined while navigation
 * cannot say, when every query counts as shown.
 */
export function homeTabOnScreen(): string | null | undefined {
  if (!navigationRef.isReady()) return undefined;
  const root = navigationRef.getRootState();
  if (!root) return undefined;
  const top = root.routes[root.index];
  if (top?.name !== 'Home') return null;
  const tabs = top.state;
  if (tabs?.index === undefined) return undefined;
  return tabs.routes[tabs.index]?.name;
}
