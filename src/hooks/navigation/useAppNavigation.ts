import {
  CommonActions,
  StackActions,
  useNavigation,
} from '@react-navigation/native';
import type { RootStackParamList } from '#navigation/RootNavigator';
import type { BarcodeStackParams } from '#navigation/stacks/BarcodeStack';
import type { NotificationStackParams } from '#navigation/stacks/NotificationStack';

/** Root routes whose params are an object or absent: what `replace` can carry. */
type ReplaceableRoute = {
  [Name in keyof RootStackParamList]: RootStackParamList[Name] extends
    | object
    | undefined
    ? Name
    : never;
}[keyof RootStackParamList];

// `StackActions.replace` accepts any name and params; this checks both against
// the root stack the way `navigate` is checked.
const replaceAction = <Name extends ReplaceableRoute>(
  name: Name,
  params: RootStackParamList[Name],
) => StackActions.replace(name, params);

/** The root stack holding only `name`, checked the way `replaceAction` is. */
const resetRootAction = <Name extends ReplaceableRoute>(
  name: Name,
  params: RootStackParamList[Name],
) => CommonActions.reset({ index: 0, routes: [{ name, params }] });

interface Navigable {
  getState():
    | { routeNames: readonly string[]; routes: readonly { name: string }[] }
    | undefined;
  getParent(): Navigable | undefined;
  dispatch(action: ReturnType<typeof CommonActions.reset>): void;
}

/**
 * A deep-link screen alone on the root stack (a link opened the app, or a
 * session end removed what was under it) gives way to the screen the app starts
 * on: the active group's first route.
 */
function leaveLoneDeepLink(navigation: Navigable) {
  let root = navigation;
  for (let parent = root.getParent(); parent; parent = parent.getParent()) {
    root = parent;
  }
  const state = root.getState();
  const [start] = state?.routeNames ?? [];
  const [only] = state?.routes ?? [];
  if (!start || only?.name === start) return;
  root.dispatch(CommonActions.reset({ index: 0, routes: [{ name: start }] }));
}

/**
 * The one place that knows screen names, so a rename surfaces here as a type
 * error. Names stay string LITERALS: the overloads discriminate on them, and a
 * `ROUTES` object loses that.
 */
