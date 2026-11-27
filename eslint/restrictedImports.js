/**
 * `no-restricted-imports`, shared rather than duplicated: a config object that
 * sets the rule replaces its options, so an override retyping a shorter list
 * silently un-bans the rest. `restrictedImports({ allow })` makes an override
 * name what it drops; `__tests__/lint/restrictedImportsAreNotDropped.test.ts`
 * holds that. A module of the app's own that only named files may import is a
 * one-door policy in `boundaries.js`.
 */
const RESTRICTED_IMPORT_PATHS = [
  {
    name: 'react-native',
    importNames: [
      'StyleSheet',
      'Text',
      'Pressable',
      'TouchableOpacity',
      'TouchableHighlight',
      'TouchableNativeFeedback',
      'TouchableWithoutFeedback',
      'ActivityIndicator',
      'FlatList',
      'SectionList',
    ],
    message:
      'Use the project re-exports/atoms for app-wide consistency: FlatList/SectionList → FlashList with an explicit renderScrollComponent (RN lists do not take part in the gesture arbitration swipeable rows need); StyleSheet → "react-native-unistyles"; Text → "#components/atoms/Text" (role/tone typography, where a role carries size, weight and leading together); Pressable → "#components/atoms/themedComponents" (or AppPressable/PressableScale for press feedback, or react-native-gesture-handler\'s Pressable for gesture composition). ActivityIndicator → one of the themed spinners in "#components/atoms/themedComponents" (Themed, Muted, Error, Success, OnPrimary, OnError); a raw one renders in the platform\'s default colour rather than the theme\'s. Touchables are deprecated — use Pressable. For RN Text/Pressable *types*, import `type { TextProps, TextStyle, PressableProps }` (type-only imports are fine).',
  },
  {
    name: 'react',
    importNames: ['useMemo', 'useCallback'],
    message:
      'useMemo/useCallback are unnecessary — the React Compiler handles memoization automatically.',
  },
  {
    name: 'react-i18next',
    message:
      "Import from '#i18n' instead — it is the single entry point for translation, and it pins the namespace so call sites cannot drift onto a second one. `const { t } = useTranslation()` in components and hooks; `import { t }` at module scope. Only src/i18n's own entry files may reach for react-i18next directly (exempted in this config).",
  },
  {
    name: 'react-native-permissions',
    message:
      "Use `PermissionService` from '#services/permissions/PermissionService'. It normalises the platform statuses to granted/denied/blocked/undetermined, treats LIMITED as granted and UNAVAILABLE as blocked, and owns `openSettings()` for the twice-denied case that a re-prompt cannot resolve.",
  },
  {
    name: 'fraction.js',
    message:
      'Use formatQuantityForDisplay / formatQuantityAsFraction from \'#utils/formatQuantity\'. A second fraction table decides its own denominators and precision, so the same 1/3 cup reads as "0.33" on one screen and "0.33333334" on the next.',
  },
  {
    name: 'date-fns',
    importNames: [
      'format',
      'formatDistance',
      'formatDistanceToNow',
      'formatDistanceStrict',
      'formatRelative',
      'formatDuration',
      'lightFormat',
    ],
    message:
      "Use the shared formatters in '#utils/formatters/date' or '#utils/dateUtils'. A direct format() call takes no locale, so the date stays English after a language change.",
  },
  {
    name: 'react-native-turbo-image',
    message:
      "Use `CachedImage` from '#components/atoms/CachedImage' — one wrapper owns the caching policy, the recycling key and the placeholder. A second call site pins a second set of options.",
  },
  {
    name: '@react-native-vector-icons/ionicons',
    message:
      "Use `Icon` from '#components/atoms/Icon' with a `tone`, so the glyph colour follows the theme. For an icon NAME type, import `type { IconName }` from the same module. A colour the tone set cannot express is a missing entry in TONE_TO_COLOR, not a reason to import the glyph package.",
  },
  {
    name: '@react-navigation/native',
    importNames: ['useNavigation'],
    message:
      "Use `useAppNavigation` from '#hooks/navigation/useAppNavigation'. It is the one place that knows screen names, so a rename surfaces as a type error rather than a runtime miss, and its `goBack` guards on `canGoBack`. For an escape hatch it returns the raw prop: `const { navigation } = useAppNavigation()` gives you `dispatch` and `addListener`.",
  },
  {
    name: 'react-native-reanimated',
    importNames: ['useReducedMotion'],
    message:
      "Don't branch an animation on reduce motion — `withTiming`, `withSpring`, `withRepeat` and the entering/exiting builders already collapse under the OS setting with no config, so a component that checks it is a second mechanism for a concern the library owns. `useMotionEnabled` from '#hooks/animations/useMotionEnabled' is the ONE read, and only for what a zero duration cannot stop: a loop's resting state, an ambient illustration.",
  },
  {
    name: 'react-native-unistyles/reanimated',
    importNames: ['useAnimatedTheme'],
    message:
      "Use `useAnimatedTheme` from '#hooks/ui/useAnimatedTheme'. Unistyles' own drops its listener while a paused screen is hidden and re-subscribes without re-reading the theme, so a screen revealed after a theme change keeps animating in the old one. See docs/verified-library-behaviour.md § Unistyles' useAnimatedTheme misses a theme change made while its screen is paused.",
  },
  {
    name: '#i18n/config',
    importNames: ['getI18n'],
    message:
      "Translate through `t` from '#i18n' (aliased `tGlobal` in a .tsx), or `useTranslation()` in a component. The module-scope `t` IS `getI18n().t` with the fallback and options overloads in front of it, so reaching the instance loses the fallback form and bypasses the entry point that pins the namespace. Reaching it for something other than translating — changing the language, reading the current one — belongs in src/i18n or the store, which are exempt.",
  },
];

