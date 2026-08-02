import { useNavigation } from '@react-navigation/native';
import type { BarcodeStackParams } from '#navigation/stacks/BarcodeStack';
import type { NotificationStackParams } from '#navigation/stacks/NotificationStack';
import type { PantryStackParams } from '#navigation/stacks/PantryStack';
import type { ShoppingListStackParams } from '#navigation/stacks/ShoppingListStack';
import type { RecipeStackParams } from '#navigation/stacks/RecipeStack';
import type { MealPlanStackParams } from '#navigation/stacks/MealPlanStack';
import type { OnboardingStackParams } from '#navigation/stacks/OnboardingStack';

/**
 * Centralized navigation facade — the single place that knows screen names.
 *
 * Always navigate through this hook rather than calling
 * `navigation.navigate('X')` or `CommonActions.navigate('X')` directly.
 * Renaming a screen in the navigator config flows here as a TypeScript error
 * (via the `RootNavigator` module augmentation in `RootNavigator.tsx`); call
 * sites stay untouched.
 *
 * v8 notes:
 * - `navigation.navigate('X')` is type-checked against the root navigator's
 *   own `StaticParamList` thanks to the `declare module '@react-navigation/core'`
 *   augmentation in `RootNavigator.tsx`. Feature-contributed deep-link screens
 *   (`AcceptInvitation`, `JoinByShareCode`) are declared statically in the
 *   root navigator so v8's `StaticParamList` inference covers them.
 * - For nested navigators (Auth, Onboarding, the HomeTabs tab *main* screens
 *   — Pantry/ShoppingList/Recipe/MealPlan — and Barcode/Notifications), use
 *   the nested form: `navigate(Parent, { screen, params })`. This is the
 *   v8-idiomatic alternative to `CommonActions.navigate(name)`, which is
 *   untyped and intentionally avoided here.
 * - Feature detail/sub screens (item details, settings, RecipeDetail, …) are
 *   nested inside each screen's owning tab's own stack (PantryStack/
 *   ShoppingListStack/RecipeStack/MealPlanStack) — isolating each tab's
 *   Offscreen-pause boundary instead of all 4 tabs freezing/resuming together
 *   via the shared `Home` screen (see RootNavigator's `Home` registration).
 *   Reached via `navigateToTabScreen` below, which nests the call under the
 *   right tab. A few screens (RecipeDetail, HomeDetail, StorageLocations,
 *   ImageCrop) are registered in more than one stack because more than one
 *   tab reaches them — see each `to*` method's own comment for which case it
 *   is: an explicit alias per stack (caller's context is statically known,
 *   e.g. `toPantryHomeDetail`/`toShoppingListHomeDetail`), or a flat call
 *   relying on ancestor walk-up to resolve to "whichever nested copy is
 *   nearest" (only where the same shared screen component is itself the
 *   caller, e.g. `toStorageLocations`).
 *
 * Screen names appear as string literals in this file only — extracting
 * them into a `ROUTES` constants object would lose v8 type safety, because
 * `navigation.navigate` overloads discriminate on literal types and a
 * `string`-typed constant won't match a route's specific param overload.
 * The facade itself is the centralization layer; call sites only see
 * `toFoo()` methods.
 */
/**
 * Navigate to a screen nested inside one of `Home`'s tab stacks (e.g.
 * `PantryItemDetail` inside `PantryStack`).
 *
 * `Home`'s tabs are built dynamically from the feature registry (see
 * `HomeTabs.tsx` / `features/registry.ts`) via `Object.fromEntries` over a
 * runtime-filtered array — that erases the tab-name-to-stack-type mapping,
 * so TypeScript can't derive per-tab nested param types the way it does for
 * genuinely static nested navigators (Auth, Onboarding, Barcode,
 * Notifications), where `navigation.navigate(Parent, { screen, params })`
 * type-checks against the parent's own literal `screens` object. Restructuring
 * the registry to be statically typed would give up its "delete a feature
 * folder + one array entry to fork" design, which is a separate, deliberate
 * concern from this helper.
 *
 * The cast below is scoped to this one call site only. Every caller of this
 * helper still gets a fully-typed `params` argument checked against the
 * target tab stack's own exported `StaticParamList` (e.g. `PantryStackParams`)
 * — only the "does `Home` statically know about this tab's nested screen"
 * check is bypassed, not param-shape checking for the screen itself.
 */