export function useAppNavigation() {
  const navigation = useNavigation();

  return {
    /** Raw navigation prop for one-off needs (e.g., `addListener`). */
    navigation,

    /** Pop the current screen; a lone deep-link screen leaves for the start screen. */
    goBack: () => {
      if (navigation.canGoBack()) navigation.goBack();
      else leaveLoneDeepLink(navigation);
    },

    // ─── Auth flow ─────────────────────────────────────────────────────────
    toAuth: () => navigation.navigate('Auth'),
    toLogin: () => navigation.navigate('Auth', { screen: 'Login' }),
    /**
     * Sign-in from a deep-link screen, as the root's only route. `toLogin` leaves
     * the link behind: deep-link screens have no `if` on their group, so they
     * outlive the `Auth` group and resurface after sign-in. A replace keeps what
     * was under the link, so a signed-out flow there became a second `Auth`.
     */
    replaceWithLogin: () =>
      navigation.dispatch(resetRootAction('Auth', { screen: 'Login' })),
    toSignUp: () => navigation.navigate('Auth', { screen: 'SignUp' }),
    toForgotPassword: () =>
      navigation.navigate('Auth', { screen: 'ForgotPassword' }),

    // ─── Deep-link targets ────────────────────────────────────────────────
    toJoinHomeByCode: (joinCode?: string) =>
      navigation.navigate('JoinHomeByCode', joinCode ? { joinCode } : {}),
    toJoinByShareCode: (shareCode: string) =>
      navigation.navigate('JoinByShareCode', { shareCode }),
    /** A resolver screen hands off to the join screen and leaves the stack. */
    replaceWithJoinHomeByCode: (joinCode: string) =>
      navigation.dispatch(replaceAction('JoinHomeByCode', { joinCode })),
    replaceWithJoinByShareCode: (shareCode: string) =>
      navigation.dispatch(replaceAction('JoinByShareCode', { shareCode })),

    // `pop`: from a modal or a pushed screen, back down to the tabs. Without
    // it the root stack only reuses a route above the current one, so it
    // pushes a second `Home` over the screen.
    toPantryMain: () =>
      navigation.navigate('Home', { screen: 'Pantry' }, { pop: true }),
    toShoppingListMain: () =>
      navigation.navigate('Home', { screen: 'ShoppingList' }, { pop: true }),
    toRecipeMain: () =>
      navigation.navigate('Home', { screen: 'Recipe' }, { pop: true }),
    toMealPlanMain: () =>
      navigation.navigate('Home', { screen: 'MealPlan' }, { pop: true }),

    // ─── Profile / home management ────────────────────────────────────────
    toProfile: () => navigation.navigate('Profile'),
    /**
     * Pushed, not the root's `verification` group, so backing out keeps the
     * session and a verify returns to the screen it was opened from.
     */
    toVerifyEmail: () => navigation.navigate('VerifyEmail'),
    toHomeManagement: (params?: RootStackParamList['HomeManagement']) =>
      navigation.navigate('HomeManagement', params ?? {}),
    toHomeDetail: (params: RootStackParamList['HomeDetail']) =>
      navigation.navigate('HomeDetail', params),
    toHomeDietaryNeeds: (params: RootStackParamList['HomeDietaryNeeds']) =>
      navigation.navigate('HomeDietaryNeeds', params),
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
    toDataSources: () => navigation.navigate('DataSources'),
    toMyReports: () => navigation.navigate('MyReports'),
    toBrandLists: () => navigation.navigate('BrandLists'),
    toBrandList: (params: RootStackParamList['BrandList']) =>
      navigation.navigate('BrandList', params),
    toPerformanceDashboard: () => navigation.navigate('PerformanceDashboard'),
    toDebugInfo: () => navigation.navigate('DebugInfo'),
    toReceiptScan: () =>
      navigation.navigate('Receipts', { screen: 'ReceiptScan' }),
    toReceiptReview: () =>
      navigation.navigate('Receipts', { screen: 'ReceiptReview' }),
    toChangePassword: () => navigation.navigate('ChangePassword'),
    toAppearance: () => navigation.navigate('Appearance'),

    // ─── Pantry detail/sub screens ────────────────────────────────────────
    // `PantryItem` edits an existing item, so `itemId` is required.
    toPantryItem: (params: RootStackParamList['PantryItem']) =>
      navigation.navigate('PantryItem', params),
    toPantryItemDetail: (params: RootStackParamList['PantryItemDetail']) =>
      navigation.navigate('PantryItemDetail', params),
    /** A detail whose stack was merged away shows the survivor in its place. */
    replaceWithPantryItemDetail: (
      params: RootStackParamList['PantryItemDetail'],
    ) => navigation.dispatch(replaceAction('PantryItemDetail', params)),
    toNutritionScreen: (params: RootStackParamList['NutritionScreen']) =>
      navigation.navigate('NutritionScreen', params),
    toPantryAnalytics: (params: RootStackParamList['PantryAnalytics']) =>
      navigation.navigate('PantryAnalytics', params),
    toPantrySettings: (params?: RootStackParamList['PantrySettings']) =>
      navigation.navigate('PantrySettings', params),
    toPantryBatchHistory: (params: RootStackParamList['PantryBatchHistory']) =>
      navigation.navigate('PantryBatchHistory', params),
    toPantryUsageHistory: (params: RootStackParamList['PantryUsageHistory']) =>
      navigation.navigate('PantryUsageHistory', params),
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
    toListBudget: (params: RootStackParamList['ListBudget']) =>
      navigation.navigate('ListBudget', params),
    toShareList: (params: RootStackParamList['ShareList']) =>
      navigation.navigate('ShareList', params),
    toPurchaseHistory: (params: RootStackParamList['PurchaseHistory']) =>
      navigation.navigate('PurchaseHistory', params),
    toStoreMode: (params: RootStackParamList['StoreMode']) =>
      navigation.navigate('StoreMode', params),

    // One RecipeDetail serves every tab that opens it, so its own fork and edit
    // actions stay wherever the user opened it from.
    toRecipeDetail: (params: RootStackParamList['RecipeDetail']) =>
      navigation.navigate('RecipeDetail', params),
    /** A recipe link's resolver hands off to the detail screen and leaves the stack. */
    replaceWithRecipeDetail: (params: RootStackParamList['RecipeDetail']) =>
      navigation.dispatch(replaceAction('RecipeDetail', params)),
    /** With `captureId`, the form opens filled with what that capture read. */
    toRecipeCreate: (params?: RootStackParamList['RecipeCreate']) =>
      navigation.navigate('RecipeCreate', params),
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
