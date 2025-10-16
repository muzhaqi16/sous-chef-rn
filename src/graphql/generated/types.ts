// Shared GraphQL types - no hooks
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | undefined;
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

export enum AcquisitionMethod {
  BulkSplit = 'BULK_SPLIT',
  Found = 'FOUND',
  Gifted = 'GIFTED',
  Homegrown = 'HOMEGROWN',
  Leftover = 'LEFTOVER',
  Purchased = 'PURCHASED',
  Transferred = 'TRANSFERRED',
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

export type AddPantryItemInput = {
  acquisitionMethod?: InputMaybe<AcquisitionMethod>;
  autoReorderPoint?: InputMaybe<Scalars['Float']['input']>;
  batchNumber?: InputMaybe<Scalars['String']['input']>;
  bestByDate?: InputMaybe<Scalars['String']['input']>;
  condition?: InputMaybe<ItemCondition>;
  costPerUnit?: InputMaybe<Scalars['Float']['input']>;
  customCategory?: InputMaybe<Scalars['String']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  initialQuantity: Scalars['Float']['input'];
  isAutoReorder?: InputMaybe<Scalars['Boolean']['input']>;
  itemBrand?: InputMaybe<Scalars['String']['input']>;
  itemCategory?: InputMaybe<Scalars['String']['input']>;
  itemDescription?: InputMaybe<Scalars['String']['input']>;
  itemDisplayUnitId?: InputMaybe<Scalars['String']['input']>;
  itemId?: InputMaybe<Scalars['String']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  itemNetWeight?: InputMaybe<Scalars['Float']['input']>;
  itemUpc?: InputMaybe<Scalars['String']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  lotNumber?: InputMaybe<Scalars['String']['input']>;
  pantryId: Scalars['ID']['input'];
  priority?: InputMaybe<Scalars['Int']['input']>;
  purchaseId?: InputMaybe<Scalars['String']['input']>;
  storageLocation?: InputMaybe<Scalars['String']['input']>;
  storageNotes?: InputMaybe<Scalars['String']['input']>;
  storageState?: InputMaybe<StorageState>;
  storeId?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  unitSymbol?: InputMaybe<Scalars['String']['input']>;
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

export type AddRestrictionsInput = {
  reason: Scalars['String']['input'];
  restrictedUntil?: InputMaybe<Scalars['DateTime']['input']>;
  restrictions: Array<ModerationRestriction>;
  userId: Scalars['ID']['input'];
};

export type AddWarningInput = {
  reason: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type AllergenInput = {
  contains: Scalars['Boolean']['input'];
  mayContain?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  processedIn?: InputMaybe<Scalars['Boolean']['input']>;
  severity?: InputMaybe<AllergenSeverity>;
};

export enum AllergenSeverity {
  Mild = 'MILD',
  Moderate = 'MODERATE',
  Severe = 'SEVERE',
  Trace = 'TRACE',
}

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

export type Brand = {
  __typename?: 'Brand';
  children: Array<Brand>;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  itemCount: Scalars['Int']['output'];
  items?: Maybe<Array<ItemBrand>>;
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

export type Category = {
  __typename?: 'Category';
  children?: Maybe<Array<Category>>;
  color?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<User>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isSystem: Scalars['Boolean']['output'];
  itemCategories: Array<ItemCategory>;
  itemCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  parent?: Maybe<Category>;
  slug?: Maybe<Scalars['String']['output']>;
  sortOrder: Scalars['Int']['output'];
  type: CategoryType;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
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

export type CompleteShoppingListInput = {
  completedShopDate?: InputMaybe<Scalars['DateTime']['input']>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
};

export type Connection = {
  edges: Array<Edge>;
  pageInfo: PageInfo;
  totalCount: Scalars['Int']['output'];
};

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

export type CookingLog = {
  __typename?: 'CookingLog';
  actualCookTime?: Maybe<Scalars['Int']['output']>;
  actualPrepTime?: Maybe<Scalars['Int']['output']>;
  cookedAt: Scalars['DateTime']['output'];
  difficulty?: Maybe<Difficulty>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
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
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  hasDynamicIsland?: InputMaybe<Scalars['Boolean']['input']>;
  hasNotch?: InputMaybe<Scalars['Boolean']['input']>;
  hostNames?: InputMaybe<Scalars['JSON']['input']>;
  instanceId?: InputMaybe<Scalars['String']['input']>;
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
  brandId?: InputMaybe<Scalars['String']['input']>;
  brandName?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<CategoryInput>>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  defaultUnit?: InputMaybe<Scalars['String']['input']>;
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
  shelfLifeDays?: InputMaybe<Scalars['Int']['input']>;
  storageState?: InputMaybe<StorageState>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  type?: InputMaybe<ItemType>;
  units?: InputMaybe<Array<ItemUnitInput>>;
  vendor?: InputMaybe<Scalars['String']['input']>;
};

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

export type CreateMealPlanInput = {
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  endDate: Scalars['DateTime']['input'];
  name: Scalars['String']['input'];
  planType: MealPlanType;
  servings?: InputMaybe<Scalars['Int']['input']>;
  startDate: Scalars['DateTime']['input'];
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
  dietaryTags?: InputMaybe<Array<DietaryTag>>;
  difficulty?: InputMaybe<Difficulty>;
  externalSourceData?: InputMaybe<Scalars['JSON']['input']>;
  externalSourceId?: InputMaybe<Scalars['String']['input']>;
  externalSourceUrl?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  instructions: Scalars['JSON']['input'];
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
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateShoppingListItemInput = {
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
  shoppingListId: Scalars['ID']['input'];
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  storeSection?: InputMaybe<Scalars['String']['input']>;
  unitId?: InputMaybe<Scalars['String']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
};

export type CreateStoreInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  averageShelfLife?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  priceAccuracy?: InputMaybe<Scalars['Float']['input']>;
  qualityRating?: InputMaybe<Scalars['Float']['input']>;
  supportsPriceAPI?: InputMaybe<Scalars['Boolean']['input']>;
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

export type Currency = {
  __typename?: 'Currency';
  code: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  decimalPlaces: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  priceHistory: Array<ItemPriceHistory>;
  purchases: Array<Purchase>;
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

export type Device = {
  __typename?: 'Device';
  androidId?: Maybe<Scalars['String']['output']>;
  apiLevel?: Maybe<Scalars['Int']['output']>;
  appVersion?: Maybe<Scalars['String']['output']>;
  availableLocationProviders?: Maybe<Scalars['JSON']['output']>;
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
  hostNames?: Maybe<Scalars['JSON']['output']>;
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
  lastCity?: Maybe<Scalars['String']['output']>;
  lastCountry?: Maybe<Scalars['String']['output']>;
  lastIpAddress?: Maybe<Scalars['String']['output']>;
  lastLoginAt?: Maybe<Scalars['DateTime']['output']>;
  lastSeenAt: Scalars['DateTime']['output'];
  loginCount: Scalars['Int']['output'];
  manufacturer?: Maybe<Scalars['String']['output']>;
  maxMemory?: Maybe<Scalars['String']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  osName?: Maybe<Scalars['String']['output']>;
  osVersion?: Maybe<Scalars['String']['output']>;
  platform?: Maybe<MobilePlatform>;
  powerState?: Maybe<Scalars['JSON']['output']>;
  pushToken?: Maybe<Scalars['String']['output']>;
  readableVersion?: Maybe<Scalars['String']['output']>;
  screenResolution?: Maybe<Scalars['String']['output']>;
  supportedAbis?: Maybe<Scalars['JSON']['output']>;
  supportedMediaTypes?: Maybe<Scalars['JSON']['output']>;
  systemVersion?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
  totalDiskCapacity?: Maybe<Scalars['String']['output']>;
  totalMemory?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  usedMemory?: Maybe<Scalars['String']['output']>;
  user?: Maybe<User>;
  userAgent?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
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

export type DeviceLocation = {
  __typename?: 'DeviceLocation';
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  ipAddress?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
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
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  hasDynamicIsland?: InputMaybe<Scalars['Boolean']['input']>;
  hasNotch?: InputMaybe<Scalars['Boolean']['input']>;
  hostNames?: InputMaybe<Scalars['JSON']['input']>;
  instanceId?: InputMaybe<Scalars['String']['input']>;
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
  supportedAbis?: InputMaybe<Scalars['JSON']['input']>;
  supportedMediaTypes?: InputMaybe<Scalars['JSON']['input']>;
  systemVersion?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  totalDiskCapacity?: InputMaybe<Scalars['String']['input']>;
  totalMemory?: InputMaybe<Scalars['String']['input']>;
  usedMemory?: InputMaybe<Scalars['String']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
};

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

export enum DietaryTag {
  DairyFree = 'DAIRY_FREE',
  GlutenFree = 'GLUTEN_FREE',
  Halal = 'HALAL',
  Keto = 'KETO',
  Kosher = 'KOSHER',
  LowCarb = 'LOW_CARB',
  LowSodium = 'LOW_SODIUM',
  NutFree = 'NUT_FREE',
  Paleo = 'PALEO',
  SugarFree = 'SUGAR_FREE',
  Vegan = 'VEGAN',
  Vegetarian = 'VEGETARIAN',
}

export enum Difficulty {
  Easy = 'EASY',
  Expert = 'EXPERT',
  Hard = 'HARD',
  Medium = 'MEDIUM',
  VeryEasy = 'VERY_EASY',
}

export type Edge = {
  cursor: Scalars['String']['output'];
  node: Node;
};

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

export type ForgotPasswordResponse = {
  __typename?: 'ForgotPasswordResponse';
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

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

export type Home = {
  __typename?: 'Home';
  allowJoinCode: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  invites?: Maybe<Array<HomeInvite>>;
  isPublic: Scalars['Boolean']['output'];
  joinCode?: Maybe<Scalars['String']['output']>;
  maxMembers?: Maybe<Scalars['Int']['output']>;
  members: Array<Membership>;
  membershipStats: MembershipStats;
  metadata?: Maybe<Scalars['JSON']['output']>;
  myMembership?: Maybe<Membership>;
  name: Scalars['String']['output'];
  pantries?: Maybe<Array<Pantry>>;
  tags: Array<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
  type: HomeType;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type HomeInvite = {
  __typename?: 'HomeInvite';
  acceptedAt?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  customPermissions?: Maybe<Scalars['JSON']['output']>;
  declinedAt?: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  expiresAt: Scalars['String']['output'];
  home: Home;
  homeId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  invitedUser?: Maybe<User>;
  invitedUserId?: Maybe<Scalars['String']['output']>;
  inviter: User;
  lastReminderAt?: Maybe<Scalars['String']['output']>;
  logs: Array<InviteLog>;
  message?: Maybe<Scalars['String']['output']>;
  recipientName?: Maybe<Scalars['String']['output']>;
  reminderCount: Scalars['Int']['output'];
  revokedAt?: Maybe<Scalars['String']['output']>;
  role: MembershipRole;
  sentAt: Scalars['String']['output'];
  status: InviteStatus;
  token: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type HomeInviteLogsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type HomeInviteStatsGroup = {
  __typename?: 'HomeInviteStatsGroup';
  _count: InviteActionCount;
  action: InviteAction;
};

export type HomeMember = {
  __typename?: 'HomeMember';
  homeId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  joinedAt: Scalars['DateTime']['output'];
  role?: Maybe<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
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

export type IngredientInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isGMO?: InputMaybe<Scalars['Boolean']['input']>;
  isOrganic?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Int']['input']>;
  percentage?: InputMaybe<Scalars['Float']['input']>;
  subIngredients?: InputMaybe<Array<IngredientInput>>;
};

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
  ipAddress?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  newStatus?: Maybe<InviteStatus>;
  oldStatus?: Maybe<InviteStatus>;
  userAgent?: Maybe<Scalars['String']['output']>;
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

export type Item = {
  __typename?: 'Item';
  allergens?: Maybe<Scalars['JSON']['output']>;
  brands: Array<ItemBrand>;
  categories?: Maybe<Array<ItemCategory>>;
  convertedNetWeight?: Maybe<ConvertedValue>;
  createdAt: Scalars['DateTime']['output'];
  creations: Array<ItemCreation>;
  dataSource: DataSource;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  displayUnit?: Maybe<Unit>;
  edits: Array<ItemEdit>;
  externalSources: Array<ExternalSourceMapping>;
  healthBenefits?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  images?: Maybe<Scalars['JSON']['output']>;
  ingredients?: Maybe<Scalars['JSON']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  netWeight?: Maybe<Scalars['Float']['output']>;
  nutritions?: Maybe<Scalars['JSON']['output']>;
  pantryItems: Array<PantryItem>;
  popularity: Scalars['Int']['output'];
  priceHistory: Array<ItemPriceHistory>;
  purchases: Array<Purchase>;
  recipeIngredients: Array<RecipeIngredient>;
  shelfLifeDays?: Maybe<Scalars['Int']['output']>;
  shoppingListItems: Array<ShoppingListItem>;
  showInOnboarding: Scalars['Boolean']['output'];
  status: ItemStatus;
  storageState: StorageState;
  storeSkus: Array<ItemStoreSku>;
  tags: Array<Scalars['String']['output']>;
  type: ItemType;
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
  brand?: Maybe<Brand>;
  id: Scalars['ID']['output'];
  item?: Maybe<Item>;
  sku?: Maybe<Scalars['String']['output']>;
};

export type ItemCategory = {
  __typename?: 'ItemCategory';
  assignedAt?: Maybe<Scalars['String']['output']>;
  assignedBy?: Maybe<User>;
  category: Category;
  confidence: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  item: Item;
  source: CategorySource;
};

export enum ItemCondition {
  Excellent = 'EXCELLENT',
  Fair = 'FAIR',
  Good = 'GOOD',
  Poor = 'POOR',
  Spoiled = 'SPOILED',
}

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
  hasAllergens?: InputMaybe<Scalars['Boolean']['input']>;
  hasNutrition?: InputMaybe<Scalars['Boolean']['input']>;
  hasOffers?: InputMaybe<Scalars['Boolean']['input']>;
  inventoryStatus?: InputMaybe<Scalars['String']['input']>;
  isDairyFree?: InputMaybe<Scalars['Boolean']['input']>;
  isGlutenFree?: InputMaybe<Scalars['Boolean']['input']>;
  isOrganic?: InputMaybe<Scalars['Boolean']['input']>;
  isVegan?: InputMaybe<Scalars['Boolean']['input']>;
  priceRange?: InputMaybe<PriceRangeInput>;
  status?: InputMaybe<ItemStatus>;
  statuses?: InputMaybe<Array<ItemStatus>>;
  storageState?: InputMaybe<StorageState>;
  storageStates?: InputMaybe<Array<StorageState>>;
  storeId?: InputMaybe<Scalars['String']['input']>;
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  type?: InputMaybe<ItemType>;
  types?: InputMaybe<Array<ItemType>>;
  updatedAfter?: InputMaybe<Scalars['DateTime']['input']>;
  updatedBefore?: InputMaybe<Scalars['DateTime']['input']>;
  visibility?: InputMaybe<Visibility>;
};

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

export type ItemStoreSku = {
  __typename?: 'ItemStoreSku';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  inventoryStatus?: Maybe<Scalars['String']['output']>;
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
  brand?: Maybe<BrandSuggestion>;
  category?: Maybe<CategorySuggestion>;
  defaultUnit?: Maybe<ItemUnitSuggestion>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
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
  conversionNote?: Maybe<Scalars['String']['output']>;
  conversionRatio?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  isCommon: Scalars['Boolean']['output'];
  isDefault?: Maybe<Scalars['Boolean']['output']>;
  isPreferred: Scalars['Boolean']['output'];
  isVerified: Scalars['Boolean']['output'];
  item?: Maybe<Item>;
  itemId: Scalars['String']['output'];
  lastPriceUpdate?: Maybe<Scalars['DateTime']['output']>;
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  maxQuantity?: Maybe<Scalars['Float']['output']>;
  minQuantity?: Maybe<Scalars['Float']['output']>;
  packageDescription?: Maybe<Scalars['String']['output']>;
  packageSize?: Maybe<Scalars['Float']['output']>;
  popularityScore: Scalars['Float']['output'];
  priceSource?: Maybe<Scalars['String']['output']>;
  quantityStep?: Maybe<Scalars['Float']['output']>;
  recommendedFor: Array<UnitRecommendation>;
  retailUnit: Scalars['Boolean']['output'];
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

export type ItemUnitInput = {
  averagePricePerUnit?: InputMaybe<Scalars['Float']['input']>;
  conversionRatio?: InputMaybe<Scalars['Float']['input']>;
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

export type LoginHistory = {
  __typename?: 'LoginHistory';
  apiClient?: Maybe<Scalars['String']['output']>;
  browserName?: Maybe<Scalars['String']['output']>;
  browserVersion?: Maybe<Scalars['String']['output']>;
  campaign?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  device?: Maybe<Device>;
  deviceId?: Maybe<Scalars['ID']['output']>;
  deviceType?: Maybe<DeviceType>;
  failureDetails?: Maybe<Scalars['String']['output']>;
  failureReason?: Maybe<LoginFailureReason>;
  flaggedAt?: Maybe<Scalars['DateTime']['output']>;
  flaggedBy?: Maybe<User>;
  flaggedById?: Maybe<Scalars['ID']['output']>;
  flaggedReason?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  ipAddress?: Maybe<Scalars['String']['output']>;
  ipCity?: Maybe<Scalars['String']['output']>;
  ipCountry?: Maybe<Scalars['String']['output']>;
  ipRegion?: Maybe<Scalars['String']['output']>;
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
  ipAddress?: Maybe<Scalars['String']['output']>;
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

export type MealPlan = {
  __typename?: 'MealPlan';
  actualCost: Scalars['Float']['output'];
  budgetAmount?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  endDate: Scalars['DateTime']['output'];
  generatedShoppingLists: Array<ShoppingList>;
  id: Scalars['ID']['output'];
  mealPlanItems: Array<MealPlanItem>;
  name: Scalars['String']['output'];
  planType: MealPlanType;
  servings: Scalars['Int']['output'];
  startDate: Scalars['DateTime']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  version: Scalars['Int']['output'];
};

export type MealPlanItem = {
  __typename?: 'MealPlanItem';
  actualCost?: Maybe<Scalars['Float']['output']>;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  customMealName?: Maybe<Scalars['String']['output']>;
  date: Scalars['DateTime']['output'];
  estimatedCost?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  isCompleted: Scalars['Boolean']['output'];
  mealPlan: MealPlan;
  mealType: MealType;
  notes?: Maybe<Scalars['String']['output']>;
  recipe?: Maybe<Recipe>;
  servings?: Maybe<Scalars['Int']['output']>;
  usedPantryItems: Scalars['JSON']['output'];
};

export enum MealPlanType {
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY',
}

export enum MealType {
  Breakfast = 'BREAKFAST',
  Brunch = 'BRUNCH',
  Dessert = 'DESSERT',
  Dinner = 'DINNER',
  Lunch = 'LUNCH',
  Snack = 'SNACK',
}

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
  previousValues?: Maybe<Membership>;
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

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  acceptHomeInvite: Membership;
  acceptShoppingListInvite: ShoppingListCollaborator;
  addCollaborator: ShoppingListCollaborator;
  addItemTags: Item;
  addItemToCategory: Item;
  addItemToPantry: PantryItem;
  addItemToShoppingList: ShoppingListItem;
  addItemUnit: ItemUnit;
  addRecipe: Recipe;
  addRecipeIngredientToShoppingList: AddIngredientResult;
  addRecipeToShoppingList: AddRecipeToShoppingListResult;
  addRestrictions: UserModeration;
  addUserAddress: UserAddress;
  addWarning: UserModeration;
  adminDeleteUser: Scalars['Boolean']['output'];
  archiveShoppingList: ShoppingList;
  banUser: UserModeration;
  bulkCreateItems: BulkCreateItemsResponse;
  bulkDeleteItems: BulkOperationSummary;
  bulkUpdateItems: BulkOperationSummary;
  cancelRecurring: ShoppingList;
  categorizeItem: ItemCategory;
  cleanupDeletedDevices: Scalars['Int']['output'];
  cleanupStaleDevices: Scalars['Int']['output'];
  clearReminder: ShoppingList;
  /** Mark user onboarding as complete and send welcome email */
  completeOnboarding: Scalars['Boolean']['output'];
  completeReview: UserModeration;
  completeShoppingList: ShoppingList;
  confirmItemImageUpload: Scalars['String']['output'];
  confirmProfileImageUpload: Scalars['String']['output'];
  createBrand: Brand;
  createBulkPurchases: Array<Purchase>;
  createBulkStores: Array<Store>;
  createCategory: Category;
  createCurrency: Currency;
  createDevice: Device;
  createFromTemplate: ShoppingList;
  createHome: Home;
  createImageUploadUrl: PresignPayload;
  createItem: Item;
  createLoginHistory: LoginHistory;
  createMealPlan: MealPlan;
  createMembership: Membership;
  createModerationRecord: UserModeration;
  createNotification: Notification;
  createPantry: Pantry;
  createProfile: UserProfile;
  createPurchase: Purchase;
  createShoppingList: ShoppingList;
  createStore: Store;
  createUnit: Unit;
  createUploadUrl: PresignPayload;
  deactivateDevice: Device;
  deactivateMultipleDevices: Array<Device>;
  declineHomeInvite: Scalars['Boolean']['output'];
  declineShoppingListInvite: Scalars['Boolean']['output'];
  deleteAccount: Scalars['Boolean']['output'];
  deleteAllReadNotifications: Scalars['Int']['output'];
  deleteBrand: Brand;
  deleteBulkPurchases: Scalars['Boolean']['output'];
  deleteCategory: Scalars['Boolean']['output'];
  deleteCookingLog: Scalars['Boolean']['output'];
  deleteCurrency: Scalars['Boolean']['output'];
  deleteDevice: Device;
  deleteExpiredNotifications: Scalars['Int']['output'];
  deleteHome: Home;
  deleteItem: Scalars['Boolean']['output'];
  deleteMealPlan: Scalars['Boolean']['output'];
  deleteMultipleDevices: Array<Device>;
  deleteMultipleNotifications: Scalars['Int']['output'];
  deleteNotification: Scalars['Boolean']['output'];
  deletePantry: Scalars['Boolean']['output'];
  deletePurchase: Scalars['Boolean']['output'];
  deleteRecipe: Scalars['Boolean']['output'];
  deleteShoppingList: Scalars['Boolean']['output'];
  deleteStore: Scalars['Boolean']['output'];
  deleteUnit: Scalars['Boolean']['output'];
  deleteUserAddress: UserAddress;
  exportItems: ExportResponse;
  flagDeviceAsEmulator: Device;
  flagLoginAsRisky: LoginHistory;
  flagMultipleLoginsAsRisky: Array<LoginHistory>;
  /** Request a password reset email */
  forgotPassword: ForgotPasswordResponse;
  forkRecipe: Recipe;
  generateNextRecurringList: ShoppingList;
  generateShoppingListShareCode: ShoppingList;
  hardDeleteDevice: Scalars['Boolean']['output'];
  importItemsFromCSV: ImportItemsResponse;
  importItemsFromProvider: ImportItemsResponse;
  incrementDeviceLoginCount: Device;
  incrementItemPopularity: Item;
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
  markItemAsWaste: PantryItem;
  markItemPurchased: ShoppingListItem;
  markLoginAsReviewed: LoginHistory;
  markMultipleLoginsAsReviewed: Array<LoginHistory>;
  markNotificationAsRead: Notification;
  markNotificationUnread: Notification;
  mergeItems: Item;
  putUnderReview: UserModeration;
  reactivateDevice: Device;
  recordLoginAttempt: LoginHistory;
  recordPantryItemUsage: PantryItemUsage;
  recordPriceObservation: ItemPriceHistory;
  refresh: RefreshTokenPayload;
  register: AuthPayload;
  registerDevice: Device;
  removeCollaborator: Scalars['Boolean']['output'];
  removeItemBrand: Item;
  removeItemFromCategory: Item;
  removeItemFromPantry: PantryItem;
  removeItemFromShoppingList: Scalars['Boolean']['output'];
  removeItemImage: Item;
  removeItemTags: Item;
  removeItemUnit: Scalars['Boolean']['output'];
  removeMember: Scalars['Boolean']['output'];
  removeProfileAvatar: UserProfile;
  removeProfileCover: UserProfile;
  removePushToken: Device;
  removeRestrictions: UserModeration;
  removeShoppingListCollaborator: Scalars['Boolean']['output'];
  removeUnitConversion: Unit;
  reorderShoppingListItems: Array<ShoppingListItem>;
  resendVerificationEmail: Scalars['Boolean']['output'];
  /** Reset password using token from email */
  resetPassword: ResetPasswordResponse;
  restoreItem: Item;
  reviewAppeal: UserModeration;
  revokeHomeInvite: Scalars['Boolean']['output'];
  saveRecipe: Recipe;
  sendBulkNotifications: BulkNotificationResult;
  sendTestNotification: Notification;
  setDefaultHome: UserSettings;
  setDefaultItemUnit: ItemUnit;
  setDefaultShoppingList: ShoppingList;
  setItemBrand: Item;
  setItemCategories: Item;
  setReminder: ShoppingList;
  setupRecurring: ShoppingList;
  setupUnitConversion: Unit;
  shareShoppingList: ShoppingList;
  submitAppeal: UserModeration;
  suspendUser: UserModeration;
  syncAllItemPrices: BulkOperationSummary;
  syncItemOffers: Item;
  syncItemPrices: Item;
  syncItemWithProvider: Item;
  transferHomeOwnership: HomeOwnership;
  trustDevice: Device;
  trustMultipleDevices: Array<Device>;
  unbanUser: UserModeration;
  uncategorizeItem: Scalars['Boolean']['output'];
  uncompleteShoppingList: ShoppingList;
  unsuspendUser: UserModeration;
  untrustDevice: Device;
  untrustMultipleDevices: Array<Device>;
  updateBrand: Brand;
  updateCategory: Category;
  updateCollaboratorRole: Scalars['Boolean']['output'];
  updateCookingLog: CookingLog;
  updateCurrency: Currency;
  updateDevice: Device;
  updateDeviceBatteryInfo: Device;
  updateDeviceHardwareInfo: Device;
  updateDeviceLastSeen: Device;
  updateDeviceLocation: Device;
  updateDevicePeripherals: Device;
  updateHome: Home;
  updateItem: Item;
  updateItemAllergens: Item;
  updateItemImage: Item;
  updateItemIngredients: Item;
  updateItemMetadata: Item;
  updateItemNutrition: Item;
  updateItemPrice: Item;
  updateItemUnit: ItemUnit;
  updateLoginHistory: LoginHistory;
  updateLoginSession: LoginHistory;
  updateMealPlan: MealPlan;
  updateMembership: Membership;
  updateModerationStatus: UserModeration;
  updateNotification: Notification;
  updateNotificationPreferences: NotificationPreferences;
  updatePantry: Pantry;
  updatePantryItem: PantryItem;
  updateProfile: UserProfile;
  updateProfileAvatar: UserProfile;
  updateProfileCover: UserProfile;
  updatePurchase: Purchase;
  updatePushToken: Device;
  updateRecipe: Recipe;
  updateRiskScore: UserModeration;
  updateSettings: UserSettings;
  updateShoppingList: ShoppingList;
  updateShoppingListItem: ShoppingListItem;
  updateStore: Store;
  updateStoreInfo: StoreInfo;
  updateStorePriceAccuracy: Store;
  updateStoreQualityRating: Store;
  updateTrustLevel: UserModeration;
  updateUnit: Unit;
  updateUser: User;
  updateUserAddress: UserAddress;
  upsertItemByExternalSource: UpsertItemResult;
  validateItem: ValidationResult;
  /** Validate if a password reset token is still valid */
  validatePasswordResetToken: ValidateTokenResponse;
  verifyDevice: Device;
  verifyEmail: Scalars['Boolean']['output'];
  verifyItemUnit: ItemUnit;
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

export type MutationAddItemTagsArgs = {
  id: Scalars['ID']['input'];
  tags: Array<Scalars['String']['input']>;
};

export type MutationAddItemToCategoryArgs = {
  categoryId: Scalars['ID']['input'];
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
};

export type MutationAddItemToPantryArgs = {
  input: AddPantryItemInput;
};

export type MutationAddItemToShoppingListArgs = {
  input: CreateShoppingListItemInput;
};

export type MutationAddItemUnitArgs = {
  input: ItemUnitInput;
  itemId: Scalars['ID']['input'];
};

export type MutationAddRecipeArgs = {
  category?: InputMaybe<RecipeCategory>;
  cookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  difficulty?: InputMaybe<Difficulty>;
  ingredients: Array<Scalars['String']['input']>;
  instructions: Scalars['JSON']['input'];
  name: Scalars['String']['input'];
  prepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationAddRecipeIngredientToShoppingListArgs = {
  quantityOverride?: InputMaybe<Scalars['Float']['input']>;
  recipeIngredientId: Scalars['ID']['input'];
  shoppingListId: Scalars['ID']['input'];
};

export type MutationAddRecipeToShoppingListArgs = {
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Int']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type MutationAddRestrictionsArgs = {
  input: AddRestrictionsInput;
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

export type MutationCleanupDeletedDevicesArgs = {
  olderThanDays?: InputMaybe<Scalars['Int']['input']>;
};

export type MutationCleanupStaleDevicesArgs = {
  daysInactive?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
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

export type MutationCreateBrandArgs = {
  input?: InputMaybe<CreateBrandInput>;
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

export type MutationCreateDeviceArgs = {
  input: CreateDeviceInput;
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

export type MutationCreateProfileArgs = {
  input: CreateUserProfileInput;
};

export type MutationCreatePurchaseArgs = {
  input: CreatePurchaseInput;
};

export type MutationCreateShoppingListArgs = {
  input: CreateShoppingListInput;
};

export type MutationCreateStoreArgs = {
  input: CreateStoreInput;
};

export type MutationCreateUnitArgs = {
  input: CreateUnitInput;
};

export type MutationCreateUploadUrlArgs = {
  ext: Scalars['String']['input'];
  mime: Scalars['String']['input'];
};

export type MutationDeactivateDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeactivateMultipleDevicesArgs = {
  deviceIds: Array<Scalars['ID']['input']>;
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

export type MutationDeleteDeviceArgs = {
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

export type MutationDeleteMultipleDevicesArgs = {
  deviceIds: Array<Scalars['ID']['input']>;
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

export type MutationDeletePurchaseArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteRecipeArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteShoppingListArgs = {
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

export type MutationExportItemsArgs = {
  filters?: InputMaybe<ItemFilters>;
  format: ExportFormat;
};

export type MutationFlagDeviceAsEmulatorArgs = {
  id: Scalars['ID']['input'];
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

export type MutationIncrementDeviceLoginCountArgs = {
  id: Scalars['ID']['input'];
};

export type MutationIncrementItemPopularityArgs = {
  id: Scalars['ID']['input'];
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

export type MutationMarkItemAsWasteArgs = {
  id: Scalars['ID']['input'];
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  wasteAmount: Scalars['Float']['input'];
  wasteReason: WasteReason;
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

export type MutationMergeItemsArgs = {
  duplicateIds: Array<Scalars['ID']['input']>;
  primaryId: Scalars['ID']['input'];
};

export type MutationPutUnderReviewArgs = {
  input: PutUnderReviewInput;
};

export type MutationReactivateDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRecordLoginAttemptArgs = {
  input: LoginAttemptInput;
};

export type MutationRecordPantryItemUsageArgs = {
  input: RecordPantryItemUsageInput;
};

export type MutationRecordPriceObservationArgs = {
  itemId: Scalars['ID']['input'];
  observedAt?: InputMaybe<Scalars['DateTime']['input']>;
  price: Scalars['Float']['input'];
  storeId: Scalars['String']['input'];
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

export type MutationRemoveCollaboratorArgs = {
  data: RemoveCollaboratorInput;
};

export type MutationRemoveItemBrandArgs = {
  brandId: Scalars['ID']['input'];
  itemId: Scalars['ID']['input'];
};

export type MutationRemoveItemFromCategoryArgs = {
  categoryId: Scalars['ID']['input'];
  itemId: Scalars['ID']['input'];
};

export type MutationRemoveItemFromPantryArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveItemFromShoppingListArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveItemImageArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveItemTagsArgs = {
  id: Scalars['ID']['input'];
  tags: Array<Scalars['String']['input']>;
};

export type MutationRemoveItemUnitArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveMemberArgs = {
  membershipId: Scalars['ID']['input'];
};

export type MutationRemovePushTokenArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveRestrictionsArgs = {
  input: RemoveRestrictionsInput;
};

export type MutationRemoveShoppingListCollaboratorArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveUnitConversionArgs = {
  unitId: Scalars['ID']['input'];
};

export type MutationReorderShoppingListItemsArgs = {
  input: ReorderShoppingListItemsInput;
};

export type MutationResendVerificationEmailArgs = {
  email: Scalars['String']['input'];
};

export type MutationResetPasswordArgs = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
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

export type MutationSaveRecipeArgs = {
  input: SaveRecipeInput;
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

export type MutationSetDefaultItemUnitArgs = {
  itemId: Scalars['ID']['input'];
  unitId: Scalars['ID']['input'];
};

export type MutationSetDefaultShoppingListArgs = {
  id: Scalars['ID']['input'];
};

export type MutationSetItemBrandArgs = {
  brandId: Scalars['ID']['input'];
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
};

export type MutationSetItemCategoriesArgs = {
  categoryIds: Array<Scalars['ID']['input']>;
  itemId: Scalars['ID']['input'];
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

export type MutationTransferHomeOwnershipArgs = {
  homeId: Scalars['ID']['input'];
  newOwnerId: Scalars['ID']['input'];
};

export type MutationTrustDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type MutationTrustMultipleDevicesArgs = {
  deviceIds: Array<Scalars['ID']['input']>;
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

export type MutationUnsuspendUserArgs = {
  userId: Scalars['ID']['input'];
};

export type MutationUntrustDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type MutationUntrustMultipleDevicesArgs = {
  deviceIds: Array<Scalars['ID']['input']>;
};

export type MutationUpdateBrandArgs = {
  input?: InputMaybe<UpdateBrandInput>;
};

export type MutationUpdateCategoryArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCategoryInput;
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

export type MutationUpdateDeviceBatteryInfoArgs = {
  batteryLevel: Scalars['Float']['input'];
  id: Scalars['ID']['input'];
  isBatteryCharging: Scalars['Boolean']['input'];
};

export type MutationUpdateDeviceHardwareInfoArgs = {
  hardwareInfo: DeviceHardwareInfoInput;
  id: Scalars['ID']['input'];
};

export type MutationUpdateDeviceLastSeenArgs = {
  id: Scalars['ID']['input'];
};

export type MutationUpdateDeviceLocationArgs = {
  id: Scalars['ID']['input'];
  input: DeviceLocationInput;
};

export type MutationUpdateDevicePeripheralsArgs = {
  id: Scalars['ID']['input'];
  peripherals: DevicePeripheralsInput;
};

export type MutationUpdateHomeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateHomeInput;
};

export type MutationUpdateItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdateItemInput;
};

export type MutationUpdateItemAllergensArgs = {
  allergens: Array<AllergenInput>;
  id: Scalars['ID']['input'];
};

export type MutationUpdateItemImageArgs = {
  id: Scalars['ID']['input'];
  imageUrl: Scalars['String']['input'];
};

export type MutationUpdateItemIngredientsArgs = {
  id: Scalars['ID']['input'];
  ingredients: Array<IngredientInput>;
};

export type MutationUpdateItemMetadataArgs = {
  id: Scalars['ID']['input'];
  merge?: InputMaybe<Scalars['Boolean']['input']>;
  metadata: Scalars['JSON']['input'];
};

export type MutationUpdateItemNutritionArgs = {
  id: Scalars['ID']['input'];
  nutritionFacts: Array<NutritionFactInput>;
};

export type MutationUpdateItemPriceArgs = {
  itemId: Scalars['ID']['input'];
  price: Scalars['Float']['input'];
  source?: InputMaybe<Scalars['String']['input']>;
  storeId?: InputMaybe<Scalars['String']['input']>;
};

export type MutationUpdateItemUnitArgs = {
  id: Scalars['ID']['input'];
  input: ItemUnitInput;
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
  input: NotificationPreferencesInput;
};

export type MutationUpdatePantryArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePantryInput;
};

export type MutationUpdatePantryItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePantryItemInput;
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

export type MutationUpdatePushTokenArgs = {
  id: Scalars['ID']['input'];
  pushToken: Scalars['String']['input'];
};

export type MutationUpdateRecipeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRecipeInput;
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

export type MutationValidateItemArgs = {
  deep?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
};

export type MutationValidatePasswordResetTokenArgs = {
  token: Scalars['String']['input'];
};

export type MutationVerifyDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type MutationVerifyEmailArgs = {
  code: Scalars['String']['input'];
};

export type MutationVerifyItemUnitArgs = {
  id: Scalars['ID']['input'];
};

export type MutationVerifyUserEmailArgs = {
  id: Scalars['ID']['input'];
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

export type NotificationPreferences = {
  __typename?: 'NotificationPreferences';
  categories: Array<Scalars['String']['output']>;
  email: Scalars['Boolean']['output'];
  inApp: Scalars['Boolean']['output'];
  push: Scalars['Boolean']['output'];
  quietHours?: Maybe<QuietHours>;
  sms: Scalars['Boolean']['output'];
  types: Array<NotificationType>;
  userId: Scalars['String']['output'];
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

export type NotificationSubscriptionPayload = {
  __typename?: 'NotificationSubscriptionPayload';
  mutation: MutationType;
  node: Notification;
  previousValues?: Maybe<Notification>;
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

export type NutritionFactInput = {
  category?: InputMaybe<NutritionCategory>;
  dailyValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  unit?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['Float']['input'];
};

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

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type PaginationInput = {
  cursor?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};

export type Pantry = {
  __typename?: 'Pantry';
  activities?: Maybe<Array<PantryActivity>>;
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  home: Home;
  homeId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  items?: Maybe<Array<PantryItem>>;
  location?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  temperature?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  version: Scalars['Int']['output'];
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

export type PantryItem = {
  __typename?: 'PantryItem';
  acquisitionMethod: AcquisitionMethod;
  addedAt: Scalars['DateTime']['output'];
  addedBy?: Maybe<User>;
  alertSentAt?: Maybe<Scalars['DateTime']['output']>;
  autoReorderPoint?: Maybe<Scalars['Float']['output']>;
  batchNumber?: Maybe<Scalars['String']['output']>;
  bestByDate?: Maybe<Scalars['DateTime']['output']>;
  condition: ItemCondition;
  consumedQuantity: Scalars['Float']['output'];
  costPerUnit?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  currentQuantity: Scalars['Float']['output'];
  customCategory?: Maybe<Scalars['String']['output']>;
  estimatedShelfLife?: Maybe<Scalars['Int']['output']>;
  expirationAlert: Scalars['Boolean']['output'];
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  initialQuantity: Scalars['Float']['output'];
  isAutoReorder: Scalars['Boolean']['output'];
  isComposted: Scalars['Boolean']['output'];
  isRecycled: Scalars['Boolean']['output'];
  item: Item;
  itemBarcode?: Maybe<Scalars['String']['output']>;
  itemId: Scalars['String']['output'];
  itemName: Scalars['String']['output'];
  lastModifiedBy?: Maybe<User>;
  lastReorderDate?: Maybe<Scalars['DateTime']['output']>;
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  lotNumber?: Maybe<Scalars['String']['output']>;
  lowStockAlert: Scalars['Boolean']['output'];
  openedAt?: Maybe<Scalars['DateTime']['output']>;
  pantry: Pantry;
  pantryId: Scalars['String']['output'];
  photos: Array<PantryItemPhoto>;
  priority: Scalars['Int']['output'];
  purchase?: Maybe<Purchase>;
  purchaseId?: Maybe<Scalars['String']['output']>;
  remainingValue?: Maybe<Scalars['Float']['output']>;
  reservedQuantity: Scalars['Float']['output'];
  storageLocation?: Maybe<Scalars['String']['output']>;
  storageNotes?: Maybe<Scalars['String']['output']>;
  storageState: StorageState;
  store?: Maybe<Store>;
  storeId?: Maybe<Scalars['String']['output']>;
  tags: Array<Scalars['String']['output']>;
  totalCost?: Maybe<Scalars['Float']['output']>;
  unit?: Maybe<Unit>;
  unitId?: Maybe<Scalars['String']['output']>;
  unitName?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['DateTime']['output']>;
  usageFrequency: UsageFrequency;
  usageRecords: Array<PantryItemUsage>;
  version: Scalars['Int']['output'];
  wasteAmount: Scalars['Float']['output'];
  wasteDate?: Maybe<Scalars['DateTime']['output']>;
  wasteReason?: Maybe<WasteReason>;
};

export type PantryItemChangedPayload = {
  __typename?: 'PantryItemChangedPayload';
  item: PantryItem;
  mutation: MutationType;
  pantryId: Scalars['String']['output'];
  previousValue?: Maybe<PantryItem>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
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
  cookingLogId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  mealPlanItemId?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  pantryItem: PantryItem;
  pantryItemId: Scalars['String']['output'];
  purpose: UsagePurpose;
  quantityUsed: Scalars['Float']['output'];
  recipeId?: Maybe<Scalars['String']['output']>;
  usedAt: Scalars['String']['output'];
  usedBy: User;
  usedById: Scalars['String']['output'];
};

export type PantryItemUsageChangedPayload = {
  __typename?: 'PantryItemUsageChangedPayload';
  mutation: MutationType;
  pantryId: Scalars['String']['output'];
  previousValues?: Maybe<PantryItemUsage>;
  timestamp: Scalars['DateTime']['output'];
  usage: PantryItemUsage;
  userId: Scalars['String']['output'];
};

export type PantryStats = {
  __typename?: 'PantryStats';
  activeItems: Scalars['Int']['output'];
  expiringCount: Scalars['Int']['output'];
  lowStockItems: Scalars['Int']['output'];
  totalItems: Scalars['Int']['output'];
  totalValue: Scalars['Float']['output'];
};

export type PantryUpdatedPayload = {
  __typename?: 'PantryUpdatedPayload';
  description?: Maybe<Scalars['String']['output']>;
  home: Home;
  homeId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  location?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  temperature?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
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

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  activeDevices: Array<Device>;
  activeModerations: Array<UserModeration>;
  archivedShoppingLists: Array<ShoppingList>;
  autocompleteCategories: AutocompleteCategoryResponse;
  autocompleteItems?: Maybe<AutocompleteResponse>;
  brand?: Maybe<Brand>;
  brands: Array<Brand>;
  categories: Array<Category>;
  category?: Maybe<Category>;
  categoryBySlug?: Maybe<Category>;
  checkItemAvailability?: Maybe<Array<ItemAvailability>>;
  compareItemPrices?: Maybe<Array<StorePriceComparison>>;
  completedShoppingLists: Array<ShoppingList>;
  convertUnit?: Maybe<ConvertedUnitValue>;
  cookingLog?: Maybe<CookingLog>;
  currencies: Array<Currency>;
  currency?: Maybe<Currency>;
  currencyByCode?: Maybe<Currency>;
  defaultShoppingList?: Maybe<ShoppingList>;
  device?: Maybe<Device>;
  deviceByDeviceId?: Maybe<Device>;
  deviceCount: Scalars['Int']['output'];
  deviceStats: DeviceStats;
  devicesByManufacturer: Array<Device>;
  devicesByPlatform: Array<Device>;
  devicesWithPeripherals: Array<Device>;
  emulatedDevices: Array<Device>;
  expiringItems: Array<PantryItem>;
  failedLoginAttempts: Array<LoginHistory>;
  frequentlyBoughtItems: Array<ShoppingListItem>;
  getConvertibleUnits: Array<Unit>;
  getDefaultHome?: Maybe<Home>;
  hasUrgentNotifications: Scalars['Boolean']['output'];
  home?: Maybe<Home>;
  homeByJoinCode?: Maybe<Home>;
  homeInviteByToken?: Maybe<HomeInvite>;
  homeInviteLogs: Array<InviteLog>;
  homeInviteStats: Array<HomeInviteStatsGroup>;
  homeInvites: Array<HomeInvite>;
  homeMemberships: Array<Membership>;
  homes: Array<Home>;
  inviteLogs: Array<InviteLog>;
  inviteStats: InviteStats;
  invitesSentByMe: Array<HomeInvite>;
  item?: Maybe<Item>;
  itemByExternalId?: Maybe<Item>;
  itemByExternalSource?: Maybe<Item>;
  itemBySku?: Maybe<Item>;
  itemByUpc?: Maybe<Item>;
  itemPriceHistory?: Maybe<Array<ItemPriceHistory>>;
  items: ItemsResponse;
  itemsBySource: Array<Item>;
  loginHistory?: Maybe<LoginHistory>;
  loginHistoryByIP: Array<LoginHistory>;
  loginHistoryForUser: Array<LoginHistory>;
  loginHistoryStats: LoginHistoryStats;
  lowBatteryDevices: Array<Device>;
  lowStockItems: Array<PantryItem>;
  me?: Maybe<User>;
  mealPlan?: Maybe<MealPlan>;
  mealPlans: Array<MealPlan>;
  membership?: Maybe<Membership>;
  membershipStats: MembershipStats;
  mobileDevices: Array<Device>;
  myCollaboratedShoppingLists: Array<ShoppingList>;
  myCookingLogs: Array<CookingLog>;
  myCookingStats?: Maybe<CookingStats>;
  myDevices: Array<Device>;
  myHomes?: Maybe<Array<Home>>;
  myInviteLogs: Array<InviteLog>;
  myMembershipInHome?: Maybe<Membership>;
  myMemberships?: Maybe<Array<Membership>>;
  myModeration?: Maybe<UserModeration>;
  myNotifications: NotificationConnection;
  myPendingCollaborationInvites: Array<ShoppingListCollaborator>;
  myPendingInvites: Array<HomeInvite>;
  myPurchases: Array<Purchase>;
  myRecipes: RecipesResponse;
  myShoppingListInvites: Array<ShoppingListCollaborator>;
  nearbyStores: Array<Store>;
  notification?: Maybe<Notification>;
  notificationPreferences: NotificationPreferences;
  notificationStats: NotificationStats;
  notificationsByCategory: NotificationConnection;
  notificationsByType: NotificationConnection;
  onboardingItems: Array<Item>;
  pantries: Array<Pantry>;
  pantry?: Maybe<Pantry>;
  pantryItem: PantryItem;
  pantryItemUsage: Array<PantryItemUsage>;
  pantryItems: Array<PantryItem>;
  pantryItemsByItemId: Array<PantryItem>;
  pantryStats: PantryStats;
  popularBrands: Array<Brand>;
  popularCategories: Array<Category>;
  popularItems?: Maybe<Array<Item>>;
  popularStores: Array<Store>;
  purchase?: Maybe<Purchase>;
  purchaseStats: PurchaseStats;
  purchasesByDateRange: Array<Purchase>;
  purchasesByItem: Array<Purchase>;
  purchasesByShoppingListItem: Array<Purchase>;
  purchasesByStore: Array<Purchase>;
  recentItems?: Maybe<Array<Item>>;
  recentNotifications: Array<Notification>;
  recipe?: Maybe<Recipe>;
  recipeCookingLogs: Array<CookingLog>;
  recommendedItems?: Maybe<Array<ItemSuggestion>>;
  recommendedStores: Array<Store>;
  recurringShoppingLists: Array<ShoppingList>;
  relatedItems?: Maybe<RelatedItemsResponse>;
  rootBrands: Array<Brand>;
  rootCategories: Array<Category>;
  searchDevicesByUserAgent: Array<Device>;
  searchItems?: Maybe<ItemsResponse>;
  searchLoginHistory: Array<LoginHistory>;
  searchRecipes: Array<Recipe>;
  searchShoppingLists: Array<ShoppingList>;
  searchStores: Array<Store>;
  searchUnits: Array<Unit>;
  shoppingList?: Maybe<ShoppingList>;
  shoppingListByShareCode?: Maybe<ShoppingList>;
  shoppingListCollaborators: Array<ShoppingListCollaborator>;
  shoppingListItem?: Maybe<ShoppingListItem>;
  shoppingListItems: Array<ShoppingListItem>;
  shoppingListTemplates: Array<ShoppingList>;
  shoppingLists: Array<ShoppingList>;
  staleDevices: Array<Device>;
  store?: Maybe<Store>;
  storeByName?: Maybe<Store>;
  storeStats?: Maybe<StoreStats>;
  storeWithPriceHistory?: Maybe<Store>;
  storeWithPurchases?: Maybe<Store>;
  stores: Array<Store>;
  suggestedItemsForList: Array<ItemSuggestion>;
  suggestedRecipes: Array<Recipe>;
  suspiciousDevices: Array<Device>;
  suspiciousInviteActivity: Array<InviteLog>;
  suspiciousLoginActivity: SuspiciousActivity;
  tabletDevices: Array<Device>;
  trendingItems?: Maybe<Array<Item>>;
  trustedDevices: Array<Device>;
  unit?: Maybe<Unit>;
  unitBySymbol?: Maybe<Unit>;
  units: Array<Unit>;
  unreadNotificationCount: Scalars['Int']['output'];
  user?: Maybe<User>;
  userDevices: Array<Device>;
  userModeration?: Maybe<UserModeration>;
  userProfile?: Maybe<UserProfile>;
  userPurchases: Array<Purchase>;
  userSettings?: Maybe<UserSettings>;
  users: Array<User>;
  validateUpc: UpcValidation;
  verifiedDevices: Array<Device>;
};

export type QueryActiveDevicesArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryAutocompleteCategoriesArgs = {
  input: AutocompleteCategoryInput;
};

export type QueryAutocompleteItemsArgs = {
  input: AutocompleteInput;
};

export type QueryBrandArgs = {
  id: Scalars['ID']['input'];
};

export type QueryBrandsArgs = {
  country?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  parentId?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
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

export type QueryDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type QueryDeviceByDeviceIdArgs = {
  deviceId: Scalars['String']['input'];
};

export type QueryDeviceCountArgs = {
  activeOnly?: InputMaybe<Scalars['Boolean']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  platform?: InputMaybe<MobilePlatform>;
  trustedOnly?: InputMaybe<Scalars['Boolean']['input']>;
  userId: Scalars['ID']['input'];
  verifiedOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QueryDeviceStatsArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryDevicesByManufacturerArgs = {
  manufacturer: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type QueryDevicesByPlatformArgs = {
  platform: MobilePlatform;
  userId: Scalars['ID']['input'];
};

export type QueryDevicesWithPeripheralsArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryEmulatedDevicesArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryExpiringItemsArgs = {
  pantryId: Scalars['ID']['input'];
};

export type QueryFailedLoginAttemptsArgs = {
  hours?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};

export type QueryFrequentlyBoughtItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryGetConvertibleUnitsArgs = {
  unitId: Scalars['ID']['input'];
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

export type QueryHomeInvitesArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryHomeMembershipsArgs = {
  homeId: Scalars['ID']['input'];
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

export type QueryItemByExternalIdArgs = {
  externalId: Scalars['String']['input'];
  provider: ProviderType;
};

export type QueryItemByExternalSourceArgs = {
  externalId: Scalars['String']['input'];
  source: ExternalSource;
};

export type QueryItemBySkuArgs = {
  sku: Scalars['String']['input'];
  storeId?: InputMaybe<Scalars['String']['input']>;
};

export type QueryItemByUpcArgs = {
  upc: Scalars['String']['input'];
};

export type QueryItemPriceHistoryArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
  itemId: Scalars['ID']['input'];
  storeId?: InputMaybe<Scalars['String']['input']>;
};

export type QueryItemsArgs = {
  filters?: InputMaybe<ItemFilters>;
  pagination?: InputMaybe<PaginationInput>;
  sort?: InputMaybe<ItemSortInput>;
};

export type QueryItemsBySourceArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  source: ExternalSource;
};

export type QueryLoginHistoryArgs = {
  id: Scalars['ID']['input'];
};

export type QueryLoginHistoryByIpArgs = {
  filters?: InputMaybe<LoginHistoryByIpFiltersInput>;
  ipAddress: Scalars['String']['input'];
};

export type QueryLoginHistoryForUserArgs = {
  filters?: InputMaybe<LoginHistoryFiltersInput>;
  userId: Scalars['ID']['input'];
};

export type QueryLoginHistoryStatsArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};

export type QueryLowBatteryDevicesArgs = {
  threshold?: InputMaybe<Scalars['Float']['input']>;
  userId: Scalars['ID']['input'];
};

export type QueryLowStockItemsArgs = {
  pantryId: Scalars['ID']['input'];
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

export type QueryMembershipArgs = {
  id: Scalars['ID']['input'];
};

export type QueryMembershipStatsArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryMobileDevicesArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryMyCookingLogsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryMyDevicesArgs = {
  filters?: InputMaybe<DeviceFiltersInput>;
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

export type QueryMyRecipesArgs = {
  category?: InputMaybe<RecipeCategory>;
  difficulty?: InputMaybe<Difficulty>;
  includeDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryNearbyStoresArgs = {
  lat: Scalars['Float']['input'];
  lng: Scalars['Float']['input'];
  radius?: InputMaybe<Scalars['Float']['input']>;
};

export type QueryNotificationArgs = {
  id: Scalars['ID']['input'];
};

export type QueryNotificationStatsArgs = {
  filter?: InputMaybe<NotificationFilterInput>;
};

export type QueryNotificationsByCategoryArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  category: Scalars['String']['input'];
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryNotificationsByTypeArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  type: NotificationType;
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

export type QueryPantryItemUsageArgs = {
  pantryItemId: Scalars['ID']['input'];
};

export type QueryPantryItemsArgs = {
  filter?: InputMaybe<Scalars['String']['input']>;
  pantryId: Scalars['ID']['input'];
};

export type QueryPantryItemsByItemIdArgs = {
  itemId: Scalars['String']['input'];
};

export type QueryPantryStatsArgs = {
  pantryId: Scalars['ID']['input'];
};

export type QueryPopularBrandsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryPopularCategoriesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  type?: InputMaybe<CategoryType>;
};

export type QueryPopularItemsArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  timeRange?: InputMaybe<DateRange>;
};

export type QueryPopularStoresArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryPurchaseArgs = {
  id: Scalars['ID']['input'];
};

export type QueryPurchaseStatsArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type QueryPurchasesByDateRangeArgs = {
  dateRange: DateRangeInput;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type QueryPurchasesByItemArgs = {
  itemId: Scalars['ID']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type QueryPurchasesByShoppingListItemArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  shoppingListItemId: Scalars['ID']['input'];
};

export type QueryPurchasesByStoreArgs = {
  storeId: Scalars['ID']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type QueryRecentItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type QueryRecentNotificationsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryRecipeArgs = {
  id: Scalars['ID']['input'];
};

export type QueryRecipeCookingLogsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  recipeId: Scalars['ID']['input'];
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

export type QuerySearchDevicesByUserAgentArgs = {
  userAgent: Scalars['String']['input'];
};

export type QuerySearchItemsArgs = {
  input: SearchItemsInput;
};

export type QuerySearchLoginHistoryArgs = {
  filters?: InputMaybe<LoginHistoryFiltersInput>;
  query: Scalars['String']['input'];
};

export type QuerySearchRecipesArgs = {
  query: Scalars['String']['input'];
};

export type QuerySearchShoppingListsArgs = {
  query: Scalars['String']['input'];
};

export type QuerySearchStoresArgs = {
  query: Scalars['String']['input'];
};

export type QuerySearchUnitsArgs = {
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

export type QueryShoppingListItemsArgs = {
  shoppingListId: Scalars['ID']['input'];
};

export type QueryStaleDevicesArgs = {
  daysInactive?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
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

export type QuerySuggestedItemsForListArgs = {
  shoppingListId: Scalars['ID']['input'];
};

export type QuerySuspiciousDevicesArgs = {
  userId: Scalars['ID']['input'];
};

export type QuerySuspiciousInviteActivityArgs = {
  timeWindowHours?: InputMaybe<Scalars['Int']['input']>;
};

export type QuerySuspiciousLoginActivityArgs = {
  hours?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};

export type QueryTabletDevicesArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryTrendingItemsArgs = {
  category?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryTrustedDevicesArgs = {
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
  type?: InputMaybe<UnitType>;
};

export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type QueryUserDevicesArgs = {
  filters?: InputMaybe<DeviceFiltersInput>;
  userId: Scalars['ID']['input'];
};

export type QueryUserModerationArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryUserPurchasesArgs = {
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

export type QueryVerifiedDevicesArgs = {
  userId: Scalars['ID']['input'];
};

export type QuietHours = {
  __typename?: 'QuietHours';
  enabled: Scalars['Boolean']['output'];
  endTime: Scalars['String']['output'];
  startTime: Scalars['String']['output'];
  timezone: Scalars['String']['output'];
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
  dietaryTags: Array<DietaryTag>;
  difficulty: Difficulty;
  externalData?: Maybe<Scalars['JSON']['output']>;
  externalId?: Maybe<Scalars['String']['output']>;
  externalSource?: Maybe<ExternalSource>;
  externalUrl?: Maybe<Scalars['String']['output']>;
  forkedFrom?: Maybe<Recipe>;
  forkedFromId?: Maybe<Scalars['ID']['output']>;
  forks: Array<Recipe>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  ingredients: Array<RecipeIngredient>;
  instructions: Scalars['JSON']['output'];
  isExternal: Scalars['Boolean']['output'];
  isPublished: Scalars['Boolean']['output'];
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
  servings: Scalars['Int']['output'];
  source?: Maybe<Scalars['String']['output']>;
  sourceMapping?: Maybe<RecipeSourceMapping>;
  sourceUrl?: Maybe<Scalars['String']['output']>;
  status: RecipeStatus;
  tags: Array<Scalars['String']['output']>;
  tips?: Maybe<Scalars['String']['output']>;
  totalCookingLogs: Scalars['Int']['output'];
  totalReviews: Scalars['Int']['output'];
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

export type RecipeIngredient = {
  __typename?: 'RecipeIngredient';
  aisle?: Maybe<Scalars['String']['output']>;
  availablePantryItemIds: Array<Scalars['String']['output']>;
  consistency?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  image?: Maybe<Scalars['String']['output']>;
  isOptional: Scalars['Boolean']['output'];
  item?: Maybe<Item>;
  meta: Array<Scalars['String']['output']>;
  metricAmount?: Maybe<Scalars['Float']['output']>;
  metricUnit?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  originalString?: Maybe<Scalars['String']['output']>;
  preparation?: Maybe<Scalars['String']['output']>;
  quantity: Scalars['Float']['output'];
  recipe: Recipe;
  section?: Maybe<Scalars['String']['output']>;
  sortOrder: Scalars['Int']['output'];
  spoonacularIngredientId?: Maybe<Scalars['Int']['output']>;
  unit?: Maybe<Unit>;
  usAmount?: Maybe<Scalars['Float']['output']>;
  usUnit?: Maybe<Scalars['String']['output']>;
};

export type RecipeIngredientInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  consistency?: InputMaybe<Scalars['String']['input']>;
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

export type RecipesResponse = {
  __typename?: 'RecipesResponse';
  recipes: Array<Recipe>;
  totalCount: Scalars['Int']['output'];
};

export type RecordPantryItemUsageInput = {
  cookingLogId?: InputMaybe<Scalars['String']['input']>;
  mealPlanItemId?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  pantryItemId: Scalars['ID']['input'];
  purpose: UsagePurpose;
  quantityUsed: Scalars['Float']['input'];
  recipeId?: InputMaybe<Scalars['String']['input']>;
};

export enum RecurringPattern {
  Biweekly = 'BIWEEKLY',
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY',
}

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

export type RelatedItemsResponse = {
  __typename?: 'RelatedItemsResponse';
  complementaryItems: Array<ItemSuggestion>;
  frequentlyBoughtTogether: Array<ItemSuggestion>;
  similarItems: Array<ItemSuggestion>;
};

export type RemoveCollaboratorInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type RemoveRestrictionsInput = {
  restrictions: Array<ModerationRestriction>;
  userId: Scalars['ID']['input'];
};

export type ReorderShoppingListItemsInput = {
  items: Array<ShoppingListItemSortInput>;
  shoppingListId: Scalars['ID']['input'];
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

export type SaveRecipeInput = {
  caloriesPerServing?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<RecipeCategory>;
  cookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  cuisine?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dietaryTags?: InputMaybe<Array<DietaryTag>>;
  difficulty?: InputMaybe<Difficulty>;
  externalSourceData?: InputMaybe<Scalars['JSON']['input']>;
  externalSourceId?: InputMaybe<Scalars['String']['input']>;
  externalSourceUrl?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  ingredients: Array<RecipeIngredientInput>;
  instructions: Scalars['JSON']['input'];
  name: Scalars['String']['input'];
  nutritionData?: InputMaybe<Scalars['JSON']['input']>;
  prepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
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

export type ShoppingList = {
  __typename?: 'ShoppingList';
  activities?: Maybe<Array<ShoppingListActivity>>;
  autoAddSuggestions: Scalars['Boolean']['output'];
  basedOnTemplate?: Maybe<ShoppingList>;
  budgetAmount?: Maybe<Scalars['Float']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  collaborators?: Maybe<Array<ShoppingListCollaborator>>;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  completedItems: Scalars['Int']['output'];
  completedShopDate?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  estimatedTotal: Scalars['Float']['output'];
  generatedFromMealPlan: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isCompleted: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  isPublic: Scalars['Boolean']['output'];
  isRecurring: Scalars['Boolean']['output'];
  isTemplate: Scalars['Boolean']['output'];
  items: Array<ShoppingListItem>;
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
  purchases?: Maybe<Array<Purchase>>;
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
  templatesCreated?: Maybe<Array<ShoppingList>>;
  totalCollaborators: Scalars['Int']['output'];
  totalCost: Scalars['Float']['output'];
  totalItems: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
  viewCount: Scalars['Int']['output'];
};

export type ShoppingListActivity = {
  __typename?: 'ShoppingListActivity';
  action: ListActivityType;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  ipAddress?: Maybe<Scalars['String']['output']>;
  itemName?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  newValue?: Maybe<Scalars['String']['output']>;
  oldValue?: Maybe<Scalars['String']['output']>;
  shoppingList: ShoppingList;
  shoppingListId: Scalars['String']['output'];
  source?: Maybe<Scalars['String']['output']>;
  user: User;
  userAgent?: Maybe<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
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
  inviteToken?: Maybe<Scalars['String']['output']>;
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
};

export type ShoppingListCollaboratorChangedPayload = {
  __typename?: 'ShoppingListCollaboratorChangedPayload';
  collaborator?: Maybe<ShoppingListCollaborator>;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type ShoppingListItem = {
  __typename?: 'ShoppingListItem';
  addedBy?: Maybe<User>;
  addedById?: Maybe<Scalars['String']['output']>;
  aisle?: Maybe<Scalars['String']['output']>;
  autoAddReason?: Maybe<Scalars['String']['output']>;
  averagePrice?: Maybe<Scalars['Float']['output']>;
  budgetPrice?: Maybe<Scalars['Float']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  estimatedPrice?: Maybe<Scalars['Float']['output']>;
  highestPrice?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  isAutoAdded: Scalars['Boolean']['output'];
  isFromMealPlan: Scalars['Boolean']['output'];
  isPurchased: Scalars['Boolean']['output'];
  item?: Maybe<Item>;
  itemBarcode?: Maybe<Scalars['String']['output']>;
  itemName?: Maybe<Scalars['String']['output']>;
  lastEditedBy?: Maybe<User>;
  lastEditedById?: Maybe<Scalars['String']['output']>;
  lastKnownPrice?: Maybe<Scalars['Float']['output']>;
  lastPurchaseDate?: Maybe<Scalars['DateTime']['output']>;
  lowestPrice?: Maybe<Scalars['Float']['output']>;
  mealPlanReference?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  preferredStore?: Maybe<Store>;
  previouslyPurchased: Scalars['Boolean']['output'];
  priceLastUpdated?: Maybe<Scalars['DateTime']['output']>;
  priority: Scalars['Int']['output'];
  purchaseCount: Scalars['Int']['output'];
  purchaseDate?: Maybe<Scalars['DateTime']['output']>;
  purchasedBy?: Maybe<User>;
  purchasedById?: Maybe<Scalars['String']['output']>;
  purchasedPrice?: Maybe<Scalars['Float']['output']>;
  purchasedQuantity?: Maybe<Scalars['Float']['output']>;
  purchases?: Maybe<Array<Purchase>>;
  quantity?: Maybe<Scalars['Float']['output']>;
  shoppingList: ShoppingList;
  sortOrder: Scalars['Int']['output'];
  storeSection?: Maybe<Scalars['String']['output']>;
  unit?: Maybe<Unit>;
  unitName?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type ShoppingListItemChangedPayload = {
  __typename?: 'ShoppingListItemChangedPayload';
  item?: Maybe<ShoppingListItem>;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  previousValues?: Maybe<ShoppingListItemPreviousValues>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['ID']['output'];
};

export type ShoppingListItemPreviousValues = {
  __typename?: 'ShoppingListItemPreviousValues';
  isCompleted?: Maybe<Scalars['Boolean']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  price?: Maybe<Scalars['Float']['output']>;
  quantity?: Maybe<Scalars['Int']['output']>;
};

export type ShoppingListItemSortInput = {
  id: Scalars['ID']['input'];
  sortOrder: Scalars['Int']['input'];
};

export type ShoppingListOwnership = {
  __typename?: 'ShoppingListOwnership';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  shoppingList: ShoppingList;
  transferredAt?: Maybe<Scalars['DateTime']['output']>;
  transferredFrom?: Maybe<Scalars['String']['output']>;
  user: User;
};

export type ShoppingListPreviousValues = {
  __typename?: 'ShoppingListPreviousValues';
  budgetAmount?: Maybe<Scalars['Float']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  estimatedTotal?: Maybe<Scalars['Float']['output']>;
  isCompleted?: Maybe<Scalars['Boolean']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  status?: Maybe<ListStatus>;
  totalCost?: Maybe<Scalars['Float']['output']>;
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
  previousValues?: Maybe<ShoppingListPreviousValues>;
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

export enum SortOrder {
  Asc = 'ASC',
  Desc = 'DESC',
}

export enum StorageState {
  Ambient = 'AMBIENT',
  Frozen = 'FROZEN',
  None = 'NONE',
  Refrigerated = 'REFRIGERATED',
}

export type Store = {
  __typename?: 'Store';
  address?: Maybe<Scalars['String']['output']>;
  averageShelfLife?: Maybe<Scalars['JSON']['output']>;
  chain?: Maybe<Scalars['String']['output']>;
  chainLogo?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  features?: Maybe<Array<Scalars['String']['output']>>;
  hours?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  itemSkus: Array<ItemStoreSku>;
  lastPriceUpdate?: Maybe<Scalars['DateTime']['output']>;
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  pantryItems: Array<PantryItem>;
  phone?: Maybe<Scalars['String']['output']>;
  priceAccuracy?: Maybe<Scalars['Float']['output']>;
  priceHistory: Array<ItemPriceHistory>;
  purchases: Array<Purchase>;
  qualityRating?: Maybe<Scalars['Float']['output']>;
  state?: Maybe<Scalars['String']['output']>;
  storeInfo?: Maybe<StoreInfo>;
  storeSkus: Array<ItemStoreSku>;
  supportsPriceAPI: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
  website?: Maybe<Scalars['String']['output']>;
  zipCode?: Maybe<Scalars['String']['output']>;
};

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
  failedLoginAttempts: LoginHistory;
  loginAttempts: LoginHistory;
  memberJoined: MembershipUpdatePayload;
  memberLeft: MembershipUpdatePayload;
  membershipRoleChanged: MembershipRoleChangedPayload;
  membershipUpdated: MembershipUpdatePayload;
  myMembershipUpdated: MembershipUpdatePayload;
  myShoppingListsUpdated?: Maybe<ShoppingListUpdatedPayload>;
  notificationByType: NotificationPayload;
  notificationReceived: NotificationPayload;
  notificationUpdated: NotificationPayload;
  pantryActivityAdded: PantryActivity;
  pantryExpiringItemsAlert: Array<PantryItem>;
  pantryItemUsageChanged: PantryItemUsageChangedPayload;
  pantryItemsChanged: PantryItemChangedPayload;
  pantryLowStockAlert: Array<PantryItem>;
  pantryUpdated: PantryUpdatedPayload;
  pantryWasteAlert: PantryWasteAlertPayload;
  purchaseCreated: Purchase;
  purchaseDeleted: Purchase;
  purchaseUpdated: Purchase;
  riskyLoginAlerts: LoginHistory;
  shoppingListCollaboratorsChanged?: Maybe<ShoppingListCollaboratorChangedPayload>;
  shoppingListItemAdded: ShoppingListItem;
  shoppingListItemRemoved: ShoppingListItem;
  shoppingListItemUpdated: ShoppingListItem;
  shoppingListItemsChanged?: Maybe<ShoppingListItemChangedPayload>;
  shoppingListStatusChanged?: Maybe<ShoppingListStatusChangedPayload>;
  shoppingListUpdated?: Maybe<ShoppingListUpdatedPayload>;
  storeRatingChanged: Store;
  storeUpdated: Store;
  suspiciousActivity: SuspiciousActivity;
  urgentNotificationReceived: NotificationPayload;
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

export type SubscriptionNotificationByTypeArgs = {
  type: NotificationType;
};

export type SubscriptionPantryActivityAddedArgs = {
  pantryId: Scalars['ID']['input'];
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
  id: Scalars['ID']['input'];
};

export type SubscriptionPantryWasteAlertArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPurchaseCreatedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionPurchaseDeletedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionPurchaseUpdatedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionRiskyLoginAlertsArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionShoppingListCollaboratorsChangedArgs = {
  listId: Scalars['ID']['input'];
};

export type SubscriptionShoppingListItemAddedArgs = {
  shoppingListId: Scalars['ID']['input'];
};

export type SubscriptionShoppingListItemRemovedArgs = {
  shoppingListId: Scalars['ID']['input'];
};

export type SubscriptionShoppingListItemUpdatedArgs = {
  shoppingListId: Scalars['ID']['input'];
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

export type Timestamped = {
  createdAt: Scalars['DateTime']['output'];
};

export enum TrustLevel {
  Admin = 'ADMIN',
  Basic = 'BASIC',
  Moderator = 'MODERATOR',
  NewUser = 'NEW_USER',
  Trusted = 'TRUSTED',
  Verified = 'VERIFIED',
}

export type Unit = {
  __typename?: 'Unit';
  baseUnit?: Maybe<Unit>;
  baseUnitId?: Maybe<Scalars['String']['output']>;
  conversionFactor: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  derivedUnits: Array<Unit>;
  id: Scalars['ID']['output'];
  isCommon: Scalars['Boolean']['output'];
  isMetric: Scalars['Boolean']['output'];
  itemUnits: Array<ItemUnit>;
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  pantryItems: Array<PantryItem>;
  priceHistory: Array<ItemPriceHistory>;
  purchases: Array<Purchase>;
  recipeIngredients: Array<RecipeIngredient>;
  shoppingListItems: Array<ShoppingListItem>;
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
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  hasDynamicIsland?: InputMaybe<Scalars['Boolean']['input']>;
  hasNotch?: InputMaybe<Scalars['Boolean']['input']>;
  hostNames?: InputMaybe<Scalars['JSON']['input']>;
  instanceId?: InputMaybe<Scalars['String']['input']>;
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
  supportedAbis?: InputMaybe<Scalars['JSON']['input']>;
  supportedMediaTypes?: InputMaybe<Scalars['JSON']['input']>;
  systemVersion?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  totalDiskCapacity?: InputMaybe<Scalars['String']['input']>;
  totalMemory?: InputMaybe<Scalars['String']['input']>;
  usedMemory?: InputMaybe<Scalars['String']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
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
};

export type UpdateItemInput = {
  addCategoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  addStoreSkus?: InputMaybe<Array<StoreSkuInput>>;
  addTags?: InputMaybe<Array<Scalars['String']['input']>>;
  addUnits?: InputMaybe<Array<ItemUnitInput>>;
  allergens?: InputMaybe<Scalars['JSON']['input']>;
  brandId?: InputMaybe<Scalars['String']['input']>;
  brandName?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<CategoryInput>>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  defaultUnit?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayUnitId?: InputMaybe<Scalars['String']['input']>;
  displayUnitName?: InputMaybe<Scalars['String']['input']>;
  editReason?: InputMaybe<Scalars['String']['input']>;
  healthBenefits?: InputMaybe<Scalars['JSON']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  images?: InputMaybe<Scalars['JSON']['input']>;
  ingredients?: InputMaybe<Scalars['JSON']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  popularity?: InputMaybe<Scalars['Int']['input']>;
  removeCategoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  removeStoreSkuIds?: InputMaybe<Array<Scalars['String']['input']>>;
  removeTags?: InputMaybe<Array<Scalars['String']['input']>>;
  removeUnitIds?: InputMaybe<Array<Scalars['String']['input']>>;
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
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  planType?: InputMaybe<MealPlanType>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
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

export type UpdatePantryInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  temperature?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePantryItemInput = {
  autoReorderPoint?: InputMaybe<Scalars['Float']['input']>;
  bestByDate?: InputMaybe<Scalars['String']['input']>;
  condition?: InputMaybe<ItemCondition>;
  currentQuantity?: InputMaybe<Scalars['Float']['input']>;
  customCategory?: InputMaybe<Scalars['String']['input']>;
  expirationAlert?: InputMaybe<Scalars['Boolean']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  isAutoReorder?: InputMaybe<Scalars['Boolean']['input']>;
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  lowStockAlert?: InputMaybe<Scalars['Boolean']['input']>;
  openedAt?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  reservedQuantity?: InputMaybe<Scalars['Float']['input']>;
  storageLocation?: InputMaybe<Scalars['String']['input']>;
  storageNotes?: InputMaybe<Scalars['String']['input']>;
  storageState?: InputMaybe<StorageState>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  usageFrequency?: InputMaybe<UsageFrequency>;
  wasteAmount?: InputMaybe<Scalars['Float']['input']>;
  wasteReason?: InputMaybe<WasteReason>;
};

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
  dietaryTags?: InputMaybe<Array<DietaryTag>>;
  difficulty?: InputMaybe<Difficulty>;
  externalSourceData?: InputMaybe<Scalars['JSON']['input']>;
  externalSourceId?: InputMaybe<Scalars['String']['input']>;
  externalSourceUrl?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  instructions?: InputMaybe<Scalars['JSON']['input']>;
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

export type UpdateShoppingListInput = {
  autoAddSuggestions?: InputMaybe<Scalars['Boolean']['input']>;
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
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
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  storeSection?: InputMaybe<Scalars['String']['input']>;
  unitId?: InputMaybe<Scalars['ID']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateStoreInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  averageShelfLife?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  priceAccuracy?: InputMaybe<Scalars['Float']['input']>;
  qualityRating?: InputMaybe<Scalars['Float']['input']>;
  supportsPriceAPI?: InputMaybe<Scalars['Boolean']['input']>;
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

export type UpsertItemResult = {
  __typename?: 'UpsertItemResult';
  created: Scalars['Boolean']['output'];
  item: Item;
  mapping: ExternalSourceMapping;
};

export enum UsageFrequency {
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Rarely = 'RARELY',
  Seasonal = 'SEASONAL',
  Unknown = 'UNKNOWN',
  Weekly = 'WEEKLY',
}

export enum UsagePurpose {
  Cooking = 'COOKING',
  General = 'GENERAL',
  Gift = 'GIFT',
  MealPrep = 'MEAL_PREP',
  Snack = 'SNACK',
  Transfer = 'TRANSFER',
  Waste = 'WASTE',
}

export type User = {
  __typename?: 'User';
  addresses: Array<UserAddress>;
  createdAt: Scalars['DateTime']['output'];
  defaultHome?: Maybe<Home>;
  defaultHomeId?: Maybe<Scalars['String']['output']>;
  defaultShoppingListId?: Maybe<Scalars['String']['output']>;
  devices: Array<Device>;
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  homeOwnerships: Array<HomeOwnership>;
  id: Scalars['ID']['output'];
  language?: Maybe<Scalars['String']['output']>;
  lastActiveAt?: Maybe<Scalars['DateTime']['output']>;
  loginHistory: Array<LoginHistory>;
  moderation?: Maybe<UserModeration>;
  onBoarded: Scalars['Boolean']['output'];
  preferredCurrency?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<UserProfile>;
  purchases: Array<Purchase>;
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

export type UserProfile = {
  __typename?: 'UserProfile';
  avatar?: Maybe<Scalars['String']['output']>;
  bio?: Maybe<Scalars['String']['output']>;
  coverImage?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dateOfBirth?: Maybe<Scalars['String']['output']>;
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
  previousValues?: Maybe<UserProfile>;
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

export type UserSettings = {
  __typename?: 'UserSettings';
  autoSync: Scalars['Boolean']['output'];
  betaFeatures: Array<Scalars['String']['output']>;
  compactMode: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  defaultHome?: Maybe<Home>;
  emailNotifications: Scalars['Boolean']['output'];
  enabledFeatures: Array<Scalars['String']['output']>;
  expiredItemAlerts: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  lowStockAlerts: Scalars['Boolean']['output'];
  offlineMode: Scalars['Boolean']['output'];
  personalizedAds: Scalars['Boolean']['output'];
  preferredUnitSystem: UnitSystem;
  pushNotifications: Scalars['Boolean']['output'];
  recipeRecommendations: Scalars['Boolean']['output'];
  shareUsageData: Scalars['Boolean']['output'];
  shareWithPartners: Scalars['Boolean']['output'];
  shoppingListUpdates: Scalars['Boolean']['output'];
  showTutorials: Scalars['Boolean']['output'];
  smsNotifications: Scalars['Boolean']['output'];
  theme: AppTheme;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  weeklyDigest: Scalars['Boolean']['output'];
};

export type UserSocialPayload = {
  __typename?: 'UserSocialPayload';
  action: Scalars['String']['output'];
  targetUserId: Scalars['String']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export type UserStatistics = {
  __typename?: 'UserStatistics';
  averageRatingGiven?: Maybe<Scalars['Float']['output']>;
  helpfulVotesReceived: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  lastCalculatedAt: Scalars['String']['output'];
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
  previousValues?: Maybe<User>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields?: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['String']['output'];
};

export type ValidateTokenResponse = {
  __typename?: 'ValidateTokenResponse';
  email?: Maybe<Scalars['String']['output']>;
  valid: Scalars['Boolean']['output'];
};

export type ValidationError = {
  __typename?: 'ValidationError';
  code: Scalars['String']['output'];
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

export enum Visibility {
  Private = 'PRIVATE',
  Public = 'PUBLIC',
  Restricted = 'RESTRICTED',
}

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
          lastIpAddress?: string | null | undefined;
          lastCountry?: string | null | undefined;
          lastCity?: string | null | undefined;
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
        purchases: Array<{ __typename?: 'Purchase'; id: string }>;
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

export type GetMyDevicesQueryVariables = Exact<{
  filters?: InputMaybe<DeviceFiltersInput>;
}>;

export type GetMyDevicesQuery = {
  __typename?: 'Query';
  myDevices: Array<{
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
    lastIpAddress?: string | null | undefined;
    lastCountry?: string | null | undefined;
    lastCity?: string | null | undefined;
    isActive: boolean;
    isTrusted: boolean;
    isVerified: boolean;
    loginCount: number;
    lastLoginAt?: string | null | undefined;
    lastSeenAt: string;
    createdAt: string;
    updatedAt: string;
  }>;
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
  updateDeviceLastSeen: {
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
  trustDevice: {
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
  untrustDevice: {
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
  verifyDevice: {
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
  deactivateDevice: {
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
    lastIpAddress?: string | null | undefined;
    lastCountry?: string | null | undefined;
    lastCity?: string | null | undefined;
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
    ipAddress?: string | null | undefined;
    ipCountry?: string | null | undefined;
    ipRegion?: string | null | undefined;
    ipCity?: string | null | undefined;
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
      ipAddress?: string | null | undefined;
      ipCountry?: string | null | undefined;
      riskScore?: number | null | undefined;
      riskFactors: Array<RiskFactor>;
      loggedInAt: string;
    }>;
    newLocationLogins?:
      | Array<{
          __typename?: 'LoginHistory';
          id: string;
          ipAddress?: string | null | undefined;
          ipCountry?: string | null | undefined;
          ipCity?: string | null | undefined;
          loggedInAt: string;
        }>
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
    failedFromSameIP?:
      | Array<{
          __typename?: 'FailedIPStat';
          ipAddress?: string | null | undefined;
          count: number;
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
    multipleAccountsFromIP?:
      | Array<{
          __typename?: 'FailedIPStat';
          ipAddress?: string | null | undefined;
          count: number;
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
    ipAddress?: string | null | undefined;
    ipCountry?: string | null | undefined;
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
    ipAddress?: string | null | undefined;
    ipCountry?: string | null | undefined;
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
          | {
              __typename?: 'UserSettings';
              id: string;
              emailNotifications: boolean;
              pushNotifications: boolean;
              theme: AppTheme;
            }
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
        emailNotifications: boolean;
        pushNotifications: boolean;
        smsNotifications: boolean;
        weeklyDigest: boolean;
        expiredItemAlerts: boolean;
        lowStockAlerts: boolean;
        shoppingListUpdates: boolean;
        recipeRecommendations: boolean;
        theme: AppTheme;
        compactMode: boolean;
        showTutorials: boolean;
        autoSync: boolean;
        offlineMode: boolean;
        shareUsageData: boolean;
        shareWithPartners: boolean;
        personalizedAds: boolean;
        enabledFeatures: Array<string>;
        betaFeatures: Array<string>;
        createdAt: string;
        updatedAt: string;
        user: { __typename?: 'User'; id: string; email: string };
        defaultHome?:
          | { __typename?: 'Home'; id: string; name: string }
          | null
          | undefined;
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
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
    weeklyDigest: boolean;
    expiredItemAlerts: boolean;
    lowStockAlerts: boolean;
    shoppingListUpdates: boolean;
    recipeRecommendations: boolean;
    theme: AppTheme;
    compactMode: boolean;
    showTutorials: boolean;
    autoSync: boolean;
    offlineMode: boolean;
    shareUsageData: boolean;
    shareWithPartners: boolean;
    personalizedAds: boolean;
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
    previousValues?:
      | {
          __typename?: 'User';
          email: string;
          role: UserRole;
          timezone?: string | null | undefined;
          preferredCurrency?: string | null | undefined;
          language?: string | null | undefined;
        }
      | null
      | undefined;
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
    previousValues?:
      | {
          __typename?: 'UserProfile';
          firstName?: string | null | undefined;
          lastName?: string | null | undefined;
          displayName?: string | null | undefined;
          bio?: string | null | undefined;
          avatar?: string | null | undefined;
        }
      | null
      | undefined;
  };
};

export type ShoppingListItemFragmentFragment = {
  __typename?: 'ShoppingListItem';
  id: string;
  quantity?: number | null | undefined;
  estimatedPrice?: number | null | undefined;
  budgetPrice?: number | null | undefined;
  lastKnownPrice?: number | null | undefined;
  lowestPrice?: number | null | undefined;
  highestPrice?: number | null | undefined;
  priceLastUpdated?: string | null | undefined;
  isPurchased: boolean;
  purchasedQuantity?: number | null | undefined;
  purchasedPrice?: number | null | undefined;
  purchaseDate?: string | null | undefined;
  aisle?: string | null | undefined;
  storeSection?: string | null | undefined;
  previouslyPurchased: boolean;
  lastPurchaseDate?: string | null | undefined;
  purchaseCount: number;
  itemName?: string | null | undefined;
  unitName?: string | null | undefined;
  notes?: string | null | undefined;
  priority: number;
  category?: string | null | undefined;
  sortOrder: number;
  isAutoAdded: boolean;
  autoAddReason?: string | null | undefined;
  isFromMealPlan: boolean;
  mealPlanReference?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null | undefined;
  version: number;
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
      }
    | null
    | undefined;
  unit?:
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
      }
    | null
    | undefined;
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
              emailNotifications: boolean;
              pushNotifications: boolean;
              theme: AppTheme;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
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
              emailNotifications: boolean;
              pushNotifications: boolean;
              theme: AppTheme;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
  purchases?:
    | Array<{
        __typename?: 'Purchase';
        id: string;
        purchaseDate: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        itemName: string;
        unitSymbol: string;
        user: {
          __typename?: 'User';
          id: string;
          email: string;
          profile?:
            | {
                __typename?: 'UserProfile';
                id: string;
                displayName?: string | null | undefined;
              }
            | null
            | undefined;
        };
      }>
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
    | {
        __typename?: 'UserSettings';
        id: string;
        emailNotifications: boolean;
        pushNotifications: boolean;
        theme: AppTheme;
      }
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
    lastIpAddress?: string | null | undefined;
    lastCountry?: string | null | undefined;
    lastCity?: string | null | undefined;
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
  purchases: Array<{ __typename?: 'Purchase'; id: string }>;
  shoppingListOwnerships: Array<{
    __typename?: 'ShoppingListOwnership';
    createdAt: string;
    id: string;
    transferredAt?: string | null | undefined;
    transferredFrom?: string | null | undefined;
    shoppingList: { __typename?: 'ShoppingList'; id: string };
  }>;
};

export type UnitFragmentFragment = {
  __typename?: 'ItemUnit';
  id: string;
  itemId: string;
  unitId: string;
  isDefault?: boolean | null | undefined;
  isPreferred: boolean;
  isCommon: boolean;
  conversionRatio?: number | null | undefined;
  conversionNote?: string | null | undefined;
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
  brand?:
    | {
        __typename?: 'Brand';
        id: string;
        name: string;
        description?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        version: number;
      }
    | null
    | undefined;
};

export type CategoryFragmentFragment = {
  __typename?: 'Category';
  id: string;
  name: string;
  slug?: string | null | undefined;
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
  updatedAt?: string | null | undefined;
  deletedAt?: string | null | undefined;
  version: number;
};

export type ItemFragmentFragment = {
  __typename?: 'Item';
  id: string;
  name: string;
  description?: string | null | undefined;
  dataSource: DataSource;
  type: ItemType;
  storageState: StorageState;
  showInOnboarding: boolean;
  shelfLifeDays?: number | null | undefined;
  popularity: number;
  status: ItemStatus;
  visibility: Visibility;
  imageUrl?: string | null | undefined;
  tags: Array<string>;
  healthBenefits?: any | null | undefined;
  allergens?: any | null | undefined;
  nutritions?: any | null | undefined;
  metadata?: any | null | undefined;
  ingredients?: any | null | undefined;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null | undefined;
  version: number;
  netWeight?: number | null | undefined;
  displayUnit?:
    | { __typename?: 'Unit'; id: string; name: string; symbol: string }
    | null
    | undefined;
  units: Array<{
    __typename?: 'ItemUnit';
    id: string;
    itemId: string;
    unitId: string;
    isDefault?: boolean | null | undefined;
    isPreferred: boolean;
    isCommon: boolean;
    conversionRatio?: number | null | undefined;
    conversionNote?: string | null | undefined;
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
    brand?:
      | {
          __typename?: 'Brand';
          id: string;
          name: string;
          description?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
          version: number;
        }
      | null
      | undefined;
  }>;
  categories?:
    | Array<{
        __typename?: 'ItemCategory';
        id: string;
        source: CategorySource;
        confidence: number;
        isPrimary: boolean;
        createdAt: string;
        assignedAt?: string | null | undefined;
        category: {
          __typename?: 'Category';
          id: string;
          name: string;
          slug?: string | null | undefined;
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
          updatedAt?: string | null | undefined;
          deletedAt?: string | null | undefined;
          version: number;
        };
      }>
    | null
    | undefined;
  creations: Array<{
    __typename?: 'ItemCreation';
    id: string;
    source: DataSource;
    reason?: string | null | undefined;
    metadata?: any | null | undefined;
    createdAt: string;
  }>;
  edits: Array<{
    __typename?: 'ItemEdit';
    id: string;
    fieldsChanged: Array<string>;
    oldValues?: any | null | undefined;
    newValues?: any | null | undefined;
    editReason?: string | null | undefined;
    createdAt: string;
  }>;
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

export type PantryItemFragmentFragment = {
  __typename?: 'PantryItem';
  id: string;
  pantryId: string;
  itemId: string;
  itemName: string;
  unitName?: string | null | undefined;
  unitId?: string | null | undefined;
  expiresAt?: string | null | undefined;
  storageLocation?: string | null | undefined;
  storageState: StorageState;
  storageNotes?: string | null | undefined;
  initialQuantity: number;
  currentQuantity: number;
  consumedQuantity: number;
  reservedQuantity: number;
  autoReorderPoint?: number | null | undefined;
  isAutoReorder: boolean;
  customCategory?: string | null | undefined;
  createdAt: string;
  updatedAt?: string | null | undefined;
  version: number;
  tags: Array<string>;
  item: {
    __typename?: 'Item';
    id: string;
    name: string;
    description?: string | null | undefined;
    dataSource: DataSource;
    type: ItemType;
    storageState: StorageState;
    showInOnboarding: boolean;
    shelfLifeDays?: number | null | undefined;
    popularity: number;
    status: ItemStatus;
    visibility: Visibility;
    imageUrl?: string | null | undefined;
    tags: Array<string>;
    healthBenefits?: any | null | undefined;
    allergens?: any | null | undefined;
    nutritions?: any | null | undefined;
    metadata?: any | null | undefined;
    ingredients?: any | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    version: number;
    netWeight?: number | null | undefined;
    displayUnit?:
      | { __typename?: 'Unit'; id: string; name: string; symbol: string }
      | null
      | undefined;
    units: Array<{
      __typename?: 'ItemUnit';
      id: string;
      itemId: string;
      unitId: string;
      isDefault?: boolean | null | undefined;
      isPreferred: boolean;
      isCommon: boolean;
      conversionRatio?: number | null | undefined;
      conversionNote?: string | null | undefined;
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
      brand?:
        | {
            __typename?: 'Brand';
            id: string;
            name: string;
            description?: string | null | undefined;
            createdAt: string;
            updatedAt: string;
            version: number;
          }
        | null
        | undefined;
    }>;
    categories?:
      | Array<{
          __typename?: 'ItemCategory';
          id: string;
          source: CategorySource;
          confidence: number;
          isPrimary: boolean;
          createdAt: string;
          assignedAt?: string | null | undefined;
          category: {
            __typename?: 'Category';
            id: string;
            name: string;
            slug?: string | null | undefined;
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
            updatedAt?: string | null | undefined;
            deletedAt?: string | null | undefined;
            version: number;
          };
        }>
      | null
      | undefined;
    creations: Array<{
      __typename?: 'ItemCreation';
      id: string;
      source: DataSource;
      reason?: string | null | undefined;
      metadata?: any | null | undefined;
      createdAt: string;
    }>;
    edits: Array<{
      __typename?: 'ItemEdit';
      id: string;
      fieldsChanged: Array<string>;
      oldValues?: any | null | undefined;
      newValues?: any | null | undefined;
      editReason?: string | null | undefined;
      createdAt: string;
    }>;
  };
  unit?:
    | {
        __typename?: 'Unit';
        id: string;
        name: string;
        symbol: string;
        type: UnitType;
        isMetric: boolean;
        baseUnitId?: string | null | undefined;
        conversionFactor: number;
        isCommon: boolean;
      }
    | null
    | undefined;
  usageRecords: Array<{
    __typename?: 'PantryItemUsage';
    id: string;
    pantryItemId: string;
    quantityUsed: number;
    usedById: string;
    usedAt: string;
    purpose: UsagePurpose;
    notes?: string | null | undefined;
    cookingLogId?: string | null | undefined;
    mealPlanItemId?: string | null | undefined;
    recipeId?: string | null | undefined;
    usedBy: { __typename?: 'User'; id: string };
  }>;
};

export type HomeInviteFragmentFragment = {
  __typename?: 'HomeInvite';
  id: string;
  email: string;
  token: string;
  homeId: string;
  invitedUserId?: string | null | undefined;
  recipientName?: string | null | undefined;
  role: MembershipRole;
  customPermissions?: any | null | undefined;
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
      | {
          __typename?: 'UserSettings';
          id: string;
          emailNotifications: boolean;
          pushNotifications: boolean;
          theme: AppTheme;
        }
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
  updatedAt?: string | null | undefined;
  items?:
    | Array<{
        __typename?: 'PantryItem';
        id: string;
        pantryId: string;
        itemId: string;
        itemName: string;
        unitName?: string | null | undefined;
        unitId?: string | null | undefined;
        expiresAt?: string | null | undefined;
        storageLocation?: string | null | undefined;
        storageState: StorageState;
        storageNotes?: string | null | undefined;
        initialQuantity: number;
        currentQuantity: number;
        consumedQuantity: number;
        reservedQuantity: number;
        autoReorderPoint?: number | null | undefined;
        isAutoReorder: boolean;
        customCategory?: string | null | undefined;
        createdAt: string;
        updatedAt?: string | null | undefined;
        version: number;
        tags: Array<string>;
        item: {
          __typename?: 'Item';
          id: string;
          name: string;
          description?: string | null | undefined;
          dataSource: DataSource;
          type: ItemType;
          storageState: StorageState;
          showInOnboarding: boolean;
          shelfLifeDays?: number | null | undefined;
          popularity: number;
          status: ItemStatus;
          visibility: Visibility;
          imageUrl?: string | null | undefined;
          tags: Array<string>;
          healthBenefits?: any | null | undefined;
          allergens?: any | null | undefined;
          nutritions?: any | null | undefined;
          metadata?: any | null | undefined;
          ingredients?: any | null | undefined;
          createdAt: string;
          updatedAt: string;
          deletedAt?: string | null | undefined;
          version: number;
          netWeight?: number | null | undefined;
          displayUnit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          units: Array<{
            __typename?: 'ItemUnit';
            id: string;
            itemId: string;
            unitId: string;
            isDefault?: boolean | null | undefined;
            isPreferred: boolean;
            isCommon: boolean;
            conversionRatio?: number | null | undefined;
            conversionNote?: string | null | undefined;
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
            brand?:
              | {
                  __typename?: 'Brand';
                  id: string;
                  name: string;
                  description?: string | null | undefined;
                  createdAt: string;
                  updatedAt: string;
                  version: number;
                }
              | null
              | undefined;
          }>;
          categories?:
            | Array<{
                __typename?: 'ItemCategory';
                id: string;
                source: CategorySource;
                confidence: number;
                isPrimary: boolean;
                createdAt: string;
                assignedAt?: string | null | undefined;
                category: {
                  __typename?: 'Category';
                  id: string;
                  name: string;
                  slug?: string | null | undefined;
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
                  updatedAt?: string | null | undefined;
                  deletedAt?: string | null | undefined;
                  version: number;
                };
              }>
            | null
            | undefined;
          creations: Array<{
            __typename?: 'ItemCreation';
            id: string;
            source: DataSource;
            reason?: string | null | undefined;
            metadata?: any | null | undefined;
            createdAt: string;
          }>;
          edits: Array<{
            __typename?: 'ItemEdit';
            id: string;
            fieldsChanged: Array<string>;
            oldValues?: any | null | undefined;
            newValues?: any | null | undefined;
            editReason?: string | null | undefined;
            createdAt: string;
          }>;
        };
        unit?:
          | {
              __typename?: 'Unit';
              id: string;
              name: string;
              symbol: string;
              type: UnitType;
              isMetric: boolean;
              baseUnitId?: string | null | undefined;
              conversionFactor: number;
              isCommon: boolean;
            }
          | null
          | undefined;
        usageRecords: Array<{
          __typename?: 'PantryItemUsage';
          id: string;
          pantryItemId: string;
          quantityUsed: number;
          usedById: string;
          usedAt: string;
          purpose: UsagePurpose;
          notes?: string | null | undefined;
          cookingLogId?: string | null | undefined;
          mealPlanItemId?: string | null | undefined;
          recipeId?: string | null | undefined;
          usedBy: { __typename?: 'User'; id: string };
        }>;
      }>
    | null
    | undefined;
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
  updatedAt?: string | null | undefined;
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
  invites?:
    | Array<{
        __typename?: 'HomeInvite';
        id: string;
        email: string;
        token: string;
        homeId: string;
        invitedUserId?: string | null | undefined;
        recipientName?: string | null | undefined;
        role: MembershipRole;
        customPermissions?: any | null | undefined;
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
      }>
    | null
    | undefined;
  members: Array<{
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
        | {
            __typename?: 'UserSettings';
            id: string;
            emailNotifications: boolean;
            pushNotifications: boolean;
            theme: AppTheme;
          }
        | null
        | undefined;
    };
  }>;
  myMembership?:
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
            | {
                __typename?: 'UserSettings';
                id: string;
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        };
      }
    | null
    | undefined;
  membershipStats: {
    __typename?: 'MembershipStats';
    total: number;
    active: number;
    recentlyActive: number;
    byRole: {
      __typename?: 'MembershipRoleStats';
      OWNER: number;
      ADMIN: number;
      MEMBER: number;
      GUEST: number;
    };
    byStatus: {
      __typename?: 'MembershipStatusStats';
      ACTIVE: number;
      SUSPENDED: number;
      LEFT: number;
      REMOVED: number;
    };
  };
  pantries?:
    | Array<{
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
        updatedAt?: string | null | undefined;
      }>
    | null
    | undefined;
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
  invites?:
    | Array<{
        __typename?: 'HomeInvite';
        id: string;
        email: string;
        token: string;
        homeId: string;
        invitedUserId?: string | null | undefined;
        recipientName?: string | null | undefined;
        role: MembershipRole;
        customPermissions?: any | null | undefined;
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
      }>
    | null
    | undefined;
  members: Array<{
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
        | {
            __typename?: 'UserSettings';
            id: string;
            emailNotifications: boolean;
            pushNotifications: boolean;
            theme: AppTheme;
          }
        | null
        | undefined;
    };
  }>;
  myMembership?:
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
            | {
                __typename?: 'UserSettings';
                id: string;
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        };
      }
    | null
    | undefined;
  membershipStats: {
    __typename?: 'MembershipStats';
    total: number;
    active: number;
    recentlyActive: number;
    byRole: {
      __typename?: 'MembershipRoleStats';
      OWNER: number;
      ADMIN: number;
      MEMBER: number;
      GUEST: number;
    };
    byStatus: {
      __typename?: 'MembershipStatusStats';
      ACTIVE: number;
      SUSPENDED: number;
      LEFT: number;
      REMOVED: number;
    };
  };
  pantries?:
    | Array<{
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
        updatedAt?: string | null | undefined;
        items?:
          | Array<{
              __typename?: 'PantryItem';
              id: string;
              pantryId: string;
              itemId: string;
              itemName: string;
              unitName?: string | null | undefined;
              unitId?: string | null | undefined;
              expiresAt?: string | null | undefined;
              storageLocation?: string | null | undefined;
              storageState: StorageState;
              storageNotes?: string | null | undefined;
              initialQuantity: number;
              currentQuantity: number;
              consumedQuantity: number;
              reservedQuantity: number;
              autoReorderPoint?: number | null | undefined;
              isAutoReorder: boolean;
              customCategory?: string | null | undefined;
              createdAt: string;
              updatedAt?: string | null | undefined;
              version: number;
              tags: Array<string>;
              item: {
                __typename?: 'Item';
                id: string;
                name: string;
                description?: string | null | undefined;
                dataSource: DataSource;
                type: ItemType;
                storageState: StorageState;
                showInOnboarding: boolean;
                shelfLifeDays?: number | null | undefined;
                popularity: number;
                status: ItemStatus;
                visibility: Visibility;
                imageUrl?: string | null | undefined;
                tags: Array<string>;
                healthBenefits?: any | null | undefined;
                allergens?: any | null | undefined;
                nutritions?: any | null | undefined;
                metadata?: any | null | undefined;
                ingredients?: any | null | undefined;
                createdAt: string;
                updatedAt: string;
                deletedAt?: string | null | undefined;
                version: number;
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
                units: Array<{
                  __typename?: 'ItemUnit';
                  id: string;
                  itemId: string;
                  unitId: string;
                  isDefault?: boolean | null | undefined;
                  isPreferred: boolean;
                  isCommon: boolean;
                  conversionRatio?: number | null | undefined;
                  conversionNote?: string | null | undefined;
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
                  brand?:
                    | {
                        __typename?: 'Brand';
                        id: string;
                        name: string;
                        description?: string | null | undefined;
                        createdAt: string;
                        updatedAt: string;
                        version: number;
                      }
                    | null
                    | undefined;
                }>;
                categories?:
                  | Array<{
                      __typename?: 'ItemCategory';
                      id: string;
                      source: CategorySource;
                      confidence: number;
                      isPrimary: boolean;
                      createdAt: string;
                      assignedAt?: string | null | undefined;
                      category: {
                        __typename?: 'Category';
                        id: string;
                        name: string;
                        slug?: string | null | undefined;
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
                        updatedAt?: string | null | undefined;
                        deletedAt?: string | null | undefined;
                        version: number;
                      };
                    }>
                  | null
                  | undefined;
                creations: Array<{
                  __typename?: 'ItemCreation';
                  id: string;
                  source: DataSource;
                  reason?: string | null | undefined;
                  metadata?: any | null | undefined;
                  createdAt: string;
                }>;
                edits: Array<{
                  __typename?: 'ItemEdit';
                  id: string;
                  fieldsChanged: Array<string>;
                  oldValues?: any | null | undefined;
                  newValues?: any | null | undefined;
                  editReason?: string | null | undefined;
                  createdAt: string;
                }>;
              };
              unit?:
                | {
                    __typename?: 'Unit';
                    id: string;
                    name: string;
                    symbol: string;
                    type: UnitType;
                    isMetric: boolean;
                    baseUnitId?: string | null | undefined;
                    conversionFactor: number;
                    isCommon: boolean;
                  }
                | null
                | undefined;
              usageRecords: Array<{
                __typename?: 'PantryItemUsage';
                id: string;
                pantryItemId: string;
                quantityUsed: number;
                usedById: string;
                usedAt: string;
                purpose: UsagePurpose;
                notes?: string | null | undefined;
                cookingLogId?: string | null | undefined;
                mealPlanItemId?: string | null | undefined;
                recipeId?: string | null | undefined;
                usedBy: { __typename?: 'User'; id: string };
              }>;
            }>
          | null
          | undefined;
      }>
    | null
    | undefined;
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
  user: {
    __typename?: 'User';
    id: string;
    email: string;
    profile?:
      | {
          __typename?: 'UserProfile';
          id: string;
          displayName?: string | null | undefined;
        }
      | null
      | undefined;
  };
};

export type RecipeIngredientFragmentFragment = {
  __typename?: 'RecipeIngredient';
  id: string;
  name: string;
  quantity: number;
  spoonacularIngredientId?: number | null | undefined;
  aisle?: string | null | undefined;
  consistency?: string | null | undefined;
  originalString?: string | null | undefined;
  metricAmount?: number | null | undefined;
  metricUnit?: string | null | undefined;
  usAmount?: number | null | undefined;
  usUnit?: string | null | undefined;
  meta: Array<string>;
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
  dietaryTags: Array<DietaryTag>;
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
    spoonacularIngredientId?: number | null | undefined;
    aisle?: string | null | undefined;
    consistency?: string | null | undefined;
    originalString?: string | null | undefined;
    metricAmount?: number | null | undefined;
    metricUnit?: string | null | undefined;
    usAmount?: number | null | undefined;
    usUnit?: string | null | undefined;
    meta: Array<string>;
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
        invites?:
          | Array<{
              __typename?: 'HomeInvite';
              id: string;
              email: string;
              token: string;
              homeId: string;
              invitedUserId?: string | null | undefined;
              recipientName?: string | null | undefined;
              role: MembershipRole;
              customPermissions?: any | null | undefined;
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
            }>
          | null
          | undefined;
        members: Array<{
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
              | {
                  __typename?: 'UserSettings';
                  id: string;
                  emailNotifications: boolean;
                  pushNotifications: boolean;
                  theme: AppTheme;
                }
              | null
              | undefined;
          };
        }>;
        myMembership?:
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
                  | {
                      __typename?: 'UserSettings';
                      id: string;
                      emailNotifications: boolean;
                      pushNotifications: boolean;
                      theme: AppTheme;
                    }
                  | null
                  | undefined;
              };
            }
          | null
          | undefined;
        membershipStats: {
          __typename?: 'MembershipStats';
          total: number;
          active: number;
          recentlyActive: number;
          byRole: {
            __typename?: 'MembershipRoleStats';
            OWNER: number;
            ADMIN: number;
            MEMBER: number;
            GUEST: number;
          };
          byStatus: {
            __typename?: 'MembershipStatusStats';
            ACTIVE: number;
            SUSPENDED: number;
            LEFT: number;
            REMOVED: number;
          };
        };
        pantries?:
          | Array<{
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
              updatedAt?: string | null | undefined;
              items?:
                | Array<{
                    __typename?: 'PantryItem';
                    id: string;
                    pantryId: string;
                    itemId: string;
                    itemName: string;
                    unitName?: string | null | undefined;
                    unitId?: string | null | undefined;
                    expiresAt?: string | null | undefined;
                    storageLocation?: string | null | undefined;
                    storageState: StorageState;
                    storageNotes?: string | null | undefined;
                    initialQuantity: number;
                    currentQuantity: number;
                    consumedQuantity: number;
                    reservedQuantity: number;
                    autoReorderPoint?: number | null | undefined;
                    isAutoReorder: boolean;
                    customCategory?: string | null | undefined;
                    createdAt: string;
                    updatedAt?: string | null | undefined;
                    version: number;
                    tags: Array<string>;
                    item: {
                      __typename?: 'Item';
                      id: string;
                      name: string;
                      description?: string | null | undefined;
                      dataSource: DataSource;
                      type: ItemType;
                      storageState: StorageState;
                      showInOnboarding: boolean;
                      shelfLifeDays?: number | null | undefined;
                      popularity: number;
                      status: ItemStatus;
                      visibility: Visibility;
                      imageUrl?: string | null | undefined;
                      tags: Array<string>;
                      healthBenefits?: any | null | undefined;
                      allergens?: any | null | undefined;
                      nutritions?: any | null | undefined;
                      metadata?: any | null | undefined;
                      ingredients?: any | null | undefined;
                      createdAt: string;
                      updatedAt: string;
                      deletedAt?: string | null | undefined;
                      version: number;
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
                      units: Array<{
                        __typename?: 'ItemUnit';
                        id: string;
                        itemId: string;
                        unitId: string;
                        isDefault?: boolean | null | undefined;
                        isPreferred: boolean;
                        isCommon: boolean;
                        conversionRatio?: number | null | undefined;
                        conversionNote?: string | null | undefined;
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
                        brand?:
                          | {
                              __typename?: 'Brand';
                              id: string;
                              name: string;
                              description?: string | null | undefined;
                              createdAt: string;
                              updatedAt: string;
                              version: number;
                            }
                          | null
                          | undefined;
                      }>;
                      categories?:
                        | Array<{
                            __typename?: 'ItemCategory';
                            id: string;
                            source: CategorySource;
                            confidence: number;
                            isPrimary: boolean;
                            createdAt: string;
                            assignedAt?: string | null | undefined;
                            category: {
                              __typename?: 'Category';
                              id: string;
                              name: string;
                              slug?: string | null | undefined;
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
                              updatedAt?: string | null | undefined;
                              deletedAt?: string | null | undefined;
                              version: number;
                            };
                          }>
                        | null
                        | undefined;
                      creations: Array<{
                        __typename?: 'ItemCreation';
                        id: string;
                        source: DataSource;
                        reason?: string | null | undefined;
                        metadata?: any | null | undefined;
                        createdAt: string;
                      }>;
                      edits: Array<{
                        __typename?: 'ItemEdit';
                        id: string;
                        fieldsChanged: Array<string>;
                        oldValues?: any | null | undefined;
                        newValues?: any | null | undefined;
                        editReason?: string | null | undefined;
                        createdAt: string;
                      }>;
                    };
                    unit?:
                      | {
                          __typename?: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                          type: UnitType;
                          isMetric: boolean;
                          baseUnitId?: string | null | undefined;
                          conversionFactor: number;
                          isCommon: boolean;
                        }
                      | null
                      | undefined;
                    usageRecords: Array<{
                      __typename?: 'PantryItemUsage';
                      id: string;
                      pantryItemId: string;
                      quantityUsed: number;
                      usedById: string;
                      usedAt: string;
                      purpose: UsagePurpose;
                      notes?: string | null | undefined;
                      cookingLogId?: string | null | undefined;
                      mealPlanItemId?: string | null | undefined;
                      recipeId?: string | null | undefined;
                      usedBy: { __typename?: 'User'; id: string };
                    }>;
                  }>
                | null
                | undefined;
            }>
          | null
          | undefined;
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
        invites?:
          | Array<{
              __typename?: 'HomeInvite';
              id: string;
              email: string;
              token: string;
              homeId: string;
              invitedUserId?: string | null | undefined;
              recipientName?: string | null | undefined;
              role: MembershipRole;
              customPermissions?: any | null | undefined;
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
            }>
          | null
          | undefined;
        members: Array<{
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
              | {
                  __typename?: 'UserSettings';
                  id: string;
                  emailNotifications: boolean;
                  pushNotifications: boolean;
                  theme: AppTheme;
                }
              | null
              | undefined;
          };
        }>;
        myMembership?:
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
                  | {
                      __typename?: 'UserSettings';
                      id: string;
                      emailNotifications: boolean;
                      pushNotifications: boolean;
                      theme: AppTheme;
                    }
                  | null
                  | undefined;
              };
            }
          | null
          | undefined;
        membershipStats: {
          __typename?: 'MembershipStats';
          total: number;
          active: number;
          recentlyActive: number;
          byRole: {
            __typename?: 'MembershipRoleStats';
            OWNER: number;
            ADMIN: number;
            MEMBER: number;
            GUEST: number;
          };
          byStatus: {
            __typename?: 'MembershipStatusStats';
            ACTIVE: number;
            SUSPENDED: number;
            LEFT: number;
            REMOVED: number;
          };
        };
        pantries?:
          | Array<{
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
              updatedAt?: string | null | undefined;
            }>
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type GetHomesQueryVariables = Exact<{ [key: string]: never }>;

export type GetHomesQuery = {
  __typename?: 'Query';
  homes: Array<{
    __typename?: 'Home';
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    pantries?:
      | Array<{
          __typename?: 'Pantry';
          id: string;
          name: string;
          isDefault: boolean;
        }>
      | null
      | undefined;
    members: Array<{
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
              emailNotifications: boolean;
              pushNotifications: boolean;
              theme: AppTheme;
            }
          | null
          | undefined;
      };
    }>;
    myMembership?:
      | {
          __typename?: 'Membership';
          id: string;
          role: MembershipRole;
          status: MembershipStatus;
          displayName?: string | null | undefined;
          canViewPantry: boolean;
          canEditPantry: boolean;
          canAddItems: boolean;
          canRemoveItems: boolean;
          canInviteOthers: boolean;
          canManageHome: boolean;
        }
      | null
      | undefined;
  }>;
};

export type GetHomeInvitesQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type GetHomeInvitesQuery = {
  __typename?: 'Query';
  homeInvites: Array<{
    __typename?: 'HomeInvite';
    id: string;
    email: string;
    token: string;
    homeId: string;
    invitedUserId?: string | null | undefined;
    recipientName?: string | null | undefined;
    role: MembershipRole;
    customPermissions?: any | null | undefined;
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

export type GetMyPendingInvitesQueryVariables = Exact<{ [key: string]: never }>;

export type GetMyPendingInvitesQuery = {
  __typename?: 'Query';
  myPendingInvites: Array<{
    __typename?: 'HomeInvite';
    id: string;
    email: string;
    token: string;
    homeId: string;
    invitedUserId?: string | null | undefined;
    recipientName?: string | null | undefined;
    role: MembershipRole;
    customPermissions?: any | null | undefined;
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

export type CreateHomeMutationVariables = Exact<{
  input: CreateHomeInput;
}>;

export type CreateHomeMutation = {
  __typename?: 'Mutation';
  createHome: {
    __typename?: 'Home';
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    pantries?:
      | Array<{
          __typename?: 'Pantry';
          id: string;
          name: string;
          isDefault: boolean;
        }>
      | null
      | undefined;
    members: Array<{
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
              emailNotifications: boolean;
              pushNotifications: boolean;
              theme: AppTheme;
            }
          | null
          | undefined;
      };
    }>;
    myMembership?:
      | {
          __typename?: 'Membership';
          id: string;
          role: MembershipRole;
          status: MembershipStatus;
          displayName?: string | null | undefined;
          canViewPantry: boolean;
          canEditPantry: boolean;
          canAddItems: boolean;
          canRemoveItems: boolean;
          canInviteOthers: boolean;
          canManageHome: boolean;
        }
      | null
      | undefined;
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
    invites?:
      | Array<{
          __typename?: 'HomeInvite';
          id: string;
          email: string;
          token: string;
          homeId: string;
          invitedUserId?: string | null | undefined;
          recipientName?: string | null | undefined;
          role: MembershipRole;
          customPermissions?: any | null | undefined;
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
        }>
      | null
      | undefined;
    members: Array<{
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
          | {
              __typename?: 'UserSettings';
              id: string;
              emailNotifications: boolean;
              pushNotifications: boolean;
              theme: AppTheme;
            }
          | null
          | undefined;
      };
    }>;
    myMembership?:
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
              | {
                  __typename?: 'UserSettings';
                  id: string;
                  emailNotifications: boolean;
                  pushNotifications: boolean;
                  theme: AppTheme;
                }
              | null
              | undefined;
          };
        }
      | null
      | undefined;
    membershipStats: {
      __typename?: 'MembershipStats';
      total: number;
      active: number;
      recentlyActive: number;
      byRole: {
        __typename?: 'MembershipRoleStats';
        OWNER: number;
        ADMIN: number;
        MEMBER: number;
        GUEST: number;
      };
      byStatus: {
        __typename?: 'MembershipStatusStats';
        ACTIVE: number;
        SUSPENDED: number;
        LEFT: number;
        REMOVED: number;
      };
    };
    pantries?:
      | Array<{
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
          updatedAt?: string | null | undefined;
          items?:
            | Array<{
                __typename?: 'PantryItem';
                id: string;
                pantryId: string;
                itemId: string;
                itemName: string;
                unitName?: string | null | undefined;
                unitId?: string | null | undefined;
                expiresAt?: string | null | undefined;
                storageLocation?: string | null | undefined;
                storageState: StorageState;
                storageNotes?: string | null | undefined;
                initialQuantity: number;
                currentQuantity: number;
                consumedQuantity: number;
                reservedQuantity: number;
                autoReorderPoint?: number | null | undefined;
                isAutoReorder: boolean;
                customCategory?: string | null | undefined;
                createdAt: string;
                updatedAt?: string | null | undefined;
                version: number;
                tags: Array<string>;
                item: {
                  __typename?: 'Item';
                  id: string;
                  name: string;
                  description?: string | null | undefined;
                  dataSource: DataSource;
                  type: ItemType;
                  storageState: StorageState;
                  showInOnboarding: boolean;
                  shelfLifeDays?: number | null | undefined;
                  popularity: number;
                  status: ItemStatus;
                  visibility: Visibility;
                  imageUrl?: string | null | undefined;
                  tags: Array<string>;
                  healthBenefits?: any | null | undefined;
                  allergens?: any | null | undefined;
                  nutritions?: any | null | undefined;
                  metadata?: any | null | undefined;
                  ingredients?: any | null | undefined;
                  createdAt: string;
                  updatedAt: string;
                  deletedAt?: string | null | undefined;
                  version: number;
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
                  units: Array<{
                    __typename?: 'ItemUnit';
                    id: string;
                    itemId: string;
                    unitId: string;
                    isDefault?: boolean | null | undefined;
                    isPreferred: boolean;
                    isCommon: boolean;
                    conversionRatio?: number | null | undefined;
                    conversionNote?: string | null | undefined;
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
                    brand?:
                      | {
                          __typename?: 'Brand';
                          id: string;
                          name: string;
                          description?: string | null | undefined;
                          createdAt: string;
                          updatedAt: string;
                          version: number;
                        }
                      | null
                      | undefined;
                  }>;
                  categories?:
                    | Array<{
                        __typename?: 'ItemCategory';
                        id: string;
                        source: CategorySource;
                        confidence: number;
                        isPrimary: boolean;
                        createdAt: string;
                        assignedAt?: string | null | undefined;
                        category: {
                          __typename?: 'Category';
                          id: string;
                          name: string;
                          slug?: string | null | undefined;
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
                          updatedAt?: string | null | undefined;
                          deletedAt?: string | null | undefined;
                          version: number;
                        };
                      }>
                    | null
                    | undefined;
                  creations: Array<{
                    __typename?: 'ItemCreation';
                    id: string;
                    source: DataSource;
                    reason?: string | null | undefined;
                    metadata?: any | null | undefined;
                    createdAt: string;
                  }>;
                  edits: Array<{
                    __typename?: 'ItemEdit';
                    id: string;
                    fieldsChanged: Array<string>;
                    oldValues?: any | null | undefined;
                    newValues?: any | null | undefined;
                    editReason?: string | null | undefined;
                    createdAt: string;
                  }>;
                };
                unit?:
                  | {
                      __typename?: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                      type: UnitType;
                      isMetric: boolean;
                      baseUnitId?: string | null | undefined;
                      conversionFactor: number;
                      isCommon: boolean;
                    }
                  | null
                  | undefined;
                usageRecords: Array<{
                  __typename?: 'PantryItemUsage';
                  id: string;
                  pantryItemId: string;
                  quantityUsed: number;
                  usedById: string;
                  usedAt: string;
                  purpose: UsagePurpose;
                  notes?: string | null | undefined;
                  cookingLogId?: string | null | undefined;
                  mealPlanItemId?: string | null | undefined;
                  recipeId?: string | null | undefined;
                  usedBy: { __typename?: 'User'; id: string };
                }>;
              }>
            | null
            | undefined;
        }>
      | null
      | undefined;
  };
};

export type DeleteHomeMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeleteHomeMutation = {
  __typename?: 'Mutation';
  deleteHome: {
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
    invites?:
      | Array<{
          __typename?: 'HomeInvite';
          id: string;
          email: string;
          token: string;
          homeId: string;
          invitedUserId?: string | null | undefined;
          recipientName?: string | null | undefined;
          role: MembershipRole;
          customPermissions?: any | null | undefined;
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
        }>
      | null
      | undefined;
    members: Array<{
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
          | {
              __typename?: 'UserSettings';
              id: string;
              emailNotifications: boolean;
              pushNotifications: boolean;
              theme: AppTheme;
            }
          | null
          | undefined;
      };
    }>;
    myMembership?:
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
              | {
                  __typename?: 'UserSettings';
                  id: string;
                  emailNotifications: boolean;
                  pushNotifications: boolean;
                  theme: AppTheme;
                }
              | null
              | undefined;
          };
        }
      | null
      | undefined;
    membershipStats: {
      __typename?: 'MembershipStats';
      total: number;
      active: number;
      recentlyActive: number;
      byRole: {
        __typename?: 'MembershipRoleStats';
        OWNER: number;
        ADMIN: number;
        MEMBER: number;
        GUEST: number;
      };
      byStatus: {
        __typename?: 'MembershipStatusStats';
        ACTIVE: number;
        SUSPENDED: number;
        LEFT: number;
        REMOVED: number;
      };
    };
    pantries?:
      | Array<{
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
          updatedAt?: string | null | undefined;
          items?:
            | Array<{
                __typename?: 'PantryItem';
                id: string;
                pantryId: string;
                itemId: string;
                itemName: string;
                unitName?: string | null | undefined;
                unitId?: string | null | undefined;
                expiresAt?: string | null | undefined;
                storageLocation?: string | null | undefined;
                storageState: StorageState;
                storageNotes?: string | null | undefined;
                initialQuantity: number;
                currentQuantity: number;
                consumedQuantity: number;
                reservedQuantity: number;
                autoReorderPoint?: number | null | undefined;
                isAutoReorder: boolean;
                customCategory?: string | null | undefined;
                createdAt: string;
                updatedAt?: string | null | undefined;
                version: number;
                tags: Array<string>;
                item: {
                  __typename?: 'Item';
                  id: string;
                  name: string;
                  description?: string | null | undefined;
                  dataSource: DataSource;
                  type: ItemType;
                  storageState: StorageState;
                  showInOnboarding: boolean;
                  shelfLifeDays?: number | null | undefined;
                  popularity: number;
                  status: ItemStatus;
                  visibility: Visibility;
                  imageUrl?: string | null | undefined;
                  tags: Array<string>;
                  healthBenefits?: any | null | undefined;
                  allergens?: any | null | undefined;
                  nutritions?: any | null | undefined;
                  metadata?: any | null | undefined;
                  ingredients?: any | null | undefined;
                  createdAt: string;
                  updatedAt: string;
                  deletedAt?: string | null | undefined;
                  version: number;
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
                  units: Array<{
                    __typename?: 'ItemUnit';
                    id: string;
                    itemId: string;
                    unitId: string;
                    isDefault?: boolean | null | undefined;
                    isPreferred: boolean;
                    isCommon: boolean;
                    conversionRatio?: number | null | undefined;
                    conversionNote?: string | null | undefined;
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
                    brand?:
                      | {
                          __typename?: 'Brand';
                          id: string;
                          name: string;
                          description?: string | null | undefined;
                          createdAt: string;
                          updatedAt: string;
                          version: number;
                        }
                      | null
                      | undefined;
                  }>;
                  categories?:
                    | Array<{
                        __typename?: 'ItemCategory';
                        id: string;
                        source: CategorySource;
                        confidence: number;
                        isPrimary: boolean;
                        createdAt: string;
                        assignedAt?: string | null | undefined;
                        category: {
                          __typename?: 'Category';
                          id: string;
                          name: string;
                          slug?: string | null | undefined;
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
                          updatedAt?: string | null | undefined;
                          deletedAt?: string | null | undefined;
                          version: number;
                        };
                      }>
                    | null
                    | undefined;
                  creations: Array<{
                    __typename?: 'ItemCreation';
                    id: string;
                    source: DataSource;
                    reason?: string | null | undefined;
                    metadata?: any | null | undefined;
                    createdAt: string;
                  }>;
                  edits: Array<{
                    __typename?: 'ItemEdit';
                    id: string;
                    fieldsChanged: Array<string>;
                    oldValues?: any | null | undefined;
                    newValues?: any | null | undefined;
                    editReason?: string | null | undefined;
                    createdAt: string;
                  }>;
                };
                unit?:
                  | {
                      __typename?: 'Unit';
                      id: string;
                      name: string;
                      symbol: string;
                      type: UnitType;
                      isMetric: boolean;
                      baseUnitId?: string | null | undefined;
                      conversionFactor: number;
                      isCommon: boolean;
                    }
                  | null
                  | undefined;
                usageRecords: Array<{
                  __typename?: 'PantryItemUsage';
                  id: string;
                  pantryItemId: string;
                  quantityUsed: number;
                  usedById: string;
                  usedAt: string;
                  purpose: UsagePurpose;
                  notes?: string | null | undefined;
                  cookingLogId?: string | null | undefined;
                  mealPlanItemId?: string | null | undefined;
                  recipeId?: string | null | undefined;
                  usedBy: { __typename?: 'User'; id: string };
                }>;
              }>
            | null
            | undefined;
        }>
      | null
      | undefined;
  };
};

export type InviteToHomeMutationVariables = Exact<{
  input: InviteToHomeInput;
}>;

export type InviteToHomeMutation = {
  __typename?: 'Mutation';
  inviteToHome: {
    __typename?: 'HomeInvite';
    id: string;
    email: string;
    token: string;
    homeId: string;
    invitedUserId?: string | null | undefined;
    recipientName?: string | null | undefined;
    role: MembershipRole;
    customPermissions?: any | null | undefined;
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
  membershipId: Scalars['ID']['input'];
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
    previousValues?:
      | {
          __typename?: 'Membership';
          role: MembershipRole;
          status: MembershipStatus;
          canViewPantry: boolean;
          canEditPantry: boolean;
          canAddItems: boolean;
          canRemoveItems: boolean;
          canInviteOthers: boolean;
          canManageHome: boolean;
        }
      | null
      | undefined;
  };
};

export type MyMembershipUpdatedSubscriptionVariables = Exact<{
  [key: string]: never;
}>;

export type MyMembershipUpdatedSubscription = {
  __typename?: 'Subscription';
  myMembershipUpdated: {
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
          home: {
            __typename?: 'Home';
            id: string;
            name: string;
            type: HomeType;
            joinCode?: string | null | undefined;
          };
        }
      | null
      | undefined;
    previousValues?:
      | {
          __typename?: 'Membership';
          role: MembershipRole;
          status: MembershipStatus;
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
    previousValues?:
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
          leftAt?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
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
    previousValues?:
      | {
          __typename?: 'Membership';
          role: MembershipRole;
          status: MembershipStatus;
          displayName?: string | null | undefined;
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
        invites?:
          | Array<{
              __typename?: 'HomeInvite';
              id: string;
              email: string;
              token: string;
              homeId: string;
              invitedUserId?: string | null | undefined;
              recipientName?: string | null | undefined;
              role: MembershipRole;
              customPermissions?: any | null | undefined;
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
            }>
          | null
          | undefined;
        members: Array<{
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
              | {
                  __typename?: 'UserSettings';
                  id: string;
                  emailNotifications: boolean;
                  pushNotifications: boolean;
                  theme: AppTheme;
                }
              | null
              | undefined;
          };
        }>;
        myMembership?:
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
                  | {
                      __typename?: 'UserSettings';
                      id: string;
                      emailNotifications: boolean;
                      pushNotifications: boolean;
                      theme: AppTheme;
                    }
                  | null
                  | undefined;
              };
            }
          | null
          | undefined;
        membershipStats: {
          __typename?: 'MembershipStats';
          total: number;
          active: number;
          recentlyActive: number;
          byRole: {
            __typename?: 'MembershipRoleStats';
            OWNER: number;
            ADMIN: number;
            MEMBER: number;
            GUEST: number;
          };
          byStatus: {
            __typename?: 'MembershipStatusStats';
            ACTIVE: number;
            SUSPENDED: number;
            LEFT: number;
            REMOVED: number;
          };
        };
        pantries?:
          | Array<{
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
              updatedAt?: string | null | undefined;
              items?:
                | Array<{
                    __typename?: 'PantryItem';
                    id: string;
                    pantryId: string;
                    itemId: string;
                    itemName: string;
                    unitName?: string | null | undefined;
                    unitId?: string | null | undefined;
                    expiresAt?: string | null | undefined;
                    storageLocation?: string | null | undefined;
                    storageState: StorageState;
                    storageNotes?: string | null | undefined;
                    initialQuantity: number;
                    currentQuantity: number;
                    consumedQuantity: number;
                    reservedQuantity: number;
                    autoReorderPoint?: number | null | undefined;
                    isAutoReorder: boolean;
                    customCategory?: string | null | undefined;
                    createdAt: string;
                    updatedAt?: string | null | undefined;
                    version: number;
                    tags: Array<string>;
                    item: {
                      __typename?: 'Item';
                      id: string;
                      name: string;
                      description?: string | null | undefined;
                      dataSource: DataSource;
                      type: ItemType;
                      storageState: StorageState;
                      showInOnboarding: boolean;
                      shelfLifeDays?: number | null | undefined;
                      popularity: number;
                      status: ItemStatus;
                      visibility: Visibility;
                      imageUrl?: string | null | undefined;
                      tags: Array<string>;
                      healthBenefits?: any | null | undefined;
                      allergens?: any | null | undefined;
                      nutritions?: any | null | undefined;
                      metadata?: any | null | undefined;
                      ingredients?: any | null | undefined;
                      createdAt: string;
                      updatedAt: string;
                      deletedAt?: string | null | undefined;
                      version: number;
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
                      units: Array<{
                        __typename?: 'ItemUnit';
                        id: string;
                        itemId: string;
                        unitId: string;
                        isDefault?: boolean | null | undefined;
                        isPreferred: boolean;
                        isCommon: boolean;
                        conversionRatio?: number | null | undefined;
                        conversionNote?: string | null | undefined;
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
                        brand?:
                          | {
                              __typename?: 'Brand';
                              id: string;
                              name: string;
                              description?: string | null | undefined;
                              createdAt: string;
                              updatedAt: string;
                              version: number;
                            }
                          | null
                          | undefined;
                      }>;
                      categories?:
                        | Array<{
                            __typename?: 'ItemCategory';
                            id: string;
                            source: CategorySource;
                            confidence: number;
                            isPrimary: boolean;
                            createdAt: string;
                            assignedAt?: string | null | undefined;
                            category: {
                              __typename?: 'Category';
                              id: string;
                              name: string;
                              slug?: string | null | undefined;
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
                              updatedAt?: string | null | undefined;
                              deletedAt?: string | null | undefined;
                              version: number;
                            };
                          }>
                        | null
                        | undefined;
                      creations: Array<{
                        __typename?: 'ItemCreation';
                        id: string;
                        source: DataSource;
                        reason?: string | null | undefined;
                        metadata?: any | null | undefined;
                        createdAt: string;
                      }>;
                      edits: Array<{
                        __typename?: 'ItemEdit';
                        id: string;
                        fieldsChanged: Array<string>;
                        oldValues?: any | null | undefined;
                        newValues?: any | null | undefined;
                        editReason?: string | null | undefined;
                        createdAt: string;
                      }>;
                    };
                    unit?:
                      | {
                          __typename?: 'Unit';
                          id: string;
                          name: string;
                          symbol: string;
                          type: UnitType;
                          isMetric: boolean;
                          baseUnitId?: string | null | undefined;
                          conversionFactor: number;
                          isCommon: boolean;
                        }
                      | null
                      | undefined;
                    usageRecords: Array<{
                      __typename?: 'PantryItemUsage';
                      id: string;
                      pantryItemId: string;
                      quantityUsed: number;
                      usedById: string;
                      usedAt: string;
                      purpose: UsagePurpose;
                      notes?: string | null | undefined;
                      cookingLogId?: string | null | undefined;
                      mealPlanItemId?: string | null | undefined;
                      recipeId?: string | null | undefined;
                      usedBy: { __typename?: 'User'; id: string };
                    }>;
                  }>
                | null
                | undefined;
            }>
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type SetDefaultHomeMutationVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type SetDefaultHomeMutation = {
  __typename?: 'Mutation';
  setDefaultHome: {
    __typename?: 'UserSettings';
    id: string;
    defaultHome?:
      | { __typename?: 'Home'; id: string; name: string }
      | null
      | undefined;
  };
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
  updateItemImage: {
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
  removeItemImage: {
    __typename?: 'Item';
    id: string;
    imageUrl?: string | null | undefined;
  };
};

export type GetItemsQueryVariables = Exact<{
  filters?: InputMaybe<ItemFilters>;
  sort?: InputMaybe<ItemSortInput>;
  pagination?: InputMaybe<PaginationInput>;
}>;

export type GetItemsQuery = {
  __typename?: 'Query';
  items: {
    __typename?: 'ItemsResponse';
    totalCount: number;
    items?:
      | Array<{
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
            isDefault?: boolean | null | undefined;
          }>;
          brands: Array<{ __typename?: 'ItemBrand'; id: string }>;
          categories?:
            | Array<{ __typename?: 'ItemCategory'; id: string }>
            | null
            | undefined;
        }>
      | null
      | undefined;
  };
};

export type SearchItemsQueryVariables = Exact<{
  input: SearchItemsInput;
}>;

export type SearchItemsQuery = {
  __typename?: 'Query';
  searchItems?:
    | {
        __typename?: 'ItemsResponse';
        totalCount: number;
        hasMore: boolean;
        items?:
          | Array<{ __typename?: 'Item'; id: string; name: string }>
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type ItemByUpcQueryVariables = Exact<{
  upc: Scalars['String']['input'];
}>;

export type ItemByUpcQuery = {
  __typename?: 'Query';
  itemByUpc?:
    | {
        __typename?: 'Item';
        id: string;
        imageUrl?: string | null | undefined;
        name: string;
        netWeight?: number | null | undefined;
        units: Array<{
          __typename?: 'ItemUnit';
          isDefault?: boolean | null | undefined;
          unitId: string;
        }>;
      }
    | null
    | undefined;
};

export type ItemBySkuQueryVariables = Exact<{
  sku: Scalars['String']['input'];
  storeId?: InputMaybe<Scalars['String']['input']>;
}>;

export type ItemBySkuQuery = {
  __typename?: 'Query';
  itemBySku?:
    | {
        __typename?: 'Item';
        id: string;
        imageUrl?: string | null | undefined;
        name: string;
        netWeight?: number | null | undefined;
        description?: string | null | undefined;
        units: Array<{
          __typename?: 'ItemUnit';
          isDefault?: boolean | null | undefined;
          unitId: string;
        }>;
      }
    | null
    | undefined;
};

export type GetOnboardingItemsQueryVariables = Exact<{ [key: string]: never }>;

export type GetOnboardingItemsQuery = {
  __typename?: 'Query';
  onboardingItems: Array<{
    __typename?: 'Item';
    imageUrl?: string | null | undefined;
    id: string;
    name: string;
    storageState: StorageState;
    units: Array<{
      __typename?: 'ItemUnit';
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; isCommon: boolean }
        | null
        | undefined;
    }>;
  }>;
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
          imageUrl?: string | null | undefined;
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
          brand?:
            | { __typename?: 'BrandSuggestion'; id: string; name: string }
            | null
            | undefined;
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
      sku?: string | null | undefined;
      brand?:
        | { __typename?: 'Brand'; id: string; name: string }
        | null
        | undefined;
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
      isDefault?: boolean | null | undefined;
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
    chain?: string | null | undefined;
    city?: string | null | undefined;
    state?: string | null | undefined;
    zipCode?: string | null | undefined;
    latitude?: number | null | undefined;
    longitude?: number | null | undefined;
    phone?: string | null | undefined;
    website?: string | null | undefined;
    isActive: boolean;
    updatedAt: string;
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
}>;

export type SearchUnitsQuery = {
  __typename?: 'Query';
  searchUnits: Array<{
    __typename?: 'Unit';
    id: string;
    name: string;
    symbol: string;
    type: UnitType;
    isCommon: boolean;
    sortOrder: number;
  }>;
};

export type GetCommonUnitsQueryVariables = Exact<{
  type?: InputMaybe<UnitType>;
}>;

export type GetCommonUnitsQuery = {
  __typename?: 'Query';
  units: Array<{
    __typename?: 'Unit';
    id: string;
    name: string;
    symbol: string;
    type: UnitType;
    isCommon: boolean;
    sortOrder: number;
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

export type NotificationByTypeSubscriptionVariables = Exact<{
  type: NotificationType;
}>;

export type NotificationByTypeSubscription = {
  __typename?: 'Subscription';
  notificationByType: {
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

export type UrgentNotificationReceivedSubscriptionVariables = Exact<{
  [key: string]: never;
}>;

export type UrgentNotificationReceivedSubscription = {
  __typename?: 'Subscription';
  urgentNotificationReceived: {
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
    updatedAt?: string | null | undefined;
    version: number;
    tags: Array<string>;
    items?:
      | Array<{
          __typename?: 'PantryItem';
          id: string;
          itemName: string;
          item: { __typename?: 'Item'; name: string };
        }>
      | null
      | undefined;
  }>;
};

export type GetPantryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
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
        updatedAt?: string | null | undefined;
        items?:
          | Array<{
              __typename?: 'PantryItem';
              id: string;
              itemName: string;
              item: { __typename?: 'Item'; name: string };
            }>
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type GetPantryItemsQueryVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type GetPantryItemsQuery = {
  __typename?: 'Query';
  pantryItems: Array<{
    __typename?: 'PantryItem';
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    unitName?: string | null | undefined;
    unitId?: string | null | undefined;
    expiresAt?: string | null | undefined;
    storageLocation?: string | null | undefined;
    storageState: StorageState;
    storageNotes?: string | null | undefined;
    initialQuantity: number;
    currentQuantity: number;
    consumedQuantity: number;
    reservedQuantity: number;
    autoReorderPoint?: number | null | undefined;
    isAutoReorder: boolean;
    customCategory?: string | null | undefined;
    createdAt: string;
    updatedAt?: string | null | undefined;
    version: number;
    tags: Array<string>;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      imageUrl?: string | null | undefined;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      updatedAt: string;
      deletedAt?: string | null | undefined;
      version: number;
      netWeight?: number | null | undefined;
      displayUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault?: boolean | null | undefined;
        isPreferred: boolean;
        isCommon: boolean;
        conversionRatio?: number | null | undefined;
        conversionNote?: string | null | undefined;
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
        brand?:
          | {
              __typename?: 'Brand';
              id: string;
              name: string;
              description?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              version: number;
            }
          | null
          | undefined;
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            source: CategorySource;
            confidence: number;
            isPrimary: boolean;
            createdAt: string;
            assignedAt?: string | null | undefined;
            category: {
              __typename?: 'Category';
              id: string;
              name: string;
              slug?: string | null | undefined;
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
              updatedAt?: string | null | undefined;
              deletedAt?: string | null | undefined;
              version: number;
            };
          }>
        | null
        | undefined;
      creations: Array<{
        __typename?: 'ItemCreation';
        id: string;
        source: DataSource;
        reason?: string | null | undefined;
        metadata?: any | null | undefined;
        createdAt: string;
      }>;
      edits: Array<{
        __typename?: 'ItemEdit';
        id: string;
        fieldsChanged: Array<string>;
        oldValues?: any | null | undefined;
        newValues?: any | null | undefined;
        editReason?: string | null | undefined;
        createdAt: string;
      }>;
    };
    unit?:
      | {
          __typename?: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      pantryItemId: string;
      quantityUsed: number;
      usedById: string;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      cookingLogId?: string | null | undefined;
      mealPlanItemId?: string | null | undefined;
      recipeId?: string | null | undefined;
      usedBy: { __typename?: 'User'; id: string };
    }>;
  }>;
};

export type GetPantryItemQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type GetPantryItemQuery = {
  __typename?: 'Query';
  pantryItem: {
    __typename?: 'PantryItem';
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    unitName?: string | null | undefined;
    unitId?: string | null | undefined;
    expiresAt?: string | null | undefined;
    storageLocation?: string | null | undefined;
    storageState: StorageState;
    storageNotes?: string | null | undefined;
    initialQuantity: number;
    currentQuantity: number;
    consumedQuantity: number;
    reservedQuantity: number;
    autoReorderPoint?: number | null | undefined;
    isAutoReorder: boolean;
    customCategory?: string | null | undefined;
    createdAt: string;
    updatedAt?: string | null | undefined;
    version: number;
    tags: Array<string>;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      imageUrl?: string | null | undefined;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      updatedAt: string;
      deletedAt?: string | null | undefined;
      version: number;
      netWeight?: number | null | undefined;
      displayUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault?: boolean | null | undefined;
        isPreferred: boolean;
        isCommon: boolean;
        conversionRatio?: number | null | undefined;
        conversionNote?: string | null | undefined;
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
        brand?:
          | {
              __typename?: 'Brand';
              id: string;
              name: string;
              description?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              version: number;
            }
          | null
          | undefined;
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            source: CategorySource;
            confidence: number;
            isPrimary: boolean;
            createdAt: string;
            assignedAt?: string | null | undefined;
            category: {
              __typename?: 'Category';
              id: string;
              name: string;
              slug?: string | null | undefined;
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
              updatedAt?: string | null | undefined;
              deletedAt?: string | null | undefined;
              version: number;
            };
          }>
        | null
        | undefined;
      creations: Array<{
        __typename?: 'ItemCreation';
        id: string;
        source: DataSource;
        reason?: string | null | undefined;
        metadata?: any | null | undefined;
        createdAt: string;
      }>;
      edits: Array<{
        __typename?: 'ItemEdit';
        id: string;
        fieldsChanged: Array<string>;
        oldValues?: any | null | undefined;
        newValues?: any | null | undefined;
        editReason?: string | null | undefined;
        createdAt: string;
      }>;
    };
    unit?:
      | {
          __typename?: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      pantryItemId: string;
      quantityUsed: number;
      usedById: string;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      cookingLogId?: string | null | undefined;
      mealPlanItemId?: string | null | undefined;
      recipeId?: string | null | undefined;
      usedBy: { __typename?: 'User'; id: string };
    }>;
  };
};

export type AddItemToPantryMutationVariables = Exact<{
  input: AddPantryItemInput;
}>;

export type AddItemToPantryMutation = {
  __typename?: 'Mutation';
  addItemToPantry: {
    __typename?: 'PantryItem';
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    unitName?: string | null | undefined;
    unitId?: string | null | undefined;
    expiresAt?: string | null | undefined;
    storageLocation?: string | null | undefined;
    storageState: StorageState;
    storageNotes?: string | null | undefined;
    initialQuantity: number;
    currentQuantity: number;
    consumedQuantity: number;
    reservedQuantity: number;
    autoReorderPoint?: number | null | undefined;
    isAutoReorder: boolean;
    customCategory?: string | null | undefined;
    createdAt: string;
    updatedAt?: string | null | undefined;
    version: number;
    tags: Array<string>;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      imageUrl?: string | null | undefined;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      updatedAt: string;
      deletedAt?: string | null | undefined;
      version: number;
      netWeight?: number | null | undefined;
      displayUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault?: boolean | null | undefined;
        isPreferred: boolean;
        isCommon: boolean;
        conversionRatio?: number | null | undefined;
        conversionNote?: string | null | undefined;
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
        brand?:
          | {
              __typename?: 'Brand';
              id: string;
              name: string;
              description?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              version: number;
            }
          | null
          | undefined;
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            source: CategorySource;
            confidence: number;
            isPrimary: boolean;
            createdAt: string;
            assignedAt?: string | null | undefined;
            category: {
              __typename?: 'Category';
              id: string;
              name: string;
              slug?: string | null | undefined;
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
              updatedAt?: string | null | undefined;
              deletedAt?: string | null | undefined;
              version: number;
            };
          }>
        | null
        | undefined;
      creations: Array<{
        __typename?: 'ItemCreation';
        id: string;
        source: DataSource;
        reason?: string | null | undefined;
        metadata?: any | null | undefined;
        createdAt: string;
      }>;
      edits: Array<{
        __typename?: 'ItemEdit';
        id: string;
        fieldsChanged: Array<string>;
        oldValues?: any | null | undefined;
        newValues?: any | null | undefined;
        editReason?: string | null | undefined;
        createdAt: string;
      }>;
    };
    unit?:
      | {
          __typename?: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      pantryItemId: string;
      quantityUsed: number;
      usedById: string;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      cookingLogId?: string | null | undefined;
      mealPlanItemId?: string | null | undefined;
      recipeId?: string | null | undefined;
      usedBy: { __typename?: 'User'; id: string };
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
    updatedAt?: string | null | undefined;
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
    updatedAt?: string | null | undefined;
  };
};

export type DeletePantryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type DeletePantryMutation = {
  __typename?: 'Mutation';
  deletePantry: boolean;
};

export type UpdatePantryItemMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  input: UpdatePantryItemInput;
}>;

export type UpdatePantryItemMutation = {
  __typename?: 'Mutation';
  updatePantryItem: {
    __typename?: 'PantryItem';
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    unitName?: string | null | undefined;
    unitId?: string | null | undefined;
    expiresAt?: string | null | undefined;
    storageLocation?: string | null | undefined;
    storageState: StorageState;
    storageNotes?: string | null | undefined;
    initialQuantity: number;
    currentQuantity: number;
    consumedQuantity: number;
    reservedQuantity: number;
    autoReorderPoint?: number | null | undefined;
    isAutoReorder: boolean;
    customCategory?: string | null | undefined;
    createdAt: string;
    updatedAt?: string | null | undefined;
    version: number;
    tags: Array<string>;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      imageUrl?: string | null | undefined;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      updatedAt: string;
      deletedAt?: string | null | undefined;
      version: number;
      netWeight?: number | null | undefined;
      displayUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault?: boolean | null | undefined;
        isPreferred: boolean;
        isCommon: boolean;
        conversionRatio?: number | null | undefined;
        conversionNote?: string | null | undefined;
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
        brand?:
          | {
              __typename?: 'Brand';
              id: string;
              name: string;
              description?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              version: number;
            }
          | null
          | undefined;
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            source: CategorySource;
            confidence: number;
            isPrimary: boolean;
            createdAt: string;
            assignedAt?: string | null | undefined;
            category: {
              __typename?: 'Category';
              id: string;
              name: string;
              slug?: string | null | undefined;
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
              updatedAt?: string | null | undefined;
              deletedAt?: string | null | undefined;
              version: number;
            };
          }>
        | null
        | undefined;
      creations: Array<{
        __typename?: 'ItemCreation';
        id: string;
        source: DataSource;
        reason?: string | null | undefined;
        metadata?: any | null | undefined;
        createdAt: string;
      }>;
      edits: Array<{
        __typename?: 'ItemEdit';
        id: string;
        fieldsChanged: Array<string>;
        oldValues?: any | null | undefined;
        newValues?: any | null | undefined;
        editReason?: string | null | undefined;
        createdAt: string;
      }>;
    };
    unit?:
      | {
          __typename?: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      pantryItemId: string;
      quantityUsed: number;
      usedById: string;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      cookingLogId?: string | null | undefined;
      mealPlanItemId?: string | null | undefined;
      recipeId?: string | null | undefined;
      usedBy: { __typename?: 'User'; id: string };
    }>;
  };
};

export type RemoveItemFromPantryMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type RemoveItemFromPantryMutation = {
  __typename?: 'Mutation';
  removeItemFromPantry: {
    __typename?: 'PantryItem';
    id: string;
    pantryId: string;
    itemId: string;
    itemName: string;
    unitName?: string | null | undefined;
    unitId?: string | null | undefined;
    expiresAt?: string | null | undefined;
    storageLocation?: string | null | undefined;
    storageState: StorageState;
    storageNotes?: string | null | undefined;
    initialQuantity: number;
    currentQuantity: number;
    consumedQuantity: number;
    reservedQuantity: number;
    autoReorderPoint?: number | null | undefined;
    isAutoReorder: boolean;
    customCategory?: string | null | undefined;
    createdAt: string;
    updatedAt?: string | null | undefined;
    version: number;
    tags: Array<string>;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      description?: string | null | undefined;
      dataSource: DataSource;
      type: ItemType;
      storageState: StorageState;
      showInOnboarding: boolean;
      shelfLifeDays?: number | null | undefined;
      popularity: number;
      status: ItemStatus;
      visibility: Visibility;
      imageUrl?: string | null | undefined;
      tags: Array<string>;
      healthBenefits?: any | null | undefined;
      allergens?: any | null | undefined;
      nutritions?: any | null | undefined;
      metadata?: any | null | undefined;
      ingredients?: any | null | undefined;
      createdAt: string;
      updatedAt: string;
      deletedAt?: string | null | undefined;
      version: number;
      netWeight?: number | null | undefined;
      displayUnit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        itemId: string;
        unitId: string;
        isDefault?: boolean | null | undefined;
        isPreferred: boolean;
        isCommon: boolean;
        conversionRatio?: number | null | undefined;
        conversionNote?: string | null | undefined;
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
        brand?:
          | {
              __typename?: 'Brand';
              id: string;
              name: string;
              description?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              version: number;
            }
          | null
          | undefined;
      }>;
      categories?:
        | Array<{
            __typename?: 'ItemCategory';
            id: string;
            source: CategorySource;
            confidence: number;
            isPrimary: boolean;
            createdAt: string;
            assignedAt?: string | null | undefined;
            category: {
              __typename?: 'Category';
              id: string;
              name: string;
              slug?: string | null | undefined;
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
              updatedAt?: string | null | undefined;
              deletedAt?: string | null | undefined;
              version: number;
            };
          }>
        | null
        | undefined;
      creations: Array<{
        __typename?: 'ItemCreation';
        id: string;
        source: DataSource;
        reason?: string | null | undefined;
        metadata?: any | null | undefined;
        createdAt: string;
      }>;
      edits: Array<{
        __typename?: 'ItemEdit';
        id: string;
        fieldsChanged: Array<string>;
        oldValues?: any | null | undefined;
        newValues?: any | null | undefined;
        editReason?: string | null | undefined;
        createdAt: string;
      }>;
    };
    unit?:
      | {
          __typename?: 'Unit';
          id: string;
          name: string;
          symbol: string;
          type: UnitType;
          isMetric: boolean;
          baseUnitId?: string | null | undefined;
          conversionFactor: number;
          isCommon: boolean;
        }
      | null
      | undefined;
    usageRecords: Array<{
      __typename?: 'PantryItemUsage';
      id: string;
      pantryItemId: string;
      quantityUsed: number;
      usedById: string;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
      cookingLogId?: string | null | undefined;
      mealPlanItemId?: string | null | undefined;
      recipeId?: string | null | undefined;
      usedBy: { __typename?: 'User'; id: string };
    }>;
  };
};

export type PantryUpdatedSubscriptionVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type PantryUpdatedSubscription = {
  __typename?: 'Subscription';
  pantryUpdated: {
    __typename?: 'PantryUpdatedPayload';
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
    home: { __typename?: 'Home'; id: string; name: string };
  };
};

export type PantryActivityAddedSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryActivityAddedSubscription = {
  __typename?: 'Subscription';
  pantryActivityAdded: {
    __typename?: 'PantryActivity';
    id: string;
    pantryId: string;
    userId: string;
    action: PantryActivityType;
    description: string;
    itemName?: string | null | undefined;
    quantity?: number | null | undefined;
    oldValue?: string | null | undefined;
    newValue?: string | null | undefined;
    metadata?: any | null | undefined;
    createdAt: string;
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

export type PantryLowStockAlertSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryLowStockAlertSubscription = {
  __typename?: 'Subscription';
  pantryLowStockAlert: Array<{
    __typename?: 'PantryItem';
    id: string;
    itemId: string;
    itemName: string;
    currentQuantity: number;
    autoReorderPoint?: number | null | undefined;
    unitName?: string | null | undefined;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      imageUrl?: string | null | undefined;
    };
  }>;
};

export type PantryExpiringItemsAlertSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryExpiringItemsAlertSubscription = {
  __typename?: 'Subscription';
  pantryExpiringItemsAlert: Array<{
    __typename?: 'PantryItem';
    id: string;
    itemId: string;
    itemName: string;
    expiresAt?: string | null | undefined;
    bestByDate?: string | null | undefined;
    currentQuantity: number;
    unitName?: string | null | undefined;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      imageUrl?: string | null | undefined;
    };
  }>;
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
      __typename?: 'PantryItem';
      id: string;
      itemName: string;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string }
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
      pantryItemId: string;
      quantityUsed: number;
      usedById: string;
      usedAt: string;
      purpose: UsagePurpose;
      notes?: string | null | undefined;
    };
    previousValues?:
      | {
          __typename?: 'PantryItemUsage';
          quantityUsed: number;
          purpose: UsagePurpose;
        }
      | null
      | undefined;
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
  searchRecipes: Array<{
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
  }>;
};

export type SuggestedRecipesQueryVariables = Exact<{ [key: string]: never }>;

export type SuggestedRecipesQuery = {
  __typename?: 'Query';
  suggestedRecipes: Array<{
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
  }>;
};

export type MyRecipesQueryVariables = Exact<{
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
  category?: InputMaybe<RecipeCategory>;
  difficulty?: InputMaybe<Difficulty>;
}>;

export type MyRecipesQuery = {
  __typename?: 'Query';
  myRecipes: {
    __typename?: 'RecipesResponse';
    totalCount: number;
    recipes: Array<{
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
    }>;
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
        dietaryTags: Array<DietaryTag>;
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
          spoonacularIngredientId?: number | null | undefined;
          aisle?: string | null | undefined;
          consistency?: string | null | undefined;
          originalString?: string | null | undefined;
          metricAmount?: number | null | undefined;
          metricUnit?: string | null | undefined;
          usAmount?: number | null | undefined;
          usUnit?: string | null | undefined;
          meta: Array<string>;
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

export type AddRecipeMutationVariables = Exact<{
  name: Scalars['String']['input'];
  ingredients: Array<Scalars['String']['input']> | Scalars['String']['input'];
  instructions: Scalars['JSON']['input'];
  category?: InputMaybe<RecipeCategory>;
  difficulty?: InputMaybe<Difficulty>;
  prepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  cookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
}>;

export type AddRecipeMutation = {
  __typename?: 'Mutation';
  addRecipe: {
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
    dietaryTags: Array<DietaryTag>;
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
      spoonacularIngredientId?: number | null | undefined;
      aisle?: string | null | undefined;
      consistency?: string | null | undefined;
      originalString?: string | null | undefined;
      metricAmount?: number | null | undefined;
      metricUnit?: string | null | undefined;
      usAmount?: number | null | undefined;
      usUnit?: string | null | undefined;
      meta: Array<string>;
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

export type SaveRecipeMutationVariables = Exact<{
  input: SaveRecipeInput;
}>;

export type SaveRecipeMutation = {
  __typename?: 'Mutation';
  saveRecipe: {
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
    dietaryTags: Array<DietaryTag>;
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
      spoonacularIngredientId?: number | null | undefined;
      aisle?: string | null | undefined;
      consistency?: string | null | undefined;
      originalString?: string | null | undefined;
      metricAmount?: number | null | undefined;
      metricUnit?: string | null | undefined;
      usAmount?: number | null | undefined;
      usUnit?: string | null | undefined;
      meta: Array<string>;
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

export type AddRecipeToShoppingListMutationVariables = Exact<{
  recipeId: Scalars['ID']['input'];
  shoppingListId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Int']['input']>;
}>;

export type AddRecipeToShoppingListMutation = {
  __typename?: 'Mutation';
  addRecipeToShoppingList: {
    __typename?: 'AddRecipeToShoppingListResult';
    totalAdded: number;
    totalUpdated: number;
    totalSkipped: number;
    addedItems: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      itemName?: string | null | undefined;
      quantity?: number | null | undefined;
      aisle?: string | null | undefined;
      isPurchased: boolean;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
    }>;
    updatedItems: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      itemName?: string | null | undefined;
      quantity?: number | null | undefined;
      isPurchased: boolean;
      unit?:
        | { __typename?: 'Unit'; id: string; name: string; symbol: string }
        | null
        | undefined;
    }>;
    skippedItems: Array<{
      __typename?: 'RecipeIngredient';
      id: string;
      name: string;
      quantity: number;
    }>;
  };
};

export type AddRecipeIngredientToShoppingListMutationVariables = Exact<{
  recipeIngredientId: Scalars['ID']['input'];
  shoppingListId: Scalars['ID']['input'];
  quantityOverride?: InputMaybe<Scalars['Float']['input']>;
}>;

export type AddRecipeIngredientToShoppingListMutation = {
  __typename?: 'Mutation';
  addRecipeIngredientToShoppingList: {
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

export type MyShoppingListInvitesQueryVariables = Exact<{
  [key: string]: never;
}>;

export type MyShoppingListInvitesQuery = {
  __typename?: 'Query';
  myShoppingListInvites: Array<{
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
    inviteToken?: string | null | undefined;
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
    inviteToken?: string | null | undefined;
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
    inviteToken?: string | null | undefined;
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

export type PurchaseCreatedSubscriptionVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type PurchaseCreatedSubscription = {
  __typename?: 'Subscription';
  purchaseCreated: {
    __typename?: 'Purchase';
    id: string;
    userId: string;
    itemId: string;
    storeId?: string | null | undefined;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    purchaseDate: string;
    itemName: string;
    storeName?: string | null | undefined;
    unitSymbol: string;
    currencySymbol: string;
    user: { __typename?: 'User'; id: string; email: string };
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      imageUrl?: string | null | undefined;
    };
    store?:
      | {
          __typename?: 'Store';
          id: string;
          name: string;
          address?: string | null | undefined;
        }
      | null
      | undefined;
  };
};

export type PurchaseUpdatedSubscriptionVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type PurchaseUpdatedSubscription = {
  __typename?: 'Subscription';
  purchaseUpdated: {
    __typename?: 'Purchase';
    id: string;
    userId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    purchaseDate: string;
    updatedAt: string;
  };
};

export type PurchaseDeletedSubscriptionVariables = Exact<{
  userId?: InputMaybe<Scalars['ID']['input']>;
}>;

export type PurchaseDeletedSubscription = {
  __typename?: 'Subscription';
  purchaseDeleted: {
    __typename?: 'Purchase';
    id: string;
    userId: string;
    deletedAt?: string | null | undefined;
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
        items: Array<{
          __typename?: 'ShoppingListItem';
          id: string;
          quantity?: number | null | undefined;
          estimatedPrice?: number | null | undefined;
          budgetPrice?: number | null | undefined;
          isPurchased: boolean;
          purchasedQuantity?: number | null | undefined;
          purchasedPrice?: number | null | undefined;
          purchaseDate?: string | null | undefined;
          itemName?: string | null | undefined;
          itemBarcode?: string | null | undefined;
          unitName?: string | null | undefined;
          notes?: string | null | undefined;
          priority: number;
          category?: string | null | undefined;
          sortOrder: number;
          isAutoAdded: boolean;
          autoAddReason?: string | null | undefined;
          isFromMealPlan: boolean;
          createdAt: string;
          updatedAt: string;
          item?:
            | {
                __typename?: 'Item';
                id: string;
                name: string;
                description?: string | null | undefined;
                imageUrl?: string | null | undefined;
                type: ItemType;
                storageState: StorageState;
              }
            | null
            | undefined;
          unit?:
            | { __typename?: 'Unit'; id: string; name: string; symbol: string }
            | null
            | undefined;
          preferredStore?:
            | {
                __typename?: 'Store';
                id: string;
                name: string;
                address?: string | null | undefined;
              }
            | null
            | undefined;
          purchasedBy?:
            | { __typename?: 'User'; id: string; email: string }
            | null
            | undefined;
          addedBy?:
            | { __typename?: 'User'; id: string; email: string }
            | null
            | undefined;
        }>;
        collaborators?:
          | Array<{
              __typename?: 'ShoppingListCollaborator';
              id: string;
              email?: string | null | undefined;
              role: CollaboratorRole;
              status: CollaboratorStatus;
              canEdit: boolean;
              canAddItems: boolean;
              canRemoveItems: boolean;
              canEditItems: boolean;
              canMarkPurchased: boolean;
              canInviteOthers: boolean;
              invitedAt: string;
              lastViewedAt?: string | null | undefined;
            }>
          | null
          | undefined;
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

export type GetShoppingListsQueryVariables = Exact<{ [key: string]: never }>;

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
    items: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      isPurchased: boolean;
    }>;
    collaborators?:
      | Array<{
          __typename?: 'ShoppingListCollaborator';
          id: string;
          email?: string | null | undefined;
          role: CollaboratorRole;
        }>
      | null
      | undefined;
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
        items: Array<{
          __typename?: 'ShoppingListItem';
          id: string;
          itemName?: string | null | undefined;
          quantity?: number | null | undefined;
          isPurchased: boolean;
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
      }
    | null
    | undefined;
};

export type GetShoppingListItemsQueryVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type GetShoppingListItemsQuery = {
  __typename?: 'Query';
  shoppingListItems: Array<{
    __typename?: 'ShoppingListItem';
    id: string;
    quantity?: number | null | undefined;
    estimatedPrice?: number | null | undefined;
    budgetPrice?: number | null | undefined;
    lastKnownPrice?: number | null | undefined;
    lowestPrice?: number | null | undefined;
    highestPrice?: number | null | undefined;
    priceLastUpdated?: string | null | undefined;
    isPurchased: boolean;
    purchasedQuantity?: number | null | undefined;
    purchasedPrice?: number | null | undefined;
    purchaseDate?: string | null | undefined;
    aisle?: string | null | undefined;
    storeSection?: string | null | undefined;
    previouslyPurchased: boolean;
    lastPurchaseDate?: string | null | undefined;
    purchaseCount: number;
    itemName?: string | null | undefined;
    unitName?: string | null | undefined;
    notes?: string | null | undefined;
    priority: number;
    category?: string | null | undefined;
    sortOrder: number;
    isAutoAdded: boolean;
    autoAddReason?: string | null | undefined;
    isFromMealPlan: boolean;
    mealPlanReference?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    version: number;
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
        }
      | null
      | undefined;
    unit?:
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
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchases?:
      | Array<{
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
  }>;
};

export type GetShoppingListItemQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type GetShoppingListItemQuery = {
  __typename?: 'Query';
  shoppingListItem?:
    | {
        __typename?: 'ShoppingListItem';
        id: string;
        quantity?: number | null | undefined;
        estimatedPrice?: number | null | undefined;
        budgetPrice?: number | null | undefined;
        lastKnownPrice?: number | null | undefined;
        lowestPrice?: number | null | undefined;
        highestPrice?: number | null | undefined;
        priceLastUpdated?: string | null | undefined;
        isPurchased: boolean;
        purchasedQuantity?: number | null | undefined;
        purchasedPrice?: number | null | undefined;
        purchaseDate?: string | null | undefined;
        aisle?: string | null | undefined;
        storeSection?: string | null | undefined;
        previouslyPurchased: boolean;
        lastPurchaseDate?: string | null | undefined;
        purchaseCount: number;
        itemName?: string | null | undefined;
        unitName?: string | null | undefined;
        notes?: string | null | undefined;
        priority: number;
        category?: string | null | undefined;
        sortOrder: number;
        isAutoAdded: boolean;
        autoAddReason?: string | null | undefined;
        isFromMealPlan: boolean;
        mealPlanReference?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        deletedAt?: string | null | undefined;
        version: number;
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
            }
          | null
          | undefined;
        unit?:
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
            }
          | null
          | undefined;
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
                    emailNotifications: boolean;
                    pushNotifications: boolean;
                    theme: AppTheme;
                  }
                | null
                | undefined;
            }
          | null
          | undefined;
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
                    emailNotifications: boolean;
                    pushNotifications: boolean;
                    theme: AppTheme;
                  }
                | null
                | undefined;
            }
          | null
          | undefined;
        purchases?:
          | Array<{
              __typename?: 'Purchase';
              id: string;
              purchaseDate: string;
              quantity: number;
              unitPrice: number;
              totalPrice: number;
              itemName: string;
              unitSymbol: string;
              user: {
                __typename?: 'User';
                id: string;
                email: string;
                profile?:
                  | {
                      __typename?: 'UserProfile';
                      id: string;
                      displayName?: string | null | undefined;
                    }
                  | null
                  | undefined;
              };
            }>
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type GetShoppingListCollaboratorsQueryVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type GetShoppingListCollaboratorsQuery = {
  __typename?: 'Query';
  shoppingListCollaborators: Array<{
    __typename?: 'ShoppingListCollaborator';
    id: string;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    invitedAt: string;
    statusChangedAt?: string | null | undefined;
    email?: string | null | undefined;
    collaborator?:
      | {
          __typename?: 'User';
          email: string;
          role: UserRole;
          emailVerified: boolean;
          id: string;
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
    items: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      isPurchased: boolean;
    }>;
    collaborators?:
      | Array<{
          __typename?: 'ShoppingListCollaborator';
          id: string;
          email?: string | null | undefined;
          role: CollaboratorRole;
        }>
      | null
      | undefined;
    ownerships?:
      | Array<{
          __typename?: 'ShoppingListOwnership';
          id: string;
          createdAt: string;
          transferredAt?: string | null | undefined;
          transferredFrom?: string | null | undefined;
          user: { __typename?: 'User'; id: string };
          shoppingList: { __typename?: 'ShoppingList'; id: string };
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
    items: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      isPurchased: boolean;
    }>;
    collaborators?:
      | Array<{
          __typename?: 'ShoppingListCollaborator';
          id: string;
          email?: string | null | undefined;
          role: CollaboratorRole;
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
  deleteShoppingList: boolean;
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
    inviteToken?: string | null | undefined;
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
    id: string;
    quantity?: number | null | undefined;
    estimatedPrice?: number | null | undefined;
    budgetPrice?: number | null | undefined;
    lastKnownPrice?: number | null | undefined;
    lowestPrice?: number | null | undefined;
    highestPrice?: number | null | undefined;
    priceLastUpdated?: string | null | undefined;
    isPurchased: boolean;
    purchasedQuantity?: number | null | undefined;
    purchasedPrice?: number | null | undefined;
    purchaseDate?: string | null | undefined;
    aisle?: string | null | undefined;
    storeSection?: string | null | undefined;
    previouslyPurchased: boolean;
    lastPurchaseDate?: string | null | undefined;
    purchaseCount: number;
    itemName?: string | null | undefined;
    unitName?: string | null | undefined;
    notes?: string | null | undefined;
    priority: number;
    category?: string | null | undefined;
    sortOrder: number;
    isAutoAdded: boolean;
    autoAddReason?: string | null | undefined;
    isFromMealPlan: boolean;
    mealPlanReference?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    version: number;
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
        }
      | null
      | undefined;
    unit?:
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
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchases?:
      | Array<{
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
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
    id: string;
    quantity?: number | null | undefined;
    estimatedPrice?: number | null | undefined;
    budgetPrice?: number | null | undefined;
    lastKnownPrice?: number | null | undefined;
    lowestPrice?: number | null | undefined;
    highestPrice?: number | null | undefined;
    priceLastUpdated?: string | null | undefined;
    isPurchased: boolean;
    purchasedQuantity?: number | null | undefined;
    purchasedPrice?: number | null | undefined;
    purchaseDate?: string | null | undefined;
    aisle?: string | null | undefined;
    storeSection?: string | null | undefined;
    previouslyPurchased: boolean;
    lastPurchaseDate?: string | null | undefined;
    purchaseCount: number;
    itemName?: string | null | undefined;
    unitName?: string | null | undefined;
    notes?: string | null | undefined;
    priority: number;
    category?: string | null | undefined;
    sortOrder: number;
    isAutoAdded: boolean;
    autoAddReason?: string | null | undefined;
    isFromMealPlan: boolean;
    mealPlanReference?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    version: number;
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
        }
      | null
      | undefined;
    unit?:
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
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchases?:
      | Array<{
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
  };
};

export type RemoveItemFromShoppingListMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type RemoveItemFromShoppingListMutation = {
  __typename?: 'Mutation';
  removeItemFromShoppingList: boolean;
};

export type MarkItemPurchasedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  status: Scalars['Boolean']['input'];
}>;

export type MarkItemPurchasedMutation = {
  __typename?: 'Mutation';
  markItemPurchased: {
    __typename?: 'ShoppingListItem';
    id: string;
    quantity?: number | null | undefined;
    estimatedPrice?: number | null | undefined;
    budgetPrice?: number | null | undefined;
    lastKnownPrice?: number | null | undefined;
    lowestPrice?: number | null | undefined;
    highestPrice?: number | null | undefined;
    priceLastUpdated?: string | null | undefined;
    isPurchased: boolean;
    purchasedQuantity?: number | null | undefined;
    purchasedPrice?: number | null | undefined;
    purchaseDate?: string | null | undefined;
    aisle?: string | null | undefined;
    storeSection?: string | null | undefined;
    previouslyPurchased: boolean;
    lastPurchaseDate?: string | null | undefined;
    purchaseCount: number;
    itemName?: string | null | undefined;
    unitName?: string | null | undefined;
    notes?: string | null | undefined;
    priority: number;
    category?: string | null | undefined;
    sortOrder: number;
    isAutoAdded: boolean;
    autoAddReason?: string | null | undefined;
    isFromMealPlan: boolean;
    mealPlanReference?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    version: number;
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
        }
      | null
      | undefined;
    unit?:
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
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchases?:
      | Array<{
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
  };
};

export type ReorderShoppingListItemsMutationVariables = Exact<{
  input: ReorderShoppingListItemsInput;
}>;

export type ReorderShoppingListItemsMutation = {
  __typename?: 'Mutation';
  reorderShoppingListItems: Array<{
    __typename?: 'ShoppingListItem';
    id: string;
    quantity?: number | null | undefined;
    estimatedPrice?: number | null | undefined;
    budgetPrice?: number | null | undefined;
    lastKnownPrice?: number | null | undefined;
    lowestPrice?: number | null | undefined;
    highestPrice?: number | null | undefined;
    priceLastUpdated?: string | null | undefined;
    isPurchased: boolean;
    purchasedQuantity?: number | null | undefined;
    purchasedPrice?: number | null | undefined;
    purchaseDate?: string | null | undefined;
    aisle?: string | null | undefined;
    storeSection?: string | null | undefined;
    previouslyPurchased: boolean;
    lastPurchaseDate?: string | null | undefined;
    purchaseCount: number;
    itemName?: string | null | undefined;
    unitName?: string | null | undefined;
    notes?: string | null | undefined;
    priority: number;
    category?: string | null | undefined;
    sortOrder: number;
    isAutoAdded: boolean;
    autoAddReason?: string | null | undefined;
    isFromMealPlan: boolean;
    mealPlanReference?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    version: number;
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
        }
      | null
      | undefined;
    unit?:
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
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchases?:
      | Array<{
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
  }>;
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
              items: Array<{
                __typename?: 'ShoppingListItem';
                id: string;
                itemName?: string | null | undefined;
                quantity?: number | null | undefined;
                isPurchased: boolean;
                estimatedPrice?: number | null | undefined;
              }>;
            }
          | null
          | undefined;
        previousValues?:
          | {
              __typename?: 'ShoppingListPreviousValues';
              name?: string | null | undefined;
              status?: ListStatus | null | undefined;
              isCompleted?: boolean | null | undefined;
              budgetAmount?: number | null | undefined;
              totalCost?: number | null | undefined;
              estimatedTotal?: number | null | undefined;
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
        previousValues?:
          | {
              __typename?: 'ShoppingListPreviousValues';
              name?: string | null | undefined;
              status?: ListStatus | null | undefined;
              isCompleted?: boolean | null | undefined;
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
              id: string;
              quantity?: number | null | undefined;
              estimatedPrice?: number | null | undefined;
              budgetPrice?: number | null | undefined;
              lastKnownPrice?: number | null | undefined;
              lowestPrice?: number | null | undefined;
              highestPrice?: number | null | undefined;
              priceLastUpdated?: string | null | undefined;
              isPurchased: boolean;
              purchasedQuantity?: number | null | undefined;
              purchasedPrice?: number | null | undefined;
              purchaseDate?: string | null | undefined;
              aisle?: string | null | undefined;
              storeSection?: string | null | undefined;
              previouslyPurchased: boolean;
              lastPurchaseDate?: string | null | undefined;
              purchaseCount: number;
              itemName?: string | null | undefined;
              unitName?: string | null | undefined;
              notes?: string | null | undefined;
              priority: number;
              category?: string | null | undefined;
              sortOrder: number;
              isAutoAdded: boolean;
              autoAddReason?: string | null | undefined;
              isFromMealPlan: boolean;
              mealPlanReference?: string | null | undefined;
              createdAt: string;
              updatedAt: string;
              deletedAt?: string | null | undefined;
              version: number;
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
                  }
                | null
                | undefined;
              unit?:
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
                  }
                | null
                | undefined;
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
                          emailNotifications: boolean;
                          pushNotifications: boolean;
                          theme: AppTheme;
                        }
                      | null
                      | undefined;
                  }
                | null
                | undefined;
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
                          emailNotifications: boolean;
                          pushNotifications: boolean;
                          theme: AppTheme;
                        }
                      | null
                      | undefined;
                  }
                | null
                | undefined;
              purchases?:
                | Array<{
                    __typename?: 'Purchase';
                    id: string;
                    purchaseDate: string;
                    quantity: number;
                    unitPrice: number;
                    totalPrice: number;
                    itemName: string;
                    unitSymbol: string;
                    user: {
                      __typename?: 'User';
                      id: string;
                      email: string;
                      profile?:
                        | {
                            __typename?: 'UserProfile';
                            id: string;
                            displayName?: string | null | undefined;
                          }
                        | null
                        | undefined;
                    };
                  }>
                | null
                | undefined;
            }
          | null
          | undefined;
        previousValues?:
          | {
              __typename?: 'ShoppingListItemPreviousValues';
              name?: string | null | undefined;
              quantity?: number | null | undefined;
              isCompleted?: boolean | null | undefined;
              price?: number | null | undefined;
              notes?: string | null | undefined;
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

export type ShoppingListItemAddedSubscriptionVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type ShoppingListItemAddedSubscription = {
  __typename?: 'Subscription';
  shoppingListItemAdded: {
    __typename?: 'ShoppingListItem';
    id: string;
    quantity?: number | null | undefined;
    estimatedPrice?: number | null | undefined;
    budgetPrice?: number | null | undefined;
    lastKnownPrice?: number | null | undefined;
    lowestPrice?: number | null | undefined;
    highestPrice?: number | null | undefined;
    priceLastUpdated?: string | null | undefined;
    isPurchased: boolean;
    purchasedQuantity?: number | null | undefined;
    purchasedPrice?: number | null | undefined;
    purchaseDate?: string | null | undefined;
    aisle?: string | null | undefined;
    storeSection?: string | null | undefined;
    previouslyPurchased: boolean;
    lastPurchaseDate?: string | null | undefined;
    purchaseCount: number;
    itemName?: string | null | undefined;
    unitName?: string | null | undefined;
    notes?: string | null | undefined;
    priority: number;
    category?: string | null | undefined;
    sortOrder: number;
    isAutoAdded: boolean;
    autoAddReason?: string | null | undefined;
    isFromMealPlan: boolean;
    mealPlanReference?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    version: number;
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
        }
      | null
      | undefined;
    unit?:
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
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchases?:
      | Array<{
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
  };
};

export type ShoppingListItemUpdatedSubscriptionVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type ShoppingListItemUpdatedSubscription = {
  __typename?: 'Subscription';
  shoppingListItemUpdated: {
    __typename?: 'ShoppingListItem';
    id: string;
    quantity?: number | null | undefined;
    estimatedPrice?: number | null | undefined;
    budgetPrice?: number | null | undefined;
    lastKnownPrice?: number | null | undefined;
    lowestPrice?: number | null | undefined;
    highestPrice?: number | null | undefined;
    priceLastUpdated?: string | null | undefined;
    isPurchased: boolean;
    purchasedQuantity?: number | null | undefined;
    purchasedPrice?: number | null | undefined;
    purchaseDate?: string | null | undefined;
    aisle?: string | null | undefined;
    storeSection?: string | null | undefined;
    previouslyPurchased: boolean;
    lastPurchaseDate?: string | null | undefined;
    purchaseCount: number;
    itemName?: string | null | undefined;
    unitName?: string | null | undefined;
    notes?: string | null | undefined;
    priority: number;
    category?: string | null | undefined;
    sortOrder: number;
    isAutoAdded: boolean;
    autoAddReason?: string | null | undefined;
    isFromMealPlan: boolean;
    mealPlanReference?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null | undefined;
    version: number;
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
        }
      | null
      | undefined;
    unit?:
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
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
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
                emailNotifications: boolean;
                pushNotifications: boolean;
                theme: AppTheme;
              }
            | null
            | undefined;
        }
      | null
      | undefined;
    purchases?:
      | Array<{
          __typename?: 'Purchase';
          id: string;
          purchaseDate: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          itemName: string;
          unitSymbol: string;
          user: {
            __typename?: 'User';
            id: string;
            email: string;
            profile?:
              | {
                  __typename?: 'UserProfile';
                  id: string;
                  displayName?: string | null | undefined;
                }
              | null
              | undefined;
          };
        }>
      | null
      | undefined;
  };
};

export type ShoppingListItemRemovedSubscriptionVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type ShoppingListItemRemovedSubscription = {
  __typename?: 'Subscription';
  shoppingListItemRemoved: {
    __typename?: 'ShoppingListItem';
    id: string;
    itemName?: string | null | undefined;
  };
};
