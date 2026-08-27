import type { createBottomTabScreen } from '@react-navigation/bottom-tabs';

/**
 * The screen type accepted by React Navigation's createBottomTabScreen.
 * This accommodates both React components and static navigator objects
 * (returned by createNativeStackNavigator in React Navigation 8).
 */
type NavigationScreen = Parameters<typeof createBottomTabScreen>[0]['screen'];

/** Ionicons names for a tab, focused and unfocused. */
export interface TabIconPair {
  active: string;
  inactive: string;
}

/**
 * Everything the tab bar needs to render one tab, keyed by screen name.
 *
 * Built from the registry by `HomeTabs` and passed DOWN to `FloatingTabBar` as
 * a prop. The tab bar lives in `src/components/` — the kit — so it must not
 * import the registry itself; `HomeTabs` is the composition root and the only
 * place allowed to know which features exist.
 */
export type TabAppearance = Record<
  string,
  { icon: TabIconPair; mainScreen: string }
>;

/**
 * Feature manifest — everything the app would otherwise hardcode about a
 * feature, declared by the feature itself.
 *
 * Consumed by `HomeTabs` (tab entries, icons, reset-to-root targets). The rule
 * is that adding a feature, or dropping one, is an edit to the feature and to
 * `FEATURE_REGISTRY` — not a hunt through the navigation layer for the three
 * places that named it.
 *
 * Deep-link screens are declared directly in `RootNavigator.tsx` rather than
 * here, so v8's `StaticParamList` inference can pick up their types.
 */
export interface FeatureManifest {
  /** Unique feature identifier. Must equal the directory name under
   *  `src/features/` — `scripts/check-feature-shape.mjs` enforces it. */
  id: string;

  /**
   * Set `false` to drop this feature from the app.
   *
   * Absent means enabled; only a deliberate opt-out is written down.
   *
   * For a feature with no tab this is the whole change. For a TABBED feature
   * it is half of one: `HomeTabs`'s `screens` must be a literal for
   * react-navigation to infer per-tab param types, so the tab entry has to go
   * too. `HomeTabs.test.tsx` fails until it does, naming exactly that — which
   * is the point of asserting the literal against `TAB_FEATURES`.
   *
   * Either way the feature's code still compiles into the bundle. Removing it
   * is deleting the folder and its `FEATURE_REGISTRY` entry.
   */
  enabled?: boolean;

  /** If present, the feature gets a tab in the bottom tab navigator. */
  tab?: {
    /** React Navigation screen name key (e.g. 'Pantry'). */
    screenName: string;
    /**
     * i18n KEY for the tab bar label, resolved by `TabItem` at render.
     *
     * A key rather than a string: a manifest is a module-level constant, so a
     * `t()` here would run at import and freeze the label in whatever language
     * was active at bootstrap.
     */
    titleKey: string;
    /** Deterministic sort order — lower values render first. */
    order: number;
    /** Ionicons names, focused and unfocused. */
    icon: TabIconPair;
    /**
     * The tab's own root screen, for reset-to-root on re-tapping the active
     * tab. A no-op while a tab stack holds a single screen, but it keeps the
     * standard platform gesture correct once a tab nests screens.
     */
    mainScreen: string;
    /** The stack navigator for this tab (result of createNativeStackNavigator). */
    stack: NavigationScreen;
  };
}

/** A manifest known to contribute a tab. */
export type TabbedFeature = FeatureManifest & {
  tab: NonNullable<FeatureManifest['tab']>;
};