const RESTRICTED_IMPORT_PATTERNS = [
  {
    group: ['**/*Fragments.generated'],
    importNames: [
      // Dead scalar/leaf fragments — fields are inlined where used.
      'UnitBasicFragment',
      'UnitBasicFragmentDoc',
      'UnitFullFragment',
      'UnitFullFragmentDoc',
      'StoreFieldsFragment',
      'StoreFieldsFragmentDoc',
      'BrandFieldsFragment',
      'BrandFieldsFragmentDoc',
      'UserProfileFieldsFragment',
      'UserProfileFieldsFragmentDoc',
      'UserProfileFullFragment',
      'UserProfileFullFragmentDoc',
      'UserSummaryFragment',
      'UserSummaryFragmentDoc',
      // "God" fragments, decomposed into colocated component fragments
      // (PantryItemDetail_pantryItem, PantryItemForm_pantryItem, …).
      'PantryItemFragment',
      'PantryItemFragmentDoc',
      'PantryItemDisplay',
      'PantryItemDisplayFragment',
      'PantryItemDisplayFragmentDoc',
      'ShoppingListItemFragment',
      'ShoppingListItemFragmentDoc',
      'MealPlanFullFragment',
      'MealPlanFullFragmentDoc',
      'RecipeFragment',
      'RecipeFragmentDoc',
      'ItemFragment',
      'ItemFragmentDoc',
      'ItemDisplayFragment',
      'ItemDisplayFragmentDoc',
      'ItemCoreFragment',
      'ItemCoreFragmentDoc',
      'HomeFragment',
      'HomeFragmentDoc',
    ],
    message:
      'This fragment was deleted or decomposed. Use a colocated `<Consumer>_<entity>` fragment instead (sibling .graphql file next to the consumer). See CLAUDE.md "Apollo: Fragment composition + `useFragment` convention".',
  },
];

/** `allow`: { '<module>': true | ['<importName>'] }. `add`: extra path entries. */
const restrictedImports = ({ allow = {}, add = [] } = {}) => [
  'error',
  {
    paths: [
      ...RESTRICTED_IMPORT_PATHS.flatMap(entry => {
        const allowed = allow[entry.name];
        if (allowed === true) return [];
        if (!allowed || !entry.importNames) return [entry];
        const importNames = entry.importNames.filter(
          name => !allowed.includes(name),
        );
        return importNames.length ? [{ ...entry, importNames }] : [];
      }),
      ...add,
    ],
    patterns: RESTRICTED_IMPORT_PATTERNS,
  },
];

module.exports = { restrictedImports };
