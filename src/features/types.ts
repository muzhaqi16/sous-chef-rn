import type { createBottomTabScreen } from '@react-navigation/bottom-tabs';

/** Accepts both React components and static navigator objects. */
type NavigationScreen = Parameters<typeof createBottomTabScreen>[0]['screen'];

/** Ionicons names for a tab, focused and unfocused. */
export interface TabIconPair {
  active: string;
  inactive: string;
}

/**
 * Everything the tab bar needs to render one tab, keyed by screen name. Built
 * by `HomeTabs` and passed DOWN to `FloatingTabBar`: the tab bar is kit, so it
 * must not import the registry itself.
 */
export type TabAppearance = Record<
  string,
  { icon: TabIconPair; mainScreen: string }
>;

/**
 * Everything the app would otherwise hardcode about a feature, declared by the
 * feature itself and consumed by `HomeTabs`. Deep-link screens are declared in
 * `RootNavigator.tsx` instead, so v8's `StaticParamList` can infer their types.
 */
export interface FeatureManifest {
  /** Unique feature identifier. Must equal the directory name under
   *  `src/features/` — `scripts/check-feature-shape.mjs` enforces it. */
  id: string;

  /**
   * Set `false` to drop this feature; absent means enabled. For a TABBED
   * feature the `HomeTabs` entry must go too — its `screens` has to stay a
   * literal for per-tab param inference, and `HomeTabs.test.tsx` fails until
   * both agree. The code still compiles into the bundle either way.
   */
  enabled?: boolean;

  /** If present, the feature gets a tab in the bottom tab navigator. */
  tab?: {
    /** React Navigation screen name key (e.g. 'Pantry'). */
    screenName: string;
    /**
     * i18n KEY, resolved by `TabItem` at render. A manifest is a module-level
     * constant, so a `t()` here would freeze the label at bootstrap language.
     */
    titleKey: string;
    /** Deterministic sort order — lower values render first. */
    order: number;
    /** Ionicons names, focused and unfocused. */
    icon: TabIconPair;
    /** The tab's root screen, for reset-to-root on re-tapping the active tab. */
    mainScreen: string;
    /** The stack navigator for this tab (result of createNativeStackNavigator). */
    stack: NavigationScreen;
  };
}

/** A manifest known to contribute a tab. */
export type TabbedFeature = FeatureManifest & {
  tab: NonNullable<FeatureManifest['tab']>;
};
