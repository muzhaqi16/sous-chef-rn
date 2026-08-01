import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '#navigation/RootNavigator';
import type { BarcodeStackParams } from '#navigation/stacks/BarcodeStack';
import type { NotificationStackParams } from '#navigation/stacks/NotificationStack';

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
 * - `navigation.navigate('X')` is type-checked against `RootStackParamList`
 *   thanks to the `declare module '@react-navigation/core'` augmentation in
 *   `RootNavigator.tsx`. Feature-contributed deep-link screens
 *   (`AcceptInvitation`, `JoinByShareCode`) are declared statically in the
 *   root navigator so v8's `StaticParamList` inference covers them.
 * - For nested navigators (Auth, Onboarding, the HomeTabs tab *main* screens
 *   — Pantry/ShoppingList/Recipe/MealPlan — and Barcode), use the nested
 *   form: `navigate(Parent, { screen, params })`. This is the v8-idiomatic
 *   alternative to `CommonActions.navigate(name)`, which is untyped and
 *   intentionally avoided here.
 * - Feature detail/sub screens (item details, settings, RecipeDetail, …) are
 *   registered at the root level — siblings of the tab navigator (see
 *   RootNavigator) — so the floating tab bar is never mounted on them. They're
 *   reached with the flat form: `navigate('ScreenName', params)`.
 *
 * Screen names appear as string literals in this file only — extracting
 * them into a `ROUTES` constants object would lose v8 type safety, because
 * `navigation.navigate` overloads discriminate on literal types and a
 * `string`-typed constant won't match a route's specific param overload.
 * The facade itself is the centralization layer; call sites only see
 * `toFoo()` methods.
 */
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
    toProfile: () => navigation.navigate('Profile'),
    toNotifications: () =>
      navigation.navigate('Notifications', { screen: 'NotificationList' }),
    toHomeManagement: (params?: RootStackParamList['HomeManagement']) =>
      navigation.navigate('HomeManagement', params ?? {}),
    toHomeDetail: (params: RootStackParamList['HomeDetail']) =>
      navigation.navigate('HomeDetail', params),
    toStorageLocations: (params: RootStackParamList['StorageLocations']) =>
      navigation.navigate('StorageLocations', params),
    toImageCrop: (params: RootStackParamList['ImageCrop']) =>
      navigation.navigate('ImageCrop', params),

    // ─── Profile/settings sub-screens (root-level) ────────────────────────
    toProfilePhotoUpload: () => navigation.navigate('ProfilePhotoUpload'),
    toDeleteAccount: () => navigation.navigate('DeleteAccount'),
    toNotificationSettings: () => navigation.navigate('NotificationSettings'),
    toDietaryProfile: () => navigation.navigate('DietaryProfile'),
    toPersonalInformation: () => navigation.navigate('PersonalInformation'),
    toAppSettings: () => navigation.navigate('AppSettings'),
    toPerformanceDashboard: () => navigation.navigate('PerformanceDashboard'),
    toDebugInfo: () => navigation.navigate('DebugInfo'),
    toChangePassword: () => navigation.navigate('ChangePassword'),
    toAppearance: () => navigation.navigate('Appearance'),

    // ─── Onboarding sub-screens (nested) ──────────────────────────────────
    toCreateHome: () =>
      navigation.navigate('Onboarding', { screen: 'CreateHome' }),
    toCreateShoppingList: () =>
      navigation.navigate('Onboarding', { screen: 'CreateShoppingList' }),
    toInviteMembers: () =>
      navigation.navigate('Onboarding', { screen: 'InviteMembers' }),

    // ─── Cross-tab navigation (nested) ────────────────────────────────────
    // Each tab stack is single-screen (detail screens live at the root level),
    // so focusing the tab shows its main screen — no nested `params` needed.
    toPantryMain: () => navigation.navigate('Home', { screen: 'Pantry' }),
    toShoppingListMain: () =>
      navigation.navigate('Home', { screen: 'ShoppingList' }),

    // ─── Pantry detail/sub screens (root-level, siblings of Home) ─────────
    // `PantryItem` params are an all-optional object (not `undefined`), so
    // `navigate` requires the argument present — default to `{}` when the
    // caller omits it. Type-checked: a required-param route would reject `{}`.
    toPantryItem: (params: RootStackParamList['PantryItem'] = {}) =>
      navigation.navigate('PantryItem', params),
    toPantryItemDetail: (params: RootStackParamList['PantryItemDetail']) =>
      navigation.navigate('PantryItemDetail', params),
    toNutritionScreen: (params: RootStackParamList['NutritionScreen']) =>
      navigation.navigate('NutritionScreen', params),
    toPantryAnalytics: (params: RootStackParamList['PantryAnalytics']) =>
      navigation.navigate('PantryAnalytics', params),
    toPantrySettings: (params?: RootStackParamList['PantrySettings']) =>
      navigation.navigate('PantrySettings', params),
    toFilteredPantryItems: (
      params: RootStackParamList['FilteredPantryItems'],
    ) => navigation.navigate('FilteredPantryItems', params),
    toPantryRecipeDetail: (params: RootStackParamList['RecipeDetail']) =>
      navigation.navigate('RecipeDetail', params),

    // ─── Shopping-list detail/sub screens (root-level, siblings of Home) ──
    toAddItem: (params: RootStackParamList['AddItem']) =>
      navigation.navigate('AddItem', params),
    toEditItem: (params: RootStackParamList['EditItem']) =>
      navigation.navigate('EditItem', params),
    toShoppingListItemDetail: (params: RootStackParamList['ItemDetail']) =>
      navigation.navigate('ItemDetail', params),
    toListSettings: (params?: RootStackParamList['ListSettings']) =>
      navigation.navigate('ListSettings', params),
    toShareList: (params: RootStackParamList['ShareList']) =>
      navigation.navigate('ShareList', params),
    toPurchaseHistory: (params: RootStackParamList['PurchaseHistory']) =>
      navigation.navigate('PurchaseHistory', params),

    // ─── Recipe detail/sub screens (root-level, siblings of Home) ─────────
    // RecipeDetail is a single root screen reached from Pantry, Recipe and
    // MealPlan; the three `to*RecipeDetail` aliases all target it.
    toRecipeDetail: (params: RootStackParamList['RecipeDetail']) =>
      navigation.navigate('RecipeDetail', params),
    toRecipeCreate: () => navigation.navigate('RecipeCreate'),
    toRecipeEdit: (params: RootStackParamList['RecipeEdit']) =>
      navigation.navigate('RecipeEdit', params),
    toSavedRecipes: () => navigation.navigate('SavedRecipes'),
    toMyRecipes: () => navigation.navigate('MyRecipes'),

    // ─── Meal-plan screens ────────────────────────────────────────────────
    // MealPlanMain stays nested under Home (it's the tab's main screen);
    // CreateMealPlan + RecipeDetail are root-level.
    toMealPlanMain: () => navigation.navigate('Home', { screen: 'MealPlan' }),
    toCreateMealPlan: () => navigation.navigate('CreateMealPlan'),
    toMealTemplateBuilder: (params?: { templateId?: string }) =>
      navigation.navigate('MealTemplateBuilder', params),
    toMealPlanRecipeDetail: (params: RootStackParamList['RecipeDetail']) =>
      navigation.navigate('RecipeDetail', params),

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
