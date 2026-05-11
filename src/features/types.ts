import type { createBottomTabScreen } from '@react-navigation/bottom-tabs';

/**
 * The screen type accepted by React Navigation's createBottomTabScreen.
 * This accommodates both React components and static navigator objects
 * (returned by createNativeStackNavigator in React Navigation 8).
 */
type NavigationScreen = Parameters<typeof createBottomTabScreen>[0]['screen'];

/**
 * Feature manifest — declares what a feature contributes to app navigation.
 *
 * Consumed by HomeTabs (tab entries). Today every feature is always enabled;
 * future gating adds one `if` check per consumer without changing manifests.
 *
 * Deep-link screens previously lived here too, but they're now declared
 * directly in `RootNavigator.tsx` so v8's `StaticParamList` inference can
 * pick up their types. Feature manifests no longer carry `deepLinkScreens`.
 */
export interface FeatureManifest {
  /** Unique feature identifier. */
  id: string;

  /** If present, the feature gets a tab in the bottom tab navigator. */
  tab?: {
    /** React Navigation screen name key (e.g. 'Pantry'). */
    screenName: string;
    /** Tab bar label. */
    title: string;
    /** Deterministic sort order — lower values render first. */
    order: number;
    /** The stack navigator for this tab (result of createNativeStackNavigator). */
    stack: NavigationScreen;
  };
}
