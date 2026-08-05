import { StackActions, useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '#navigation/RootNavigator';
import type { BarcodeStackParams } from '#navigation/stacks/BarcodeStack';
import type { NotificationStackParams } from '#navigation/stacks/NotificationStack';
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
 * Two navigate shapes appear below:
 * - Root-level screens (every feature detail/sub screen, plus the deep-link
 *   entry points) use the flat form, type-checked against `RootStackParamList`.
 * - Screens inside a nested navigator (Auth, Onboarding, Barcode,
 *   Notifications, and each tab's own Main screen) use
 *   `navigate(Parent, { screen, params })` — the v8-idiomatic alternative to
 *   the untyped `CommonActions.navigate(name)`.
 *
 * Screen names appear as string literals in this file only — extracting them
 * into a `ROUTES` constants object would lose type safety, because
 * `navigation.navigate` overloads discriminate on literal types and a
 * `string`-typed constant won't match a route's specific param overload.
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
    /**
     * Hand off to sign-in from a deep-link screen, dropping that screen from
     * the stack.
     *
     * `toLogin` would leave it behind: deep-link screens live in a group with
     * no `if`, so they outlive the `Auth` group that a login removes, and the
     * abandoned screen — still holding its finished state — becomes the top
     * route the moment the user signs in. `replace` is what the other
     * transparent deep-link screens use for the same reason.
     */
    replaceWithLogin: () =>
      navigation.dispatch(StackActions.replace('Auth', { screen: 'Login' })),
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

    // ─── Onboarding sub-screens (nested) ──────────────────────────────────
    toCreateHome: () =>
      navigation.navigate('Onboarding', { screen: 'CreateHome' }),
    toCreateShoppingList: () =>
      navigation.navigate('Onboarding', { screen: 'CreateShoppingList' }),
    toInviteMembers: () =>
      navigation.navigate('Onboarding', { screen: 'InviteMembers' }),
    // Onboarding's own copy of ImageCrop, so cropping during onboarding stays
    // inside that flow rather than pushing the root-level `ImageCrop` below.
    toOnboardingImageCrop: (params: OnboardingStackParams['ImageCrop']) =>
      navigation.navigate('Onboarding', { screen: 'ImageCrop', params }),

    // ─── Tab main screens (nested under Home) ─────────────────────────────
    toPantryMain: () => navigation.navigate('Home', { screen: 'Pantry' }),
    toShoppingListMain: () =>
      navigation.navigate('Home', { screen: 'ShoppingList' }),
    toMealPlanMain: () => navigation.navigate('Home', { screen: 'MealPlan' }),

    // ─── Profile / home management ────────────────────────────────────────
    toProfile: () => navigation.navigate('Profile'),
    toHomeManagement: (params?: RootStackParamList['HomeManagement']) =>
      navigation.navigate('HomeManagement', params ?? {}),
    toHomeDetail: (params: RootStackParamList['HomeDetail']) =>
      navigation.navigate('HomeDetail', params),
    toStorageLocations: (params: RootStackParamList['StorageLocations']) =>
      navigation.navigate('StorageLocations', params),
    toImageCrop: (params: RootStackParamList['ImageCrop']) =>
      navigation.navigate('ImageCrop', params),
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

    // ─── Pantry detail/sub screens ────────────────────────────────────────
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

    // ─── Shopping-list detail/sub screens ─────────────────────────────────
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

    // ─── Recipe detail/sub screens ────────────────────────────────────────
    // One RecipeDetail serves all three tabs that open it (Pantry, Recipe,
    // MealPlan), so its own "open the fork I just made" / "edit this recipe"
    // actions stay wherever the user opened it from.
    toRecipeDetail: (params: RootStackParamList['RecipeDetail']) =>
      navigation.navigate('RecipeDetail', params),
    toRecipeCreate: () => navigation.navigate('RecipeCreate'),
    toRecipeEdit: (params: RootStackParamList['RecipeEdit']) =>
      navigation.navigate('RecipeEdit', params),
    toSavedRecipes: () => navigation.navigate('SavedRecipes'),
    toMyRecipes: () => navigation.navigate('MyRecipes'),

    // ─── Meal-plan detail/sub screens ─────────────────────────────────────
    toCreateMealPlan: () => navigation.navigate('CreateMealPlan'),
    toMealTemplateBuilder: (
      params?: RootStackParamList['MealTemplateBuilder'],
    ) => navigation.navigate('MealTemplateBuilder', params),

    // ─── Notification stack screens (nested) ──────────────────────────────
    toNotifications: () =>
      navigation.navigate('Notifications', { screen: 'NotificationList' }),
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