function navigateToTabScreen<TParams>(
  navigation: ReturnType<typeof useNavigation>,
  tab: 'Pantry' | 'ShoppingList' | 'Recipe' | 'MealPlan',
  screen: string,
  params: TParams,
) {
  navigation.navigate('Home', {
    screen: tab,
    params: { screen, params },
  } as never);
}

export function useAppNavigation() {
  const navigation = useNavigation();

  return {
    /** Raw navigation prop for one-off needs (e.g., `addListener`). */
    navigation,

    /** Pop the current screen if there is something to go back to. */
    goBack: () => {
      if (navigation.canGoBack()) navigation.goBack();
    },

    // ─── Auth flow ─────────────────────────────────────────────────────────
    toAuth: () => navigation.navigate('Auth'),
    toLogin: () => navigation.navigate('Auth', { screen: 'Login' }),
    toSignUp: () => navigation.navigate('Auth', { screen: 'SignUp' }),
    toForgotPassword: () =>
      navigation.navigate('Auth', { screen: 'ForgotPassword' }),

    // ─── Deep-link targets ────────────────────────────────────────────────
    toEmailVerification: (token: string) =>
      navigation.navigate('EmailVerification', { token }),
    toResetPassword: (token: string) =>
      navigation.navigate('ResetPassword', { token }),
    toAcceptInvitation: (token: string) =>
      navigation.navigate('AcceptInvitation', { token }),
    toJoinHomeByCode: (joinCode?: string) =>
      navigation.navigate('JoinHomeByCode', joinCode ? { joinCode } : {}),
    toJoinByShareCode: (shareCode: string) =>
      navigation.navigate('JoinByShareCode', { shareCode }),

    // ─── Main-app root screens ────────────────────────────────────────────
    toNotifications: () =>
      navigation.navigate('Notifications', { screen: 'NotificationList' }),
    // HomeDetailScreen is nested in both PantryStack (HomeManagement) and
    // ShoppingListStack (ShareList/ListSettings) — each caller's context is
    // statically known, so each gets its own explicit tab-scoped alias
    // rather than relying on ancestor walk-up.
    toPantryHomeDetail: (params: PantryStackParams['HomeDetail']) =>
      navigateToTabScreen(navigation, 'Pantry', 'HomeDetail', params),
    toShoppingListHomeDetail: (params: ShoppingListStackParams['HomeDetail']) =>
      navigateToTabScreen(navigation, 'ShoppingList', 'HomeDetail', params),
    // HomeDetailScreen's own "manage storage locations" self-navigation is
    // the one case that genuinely needs "wherever I currently am" resolution
    // — it's the same shared component rendered from either stack above, and
    // each has its own nested StorageLocations sibling. The flat form
    // resolves to the nearest one via ancestor walk-up (same mechanism
    // RecipeDetail's own "view another recipe" self-navigation relies on —
    // see `toRecipeDetail` below). Unlike `navigateToTabScreen`'s cast (a
    // valid 'Home' literal, only the params object cast), there's no valid
    // literal to give the overloaded `navigate` here — 'StorageLocations' no
    // longer appears in any of its overload tuples at all — so the function
    // itself is narrowed to a single permissive signature for this one call.
    toStorageLocations: (params: PantryStackParams['StorageLocations']) =>
      (navigation.navigate as (screen: string, params?: unknown) => void)(
        'StorageLocations',
        params,
      ),
    // Onboarding's own nested ImageCrop — a different stack/copy than
    // `toPantryImageCrop` below (see PantryStack.tsx; ImageCropScreen is a
    // shared component registered separately in both places).
    toImageCrop: (params: OnboardingStackParams['ImageCrop']) =>
      navigation.navigate('Onboarding', { screen: 'ImageCrop', params }),

    // ─── Profile / home-management screens (nested under Pantry's own
    // stack) ────────────────────────────────────────────────────────────────
    // Migrated from root-level siblings of `Home` — only reachable via
    // Pantry's header (avatar/bell/home-switcher) and ProfileScreen's own
    // settings rows, so unlike RecipeDetail/HomeDetail/StorageLocations none
    // of these need a second, root-level alias — see PantryStack.tsx.
    toProfile: () =>
      navigateToTabScreen(navigation, 'Pantry', 'Profile', undefined),
    toHomeManagement: (params?: PantryStackParams['HomeManagement']) =>
      navigateToTabScreen(navigation, 'Pantry', 'HomeManagement', params ?? {}),
    toPantryImageCrop: (params: PantryStackParams['ImageCrop']) =>
      navigateToTabScreen(navigation, 'Pantry', 'ImageCrop', params),
    toProfilePhotoUpload: () =>
      navigateToTabScreen(
        navigation,
        'Pantry',
        'ProfilePhotoUpload',
        undefined,
      ),
    toDeleteAccount: () =>
      navigateToTabScreen(navigation, 'Pantry', 'DeleteAccount', undefined),
    toNotificationSettings: () =>
      navigateToTabScreen(
        navigation,
        'Pantry',
        'NotificationSettings',
        undefined,
      ),
    toDietaryProfile: () =>
      navigateToTabScreen(navigation, 'Pantry', 'DietaryProfile', undefined),
    toPersonalInformation: () =>
      navigateToTabScreen(
        navigation,
        'Pantry',
        'PersonalInformation',
        undefined,
      ),
    toAppSettings: () =>
      navigateToTabScreen(navigation, 'Pantry', 'AppSettings', undefined),
    toPerformanceDashboard: () =>
      navigateToTabScreen(
        navigation,
        'Pantry',
        'PerformanceDashboard',
        undefined,
      ),
    toDebugInfo: () =>
      navigateToTabScreen(navigation, 'Pantry', 'DebugInfo', undefined),
    toChangePassword: () =>
      navigateToTabScreen(navigation, 'Pantry', 'ChangePassword', undefined),
    toAppearance: () =>
      navigateToTabScreen(navigation, 'Pantry', 'Appearance', undefined),

    // ─── Onboarding sub-screens (nested) ──────────────────────────────────
    toCreateHome: () =>
      navigation.navigate('Onboarding', { screen: 'CreateHome' }),
    toCreateShoppingList: () =>
      navigation.navigate('Onboarding', { screen: 'CreateShoppingList' }),
    toInviteMembers: () =>
      navigation.navigate('Onboarding', { screen: 'InviteMembers' }),

    // ─── Cross-tab navigation (nested) ────────────────────────────────────
    // Each tab's stack now has multiple screens (detail screens nested
    // under it), so its own Main screen must be named explicitly.
    toPantryMain: () =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryMain' },
      }),
    toShoppingListMain: () =>
      navigation.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'ShoppingListMain' },
      }),

    // ─── Pantry detail/sub screens (nested under Pantry's own stack) ──────
    // Migrated from root-level siblings of `Home` to nested screens so
    // Pantry's Offscreen-pause boundary is isolated from the other 3 tabs —
    // see PantryStack.tsx.
    //
    // `PantryItem` params are an all-optional object (not `undefined`), so
    // `navigate` requires the argument present — default to `{}` when the
    // caller omits it. Type-checked: a required-param route would reject `{}`.
    toPantryItem: (params: PantryStackParams['PantryItem'] = {}) =>
      navigateToTabScreen(navigation, 'Pantry', 'PantryItem', params),
    toPantryItemDetail: (params: PantryStackParams['PantryItemDetail']) =>
      navigateToTabScreen(navigation, 'Pantry', 'PantryItemDetail', params),
    toNutritionScreen: (params: PantryStackParams['NutritionScreen']) =>
      navigateToTabScreen(navigation, 'Pantry', 'NutritionScreen', params),
    toPantryAnalytics: (params: PantryStackParams['PantryAnalytics']) =>
      navigateToTabScreen(navigation, 'Pantry', 'PantryAnalytics', params),
    toPantrySettings: (params?: PantryStackParams['PantrySettings']) =>
      navigateToTabScreen(navigation, 'Pantry', 'PantrySettings', params),
    toFilteredPantryItems: (params: PantryStackParams['FilteredPantryItems']) =>
      navigateToTabScreen(navigation, 'Pantry', 'FilteredPantryItems', params),
    // Nested Pantry copy — see the RecipeDetail duplication note on
    // `toRecipeDetail` below.
    toPantryRecipeDetail: (params: PantryStackParams['RecipeDetail']) =>
      navigateToTabScreen(navigation, 'Pantry', 'RecipeDetail', params),

    // ─── Shopping-list detail/sub screens (nested under ShoppingList's own
    // stack) ─────────────────────────────────────────────────────────────
    // Migrated from root-level siblings of `Home` to nested screens so
    // ShoppingList's Offscreen-pause boundary is isolated from the other 3
    // tabs — see ShoppingListStack.tsx.
    toEditItem: (params: ShoppingListStackParams['EditItem']) =>
      navigateToTabScreen(navigation, 'ShoppingList', 'EditItem', params),
    toShoppingListItemDetail: (params: ShoppingListStackParams['ItemDetail']) =>
      navigateToTabScreen(navigation, 'ShoppingList', 'ItemDetail', params),
    toListSettings: (params?: ShoppingListStackParams['ListSettings']) =>
      navigateToTabScreen(navigation, 'ShoppingList', 'ListSettings', params),
    toShareList: (params: ShoppingListStackParams['ShareList']) =>
      navigateToTabScreen(navigation, 'ShoppingList', 'ShareList', params),
    toPurchaseHistory: (params: ShoppingListStackParams['PurchaseHistory']) =>
      navigateToTabScreen(
        navigation,
        'ShoppingList',
        'PurchaseHistory',
        params,
      ),

    // ─── Recipe detail/sub screens (nested under Recipe's own stack) ──────
    // Migrated from root-level siblings of `Home` to nested screens so
    // Recipe's Offscreen-pause boundary is isolated from the other 3 tabs —
    // see RecipeStack.tsx. RecipeDetail is now nested in all three tabs that
    // reach it (Pantry/Recipe/MealPlan) with no shared root copy left — see
    // `toPantryRecipeDetail` and `toMealPlanRecipeDetail` for the other two.
    toRecipeDetail: (params: RecipeStackParams['RecipeDetail']) =>
      navigateToTabScreen(navigation, 'Recipe', 'RecipeDetail', params),
    toRecipeCreate: () =>
      navigateToTabScreen(navigation, 'Recipe', 'RecipeCreate', undefined),
    toRecipeEdit: (params: RecipeStackParams['RecipeEdit']) =>
      navigateToTabScreen(navigation, 'Recipe', 'RecipeEdit', params),
    toSavedRecipes: () =>
      navigateToTabScreen(navigation, 'Recipe', 'SavedRecipes', undefined),
    toMyRecipes: () =>
      navigateToTabScreen(navigation, 'Recipe', 'MyRecipes', undefined),

    // ─── Meal-plan screens (nested under MealPlan's own stack) ────────────
    // MealPlanMain stays nested under Home (it's the tab's main screen);
    // CreateMealPlan/MealTemplateBuilder/RecipeDetail are migrated the same
    // way as the other three tabs' own detail screens — see MealPlanStack.tsx.
    toMealPlanMain: () => navigation.navigate('Home', { screen: 'MealPlan' }),
    toCreateMealPlan: () =>
      navigateToTabScreen(navigation, 'MealPlan', 'CreateMealPlan', undefined),
    toMealTemplateBuilder: (
      params?: MealPlanStackParams['MealTemplateBuilder'],
    ) =>
      navigateToTabScreen(
        navigation,
        'MealPlan',
        'MealTemplateBuilder',
        params,
      ),
    toMealPlanRecipeDetail: (params: MealPlanStackParams['RecipeDetail']) =>
      navigateToTabScreen(navigation, 'MealPlan', 'RecipeDetail', params),

    // ─── Notification stack screens (nested under Notifications) ──────────
    toNotificationDetail: (
      params: NotificationStackParams['NotificationDetail'],
    ) =>
      navigation.navigate('Notifications', {
        screen: 'NotificationDetail',
        params,
      }),

    // ─── Barcode modal flow (nested) ──────────────────────────────────────
    toBarcode: (params?: BarcodeStackParams['BarcodeScanner']) =>
      navigation.navigate('Barcode', { screen: 'BarcodeScanner', params }),
    toSearchResults: (params: BarcodeStackParams['SearchResults']) =>
      navigation.navigate('Barcode', { screen: 'SearchResults', params }),
  };
}
