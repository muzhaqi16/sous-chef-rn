import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '#navigation/RootNavigator';
import type { PantryStackParams } from '#navigation/stacks/PantryStack';
import type { ShoppingListStackParams } from '#navigation/stacks/ShoppingListStack';
import type { RecipeStackParams } from '#navigation/stacks/RecipeStack';
import type { BarcodeStackParams } from '#navigation/stacks/BarcodeStack';
import type { NotificationStackParams } from '#navigation/stacks/NotificationStack';
import type { MealPlanStackParams } from '#navigation/stacks/MealPlanStack';

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
 * - For nested stacks (Auth, Onboarding, HomeTabs → Pantry/ShoppingList/
 *   Recipe/MealPlan, Barcode), use the nested form:
 *   `navigate(Parent, { screen, params })`. This is the v8-idiomatic
 *   alternative to `CommonActions.navigate(name)`, which is untyped and
 *   intentionally avoided here.
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
    /** True when the navigation stack has a previous screen to return to. */
    canGoBack: navigation.canGoBack(),

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
    toNotifications: () => navigation.navigate('Notifications'),
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

    // ─── Pantry stack screens (nested under Home → Pantry) ────────────────
    toPantryItem: (params?: PantryStackParams['PantryItem']) =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryItem', params },
      }),
    toPantryItemDetail: (params: PantryStackParams['PantryItemDetail']) =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryItemDetail', params },
      }),
    toNutritionScreen: (params: PantryStackParams['NutritionScreen']) =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'NutritionScreen', params },
      }),
    toPantryAnalytics: (params: PantryStackParams['PantryAnalytics']) =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'PantryAnalytics', params },
      }),
    toPantrySettings: (params?: PantryStackParams['PantrySettings']) =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'PantrySettings', params },
      }),
    toFilteredPantryItems: (params: PantryStackParams['FilteredPantryItems']) =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'FilteredPantryItems', params },
      }),
    toPantryRecipeDetail: (params: PantryStackParams['RecipeDetail']) =>
      navigation.navigate('Home', {
        screen: 'Pantry',
        params: { screen: 'RecipeDetail', params },
      }),

    // ─── Shopping-list stack screens (nested under Home → ShoppingList) ───
    toAddItem: (params?: ShoppingListStackParams['AddItem']) =>
      navigation.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'AddItem', params },
      }),
    toEditItem: (params: ShoppingListStackParams['EditItem']) =>
      navigation.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'EditItem', params },
      }),
    toShoppingListItemDetail: (params: ShoppingListStackParams['ItemDetail']) =>
      navigation.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'ItemDetail', params },
      }),
    toListSettings: (params?: ShoppingListStackParams['ListSettings']) =>
      navigation.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'ListSettings', params },
      }),
    toShareList: (params: ShoppingListStackParams['ShareList']) =>
      navigation.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'ShareList', params },
      }),
    toPurchaseHistory: (params: ShoppingListStackParams['PurchaseHistory']) =>
      navigation.navigate('Home', {
        screen: 'ShoppingList',
        params: { screen: 'PurchaseHistory', params },
      }),

    // ─── Recipe stack screens (nested under Home → Recipe) ────────────────
    toRecipeDetail: (params: RecipeStackParams['RecipeDetail']) =>
      navigation.navigate('Home', {
        screen: 'Recipe',
        params: { screen: 'RecipeDetail', params },
      }),
    toRecipeCreate: () =>
      navigation.navigate('Home', {
        screen: 'Recipe',
        params: { screen: 'RecipeCreate' },
      }),
    toRecipeEdit: (params: RecipeStackParams['RecipeEdit']) =>
      navigation.navigate('Home', {
        screen: 'Recipe',
        params: { screen: 'RecipeEdit', params },
      }),
    toSavedRecipes: () =>
      navigation.navigate('Home', {
        screen: 'Recipe',
        params: { screen: 'SavedRecipes' },
      }),
    toMyRecipes: () =>
      navigation.navigate('Home', {
        screen: 'Recipe',
        params: { screen: 'MyRecipes' },
      }),

    // ─── Meal-plan stack screens (nested under Home → MealPlan) ───────────
    toMealPlanMain: () =>
      navigation.navigate('Home', {
        screen: 'MealPlan',
        params: { screen: 'MealPlanMain' },
      }),
    toCreateMealPlan: () =>
      navigation.navigate('Home', {
        screen: 'MealPlan',
        params: { screen: 'CreateMealPlan' },
      }),
    toMealPlanRecipeDetail: (params: MealPlanStackParams['RecipeDetail']) =>
      navigation.navigate('Home', {
        screen: 'MealPlan',
        params: { screen: 'RecipeDetail', params },
      }),

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
