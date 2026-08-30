import { StackActions, useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '#navigation/RootNavigator';
import type { BarcodeStackParams } from '#navigation/stacks/BarcodeStack';
import type { NotificationStackParams } from '#navigation/stacks/NotificationStack';
import type { OnboardingStackParams } from '#navigation/stacks/OnboardingStack';

/**
 * The one place that knows screen names — always navigate through this hook, so
 * a rename surfaces here as a type error. Root screens use the flat form, nested
 * navigators `navigate(Parent, { screen, params })`. Names stay string LITERALS:
 * a `ROUTES` object loses type safety, as the overloads discriminate on those.
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
     * Sign-in from a deep-link screen, DROPPING that screen. `toLogin` leaves it
     * behind: deep-link screens have no `if` on their group, so they outlive the
     * `Auth` group and resurface as the top route after sign-in.
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
    /**
     * Email verification reached from INSIDE the app (the profile banner, the
     * collaborate gate). A pushed screen rather than the root navigator's
     * `verification` group, so backing out keeps the session and a successful
     * verify returns to the screen it was opened from.
     */
    toVerifyEmail: () => navigation.navigate('VerifyEmail'),
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
    // `PantryItem` edits an existing item, so `itemId` is required. It was
    // optional while the form carried an unreachable `add` mode.
    toPantryItem: (params: RootStackParamList['PantryItem']) =>
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
