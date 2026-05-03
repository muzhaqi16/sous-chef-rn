import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
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
 * Consumed by HomeTabs (tab entries) and RootNavigator (deep-link screens).
 * Today every feature is always enabled; future gating adds one `if` check
 * per consumer without changing manifests.
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

  /**
   * Screens registered in the always-available DeepLinks group
   * (outside auth/onboarding guards). Used for invite links, etc.
   */
  deepLinkScreens?: Record<
    string,
    {
      screen: React.ComponentType<any>;
      options?: NativeStackNavigationOptions;
      linking?: string;
    }
  >;
}
