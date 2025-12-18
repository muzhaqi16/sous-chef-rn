/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-shadow */
// Shared GraphQL types - no hooks
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  BigInt: { input: string; output: string };
  DateTime: { input: string; output: string };
  IPv4: { input: string; output: string };
  JSON: { input: any; output: any };
  Upload: { input: File; output: File };
};

/**
 * Access level for resource-based authorization
 * - OWNER: Full control (create, read, update, delete, manage permissions)
 * - WRITE: Can modify (create, read, update, delete own items)
 * - READ: Can only view (read-only access)
 */
export enum AccessLevel {
  Owner = 'OWNER',
  Read = 'READ',
  Write = 'WRITE',
}

export enum AcquisitionMethod {
  BarcodeScan = 'BARCODE_SCAN',
  Gifted = 'GIFTED',
  Homegrown = 'HOMEGROWN',
  Other = 'OTHER',
  Purchased = 'PURCHASED',
  ShoppingList = 'SHOPPING_LIST',
}

export type AddCollaboratorInput = {
  email: Scalars['String']['input'];
  role: CollaboratorRole;
  shoppingListId: Scalars['ID']['input'];
};

export type AddIngredientResult = {
  __typename?: 'AddIngredientResult';
  previousQuantity?: Maybe<Scalars['Float']['output']>;
  quantityAdded: Scalars['Float']['output'];
  shoppingListItem: ShoppingListItem;
  unitConversionApplied: Scalars['Boolean']['output'];
  wasUpdated: Scalars['Boolean']['output'];
};

/** Result of adding an item to pantry */
export type AddPantryItemResult =
  | NotFoundError
  | PantryItem
  | UnauthorizedError
  | ValidationError;

/** Result of adding a pantry item to a shopping list */
export type AddPantryItemToShoppingListResult = {
  __typename?: 'AddPantryItemToShoppingListResult';
  shoppingListItemId: Scalars['String']['output'];
};

export type AddRecipeToShoppingListResult = {
  __typename?: 'AddRecipeToShoppingListResult';
  addedItems: Array<ShoppingListItem>;
  skippedItems: Array<RecipeIngredient>;
  totalAdded: Scalars['Int']['output'];
  totalSkipped: Scalars['Int']['output'];
  totalUpdated: Scalars['Int']['output'];
  updatedItems: Array<ShoppingListItem>;
};

export type AddRestrictionInput = {
  appliesToHomeId?: InputMaybe<Scalars['String']['input']>;
  diet?: InputMaybe<Diet>;
  healthGoal?: InputMaybe<HealthGoal>;
  intolerance?: InputMaybe<Intolerance>;
  notes?: InputMaybe<Scalars['String']['input']>;
  severity: RestrictionSeverity;
};

export type AddRestrictionsInput = {
  reason: Scalars['String']['input'];
  restrictedUntil?: InputMaybe<Scalars['DateTime']['input']>;
  restrictions: Array<ModerationRestriction>;
  userId: Scalars['ID']['input'];
};

/** Result of adding an item to a shopping list */
export type AddShoppingListItemResult =
  | DuplicateError
  | NotFoundError
  | ShoppingListItem
  | UnauthorizedError
  | ValidationError;

export type AddTemplateItemInput = {
  customMealName?: InputMaybe<Scalars['String']['input']>;
  dayOffset: Scalars['Int']['input'];
  mealType: MealType;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  templateId: Scalars['ID']['input'];
};

export type AddWarningInput = {
  reason: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

/** Item that was added to the shopping list from low stock detection */
export type AddedLowStockItem = {
  __typename?: 'AddedLowStockItem';
  itemName: Scalars['String']['output'];
  pantryItemId: Scalars['String']['output'];
  quantity: Scalars['Float']['output'];
  shoppingListItemId: Scalars['String']['output'];
};

/** Cost analytics for additions/restocks */
export type AdditionCostAnalytics = {
  __typename?: 'AdditionCostAnalytics';
  averageCostPerUnit: Scalars['Float']['output'];
  costByStore: Array<StoreCostBreakdown>;
  totalSpent: Scalars['Float']['output'];
};

/** Result of quantity aggregation (add/subtract) */
export type AggregationResult = {
  __typename?: 'AggregationResult';
  displayText: Scalars['String']['output'];
  quantity: Scalars['Float']['output'];
  sufficient?: Maybe<Scalars['Boolean']['output']>;
  unit: Unit;
};

/** Input for allergen data */
export type AllergenInput = {
  confirmed?: InputMaybe<Scalars['Boolean']['input']>;
  contains: Scalars['Boolean']['input'];
  mayContain?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  processedIn?: InputMaybe<Scalars['Boolean']['input']>;
  severity?: InputMaybe<AllergenSeverity>;
};

/** Allergen severity levels */
export enum AllergenSeverity {
  LifeThreatening = 'LIFE_THREATENING',
  Mild = 'MILD',
  Moderate = 'MODERATE',
  Severe = 'SEVERE',
  Trace = 'TRACE',
}

/** Input for filtering analytics queries by time period */
export type AnalyticsFilterInput = {
  /** Custom date range - overrides dateRange if both provided */
  customRange?: InputMaybe<DateRangeInput>;
  /** Predefined date range (TODAY, LAST_WEEK, LAST_MONTH, etc.) */
  dateRange?: InputMaybe<DateRange>;
  /** Limit for top items lists (default: 10) */
  topItemsLimit?: InputMaybe<Scalars['Int']['input']>;
};

export enum AppTheme {
  Dark = 'DARK',
  Light = 'LIGHT',
  System = 'SYSTEM',
}

export enum AppealStatus {
  Approved = 'APPROVED',
  Denied = 'DENIED',
  Submitted = 'SUBMITTED',
  UnderReview = 'UNDER_REVIEW',
  Withdrawn = 'WITHDRAWN',
}

/** Authentication response containing tokens - NEVER cache */
export type AuthPayload = {
  __typename?: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
  user: User;
};

export type AutocompleteCategoryInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  parentId?: InputMaybe<Scalars['String']['input']>;
  query: Scalars['String']['input'];
  type?: InputMaybe<CategoryType>;
};

export type AutocompleteCategoryResponse = {
  __typename?: 'AutocompleteCategoryResponse';
  suggestions: Array<CategorySuggestion>;
  totalCount: Scalars['Int']['output'];
};

export type AutocompleteInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  storeId?: InputMaybe<Scalars['String']['input']>;
};

export type AutocompleteResponse = {
  __typename?: 'AutocompleteResponse';
  suggestions: Array<ItemSuggestion>;
  totalCount: Scalars['Int']['output'];
};

export enum AutomatedFlag {
  AbuseLanguage = 'ABUSE_LANGUAGE',
  DuplicateContent = 'DUPLICATE_CONTENT',
  FakeReviews = 'FAKE_REVIEWS',
  MultipleAccounts = 'MULTIPLE_ACCOUNTS',
  PromotionalContent = 'PROMOTIONAL_CONTENT',
  SpamDetected = 'SPAM_DETECTED',
  SuspiciousBehavior = 'SUSPICIOUS_BEHAVIOR',
}

export type BanUserInput = {
  reason: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

/**
 * Brand type for product manufacturers and retailers
 * Cache: 1 hour - brand catalog is relatively stable
 */
export type Brand = {
  __typename?: 'Brand';
  children: Array<Brand>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  parent?: Maybe<Brand>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type BrandInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  logo?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  website?: InputMaybe<Scalars['String']['input']>;
};

export type BrandSuggestion = {
  __typename?: 'BrandSuggestion';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type BrowserStat = {
  __typename?: 'BrowserStat';
  browserName: Scalars['String']['output'];
  count: Scalars['Int']['output'];
};

export type BulkCreateItemInput = {
  items: Array<CreateItemInput>;
  skipDuplicates?: InputMaybe<Scalars['Boolean']['input']>;
  updateExisting?: InputMaybe<Scalars['Boolean']['input']>;
  validateOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type BulkCreateItemsResponse = {
  __typename?: 'BulkCreateItemsResponse';
  created: Array<Item>;
  errors: Array<ItemError>;
  skipped: Array<SkippedItem>;
  summary: BulkOperationSummary;
  updated: Array<Item>;
};

/** Error detail for bulk device operations */
export type BulkDeviceError = {
  __typename?: 'BulkDeviceError';
  deviceId: Scalars['ID']['output'];
  message: Scalars['String']['output'];
};

/** Result of bulk device update */
export type BulkDeviceResult = {
  __typename?: 'BulkDeviceResult';
  devices: Array<Device>;
  errors?: Maybe<Array<BulkDeviceError>>;
  success: Scalars['Boolean']['output'];
  updatedCount: Scalars['Int']['output'];
};

/**
 * Input for bulk device updates.
 * Only status fields that make sense for bulk operations.
 */
export type BulkDeviceUpdateInput = {
  delete?: InputMaybe<Scalars['Boolean']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
};

export type BulkNotificationInput = {
  actionUrl?: InputMaybe<Scalars['String']['input']>;
  batchId?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  payload: Scalars['JSON']['input'];
  priority?: InputMaybe<Priority>;
  title?: InputMaybe<Scalars['String']['input']>;
  type: NotificationType;
  userIds: Array<Scalars['String']['input']>;
};

export type BulkNotificationResult = {
  __typename?: 'BulkNotificationResult';
  failed: Array<Scalars['String']['output']>;
  sent: Array<Notification>;
  totalFailed: Scalars['Int']['output'];
  totalSent: Scalars['Int']['output'];
};

export type BulkOperationSummary = {
  __typename?: 'BulkOperationSummary';
  executionTime: Scalars['Float']['output'];
  failed: Scalars['Int']['output'];
  skipped: Scalars['Int']['output'];
  successful: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

/**
 * Scope for cache control (PUBLIC or PRIVATE)
 * PUBLIC: Can be cached by CDN and shared caches
 * PRIVATE: Can only be cached by private/user-specific caches
 */
export enum CacheControlScope {
  Private = 'PRIVATE',
  Public = 'PUBLIC',
}

export type CanDeleteAccountResult = {
  __typename?: 'CanDeleteAccountResult';
  blockers: Array<DeletionBlocker>;
  canDelete: Scalars['Boolean']['output'];
};

/**
 * Category type for organizing items
 * Cache: 2 hours - reference data that changes very rarely
 */
export type Category = {
  __typename?: 'Category';
  children: Array<Category>;
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<User>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isSystem: Scalars['Boolean']['output'];
  itemCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  parent?: Maybe<Category>;
  slug: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  type: CategoryType;
  updatedAt: Scalars['DateTime']['output'];
  usageCount: Scalars['Int']['output'];
  version: Scalars['Int']['output'];
  visibility: Visibility;
};

export type CategoryInput = {
  level?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  parentCategory?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export enum CategorySource {
  Ai = 'AI',
  Auto = 'AUTO',
  Crowd = 'CROWD',
  Import = 'IMPORT',
  Manual = 'MANUAL',
}

export type CategorySuggestion = {
  __typename?: 'CategorySuggestion';
  color?: Maybe<Scalars['String']['output']>;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  slug?: Maybe<Scalars['String']['output']>;
  type: CategoryType;
};

export enum CategoryType {
  Cuisine = 'CUISINE',
  Custom = 'CUSTOM',
  Dietary = 'DIETARY',
  General = 'GENERAL',
  MealType = 'MEAL_TYPE',
  Storage = 'STORAGE',
  System = 'SYSTEM',
}

export type ChangePasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};

export type ChangePasswordResponse = {
  __typename?: 'ChangePasswordResponse';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Source of the change for audit purposes */
export enum ChangeSource {
  Api = 'API',
  BarcodeScan = 'BARCODE_SCAN',
  ExpirationAlert = 'EXPIRATION_ALERT',
  MobileApp = 'MOBILE_APP',
  RecipeCooking = 'RECIPE_COOKING',
  ShoppingList = 'SHOPPING_LIST',
  System = 'SYSTEM',
  User = 'USER',
  WebApp = 'WEB_APP',
}

/** Change types for pantry item modifications */
export enum ChangeType {
  Consumed = 'CONSUMED',
  Created = 'CREATED',
  Deleted = 'DELETED',
  ExpirationUpdated = 'EXPIRATION_UPDATED',
  LocationUpdated = 'LOCATION_UPDATED',
  QuantityUpdated = 'QUANTITY_UPDATED',
}

/** Order by options for collaborators */
export type CollaboratorOrderBy = {
  invitedAt?: InputMaybe<SortOrder>;
  itemsAdded?: InputMaybe<SortOrder>;
  lastViewedAt?: InputMaybe<SortOrder>;
};

export enum CollaboratorRole {
  Admin = 'ADMIN',
  Contributor = 'CONTRIBUTOR',
  Editor = 'EDITOR',
  Owner = 'OWNER',
  Shopper = 'SHOPPER',
  Viewer = 'VIEWER',
}

export enum CollaboratorStatus {
  Active = 'ACTIVE',
  Left = 'LEFT',
  Pending = 'PENDING',
  Removed = 'REMOVED',
  Suspended = 'SUSPENDED',
}

export type CompatibleUnit = {
  __typename?: 'CompatibleUnit';
  conversionConfidence?: Maybe<Scalars['Float']['output']>;
  conversionRatio?: Maybe<Scalars['Float']['output']>;
  isConfigured: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  source?: Maybe<ConversionSource>;
  unit: Unit;
  usageContexts: Array<UnitUsageContext>;
};

export type CompleteShoppingListInput = {
  completedShopDate?: InputMaybe<Scalars['DateTime']['input']>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
};

export type ConfirmedIngredientConsumptionInput = {
  pantryItemId: Scalars['ID']['input'];
  quantity: Scalars['Float']['input'];
  recipeIngredientId: Scalars['ID']['input'];
  unitId: Scalars['ID']['input'];
};

/** Error when operation conflicts with existing data */
export type ConflictError = MutationError & {
  __typename?: 'ConflictError';
  code: Scalars['String']['output'];
  /** The field causing the conflict */
  conflictingField?: Maybe<Scalars['String']['output']>;
  /** The existing value causing the conflict */
  existingValue?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
};

export type Connection = {
  edges: Array<Edge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Relay-style cursor pagination input (for Connection types) */
export type ConnectionPaginationInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type ConsumptionFailure = {
  __typename?: 'ConsumptionFailure';
  availableQuantity: Scalars['Float']['output'];
  pantryItemId: Scalars['ID']['output'];
  reason: Scalars['String']['output'];
  recipeIngredientId: Scalars['ID']['output'];
  requestedQuantity: Scalars['Float']['output'];
};

/** Conversion availability result */
export type ConversionAvailability = {
  __typename?: 'ConversionAvailability';
  available: Scalars['Boolean']['output'];
  confidence: Scalars['Float']['output'];
  conversionType: ConversionType;
  notes?: Maybe<Scalars['String']['output']>;
  requiresItemContext: Scalars['Boolean']['output'];
};

/** Result of a unit conversion operation */
export type ConversionResult = {
  __typename?: 'ConversionResult';
  displayText: Scalars['String']['output'];
  unit: Unit;
  value: Scalars['Float']['output'];
};

/** Source of the unit conversion data */
export enum ConversionSource {
  Calculated = 'CALCULATED',
  Community = 'COMMUNITY',
  Kroger = 'KROGER',
  MlPredicted = 'ML_PREDICTED',
  Spoonacular = 'SPOONACULAR',
  Usda = 'USDA',
  UserDefined = 'USER_DEFINED',
}

/** Type of conversion being performed */
export enum ConversionType {
  CrossTypeDensityBased = 'CROSS_TYPE_DENSITY_BASED',
  CrossTypeItemSpecific = 'CROSS_TYPE_ITEM_SPECIFIC',
  NotPossible = 'NOT_POSSIBLE',
  SameTypeCustom = 'SAME_TYPE_CUSTOM',
  SameTypeStandard = 'SAME_TYPE_STANDARD',
}

export type ConvertedUnitValue = {
  __typename?: 'ConvertedUnitValue';
  conversionFactor: Scalars['Float']['output'];
  fromUnit: Unit;
  toUnit: Unit;
  value: Scalars['Float']['output'];
};

export type ConvertedValue = {
  __typename?: 'ConvertedValue';
  unit: Unit;
  value: Scalars['Float']['output'];
};

/** Cooking activity log - personal user data */
export type CookingLog = {
  __typename?: 'CookingLog';
  actualCookTime?: Maybe<Scalars['Int']['output']>;
  actualPrepTime?: Maybe<Scalars['Int']['output']>;
  cookedAt: Scalars['DateTime']['output'];
  deductionMethod?: Maybe<DeductionMethod>;
  difficulty?: Maybe<Difficulty>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  ingredientsUsed?: Maybe<Scalars['JSON']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  pantryDeducted: Scalars['Boolean']['output'];
  pantryItemsUsed: Array<PantryItemUsage>;
  rating?: Maybe<Scalars['Int']['output']>;
  recipe: Recipe;
  servingsMade?: Maybe<Scalars['Int']['output']>;
  user: User;
  wouldMakeAgain?: Maybe<Scalars['Boolean']['output']>;
};

export type CookingStats = {
  __typename?: 'CookingStats';
  averageRating?: Maybe<Scalars['Float']['output']>;
  favoriteRecipes: Array<Recipe>;
  recentCookingLogs: Array<CookingLog>;
  totalCookingSessions: Scalars['Int']['output'];
  totalRecipesCooked: Scalars['Int']['output'];
};

export type CreateBrandInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateCategoryInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  icon?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<CategoryType>;
  visibility?: InputMaybe<Visibility>;
};

export type CreateCookingLogInput = {
  actualCookTime?: InputMaybe<Scalars['Int']['input']>;
  actualPrepTime?: InputMaybe<Scalars['Int']['input']>;
  cookedAt?: InputMaybe<Scalars['DateTime']['input']>;
  difficulty?: InputMaybe<Difficulty>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  rating?: InputMaybe<Scalars['Int']['input']>;
  recipeId: Scalars['ID']['input'];
  servingsMade?: InputMaybe<Scalars['Int']['input']>;
  wouldMakeAgain?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateCurrencyInput = {
  code: Scalars['String']['input'];
  decimalPlaces: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  symbol: Scalars['String']['input'];
};

export type CreateDeviceInput = {
  androidId?: InputMaybe<Scalars['String']['input']>;
  apiLevel?: InputMaybe<Scalars['Int']['input']>;
  appVersion?: InputMaybe<Scalars['String']['input']>;
  availableLocationProviders?: InputMaybe<Scalars['JSON']['input']>;
  batteryLevel?: InputMaybe<Scalars['Float']['input']>;
  brand?: InputMaybe<Scalars['String']['input']>;
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  buildNumber?: InputMaybe<Scalars['String']['input']>;
  bundleId?: InputMaybe<Scalars['String']['input']>;
  carrier?: InputMaybe<Scalars['String']['input']>;
  deviceFingerprint?: InputMaybe<Scalars['String']['input']>;
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  firstInstallTime?: InputMaybe<Scalars['DateTime']['input']>;
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  hasDynamicIsland?: InputMaybe<Scalars['Boolean']['input']>;
  hasNotch?: InputMaybe<Scalars['Boolean']['input']>;
  hostNames?: InputMaybe<Scalars['JSON']['input']>;
  instanceId?: InputMaybe<Scalars['String']['input']>;
  iosVendorId?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isAirplaneMode?: InputMaybe<Scalars['Boolean']['input']>;
  isBatteryCharging?: InputMaybe<Scalars['Boolean']['input']>;
  isBluetoothHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isEmulator?: InputMaybe<Scalars['Boolean']['input']>;
  isHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isKeyboardConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isLocationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isMouseConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isTablet?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  isWiredHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  lastCity?: InputMaybe<Scalars['String']['input']>;
  lastCountry?: InputMaybe<Scalars['String']['input']>;
  lastIpAddress?: InputMaybe<Scalars['String']['input']>;
  lastUpdateTime?: InputMaybe<Scalars['DateTime']['input']>;
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  maxMemory?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  platform?: InputMaybe<MobilePlatform>;
  powerState?: InputMaybe<Scalars['JSON']['input']>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
  readableVersion?: InputMaybe<Scalars['String']['input']>;
  screenResolution?: InputMaybe<Scalars['String']['input']>;
  securityPatch?: InputMaybe<Scalars['String']['input']>;
  supportedAbis?: InputMaybe<Scalars['JSON']['input']>;
  supportedMediaTypes?: InputMaybe<Scalars['JSON']['input']>;
  systemVersion?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  totalDiskCapacity?: InputMaybe<Scalars['String']['input']>;
  totalMemory?: InputMaybe<Scalars['String']['input']>;
  usedMemory?: InputMaybe<Scalars['String']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type CreateFromTemplateInput = {
  name?: InputMaybe<Scalars['String']['input']>;
  plannedShopDate?: InputMaybe<Scalars['DateTime']['input']>;
  targetStoreId?: InputMaybe<Scalars['String']['input']>;
  templateId: Scalars['ID']['input'];
};

export type CreateHomeInput = {
  allowJoinCode?: InputMaybe<Scalars['Boolean']['input']>;
  createDefaultPantry?: InputMaybe<Scalars['Boolean']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  maxMembers?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<HomeType>;
};

export type CreateItemInput = {
  allergens?: InputMaybe<Scalars['JSON']['input']>;
  alternateUpcs?: InputMaybe<Array<Scalars['String']['input']>>;
  brandId?: InputMaybe<Scalars['String']['input']>;
  brandName?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<CategoryInput>>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  defaultUnit?: InputMaybe<Scalars['String']['input']>;
  density?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayUnitId?: InputMaybe<Scalars['String']['input']>;
  displayUnitName?: InputMaybe<Scalars['String']['input']>;
  externalSource?: InputMaybe<ExternalSource>;
  externalSourceData?: InputMaybe<Scalars['JSON']['input']>;
  externalSourceId?: InputMaybe<Scalars['String']['input']>;
  externalSourceType?: InputMaybe<Scalars['String']['input']>;
  externalSources?: InputMaybe<Array<ExternalSourceMappingInput>>;
  healthBenefits?: InputMaybe<Scalars['JSON']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  images?: InputMaybe<Scalars['JSON']['input']>;
  ingredients?: InputMaybe<Scalars['JSON']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  preferredTrackingUnitId?: InputMaybe<Scalars['String']['input']>;
  primaryUpc?: InputMaybe<Scalars['String']['input']>;
  servingSize?: InputMaybe<Scalars['Float']['input']>;
  servingSizeUnit?: InputMaybe<Scalars['String']['input']>;
  servingsPerPackage?: InputMaybe<Scalars['Int']['input']>;
  shelfLifeDays?: InputMaybe<Scalars['Int']['input']>;
  storageState?: InputMaybe<StorageState>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  type?: InputMaybe<ItemType>;
  units?: InputMaybe<Array<ItemUnitInput>>;
  vendor?: InputMaybe<Scalars['String']['input']>;
};

/** Result of creating an item - either success or specific error */
export type CreateItemResult =
  | DuplicateError
  | Item
  | UnauthorizedError
  | ValidationError;

export type CreateLoginHistoryInput = {
  apiClient?: InputMaybe<Scalars['String']['input']>;
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  campaign?: InputMaybe<Scalars['String']['input']>;
  deviceId?: InputMaybe<Scalars['ID']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  failureDetails?: InputMaybe<Scalars['String']['input']>;
  failureReason?: InputMaybe<LoginFailureReason>;
  ipAddress?: InputMaybe<Scalars['String']['input']>;
  ipCity?: InputMaybe<Scalars['String']['input']>;
  ipCountry?: InputMaybe<Scalars['String']['input']>;
  ipRegion?: InputMaybe<Scalars['String']['input']>;
  isApiLogin?: InputMaybe<Scalars['Boolean']['input']>;
  isAutomated?: InputMaybe<Scalars['Boolean']['input']>;
  isMobileApp?: InputMaybe<Scalars['Boolean']['input']>;
  isNewBrowser?: InputMaybe<Scalars['Boolean']['input']>;
  isNewDevice?: InputMaybe<Scalars['Boolean']['input']>;
  isNewLocation?: InputMaybe<Scalars['Boolean']['input']>;
  isProxy?: InputMaybe<Scalars['Boolean']['input']>;
  isRisky?: InputMaybe<Scalars['Boolean']['input']>;
  isTor?: InputMaybe<Scalars['Boolean']['input']>;
  isVpn?: InputMaybe<Scalars['Boolean']['input']>;
  landingPage?: InputMaybe<Scalars['String']['input']>;
  lastActivityAt?: InputMaybe<Scalars['DateTime']['input']>;
  loggedOutAt?: InputMaybe<Scalars['DateTime']['input']>;
  method?: InputMaybe<LoginMethod>;
  mfaCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  mfaMethod?: InputMaybe<MfaMethod>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  provider?: InputMaybe<Scalars['String']['input']>;
  referrer?: InputMaybe<Scalars['String']['input']>;
  requiresMfa?: InputMaybe<Scalars['Boolean']['input']>;
  riskFactors?: InputMaybe<Array<RiskFactor>>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  success: Scalars['Boolean']['input'];
  timezoneDiff?: InputMaybe<Scalars['Int']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

/** Input for creating a meal plan from a template */
export type CreateMealPlanFromTemplateInput = {
  /** Optional budget for the meal plan */
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  /** Optional dietary profile to link for nutrition tracking */
  dietaryProfileId?: InputMaybe<Scalars['ID']['input']>;
  /** Name for the new meal plan (defaults to template name + date) */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Override default servings from template */
  servings?: InputMaybe<Scalars['Int']['input']>;
  /** Start date for the new meal plan */
  startDate: Scalars['DateTime']['input'];
  templateId: Scalars['ID']['input'];
};

export type CreateMealPlanInput = {
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  /** Optional link to a dietary profile for nutrition goal tracking */
  dietaryProfileId?: InputMaybe<Scalars['ID']['input']>;
  endDate: Scalars['DateTime']['input'];
  name: Scalars['String']['input'];
  planType: MealPlanType;
  servings?: InputMaybe<Scalars['Int']['input']>;
  startDate: Scalars['DateTime']['input'];
};

export type CreateMealPlanItemInput = {
  /** Manual nutrition override - if not provided, will be pulled from recipe */
  calories?: InputMaybe<Scalars['Float']['input']>;
  carbs?: InputMaybe<Scalars['Float']['input']>;
  customMealName?: InputMaybe<Scalars['String']['input']>;
  date: Scalars['DateTime']['input'];
  estimatedCost?: InputMaybe<Scalars['Float']['input']>;
  fat?: InputMaybe<Scalars['Float']['input']>;
  mealPlanId: Scalars['ID']['input'];
  mealType: MealType;
  notes?: InputMaybe<Scalars['String']['input']>;
  protein?: InputMaybe<Scalars['Float']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateMealTemplateInput = {
  category?: InputMaybe<TemplateCategory>;
  defaultServings?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  durationDays?: InputMaybe<Scalars['Int']['input']>;
  /** Initial items to add to the template */
  items?: InputMaybe<Array<MealTemplateItemInput>>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateMembershipInput = {
  canAddItems?: InputMaybe<Scalars['Boolean']['input']>;
  canEditPantry?: InputMaybe<Scalars['Boolean']['input']>;
  canInviteOthers?: InputMaybe<Scalars['Boolean']['input']>;
  canManageHome?: InputMaybe<Scalars['Boolean']['input']>;
  canRemoveItems?: InputMaybe<Scalars['Boolean']['input']>;
  canViewPantry?: InputMaybe<Scalars['Boolean']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  homeId: Scalars['ID']['input'];
  role?: InputMaybe<MembershipRole>;
  userId: Scalars['ID']['input'];
};

export type CreateNotificationInput = {
  actionUrl?: InputMaybe<Scalars['String']['input']>;
  batchId?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  payload: Scalars['JSON']['input'];
  priority?: InputMaybe<Priority>;
  sourceId?: InputMaybe<Scalars['String']['input']>;
  sourceType?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<NotificationStatus>;
  title?: InputMaybe<Scalars['String']['input']>;
  type: NotificationType;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePantryActivityInput = {
  action: PantryActivityType;
  description: Scalars['String']['input'];
  itemName?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  newValue?: InputMaybe<Scalars['String']['input']>;
  oldValue?: InputMaybe<Scalars['String']['input']>;
  pantryId: Scalars['ID']['input'];
  quantity?: InputMaybe<Scalars['Float']['input']>;
  userId: Scalars['ID']['input'];
};

export type CreatePantryInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  homeId: Scalars['ID']['input'];
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  temperature?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePantryItemInput = {
  acquisitionMethod?: InputMaybe<AcquisitionMethod>;
  condition?: InputMaybe<ItemCondition>;
  costPerUnit?: InputMaybe<Scalars['Float']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  initialQuantity?: InputMaybe<Scalars['Float']['input']>;
  itemBrand?: InputMaybe<Scalars['String']['input']>;
  itemCategory?: InputMaybe<Scalars['String']['input']>;
  itemDescription?: InputMaybe<Scalars['String']['input']>;
  itemDisplayUnitId?: InputMaybe<Scalars['String']['input']>;
  itemId?: InputMaybe<Scalars['String']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  itemNetWeight?: InputMaybe<Scalars['Float']['input']>;
  itemUpc?: InputMaybe<Scalars['String']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  minQuantity?: InputMaybe<Scalars['Float']['input']>;
  packageWeight?: InputMaybe<Scalars['Float']['input']>;
  packageWeightUnitId?: InputMaybe<Scalars['String']['input']>;
  pantryId: Scalars['ID']['input'];
  purchaseId?: InputMaybe<Scalars['String']['input']>;
  restockQuantity?: InputMaybe<Scalars['Float']['input']>;
  storageLocationId?: InputMaybe<Scalars['String']['input']>;
  storageLocationName?: InputMaybe<Scalars['String']['input']>;
  storageNotes?: InputMaybe<Scalars['String']['input']>;
  storageState?: InputMaybe<StorageState>;
  storeId?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  unitSymbol?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePurchaseInput = {
  currencyId: Scalars['ID']['input'];
  discountAmount?: InputMaybe<Scalars['Float']['input']>;
  expirationDate?: InputMaybe<Scalars['DateTime']['input']>;
  itemId: Scalars['ID']['input'];
  originalPrice?: InputMaybe<Scalars['Float']['input']>;
  purchaseDate?: InputMaybe<Scalars['DateTime']['input']>;
  quantity: Scalars['Float']['input'];
  receiptNumber?: InputMaybe<Scalars['String']['input']>;
  shoppingListId?: InputMaybe<Scalars['ID']['input']>;
  shoppingListItemId?: InputMaybe<Scalars['ID']['input']>;
  storeId: Scalars['ID']['input'];
  totalPrice?: InputMaybe<Scalars['Float']['input']>;
  transactionId?: InputMaybe<Scalars['String']['input']>;
  unitId: Scalars['ID']['input'];
  unitPrice: Scalars['Float']['input'];
};

export type CreateRecipeInput = {
  caloriesPerServing?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<RecipeCategory>;
  cookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  cuisine?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  diets?: InputMaybe<Array<Diet>>;
  difficulty?: InputMaybe<Difficulty>;
  externalSourceData?: InputMaybe<Scalars['JSON']['input']>;
  externalSourceId?: InputMaybe<Scalars['String']['input']>;
  externalSourceUrl?: InputMaybe<Scalars['String']['input']>;
  healthGoals?: InputMaybe<Array<HealthGoal>>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  ingredients: Array<RecipeIngredientInput>;
  instructions: Scalars['JSON']['input'];
  intolerances?: InputMaybe<Array<Intolerance>>;
  isPublished?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  nutritionData?: InputMaybe<Scalars['JSON']['input']>;
  originalAuthor?: InputMaybe<Scalars['String']['input']>;
  prepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  sourceUrl?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<RecipeStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  tips?: InputMaybe<Scalars['String']['input']>;
  totalTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  videoUrl?: InputMaybe<Scalars['String']['input']>;
  visibility?: InputMaybe<Visibility>;
};

export type CreateShoppingListInput = {
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  homeId?: InputMaybe<Scalars['String']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateShoppingListItemInput = {
  addedContext?: InputMaybe<Scalars['String']['input']>;
  aisle?: InputMaybe<Scalars['String']['input']>;
  budgetPrice?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  estimatedPrice?: InputMaybe<Scalars['Float']['input']>;
  itemId?: InputMaybe<Scalars['String']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  preferredStoreId?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  recipeIngredientId?: InputMaybe<Scalars['ID']['input']>;
  shoppingListId: Scalars['ID']['input'];
  sortOrder?: InputMaybe<Scalars['String']['input']>;
  storeSection?: InputMaybe<Scalars['String']['input']>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
};

/** Input for creating a new storage location */
export type CreateStorageLocationInput = {
  /** Maximum capacity in specified units */
  capacity?: InputMaybe<Scalars['Float']['input']>;
  /** Unit of measurement for capacity */
  capacityUnit?: InputMaybe<Scalars['String']['input']>;
  /** Optional color code (hex format recommended) */
  color?: InputMaybe<Scalars['String']['input']>;
  /** Optional description or notes */
  description?: InputMaybe<Scalars['String']['input']>;
  /** ID of the home this location belongs to */
  homeId: Scalars['ID']['input'];
  /** Optional icon identifier */
  icon?: InputMaybe<Scalars['String']['input']>;
  /** Whether the location has climate control (default: false) */
  isClimateControlled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Set as default location for the home (default: false) */
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  /** Display name for the location */
  name: Scalars['String']['input'];
  /** Optional parent location ID for nested locations */
  parentLocationId?: InputMaybe<Scalars['ID']['input']>;
  /** Sort order (default: 0) */
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  /** Temperature state of the location */
  temperature?: InputMaybe<StorageState>;
  /** Type of storage location */
  type: StorageType;
};

export type CreateStoreInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  averageShelfLife?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  priceAccuracy?: InputMaybe<Scalars['Float']['input']>;
  qualityRating?: InputMaybe<Scalars['Float']['input']>;
  supportsPriceAPI?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Input for creating a template from an existing meal plan */
export type CreateTemplateFromMealPlanInput = {
  category?: InputMaybe<TemplateCategory>;
  description?: InputMaybe<Scalars['String']['input']>;
  mealPlanId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateUnitInput = {
  baseUnitId?: InputMaybe<Scalars['String']['input']>;
  conversionFactor?: InputMaybe<Scalars['Float']['input']>;
  isCommon?: InputMaybe<Scalars['Boolean']['input']>;
  isMetric?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  symbol: Scalars['String']['input'];
  type: UnitType;
};

export type CreateUserAddressInput = {
  city: Scalars['String']['input'];
  country: Scalars['String']['input'];
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  postalCode: Scalars['String']['input'];
  state: Scalars['String']['input'];
  street: Scalars['String']['input'];
};

export type CreateUserModerationInput = {
  moderatorNotes?: InputMaybe<Scalars['String']['input']>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
  status?: InputMaybe<ModerationStatus>;
  trustLevel?: InputMaybe<TrustLevel>;
  userId: Scalars['ID']['input'];
};

export type CreateUserProfileInput = {
  bio?: InputMaybe<Scalars['String']['input']>;
  dateOfBirth?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  gender?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  profileVisibility?: InputMaybe<ProfileVisibility>;
  showEmail?: InputMaybe<Scalars['Boolean']['input']>;
  showPhone?: InputMaybe<Scalars['Boolean']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
};

export enum Cuisine {
  African = 'AFRICAN',
  American = 'AMERICAN',
  British = 'BRITISH',
  Cajun = 'CAJUN',
  Caribbean = 'CARIBBEAN',
  Chinese = 'CHINESE',
  EasternEuropean = 'EASTERN_EUROPEAN',
  French = 'FRENCH',
  German = 'GERMAN',
  Greek = 'GREEK',
  Indian = 'INDIAN',
  Irish = 'IRISH',
  Italian = 'ITALIAN',
  Japanese = 'JAPANESE',
  Jewish = 'JEWISH',
  Korean = 'KOREAN',
  LatinAmerican = 'LATIN_AMERICAN',
  Mediterranean = 'MEDITERRANEAN',
  Mexican = 'MEXICAN',
  MiddleEastern = 'MIDDLE_EASTERN',
  Nordic = 'NORDIC',
  Southern = 'SOUTHERN',
  Spanish = 'SPANISH',
  Thai = 'THAI',
  Vietnamese = 'VIETNAMESE',
}

/**
 * Currency type for price information
 * Cache: 2 hours - currency definitions are static reference data
 */
export type Currency = {
  __typename?: 'Currency';
  code: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  decimalPlaces: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export enum DataSource {
  Api = 'API',
  BarcodeScan = 'BARCODE_SCAN',
  Import = 'IMPORT',
  Kroger = 'KROGER',
  Manual = 'MANUAL',
  Spoonacular = 'SPOONACULAR',
  Usda = 'USDA',
}

export enum DateRange {
  Custom = 'CUSTOM',
  LastMonth = 'LAST_MONTH',
  LastQuarter = 'LAST_QUARTER',
  LastWeek = 'LAST_WEEK',
  LastYear = 'LAST_YEAR',
  Today = 'TODAY',
  Yesterday = 'YESTERDAY',
}

export type DateRangeInput = {
  end: Scalars['DateTime']['input'];
  endDate: Scalars['DateTime']['input'];
  start: Scalars['DateTime']['input'];
  startDate: Scalars['DateTime']['input'];
};

/** Method used to deduct ingredients from pantry */
export enum DeductionMethod {
  Automatic = 'AUTOMATIC',
  Manual = 'MANUAL',
  RecipeBased = 'RECIPE_BASED',
}

/** Result of deleting an item */
export type DeleteItemResult =
  | DeleteSuccess
  | NotFoundError
  | UnauthorizedError;

/** Success response for delete operations */
export type DeleteSuccess = {
  __typename?: 'DeleteSuccess';
  /** ID of the deleted resource */
  id: Scalars['ID']['output'];
  /** Whether the deletion was successful */
  success: Scalars['Boolean']['output'];
};

/** Input for deleted device cleanup */
export type DeletedDeviceCleanupInput = {
  olderThanDays?: InputMaybe<Scalars['Int']['input']>;
};

export type DeletionBlocker = {
  __typename?: 'DeletionBlocker';
  message: Scalars['String']['output'];
  resourceId: Scalars['ID']['output'];
  resourceName: Scalars['String']['output'];
  type: DeletionBlockerType;
};

export enum DeletionBlockerType {
  HomeOwnership = 'HOME_OWNERSHIP',
  Other = 'OTHER',
  ShoppingList = 'SHOPPING_LIST',
}

/** User device information - contains sensitive device fingerprinting data */
export type Device = {
  __typename?: 'Device';
  androidId?: Maybe<Scalars['String']['output']>;
  apiLevel?: Maybe<Scalars['Int']['output']>;
  appVersion?: Maybe<Scalars['String']['output']>;
  availableLocationProviders?: Maybe<Scalars['String']['output']>;
  batteryLevel?: Maybe<Scalars['Float']['output']>;
  brand?: Maybe<Scalars['String']['output']>;
  browserName?: Maybe<Scalars['String']['output']>;
  browserVersion?: Maybe<Scalars['String']['output']>;
  buildNumber?: Maybe<Scalars['String']['output']>;
  bundleId?: Maybe<Scalars['String']['output']>;
  carrier?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deviceId: Scalars['String']['output'];
  deviceName?: Maybe<Scalars['String']['output']>;
  deviceType: DeviceType;
  freeDiskStorage?: Maybe<Scalars['String']['output']>;
  hasDynamicIsland?: Maybe<Scalars['Boolean']['output']>;
  hasNotch?: Maybe<Scalars['Boolean']['output']>;
  hostNames?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  instanceId?: Maybe<Scalars['String']['output']>;
  isActive: Scalars['Boolean']['output'];
  isAirplaneMode?: Maybe<Scalars['Boolean']['output']>;
  isBatteryCharging?: Maybe<Scalars['Boolean']['output']>;
  isBluetoothHeadphonesConnected?: Maybe<Scalars['Boolean']['output']>;
  isEmulator?: Maybe<Scalars['Boolean']['output']>;
  isHeadphonesConnected?: Maybe<Scalars['Boolean']['output']>;
  isKeyboardConnected?: Maybe<Scalars['Boolean']['output']>;
  isLocationEnabled?: Maybe<Scalars['Boolean']['output']>;
  isMouseConnected?: Maybe<Scalars['Boolean']['output']>;
  isTablet?: Maybe<Scalars['Boolean']['output']>;
  isTrusted: Scalars['Boolean']['output'];
  isVerified: Scalars['Boolean']['output'];
  isWiredHeadphonesConnected?: Maybe<Scalars['Boolean']['output']>;
  language?: Maybe<Scalars['String']['output']>;
  lastLoginAt?: Maybe<Scalars['DateTime']['output']>;
  lastSeenAt: Scalars['DateTime']['output'];
  loginCount: Scalars['Int']['output'];
  manufacturer?: Maybe<Scalars['String']['output']>;
  maxMemory?: Maybe<Scalars['String']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  osName?: Maybe<Scalars['String']['output']>;
  osVersion?: Maybe<Scalars['String']['output']>;
  platform?: Maybe<MobilePlatform>;
  powerState?: Maybe<Scalars['String']['output']>;
  pushToken?: Maybe<Scalars['String']['output']>;
  readableVersion?: Maybe<Scalars['String']['output']>;
  screenResolution?: Maybe<Scalars['String']['output']>;
  supportedAbis?: Maybe<Scalars['String']['output']>;
  supportedMediaTypes?: Maybe<Scalars['String']['output']>;
  systemVersion?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
  totalDiskCapacity?: Maybe<Scalars['String']['output']>;
  totalMemory?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  usedMemory?: Maybe<Scalars['String']['output']>;
  user?: Maybe<User>;
  userAgent?: Maybe<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
  verifiedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type DeviceActivity = {
  __typename?: 'DeviceActivity';
  deviceName?: Maybe<Scalars['String']['output']>;
  deviceType: DeviceType;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isTrusted: Scalars['Boolean']['output'];
  lastSeenAt: Scalars['DateTime']['output'];
  loginCount: Scalars['Int']['output'];
};

export type DeviceBreakdown = {
  __typename?: 'DeviceBreakdown';
  browsers: Array<BrowserStat>;
  deviceTypes: Array<DeviceTypeStat>;
  operatingSystems: Array<OperatingSystemStat>;
  platforms: Array<PlatformStat>;
};

/** Input for device cleanup operations */
export type DeviceCleanupInput = {
  /** Clean up soft-deleted devices older than X days */
  deletedDevices?: InputMaybe<DeletedDeviceCleanupInput>;
  /** Clean up stale devices (not seen for X days) */
  staleDevices?: InputMaybe<StaleDeviceCleanupInput>;
};

/** Result of device cleanup operation */
export type DeviceCleanupResult = {
  __typename?: 'DeviceCleanupResult';
  deletedDevicesRemoved?: Maybe<Scalars['Int']['output']>;
  staleDevicesRemoved?: Maybe<Scalars['Int']['output']>;
  success: Scalars['Boolean']['output'];
  totalRemoved: Scalars['Int']['output'];
};

/** Device connection for pagination */
export type DeviceConnection = {
  __typename?: 'DeviceConnection';
  edges: Array<DeviceEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Input for device count query */
export type DeviceCountInput = {
  deviceType?: InputMaybe<DeviceType>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  platform?: InputMaybe<MobilePlatform>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

/** Device edge for pagination */
export type DeviceEdge = {
  __typename?: 'DeviceEdge';
  cursor: Scalars['String']['output'];
  node: Device;
};

export type DeviceFiltersInput = {
  activeOnly?: InputMaybe<Scalars['Boolean']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  orderBy?: InputMaybe<SortOrder>;
  platform?: InputMaybe<MobilePlatform>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  trustedOnly?: InputMaybe<Scalars['Boolean']['input']>;
  verifiedOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DeviceHardwareInfoInput = {
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  maxMemory?: InputMaybe<Scalars['String']['input']>;
  totalDiskCapacity?: InputMaybe<Scalars['String']['input']>;
  totalMemory?: InputMaybe<Scalars['String']['input']>;
  usedMemory?: InputMaybe<Scalars['String']['input']>;
};

export type DeviceLocationInput = {
  lastCity?: InputMaybe<Scalars['String']['input']>;
  lastCountry?: InputMaybe<Scalars['String']['input']>;
  lastIpAddress?: InputMaybe<Scalars['String']['input']>;
};

export type DevicePeripheralsInput = {
  isBluetoothHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isKeyboardConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isMouseConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isWiredHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DeviceRegistrationInput = {
  androidId?: InputMaybe<Scalars['String']['input']>;
  apiLevel?: InputMaybe<Scalars['Int']['input']>;
  appVersion?: InputMaybe<Scalars['String']['input']>;
  availableLocationProviders?: InputMaybe<Scalars['JSON']['input']>;
  batteryLevel?: InputMaybe<Scalars['Float']['input']>;
  brand?: InputMaybe<Scalars['String']['input']>;
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  buildNumber?: InputMaybe<Scalars['String']['input']>;
  bundleId?: InputMaybe<Scalars['String']['input']>;
  carrier?: InputMaybe<Scalars['String']['input']>;
  deviceFingerprint?: InputMaybe<Scalars['String']['input']>;
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  firstInstallTime?: InputMaybe<Scalars['DateTime']['input']>;
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  hasDynamicIsland?: InputMaybe<Scalars['Boolean']['input']>;
  hasNotch?: InputMaybe<Scalars['Boolean']['input']>;
  hostNames?: InputMaybe<Scalars['JSON']['input']>;
  instanceId?: InputMaybe<Scalars['String']['input']>;
  iosVendorId?: InputMaybe<Scalars['String']['input']>;
  isAirplaneMode?: InputMaybe<Scalars['Boolean']['input']>;
  isBatteryCharging?: InputMaybe<Scalars['Boolean']['input']>;
  isBluetoothHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isEmulator?: InputMaybe<Scalars['Boolean']['input']>;
  isHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isKeyboardConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isLocationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isMouseConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isTablet?: InputMaybe<Scalars['Boolean']['input']>;
  isWiredHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  lastCity?: InputMaybe<Scalars['String']['input']>;
  lastCountry?: InputMaybe<Scalars['String']['input']>;
  lastIpAddress?: InputMaybe<Scalars['String']['input']>;
  lastUpdateTime?: InputMaybe<Scalars['DateTime']['input']>;
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  maxMemory?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  platform?: InputMaybe<MobilePlatform>;
  powerState?: InputMaybe<Scalars['JSON']['input']>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
  readableVersion?: InputMaybe<Scalars['String']['input']>;
  screenResolution?: InputMaybe<Scalars['String']['input']>;
  securityPatch?: InputMaybe<Scalars['String']['input']>;
  supportedAbis?: InputMaybe<Scalars['JSON']['input']>;
  supportedMediaTypes?: InputMaybe<Scalars['JSON']['input']>;
  systemVersion?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  totalDiskCapacity?: InputMaybe<Scalars['String']['input']>;
  totalMemory?: InputMaybe<Scalars['String']['input']>;
  usedMemory?: InputMaybe<Scalars['String']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
};

/** Sort field options for devices */
export enum DeviceSortField {
  CreatedAt = 'CREATED_AT',
  DeviceName = 'DEVICE_NAME',
  LastLoginAt = 'LAST_LOGIN_AT',
  LastSeenAt = 'LAST_SEEN_AT',
}

export type DeviceStat = {
  __typename?: 'DeviceStat';
  count: Scalars['Int']['output'];
  userAgent: Scalars['String']['output'];
};

export type DeviceStats = {
  __typename?: 'DeviceStats';
  breakdown: DeviceBreakdown;
  recentActivity: Array<DeviceActivity>;
  summary: DeviceSummary;
};

export type DeviceSummary = {
  __typename?: 'DeviceSummary';
  activeDevices: Scalars['Int']['output'];
  mobileDevices: Scalars['Int']['output'];
  staleDevices: Scalars['Int']['output'];
  totalDevices: Scalars['Int']['output'];
  trustedDevices: Scalars['Int']['output'];
  verifiedDevices: Scalars['Int']['output'];
};

export enum DeviceType {
  Desktop = 'DESKTOP',
  Mobile = 'MOBILE',
  Tablet = 'TABLET',
  Tv = 'TV',
  Unknown = 'UNKNOWN',
  Watch = 'WATCH',
}

export type DeviceTypeStat = {
  __typename?: 'DeviceTypeStat';
  count: Scalars['Int']['output'];
  deviceType: DeviceType;
};

/**
 * Comprehensive input for querying devices with filtering, pagination, and sorting.
 * If userId is not provided, returns current user's devices.
 */
export type DevicesQueryInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  batteryLevelBelow?: InputMaybe<Scalars['Float']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  first?: InputMaybe<Scalars['Int']['input']>;
  hasPeripherals?: InputMaybe<Scalars['Boolean']['input']>;
  inactiveDays?: InputMaybe<Scalars['Int']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isEmulated?: InputMaybe<Scalars['Boolean']['input']>;
  isSuspicious?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<DeviceSortField>;
  orderDirection?: InputMaybe<SortOrder>;
  platform?: InputMaybe<MobilePlatform>;
  search?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export enum Diet {
  GlutenFree = 'GLUTEN_FREE',
  Keto = 'KETO',
  LactoVegetarian = 'LACTO_VEGETARIAN',
  LowFodmap = 'LOW_FODMAP',
  OvoVegetarian = 'OVO_VEGETARIAN',
  Paleo = 'PALEO',
  Pescetarian = 'PESCETARIAN',
  Primal = 'PRIMAL',
  Vegan = 'VEGAN',
  Vegetarian = 'VEGETARIAN',
  Whole30 = 'WHOLE30',
}

export type DietaryProfile = {
  __typename?: 'DietaryProfile';
  budgetPerMeal?: Maybe<Scalars['Float']['output']>;
  calorieTarget?: Maybe<Scalars['Int']['output']>;
  carbsTarget?: Maybe<Scalars['Int']['output']>;
  cookingSkillLevel?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dislikedIngredients: Array<Scalars['String']['output']>;
  fatTarget?: Maybe<Scalars['Int']['output']>;
  favoriteIngredients: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  maxCookTimeMinutes?: Maybe<Scalars['Int']['output']>;
  maxPrepTimeMinutes?: Maybe<Scalars['Int']['output']>;
  mealsPerDay: Scalars['Int']['output'];
  preferredCuisines: Array<Scalars['String']['output']>;
  proteinTarget?: Maybe<Scalars['Int']['output']>;
  restrictions: Array<DietaryRestriction>;
  snacksPerDay: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['String']['output'];
};

export type DietaryRestriction = {
  __typename?: 'DietaryRestriction';
  appliesToHomeId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  diet?: Maybe<Diet>;
  dietaryProfile: DietaryProfile;
  dietaryProfileId: Scalars['String']['output'];
  healthGoal?: Maybe<HealthGoal>;
  id: Scalars['ID']['output'];
  intolerance?: Maybe<Intolerance>;
  notes?: Maybe<Scalars['String']['output']>;
  severity: RestrictionSeverity;
  updatedAt: Scalars['DateTime']['output'];
};

export enum Difficulty {
  Easy = 'EASY',
  Expert = 'EXPERT',
  Hard = 'HARD',
  Medium = 'MEDIUM',
  VeryEasy = 'VERY_EASY',
}

export type DismissNotificationInput = {
  notificationId: Scalars['ID']['input'];
};

/** Display format for quantities */
export enum DisplayFormat {
  Auto = 'AUTO',
  Decimal = 'DECIMAL',
  Fraction = 'FRACTION',
  Mixed = 'MIXED',
}

/** Error when a duplicate resource already exists */
export type DuplicateError = MutationError & {
  __typename?: 'DuplicateError';
  code: Scalars['String']['output'];
  /** ID of the existing resource (if available) */
  existingId?: Maybe<Scalars['ID']['output']>;
  /** The field that has a duplicate value */
  field: Scalars['String']['output'];
  message: Scalars['String']['output'];
  /** The duplicate value */
  value?: Maybe<Scalars['String']['output']>;
};

export type Edge = {
  cursor: Scalars['String']['output'];
  node: Node;
};

export enum ExpirationAction {
  Consumed = 'CONSUMED',
  Cooked = 'COOKED',
  Extended = 'EXTENDED',
  NoAction = 'NO_ACTION',
  Shared = 'SHARED',
  Waste = 'WASTE',
}

export enum ExpirationFrequency {
  DailyEvening = 'DAILY_EVENING',
  DailyMorning = 'DAILY_MORNING',
  Never = 'NEVER',
  RealTime = 'REAL_TIME',
  WeeklyDigest = 'WEEKLY_DIGEST',
}

export type ExpirationNotification = {
  __typename?: 'ExpirationNotification';
  actionAt?: Maybe<Scalars['DateTime']['output']>;
  actionTaken?: Maybe<ExpirationAction>;
  batchId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  daysUntilExpiry: Scalars['Int']['output'];
  dismissedAt?: Maybe<Scalars['DateTime']['output']>;
  expiresAt: Scalars['DateTime']['output'];
  genericNotification?: Maybe<Notification>;
  genericNotificationId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isBatched: Scalars['Boolean']['output'];
  notificationType: ExpirationNotificationType;
  pantryItem: PantryItem;
  pantryItemId: Scalars['String']['output'];
  readAt?: Maybe<Scalars['DateTime']['output']>;
  sentAt?: Maybe<Scalars['DateTime']['output']>;
  status: NotificationDeliveryStatus;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['String']['output'];
};

export enum ExpirationNotificationType {
  ExpiredReminder = 'EXPIRED_REMINDER',
  ExpiresIn_3Days = 'EXPIRES_IN_3_DAYS',
  ExpiresIn_7Days = 'EXPIRES_IN_7_DAYS',
  ExpiresToday = 'EXPIRES_TODAY',
  ExpiresTomorrow = 'EXPIRES_TOMORROW',
  WeeklyDigest = 'WEEKLY_DIGEST',
}

export enum ExportFormat {
  Csv = 'CSV',
  Excel = 'EXCEL',
  Json = 'JSON',
}

export type ExportResponse = {
  __typename?: 'ExportResponse';
  expiresAt: Scalars['DateTime']['output'];
  format: ExportFormat;
  rowCount: Scalars['Int']['output'];
  url: Scalars['String']['output'];
};

export enum ExternalSource {
  Allrecipes = 'ALLRECIPES',
  BarcodeLookup = 'BARCODE_LOOKUP',
  Edamam = 'EDAMAM',
  Kroger = 'KROGER',
  Openfoodfacts = 'OPENFOODFACTS',
  Spoonacular = 'SPOONACULAR',
  Tasty = 'TASTY',
  Usda = 'USDA',
  UserCreated = 'USER_CREATED',
}

export type ExternalSourceMapping = {
  __typename?: 'ExternalSourceMapping';
  allergens?: Maybe<Scalars['JSON']['output']>;
  availability?: Maybe<Scalars['JSON']['output']>;
  brandInfo?: Maybe<Scalars['JSON']['output']>;
  categories?: Maybe<Scalars['JSON']['output']>;
  confidence?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  data?: Maybe<Scalars['JSON']['output']>;
  externalDescription?: Maybe<Scalars['String']['output']>;
  externalId: Scalars['String']['output'];
  externalName?: Maybe<Scalars['String']['output']>;
  externalType?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifiers?: Maybe<Scalars['JSON']['output']>;
  images?: Maybe<Scalars['JSON']['output']>;
  isPrimary: Scalars['Boolean']['output'];
  item: Item;
  lastSyncedAt: Scalars['DateTime']['output'];
  location?: Maybe<Scalars['JSON']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  netWeight?: Maybe<Scalars['Float']['output']>;
  netWeightUnit?: Maybe<Scalars['String']['output']>;
  nutritionData?: Maybe<Scalars['JSON']['output']>;
  packageSize?: Maybe<Scalars['String']['output']>;
  pricing?: Maybe<Scalars['JSON']['output']>;
  retailInfo?: Maybe<Scalars['JSON']['output']>;
  source: ExternalSource;
  storage?: Maybe<Scalars['JSON']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type ExternalSourceMappingInput = {
  allergens?: InputMaybe<Scalars['JSON']['input']>;
  availability?: InputMaybe<Scalars['JSON']['input']>;
  brandInfo?: InputMaybe<Scalars['JSON']['input']>;
  categories?: InputMaybe<Scalars['JSON']['input']>;
  confidence?: InputMaybe<Scalars['Float']['input']>;
  data?: InputMaybe<Scalars['JSON']['input']>;
  externalDescription?: InputMaybe<Scalars['String']['input']>;
  externalId: Scalars['String']['input'];
  externalName?: InputMaybe<Scalars['String']['input']>;
  externalType?: InputMaybe<Scalars['String']['input']>;
  identifiers?: InputMaybe<Scalars['JSON']['input']>;
  images?: InputMaybe<Scalars['JSON']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['JSON']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  netWeightUnit?: InputMaybe<Scalars['String']['input']>;
  nutritionData?: InputMaybe<Scalars['JSON']['input']>;
  packageSize?: InputMaybe<Scalars['String']['input']>;
  pricing?: InputMaybe<Scalars['JSON']['input']>;
  retailInfo?: InputMaybe<Scalars['JSON']['input']>;
  source: ExternalSource;
  storage?: InputMaybe<Scalars['JSON']['input']>;
};

export type FacetValue = {
  __typename?: 'FacetValue';
  count: Scalars['Int']['output'];
  label: Scalars['String']['output'];
  selected?: Maybe<Scalars['Boolean']['output']>;
  value: Scalars['String']['output'];
};

export type FailedIpStat = {
  __typename?: 'FailedIPStat';
  count: Scalars['Int']['output'];
  ipAddress?: Maybe<Scalars['String']['output']>;
};

export type FavoriteRecipeInput = {
  folder?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId: Scalars['ID']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type ForgotPasswordResponse = {
  __typename?: 'ForgotPasswordResponse';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type GetExpirationNotificationsInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  pantryItemId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<NotificationDeliveryStatus>;
};

/** Progress toward a single nutrition goal */
export type GoalProgress = {
  __typename?: 'GoalProgress';
  current: Scalars['Float']['output'];
  percentage: Scalars['Float']['output'];
  status: GoalStatus;
  target: Scalars['Float']['output'];
};

/** Status relative to nutrition target */
export enum GoalStatus {
  OnTarget = 'ON_TARGET',
  OverTarget = 'OVER_TARGET',
  UnderTarget = 'UNDER_TARGET',
}

export enum HealthBenefitCategory {
  Dietary = 'DIETARY',
  Fitness = 'FITNESS',
  Medical = 'MEDICAL',
  Nutritional = 'NUTRITIONAL',
  Wellness = 'WELLNESS',
}

export type HealthBenefitInput = {
  benefit: Scalars['String']['input'];
  category?: InputMaybe<HealthBenefitCategory>;
  confidenceLevel?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  scientificEvidence?: InputMaybe<Scalars['String']['input']>;
};

export enum HealthGoal {
  DiabeticFriendly = 'DIABETIC_FRIENDLY',
  HeartHealthy = 'HEART_HEALTHY',
  HighProtein = 'HIGH_PROTEIN',
  LowCarb = 'LOW_CARB',
  LowSodium = 'LOW_SODIUM',
  SugarFree = 'SUGAR_FREE',
}

/**
 * Home/household for managing pantries and shopping lists
 * Cache: 5 minutes - metadata changes occasionally
 */
export type Home = {
  __typename?: 'Home';
  allowJoinCode: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  invitesConnection: HomeInviteConnection;
  isPublic: Scalars['Boolean']['output'];
  joinCode?: Maybe<Scalars['String']['output']>;
  maxMembers?: Maybe<Scalars['Int']['output']>;
  membersConnection: MembershipConnection;
  metadata?: Maybe<Scalars['JSON']['output']>;
  myMembership?: Maybe<Membership>;
  name: Scalars['String']['output'];
  pantriesConnection: PantryConnection;
  shoppingListsConnection: ShoppingListConnection;
  tags: Array<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
  type: HomeType;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

/**
 * Home/household for managing pantries and shopping lists
 * Cache: 5 minutes - metadata changes occasionally
 */
export type HomeInvitesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Home/household for managing pantries and shopping lists
 * Cache: 5 minutes - metadata changes occasionally
 */
export type HomeMembersConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Home/household for managing pantries and shopping lists
 * Cache: 5 minutes - metadata changes occasionally
 */
export type HomePantriesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Home/household for managing pantries and shopping lists
 * Cache: 5 minutes - metadata changes occasionally
 */
export type HomeShoppingListsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<ShoppingListFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type HomeInvite = {
  __typename?: 'HomeInvite';
  acceptedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  customPermissions?: Maybe<HomePermissions>;
  declinedAt?: Maybe<Scalars['DateTime']['output']>;
  email: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
  home: Home;
  homeId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  invitedUser?: Maybe<User>;
  invitedUserId?: Maybe<Scalars['String']['output']>;
  inviter: User;
  lastReminderAt?: Maybe<Scalars['DateTime']['output']>;
  logs: Array<InviteLog>;
  message?: Maybe<Scalars['String']['output']>;
  recipientName?: Maybe<Scalars['String']['output']>;
  reminderCount: Scalars['Int']['output'];
  revokedAt?: Maybe<Scalars['DateTime']['output']>;
  role: MembershipRole;
  sentAt: Scalars['DateTime']['output'];
  status: InviteStatus;
  token: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type HomeInviteLogsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type HomeInviteConnection = {
  __typename?: 'HomeInviteConnection';
  edges: Array<HomeInviteEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Home invite connection for pagination */
export type HomeInviteEdge = {
  __typename?: 'HomeInviteEdge';
  cursor: Scalars['String']['output'];
  node: HomeInvite;
};

export type HomeInviteStatsGroup = {
  __typename?: 'HomeInviteStatsGroup';
  _count: InviteActionCount;
  action: InviteAction;
};

export type HomeOwnership = {
  __typename?: 'HomeOwnership';
  createdAt: Scalars['DateTime']['output'];
  home: Home;
  homeId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  transferredAt?: Maybe<Scalars['DateTime']['output']>;
  transferredFrom?: Maybe<Scalars['String']['output']>;
  user: User;
  userId: Scalars['String']['output'];
};

/** Custom permissions that can override default role permissions */
export type HomePermissions = {
  __typename?: 'HomePermissions';
  canAddItems?: Maybe<Scalars['Boolean']['output']>;
  canEditPantry?: Maybe<Scalars['Boolean']['output']>;
  canInviteOthers?: Maybe<Scalars['Boolean']['output']>;
  canManageHome?: Maybe<Scalars['Boolean']['output']>;
  canRemoveItems?: Maybe<Scalars['Boolean']['output']>;
  canViewPantry?: Maybe<Scalars['Boolean']['output']>;
};

export enum HomeType {
  Boat = 'BOAT',
  Household = 'HOUSEHOLD',
  Office = 'OFFICE',
  Other = 'OTHER',
  Personal = 'PERSONAL',
  Vacation = 'VACATION',
}

export type IpStat = {
  __typename?: 'IPStat';
  count: Scalars['Int']['output'];
  ipAddress: Scalars['String']['output'];
};

export type ImageInput = {
  format?: InputMaybe<Scalars['String']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  kind?: InputMaybe<ImageKind>;
  url: Scalars['String']['input'];
  width?: InputMaybe<Scalars['Int']['input']>;
};

export enum ImageKind {
  Barcode = 'BARCODE',
  Gallery = 'GALLERY',
  IngredientList = 'INGREDIENT_LIST',
  Main = 'MAIN',
  NutritionLabel = 'NUTRITION_LABEL',
  Size_128 = 'SIZE_128',
  Size_256 = 'SIZE_256',
  Size_512 = 'SIZE_512',
  Thumbnail = 'THUMBNAIL',
}

export enum ImageUploadPurpose {
  ItemImage = 'ITEM_IMAGE',
  PantryItemPhoto = 'PANTRY_ITEM_PHOTO',
  ProfileAvatar = 'PROFILE_AVATAR',
  ProfileCover = 'PROFILE_COVER',
}

export type ImportItemsFromProviderInput = {
  categoryUrl?: InputMaybe<Scalars['String']['input']>;
  dryRun?: InputMaybe<Scalars['Boolean']['input']>;
  filters?: InputMaybe<ProviderFilters>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  productIds?: InputMaybe<Array<Scalars['String']['input']>>;
  provider: ProviderType;
  searchQuery?: InputMaybe<Scalars['String']['input']>;
};

export type ImportItemsResponse = {
  __typename?: 'ImportItemsResponse';
  errors: Array<ItemError>;
  executionTime?: Maybe<Scalars['Float']['output']>;
  failed: Scalars['Int']['output'];
  imported: Scalars['Int']['output'];
  items: Array<Item>;
  providerMetadata?: Maybe<Scalars['JSON']['output']>;
  updated: Scalars['Int']['output'];
};

/** Input for ingredient data */
export type IngredientInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isAllergen?: InputMaybe<Scalars['Boolean']['input']>;
  isGMO?: InputMaybe<Scalars['Boolean']['input']>;
  isOrganic?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Int']['input']>;
  percentage?: InputMaybe<Scalars['Float']['input']>;
  subIngredients?: InputMaybe<Array<IngredientInput>>;
  unit?: InputMaybe<Scalars['String']['input']>;
};

/** Input for ingredient usage when marking recipe as cooked */
export type IngredientUsageInput = {
  actualQuantity: Scalars['Float']['input'];
  actualUnitId: Scalars['ID']['input'];
  recipeIngredientId: Scalars['ID']['input'];
};

export enum Intolerance {
  Dairy = 'DAIRY',
  Egg = 'EGG',
  Fish = 'FISH',
  Gluten = 'GLUTEN',
  Grain = 'GRAIN',
  Peanut = 'PEANUT',
  Seafood = 'SEAFOOD',
  Sesame = 'SESAME',
  Shellfish = 'SHELLFISH',
  Soy = 'SOY',
  Sulfite = 'SULFITE',
  TreeNut = 'TREE_NUT',
  Wheat = 'WHEAT',
}

export enum InviteAction {
  InviteAccepted = 'INVITE_ACCEPTED',
  InviteDeclined = 'INVITE_DECLINED',
  InviteExpired = 'INVITE_EXPIRED',
  InviteRevoked = 'INVITE_REVOKED',
  InviteSent = 'INVITE_SENT',
  InviteViewed = 'INVITE_VIEWED',
  PermissionsUpdated = 'PERMISSIONS_UPDATED',
  ReminderSent = 'REMINDER_SENT',
  StatusChanged = 'STATUS_CHANGED',
}

export type InviteActionCount = {
  __typename?: 'InviteActionCount';
  action: Scalars['Int']['output'];
};

export type InviteActionStats = {
  __typename?: 'InviteActionStats';
  INVITE_ACCEPTED?: Maybe<Scalars['Int']['output']>;
  INVITE_CANCELLED?: Maybe<Scalars['Int']['output']>;
  INVITE_CREATED?: Maybe<Scalars['Int']['output']>;
  INVITE_DECLINED?: Maybe<Scalars['Int']['output']>;
  INVITE_EXPIRED?: Maybe<Scalars['Int']['output']>;
  INVITE_RESENT?: Maybe<Scalars['Int']['output']>;
  INVITE_SENT?: Maybe<Scalars['Int']['output']>;
  INVITE_VIEWED?: Maybe<Scalars['Int']['output']>;
};

export type InviteLog = {
  __typename?: 'InviteLog';
  action: InviteAction;
  actor?: Maybe<User>;
  actorId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  invite: HomeInvite;
  inviteId: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  newStatus?: Maybe<InviteStatus>;
  oldStatus?: Maybe<InviteStatus>;
};

export type InviteStats = {
  __typename?: 'InviteStats';
  actions: InviteActionStats;
  timeline: Array<InviteTimelineEntry>;
  total: Scalars['Int']['output'];
};

export enum InviteStatus {
  Accepted = 'ACCEPTED',
  Declined = 'DECLINED',
  Expired = 'EXPIRED',
  Pending = 'PENDING',
  Revoked = 'REVOKED',
}

export type InviteTimelineEntry = {
  __typename?: 'InviteTimelineEntry';
  action: InviteAction;
  timestamp: Scalars['DateTime']['output'];
};

export type InviteToHomeInput = {
  email: Scalars['String']['input'];
  homeId: Scalars['ID']['input'];
  message?: InputMaybe<Scalars['String']['input']>;
  role: MembershipRole;
};

export type InviteToShoppingListInput = {
  canAddItems?: InputMaybe<Scalars['Boolean']['input']>;
  canEdit?: InputMaybe<Scalars['Boolean']['input']>;
  canEditItems?: InputMaybe<Scalars['Boolean']['input']>;
  canExport?: InputMaybe<Scalars['Boolean']['input']>;
  canInviteOthers?: InputMaybe<Scalars['Boolean']['input']>;
  canMarkPurchased?: InputMaybe<Scalars['Boolean']['input']>;
  canRemoveItems?: InputMaybe<Scalars['Boolean']['input']>;
  canViewHistory?: InputMaybe<Scalars['Boolean']['input']>;
  email: Scalars['String']['input'];
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  role: CollaboratorRole;
  shoppingListId: Scalars['ID']['input'];
};

/**
 * Item/Product catalog type
 * Cache: 30 minutes - catalog items are relatively static
 */
export type Item = {
  __typename?: 'Item';
  allergens?: Maybe<Scalars['JSON']['output']>;
  alternateUpcs: Array<Scalars['String']['output']>;
  approvedAt?: Maybe<Scalars['DateTime']['output']>;
  approvedBy?: Maybe<User>;
  brands: Array<ItemBrand>;
  categories?: Maybe<Array<ItemCategory>>;
  convertedNetWeight?: Maybe<ConvertedValue>;
  createdAt: Scalars['DateTime']['output'];
  dataSource: DataSource;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  density?: Maybe<Scalars['Float']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  displayUnit?: Maybe<Unit>;
  displayUnitId?: Maybe<Scalars['String']['output']>;
  externalSources: Array<ExternalSourceMapping>;
  healthBenefits?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  images?: Maybe<Scalars['JSON']['output']>;
  ingredients?: Maybe<Scalars['JSON']['output']>;
  isUserCreated: Scalars['Boolean']['output'];
  matchedVariation?: Maybe<ProductVariation>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  needsApproval: Scalars['Boolean']['output'];
  netWeight?: Maybe<Scalars['Float']['output']>;
  nutritions?: Maybe<Scalars['JSON']['output']>;
  popularity: Scalars['Int']['output'];
  preferredTrackingUnit?: Maybe<Unit>;
  preferredTrackingUnitId?: Maybe<Scalars['String']['output']>;
  priceHistory: Array<ItemPriceHistory>;
  primaryUpc?: Maybe<Scalars['String']['output']>;
  servingSize?: Maybe<Scalars['Float']['output']>;
  servingSizeUnit?: Maybe<Scalars['String']['output']>;
  servingsPerPackage?: Maybe<Scalars['Int']['output']>;
  shelfLifeDays?: Maybe<Scalars['Int']['output']>;
  showInOnboarding: Scalars['Boolean']['output'];
  status: ItemStatus;
  storageState: StorageState;
  storeSkus: Array<ItemStoreSku>;
  tags: Array<Scalars['String']['output']>;
  type: ItemType;
  unitConversions: Array<ItemUnitConversion>;
  units: Array<ItemUnit>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
  visibility: Visibility;
};

export type ItemAvailability = {
  __typename?: 'ItemAvailability';
  available: Scalars['Boolean']['output'];
  inventory?: Maybe<Scalars['Int']['output']>;
  lastChecked: Scalars['DateTime']['output'];
  price?: Maybe<Scalars['Float']['output']>;
  storeId: Scalars['String']['output'];
  storeName: Scalars['String']['output'];
};

export type ItemBrand = {
  __typename?: 'ItemBrand';
  brand: Brand;
  id: Scalars['ID']['output'];
  item: Item;
};

export type ItemCategory = {
  __typename?: 'ItemCategory';
  assignedAt?: Maybe<Scalars['String']['output']>;
  assignedBy?: Maybe<User>;
  category: Category;
  confidence: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  item: Item;
  source: CategorySource;
};

export enum ItemCondition {
  Fair = 'FAIR',
  Good = 'GOOD',
  Spoiled = 'SPOILED',
}

export type ItemConnection = {
  __typename?: 'ItemConnection';
  edges: Array<ItemEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type ItemCreation = {
  __typename?: 'ItemCreation';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  item: Item;
  metadata?: Maybe<Scalars['JSON']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  source: DataSource;
  user: User;
};

/** Item connection for pagination (Relay spec) */
export type ItemEdge = {
  __typename?: 'ItemEdge';
  cursor: Scalars['String']['output'];
  node: Item;
};

export type ItemEdit = {
  __typename?: 'ItemEdit';
  createdAt: Scalars['DateTime']['output'];
  editReason?: Maybe<Scalars['String']['output']>;
  fieldsChanged: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  item: Item;
  newValues?: Maybe<Scalars['JSON']['output']>;
  oldValues?: Maybe<Scalars['JSON']['output']>;
  user: User;
};

export type ItemError = {
  __typename?: 'ItemError';
  code?: Maybe<Scalars['String']['output']>;
  error: Scalars['String']['output'];
  field?: Maybe<Scalars['String']['output']>;
  identifier?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

export type ItemFilters = {
  brand?: InputMaybe<Scalars['String']['input']>;
  brandIds?: InputMaybe<Array<Scalars['String']['input']>>;
  brands?: InputMaybe<Array<Scalars['String']['input']>>;
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  category?: InputMaybe<Scalars['String']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  /** External ID from a provider (e.g., Kroger product ID) */
  externalId?: InputMaybe<Scalars['String']['input']>;
  /** Provider type for external ID lookup */
  externalProvider?: InputMaybe<ProviderType>;
  hasAllergens?: InputMaybe<Scalars['Boolean']['input']>;
  hasNutrition?: InputMaybe<Scalars['Boolean']['input']>;
  hasOffers?: InputMaybe<Scalars['Boolean']['input']>;
  inventoryStatus?: InputMaybe<Scalars['String']['input']>;
  isDairyFree?: InputMaybe<Scalars['Boolean']['input']>;
  isGlutenFree?: InputMaybe<Scalars['Boolean']['input']>;
  isOrganic?: InputMaybe<Scalars['Boolean']['input']>;
  isPopular?: InputMaybe<Scalars['Boolean']['input']>;
  isRecent?: InputMaybe<Scalars['Boolean']['input']>;
  isTrending?: InputMaybe<Scalars['Boolean']['input']>;
  isVegan?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  priceRange?: InputMaybe<PriceRangeInput>;
  showInOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
  /** SKU to search for */
  sku?: InputMaybe<Scalars['String']['input']>;
  /** Store ID for SKU lookup (optional, searches all stores if not provided) */
  skuStoreId?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ItemStatus>;
  statuses?: InputMaybe<Array<ItemStatus>>;
  storageState?: InputMaybe<StorageState>;
  storageStates?: InputMaybe<Array<StorageState>>;
  storeId?: InputMaybe<Scalars['String']['input']>;
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timeRange?: InputMaybe<DateRange>;
  type?: InputMaybe<ItemType>;
  types?: InputMaybe<Array<ItemType>>;
  /** UPC/barcode to search for */
  upc?: InputMaybe<Scalars['String']['input']>;
  /** Format hint for UPC validation/normalization (defaults to AUTO) */
  upcFormat?: InputMaybe<UpcFormat>;
  updatedAfter?: InputMaybe<Scalars['DateTime']['input']>;
  updatedBefore?: InputMaybe<Scalars['DateTime']['input']>;
  visibility?: InputMaybe<Visibility>;
};

/** Price history for items - may contain user-specific pricing data */
export type ItemPriceHistory = {
  __typename?: 'ItemPriceHistory';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  item: Item;
  metadata?: Maybe<Scalars['JSON']['output']>;
  price: Scalars['Float']['output'];
  source: Scalars['String']['output'];
};

export enum ItemSortField {
  CreatedAt = 'CREATED_AT',
  Name = 'NAME',
  Popularity = 'POPULARITY',
  Price = 'PRICE',
  ShelfLife = 'SHELF_LIFE',
  UnitPrice = 'UNIT_PRICE',
  UpdatedAt = 'UPDATED_AT',
}

export type ItemSortInput = {
  field: ItemSortField;
  order: SortOrder;
};

export enum ItemStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Deprecated = 'DEPRECATED',
  Pending = 'PENDING',
}

/**
 * Store SKU mapping for items
 * Cache: 10 minutes - SKU mappings can change but not frequently
 */
export type ItemStoreSku = {
  __typename?: 'ItemStoreSku';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  item: Item;
  metadata?: Maybe<Scalars['JSON']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  sku: Scalars['String']['output'];
  store: Store;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type ItemSuggestion = {
  __typename?: 'ItemSuggestion';
  brands: Array<BrandSuggestion>;
  category?: Maybe<CategorySuggestion>;
  defaultUnit?: Maybe<ItemUnitSuggestion>;
  displayUnit?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  images?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  netWeight?: Maybe<Scalars['Float']['output']>;
  type: ItemType;
};

export enum ItemType {
  Drink = 'DRINK',
  Food = 'FOOD',
  Foundation = 'FOUNDATION',
  Household = 'HOUSEHOLD',
  Other = 'OTHER',
  PersonalCare = 'PERSONAL_CARE',
  Pet = 'PET',
  Product = 'PRODUCT',
  Supplement = 'SUPPLEMENT',
}

export type ItemUnit = {
  __typename?: 'ItemUnit';
  addedBy?: Maybe<User>;
  averagePricePerUnit?: Maybe<Scalars['Float']['output']>;
  confidence?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  displayFormat: DisplayFormat;
  id: Scalars['ID']['output'];
  isCommon: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  isPreferred: Scalars['Boolean']['output'];
  isTrackingDefault: Scalars['Boolean']['output'];
  isVerified: Scalars['Boolean']['output'];
  item?: Maybe<Item>;
  itemId: Scalars['String']['output'];
  lastPriceUpdate?: Maybe<Scalars['DateTime']['output']>;
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  maxDisplayPrecision?: Maybe<Scalars['Int']['output']>;
  maxQuantity?: Maybe<Scalars['Float']['output']>;
  minQuantity?: Maybe<Scalars['Float']['output']>;
  packageDescription?: Maybe<Scalars['String']['output']>;
  packageSize?: Maybe<Scalars['Float']['output']>;
  popularityScore: Scalars['Float']['output'];
  preferredDenominators?: Maybe<Scalars['JSON']['output']>;
  priceSource?: Maybe<Scalars['String']['output']>;
  quantityStep?: Maybe<Scalars['Float']['output']>;
  recommendedFor: Array<UnitRecommendation>;
  retailUnit: Scalars['Boolean']['output'];
  roundToNearestFraction: Scalars['Boolean']['output'];
  source: UnitSource;
  unit?: Maybe<Unit>;
  unitId: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  usageContext: Array<UnitUsageContext>;
  usageCount: Scalars['Int']['output'];
  verifiedAt?: Maybe<Scalars['DateTime']['output']>;
  verifiedBy?: Maybe<User>;
  version: Scalars['Int']['output'];
};

/**
 * Item-specific unit conversion
 * Stores conversions like "1 cup flour = 120g"
 */
export type ItemUnitConversion = {
  __typename?: 'ItemUnitConversion';
  addedBy?: Maybe<User>;
  confidence: Scalars['Float']['output'];
  conversionRatio: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  fromUnit: Unit;
  id: Scalars['ID']['output'];
  isVerified: Scalars['Boolean']['output'];
  item: Item;
  notes?: Maybe<Scalars['String']['output']>;
  source: ConversionSource;
  toUnit: Unit;
  updatedAt: Scalars['DateTime']['output'];
  verifiedBy?: Maybe<User>;
};

export type ItemUnitInput = {
  averagePricePerUnit?: InputMaybe<Scalars['Float']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  isPreferred?: InputMaybe<Scalars['Boolean']['input']>;
  packageDescription?: InputMaybe<Scalars['String']['input']>;
  packageSize?: InputMaybe<Scalars['Float']['input']>;
  recommendedFor?: InputMaybe<Array<UnitRecommendation>>;
  retailUnit?: InputMaybe<Scalars['Boolean']['input']>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  usageContext?: InputMaybe<Array<UnitUsageContext>>;
};

export type ItemUnitSuggestion = {
  __typename?: 'ItemUnitSuggestion';
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  isPreferred: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  type: UnitType;
};

export type ItemsResponse = {
  __typename?: 'ItemsResponse';
  hasMore: Scalars['Boolean']['output'];
  items?: Maybe<Array<Item>>;
  totalCount: Scalars['Int']['output'];
};

/** Comprehensive ledger analytics combining additions and consumption */
export type LedgerAnalytics = {
  __typename?: 'LedgerAnalytics';
  costAnalytics?: Maybe<AdditionCostAnalytics>;
  granularity: PeriodGranularity;
  periodData: Array<LedgerPeriodData>;
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  summary: LedgerSummary;
  topRestockedItems: Array<UsageByItem>;
};

/** Per-period ledger data for trend analysis */
export type LedgerPeriodData = {
  __typename?: 'LedgerPeriodData';
  added: Scalars['Float']['output'];
  additionCost?: Maybe<Scalars['Float']['output']>;
  consumed: Scalars['Float']['output'];
  net: Scalars['Float']['output'];
  periodEnd: Scalars['DateTime']['output'];
  periodLabel: Scalars['String']['output'];
  periodStart: Scalars['DateTime']['output'];
  wasted: Scalars['Float']['output'];
};

/** Ledger summary showing additions vs consumption */
export type LedgerSummary = {
  __typename?: 'LedgerSummary';
  additionCount: Scalars['Int']['output'];
  additionsByUnit: Array<UsageByUnit>;
  consumptionByUnit: Array<UsageByUnit>;
  consumptionCount: Scalars['Int']['output'];
  netQuantity: Scalars['Float']['output'];
  totalAdded: Scalars['Float']['output'];
  totalConsumed: Scalars['Float']['output'];
  totalWasted: Scalars['Float']['output'];
  unitName?: Maybe<Scalars['String']['output']>;
  wasteCount: Scalars['Int']['output'];
};

export enum ListActivityType {
  AutoSuggestionAdded = 'AUTO_SUGGESTION_ADDED',
  CollaboratorAdded = 'COLLABORATOR_ADDED',
  CollaboratorJoined = 'COLLABORATOR_JOINED',
  CollaboratorLeft = 'COLLABORATOR_LEFT',
  CollaboratorRemoved = 'COLLABORATOR_REMOVED',
  CollaboratorRoleChanged = 'COLLABORATOR_ROLE_CHANGED',
  ItemAdded = 'ITEM_ADDED',
  ItemMoved = 'ITEM_MOVED',
  ItemPriceUpdated = 'ITEM_PRICE_UPDATED',
  ItemPurchased = 'ITEM_PURCHASED',
  ItemQuantityChanged = 'ITEM_QUANTITY_CHANGED',
  ItemRemoved = 'ITEM_REMOVED',
  ItemUpdated = 'ITEM_UPDATED',
  ListArchived = 'LIST_ARCHIVED',
  ListCompleted = 'LIST_COMPLETED',
  ListCreated = 'LIST_CREATED',
  ListDeleted = 'LIST_DELETED',
  ListDuplicated = 'LIST_DUPLICATED',
  ListExported = 'LIST_EXPORTED',
  ListShared = 'LIST_SHARED',
  ListUpdated = 'LIST_UPDATED',
  PriceAlertTriggered = 'PRICE_ALERT_TRIGGERED',
  RecurringListGenerated = 'RECURRING_LIST_GENERATED',
}

export enum ListStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Paused = 'PAUSED',
  Template = 'TEMPLATE',
}

export type LocationStat = {
  __typename?: 'LocationStat';
  count: Scalars['Int']['output'];
  ipCity?: Maybe<Scalars['String']['output']>;
  ipCountry?: Maybe<Scalars['String']['output']>;
};

export type LoginAttemptInput = {
  deviceType?: InputMaybe<DeviceType>;
  failureReason?: InputMaybe<LoginFailureReason>;
  ipAddress?: InputMaybe<Scalars['String']['input']>;
  isMobileApp?: InputMaybe<Scalars['Boolean']['input']>;
  method?: InputMaybe<LoginMethod>;
  provider?: InputMaybe<Scalars['String']['input']>;
  referrer?: InputMaybe<Scalars['String']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  success: Scalars['Boolean']['input'];
  userAgent?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export enum LoginFailureReason {
  AccountDisabled = 'ACCOUNT_DISABLED',
  AccountLocked = 'ACCOUNT_LOCKED',
  AccountNotFound = 'ACCOUNT_NOT_FOUND',
  DeviceBlocked = 'DEVICE_BLOCKED',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  InvalidCredentials = 'INVALID_CREDENTIALS',
  IpBlocked = 'IP_BLOCKED',
  MaintenanceMode = 'MAINTENANCE_MODE',
  MfaFailed = 'MFA_FAILED',
  MfaRequired = 'MFA_REQUIRED',
  PasswordExpired = 'PASSWORD_EXPIRED',
  RateLimited = 'RATE_LIMITED',
  SuspiciousActivity = 'SUSPICIOUS_ACTIVITY',
}

/**
 * Consolidated input for querying login history.
 * Replaces multiple specialized queries with a single flexible query.
 */
export type LoginHistoriesInput = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  failuresOnly?: InputMaybe<Scalars['Boolean']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  fromDate?: InputMaybe<Scalars['DateTime']['input']>;
  hours?: InputMaybe<Scalars['Int']['input']>;
  ipAddress?: InputMaybe<Scalars['String']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  method?: InputMaybe<LoginMethod>;
  orderBy?: InputMaybe<LoginHistoryOrderBy>;
  orderDirection?: InputMaybe<SortOrder>;
  riskyOnly?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  successOnly?: InputMaybe<Scalars['Boolean']['input']>;
  toDate?: InputMaybe<Scalars['DateTime']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

/** Security audit log for login attempts - NEVER cache */
export type LoginHistory = {
  __typename?: 'LoginHistory';
  apiClient?: Maybe<Scalars['String']['output']>;
  browserName?: Maybe<Scalars['String']['output']>;
  browserVersion?: Maybe<Scalars['String']['output']>;
  campaign?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  device?: Maybe<Device>;
  deviceId?: Maybe<Scalars['String']['output']>;
  deviceType?: Maybe<DeviceType>;
  failureDetails?: Maybe<Scalars['String']['output']>;
  failureReason?: Maybe<LoginFailureReason>;
  flaggedAt?: Maybe<Scalars['DateTime']['output']>;
  flaggedBy?: Maybe<User>;
  flaggedById?: Maybe<Scalars['String']['output']>;
  flaggedReason?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isApiLogin: Scalars['Boolean']['output'];
  isAutomated: Scalars['Boolean']['output'];
  isMobileApp: Scalars['Boolean']['output'];
  isNewBrowser: Scalars['Boolean']['output'];
  isNewDevice: Scalars['Boolean']['output'];
  isNewLocation: Scalars['Boolean']['output'];
  isProxy?: Maybe<Scalars['Boolean']['output']>;
  isRisky: Scalars['Boolean']['output'];
  isTor?: Maybe<Scalars['Boolean']['output']>;
  isVpn?: Maybe<Scalars['Boolean']['output']>;
  landingPage?: Maybe<Scalars['String']['output']>;
  lastActivityAt?: Maybe<Scalars['DateTime']['output']>;
  loggedInAt: Scalars['DateTime']['output'];
  loggedOutAt?: Maybe<Scalars['DateTime']['output']>;
  method: LoginMethod;
  mfaCompleted: Scalars['Boolean']['output'];
  mfaMethod?: Maybe<MfaMethod>;
  osName?: Maybe<Scalars['String']['output']>;
  osVersion?: Maybe<Scalars['String']['output']>;
  provider?: Maybe<Scalars['String']['output']>;
  referrer?: Maybe<Scalars['String']['output']>;
  requiresMfa: Scalars['Boolean']['output'];
  reviewed: Scalars['Boolean']['output'];
  reviewedAt?: Maybe<Scalars['DateTime']['output']>;
  reviewedBy?: Maybe<User>;
  reviewedById?: Maybe<Scalars['ID']['output']>;
  riskFactors: Array<RiskFactor>;
  riskScore?: Maybe<Scalars['Float']['output']>;
  sessionDuration?: Maybe<Scalars['Int']['output']>;
  sessionId?: Maybe<Scalars['String']['output']>;
  source?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  timezoneDiff?: Maybe<Scalars['Int']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userAgent?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

export type LoginHistoryActivity = {
  __typename?: 'LoginHistoryActivity';
  id: Scalars['ID']['output'];
  isRisky: Scalars['Boolean']['output'];
  loggedInAt: Scalars['DateTime']['output'];
  method: LoginMethod;
  riskFactors: Array<RiskFactor>;
  success: Scalars['Boolean']['output'];
};

export type LoginHistoryBreakdown = {
  __typename?: 'LoginHistoryBreakdown';
  locations: Array<LocationStat>;
  methods: Array<LoginMethodStat>;
  uniqueDevices: Array<DeviceStat>;
  uniqueIPs: Array<IpStat>;
};

export type LoginHistoryByIpFiltersInput = {
  fromDate?: InputMaybe<Scalars['DateTime']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  successOnly?: InputMaybe<Scalars['Boolean']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  toDate?: InputMaybe<Scalars['DateTime']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type LoginHistoryConnection = {
  __typename?: 'LoginHistoryConnection';
  edges: Array<LoginHistoryEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type LoginHistoryEdge = {
  __typename?: 'LoginHistoryEdge';
  cursor: Scalars['String']['output'];
  node: LoginHistory;
};

export type LoginHistoryFiltersInput = {
  failuresOnly?: InputMaybe<Scalars['Boolean']['input']>;
  fromDate?: InputMaybe<Scalars['DateTime']['input']>;
  ipAddress?: InputMaybe<Scalars['String']['input']>;
  method?: InputMaybe<LoginMethod>;
  orderBy?: InputMaybe<SortOrder>;
  riskyOnly?: InputMaybe<Scalars['Boolean']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  successOnly?: InputMaybe<Scalars['Boolean']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  toDate?: InputMaybe<Scalars['DateTime']['input']>;
};

export enum LoginHistoryOrderBy {
  CreatedAt = 'CREATED_AT',
  LoggedInAt = 'LOGGED_IN_AT',
  RiskScore = 'RISK_SCORE',
}

export type LoginHistoryPeriod = {
  __typename?: 'LoginHistoryPeriod';
  days: Scalars['Int']['output'];
  from: Scalars['DateTime']['output'];
  to: Scalars['DateTime']['output'];
};

export type LoginHistoryStats = {
  __typename?: 'LoginHistoryStats';
  breakdown: LoginHistoryBreakdown;
  period: LoginHistoryPeriod;
  recentActivity: Array<LoginHistoryActivity>;
  summary: LoginHistorySummary;
};

export type LoginHistorySummary = {
  __typename?: 'LoginHistorySummary';
  failedLogins: Scalars['Int']['output'];
  riskyLogins: Scalars['Int']['output'];
  successRate: Scalars['Float']['output'];
  successfulLogins: Scalars['Int']['output'];
  totalLogins: Scalars['Int']['output'];
  uniqueDeviceCount: Scalars['Int']['output'];
  uniqueIPCount: Scalars['Int']['output'];
};

export type LoginInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export enum LoginMethod {
  ApiKey = 'API_KEY',
  Biometric = 'BIOMETRIC',
  MagicLink = 'MAGIC_LINK',
  Oauth = 'OAUTH',
  Password = 'PASSWORD',
  Sms = 'SMS',
  Sso = 'SSO',
  Token = 'TOKEN',
}

export type LoginMethodStat = {
  __typename?: 'LoginMethodStat';
  count: Scalars['Int']['output'];
  method: LoginMethod;
};

/** A pantry item that is running low on stock */
export type LowStockItem = {
  __typename?: 'LowStockItem';
  currentQuantity: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  itemId: Scalars['String']['output'];
  itemName: Scalars['String']['output'];
  minQuantity: Scalars['Float']['output'];
  pantryId: Scalars['String']['output'];
  pantryName: Scalars['String']['output'];
  restockQuantity?: Maybe<Scalars['Float']['output']>;
  unitId: Scalars['String']['output'];
  unitName: Scalars['String']['output'];
};

/** Result of adding low stock items to a shopping list */
export type LowStockToShoppingListResult = {
  __typename?: 'LowStockToShoppingListResult';
  addedCount: Scalars['Int']['output'];
  addedItems: Array<AddedLowStockItem>;
  skippedCount: Scalars['Int']['output'];
  skippedItems: Array<SkippedLowStockItem>;
};

export type MarkActionInput = {
  action: ExpirationAction;
  notificationId: Scalars['ID']['input'];
};

export type MarkAsTemplateInput = {
  saveItems?: InputMaybe<Scalars['Boolean']['input']>;
  templateName: Scalars['String']['input'];
};

export enum MatchType {
  Category = 'CATEGORY',
  Exact = 'EXACT',
  Fuzzy = 'FUZZY',
  Partial = 'PARTIAL',
}

/**
 * Meal plan for organizing meals over a period
 * Cache: 5 minutes - plans change occasionally
 */
export type MealPlan = {
  __typename?: 'MealPlan';
  actualCost: Scalars['Float']['output'];
  budgetAmount?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dietaryProfile?: Maybe<DietaryProfile>;
  endDate: Scalars['DateTime']['output'];
  generatedShoppingLists: Array<ShoppingList>;
  id: Scalars['ID']['output'];
  mealPlanItems: Array<MealPlanItem>;
  name: Scalars['String']['output'];
  /**
   * Progress toward nutrition goals from linked dietary profile.
   * Returns null if no dietary profile is linked.
   */
  nutritionGoalProgress?: Maybe<NutritionGoalProgress>;
  /**
   * Aggregated nutrition summary for the entire meal plan.
   * Includes totals, daily averages, and breakdown by meal type.
   */
  nutritionSummary: MealPlanNutritionSummary;
  planType: MealPlanType;
  servings: Scalars['Int']['output'];
  startDate: Scalars['DateTime']['output'];
  totalCalories?: Maybe<Scalars['Float']['output']>;
  totalCarbs?: Maybe<Scalars['Float']['output']>;
  totalFat?: Maybe<Scalars['Float']['output']>;
  totalProtein?: Maybe<Scalars['Float']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  version: Scalars['Int']['output'];
};

/**
 * Meal plan item linking recipes to meals
 * Cache: 5 minutes - meal plans change occasionally
 */
export type MealPlanItem = {
  __typename?: 'MealPlanItem';
  actualCost?: Maybe<Scalars['Float']['output']>;
  calories?: Maybe<Scalars['Float']['output']>;
  carbs?: Maybe<Scalars['Float']['output']>;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  customMealName?: Maybe<Scalars['String']['output']>;
  date: Scalars['DateTime']['output'];
  estimatedCost?: Maybe<Scalars['Float']['output']>;
  fat?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  isCompleted: Scalars['Boolean']['output'];
  mealPlan: MealPlan;
  mealType: MealType;
  notes?: Maybe<Scalars['String']['output']>;
  nutritionSource: NutritionSource;
  protein?: Maybe<Scalars['Float']['output']>;
  recipe?: Maybe<Recipe>;
  servings?: Maybe<Scalars['Int']['output']>;
  usedPantryItems: Scalars['JSON']['output'];
};

/** Aggregated nutrition data for a meal plan */
export type MealPlanNutritionSummary = {
  __typename?: 'MealPlanNutritionSummary';
  avgDailyCalories: Scalars['Float']['output'];
  avgDailyCarbs: Scalars['Float']['output'];
  avgDailyFat: Scalars['Float']['output'];
  avgDailyProtein: Scalars['Float']['output'];
  coveragePercentage: Scalars['Float']['output'];
  mealTypeBreakdown: Array<MealTypeNutrition>;
  mealsWithNutrition: Scalars['Int']['output'];
  totalCalories: Scalars['Float']['output'];
  totalCarbs: Scalars['Float']['output'];
  totalFat: Scalars['Float']['output'];
  totalMeals: Scalars['Int']['output'];
  totalProtein: Scalars['Float']['output'];
};

export enum MealPlanType {
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY',
}

/**
 * Reusable meal template for quick meal plan creation.
 * Templates store meal patterns that can be applied to create meal plans.
 * Cache: 5 minutes - templates change occasionally
 */
export type MealTemplate = {
  __typename?: 'MealTemplate';
  category: TemplateCategory;
  createdAt: Scalars['DateTime']['output'];
  defaultServings: Scalars['Int']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  durationDays: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  items: Array<MealTemplateItem>;
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  usageCount: Scalars['Int']['output'];
  user: User;
};

/** A single meal within a template */
export type MealTemplateItem = {
  __typename?: 'MealTemplateItem';
  customMealName?: Maybe<Scalars['String']['output']>;
  dayOffset: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  mealType: MealType;
  notes?: Maybe<Scalars['String']['output']>;
  recipe?: Maybe<Recipe>;
  servings?: Maybe<Scalars['Int']['output']>;
  template: MealTemplate;
};

export type MealTemplateItemInput = {
  customMealName?: InputMaybe<Scalars['String']['input']>;
  dayOffset: Scalars['Int']['input'];
  mealType: MealType;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

/** Filter options for listing templates */
export type MealTemplatesFilter = {
  category?: InputMaybe<TemplateCategory>;
  maxDuration?: InputMaybe<Scalars['Int']['input']>;
  minDuration?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export enum MealType {
  Breakfast = 'BREAKFAST',
  Brunch = 'BRUNCH',
  Dessert = 'DESSERT',
  Dinner = 'DINNER',
  Lunch = 'LUNCH',
  Snack = 'SNACK',
}

/** Nutrition breakdown by meal type */
export type MealTypeNutrition = {
  __typename?: 'MealTypeNutrition';
  mealCount: Scalars['Int']['output'];
  mealType: MealType;
  totalCalories: Scalars['Float']['output'];
  totalCarbs: Scalars['Float']['output'];
  totalFat: Scalars['Float']['output'];
  totalProtein: Scalars['Float']['output'];
};

export type Membership = {
  __typename?: 'Membership';
  canAddItems: Scalars['Boolean']['output'];
  canEditPantry: Scalars['Boolean']['output'];
  canInviteOthers: Scalars['Boolean']['output'];
  canManageHome: Scalars['Boolean']['output'];
  canRemoveItems: Scalars['Boolean']['output'];
  canViewPantry: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  home: Home;
  homeId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  joinedAt: Scalars['DateTime']['output'];
  lastActiveAt?: Maybe<Scalars['DateTime']['output']>;
  leftAt?: Maybe<Scalars['DateTime']['output']>;
  role: MembershipRole;
  status: MembershipStatus;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type MembershipConnection = {
  __typename?: 'MembershipConnection';
  edges: Array<MembershipEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Membership connection for pagination */
export type MembershipEdge = {
  __typename?: 'MembershipEdge';
  cursor: Scalars['String']['output'];
  node: Membership;
};

export enum MembershipJoinMethod {
  DirectAdd = 'DIRECT_ADD',
  Invite = 'INVITE',
  JoinCode = 'JOIN_CODE',
}

export type MembershipJoinedPayload = {
  __typename?: 'MembershipJoinedPayload';
  homeId: Scalars['String']['output'];
  joinMethod: MembershipJoinMethod;
  membership: Membership;
  userId: Scalars['String']['output'];
};

export enum MembershipLeftMethod {
  Removed = 'REMOVED',
  Suspended = 'SUSPENDED',
  Voluntary = 'VOLUNTARY',
}

export type MembershipLeftPayload = {
  __typename?: 'MembershipLeftPayload';
  homeId: Scalars['String']['output'];
  leftMethod: MembershipLeftMethod;
  membership: Membership;
  userId: Scalars['String']['output'];
};

export enum MembershipMutationType {
  Created = 'CREATED',
  Left = 'LEFT',
  Rejoined = 'REJOINED',
  Removed = 'REMOVED',
  Updated = 'UPDATED',
}

export enum MembershipRole {
  Admin = 'ADMIN',
  Guest = 'GUEST',
  Member = 'MEMBER',
  Owner = 'OWNER',
}

export type MembershipRoleChangedPayload = {
  __typename?: 'MembershipRoleChangedPayload';
  changedBy: Scalars['String']['output'];
  homeId: Scalars['String']['output'];
  membership: Membership;
  newRole: MembershipRole;
  previousRole: MembershipRole;
  userId: Scalars['String']['output'];
};

export type MembershipRoleStats = {
  __typename?: 'MembershipRoleStats';
  ADMIN: Scalars['Int']['output'];
  GUEST: Scalars['Int']['output'];
  MEMBER: Scalars['Int']['output'];
  OWNER: Scalars['Int']['output'];
};

export type MembershipStats = {
  __typename?: 'MembershipStats';
  active: Scalars['Int']['output'];
  byRole: MembershipRoleStats;
  byStatus: MembershipStatusStats;
  recentlyActive: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export enum MembershipStatus {
  Active = 'ACTIVE',
  Left = 'LEFT',
  Removed = 'REMOVED',
  Suspended = 'SUSPENDED',
}

export type MembershipStatusStats = {
  __typename?: 'MembershipStatusStats';
  ACTIVE: Scalars['Int']['output'];
  LEFT: Scalars['Int']['output'];
  REMOVED: Scalars['Int']['output'];
  SUSPENDED: Scalars['Int']['output'];
};

export type MembershipUpdatePayload = {
  __typename?: 'MembershipUpdatePayload';
  mutation: MembershipMutationType;
  node?: Maybe<Membership>;
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['String']['output'];
};

export enum MfaMethod {
  Biometric = 'BIOMETRIC',
  Email = 'EMAIL',
  Hardware = 'HARDWARE',
  Push = 'PUSH',
  Sms = 'SMS',
  Totp = 'TOTP',
}

export enum MobilePlatform {
  Android = 'ANDROID',
  Ios = 'IOS',
  Linux = 'LINUX',
  Macos = 'MACOS',
  Other = 'OTHER',
  Windows = 'WINDOWS',
}

export enum ModerationRestriction {
  LimitedInteractions = 'LIMITED_INTERACTIONS',
  NoCommenting = 'NO_COMMENTING',
  NoMessaging = 'NO_MESSAGING',
  NoPosting = 'NO_POSTING',
  NoRecipeCreation = 'NO_RECIPE_CREATION',
  NoReviews = 'NO_REVIEWS',
  NoSharing = 'NO_SHARING',
}

export enum ModerationStatus {
  Active = 'ACTIVE',
  Appealing = 'APPEALING',
  Banned = 'BANNED',
  Restricted = 'RESTRICTED',
  Suspended = 'SUSPENDED',
  UnderReview = 'UNDER_REVIEW',
  Warned = 'WARNED',
}

/** Result of moving all purchased items to pantry */
export type MovePurchasedItemsResult = {
  __typename?: 'MovePurchasedItemsResult';
  /** Number of items successfully moved to pantry */
  movedCount: Scalars['Int']['output'];
  /** Details of successfully moved items */
  movedItems: Array<MovedItemInfo>;
  /** Number of items skipped (no itemId, already moved, or error) */
  skippedCount: Scalars['Int']['output'];
  /** Details of skipped items with reasons */
  skippedItems: Array<SkippedItemInfo>;
  /** ID of the pantry items were moved to */
  targetPantryId: Scalars['ID']['output'];
  /** Name of the pantry items were moved to */
  targetPantryName: Scalars['String']['output'];
};

/**
 * Input for moving a shopping list item to the pantry.
 * Creates a PantryItem from a ShoppingListItem after purchase.
 */
export type MoveShoppingItemToPantryInput = {
  /** Actual quantity purchased (may differ from planned) */
  actualQuantity: Scalars['Float']['input'];
  /** Unit ID for the quantity (defaults to shopping item's unit) */
  actualUnitId?: InputMaybe<Scalars['ID']['input']>;
  /** Cost per unit (optional) */
  costPerUnit?: InputMaybe<Scalars['Float']['input']>;
  /** Expiration date (optional) */
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  /** Additional notes */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** ID of the target pantry */
  pantryId: Scalars['ID']['input'];
  /** Whether to remove the item from the shopping list after moving (default: true) */
  removeFromList?: InputMaybe<Scalars['Boolean']['input']>;
  /** ID of the shopping list item to move */
  shoppingListItemId: Scalars['ID']['input'];
  /** Storage location ID (optional) */
  storageLocationId?: InputMaybe<Scalars['ID']['input']>;
  /** Storage state (FROZEN, REFRIGERATED, AMBIENT, NONE) */
  storageState?: InputMaybe<StorageState>;
  /** Total cost paid (optional) */
  totalCost?: InputMaybe<Scalars['Float']['input']>;
};

export type MoveShoppingListItemInput = {
  afterItemId?: InputMaybe<Scalars['ID']['input']>;
  beforeItemId?: InputMaybe<Scalars['ID']['input']>;
  itemId: Scalars['ID']['input'];
};

/** Info about a successfully moved item */
export type MovedItemInfo = {
  __typename?: 'MovedItemInfo';
  itemName: Scalars['String']['output'];
  pantryItemId: Scalars['ID']['output'];
  quantity: Scalars['Float']['output'];
  shoppingListItemId: Scalars['ID']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  acceptHomeInvite: Membership;
  acceptShoppingListInvite: ShoppingListCollaborator;
  addCollaborator: ShoppingListCollaborator;
  addItemToShoppingList: ShoppingListItem;
  /**
   * Add all low stock items from a home's pantries to a shopping list.
   * If no shoppingListId is provided, uses the home's default shopping list.
   */
  addLowStockItemsToShoppingList: LowStockToShoppingListResult;
  /**
   * Add a specific pantry item to a shopping list.
   * Useful for manually adding items when running low.
   */
  addPantryItemToShoppingList: AddPantryItemToShoppingListResult;
  /**
   * Add recipe ingredients to shopping list with smart unit handling
   * Checks pantry for available items and only adds deficit
   */
  addRecipeToShoppingList: ShoppingList;
  addRestriction: DietaryRestriction;
  addRestrictions: UserModeration;
  /** Add an item to a template */
  addTemplateItem: MealTemplateItem;
  addUserAddress: UserAddress;
  addWarning: UserModeration;
  adminDeleteUser: Scalars['Boolean']['output'];
  /** Approve a user-created item for public visibility */
  approveItem: Item;
  archiveShoppingList: ShoppingList;
  banUser: UserModeration;
  /** Create multiple items at once */
  bulkCreateItems: BulkCreateItemsResponse;
  /** Delete multiple items */
  bulkDeleteItems: BulkOperationSummary;
  /**
   * Bulk update multiple devices at once.
   * Replaces: trustMultipleDevices, untrustMultipleDevices, deactivateMultipleDevices, deleteMultipleDevices
   */
  bulkUpdateDevices: BulkDeviceResult;
  /** Update multiple items with the same changes */
  bulkUpdateItems: BulkOperationSummary;
  cancelRecurring: ShoppingList;
  categorizeItem: ItemCategory;
  /** Change password for authenticated user (requires current password verification) */
  changePassword: ChangePasswordResponse;
  /**
   * Cleanup stale or deleted devices.
   * Admin operation for maintenance.
   */
  cleanupDevices: DeviceCleanupResult;
  clearReminder: ShoppingList;
  /** Mark user onboarding as complete and send welcome email */
  completeOnboarding: Scalars['Boolean']['output'];
  completeReview: UserModeration;
  completeShoppingList: ShoppingList;
  confirmItemImageUpload: Scalars['String']['output'];
  confirmProfileImageUpload: Scalars['String']['output'];
  confirmRecipeConsumption: RecipeConsumptionResult;
  createBrand: Brand;
  createBulkPurchases: Array<Purchase>;
  createBulkStores: Array<Store>;
  createCategory: Category;
  createCurrency: Currency;
  createFromTemplate: ShoppingList;
  createHome: Home;
  createImageUploadUrl: PresignPayload;
  /** Create a new item */
  createItem: Item;
  createLoginHistory: LoginHistory;
  createMealPlan: MealPlan;
  /**
   * Create a new meal plan from a template.
   * Copies all template items to the new plan with dates offset from startDate.
   */
  createMealPlanFromTemplate: MealPlan;
  /** Create a new meal template */
  createMealTemplate: MealTemplate;
  createMembership: Membership;
  createModerationRecord: UserModeration;
  createNotification: Notification;
  createPantry: Pantry;
  createPantryItem: PantryItem;
  createPantryItemUsage: PantryItemUsage;
  createProfile: UserProfile;
  createPurchase: Purchase;
  createRecipe: Recipe;
  createShoppingList: ShoppingList;
  createShoppingListItemFromRecipeIngredient: AddIngredientResult;
  createShoppingListItemsFromRecipe: AddRecipeToShoppingListResult;
  /**
   * Create a new storage location
   * Validates parent-child relationships and prevents circular references
   * Requires user to have edit permissions in the home
   */
  createStorageLocation: StorageLocation;
  createStore: Store;
  /**
   * Create a template from an existing meal plan.
   * Extracts the meal pattern into a reusable template.
   */
  createTemplateFromMealPlan: MealTemplate;
  createUnit: Unit;
  createUploadUrl: PresignPayload;
  declineHomeInvite: Scalars['Boolean']['output'];
  declineShoppingListInvite: Scalars['Boolean']['output'];
  deleteAccount: Scalars['Boolean']['output'];
  deleteAllReadNotifications: Scalars['Int']['output'];
  deleteBrand: Brand;
  deleteBulkPurchases: Scalars['Boolean']['output'];
  deleteCategory: Scalars['Boolean']['output'];
  deleteCookingLog: Scalars['Boolean']['output'];
  deleteCurrency: Scalars['Boolean']['output'];
  deleteExpiredNotifications: Scalars['Int']['output'];
  deleteHome: Home;
  /** Delete an item (soft delete by default, permanent if specified) */
  deleteItem: Item;
  deleteMealPlan: Scalars['Boolean']['output'];
  /** Delete a meal template (soft delete) */
  deleteMealTemplate: Scalars['Boolean']['output'];
  deleteMultipleNotifications: Scalars['Int']['output'];
  deleteNotification: Scalars['Boolean']['output'];
  deletePantry: Pantry;
  deletePantryItem: PantryItem;
  deletePurchase: Scalars['Boolean']['output'];
  deleteRecipe: Scalars['Boolean']['output'];
  deleteShoppingList: ShoppingList;
  /**
   * Delete a storage location (soft delete)
   * Fails if location has child locations or items
   * Requires user to have edit permissions in the home
   */
  deleteStorageLocation: Scalars['Boolean']['output'];
  deleteStore: Scalars['Boolean']['output'];
  deleteUnit: Scalars['Boolean']['output'];
  deleteUserAddress: UserAddress;
  dismissExpirationNotification: ExpirationNotification;
  /** Duplicate a template with a new name */
  duplicateTemplate: MealTemplate;
  /** Export items to file */
  exportItems: ExportResponse;
  favoriteRecipe: SavedRecipe;
  /** Flag an item for review */
  flagItemForReview: Item;
  flagLoginAsRisky: LoginHistory;
  flagMultipleLoginsAsRisky: Array<LoginHistory>;
  /** Request a password reset email */
  forgotPassword: ForgotPasswordResponse;
  forkRecipe: Recipe;
  generateNextRecurringList: ShoppingList;
  generateShoppingListShareCode: ShoppingList;
  /** Hard delete a device permanently (admin only) */
  hardDeleteDevice: Scalars['Boolean']['output'];
  /** Import items from CSV file */
  importItemsFromCSV: ImportItemsResponse;
  /** Import items from external provider (USDA, Spoonacular, etc.) */
  importItemsFromProvider: ImportItemsResponse;
  incrementRecipeCookedCount: SavedRecipe;
  inviteToHome: HomeInvite;
  inviteToShoppingList: ShoppingListCollaborator;
  joinHomeByCode: Membership;
  joinShoppingListByShareCode: ShoppingList;
  leaveHome: Scalars['Boolean']['output'];
  linkItemToExternalSource: ExternalSourceMapping;
  logCooking: CookingLog;
  login: AuthPayload;
  markAllNotificationsAsRead: Array<Notification>;
  markAsTemplate: ShoppingList;
  markExpirationAction: ExpirationNotification;
  markExpirationNotificationAsRead: ExpirationNotification;
  markItemPurchased: ShoppingListItem;
  markLoginAsReviewed: LoginHistory;
  markMultipleLoginsAsReviewed: Array<LoginHistory>;
  markNotificationAsRead: Notification;
  markNotificationUnread: Notification;
  markPantryItemExpired: PantryItem;
  /** Mark recipe as cooked and optionally deduct from pantry */
  markRecipeAsCooked: CookingLog;
  /** Merge duplicate items into one */
  mergeItems: Item;
  /**
   * Move all purchased items from a shopping list to the home's default pantry.
   * Only available for shopping lists linked to a home.
   * Items without an itemId (custom items not in catalog) will be skipped.
   */
  movePurchasedItemsToPantry: MovePurchasedItemsResult;
  /**
   * Move a shopping list item to the pantry after purchase.
   * Creates a PantryItem with full traceability back to the shopping list item.
   * Optionally removes the item from the shopping list.
   */
  moveShoppingItemToPantry: PantryItem;
  moveShoppingListItem: ShoppingListItem;
  openPantryItem: PantryItem;
  putUnderReview: UserModeration;
  recordLoginAttempt: LoginHistory;
  recordPantryItemWaste: PantryItem;
  /** Manually record pantry item usage */
  recordPantryUsage: PantryItemUsage;
  /** Record a price observation for historical tracking */
  recordPriceObservation: ItemPriceHistory;
  refresh: RefreshTokenPayload;
  register: AuthPayload;
  /**
   * Register a new device for the current user.
   * This is the primary way to add a device from mobile apps.
   */
  registerDevice: Device;
  /** Reject a user-created item */
  rejectItem: Scalars['Boolean']['output'];
  removeCollaborator: Scalars['Boolean']['output'];
  removeItemFromShoppingList: ShoppingListItem;
  removeMember: Scalars['Boolean']['output'];
  removeProfileAvatar: UserProfile;
  removeProfileCover: UserProfile;
  removeRestriction: Scalars['Boolean']['output'];
  removeRestrictions: UserModeration;
  removeShoppingListCollaborator: Scalars['Boolean']['output'];
  /** Remove an item from a template */
  removeTemplateItem: Scalars['Boolean']['output'];
  removeUnitConversion: Unit;
  /**
   * Reorder multiple storage locations
   * All locations must belong to the same home
   * Requires user to have edit permissions in the home
   */
  reorderStorageLocations: Scalars['Boolean']['output'];
  resendVerificationEmail: Scalars['Boolean']['output'];
  /** Reset password using token from email */
  resetPassword: ResetPasswordResponse;
  /**
   * Restock a pantry item - adds quantity and creates a ledger record.
   * Use this when replenishing an existing pantry item.
   */
  restockPantryItem: PantryItemUsage;
  /** Restore a soft-deleted item */
  restoreItem: Item;
  reviewAppeal: UserModeration;
  revokeHomeInvite: Scalars['Boolean']['output'];
  sendBulkNotifications: BulkNotificationResult;
  sendTestNotification: Notification;
  setDefaultHome: UserSettings;
  setDefaultPantry: Pantry;
  setDefaultShoppingList: ShoppingList;
  /**
   * Set a storage location as the default for its home
   * Automatically unsets the previous default location
   * Requires user to have edit permissions in the home
   */
  setDefaultStorageLocation: StorageLocation;
  setReminder: ShoppingList;
  setupRecurring: ShoppingList;
  setupUnitConversion: Unit;
  shareShoppingList: ShoppingList;
  submitAppeal: UserModeration;
  suspendUser: UserModeration;
  /** Sync all item prices for a store */
  syncAllItemPrices: BulkOperationSummary;
  syncDeletePantryItem: SyncPantryItemResult;
  syncDeleteShoppingListItem: SyncShoppingListItemResult;
  /** Sync item offers from store */
  syncItemOffers: Item;
  /** Sync item prices from stores */
  syncItemPrices: Item;
  /** Sync item data with external provider */
  syncItemWithProvider: Item;
  syncMovePantryItem: SyncPantryItemResult;
  syncMoveShoppingListItem: SyncShoppingListItemResult;
  syncPantryItem: SyncPantryItemResult;
  syncShoppingListItem: SyncShoppingListItemResult;
  toggleShoppingListItemPurchased: ShoppingListItem;
  transferHomeOwnership: HomeOwnership;
  unbanUser: UserModeration;
  uncategorizeItem: Scalars['Boolean']['output'];
  uncompleteShoppingList: ShoppingList;
  unfavoriteRecipe: Scalars['Boolean']['output'];
  unsuspendUser: UserModeration;
  updateBrand: Brand;
  updateCategory: Category;
  updateCollaboratorPermissions: ShoppingListCollaborator;
  updateCollaboratorRole: Scalars['Boolean']['output'];
  updateCookingLog: CookingLog;
  updateCurrency: Currency;
  /**
   * Update a device. Consolidated mutation that handles all device updates including:
   * - Status changes (trust, verify, activate/deactivate)
   * - Location updates
   * - Push token management
   * - Hardware info updates
   * - Battery info updates
   * - Peripheral updates
   * - Soft delete
   */
  updateDevice: Device;
  updateDietaryProfile: DietaryProfile;
  updateFavoriteRecipe: SavedRecipe;
  updateHome: Home;
  /**
   * Update an item. Consolidated mutation that handles:
   * - Basic fields (name, description, type, etc.)
   * - Categories (set, add, remove)
   * - Brands (set, add, remove)
   * - Units (set, add, remove, default)
   * - Tags (set, add, remove)
   * - Nutrition facts, allergens, ingredients
   * - Images
   * - Metadata
   * - Price updates
   */
  updateItem: Item;
  updateLoginHistory: LoginHistory;
  updateLoginSession: LoginHistory;
  updateMealPlan: MealPlan;
  /** Update an existing meal template */
  updateMealTemplate: MealTemplate;
  updateMembership: Membership;
  updateModerationStatus: UserModeration;
  updateNotification: Notification;
  updateNotificationPreferences: NotificationPreferences;
  updatePantry: Pantry;
  updatePantryItem: PantryItem;
  updatePantryItemLocation: PantryItem;
  /** Update pantry item quantity (supports fractions) */
  updatePantryItemQuantity: PantryItem;
  updateProfile: UserProfile;
  updateProfileAvatar: UserProfile;
  updateProfileCover: UserProfile;
  updatePurchase: Purchase;
  updateRecipe: Recipe;
  updateRecipeIngredients: Recipe;
  updateRestriction: DietaryRestriction;
  updateRiskScore: UserModeration;
  updateSettings: UserSettings;
  updateShoppingList: ShoppingList;
  updateShoppingListItem: ShoppingListItem;
  updateShoppingListItemNotes: ShoppingListItem;
  updateShoppingListItemPriority: ShoppingListItem;
  /** Update shopping list item quantity (supports fractions) */
  updateShoppingListItemQuantity: ShoppingListItem;
  /**
   * Update an existing storage location
   * Validates parent-child relationships and prevents circular references
   * Requires user to have edit permissions in the home
   */
  updateStorageLocation: StorageLocation;
  updateStore: Store;
  updateStoreInfo: StoreInfo;
  updateStorePriceAccuracy: Store;
  updateStoreQualityRating: Store;
  /** Update a template item */
  updateTemplateItem: MealTemplateItem;
  updateTrustLevel: UserModeration;
  updateUnit: Unit;
  updateUser: User;
  updateUserAddress: UserAddress;
  upsertItemByExternalSource: UpsertItemResult;
  /** Add or update item-specific unit conversion */
  upsertItemUnitConversion: ItemUnitConversion;
  /** Validate item data integrity */
  validateItem: ValidationResult;
  /** Validate if a password reset token is still valid */
  validatePasswordResetToken: ValidateTokenResponse;
  verifyEmail: Scalars['Boolean']['output'];
  verifyUserEmail: User;
};

export type MutationAcceptHomeInviteArgs = {
  token: Scalars['String']['input'];
};

export type MutationAcceptShoppingListInviteArgs = {
  token: Scalars['String']['input'];
};

export type MutationAddCollaboratorArgs = {
  data: AddCollaboratorInput;
};

export type MutationAddItemToShoppingListArgs = {
  input: CreateShoppingListItemInput;
};

export type MutationAddLowStockItemsToShoppingListArgs = {
  homeId: Scalars['ID']['input'];
  shoppingListId?: InputMaybe<Scalars['ID']['input']>;
};

export type MutationAddPantryItemToShoppingListArgs = {
  pantryItemId: Scalars['ID']['input'];
  quantity?: InputMaybe<Scalars['Float']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type MutationAddRecipeToShoppingListArgs = {
  checkPantry?: InputMaybe<Scalars['Boolean']['input']>;
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type MutationAddRestrictionArgs = {
  input: AddRestrictionInput;
};

export type MutationAddRestrictionsArgs = {
  input: AddRestrictionsInput;
};

export type MutationAddTemplateItemArgs = {
  input: AddTemplateItemInput;
};

export type MutationAddUserAddressArgs = {
  input: CreateUserAddressInput;
};

export type MutationAddWarningArgs = {
  input: AddWarningInput;
};

export type MutationAdminDeleteUserArgs = {
  id: Scalars['ID']['input'];
};

export type MutationApproveItemArgs = {
  itemId: Scalars['ID']['input'];
};

export type MutationArchiveShoppingListArgs = {
  id: Scalars['ID']['input'];
};

export type MutationBanUserArgs = {
  input: BanUserInput;
};

export type MutationBulkCreateItemsArgs = {
  input: BulkCreateItemInput;
};

export type MutationBulkDeleteItemsArgs = {
  ids: Array<Scalars['ID']['input']>;
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type MutationBulkUpdateDevicesArgs = {
  ids: Array<Scalars['ID']['input']>;
  input: BulkDeviceUpdateInput;
};

export type MutationBulkUpdateItemsArgs = {
  ids: Array<Scalars['ID']['input']>;
  input: UpdateItemInput;
};

export type MutationCancelRecurringArgs = {
  id: Scalars['ID']['input'];
};

export type MutationCategorizeItemArgs = {
  categoryId: Scalars['ID']['input'];
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
};

export type MutationChangePasswordArgs = {
  input: ChangePasswordInput;
};

export type MutationCleanupDevicesArgs = {
  input: DeviceCleanupInput;
};

export type MutationClearReminderArgs = {
  id: Scalars['ID']['input'];
};

export type MutationCompleteReviewArgs = {
  newStatus: ModerationStatus;
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type MutationCompleteShoppingListArgs = {
  id: Scalars['ID']['input'];
  input: CompleteShoppingListInput;
};

export type MutationConfirmItemImageUploadArgs = {
  itemId: Scalars['String']['input'];
  key: Scalars['String']['input'];
};

export type MutationConfirmProfileImageUploadArgs = {
  key: Scalars['String']['input'];
};

export type MutationConfirmRecipeConsumptionArgs = {
  consumptions: Array<ConfirmedIngredientConsumptionInput>;
  pantryId: Scalars['ID']['input'];
  recipeId: Scalars['ID']['input'];
};

export type MutationCreateBrandArgs = {
  input: CreateBrandInput;
};

export type MutationCreateBulkPurchasesArgs = {
  purchases: Array<CreatePurchaseInput>;
};

export type MutationCreateBulkStoresArgs = {
  stores: Array<CreateStoreInput>;
};

export type MutationCreateCategoryArgs = {
  input: CreateCategoryInput;
};

export type MutationCreateCurrencyArgs = {
  input: CreateCurrencyInput;
};

export type MutationCreateFromTemplateArgs = {
  input: CreateFromTemplateInput;
};

export type MutationCreateHomeArgs = {
  input: CreateHomeInput;
};

export type MutationCreateImageUploadUrlArgs = {
  itemId?: InputMaybe<Scalars['String']['input']>;
  mime: Scalars['String']['input'];
  purpose: ImageUploadPurpose;
};

export type MutationCreateItemArgs = {
  input: CreateItemInput;
};

export type MutationCreateLoginHistoryArgs = {
  input: CreateLoginHistoryInput;
};

export type MutationCreateMealPlanArgs = {
  input: CreateMealPlanInput;
};

export type MutationCreateMealPlanFromTemplateArgs = {
  input: CreateMealPlanFromTemplateInput;
};

export type MutationCreateMealTemplateArgs = {
  input: CreateMealTemplateInput;
};

export type MutationCreateMembershipArgs = {
  input: CreateMembershipInput;
};

export type MutationCreateModerationRecordArgs = {
  input: CreateUserModerationInput;
};

export type MutationCreateNotificationArgs = {
  input: CreateNotificationInput;
};

export type MutationCreatePantryArgs = {
  input: CreatePantryInput;
};

export type MutationCreatePantryItemArgs = {
  input: CreatePantryItemInput;
};

export type MutationCreatePantryItemUsageArgs = {
  input: RecordPantryItemUsageInput;
};

export type MutationCreateProfileArgs = {
  input: CreateUserProfileInput;
};

export type MutationCreatePurchaseArgs = {
  input: CreatePurchaseInput;
};

export type MutationCreateRecipeArgs = {
  input: CreateRecipeInput;
};

export type MutationCreateShoppingListArgs = {
  input: CreateShoppingListInput;
};

export type MutationCreateShoppingListItemFromRecipeIngredientArgs = {
  quantityOverride?: InputMaybe<Scalars['Float']['input']>;
  recipeIngredientId: Scalars['ID']['input'];
  shoppingListId: Scalars['ID']['input'];
};

export type MutationCreateShoppingListItemsFromRecipeArgs = {
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Int']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type MutationCreateStorageLocationArgs = {
  input: CreateStorageLocationInput;
};

export type MutationCreateStoreArgs = {
  input: CreateStoreInput;
};

export type MutationCreateTemplateFromMealPlanArgs = {
  input: CreateTemplateFromMealPlanInput;
};

export type MutationCreateUnitArgs = {
  input: CreateUnitInput;
};

export type MutationCreateUploadUrlArgs = {
  ext: Scalars['String']['input'];
  mime: Scalars['String']['input'];
};

export type MutationDeclineHomeInviteArgs = {
  token: Scalars['String']['input'];
};

export type MutationDeclineShoppingListInviteArgs = {
  token: Scalars['String']['input'];
};

export type MutationDeleteBrandArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteBulkPurchasesArgs = {
  purchaseIds: Array<Scalars['ID']['input']>;
};

export type MutationDeleteCategoryArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteCookingLogArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteCurrencyArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteHomeArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteItemArgs = {
  id: Scalars['ID']['input'];
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type MutationDeleteMealPlanArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteMealTemplateArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteMultipleNotificationsArgs = {
  ids: Array<Scalars['ID']['input']>;
};

export type MutationDeleteNotificationArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeletePantryArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeletePantryItemArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeletePurchaseArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteRecipeArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteShoppingListArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteStorageLocationArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteStoreArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteUnitArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteUserAddressArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDismissExpirationNotificationArgs = {
  input: DismissNotificationInput;
};

export type MutationDuplicateTemplateArgs = {
  id: Scalars['ID']['input'];
  newName: Scalars['String']['input'];
};

export type MutationExportItemsArgs = {
  filters?: InputMaybe<ItemFilters>;
  format: ExportFormat;
};

export type MutationFavoriteRecipeArgs = {
  input: FavoriteRecipeInput;
};

export type MutationFlagItemForReviewArgs = {
  itemId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};

export type MutationFlagLoginAsRiskyArgs = {
  flaggedById: Scalars['ID']['input'];
  loginId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
};

export type MutationFlagMultipleLoginsAsRiskyArgs = {
  flaggedById: Scalars['ID']['input'];
  loginIds: Array<Scalars['ID']['input']>;
  reason: Scalars['String']['input'];
};

export type MutationForgotPasswordArgs = {
  email: Scalars['String']['input'];
};

export type MutationForkRecipeArgs = {
  id: Scalars['ID']['input'];
};

export type MutationGenerateNextRecurringListArgs = {
  id: Scalars['ID']['input'];
};

export type MutationGenerateShoppingListShareCodeArgs = {
  id: Scalars['ID']['input'];
};

export type MutationHardDeleteDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type MutationImportItemsFromCsvArgs = {
  file: Scalars['Upload']['input'];
  mappings?: InputMaybe<Scalars['JSON']['input']>;
  skipDuplicates?: InputMaybe<Scalars['Boolean']['input']>;
};

export type MutationImportItemsFromProviderArgs = {
  input: ImportItemsFromProviderInput;
};

export type MutationIncrementRecipeCookedCountArgs = {
  recipeId: Scalars['ID']['input'];
};

export type MutationInviteToHomeArgs = {
  input: InviteToHomeInput;
};

export type MutationInviteToShoppingListArgs = {
  input: InviteToShoppingListInput;
};

export type MutationJoinHomeByCodeArgs = {
  joinCode: Scalars['String']['input'];
};

export type MutationJoinShoppingListByShareCodeArgs = {
  shareCode: Scalars['String']['input'];
};

export type MutationLeaveHomeArgs = {
  homeId: Scalars['ID']['input'];
};

export type MutationLinkItemToExternalSourceArgs = {
  data?: InputMaybe<Scalars['JSON']['input']>;
  externalId: Scalars['String']['input'];
  externalType?: InputMaybe<Scalars['String']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
  source: ExternalSource;
};

export type MutationLogCookingArgs = {
  input: CreateCookingLogInput;
};

export type MutationLoginArgs = {
  input: LoginInput;
};

export type MutationMarkAsTemplateArgs = {
  id: Scalars['ID']['input'];
  input: MarkAsTemplateInput;
};

export type MutationMarkExpirationActionArgs = {
  input: MarkActionInput;
};

export type MutationMarkExpirationNotificationAsReadArgs = {
  notificationId: Scalars['ID']['input'];
};

export type MutationMarkItemPurchasedArgs = {
  id: Scalars['ID']['input'];
  status: Scalars['Boolean']['input'];
};

export type MutationMarkLoginAsReviewedArgs = {
  loginId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  reviewerId: Scalars['ID']['input'];
};

export type MutationMarkMultipleLoginsAsReviewedArgs = {
  loginIds: Array<Scalars['ID']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  reviewerId: Scalars['ID']['input'];
};

export type MutationMarkNotificationAsReadArgs = {
  id: Scalars['ID']['input'];
};

export type MutationMarkNotificationUnreadArgs = {
  id: Scalars['ID']['input'];
};

export type MutationMarkPantryItemExpiredArgs = {
  id: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationMarkRecipeAsCookedArgs = {
  deductFromPantry: Scalars['Boolean']['input'];
  ingredientsUsed?: InputMaybe<Array<IngredientUsageInput>>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
};

export type MutationMergeItemsArgs = {
  duplicateIds: Array<Scalars['ID']['input']>;
  primaryId: Scalars['ID']['input'];
};

export type MutationMovePurchasedItemsToPantryArgs = {
  shoppingListId: Scalars['ID']['input'];
};

export type MutationMoveShoppingItemToPantryArgs = {
  input: MoveShoppingItemToPantryInput;
};

export type MutationMoveShoppingListItemArgs = {
  input: MoveShoppingListItemInput;
};

export type MutationOpenPantryItemArgs = {
  id: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationPutUnderReviewArgs = {
  input: PutUnderReviewInput;
};

export type MutationRecordLoginAttemptArgs = {
  input: LoginAttemptInput;
};

export type MutationRecordPantryItemWasteArgs = {
  id: Scalars['ID']['input'];
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  wasteAmount: Scalars['Float']['input'];
  wasteReason: WasteReason;
  wasteUnitId?: InputMaybe<Scalars['String']['input']>;
  wasteWeight?: InputMaybe<Scalars['Float']['input']>;
  wasteWeightUnitId?: InputMaybe<Scalars['String']['input']>;
};

export type MutationRecordPantryUsageArgs = {
  notes?: InputMaybe<Scalars['String']['input']>;
  pantryItemId: Scalars['ID']['input'];
  purpose?: InputMaybe<Scalars['String']['input']>;
  quantity: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
};

export type MutationRecordPriceObservationArgs = {
  input: RecordPriceObservationInput;
};

export type MutationRefreshArgs = {
  token: Scalars['String']['input'];
};

export type MutationRegisterArgs = {
  input: RegisterInput;
};

export type MutationRegisterDeviceArgs = {
  input: DeviceRegistrationInput;
};

export type MutationRejectItemArgs = {
  input: RejectItemInput;
};

export type MutationRemoveCollaboratorArgs = {
  data: RemoveCollaboratorInput;
};

export type MutationRemoveItemFromShoppingListArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveMemberArgs = {
  membershipId: Scalars['ID']['input'];
};

export type MutationRemoveRestrictionArgs = {
  input: RemoveRestrictionInput;
};

export type MutationRemoveRestrictionsArgs = {
  input: RemoveRestrictionsInput;
};

export type MutationRemoveShoppingListCollaboratorArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveTemplateItemArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveUnitConversionArgs = {
  unitId: Scalars['ID']['input'];
};

export type MutationReorderStorageLocationsArgs = {
  input: ReorderStorageLocationsInput;
};

export type MutationResendVerificationEmailArgs = {
  email: Scalars['String']['input'];
};

export type MutationResetPasswordArgs = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type MutationRestockPantryItemArgs = {
  id: Scalars['ID']['input'];
  input: RestockPantryItemInput;
};

export type MutationRestoreItemArgs = {
  id: Scalars['ID']['input'];
};

export type MutationReviewAppealArgs = {
  input: ReviewAppealInput;
};

export type MutationRevokeHomeInviteArgs = {
  id: Scalars['ID']['input'];
};

export type MutationSendBulkNotificationsArgs = {
  input: BulkNotificationInput;
};

export type MutationSendTestNotificationArgs = {
  type: NotificationType;
};

export type MutationSetDefaultHomeArgs = {
  homeId: Scalars['ID']['input'];
};

export type MutationSetDefaultPantryArgs = {
  id: Scalars['ID']['input'];
};

export type MutationSetDefaultShoppingListArgs = {
  id: Scalars['ID']['input'];
};

export type MutationSetDefaultStorageLocationArgs = {
  id: Scalars['ID']['input'];
};

export type MutationSetReminderArgs = {
  id: Scalars['ID']['input'];
  input: SetReminderInput;
};

export type MutationSetupRecurringArgs = {
  id: Scalars['ID']['input'];
  input: SetupRecurringInput;
};

export type MutationSetupUnitConversionArgs = {
  baseUnitId: Scalars['ID']['input'];
  conversionFactor: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
};

export type MutationShareShoppingListArgs = {
  id: Scalars['ID']['input'];
  input: ShareShoppingListInput;
};

export type MutationSubmitAppealArgs = {
  input: SubmitAppealInput;
};

export type MutationSuspendUserArgs = {
  input: SuspendUserInput;
};

export type MutationSyncAllItemPricesArgs = {
  batchSize?: InputMaybe<Scalars['Int']['input']>;
  storeId: Scalars['String']['input'];
};

export type MutationSyncDeletePantryItemArgs = {
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationSyncDeleteShoppingListItemArgs = {
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationSyncItemOffersArgs = {
  itemId: Scalars['ID']['input'];
  storeId: Scalars['String']['input'];
};

export type MutationSyncItemPricesArgs = {
  itemId: Scalars['ID']['input'];
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type MutationSyncItemWithProviderArgs = {
  itemId: Scalars['ID']['input'];
  provider: ProviderType;
};

export type MutationSyncMovePantryItemArgs = {
  afterId?: InputMaybe<Scalars['ID']['input']>;
  beforeId?: InputMaybe<Scalars['ID']['input']>;
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationSyncMoveShoppingListItemArgs = {
  afterId?: InputMaybe<Scalars['ID']['input']>;
  beforeId?: InputMaybe<Scalars['ID']['input']>;
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationSyncPantryItemArgs = {
  clientId: Scalars['ID']['input'];
  input: SyncPantryItemInput;
};

export type MutationSyncShoppingListItemArgs = {
  clientId: Scalars['ID']['input'];
  input: SyncShoppingListItemInput;
};

export type MutationToggleShoppingListItemPurchasedArgs = {
  id: Scalars['ID']['input'];
  purchased: Scalars['Boolean']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationTransferHomeOwnershipArgs = {
  homeId: Scalars['ID']['input'];
  newOwnerId: Scalars['ID']['input'];
};

export type MutationUnbanUserArgs = {
  userId: Scalars['ID']['input'];
};

export type MutationUncategorizeItemArgs = {
  categoryId: Scalars['ID']['input'];
  itemId: Scalars['ID']['input'];
};

export type MutationUncompleteShoppingListArgs = {
  id: Scalars['ID']['input'];
};

export type MutationUnfavoriteRecipeArgs = {
  recipeId: Scalars['ID']['input'];
};

export type MutationUnsuspendUserArgs = {
  userId: Scalars['ID']['input'];
};

export type MutationUpdateBrandArgs = {
  input: UpdateBrandInput;
};

export type MutationUpdateCategoryArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCategoryInput;
};

export type MutationUpdateCollaboratorPermissionsArgs = {
  collaboratorId: Scalars['ID']['input'];
  permissions: UpdateCollaboratorPermissionsInput;
  shoppingListId: Scalars['ID']['input'];
};

export type MutationUpdateCollaboratorRoleArgs = {
  collaboratorId: Scalars['ID']['input'];
  role: CollaboratorRole;
  shoppingListId: Scalars['ID']['input'];
};

export type MutationUpdateCookingLogArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCookingLogInput;
};

export type MutationUpdateCurrencyArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCurrencyInput;
};

export type MutationUpdateDeviceArgs = {
  id: Scalars['ID']['input'];
  input: UpdateDeviceInput;
};

export type MutationUpdateDietaryProfileArgs = {
  input: UpdateDietaryProfileInput;
};

export type MutationUpdateFavoriteRecipeArgs = {
  input: UpdateFavoriteRecipeInput;
  recipeId: Scalars['ID']['input'];
};

export type MutationUpdateHomeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateHomeInput;
};

export type MutationUpdateItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdateItemInput;
};

export type MutationUpdateLoginHistoryArgs = {
  id: Scalars['ID']['input'];
  input: UpdateLoginHistoryInput;
};

export type MutationUpdateLoginSessionArgs = {
  lastActivityAt?: InputMaybe<Scalars['DateTime']['input']>;
  loggedOutAt?: InputMaybe<Scalars['DateTime']['input']>;
  loginId: Scalars['ID']['input'];
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationUpdateMealPlanArgs = {
  id: Scalars['ID']['input'];
  input: UpdateMealPlanInput;
};

export type MutationUpdateMealTemplateArgs = {
  id: Scalars['ID']['input'];
  input: UpdateMealTemplateInput;
};

export type MutationUpdateMembershipArgs = {
  id: Scalars['ID']['input'];
  input: UpdateMembershipInput;
};

export type MutationUpdateModerationStatusArgs = {
  reason?: InputMaybe<Scalars['String']['input']>;
  status: ModerationStatus;
  userId: Scalars['ID']['input'];
};

export type MutationUpdateNotificationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateNotificationInput;
};

export type MutationUpdateNotificationPreferencesArgs = {
  input: UpdateNotificationPreferencesInput;
};

export type MutationUpdatePantryArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePantryInput;
};

export type MutationUpdatePantryItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePantryItemInput;
};

export type MutationUpdatePantryItemLocationArgs = {
  id: Scalars['ID']['input'];
  storageLocationId: Scalars['String']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationUpdatePantryItemQuantityArgs = {
  pantryItemId: Scalars['ID']['input'];
  quantity: Scalars['String']['input'];
  unitId?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationUpdateProfileArgs = {
  input: UpdateUserProfileInput;
};

export type MutationUpdateProfileAvatarArgs = {
  avatarUrl: Scalars['String']['input'];
};

export type MutationUpdateProfileCoverArgs = {
  coverImageUrl: Scalars['String']['input'];
};

export type MutationUpdatePurchaseArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePurchaseInput;
};

export type MutationUpdateRecipeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRecipeInput;
};

export type MutationUpdateRecipeIngredientsArgs = {
  ingredients: Array<RecipeIngredientInput>;
  recipeId: Scalars['ID']['input'];
};

export type MutationUpdateRestrictionArgs = {
  input: UpdateRestrictionInput;
};

export type MutationUpdateRiskScoreArgs = {
  riskScore: Scalars['Float']['input'];
  userId: Scalars['ID']['input'];
};

export type MutationUpdateSettingsArgs = {
  input: UpdateUserSettingsInput;
};

export type MutationUpdateShoppingListArgs = {
  id: Scalars['ID']['input'];
  input: UpdateShoppingListInput;
};

export type MutationUpdateShoppingListItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdateShoppingListItemInput;
};

export type MutationUpdateShoppingListItemNotesArgs = {
  id: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationUpdateShoppingListItemPriorityArgs = {
  id: Scalars['ID']['input'];
  priority: Scalars['Int']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationUpdateShoppingListItemQuantityArgs = {
  itemId: Scalars['ID']['input'];
  quantity: Scalars['String']['input'];
  unitId?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationUpdateStorageLocationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateStorageLocationInput;
};

export type MutationUpdateStoreArgs = {
  id: Scalars['ID']['input'];
  input: UpdateStoreInput;
};

export type MutationUpdateStoreInfoArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  hoursJSON?: InputMaybe<Scalars['JSON']['input']>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  storeId: Scalars['ID']['input'];
  website?: InputMaybe<Scalars['String']['input']>;
};

export type MutationUpdateStorePriceAccuracyArgs = {
  accuracy: Scalars['Float']['input'];
  id: Scalars['ID']['input'];
};

export type MutationUpdateStoreQualityRatingArgs = {
  id: Scalars['ID']['input'];
  rating: Scalars['Float']['input'];
};

export type MutationUpdateTemplateItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTemplateItemInput;
};

export type MutationUpdateTrustLevelArgs = {
  trustLevel: TrustLevel;
  userId: Scalars['ID']['input'];
};

export type MutationUpdateUnitArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUnitInput;
};

export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};

export type MutationUpdateUserAddressArgs = {
  input: UpdateUserAddressInput;
};

export type MutationUpsertItemByExternalSourceArgs = {
  externalId: Scalars['String']['input'];
  externalType?: InputMaybe<Scalars['String']['input']>;
  itemData: CreateItemInput;
  source: ExternalSource;
  sourceData?: InputMaybe<Scalars['JSON']['input']>;
};

export type MutationUpsertItemUnitConversionArgs = {
  conversionRatio: Scalars['Float']['input'];
  fromUnitId: Scalars['ID']['input'];
  itemId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  toUnitId: Scalars['ID']['input'];
};

export type MutationValidateItemArgs = {
  deep?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
};

export type MutationValidatePasswordResetTokenArgs = {
  token: Scalars['String']['input'];
};

export type MutationVerifyEmailArgs = {
  code: Scalars['String']['input'];
};

export type MutationVerifyUserEmailArgs = {
  id: Scalars['ID']['input'];
};

/**
 * Standard error interface for all mutation errors.
 * All error types should implement this interface.
 */
export type MutationError = {
  /** Machine-readable error code for client handling */
  code: Scalars['String']['output'];
  /** Human-readable error message */
  message: Scalars['String']['output'];
};

export enum MutationType {
  CollaboratorAdded = 'COLLABORATOR_ADDED',
  CollaboratorRemoved = 'COLLABORATOR_REMOVED',
  Completed = 'COMPLETED',
  Created = 'CREATED',
  Deleted = 'DELETED',
  ItemAdded = 'ITEM_ADDED',
  ItemCompleted = 'ITEM_COMPLETED',
  ItemRemoved = 'ITEM_REMOVED',
  ItemUpdated = 'ITEM_UPDATED',
  StatusChanged = 'STATUS_CHANGED',
  Updated = 'UPDATED',
}

export type Node = {
  id: Scalars['ID']['output'];
};

/** Error when a requested resource is not found */
export type NotFoundError = MutationError & {
  __typename?: 'NotFoundError';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  /** ID that was searched for */
  resourceId?: Maybe<Scalars['String']['output']>;
  /** Type of resource that was not found */
  resourceType: Scalars['String']['output'];
};

/**
 * Notification type for user alerts and messages
 * Cache: None - notifications must be real-time
 */
export type Notification = Node &
  Timestamped & {
    __typename?: 'Notification';
    createdAt: Scalars['DateTime']['output'];
    id: Scalars['ID']['output'];
    payload: Scalars['JSON']['output'];
    readAt?: Maybe<Scalars['DateTime']['output']>;
    sentAt: Scalars['DateTime']['output'];
    status: NotificationStatus;
    type: NotificationType;
    user: User;
    userId: Scalars['String']['output'];
  };

export type NotificationCategoryCount = {
  __typename?: 'NotificationCategoryCount';
  category: Scalars['String']['output'];
  count: Scalars['Int']['output'];
  unreadCount: Scalars['Int']['output'];
};

export type NotificationConnection = Connection & {
  __typename?: 'NotificationConnection';
  edges: Array<NotificationEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
  unreadCount: Scalars['Int']['output'];
};

export enum NotificationDeliveryStatus {
  Cancelled = 'CANCELLED',
  Dismissed = 'DISMISSED',
  Failed = 'FAILED',
  Pending = 'PENDING',
  Read = 'READ',
  Sent = 'SENT',
}

/** Notification connection for pagination */
export type NotificationEdge = Edge & {
  __typename?: 'NotificationEdge';
  cursor: Scalars['String']['output'];
  node: Notification;
};

export type NotificationFilterInput = {
  batchId?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  dateRange?: InputMaybe<DateRangeInput>;
  priority?: InputMaybe<Priority>;
  sourceType?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<NotificationStatus>;
  type?: InputMaybe<NotificationType>;
  unreadOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export enum NotificationOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  PriorityAsc = 'PRIORITY_ASC',
  PriorityDesc = 'PRIORITY_DESC',
  SentAtAsc = 'SENT_AT_ASC',
  SentAtDesc = 'SENT_AT_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TypeAsc = 'TYPE_ASC',
  TypeDesc = 'TYPE_DESC',
}

export type NotificationPayload = {
  __typename?: 'NotificationPayload';
  mutation?: Maybe<MutationType>;
  notification?: Maybe<Notification>;
  timestamp?: Maybe<Scalars['String']['output']>;
  userId?: Maybe<Scalars['String']['output']>;
};

/**
 * User notification preferences
 * Cache: 10 minutes - preferences rarely change, always private
 */
export type NotificationPreferences = {
  __typename?: 'NotificationPreferences';
  collaborationInvites: Scalars['Boolean']['output'];
  cookingReminders: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  emailEnabled: Scalars['Boolean']['output'];
  expirationDaysThreshold: Scalars['Int']['output'];
  expirationNotificationFrequency: ExpirationFrequency;
  expirationNotifications: Scalars['Boolean']['output'];
  homeInvites: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  lowStockAlerts: Scalars['Boolean']['output'];
  mealPlanReminders: Scalars['Boolean']['output'];
  monthlyReport: Scalars['Boolean']['output'];
  pantryChanges: Scalars['Boolean']['output'];
  pushEnabled: Scalars['Boolean']['output'];
  quietHoursEnabled: Scalars['Boolean']['output'];
  quietHoursEnd?: Maybe<Scalars['String']['output']>;
  quietHoursStart?: Maybe<Scalars['String']['output']>;
  quietHoursTimezone?: Maybe<Scalars['String']['output']>;
  recipeRecommendations: Scalars['Boolean']['output'];
  sharedListUpdates: Scalars['Boolean']['output'];
  shoppingListUpdates: Scalars['Boolean']['output'];
  smsEnabled: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['String']['output'];
  weeklyDigest: Scalars['Boolean']['output'];
};

export type NotificationPreferencesInput = {
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  email?: InputMaybe<Scalars['Boolean']['input']>;
  inApp?: InputMaybe<Scalars['Boolean']['input']>;
  push?: InputMaybe<Scalars['Boolean']['input']>;
  quietHours?: InputMaybe<QuietHoursInput>;
  sms?: InputMaybe<Scalars['Boolean']['input']>;
  types?: InputMaybe<Array<NotificationType>>;
};

export type NotificationPriorityCount = {
  __typename?: 'NotificationPriorityCount';
  count: Scalars['Int']['output'];
  priority: Priority;
  unreadCount: Scalars['Int']['output'];
};

/**
 * Notification statistics
 * Cache: 1 minute - stats update frequently but can tolerate brief staleness
 */
export type NotificationStats = {
  __typename?: 'NotificationStats';
  byCategory: Array<NotificationCategoryCount>;
  byPriority: Array<NotificationPriorityCount>;
  byType: Array<NotificationTypeCount>;
  clicked: Scalars['Int']['output'];
  dismissed: Scalars['Int']['output'];
  expired: Scalars['Int']['output'];
  read: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  unread: Scalars['Int']['output'];
};

export enum NotificationStatus {
  Delivered = 'DELIVERED',
  Failed = 'FAILED',
  Pending = 'PENDING',
  Read = 'READ',
  Sent = 'SENT',
}

/**
 * Notification subscription payload
 * Cache: None - subscription events must be real-time
 */
export type NotificationSubscriptionPayload = {
  __typename?: 'NotificationSubscriptionPayload';
  mutation: MutationType;
  node: Notification;
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
};

export enum NotificationType {
  CollaborationInvite = 'COLLABORATION_INVITE',
  ExpiryReminder = 'EXPIRY_REMINDER',
  HomeInvitation = 'HOME_INVITATION',
  HomeJoined = 'HOME_JOINED',
  ItemDeleted = 'ITEM_DELETED',
  ItemUpdated = 'ITEM_UPDATED',
  ListUpdated = 'LIST_UPDATED',
  LowStock = 'LOW_STOCK',
  MembershipInvite = 'MEMBERSHIP_INVITE',
  NewItemAdded = 'NEW_ITEM_ADDED',
}

export type NotificationTypeCount = {
  __typename?: 'NotificationTypeCount';
  count: Scalars['Int']['output'];
  type: NotificationType;
  unreadCount: Scalars['Int']['output'];
};

export enum NutritionCategory {
  Macronutrient = 'MACRONUTRIENT',
  Mineral = 'MINERAL',
  Other = 'OTHER',
  Vitamin = 'VITAMIN',
}

/** Input for nutrition fact data */
export type NutritionFactInput = {
  amount: Scalars['Float']['input'];
  category?: InputMaybe<NutritionCategory>;
  dailyValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  nutrientId?: InputMaybe<Scalars['String']['input']>;
  nutrientName: Scalars['String']['input'];
  percentDailyValue?: InputMaybe<Scalars['Float']['input']>;
  unit?: InputMaybe<Scalars['String']['input']>;
  unitName: Scalars['String']['input'];
  value: Scalars['Float']['input'];
};

/** Progress toward nutrition goals from dietary profile */
export type NutritionGoalProgress = {
  __typename?: 'NutritionGoalProgress';
  caloriesProgress?: Maybe<GoalProgress>;
  carbsProgress?: Maybe<GoalProgress>;
  fatProgress?: Maybe<GoalProgress>;
  /**
   * Overall score (0-100) based on how close to targets.
   * 100 = all targets met perfectly.
   */
  overallScore: Scalars['Float']['output'];
  proteinProgress?: Maybe<GoalProgress>;
};

/** Source of nutrition data for a meal plan item */
export enum NutritionSource {
  Auto = 'AUTO',
  Manual = 'MANUAL',
  Partial = 'PARTIAL',
}

export type OfferInput = {
  brand?: InputMaybe<Scalars['String']['input']>;
  image?: InputMaybe<Scalars['String']['input']>;
  offerId: Scalars['String']['input'];
  offerType?: InputMaybe<Scalars['String']['input']>;
  rewardInfo: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  title: Scalars['String']['input'];
  validFrom?: InputMaybe<Scalars['DateTime']['input']>;
  validUntil?: InputMaybe<Scalars['DateTime']['input']>;
};

export type OfferSummary = {
  __typename?: 'OfferSummary';
  discount: Scalars['Float']['output'];
  id: Scalars['String']['output'];
  title: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

export type OperatingSystemStat = {
  __typename?: 'OperatingSystemStat';
  count: Scalars['Int']['output'];
  osName: Scalars['String']['output'];
};

/** Page information for cursor-based pagination (Relay spec) */
export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
  totalCount: Scalars['Int']['output'];
};

export type PaginationInput = {
  cursor?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type Pantry = {
  __typename?: 'Pantry';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  home: Home;
  homeId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  /** Paginated list of items in this pantry */
  itemsConnection: PantryItemConnection;
  location?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  storageLocationsConnection: StorageLocationConnection;
  tags: Array<Scalars['String']['output']>;
  temperature?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type PantryItemsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PantryItemOrderBy>;
};

/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type PantryStorageLocationsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StorageLocationOrderBy>;
};

export type PantryActivity = {
  __typename?: 'PantryActivity';
  action: PantryActivityType;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  itemName?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  newValue?: Maybe<Scalars['String']['output']>;
  oldValue?: Maybe<Scalars['String']['output']>;
  pantry: Pantry;
  pantryId: Scalars['String']['output'];
  quantity?: Maybe<Scalars['Float']['output']>;
  user: User;
  userId: Scalars['String']['output'];
};

export enum PantryActivityType {
  ItemAdded = 'ITEM_ADDED',
  ItemExpired = 'ITEM_EXPIRED',
  ItemRemoved = 'ITEM_REMOVED',
  ItemUpdated = 'ITEM_UPDATED',
  ItemUsed = 'ITEM_USED',
  PantryCreated = 'PANTRY_CREATED',
  PantryDeleted = 'PANTRY_DELETED',
  PantryUpdated = 'PANTRY_UPDATED',
  QuantityUpdated = 'QUANTITY_UPDATED',
}

export type PantryConnection = {
  __typename?: 'PantryConnection';
  edges: Array<PantryEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Deficit calculation for recipe ingredients */
export type PantryDeficit = {
  __typename?: 'PantryDeficit';
  available: Scalars['Float']['output'];
  availableItems: Array<PantryItem>;
  deficit: Scalars['Float']['output'];
  ingredient: RecipeIngredient;
  needed: Scalars['Float']['output'];
  needsToBuy: Scalars['Boolean']['output'];
  unit: Unit;
};

/** Pantry connection for pagination */
export type PantryEdge = {
  __typename?: 'PantryEdge';
  cursor: Scalars['String']['output'];
  node: Pantry;
};

export type PantryExpiringItemsAlertPayload = {
  __typename?: 'PantryExpiringItemsAlertPayload';
  daysUntilExpiration: Scalars['Int']['output'];
  expiresAt: Scalars['DateTime']['output'];
  item: PantryItem;
  pantryId: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

/** Real-time collaborative type - never cache */
export type PantryItem = {
  __typename?: 'PantryItem';
  acquisitionMethod: AcquisitionMethod;
  addedAt: Scalars['DateTime']['output'];
  addedBy?: Maybe<User>;
  brand?: Maybe<Brand>;
  condition: ItemCondition;
  consumedQuantity: Scalars['Float']['output'];
  costPerUnit?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  currentQuantity: Scalars['Float']['output'];
  expirationAlert: Scalars['Boolean']['output'];
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  initialQuantity: Scalars['Float']['output'];
  isComposted: Scalars['Boolean']['output'];
  isLowStock: Scalars['Boolean']['output'];
  isRecycled: Scalars['Boolean']['output'];
  item: Item;
  itemId: Scalars['String']['output'];
  itemName: Scalars['String']['output'];
  itemUpc?: Maybe<Scalars['String']['output']>;
  lastModifiedBy?: Maybe<User>;
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  lowStockAlert: Scalars['Boolean']['output'];
  minQuantity?: Maybe<Scalars['Float']['output']>;
  normalizedQuantity?: Maybe<Scalars['Float']['output']>;
  normalizedUnit?: Maybe<Unit>;
  normalizedUnitId?: Maybe<Scalars['String']['output']>;
  packageWeight?: Maybe<Scalars['Float']['output']>;
  packageWeightUnit?: Maybe<Unit>;
  packageWeightUnitId?: Maybe<Scalars['String']['output']>;
  pantry: Pantry;
  pantryId: Scalars['String']['output'];
  photos: Array<PantryItemPhoto>;
  purchase?: Maybe<Purchase>;
  purchaseId?: Maybe<Scalars['String']['output']>;
  restockQuantity?: Maybe<Scalars['Float']['output']>;
  storageLocation?: Maybe<StorageLocation>;
  storageNotes?: Maybe<Scalars['String']['output']>;
  storageState: StorageState;
  store?: Maybe<Store>;
  storeId?: Maybe<Scalars['String']['output']>;
  tags: Array<Scalars['String']['output']>;
  totalCost?: Maybe<Scalars['Float']['output']>;
  unit?: Maybe<Unit>;
  unitId?: Maybe<Scalars['String']['output']>;
  unitName: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  usageRecords: Array<PantryItemUsage>;
  version?: Maybe<Scalars['Int']['output']>;
  wasteAmount: Scalars['Float']['output'];
  wasteDate?: Maybe<Scalars['DateTime']['output']>;
  wasteReason?: Maybe<WasteReason>;
};

/** Audit record of a change to a pantry item */
export type PantryItemChange = {
  __typename?: 'PantryItemChange';
  changeType: ChangeType;
  changedBy: User;
  changedById: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  deviceId?: Maybe<Scalars['String']['output']>;
  field?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  newValue?: Maybe<Scalars['String']['output']>;
  oldValue?: Maybe<Scalars['String']['output']>;
  pantryItem: PantryItem;
  pantryItemId: Scalars['ID']['output'];
  source: ChangeSource;
};

/** Connection type for paginated PantryItemChange results */
export type PantryItemChangeConnection = {
  __typename?: 'PantryItemChangeConnection';
  edges: Array<PantryItemChangeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Edge type for PantryItemChange pagination */
export type PantryItemChangeEdge = {
  __typename?: 'PantryItemChangeEdge';
  cursor: Scalars['String']['output'];
  node: PantryItemChange;
};

export type PantryItemChangedPayload = {
  __typename?: 'PantryItemChangedPayload';
  item: PantryItem;
  mutation: MutationType;
  pantryId: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
};

export type PantryItemConnection = {
  __typename?: 'PantryItemConnection';
  edges: Array<PantryItemEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Pantry item connection for pagination */
export type PantryItemEdge = {
  __typename?: 'PantryItemEdge';
  cursor: Scalars['String']['output'];
  node: PantryItem;
};

export type PantryItemFilters = {
  condition?: InputMaybe<ItemCondition>;
  expirationDays?: InputMaybe<Scalars['Int']['input']>;
  expiringSoon?: InputMaybe<Scalars['Boolean']['input']>;
  itemId?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  storageState?: InputMaybe<StorageState>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** Order by options for pantry items */
export type PantryItemOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  currentQuantity?: InputMaybe<SortOrder>;
  expiresAt?: InputMaybe<SortOrder>;
  priority?: InputMaybe<SortOrder>;
};

export type PantryItemPhoto = {
  __typename?: 'PantryItemPhoto';
  id: Scalars['ID']['output'];
  imageUrl: Scalars['String']['output'];
  pantryItem: PantryItem;
  photoType: PhotoType;
  takenAt: Scalars['DateTime']['output'];
  takenBy: User;
};

export type PantryItemUsage = {
  __typename?: 'PantryItemUsage';
  conversionConfidence?: Maybe<Scalars['Float']['output']>;
  conversionRatio?: Maybe<Scalars['Float']['output']>;
  conversionSource?: Maybe<Scalars['String']['output']>;
  cookingLog?: Maybe<CookingLog>;
  cookingLogId?: Maybe<Scalars['String']['output']>;
  costPerUnit?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  mealPlanItem?: Maybe<MealPlanItem>;
  mealPlanItemId?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  pantryItem: PantryItem;
  purpose: UsagePurpose;
  quantityUsed: Scalars['Float']['output'];
  recipe?: Maybe<Recipe>;
  recipeId?: Maybe<Scalars['String']['output']>;
  store?: Maybe<Store>;
  storeId?: Maybe<Scalars['String']['output']>;
  totalCost?: Maybe<Scalars['Float']['output']>;
  usageSource: UsageSource;
  usageUnit?: Maybe<Unit>;
  usageUnitId?: Maybe<Scalars['String']['output']>;
  usedAt: Scalars['DateTime']['output'];
  usedBy?: Maybe<User>;
  weightUsed?: Maybe<Scalars['Float']['output']>;
  weightUsedUnit?: Maybe<Unit>;
  weightUsedUnitId?: Maybe<Scalars['String']['output']>;
};

export type PantryItemUsageChangedPayload = {
  __typename?: 'PantryItemUsageChangedPayload';
  mutation: MutationType;
  pantryId: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  usage: PantryItemUsage;
  userId: Scalars['String']['output'];
};

export type PantryLowStockAlertPayload = {
  __typename?: 'PantryLowStockAlertPayload';
  currentQuantity: Scalars['Float']['output'];
  item: PantryItem;
  minimumQuantity: Scalars['Float']['output'];
  pantryId: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export type PantryStats = {
  __typename?: 'PantryStats';
  activeItems: Scalars['Int']['output'];
  expiringCount: Scalars['Int']['output'];
  lowStockCount: Scalars['Int']['output'];
  totalItems: Scalars['Int']['output'];
  totalValue: Scalars['Float']['output'];
};

export type PantryUpdatedPayload = {
  __typename?: 'PantryUpdatedPayload';
  mutation: MutationType;
  node?: Maybe<Pantry>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['ID']['output'];
};

export type PantryWasteAlertPayload = {
  __typename?: 'PantryWasteAlertPayload';
  item: PantryItem;
  pantryId: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
  wasteAmount: Scalars['Float']['output'];
  wasteReason: Scalars['String']['output'];
  wasteValue?: Maybe<Scalars['Float']['output']>;
};

export type ParentCategorySuggestion = {
  __typename?: 'ParentCategorySuggestion';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  slug?: Maybe<Scalars['String']['output']>;
  type: CategoryType;
};

/** Period granularity for ledger analytics */
export enum PeriodGranularity {
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY',
}

export enum PhotoType {
  Condition = 'CONDITION',
  Expiration = 'EXPIRATION',
  General = 'GENERAL',
  Storage = 'STORAGE',
  Waste = 'WASTE',
}

export type PlatformStat = {
  __typename?: 'PlatformStat';
  count: Scalars['Int']['output'];
  platform: MobilePlatform;
};

export type PresignPayload = {
  __typename?: 'PresignPayload';
  key: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

/** Price estimate information for a shopping list item */
export type PriceEstimate = {
  __typename?: 'PriceEstimate';
  /** Average price from purchase history */
  average?: Maybe<Scalars['Float']['output']>;
  /** User-provided budget limit */
  budget?: Maybe<Scalars['Float']['output']>;
  /** User-provided estimated price */
  estimated?: Maybe<Scalars['Float']['output']>;
  /** Highest price seen */
  highest?: Maybe<Scalars['Float']['output']>;
  /** Last known actual price from purchase history */
  lastKnown?: Maybe<Scalars['Float']['output']>;
  /** When price data was last updated */
  lastUpdated?: Maybe<Scalars['DateTime']['output']>;
  /** Lowest price seen */
  lowest?: Maybe<Scalars['Float']['output']>;
};

export type PriceRangeFacet = {
  __typename?: 'PriceRangeFacet';
  count: Scalars['Int']['output'];
  label: Scalars['String']['output'];
  max: Scalars['Float']['output'];
  min: Scalars['Float']['output'];
  selected?: Maybe<Scalars['Boolean']['output']>;
};

export type PriceRangeInput = {
  includeNull?: InputMaybe<Scalars['Boolean']['input']>;
  max?: InputMaybe<Scalars['Float']['input']>;
  min?: InputMaybe<Scalars['Float']['input']>;
};

export enum PriceSource {
  CrowdSource = 'CROWD_SOURCE',
  Manual = 'MANUAL',
  PriceMatch = 'PRICE_MATCH',
  Purchase = 'PURCHASE',
  ReceiptScan = 'RECEIPT_SCAN',
  StoreApi = 'STORE_API',
  WebScraping = 'WEB_SCRAPING',
}

export enum Priority {
  High = 'HIGH',
  Low = 'LOW',
  Normal = 'NORMAL',
  Urgent = 'URGENT',
}

/**
 * Product variation data from ExternalSourceMapping
 * Represents a specific UPC/package variation of an Item
 */
export type ProductVariation = {
  __typename?: 'ProductVariation';
  brandInfo?: Maybe<VariationBrandInfo>;
  confidence?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  externalType?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  images?: Maybe<Array<VariationImage>>;
  netWeight?: Maybe<Scalars['Float']['output']>;
  netWeightUnit?: Maybe<Scalars['String']['output']>;
  packageSize?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  upc?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export enum ProfileVisibility {
  Friends = 'FRIENDS',
  Private = 'PRIVATE',
  Public = 'PUBLIC',
}

export type ProviderFilters = {
  brand?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  hasOffers?: InputMaybe<Scalars['Boolean']['input']>;
  inStock?: InputMaybe<Scalars['Boolean']['input']>;
  priceRange?: InputMaybe<PriceRangeInput>;
};

export enum ProviderType {
  Amazon = 'AMAZON',
  GiantEagle = 'GIANT_EAGLE',
  Kroger = 'KROGER',
  OpenFoodFacts = 'OPEN_FOOD_FACTS',
  Usda = 'USDA',
  Walmart = 'WALMART',
}

/** Purchase record - contains financial and shopping data */
export type Purchase = {
  __typename?: 'Purchase';
  createdAt: Scalars['DateTime']['output'];
  currency: Currency;
  currencyId: Scalars['String']['output'];
  currencySymbol: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  discountAmount?: Maybe<Scalars['Float']['output']>;
  expirationDate?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  item: Item;
  itemId: Scalars['String']['output'];
  itemName: Scalars['String']['output'];
  itemUpc?: Maybe<Scalars['String']['output']>;
  originalPrice?: Maybe<Scalars['Float']['output']>;
  pantryItems: Array<PantryItem>;
  purchaseDate: Scalars['DateTime']['output'];
  quantity: Scalars['Float']['output'];
  receiptNumber?: Maybe<Scalars['String']['output']>;
  shoppingList?: Maybe<ShoppingList>;
  shoppingListId?: Maybe<Scalars['String']['output']>;
  shoppingListItem?: Maybe<ShoppingListItem>;
  shoppingListItemId?: Maybe<Scalars['String']['output']>;
  store?: Maybe<Store>;
  storeId?: Maybe<Scalars['String']['output']>;
  storeName?: Maybe<Scalars['String']['output']>;
  totalPrice: Scalars['Float']['output'];
  transactionId?: Maybe<Scalars['String']['output']>;
  unit: Unit;
  unitId: Scalars['String']['output'];
  unitPrice: Scalars['Float']['output'];
  unitSymbol: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type PurchaseConnection = {
  __typename?: 'PurchaseConnection';
  edges: Array<PurchaseEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Purchase connection for pagination */
export type PurchaseEdge = {
  __typename?: 'PurchaseEdge';
  cursor: Scalars['String']['output'];
  node: Purchase;
};

export type PurchaseFilterInput = {
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
  shoppingListItemId?: InputMaybe<Scalars['ID']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
  storeId?: InputMaybe<Scalars['ID']['input']>;
};

/** Summary of purchase history for a shopping list item */
export type PurchaseHistorySummary = {
  __typename?: 'PurchaseHistorySummary';
  /** Date of most recent purchase */
  lastPurchaseDate?: Maybe<Scalars['DateTime']['output']>;
  /** Whether this item has been purchased before */
  previouslyPurchased: Scalars['Boolean']['output'];
  /** Total number of times purchased */
  purchaseCount: Scalars['Int']['output'];
};

/** Order by options for purchases */
export type PurchaseOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  purchaseDate?: InputMaybe<SortOrder>;
  totalPrice?: InputMaybe<SortOrder>;
};

export type PurchaseStats = {
  __typename?: 'PurchaseStats';
  averagePurchaseAmount: Scalars['Float']['output'];
  mostFrequentStore?: Maybe<Scalars['String']['output']>;
  recentPurchases: Array<Purchase>;
  totalAmountSpent: Scalars['Float']['output'];
  totalPurchases: Scalars['Int']['output'];
};

export type PutUnderReviewInput = {
  reason?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

/**
 * Quantity displayed in multiple formats
 * Useful for showing both fraction and decimal representations
 */
export type QuantityDisplay = {
  __typename?: 'QuantityDisplay';
  decimal: Scalars['Float']['output'];
  display: Scalars['String']['output'];
  fraction?: Maybe<Scalars['String']['output']>;
  mixed?: Maybe<Scalars['String']['output']>;
  unit?: Maybe<Unit>;
};

/** User preference for quantity display */
export enum QuantityDisplayPreference {
  Auto = 'AUTO',
  Decimal = 'DECIMAL',
  Fraction = 'FRACTION',
  Mixed = 'MIXED',
}

/** Input for quantity aggregation */
export type QuantityInput = {
  quantity: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  activeModerations: Array<UserModeration>;
  adminCanDeleteUser: CanDeleteAccountResult;
  /**
   * Aggregate multiple quantities of the same item
   * Useful for calculating total needed across multiple recipes
   */
  aggregateQuantities: AggregationResult;
  autocompleteCategories: AutocompleteCategoryResponse;
  autocompleteItems?: Maybe<AutocompleteResponse>;
  /**
   * Optimized autocomplete for unit selection dropdowns.
   * Returns units matching query, prioritizing common units.
   * Default limit: 10
   */
  autocompleteUnits: Array<Unit>;
  brand?: Maybe<Brand>;
  brands: Array<Brand>;
  /**
   * Calculate pantry deficit for recipe ingredients
   * Compares recipe needs against available pantry items
   */
  calculateRecipePantryDeficit: Array<PantryDeficit>;
  /**
   * Check if conversion is possible between two units
   * Returns availability and confidence level
   */
  canConvert: ConversionAvailability;
  canDeleteAccount: CanDeleteAccountResult;
  categories: Array<Category>;
  category?: Maybe<Category>;
  categoryBySlug?: Maybe<Category>;
  checkItemAvailability?: Maybe<Array<ItemAvailability>>;
  compareItemPrices?: Maybe<Array<StorePriceComparison>>;
  compatibleUnitsForItem: Array<CompatibleUnit>;
  /**
   * Convert quantity between units with item context
   * Supports both same-type (cup→tbsp) and cross-type (cup→gram) conversions
   */
  convertQuantity?: Maybe<ConversionResult>;
  convertUnit?: Maybe<ConvertedUnitValue>;
  cookingLog?: Maybe<CookingLog>;
  currencies: Array<Currency>;
  currency?: Maybe<Currency>;
  currencyByCode?: Maybe<Currency>;
  defaultPantry?: Maybe<Pantry>;
  defaultShoppingList?: Maybe<ShoppingList>;
  /** Get a single device by ID */
  device?: Maybe<Device>;
  /** Get a single device by device identifier string */
  deviceByDeviceId?: Maybe<Device>;
  /** Get device count with filters */
  deviceCount: Scalars['Int']['output'];
  /** Get device statistics for a user */
  deviceStats: DeviceStats;
  /**
   * Consolidated device query with comprehensive filtering.
   * Replaces: userDevices, myDevices, activeDevices, trustedDevices, verifiedDevices,
   * mobileDevices, tabletDevices, emulatedDevices, suspiciousDevices, devicesByPlatform,
   * devicesByManufacturer, devicesWithPeripherals, lowBatteryDevices, staleDevices
   */
  devices: DeviceConnection;
  dietaryProfile?: Maybe<DietaryProfile>;
  expirationNotification?: Maybe<ExpirationNotification>;
  frequentlyBoughtItems: Array<ShoppingListItem>;
  /**
   * Get best display unit for a quantity
   * Auto-converts to more readable units (1000mL → 1L)
   */
  getBestDisplayUnit: Unit;
  getConvertibleUnits: Array<Unit>;
  getDefaultHome?: Maybe<Home>;
  /**
   * Get all available conversions for an item
   * Returns both stored conversions and calculable standard conversions
   */
  getItemConversions: Array<ItemUnitConversion>;
  hasUrgentNotifications: Scalars['Boolean']['output'];
  home?: Maybe<Home>;
  homeByJoinCode?: Maybe<Home>;
  homeInviteByToken?: Maybe<HomeInvite>;
  homeInviteLogs: Array<InviteLog>;
  homeInviteStats: Array<HomeInviteStatsGroup>;
  homes: Array<Home>;
  inviteLogs: Array<InviteLog>;
  inviteStats: InviteStats;
  invitesSentByMe: Array<HomeInvite>;
  item?: Maybe<Item>;
  itemByExternalSource?: Maybe<Item>;
  itemPriceHistory?: Maybe<Array<ItemPriceHistory>>;
  /**
   * List items with filtering and cursor-based pagination (Relay spec).
   * Use filters for UPC, SKU, or external ID lookups:
   * - items(filters: { upc, upcFormat }) - UPC/barcode lookup
   * - items(filters: { sku, skuStoreId }) - SKU lookup
   * - items(filters: { externalId, externalProvider }) - External ID lookup
   */
  items: ItemConnection;
  itemsBySource: Array<Item>;
  /**
   * Consolidated login history query with comprehensive filtering.
   * Supports filtering by userId, ipAddress, date range, device, success/failure, and search.
   */
  loginHistories: LoginHistoryConnection;
  loginHistoryStats: LoginHistoryStats;
  /**
   * Get all low stock items for a home's pantries.
   * Returns items where currentQuantity <= minQuantity and lowStockAlert is enabled.
   */
  lowStockItems: Array<LowStockItem>;
  matchRecipeIngredientsToPantry: Array<RecipeIngredientMatch>;
  me?: Maybe<User>;
  mealPlan?: Maybe<MealPlan>;
  mealPlans: Array<MealPlan>;
  /** Get a single meal template by ID */
  mealTemplate?: Maybe<MealTemplate>;
  /** List meal templates for the current user */
  mealTemplates: Array<MealTemplate>;
  /** Count templates matching filter criteria */
  mealTemplatesCount: Scalars['Int']['output'];
  membership?: Maybe<Membership>;
  membershipStats: MembershipStats;
  myCollaboratedShoppingLists: Array<ShoppingList>;
  myCookingLogs: Array<CookingLog>;
  myCookingStats?: Maybe<CookingStats>;
  myDietaryProfile?: Maybe<DietaryProfile>;
  myExpirationNotifications: Array<ExpirationNotification>;
  myHomes?: Maybe<Array<Home>>;
  myInviteLogs: Array<InviteLog>;
  myMembershipInHome?: Maybe<Membership>;
  myMemberships?: Maybe<Array<Membership>>;
  myModeration?: Maybe<UserModeration>;
  myNotificationPreferences?: Maybe<NotificationPreferences>;
  myNotifications: NotificationConnection;
  myPendingCollaborationInvites: Array<ShoppingListCollaborator>;
  myPendingInvites: Array<HomeInvite>;
  myPurchases: Array<Purchase>;
  mySavedRecipes: Array<SavedRecipe>;
  myShoppingListInvites: Array<ShoppingListCollaborator>;
  nearbyStores: Array<Store>;
  notification?: Maybe<Notification>;
  notificationPreferences: NotificationPreferences;
  notificationStats: NotificationStats;
  pantries: Array<Pantry>;
  pantry?: Maybe<Pantry>;
  pantryItem: PantryItem;
  /**
   * Get the change history for a specific pantry item.
   * Useful for audit trails and tracking item modifications over time.
   */
  pantryItemHistory: PantryItemChangeConnection;
  /**
   * Get ledger summary for a specific pantry item showing total added, consumed, and wasted.
   * Handles mixed units by providing breakdown per unit.
   */
  pantryItemLedger: LedgerSummary;
  pantryItemUsage: Array<PantryItemUsage>;
  /**
   * Get comprehensive ledger analytics for a pantry showing additions vs consumption over time.
   * Includes cost tracking for restocks and per-period breakdowns.
   */
  pantryLedgerAnalytics: LedgerAnalytics;
  pantryStats: PantryStats;
  /**
   * Get comprehensive usage analytics for a pantry
   * Useful for building usage pattern charts and reports
   */
  pantryUsageAnalytics: UsageAnalytics;
  /**
   * Get comprehensive waste analytics for a pantry
   * Useful for building waste tracking charts and reports
   */
  pantryWasteAnalytics: WasteAnalytics;
  /**
   * Parse fractional input string to decimal
   * Handles "1/4", "1 1/4", "0.25" formats
   */
  parseQuantityInput: QuantityDisplay;
  popularBrands: Array<Brand>;
  popularCategories: Array<Category>;
  popularStores: Array<Store>;
  /** Get popular/frequently used templates */
  popularTemplates: Array<MealTemplate>;
  purchase?: Maybe<Purchase>;
  purchaseStats: PurchaseStats;
  /**
   * Get recently deleted pantry items for quick re-adding suggestions.
   * Returns soft-deleted items that are not currently in the pantry,
   * deduplicated by itemId (only shows most recent entry per item).
   * Useful for "Add to Pantry" UI to show items user previously had.
   */
  recentlyDeletedPantryItems: Array<PantryItem>;
  /**
   * Get recently deleted shopping list items for quick re-adding suggestions.
   * Returns soft-deleted items that are not currently in the shopping list,
   * deduplicated by itemId (only shows most recent entry per item).
   * Useful for "Add to List" UI to show items user previously had.
   */
  recentlyDeletedShoppingListItems: Array<ShoppingListItem>;
  recipe?: Maybe<Recipe>;
  recipeCookingLogs: Array<CookingLog>;
  recipeSuggestions: RecipeConnection;
  recipes: RecipeConnection;
  recommendedItems?: Maybe<Array<ItemSuggestion>>;
  recommendedStores: Array<Store>;
  relatedItems?: Maybe<RelatedItemsResponse>;
  rootBrands: Array<Brand>;
  rootCategories: Array<Category>;
  savedRecipe?: Maybe<SavedRecipe>;
  savedRecipeFolders: Array<Scalars['String']['output']>;
  /** Search items with cursor-based pagination (Relay spec). */
  searchItems?: Maybe<ItemConnection>;
  searchRecipes: RecipeConnection;
  searchShoppingLists: Array<ShoppingList>;
  searchStores: Array<Store>;
  /**
   * Search units by name or symbol.
   * Default limit: 10
   */
  searchUnits: Array<Unit>;
  shoppingList?: Maybe<ShoppingList>;
  shoppingListByShareCode?: Maybe<ShoppingList>;
  shoppingListCollaborators: Array<ShoppingListCollaborator>;
  shoppingListItem?: Maybe<ShoppingListItem>;
  shoppingLists: Array<ShoppingList>;
  /**
   * Get a single storage location by ID
   * Requires user to be a member of the home
   */
  storageLocation?: Maybe<StorageLocation>;
  /**
   * Get hierarchical tree of storage locations for a home
   * Returns top-level locations with nested children
   * Ideal for rendering nested location pickers
   * Requires user to be a member of the home
   */
  storageLocationTree: Array<StorageLocation>;
  /**
   * Get all active storage locations for a home (flat list)
   * Returns locations ordered by sortOrder
   * Requires user to be a member of the home
   */
  storageLocations: Array<StorageLocation>;
  store?: Maybe<Store>;
  storeByName?: Maybe<Store>;
  storeStats?: Maybe<StoreStats>;
  storeWithPriceHistory?: Maybe<Store>;
  storeWithPurchases?: Maybe<Store>;
  stores: Array<Store>;
  /**
   * Get suggested display format for a quantity
   * Based on unit rules, user preferences, and quantity value
   */
  suggestDisplayFormat: QuantityDisplay;
  suggestedItemsForList: Array<ItemSuggestion>;
  suspiciousInviteActivity: Array<InviteLog>;
  suspiciousLoginActivity: SuspiciousActivity;
  unit?: Maybe<Unit>;
  unitBySymbol?: Maybe<Unit>;
  /**
   * Get all units, optionally filtered by type and/or common flag.
   * Default limit: 50
   */
  units: Array<Unit>;
  unreadNotificationCount: Scalars['Int']['output'];
  user?: Maybe<User>;
  userModeration?: Maybe<UserModeration>;
  userProfile?: Maybe<UserProfile>;
  userSettings?: Maybe<UserSettings>;
  users: Array<User>;
  validateUpc: UpcValidation;
};

export type QueryAdminCanDeleteUserArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryAggregateQuantitiesArgs = {
  itemId: Scalars['ID']['input'];
  quantities: Array<QuantityInput>;
};

export type QueryAutocompleteCategoriesArgs = {
  input: AutocompleteCategoryInput;
};

export type QueryAutocompleteItemsArgs = {
  input: AutocompleteInput;
};

export type QueryAutocompleteUnitsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  type?: InputMaybe<UnitType>;
};

export type QueryBrandArgs = {
  id: Scalars['ID']['input'];
};

export type QueryBrandsArgs = {
  parentId?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryCalculateRecipePantryDeficitArgs = {
  householdId: Scalars['ID']['input'];
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
};

export type QueryCanConvertArgs = {
  fromUnitId: Scalars['ID']['input'];
  itemId?: InputMaybe<Scalars['ID']['input']>;
  toUnitId: Scalars['ID']['input'];
};

export type QueryCategoriesArgs = {
  parentId?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<CategoryType>;
};

export type QueryCategoryArgs = {
  id: Scalars['ID']['input'];
};

export type QueryCategoryBySlugArgs = {
  slug: Scalars['String']['input'];
};

export type QueryCheckItemAvailabilityArgs = {
  itemId: Scalars['ID']['input'];
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type QueryCompareItemPricesArgs = {
  itemId: Scalars['ID']['input'];
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type QueryCompatibleUnitsForItemArgs = {
  currentUnitId?: InputMaybe<Scalars['ID']['input']>;
  itemId: Scalars['ID']['input'];
};

export type QueryConvertQuantityArgs = {
  fromUnitId: Scalars['ID']['input'];
  itemId?: InputMaybe<Scalars['ID']['input']>;
  quantity: Scalars['Float']['input'];
  toUnitId: Scalars['ID']['input'];
};

export type QueryConvertUnitArgs = {
  fromUnitId: Scalars['ID']['input'];
  toUnitId: Scalars['ID']['input'];
  value: Scalars['Float']['input'];
};

export type QueryCookingLogArgs = {
  id: Scalars['ID']['input'];
};

export type QueryCurrenciesArgs = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QueryCurrencyArgs = {
  id: Scalars['ID']['input'];
};

export type QueryCurrencyByCodeArgs = {
  code: Scalars['String']['input'];
};

export type QueryDefaultPantryArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type QueryDeviceByDeviceIdArgs = {
  deviceId: Scalars['String']['input'];
};

export type QueryDeviceCountArgs = {
  input: DeviceCountInput;
};

export type QueryDeviceStatsArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryDevicesArgs = {
  input: DevicesQueryInput;
};

export type QueryDietaryProfileArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryExpirationNotificationArgs = {
  id: Scalars['ID']['input'];
};

export type QueryFrequentlyBoughtItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryGetBestDisplayUnitArgs = {
  currentUnitId: Scalars['ID']['input'];
  itemId?: InputMaybe<Scalars['ID']['input']>;
  quantity: Scalars['Float']['input'];
};

export type QueryGetConvertibleUnitsArgs = {
  unitId: Scalars['ID']['input'];
};

export type QueryGetItemConversionsArgs = {
  includeStandard?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
};

export type QueryHomeArgs = {
  id: Scalars['ID']['input'];
};

export type QueryHomeByJoinCodeArgs = {
  joinCode: Scalars['String']['input'];
};

export type QueryHomeInviteByTokenArgs = {
  token: Scalars['String']['input'];
};

export type QueryHomeInviteLogsArgs = {
  homeId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryHomeInviteStatsArgs = {
  homeId: Scalars['String']['input'];
};

export type QueryInviteLogsArgs = {
  inviteId: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryInviteStatsArgs = {
  inviteId: Scalars['String']['input'];
};

export type QueryItemArgs = {
  id: Scalars['ID']['input'];
};

export type QueryItemByExternalSourceArgs = {
  externalId: Scalars['String']['input'];
  source: ExternalSource;
};

export type QueryItemPriceHistoryArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
  itemId: Scalars['ID']['input'];
  storeId?: InputMaybe<Scalars['String']['input']>;
};

export type QueryItemsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<ItemFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<ItemSortInput>;
};

export type QueryItemsBySourceArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  source: ExternalSource;
};

export type QueryLoginHistoriesArgs = {
  input: LoginHistoriesInput;
};

export type QueryLoginHistoryStatsArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};

export type QueryLowStockItemsArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryMatchRecipeIngredientsToPantryArgs = {
  pantryId: Scalars['ID']['input'];
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryMealPlanArgs = {
  id: Scalars['ID']['input'];
};

export type QueryMealPlansArgs = {
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryMealTemplateArgs = {
  id: Scalars['ID']['input'];
};

export type QueryMealTemplatesArgs = {
  filter?: InputMaybe<MealTemplatesFilter>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryMealTemplatesCountArgs = {
  filter?: InputMaybe<MealTemplatesFilter>;
};

export type QueryMembershipArgs = {
  id: Scalars['ID']['input'];
};

export type QueryMembershipStatsArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryMyCookingLogsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryMyExpirationNotificationsArgs = {
  input?: InputMaybe<GetExpirationNotificationsInput>;
};

export type QueryMyInviteLogsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryMyMembershipInHomeArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryMyNotificationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<NotificationFilterInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<NotificationOrderBy>;
};

export type QueryMyPurchasesArgs = {
  filter?: InputMaybe<PurchaseFilterInput>;
};

export type QueryMySavedRecipesArgs = {
  folder?: InputMaybe<Scalars['String']['input']>;
};

export type QueryNearbyStoresArgs = {
  lat: Scalars['Float']['input'];
  lng: Scalars['Float']['input'];
  radius?: InputMaybe<Scalars['Float']['input']>;
};

export type QueryNotificationArgs = {
  id: Scalars['ID']['input'];
};

export type QueryNotificationPreferencesArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryNotificationStatsArgs = {
  filter?: InputMaybe<NotificationFilterInput>;
};

export type QueryPantriesArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryPantryArgs = {
  id: Scalars['ID']['input'];
};

export type QueryPantryItemArgs = {
  id: Scalars['ID']['input'];
};

export type QueryPantryItemHistoryArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  pantryItemId: Scalars['ID']['input'];
};

export type QueryPantryItemLedgerArgs = {
  filter?: InputMaybe<AnalyticsFilterInput>;
  pantryItemId: Scalars['ID']['input'];
};

export type QueryPantryItemUsageArgs = {
  pantryItemId: Scalars['ID']['input'];
};

export type QueryPantryLedgerAnalyticsArgs = {
  filter?: InputMaybe<AnalyticsFilterInput>;
  granularity?: InputMaybe<PeriodGranularity>;
  itemId?: InputMaybe<Scalars['String']['input']>;
  pantryId: Scalars['ID']['input'];
};

export type QueryPantryStatsArgs = {
  pantryId: Scalars['ID']['input'];
};

export type QueryPantryUsageAnalyticsArgs = {
  filter?: InputMaybe<AnalyticsFilterInput>;
  pantryId: Scalars['ID']['input'];
};

export type QueryPantryWasteAnalyticsArgs = {
  filter?: InputMaybe<AnalyticsFilterInput>;
  pantryId: Scalars['ID']['input'];
};

export type QueryParseQuantityInputArgs = {
  input: Scalars['String']['input'];
  unitId: Scalars['ID']['input'];
};

export type QueryPopularBrandsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryPopularCategoriesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<CategoryType>;
};

export type QueryPopularStoresArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryPopularTemplatesArgs = {
  take?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryPurchaseArgs = {
  id: Scalars['ID']['input'];
};

export type QueryPurchaseStatsArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type QueryRecentlyDeletedPantryItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  pantryId: Scalars['ID']['input'];
};

export type QueryRecentlyDeletedShoppingListItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type QueryRecipeArgs = {
  id: Scalars['ID']['input'];
};

export type QueryRecipeCookingLogsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  recipeId: Scalars['ID']['input'];
};

export type QueryRecipeSuggestionsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryRecipesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<RecipeCategory>;
  difficulty?: InputMaybe<Difficulty>;
  first?: InputMaybe<Scalars['Int']['input']>;
  includeDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryRecommendedItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type QueryRelatedItemsArgs = {
  itemId: Scalars['ID']['input'];
};

export type QueryRootCategoriesArgs = {
  type?: InputMaybe<CategoryType>;
};

export type QuerySavedRecipeArgs = {
  recipeId: Scalars['ID']['input'];
};

export type QuerySearchItemsArgs = {
  input: SearchItemsInput;
};

export type QuerySearchRecipesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};

export type QuerySearchShoppingListsArgs = {
  query: Scalars['String']['input'];
};

export type QuerySearchStoresArgs = {
  query: Scalars['String']['input'];
};

export type QuerySearchUnitsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  type?: InputMaybe<UnitType>;
};

export type QueryShoppingListArgs = {
  id: Scalars['ID']['input'];
};

export type QueryShoppingListByShareCodeArgs = {
  shareCode: Scalars['String']['input'];
};

export type QueryShoppingListCollaboratorsArgs = {
  shoppingListId: Scalars['ID']['input'];
};

export type QueryShoppingListItemArgs = {
  id: Scalars['ID']['input'];
};

export type QueryShoppingListsArgs = {
  filters?: InputMaybe<ShoppingListFilters>;
};

export type QueryStorageLocationArgs = {
  id: Scalars['ID']['input'];
};

export type QueryStorageLocationTreeArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryStorageLocationsArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryStoreArgs = {
  id: Scalars['ID']['input'];
};

export type QueryStoreByNameArgs = {
  name: Scalars['String']['input'];
};

export type QueryStoreStatsArgs = {
  id: Scalars['ID']['input'];
};

export type QueryStoreWithPriceHistoryArgs = {
  id: Scalars['ID']['input'];
};

export type QueryStoreWithPurchasesArgs = {
  id: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QuerySuggestDisplayFormatArgs = {
  quantity: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type QuerySuggestedItemsForListArgs = {
  shoppingListId: Scalars['ID']['input'];
};

export type QuerySuspiciousInviteActivityArgs = {
  timeWindowHours?: InputMaybe<Scalars['Int']['input']>;
};

export type QuerySuspiciousLoginActivityArgs = {
  hours?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};

export type QueryUnitArgs = {
  id: Scalars['ID']['input'];
};

export type QueryUnitBySymbolArgs = {
  symbol: Scalars['String']['input'];
};

export type QueryUnitsArgs = {
  isCommon?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<UnitType>;
};

export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type QueryUserModerationArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryUserSettingsArgs = {
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type QueryUsersArgs = {
  search?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryValidateUpcArgs = {
  upc: Scalars['String']['input'];
};

export type QuietHoursInput = {
  enabled: Scalars['Boolean']['input'];
  endTime: Scalars['String']['input'];
  startTime: Scalars['String']['input'];
  timezone: Scalars['String']['input'];
};

export type RapidAttempt = {
  __typename?: 'RapidAttempt';
  count: Scalars['Int']['output'];
  hour: Scalars['String']['output'];
};

/** Error when rate limit is exceeded */
export type RateLimitError = MutationError & {
  __typename?: 'RateLimitError';
  code: Scalars['String']['output'];
  /** The limit that was exceeded */
  limit: Scalars['Int']['output'];
  message: Scalars['String']['output'];
  /** Seconds until the limit resets */
  retryAfter: Scalars['Int']['output'];
};

/**
 * Recipe type for meal instructions and ingredients
 * Cache: 30 minutes - published recipes are static content
 */
export type Recipe = {
  __typename?: 'Recipe';
  averageRating?: Maybe<Scalars['Float']['output']>;
  caloriesPerServing?: Maybe<Scalars['Float']['output']>;
  category: RecipeCategory;
  cookTimeMinutes?: Maybe<Scalars['Int']['output']>;
  cookingLogs: Array<CookingLog>;
  createdAt: Scalars['DateTime']['output'];
  createdBy: User;
  cuisine?: Maybe<Scalars['String']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  diets: Array<Diet>;
  difficulty: Difficulty;
  externalData?: Maybe<Scalars['JSON']['output']>;
  externalId?: Maybe<Scalars['String']['output']>;
  externalSource?: Maybe<ExternalSource>;
  externalUrl?: Maybe<Scalars['String']['output']>;
  forkedFrom?: Maybe<Recipe>;
  forkedFromId?: Maybe<Scalars['ID']['output']>;
  forks: Array<Recipe>;
  healthGoals: Array<HealthGoal>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  ingredients: Array<RecipeIngredient>;
  instructions: Scalars['JSON']['output'];
  intolerances: Array<Intolerance>;
  isExternal: Scalars['Boolean']['output'];
  isPublished: Scalars['Boolean']['output'];
  isSaved: Scalars['Boolean']['output'];
  matchPercentage?: Maybe<Scalars['Float']['output']>;
  mealPlanItems: Array<MealPlanItem>;
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  nutritionData?: Maybe<Scalars['JSON']['output']>;
  originalAuthor?: Maybe<Scalars['String']['output']>;
  prepTimeMinutes?: Maybe<Scalars['Int']['output']>;
  primarySource?: Maybe<Scalars['String']['output']>;
  publishedAt?: Maybe<Scalars['DateTime']['output']>;
  rating1Count: Scalars['Int']['output'];
  rating2Count: Scalars['Int']['output'];
  rating3Count: Scalars['Int']['output'];
  rating4Count: Scalars['Int']['output'];
  rating5Count: Scalars['Int']['output'];
  reviews: Array<RecipeReview>;
  savedDetails?: Maybe<SavedRecipe>;
  servings: Scalars['Int']['output'];
  source?: Maybe<Scalars['String']['output']>;
  sourceMapping?: Maybe<RecipeSourceMapping>;
  sourceUrl?: Maybe<Scalars['String']['output']>;
  status: RecipeStatus;
  tags: Array<Scalars['String']['output']>;
  tips?: Maybe<Scalars['String']['output']>;
  totalCookingLogs: Scalars['Int']['output'];
  totalReviews: Scalars['Int']['output'];
  totalSaves: Scalars['Int']['output'];
  totalTimeMinutes?: Maybe<Scalars['Int']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
  videoUrl?: Maybe<Scalars['String']['output']>;
  visibility: Visibility;
};

export enum RecipeCategory {
  Appetizer = 'APPETIZER',
  Baking = 'BAKING',
  Beverage = 'BEVERAGE',
  Breakfast = 'BREAKFAST',
  Condiment = 'CONDIMENT',
  Dessert = 'DESSERT',
  Dinner = 'DINNER',
  Lunch = 'LUNCH',
  MainCourse = 'MAIN_COURSE',
  Sauce = 'SAUCE',
  SideDish = 'SIDE_DISH',
  Snack = 'SNACK',
}

export type RecipeConnection = {
  __typename?: 'RecipeConnection';
  edges: Array<RecipeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

export type RecipeConsumptionResult = {
  __typename?: 'RecipeConsumptionResult';
  consumedItems: Array<PantryItemUsage>;
  cookingLog?: Maybe<CookingLog>;
  failedItems: Array<ConsumptionFailure>;
  success: Scalars['Boolean']['output'];
  totalConsumed: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

/** Recipe connection for pagination */
export type RecipeEdge = {
  __typename?: 'RecipeEdge';
  cursor: Scalars['String']['output'];
  node: Recipe;
};

export type RecipeIngredient = {
  __typename?: 'RecipeIngredient';
  availablePantryItemIds: Array<Scalars['String']['output']>;
  externalSources: Array<RecipeIngredientSourceMapping>;
  id: Scalars['ID']['output'];
  image?: Maybe<Scalars['String']['output']>;
  isOptional: Scalars['Boolean']['output'];
  item?: Maybe<Item>;
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  preparation?: Maybe<Scalars['String']['output']>;
  quantity: Scalars['Float']['output'];
  recipe: Recipe;
  section?: Maybe<Scalars['String']['output']>;
  sortOrder: Scalars['Int']['output'];
  unit?: Maybe<Unit>;
};

export type RecipeIngredientInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  consistency?: InputMaybe<Scalars['String']['input']>;
  externalSources?: InputMaybe<Array<RecipeIngredientSourceInput>>;
  image?: InputMaybe<Scalars['String']['input']>;
  isOptional?: InputMaybe<Scalars['Boolean']['input']>;
  itemId?: InputMaybe<Scalars['String']['input']>;
  meta?: InputMaybe<Array<Scalars['String']['input']>>;
  metricAmount?: InputMaybe<Scalars['Float']['input']>;
  metricUnit?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  originalString?: InputMaybe<Scalars['String']['input']>;
  preparation?: InputMaybe<Scalars['String']['input']>;
  quantity: Scalars['Float']['input'];
  section?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  spoonacularIngredientId?: InputMaybe<Scalars['Int']['input']>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  usAmount?: InputMaybe<Scalars['Float']['input']>;
  usUnit?: InputMaybe<Scalars['String']['input']>;
};

export type RecipeIngredientMatch = {
  __typename?: 'RecipeIngredientMatch';
  alternativeMatches: Array<PantryItem>;
  availableQuantity: Scalars['Float']['output'];
  ingredient: RecipeIngredient;
  isAvailable: Scalars['Boolean']['output'];
  matchConfidence: Scalars['Float']['output'];
  matchedPantryItem?: Maybe<PantryItem>;
  shortfall?: Maybe<Scalars['Float']['output']>;
  suggestedQuantity: Scalars['Float']['output'];
  suggestedUnit?: Maybe<Unit>;
};

export type RecipeIngredientSourceInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  consistency?: InputMaybe<Scalars['String']['input']>;
  data?: InputMaybe<Scalars['JSON']['input']>;
  externalId: Scalars['String']['input'];
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  originalName?: InputMaybe<Scalars['String']['input']>;
  originalString?: InputMaybe<Scalars['String']['input']>;
  source: ExternalSource;
};

export type RecipeIngredientSourceMapping = {
  __typename?: 'RecipeIngredientSourceMapping';
  aisle?: Maybe<Scalars['String']['output']>;
  consistency?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  data?: Maybe<Scalars['JSON']['output']>;
  externalId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  isPrimary: Scalars['Boolean']['output'];
  lastSyncedAt: Scalars['DateTime']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  originalName?: Maybe<Scalars['String']['output']>;
  originalString?: Maybe<Scalars['String']['output']>;
  recipeIngredient: RecipeIngredient;
  source: ExternalSource;
  updatedAt: Scalars['DateTime']['output'];
};

export type RecipeReview = {
  __typename?: 'RecipeReview';
  comment?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  helpful: Scalars['Int']['output'];
  helpfulVotes: Array<ReviewHelpful>;
  id: Scalars['ID']['output'];
  rating: Scalars['Int']['output'];
  recipe: Recipe;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  verified: Scalars['Boolean']['output'];
};

export type RecipeSourceMapping = {
  __typename?: 'RecipeSourceMapping';
  createdAt: Scalars['DateTime']['output'];
  data?: Maybe<Scalars['JSON']['output']>;
  externalId: Scalars['String']['output'];
  externalType?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  lastSyncedAt?: Maybe<Scalars['DateTime']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  source: ExternalSource;
  updatedAt: Scalars['DateTime']['output'];
};

export enum RecipeStatus {
  Archived = 'ARCHIVED',
  Draft = 'DRAFT',
  Private = 'PRIVATE',
  Published = 'PUBLISHED',
}

export type RecordPantryItemUsageInput = {
  cookingLogId?: InputMaybe<Scalars['String']['input']>;
  mealPlanItemId?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  pantryItemId: Scalars['ID']['input'];
  purpose: UsagePurpose;
  quantityUsed: Scalars['Float']['input'];
  recipeId?: InputMaybe<Scalars['String']['input']>;
  usageUnitId?: InputMaybe<Scalars['String']['input']>;
  weightUsed?: InputMaybe<Scalars['Float']['input']>;
  weightUsedUnitId?: InputMaybe<Scalars['String']['input']>;
};

/** Input for recording a price observation (historical tracking) */
export type RecordPriceObservationInput = {
  itemId: Scalars['ID']['input'];
  observedAt?: InputMaybe<Scalars['DateTime']['input']>;
  price: Scalars['Float']['input'];
  storeId: Scalars['String']['input'];
};

export enum RecurringPattern {
  Biweekly = 'BIWEEKLY',
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY',
}

/** Token refresh response - NEVER cache */
export type RefreshTokenPayload = {
  __typename?: 'RefreshTokenPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
};

export type RegisterInput = {
  email: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
};

/** Input for rejecting a user-created item */
export type RejectItemInput = {
  itemId: Scalars['ID']['input'];
  notifyUser?: InputMaybe<Scalars['Boolean']['input']>;
  reason: Scalars['String']['input'];
};

export type RelatedItemsResponse = {
  __typename?: 'RelatedItemsResponse';
  complementaryItems: Array<ItemSuggestion>;
  frequentlyBoughtTogether: Array<ItemSuggestion>;
  similarItems: Array<ItemSuggestion>;
};

export enum ReligiousDiet {
  Halal = 'HALAL',
  Kosher = 'KOSHER',
}

export type RemoveCollaboratorInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type RemoveRestrictionInput = {
  id: Scalars['ID']['input'];
};

export type RemoveRestrictionsInput = {
  restrictions: Array<ModerationRestriction>;
  userId: Scalars['ID']['input'];
};

/**
 * Input for reordering multiple storage locations
 * Arrays must be the same length
 */
export type ReorderStorageLocationsInput = {
  /** Array of location IDs to reorder */
  locationIds: Array<Scalars['ID']['input']>;
  /** Array of new sort orders (must match locationIds length) */
  sortOrders: Array<Scalars['Int']['input']>;
};

export type ResetPasswordInput = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type ResetPasswordResponse = {
  __typename?: 'ResetPasswordResponse';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Input for restocking a pantry item - adds quantity and creates ledger record */
export type RestockPantryItemInput = {
  costPerUnit?: InputMaybe<Scalars['Float']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  quantity: Scalars['Float']['input'];
  restockedAt?: InputMaybe<Scalars['DateTime']['input']>;
  storeId?: InputMaybe<Scalars['String']['input']>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  weight?: InputMaybe<Scalars['Float']['input']>;
  weightUnitId?: InputMaybe<Scalars['String']['input']>;
};

export enum RestrictionSeverity {
  Allergy = 'ALLERGY',
  Goal = 'GOAL',
  Intolerance = 'INTOLERANCE',
  Preference = 'PREFERENCE',
}

export type ReviewAppealInput = {
  approved: Scalars['Boolean']['input'];
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type ReviewHelpful = {
  __typename?: 'ReviewHelpful';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  review: RecipeReview;
  user: User;
};

export enum RiskFactor {
  BlacklistedIp = 'BLACKLISTED_IP',
  BotDetected = 'BOT_DETECTED',
  FailedAttempts = 'FAILED_ATTEMPTS',
  MultipleAccounts = 'MULTIPLE_ACCOUNTS',
  NewDevice = 'NEW_DEVICE',
  NewIp = 'NEW_IP',
  NewLocation = 'NEW_LOCATION',
  ProxyDetected = 'PROXY_DETECTED',
  RapidSuccession = 'RAPID_SUCCESSION',
  TorDetected = 'TOR_DETECTED',
  UnusualTime = 'UNUSUAL_TIME',
  VpnDetected = 'VPN_DETECTED',
}

export type SavedRecipe = {
  __typename?: 'SavedRecipe';
  cookedCount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  folder?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastCookedAt?: Maybe<Scalars['DateTime']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  personalRating?: Maybe<Scalars['Int']['output']>;
  recipe: Recipe;
  recipeId: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['String']['output'];
};

export type SavedRecipeConnection = {
  __typename?: 'SavedRecipeConnection';
  edges: Array<SavedRecipeEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Saved recipe connection for pagination */
export type SavedRecipeEdge = {
  __typename?: 'SavedRecipeEdge';
  cursor: Scalars['String']['output'];
  node: SavedRecipe;
};

export type SearchFacets = {
  __typename?: 'SearchFacets';
  brands: Array<FacetValue>;
  categories: Array<FacetValue>;
  priceRanges: Array<PriceRangeFacet>;
  storageStates: Array<FacetValue>;
  stores: Array<FacetValue>;
  tags: Array<FacetValue>;
  types: Array<FacetValue>;
};

export type SearchItemsInput = {
  filters?: InputMaybe<ItemFilters>;
  pagination?: InputMaybe<PaginationInput>;
  query: Scalars['String']['input'];
  sort?: InputMaybe<ItemSortInput>;
};

export type SetReminderInput = {
  reminderDate: Scalars['DateTime']['input'];
  reminderEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type SetupRecurringInput = {
  nextRecurringDate?: InputMaybe<Scalars['DateTime']['input']>;
  recurringInterval: Scalars['Int']['input'];
  recurringPattern: RecurringPattern;
};

export type ShareShoppingListInput = {
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  shareCode?: InputMaybe<Scalars['String']['input']>;
};

/**
 * Shopping list for a home
 * Cache: 1 minute - frequently updated by collaborators
 */
export type ShoppingList = {
  __typename?: 'ShoppingList';
  activitiesConnection: ShoppingListActivityConnection;
  autoAddSuggestions: Scalars['Boolean']['output'];
  /**
   * Available pantries for moving items (from linked home).
   * Returns empty array if not linked to a home.
   */
  availablePantries: Array<Pantry>;
  basedOnTemplate?: Maybe<ShoppingList>;
  budgetAmount?: Maybe<Scalars['Float']['output']>;
  /**
   * Whether items from this list can be moved to pantry.
   * True only if the list is linked to a home.
   */
  canMoveToPantry: Scalars['Boolean']['output'];
  category?: Maybe<Scalars['String']['output']>;
  collaboratorsConnection: ShoppingListCollaboratorConnection;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  completedItems: Scalars['Int']['output'];
  completedShopDate?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  /** Default pantry for the linked home (if any). */
  defaultPantry?: Maybe<Pantry>;
  description?: Maybe<Scalars['String']['output']>;
  estimatedTotal: Scalars['Float']['output'];
  generatedFromMealPlan: Scalars['Boolean']['output'];
  home?: Maybe<Home>;
  homeId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isCompleted: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  isPublic: Scalars['Boolean']['output'];
  isRecurring: Scalars['Boolean']['output'];
  isTemplate: Scalars['Boolean']['output'];
  itemsConnection: ShoppingListItemConnection;
  lastRecurredAt?: Maybe<Scalars['DateTime']['output']>;
  lastReminderSent?: Maybe<Scalars['DateTime']['output']>;
  mealPlan?: Maybe<MealPlan>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  nextRecurringDate?: Maybe<Scalars['DateTime']['output']>;
  ownerships?: Maybe<Array<ShoppingListOwnership>>;
  plannedShopDate?: Maybe<Scalars['DateTime']['output']>;
  priceTracking: Scalars['Boolean']['output'];
  priority: Scalars['Int']['output'];
  recurringInterval?: Maybe<Scalars['Int']['output']>;
  recurringPattern?: Maybe<RecurringPattern>;
  reminderDate?: Maybe<Scalars['DateTime']['output']>;
  reminderEnabled: Scalars['Boolean']['output'];
  shareCode?: Maybe<Scalars['String']['output']>;
  shareCount: Scalars['Int']['output'];
  smartSorting: Scalars['Boolean']['output'];
  sortOrder: Scalars['Int']['output'];
  status: ListStatus;
  tags: Array<Scalars['String']['output']>;
  targetStore?: Maybe<Store>;
  targetStoreId?: Maybe<Scalars['String']['output']>;
  templateName?: Maybe<Scalars['String']['output']>;
  totalCollaborators: Scalars['Int']['output'];
  totalCost: Scalars['Float']['output'];
  totalItems: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
  viewCount: Scalars['Int']['output'];
};

/**
 * Shopping list for a home
 * Cache: 1 minute - frequently updated by collaborators
 */
export type ShoppingListActivitiesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ShoppingListActivityOrderBy>;
};

/**
 * Shopping list for a home
 * Cache: 1 minute - frequently updated by collaborators
 */
export type ShoppingListCollaboratorsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CollaboratorOrderBy>;
};

/**
 * Shopping list for a home
 * Cache: 1 minute - frequently updated by collaborators
 */
export type ShoppingListItemsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ShoppingListItemOrderBy>;
};

export type ShoppingListActivity = {
  __typename?: 'ShoppingListActivity';
  action: ListActivityType;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  itemName?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  newValue?: Maybe<Scalars['String']['output']>;
  oldValue?: Maybe<Scalars['String']['output']>;
  shoppingList: ShoppingList;
  shoppingListId: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
  user: User;
  userId: Scalars['String']['output'];
};

export type ShoppingListActivityConnection = {
  __typename?: 'ShoppingListActivityConnection';
  edges: Array<ShoppingListActivityEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Shopping list activity connection for pagination */
export type ShoppingListActivityEdge = {
  __typename?: 'ShoppingListActivityEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingListActivity;
};

/** Order by options for shopping list activities */
export type ShoppingListActivityOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  timestamp?: InputMaybe<SortOrder>;
};

export type ShoppingListCollaborator = {
  __typename?: 'ShoppingListCollaborator';
  canAddItems: Scalars['Boolean']['output'];
  canEdit: Scalars['Boolean']['output'];
  canEditItems: Scalars['Boolean']['output'];
  canExport: Scalars['Boolean']['output'];
  canInviteOthers: Scalars['Boolean']['output'];
  canMarkPurchased: Scalars['Boolean']['output'];
  canRemoveItems: Scalars['Boolean']['output'];
  canViewHistory: Scalars['Boolean']['output'];
  collaborator?: Maybe<User>;
  collaboratorId?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  invitedAt: Scalars['DateTime']['output'];
  invitedBy?: Maybe<User>;
  itemsAdded: Scalars['Int']['output'];
  itemsPurchased: Scalars['Int']['output'];
  lastEditedAt?: Maybe<Scalars['DateTime']['output']>;
  lastViewedAt?: Maybe<Scalars['DateTime']['output']>;
  notifyOnChanges: Scalars['Boolean']['output'];
  notifyOnComplete: Scalars['Boolean']['output'];
  role: CollaboratorRole;
  shoppingList: ShoppingList;
  shoppingListId: Scalars['String']['output'];
  status: CollaboratorStatus;
  statusChangedAt?: Maybe<Scalars['DateTime']['output']>;
  token?: Maybe<Scalars['String']['output']>;
};

export type ShoppingListCollaboratorChangedPayload = {
  __typename?: 'ShoppingListCollaboratorChangedPayload';
  collaborator?: Maybe<ShoppingListCollaborator>;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type ShoppingListCollaboratorConnection = {
  __typename?: 'ShoppingListCollaboratorConnection';
  edges: Array<ShoppingListCollaboratorEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Shopping list collaborator connection for pagination */
export type ShoppingListCollaboratorEdge = {
  __typename?: 'ShoppingListCollaboratorEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingListCollaborator;
};

export type ShoppingListConnection = {
  __typename?: 'ShoppingListConnection';
  edges: Array<ShoppingListEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Shopping list connection for pagination */
export type ShoppingListEdge = {
  __typename?: 'ShoppingListEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingList;
};

export type ShoppingListFilters = {
  homeId?: InputMaybe<Scalars['String']['input']>;
  isArchived?: InputMaybe<Scalars['Boolean']['input']>;
  isCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  isTemplate?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ListStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

/**
 * Real-time collaborative type - never cache
 * Shopping list item with focused sub-types for better organization
 */
export type ShoppingListItem = {
  __typename?: 'ShoppingListItem';
  addedBy?: Maybe<User>;
  addedById?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  displayFormat: DisplayFormat;
  id: Scalars['ID']['output'];
  item?: Maybe<Item>;
  itemBarcode?: Maybe<Scalars['String']['output']>;
  itemName?: Maybe<Scalars['String']['output']>;
  lastEditedBy?: Maybe<User>;
  lastEditedById?: Maybe<Scalars['String']['output']>;
  normalizedQuantity?: Maybe<Scalars['Float']['output']>;
  normalizedUnit?: Maybe<Unit>;
  normalizedUnitId?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  priceEstimate: PriceEstimate;
  priority: Scalars['Int']['output'];
  purchaseHistory: PurchaseHistorySummary;
  purchaseInfo: ShoppingListItemPurchaseInfo;
  purchasesConnection: PurchaseConnection;
  quantity?: Maybe<Scalars['Float']['output']>;
  quantityInput?: Maybe<Scalars['String']['output']>;
  shoppingList: ShoppingList;
  sortOrder: Scalars['String']['output'];
  source: ShoppingListItemSource;
  storeInfo: ShoppingListItemStoreInfo;
  unit?: Maybe<Unit>;
  unitName?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

/**
 * Real-time collaborative type - never cache
 * Shopping list item with focused sub-types for better organization
 */
export type ShoppingListItemPurchasesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PurchaseOrderBy>;
};

export type ShoppingListItemChangedPayload = {
  __typename?: 'ShoppingListItemChangedPayload';
  item?: Maybe<ShoppingListItem>;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  timestamp: Scalars['DateTime']['output'];
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['ID']['output'];
};

export type ShoppingListItemConnection = {
  __typename?: 'ShoppingListItemConnection';
  edges: Array<ShoppingListItemEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Shopping list item connection for pagination */
export type ShoppingListItemEdge = {
  __typename?: 'ShoppingListItemEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingListItem;
};

/** Order by options for shopping list items */
export type ShoppingListItemOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  priority?: InputMaybe<SortOrder>;
  sortOrder?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

/** Purchase state for a shopping list item */
export type ShoppingListItemPurchaseInfo = {
  __typename?: 'ShoppingListItemPurchaseInfo';
  /** Whether the item has been purchased */
  isPurchased: Scalars['Boolean']['output'];
  /** When the item was purchased */
  purchaseDate?: Maybe<Scalars['DateTime']['output']>;
  /** Who purchased the item */
  purchasedBy?: Maybe<User>;
  /** ID of user who purchased */
  purchasedById?: Maybe<Scalars['String']['output']>;
  /** Actual price paid */
  purchasedPrice?: Maybe<Scalars['Float']['output']>;
  /** Actual quantity purchased (may differ from requested) */
  purchasedQuantity?: Maybe<Scalars['Float']['output']>;
};

/** Source information for how a shopping list item was added */
export type ShoppingListItemSource = {
  __typename?: 'ShoppingListItemSource';
  /** Context about why item was added */
  addedContext?: Maybe<Scalars['String']['output']>;
  /** Reason for auto-add (e.g., 'low_stock', 'meal_plan') */
  autoAddReason?: Maybe<Scalars['String']['output']>;
  /** Whether item was auto-added (e.g., from low stock) */
  isAutoAdded: Scalars['Boolean']['output'];
  /** Whether item came from meal planning */
  isFromMealPlan: Scalars['Boolean']['output'];
  /** Associated meal plan */
  mealPlan?: Maybe<MealPlan>;
  mealPlanId?: Maybe<Scalars['String']['output']>;
  /** Specific meal plan item */
  mealPlanItem?: Maybe<MealPlanItem>;
  mealPlanItemId?: Maybe<Scalars['String']['output']>;
  /** Reference to meal plan (legacy) */
  mealPlanReference?: Maybe<Scalars['String']['output']>;
  /** Associated recipe */
  recipe?: Maybe<Recipe>;
  /** Specific recipe ingredient */
  recipeIngredient?: Maybe<RecipeIngredient>;
};

/** Store and location preferences for a shopping list item */
export type ShoppingListItemStoreInfo = {
  __typename?: 'ShoppingListItemStoreInfo';
  /** Aisle location in store */
  aisle?: Maybe<Scalars['String']['output']>;
  /** Preferred store for this item */
  preferredStore?: Maybe<Store>;
  /** Storage location after purchase */
  storageLocation?: Maybe<Scalars['String']['output']>;
  /** Section within store */
  storeSection?: Maybe<Scalars['String']['output']>;
};

export type ShoppingListOwnership = {
  __typename?: 'ShoppingListOwnership';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  shoppingList: ShoppingList;
  shoppingListId: Scalars['String']['output'];
  transferredAt?: Maybe<Scalars['DateTime']['output']>;
  transferredFrom?: Maybe<Scalars['String']['output']>;
  user: User;
  userId: Scalars['String']['output'];
};

export type ShoppingListStatusChangedPayload = {
  __typename?: 'ShoppingListStatusChangedPayload';
  completedBy?: Maybe<User>;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  newStatus: ListStatus;
  previousStatus?: Maybe<ListStatus>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type ShoppingListUpdatedPayload = {
  __typename?: 'ShoppingListUpdatedPayload';
  mutation: MutationType;
  node?: Maybe<ShoppingList>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['ID']['output'];
};

export type SkippedItem = {
  __typename?: 'SkippedItem';
  identifier?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

/** Info about a skipped item */
export type SkippedItemInfo = {
  __typename?: 'SkippedItemInfo';
  itemName: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  shoppingListItemId: Scalars['ID']['output'];
};

/** Item that was skipped when adding to shopping list */
export type SkippedLowStockItem = {
  __typename?: 'SkippedLowStockItem';
  itemName: Scalars['String']['output'];
  pantryItemId: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

/** Sort order for ordering results */
export enum SortOrder {
  Asc = 'ASC',
  Desc = 'DESC',
}

/** Input for stale device cleanup */
export type StaleDeviceCleanupInput = {
  daysInactive?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};

/**
 * Storage location within a home (refrigerator, freezer, pantry shelf, etc.)
 * Supports hierarchical organization with parent-child relationships
 */
export type StorageLocation = {
  __typename?: 'StorageLocation';
  /** Maximum capacity (in capacityUnit) */
  capacity?: Maybe<Scalars['Float']['output']>;
  /** Unit of measurement for capacity (e.g., 'liters', 'cubic feet') */
  capacityUnit?: Maybe<Scalars['String']['output']>;
  /** Child locations nested within this location */
  childLocations: Array<StorageLocation>;
  /** Optional color code (hex) for UI display */
  color?: Maybe<Scalars['String']['output']>;
  /** When this storage location was created */
  createdAt: Scalars['DateTime']['output'];
  /** Current count of items stored in this location */
  currentItemCount: Scalars['Int']['output'];
  /** When this storage location was soft-deleted (if applicable) */
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Optional description or notes about this location */
  description?: Maybe<Scalars['String']['output']>;
  /** The home this storage location belongs to */
  home: Home;
  /** ID of the home this storage location belongs to */
  homeId: Scalars['String']['output'];
  /** Optional icon identifier for UI display */
  icon?: Maybe<Scalars['String']['output']>;
  /** Unique identifier for the storage location */
  id: Scalars['ID']['output'];
  /** Whether this location is active and visible */
  isActive: Scalars['Boolean']['output'];
  /** Whether this location has climate control */
  isClimateControlled: Scalars['Boolean']['output'];
  /** Whether this is the default storage location for the home */
  isDefault: Scalars['Boolean']['output'];
  /** Display name of the storage location (e.g., 'Main Fridge', 'Basement Freezer') */
  name: Scalars['String']['output'];
  /** Parent location if this is a nested location (e.g., a drawer inside a refrigerator) */
  parentLocation?: Maybe<StorageLocation>;
  /** ID of the parent location */
  parentLocationId?: Maybe<Scalars['String']['output']>;
  /** Sort order for display (lower numbers appear first) */
  sortOrder: Scalars['Int']['output'];
  /** Temperature state (FROZEN, REFRIGERATED, AMBIENT, NONE) */
  temperature?: Maybe<StorageState>;
  /** Type of storage (REFRIGERATOR, FREEZER, PANTRY_SHELF, etc.) */
  type: StorageType;
  /** When this storage location was last updated */
  updatedAt: Scalars['DateTime']['output'];
};

export type StorageLocationConnection = {
  __typename?: 'StorageLocationConnection';
  edges: Array<StorageLocationEdge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

/** Storage location connection for pagination */
export type StorageLocationEdge = {
  __typename?: 'StorageLocationEdge';
  cursor: Scalars['String']['output'];
  node: StorageLocation;
};

/** Order by options for storage locations */
export type StorageLocationOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
};

/** Temperature state of a storage location */
export enum StorageState {
  /** Room temperature / ambient conditions */
  Ambient = 'AMBIENT',
  /** Below freezing temperature (typically -18°C / 0°F or below) */
  Frozen = 'FROZEN',
  /** No specific temperature control or not applicable */
  None = 'NONE',
  /** Refrigerated temperature (typically 1-4°C / 34-39°F) */
  Refrigerated = 'REFRIGERATED',
}

/** Type of storage location */
export enum StorageType {
  /** Basement storage area */
  Basement = 'BASEMENT',
  /** Boat storage compartment */
  BoatStorage = 'BOAT_STORAGE',
  /** Kitchen or storage cabinet */
  Cabinet = 'CABINET',
  /** Closet storage */
  Closet = 'CLOSET',
  /** Kitchen counter or surface */
  Counter = 'COUNTER',
  /** Custom or other storage type */
  Custom = 'CUSTOM',
  /** Storage drawer */
  Drawer = 'DRAWER',
  /** Freezer or deep freezer */
  Freezer = 'FREEZER',
  /** Garage storage */
  Garage = 'GARAGE',
  /** Outdoor storage area */
  Outdoor = 'OUTDOOR',
  /** Pantry shelf or cabinet shelf */
  PantryShelf = 'PANTRY_SHELF',
  /** Standard refrigerator */
  Refrigerator = 'REFRIGERATOR',
  /** RV storage compartment */
  RvStorage = 'RV_STORAGE',
}

/**
 * Store type for retail locations
 * Cache: 30 minutes - store information changes rarely
 */
export type Store = {
  __typename?: 'Store';
  address?: Maybe<Scalars['String']['output']>;
  averageShelfLife?: Maybe<Scalars['JSON']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  lastPriceUpdate?: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  pantryItems: Array<PantryItem>;
  priceAccuracy?: Maybe<Scalars['Float']['output']>;
  priceHistory: Array<ItemPriceHistory>;
  purchases: Array<Purchase>;
  qualityRating?: Maybe<Scalars['Float']['output']>;
  storeInfo?: Maybe<StoreInfo>;
  storeSkus: Array<ItemStoreSku>;
  supportsPriceAPI: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

/** Cost breakdown by store */
export type StoreCostBreakdown = {
  __typename?: 'StoreCostBreakdown';
  averageCostPerUnit: Scalars['Float']['output'];
  itemCount: Scalars['Int']['output'];
  storeId?: Maybe<Scalars['String']['output']>;
  storeName?: Maybe<Scalars['String']['output']>;
  totalSpent: Scalars['Float']['output'];
};

/**
 * Store information and contact details
 * Cache: 30 minutes - store metadata changes rarely
 */
export type StoreInfo = {
  __typename?: 'StoreInfo';
  email?: Maybe<Scalars['String']['output']>;
  hoursJSON?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  lat?: Maybe<Scalars['Float']['output']>;
  lng?: Maybe<Scalars['Float']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  website?: Maybe<Scalars['String']['output']>;
};

export type StorePriceComparison = {
  __typename?: 'StorePriceComparison';
  inventoryStatus?: Maybe<Scalars['String']['output']>;
  lastUpdated?: Maybe<Scalars['DateTime']['output']>;
  offers?: Maybe<Array<OfferSummary>>;
  price?: Maybe<Scalars['Float']['output']>;
  storeId: Scalars['String']['output'];
  storeName: Scalars['String']['output'];
  unitPrice?: Maybe<Scalars['Float']['output']>;
};

export type StoreSkuInput = {
  displayItemSize?: InputMaybe<Scalars['String']['input']>;
  fulfillmentMethods?: InputMaybe<Array<Scalars['String']['input']>>;
  inventoryStatus?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['Float']['input']>;
  sku: Scalars['String']['input'];
  storeId: Scalars['String']['input'];
};

/**
 * Store statistics and analytics
 * Cache: 10 minutes - stats aggregate over time
 */
export type StoreStats = {
  __typename?: 'StoreStats';
  averagePurchaseAmount: Scalars['Float']['output'];
  priceAccuracy?: Maybe<Scalars['Float']['output']>;
  qualityRating?: Maybe<Scalars['Float']['output']>;
  recentActivity: Array<Purchase>;
  topItems: Array<StoreTopItem>;
  totalPurchases: Scalars['Int']['output'];
  totalRevenue: Scalars['Float']['output'];
  uniqueCustomers: Scalars['Int']['output'];
};

export type StoreTopItem = {
  __typename?: 'StoreTopItem';
  count: Scalars['Int']['output'];
  itemName: Scalars['String']['output'];
  revenue: Scalars['Float']['output'];
};

export type SubmitAppealInput = {
  appealNotes: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type Subscription = {
  __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']['output']>;
  collaborationInviteAccepted: ShoppingListCollaborator;
  collaborationInviteSent: ShoppingListCollaborator;
  collaborationMemberAdded: ShoppingListCollaborator;
  collaborationMemberRemoved: ShoppingListCollaborator;
  deviceActivity: Device;
  deviceRegistered: Device;
  deviceStatusChanged: Device;
  deviceTrustChanged: Device;
  deviceVerified: Device;
  expirationNotificationCreated: ExpirationNotification;
  expirationNotificationUpdated: ExpirationNotification;
  failedLoginAttempts: LoginHistory;
  loginAttempts: LoginHistory;
  memberJoined: MembershipUpdatePayload;
  memberLeft: MembershipUpdatePayload;
  membershipRoleChanged: MembershipRoleChangedPayload;
  membershipUpdated: MembershipUpdatePayload;
  myShoppingListsUpdated?: Maybe<ShoppingListUpdatedPayload>;
  notificationReceived: NotificationPayload;
  notificationUpdated: NotificationPayload;
  pantryExpiringItemsAlert: PantryExpiringItemsAlertPayload;
  pantryItemUsageChanged: PantryItemUsageChangedPayload;
  pantryItemsChanged: PantryItemChangedPayload;
  pantryLowStockAlert: PantryLowStockAlertPayload;
  pantryUpdated: PantryUpdatedPayload;
  pantryWasteAlert: PantryWasteAlertPayload;
  riskyLoginAlerts: LoginHistory;
  shoppingListCollaboratorsChanged?: Maybe<ShoppingListCollaboratorChangedPayload>;
  shoppingListItemsChanged?: Maybe<ShoppingListItemChangedPayload>;
  shoppingListStatusChanged?: Maybe<ShoppingListStatusChangedPayload>;
  shoppingListUpdated?: Maybe<ShoppingListUpdatedPayload>;
  storeRatingChanged: Store;
  storeUpdated: Store;
  suspiciousActivity: SuspiciousActivity;
  userActivity: UserActivityPayload;
  userModerationChanged: UserModerationChangedPayload;
  userProfileChanged: UserProfileChangedPayload;
  userStatusChanged: UserStatusChangedPayload;
  userUpdated: UserUpdatedPayload;
};

export type SubscriptionCollaborationInviteAcceptedArgs = {
  email: Scalars['String']['input'];
  shoppingListId: Scalars['ID']['input'];
};

export type SubscriptionCollaborationInviteSentArgs = {
  email: Scalars['String']['input'];
  shoppingListId: Scalars['ID']['input'];
};

export type SubscriptionCollaborationMemberAddedArgs = {
  email: Scalars['String']['input'];
  shoppingListId: Scalars['ID']['input'];
};

export type SubscriptionCollaborationMemberRemovedArgs = {
  email: Scalars['String']['input'];
  shoppingListId: Scalars['ID']['input'];
};

export type SubscriptionDeviceActivityArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionDeviceRegisteredArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionDeviceStatusChangedArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionDeviceTrustChangedArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionDeviceVerifiedArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionFailedLoginAttemptsArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionLoginAttemptsArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionMemberJoinedArgs = {
  homeId: Scalars['ID']['input'];
};

export type SubscriptionMemberLeftArgs = {
  homeId: Scalars['ID']['input'];
};

export type SubscriptionMembershipRoleChangedArgs = {
  homeId: Scalars['ID']['input'];
};

export type SubscriptionMembershipUpdatedArgs = {
  homeId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionPantryExpiringItemsAlertArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryItemUsageChangedArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryItemsChangedArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryLowStockAlertArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryUpdatedArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryWasteAlertArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionRiskyLoginAlertsArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionShoppingListCollaboratorsChangedArgs = {
  listId: Scalars['ID']['input'];
};

export type SubscriptionShoppingListItemsChangedArgs = {
  listId: Scalars['ID']['input'];
};

export type SubscriptionShoppingListStatusChangedArgs = {
  listId: Scalars['ID']['input'];
};

export type SubscriptionShoppingListUpdatedArgs = {
  listId: Scalars['ID']['input'];
};

export type SubscriptionStoreRatingChangedArgs = {
  storeId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionStoreUpdatedArgs = {
  storeId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionSuspiciousActivityArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionUserActivityArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionUserModerationChangedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionUserProfileChangedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionUserStatusChangedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionUserUpdatedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SuspendUserInput = {
  reason: Scalars['String']['input'];
  suspendedUntil: Scalars['DateTime']['input'];
  userId: Scalars['ID']['input'];
};

export type SuspiciousActivity = {
  __typename?: 'SuspiciousActivity';
  failedFromSameIP?: Maybe<Array<FailedIpStat>>;
  multipleAccountsFromIP?: Maybe<Array<FailedIpStat>>;
  newDeviceLogins?: Maybe<Array<LoginHistory>>;
  newLocationLogins?: Maybe<Array<LoginHistory>>;
  rapidAttempts?: Maybe<Array<RapidAttempt>>;
  riskyLogins: Array<LoginHistory>;
  suspiciousActivity: Scalars['Boolean']['output'];
  unusualTimeLogins?: Maybe<Array<LoginHistory>>;
};

export type SuspiciousActivitySummary = {
  __typename?: 'SuspiciousActivitySummary';
  actionsBreakdown: InviteActionStats;
  timeWindow: Scalars['Int']['output'];
  totalSuspiciousActions: Scalars['Int']['output'];
};

export type SuspiciousInviteActivity = {
  __typename?: 'SuspiciousInviteActivity';
  logs: Array<InviteLog>;
  summary: SuspiciousActivitySummary;
};

/** Information about a sync conflict */
export type SyncConflictInfo = {
  __typename?: 'SyncConflictInfo';
  /** The version the client had */
  clientVersion: Scalars['Int']['output'];
  /** Description of the conflict */
  message: Scalars['String']['output'];
  /** The current state of the item on the server */
  serverItem: ShoppingListItem;
  /** The current version on the server */
  serverVersion: Scalars['Int']['output'];
};

export enum SyncOperation {
  Create = 'CREATE',
  Delete = 'DELETE',
  Move = 'MOVE',
  Update = 'UPDATE',
}

export type SyncPantryItemInput = {
  acquisitionMethod?: InputMaybe<AcquisitionMethod>;
  condition?: InputMaybe<ItemCondition>;
  costPerUnit?: InputMaybe<Scalars['Float']['input']>;
  currentQuantity?: InputMaybe<Scalars['Float']['input']>;
  expirationAlert?: InputMaybe<Scalars['Boolean']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  initialQuantity?: InputMaybe<Scalars['Float']['input']>;
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  itemBrand?: InputMaybe<Scalars['String']['input']>;
  itemCategory?: InputMaybe<Scalars['String']['input']>;
  itemDescription?: InputMaybe<Scalars['String']['input']>;
  itemDisplayUnitId?: InputMaybe<Scalars['String']['input']>;
  itemId?: InputMaybe<Scalars['String']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  itemNetWeight?: InputMaybe<Scalars['Float']['input']>;
  itemUpc?: InputMaybe<Scalars['String']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  lowStockAlert?: InputMaybe<Scalars['Boolean']['input']>;
  minQuantity?: InputMaybe<Scalars['Float']['input']>;
  packageWeight?: InputMaybe<Scalars['Float']['input']>;
  packageWeightUnitId?: InputMaybe<Scalars['String']['input']>;
  pantryId: Scalars['ID']['input'];
  purchaseId?: InputMaybe<Scalars['String']['input']>;
  restockQuantity?: InputMaybe<Scalars['Float']['input']>;
  storageLocationId?: InputMaybe<Scalars['String']['input']>;
  storageNotes?: InputMaybe<Scalars['String']['input']>;
  storageState?: InputMaybe<StorageState>;
  storeId?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  unitSymbol?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
  wasteAmount?: InputMaybe<Scalars['Float']['input']>;
  wasteReason?: InputMaybe<WasteReason>;
};

export type SyncPantryItemResult = {
  __typename?: 'SyncPantryItemResult';
  clientId: Scalars['ID']['output'];
  conflict?: Maybe<SyncConflictInfo>;
  item?: Maybe<PantryItem>;
  operation: SyncOperation;
  serverId?: Maybe<Scalars['ID']['output']>;
  wasCreated: Scalars['Boolean']['output'];
};

export type SyncShoppingListItemInput = {
  addedContext?: InputMaybe<Scalars['String']['input']>;
  aisle?: InputMaybe<Scalars['String']['input']>;
  budgetPrice?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  /** Price information */
  estimatedPrice?: InputMaybe<Scalars['Float']['input']>;
  /** Purchase tracking */
  isPurchased?: InputMaybe<Scalars['Boolean']['input']>;
  /** Item reference (if linking to catalog item) */
  itemId?: InputMaybe<Scalars['String']['input']>;
  /** Item details (for items not in catalog) */
  itemName?: InputMaybe<Scalars['String']['input']>;
  /** User-provided information */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Store preferences */
  preferredStoreId?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  purchasedPrice?: InputMaybe<Scalars['Float']['input']>;
  purchasedQuantity?: InputMaybe<Scalars['Float']['input']>;
  /** Quantity of the item */
  quantity?: InputMaybe<Scalars['Float']['input']>;
  /** Recipe references */
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  recipeIngredientId?: InputMaybe<Scalars['ID']['input']>;
  /** Required: ID of the shopping list this item belongs to */
  shoppingListId: Scalars['ID']['input'];
  sortOrder?: InputMaybe<Scalars['String']['input']>;
  storeSection?: InputMaybe<Scalars['String']['input']>;
  /** Unit reference (if linking to catalog unit) */
  unitId?: InputMaybe<Scalars['String']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  /** Version for optimistic locking (null if new item) */
  version?: InputMaybe<Scalars['Int']['input']>;
};

/** Result of syncing a shopping list item */
export type SyncShoppingListItemResult = {
  __typename?: 'SyncShoppingListItemResult';
  /** The client-provided ID (may be temp ID like 'temp-uuid') */
  clientId: Scalars['ID']['output'];
  /** Conflict information if version mismatch occurred */
  conflict?: Maybe<SyncConflictInfo>;
  /** The synced shopping list item (null for delete operations) */
  item?: Maybe<ShoppingListItem>;
  /** The operation that was performed */
  operation: SyncOperation;
  /** The server-assigned MongoDB ObjectID (null if item was deleted before reaching server) */
  serverId?: Maybe<Scalars['ID']['output']>;
  /** Whether this was a create (true) or update (false) operation */
  wasCreated: Scalars['Boolean']['output'];
};

/** Categories for organizing meal templates */
export enum TemplateCategory {
  Breakfast = 'BREAKFAST',
  Custom = 'CUSTOM',
  Dinner = 'DINNER',
  Holiday = 'HOLIDAY',
  Lunch = 'LUNCH',
  Monthly = 'MONTHLY',
  SpecialDiet = 'SPECIAL_DIET',
  Weekly = 'WEEKLY',
}

/** Time series data point for charting usage/waste trends */
export type TimeSeriesDataPoint = {
  __typename?: 'TimeSeriesDataPoint';
  count: Scalars['Int']['output'];
  date: Scalars['DateTime']['output'];
  value: Scalars['Float']['output'];
};

export type Timestamped = {
  createdAt: Scalars['DateTime']['output'];
};

/** Result of toggling purchased status */
export type TogglePurchasedResult =
  | NotFoundError
  | ShoppingListItem
  | UnauthorizedError;

export enum TrustLevel {
  Admin = 'ADMIN',
  Basic = 'BASIC',
  Moderator = 'MODERATOR',
  NewUser = 'NEW_USER',
  Trusted = 'TRUSTED',
  Verified = 'VERIFIED',
}

/** Error when user lacks permission for the operation */
export type UnauthorizedError = MutationError & {
  __typename?: 'UnauthorizedError';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  /** The permission that was required */
  requiredPermission?: Maybe<Scalars['String']['output']>;
  /** The resource being accessed */
  resource?: Maybe<Scalars['String']['output']>;
};

/**
 * Unit of measurement type
 * Cache: 2 hours - measurement units are static reference data
 */
export type Unit = {
  __typename?: 'Unit';
  autoConvertThreshold?: Maybe<Scalars['Float']['output']>;
  autoConvertToUnit?: Maybe<Unit>;
  autoConvertToUnitId?: Maybe<Scalars['String']['output']>;
  baseUnit?: Maybe<Unit>;
  baseUnitId?: Maybe<Scalars['String']['output']>;
  commonFractions?: Maybe<Scalars['JSON']['output']>;
  conversionFactor: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  displayAsFraction: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isCommon: Scalars['Boolean']['output'];
  isMetric: Scalars['Boolean']['output'];
  minPrecision: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  sortOrder: Scalars['Int']['output'];
  symbol: Scalars['String']['output'];
  type: UnitType;
  updatedAt: Scalars['DateTime']['output'];
};

export enum UnitRecommendation {
  BulkBuying = 'BULK_BUYING',
  CostComparison = 'COST_COMPARISON',
  MealPlanning = 'MEAL_PLANNING',
  PortionControl = 'PORTION_CONTROL',
  PrecisionCooking = 'PRECISION_COOKING',
  RecipeScaling = 'RECIPE_SCALING',
  StoragePlanning = 'STORAGE_PLANNING',
}

export enum UnitSource {
  AiSuggested = 'AI_SUGGESTED',
  AutoDetected = 'AUTO_DETECTED',
  Community = 'COMMUNITY',
  Import = 'IMPORT',
  Manual = 'MANUAL',
  PurchaseHistory = 'PURCHASE_HISTORY',
  RecipeDerived = 'RECIPE_DERIVED',
}

export enum UnitSystem {
  Imperial = 'IMPERIAL',
  Metric = 'METRIC',
  System = 'SYSTEM',
}

export enum UnitType {
  Area = 'AREA',
  Count = 'COUNT',
  Length = 'LENGTH',
  Time = 'TIME',
  Volume = 'VOLUME',
  Weight = 'WEIGHT',
}

export enum UnitUsageContext {
  Bulk = 'BULK',
  Cooking = 'COOKING',
  Nutrition = 'NUTRITION',
  Packaging = 'PACKAGING',
  Recipe = 'RECIPE',
  Serving = 'SERVING',
  Shopping = 'SHOPPING',
  Storing = 'STORING',
}

/** UPC/barcode format for lookup optimization */
export enum UpcFormat {
  /** Auto-detect format based on length (default) */
  Auto = 'AUTO',
  /** 8-digit shortened European format */
  Ean_8 = 'EAN_8',
  /** 13-digit European Article Number */
  Ean_13 = 'EAN_13',
  /** 12-digit standard UPC (US/Canada) */
  UpcA = 'UPC_A',
  /** 8-digit compressed UPC (auto-expanded to UPC-A) */
  UpcE = 'UPC_E',
}

export type UpcValidation = {
  __typename?: 'UpcValidation';
  exists: Scalars['Boolean']['output'];
  format?: Maybe<Scalars['String']['output']>;
  isValid: Scalars['Boolean']['output'];
  item?: Maybe<Item>;
};

export type UpdateBrandInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
};

export type UpdateCategoryInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  icon?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  visibility?: InputMaybe<Visibility>;
};

export type UpdateCollaboratorPermissionsInput = {
  canAddItems?: InputMaybe<Scalars['Boolean']['input']>;
  canEdit?: InputMaybe<Scalars['Boolean']['input']>;
  canEditItems?: InputMaybe<Scalars['Boolean']['input']>;
  canExport?: InputMaybe<Scalars['Boolean']['input']>;
  canInviteOthers?: InputMaybe<Scalars['Boolean']['input']>;
  canMarkPurchased?: InputMaybe<Scalars['Boolean']['input']>;
  canRemoveItems?: InputMaybe<Scalars['Boolean']['input']>;
  canViewHistory?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateCookingLogInput = {
  actualCookTime?: InputMaybe<Scalars['Int']['input']>;
  actualPrepTime?: InputMaybe<Scalars['Int']['input']>;
  difficulty?: InputMaybe<Difficulty>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  rating?: InputMaybe<Scalars['Int']['input']>;
  servingsMade?: InputMaybe<Scalars['Int']['input']>;
  wouldMakeAgain?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateCurrencyInput = {
  code?: InputMaybe<Scalars['String']['input']>;
  decimalPlaces?: InputMaybe<Scalars['Int']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
};

/**
 * Consolidated input for updating devices.
 * Handles all device updates including status changes, location, hardware info, etc.
 */
export type UpdateDeviceInput = {
  androidId?: InputMaybe<Scalars['String']['input']>;
  apiLevel?: InputMaybe<Scalars['Int']['input']>;
  appVersion?: InputMaybe<Scalars['String']['input']>;
  availableLocationProviders?: InputMaybe<Scalars['JSON']['input']>;
  batteryLevel?: InputMaybe<Scalars['Float']['input']>;
  brand?: InputMaybe<Scalars['String']['input']>;
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  buildNumber?: InputMaybe<Scalars['String']['input']>;
  bundleId?: InputMaybe<Scalars['String']['input']>;
  carrier?: InputMaybe<Scalars['String']['input']>;
  /** Clear the push token (replaces removePushToken mutation) */
  clearPushToken?: InputMaybe<Scalars['Boolean']['input']>;
  /** Soft delete the device (replaces deleteDevice mutation) */
  delete?: InputMaybe<Scalars['Boolean']['input']>;
  deviceFingerprint?: InputMaybe<Scalars['String']['input']>;
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  firstInstallTime?: InputMaybe<Scalars['DateTime']['input']>;
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  /** Update hardware info using structured input */
  hardwareInfo?: InputMaybe<DeviceHardwareInfoInput>;
  hasDynamicIsland?: InputMaybe<Scalars['Boolean']['input']>;
  hasNotch?: InputMaybe<Scalars['Boolean']['input']>;
  hostNames?: InputMaybe<Scalars['JSON']['input']>;
  /** Increment the login count (replaces incrementDeviceLoginCount mutation) */
  incrementLoginCount?: InputMaybe<Scalars['Boolean']['input']>;
  instanceId?: InputMaybe<Scalars['String']['input']>;
  iosVendorId?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isAirplaneMode?: InputMaybe<Scalars['Boolean']['input']>;
  isBatteryCharging?: InputMaybe<Scalars['Boolean']['input']>;
  isBluetoothHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isEmulator?: InputMaybe<Scalars['Boolean']['input']>;
  isHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isKeyboardConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isLocationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  isMouseConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isTablet?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  isWiredHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  lastCity?: InputMaybe<Scalars['String']['input']>;
  lastCountry?: InputMaybe<Scalars['String']['input']>;
  lastIpAddress?: InputMaybe<Scalars['String']['input']>;
  lastUpdateTime?: InputMaybe<Scalars['DateTime']['input']>;
  /** Update location using structured input */
  location?: InputMaybe<DeviceLocationInput>;
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  maxMemory?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  /** Update peripheral info using structured input */
  peripherals?: InputMaybe<DevicePeripheralsInput>;
  platform?: InputMaybe<MobilePlatform>;
  powerState?: InputMaybe<Scalars['JSON']['input']>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
  readableVersion?: InputMaybe<Scalars['String']['input']>;
  screenResolution?: InputMaybe<Scalars['String']['input']>;
  securityPatch?: InputMaybe<Scalars['String']['input']>;
  supportedAbis?: InputMaybe<Scalars['JSON']['input']>;
  supportedMediaTypes?: InputMaybe<Scalars['JSON']['input']>;
  systemVersion?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  totalDiskCapacity?: InputMaybe<Scalars['String']['input']>;
  totalMemory?: InputMaybe<Scalars['String']['input']>;
  /** Update lastSeenAt to now (replaces updateDeviceLastSeen mutation) */
  touchLastSeen?: InputMaybe<Scalars['Boolean']['input']>;
  usedMemory?: InputMaybe<Scalars['String']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateDietaryProfileInput = {
  budgetPerMeal?: InputMaybe<Scalars['Float']['input']>;
  calorieTarget?: InputMaybe<Scalars['Int']['input']>;
  carbsTarget?: InputMaybe<Scalars['Int']['input']>;
  cookingSkillLevel?: InputMaybe<Scalars['String']['input']>;
  dislikedIngredients?: InputMaybe<Array<Scalars['String']['input']>>;
  fatTarget?: InputMaybe<Scalars['Int']['input']>;
  favoriteIngredients?: InputMaybe<Array<Scalars['String']['input']>>;
  maxCookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  maxPrepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  mealsPerDay?: InputMaybe<Scalars['Int']['input']>;
  preferredCuisines?: InputMaybe<Array<Cuisine>>;
  proteinTarget?: InputMaybe<Scalars['Int']['input']>;
  religiousDiet?: InputMaybe<ReligiousDiet>;
  snacksPerDay?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateFavoriteRecipeInput = {
  folder?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  personalRating?: InputMaybe<Scalars['Int']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateHomeInput = {
  allowJoinCode?: InputMaybe<Scalars['Boolean']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  maxMembers?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Consolidated input for updating items.
 * Handles all item updates including categories, brands, units, tags, nutrition, images, etc.
 */
export type UpdateItemInput = {
  addCategoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  addStoreSkus?: InputMaybe<Array<StoreSkuInput>>;
  addTags?: InputMaybe<Array<Scalars['String']['input']>>;
  addUnits?: InputMaybe<Array<ItemUnitInput>>;
  allergens?: InputMaybe<Scalars['JSON']['input']>;
  alternateUpcs?: InputMaybe<Array<Scalars['String']['input']>>;
  brandId?: InputMaybe<Scalars['String']['input']>;
  brandName?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<CategoryInput>>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  defaultUnit?: InputMaybe<Scalars['String']['input']>;
  density?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayUnitId?: InputMaybe<Scalars['String']['input']>;
  displayUnitName?: InputMaybe<Scalars['String']['input']>;
  editReason?: InputMaybe<Scalars['String']['input']>;
  healthBenefits?: InputMaybe<Scalars['JSON']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  images?: InputMaybe<Scalars['JSON']['input']>;
  /** Increment popularity counter (replaces incrementItemPopularity) */
  incrementPopularity?: InputMaybe<Scalars['Boolean']['input']>;
  ingredients?: InputMaybe<Scalars['JSON']['input']>;
  mergeMetadata?: InputMaybe<Scalars['Boolean']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  nutritionFacts?: InputMaybe<Array<NutritionFactInput>>;
  popularity?: InputMaybe<Scalars['Int']['input']>;
  preferredTrackingUnitId?: InputMaybe<Scalars['String']['input']>;
  /** Update item price (replaces updateItemPrice) */
  price?: InputMaybe<Scalars['Float']['input']>;
  /** Price source for tracking */
  priceSource?: InputMaybe<Scalars['String']['input']>;
  /** Store ID for price update */
  priceStoreId?: InputMaybe<Scalars['String']['input']>;
  primaryCategoryId?: InputMaybe<Scalars['String']['input']>;
  primaryUpc?: InputMaybe<Scalars['String']['input']>;
  removeCategoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Remove the item image (replaces removeItemImage) */
  removeImage?: InputMaybe<Scalars['Boolean']['input']>;
  removeStoreSkuIds?: InputMaybe<Array<Scalars['String']['input']>>;
  removeTags?: InputMaybe<Array<Scalars['String']['input']>>;
  removeUnitIds?: InputMaybe<Array<Scalars['String']['input']>>;
  servingSize?: InputMaybe<Scalars['Float']['input']>;
  servingSizeUnit?: InputMaybe<Scalars['String']['input']>;
  servingsPerPackage?: InputMaybe<Scalars['Int']['input']>;
  shelfLifeDays?: InputMaybe<Scalars['Int']['input']>;
  showInOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<ItemStatus>;
  storageState?: InputMaybe<StorageState>;
  storeSkus?: InputMaybe<Array<StoreSkuInput>>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  type?: InputMaybe<ItemType>;
  units?: InputMaybe<Array<ItemUnitInput>>;
  vendor?: InputMaybe<Scalars['String']['input']>;
  visibility?: InputMaybe<Visibility>;
};

/** Input for updating an item's price */
export type UpdateItemPriceInput = {
  itemId: Scalars['ID']['input'];
  price: Scalars['Float']['input'];
  source?: InputMaybe<Scalars['String']['input']>;
  storeId?: InputMaybe<Scalars['String']['input']>;
};

/** Result of updating an item */
export type UpdateItemResult =
  | Item
  | NotFoundError
  | UnauthorizedError
  | ValidationError
  | VersionMismatchError;

export type UpdateLoginHistoryInput = {
  apiClient?: InputMaybe<Scalars['String']['input']>;
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  campaign?: InputMaybe<Scalars['String']['input']>;
  deviceId?: InputMaybe<Scalars['ID']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  failureDetails?: InputMaybe<Scalars['String']['input']>;
  failureReason?: InputMaybe<LoginFailureReason>;
  flaggedReason?: InputMaybe<Scalars['String']['input']>;
  ipAddress?: InputMaybe<Scalars['String']['input']>;
  ipCity?: InputMaybe<Scalars['String']['input']>;
  ipCountry?: InputMaybe<Scalars['String']['input']>;
  ipRegion?: InputMaybe<Scalars['String']['input']>;
  isApiLogin?: InputMaybe<Scalars['Boolean']['input']>;
  isAutomated?: InputMaybe<Scalars['Boolean']['input']>;
  isMobileApp?: InputMaybe<Scalars['Boolean']['input']>;
  isNewBrowser?: InputMaybe<Scalars['Boolean']['input']>;
  isNewDevice?: InputMaybe<Scalars['Boolean']['input']>;
  isNewLocation?: InputMaybe<Scalars['Boolean']['input']>;
  isProxy?: InputMaybe<Scalars['Boolean']['input']>;
  isRisky?: InputMaybe<Scalars['Boolean']['input']>;
  isTor?: InputMaybe<Scalars['Boolean']['input']>;
  isVpn?: InputMaybe<Scalars['Boolean']['input']>;
  landingPage?: InputMaybe<Scalars['String']['input']>;
  lastActivityAt?: InputMaybe<Scalars['DateTime']['input']>;
  loggedOutAt?: InputMaybe<Scalars['DateTime']['input']>;
  mfaCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  mfaMethod?: InputMaybe<MfaMethod>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  referrer?: InputMaybe<Scalars['String']['input']>;
  requiresMfa?: InputMaybe<Scalars['Boolean']['input']>;
  reviewed?: InputMaybe<Scalars['Boolean']['input']>;
  riskFactors?: InputMaybe<Array<RiskFactor>>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  timezoneDiff?: InputMaybe<Scalars['Int']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateMealPlanInput = {
  actualCost?: InputMaybe<Scalars['Float']['input']>;
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  /** Link or unlink dietary profile for nutrition goal tracking */
  dietaryProfileId?: InputMaybe<Scalars['ID']['input']>;
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  planType?: InputMaybe<MealPlanType>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
};

export type UpdateMealPlanItemInput = {
  actualCost?: InputMaybe<Scalars['Float']['input']>;
  /** Manual nutrition override */
  calories?: InputMaybe<Scalars['Float']['input']>;
  carbs?: InputMaybe<Scalars['Float']['input']>;
  completedAt?: InputMaybe<Scalars['DateTime']['input']>;
  customMealName?: InputMaybe<Scalars['String']['input']>;
  date?: InputMaybe<Scalars['DateTime']['input']>;
  estimatedCost?: InputMaybe<Scalars['Float']['input']>;
  fat?: InputMaybe<Scalars['Float']['input']>;
  isCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  mealType?: InputMaybe<MealType>;
  notes?: InputMaybe<Scalars['String']['input']>;
  protein?: InputMaybe<Scalars['Float']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateMealTemplateInput = {
  category?: InputMaybe<TemplateCategory>;
  defaultServings?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  durationDays?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateMembershipInput = {
  canAddItems?: InputMaybe<Scalars['Boolean']['input']>;
  canEditPantry?: InputMaybe<Scalars['Boolean']['input']>;
  canInviteOthers?: InputMaybe<Scalars['Boolean']['input']>;
  canManageHome?: InputMaybe<Scalars['Boolean']['input']>;
  canRemoveItems?: InputMaybe<Scalars['Boolean']['input']>;
  canViewPantry?: InputMaybe<Scalars['Boolean']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<MembershipRole>;
};

export type UpdateNotificationInput = {
  actionUrl?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  payload?: InputMaybe<Scalars['JSON']['input']>;
  priority?: InputMaybe<Priority>;
  readAt?: InputMaybe<Scalars['DateTime']['input']>;
  status?: InputMaybe<NotificationStatus>;
  title?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<NotificationType>;
};

export type UpdateNotificationPreferencesInput = {
  collaborationInvites?: InputMaybe<Scalars['Boolean']['input']>;
  cookingReminders?: InputMaybe<Scalars['Boolean']['input']>;
  emailEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  expirationDaysThreshold?: InputMaybe<Scalars['Int']['input']>;
  expirationNotificationFrequency?: InputMaybe<ExpirationFrequency>;
  expirationNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  homeInvites?: InputMaybe<Scalars['Boolean']['input']>;
  lowStockAlerts?: InputMaybe<Scalars['Boolean']['input']>;
  mealPlanReminders?: InputMaybe<Scalars['Boolean']['input']>;
  monthlyReport?: InputMaybe<Scalars['Boolean']['input']>;
  pantryChanges?: InputMaybe<Scalars['Boolean']['input']>;
  pushEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  quietHoursEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  quietHoursEnd?: InputMaybe<Scalars['String']['input']>;
  quietHoursStart?: InputMaybe<Scalars['String']['input']>;
  quietHoursTimezone?: InputMaybe<Scalars['String']['input']>;
  recipeRecommendations?: InputMaybe<Scalars['Boolean']['input']>;
  sharedListUpdates?: InputMaybe<Scalars['Boolean']['input']>;
  shoppingListUpdates?: InputMaybe<Scalars['Boolean']['input']>;
  smsEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  weeklyDigest?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdatePantryInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  temperature?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePantryItemInput = {
  condition?: InputMaybe<ItemCondition>;
  currentQuantity?: InputMaybe<Scalars['Float']['input']>;
  expirationAlert?: InputMaybe<Scalars['Boolean']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  lowStockAlert?: InputMaybe<Scalars['Boolean']['input']>;
  minQuantity?: InputMaybe<Scalars['Float']['input']>;
  packageWeight?: InputMaybe<Scalars['Float']['input']>;
  packageWeightUnitId?: InputMaybe<Scalars['String']['input']>;
  restockQuantity?: InputMaybe<Scalars['Float']['input']>;
  storageLocationId?: InputMaybe<Scalars['String']['input']>;
  storageNotes?: InputMaybe<Scalars['String']['input']>;
  storageState?: InputMaybe<StorageState>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
  wasteAmount?: InputMaybe<Scalars['Float']['input']>;
  wasteReason?: InputMaybe<WasteReason>;
};

/** Result of updating a pantry item */
export type UpdatePantryItemResult =
  | NotFoundError
  | PantryItem
  | UnauthorizedError
  | ValidationError
  | VersionMismatchError;

export type UpdatePurchaseInput = {
  discountAmount?: InputMaybe<Scalars['Float']['input']>;
  expirationDate?: InputMaybe<Scalars['DateTime']['input']>;
  originalPrice?: InputMaybe<Scalars['Float']['input']>;
  purchaseDate?: InputMaybe<Scalars['DateTime']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  receiptNumber?: InputMaybe<Scalars['String']['input']>;
  totalPrice?: InputMaybe<Scalars['Float']['input']>;
  transactionId?: InputMaybe<Scalars['String']['input']>;
  unitPrice?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdateRecipeInput = {
  addTags?: InputMaybe<Array<Scalars['String']['input']>>;
  caloriesPerServing?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<RecipeCategory>;
  cookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  cuisine?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  diets?: InputMaybe<Array<Diet>>;
  difficulty?: InputMaybe<Difficulty>;
  externalSourceData?: InputMaybe<Scalars['JSON']['input']>;
  externalSourceId?: InputMaybe<Scalars['String']['input']>;
  externalSourceUrl?: InputMaybe<Scalars['String']['input']>;
  healthGoals?: InputMaybe<Array<HealthGoal>>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  instructions?: InputMaybe<Scalars['JSON']['input']>;
  intolerances?: InputMaybe<Array<Intolerance>>;
  isPublished?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  nutritionData?: InputMaybe<Scalars['JSON']['input']>;
  originalAuthor?: InputMaybe<Scalars['String']['input']>;
  prepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  removeTags?: InputMaybe<Array<Scalars['String']['input']>>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  sourceUrl?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<RecipeStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  tips?: InputMaybe<Scalars['String']['input']>;
  totalTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  videoUrl?: InputMaybe<Scalars['String']['input']>;
  visibility?: InputMaybe<Visibility>;
};

export type UpdateRestrictionInput = {
  id: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  severity?: InputMaybe<RestrictionSeverity>;
};

export type UpdateShoppingListInput = {
  autoAddSuggestions?: InputMaybe<Scalars['Boolean']['input']>;
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  homeId?: InputMaybe<Scalars['String']['input']>;
  isCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  plannedShopDate?: InputMaybe<Scalars['String']['input']>;
  priceTracking?: InputMaybe<Scalars['Boolean']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  reminderDate?: InputMaybe<Scalars['String']['input']>;
  reminderEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  smartSorting?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<ListStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  targetStoreId?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateShoppingListItemInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  budgetPrice?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  estimatedPrice?: InputMaybe<Scalars['Float']['input']>;
  isPurchased?: InputMaybe<Scalars['Boolean']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  preferredStoreId?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  purchasedPrice?: InputMaybe<Scalars['Float']['input']>;
  purchasedQuantity?: InputMaybe<Scalars['Float']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  sortOrder?: InputMaybe<Scalars['String']['input']>;
  storeSection?: InputMaybe<Scalars['String']['input']>;
  unitId?: InputMaybe<Scalars['ID']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

/** Result of updating a shopping list item */
export type UpdateShoppingListItemResult =
  | NotFoundError
  | ShoppingListItem
  | UnauthorizedError
  | ValidationError
  | VersionMismatchError;

/**
 * Input for updating an existing storage location
 * All fields are optional
 */
export type UpdateStorageLocationInput = {
  /** New capacity value */
  capacity?: InputMaybe<Scalars['Float']['input']>;
  /** New capacity unit */
  capacityUnit?: InputMaybe<Scalars['String']['input']>;
  /** New color code */
  color?: InputMaybe<Scalars['String']['input']>;
  /** New description */
  description?: InputMaybe<Scalars['String']['input']>;
  /** New icon identifier */
  icon?: InputMaybe<Scalars['String']['input']>;
  /** Activate or deactivate the location */
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  /** Update climate control setting */
  isClimateControlled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Set or unset as default location */
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  /** New display name */
  name?: InputMaybe<Scalars['String']['input']>;
  /** New parent location ID (set to null to make top-level) */
  parentLocationId?: InputMaybe<Scalars['ID']['input']>;
  /** New sort order */
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  /** New temperature state */
  temperature?: InputMaybe<StorageState>;
  /** New storage type */
  type?: InputMaybe<StorageType>;
};

export type UpdateStoreInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  averageShelfLife?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  priceAccuracy?: InputMaybe<Scalars['Float']['input']>;
  qualityRating?: InputMaybe<Scalars['Float']['input']>;
  supportsPriceAPI?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateTemplateItemInput = {
  customMealName?: InputMaybe<Scalars['String']['input']>;
  dayOffset?: InputMaybe<Scalars['Int']['input']>;
  mealType?: InputMaybe<MealType>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateUnitInput = {
  baseUnitId?: InputMaybe<Scalars['String']['input']>;
  conversionFactor?: InputMaybe<Scalars['Float']['input']>;
  isCommon?: InputMaybe<Scalars['Boolean']['input']>;
  isMetric?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<UnitType>;
};

export type UpdateUserAddressInput = {
  city?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  postalCode?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
  street?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserInput = {
  deletedAt?: InputMaybe<Scalars['DateTime']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  emailVerified?: InputMaybe<Scalars['Boolean']['input']>;
  lastLoginAt?: InputMaybe<Scalars['DateTime']['input']>;
  onBoarded?: InputMaybe<Scalars['Boolean']['input']>;
  preferredCurrency?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<UserRole>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserModerationInput = {
  moderatorNotes?: InputMaybe<Scalars['String']['input']>;
  restrictedUntil?: InputMaybe<Scalars['DateTime']['input']>;
  restrictionReason?: InputMaybe<Scalars['String']['input']>;
  restrictions?: InputMaybe<Array<ModerationRestriction>>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
  status?: InputMaybe<ModerationStatus>;
  trustLevel?: InputMaybe<TrustLevel>;
};

export type UpdateUserProfileInput = {
  avatar?: InputMaybe<Scalars['String']['input']>;
  bio?: InputMaybe<Scalars['String']['input']>;
  coverImage?: InputMaybe<Scalars['String']['input']>;
  dateOfBirth?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  gender?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  profileVisibility?: InputMaybe<ProfileVisibility>;
  showEmail?: InputMaybe<Scalars['Boolean']['input']>;
  showPhone?: InputMaybe<Scalars['Boolean']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
};

/** Result of updating user profile */
export type UpdateUserResult =
  | NotFoundError
  | UnauthorizedError
  | User
  | ValidationError;

export type UpdateUserSettingsInput = {
  autoSync?: InputMaybe<Scalars['Boolean']['input']>;
  betaFeatures?: InputMaybe<Array<Scalars['String']['input']>>;
  compactMode?: InputMaybe<Scalars['Boolean']['input']>;
  emailNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  enabledFeatures?: InputMaybe<Array<Scalars['String']['input']>>;
  expiredItemAlerts?: InputMaybe<Scalars['Boolean']['input']>;
  lowStockAlerts?: InputMaybe<Scalars['Boolean']['input']>;
  offlineMode?: InputMaybe<Scalars['Boolean']['input']>;
  personalizedAds?: InputMaybe<Scalars['Boolean']['input']>;
  preferredUnitSystem?: InputMaybe<UnitSystem>;
  pushNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  recipeRecommendations?: InputMaybe<Scalars['Boolean']['input']>;
  shareUsageData?: InputMaybe<Scalars['Boolean']['input']>;
  shareWithPartners?: InputMaybe<Scalars['Boolean']['input']>;
  shoppingListUpdates?: InputMaybe<Scalars['Boolean']['input']>;
  showTutorials?: InputMaybe<Scalars['Boolean']['input']>;
  smsNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  theme?: InputMaybe<AppTheme>;
  weeklyDigest?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Result of updating user settings */
export type UpdateUserSettingsResult =
  | NotFoundError
  | UnauthorizedError
  | UserSettings
  | ValidationError;

export type UpsertItemResult = {
  __typename?: 'UpsertItemResult';
  created: Scalars['Boolean']['output'];
  item: Item;
  mapping: ExternalSourceMapping;
};

/** Comprehensive usage analytics for a pantry */
export type UsageAnalytics = {
  __typename?: 'UsageAnalytics';
  averageUsagePerDay: Scalars['Float']['output'];
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  topUsedItems: Array<UsageByItem>;
  totalQuantityUsed: Scalars['Float']['output'];
  totalUsageCount: Scalars['Int']['output'];
  usageByPurpose: Array<UsageByPurpose>;
  usageBySource: Array<UsageBySource>;
  usageTrend: Array<TimeSeriesDataPoint>;
};

/** Usage breakdown by item - top consumed items */
export type UsageByItem = {
  __typename?: 'UsageByItem';
  count: Scalars['Int']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  itemId: Scalars['String']['output'];
  itemName: Scalars['String']['output'];
  totalQuantity: Scalars['Float']['output'];
  unitName?: Maybe<Scalars['String']['output']>;
};

/** Usage breakdown by purpose (cooking, snack, waste, etc.) */
export type UsageByPurpose = {
  __typename?: 'UsageByPurpose';
  count: Scalars['Int']['output'];
  percentage: Scalars['Float']['output'];
  purpose: UsagePurpose;
  totalQuantity: Scalars['Float']['output'];
};

/** Usage breakdown by source (manual, cooking log, meal plan, recipe) */
export type UsageBySource = {
  __typename?: 'UsageBySource';
  count: Scalars['Int']['output'];
  percentage: Scalars['Float']['output'];
  source: UsageSource;
  totalQuantity: Scalars['Float']['output'];
};

/** Usage breakdown by unit for mixed-unit tracking */
export type UsageByUnit = {
  __typename?: 'UsageByUnit';
  count: Scalars['Int']['output'];
  totalQuantity: Scalars['Float']['output'];
  unitId: Scalars['String']['output'];
  unitName: Scalars['String']['output'];
  unitSymbol: Scalars['String']['output'];
};

export enum UsagePurpose {
  Cooking = 'COOKING',
  General = 'GENERAL',
  Gift = 'GIFT',
  MealPrep = 'MEAL_PREP',
  Restock = 'RESTOCK',
  Snack = 'SNACK',
  Transfer = 'TRANSFER',
  Waste = 'WASTE',
}

/** Source that triggered pantry item usage */
export enum UsageSource {
  Manual = 'MANUAL',
  RecipeAuto = 'RECIPE_AUTO',
  RecipeManual = 'RECIPE_MANUAL',
  Transfer = 'TRANSFER',
  Waste = 'WASTE',
}

/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type User = {
  __typename?: 'User';
  addresses: Array<UserAddress>;
  createdAt: Scalars['DateTime']['output'];
  defaultHome?: Maybe<Home>;
  defaultHomeId?: Maybe<Scalars['String']['output']>;
  defaultShoppingListId?: Maybe<Scalars['String']['output']>;
  devices: Array<Device>;
  dietaryProfile?: Maybe<DietaryProfile>;
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  homeOwnerships: Array<HomeOwnership>;
  id: Scalars['ID']['output'];
  language?: Maybe<Scalars['String']['output']>;
  lastActiveAt?: Maybe<Scalars['DateTime']['output']>;
  loginHistory: Array<LoginHistory>;
  moderation?: Maybe<UserModeration>;
  notificationPreferences?: Maybe<NotificationPreferences>;
  onBoarded: Scalars['Boolean']['output'];
  preferredCurrency?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<UserProfile>;
  role: UserRole;
  settings?: Maybe<UserSettings>;
  shoppingListOwnerships: Array<ShoppingListOwnership>;
  statistics?: Maybe<UserStatistics>;
  timezone?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type UserActivityPayload = {
  __typename?: 'UserActivityPayload';
  activityType: UserActivityType;
  description: Scalars['String']['output'];
  metadata?: Maybe<Scalars['JSON']['output']>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export enum UserActivityType {
  ContentCreated = 'CONTENT_CREATED',
  ContentDeleted = 'CONTENT_DELETED',
  ContentUpdated = 'CONTENT_UPDATED',
  Login = 'LOGIN',
  Logout = 'LOGOUT',
  ProfileUpdate = 'PROFILE_UPDATE',
  PurchaseMade = 'PURCHASE_MADE',
  ReviewGiven = 'REVIEW_GIVEN',
  SettingsChange = 'SETTINGS_CHANGE',
  SocialAction = 'SOCIAL_ACTION',
}

/**
 * User address information
 * Cache: 10 minutes - addresses rarely change, always private
 */
export type UserAddress = {
  __typename?: 'UserAddress';
  city: Scalars['String']['output'];
  country: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  label: Scalars['String']['output'];
  lat?: Maybe<Scalars['Float']['output']>;
  lng?: Maybe<Scalars['Float']['output']>;
  postalCode: Scalars['String']['output'];
  state: Scalars['String']['output'];
  street: Scalars['String']['output'];
};

export type UserAuthPayload = {
  __typename?: 'UserAuthPayload';
  authType: Scalars['String']['output'];
  deviceInfo?: Maybe<Scalars['JSON']['output']>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export type UserModeration = {
  __typename?: 'UserModeration';
  abuseScore: Scalars['Float']['output'];
  appealNotes?: Maybe<Scalars['String']['output']>;
  appealStatus?: Maybe<AppealStatus>;
  appealedAt?: Maybe<Scalars['DateTime']['output']>;
  automatedFlags: Array<AutomatedFlag>;
  banReason?: Maybe<Scalars['String']['output']>;
  bannedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<User>;
  createdById?: Maybe<Scalars['String']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedBy?: Maybe<User>;
  deletedById?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isBanned: Scalars['Boolean']['output'];
  isSuspended: Scalars['Boolean']['output'];
  lastModifiedBy?: Maybe<User>;
  lastModifiedById?: Maybe<Scalars['String']['output']>;
  lastViolationAt?: Maybe<Scalars['DateTime']['output']>;
  moderatorNotes?: Maybe<Scalars['String']['output']>;
  restrictedUntil?: Maybe<Scalars['DateTime']['output']>;
  restrictionReason?: Maybe<Scalars['String']['output']>;
  restrictions: Array<ModerationRestriction>;
  reviewStartedAt?: Maybe<Scalars['DateTime']['output']>;
  riskScore: Scalars['Float']['output'];
  spamScore: Scalars['Float']['output'];
  status: ModerationStatus;
  suspendedAt?: Maybe<Scalars['DateTime']['output']>;
  suspendedUntil?: Maybe<Scalars['DateTime']['output']>;
  suspensionReason?: Maybe<Scalars['String']['output']>;
  trustLevel: TrustLevel;
  underReview: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['String']['output'];
  version: Scalars['Int']['output'];
  violationCount: Scalars['Int']['output'];
  warningCount: Scalars['Int']['output'];
};

export type UserModerationChangedPayload = {
  __typename?: 'UserModerationChangedPayload';
  moderatedBy: Scalars['String']['output'];
  moderationStatus: Scalars['String']['output'];
  moderationType: Scalars['String']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

/**
 * User profile information
 * Cache: 10 minutes - profile data rarely changes, always private
 */
export type UserProfile = {
  __typename?: 'UserProfile';
  avatar?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  coverImage?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dateOfBirth?: Maybe<Scalars['DateTime']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  gender?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  profileVisibility: ProfileVisibility;
  showEmail: Scalars['Boolean']['output'];
  showPhone: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
  website?: Maybe<Scalars['String']['output']>;
};

export type UserProfileChangedPayload = {
  __typename?: 'UserProfileChangedPayload';
  mutation: Scalars['String']['output'];
  profile: UserProfile;
  timestamp: Scalars['DateTime']['output'];
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['String']['output'];
};

export enum UserRole {
  Admin = 'ADMIN',
  Moderator = 'MODERATOR',
  SuperAdmin = 'SUPER_ADMIN',
  User = 'USER',
}

/**
 * User settings and preferences
 * Cache: 10 minutes - settings rarely change, always private
 */
export type UserSettings = {
  __typename?: 'UserSettings';
  alwaysShowFractions: Scalars['Boolean']['output'];
  autoSync: Scalars['Boolean']['output'];
  betaFeatures: Array<Scalars['String']['output']>;
  compactMode: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  enabledFeatures: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  language: Scalars['String']['output'];
  maxDecimalPlaces: Scalars['Int']['output'];
  offlineMode: Scalars['Boolean']['output'];
  personalizedAds: Scalars['Boolean']['output'];
  preferredCurrency: Scalars['String']['output'];
  preferredFractionSet?: Maybe<Scalars['JSON']['output']>;
  preferredUnitSystem: UnitSystem;
  quantityDisplayPreference: QuantityDisplayPreference;
  shareUsageData: Scalars['Boolean']['output'];
  shareWithPartners: Scalars['Boolean']['output'];
  showTutorials: Scalars['Boolean']['output'];
  theme: AppTheme;
  timezone: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
};

export type UserSocialPayload = {
  __typename?: 'UserSocialPayload';
  action: Scalars['String']['output'];
  targetUserId: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

/**
 * User activity statistics
 * Cache: 3 minutes - stats update with user activity, always private
 */
export type UserStatistics = {
  __typename?: 'UserStatistics';
  averageRatingGiven?: Maybe<Scalars['Float']['output']>;
  helpfulVotesReceived: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  lastCalculatedAt: Scalars['DateTime']['output'];
  streakDays: Scalars['Int']['output'];
  totalAmountSpent: Scalars['Float']['output'];
  totalCollaborations: Scalars['Int']['output'];
  totalCookingSessions: Scalars['Int']['output'];
  totalItemsAdded: Scalars['Int']['output'];
  totalMealPlans: Scalars['Int']['output'];
  totalPurchases: Scalars['Int']['output'];
  totalRecipesCreated: Scalars['Int']['output'];
  totalReviewsGiven: Scalars['Int']['output'];
  totalShoppingLists: Scalars['Int']['output'];
  totalWasteReduced: Scalars['Float']['output'];
  user: User;
  userId: Scalars['String']['output'];
};

export type UserStatusChangedPayload = {
  __typename?: 'UserStatusChangedPayload';
  isOnline: Scalars['Boolean']['output'];
  lastActiveAt?: Maybe<Scalars['DateTime']['output']>;
  newStatus: UserStatusType;
  previousStatus?: Maybe<UserStatusType>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export enum UserStatusType {
  Away = 'AWAY',
  Busy = 'BUSY',
  Invisible = 'INVISIBLE',
  Offline = 'OFFLINE',
  Online = 'ONLINE',
}

export type UserUpdatedPayload = {
  __typename?: 'UserUpdatedPayload';
  mutation: Scalars['String']['output'];
  node: User;
  timestamp: Scalars['DateTime']['output'];
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['String']['output'];
};

export type ValidateTokenResponse = {
  __typename?: 'ValidateTokenResponse';
  email?: Maybe<Scalars['String']['output']>;
  valid: Scalars['Boolean']['output'];
};

/** Generic validation error for invalid input data */
export type ValidationError = MutationError & {
  __typename?: 'ValidationError';
  code: Scalars['String']['output'];
  /** Validation constraint that was violated */
  constraint?: Maybe<Scalars['String']['output']>;
  /** The field that failed validation (if applicable) */
  field: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

export type ValidationResult = {
  __typename?: 'ValidationResult';
  errors: Array<ValidationError>;
  isValid: Scalars['Boolean']['output'];
  warnings: Array<ValidationWarning>;
};

export type ValidationWarning = {
  __typename?: 'ValidationWarning';
  field: Scalars['String']['output'];
  message: Scalars['String']['output'];
  suggestion?: Maybe<Scalars['String']['output']>;
};

/** Brand information for a product variation */
export type VariationBrandInfo = {
  __typename?: 'VariationBrandInfo';
  id?: Maybe<Scalars['ID']['output']>;
  name: Scalars['String']['output'];
  type?: Maybe<Scalars['String']['output']>;
};

/** Image information for a product variation */
export type VariationImage = {
  __typename?: 'VariationImage';
  isPrimary?: Maybe<Scalars['Boolean']['output']>;
  size?: Maybe<Scalars['String']['output']>;
  source?: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
};

/** Error when optimistic locking version mismatch occurs */
export type VersionMismatchError = MutationError & {
  __typename?: 'VersionMismatchError';
  /** Actual current version on server */
  actualVersion: Scalars['Int']['output'];
  code: Scalars['String']['output'];
  /** Expected version from client */
  expectedVersion: Scalars['Int']['output'];
  message: Scalars['String']['output'];
  /** The resource that had the version mismatch */
  resourceId: Scalars['ID']['output'];
};

export enum Visibility {
  Private = 'PRIVATE',
  Public = 'PUBLIC',
  Restricted = 'RESTRICTED',
}

/** Comprehensive waste analytics for a pantry */
export type WasteAnalytics = {
  __typename?: 'WasteAnalytics';
  averageWastePerDay: Scalars['Float']['output'];
  composted: Scalars['Float']['output'];
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  recycled: Scalars['Float']['output'];
  topWastedItems: Array<WasteByItem>;
  totalWasteCount: Scalars['Int']['output'];
  totalWasteQuantity: Scalars['Float']['output'];
  totalWasteValue: Scalars['Float']['output'];
  wasteByReason: Array<WasteByReason>;
  wasteRate: Scalars['Float']['output'];
  wasteTrend: Array<TimeSeriesDataPoint>;
};

/** Waste breakdown by item - most wasted items */
export type WasteByItem = {
  __typename?: 'WasteByItem';
  count: Scalars['Int']['output'];
  estimatedValue?: Maybe<Scalars['Float']['output']>;
  imageUrl?: Maybe<Scalars['String']['output']>;
  itemId: Scalars['String']['output'];
  itemName: Scalars['String']['output'];
  totalQuantity: Scalars['Float']['output'];
  unitName?: Maybe<Scalars['String']['output']>;
};

/** Waste breakdown by reason (expired, spoiled, etc.) */
export type WasteByReason = {
  __typename?: 'WasteByReason';
  count: Scalars['Int']['output'];
  estimatedValue?: Maybe<Scalars['Float']['output']>;
  percentage: Scalars['Float']['output'];
  reason: WasteReason;
  totalQuantity: Scalars['Float']['output'];
};

export enum WasteReason {
  CookingFail = 'COOKING_FAIL',
  Expired = 'EXPIRED',
  Mold = 'MOLD',
  Other = 'OTHER',
  Overstock = 'OVERSTOCK',
  Pest = 'PEST',
  Spoiled = 'SPOILED',
  Taste = 'TASTE',
}

export type GetAuthUserQueryVariables = Exact<{ [key: string]: never }>;

export type GetAuthUserQuery = {
  __typename?: 'Query';
  me?:
    | {
        __typename?: 'User';
        id: string;
        email: string;
        emailVerified: boolean;
        role: UserRole;
        onBoarded: boolean;
        createdAt: string;
        updatedAt: string;
        timezone?: string | null | undefined;
      }
    | null
    | undefined;
};

export type GetCompleteUserQueryVariables = Exact<{ [key: string]: never }>;

export type GetCompleteUserQuery = {
  __typename?: 'Query';
  me?:
    | {
        __typename?: 'User';
        id: string;
        email: string;
        emailVerified: boolean;
        role: UserRole;
        onBoarded: boolean;
        createdAt: string;
        updatedAt: string;
        timezone?: string | null | undefined;
        addresses: Array<{
          __typename?: 'UserAddress';
          id: string;
          label: string;
          street: string;
          city: string;
          state: string;
          postalCode: string;
          country: string;
          lat?: number | null | undefined;
          lng?: number | null | undefined;
          isDefault: boolean;
        }>;
        devices: Array<{
          __typename?: 'Device';
          id: string;
          userId: string;
          deviceId: string;
          deviceName?: string | null | undefined;
          deviceType: DeviceType;
          userAgent?: string | null | undefined;
          browserName?: string | null | undefined;
          browserVersion?: string | null | undefined;
          osName?: string | null | undefined;
          osVersion?: string | null | undefined;
          screenResolution?: string | null | undefined;
          timezone?: string | null | undefined;
          language?: string | null | undefined;
          appVersion?: string | null | undefined;
          platform?: MobilePlatform | null | undefined;
          pushToken?: string | null | undefined;
          isActive: boolean;
          isTrusted: boolean;
          lastSeenAt: string;
          isVerified: boolean;
          verifiedAt?: string | null | undefined;
          loginCount: number;
          lastLoginAt?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          deletedAt?: string | null | undefined;
        }>;
        homeOwnerships: Array<{
          __typename?: 'HomeOwnership';
          id: string;
          createdAt: string;
          homeId: string;
          userId: string;
          user: { __typename?: 'User'; id: string };
          home: {
            __typename?: 'Home';
            id: string;
            name: string;
            createdAt: string;
          };
        }>;
        shoppingListOwnerships: Array<{
          __typename?: 'ShoppingListOwnership';
          createdAt: string;
          id: string;
          transferredAt?: string | null | undefined;
          transferredFrom?: string | null | undefined;
          shoppingList: { __typename?: 'ShoppingList'; id: string };
        }>;
      }
    | null
    | undefined;
};

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;

export type LoginMutation = {
  __typename?: 'Mutation';
  login: {
    __typename?: 'AuthPayload';
    accessToken: string;
    refreshToken: string;
    user: {
      __typename?: 'User';
      id: string;
      email: string;
      emailVerified: boolean;
      role: UserRole;
      onBoarded: boolean;
      createdAt: string;
      updatedAt: string;
      timezone?: string | null | undefined;
    };
  };
};

export type RegisterMutationVariables = Exact<{
  input: RegisterInput;
}>;

export type RegisterMutation = {
  __typename?: 'Mutation';
  register: {
    __typename?: 'AuthPayload';
    accessToken: string;
    refreshToken: string;
    user: {
      __typename?: 'User';
      id: string;
      email: string;
      emailVerified: boolean;
      role: UserRole;
      onBoarded: boolean;
      createdAt: string;
      updatedAt: string;
      timezone?: string | null | undefined;
    };
  };
};

export type RefreshTokenMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;

export type RefreshTokenMutation = {
  __typename?: 'Mutation';
  refresh: {
    __typename?: 'RefreshTokenPayload';
    accessToken: string;
    refreshToken: string;
  };
};

export type VerifyEmailMutationVariables = Exact<{
  code: Scalars['String']['input'];
}>;

export type VerifyEmailMutation = {
  __typename?: 'Mutation';
  verifyEmail: boolean;
};

export type ForgotPasswordMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;

export type ForgotPasswordMutation = {
  __typename?: 'Mutation';
  forgotPassword: {
    __typename?: 'ForgotPasswordResponse';
    success: boolean;
    message: string;
  };
};

export type ResetPasswordMutationVariables = Exact<{
  token: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
}>;

export type ResetPasswordMutation = {
  __typename?: 'Mutation';
  resetPassword: {
    __typename?: 'ResetPasswordResponse';
    success: boolean;
    message: string;
  };
};

export type ResendVerificationEmailMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;

export type ResendVerificationEmailMutation = {
  __typename?: 'Mutation';
  resendVerificationEmail: boolean;
};

export type ChangePasswordMutationVariables = Exact<{
  input: ChangePasswordInput;
}>;

export type ChangePasswordMutation = {
  __typename?: 'Mutation';
  changePassword: {
    __typename?: 'ChangePasswordResponse';
    success: boolean;
    message: string;
  };
};

export type GetMyDevicesQueryVariables = Exact<{
  input: DevicesQueryInput;
}>;

export type GetMyDevicesQuery = {
  __typename?: 'Query';
  devices: {
    __typename?: 'DeviceConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'DeviceEdge';
      cursor: string;
      node: {
        __typename?: 'Device';
        id: string;
        deviceId: string;
        deviceName?: string | null | undefined;
        deviceType: DeviceType;
        platform?: MobilePlatform | null | undefined;
        osName?: string | null | undefined;
        osVersion?: string | null | undefined;
        appVersion?: string | null | undefined;
        userAgent?: string | null | undefined;
        browserName?: string | null | undefined;
        browserVersion?: string | null | undefined;
        screenResolution?: string | null | undefined;
        timezone?: string | null | undefined;
        language?: string | null | undefined;
        isActive: boolean;
        isTrusted: boolean;
        isVerified: boolean;
        loginCount: number;
        lastLoginAt?: string | null | undefined;
        lastSeenAt: string;
        createdAt: string;
        updatedAt: string;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null | undefined;
      endCursor?: string | null | undefined;
    };
  };
};

export type GetDeviceByDeviceIdQueryVariables = Exact<{
  deviceId: Scalars['String']['input'];
}>;

export type GetDeviceByDeviceIdQuery = {
  __typename?: 'Query';
  deviceByDeviceId?:
    | {
        __typename?: 'Device';
        id: string;
        deviceId: string;
        deviceName?: string | null | undefined;
        deviceType: DeviceType;
        platform?: MobilePlatform | null | undefined;
        isActive: boolean;
        isTrusted: boolean;
        isVerified: boolean;
        lastSeenAt: string;
        createdAt: string;
      }
    | null
    | undefined;
};

export type RegisterDeviceMutationVariables = Exact<{
  input: DeviceRegistrationInput;
}>;

export type RegisterDeviceMutation = {
  __typename?: 'Mutation';
  registerDevice: {
    __typename?: 'Device';
    id: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    deviceType: DeviceType;
    platform?: MobilePlatform | null | undefined;
    osName?: string | null | undefined;
    osVersion?: string | null | undefined;
    appVersion?: string | null | undefined;
    userAgent?: string | null | undefined;
    browserName?: string | null | undefined;
    browserVersion?: string | null | undefined;
    screenResolution?: string | null | undefined;
    timezone?: string | null | undefined;
    language?: string | null | undefined;
    isActive: boolean;
    isTrusted: boolean;
    isVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type UpdateDeviceLastSeenMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type UpdateDeviceLastSeenMutation = {
  __typename?: 'Mutation';
  updateDevice: {
    __typename?: 'Device';
    id: string;
    deviceId: string;
    lastSeenAt: string;
    updatedAt: string;
  };
};

export type TrustDeviceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type TrustDeviceMutation = {
  __typename?: 'Mutation';
  updateDevice: {
    __typename?: 'Device';
    id: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    isTrusted: boolean;
    updatedAt: string;
  };
};

export type UntrustDeviceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type UntrustDeviceMutation = {
  __typename?: 'Mutation';
  updateDevice: {
    __typename?: 'Device';
    id: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    isTrusted: boolean;
    updatedAt: string;
  };
};

export type VerifyDeviceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type VerifyDeviceMutation = {
  __typename?: 'Mutation';
  updateDevice: {
    __typename?: 'Device';
    id: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    isVerified: boolean;
    verifiedAt?: string | null | undefined;
  };
};

export type DeactivateDeviceMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeactivateDeviceMutation = {
  __typename?: 'Mutation';
  updateDevice: {
    __typename?: 'Device';
    id: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    isActive: boolean;
    updatedAt: string;
  };
};

export type DeviceActivitySubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type DeviceActivitySubscription = {
  __typename?: 'Subscription';
  deviceActivity: {
    __typename?: 'Device';
    id: string;
    userId: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    deviceType: DeviceType;
    platform?: MobilePlatform | null | undefined;
    lastSeenAt: string;
    isActive: boolean;
    isTrusted: boolean;
    loginCount: number;
    user?:
      | { __typename?: 'User'; id: string; email: string }
      | null
      | undefined;
  };
};

export type DeviceRegisteredSubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type DeviceRegisteredSubscription = {
  __typename?: 'Subscription';
  deviceRegistered: {
    __typename?: 'Device';
    id: string;
    userId: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    deviceType: DeviceType;
    platform?: MobilePlatform | null | undefined;
    userAgent?: string | null | undefined;
    browserName?: string | null | undefined;
    browserVersion?: string | null | undefined;
    osName?: string | null | undefined;
    osVersion?: string | null | undefined;
    isActive: boolean;
    isTrusted: boolean;
    isVerified: boolean;
    createdAt: string;
  };
};

export type DeviceStatusChangedSubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type DeviceStatusChangedSubscription = {
  __typename?: 'Subscription';
  deviceStatusChanged: {
    __typename?: 'Device';
    id: string;
    userId: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    isActive: boolean;
    lastSeenAt: string;
    updatedAt: string;
  };
};

export type DeviceTrustChangedSubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type DeviceTrustChangedSubscription = {
  __typename?: 'Subscription';
  deviceTrustChanged: {
    __typename?: 'Device';
    id: string;
    userId: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    isTrusted: boolean;
    updatedAt: string;
  };
};

export type DeviceVerifiedSubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type DeviceVerifiedSubscription = {
  __typename?: 'Subscription';
  deviceVerified: {
    __typename?: 'Device';
    id: string;
    userId: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    isVerified: boolean;
    verifiedAt?: string | null | undefined;
  };
};

export type LoginAttemptsSubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type LoginAttemptsSubscription = {
  __typename?: 'Subscription';
  loginAttempts: {
    __typename?: 'LoginHistory';
    id: string;
    userId: string;
    success: boolean;
    method: LoginMethod;
    provider?: string | null | undefined;
    isVpn?: boolean | null | undefined;
    isTor?: boolean | null | undefined;
    isProxy?: boolean | null | undefined;
    userAgent?: string | null | undefined;
    browserName?: string | null | undefined;
    browserVersion?: string | null | undefined;
    osName?: string | null | undefined;
    osVersion?: string | null | undefined;
    deviceType?: DeviceType | null | undefined;
    isMobileApp: boolean;
    riskScore?: number | null | undefined;
    isRisky: boolean;
    riskFactors: Array<RiskFactor>;
    failureReason?: LoginFailureReason | null | undefined;
    failureDetails?: string | null | undefined;
    isNewLocation: boolean;
    isNewDevice: boolean;
    isNewBrowser: boolean;
    loggedInAt: string;
    user: { __typename?: 'User'; id: string; email: string };
  };
};

export type SuspiciousActivitySubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type SuspiciousActivitySubscription = {
  __typename?: 'Subscription';
  suspiciousActivity: {
    __typename?: 'SuspiciousActivity';
    suspiciousActivity: boolean;
    rapidAttempts?:
      | Array<{ __typename?: 'RapidAttempt'; hour: string; count: number }>
      | null
      | undefined;
    riskyLogins: Array<{
      __typename?: 'LoginHistory';
      id: string;
      riskScore?: number | null | undefined;
      riskFactors: Array<RiskFactor>;
      loggedInAt: string;
    }>;
    newLocationLogins?:
      | Array<{ __typename?: 'LoginHistory'; id: string; loggedInAt: string }>
      | null
      | undefined;
    newDeviceLogins?:
      | Array<{
          __typename?: 'LoginHistory';
          id: string;
          deviceType?: DeviceType | null | undefined;
          browserName?: string | null | undefined;
          osName?: string | null | undefined;
          loggedInAt: string;
        }>
      | null
      | undefined;
    unusualTimeLogins?:
      | Array<{
          __typename?: 'LoginHistory';
          id: string;
          loggedInAt: string;
          timezoneDiff?: number | null | undefined;
        }>
      | null
      | undefined;
  };
};

export type FailedLoginAttemptsSubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type FailedLoginAttemptsSubscription = {
  __typename?: 'Subscription';
  failedLoginAttempts: {
    __typename?: 'LoginHistory';
    id: string;
    userId: string;
    method: LoginMethod;
    userAgent?: string | null | undefined;
    failureReason?: LoginFailureReason | null | undefined;
    failureDetails?: string | null | undefined;
    loggedInAt: string;
  };
};

export type RiskyLoginAlertsSubscriptionVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;

export type RiskyLoginAlertsSubscription = {
  __typename?: 'Subscription';
  riskyLoginAlerts: {
    __typename?: 'LoginHistory';
    id: string;
    userId: string;
    riskScore?: number | null | undefined;
    riskFactors: Array<RiskFactor>;
    isVpn?: boolean | null | undefined;
    isTor?: boolean | null | undefined;
    isProxy?: boolean | null | undefined;
    requiresMfa: boolean;
    mfaCompleted: boolean;
    loggedInAt: string;
    flaggedReason?: string | null | undefined;
    flaggedBy?:
      | { __typename?: 'User'; id: string; email: string }
      | null
      | undefined;
  };
};

export type GetMeQueryVariables = Exact<{ [key: string]: never }>;

export type GetMeQuery = {
  __typename?: 'Query';
  me?:
    | {
        __typename?: 'User';
        id: string;
        email: string;
        emailVerified: boolean;
        role: UserRole;
        onBoarded: boolean;
        timezone?: string | null | undefined;
        preferredCurrency?: string | null | undefined;
        language?: string | null | undefined;
        defaultShoppingListId?: string | null | undefined;
        defaultHomeId?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        lastActiveAt?: string | null | undefined;
        profile?:
          | {
              __typename?: 'UserProfile';
              id: string;
              firstName?: string | null | undefined;
              lastName?: string | null | undefined;
              displayName?: string | null | undefined;
              bio?: string | null | undefined;
              avatar?: string | null | undefined;
              phone?: string | null | undefined;
            }
          | null
          | undefined;
        settings?:
          | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type GetUserSettingsQueryVariables = Exact<{ [key: string]: never }>;

export type GetUserSettingsQuery = {
  __typename?: 'Query';
  userSettings?:
    | {
        __typename?: 'UserSettings';
        id: string;
        theme: AppTheme;
        compactMode: boolean;
        showTutorials: boolean;
        autoSync: boolean;
        offlineMode: boolean;
        shareUsageData: boolean;
        shareWithPartners: boolean;
        personalizedAds: boolean;
        preferredUnitSystem: UnitSystem;
        language: string;
        timezone: string;
        preferredCurrency: string;
        enabledFeatures: Array<string>;
        betaFeatures: Array<string>;
        createdAt: string;
        updatedAt: string;
        user: { __typename?: 'User'; id: string; email: string };
      }
    | null
    | undefined;
};

export type GetUserProfileQueryVariables = Exact<{ [key: string]: never }>;

export type GetUserProfileQuery = {
  __typename?: 'Query';
  userProfile?:
    | {
        __typename?: 'UserProfile';
        id: string;
        userId: string;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        displayName?: string | null | undefined;
        bio?: string | null | undefined;
        avatar?: string | null | undefined;
        coverImage?: string | null | undefined;
        phone?: string | null | undefined;
        website?: string | null | undefined;
        dateOfBirth?: string | null | undefined;
        gender?: string | null | undefined;
        profileVisibility: ProfileVisibility;
        showEmail: boolean;
        showPhone: boolean;
        createdAt: string;
        updatedAt: string;
      }
    | null
    | undefined;
};

export type CanDeleteAccountQueryVariables = Exact<{ [key: string]: never }>;

export type CanDeleteAccountQuery = {
  __typename?: 'Query';
  canDeleteAccount: {
    __typename?: 'CanDeleteAccountResult';
    canDelete: boolean;
    blockers: Array<{
      __typename?: 'DeletionBlocker';
      type: DeletionBlockerType;
      resourceId: string;
      resourceName: string;
      message: string;
    }>;
  };
};

export type UpdateUserMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
}>;

export type UpdateUserMutation = {
  __typename?: 'Mutation';
  updateUser: {
    __typename?: 'User';
    id: string;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    onBoarded: boolean;
    timezone?: string | null | undefined;
    preferredCurrency?: string | null | undefined;
    language?: string | null | undefined;
    defaultShoppingListId?: string | null | undefined;
    defaultHomeId?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    lastActiveAt?: string | null | undefined;
  };
};

export type UpdateUserProfileMutationVariables = Exact<{
  input: UpdateUserProfileInput;
}>;

export type UpdateUserProfileMutation = {
  __typename?: 'Mutation';
  updateProfile: {
    __typename?: 'UserProfile';
    id: string;
    userId: string;
    firstName?: string | null | undefined;
    lastName?: string | null | undefined;
    displayName?: string | null | undefined;
    bio?: string | null | undefined;
    avatar?: string | null | undefined;
    coverImage?: string | null | undefined;
    phone?: string | null | undefined;
    website?: string | null | undefined;
    dateOfBirth?: string | null | undefined;
    gender?: string | null | undefined;
    profileVisibility: ProfileVisibility;
    showEmail: boolean;
    showPhone: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type UpdateUserPreferencesMutationVariables = Exact<{
  input: UpdateUserSettingsInput;
}>;

export type UpdateUserPreferencesMutation = {
  __typename?: 'Mutation';
  updateSettings: {
    __typename?: 'UserSettings';
    id: string;
    theme: AppTheme;
    compactMode: boolean;
    showTutorials: boolean;
    autoSync: boolean;
    offlineMode: boolean;
    shareUsageData: boolean;
    shareWithPartners: boolean;
    personalizedAds: boolean;
    preferredUnitSystem: UnitSystem;
    language: string;
    timezone: string;
    preferredCurrency: string;
    enabledFeatures: Array<string>;
    betaFeatures: Array<string>;
    createdAt: string;
    updatedAt: string;
    user: { __typename?: 'User'; id: string; email: string };
  };
};

export type DeleteAccountMutationVariables = Exact<{ [key: string]: never }>;

export type DeleteAccountMutation = {
  __typename?: 'Mutation';
  deleteAccount: boolean;
};

export type CompleteOnboardingMutationVariables = Exact<{
  [key: string]: never;
}>;

export type CompleteOnboardingMutation = {
  __typename?: 'Mutation';
  completeOnboarding: boolean;
};

export type UserUpdatedSubscriptionVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type UserUpdatedSubscription = {
  __typename?: 'Subscription';
  userUpdated: {
    __typename?: 'UserUpdatedPayload';
    mutation: string;
    updatedFields?: Array<string> | null | undefined;
    userId: string;
    timestamp: string;
    node: {
      __typename?: 'User';
      id: string;
      email: string;
      emailVerified: boolean;
      role: UserRole;
      onBoarded: boolean;
      timezone?: string | null | undefined;
      preferredCurrency?: string | null | undefined;
      language?: string | null | undefined;
      lastActiveAt?: string | null | undefined;
      profile?:
        | {
            __typename?: 'UserProfile';
            id: string;
            firstName?: string | null | undefined;
            lastName?: string | null | undefined;
            displayName?: string | null | undefined;
            avatar?: string | null | undefined;
            bio?: string | null | undefined;
          }
        | null
        | undefined;
    };
  };
};

export type UserStatusChangedSubscriptionVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type UserStatusChangedSubscription = {
  __typename?: 'Subscription';
  userStatusChanged: {
    __typename?: 'UserStatusChangedPayload';
    userId: string;
    newStatus: UserStatusType;
    previousStatus?: UserStatusType | null | undefined;
    isOnline: boolean;
    lastActiveAt?: string | null | undefined;
    timestamp: string;
  };
};

export type UserActivitySubscriptionVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type UserActivitySubscription = {
  __typename?: 'Subscription';
  userActivity: {
    __typename?: 'UserActivityPayload';
    userId: string;
    activityType: UserActivityType;
    description: string;
    metadata?: any | null | undefined;
    timestamp: string;
  };
};

export type UserModerationChangedSubscriptionVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type UserModerationChangedSubscription = {
  __typename?: 'Subscription';
  userModerationChanged: {
    __typename?: 'UserModerationChangedPayload';
    userId: string;
    moderationType: string;
    moderationStatus: string;
    reason?: string | null | undefined;
    moderatedBy: string;
    timestamp: string;
  };
};

export type UserProfileChangedSubscriptionVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type UserProfileChangedSubscription = {
  __typename?: 'Subscription';
  userProfileChanged: {
    __typename?: 'UserProfileChangedPayload';
    userId: string;
    mutation: string;
    updatedFields?: Array<string> | null | undefined;
    timestamp: string;
    profile: {
      __typename?: 'UserProfile';
      id: string;
      firstName?: string | null | undefined;
      lastName?: string | null | undefined;
      displayName?: string | null | undefined;
      bio?: string | null | undefined;
      avatar?: string | null | undefined;
      coverImage?: string | null | undefined;
      phone?: string | null | undefined;
      website?: string | null | undefined;
      profileVisibility: ProfileVisibility;
    };
  };
};

export type ShoppingListItemCoreFragment = {
  __typename?: 'ShoppingListItem';
  id: string;
  itemName?: string | null | undefined;
  quantity?: number | null | undefined;
  quantityInput?: string | null | undefined;
  displayFormat: DisplayFormat;
  version: number;
  updatedAt: string;
  category?: string | null | undefined;
  notes?: string | null | undefined;
  unitName?: string | null | undefined;
  purchaseInfo: {
    __typename?: 'ShoppingListItemPurchaseInfo';
    isPurchased: boolean;
  };
  unit?:
    | {
        __typename?: 'Unit';
        id: string;
        name: string;
        symbol: string;
        displayAsFraction: boolean;
        minPrecision: number;
        autoConvertThreshold?: number | null | undefined;
      }
    | null
    | undefined;
};

export type ShoppingListItemDisplayFragmentFragment = {
  __typename?: 'ShoppingListItem';
  id: string;
  itemName?: string | null | undefined;
  quantity?: number | null | undefined;
  sortOrder: string;
  unitName?: string | null | undefined;
  category?: string | null | undefined;
  version: number;
  purchaseInfo: {
    __typename?: 'ShoppingListItemPurchaseInfo';
    isPurchased: boolean;
  };
  unit?:
    | { __typename?: 'Unit'; id: string; name: string; symbol: string }
    | null
    | undefined;
  item?:
    | {
        __typename?: 'Item';
        id: string;
        imageUrl?: string | null | undefined;
        categories?:
          | Array<{
              __typename?: 'ItemCategory';
              id: string;
              isPrimary: boolean;
              category: { __typename?: 'Category'; id: string; name: string };
            }>
          | null
          | undefined;
        units: Array<{
          __typename?: 'ItemUnit';
          id: string;
          isDefault: boolean;
          isPreferred: boolean;
          unit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
        }>;
      }
    | null
    | undefined;
};

export type ShoppingListItemFragmentFragment = {
  __typename?: 'ShoppingListItem';
  priority: number;
  sortOrder: string;
  createdAt: string;
  deletedAt?: string | null | undefined;
  id: string;
  itemName?: string | null | undefined;
  quantity?: number | null | undefined;
  quantityInput?: string | null | undefined;
  displayFormat: DisplayFormat;
  version: number;
  updatedAt: string;
  category?: string | null | undefined;
  notes?: string | null | undefined;
  unitName?: string | null | undefined;
  shoppingList: {
    __typename?: 'ShoppingList';
    id: string;
    totalItems: number;
    completedItems: number;
    estimatedTotal: number;
  };
  item?:
    | {
        __typename?: 'Item';
        id: string;
        name: string;
        description?: string | null | undefined;
        imageUrl?: string | null | undefined;
        netWeight?: number | null | undefined;
        displayUnit?:
          | { __typename?: 'Unit'; id: string; name: string; symbol: string }
          | null
          | undefined;
        categories?:
          | Array<{
              __typename?: 'ItemCategory';
              id: string;
              isPrimary: boolean;
              confidence: number;
              source: CategorySource;
              assignedAt?: string | null | undefined;
              category: { __typename?: 'Category'; id: string; name: string };
            }>
          | null
          | undefined;
      }
    | null
    | undefined;
  unit?:
    | {
        __typename?: 'Unit';
        type: UnitType;
        isMetric: boolean;
        baseUnitId?: string | null | undefined;
        conversionFactor: number;
        notes?: string | null | undefined;
        isCommon: boolean;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
        id: string;
        name: string;
        symbol: string;
        displayAsFraction: boolean;
        minPrecision: number;
        autoConvertThreshold?: number | null | undefined;
      }
    | null
    | undefined;
  priceEstimate: {
    __typename?: 'PriceEstimate';
    estimated?: number | null | undefined;
    budget?: number | null | undefined;
    lastKnown?: number | null | undefined;
    lowest?: number | null | undefined;
    highest?: number | null | undefined;
    lastUpdated?: string | null | undefined;
  };
  purchaseInfo: {
    __typename?: 'ShoppingListItemPurchaseInfo';
    isPurchased: boolean;
    purchasedQuantity?: number | null | undefined;
    purchasedPrice?: number | null | undefined;
    purchaseDate?: string | null | undefined;
    purchasedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        }
      | null
      | undefined;
  };
  source: {
    __typename?: 'ShoppingListItemSource';
    isAutoAdded: boolean;
    autoAddReason?: string | null | undefined;
    isFromMealPlan: boolean;
    mealPlan?:
      | { __typename?: 'MealPlan'; id: string; name: string }
      | null
      | undefined;
  };
  storeInfo: {
    __typename?: 'ShoppingListItemStoreInfo';
    aisle?: string | null | undefined;
    storeSection?: string | null | undefined;
    preferredStore?:
      | { __typename?: 'Store'; id: string; name: string }
      | null
      | undefined;
  };
  purchaseHistory: {
    __typename?: 'PurchaseHistorySummary';
    previouslyPurchased: boolean;
    lastPurchaseDate?: string | null | undefined;
    purchaseCount: number;
  };
  addedBy?:
    | {
        __typename?: 'User';
        id: string;
        email: string;
        emailVerified: boolean;
        role: UserRole;
        onBoarded: boolean;
        timezone?: string | null | undefined;
        preferredCurrency?: string | null | undefined;
        language?: string | null | undefined;
        defaultShoppingListId?: string | null | undefined;
        defaultHomeId?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        lastActiveAt?: string | null | undefined;
        profile?:
          | {
              __typename?: 'UserProfile';
              id: string;
              firstName?: string | null | undefined;
              lastName?: string | null | undefined;
              displayName?: string | null | undefined;
              bio?: string | null | undefined;
              avatar?: string | null | undefined;
              phone?: string | null | undefined;
            }
          | null
          | undefined;
        settings?:
          | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
          | null
          | undefined;
      }
    | null
    | undefined;
  purchasesConnection: {
    __typename?: 'PurchaseConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'PurchaseEdge';
      cursor: string;
      node: {
        __typename?: 'Purchase';
        id: string;
        purchaseDate: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        itemName: string;
        unitSymbol: string;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type ShoppingListOwnershipFragmentFragment = {
  __typename?: 'ShoppingListOwnership';
  id: string;
  userId: string;
  shoppingListId: string;
  createdAt: string;
  transferredAt?: string | null | undefined;
  transferredFrom?: string | null | undefined;
  user: {
    __typename?: 'User';
    id: string;
    email: string;
    profile?:
      | {
          __typename?: 'UserProfile';
          displayName?: string | null | undefined;
          avatar?: string | null | undefined;
        }
      | null
      | undefined;
  };
};

export type ShoppingListCollaboratorFragmentFragment = {
  __typename?: 'ShoppingListCollaborator';
  id: string;
  email?: string | null | undefined;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  collaboratorId?: string | null | undefined;
  collaborator?:
    | {
        __typename?: 'User';
        id: string;
        email: string;
        profile?:
          | {
              __typename?: 'UserProfile';
              displayName?: string | null | undefined;
              avatar?: string | null | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
  invitedBy?:
    | {
        __typename?: 'User';
        id: string;
        email: string;
        profile?:
          | {
              __typename?: 'UserProfile';
              displayName?: string | null | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type BasicUserFragment = {
  __typename?: 'User';
  id: string;
  email: string;
};

export type AuthUserFragment = {
  __typename?: 'User';
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  onBoarded: boolean;
  createdAt: string;
  updatedAt: string;
  timezone?: string | null | undefined;
};

export type PartialUserFragment = {
  __typename?: 'User';
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  onBoarded: boolean;
  timezone?: string | null | undefined;
  preferredCurrency?: string | null | undefined;
  language?: string | null | undefined;
  defaultShoppingListId?: string | null | undefined;
  defaultHomeId?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string | null | undefined;
  profile?:
    | {
        __typename?: 'UserProfile';
        id: string;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        displayName?: string | null | undefined;
        bio?: string | null | undefined;
        avatar?: string | null | undefined;
        phone?: string | null | undefined;
      }
    | null
    | undefined;
  settings?:
    | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
    | null
    | undefined;
};

export type CompleteUserFragment = {
  __typename?: 'User';
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  onBoarded: boolean;
  createdAt: string;
  updatedAt: string;
  timezone?: string | null | undefined;
  addresses: Array<{
    __typename?: 'UserAddress';
    id: string;
    label: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    lat?: number | null | undefined;
    lng?: number | null | undefined;
    isDefault: boolean;
  }>;
  devices: Array<{
    __typename?: 'Device';
    id: string;
    userId: string;
    deviceId: string;
    deviceName?: string | null | undefined;
    deviceType: DeviceType;
    userAgent?: string | null | undefined;
    browserName?: string | null | undefined;
    browserVersion?: string | null | undefined;
    osName?: string | null | undefined;
    osVersion?: string | null | undefined;
    screenResolution?: string | null | undefined;
    timezone?: string | null | undefined;
    language?: string | null | undefined;
    appVersion?: string | null | undefined;
    platform?: MobilePlatform | null | undefined;
    pushToken?: string | null | undefined;
    isActive: boolean;
    isTrusted: boolean;
    lastSeenAt: string;
    isVerified: boolean;
    verifiedAt?: string | null | undefined;
    loginCount: number;
    lastLoginAt?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
  }>;
  homeOwnerships: Array<{
    __typename?: 'HomeOwnership';
    id: string;
    createdAt: string;
    homeId: string;
    userId: string;
    user: { __typename?: 'User'; id: string };
    home: { __typename?: 'Home'; id: string; name: string; createdAt: string };
  }>;
  shoppingListOwnerships: Array<{
    __typename?: 'ShoppingListOwnership';
    createdAt: string;
    id: string;
    transferredAt?: string | null | undefined;
    transferredFrom?: string | null | undefined;
    shoppingList: { __typename?: 'ShoppingList'; id: string };
  }>;
};

export type UnitDisplayFragment = {
  __typename: 'Unit';
  id: string;
  name: string;
  symbol: string;
  displayAsFraction: boolean;
};

export type UnitFragmentFragment = {
  __typename?: 'ItemUnit';
  id: string;
  itemId: string;
  unitId: string;
  isDefault: boolean;
  isPreferred: boolean;
  isCommon: boolean;
  packageSize?: number | null | undefined;
  packageDescription?: string | null | undefined;
  retailUnit: boolean;
  usageContext: Array<UnitUsageContext>;
  recommendedFor: Array<UnitRecommendation>;
  minQuantity?: number | null | undefined;
  maxQuantity?: number | null | undefined;
  quantityStep?: number | null | undefined;
  averagePricePerUnit?: number | null | undefined;
  lastPriceUpdate?: string | null | undefined;
  priceSource?: string | null | undefined;
  usageCount: number;
  lastUsedAt?: string | null | undefined;
  popularityScore: number;
  source: UnitSource;
  confidence?: number | null | undefined;
  isVerified: boolean;
  verifiedAt?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type BrandFragmentFragment = {
  __typename?: 'ItemBrand';
  id: string;
  brand: {
    __typename?: 'Brand';
    id: string;
    name: string;
    description?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    version: number;
  };
};

export type CategoryFragmentFragment = {
  __typename?: 'Category';
  id: string;
  name: string;
  slug: string;
  description?: string | null | undefined;
  icon?: string | null | undefined;
  color?: string | null | undefined;
  sortOrder: number;
  type: CategoryType;
  isActive: boolean;
  isSystem: boolean;
  visibility: Visibility;
  itemCount: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null | undefined;
  version: number;
};

export type ItemCoreFragment = {
  __typename: 'Item';
  id: string;
  name: string;
  version: number;
  updatedAt: string;
};

export type ItemDisplayFragment = {
  __typename: 'Item';
  id: string;
  name: string;
  imageUrl?: string | null | undefined;
  netWeight?: number | null | undefined;
  displayUnit?:
    | { __typename: 'Unit'; id: string; symbol: string }
    | null
    | undefined;
  categories?:
    | Array<{
        __typename?: 'ItemCategory';
        id: string;
        isPrimary: boolean;
        category: {
          __typename: 'Category';
          id: string;
          name: string;
          color?: string | null | undefined;
          icon?: string | null | undefined;
        };
      }>
    | null
    | undefined;
};

export type ItemFragmentFragment = {
  __typename: 'Item';
  description?: string | null | undefined;
  dataSource: DataSource;
  type: ItemType;
  storageState: StorageState;
  showInOnboarding: boolean;
  shelfLifeDays?: number | null | undefined;
  popularity: number;
  status: ItemStatus;
  visibility: Visibility;
  tags: Array<string>;
  healthBenefits?: any | null | undefined;
  allergens?: any | null | undefined;
  nutritions?: any | null | undefined;
  metadata?: any | null | undefined;
  ingredients?: any | null | undefined;
  createdAt: string;
  deletedAt?: string | null | undefined;
  density?: number | null | undefined;
  preferredTrackingUnitId?: string | null | undefined;
  id: string;
  name: string;
  imageUrl?: string | null | undefined;
  netWeight?: number | null | undefined;
  preferredTrackingUnit?:
    | { __typename?: 'Unit'; id: string; name: string; symbol: string }
    | null
    | undefined;
  displayUnit?:
    | { __typename: 'Unit'; id: string; name: string; symbol: string }
    | null
    | undefined;
  units: Array<{
    __typename?: 'ItemUnit';
    id: string;
    itemId: string;
    unitId: string;
    isDefault: boolean;
    isPreferred: boolean;
    isCommon: boolean;
    packageSize?: number | null | undefined;
    packageDescription?: string | null | undefined;
    retailUnit: boolean;
    usageContext: Array<UnitUsageContext>;
    recommendedFor: Array<UnitRecommendation>;
    minQuantity?: number | null | undefined;
    maxQuantity?: number | null | undefined;
    quantityStep?: number | null | undefined;
    averagePricePerUnit?: number | null | undefined;
    lastPriceUpdate?: string | null | undefined;
    priceSource?: string | null | undefined;
    usageCount: number;
    lastUsedAt?: string | null | undefined;
    popularityScore: number;
    source: UnitSource;
    confidence?: number | null | undefined;
    isVerified: boolean;
    verifiedAt?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    version: number;
  }>;
  brands: Array<{
    __typename?: 'ItemBrand';
    id: string;
    brand: {
      __typename?: 'Brand';
      id: string;
      name: string;
      description?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      version: number;
    };
  }>;
  categories?:
    | Array<{
        __typename?: 'ItemCategory';
        id: string;
        isPrimary: boolean;
        category: {
          __typename: 'Category';
          id: string;
          name: string;
          color?: string | null | undefined;
          icon?: string | null | undefined;
        };
      }>
    | null
    | undefined;
};

export type NotificationSubscriptionFragment = {
  __typename?: 'NotificationPayload';
  mutation?: MutationType | null | undefined;
  userId?: string | null | undefined;
  timestamp?: string | null | undefined;
  notification?:
    | {
        __typename?: 'Notification';
        id: string;
        type: NotificationType;
        payload: any;
        status: NotificationStatus;
        sentAt: string;
        readAt?: string | null | undefined;
        createdAt: string;
      }
    | null
    | undefined;
};

export type PantryItemCoreFragment = {
  __typename: 'PantryItem';
  id: string;
  pantryId: string;
  itemId: string;
  itemName: string;
  currentQuantity: number;
  unitId?: string | null | undefined;
  unitName: string;
  version?: number | null | undefined;
  updatedAt?: string | null | undefined;
  storageState: StorageState;
  expiresAt?: string | null | undefined;
  lowStockAlert: boolean;
  minQuantity?: number | null | undefined;
  lastUsedAt?: string | null | undefined;
};

export type PantryItemDisplayFragment = {
  __typename: 'PantryItem';
  packageWeight?: number | null | undefined;
  tags: Array<string>;
  initialQuantity: number;
  consumedQuantity: number;
  id: string;
  pantryId: string;
  itemId: string;
  itemName: string;
  currentQuantity: number;
  unitId?: string | null | undefined;
  unitName: string;
  version?: number | null | undefined;
  updatedAt?: string | null | undefined;
  storageState: StorageState;
  expiresAt?: string | null | undefined;
  lowStockAlert: boolean;
  minQuantity?: number | null | undefined;
  lastUsedAt?: string | null | undefined;
  item: {
    __typename: 'Item';
    id: string;
    imageUrl?: string | null | undefined;
    name: string;
    netWeight?: number | null | undefined;
    displayUnit?:
      | { __typename: 'Unit'; id: string; symbol: string }
      | null
      | undefined;
  };
  unit?:
    | { __typename: 'Unit'; id: string; name: string; symbol: string }
    | null
    | undefined;
  storageLocation?:
    | {
        __typename: 'StorageLocation';
        id: string;
        name: string;
        type: StorageType;
      }
    | null
    | undefined;
  brand?: { __typename: 'Brand'; id: string; name: string } | null | undefined;
  packageWeightUnit?:
    | { __typename: 'Unit'; id: string; name: string; symbol: string }
    | null
    | undefined;
};

export type PantryItemFragmentFragment = {
  __typename: 'PantryItem';
  storageNotes?: string | null | undefined;
  normalizedUnitId?: string | null | undefined;
  packageWeight?: number | null | undefined;
  packageWeightUnitId?: string | null | undefined;
  createdAt: string;
  restockQuantity?: number | null | undefined;
  wasteAmount: number;
  wasteDate?: string | null | undefined;
  wasteReason?: WasteReason | null | undefined;
  condition: ItemCondition;
  acquisitionMethod: AcquisitionMethod;
  costPerUnit?: number | null | undefined;
  totalCost?: number | null | undefined;
  tags: Array<string>;
  initialQuantity: number;
  consumedQuantity: number;
  id: string;
  pantryId: string;
  itemId: string;
  itemName: string;
  currentQuantity: number;
  unitId?: string | null | undefined;
  unitName: string;
  version?: number | null | undefined;
  updatedAt?: string | null | undefined;
  storageState: StorageState;
  expiresAt?: string | null | undefined;
  lowStockAlert: boolean;
  minQuantity?: number | null | undefined;
  lastUsedAt?: string | null | undefined;
  item: {
    __typename: 'Item';
    id: string;
    imageUrl?: string | null | undefined;
    name: string;
    netWeight?: number | null | undefined;
    description?: string | null | undefined;
    dataSource: DataSource;
    type: ItemType;
    storageState: StorageState;
    showInOnboarding: boolean;
    shelfLifeDays?: number | null | undefined;
    popularity: number;
    status: ItemStatus;
    visibility: Visibility;
    tags: Array<string>;
    healthBenefits?: any | null | undefined;
    allergens?: any | null | undefined;
    nutritions?: any | null | undefined;
    metadata?: any | null | undefined;
    ingredients?: any | null | undefined;
    createdAt: string;
    deletedAt?: string | null | undefined;
    density?: number | null | undefined;
    preferredTrackingUnitId?: string | null | undefined;
    displayUnit?:
      | { __typename: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    preferredTrackingUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    units: Array<{
      __typename?: 'ItemUnit';
      id: string;
      itemId: string;
      unitId: string;
      isDefault: boolean;
      isPreferred: boolean;
      isCommon: boolean;
      packageSize?: number | null | undefined;
      packageDescription?: string | null | undefined;
      retailUnit: boolean;
      usageContext: Array<UnitUsageContext>;
      recommendedFor: Array<UnitRecommendation>;
      minQuantity?: number | null | undefined;
      maxQuantity?: number | null | undefined;
      quantityStep?: number | null | undefined;
      averagePricePerUnit?: number | null | undefined;
      lastPriceUpdate?: string | null | undefined;
      priceSource?: string | null | undefined;
      usageCount: number;
      lastUsedAt?: string | null | undefined;
      popularityScore: number;
      source: UnitSource;
      confidence?: number | null | undefined;
      isVerified: boolean;
      verifiedAt?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      version: number;
    }>;
    brands: Array<{
      __typename?: 'ItemBrand';
      id: string;
      brand: {
        __typename?: 'Brand';
        id: string;
        name: string;
        description?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        version: number;
      };
    }>;
    categories?:
      | Array<{
          __typename?: 'ItemCategory';
          id: string;
          isPrimary: boolean;
          category: {
            __typename: 'Category';
            id: string;
            name: string;
            color?: string | null | undefined;
            icon?: string | null | undefined;
          };
        }>
      | null
      | undefined;
  };
  unit?:
    | {
        __typename: 'Unit';
        type: UnitType;
        isMetric: boolean;
        baseUnitId?: string | null | undefined;
        conversionFactor: number;
        isCommon: boolean;
        displayAsFraction: boolean;
        minPrecision: number;
        autoConvertThreshold?: number | null | undefined;
        id: string;
        name: string;
        symbol: string;
      }
    | null
    | undefined;
  normalizedUnit?:
    | { __typename?: 'Unit'; id: string; name: string; symbol: string }
    | null
    | undefined;
  packageWeightUnit?:
    | {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
        type: UnitType;
      }
    | null
    | undefined;
  store?: { __typename?: 'Store'; id: string; name: string } | null | undefined;
  purchase?:
    | {
        __typename?: 'Purchase';
        id: string;
        purchaseDate: string;
        unitPrice: number;
        totalPrice: number;
        quantity: number;
      }
    | null
    | undefined;
  usageRecords: Array<{
    __typename?: 'PantryItemUsage';
    id: string;
    quantityUsed: number;
    usedAt: string;
    purpose: UsagePurpose;
    notes?: string | null | undefined;
    pantryItem: { __typename?: 'PantryItem'; id: string };
    usedBy?: { __typename?: 'User'; id: string } | null | undefined;
    cookingLog?: { __typename?: 'CookingLog'; id: string } | null | undefined;
    mealPlanItem?:
      | { __typename?: 'MealPlanItem'; id: string }
      | null
      | undefined;
    recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
  }>;
  storageLocation?:
    | {
        __typename: 'StorageLocation';
        id: string;
        name: string;
        type: StorageType;
      }
    | null
    | undefined;
  brand?: { __typename: 'Brand'; id: string; name: string } | null | undefined;
};

export type HomeInviteFragmentFragment = {
  __typename?: 'HomeInvite';
  id: string;
  token: string;
  email: string;
  homeId: string;
  invitedUserId?: string | null | undefined;
  recipientName?: string | null | undefined;
  role: MembershipRole;
  status: InviteStatus;
  expiresAt: string;
  sentAt: string;
  lastReminderAt?: string | null | undefined;
  reminderCount: number;
  acceptedAt?: string | null | undefined;
  declinedAt?: string | null | undefined;
  revokedAt?: string | null | undefined;
  message?: string | null | undefined;
  createdAt: string;
  customPermissions?:
    | {
        __typename?: 'HomePermissions';
        canViewPantry?: boolean | null | undefined;
        canEditPantry?: boolean | null | undefined;
        canAddItems?: boolean | null | undefined;
        canRemoveItems?: boolean | null | undefined;
        canInviteOthers?: boolean | null | undefined;
        canManageHome?: boolean | null | undefined;
      }
    | null
    | undefined;
  home: { __typename?: 'Home'; id: string; name: string };
  inviter: {
    __typename?: 'User';
    id: string;
    email: string;
    profile?:
      | { __typename?: 'UserProfile'; displayName?: string | null | undefined }
      | null
      | undefined;
  };
};

export type MemberShipFragmentFragment = {
  __typename?: 'Membership';
  id: string;
  homeId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  displayName?: string | null | undefined;
  canViewPantry: boolean;
  canEditPantry: boolean;
  canAddItems: boolean;
  canRemoveItems: boolean;
  canInviteOthers: boolean;
  canManageHome: boolean;
  lastActiveAt?: string | null | undefined;
  joinedAt: string;
  leftAt?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
  user: {
    __typename?: 'User';
    id: string;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    onBoarded: boolean;
    timezone?: string | null | undefined;
    preferredCurrency?: string | null | undefined;
    language?: string | null | undefined;
    defaultShoppingListId?: string | null | undefined;
    defaultHomeId?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    lastActiveAt?: string | null | undefined;
    profile?:
      | {
          __typename?: 'UserProfile';
          id: string;
          firstName?: string | null | undefined;
          lastName?: string | null | undefined;
          displayName?: string | null | undefined;
          bio?: string | null | undefined;
          avatar?: string | null | undefined;
          phone?: string | null | undefined;
        }
      | null
      | undefined;
    settings?:
      | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
      | null
      | undefined;
  };
};

export type PantryFragmentFragment = {
  __typename?: 'Pantry';
  id: string;
  homeId: string;
  name: string;
  description?: string | null | undefined;
  isDefault: boolean;
  location?: string | null | undefined;
  temperature?: string | null | undefined;
  tags: Array<string>;
  metadata?: any | null | undefined;
  version: number;
  createdAt: string;
  updatedAt: string;
  itemsConnection: {
    __typename?: 'PantryItemConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'PantryItemEdge';
      cursor: string;
      node: {
        __typename: 'PantryItem';
        storageNotes?: string | null | undefined;
        normalizedUnitId?: string | null | undefined;
        packageWeight?: number | null | undefined;
        packageWeightUnitId?: string | null | undefined;
        createdAt: string;
        restockQuantity?: number | null | undefined;
        wasteAmount: number;
        wasteDate?: string | null | undefined;
        wasteReason?: WasteReason | null | undefined;
        condition: ItemCondition;
        acquisitionMethod: AcquisitionMethod;
        costPerUnit?: number | null | undefined;
        totalCost?: number | null | undefined;
        tags: Array<string>;
        initialQuantity: number;
        consumedQuantity: number;
        id: string;
        pantryId: string;
        itemId: string;
        itemName: string;
        currentQuantity: number;
        unitId?: string | null | undefined;
        unitName: string;
        version?: number | null | undefined;
        updatedAt?: string | null | undefined;
        storageState: StorageState;
        expiresAt?: string | null | undefined;
        lowStockAlert: boolean;
        minQuantity?: number | null | undefined;
        lastUsedAt?: string | null | undefined;
        item: {
          __typename: 'Item';
          id: string;
          imageUrl?: string | null | undefined;
          name: string;
          netWeight?: number | null | undefined;
          description?: string | null | undefined;
          dataSource: DataSource;
          type: ItemType;
          storageState: StorageState;
          showInOnboarding: boolean;
          shelfLifeDays?: number | null | undefined;
          popularity: number;
          status: ItemStatus;
          visibility: Visibility;
          tags: Array<string>;
          healthBenefits?: any | null | undefined;
          allergens?: any | null | undefined;
          nutritions?: any | null | undefined;
          metadata?: any | null | undefined;
          ingredients?: any | null | undefined;
          createdAt: string;
          deletedAt?: string | null | undefined;
          density?: number | null | undefined;
          preferredTrackingUnitId?: string | null | undefined;
          displayUnit?:
            | { __typename: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          preferredTrackingUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          units: Array<{
            __typename?: 'ItemUnit';
            id: string;
            itemId: string;
            unitId: string;
            isDefault: boolean;
            isPreferred: boolean;
            isCommon: boolean;
            packageSize?: number | null | undefined;
            packageDescription?: string | null | undefined;
            retailUnit: boolean;
            usageContext: Array<UnitUsageContext>;
            recommendedFor: Array<UnitRecommendation>;
            minQuantity?: number | null | undefined;
            maxQuantity?: number | null | undefined;
            quantityStep?: number | null | undefined;
            averagePricePerUnit?: number | null | undefined;
            lastPriceUpdate?: string | null | undefined;
            priceSource?: string | null | undefined;
            usageCount: number;
            lastUsedAt?: string | null | undefined;
            popularityScore: number;
            source: UnitSource;
            confidence?: number | null | undefined;
            isVerified: boolean;
            verifiedAt?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            version: number;
          }>;
          brands: Array<{
            __typename?: 'ItemBrand';
            id: string;
            brand: {
              __typename?: 'Brand';
              id: string;
              name: string;
              description?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              version: number;
            };
          }>;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                isPrimary: boolean;
                category: {
                  __typename: 'Category';
                  id: string;
                  name: string;
                  color?: string | null | undefined;
                  icon?: string | null | undefined;
                };
              }>
            | null
            | undefined;
        };
        unit?:
          | {
              __typename: 'Unit';
              type: UnitType;
              isMetric: boolean;
              baseUnitId?: string | null | undefined;
              conversionFactor: number;
              isCommon: boolean;
              displayAsFraction: boolean;
              minPrecision: number;
              autoConvertThreshold?: number | null | undefined;
              id: string;
              name: string;
              symbol: string;
            }
          | null
          | undefined;
        normalizedUnit?:
          | { __typename?: 'Unit'; id: string; name: string; symbol: string }
          | null
          | undefined;
        packageWeightUnit?:
          | {
              __typename: 'Unit';
              id: string;
              name: string;
              symbol: string;
              type: UnitType;
            }
          | null
          | undefined;
        store?:
          | { __typename?: 'Store'; id: string; name: string }
          | null
          | undefined;
        purchase?:
          | {
              __typename?: 'Purchase';
              id: string;
              purchaseDate: string;
              unitPrice: number;
              totalPrice: number;
              quantity: number;
            }
          | null
          | undefined;
        usageRecords: Array<{
          __typename?: 'PantryItemUsage';
          id: string;
          quantityUsed: number;
          usedAt: string;
          purpose: UsagePurpose;
          notes?: string | null | undefined;
          pantryItem: { __typename?: 'PantryItem'; id: string };
          usedBy?: { __typename?: 'User'; id: string } | null | undefined;
          cookingLog?:
            | { __typename?: 'CookingLog'; id: string }
            | null
            | undefined;
          mealPlanItem?:
            | { __typename?: 'MealPlanItem'; id: string }
            | null
            | undefined;
          recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
        }>;
        storageLocation?:
          | {
              __typename: 'StorageLocation';
              id: string;
              name: string;
              type: StorageType;
            }
          | null
          | undefined;
        brand?:
          | { __typename: 'Brand'; id: string; name: string }
          | null
          | undefined;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type BasicPantryFragmentFragment = {
  __typename?: 'Pantry';
  id: string;
  homeId: string;
  name: string;
  description?: string | null | undefined;
  isDefault: boolean;
  location?: string | null | undefined;
  temperature?: string | null | undefined;
  tags: Array<string>;
  metadata?: any | null | undefined;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type HomeWithPantriesFragmentFragment = {
  __typename?: 'Home';
  id: string;
  name: string;
  type: HomeType;
  description?: string | null | undefined;
  timezone?: string | null | undefined;
  currency?: string | null | undefined;
  isPublic: boolean;
  joinCode?: string | null | undefined;
  allowJoinCode: boolean;
  maxMembers?: number | null | undefined;
  tags: Array<string>;
  metadata?: any | null | undefined;
  version: number;
  createdAt: string;
  updatedAt: string;
  invitesConnection: {
    __typename?: 'HomeInviteConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'HomeInviteEdge';
      cursor: string;
      node: {
        __typename?: 'HomeInvite';
        id: string;
        token: string;
        email: string;
        homeId: string;
        invitedUserId?: string | null | undefined;
        recipientName?: string | null | undefined;
        role: MembershipRole;
        status: InviteStatus;
        expiresAt: string;
        sentAt: string;
        lastReminderAt?: string | null | undefined;
        reminderCount: number;
        acceptedAt?: string | null | undefined;
        declinedAt?: string | null | undefined;
        revokedAt?: string | null | undefined;
        message?: string | null | undefined;
        createdAt: string;
        customPermissions?:
          | {
              __typename?: 'HomePermissions';
              canViewPantry?: boolean | null | undefined;
              canEditPantry?: boolean | null | undefined;
              canAddItems?: boolean | null | undefined;
              canRemoveItems?: boolean | null | undefined;
              canInviteOthers?: boolean | null | undefined;
              canManageHome?: boolean | null | undefined;
            }
          | null
          | undefined;
        home: { __typename?: 'Home'; id: string; name: string };
        inviter: {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        };
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
  membersConnection: {
    __typename?: 'MembershipConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'MembershipEdge';
      cursor: string;
      node: {
        __typename?: 'Membership';
        id: string;
        homeId: string;
        userId: string;
        role: MembershipRole;
        status: MembershipStatus;
        displayName?: string | null | undefined;
        canViewPantry: boolean;
        canEditPantry: boolean;
        canAddItems: boolean;
        canRemoveItems: boolean;
        canInviteOthers: boolean;
        canManageHome: boolean;
        lastActiveAt?: string | null | undefined;
        joinedAt: string;
        leftAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        user: {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        };
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
  pantriesConnection: {
    __typename?: 'PantryConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'PantryEdge';
      cursor: string;
      node: {
        __typename?: 'Pantry';
        id: string;
        homeId: string;
        name: string;
        description?: string | null | undefined;
        isDefault: boolean;
        location?: string | null | undefined;
        temperature?: string | null | undefined;
        tags: Array<string>;
        metadata?: any | null | undefined;
        version: number;
        createdAt: string;
        updatedAt: string;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type HomeDisplayFragment = {
  __typename: 'Home';
  id: string;
  name: string;
  type: HomeType;
  currency?: string | null | undefined;
  timezone?: string | null | undefined;
  version: number;
  updatedAt: string;
  membersConnection: {
    __typename?: 'MembershipConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'MembershipEdge';
      cursor: string;
      node: {
        __typename?: 'Membership';
        id: string;
        role: MembershipRole;
        status: MembershipStatus;
        userId: string;
        displayName?: string | null | undefined;
        user: {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        };
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
  invitesConnection: {
    __typename?: 'HomeInviteConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'HomeInviteEdge';
      cursor: string;
      node: {
        __typename?: 'HomeInvite';
        id: string;
        token: string;
        email: string;
        homeId: string;
        invitedUserId?: string | null | undefined;
        recipientName?: string | null | undefined;
        role: MembershipRole;
        status: InviteStatus;
        expiresAt: string;
        sentAt: string;
        lastReminderAt?: string | null | undefined;
        reminderCount: number;
        acceptedAt?: string | null | undefined;
        declinedAt?: string | null | undefined;
        revokedAt?: string | null | undefined;
        message?: string | null | undefined;
        createdAt: string;
        customPermissions?:
          | {
              __typename?: 'HomePermissions';
              canViewPantry?: boolean | null | undefined;
              canEditPantry?: boolean | null | undefined;
              canAddItems?: boolean | null | undefined;
              canRemoveItems?: boolean | null | undefined;
              canInviteOthers?: boolean | null | undefined;
              canManageHome?: boolean | null | undefined;
            }
          | null
          | undefined;
        home: { __typename?: 'Home'; id: string; name: string };
        inviter: {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        };
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
  pantriesConnection: {
    __typename?: 'PantryConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'PantryEdge';
      cursor: string;
      node: {
        __typename?: 'Pantry';
        id: string;
        homeId: string;
        name: string;
        description?: string | null | undefined;
        isDefault: boolean;
        location?: string | null | undefined;
        temperature?: string | null | undefined;
        tags: Array<string>;
        metadata?: any | null | undefined;
        version: number;
        createdAt: string;
        updatedAt: string;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type HomeFragmentFragment = {
  __typename?: 'Home';
  id: string;
  name: string;
  type: HomeType;
  description?: string | null | undefined;
  timezone?: string | null | undefined;
  currency?: string | null | undefined;
  isPublic: boolean;
  joinCode?: string | null | undefined;
  allowJoinCode: boolean;
  maxMembers?: number | null | undefined;
  tags: Array<string>;
  metadata?: any | null | undefined;
  version: number;
  createdAt: string;
  updatedAt: string;
  invitesConnection: {
    __typename?: 'HomeInviteConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'HomeInviteEdge';
      cursor: string;
      node: {
        __typename?: 'HomeInvite';
        id: string;
        token: string;
        email: string;
        homeId: string;
        invitedUserId?: string | null | undefined;
        recipientName?: string | null | undefined;
        role: MembershipRole;
        status: InviteStatus;
        expiresAt: string;
        sentAt: string;
        lastReminderAt?: string | null | undefined;
        reminderCount: number;
        acceptedAt?: string | null | undefined;
        declinedAt?: string | null | undefined;
        revokedAt?: string | null | undefined;
        message?: string | null | undefined;
        createdAt: string;
        customPermissions?:
          | {
              __typename?: 'HomePermissions';
              canViewPantry?: boolean | null | undefined;
              canEditPantry?: boolean | null | undefined;
              canAddItems?: boolean | null | undefined;
              canRemoveItems?: boolean | null | undefined;
              canInviteOthers?: boolean | null | undefined;
              canManageHome?: boolean | null | undefined;
            }
          | null
          | undefined;
        home: { __typename?: 'Home'; id: string; name: string };
        inviter: {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        };
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
  membersConnection: {
    __typename?: 'MembershipConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'MembershipEdge';
      cursor: string;
      node: {
        __typename?: 'Membership';
        id: string;
        homeId: string;
        userId: string;
        role: MembershipRole;
        status: MembershipStatus;
        displayName?: string | null | undefined;
        canViewPantry: boolean;
        canEditPantry: boolean;
        canAddItems: boolean;
        canRemoveItems: boolean;
        canInviteOthers: boolean;
        canManageHome: boolean;
        lastActiveAt?: string | null | undefined;
        joinedAt: string;
        leftAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        user: {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        };
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
  pantriesConnection: {
    __typename?: 'PantryConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'PantryEdge';
      cursor: string;
      node: {
        __typename?: 'Pantry';
        id: string;
        homeId: string;
        name: string;
        description?: string | null | undefined;
        isDefault: boolean;
        location?: string | null | undefined;
        temperature?: string | null | undefined;
        tags: Array<string>;
        metadata?: any | null | undefined;
        version: number;
        createdAt: string;
        updatedAt: string;
        itemsConnection: {
          __typename?: 'PantryItemConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'PantryItemEdge';
            cursor: string;
            node: {
              __typename: 'PantryItem';
              storageNotes?: string | null | undefined;
              normalizedUnitId?: string | null | undefined;
              packageWeight?: number | null | undefined;
              packageWeightUnitId?: string | null | undefined;
              createdAt: string;
              restockQuantity?: number | null | undefined;
              wasteAmount: number;
              wasteDate?: string | null | undefined;
              wasteReason?: WasteReason | null | undefined;
              condition: ItemCondition;
              acquisitionMethod: AcquisitionMethod;
              costPerUnit?: number | null | undefined;
              totalCost?: number | null | undefined;
              tags: Array<string>;
              initialQuantity: number;
              consumedQuantity: number;
              id: string;
              pantryId: string;
              itemId: string;
              itemName: string;
              currentQuantity: number;
              unitId?: string | null | undefined;
              unitName: string;
              version?: number | null | undefined;
              updatedAt?: string | null | undefined;
              storageState: StorageState;
              expiresAt?: string | null | undefined;
              lowStockAlert: boolean;
              minQuantity?: number | null | undefined;
              lastUsedAt?: string | null | undefined;
              item: {
                __typename: 'Item';
                id: string;
                imageUrl?: string | null | undefined;
                name: string;
                netWeight?: number | null | undefined;
                description?: string | null | undefined;
                dataSource: DataSource;
                type: ItemType;
                storageState: StorageState;
                showInOnboarding: boolean;
                shelfLifeDays?: number | null | undefined;
                popularity: number;
                status: ItemStatus;
                visibility: Visibility;
                tags: Array<string>;
                healthBenefits?: any | null | undefined;
                allergens?: any | null | undefined;
                nutritions?: any | null | undefined;
                metadata?: any | null | undefined;
                ingredients?: any | null | undefined;
                createdAt: string;
                deletedAt?: string | null | undefined;
                density?: number | null | undefined;
                preferredTrackingUnitId?: string | null | undefined;
                displayUnit?:
                  | {
                      __typename: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                    }
                  | null
                  | undefined;
                preferredTrackingUnit?:
                  | {
                      __typename?: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                    }
                  | null
                  | undefined;
                units: Array<{
                  __typename?: 'ItemUnit';
                  id: string;
                  itemId: string;
                  unitId: string;
                  isDefault: boolean;
                  isPreferred: boolean;
                  isCommon: boolean;
                  packageSize?: number | null | undefined;
                  packageDescription?: string | null | undefined;
                  retailUnit: boolean;
                  usageContext: Array<UnitUsageContext>;
                  recommendedFor: Array<UnitRecommendation>;
                  minQuantity?: number | null | undefined;
                  maxQuantity?: number | null | undefined;
                  quantityStep?: number | null | undefined;
                  averagePricePerUnit?: number | null | undefined;
                  lastPriceUpdate?: string | null | undefined;
                  priceSource?: string | null | undefined;
                  usageCount: number;
                  lastUsedAt?: string | null | undefined;
                  popularityScore: number;
                  source: UnitSource;
                  confidence?: number | null | undefined;
                  isVerified: boolean;
                  verifiedAt?: string | null | undefined;
                  createdAt: string;
                  updatedAt: string;
                  version: number;
                }>;
                brands: Array<{
                  __typename?: 'ItemBrand';
                  id: string;
                  brand: {
                    __typename?: 'Brand';
                    id: string;
                    name: string;
                    description?: string | null | undefined;
                    createdAt: string;
                    updatedAt: string;
                    version: number;
                  };
                }>;
                categories?:
                  | Array<{
                      __typename?: 'ItemCategory';
                      id: string;
                      isPrimary: boolean;
                      category: {
                        __typename: 'Category';
                        id: string;
                        name: string;
                        color?: string | null | undefined;
                        icon?: string | null | undefined;
                      };
                    }>
                  | null
                  | undefined;
              };
              unit?:
                | {
                    __typename: 'Unit';
                    type: UnitType;
                    isMetric: boolean;
                    baseUnitId?: string | null | undefined;
                    conversionFactor: number;
                    isCommon: boolean;
                    displayAsFraction: boolean;
                    minPrecision: number;
                    autoConvertThreshold?: number | null | undefined;
                    id: string;
                    name: string;
                    symbol: string;
                  }
                | null
                | undefined;
              normalizedUnit?:
                | {
                    __typename?: 'Unit';
                    id: string;
                    name: string;
                    symbol: string;
                  }
                | null
                | undefined;
              packageWeightUnit?:
                | {
                    __typename: 'Unit';
                    id: string;
                    name: string;
                    symbol: string;
                    type: UnitType;
                  }
                | null
                | undefined;
              store?:
                | { __typename?: 'Store'; id: string; name: string }
                | null
                | undefined;
              purchase?:
                | {
                    __typename?: 'Purchase';
                    id: string;
                    purchaseDate: string;
                    unitPrice: number;
                    totalPrice: number;
                    quantity: number;
                  }
                | null
                | undefined;
              usageRecords: Array<{
                __typename?: 'PantryItemUsage';
                id: string;
                quantityUsed: number;
                usedAt: string;
                purpose: UsagePurpose;
                notes?: string | null | undefined;
                pantryItem: { __typename?: 'PantryItem'; id: string };
                usedBy?: { __typename?: 'User'; id: string } | null | undefined;
                cookingLog?:
                  | { __typename?: 'CookingLog'; id: string }
                  | null
                  | undefined;
                mealPlanItem?:
                  | { __typename?: 'MealPlanItem'; id: string }
                  | null
                  | undefined;
                recipe?:
                  | { __typename?: 'Recipe'; id: string }
                  | null
                  | undefined;
              }>;
              storageLocation?:
                | {
                    __typename: 'StorageLocation';
                    id: string;
                    name: string;
                    type: StorageType;
                  }
                | null
                | undefined;
              brand?:
                | { __typename: 'Brand'; id: string; name: string }
                | null
                | undefined;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type NotificationFragmentFragment = {
  __typename?: 'Notification';
  id: string;
  userId: string;
  type: NotificationType;
  payload: any;
  status: NotificationStatus;
  sentAt: string;
  readAt?: string | null | undefined;
  createdAt: string;
};

export type PurchaseFragmentFragment = {
  __typename?: 'Purchase';
  id: string;
  purchaseDate: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  itemName: string;
  unitSymbol: string;
};

export type RecipeIngredientFragmentFragment = {
  __typename?: 'RecipeIngredient';
  id: string;
  name: string;
  quantity: number;
  image?: string | null | undefined;
  isOptional: boolean;
  notes?: string | null | undefined;
  preparation?: string | null | undefined;
  sortOrder: number;
  section?: string | null | undefined;
  item?:
    | {
        __typename?: 'Item';
        id: string;
        name: string;
        imageUrl?: string | null | undefined;
      }
    | null
    | undefined;
  unit?:
    | { __typename?: 'Unit'; id: string; name: string; symbol: string }
    | null
    | undefined;
};

export type BasicRecipeFragmentFragment = {
  __typename?: 'Recipe';
  id: string;
  name: string;
  description?: string | null | undefined;
  imageUrl?: string | null | undefined;
  servings: number;
  prepTimeMinutes?: number | null | undefined;
  cookTimeMinutes?: number | null | undefined;
  totalTimeMinutes?: number | null | undefined;
  difficulty: Difficulty;
  category: RecipeCategory;
  status: RecipeStatus;
  isExternal: boolean;
  externalSource?: ExternalSource | null | undefined;
  externalId?: string | null | undefined;
  primarySource?: string | null | undefined;
  caloriesPerServing?: number | null | undefined;
  createdAt: string;
  updatedAt: string;
};

export type RecipeFragmentFragment = {
  __typename?: 'Recipe';
  id: string;
  name: string;
  description?: string | null | undefined;
  imageUrl?: string | null | undefined;
  servings: number;
  prepTimeMinutes?: number | null | undefined;
  cookTimeMinutes?: number | null | undefined;
  totalTimeMinutes?: number | null | undefined;
  difficulty: Difficulty;
  category: RecipeCategory;
  status: RecipeStatus;
  cuisine?: string | null | undefined;
  instructions: any;
  notes?: string | null | undefined;
  tips?: string | null | undefined;
  videoUrl?: string | null | undefined;
  sourceUrl?: string | null | undefined;
  source?: string | null | undefined;
  originalAuthor?: string | null | undefined;
  isExternal: boolean;
  externalSource?: ExternalSource | null | undefined;
  externalId?: string | null | undefined;
  externalUrl?: string | null | undefined;
  externalData?: any | null | undefined;
  primarySource?: string | null | undefined;
  caloriesPerServing?: number | null | undefined;
  nutritionData?: any | null | undefined;
  tags: Array<string>;
  visibility: Visibility;
  isPublished: boolean;
  publishedAt?: string | null | undefined;
  averageRating?: number | null | undefined;
  matchPercentage?: number | null | undefined;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null | undefined;
  createdBy: { __typename?: 'User'; id: string; email: string };
  ingredients: Array<{
    __typename?: 'RecipeIngredient';
    id: string;
    name: string;
    quantity: number;
    image?: string | null | undefined;
    isOptional: boolean;
    notes?: string | null | undefined;
    preparation?: string | null | undefined;
    sortOrder: number;
    section?: string | null | undefined;
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          imageUrl?: string | null | undefined;
        }
      | null
      | undefined;
    unit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
  }>;
};

export type GetHomeQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type GetHomeQuery = {
  __typename?: 'Query';
  home?:
    | {
        __typename?: 'Home';
        id: string;
        name: string;
        type: HomeType;
        description?: string | null | undefined;
        timezone?: string | null | undefined;
        currency?: string | null | undefined;
        isPublic: boolean;
        joinCode?: string | null | undefined;
        allowJoinCode: boolean;
        maxMembers?: number | null | undefined;
        tags: Array<string>;
        metadata?: any | null | undefined;
        version: number;
        createdAt: string;
        updatedAt: string;
        invitesConnection: {
          __typename?: 'HomeInviteConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'HomeInviteEdge';
            cursor: string;
            node: {
              __typename?: 'HomeInvite';
              id: string;
              token: string;
              email: string;
              homeId: string;
              invitedUserId?: string | null | undefined;
              recipientName?: string | null | undefined;
              role: MembershipRole;
              status: InviteStatus;
              expiresAt: string;
              sentAt: string;
              lastReminderAt?: string | null | undefined;
              reminderCount: number;
              acceptedAt?: string | null | undefined;
              declinedAt?: string | null | undefined;
              revokedAt?: string | null | undefined;
              message?: string | null | undefined;
              createdAt: string;
              customPermissions?:
                | {
                    __typename?: 'HomePermissions';
                    canViewPantry?: boolean | null | undefined;
                    canEditPantry?: boolean | null | undefined;
                    canAddItems?: boolean | null | undefined;
                    canRemoveItems?: boolean | null | undefined;
                    canInviteOthers?: boolean | null | undefined;
                    canManageHome?: boolean | null | undefined;
                  }
                | null
                | undefined;
              home: { __typename?: 'Home'; id: string; name: string };
              inviter: {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                    }
                  | null
                  | undefined;
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        membersConnection: {
          __typename?: 'MembershipConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'MembershipEdge';
            cursor: string;
            node: {
              __typename?: 'Membership';
              id: string;
              homeId: string;
              userId: string;
              role: MembershipRole;
              status: MembershipStatus;
              displayName?: string | null | undefined;
              canViewPantry: boolean;
              canEditPantry: boolean;
              canAddItems: boolean;
              canRemoveItems: boolean;
              canInviteOthers: boolean;
              canManageHome: boolean;
              lastActiveAt?: string | null | undefined;
              joinedAt: string;
              leftAt?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              user: {
                __typename?: 'User';
                id: string;
                email: string;
                emailVerified: boolean;
                role: UserRole;
                onBoarded: boolean;
                timezone?: string | null | undefined;
                preferredCurrency?: string | null | undefined;
                language?: string | null | undefined;
                defaultShoppingListId?: string | null | undefined;
                defaultHomeId?: string | null | undefined;
                createdAt: string;
                updatedAt: string;
                lastActiveAt?: string | null | undefined;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      id: string;
                      firstName?: string | null | undefined;
                      lastName?: string | null | undefined;
                      displayName?: string | null | undefined;
                      bio?: string | null | undefined;
                      avatar?: string | null | undefined;
                      phone?: string | null | undefined;
                    }
                  | null
                  | undefined;
                settings?:
                  | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
                  | null
                  | undefined;
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        pantriesConnection: {
          __typename?: 'PantryConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'PantryEdge';
            cursor: string;
            node: {
              __typename?: 'Pantry';
              id: string;
              homeId: string;
              name: string;
              description?: string | null | undefined;
              isDefault: boolean;
              location?: string | null | undefined;
              temperature?: string | null | undefined;
              tags: Array<string>;
              metadata?: any | null | undefined;
              version: number;
              createdAt: string;
              updatedAt: string;
              itemsConnection: {
                __typename?: 'PantryItemConnection';
                totalCount: number;
                edges: Array<{
                  __typename?: 'PantryItemEdge';
                  cursor: string;
                  node: {
                    __typename: 'PantryItem';
                    storageNotes?: string | null | undefined;
                    normalizedUnitId?: string | null | undefined;
                    packageWeight?: number | null | undefined;
                    packageWeightUnitId?: string | null | undefined;
                    createdAt: string;
                    restockQuantity?: number | null | undefined;
                    wasteAmount: number;
                    wasteDate?: string | null | undefined;
                    wasteReason?: WasteReason | null | undefined;
                    condition: ItemCondition;
                    acquisitionMethod: AcquisitionMethod;
                    costPerUnit?: number | null | undefined;
                    totalCost?: number | null | undefined;
                    tags: Array<string>;
                    initialQuantity: number;
                    consumedQuantity: number;
                    id: string;
                    pantryId: string;
                    itemId: string;
                    itemName: string;
                    currentQuantity: number;
                    unitId?: string | null | undefined;
                    unitName: string;
                    version?: number | null | undefined;
                    updatedAt?: string | null | undefined;
                    storageState: StorageState;
                    expiresAt?: string | null | undefined;
                    lowStockAlert: boolean;
                    minQuantity?: number | null | undefined;
                    lastUsedAt?: string | null | undefined;
                    item: {
                      __typename: 'Item';
                      id: string;
                      imageUrl?: string | null | undefined;
                      name: string;
                      netWeight?: number | null | undefined;
                      description?: string | null | undefined;
                      dataSource: DataSource;
                      type: ItemType;
                      storageState: StorageState;
                      showInOnboarding: boolean;
                      shelfLifeDays?: number | null | undefined;
                      popularity: number;
                      status: ItemStatus;
                      visibility: Visibility;
                      tags: Array<string>;
                      healthBenefits?: any | null | undefined;
                      allergens?: any | null | undefined;
                      nutritions?: any | null | undefined;
                      metadata?: any | null | undefined;
                      ingredients?: any | null | undefined;
                      createdAt: string;
                      deletedAt?: string | null | undefined;
                      density?: number | null | undefined;
                      preferredTrackingUnitId?: string | null | undefined;
                      displayUnit?:
                        | {
                            __typename: 'Unit';
                            id: string;
                            name: string;
                            symbol: string;
                          }
                        | null
                        | undefined;
                      preferredTrackingUnit?:
                        | {
                            __typename?: 'Unit';
                            id: string;
                            name: string;
                            symbol: string;
                          }
                        | null
                        | undefined;
                      units: Array<{
                        __typename?: 'ItemUnit';
                        id: string;
                        itemId: string;
                        unitId: string;
                        isDefault: boolean;
                        isPreferred: boolean;
                        isCommon: boolean;
                        packageSize?: number | null | undefined;
                        packageDescription?: string | null | undefined;
                        retailUnit: boolean;
                        usageContext: Array<UnitUsageContext>;
                        recommendedFor: Array<UnitRecommendation>;
                        minQuantity?: number | null | undefined;
                        maxQuantity?: number | null | undefined;
                        quantityStep?: number | null | undefined;
                        averagePricePerUnit?: number | null | undefined;
                        lastPriceUpdate?: string | null | undefined;
                        priceSource?: string | null | undefined;
                        usageCount: number;
                        lastUsedAt?: string | null | undefined;
                        popularityScore: number;
                        source: UnitSource;
                        confidence?: number | null | undefined;
                        isVerified: boolean;
                        verifiedAt?: string | null | undefined;
                        createdAt: string;
                        updatedAt: string;
                        version: number;
                      }>;
                      brands: Array<{
                        __typename?: 'ItemBrand';
                        id: string;
                        brand: {
                          __typename?: 'Brand';
                          id: string;
                          name: string;
                          description?: string | null | undefined;
                          createdAt: string;
                          updatedAt: string;
                          version: number;
                        };
                      }>;
                      categories?:
                        | Array<{
                            __typename?: 'ItemCategory';
                            id: string;
                            isPrimary: boolean;
                            category: {
                              __typename: 'Category';
                              id: string;
                              name: string;
                              color?: string | null | undefined;
                              icon?: string | null | undefined;
                            };
                          }>
                        | null
                        | undefined;
                    };
                    unit?:
                      | {
                          __typename: 'Unit';
                          type: UnitType;
                          isMetric: boolean;
                          baseUnitId?: string | null | undefined;
                          conversionFactor: number;
                          isCommon: boolean;
                          displayAsFraction: boolean;
                          minPrecision: number;
                          autoConvertThreshold?: number | null | undefined;
                          id: string;
                          name: string;
                          symbol: string;
                        }
                      | null
                      | undefined;
                    normalizedUnit?:
                      | {
                          __typename?: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                        }
                      | null
                      | undefined;
                    packageWeightUnit?:
                      | {
                          __typename: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                          type: UnitType;
                        }
                      | null
                      | undefined;
                    store?:
                      | { __typename?: 'Store'; id: string; name: string }
                      | null
                      | undefined;
                    purchase?:
                      | {
                          __typename?: 'Purchase';
                          id: string;
                          purchaseDate: string;
                          unitPrice: number;
                          totalPrice: number;
                          quantity: number;
                        }
                      | null
                      | undefined;
                    usageRecords: Array<{
                      __typename?: 'PantryItemUsage';
                      id: string;
                      quantityUsed: number;
                      usedAt: string;
                      purpose: UsagePurpose;
                      notes?: string | null | undefined;
                      pantryItem: { __typename?: 'PantryItem'; id: string };
                      usedBy?:
                        | { __typename?: 'User'; id: string }
                        | null
                        | undefined;
                      cookingLog?:
                        | { __typename?: 'CookingLog'; id: string }
                        | null
                        | undefined;
                      mealPlanItem?:
                        | { __typename?: 'MealPlanItem'; id: string }
                        | null
                        | undefined;
                      recipe?:
                        | { __typename?: 'Recipe'; id: string }
                        | null
                        | undefined;
                    }>;
                    storageLocation?:
                      | {
                          __typename: 'StorageLocation';
                          id: string;
                          name: string;
                          type: StorageType;
                        }
                      | null
                      | undefined;
                    brand?:
                      | { __typename: 'Brand'; id: string; name: string }
                      | null
                      | undefined;
                  };
                }>;
                pageInfo: {
                  __typename?: 'PageInfo';
                  hasNextPage: boolean;
                  endCursor?: string | null | undefined;
                };
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
      }
    | null
    | undefined;
};

export type GetHomeBasicQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type GetHomeBasicQuery = {
  __typename?: 'Query';
  home?:
    | {
        __typename?: 'Home';
        id: string;
        name: string;
        type: HomeType;
        description?: string | null | undefined;
        timezone?: string | null | undefined;
        currency?: string | null | undefined;
        isPublic: boolean;
        joinCode?: string | null | undefined;
        allowJoinCode: boolean;
        maxMembers?: number | null | undefined;
        tags: Array<string>;
        metadata?: any | null | undefined;
        version: number;
        createdAt: string;
        updatedAt: string;
        invitesConnection: {
          __typename?: 'HomeInviteConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'HomeInviteEdge';
            cursor: string;
            node: {
              __typename?: 'HomeInvite';
              id: string;
              token: string;
              email: string;
              homeId: string;
              invitedUserId?: string | null | undefined;
              recipientName?: string | null | undefined;
              role: MembershipRole;
              status: InviteStatus;
              expiresAt: string;
              sentAt: string;
              lastReminderAt?: string | null | undefined;
              reminderCount: number;
              acceptedAt?: string | null | undefined;
              declinedAt?: string | null | undefined;
              revokedAt?: string | null | undefined;
              message?: string | null | undefined;
              createdAt: string;
              customPermissions?:
                | {
                    __typename?: 'HomePermissions';
                    canViewPantry?: boolean | null | undefined;
                    canEditPantry?: boolean | null | undefined;
                    canAddItems?: boolean | null | undefined;
                    canRemoveItems?: boolean | null | undefined;
                    canInviteOthers?: boolean | null | undefined;
                    canManageHome?: boolean | null | undefined;
                  }
                | null
                | undefined;
              home: { __typename?: 'Home'; id: string; name: string };
              inviter: {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                    }
                  | null
                  | undefined;
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        membersConnection: {
          __typename?: 'MembershipConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'MembershipEdge';
            cursor: string;
            node: {
              __typename?: 'Membership';
              id: string;
              homeId: string;
              userId: string;
              role: MembershipRole;
              status: MembershipStatus;
              displayName?: string | null | undefined;
              canViewPantry: boolean;
              canEditPantry: boolean;
              canAddItems: boolean;
              canRemoveItems: boolean;
              canInviteOthers: boolean;
              canManageHome: boolean;
              lastActiveAt?: string | null | undefined;
              joinedAt: string;
              leftAt?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              user: {
                __typename?: 'User';
                id: string;
                email: string;
                emailVerified: boolean;
                role: UserRole;
                onBoarded: boolean;
                timezone?: string | null | undefined;
                preferredCurrency?: string | null | undefined;
                language?: string | null | undefined;
                defaultShoppingListId?: string | null | undefined;
                defaultHomeId?: string | null | undefined;
                createdAt: string;
                updatedAt: string;
                lastActiveAt?: string | null | undefined;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      id: string;
                      firstName?: string | null | undefined;
                      lastName?: string | null | undefined;
                      displayName?: string | null | undefined;
                      bio?: string | null | undefined;
                      avatar?: string | null | undefined;
                      phone?: string | null | undefined;
                    }
                  | null
                  | undefined;
                settings?:
                  | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
                  | null
                  | undefined;
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        pantriesConnection: {
          __typename?: 'PantryConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'PantryEdge';
            cursor: string;
            node: {
              __typename?: 'Pantry';
              id: string;
              homeId: string;
              name: string;
              description?: string | null | undefined;
              isDefault: boolean;
              location?: string | null | undefined;
              temperature?: string | null | undefined;
              tags: Array<string>;
              metadata?: any | null | undefined;
              version: number;
              createdAt: string;
              updatedAt: string;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
      }
    | null
    | undefined;
};

export type GetHomesQueryVariables = Exact<{ [key: string]: never }>;

export type GetHomesQuery = {
  __typename?: 'Query';
  homes: Array<{
    __typename: 'Home';
    id: string;
    name: string;
    type: HomeType;
    currency?: string | null | undefined;
    timezone?: string | null | undefined;
    version: number;
    updatedAt: string;
    membersConnection: {
      __typename?: 'MembershipConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'MembershipEdge';
        cursor: string;
        node: {
          __typename?: 'Membership';
          id: string;
          role: MembershipRole;
          status: MembershipStatus;
          userId: string;
          displayName?: string | null | undefined;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    invitesConnection: {
      __typename?: 'HomeInviteConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'HomeInviteEdge';
        cursor: string;
        node: {
          __typename?: 'HomeInvite';
          id: string;
          token: string;
          email: string;
          homeId: string;
          invitedUserId?: string | null | undefined;
          recipientName?: string | null | undefined;
          role: MembershipRole;
          status: InviteStatus;
          expiresAt: string;
          sentAt: string;
          lastReminderAt?: string | null | undefined;
          reminderCount: number;
          acceptedAt?: string | null | undefined;
          declinedAt?: string | null | undefined;
          revokedAt?: string | null | undefined;
          message?: string | null | undefined;
          createdAt: string;
          customPermissions?:
            | {
                __typename?: 'HomePermissions';
                canViewPantry?: boolean | null | undefined;
                canEditPantry?: boolean | null | undefined;
                canAddItems?: boolean | null | undefined;
                canRemoveItems?: boolean | null | undefined;
                canInviteOthers?: boolean | null | undefined;
                canManageHome?: boolean | null | undefined;
              }
            | null
            | undefined;
          home: { __typename?: 'Home'; id: string; name: string };
          inviter: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    pantriesConnection: {
      __typename?: 'PantryConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PantryEdge';
        cursor: string;
        node: {
          __typename?: 'Pantry';
          id: string;
          homeId: string;
          name: string;
          description?: string | null | undefined;
          isDefault: boolean;
          location?: string | null | undefined;
          temperature?: string | null | undefined;
          tags: Array<string>;
          metadata?: any | null | undefined;
          version: number;
          createdAt: string;
          updatedAt: string;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  }>;
};

export type GetMyPendingInvitesQueryVariables = Exact<{ [key: string]: never }>;

export type GetMyPendingInvitesQuery = {
  __typename?: 'Query';
  myPendingInvites: Array<{
    __typename?: 'HomeInvite';
    id: string;
    token: string;
    email: string;
    homeId: string;
    invitedUserId?: string | null | undefined;
    recipientName?: string | null | undefined;
    role: MembershipRole;
    status: InviteStatus;
    expiresAt: string;
    sentAt: string;
    lastReminderAt?: string | null | undefined;
    reminderCount: number;
    acceptedAt?: string | null | undefined;
    declinedAt?: string | null | undefined;
    revokedAt?: string | null | undefined;
    message?: string | null | undefined;
    createdAt: string;
    customPermissions?:
      | {
          __typename?: 'HomePermissions';
          canViewPantry?: boolean | null | undefined;
          canEditPantry?: boolean | null | undefined;
          canAddItems?: boolean | null | undefined;
          canRemoveItems?: boolean | null | undefined;
          canInviteOthers?: boolean | null | undefined;
          canManageHome?: boolean | null | undefined;
        }
      | null
      | undefined;
    home: { __typename?: 'Home'; id: string; name: string };
    inviter: {
      __typename?: 'User';
      id: string;
      email: string;
      profile?:
        | {
            __typename?: 'UserProfile';
            displayName?: string | null | undefined;
          }
        | null
        | undefined;
    };
  }>;
};

export type GetHomeByJoinCodeQueryVariables = Exact<{
  joinCode: Scalars['String']['input'];
}>;

export type GetHomeByJoinCodeQuery = {
  __typename?: 'Query';
  homeByJoinCode?:
    | {
        __typename?: 'Home';
        id: string;
        name: string;
        type: HomeType;
        description?: string | null | undefined;
        timezone?: string | null | undefined;
        currency?: string | null | undefined;
        isPublic: boolean;
        joinCode?: string | null | undefined;
        allowJoinCode: boolean;
        maxMembers?: number | null | undefined;
        tags: Array<string>;
        metadata?: any | null | undefined;
        version: number;
        createdAt: string;
        updatedAt: string;
        invitesConnection: {
          __typename?: 'HomeInviteConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'HomeInviteEdge';
            cursor: string;
            node: {
              __typename?: 'HomeInvite';
              id: string;
              token: string;
              email: string;
              homeId: string;
              invitedUserId?: string | null | undefined;
              recipientName?: string | null | undefined;
              role: MembershipRole;
              status: InviteStatus;
              expiresAt: string;
              sentAt: string;
              lastReminderAt?: string | null | undefined;
              reminderCount: number;
              acceptedAt?: string | null | undefined;
              declinedAt?: string | null | undefined;
              revokedAt?: string | null | undefined;
              message?: string | null | undefined;
              createdAt: string;
              customPermissions?:
                | {
                    __typename?: 'HomePermissions';
                    canViewPantry?: boolean | null | undefined;
                    canEditPantry?: boolean | null | undefined;
                    canAddItems?: boolean | null | undefined;
                    canRemoveItems?: boolean | null | undefined;
                    canInviteOthers?: boolean | null | undefined;
                    canManageHome?: boolean | null | undefined;
                  }
                | null
                | undefined;
              home: { __typename?: 'Home'; id: string; name: string };
              inviter: {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                    }
                  | null
                  | undefined;
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        membersConnection: {
          __typename?: 'MembershipConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'MembershipEdge';
            cursor: string;
            node: {
              __typename?: 'Membership';
              id: string;
              homeId: string;
              userId: string;
              role: MembershipRole;
              status: MembershipStatus;
              displayName?: string | null | undefined;
              canViewPantry: boolean;
              canEditPantry: boolean;
              canAddItems: boolean;
              canRemoveItems: boolean;
              canInviteOthers: boolean;
              canManageHome: boolean;
              lastActiveAt?: string | null | undefined;
              joinedAt: string;
              leftAt?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              user: {
                __typename?: 'User';
                id: string;
                email: string;
                emailVerified: boolean;
                role: UserRole;
                onBoarded: boolean;
                timezone?: string | null | undefined;
                preferredCurrency?: string | null | undefined;
                language?: string | null | undefined;
                defaultShoppingListId?: string | null | undefined;
                defaultHomeId?: string | null | undefined;
                createdAt: string;
                updatedAt: string;
                lastActiveAt?: string | null | undefined;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      id: string;
                      firstName?: string | null | undefined;
                      lastName?: string | null | undefined;
                      displayName?: string | null | undefined;
                      bio?: string | null | undefined;
                      avatar?: string | null | undefined;
                      phone?: string | null | undefined;
                    }
                  | null
                  | undefined;
                settings?:
                  | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
                  | null
                  | undefined;
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        pantriesConnection: {
          __typename?: 'PantryConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'PantryEdge';
            cursor: string;
            node: {
              __typename?: 'Pantry';
              id: string;
              homeId: string;
              name: string;
              description?: string | null | undefined;
              isDefault: boolean;
              location?: string | null | undefined;
              temperature?: string | null | undefined;
              tags: Array<string>;
              metadata?: any | null | undefined;
              version: number;
              createdAt: string;
              updatedAt: string;
              itemsConnection: {
                __typename?: 'PantryItemConnection';
                totalCount: number;
                edges: Array<{
                  __typename?: 'PantryItemEdge';
                  cursor: string;
                  node: {
                    __typename: 'PantryItem';
                    storageNotes?: string | null | undefined;
                    normalizedUnitId?: string | null | undefined;
                    packageWeight?: number | null | undefined;
                    packageWeightUnitId?: string | null | undefined;
                    createdAt: string;
                    restockQuantity?: number | null | undefined;
                    wasteAmount: number;
                    wasteDate?: string | null | undefined;
                    wasteReason?: WasteReason | null | undefined;
                    condition: ItemCondition;
                    acquisitionMethod: AcquisitionMethod;
                    costPerUnit?: number | null | undefined;
                    totalCost?: number | null | undefined;
                    tags: Array<string>;
                    initialQuantity: number;
                    consumedQuantity: number;
                    id: string;
                    pantryId: string;
                    itemId: string;
                    itemName: string;
                    currentQuantity: number;
                    unitId?: string | null | undefined;
                    unitName: string;
                    version?: number | null | undefined;
                    updatedAt?: string | null | undefined;
                    storageState: StorageState;
                    expiresAt?: string | null | undefined;
                    lowStockAlert: boolean;
                    minQuantity?: number | null | undefined;
                    lastUsedAt?: string | null | undefined;
                    item: {
                      __typename: 'Item';
                      id: string;
                      imageUrl?: string | null | undefined;
                      name: string;
                      netWeight?: number | null | undefined;
                      description?: string | null | undefined;
                      dataSource: DataSource;
                      type: ItemType;
                      storageState: StorageState;
                      showInOnboarding: boolean;
                      shelfLifeDays?: number | null | undefined;
                      popularity: number;
                      status: ItemStatus;
                      visibility: Visibility;
                      tags: Array<string>;
                      healthBenefits?: any | null | undefined;
                      allergens?: any | null | undefined;
                      nutritions?: any | null | undefined;
                      metadata?: any | null | undefined;
                      ingredients?: any | null | undefined;
                      createdAt: string;
                      deletedAt?: string | null | undefined;
                      density?: number | null | undefined;
                      preferredTrackingUnitId?: string | null | undefined;
                      displayUnit?:
                        | {
                            __typename: 'Unit';
                            id: string;
                            name: string;
                            symbol: string;
                          }
                        | null
                        | undefined;
                      preferredTrackingUnit?:
                        | {
                            __typename?: 'Unit';
                            id: string;
                            name: string;
                            symbol: string;
                          }
                        | null
                        | undefined;
                      units: Array<{
                        __typename?: 'ItemUnit';
                        id: string;
                        itemId: string;
                        unitId: string;
                        isDefault: boolean;
                        isPreferred: boolean;
                        isCommon: boolean;
                        packageSize?: number | null | undefined;
                        packageDescription?: string | null | undefined;
                        retailUnit: boolean;
                        usageContext: Array<UnitUsageContext>;
                        recommendedFor: Array<UnitRecommendation>;
                        minQuantity?: number | null | undefined;
                        maxQuantity?: number | null | undefined;
                        quantityStep?: number | null | undefined;
                        averagePricePerUnit?: number | null | undefined;
                        lastPriceUpdate?: string | null | undefined;
                        priceSource?: string | null | undefined;
                        usageCount: number;
                        lastUsedAt?: string | null | undefined;
                        popularityScore: number;
                        source: UnitSource;
                        confidence?: number | null | undefined;
                        isVerified: boolean;
                        verifiedAt?: string | null | undefined;
                        createdAt: string;
                        updatedAt: string;
                        version: number;
                      }>;
                      brands: Array<{
                        __typename?: 'ItemBrand';
                        id: string;
                        brand: {
                          __typename?: 'Brand';
                          id: string;
                          name: string;
                          description?: string | null | undefined;
                          createdAt: string;
                          updatedAt: string;
                          version: number;
                        };
                      }>;
                      categories?:
                        | Array<{
                            __typename?: 'ItemCategory';
                            id: string;
                            isPrimary: boolean;
                            category: {
                              __typename: 'Category';
                              id: string;
                              name: string;
                              color?: string | null | undefined;
                              icon?: string | null | undefined;
                            };
                          }>
                        | null
                        | undefined;
                    };
                    unit?:
                      | {
                          __typename: 'Unit';
                          type: UnitType;
                          isMetric: boolean;
                          baseUnitId?: string | null | undefined;
                          conversionFactor: number;
                          isCommon: boolean;
                          displayAsFraction: boolean;
                          minPrecision: number;
                          autoConvertThreshold?: number | null | undefined;
                          id: string;
                          name: string;
                          symbol: string;
                        }
                      | null
                      | undefined;
                    normalizedUnit?:
                      | {
                          __typename?: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                        }
                      | null
                      | undefined;
                    packageWeightUnit?:
                      | {
                          __typename: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                          type: UnitType;
                        }
                      | null
                      | undefined;
                    store?:
                      | { __typename?: 'Store'; id: string; name: string }
                      | null
                      | undefined;
                    purchase?:
                      | {
                          __typename?: 'Purchase';
                          id: string;
                          purchaseDate: string;
                          unitPrice: number;
                          totalPrice: number;
                          quantity: number;
                        }
                      | null
                      | undefined;
                    usageRecords: Array<{
                      __typename?: 'PantryItemUsage';
                      id: string;
                      quantityUsed: number;
                      usedAt: string;
                      purpose: UsagePurpose;
                      notes?: string | null | undefined;
                      pantryItem: { __typename?: 'PantryItem'; id: string };
                      usedBy?:
                        | { __typename?: 'User'; id: string }
                        | null
                        | undefined;
                      cookingLog?:
                        | { __typename?: 'CookingLog'; id: string }
                        | null
                        | undefined;
                      mealPlanItem?:
                        | { __typename?: 'MealPlanItem'; id: string }
                        | null
                        | undefined;
                      recipe?:
                        | { __typename?: 'Recipe'; id: string }
                        | null
                        | undefined;
                    }>;
                    storageLocation?:
                      | {
                          __typename: 'StorageLocation';
                          id: string;
                          name: string;
                          type: StorageType;
                        }
                      | null
                      | undefined;
                    brand?:
                      | { __typename: 'Brand'; id: string; name: string }
                      | null
                      | undefined;
                  };
                }>;
                pageInfo: {
                  __typename?: 'PageInfo';
                  hasNextPage: boolean;
                  endCursor?: string | null | undefined;
                };
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
      }
    | null
    | undefined;
};

export type CreateHomeMutationVariables = Exact<{
  input: CreateHomeInput;
}>;

export type CreateHomeMutation = {
  __typename?: 'Mutation';
  createHome: {
    __typename?: 'Home';
    id: string;
    name: string;
    type: HomeType;
    description?: string | null | undefined;
    timezone?: string | null | undefined;
    currency?: string | null | undefined;
    isPublic: boolean;
    joinCode?: string | null | undefined;
    allowJoinCode: boolean;
    maxMembers?: number | null | undefined;
    tags: Array<string>;
    metadata?: any | null | undefined;
    version: number;
    createdAt: string;
    updatedAt: string;
    invitesConnection: {
      __typename?: 'HomeInviteConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'HomeInviteEdge';
        cursor: string;
        node: {
          __typename?: 'HomeInvite';
          id: string;
          token: string;
          email: string;
          homeId: string;
          invitedUserId?: string | null | undefined;
          recipientName?: string | null | undefined;
          role: MembershipRole;
          status: InviteStatus;
          expiresAt: string;
          sentAt: string;
          lastReminderAt?: string | null | undefined;
          reminderCount: number;
          acceptedAt?: string | null | undefined;
          declinedAt?: string | null | undefined;
          revokedAt?: string | null | undefined;
          message?: string | null | undefined;
          createdAt: string;
          customPermissions?:
            | {
                __typename?: 'HomePermissions';
                canViewPantry?: boolean | null | undefined;
                canEditPantry?: boolean | null | undefined;
                canAddItems?: boolean | null | undefined;
                canRemoveItems?: boolean | null | undefined;
                canInviteOthers?: boolean | null | undefined;
                canManageHome?: boolean | null | undefined;
              }
            | null
            | undefined;
          home: { __typename?: 'Home'; id: string; name: string };
          inviter: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    membersConnection: {
      __typename?: 'MembershipConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'MembershipEdge';
        cursor: string;
        node: {
          __typename?: 'Membership';
          id: string;
          homeId: string;
          userId: string;
          role: MembershipRole;
          status: MembershipStatus;
          displayName?: string | null | undefined;
          canViewPantry: boolean;
          canEditPantry: boolean;
          canAddItems: boolean;
          canRemoveItems: boolean;
          canInviteOthers: boolean;
          canManageHome: boolean;
          lastActiveAt?: string | null | undefined;
          joinedAt: string;
          leftAt?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    pantriesConnection: {
      __typename?: 'PantryConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PantryEdge';
        cursor: string;
        node: {
          __typename?: 'Pantry';
          id: string;
          homeId: string;
          name: string;
          description?: string | null | undefined;
          isDefault: boolean;
          location?: string | null | undefined;
          temperature?: string | null | undefined;
          tags: Array<string>;
          metadata?: any | null | undefined;
          version: number;
          createdAt: string;
          updatedAt: string;
          itemsConnection: {
            __typename?: 'PantryItemConnection';
            totalCount: number;
            edges: Array<{
              __typename?: 'PantryItemEdge';
              cursor: string;
              node: {
                __typename: 'PantryItem';
                storageNotes?: string | null | undefined;
                normalizedUnitId?: string | null | undefined;
                packageWeight?: number | null | undefined;
                packageWeightUnitId?: string | null | undefined;
                createdAt: string;
                restockQuantity?: number | null | undefined;
                wasteAmount: number;
                wasteDate?: string | null | undefined;
                wasteReason?: WasteReason | null | undefined;
                condition: ItemCondition;
                acquisitionMethod: AcquisitionMethod;
                costPerUnit?: number | null | undefined;
                totalCost?: number | null | undefined;
                tags: Array<string>;
                initialQuantity: number;
                consumedQuantity: number;
                id: string;
                pantryId: string;
                itemId: string;
                itemName: string;
                currentQuantity: number;
                unitId?: string | null | undefined;
                unitName: string;
                version?: number | null | undefined;
                updatedAt?: string | null | undefined;
                storageState: StorageState;
                expiresAt?: string | null | undefined;
                lowStockAlert: boolean;
                minQuantity?: number | null | undefined;
                lastUsedAt?: string | null | undefined;
                item: {
                  __typename: 'Item';
                  id: string;
                  imageUrl?: string | null | undefined;
                  name: string;
                  netWeight?: number | null | undefined;
                  description?: string | null | undefined;
                  dataSource: DataSource;
                  type: ItemType;
                  storageState: StorageState;
                  showInOnboarding: boolean;
                  shelfLifeDays?: number | null | undefined;
                  popularity: number;
                  status: ItemStatus;
                  visibility: Visibility;
                  tags: Array<string>;
                  healthBenefits?: any | null | undefined;
                  allergens?: any | null | undefined;
                  nutritions?: any | null | undefined;
                  metadata?: any | null | undefined;
                  ingredients?: any | null | undefined;
                  createdAt: string;
                  deletedAt?: string | null | undefined;
                  density?: number | null | undefined;
                  preferredTrackingUnitId?: string | null | undefined;
                  displayUnit?:
                    | {
                        __typename: 'Unit';
                        id: string;
                        name: string;
                        symbol: string;
                      }
                    | null
                    | undefined;
                  preferredTrackingUnit?:
                    | {
                        __typename?: 'Unit';
                        id: string;
                        name: string;
                        symbol: string;
                      }
                    | null
                    | undefined;
                  units: Array<{
                    __typename?: 'ItemUnit';
                    id: string;
                    itemId: string;
                    unitId: string;
                    isDefault: boolean;
                    isPreferred: boolean;
                    isCommon: boolean;
                    packageSize?: number | null | undefined;
                    packageDescription?: string | null | undefined;
                    retailUnit: boolean;
                    usageContext: Array<UnitUsageContext>;
                    recommendedFor: Array<UnitRecommendation>;
                    minQuantity?: number | null | undefined;
                    maxQuantity?: number | null | undefined;
                    quantityStep?: number | null | undefined;
                    averagePricePerUnit?: number | null | undefined;
                    lastPriceUpdate?: string | null | undefined;
                    priceSource?: string | null | undefined;
                    usageCount: number;
                    lastUsedAt?: string | null | undefined;
                    popularityScore: number;
                    source: UnitSource;
                    confidence?: number | null | undefined;
                    isVerified: boolean;
                    verifiedAt?: string | null | undefined;
                    createdAt: string;
                    updatedAt: string;
                    version: number;
                  }>;
                  brands: Array<{
                    __typename?: 'ItemBrand';
                    id: string;
                    brand: {
                      __typename?: 'Brand';
                      id: string;
                      name: string;
                      description?: string | null | undefined;
                      createdAt: string;
                      updatedAt: string;
                      version: number;
                    };
                  }>;
                  categories?:
                    | Array<{
                        __typename?: 'ItemCategory';
                        id: string;
                        isPrimary: boolean;
                        category: {
                          __typename: 'Category';
                          id: string;
                          name: string;
                          color?: string | null | undefined;
                          icon?: string | null | undefined;
                        };
                      }>
                    | null
                    | undefined;
                };
                unit?:
                  | {
                      __typename: 'Unit';
                      type: UnitType;
                      isMetric: boolean;
                      baseUnitId?: string | null | undefined;
                      conversionFactor: number;
                      isCommon: boolean;
                      displayAsFraction: boolean;
                      minPrecision: number;
                      autoConvertThreshold?: number | null | undefined;
                      id: string;
                      name: string;
                      symbol: string;
                    }
                  | null
                  | undefined;
                normalizedUnit?:
                  | {
                      __typename?: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                    }
                  | null
                  | undefined;
                packageWeightUnit?:
                  | {
                      __typename: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                      type: UnitType;
                    }
                  | null
                  | undefined;
                store?:
                  | { __typename?: 'Store'; id: string; name: string }
                  | null
                  | undefined;
                purchase?:
                  | {
                      __typename?: 'Purchase';
                      id: string;
                      purchaseDate: string;
                      unitPrice: number;
                      totalPrice: number;
                      quantity: number;
                    }
                  | null
                  | undefined;
                usageRecords: Array<{
                  __typename?: 'PantryItemUsage';
                  id: string;
                  quantityUsed: number;
                  usedAt: string;
                  purpose: UsagePurpose;
                  notes?: string | null | undefined;
                  pantryItem: { __typename?: 'PantryItem'; id: string };
                  usedBy?:
                    | { __typename?: 'User'; id: string }
                    | null
                    | undefined;
                  cookingLog?:
                    | { __typename?: 'CookingLog'; id: string }
                    | null
                    | undefined;
                  mealPlanItem?:
                    | { __typename?: 'MealPlanItem'; id: string }
                    | null
                    | undefined;
                  recipe?:
                    | { __typename?: 'Recipe'; id: string }
                    | null
                    | undefined;
                }>;
                storageLocation?:
                  | {
                      __typename: 'StorageLocation';
                      id: string;
                      name: string;
                      type: StorageType;
                    }
                  | null
                  | undefined;
                brand?:
                  | { __typename: 'Brand'; id: string; name: string }
                  | null
                  | undefined;
              };
            }>;
            pageInfo: {
              __typename?: 'PageInfo';
              hasNextPage: boolean;
              endCursor?: string | null | undefined;
            };
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type UpdateHomeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateHomeInput;
}>;

export type UpdateHomeMutation = {
  __typename?: 'Mutation';
  updateHome: {
    __typename?: 'Home';
    id: string;
    name: string;
    type: HomeType;
    description?: string | null | undefined;
    timezone?: string | null | undefined;
    currency?: string | null | undefined;
    isPublic: boolean;
    joinCode?: string | null | undefined;
    allowJoinCode: boolean;
    maxMembers?: number | null | undefined;
    tags: Array<string>;
    metadata?: any | null | undefined;
    version: number;
    createdAt: string;
    updatedAt: string;
    invitesConnection: {
      __typename?: 'HomeInviteConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'HomeInviteEdge';
        cursor: string;
        node: {
          __typename?: 'HomeInvite';
          id: string;
          token: string;
          email: string;
          homeId: string;
          invitedUserId?: string | null | undefined;
          recipientName?: string | null | undefined;
          role: MembershipRole;
          status: InviteStatus;
          expiresAt: string;
          sentAt: string;
          lastReminderAt?: string | null | undefined;
          reminderCount: number;
          acceptedAt?: string | null | undefined;
          declinedAt?: string | null | undefined;
          revokedAt?: string | null | undefined;
          message?: string | null | undefined;
          createdAt: string;
          customPermissions?:
            | {
                __typename?: 'HomePermissions';
                canViewPantry?: boolean | null | undefined;
                canEditPantry?: boolean | null | undefined;
                canAddItems?: boolean | null | undefined;
                canRemoveItems?: boolean | null | undefined;
                canInviteOthers?: boolean | null | undefined;
                canManageHome?: boolean | null | undefined;
              }
            | null
            | undefined;
          home: { __typename?: 'Home'; id: string; name: string };
          inviter: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    membersConnection: {
      __typename?: 'MembershipConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'MembershipEdge';
        cursor: string;
        node: {
          __typename?: 'Membership';
          id: string;
          homeId: string;
          userId: string;
          role: MembershipRole;
          status: MembershipStatus;
          displayName?: string | null | undefined;
          canViewPantry: boolean;
          canEditPantry: boolean;
          canAddItems: boolean;
          canRemoveItems: boolean;
          canInviteOthers: boolean;
          canManageHome: boolean;
          lastActiveAt?: string | null | undefined;
          joinedAt: string;
          leftAt?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    pantriesConnection: {
      __typename?: 'PantryConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PantryEdge';
        cursor: string;
        node: {
          __typename?: 'Pantry';
          id: string;
          homeId: string;
          name: string;
          description?: string | null | undefined;
          isDefault: boolean;
          location?: string | null | undefined;
          temperature?: string | null | undefined;
          tags: Array<string>;
          metadata?: any | null | undefined;
          version: number;
          createdAt: string;
          updatedAt: string;
          itemsConnection: {
            __typename?: 'PantryItemConnection';
            totalCount: number;
            edges: Array<{
              __typename?: 'PantryItemEdge';
              cursor: string;
              node: {
                __typename: 'PantryItem';
                storageNotes?: string | null | undefined;
                normalizedUnitId?: string | null | undefined;
                packageWeight?: number | null | undefined;
                packageWeightUnitId?: string | null | undefined;
                createdAt: string;
                restockQuantity?: number | null | undefined;
                wasteAmount: number;
                wasteDate?: string | null | undefined;
                wasteReason?: WasteReason | null | undefined;
                condition: ItemCondition;
                acquisitionMethod: AcquisitionMethod;
                costPerUnit?: number | null | undefined;
                totalCost?: number | null | undefined;
                tags: Array<string>;
                initialQuantity: number;
                consumedQuantity: number;
                id: string;
                pantryId: string;
                itemId: string;
                itemName: string;
                currentQuantity: number;
                unitId?: string | null | undefined;
                unitName: string;
                version?: number | null | undefined;
                updatedAt?: string | null | undefined;
                storageState: StorageState;
                expiresAt?: string | null | undefined;
                lowStockAlert: boolean;
                minQuantity?: number | null | undefined;
                lastUsedAt?: string | null | undefined;
                item: {
                  __typename: 'Item';
                  id: string;
                  imageUrl?: string | null | undefined;
                  name: string;
                  netWeight?: number | null | undefined;
                  description?: string | null | undefined;
                  dataSource: DataSource;
                  type: ItemType;
                  storageState: StorageState;
                  showInOnboarding: boolean;
                  shelfLifeDays?: number | null | undefined;
                  popularity: number;
                  status: ItemStatus;
                  visibility: Visibility;
                  tags: Array<string>;
                  healthBenefits?: any | null | undefined;
                  allergens?: any | null | undefined;
                  nutritions?: any | null | undefined;
                  metadata?: any | null | undefined;
                  ingredients?: any | null | undefined;
                  createdAt: string;
                  deletedAt?: string | null | undefined;
                  density?: number | null | undefined;
                  preferredTrackingUnitId?: string | null | undefined;
                  displayUnit?:
                    | {
                        __typename: 'Unit';
                        id: string;
                        name: string;
                        symbol: string;
                      }
                    | null
                    | undefined;
                  preferredTrackingUnit?:
                    | {
                        __typename?: 'Unit';
                        id: string;
                        name: string;
                        symbol: string;
                      }
                    | null
                    | undefined;
                  units: Array<{
                    __typename?: 'ItemUnit';
                    id: string;
                    itemId: string;
                    unitId: string;
                    isDefault: boolean;
                    isPreferred: boolean;
                    isCommon: boolean;
                    packageSize?: number | null | undefined;
                    packageDescription?: string | null | undefined;
                    retailUnit: boolean;
                    usageContext: Array<UnitUsageContext>;
                    recommendedFor: Array<UnitRecommendation>;
                    minQuantity?: number | null | undefined;
                    maxQuantity?: number | null | undefined;
                    quantityStep?: number | null | undefined;
                    averagePricePerUnit?: number | null | undefined;
                    lastPriceUpdate?: string | null | undefined;
                    priceSource?: string | null | undefined;
                    usageCount: number;
                    lastUsedAt?: string | null | undefined;
                    popularityScore: number;
                    source: UnitSource;
                    confidence?: number | null | undefined;
                    isVerified: boolean;
                    verifiedAt?: string | null | undefined;
                    createdAt: string;
                    updatedAt: string;
                    version: number;
                  }>;
                  brands: Array<{
                    __typename?: 'ItemBrand';
                    id: string;
                    brand: {
                      __typename?: 'Brand';
                      id: string;
                      name: string;
                      description?: string | null | undefined;
                      createdAt: string;
                      updatedAt: string;
                      version: number;
                    };
                  }>;
                  categories?:
                    | Array<{
                        __typename?: 'ItemCategory';
                        id: string;
                        isPrimary: boolean;
                        category: {
                          __typename: 'Category';
                          id: string;
                          name: string;
                          color?: string | null | undefined;
                          icon?: string | null | undefined;
                        };
                      }>
                    | null
                    | undefined;
                };
                unit?:
                  | {
                      __typename: 'Unit';
                      type: UnitType;
                      isMetric: boolean;
                      baseUnitId?: string | null | undefined;
                      conversionFactor: number;
                      isCommon: boolean;
                      displayAsFraction: boolean;
                      minPrecision: number;
                      autoConvertThreshold?: number | null | undefined;
                      id: string;
                      name: string;
                      symbol: string;
                    }
                  | null
                  | undefined;
                normalizedUnit?:
                  | {
                      __typename?: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                    }
                  | null
                  | undefined;
                packageWeightUnit?:
                  | {
                      __typename: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                      type: UnitType;
                    }
                  | null
                  | undefined;
                store?:
                  | { __typename?: 'Store'; id: string; name: string }
                  | null
                  | undefined;
                purchase?:
                  | {
                      __typename?: 'Purchase';
                      id: string;
                      purchaseDate: string;
                      unitPrice: number;
                      totalPrice: number;
                      quantity: number;
                    }
                  | null
                  | undefined;
                usageRecords: Array<{
                  __typename?: 'PantryItemUsage';
                  id: string;
                  quantityUsed: number;
                  usedAt: string;
                  purpose: UsagePurpose;
                  notes?: string | null | undefined;
                  pantryItem: { __typename?: 'PantryItem'; id: string };
                  usedBy?:
                    | { __typename?: 'User'; id: string }
                    | null
                    | undefined;
                  cookingLog?:
                    | { __typename?: 'CookingLog'; id: string }
                    | null
                    | undefined;
                  mealPlanItem?:
                    | { __typename?: 'MealPlanItem'; id: string }
                    | null
                    | undefined;
                  recipe?:
                    | { __typename?: 'Recipe'; id: string }
                    | null
                    | undefined;
                }>;
                storageLocation?:
                  | {
                      __typename: 'StorageLocation';
                      id: string;
                      name: string;
                      type: StorageType;
                    }
                  | null
                  | undefined;
                brand?:
                  | { __typename: 'Brand'; id: string; name: string }
                  | null
                  | undefined;
              };
            }>;
            pageInfo: {
              __typename?: 'PageInfo';
              hasNextPage: boolean;
              endCursor?: string | null | undefined;
            };
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type DeleteHomeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeleteHomeMutation = {
  __typename?: 'Mutation';
  deleteHome: { __typename?: 'Home'; id: string; name: string };
};

export type InviteToHomeMutationVariables = Exact<{
  input: InviteToHomeInput;
}>;

export type InviteToHomeMutation = {
  __typename?: 'Mutation';
  inviteToHome: {
    __typename?: 'HomeInvite';
    id: string;
    token: string;
    email: string;
    homeId: string;
    invitedUserId?: string | null | undefined;
    recipientName?: string | null | undefined;
    role: MembershipRole;
    status: InviteStatus;
    expiresAt: string;
    sentAt: string;
    lastReminderAt?: string | null | undefined;
    reminderCount: number;
    acceptedAt?: string | null | undefined;
    declinedAt?: string | null | undefined;
    revokedAt?: string | null | undefined;
    message?: string | null | undefined;
    createdAt: string;
    customPermissions?:
      | {
          __typename?: 'HomePermissions';
          canViewPantry?: boolean | null | undefined;
          canEditPantry?: boolean | null | undefined;
          canAddItems?: boolean | null | undefined;
          canRemoveItems?: boolean | null | undefined;
          canInviteOthers?: boolean | null | undefined;
          canManageHome?: boolean | null | undefined;
        }
      | null
      | undefined;
    home: { __typename?: 'Home'; id: string; name: string };
    inviter: {
      __typename?: 'User';
      id: string;
      email: string;
      profile?:
        | {
            __typename?: 'UserProfile';
            displayName?: string | null | undefined;
          }
        | null
        | undefined;
    };
  };
};

export type AcceptHomeInviteMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;

export type AcceptHomeInviteMutation = {
  __typename?: 'Mutation';
  acceptHomeInvite: {
    __typename?: 'Membership';
    id: string;
    homeId: string;
    userId: string;
    role: MembershipRole;
    status: MembershipStatus;
    displayName?: string | null | undefined;
    canViewPantry: boolean;
    canEditPantry: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canInviteOthers: boolean;
    canManageHome: boolean;
    lastActiveAt?: string | null | undefined;
    joinedAt: string;
    leftAt?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
  };
};

export type DeclineHomeInviteMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;

export type DeclineHomeInviteMutation = {
  __typename?: 'Mutation';
  declineHomeInvite: boolean;
};

export type UpdateMembershipMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateMembershipInput;
}>;

export type UpdateMembershipMutation = {
  __typename?: 'Mutation';
  updateMembership: {
    __typename?: 'Membership';
    id: string;
    homeId: string;
    userId: string;
    role: MembershipRole;
    status: MembershipStatus;
    displayName?: string | null | undefined;
    canViewPantry: boolean;
    canEditPantry: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canInviteOthers: boolean;
    canManageHome: boolean;
    lastActiveAt?: string | null | undefined;
    joinedAt: string;
    leftAt?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
  };
};

export type RemoveMemberMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type RemoveMemberMutation = {
  __typename?: 'Mutation';
  removeMember: boolean;
};

export type RevokeHomeInviteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type RevokeHomeInviteMutation = {
  __typename?: 'Mutation';
  revokeHomeInvite: boolean;
};

export type JoinHomeByCodeMutationVariables = Exact<{
  joinCode: Scalars['String']['input'];
}>;

export type JoinHomeByCodeMutation = {
  __typename?: 'Mutation';
  joinHomeByCode: {
    __typename?: 'Membership';
    id: string;
    homeId: string;
    userId: string;
    role: MembershipRole;
    status: MembershipStatus;
    displayName?: string | null | undefined;
    canViewPantry: boolean;
    canEditPantry: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canInviteOthers: boolean;
    canManageHome: boolean;
    lastActiveAt?: string | null | undefined;
    joinedAt: string;
    leftAt?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
  };
};

export type MembershipUpdatedSubscriptionVariables = Exact<{
  homeId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type MembershipUpdatedSubscription = {
  __typename?: 'Subscription';
  membershipUpdated: {
    __typename?: 'MembershipUpdatePayload';
    mutation: MembershipMutationType;
    updatedFields?: Array<string> | null | undefined;
    userId: string;
    node?:
      | {
          __typename?: 'Membership';
          id: string;
          homeId: string;
          userId: string;
          role: MembershipRole;
          status: MembershipStatus;
          displayName?: string | null | undefined;
          canViewPantry: boolean;
          canEditPantry: boolean;
          canAddItems: boolean;
          canRemoveItems: boolean;
          canInviteOthers: boolean;
          canManageHome: boolean;
          lastActiveAt?: string | null | undefined;
          joinedAt: string;
          home: {
            __typename?: 'Home';
            id: string;
            name: string;
            type: HomeType;
          };
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                  avatar?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }
      | null
      | undefined;
  };
};

export type MemberJoinedSubscriptionVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type MemberJoinedSubscription = {
  __typename?: 'Subscription';
  memberJoined: {
    __typename?: 'MembershipUpdatePayload';
    mutation: MembershipMutationType;
    updatedFields?: Array<string> | null | undefined;
    userId: string;
    node?:
      | {
          __typename?: 'Membership';
          homeId: string;
          userId: string;
          user: {
            __typename?: 'User';
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }
      | null
      | undefined;
  };
};

export type MemberLeftSubscriptionVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type MemberLeftSubscription = {
  __typename?: 'Subscription';
  memberLeft: {
    __typename?: 'MembershipUpdatePayload';
    mutation: MembershipMutationType;
    updatedFields?: Array<string> | null | undefined;
    userId: string;
    node?:
      | {
          __typename?: 'Membership';
          id: string;
          homeId: string;
          userId: string;
          role: MembershipRole;
          status: MembershipStatus;
          displayName?: string | null | undefined;
          user: {
            __typename?: 'User';
            id: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                  avatar?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }
      | null
      | undefined;
  };
};

export type MembershipRoleChangedSubscriptionVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type MembershipRoleChangedSubscription = {
  __typename?: 'Subscription';
  membershipRoleChanged: {
    __typename?: 'MembershipRoleChangedPayload';
    homeId: string;
    userId: string;
    previousRole: MembershipRole;
    newRole: MembershipRole;
    changedBy: string;
    membership: {
      __typename?: 'Membership';
      id: string;
      homeId: string;
      userId: string;
      role: MembershipRole;
      user: {
        __typename?: 'User';
        id: string;
        email: string;
        profile?:
          | {
              __typename?: 'UserProfile';
              displayName?: string | null | undefined;
            }
          | null
          | undefined;
      };
    };
  };
};

export type GetDefaultHomeQueryVariables = Exact<{ [key: string]: never }>;

export type GetDefaultHomeQuery = {
  __typename?: 'Query';
  getDefaultHome?:
    | {
        __typename?: 'Home';
        id: string;
        name: string;
        type: HomeType;
        description?: string | null | undefined;
        timezone?: string | null | undefined;
        currency?: string | null | undefined;
        isPublic: boolean;
        joinCode?: string | null | undefined;
        allowJoinCode: boolean;
        maxMembers?: number | null | undefined;
        tags: Array<string>;
        metadata?: any | null | undefined;
        version: number;
        createdAt: string;
        updatedAt: string;
        invitesConnection: {
          __typename?: 'HomeInviteConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'HomeInviteEdge';
            cursor: string;
            node: {
              __typename?: 'HomeInvite';
              id: string;
              token: string;
              email: string;
              homeId: string;
              invitedUserId?: string | null | undefined;
              recipientName?: string | null | undefined;
              role: MembershipRole;
              status: InviteStatus;
              expiresAt: string;
              sentAt: string;
              lastReminderAt?: string | null | undefined;
              reminderCount: number;
              acceptedAt?: string | null | undefined;
              declinedAt?: string | null | undefined;
              revokedAt?: string | null | undefined;
              message?: string | null | undefined;
              createdAt: string;
              customPermissions?:
                | {
                    __typename?: 'HomePermissions';
                    canViewPantry?: boolean | null | undefined;
                    canEditPantry?: boolean | null | undefined;
                    canAddItems?: boolean | null | undefined;
                    canRemoveItems?: boolean | null | undefined;
                    canInviteOthers?: boolean | null | undefined;
                    canManageHome?: boolean | null | undefined;
                  }
                | null
                | undefined;
              home: { __typename?: 'Home'; id: string; name: string };
              inviter: {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                    }
                  | null
                  | undefined;
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        membersConnection: {
          __typename?: 'MembershipConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'MembershipEdge';
            cursor: string;
            node: {
              __typename?: 'Membership';
              id: string;
              homeId: string;
              userId: string;
              role: MembershipRole;
              status: MembershipStatus;
              displayName?: string | null | undefined;
              canViewPantry: boolean;
              canEditPantry: boolean;
              canAddItems: boolean;
              canRemoveItems: boolean;
              canInviteOthers: boolean;
              canManageHome: boolean;
              lastActiveAt?: string | null | undefined;
              joinedAt: string;
              leftAt?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              user: {
                __typename?: 'User';
                id: string;
                email: string;
                emailVerified: boolean;
                role: UserRole;
                onBoarded: boolean;
                timezone?: string | null | undefined;
                preferredCurrency?: string | null | undefined;
                language?: string | null | undefined;
                defaultShoppingListId?: string | null | undefined;
                defaultHomeId?: string | null | undefined;
                createdAt: string;
                updatedAt: string;
                lastActiveAt?: string | null | undefined;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      id: string;
                      firstName?: string | null | undefined;
                      lastName?: string | null | undefined;
                      displayName?: string | null | undefined;
                      bio?: string | null | undefined;
                      avatar?: string | null | undefined;
                      phone?: string | null | undefined;
                    }
                  | null
                  | undefined;
                settings?:
                  | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
                  | null
                  | undefined;
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        pantriesConnection: {
          __typename?: 'PantryConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'PantryEdge';
            cursor: string;
            node: {
              __typename?: 'Pantry';
              id: string;
              homeId: string;
              name: string;
              description?: string | null | undefined;
              isDefault: boolean;
              location?: string | null | undefined;
              temperature?: string | null | undefined;
              tags: Array<string>;
              metadata?: any | null | undefined;
              version: number;
              createdAt: string;
              updatedAt: string;
              itemsConnection: {
                __typename?: 'PantryItemConnection';
                totalCount: number;
                edges: Array<{
                  __typename?: 'PantryItemEdge';
                  cursor: string;
                  node: {
                    __typename: 'PantryItem';
                    storageNotes?: string | null | undefined;
                    normalizedUnitId?: string | null | undefined;
                    packageWeight?: number | null | undefined;
                    packageWeightUnitId?: string | null | undefined;
                    createdAt: string;
                    restockQuantity?: number | null | undefined;
                    wasteAmount: number;
                    wasteDate?: string | null | undefined;
                    wasteReason?: WasteReason | null | undefined;
                    condition: ItemCondition;
                    acquisitionMethod: AcquisitionMethod;
                    costPerUnit?: number | null | undefined;
                    totalCost?: number | null | undefined;
                    tags: Array<string>;
                    initialQuantity: number;
                    consumedQuantity: number;
                    id: string;
                    pantryId: string;
                    itemId: string;
                    itemName: string;
                    currentQuantity: number;
                    unitId?: string | null | undefined;
                    unitName: string;
                    version?: number | null | undefined;
                    updatedAt?: string | null | undefined;
                    storageState: StorageState;
                    expiresAt?: string | null | undefined;
                    lowStockAlert: boolean;
                    minQuantity?: number | null | undefined;
                    lastUsedAt?: string | null | undefined;
                    item: {
                      __typename: 'Item';
                      id: string;
                      imageUrl?: string | null | undefined;
                      name: string;
                      netWeight?: number | null | undefined;
                      description?: string | null | undefined;
                      dataSource: DataSource;
                      type: ItemType;
                      storageState: StorageState;
                      showInOnboarding: boolean;
                      shelfLifeDays?: number | null | undefined;
                      popularity: number;
                      status: ItemStatus;
                      visibility: Visibility;
                      tags: Array<string>;
                      healthBenefits?: any | null | undefined;
                      allergens?: any | null | undefined;
                      nutritions?: any | null | undefined;
                      metadata?: any | null | undefined;
                      ingredients?: any | null | undefined;
                      createdAt: string;
                      deletedAt?: string | null | undefined;
                      density?: number | null | undefined;
                      preferredTrackingUnitId?: string | null | undefined;
                      displayUnit?:
                        | {
                            __typename: 'Unit';
                            id: string;
                            name: string;
                            symbol: string;
                          }
                        | null
                        | undefined;
                      preferredTrackingUnit?:
                        | {
                            __typename?: 'Unit';
                            id: string;
                            name: string;
                            symbol: string;
                          }
                        | null
                        | undefined;
                      units: Array<{
                        __typename?: 'ItemUnit';
                        id: string;
                        itemId: string;
                        unitId: string;
                        isDefault: boolean;
                        isPreferred: boolean;
                        isCommon: boolean;
                        packageSize?: number | null | undefined;
                        packageDescription?: string | null | undefined;
                        retailUnit: boolean;
                        usageContext: Array<UnitUsageContext>;
                        recommendedFor: Array<UnitRecommendation>;
                        minQuantity?: number | null | undefined;
                        maxQuantity?: number | null | undefined;
                        quantityStep?: number | null | undefined;
                        averagePricePerUnit?: number | null | undefined;
                        lastPriceUpdate?: string | null | undefined;
                        priceSource?: string | null | undefined;
                        usageCount: number;
                        lastUsedAt?: string | null | undefined;
                        popularityScore: number;
                        source: UnitSource;
                        confidence?: number | null | undefined;
                        isVerified: boolean;
                        verifiedAt?: string | null | undefined;
                        createdAt: string;
                        updatedAt: string;
                        version: number;
                      }>;
                      brands: Array<{
                        __typename?: 'ItemBrand';
                        id: string;
                        brand: {
                          __typename?: 'Brand';
                          id: string;
                          name: string;
                          description?: string | null | undefined;
                          createdAt: string;
                          updatedAt: string;
                          version: number;
                        };
                      }>;
                      categories?:
                        | Array<{
                            __typename?: 'ItemCategory';
                            id: string;
                            isPrimary: boolean;
                            category: {
                              __typename: 'Category';
                              id: string;
                              name: string;
                              color?: string | null | undefined;
                              icon?: string | null | undefined;
                            };
                          }>
                        | null
                        | undefined;
                    };
                    unit?:
                      | {
                          __typename: 'Unit';
                          type: UnitType;
                          isMetric: boolean;
                          baseUnitId?: string | null | undefined;
                          conversionFactor: number;
                          isCommon: boolean;
                          displayAsFraction: boolean;
                          minPrecision: number;
                          autoConvertThreshold?: number | null | undefined;
                          id: string;
                          name: string;
                          symbol: string;
                        }
                      | null
                      | undefined;
                    normalizedUnit?:
                      | {
                          __typename?: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                        }
                      | null
                      | undefined;
                    packageWeightUnit?:
                      | {
                          __typename: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                          type: UnitType;
                        }
                      | null
                      | undefined;
                    store?:
                      | { __typename?: 'Store'; id: string; name: string }
                      | null
                      | undefined;
                    purchase?:
                      | {
                          __typename?: 'Purchase';
                          id: string;
                          purchaseDate: string;
                          unitPrice: number;
                          totalPrice: number;
                          quantity: number;
                        }
                      | null
                      | undefined;
                    usageRecords: Array<{
                      __typename?: 'PantryItemUsage';
                      id: string;
                      quantityUsed: number;
                      usedAt: string;
                      purpose: UsagePurpose;
                      notes?: string | null | undefined;
                      pantryItem: { __typename?: 'PantryItem'; id: string };
                      usedBy?:
                        | { __typename?: 'User'; id: string }
                        | null
                        | undefined;
                      cookingLog?:
                        | { __typename?: 'CookingLog'; id: string }
                        | null
                        | undefined;
                      mealPlanItem?:
                        | { __typename?: 'MealPlanItem'; id: string }
                        | null
                        | undefined;
                      recipe?:
                        | { __typename?: 'Recipe'; id: string }
                        | null
                        | undefined;
                    }>;
                    storageLocation?:
                      | {
                          __typename: 'StorageLocation';
                          id: string;
                          name: string;
                          type: StorageType;
                        }
                      | null
                      | undefined;
                    brand?:
                      | { __typename: 'Brand'; id: string; name: string }
                      | null
                      | undefined;
                  };
                }>;
                pageInfo: {
                  __typename?: 'PageInfo';
                  hasNextPage: boolean;
                  endCursor?: string | null | undefined;
                };
              };
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
      }
    | null
    | undefined;
};

export type SetDefaultHomeMutationVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type SetDefaultHomeMutation = {
  __typename?: 'Mutation';
  setDefaultHome: { __typename?: 'UserSettings'; id: string };
};

export type CreateImageUploadUrlMutationVariables = Exact<{
  mime: Scalars['String']['input'];
  purpose: ImageUploadPurpose;
  itemId?: InputMaybe<Scalars['String']['input']>;
}>;

export type CreateImageUploadUrlMutation = {
  __typename?: 'Mutation';
  createImageUploadUrl: {
    __typename?: 'PresignPayload';
    url: string;
    key: string;
  };
};

export type ConfirmProfileImageUploadMutationVariables = Exact<{
  key: Scalars['String']['input'];
}>;

export type ConfirmProfileImageUploadMutation = {
  __typename?: 'Mutation';
  confirmProfileImageUpload: string;
};

export type ConfirmItemImageUploadMutationVariables = Exact<{
  itemId: Scalars['String']['input'];
  key: Scalars['String']['input'];
}>;

export type ConfirmItemImageUploadMutation = {
  __typename?: 'Mutation';
  confirmItemImageUpload: string;
};

export type UpdateProfileAvatarMutationVariables = Exact<{
  avatarUrl: Scalars['String']['input'];
}>;

export type UpdateProfileAvatarMutation = {
  __typename?: 'Mutation';
  updateProfileAvatar: {
    __typename?: 'UserProfile';
    id: string;
    avatar?: string | null | undefined;
  };
};

export type UpdateProfileCoverMutationVariables = Exact<{
  coverImageUrl: Scalars['String']['input'];
}>;

export type UpdateProfileCoverMutation = {
  __typename?: 'Mutation';
  updateProfileCover: {
    __typename?: 'UserProfile';
    id: string;
    coverImage?: string | null | undefined;
  };
};

export type RemoveProfileAvatarMutationVariables = Exact<{
  [key: string]: never;
}>;

export type RemoveProfileAvatarMutation = {
  __typename?: 'Mutation';
  removeProfileAvatar: {
    __typename?: 'UserProfile';
    id: string;
    avatar?: string | null | undefined;
  };
};

export type RemoveProfileCoverMutationVariables = Exact<{
  [key: string]: never;
}>;

export type RemoveProfileCoverMutation = {
  __typename?: 'Mutation';
  removeProfileCover: {
    __typename?: 'UserProfile';
    id: string;
    coverImage?: string | null | undefined;
  };
};

export type UpdateItemImageMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  imageUrl: Scalars['String']['input'];
}>;

export type UpdateItemImageMutation = {
  __typename?: 'Mutation';
  updateItem: {
    __typename?: 'Item';
    id: string;
    imageUrl?: string | null | undefined;
  };
};

export type RemoveItemImageMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type RemoveItemImageMutation = {
  __typename?: 'Mutation';
  updateItem: {
    __typename?: 'Item';
    id: string;
    imageUrl?: string | null | undefined;
  };
};

export type ConvertQuantityQueryVariables = Exact<{
  itemId?: InputMaybe<Scalars['ID']['input']>;
  quantity: Scalars['Float']['input'];
  fromUnitId: Scalars['ID']['input'];
  toUnitId: Scalars['ID']['input'];
}>;

export type ConvertQuantityQuery = {
  __typename?: 'Query';
  convertQuantity?:
    | {
        __typename?: 'ConversionResult';
        value: number;
        displayText: string;
        unit: {
          __typename?: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        };
      }
    | null
    | undefined;
};

export type SuggestDisplayFormatQueryVariables = Exact<{
  quantity: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type SuggestDisplayFormatQuery = {
  __typename?: 'Query';
  suggestDisplayFormat: {
    __typename?: 'QuantityDisplay';
    decimal: number;
    fraction?: string | null | undefined;
    mixed?: string | null | undefined;
    display: string;
    unit?:
      | {
          __typename?: 'Unit';
          id: string;
          name: string;
          symbol: string;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        }
      | null
      | undefined;
  };
};

export type ParseQuantityInputQueryVariables = Exact<{
  input: Scalars['String']['input'];
  unitId: Scalars['ID']['input'];
}>;

export type ParseQuantityInputQuery = {
  __typename?: 'Query';
  parseQuantityInput: {
    __typename?: 'QuantityDisplay';
    decimal: number;
    fraction?: string | null | undefined;
    mixed?: string | null | undefined;
    display: string;
    unit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
  };
};

export type CanConvertQueryVariables = Exact<{
  itemId?: InputMaybe<Scalars['ID']['input']>;
  fromUnitId: Scalars['ID']['input'];
  toUnitId: Scalars['ID']['input'];
}>;

export type CanConvertQuery = {
  __typename?: 'Query';
  canConvert: {
    __typename?: 'ConversionAvailability';
    available: boolean;
    confidence: number;
    requiresItemContext: boolean;
    conversionType: ConversionType;
    notes?: string | null | undefined;
  };
};

export type GetItemConversionsQueryVariables = Exact<{
  itemId: Scalars['ID']['input'];
  includeStandard?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type GetItemConversionsQuery = {
  __typename?: 'Query';
  getItemConversions: Array<{
    __typename?: 'ItemUnitConversion';
    id: string;
    conversionRatio: number;
    source: ConversionSource;
    confidence: number;
    isVerified: boolean;
    notes?: string | null | undefined;
    createdAt: string;
    fromUnit: {
      __typename?: 'Unit';
      id: string;
      name: string;
      symbol: string;
      type: UnitType;
    };
    toUnit: {
      __typename?: 'Unit';
      id: string;
      name: string;
      symbol: string;
      type: UnitType;
    };
  }>;
};

export type GetBestDisplayUnitQueryVariables = Exact<{
  quantity: Scalars['Float']['input'];
  currentUnitId: Scalars['ID']['input'];
  itemId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type GetBestDisplayUnitQuery = {
  __typename?: 'Query';
  getBestDisplayUnit: {
    __typename?: 'Unit';
    id: string;
    name: string;
    symbol: string;
    type: UnitType;
    displayAsFraction: boolean;
    minPrecision: number;
    autoConvertThreshold?: number | null | undefined;
  };
};

export type AggregateQuantitiesQueryVariables = Exact<{
  itemId: Scalars['ID']['input'];
  quantities: Array<QuantityInput> | QuantityInput;
}>;

export type AggregateQuantitiesQuery = {
  __typename?: 'Query';
  aggregateQuantities: {
    __typename?: 'AggregationResult';
    quantity: number;
    displayText: string;
    unit: { __typename?: 'Unit'; id: string; name: string; symbol: string };
  };
};

export type CalculateRecipePantryDeficitQueryVariables = Exact<{
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
  householdId: Scalars['ID']['input'];
}>;

export type CalculateRecipePantryDeficitQuery = {
  __typename?: 'Query';
  calculateRecipePantryDeficit: Array<{
    __typename?: 'PantryDeficit';
    needed: number;
    available: number;
    deficit: number;
    needsToBuy: boolean;
    ingredient: {
      __typename?: 'RecipeIngredient';
      id: string;
      name: string;
      quantity: number;
      item?:
        | {
            __typename?: 'Item';
            id: string;
            name: string;
            imageUrl?: string | null | undefined;
          }
        | null
        | undefined;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
    };
    unit: { __typename?: 'Unit'; id: string; name: string; symbol: string };
    availableItems: Array<{
      __typename?: 'PantryItem';
      id: string;
      itemName: string;
      currentQuantity: number;
      expiresAt?: string | null | undefined;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
    }>;
  }>;
};

export type UpsertItemUnitConversionMutationVariables = Exact<{
  itemId: Scalars['ID']['input'];
  fromUnitId: Scalars['ID']['input'];
  toUnitId: Scalars['ID']['input'];
  conversionRatio: Scalars['Float']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
}>;

export type UpsertItemUnitConversionMutation = {
  __typename?: 'Mutation';
  upsertItemUnitConversion: {
    __typename?: 'ItemUnitConversion';
    id: string;
    conversionRatio: number;
    source: ConversionSource;
    confidence: number;
    notes?: string | null | undefined;
    createdAt: string;
    fromUnit: { __typename?: 'Unit'; id: string; name: string; symbol: string };
    toUnit: { __typename?: 'Unit'; id: string; name: string; symbol: string };
  };
};

export type GetItemsQueryVariables = Exact<{
  filters?: InputMaybe<ItemFilters>;
  sort?: InputMaybe<ItemSortInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetItemsQuery = {
  __typename?: 'Query';
  items: {
    __typename?: 'ItemConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'ItemEdge';
      cursor: string;
      node: {
        __typename?: 'Item';
        id: string;
        name: string;
        description?: string | null | undefined;
        type: ItemType;
        storageState: StorageState;
        imageUrl?: string | null | undefined;
        shelfLifeDays?: number | null | undefined;
        tags: Array<string>;
        status: ItemStatus;
        visibility: Visibility;
        showInOnboarding: boolean;
        popularity: number;
        nutritions?: any | null | undefined;
        healthBenefits?: any | null | undefined;
        metadata?: any | null | undefined;
        createdAt: string;
        updatedAt: string;
        deletedAt?: string | null | undefined;
        version: number;
        units: Array<{
          __typename?: 'ItemUnit';
          id: string;
          isDefault: boolean;
        }>;
        brands: Array<{ __typename?: 'ItemBrand'; id: string }>;
        categories?:
          | Array<{ __typename?: 'ItemCategory'; id: string }>
          | null
          | undefined;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null | undefined;
      endCursor?: string | null | undefined;
    };
  };
};

export type SearchItemsQueryVariables = Exact<{
  input: SearchItemsInput;
}>;

export type SearchItemsQuery = {
  __typename?: 'Query';
  searchItems?:
    | {
        __typename?: 'ItemConnection';
        totalCount: number;
        edges: Array<{
          __typename?: 'ItemEdge';
          cursor: string;
          node: {
            __typename?: 'Item';
            id: string;
            name: string;
            imageUrl?: string | null | undefined;
          };
        }>;
        pageInfo: {
          __typename?: 'PageInfo';
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor?: string | null | undefined;
          endCursor?: string | null | undefined;
        };
      }
    | null
    | undefined;
};

export type ItemByUpcFilterQueryVariables = Exact<{
  upc: Scalars['String']['input'];
  upcFormat?: InputMaybe<UpcFormat>;
}>;

export type ItemByUpcFilterQuery = {
  __typename?: 'Query';
  items: {
    __typename?: 'ItemConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'ItemEdge';
      cursor: string;
      node: {
        __typename?: 'Item';
        id: string;
        imageUrl?: string | null | undefined;
        name: string;
        netWeight?: number | null | undefined;
        primaryUpc?: string | null | undefined;
        units: Array<{
          __typename?: 'ItemUnit';
          isDefault: boolean;
          unitId: string;
        }>;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type ItemBySkuFilterQueryVariables = Exact<{
  sku: Scalars['String']['input'];
  skuStoreId?: InputMaybe<Scalars['String']['input']>;
}>;

export type ItemBySkuFilterQuery = {
  __typename?: 'Query';
  items: {
    __typename?: 'ItemConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'ItemEdge';
      cursor: string;
      node: {
        __typename?: 'Item';
        id: string;
        imageUrl?: string | null | undefined;
        name: string;
        netWeight?: number | null | undefined;
        description?: string | null | undefined;
        primaryUpc?: string | null | undefined;
        units: Array<{
          __typename?: 'ItemUnit';
          isDefault: boolean;
          unitId: string;
        }>;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type GetOnboardingItemsQueryVariables = Exact<{
  filters?: InputMaybe<ItemFilters>;
  sort?: InputMaybe<ItemSortInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetOnboardingItemsQuery = {
  __typename?: 'Query';
  items: {
    __typename?: 'ItemConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'ItemEdge';
      cursor: string;
      node: {
        __typename?: 'Item';
        id: string;
        name: string;
        imageUrl?: string | null | undefined;
        storageState: StorageState;
        displayUnit?:
          | { __typename?: 'Unit'; id: string; name: string }
          | null
          | undefined;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type AutocompleteItemsQueryVariables = Exact<{
  input: AutocompleteInput;
}>;

export type AutocompleteItemsQuery = {
  __typename?: 'Query';
  autocompleteItems?:
    | {
        __typename?: 'AutocompleteResponse';
        totalCount: number;
        suggestions: Array<{
          __typename?: 'ItemSuggestion';
          id: string;
          name: string;
          type: ItemType;
          imageUrl?: string | null | undefined;
          images?: any | null | undefined;
          netWeight?: number | null | undefined;
          displayUnit?: string | null | undefined;
          defaultUnit?:
            | {
                __typename?: 'ItemUnitSuggestion';
                id: string;
                name: string;
                symbol: string;
                type: UnitType;
                isDefault: boolean;
                isPreferred: boolean;
              }
            | null
            | undefined;
          brands: Array<{
            __typename?: 'BrandSuggestion';
            id: string;
            name: string;
          }>;
          category?:
            | {
                __typename?: 'CategorySuggestion';
                id: string;
                name: string;
                type: CategoryType;
                isPrimary: boolean;
                color?: string | null | undefined;
                icon?: string | null | undefined;
                slug?: string | null | undefined;
              }
            | null
            | undefined;
        }>;
      }
    | null
    | undefined;
};

export type SearchBrandsQueryVariables = Exact<{
  search: Scalars['String']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type SearchBrandsQuery = {
  __typename?: 'Query';
  brands: Array<{ __typename?: 'Brand'; id: string; name: string }>;
};

export type AutocompleteCategoriesQueryVariables = Exact<{
  input: AutocompleteCategoryInput;
}>;

export type AutocompleteCategoriesQuery = {
  __typename?: 'Query';
  autocompleteCategories: {
    __typename?: 'AutocompleteCategoryResponse';
    totalCount: number;
    suggestions: Array<{
      __typename?: 'CategorySuggestion';
      id: string;
      name: string;
      type: CategoryType;
      icon?: string | null | undefined;
    }>;
  };
};

export type CreateItemMutationVariables = Exact<{
  input: CreateItemInput;
}>;

export type CreateItemMutation = {
  __typename?: 'Mutation';
  createItem: {
    __typename?: 'Item';
    id: string;
    name: string;
    description?: string | null | undefined;
    netWeight?: number | null | undefined;
    type: ItemType;
    storageState: StorageState;
    shelfLifeDays?: number | null | undefined;
    imageUrl?: string | null | undefined;
    tags: Array<string>;
    displayUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    convertedNetWeight?:
      | {
          __typename?: 'ConvertedValue';
          value: number;
          unit: {
            __typename?: 'Unit';
            id: string;
            name: string;
            symbol: string;
          };
        }
      | null
      | undefined;
    brands: Array<{
      __typename?: 'ItemBrand';
      brand: { __typename?: 'Brand'; id: string; name: string };
    }>;
    categories?:
      | Array<{
          __typename?: 'ItemCategory';
          category: { __typename?: 'Category'; id: string; name: string };
        }>
      | null
      | undefined;
    units: Array<{
      __typename?: 'ItemUnit';
      isDefault: boolean;
      unitId: string;
    }>;
  };
};

export type StoreUpdatedSubscriptionVariables = Exact<{
  storeId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type StoreUpdatedSubscription = {
  __typename?: 'Subscription';
  storeUpdated: {
    __typename?: 'Store';
    id: string;
    name: string;
    address?: string | null | undefined;
    priceAccuracy?: number | null | undefined;
    lastPriceUpdate?: string | null | undefined;
    qualityRating?: number | null | undefined;
    storeInfo?:
      | {
          __typename?: 'StoreInfo';
          id: string;
          phone?: string | null | undefined;
        }
      | null
      | undefined;
  };
};

export type StoreRatingChangedSubscriptionVariables = Exact<{
  storeId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type StoreRatingChangedSubscription = {
  __typename?: 'Subscription';
  storeRatingChanged: {
    __typename?: 'Store';
    id: string;
    name: string;
    qualityRating?: number | null | undefined;
    priceAccuracy?: number | null | undefined;
    updatedAt: string;
  };
};

export type GetUnitsQueryVariables = Exact<{ [key: string]: never }>;

export type GetUnitsQuery = {
  __typename?: 'Query';
  units: Array<{
    __typename?: 'Unit';
    id: string;
    name: string;
    symbol: string;
    type: UnitType;
    conversionFactor: number;
    notes?: string | null | undefined;
  }>;
};

export type GetUnitQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type GetUnitQuery = {
  __typename?: 'Query';
  unit?:
    | {
        __typename?: 'Unit';
        id: string;
        name: string;
        symbol: string;
        type: UnitType;
        conversionFactor: number;
        notes?: string | null | undefined;
      }
    | null
    | undefined;
};

export type GetUnitBySymbolQueryVariables = Exact<{
  symbol: Scalars['String']['input'];
}>;

export type GetUnitBySymbolQuery = {
  __typename?: 'Query';
  unitBySymbol?:
    | {
        __typename?: 'Unit';
        id: string;
        name: string;
        symbol: string;
        type: UnitType;
        isMetric: boolean;
        baseUnitId?: string | null | undefined;
        conversionFactor: number;
        notes?: string | null | undefined;
        isCommon: boolean;
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
        baseUnit?:
          | {
              __typename?: 'Unit';
              id: string;
              name: string;
              conversionFactor: number;
              baseUnitId?: string | null | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type SearchUnitsQueryVariables = Exact<{
  query: Scalars['String']['input'];
  type?: InputMaybe<UnitType>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type SearchUnitsQuery = {
  __typename?: 'Query';
  searchUnits: Array<{
    __typename?: 'Unit';
    id: string;
    name: string;
    symbol: string;
    type: UnitType;
    isMetric: boolean;
    isCommon: boolean;
    sortOrder: number;
    displayAsFraction: boolean;
    minPrecision: number;
    conversionFactor: number;
    baseUnitId?: string | null | undefined;
  }>;
};

export type GetCommonUnitsQueryVariables = Exact<{
  type?: InputMaybe<UnitType>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type GetCommonUnitsQuery = {
  __typename?: 'Query';
  units: Array<{
    __typename?: 'Unit';
    id: string;
    name: string;
    symbol: string;
    type: UnitType;
    isMetric: boolean;
    isCommon: boolean;
    sortOrder: number;
    displayAsFraction: boolean;
    minPrecision: number;
    conversionFactor: number;
    baseUnitId?: string | null | undefined;
  }>;
};

export type GetConvertibleUnitsQueryVariables = Exact<{
  unitId: Scalars['ID']['input'];
}>;

export type GetConvertibleUnitsQuery = {
  __typename?: 'Query';
  getConvertibleUnits: Array<{
    __typename?: 'Unit';
    id: string;
    name: string;
    symbol: string;
    type: UnitType;
    isMetric: boolean;
    isCommon: boolean;
    displayAsFraction: boolean;
    minPrecision: number;
    conversionFactor: number;
  }>;
};

export type GetMyNotificationsQueryVariables = Exact<{
  filter?: InputMaybe<NotificationFilterInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  after?: InputMaybe<Scalars['String']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  orderBy?: InputMaybe<NotificationOrderBy>;
}>;

export type GetMyNotificationsQuery = {
  __typename?: 'Query';
  myNotifications: {
    __typename?: 'NotificationConnection';
    totalCount: number;
    unreadCount: number;
    edges: Array<{
      __typename?: 'NotificationEdge';
      cursor: string;
      node: {
        __typename?: 'Notification';
        id: string;
        userId: string;
        type: NotificationType;
        payload: any;
        status: NotificationStatus;
        sentAt: string;
        readAt?: string | null | undefined;
        createdAt: string;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null | undefined;
      endCursor?: string | null | undefined;
    };
  };
};

export type MarkNotificationAsReadMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type MarkNotificationAsReadMutation = {
  __typename?: 'Mutation';
  markNotificationAsRead: {
    __typename?: 'Notification';
    id: string;
    userId: string;
    type: NotificationType;
    payload: any;
    status: NotificationStatus;
    sentAt: string;
    readAt?: string | null | undefined;
    createdAt: string;
  };
};

export type DeleteNotificationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeleteNotificationMutation = {
  __typename?: 'Mutation';
  deleteNotification: boolean;
};

export type NotificationReceivedSubscriptionVariables = Exact<{
  [key: string]: never;
}>;

export type NotificationReceivedSubscription = {
  __typename?: 'Subscription';
  notificationReceived: {
    __typename?: 'NotificationPayload';
    mutation?: MutationType | null | undefined;
    userId?: string | null | undefined;
    timestamp?: string | null | undefined;
    notification?:
      | {
          __typename?: 'Notification';
          id: string;
          type: NotificationType;
          payload: any;
          status: NotificationStatus;
          sentAt: string;
          readAt?: string | null | undefined;
          createdAt: string;
        }
      | null
      | undefined;
  };
};

export type NotificationUpdatedSubscriptionVariables = Exact<{
  [key: string]: never;
}>;

export type NotificationUpdatedSubscription = {
  __typename?: 'Subscription';
  notificationUpdated: {
    __typename?: 'NotificationPayload';
    mutation?: MutationType | null | undefined;
    userId?: string | null | undefined;
    timestamp?: string | null | undefined;
    notification?:
      | {
          __typename?: 'Notification';
          id: string;
          type: NotificationType;
          payload: any;
          status: NotificationStatus;
          sentAt: string;
          readAt?: string | null | undefined;
          createdAt: string;
        }
      | null
      | undefined;
  };
};

export type GetPantriesQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type GetPantriesQuery = {
  __typename?: 'Query';
  pantries: Array<{
    __typename?: 'Pantry';
    id: string;
    homeId: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
    version: number;
    tags: Array<string>;
  }>;
};

export type GetPantryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  itemsCursor?: InputMaybe<Scalars['String']['input']>;
  itemsFirst?: InputMaybe<Scalars['Int']['input']>;
  storageLocationsCursor?: InputMaybe<Scalars['String']['input']>;
  storageLocationsFirst?: InputMaybe<Scalars['Int']['input']>;
}>;

export type GetPantryQuery = {
  __typename?: 'Query';
  pantry?:
    | {
        __typename?: 'Pantry';
        id: string;
        homeId: string;
        name: string;
        description?: string | null | undefined;
        isDefault: boolean;
        location?: string | null | undefined;
        temperature?: string | null | undefined;
        tags: Array<string>;
        metadata?: any | null | undefined;
        version: number;
        createdAt: string;
        updatedAt: string;
        itemsConnection: {
          __typename?: 'PantryItemConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'PantryItemEdge';
            cursor: string;
            node: {
              __typename: 'PantryItem';
              packageWeight?: number | null | undefined;
              tags: Array<string>;
              initialQuantity: number;
              consumedQuantity: number;
              id: string;
              pantryId: string;
              itemId: string;
              itemName: string;
              currentQuantity: number;
              unitId?: string | null | undefined;
              unitName: string;
              version?: number | null | undefined;
              updatedAt?: string | null | undefined;
              storageState: StorageState;
              expiresAt?: string | null | undefined;
              lowStockAlert: boolean;
              minQuantity?: number | null | undefined;
              lastUsedAt?: string | null | undefined;
              item: {
                __typename: 'Item';
                id: string;
                imageUrl?: string | null | undefined;
                name: string;
                netWeight?: number | null | undefined;
                displayUnit?:
                  | { __typename: 'Unit'; id: string; symbol: string }
                  | null
                  | undefined;
              };
              unit?:
                | {
                    __typename: 'Unit';
                    id: string;
                    name: string;
                    symbol: string;
                  }
                | null
                | undefined;
              storageLocation?:
                | {
                    __typename: 'StorageLocation';
                    id: string;
                    name: string;
                    type: StorageType;
                  }
                | null
                | undefined;
              brand?:
                | { __typename: 'Brand'; id: string; name: string }
                | null
                | undefined;
              packageWeightUnit?:
                | {
                    __typename: 'Unit';
                    id: string;
                    name: string;
                    symbol: string;
                  }
                | null
                | undefined;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            hasPreviousPage: boolean;
            startCursor?: string | null | undefined;
            endCursor?: string | null | undefined;
          };
        };
        storageLocationsConnection: {
          __typename?: 'StorageLocationConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'StorageLocationEdge';
            cursor: string;
            node: {
              __typename?: 'StorageLocation';
              id: string;
              name: string;
              type: StorageType;
              icon?: string | null | undefined;
              color?: string | null | undefined;
              temperature?: StorageState | null | undefined;
              isDefault: boolean;
              sortOrder: number;
              parentLocation?:
                | { __typename?: 'StorageLocation'; id: string; name: string }
                | null
                | undefined;
              childLocations: Array<{
                __typename?: 'StorageLocation';
                id: string;
                name: string;
              }>;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            hasPreviousPage: boolean;
            startCursor?: string | null | undefined;
            endCursor?: string | null | undefined;
          };
        };
      }
    | null
    | undefined;
};

export type GetPantryItemQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type GetPantryItemQuery = {
  __typename?: 'Query';
  pantryItem: {
    __typename: 'PantryItem';
    storageNotes?: string | null | undefined;
    normalizedUnitId?: string | null | undefined;
    packageWeight?: number | null | undefined;
    packageWeightUnitId?: string | null | undefined;
    createdAt: string;
    restockQuantity?: number | null | undefined;
    wasteAmount: number;
    wasteDate?: string | null | undefined;
    wasteReason?: WasteReason | null | undefined;
    condition: ItemCondition;
    acquisitionMethod: AcquisitionMethod;
    costPerUnit?: number | null | undefined;
    totalCost?: number | null | undefined;
    tags: Array<string>;
    initialQuantity: number;
    consumedQuantity: number;
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    currentQuantity: number;
    unitId?: string | null | undefined;
    unitName: string;
    version?: number | null | undefined;
    updatedAt?: string | null | undefined;
    storageState: StorageState;
    expiresAt?: string | null | undefined;
    lowStockAlert: boolean;
    minQuantity?: number | null | undefined;
    lastUsedAt?: string | null | undefined;
    item: {
      __typename: 'Item';
      id: string;
      imageUrl?: string | null | undefined;
      name: string;
      netWeight?: number | null | undefined;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      deletedAt?: string | null | undefined;
      density?: number | null | undefined;
      preferredTrackingUnitId?: string | null | undefined;
      displayUnit?:
        | { __typename: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      preferredTrackingUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault: boolean;
        isPreferred: boolean;
        isCommon: boolean;
        packageSize?: number | null | undefined;
        packageDescription?: string | null | undefined;
        retailUnit: boolean;
        usageContext: Array<UnitUsageContext>;
        recommendedFor: Array<UnitRecommendation>;
        minQuantity?: number | null | undefined;
        maxQuantity?: number | null | undefined;
        quantityStep?: number | null | undefined;
        averagePricePerUnit?: number | null | undefined;
        lastPriceUpdate?: string | null | undefined;
        priceSource?: string | null | undefined;
        usageCount: number;
        lastUsedAt?: string | null | undefined;
        popularityScore: number;
        source: UnitSource;
        confidence?: number | null | undefined;
        isVerified: boolean;
        verifiedAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        version: number;
      }>;
      brands: Array<{
        __typename?: 'ItemBrand';
        id: string;
        brand: {
          __typename?: 'Brand';
          id: string;
          name: string;
          description?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          version: number;
        };
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            isPrimary: boolean;
            category: {
              __typename: 'Category';
              id: string;
              name: string;
              color?: string | null | undefined;
              icon?: string | null | undefined;
            };
          }>
        | null
        | undefined;
    };
    unit?:
      | {
          __typename: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
          id: string;
          name: string;
          symbol: string;
        }
      | null
      | undefined;
    normalizedUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    packageWeightUnit?:
      | {
          __typename: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
        }
      | null
      | undefined;
    store?:
      | { __typename?: 'Store'; id: string; name: string }
      | null
      | undefined;
    purchase?:
      | {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          unitPrice: number;
          totalPrice: number;
          quantity: number;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      quantityUsed: number;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      pantryItem: { __typename?: 'PantryItem'; id: string };
      usedBy?: { __typename?: 'User'; id: string } | null | undefined;
      cookingLog?: { __typename?: 'CookingLog'; id: string } | null | undefined;
      mealPlanItem?:
        | { __typename?: 'MealPlanItem'; id: string }
        | null
        | undefined;
      recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
    }>;
    storageLocation?:
      | {
          __typename: 'StorageLocation';
          id: string;
          name: string;
          type: StorageType;
        }
      | null
      | undefined;
    brand?:
      | { __typename: 'Brand'; id: string; name: string }
      | null
      | undefined;
  };
};

export type GetDefaultPantryQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type GetDefaultPantryQuery = {
  __typename?: 'Query';
  defaultPantry?:
    | { __typename?: 'Pantry'; id: string; name: string; isDefault: boolean }
    | null
    | undefined;
};

export type GetRecentlyDeletedPantryItemsQueryVariables = Exact<{
  pantryId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type GetRecentlyDeletedPantryItemsQuery = {
  __typename?: 'Query';
  recentlyDeletedPantryItems: Array<{
    __typename?: 'PantryItem';
    id: string;
    itemName: string;
    itemId: string;
    createdAt: string;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      imageUrl?: string | null | undefined;
    };
  }>;
};

export type GetPantryLedgerAnalyticsQueryVariables = Exact<{
  pantryId: Scalars['ID']['input'];
  itemId?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<AnalyticsFilterInput>;
  granularity?: InputMaybe<PeriodGranularity>;
}>;

export type GetPantryLedgerAnalyticsQuery = {
  __typename?: 'Query';
  pantryLedgerAnalytics: {
    __typename?: 'LedgerAnalytics';
    periodStart: string;
    periodEnd: string;
    granularity: PeriodGranularity;
    summary: {
      __typename?: 'LedgerSummary';
      totalAdded: number;
      totalConsumed: number;
      totalWasted: number;
      netQuantity: number;
      additionCount: number;
      consumptionCount: number;
      wasteCount: number;
      unitName?: string | null | undefined;
      additionsByUnit: Array<{
        __typename?: 'UsageByUnit';
        unitId: string;
        unitName: string;
        unitSymbol: string;
        totalQuantity: number;
        count: number;
      }>;
      consumptionByUnit: Array<{
        __typename?: 'UsageByUnit';
        unitId: string;
        unitName: string;
        unitSymbol: string;
        totalQuantity: number;
        count: number;
      }>;
    };
    periodData: Array<{
      __typename?: 'LedgerPeriodData';
      periodStart: string;
      periodEnd: string;
      periodLabel: string;
      added: number;
      consumed: number;
      wasted: number;
      net: number;
      additionCost?: number | null | undefined;
    }>;
    costAnalytics?:
      | {
          __typename?: 'AdditionCostAnalytics';
          totalSpent: number;
          averageCostPerUnit: number;
          costByStore: Array<{
            __typename?: 'StoreCostBreakdown';
            storeId?: string | null | undefined;
            storeName?: string | null | undefined;
            totalSpent: number;
            itemCount: number;
            averageCostPerUnit: number;
          }>;
        }
      | null
      | undefined;
    topRestockedItems: Array<{
      __typename?: 'UsageByItem';
      itemId: string;
      itemName: string;
      totalQuantity: number;
      count: number;
      unitName?: string | null | undefined;
      imageUrl?: string | null | undefined;
    }>;
  };
};

export type GetPantryItemLedgerQueryVariables = Exact<{
  pantryItemId: Scalars['ID']['input'];
  filter?: InputMaybe<AnalyticsFilterInput>;
}>;

export type GetPantryItemLedgerQuery = {
  __typename?: 'Query';
  pantryItemLedger: {
    __typename?: 'LedgerSummary';
    totalAdded: number;
    totalConsumed: number;
    totalWasted: number;
    netQuantity: number;
    additionCount: number;
    consumptionCount: number;
    wasteCount: number;
    unitName?: string | null | undefined;
    additionsByUnit: Array<{
      __typename?: 'UsageByUnit';
      unitId: string;
      unitName: string;
      totalQuantity: number;
    }>;
    consumptionByUnit: Array<{
      __typename?: 'UsageByUnit';
      unitId: string;
      unitName: string;
      totalQuantity: number;
    }>;
  };
};

export type GetPantryUsageAnalyticsQueryVariables = Exact<{
  pantryId: Scalars['ID']['input'];
  filter?: InputMaybe<AnalyticsFilterInput>;
}>;

export type GetPantryUsageAnalyticsQuery = {
  __typename?: 'Query';
  pantryUsageAnalytics: {
    __typename?: 'UsageAnalytics';
    totalUsageCount: number;
    totalQuantityUsed: number;
    averageUsagePerDay: number;
    periodStart: string;
    periodEnd: string;
    usageTrend: Array<{
      __typename?: 'TimeSeriesDataPoint';
      date: string;
      value: number;
      count: number;
    }>;
    usageByPurpose: Array<{
      __typename?: 'UsageByPurpose';
      purpose: UsagePurpose;
      totalQuantity: number;
      count: number;
      percentage: number;
    }>;
    usageBySource: Array<{
      __typename?: 'UsageBySource';
      source: UsageSource;
      totalQuantity: number;
      count: number;
      percentage: number;
    }>;
    topUsedItems: Array<{
      __typename?: 'UsageByItem';
      itemId: string;
      itemName: string;
      totalQuantity: number;
      count: number;
      unitName?: string | null | undefined;
      imageUrl?: string | null | undefined;
    }>;
  };
};

export type GetPantryWasteAnalyticsQueryVariables = Exact<{
  pantryId: Scalars['ID']['input'];
  filter?: InputMaybe<AnalyticsFilterInput>;
}>;

export type GetPantryWasteAnalyticsQuery = {
  __typename?: 'Query';
  pantryWasteAnalytics: {
    __typename?: 'WasteAnalytics';
    totalWasteCount: number;
    totalWasteQuantity: number;
    totalWasteValue: number;
    wasteRate: number;
    averageWastePerDay: number;
    composted: number;
    recycled: number;
    periodStart: string;
    periodEnd: string;
    wasteTrend: Array<{
      __typename?: 'TimeSeriesDataPoint';
      date: string;
      value: number;
      count: number;
    }>;
    wasteByReason: Array<{
      __typename?: 'WasteByReason';
      reason: WasteReason;
      totalQuantity: number;
      count: number;
      percentage: number;
      estimatedValue?: number | null | undefined;
    }>;
    topWastedItems: Array<{
      __typename?: 'WasteByItem';
      itemId: string;
      itemName: string;
      totalQuantity: number;
      count: number;
      estimatedValue?: number | null | undefined;
      unitName?: string | null | undefined;
      imageUrl?: string | null | undefined;
    }>;
  };
};

export type CreatePantryMutationVariables = Exact<{
  input: CreatePantryInput;
}>;

export type CreatePantryMutation = {
  __typename?: 'Mutation';
  createPantry: {
    __typename?: 'Pantry';
    id: string;
    homeId: string;
    name: string;
    description?: string | null | undefined;
    isDefault: boolean;
    location?: string | null | undefined;
    temperature?: string | null | undefined;
    tags: Array<string>;
    metadata?: any | null | undefined;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
};

export type UpdatePantryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePantryInput;
}>;

export type UpdatePantryMutation = {
  __typename?: 'Mutation';
  updatePantry: {
    __typename?: 'Pantry';
    id: string;
    homeId: string;
    name: string;
    description?: string | null | undefined;
    isDefault: boolean;
    location?: string | null | undefined;
    temperature?: string | null | undefined;
    tags: Array<string>;
    metadata?: any | null | undefined;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
};

export type DeletePantryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeletePantryMutation = {
  __typename?: 'Mutation';
  deletePantry: { __typename?: 'Pantry'; id: string; name: string };
};

export type SetDefaultPantryMutationVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type SetDefaultPantryMutation = {
  __typename?: 'Mutation';
  setDefaultPantry: {
    __typename?: 'Pantry';
    id: string;
    name: string;
    isDefault: boolean;
    homeId: string;
  };
};

export type CreatePantryItemMutationVariables = Exact<{
  input: CreatePantryItemInput;
}>;

export type CreatePantryItemMutation = {
  __typename?: 'Mutation';
  createPantryItem: {
    __typename: 'PantryItem';
    packageWeight?: number | null | undefined;
    tags: Array<string>;
    initialQuantity: number;
    consumedQuantity: number;
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    currentQuantity: number;
    unitId?: string | null | undefined;
    unitName: string;
    version?: number | null | undefined;
    updatedAt?: string | null | undefined;
    storageState: StorageState;
    expiresAt?: string | null | undefined;
    lowStockAlert: boolean;
    minQuantity?: number | null | undefined;
    lastUsedAt?: string | null | undefined;
    item: {
      __typename: 'Item';
      id: string;
      imageUrl?: string | null | undefined;
      name: string;
      netWeight?: number | null | undefined;
      displayUnit?:
        | { __typename: 'Unit'; id: string; symbol: string }
        | null
        | undefined;
    };
    unit?:
      | { __typename: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    storageLocation?:
      | {
          __typename: 'StorageLocation';
          id: string;
          name: string;
          type: StorageType;
        }
      | null
      | undefined;
    brand?:
      | { __typename: 'Brand'; id: string; name: string }
      | null
      | undefined;
    packageWeightUnit?:
      | { __typename: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
  };
};

export type UpdatePantryItemMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePantryItemInput;
}>;

export type UpdatePantryItemMutation = {
  __typename?: 'Mutation';
  updatePantryItem: {
    __typename: 'PantryItem';
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    currentQuantity: number;
    unitId?: string | null | undefined;
    unitName: string;
    version?: number | null | undefined;
    updatedAt?: string | null | undefined;
    storageState: StorageState;
    expiresAt?: string | null | undefined;
    lowStockAlert: boolean;
    minQuantity?: number | null | undefined;
    lastUsedAt?: string | null | undefined;
  };
};

export type DeletePantryItemMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeletePantryItemMutation = {
  __typename?: 'Mutation';
  deletePantryItem: {
    __typename: 'PantryItem';
    storageNotes?: string | null | undefined;
    normalizedUnitId?: string | null | undefined;
    packageWeight?: number | null | undefined;
    packageWeightUnitId?: string | null | undefined;
    createdAt: string;
    restockQuantity?: number | null | undefined;
    wasteAmount: number;
    wasteDate?: string | null | undefined;
    wasteReason?: WasteReason | null | undefined;
    condition: ItemCondition;
    acquisitionMethod: AcquisitionMethod;
    costPerUnit?: number | null | undefined;
    totalCost?: number | null | undefined;
    tags: Array<string>;
    initialQuantity: number;
    consumedQuantity: number;
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    currentQuantity: number;
    unitId?: string | null | undefined;
    unitName: string;
    version?: number | null | undefined;
    updatedAt?: string | null | undefined;
    storageState: StorageState;
    expiresAt?: string | null | undefined;
    lowStockAlert: boolean;
    minQuantity?: number | null | undefined;
    lastUsedAt?: string | null | undefined;
    item: {
      __typename: 'Item';
      id: string;
      imageUrl?: string | null | undefined;
      name: string;
      netWeight?: number | null | undefined;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      deletedAt?: string | null | undefined;
      density?: number | null | undefined;
      preferredTrackingUnitId?: string | null | undefined;
      displayUnit?:
        | { __typename: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      preferredTrackingUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault: boolean;
        isPreferred: boolean;
        isCommon: boolean;
        packageSize?: number | null | undefined;
        packageDescription?: string | null | undefined;
        retailUnit: boolean;
        usageContext: Array<UnitUsageContext>;
        recommendedFor: Array<UnitRecommendation>;
        minQuantity?: number | null | undefined;
        maxQuantity?: number | null | undefined;
        quantityStep?: number | null | undefined;
        averagePricePerUnit?: number | null | undefined;
        lastPriceUpdate?: string | null | undefined;
        priceSource?: string | null | undefined;
        usageCount: number;
        lastUsedAt?: string | null | undefined;
        popularityScore: number;
        source: UnitSource;
        confidence?: number | null | undefined;
        isVerified: boolean;
        verifiedAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        version: number;
      }>;
      brands: Array<{
        __typename?: 'ItemBrand';
        id: string;
        brand: {
          __typename?: 'Brand';
          id: string;
          name: string;
          description?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          version: number;
        };
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            isPrimary: boolean;
            category: {
              __typename: 'Category';
              id: string;
              name: string;
              color?: string | null | undefined;
              icon?: string | null | undefined;
            };
          }>
        | null
        | undefined;
    };
    unit?:
      | {
          __typename: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
          id: string;
          name: string;
          symbol: string;
        }
      | null
      | undefined;
    normalizedUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    packageWeightUnit?:
      | {
          __typename: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
        }
      | null
      | undefined;
    store?:
      | { __typename?: 'Store'; id: string; name: string }
      | null
      | undefined;
    purchase?:
      | {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          unitPrice: number;
          totalPrice: number;
          quantity: number;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      quantityUsed: number;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      pantryItem: { __typename?: 'PantryItem'; id: string };
      usedBy?: { __typename?: 'User'; id: string } | null | undefined;
      cookingLog?: { __typename?: 'CookingLog'; id: string } | null | undefined;
      mealPlanItem?:
        | { __typename?: 'MealPlanItem'; id: string }
        | null
        | undefined;
      recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
    }>;
    storageLocation?:
      | {
          __typename: 'StorageLocation';
          id: string;
          name: string;
          type: StorageType;
        }
      | null
      | undefined;
    brand?:
      | { __typename: 'Brand'; id: string; name: string }
      | null
      | undefined;
  };
};

export type CreatePantryItemUsageMutationVariables = Exact<{
  input: RecordPantryItemUsageInput;
}>;

export type CreatePantryItemUsageMutation = {
  __typename?: 'Mutation';
  createPantryItemUsage: {
    __typename?: 'PantryItemUsage';
    id: string;
    quantityUsed: number;
    usageUnitId?: string | null | undefined;
    weightUsed?: number | null | undefined;
    weightUsedUnitId?: string | null | undefined;
    usedAt: string;
    purpose: UsagePurpose;
    notes?: string | null | undefined;
    usageUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    weightUsedUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    pantryItem: {
      __typename: 'PantryItem';
      id: string;
      currentQuantity: number;
      packageWeight?: number | null | undefined;
      consumedQuantity: number;
      storageNotes?: string | null | undefined;
      normalizedUnitId?: string | null | undefined;
      packageWeightUnitId?: string | null | undefined;
      createdAt: string;
      restockQuantity?: number | null | undefined;
      wasteAmount: number;
      wasteDate?: string | null | undefined;
      wasteReason?: WasteReason | null | undefined;
      condition: ItemCondition;
      acquisitionMethod: AcquisitionMethod;
      costPerUnit?: number | null | undefined;
      totalCost?: number | null | undefined;
      tags: Array<string>;
      initialQuantity: number;
      pantryId: string;
      itemId: string;
      itemName: string;
      unitId?: string | null | undefined;
      unitName: string;
      version?: number | null | undefined;
      updatedAt?: string | null | undefined;
      storageState: StorageState;
      expiresAt?: string | null | undefined;
      lowStockAlert: boolean;
      minQuantity?: number | null | undefined;
      lastUsedAt?: string | null | undefined;
      item: {
        __typename: 'Item';
        id: string;
        imageUrl?: string | null | undefined;
        name: string;
        netWeight?: number | null | undefined;
        description?: string | null | undefined;
        dataSource: DataSource;
        type: ItemType;
        storageState: StorageState;
        showInOnboarding: boolean;
        shelfLifeDays?: number | null | undefined;
        popularity: number;
        status: ItemStatus;
        visibility: Visibility;
        tags: Array<string>;
        healthBenefits?: any | null | undefined;
        allergens?: any | null | undefined;
        nutritions?: any | null | undefined;
        metadata?: any | null | undefined;
        ingredients?: any | null | undefined;
        createdAt: string;
        deletedAt?: string | null | undefined;
        density?: number | null | undefined;
        preferredTrackingUnitId?: string | null | undefined;
        displayUnit?:
          | { __typename: 'Unit'; id: string; name: string; symbol: string }
          | null
          | undefined;
        preferredTrackingUnit?:
          | { __typename?: 'Unit'; id: string; name: string; symbol: string }
          | null
          | undefined;
        units: Array<{
          __typename?: 'ItemUnit';
          id: string;
          itemId: string;
          unitId: string;
          isDefault: boolean;
          isPreferred: boolean;
          isCommon: boolean;
          packageSize?: number | null | undefined;
          packageDescription?: string | null | undefined;
          retailUnit: boolean;
          usageContext: Array<UnitUsageContext>;
          recommendedFor: Array<UnitRecommendation>;
          minQuantity?: number | null | undefined;
          maxQuantity?: number | null | undefined;
          quantityStep?: number | null | undefined;
          averagePricePerUnit?: number | null | undefined;
          lastPriceUpdate?: string | null | undefined;
          priceSource?: string | null | undefined;
          usageCount: number;
          lastUsedAt?: string | null | undefined;
          popularityScore: number;
          source: UnitSource;
          confidence?: number | null | undefined;
          isVerified: boolean;
          verifiedAt?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          version: number;
        }>;
        brands: Array<{
          __typename?: 'ItemBrand';
          id: string;
          brand: {
            __typename?: 'Brand';
            id: string;
            name: string;
            description?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            version: number;
          };
        }>;
        categories?:
          | Array<{
              __typename?: 'ItemCategory';
              id: string;
              isPrimary: boolean;
              category: {
                __typename: 'Category';
                id: string;
                name: string;
                color?: string | null | undefined;
                icon?: string | null | undefined;
              };
            }>
          | null
          | undefined;
      };
      unit?:
        | {
            __typename: 'Unit';
            type: UnitType;
            isMetric: boolean;
            baseUnitId?: string | null | undefined;
            conversionFactor: number;
            isCommon: boolean;
            displayAsFraction: boolean;
            minPrecision: number;
            autoConvertThreshold?: number | null | undefined;
            id: string;
            name: string;
            symbol: string;
          }
        | null
        | undefined;
      normalizedUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      packageWeightUnit?:
        | {
            __typename: 'Unit';
            id: string;
            name: string;
            symbol: string;
            type: UnitType;
          }
        | null
        | undefined;
      store?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
      purchase?:
        | {
            __typename?: 'Purchase';
            id: string;
            purchaseDate: string;
            unitPrice: number;
            totalPrice: number;
            quantity: number;
          }
        | null
        | undefined;
      usageRecords: Array<{
        __typename?: 'PantryItemUsage';
        id: string;
        quantityUsed: number;
        usedAt: string;
        purpose: UsagePurpose;
        notes?: string | null | undefined;
        pantryItem: { __typename?: 'PantryItem'; id: string };
        usedBy?: { __typename?: 'User'; id: string } | null | undefined;
        cookingLog?:
          | { __typename?: 'CookingLog'; id: string }
          | null
          | undefined;
        mealPlanItem?:
          | { __typename?: 'MealPlanItem'; id: string }
          | null
          | undefined;
        recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
      }>;
      storageLocation?:
        | {
            __typename: 'StorageLocation';
            id: string;
            name: string;
            type: StorageType;
          }
        | null
        | undefined;
      brand?:
        | { __typename: 'Brand'; id: string; name: string }
        | null
        | undefined;
    };
    usedBy?:
      | { __typename?: 'User'; id: string; email: string }
      | null
      | undefined;
  };
};

export type RecordPantryItemWasteMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  wasteAmount: Scalars['Float']['input'];
  wasteReason: WasteReason;
  wasteUnitId?: InputMaybe<Scalars['String']['input']>;
  wasteWeight?: InputMaybe<Scalars['Float']['input']>;
  wasteWeightUnitId?: InputMaybe<Scalars['String']['input']>;
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type RecordPantryItemWasteMutation = {
  __typename?: 'Mutation';
  recordPantryItemWaste: {
    __typename: 'PantryItem';
    storageNotes?: string | null | undefined;
    normalizedUnitId?: string | null | undefined;
    packageWeight?: number | null | undefined;
    packageWeightUnitId?: string | null | undefined;
    createdAt: string;
    restockQuantity?: number | null | undefined;
    wasteAmount: number;
    wasteDate?: string | null | undefined;
    wasteReason?: WasteReason | null | undefined;
    condition: ItemCondition;
    acquisitionMethod: AcquisitionMethod;
    costPerUnit?: number | null | undefined;
    totalCost?: number | null | undefined;
    tags: Array<string>;
    initialQuantity: number;
    consumedQuantity: number;
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    currentQuantity: number;
    unitId?: string | null | undefined;
    unitName: string;
    version?: number | null | undefined;
    updatedAt?: string | null | undefined;
    storageState: StorageState;
    expiresAt?: string | null | undefined;
    lowStockAlert: boolean;
    minQuantity?: number | null | undefined;
    lastUsedAt?: string | null | undefined;
    item: {
      __typename: 'Item';
      id: string;
      imageUrl?: string | null | undefined;
      name: string;
      netWeight?: number | null | undefined;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      deletedAt?: string | null | undefined;
      density?: number | null | undefined;
      preferredTrackingUnitId?: string | null | undefined;
      displayUnit?:
        | { __typename: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      preferredTrackingUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault: boolean;
        isPreferred: boolean;
        isCommon: boolean;
        packageSize?: number | null | undefined;
        packageDescription?: string | null | undefined;
        retailUnit: boolean;
        usageContext: Array<UnitUsageContext>;
        recommendedFor: Array<UnitRecommendation>;
        minQuantity?: number | null | undefined;
        maxQuantity?: number | null | undefined;
        quantityStep?: number | null | undefined;
        averagePricePerUnit?: number | null | undefined;
        lastPriceUpdate?: string | null | undefined;
        priceSource?: string | null | undefined;
        usageCount: number;
        lastUsedAt?: string | null | undefined;
        popularityScore: number;
        source: UnitSource;
        confidence?: number | null | undefined;
        isVerified: boolean;
        verifiedAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        version: number;
      }>;
      brands: Array<{
        __typename?: 'ItemBrand';
        id: string;
        brand: {
          __typename?: 'Brand';
          id: string;
          name: string;
          description?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          version: number;
        };
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            isPrimary: boolean;
            category: {
              __typename: 'Category';
              id: string;
              name: string;
              color?: string | null | undefined;
              icon?: string | null | undefined;
            };
          }>
        | null
        | undefined;
    };
    unit?:
      | {
          __typename: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
          id: string;
          name: string;
          symbol: string;
        }
      | null
      | undefined;
    normalizedUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    packageWeightUnit?:
      | {
          __typename: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
        }
      | null
      | undefined;
    store?:
      | { __typename?: 'Store'; id: string; name: string }
      | null
      | undefined;
    purchase?:
      | {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          unitPrice: number;
          totalPrice: number;
          quantity: number;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      quantityUsed: number;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      pantryItem: { __typename?: 'PantryItem'; id: string };
      usedBy?: { __typename?: 'User'; id: string } | null | undefined;
      cookingLog?: { __typename?: 'CookingLog'; id: string } | null | undefined;
      mealPlanItem?:
        | { __typename?: 'MealPlanItem'; id: string }
        | null
        | undefined;
      recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
    }>;
    storageLocation?:
      | {
          __typename: 'StorageLocation';
          id: string;
          name: string;
          type: StorageType;
        }
      | null
      | undefined;
    brand?:
      | { __typename: 'Brand'; id: string; name: string }
      | null
      | undefined;
  };
};

export type RestockPantryItemMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: RestockPantryItemInput;
}>;

export type RestockPantryItemMutation = {
  __typename?: 'Mutation';
  restockPantryItem: {
    __typename?: 'PantryItemUsage';
    id: string;
    quantityUsed: number;
    purpose: UsagePurpose;
    costPerUnit?: number | null | undefined;
    totalCost?: number | null | undefined;
    pantryItem: {
      __typename: 'PantryItem';
      storageNotes?: string | null | undefined;
      normalizedUnitId?: string | null | undefined;
      packageWeight?: number | null | undefined;
      packageWeightUnitId?: string | null | undefined;
      createdAt: string;
      restockQuantity?: number | null | undefined;
      wasteAmount: number;
      wasteDate?: string | null | undefined;
      wasteReason?: WasteReason | null | undefined;
      condition: ItemCondition;
      acquisitionMethod: AcquisitionMethod;
      costPerUnit?: number | null | undefined;
      totalCost?: number | null | undefined;
      tags: Array<string>;
      initialQuantity: number;
      consumedQuantity: number;
      id: string;
      pantryId: string;
      itemId: string;
      itemName: string;
      currentQuantity: number;
      unitId?: string | null | undefined;
      unitName: string;
      version?: number | null | undefined;
      updatedAt?: string | null | undefined;
      storageState: StorageState;
      expiresAt?: string | null | undefined;
      lowStockAlert: boolean;
      minQuantity?: number | null | undefined;
      lastUsedAt?: string | null | undefined;
      item: {
        __typename: 'Item';
        id: string;
        imageUrl?: string | null | undefined;
        name: string;
        netWeight?: number | null | undefined;
        description?: string | null | undefined;
        dataSource: DataSource;
        type: ItemType;
        storageState: StorageState;
        showInOnboarding: boolean;
        shelfLifeDays?: number | null | undefined;
        popularity: number;
        status: ItemStatus;
        visibility: Visibility;
        tags: Array<string>;
        healthBenefits?: any | null | undefined;
        allergens?: any | null | undefined;
        nutritions?: any | null | undefined;
        metadata?: any | null | undefined;
        ingredients?: any | null | undefined;
        createdAt: string;
        deletedAt?: string | null | undefined;
        density?: number | null | undefined;
        preferredTrackingUnitId?: string | null | undefined;
        displayUnit?:
          | { __typename: 'Unit'; id: string; name: string; symbol: string }
          | null
          | undefined;
        preferredTrackingUnit?:
          | { __typename?: 'Unit'; id: string; name: string; symbol: string }
          | null
          | undefined;
        units: Array<{
          __typename?: 'ItemUnit';
          id: string;
          itemId: string;
          unitId: string;
          isDefault: boolean;
          isPreferred: boolean;
          isCommon: boolean;
          packageSize?: number | null | undefined;
          packageDescription?: string | null | undefined;
          retailUnit: boolean;
          usageContext: Array<UnitUsageContext>;
          recommendedFor: Array<UnitRecommendation>;
          minQuantity?: number | null | undefined;
          maxQuantity?: number | null | undefined;
          quantityStep?: number | null | undefined;
          averagePricePerUnit?: number | null | undefined;
          lastPriceUpdate?: string | null | undefined;
          priceSource?: string | null | undefined;
          usageCount: number;
          lastUsedAt?: string | null | undefined;
          popularityScore: number;
          source: UnitSource;
          confidence?: number | null | undefined;
          isVerified: boolean;
          verifiedAt?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          version: number;
        }>;
        brands: Array<{
          __typename?: 'ItemBrand';
          id: string;
          brand: {
            __typename?: 'Brand';
            id: string;
            name: string;
            description?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            version: number;
          };
        }>;
        categories?:
          | Array<{
              __typename?: 'ItemCategory';
              id: string;
              isPrimary: boolean;
              category: {
                __typename: 'Category';
                id: string;
                name: string;
                color?: string | null | undefined;
                icon?: string | null | undefined;
              };
            }>
          | null
          | undefined;
      };
      unit?:
        | {
            __typename: 'Unit';
            type: UnitType;
            isMetric: boolean;
            baseUnitId?: string | null | undefined;
            conversionFactor: number;
            isCommon: boolean;
            displayAsFraction: boolean;
            minPrecision: number;
            autoConvertThreshold?: number | null | undefined;
            id: string;
            name: string;
            symbol: string;
          }
        | null
        | undefined;
      normalizedUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      packageWeightUnit?:
        | {
            __typename: 'Unit';
            id: string;
            name: string;
            symbol: string;
            type: UnitType;
          }
        | null
        | undefined;
      store?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
      purchase?:
        | {
            __typename?: 'Purchase';
            id: string;
            purchaseDate: string;
            unitPrice: number;
            totalPrice: number;
            quantity: number;
          }
        | null
        | undefined;
      usageRecords: Array<{
        __typename?: 'PantryItemUsage';
        id: string;
        quantityUsed: number;
        usedAt: string;
        purpose: UsagePurpose;
        notes?: string | null | undefined;
        pantryItem: { __typename?: 'PantryItem'; id: string };
        usedBy?: { __typename?: 'User'; id: string } | null | undefined;
        cookingLog?:
          | { __typename?: 'CookingLog'; id: string }
          | null
          | undefined;
        mealPlanItem?:
          | { __typename?: 'MealPlanItem'; id: string }
          | null
          | undefined;
        recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
      }>;
      storageLocation?:
        | {
            __typename: 'StorageLocation';
            id: string;
            name: string;
            type: StorageType;
          }
        | null
        | undefined;
      brand?:
        | { __typename: 'Brand'; id: string; name: string }
        | null
        | undefined;
    };
  };
};

export type UpdatePantryItemQuantityMutationVariables = Exact<{
  pantryItemId: Scalars['ID']['input'];
  quantity: Scalars['String']['input'];
  unitId?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
}>;

export type UpdatePantryItemQuantityMutation = {
  __typename?: 'Mutation';
  updatePantryItemQuantity: {
    __typename: 'PantryItem';
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    currentQuantity: number;
    unitId?: string | null | undefined;
    unitName: string;
    version?: number | null | undefined;
    updatedAt?: string | null | undefined;
    storageState: StorageState;
    expiresAt?: string | null | undefined;
    lowStockAlert: boolean;
    minQuantity?: number | null | undefined;
    lastUsedAt?: string | null | undefined;
  };
};

export type SyncPantryItemMutationVariables = Exact<{
  clientId: Scalars['ID']['input'];
  input: SyncPantryItemInput;
}>;

export type SyncPantryItemMutation = {
  __typename?: 'Mutation';
  syncPantryItem: {
    __typename?: 'SyncPantryItemResult';
    clientId: string;
    serverId?: string | null | undefined;
    operation: SyncOperation;
    wasCreated: boolean;
    item?:
      | {
          __typename: 'PantryItem';
          storageNotes?: string | null | undefined;
          normalizedUnitId?: string | null | undefined;
          packageWeight?: number | null | undefined;
          packageWeightUnitId?: string | null | undefined;
          createdAt: string;
          restockQuantity?: number | null | undefined;
          wasteAmount: number;
          wasteDate?: string | null | undefined;
          wasteReason?: WasteReason | null | undefined;
          condition: ItemCondition;
          acquisitionMethod: AcquisitionMethod;
          costPerUnit?: number | null | undefined;
          totalCost?: number | null | undefined;
          tags: Array<string>;
          initialQuantity: number;
          consumedQuantity: number;
          id: string;
          pantryId: string;
          itemId: string;
          itemName: string;
          currentQuantity: number;
          unitId?: string | null | undefined;
          unitName: string;
          version?: number | null | undefined;
          updatedAt?: string | null | undefined;
          storageState: StorageState;
          expiresAt?: string | null | undefined;
          lowStockAlert: boolean;
          minQuantity?: number | null | undefined;
          lastUsedAt?: string | null | undefined;
          item: {
            __typename: 'Item';
            id: string;
            imageUrl?: string | null | undefined;
            name: string;
            netWeight?: number | null | undefined;
            description?: string | null | undefined;
            dataSource: DataSource;
            type: ItemType;
            storageState: StorageState;
            showInOnboarding: boolean;
            shelfLifeDays?: number | null | undefined;
            popularity: number;
            status: ItemStatus;
            visibility: Visibility;
            tags: Array<string>;
            healthBenefits?: any | null | undefined;
            allergens?: any | null | undefined;
            nutritions?: any | null | undefined;
            metadata?: any | null | undefined;
            ingredients?: any | null | undefined;
            createdAt: string;
            deletedAt?: string | null | undefined;
            density?: number | null | undefined;
            preferredTrackingUnitId?: string | null | undefined;
            displayUnit?:
              | { __typename: 'Unit'; id: string; name: string; symbol: string }
              | null
              | undefined;
            preferredTrackingUnit?:
              | {
                  __typename?: 'Unit';
                  id: string;
                  name: string;
                  symbol: string;
                }
              | null
              | undefined;
            units: Array<{
              __typename?: 'ItemUnit';
              id: string;
              itemId: string;
              unitId: string;
              isDefault: boolean;
              isPreferred: boolean;
              isCommon: boolean;
              packageSize?: number | null | undefined;
              packageDescription?: string | null | undefined;
              retailUnit: boolean;
              usageContext: Array<UnitUsageContext>;
              recommendedFor: Array<UnitRecommendation>;
              minQuantity?: number | null | undefined;
              maxQuantity?: number | null | undefined;
              quantityStep?: number | null | undefined;
              averagePricePerUnit?: number | null | undefined;
              lastPriceUpdate?: string | null | undefined;
              priceSource?: string | null | undefined;
              usageCount: number;
              lastUsedAt?: string | null | undefined;
              popularityScore: number;
              source: UnitSource;
              confidence?: number | null | undefined;
              isVerified: boolean;
              verifiedAt?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              version: number;
            }>;
            brands: Array<{
              __typename?: 'ItemBrand';
              id: string;
              brand: {
                __typename?: 'Brand';
                id: string;
                name: string;
                description?: string | null | undefined;
                createdAt: string;
                updatedAt: string;
                version: number;
              };
            }>;
            categories?:
              | Array<{
                  __typename?: 'ItemCategory';
                  id: string;
                  isPrimary: boolean;
                  category: {
                    __typename: 'Category';
                    id: string;
                    name: string;
                    color?: string | null | undefined;
                    icon?: string | null | undefined;
                  };
                }>
              | null
              | undefined;
          };
          unit?:
            | {
                __typename: 'Unit';
                type: UnitType;
                isMetric: boolean;
                baseUnitId?: string | null | undefined;
                conversionFactor: number;
                isCommon: boolean;
                displayAsFraction: boolean;
                minPrecision: number;
                autoConvertThreshold?: number | null | undefined;
                id: string;
                name: string;
                symbol: string;
              }
            | null
            | undefined;
          normalizedUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          packageWeightUnit?:
            | {
                __typename: 'Unit';
                id: string;
                name: string;
                symbol: string;
                type: UnitType;
              }
            | null
            | undefined;
          store?:
            | { __typename?: 'Store'; id: string; name: string }
            | null
            | undefined;
          purchase?:
            | {
                __typename?: 'Purchase';
                id: string;
                purchaseDate: string;
                unitPrice: number;
                totalPrice: number;
                quantity: number;
              }
            | null
            | undefined;
          usageRecords: Array<{
            __typename?: 'PantryItemUsage';
            id: string;
            quantityUsed: number;
            usedAt: string;
            purpose: UsagePurpose;
            notes?: string | null | undefined;
            pantryItem: { __typename?: 'PantryItem'; id: string };
            usedBy?: { __typename?: 'User'; id: string } | null | undefined;
            cookingLog?:
              | { __typename?: 'CookingLog'; id: string }
              | null
              | undefined;
            mealPlanItem?:
              | { __typename?: 'MealPlanItem'; id: string }
              | null
              | undefined;
            recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
          }>;
          storageLocation?:
            | {
                __typename: 'StorageLocation';
                id: string;
                name: string;
                type: StorageType;
              }
            | null
            | undefined;
          brand?:
            | { __typename: 'Brand'; id: string; name: string }
            | null
            | undefined;
        }
      | null
      | undefined;
    conflict?:
      | {
          __typename?: 'SyncConflictInfo';
          clientVersion: number;
          serverVersion: number;
          message: string;
          serverItem: {
            __typename?: 'ShoppingListItem';
            id: string;
            version: number;
          };
        }
      | null
      | undefined;
  };
};

export type SyncDeletePantryItemMutationVariables = Exact<{
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
}>;

export type SyncDeletePantryItemMutation = {
  __typename?: 'Mutation';
  syncDeletePantryItem: {
    __typename?: 'SyncPantryItemResult';
    clientId: string;
    serverId?: string | null | undefined;
    operation: SyncOperation;
    wasCreated: boolean;
    item?:
      | { __typename?: 'PantryItem'; id: string; itemName: string }
      | null
      | undefined;
    conflict?:
      | {
          __typename?: 'SyncConflictInfo';
          clientVersion: number;
          serverVersion: number;
          message: string;
        }
      | null
      | undefined;
  };
};

export type PantryUpdatedSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryUpdatedSubscription = {
  __typename?: 'Subscription';
  pantryUpdated: {
    __typename?: 'PantryUpdatedPayload';
    mutation: MutationType;
    updatedFields?: Array<string> | null | undefined;
    userId: string;
    timestamp: string;
    node?:
      | {
          __typename?: 'Pantry';
          id: string;
          homeId: string;
          name: string;
          description?: string | null | undefined;
          location?: string | null | undefined;
          temperature?: string | null | undefined;
          tags: Array<string>;
          metadata?: any | null | undefined;
          version: number;
          updatedAt: string;
        }
      | null
      | undefined;
  };
};

export type PantryLowStockAlertSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryLowStockAlertSubscription = {
  __typename?: 'Subscription';
  pantryLowStockAlert: {
    __typename?: 'PantryLowStockAlertPayload';
    pantryId: string;
    currentQuantity: number;
    minimumQuantity: number;
    userId: string;
    timestamp: string;
    item: {
      __typename?: 'PantryItem';
      id: string;
      itemId: string;
      itemName: string;
      unitName: string;
      item: {
        __typename?: 'Item';
        id: string;
        name: string;
        imageUrl?: string | null | undefined;
      };
    };
  };
};

export type PantryExpiringItemsAlertSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryExpiringItemsAlertSubscription = {
  __typename?: 'Subscription';
  pantryExpiringItemsAlert: {
    __typename?: 'PantryExpiringItemsAlertPayload';
    pantryId: string;
    expiresAt: string;
    daysUntilExpiration: number;
    userId: string;
    timestamp: string;
    item: {
      __typename?: 'PantryItem';
      id: string;
      itemId: string;
      itemName: string;
      unitName: string;
      item: {
        __typename?: 'Item';
        id: string;
        name: string;
        imageUrl?: string | null | undefined;
      };
    };
  };
};

export type PantryItemsChangedSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryItemsChangedSubscription = {
  __typename?: 'Subscription';
  pantryItemsChanged: {
    __typename?: 'PantryItemChangedPayload';
    pantryId: string;
    updatedFields: Array<string>;
    mutation: MutationType;
    timestamp: string;
    userId: string;
    item: {
      __typename: 'PantryItem';
      packageWeight?: number | null | undefined;
      tags: Array<string>;
      initialQuantity: number;
      consumedQuantity: number;
      id: string;
      pantryId: string;
      itemId: string;
      itemName: string;
      currentQuantity: number;
      unitId?: string | null | undefined;
      unitName: string;
      version?: number | null | undefined;
      updatedAt?: string | null | undefined;
      storageState: StorageState;
      expiresAt?: string | null | undefined;
      lowStockAlert: boolean;
      minQuantity?: number | null | undefined;
      lastUsedAt?: string | null | undefined;
      item: {
        __typename: 'Item';
        id: string;
        imageUrl?: string | null | undefined;
        name: string;
        netWeight?: number | null | undefined;
        displayUnit?:
          | { __typename: 'Unit'; id: string; symbol: string }
          | null
          | undefined;
      };
      unit?:
        | { __typename: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      storageLocation?:
        | {
            __typename: 'StorageLocation';
            id: string;
            name: string;
            type: StorageType;
          }
        | null
        | undefined;
      brand?:
        | { __typename: 'Brand'; id: string; name: string }
        | null
        | undefined;
      packageWeightUnit?:
        | { __typename: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
    };
  };
};

export type PantryItemUsageChangedSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryItemUsageChangedSubscription = {
  __typename?: 'Subscription';
  pantryItemUsageChanged: {
    __typename?: 'PantryItemUsageChangedPayload';
    mutation: MutationType;
    pantryId: string;
    userId: string;
    timestamp: string;
    usage: {
      __typename?: 'PantryItemUsage';
      id: string;
      quantityUsed: number;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      pantryItem: { __typename?: 'PantryItem'; id: string };
      usedBy?: { __typename?: 'User'; id: string } | null | undefined;
    };
  };
};

export type PantryWasteAlertSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryWasteAlertSubscription = {
  __typename?: 'Subscription';
  pantryWasteAlert: {
    __typename?: 'PantryWasteAlertPayload';
    pantryId: string;
    wasteAmount: number;
    wasteReason: string;
    wasteValue?: number | null | undefined;
    userId: string;
    timestamp: string;
    item: {
      __typename?: 'PantryItem';
      id: string;
      itemId: string;
      itemName: string;
      pantryId: string;
      currentQuantity: number;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      item: {
        __typename?: 'Item';
        id: string;
        name: string;
        imageUrl?: string | null | undefined;
      };
    };
  };
};

export type SearchRecipesQueryVariables = Exact<{
  query: Scalars['String']['input'];
}>;

export type SearchRecipesQuery = {
  __typename?: 'Query';
  searchRecipes: {
    __typename?: 'RecipeConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'RecipeEdge';
      cursor: string;
      node: {
        __typename?: 'Recipe';
        id: string;
        name: string;
        description?: string | null | undefined;
        imageUrl?: string | null | undefined;
        servings: number;
        prepTimeMinutes?: number | null | undefined;
        cookTimeMinutes?: number | null | undefined;
        totalTimeMinutes?: number | null | undefined;
        difficulty: Difficulty;
        category: RecipeCategory;
        status: RecipeStatus;
        isExternal: boolean;
        externalSource?: ExternalSource | null | undefined;
        externalId?: string | null | undefined;
        primarySource?: string | null | undefined;
        caloriesPerServing?: number | null | undefined;
        createdAt: string;
        updatedAt: string;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type SuggestedRecipesQueryVariables = Exact<{ [key: string]: never }>;

export type SuggestedRecipesQuery = {
  __typename?: 'Query';
  recipeSuggestions: {
    __typename?: 'RecipeConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'RecipeEdge';
      cursor: string;
      node: {
        __typename?: 'Recipe';
        id: string;
        name: string;
        description?: string | null | undefined;
        imageUrl?: string | null | undefined;
        servings: number;
        prepTimeMinutes?: number | null | undefined;
        cookTimeMinutes?: number | null | undefined;
        totalTimeMinutes?: number | null | undefined;
        difficulty: Difficulty;
        category: RecipeCategory;
        status: RecipeStatus;
        isExternal: boolean;
        externalSource?: ExternalSource | null | undefined;
        externalId?: string | null | undefined;
        primarySource?: string | null | undefined;
        caloriesPerServing?: number | null | undefined;
        createdAt: string;
        updatedAt: string;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      endCursor?: string | null | undefined;
    };
  };
};

export type MyRecipesQueryVariables = Exact<{
  cursor?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  category?: InputMaybe<RecipeCategory>;
  difficulty?: InputMaybe<Difficulty>;
}>;

export type MyRecipesQuery = {
  __typename?: 'Query';
  recipes: {
    __typename?: 'RecipeConnection';
    totalCount: number;
    edges: Array<{
      __typename?: 'RecipeEdge';
      cursor: string;
      node: {
        __typename?: 'Recipe';
        cuisine?: string | null | undefined;
        id: string;
        name: string;
        description?: string | null | undefined;
        imageUrl?: string | null | undefined;
        servings: number;
        prepTimeMinutes?: number | null | undefined;
        cookTimeMinutes?: number | null | undefined;
        totalTimeMinutes?: number | null | undefined;
        difficulty: Difficulty;
        category: RecipeCategory;
        status: RecipeStatus;
        isExternal: boolean;
        externalSource?: ExternalSource | null | undefined;
        externalId?: string | null | undefined;
        primarySource?: string | null | undefined;
        caloriesPerServing?: number | null | undefined;
        createdAt: string;
        updatedAt: string;
      };
    }>;
    pageInfo: {
      __typename?: 'PageInfo';
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string | null | undefined;
      endCursor?: string | null | undefined;
    };
  };
};

export type GetRecipeQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type GetRecipeQuery = {
  __typename?: 'Query';
  recipe?:
    | {
        __typename?: 'Recipe';
        id: string;
        name: string;
        description?: string | null | undefined;
        imageUrl?: string | null | undefined;
        servings: number;
        prepTimeMinutes?: number | null | undefined;
        cookTimeMinutes?: number | null | undefined;
        totalTimeMinutes?: number | null | undefined;
        difficulty: Difficulty;
        category: RecipeCategory;
        status: RecipeStatus;
        cuisine?: string | null | undefined;
        instructions: any;
        notes?: string | null | undefined;
        tips?: string | null | undefined;
        videoUrl?: string | null | undefined;
        sourceUrl?: string | null | undefined;
        source?: string | null | undefined;
        originalAuthor?: string | null | undefined;
        isExternal: boolean;
        externalSource?: ExternalSource | null | undefined;
        externalId?: string | null | undefined;
        externalUrl?: string | null | undefined;
        externalData?: any | null | undefined;
        primarySource?: string | null | undefined;
        caloriesPerServing?: number | null | undefined;
        nutritionData?: any | null | undefined;
        tags: Array<string>;
        visibility: Visibility;
        isPublished: boolean;
        publishedAt?: string | null | undefined;
        averageRating?: number | null | undefined;
        matchPercentage?: number | null | undefined;
        createdAt: string;
        updatedAt: string;
        deletedAt?: string | null | undefined;
        createdBy: { __typename?: 'User'; id: string; email: string };
        ingredients: Array<{
          __typename?: 'RecipeIngredient';
          id: string;
          name: string;
          quantity: number;
          image?: string | null | undefined;
          isOptional: boolean;
          notes?: string | null | undefined;
          preparation?: string | null | undefined;
          sortOrder: number;
          section?: string | null | undefined;
          item?:
            | {
                __typename?: 'Item';
                id: string;
                name: string;
                imageUrl?: string | null | undefined;
              }
            | null
            | undefined;
          unit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
        }>;
      }
    | null
    | undefined;
};

export type CreateRecipeMutationVariables = Exact<{
  input: CreateRecipeInput;
}>;

export type CreateRecipeMutation = {
  __typename?: 'Mutation';
  createRecipe: {
    __typename?: 'Recipe';
    id: string;
    name: string;
    description?: string | null | undefined;
    imageUrl?: string | null | undefined;
    servings: number;
    prepTimeMinutes?: number | null | undefined;
    cookTimeMinutes?: number | null | undefined;
    totalTimeMinutes?: number | null | undefined;
    difficulty: Difficulty;
    category: RecipeCategory;
    status: RecipeStatus;
    cuisine?: string | null | undefined;
    instructions: any;
    notes?: string | null | undefined;
    tips?: string | null | undefined;
    videoUrl?: string | null | undefined;
    sourceUrl?: string | null | undefined;
    source?: string | null | undefined;
    originalAuthor?: string | null | undefined;
    isExternal: boolean;
    externalSource?: ExternalSource | null | undefined;
    externalId?: string | null | undefined;
    externalUrl?: string | null | undefined;
    externalData?: any | null | undefined;
    primarySource?: string | null | undefined;
    caloriesPerServing?: number | null | undefined;
    nutritionData?: any | null | undefined;
    tags: Array<string>;
    visibility: Visibility;
    isPublished: boolean;
    publishedAt?: string | null | undefined;
    averageRating?: number | null | undefined;
    matchPercentage?: number | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    createdBy: { __typename?: 'User'; id: string; email: string };
    ingredients: Array<{
      __typename?: 'RecipeIngredient';
      id: string;
      name: string;
      quantity: number;
      image?: string | null | undefined;
      isOptional: boolean;
      notes?: string | null | undefined;
      preparation?: string | null | undefined;
      sortOrder: number;
      section?: string | null | undefined;
      item?:
        | {
            __typename?: 'Item';
            id: string;
            name: string;
            imageUrl?: string | null | undefined;
          }
        | null
        | undefined;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
    }>;
  };
};

export type UpdateRecipeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateRecipeInput;
}>;

export type UpdateRecipeMutation = {
  __typename?: 'Mutation';
  updateRecipe: {
    __typename?: 'Recipe';
    id: string;
    name: string;
    description?: string | null | undefined;
    imageUrl?: string | null | undefined;
    servings: number;
    prepTimeMinutes?: number | null | undefined;
    cookTimeMinutes?: number | null | undefined;
    totalTimeMinutes?: number | null | undefined;
    difficulty: Difficulty;
    category: RecipeCategory;
    status: RecipeStatus;
    cuisine?: string | null | undefined;
    instructions: any;
    notes?: string | null | undefined;
    tips?: string | null | undefined;
    videoUrl?: string | null | undefined;
    sourceUrl?: string | null | undefined;
    source?: string | null | undefined;
    originalAuthor?: string | null | undefined;
    isExternal: boolean;
    externalSource?: ExternalSource | null | undefined;
    externalId?: string | null | undefined;
    externalUrl?: string | null | undefined;
    externalData?: any | null | undefined;
    primarySource?: string | null | undefined;
    caloriesPerServing?: number | null | undefined;
    nutritionData?: any | null | undefined;
    tags: Array<string>;
    visibility: Visibility;
    isPublished: boolean;
    publishedAt?: string | null | undefined;
    averageRating?: number | null | undefined;
    matchPercentage?: number | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    createdBy: { __typename?: 'User'; id: string; email: string };
    ingredients: Array<{
      __typename?: 'RecipeIngredient';
      id: string;
      name: string;
      quantity: number;
      image?: string | null | undefined;
      isOptional: boolean;
      notes?: string | null | undefined;
      preparation?: string | null | undefined;
      sortOrder: number;
      section?: string | null | undefined;
      item?:
        | {
            __typename?: 'Item';
            id: string;
            name: string;
            imageUrl?: string | null | undefined;
          }
        | null
        | undefined;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
    }>;
  };
};

export type DeleteRecipeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeleteRecipeMutation = {
  __typename?: 'Mutation';
  deleteRecipe: boolean;
};

export type FavoriteRecipeMutationVariables = Exact<{
  input: FavoriteRecipeInput;
}>;

export type FavoriteRecipeMutation = {
  __typename?: 'Mutation';
  favoriteRecipe: {
    __typename?: 'SavedRecipe';
    id: string;
    recipeId: string;
    userId: string;
    folder?: string | null | undefined;
    tags: Array<string>;
    notes?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
  };
};

export type CreateShoppingListItemsFromRecipeMutationVariables = Exact<{
  recipeId: Scalars['ID']['input'];
  shoppingListId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Int']['input']>;
}>;

export type CreateShoppingListItemsFromRecipeMutation = {
  __typename?: 'Mutation';
  createShoppingListItemsFromRecipe: {
    __typename?: 'AddRecipeToShoppingListResult';
    totalAdded: number;
    totalUpdated: number;
    totalSkipped: number;
    addedItems: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      itemName?: string | null | undefined;
      quantity?: number | null | undefined;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      storeInfo: {
        __typename?: 'ShoppingListItemStoreInfo';
        aisle?: string | null | undefined;
      };
      purchaseInfo: {
        __typename?: 'ShoppingListItemPurchaseInfo';
        isPurchased: boolean;
      };
    }>;
    updatedItems: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      itemName?: string | null | undefined;
      quantity?: number | null | undefined;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      purchaseInfo: {
        __typename?: 'ShoppingListItemPurchaseInfo';
        isPurchased: boolean;
      };
    }>;
    skippedItems: Array<{
      __typename?: 'RecipeIngredient';
      id: string;
      name: string;
      quantity: number;
    }>;
  };
};

export type CreateShoppingListItemFromRecipeIngredientMutationVariables =
  Exact<{
    recipeIngredientId: Scalars['ID']['input'];
    shoppingListId: Scalars['ID']['input'];
    quantityOverride?: InputMaybe<Scalars['Float']['input']>;
  }>;

export type CreateShoppingListItemFromRecipeIngredientMutation = {
  __typename?: 'Mutation';
  createShoppingListItemFromRecipeIngredient: {
    __typename?: 'AddIngredientResult';
    previousQuantity?: number | null | undefined;
    quantityAdded: number;
    wasUpdated: boolean;
    unitConversionApplied: boolean;
    shoppingListItem: {
      __typename?: 'ShoppingListItem';
      id: string;
      itemName?: string | null | undefined;
      quantity?: number | null | undefined;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
    };
  };
};

export type AddRecipeToShoppingListMutationVariables = Exact<{
  recipeId: Scalars['ID']['input'];
  shoppingListId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
  checkPantry?: InputMaybe<Scalars['Boolean']['input']>;
}>;

export type AddRecipeToShoppingListMutation = {
  __typename?: 'Mutation';
  addRecipeToShoppingList: {
    __typename?: 'ShoppingList';
    id: string;
    itemsConnection: {
      __typename?: 'ShoppingListItemConnection';
      edges: Array<{
        __typename?: 'ShoppingListItemEdge';
        node: {
          __typename?: 'ShoppingListItem';
          id: string;
          itemName?: string | null | undefined;
          quantity?: number | null | undefined;
          quantityInput?: string | null | undefined;
          displayFormat: DisplayFormat;
          version: number;
          updatedAt: string;
          category?: string | null | undefined;
          notes?: string | null | undefined;
          unitName?: string | null | undefined;
          purchaseInfo: {
            __typename?: 'ShoppingListItemPurchaseInfo';
            isPurchased: boolean;
          };
          unit?:
            | {
                __typename?: 'Unit';
                id: string;
                name: string;
                symbol: string;
                displayAsFraction: boolean;
                minPrecision: number;
                autoConvertThreshold?: number | null | undefined;
              }
            | null
            | undefined;
        };
      }>;
    };
  };
};

export type MarkRecipeAsCookedMutationVariables = Exact<{
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
  deductFromPantry: Scalars['Boolean']['input'];
  ingredientsUsed?: InputMaybe<
    Array<IngredientUsageInput> | IngredientUsageInput
  >;
  notes?: InputMaybe<Scalars['String']['input']>;
}>;

export type MarkRecipeAsCookedMutation = {
  __typename?: 'Mutation';
  markRecipeAsCooked: {
    __typename?: 'CookingLog';
    id: string;
    servingsMade?: number | null | undefined;
    notes?: string | null | undefined;
    cookedAt: string;
    recipe: { __typename?: 'Recipe'; id: string; name: string };
  };
};

export type RecordPantryUsageMutationVariables = Exact<{
  pantryItemId: Scalars['ID']['input'];
  quantity: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
  purpose?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
}>;

export type RecordPantryUsageMutation = {
  __typename?: 'Mutation';
  recordPantryUsage: {
    __typename?: 'PantryItemUsage';
    id: string;
    quantityUsed: number;
    usedAt: string;
    purpose: UsagePurpose;
    notes?: string | null | undefined;
    pantryItem: {
      __typename?: 'PantryItem';
      id: string;
      itemName: string;
      currentQuantity: number;
    };
  };
};

export type MyShoppingListInvitesQueryVariables = Exact<{
  [key: string]: never;
}>;

export type MyShoppingListInvitesQuery = {
  __typename?: 'Query';
  myShoppingListInvites: Array<{
    __typename?: 'ShoppingListCollaborator';
    id: string;
    token?: string | null | undefined;
    shoppingListId: string;
    collaboratorId?: string | null | undefined;
    email?: string | null | undefined;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    canEdit: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canMarkPurchased: boolean;
    canInviteOthers: boolean;
    invitedAt: string;
    expiresAt?: string | null | undefined;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      name: string;
      description?: string | null | undefined;
    };
    collaborator?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
                avatar?: string | null | undefined;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    invitedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
  }>;
};

export type InviteToShoppingListMutationVariables = Exact<{
  input: InviteToShoppingListInput;
}>;

export type InviteToShoppingListMutation = {
  __typename?: 'Mutation';
  inviteToShoppingList: {
    __typename?: 'ShoppingListCollaborator';
    id: string;
    shoppingListId: string;
    collaboratorId?: string | null | undefined;
    email?: string | null | undefined;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    canEdit: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canMarkPurchased: boolean;
    canInviteOthers: boolean;
    invitedAt: string;
    expiresAt?: string | null | undefined;
    shoppingList: { __typename?: 'ShoppingList'; id: string; name: string };
    invitedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
  };
};

export type AcceptShoppingListInviteMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;

export type AcceptShoppingListInviteMutation = {
  __typename?: 'Mutation';
  acceptShoppingListInvite: {
    __typename?: 'ShoppingListCollaborator';
    id: string;
    shoppingListId: string;
    collaboratorId?: string | null | undefined;
    email?: string | null | undefined;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    canEdit: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canMarkPurchased: boolean;
    canInviteOthers: boolean;
    invitedAt: string;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      name: string;
      description?: string | null | undefined;
    };
    collaborator?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
                avatar?: string | null | undefined;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
  };
};

export type DeclineShoppingListInviteMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;

export type DeclineShoppingListInviteMutation = {
  __typename?: 'Mutation';
  declineShoppingListInvite: boolean;
};

export type CollaborationMemberAddedSubscriptionVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
  email: Scalars['String']['input'];
}>;

export type CollaborationMemberAddedSubscription = {
  __typename?: 'Subscription';
  collaborationMemberAdded: {
    __typename?: 'ShoppingListCollaborator';
    id: string;
    shoppingListId: string;
    collaboratorId?: string | null | undefined;
    email?: string | null | undefined;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    canEdit: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canMarkPurchased: boolean;
    canInviteOthers: boolean;
    invitedAt: string;
    shoppingList: { __typename?: 'ShoppingList'; id: string; name: string };
    collaborator?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
                avatar?: string | null | undefined;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    invitedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
  };
};

export type CollaborationMemberRemovedSubscriptionVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
  email: Scalars['String']['input'];
}>;

export type CollaborationMemberRemovedSubscription = {
  __typename?: 'Subscription';
  collaborationMemberRemoved: {
    __typename?: 'ShoppingListCollaborator';
    id: string;
    email?: string | null | undefined;
    collaboratorId?: string | null | undefined;
    shoppingList: { __typename?: 'ShoppingList'; id: string; name: string };
  };
};

export type CollaborationInviteSentSubscriptionVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
  email: Scalars['String']['input'];
}>;

export type CollaborationInviteSentSubscription = {
  __typename?: 'Subscription';
  collaborationInviteSent: {
    __typename?: 'ShoppingListCollaborator';
    id: string;
    shoppingListId: string;
    email?: string | null | undefined;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    invitedAt: string;
    expiresAt?: string | null | undefined;
    shoppingList: { __typename?: 'ShoppingList'; id: string; name: string };
    invitedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
  };
};

export type GetShoppingListQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type GetShoppingListQuery = {
  __typename?: 'Query';
  shoppingList?:
    | {
        __typename?: 'ShoppingList';
        id: string;
        name: string;
        description?: string | null | undefined;
        isDefault: boolean;
        isPublic: boolean;
        shareCode?: string | null | undefined;
        tags: Array<string>;
        budgetAmount?: number | null | undefined;
        totalCost: number;
        estimatedTotal: number;
        currency?: string | null | undefined;
        category?: string | null | undefined;
        priority: number;
        status: ListStatus;
        isCompleted: boolean;
        completedAt?: string | null | undefined;
        totalItems: number;
        completedItems: number;
        createdAt: string;
        updatedAt: string;
        ownerships?:
          | Array<{
              __typename?: 'ShoppingListOwnership';
              id: string;
              userId: string;
              shoppingListId: string;
              createdAt: string;
              transferredAt?: string | null | undefined;
              transferredFrom?: string | null | undefined;
              user: {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                      avatar?: string | null | undefined;
                    }
                  | null
                  | undefined;
              };
            }>
          | null
          | undefined;
        itemsConnection: {
          __typename?: 'ShoppingListItemConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'ShoppingListItemEdge';
            cursor: string;
            node: {
              __typename?: 'ShoppingListItem';
              id: string;
              itemName?: string | null | undefined;
              quantity?: number | null | undefined;
              sortOrder: string;
              unitName?: string | null | undefined;
              category?: string | null | undefined;
              version: number;
              purchaseInfo: {
                __typename?: 'ShoppingListItemPurchaseInfo';
                isPurchased: boolean;
              };
              unit?:
                | {
                    __typename?: 'Unit';
                    id: string;
                    name: string;
                    symbol: string;
                  }
                | null
                | undefined;
              item?:
                | {
                    __typename?: 'Item';
                    id: string;
                    imageUrl?: string | null | undefined;
                    categories?:
                      | Array<{
                          __typename?: 'ItemCategory';
                          id: string;
                          isPrimary: boolean;
                          category: {
                            __typename?: 'Category';
                            id: string;
                            name: string;
                          };
                        }>
                      | null
                      | undefined;
                    units: Array<{
                      __typename?: 'ItemUnit';
                      id: string;
                      isDefault: boolean;
                      isPreferred: boolean;
                      unit?:
                        | {
                            __typename?: 'Unit';
                            id: string;
                            name: string;
                            symbol: string;
                          }
                        | null
                        | undefined;
                    }>;
                  }
                | null
                | undefined;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        collaboratorsConnection: {
          __typename?: 'ShoppingListCollaboratorConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'ShoppingListCollaboratorEdge';
            cursor: string;
            node: {
              __typename?: 'ShoppingListCollaborator';
              canEdit: boolean;
              canAddItems: boolean;
              canRemoveItems: boolean;
              canEditItems: boolean;
              canMarkPurchased: boolean;
              canInviteOthers: boolean;
              invitedAt: string;
              lastViewedAt?: string | null | undefined;
              id: string;
              email?: string | null | undefined;
              role: CollaboratorRole;
              status: CollaboratorStatus;
              collaboratorId?: string | null | undefined;
              collaborator?:
                | {
                    __typename?: 'User';
                    id: string;
                    email: string;
                    profile?:
                      | {
                          __typename?: 'UserProfile';
                          displayName?: string | null | undefined;
                          avatar?: string | null | undefined;
                        }
                      | null
                      | undefined;
                  }
                | null
                | undefined;
              invitedBy?:
                | {
                    __typename?: 'User';
                    id: string;
                    email: string;
                    profile?:
                      | {
                          __typename?: 'UserProfile';
                          displayName?: string | null | undefined;
                        }
                      | null
                      | undefined;
                  }
                | null
                | undefined;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        targetStore?:
          | {
              __typename?: 'Store';
              id: string;
              name: string;
              address?: string | null | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type GetShoppingListsQueryVariables = Exact<{
  homeId?: InputMaybe<Scalars['String']['input']>;
}>;

export type GetShoppingListsQuery = {
  __typename?: 'Query';
  shoppingLists: Array<{
    __typename?: 'ShoppingList';
    id: string;
    name: string;
    description?: string | null | undefined;
    isDefault: boolean;
    isPublic: boolean;
    tags: Array<string>;
    totalItems: number;
    completedItems: number;
    estimatedTotal: number;
    currency?: string | null | undefined;
    status: ListStatus;
    isCompleted: boolean;
    priority: number;
    createdAt: string;
    updatedAt: string;
    homeId?: string | null | undefined;
    home?: { __typename?: 'Home'; id: string; name: string } | null | undefined;
    ownerships?:
      | Array<{
          __typename?: 'ShoppingListOwnership';
          id: string;
          userId: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                  avatar?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
    itemsConnection: {
      __typename?: 'ShoppingListItemConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'ShoppingListItemEdge';
        cursor: string;
        node: {
          __typename?: 'ShoppingListItem';
          id: string;
          itemName?: string | null | undefined;
          quantity?: number | null | undefined;
          sortOrder: string;
          unitName?: string | null | undefined;
          category?: string | null | undefined;
          version: number;
          purchaseInfo: {
            __typename?: 'ShoppingListItemPurchaseInfo';
            isPurchased: boolean;
          };
          unit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          item?:
            | {
                __typename?: 'Item';
                id: string;
                imageUrl?: string | null | undefined;
                categories?:
                  | Array<{
                      __typename?: 'ItemCategory';
                      id: string;
                      isPrimary: boolean;
                      category: {
                        __typename?: 'Category';
                        id: string;
                        name: string;
                      };
                    }>
                  | null
                  | undefined;
                units: Array<{
                  __typename?: 'ItemUnit';
                  id: string;
                  isDefault: boolean;
                  isPreferred: boolean;
                  unit?:
                    | {
                        __typename?: 'Unit';
                        id: string;
                        name: string;
                        symbol: string;
                      }
                    | null
                    | undefined;
                }>;
              }
            | null
            | undefined;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  }>;
};

export type GetDefaultShoppingListQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetDefaultShoppingListQuery = {
  __typename?: 'Query';
  defaultShoppingList?:
    | {
        __typename?: 'ShoppingList';
        id: string;
        name: string;
        description?: string | null | undefined;
        isDefault: boolean;
        totalItems: number;
        completedItems: number;
        itemsConnection: {
          __typename?: 'ShoppingListItemConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'ShoppingListItemEdge';
            cursor: string;
            node: {
              __typename?: 'ShoppingListItem';
              id: string;
              itemName?: string | null | undefined;
              quantity?: number | null | undefined;
              purchaseInfo: {
                __typename?: 'ShoppingListItemPurchaseInfo';
                isPurchased: boolean;
              };
              item?:
                | {
                    __typename?: 'Item';
                    id: string;
                    name: string;
                    imageUrl?: string | null | undefined;
                  }
                | null
                | undefined;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
        ownerships?:
          | Array<{
              __typename?: 'ShoppingListOwnership';
              id: string;
              userId: string;
              shoppingListId: string;
              createdAt: string;
              transferredAt?: string | null | undefined;
              transferredFrom?: string | null | undefined;
              user: {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                      avatar?: string | null | undefined;
                    }
                  | null
                  | undefined;
              };
            }>
          | null
          | undefined;
        collaboratorsConnection: {
          __typename?: 'ShoppingListCollaboratorConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'ShoppingListCollaboratorEdge';
            cursor: string;
            node: {
              __typename?: 'ShoppingListCollaborator';
              id: string;
              email?: string | null | undefined;
              role: CollaboratorRole;
              status: CollaboratorStatus;
              collaboratorId?: string | null | undefined;
              collaborator?:
                | {
                    __typename?: 'User';
                    id: string;
                    email: string;
                    profile?:
                      | {
                          __typename?: 'UserProfile';
                          displayName?: string | null | undefined;
                          avatar?: string | null | undefined;
                        }
                      | null
                      | undefined;
                  }
                | null
                | undefined;
              invitedBy?:
                | {
                    __typename?: 'User';
                    id: string;
                    email: string;
                    profile?:
                      | {
                          __typename?: 'UserProfile';
                          displayName?: string | null | undefined;
                        }
                      | null
                      | undefined;
                  }
                | null
                | undefined;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
      }
    | null
    | undefined;
};

export type GetShoppingListItemQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type GetShoppingListItemQuery = {
  __typename?: 'Query';
  shoppingListItem?:
    | {
        __typename?: 'ShoppingListItem';
        priority: number;
        sortOrder: string;
        createdAt: string;
        deletedAt?: string | null | undefined;
        id: string;
        itemName?: string | null | undefined;
        quantity?: number | null | undefined;
        quantityInput?: string | null | undefined;
        displayFormat: DisplayFormat;
        version: number;
        updatedAt: string;
        category?: string | null | undefined;
        notes?: string | null | undefined;
        unitName?: string | null | undefined;
        shoppingList: {
          __typename?: 'ShoppingList';
          id: string;
          totalItems: number;
          completedItems: number;
          estimatedTotal: number;
        };
        item?:
          | {
              __typename?: 'Item';
              id: string;
              name: string;
              description?: string | null | undefined;
              imageUrl?: string | null | undefined;
              netWeight?: number | null | undefined;
              displayUnit?:
                | {
                    __typename?: 'Unit';
                    id: string;
                    name: string;
                    symbol: string;
                  }
                | null
                | undefined;
              categories?:
                | Array<{
                    __typename?: 'ItemCategory';
                    id: string;
                    isPrimary: boolean;
                    confidence: number;
                    source: CategorySource;
                    assignedAt?: string | null | undefined;
                    category: {
                      __typename?: 'Category';
                      id: string;
                      name: string;
                    };
                  }>
                | null
                | undefined;
            }
          | null
          | undefined;
        unit?:
          | {
              __typename?: 'Unit';
              type: UnitType;
              isMetric: boolean;
              baseUnitId?: string | null | undefined;
              conversionFactor: number;
              notes?: string | null | undefined;
              isCommon: boolean;
              sortOrder: number;
              createdAt: string;
              updatedAt: string;
              id: string;
              name: string;
              symbol: string;
              displayAsFraction: boolean;
              minPrecision: number;
              autoConvertThreshold?: number | null | undefined;
            }
          | null
          | undefined;
        priceEstimate: {
          __typename?: 'PriceEstimate';
          estimated?: number | null | undefined;
          budget?: number | null | undefined;
          lastKnown?: number | null | undefined;
          lowest?: number | null | undefined;
          highest?: number | null | undefined;
          lastUpdated?: string | null | undefined;
        };
        purchaseInfo: {
          __typename?: 'ShoppingListItemPurchaseInfo';
          isPurchased: boolean;
          purchasedQuantity?: number | null | undefined;
          purchasedPrice?: number | null | undefined;
          purchaseDate?: string | null | undefined;
          purchasedBy?:
            | {
                __typename?: 'User';
                id: string;
                email: string;
                emailVerified: boolean;
                role: UserRole;
                onBoarded: boolean;
                timezone?: string | null | undefined;
                preferredCurrency?: string | null | undefined;
                language?: string | null | undefined;
                defaultShoppingListId?: string | null | undefined;
                defaultHomeId?: string | null | undefined;
                createdAt: string;
                updatedAt: string;
                lastActiveAt?: string | null | undefined;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      id: string;
                      firstName?: string | null | undefined;
                      lastName?: string | null | undefined;
                      displayName?: string | null | undefined;
                      bio?: string | null | undefined;
                      avatar?: string | null | undefined;
                      phone?: string | null | undefined;
                    }
                  | null
                  | undefined;
                settings?:
                  | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
                  | null
                  | undefined;
              }
            | null
            | undefined;
        };
        source: {
          __typename?: 'ShoppingListItemSource';
          isAutoAdded: boolean;
          autoAddReason?: string | null | undefined;
          isFromMealPlan: boolean;
          mealPlan?:
            | { __typename?: 'MealPlan'; id: string; name: string }
            | null
            | undefined;
        };
        storeInfo: {
          __typename?: 'ShoppingListItemStoreInfo';
          aisle?: string | null | undefined;
          storeSection?: string | null | undefined;
          preferredStore?:
            | { __typename?: 'Store'; id: string; name: string }
            | null
            | undefined;
        };
        purchaseHistory: {
          __typename?: 'PurchaseHistorySummary';
          previouslyPurchased: boolean;
          lastPurchaseDate?: string | null | undefined;
          purchaseCount: number;
        };
        addedBy?:
          | {
              __typename?: 'User';
              id: string;
              email: string;
              emailVerified: boolean;
              role: UserRole;
              onBoarded: boolean;
              timezone?: string | null | undefined;
              preferredCurrency?: string | null | undefined;
              language?: string | null | undefined;
              defaultShoppingListId?: string | null | undefined;
              defaultHomeId?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              lastActiveAt?: string | null | undefined;
              profile?:
                | {
                    __typename?: 'UserProfile';
                    id: string;
                    firstName?: string | null | undefined;
                    lastName?: string | null | undefined;
                    displayName?: string | null | undefined;
                    bio?: string | null | undefined;
                    avatar?: string | null | undefined;
                    phone?: string | null | undefined;
                  }
                | null
                | undefined;
              settings?:
                | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
                | null
                | undefined;
            }
          | null
          | undefined;
        purchasesConnection: {
          __typename?: 'PurchaseConnection';
          totalCount: number;
          edges: Array<{
            __typename?: 'PurchaseEdge';
            cursor: string;
            node: {
              __typename?: 'Purchase';
              id: string;
              purchaseDate: string;
              quantity: number;
              unitPrice: number;
              totalPrice: number;
              itemName: string;
              unitSymbol: string;
            };
          }>;
          pageInfo: {
            __typename?: 'PageInfo';
            hasNextPage: boolean;
            endCursor?: string | null | undefined;
          };
        };
      }
    | null
    | undefined;
};

export type GetRecentlyDeletedShoppingListItemsQueryVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;

export type GetRecentlyDeletedShoppingListItemsQuery = {
  __typename?: 'Query';
  recentlyDeletedShoppingListItems: Array<{
    __typename?: 'ShoppingListItem';
    id: string;
    itemName?: string | null | undefined;
    createdAt: string;
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          imageUrl?: string | null | undefined;
        }
      | null
      | undefined;
  }>;
};

export type CreateShoppingListMutationVariables = Exact<{
  input: CreateShoppingListInput;
}>;

export type CreateShoppingListMutation = {
  __typename?: 'Mutation';
  createShoppingList: {
    __typename?: 'ShoppingList';
    id: string;
    name: string;
    description?: string | null | undefined;
    isDefault: boolean;
    isPublic: boolean;
    tags: Array<string>;
    totalItems: number;
    completedItems: number;
    estimatedTotal: number;
    currency?: string | null | undefined;
    status: ListStatus;
    isCompleted: boolean;
    priority: number;
    metadata?: any | null | undefined;
    createdAt: string;
    updatedAt: string;
    homeId?: string | null | undefined;
    home?: { __typename?: 'Home'; id: string; name: string } | null | undefined;
    itemsConnection: {
      __typename?: 'ShoppingListItemConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'ShoppingListItemEdge';
        cursor: string;
        node: {
          __typename?: 'ShoppingListItem';
          id: string;
          purchaseInfo: {
            __typename?: 'ShoppingListItemPurchaseInfo';
            isPurchased: boolean;
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    collaboratorsConnection: {
      __typename?: 'ShoppingListCollaboratorConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'ShoppingListCollaboratorEdge';
        cursor: string;
        node: {
          __typename?: 'ShoppingListCollaborator';
          id: string;
          email?: string | null | undefined;
          role: CollaboratorRole;
          status: CollaboratorStatus;
          collaboratorId?: string | null | undefined;
          collaborator?:
            | {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                      avatar?: string | null | undefined;
                    }
                  | null
                  | undefined;
              }
            | null
            | undefined;
          invitedBy?:
            | {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                    }
                  | null
                  | undefined;
              }
            | null
            | undefined;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    ownerships?:
      | Array<{
          __typename?: 'ShoppingListOwnership';
          id: string;
          userId: string;
          shoppingListId: string;
          createdAt: string;
          transferredAt?: string | null | undefined;
          transferredFrom?: string | null | undefined;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                  avatar?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
  };
};

export type UpdateShoppingListMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateShoppingListInput;
}>;

export type UpdateShoppingListMutation = {
  __typename?: 'Mutation';
  updateShoppingList: {
    __typename?: 'ShoppingList';
    id: string;
    name: string;
    description?: string | null | undefined;
    isDefault: boolean;
    isPublic: boolean;
    tags: Array<string>;
    totalItems: number;
    completedItems: number;
    estimatedTotal: number;
    currency?: string | null | undefined;
    status: ListStatus;
    isCompleted: boolean;
    priority: number;
    createdAt: string;
    updatedAt: string;
    itemsConnection: {
      __typename?: 'ShoppingListItemConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'ShoppingListItemEdge';
        cursor: string;
        node: {
          __typename?: 'ShoppingListItem';
          id: string;
          purchaseInfo: {
            __typename?: 'ShoppingListItemPurchaseInfo';
            isPurchased: boolean;
          };
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    collaboratorsConnection: {
      __typename?: 'ShoppingListCollaboratorConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'ShoppingListCollaboratorEdge';
        cursor: string;
        node: {
          __typename?: 'ShoppingListCollaborator';
          id: string;
          email?: string | null | undefined;
          role: CollaboratorRole;
          status: CollaboratorStatus;
          collaboratorId?: string | null | undefined;
          collaborator?:
            | {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                      avatar?: string | null | undefined;
                    }
                  | null
                  | undefined;
              }
            | null
            | undefined;
          invitedBy?:
            | {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      displayName?: string | null | undefined;
                    }
                  | null
                  | undefined;
              }
            | null
            | undefined;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
    ownerships?:
      | Array<{
          __typename?: 'ShoppingListOwnership';
          id: string;
          userId: string;
          shoppingListId: string;
          createdAt: string;
          transferredAt?: string | null | undefined;
          transferredFrom?: string | null | undefined;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  displayName?: string | null | undefined;
                  avatar?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
  };
};

export type DeleteShoppingListMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeleteShoppingListMutation = {
  __typename?: 'Mutation';
  deleteShoppingList: { __typename?: 'ShoppingList'; id: string; name: string };
};

export type SetDefaultShoppingListMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type SetDefaultShoppingListMutation = {
  __typename?: 'Mutation';
  setDefaultShoppingList: {
    __typename?: 'ShoppingList';
    id: string;
    name: string;
    isDefault: boolean;
  };
};

export type ShareShoppingListMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: ShareShoppingListInput;
}>;

export type ShareShoppingListMutation = {
  __typename?: 'Mutation';
  shareShoppingList: {
    __typename?: 'ShoppingList';
    name: string;
    id: string;
    isPublic: boolean;
    isDefault: boolean;
  };
};

export type AddCollaboratorMutationVariables = Exact<{
  data: AddCollaboratorInput;
}>;

export type AddCollaboratorMutation = {
  __typename?: 'Mutation';
  addCollaborator: {
    __typename?: 'ShoppingListCollaborator';
    id: string;
    shoppingListId: string;
    collaboratorId?: string | null | undefined;
    email?: string | null | undefined;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    canEdit: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canEditItems: boolean;
    canMarkPurchased: boolean;
    canInviteOthers: boolean;
    canViewHistory: boolean;
    canExport: boolean;
    invitedAt: string;
    statusChangedAt?: string | null | undefined;
    expiresAt?: string | null | undefined;
    lastViewedAt?: string | null | undefined;
    lastEditedAt?: string | null | undefined;
    itemsAdded: number;
    itemsPurchased: number;
    notifyOnChanges: boolean;
    notifyOnComplete: boolean;
  };
};

export type RemoveCollaboratorMutationVariables = Exact<{
  data: RemoveCollaboratorInput;
}>;

export type RemoveCollaboratorMutation = {
  __typename?: 'Mutation';
  removeCollaborator: boolean;
};

export type AddItemToShoppingListMutationVariables = Exact<{
  input: CreateShoppingListItemInput;
}>;

export type AddItemToShoppingListMutation = {
  __typename?: 'Mutation';
  addItemToShoppingList: {
    __typename?: 'ShoppingListItem';
    priority: number;
    sortOrder: string;
    createdAt: string;
    deletedAt?: string | null | undefined;
    id: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    quantityInput?: string | null | undefined;
    displayFormat: DisplayFormat;
    version: number;
    updatedAt: string;
    category?: string | null | undefined;
    notes?: string | null | undefined;
    unitName?: string | null | undefined;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
    };
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          description?: string | null | undefined;
          imageUrl?: string | null | undefined;
          netWeight?: number | null | undefined;
          displayUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                isPrimary: boolean;
                confidence: number;
                source: CategorySource;
                assignedAt?: string | null | undefined;
                category: { __typename?: 'Category'; id: string; name: string };
              }>
            | null
            | undefined;
        }
      | null
      | undefined;
    unit?:
      | {
          __typename?: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          notes?: string | null | undefined;
          isCommon: boolean;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
          id: string;
          name: string;
          symbol: string;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        }
      | null
      | undefined;
    priceEstimate: {
      __typename?: 'PriceEstimate';
      estimated?: number | null | undefined;
      budget?: number | null | undefined;
      lastKnown?: number | null | undefined;
      lowest?: number | null | undefined;
      highest?: number | null | undefined;
      lastUpdated?: string | null | undefined;
    };
    purchaseInfo: {
      __typename?: 'ShoppingListItemPurchaseInfo';
      isPurchased: boolean;
      purchasedQuantity?: number | null | undefined;
      purchasedPrice?: number | null | undefined;
      purchaseDate?: string | null | undefined;
      purchasedBy?:
        | {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          }
        | null
        | undefined;
    };
    source: {
      __typename?: 'ShoppingListItemSource';
      isAutoAdded: boolean;
      autoAddReason?: string | null | undefined;
      isFromMealPlan: boolean;
      mealPlan?:
        | { __typename?: 'MealPlan'; id: string; name: string }
        | null
        | undefined;
    };
    storeInfo: {
      __typename?: 'ShoppingListItemStoreInfo';
      aisle?: string | null | undefined;
      storeSection?: string | null | undefined;
      preferredStore?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
    };
    purchaseHistory: {
      __typename?: 'PurchaseHistorySummary';
      previouslyPurchased: boolean;
      lastPurchaseDate?: string | null | undefined;
      purchaseCount: number;
    };
    addedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchasesConnection: {
      __typename?: 'PurchaseConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PurchaseEdge';
        cursor: string;
        node: {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type UpdateShoppingListItemMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateShoppingListItemInput;
}>;

export type UpdateShoppingListItemMutation = {
  __typename?: 'Mutation';
  updateShoppingListItem: {
    __typename?: 'ShoppingListItem';
    priority: number;
    sortOrder: string;
    createdAt: string;
    deletedAt?: string | null | undefined;
    id: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    quantityInput?: string | null | undefined;
    displayFormat: DisplayFormat;
    version: number;
    updatedAt: string;
    category?: string | null | undefined;
    notes?: string | null | undefined;
    unitName?: string | null | undefined;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
    };
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          description?: string | null | undefined;
          imageUrl?: string | null | undefined;
          netWeight?: number | null | undefined;
          displayUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                isPrimary: boolean;
                confidence: number;
                source: CategorySource;
                assignedAt?: string | null | undefined;
                category: { __typename?: 'Category'; id: string; name: string };
              }>
            | null
            | undefined;
        }
      | null
      | undefined;
    unit?:
      | {
          __typename?: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          notes?: string | null | undefined;
          isCommon: boolean;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
          id: string;
          name: string;
          symbol: string;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        }
      | null
      | undefined;
    priceEstimate: {
      __typename?: 'PriceEstimate';
      estimated?: number | null | undefined;
      budget?: number | null | undefined;
      lastKnown?: number | null | undefined;
      lowest?: number | null | undefined;
      highest?: number | null | undefined;
      lastUpdated?: string | null | undefined;
    };
    purchaseInfo: {
      __typename?: 'ShoppingListItemPurchaseInfo';
      isPurchased: boolean;
      purchasedQuantity?: number | null | undefined;
      purchasedPrice?: number | null | undefined;
      purchaseDate?: string | null | undefined;
      purchasedBy?:
        | {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          }
        | null
        | undefined;
    };
    source: {
      __typename?: 'ShoppingListItemSource';
      isAutoAdded: boolean;
      autoAddReason?: string | null | undefined;
      isFromMealPlan: boolean;
      mealPlan?:
        | { __typename?: 'MealPlan'; id: string; name: string }
        | null
        | undefined;
    };
    storeInfo: {
      __typename?: 'ShoppingListItemStoreInfo';
      aisle?: string | null | undefined;
      storeSection?: string | null | undefined;
      preferredStore?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
    };
    purchaseHistory: {
      __typename?: 'PurchaseHistorySummary';
      previouslyPurchased: boolean;
      lastPurchaseDate?: string | null | undefined;
      purchaseCount: number;
    };
    addedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchasesConnection: {
      __typename?: 'PurchaseConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PurchaseEdge';
        cursor: string;
        node: {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type RemoveItemFromShoppingListMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type RemoveItemFromShoppingListMutation = {
  __typename?: 'Mutation';
  removeItemFromShoppingList: { __typename?: 'ShoppingListItem'; id: string };
};

export type MarkItemPurchasedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  status: Scalars['Boolean']['input'];
}>;

export type MarkItemPurchasedMutation = {
  __typename?: 'Mutation';
  markItemPurchased: {
    __typename?: 'ShoppingListItem';
    priority: number;
    sortOrder: string;
    createdAt: string;
    deletedAt?: string | null | undefined;
    id: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    quantityInput?: string | null | undefined;
    displayFormat: DisplayFormat;
    version: number;
    updatedAt: string;
    category?: string | null | undefined;
    notes?: string | null | undefined;
    unitName?: string | null | undefined;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
    };
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          description?: string | null | undefined;
          imageUrl?: string | null | undefined;
          netWeight?: number | null | undefined;
          displayUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                isPrimary: boolean;
                confidence: number;
                source: CategorySource;
                assignedAt?: string | null | undefined;
                category: { __typename?: 'Category'; id: string; name: string };
              }>
            | null
            | undefined;
        }
      | null
      | undefined;
    unit?:
      | {
          __typename?: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          notes?: string | null | undefined;
          isCommon: boolean;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
          id: string;
          name: string;
          symbol: string;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        }
      | null
      | undefined;
    priceEstimate: {
      __typename?: 'PriceEstimate';
      estimated?: number | null | undefined;
      budget?: number | null | undefined;
      lastKnown?: number | null | undefined;
      lowest?: number | null | undefined;
      highest?: number | null | undefined;
      lastUpdated?: string | null | undefined;
    };
    purchaseInfo: {
      __typename?: 'ShoppingListItemPurchaseInfo';
      isPurchased: boolean;
      purchasedQuantity?: number | null | undefined;
      purchasedPrice?: number | null | undefined;
      purchaseDate?: string | null | undefined;
      purchasedBy?:
        | {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          }
        | null
        | undefined;
    };
    source: {
      __typename?: 'ShoppingListItemSource';
      isAutoAdded: boolean;
      autoAddReason?: string | null | undefined;
      isFromMealPlan: boolean;
      mealPlan?:
        | { __typename?: 'MealPlan'; id: string; name: string }
        | null
        | undefined;
    };
    storeInfo: {
      __typename?: 'ShoppingListItemStoreInfo';
      aisle?: string | null | undefined;
      storeSection?: string | null | undefined;
      preferredStore?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
    };
    purchaseHistory: {
      __typename?: 'PurchaseHistorySummary';
      previouslyPurchased: boolean;
      lastPurchaseDate?: string | null | undefined;
      purchaseCount: number;
    };
    addedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchasesConnection: {
      __typename?: 'PurchaseConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PurchaseEdge';
        cursor: string;
        node: {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type MoveShoppingListItemMutationVariables = Exact<{
  input: MoveShoppingListItemInput;
}>;

export type MoveShoppingListItemMutation = {
  __typename?: 'Mutation';
  moveShoppingListItem: {
    __typename?: 'ShoppingListItem';
    priority: number;
    sortOrder: string;
    createdAt: string;
    deletedAt?: string | null | undefined;
    id: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    quantityInput?: string | null | undefined;
    displayFormat: DisplayFormat;
    version: number;
    updatedAt: string;
    category?: string | null | undefined;
    notes?: string | null | undefined;
    unitName?: string | null | undefined;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
    };
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          description?: string | null | undefined;
          imageUrl?: string | null | undefined;
          netWeight?: number | null | undefined;
          displayUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                isPrimary: boolean;
                confidence: number;
                source: CategorySource;
                assignedAt?: string | null | undefined;
                category: { __typename?: 'Category'; id: string; name: string };
              }>
            | null
            | undefined;
        }
      | null
      | undefined;
    unit?:
      | {
          __typename?: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          notes?: string | null | undefined;
          isCommon: boolean;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
          id: string;
          name: string;
          symbol: string;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        }
      | null
      | undefined;
    priceEstimate: {
      __typename?: 'PriceEstimate';
      estimated?: number | null | undefined;
      budget?: number | null | undefined;
      lastKnown?: number | null | undefined;
      lowest?: number | null | undefined;
      highest?: number | null | undefined;
      lastUpdated?: string | null | undefined;
    };
    purchaseInfo: {
      __typename?: 'ShoppingListItemPurchaseInfo';
      isPurchased: boolean;
      purchasedQuantity?: number | null | undefined;
      purchasedPrice?: number | null | undefined;
      purchaseDate?: string | null | undefined;
      purchasedBy?:
        | {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          }
        | null
        | undefined;
    };
    source: {
      __typename?: 'ShoppingListItemSource';
      isAutoAdded: boolean;
      autoAddReason?: string | null | undefined;
      isFromMealPlan: boolean;
      mealPlan?:
        | { __typename?: 'MealPlan'; id: string; name: string }
        | null
        | undefined;
    };
    storeInfo: {
      __typename?: 'ShoppingListItemStoreInfo';
      aisle?: string | null | undefined;
      storeSection?: string | null | undefined;
      preferredStore?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
    };
    purchaseHistory: {
      __typename?: 'PurchaseHistorySummary';
      previouslyPurchased: boolean;
      lastPurchaseDate?: string | null | undefined;
      purchaseCount: number;
    };
    addedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchasesConnection: {
      __typename?: 'PurchaseConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PurchaseEdge';
        cursor: string;
        node: {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type ToggleShoppingListItemPurchasedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  purchased: Scalars['Boolean']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
}>;

export type ToggleShoppingListItemPurchasedMutation = {
  __typename?: 'Mutation';
  toggleShoppingListItemPurchased: {
    __typename?: 'ShoppingListItem';
    id: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    quantityInput?: string | null | undefined;
    normalizedQuantity?: number | null | undefined;
    updatedAt: string;
    version: number;
    category?: string | null | undefined;
    unitName?: string | null | undefined;
    purchaseInfo: {
      __typename?: 'ShoppingListItemPurchaseInfo';
      isPurchased: boolean;
      purchasedQuantity?: number | null | undefined;
      purchasedPrice?: number | null | undefined;
      purchaseDate?: string | null | undefined;
    };
    unit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
  };
};

export type UpdateShoppingListItemQuantityMutationVariables = Exact<{
  itemId: Scalars['ID']['input'];
  quantity: Scalars['String']['input'];
  unitId?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
}>;

export type UpdateShoppingListItemQuantityMutation = {
  __typename?: 'Mutation';
  updateShoppingListItemQuantity: {
    __typename?: 'ShoppingListItem';
    priority: number;
    sortOrder: string;
    createdAt: string;
    deletedAt?: string | null | undefined;
    id: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    quantityInput?: string | null | undefined;
    displayFormat: DisplayFormat;
    version: number;
    updatedAt: string;
    category?: string | null | undefined;
    notes?: string | null | undefined;
    unitName?: string | null | undefined;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
    };
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          description?: string | null | undefined;
          imageUrl?: string | null | undefined;
          netWeight?: number | null | undefined;
          displayUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                isPrimary: boolean;
                confidence: number;
                source: CategorySource;
                assignedAt?: string | null | undefined;
                category: { __typename?: 'Category'; id: string; name: string };
              }>
            | null
            | undefined;
        }
      | null
      | undefined;
    unit?:
      | {
          __typename?: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          notes?: string | null | undefined;
          isCommon: boolean;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
          id: string;
          name: string;
          symbol: string;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        }
      | null
      | undefined;
    priceEstimate: {
      __typename?: 'PriceEstimate';
      estimated?: number | null | undefined;
      budget?: number | null | undefined;
      lastKnown?: number | null | undefined;
      lowest?: number | null | undefined;
      highest?: number | null | undefined;
      lastUpdated?: string | null | undefined;
    };
    purchaseInfo: {
      __typename?: 'ShoppingListItemPurchaseInfo';
      isPurchased: boolean;
      purchasedQuantity?: number | null | undefined;
      purchasedPrice?: number | null | undefined;
      purchaseDate?: string | null | undefined;
      purchasedBy?:
        | {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          }
        | null
        | undefined;
    };
    source: {
      __typename?: 'ShoppingListItemSource';
      isAutoAdded: boolean;
      autoAddReason?: string | null | undefined;
      isFromMealPlan: boolean;
      mealPlan?:
        | { __typename?: 'MealPlan'; id: string; name: string }
        | null
        | undefined;
    };
    storeInfo: {
      __typename?: 'ShoppingListItemStoreInfo';
      aisle?: string | null | undefined;
      storeSection?: string | null | undefined;
      preferredStore?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
    };
    purchaseHistory: {
      __typename?: 'PurchaseHistorySummary';
      previouslyPurchased: boolean;
      lastPurchaseDate?: string | null | undefined;
      purchaseCount: number;
    };
    addedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchasesConnection: {
      __typename?: 'PurchaseConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PurchaseEdge';
        cursor: string;
        node: {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type UpdateShoppingListItemNotesMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
}>;

export type UpdateShoppingListItemNotesMutation = {
  __typename?: 'Mutation';
  updateShoppingListItemNotes: {
    __typename?: 'ShoppingListItem';
    priority: number;
    sortOrder: string;
    createdAt: string;
    deletedAt?: string | null | undefined;
    id: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    quantityInput?: string | null | undefined;
    displayFormat: DisplayFormat;
    version: number;
    updatedAt: string;
    category?: string | null | undefined;
    notes?: string | null | undefined;
    unitName?: string | null | undefined;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
    };
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          description?: string | null | undefined;
          imageUrl?: string | null | undefined;
          netWeight?: number | null | undefined;
          displayUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                isPrimary: boolean;
                confidence: number;
                source: CategorySource;
                assignedAt?: string | null | undefined;
                category: { __typename?: 'Category'; id: string; name: string };
              }>
            | null
            | undefined;
        }
      | null
      | undefined;
    unit?:
      | {
          __typename?: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          notes?: string | null | undefined;
          isCommon: boolean;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
          id: string;
          name: string;
          symbol: string;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        }
      | null
      | undefined;
    priceEstimate: {
      __typename?: 'PriceEstimate';
      estimated?: number | null | undefined;
      budget?: number | null | undefined;
      lastKnown?: number | null | undefined;
      lowest?: number | null | undefined;
      highest?: number | null | undefined;
      lastUpdated?: string | null | undefined;
    };
    purchaseInfo: {
      __typename?: 'ShoppingListItemPurchaseInfo';
      isPurchased: boolean;
      purchasedQuantity?: number | null | undefined;
      purchasedPrice?: number | null | undefined;
      purchaseDate?: string | null | undefined;
      purchasedBy?:
        | {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          }
        | null
        | undefined;
    };
    source: {
      __typename?: 'ShoppingListItemSource';
      isAutoAdded: boolean;
      autoAddReason?: string | null | undefined;
      isFromMealPlan: boolean;
      mealPlan?:
        | { __typename?: 'MealPlan'; id: string; name: string }
        | null
        | undefined;
    };
    storeInfo: {
      __typename?: 'ShoppingListItemStoreInfo';
      aisle?: string | null | undefined;
      storeSection?: string | null | undefined;
      preferredStore?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
    };
    purchaseHistory: {
      __typename?: 'PurchaseHistorySummary';
      previouslyPurchased: boolean;
      lastPurchaseDate?: string | null | undefined;
      purchaseCount: number;
    };
    addedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchasesConnection: {
      __typename?: 'PurchaseConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PurchaseEdge';
        cursor: string;
        node: {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type UpdateShoppingListItemPriorityMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  priority: Scalars['Int']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
}>;

export type UpdateShoppingListItemPriorityMutation = {
  __typename?: 'Mutation';
  updateShoppingListItemPriority: {
    __typename?: 'ShoppingListItem';
    priority: number;
    sortOrder: string;
    createdAt: string;
    deletedAt?: string | null | undefined;
    id: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    quantityInput?: string | null | undefined;
    displayFormat: DisplayFormat;
    version: number;
    updatedAt: string;
    category?: string | null | undefined;
    notes?: string | null | undefined;
    unitName?: string | null | undefined;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
    };
    item?:
      | {
          __typename?: 'Item';
          id: string;
          name: string;
          description?: string | null | undefined;
          imageUrl?: string | null | undefined;
          netWeight?: number | null | undefined;
          displayUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                isPrimary: boolean;
                confidence: number;
                source: CategorySource;
                assignedAt?: string | null | undefined;
                category: { __typename?: 'Category'; id: string; name: string };
              }>
            | null
            | undefined;
        }
      | null
      | undefined;
    unit?:
      | {
          __typename?: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          notes?: string | null | undefined;
          isCommon: boolean;
          sortOrder: number;
          createdAt: string;
          updatedAt: string;
          id: string;
          name: string;
          symbol: string;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
        }
      | null
      | undefined;
    priceEstimate: {
      __typename?: 'PriceEstimate';
      estimated?: number | null | undefined;
      budget?: number | null | undefined;
      lastKnown?: number | null | undefined;
      lowest?: number | null | undefined;
      highest?: number | null | undefined;
      lastUpdated?: string | null | undefined;
    };
    purchaseInfo: {
      __typename?: 'ShoppingListItemPurchaseInfo';
      isPurchased: boolean;
      purchasedQuantity?: number | null | undefined;
      purchasedPrice?: number | null | undefined;
      purchaseDate?: string | null | undefined;
      purchasedBy?:
        | {
            __typename?: 'User';
            id: string;
            email: string;
            emailVerified: boolean;
            role: UserRole;
            onBoarded: boolean;
            timezone?: string | null | undefined;
            preferredCurrency?: string | null | undefined;
            language?: string | null | undefined;
            defaultShoppingListId?: string | null | undefined;
            defaultHomeId?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            lastActiveAt?: string | null | undefined;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  firstName?: string | null | undefined;
                  lastName?: string | null | undefined;
                  displayName?: string | null | undefined;
                  bio?: string | null | undefined;
                  avatar?: string | null | undefined;
                  phone?: string | null | undefined;
                }
              | null
              | undefined;
            settings?:
              | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
              | null
              | undefined;
          }
        | null
        | undefined;
    };
    source: {
      __typename?: 'ShoppingListItemSource';
      isAutoAdded: boolean;
      autoAddReason?: string | null | undefined;
      isFromMealPlan: boolean;
      mealPlan?:
        | { __typename?: 'MealPlan'; id: string; name: string }
        | null
        | undefined;
    };
    storeInfo: {
      __typename?: 'ShoppingListItemStoreInfo';
      aisle?: string | null | undefined;
      storeSection?: string | null | undefined;
      preferredStore?:
        | { __typename?: 'Store'; id: string; name: string }
        | null
        | undefined;
    };
    purchaseHistory: {
      __typename?: 'PurchaseHistorySummary';
      previouslyPurchased: boolean;
      lastPurchaseDate?: string | null | undefined;
      purchaseCount: number;
    };
    addedBy?:
      | {
          __typename?: 'User';
          id: string;
          email: string;
          emailVerified: boolean;
          role: UserRole;
          onBoarded: boolean;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
          defaultShoppingListId?: string | null | undefined;
          defaultHomeId?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          lastActiveAt?: string | null | undefined;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                firstName?: string | null | undefined;
                lastName?: string | null | undefined;
                displayName?: string | null | undefined;
                bio?: string | null | undefined;
                avatar?: string | null | undefined;
                phone?: string | null | undefined;
              }
            | null
            | undefined;
          settings?:
            | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchasesConnection: {
      __typename?: 'PurchaseConnection';
      totalCount: number;
      edges: Array<{
        __typename?: 'PurchaseEdge';
        cursor: string;
        node: {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
        };
      }>;
      pageInfo: {
        __typename?: 'PageInfo';
        hasNextPage: boolean;
        endCursor?: string | null | undefined;
      };
    };
  };
};

export type UpdateCollaboratorRoleMutationVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
  collaboratorId: Scalars['ID']['input'];
  role: CollaboratorRole;
}>;

export type UpdateCollaboratorRoleMutation = {
  __typename?: 'Mutation';
  updateCollaboratorRole: boolean;
};

export type MoveShoppingItemToPantryMutationVariables = Exact<{
  input: MoveShoppingItemToPantryInput;
}>;

export type MoveShoppingItemToPantryMutation = {
  __typename?: 'Mutation';
  moveShoppingItemToPantry: {
    __typename: 'PantryItem';
    storageNotes?: string | null | undefined;
    normalizedUnitId?: string | null | undefined;
    packageWeight?: number | null | undefined;
    packageWeightUnitId?: string | null | undefined;
    createdAt: string;
    restockQuantity?: number | null | undefined;
    wasteAmount: number;
    wasteDate?: string | null | undefined;
    wasteReason?: WasteReason | null | undefined;
    condition: ItemCondition;
    acquisitionMethod: AcquisitionMethod;
    costPerUnit?: number | null | undefined;
    totalCost?: number | null | undefined;
    tags: Array<string>;
    initialQuantity: number;
    consumedQuantity: number;
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    currentQuantity: number;
    unitId?: string | null | undefined;
    unitName: string;
    version?: number | null | undefined;
    updatedAt?: string | null | undefined;
    storageState: StorageState;
    expiresAt?: string | null | undefined;
    lowStockAlert: boolean;
    minQuantity?: number | null | undefined;
    lastUsedAt?: string | null | undefined;
    item: {
      __typename: 'Item';
      id: string;
      imageUrl?: string | null | undefined;
      name: string;
      netWeight?: number | null | undefined;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      deletedAt?: string | null | undefined;
      density?: number | null | undefined;
      preferredTrackingUnitId?: string | null | undefined;
      displayUnit?:
        | { __typename: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      preferredTrackingUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault: boolean;
        isPreferred: boolean;
        isCommon: boolean;
        packageSize?: number | null | undefined;
        packageDescription?: string | null | undefined;
        retailUnit: boolean;
        usageContext: Array<UnitUsageContext>;
        recommendedFor: Array<UnitRecommendation>;
        minQuantity?: number | null | undefined;
        maxQuantity?: number | null | undefined;
        quantityStep?: number | null | undefined;
        averagePricePerUnit?: number | null | undefined;
        lastPriceUpdate?: string | null | undefined;
        priceSource?: string | null | undefined;
        usageCount: number;
        lastUsedAt?: string | null | undefined;
        popularityScore: number;
        source: UnitSource;
        confidence?: number | null | undefined;
        isVerified: boolean;
        verifiedAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        version: number;
      }>;
      brands: Array<{
        __typename?: 'ItemBrand';
        id: string;
        brand: {
          __typename?: 'Brand';
          id: string;
          name: string;
          description?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          version: number;
        };
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            isPrimary: boolean;
            category: {
              __typename: 'Category';
              id: string;
              name: string;
              color?: string | null | undefined;
              icon?: string | null | undefined;
            };
          }>
        | null
        | undefined;
    };
    unit?:
      | {
          __typename: 'Unit';
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
          displayAsFraction: boolean;
          minPrecision: number;
          autoConvertThreshold?: number | null | undefined;
          id: string;
          name: string;
          symbol: string;
        }
      | null
      | undefined;
    normalizedUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    packageWeightUnit?:
      | {
          __typename: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
        }
      | null
      | undefined;
    store?:
      | { __typename?: 'Store'; id: string; name: string }
      | null
      | undefined;
    purchase?:
      | {
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          unitPrice: number;
          totalPrice: number;
          quantity: number;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      quantityUsed: number;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      pantryItem: { __typename?: 'PantryItem'; id: string };
      usedBy?: { __typename?: 'User'; id: string } | null | undefined;
      cookingLog?: { __typename?: 'CookingLog'; id: string } | null | undefined;
      mealPlanItem?:
        | { __typename?: 'MealPlanItem'; id: string }
        | null
        | undefined;
      recipe?: { __typename?: 'Recipe'; id: string } | null | undefined;
    }>;
    storageLocation?:
      | {
          __typename: 'StorageLocation';
          id: string;
          name: string;
          type: StorageType;
        }
      | null
      | undefined;
    brand?:
      | { __typename: 'Brand'; id: string; name: string }
      | null
      | undefined;
  };
};

export type SyncShoppingListItemMutationVariables = Exact<{
  clientId: Scalars['ID']['input'];
  input: SyncShoppingListItemInput;
}>;

export type SyncShoppingListItemMutation = {
  __typename?: 'Mutation';
  syncShoppingListItem: {
    __typename?: 'SyncShoppingListItemResult';
    clientId: string;
    serverId?: string | null | undefined;
    operation: SyncOperation;
    wasCreated: boolean;
    item?:
      | {
          __typename?: 'ShoppingListItem';
          priority: number;
          sortOrder: string;
          createdAt: string;
          deletedAt?: string | null | undefined;
          id: string;
          itemName?: string | null | undefined;
          quantity?: number | null | undefined;
          quantityInput?: string | null | undefined;
          displayFormat: DisplayFormat;
          version: number;
          updatedAt: string;
          category?: string | null | undefined;
          notes?: string | null | undefined;
          unitName?: string | null | undefined;
          shoppingList: {
            __typename?: 'ShoppingList';
            id: string;
            totalItems: number;
            completedItems: number;
            estimatedTotal: number;
          };
          item?:
            | {
                __typename?: 'Item';
                id: string;
                name: string;
                description?: string | null | undefined;
                imageUrl?: string | null | undefined;
                netWeight?: number | null | undefined;
                displayUnit?:
                  | {
                      __typename?: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                    }
                  | null
                  | undefined;
                categories?:
                  | Array<{
                      __typename?: 'ItemCategory';
                      id: string;
                      isPrimary: boolean;
                      confidence: number;
                      source: CategorySource;
                      assignedAt?: string | null | undefined;
                      category: {
                        __typename?: 'Category';
                        id: string;
                        name: string;
                      };
                    }>
                  | null
                  | undefined;
              }
            | null
            | undefined;
          unit?:
            | {
                __typename?: 'Unit';
                type: UnitType;
                isMetric: boolean;
                baseUnitId?: string | null | undefined;
                conversionFactor: number;
                notes?: string | null | undefined;
                isCommon: boolean;
                sortOrder: number;
                createdAt: string;
                updatedAt: string;
                id: string;
                name: string;
                symbol: string;
                displayAsFraction: boolean;
                minPrecision: number;
                autoConvertThreshold?: number | null | undefined;
              }
            | null
            | undefined;
          priceEstimate: {
            __typename?: 'PriceEstimate';
            estimated?: number | null | undefined;
            budget?: number | null | undefined;
            lastKnown?: number | null | undefined;
            lowest?: number | null | undefined;
            highest?: number | null | undefined;
            lastUpdated?: string | null | undefined;
          };
          purchaseInfo: {
            __typename?: 'ShoppingListItemPurchaseInfo';
            isPurchased: boolean;
            purchasedQuantity?: number | null | undefined;
            purchasedPrice?: number | null | undefined;
            purchaseDate?: string | null | undefined;
            purchasedBy?:
              | {
                  __typename?: 'User';
                  id: string;
                  email: string;
                  emailVerified: boolean;
                  role: UserRole;
                  onBoarded: boolean;
                  timezone?: string | null | undefined;
                  preferredCurrency?: string | null | undefined;
                  language?: string | null | undefined;
                  defaultShoppingListId?: string | null | undefined;
                  defaultHomeId?: string | null | undefined;
                  createdAt: string;
                  updatedAt: string;
                  lastActiveAt?: string | null | undefined;
                  profile?:
                    | {
                        __typename?: 'UserProfile';
                        id: string;
                        firstName?: string | null | undefined;
                        lastName?: string | null | undefined;
                        displayName?: string | null | undefined;
                        bio?: string | null | undefined;
                        avatar?: string | null | undefined;
                        phone?: string | null | undefined;
                      }
                    | null
                    | undefined;
                  settings?:
                    | {
                        __typename?: 'UserSettings';
                        id: string;
                        theme: AppTheme;
                      }
                    | null
                    | undefined;
                }
              | null
              | undefined;
          };
          source: {
            __typename?: 'ShoppingListItemSource';
            isAutoAdded: boolean;
            autoAddReason?: string | null | undefined;
            isFromMealPlan: boolean;
            mealPlan?:
              | { __typename?: 'MealPlan'; id: string; name: string }
              | null
              | undefined;
          };
          storeInfo: {
            __typename?: 'ShoppingListItemStoreInfo';
            aisle?: string | null | undefined;
            storeSection?: string | null | undefined;
            preferredStore?:
              | { __typename?: 'Store'; id: string; name: string }
              | null
              | undefined;
          };
          purchaseHistory: {
            __typename?: 'PurchaseHistorySummary';
            previouslyPurchased: boolean;
            lastPurchaseDate?: string | null | undefined;
            purchaseCount: number;
          };
          addedBy?:
            | {
                __typename?: 'User';
                id: string;
                email: string;
                emailVerified: boolean;
                role: UserRole;
                onBoarded: boolean;
                timezone?: string | null | undefined;
                preferredCurrency?: string | null | undefined;
                language?: string | null | undefined;
                defaultShoppingListId?: string | null | undefined;
                defaultHomeId?: string | null | undefined;
                createdAt: string;
                updatedAt: string;
                lastActiveAt?: string | null | undefined;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      id: string;
                      firstName?: string | null | undefined;
                      lastName?: string | null | undefined;
                      displayName?: string | null | undefined;
                      bio?: string | null | undefined;
                      avatar?: string | null | undefined;
                      phone?: string | null | undefined;
                    }
                  | null
                  | undefined;
                settings?:
                  | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
                  | null
                  | undefined;
              }
            | null
            | undefined;
          purchasesConnection: {
            __typename?: 'PurchaseConnection';
            totalCount: number;
            edges: Array<{
              __typename?: 'PurchaseEdge';
              cursor: string;
              node: {
                __typename?: 'Purchase';
                id: string;
                purchaseDate: string;
                quantity: number;
                unitPrice: number;
                totalPrice: number;
                itemName: string;
                unitSymbol: string;
              };
            }>;
            pageInfo: {
              __typename?: 'PageInfo';
              hasNextPage: boolean;
              endCursor?: string | null | undefined;
            };
          };
        }
      | null
      | undefined;
    conflict?:
      | {
          __typename?: 'SyncConflictInfo';
          clientVersion: number;
          serverVersion: number;
          message: string;
          serverItem: {
            __typename?: 'ShoppingListItem';
            id: string;
            version: number;
            sortOrder: string;
          };
        }
      | null
      | undefined;
  };
};

export type SyncDeleteShoppingListItemMutationVariables = Exact<{
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
}>;

export type SyncDeleteShoppingListItemMutation = {
  __typename?: 'Mutation';
  syncDeleteShoppingListItem: {
    __typename?: 'SyncShoppingListItemResult';
    clientId: string;
    serverId?: string | null | undefined;
    operation: SyncOperation;
    wasCreated: boolean;
    item?:
      | {
          __typename?: 'ShoppingListItem';
          id: string;
          itemName?: string | null | undefined;
        }
      | null
      | undefined;
    conflict?:
      | {
          __typename?: 'SyncConflictInfo';
          clientVersion: number;
          serverVersion: number;
          message: string;
        }
      | null
      | undefined;
  };
};

export type SyncMoveShoppingListItemMutationVariables = Exact<{
  clientId: Scalars['ID']['input'];
  afterId?: InputMaybe<Scalars['ID']['input']>;
  beforeId?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
}>;

export type SyncMoveShoppingListItemMutation = {
  __typename?: 'Mutation';
  syncMoveShoppingListItem: {
    __typename?: 'SyncShoppingListItemResult';
    clientId: string;
    serverId?: string | null | undefined;
    operation: SyncOperation;
    wasCreated: boolean;
    item?:
      | {
          __typename?: 'ShoppingListItem';
          priority: number;
          sortOrder: string;
          createdAt: string;
          deletedAt?: string | null | undefined;
          id: string;
          itemName?: string | null | undefined;
          quantity?: number | null | undefined;
          quantityInput?: string | null | undefined;
          displayFormat: DisplayFormat;
          version: number;
          updatedAt: string;
          category?: string | null | undefined;
          notes?: string | null | undefined;
          unitName?: string | null | undefined;
          shoppingList: {
            __typename?: 'ShoppingList';
            id: string;
            totalItems: number;
            completedItems: number;
            estimatedTotal: number;
          };
          item?:
            | {
                __typename?: 'Item';
                id: string;
                name: string;
                description?: string | null | undefined;
                imageUrl?: string | null | undefined;
                netWeight?: number | null | undefined;
                displayUnit?:
                  | {
                      __typename?: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                    }
                  | null
                  | undefined;
                categories?:
                  | Array<{
                      __typename?: 'ItemCategory';
                      id: string;
                      isPrimary: boolean;
                      confidence: number;
                      source: CategorySource;
                      assignedAt?: string | null | undefined;
                      category: {
                        __typename?: 'Category';
                        id: string;
                        name: string;
                      };
                    }>
                  | null
                  | undefined;
              }
            | null
            | undefined;
          unit?:
            | {
                __typename?: 'Unit';
                type: UnitType;
                isMetric: boolean;
                baseUnitId?: string | null | undefined;
                conversionFactor: number;
                notes?: string | null | undefined;
                isCommon: boolean;
                sortOrder: number;
                createdAt: string;
                updatedAt: string;
                id: string;
                name: string;
                symbol: string;
                displayAsFraction: boolean;
                minPrecision: number;
                autoConvertThreshold?: number | null | undefined;
              }
            | null
            | undefined;
          priceEstimate: {
            __typename?: 'PriceEstimate';
            estimated?: number | null | undefined;
            budget?: number | null | undefined;
            lastKnown?: number | null | undefined;
            lowest?: number | null | undefined;
            highest?: number | null | undefined;
            lastUpdated?: string | null | undefined;
          };
          purchaseInfo: {
            __typename?: 'ShoppingListItemPurchaseInfo';
            isPurchased: boolean;
            purchasedQuantity?: number | null | undefined;
            purchasedPrice?: number | null | undefined;
            purchaseDate?: string | null | undefined;
            purchasedBy?:
              | {
                  __typename?: 'User';
                  id: string;
                  email: string;
                  emailVerified: boolean;
                  role: UserRole;
                  onBoarded: boolean;
                  timezone?: string | null | undefined;
                  preferredCurrency?: string | null | undefined;
                  language?: string | null | undefined;
                  defaultShoppingListId?: string | null | undefined;
                  defaultHomeId?: string | null | undefined;
                  createdAt: string;
                  updatedAt: string;
                  lastActiveAt?: string | null | undefined;
                  profile?:
                    | {
                        __typename?: 'UserProfile';
                        id: string;
                        firstName?: string | null | undefined;
                        lastName?: string | null | undefined;
                        displayName?: string | null | undefined;
                        bio?: string | null | undefined;
                        avatar?: string | null | undefined;
                        phone?: string | null | undefined;
                      }
                    | null
                    | undefined;
                  settings?:
                    | {
                        __typename?: 'UserSettings';
                        id: string;
                        theme: AppTheme;
                      }
                    | null
                    | undefined;
                }
              | null
              | undefined;
          };
          source: {
            __typename?: 'ShoppingListItemSource';
            isAutoAdded: boolean;
            autoAddReason?: string | null | undefined;
            isFromMealPlan: boolean;
            mealPlan?:
              | { __typename?: 'MealPlan'; id: string; name: string }
              | null
              | undefined;
          };
          storeInfo: {
            __typename?: 'ShoppingListItemStoreInfo';
            aisle?: string | null | undefined;
            storeSection?: string | null | undefined;
            preferredStore?:
              | { __typename?: 'Store'; id: string; name: string }
              | null
              | undefined;
          };
          purchaseHistory: {
            __typename?: 'PurchaseHistorySummary';
            previouslyPurchased: boolean;
            lastPurchaseDate?: string | null | undefined;
            purchaseCount: number;
          };
          addedBy?:
            | {
                __typename?: 'User';
                id: string;
                email: string;
                emailVerified: boolean;
                role: UserRole;
                onBoarded: boolean;
                timezone?: string | null | undefined;
                preferredCurrency?: string | null | undefined;
                language?: string | null | undefined;
                defaultShoppingListId?: string | null | undefined;
                defaultHomeId?: string | null | undefined;
                createdAt: string;
                updatedAt: string;
                lastActiveAt?: string | null | undefined;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      id: string;
                      firstName?: string | null | undefined;
                      lastName?: string | null | undefined;
                      displayName?: string | null | undefined;
                      bio?: string | null | undefined;
                      avatar?: string | null | undefined;
                      phone?: string | null | undefined;
                    }
                  | null
                  | undefined;
                settings?:
                  | { __typename?: 'UserSettings'; id: string; theme: AppTheme }
                  | null
                  | undefined;
              }
            | null
            | undefined;
          purchasesConnection: {
            __typename?: 'PurchaseConnection';
            totalCount: number;
            edges: Array<{
              __typename?: 'PurchaseEdge';
              cursor: string;
              node: {
                __typename?: 'Purchase';
                id: string;
                purchaseDate: string;
                quantity: number;
                unitPrice: number;
                totalPrice: number;
                itemName: string;
                unitSymbol: string;
              };
            }>;
            pageInfo: {
              __typename?: 'PageInfo';
              hasNextPage: boolean;
              endCursor?: string | null | undefined;
            };
          };
        }
      | null
      | undefined;
    conflict?:
      | {
          __typename?: 'SyncConflictInfo';
          clientVersion: number;
          serverVersion: number;
          message: string;
          serverItem: {
            __typename?: 'ShoppingListItem';
            id: string;
            version: number;
            sortOrder: string;
          };
        }
      | null
      | undefined;
  };
};

export type ShoppingListUpdatedSubscriptionVariables = Exact<{
  listId: Scalars['ID']['input'];
}>;

export type ShoppingListUpdatedSubscription = {
  __typename?: 'Subscription';
  shoppingListUpdated?:
    | {
        __typename?: 'ShoppingListUpdatedPayload';
        mutation: MutationType;
        updatedFields?: Array<string> | null | undefined;
        userId: string;
        timestamp: string;
        node?:
          | {
              __typename?: 'ShoppingList';
              id: string;
              name: string;
              totalItems: number;
              completedItems: number;
              estimatedTotal: number;
              status: ListStatus;
              isCompleted: boolean;
              completedAt?: string | null | undefined;
              budgetAmount?: number | null | undefined;
              totalCost: number;
              itemsConnection: {
                __typename?: 'ShoppingListItemConnection';
                totalCount: number;
                edges: Array<{
                  __typename?: 'ShoppingListItemEdge';
                  cursor: string;
                  node: {
                    __typename?: 'ShoppingListItem';
                    id: string;
                    itemName?: string | null | undefined;
                    quantity?: number | null | undefined;
                    purchaseInfo: {
                      __typename?: 'ShoppingListItemPurchaseInfo';
                      isPurchased: boolean;
                    };
                    priceEstimate: {
                      __typename?: 'PriceEstimate';
                      estimated?: number | null | undefined;
                    };
                  };
                }>;
                pageInfo: {
                  __typename?: 'PageInfo';
                  hasNextPage: boolean;
                  endCursor?: string | null | undefined;
                };
              };
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type MyShoppingListsUpdatedSubscriptionVariables = Exact<{
  [key: string]: never;
}>;

export type MyShoppingListsUpdatedSubscription = {
  __typename?: 'Subscription';
  myShoppingListsUpdated?:
    | {
        __typename?: 'ShoppingListUpdatedPayload';
        mutation: MutationType;
        updatedFields?: Array<string> | null | undefined;
        userId: string;
        timestamp: string;
        node?:
          | {
              __typename?: 'ShoppingList';
              id: string;
              name: string;
              totalItems: number;
              completedItems: number;
              estimatedTotal: number;
              status: ListStatus;
              isCompleted: boolean;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type ShoppingListItemsChangedSubscriptionVariables = Exact<{
  listId: Scalars['ID']['input'];
}>;

export type ShoppingListItemsChangedSubscription = {
  __typename?: 'Subscription';
  shoppingListItemsChanged?:
    | {
        __typename?: 'ShoppingListItemChangedPayload';
        mutation: MutationType;
        listId: string;
        updatedFields?: Array<string> | null | undefined;
        userId: string;
        timestamp: string;
        item?:
          | {
              __typename?: 'ShoppingListItem';
              priority: number;
              sortOrder: string;
              createdAt: string;
              deletedAt?: string | null | undefined;
              id: string;
              itemName?: string | null | undefined;
              quantity?: number | null | undefined;
              quantityInput?: string | null | undefined;
              displayFormat: DisplayFormat;
              version: number;
              updatedAt: string;
              category?: string | null | undefined;
              notes?: string | null | undefined;
              unitName?: string | null | undefined;
              shoppingList: {
                __typename?: 'ShoppingList';
                id: string;
                totalItems: number;
                completedItems: number;
                estimatedTotal: number;
              };
              item?:
                | {
                    __typename?: 'Item';
                    id: string;
                    name: string;
                    description?: string | null | undefined;
                    imageUrl?: string | null | undefined;
                    netWeight?: number | null | undefined;
                    displayUnit?:
                      | {
                          __typename?: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                        }
                      | null
                      | undefined;
                    categories?:
                      | Array<{
                          __typename?: 'ItemCategory';
                          id: string;
                          isPrimary: boolean;
                          confidence: number;
                          source: CategorySource;
                          assignedAt?: string | null | undefined;
                          category: {
                            __typename?: 'Category';
                            id: string;
                            name: string;
                          };
                        }>
                      | null
                      | undefined;
                  }
                | null
                | undefined;
              unit?:
                | {
                    __typename?: 'Unit';
                    type: UnitType;
                    isMetric: boolean;
                    baseUnitId?: string | null | undefined;
                    conversionFactor: number;
                    notes?: string | null | undefined;
                    isCommon: boolean;
                    sortOrder: number;
                    createdAt: string;
                    updatedAt: string;
                    id: string;
                    name: string;
                    symbol: string;
                    displayAsFraction: boolean;
                    minPrecision: number;
                    autoConvertThreshold?: number | null | undefined;
                  }
                | null
                | undefined;
              priceEstimate: {
                __typename?: 'PriceEstimate';
                estimated?: number | null | undefined;
                budget?: number | null | undefined;
                lastKnown?: number | null | undefined;
                lowest?: number | null | undefined;
                highest?: number | null | undefined;
                lastUpdated?: string | null | undefined;
              };
              purchaseInfo: {
                __typename?: 'ShoppingListItemPurchaseInfo';
                isPurchased: boolean;
                purchasedQuantity?: number | null | undefined;
                purchasedPrice?: number | null | undefined;
                purchaseDate?: string | null | undefined;
                purchasedBy?:
                  | {
                      __typename?: 'User';
                      id: string;
                      email: string;
                      emailVerified: boolean;
                      role: UserRole;
                      onBoarded: boolean;
                      timezone?: string | null | undefined;
                      preferredCurrency?: string | null | undefined;
                      language?: string | null | undefined;
                      defaultShoppingListId?: string | null | undefined;
                      defaultHomeId?: string | null | undefined;
                      createdAt: string;
                      updatedAt: string;
                      lastActiveAt?: string | null | undefined;
                      profile?:
                        | {
                            __typename?: 'UserProfile';
                            id: string;
                            firstName?: string | null | undefined;
                            lastName?: string | null | undefined;
                            displayName?: string | null | undefined;
                            bio?: string | null | undefined;
                            avatar?: string | null | undefined;
                            phone?: string | null | undefined;
                          }
                        | null
                        | undefined;
                      settings?:
                        | {
                            __typename?: 'UserSettings';
                            id: string;
                            theme: AppTheme;
                          }
                        | null
                        | undefined;
                    }
                  | null
                  | undefined;
              };
              source: {
                __typename?: 'ShoppingListItemSource';
                isAutoAdded: boolean;
                autoAddReason?: string | null | undefined;
                isFromMealPlan: boolean;
                mealPlan?:
                  | { __typename?: 'MealPlan'; id: string; name: string }
                  | null
                  | undefined;
              };
              storeInfo: {
                __typename?: 'ShoppingListItemStoreInfo';
                aisle?: string | null | undefined;
                storeSection?: string | null | undefined;
                preferredStore?:
                  | { __typename?: 'Store'; id: string; name: string }
                  | null
                  | undefined;
              };
              purchaseHistory: {
                __typename?: 'PurchaseHistorySummary';
                previouslyPurchased: boolean;
                lastPurchaseDate?: string | null | undefined;
                purchaseCount: number;
              };
              addedBy?:
                | {
                    __typename?: 'User';
                    id: string;
                    email: string;
                    emailVerified: boolean;
                    role: UserRole;
                    onBoarded: boolean;
                    timezone?: string | null | undefined;
                    preferredCurrency?: string | null | undefined;
                    language?: string | null | undefined;
                    defaultShoppingListId?: string | null | undefined;
                    defaultHomeId?: string | null | undefined;
                    createdAt: string;
                    updatedAt: string;
                    lastActiveAt?: string | null | undefined;
                    profile?:
                      | {
                          __typename?: 'UserProfile';
                          id: string;
                          firstName?: string | null | undefined;
                          lastName?: string | null | undefined;
                          displayName?: string | null | undefined;
                          bio?: string | null | undefined;
                          avatar?: string | null | undefined;
                          phone?: string | null | undefined;
                        }
                      | null
                      | undefined;
                    settings?:
                      | {
                          __typename?: 'UserSettings';
                          id: string;
                          theme: AppTheme;
                        }
                      | null
                      | undefined;
                  }
                | null
                | undefined;
              purchasesConnection: {
                __typename?: 'PurchaseConnection';
                totalCount: number;
                edges: Array<{
                  __typename?: 'PurchaseEdge';
                  cursor: string;
                  node: {
                    __typename?: 'Purchase';
                    id: string;
                    purchaseDate: string;
                    quantity: number;
                    unitPrice: number;
                    totalPrice: number;
                    itemName: string;
                    unitSymbol: string;
                  };
                }>;
                pageInfo: {
                  __typename?: 'PageInfo';
                  hasNextPage: boolean;
                  endCursor?: string | null | undefined;
                };
              };
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type ShoppingListCollaboratorsChangedSubscriptionVariables = Exact<{
  listId: Scalars['ID']['input'];
}>;

export type ShoppingListCollaboratorsChangedSubscription = {
  __typename?: 'Subscription';
  shoppingListCollaboratorsChanged?:
    | {
        __typename?: 'ShoppingListCollaboratorChangedPayload';
        mutation: MutationType;
        listId: string;
        userId: string;
        timestamp: string;
        collaborator?:
          | {
              __typename?: 'ShoppingListCollaborator';
              id: string;
              token?: string | null | undefined;
              collaboratorId?: string | null | undefined;
              email?: string | null | undefined;
              role: CollaboratorRole;
              status: CollaboratorStatus;
              canEdit: boolean;
              canAddItems: boolean;
              canRemoveItems: boolean;
              canMarkPurchased: boolean;
              invitedAt: string;
              collaborator?:
                | {
                    __typename?: 'User';
                    id: string;
                    email: string;
                    profile?:
                      | {
                          __typename?: 'UserProfile';
                          displayName?: string | null | undefined;
                          avatar?: string | null | undefined;
                        }
                      | null
                      | undefined;
                  }
                | null
                | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type ShoppingListStatusChangedSubscriptionVariables = Exact<{
  listId: Scalars['ID']['input'];
}>;

export type ShoppingListStatusChangedSubscription = {
  __typename?: 'Subscription';
  shoppingListStatusChanged?:
    | {
        __typename?: 'ShoppingListStatusChangedPayload';
        mutation: MutationType;
        listId: string;
        newStatus: ListStatus;
        previousStatus?: ListStatus | null | undefined;
        userId: string;
        timestamp: string;
        completedBy?:
          | {
              __typename?: 'User';
              id: string;
              email: string;
              profile?:
                | {
                    __typename?: 'UserProfile';
                    displayName?: string | null | undefined;
                    avatar?: string | null | undefined;
                  }
                | null
                | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type GetStorageLocationsQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type GetStorageLocationsQuery = {
  __typename?: 'Query';
  storageLocations: Array<{
    __typename?: 'StorageLocation';
    id: string;
    name: string;
    type: StorageType;
    icon?: string | null | undefined;
    color?: string | null | undefined;
    temperature?: StorageState | null | undefined;
    sortOrder: number;
    isDefault: boolean;
    currentItemCount: number;
    parentLocation?:
      | { __typename?: 'StorageLocation'; id: string; name: string }
      | null
      | undefined;
  }>;
};

export type GetStorageLocationTreeQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type GetStorageLocationTreeQuery = {
  __typename?: 'Query';
  storageLocationTree: Array<{
    __typename?: 'StorageLocation';
    id: string;
    name: string;
    type: StorageType;
    icon?: string | null | undefined;
    color?: string | null | undefined;
    sortOrder: number;
    currentItemCount: number;
    isDefault: boolean;
    childLocations: Array<{
      __typename?: 'StorageLocation';
      id: string;
      name: string;
      type: StorageType;
      icon?: string | null | undefined;
      color?: string | null | undefined;
      sortOrder: number;
      currentItemCount: number;
      childLocations: Array<{
        __typename?: 'StorageLocation';
        id: string;
        name: string;
        type: StorageType;
        currentItemCount: number;
      }>;
    }>;
  }>;
};

export type GetStorageLocationQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type GetStorageLocationQuery = {
  __typename?: 'Query';
  storageLocation?:
    | {
        __typename?: 'StorageLocation';
        id: string;
        name: string;
        type: StorageType;
        icon?: string | null | undefined;
        color?: string | null | undefined;
        temperature?: StorageState | null | undefined;
        isClimateControlled: boolean;
        sortOrder: number;
        isDefault: boolean;
        currentItemCount: number;
        parentLocation?:
          | { __typename?: 'StorageLocation'; id: string; name: string }
          | null
          | undefined;
        childLocations: Array<{
          __typename?: 'StorageLocation';
          id: string;
          name: string;
          type: StorageType;
        }>;
      }
    | null
    | undefined;
};

export type CreateStorageLocationMutationVariables = Exact<{
  input: CreateStorageLocationInput;
}>;

export type CreateStorageLocationMutation = {
  __typename?: 'Mutation';
  createStorageLocation: {
    __typename?: 'StorageLocation';
    id: string;
    name: string;
    type: StorageType;
    icon?: string | null | undefined;
    color?: string | null | undefined;
    temperature?: StorageState | null | undefined;
    sortOrder: number;
    isDefault: boolean;
    currentItemCount: number;
    homeId: string;
    parentLocation?:
      | { __typename?: 'StorageLocation'; id: string; name: string }
      | null
      | undefined;
  };
};

export type UpdateStorageLocationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdateStorageLocationInput;
}>;

export type UpdateStorageLocationMutation = {
  __typename?: 'Mutation';
  updateStorageLocation: {
    __typename?: 'StorageLocation';
    id: string;
    name: string;
    type: StorageType;
    icon?: string | null | undefined;
    color?: string | null | undefined;
    sortOrder: number;
    parentLocationId?: string | null | undefined;
  };
};

export type DeleteStorageLocationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeleteStorageLocationMutation = {
  __typename?: 'Mutation';
  deleteStorageLocation: boolean;
};

export type SetDefaultStorageLocationMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type SetDefaultStorageLocationMutation = {
  __typename?: 'Mutation';
  setDefaultStorageLocation: {
    __typename?: 'StorageLocation';
    id: string;
    name: string;
    isDefault: boolean;
  };
};

export type GetNotificationPreferencesQueryVariables = Exact<{
  [key: string]: never;
}>;

export type GetNotificationPreferencesQuery = {
  __typename?: 'Query';
  myNotificationPreferences?:
    | {
        __typename?: 'NotificationPreferences';
        id: string;
        userId: string;
        emailEnabled: boolean;
        pushEnabled: boolean;
        smsEnabled: boolean;
        expirationNotifications: boolean;
        expirationNotificationFrequency: ExpirationFrequency;
        expirationDaysThreshold: number;
        lowStockAlerts: boolean;
        shoppingListUpdates: boolean;
        pantryChanges: boolean;
        recipeRecommendations: boolean;
        mealPlanReminders: boolean;
        cookingReminders: boolean;
        collaborationInvites: boolean;
        homeInvites: boolean;
        sharedListUpdates: boolean;
        weeklyDigest: boolean;
        monthlyReport: boolean;
        quietHoursEnabled: boolean;
        quietHoursStart?: string | null | undefined;
        quietHoursEnd?: string | null | undefined;
        quietHoursTimezone?: string | null | undefined;
      }
    | null
    | undefined;
};

export type GetDietaryProfileQueryVariables = Exact<{ [key: string]: never }>;

export type GetDietaryProfileQuery = {
  __typename?: 'Query';
  myDietaryProfile?:
    | {
        __typename?: 'DietaryProfile';
        id: string;
        userId: string;
        preferredCuisines: Array<string>;
        dislikedIngredients: Array<string>;
        favoriteIngredients: Array<string>;
        calorieTarget?: number | null | undefined;
        proteinTarget?: number | null | undefined;
        carbsTarget?: number | null | undefined;
        fatTarget?: number | null | undefined;
        mealsPerDay: number;
        snacksPerDay: number;
        cookingSkillLevel?: string | null | undefined;
        maxPrepTimeMinutes?: number | null | undefined;
        maxCookTimeMinutes?: number | null | undefined;
        budgetPerMeal?: number | null | undefined;
        createdAt: string;
        updatedAt: string;
        restrictions: Array<{
          __typename?: 'DietaryRestriction';
          id: string;
          diet?: Diet | null | undefined;
          intolerance?: Intolerance | null | undefined;
          healthGoal?: HealthGoal | null | undefined;
          severity: RestrictionSeverity;
          notes?: string | null | undefined;
          appliesToHomeId?: string | null | undefined;
          createdAt: string;
        }>;
      }
    | null
    | undefined;
};

export type UpdateNotificationPreferencesMutationVariables = Exact<{
  input: UpdateNotificationPreferencesInput;
}>;

export type UpdateNotificationPreferencesMutation = {
  __typename?: 'Mutation';
  updateNotificationPreferences: {
    __typename?: 'NotificationPreferences';
    id: string;
    userId: string;
    emailEnabled: boolean;
    pushEnabled: boolean;
    smsEnabled: boolean;
    expirationNotifications: boolean;
    expirationNotificationFrequency: ExpirationFrequency;
    expirationDaysThreshold: number;
    lowStockAlerts: boolean;
    shoppingListUpdates: boolean;
    pantryChanges: boolean;
    recipeRecommendations: boolean;
    mealPlanReminders: boolean;
    cookingReminders: boolean;
    collaborationInvites: boolean;
    homeInvites: boolean;
    sharedListUpdates: boolean;
    weeklyDigest: boolean;
    monthlyReport: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart?: string | null | undefined;
    quietHoursEnd?: string | null | undefined;
    quietHoursTimezone?: string | null | undefined;
  };
};

export type UpdateDietaryProfileMutationVariables = Exact<{
  input: UpdateDietaryProfileInput;
}>;

export type UpdateDietaryProfileMutation = {
  __typename?: 'Mutation';
  updateDietaryProfile: {
    __typename?: 'DietaryProfile';
    id: string;
    userId: string;
    preferredCuisines: Array<string>;
    dislikedIngredients: Array<string>;
    favoriteIngredients: Array<string>;
    calorieTarget?: number | null | undefined;
    proteinTarget?: number | null | undefined;
    carbsTarget?: number | null | undefined;
    fatTarget?: number | null | undefined;
    mealsPerDay: number;
    snacksPerDay: number;
    cookingSkillLevel?: string | null | undefined;
    maxPrepTimeMinutes?: number | null | undefined;
    maxCookTimeMinutes?: number | null | undefined;
    budgetPerMeal?: number | null | undefined;
    createdAt: string;
    updatedAt: string;
    restrictions: Array<{
      __typename?: 'DietaryRestriction';
      id: string;
      diet?: Diet | null | undefined;
      intolerance?: Intolerance | null | undefined;
      healthGoal?: HealthGoal | null | undefined;
      severity: RestrictionSeverity;
      notes?: string | null | undefined;
      appliesToHomeId?: string | null | undefined;
      createdAt: string;
    }>;
  };
};

export type AddDietaryRestrictionMutationVariables = Exact<{
  input: AddRestrictionInput;
}>;

export type AddDietaryRestrictionMutation = {
  __typename?: 'Mutation';
  addRestriction: {
    __typename?: 'DietaryRestriction';
    id: string;
    diet?: Diet | null | undefined;
    intolerance?: Intolerance | null | undefined;
    healthGoal?: HealthGoal | null | undefined;
    severity: RestrictionSeverity;
    notes?: string | null | undefined;
    appliesToHomeId?: string | null | undefined;
    createdAt: string;
  };
};

export type UpdateDietaryRestrictionMutationVariables = Exact<{
  input: UpdateRestrictionInput;
}>;

export type UpdateDietaryRestrictionMutation = {
  __typename?: 'Mutation';
  updateRestriction: {
    __typename?: 'DietaryRestriction';
    id: string;
    diet?: Diet | null | undefined;
    intolerance?: Intolerance | null | undefined;
    healthGoal?: HealthGoal | null | undefined;
    severity: RestrictionSeverity;
    notes?: string | null | undefined;
    appliesToHomeId?: string | null | undefined;
    createdAt: string;
  };
};

export type RemoveDietaryRestrictionMutationVariables = Exact<{
  input: RemoveRestrictionInput;
}>;

export type RemoveDietaryRestrictionMutation = {
  __typename?: 'Mutation';
  removeRestriction: boolean;
};
