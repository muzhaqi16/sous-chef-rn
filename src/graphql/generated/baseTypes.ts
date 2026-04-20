// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.This scalar is serialized to a string in ISO 8601 format and parsed from a string in ISO 8601 format. */
  DateTime: { input: string; output: string; }
  /** Quantity input that accepts both strings and numbers. Strings can be fractions like "1/3" or "1 1/4". */
  FlexibleQuantity: { input: string | number; output: string; }
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSON: { input: any; output: any; }
  Upload: { input: { uri: string; type: string; name: string }; output: { uri: string; type: string; name: string }; }
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
  Write = 'WRITE'
}

/** Indicates how a pantry item was originally acquired or added to the inventory */
export enum AcquisitionMethod {
  /** Added by scanning the product barcode */
  BarcodeScan = 'BARCODE_SCAN',
  /** Received as a gift from someone else */
  Gifted = 'GIFTED',
  /** Grown at home in a garden, farm, or indoor setup */
  Homegrown = 'HOMEGROWN',
  /** Acquired through a method not covered by the other options */
  Other = 'OTHER',
  /** Bought from a store, market, or online retailer */
  Purchased = 'PURCHASED',
  /** Added to the pantry after being purchased from a shopping list */
  ShoppingList = 'SHOPPING_LIST'
}

export type AddCollaboratorInput = {
  email: Scalars['String']['input'];
  role: CollaboratorRole;
  shoppingListId: Scalars['ID']['input'];
};

export type AddIngredientResult = {
  __typename: 'AddIngredientResult';
  previousQuantity: Maybe<Scalars['Float']['output']>;
  quantityAdded: Scalars['Float']['output'];
  shoppingListItem: ShoppingListItem;
  unitConversionApplied: Scalars['Boolean']['output'];
  wasUpdated: Scalars['Boolean']['output'];
};

/** Result of adding a pantry item to a shopping list */
export type AddPantryItemToShoppingListResult = {
  __typename: 'AddPantryItemToShoppingListResult';
  shoppingListItemId: Scalars['ID']['output'];
};

/** Input for adding recipe ingredients to a shopping list */
export type AddRecipeToShoppingListInput = {
  checkPantry?: InputMaybe<Scalars['Boolean']['input']>;
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type AddRecipeToShoppingListResult = {
  __typename: 'AddRecipeToShoppingListResult';
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

export enum AddedContext {
  Expiring = 'EXPIRING',
  FromMealPlan = 'FROM_MEAL_PLAN',
  FromRecipe = 'FROM_RECIPE',
  LowStock = 'LOW_STOCK',
  Manual = 'MANUAL',
  PantryMissing = 'PANTRY_MISSING',
  Recurring = 'RECURRING',
  Suggested = 'SUGGESTED'
}

/** Item that was added to the shopping list from low stock detection */
export type AddedLowStockItem = {
  __typename: 'AddedLowStockItem';
  itemName: Scalars['String']['output'];
  pantryItemId: Scalars['ID']['output'];
  quantity: Scalars['Float']['output'];
  shoppingListItemId: Scalars['ID']['output'];
};

/** Cost analytics for additions/restocks */
export type AdditionCostAnalytics = {
  __typename: 'AdditionCostAnalytics';
  averageCostPerUnit: Scalars['Float']['output'];
  costByStore: Array<StoreCostBreakdown>;
  totalSpent: Scalars['Float']['output'];
};

/**
 * Input for adjusting pantry item quantity to match physical count.
 * Creates an ADJUSTMENT usage record for audit trail.
 */
export type AdjustPantryItemQuantityInput = {
  /** The actual quantity from physical count */
  newQuantity: Scalars['Float']['input'];
  /** Why the adjustment was made (required for audit trail) */
  reason: Scalars['String']['input'];
  /** Explicit remaining net weight override for full recount scenarios (dual-tracked items only) */
  remainingNetWeight?: InputMaybe<Scalars['Float']['input']>;
  /** Optimistic concurrency control — must match current version */
  version?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Input for batch deleting images from S3/MinIO storage.
 * Used by admin panel after duplicate detection.
 */
export type AdminDeleteImagesInput = {
  /** Image URLs to delete from S3/MinIO storage */
  imageUrls: Array<Scalars['String']['input']>;
  /**
   * Optional Item IDs to update after deletion.
   * If not provided, all items will be checked for affected images.
   */
  itemIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /**
   * Force background job processing regardless of batch size.
   * By default, batches >50 images are automatically queued.
   */
  useQueue?: InputMaybe<Scalars['Boolean']['input']>;
};

export type AdminDeleteUserInput = {
  /** If true, permanently deletes the user (SuperAdmin only) */
  hard?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Paginated result for admin item unit conversion listing */
export type AdminItemUnitConversionsResult = {
  __typename: 'AdminItemUnitConversionsResult';
  conversions: Array<ItemUnitConversion>;
  totalCount: Scalars['Int']['output'];
};

/** Result of quantity aggregation (add/subtract) */
export type AggregationResult = {
  __typename: 'AggregationResult';
  displayText: Scalars['String']['output'];
  quantity: Scalars['Float']['output'];
  sufficient: Maybe<Scalars['Boolean']['output']>;
  unit: Unit;
};

/** Typed allergen information (replaces JSON allergens field) */
export type AllergenInfo = {
  __typename: 'AllergenInfo';
  contains: Scalars['Boolean']['output'];
  mayContain: Maybe<Scalars['Boolean']['output']>;
  name: Scalars['String']['output'];
  processedIn: Maybe<Scalars['Boolean']['output']>;
  severity: Maybe<AllergenSeverity>;
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
  Trace = 'TRACE'
}

/** Input for filtering analytics queries by time period */
export type AnalyticsFilters = {
  /** Custom date range - overrides dateRange if both provided */
  customRange?: InputMaybe<DateRangeInput>;
  /** Predefined date range (TODAY, LAST_WEEK, LAST_MONTH, etc.) */
  dateRange?: InputMaybe<DateRange>;
  /** Limit for top items lists (default: 10) */
  topItemsLimit?: InputMaybe<Scalars['Int']['input']>;
};

/** Sub-input for API/automation detection */
export type ApiAutomationInput = {
  apiClient?: InputMaybe<Scalars['String']['input']>;
  isApiLogin?: InputMaybe<Scalars['Boolean']['input']>;
  isAutomated?: InputMaybe<Scalars['Boolean']['input']>;
};

export enum AppTheme {
  Dark = 'DARK',
  Light = 'LIGHT',
  System = 'SYSTEM'
}

export enum AppealStatus {
  Approved = 'APPROVED',
  Denied = 'DENIED',
  Submitted = 'SUBMITTED',
  UnderReview = 'UNDER_REVIEW',
  Withdrawn = 'WITHDRAWN'
}

/** Sub-input for attribution data */
export type AttributionInput = {
  campaign?: InputMaybe<Scalars['String']['input']>;
  landingPage?: InputMaybe<Scalars['String']['input']>;
  referrer?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
};

/** Authentication response containing tokens - NEVER cache */
export type AuthPayload = {
  __typename: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
  user: User;
};

export type AutocompleteCategoryInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  query: Scalars['String']['input'];
  type?: InputMaybe<CategoryType>;
};

export type AutocompleteCategoryResponse = {
  __typename: 'AutocompleteCategoryResponse';
  suggestions: Array<CategorySuggestion>;
  totalCount: Scalars['Int']['output'];
};

export type AutocompleteInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  storeId?: InputMaybe<Scalars['ID']['input']>;
};

export type AutocompleteResponse = {
  __typename: 'AutocompleteResponse';
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
  SuspiciousBehavior = 'SUSPICIOUS_BEHAVIOR'
}

/** Result of a backfill run — what would/did get queued. */
export type BackfillEmbeddingsResult = {
  __typename: 'BackfillEmbeddingsResult';
  /** Whether dryRun was set. */
  dryRun: Scalars['Boolean']['output'];
  /** How many were enqueued this call (0 if dryRun). */
  enqueued: Scalars['Int']['output'];
  /** The limit applied to this run. */
  limit: Scalars['Int']['output'];
  /** Number of items remaining without embeddings (after this run). */
  remaining: Scalars['Int']['output'];
};

export type BanUserInput = {
  reason: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export enum BaseDimension {
  Count = 'COUNT',
  Mass = 'MASS',
  Volume = 'VOLUME'
}

/** Input for a single item in batch add operation (without shoppingListId) */
export type BatchAddShoppingListItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  category?: InputMaybe<Scalars['String']['input']>;
  /** Client-provided ID for matching results (optional) */
  clientId?: InputMaybe<Scalars['String']['input']>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  netWeight?: InputMaybe<NetWeightInput>;
  notes?: InputMaybe<Scalars['String']['input']>;
  pricing?: InputMaybe<PricingEstimatesInput>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  quantity?: InputMaybe<Scalars['FlexibleQuantity']['input']>;
  recipeContext?: InputMaybe<RecipeContextInput>;
  sortOrder?: InputMaybe<Scalars['String']['input']>;
  storePrefs?: InputMaybe<StorePreferencesInput>;
  unit?: InputMaybe<UnitSpecInput>;
};

/** Result for a single item in batch add operation */
export type BatchAddShoppingListItemResult = {
  __typename: 'BatchAddShoppingListItemResult';
  /** Client ID if provided in input */
  clientId: Maybe<Scalars['String']['output']>;
  /** Error message if failed */
  error: Maybe<Scalars['String']['output']>;
  /** Index in the input array */
  index: Scalars['Int']['output'];
  /** The created/updated item (null if failed) */
  item: Maybe<ShoppingListItem>;
  /** Whether quantity was incremented (item already existed) */
  quantityIncremented: Maybe<Scalars['Boolean']['output']>;
  /** Whether the operation succeeded */
  success: Scalars['Boolean']['output'];
};

/** Response for batch add operation */
export type BatchAddShoppingListItemsResponse = {
  __typename: 'BatchAddShoppingListItemsResponse';
  /** Number of items that failed */
  failedCount: Scalars['Int']['output'];
  /** Number of items where quantity was incremented */
  incrementedCount: Scalars['Int']['output'];
  results: Array<BatchAddShoppingListItemResult>;
  /** Number of items successfully added */
  successCount: Scalars['Int']['output'];
};

export type BatchOperationSummary = {
  __typename: 'BatchOperationSummary';
  created: Scalars['Int']['output'];
  executionTime: Scalars['Float']['output'];
  failed: Scalars['Int']['output'];
  successful: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  updated: Scalars['Int']['output'];
};

/** Lifecycle status of a pantry item batch */
export enum BatchStatus {
  /** Batch has remaining quantity available for consumption */
  Active = 'ACTIVE',
  /** Batch has been fully consumed */
  Depleted = 'DEPLETED',
  /** Batch was merged into another batch */
  Merged = 'MERGED',
  /** Batch was discarded as waste */
  Wasted = 'WASTED'
}

export type BatchUpsertItemInput = {
  externalId: Scalars['String']['input'];
  externalType?: InputMaybe<Scalars['String']['input']>;
  itemData: CreateItemInput;
  source: ExternalSource;
  sourceData?: InputMaybe<Scalars['JSON']['input']>;
};

export type BatchUpsertItemResult = {
  __typename: 'BatchUpsertItemResult';
  created: Maybe<Scalars['Boolean']['output']>;
  error: Maybe<Scalars['String']['output']>;
  externalId: Scalars['String']['output'];
  item: Maybe<Item>;
  mapping: Maybe<ExternalSourceMapping>;
  source: ExternalSource;
  success: Scalars['Boolean']['output'];
};

export type BatchUpsertItemsResponse = MutationPayload & {
  __typename: 'BatchUpsertItemsResponse';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  results: Array<BatchUpsertItemResult>;
  success: Scalars['Boolean']['output'];
  summary: BatchOperationSummary;
};

/** Sub-input for behavioral signals */
export type BehavioralSignalsInput = {
  isNewBrowser?: InputMaybe<Scalars['Boolean']['input']>;
  isNewDevice?: InputMaybe<Scalars['Boolean']['input']>;
  isNewLocation?: InputMaybe<Scalars['Boolean']['input']>;
  timezoneDiff?: InputMaybe<Scalars['Int']['input']>;
};

/**
 * Brand type for product manufacturers and retailers
 * Cache: 1 hour - brand catalog is relatively stable
 */
export type Brand = {
  __typename: 'Brand';
  children: Array<Brand>;
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Denormalized count of items associated with this brand */
  itemCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  parent: Maybe<Brand>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type BrandConnection = Connection & {
  __typename: 'BrandConnection';
  edges: Array<BrandEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Brand connection for pagination */
export type BrandEdge = Edge & {
  __typename: 'BrandEdge';
  cursor: Scalars['String']['output'];
  node: Brand;
};

/** Sub-input for brand-related filters */
export type BrandFilterInput = {
  brand?: InputMaybe<Scalars['String']['input']>;
  brandIds?: InputMaybe<Array<Scalars['String']['input']>>;
  brands?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type BrandFilters = {
  /** Filter root brands (no parent) */
  isRoot?: InputMaybe<Scalars['Boolean']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
};

export type BrandOpsInput = {
  addBrandIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  removeBrandIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

/** Order by options for brands */
export type BrandOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
};

export type BrandPayload = MutationPayload & {
  __typename: 'BrandPayload';
  brand: Maybe<Brand>;
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Reusable sub-input for referencing a brand by ID or name (find-or-create) */
export type BrandReferenceInput = {
  brandId?: InputMaybe<Scalars['ID']['input']>;
  brandName?: InputMaybe<Scalars['String']['input']>;
};

export type BrandSuggestion = {
  __typename: 'BrandSuggestion';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

/** Reusable sub-input for browser and OS details */
export type BrowserOsDetailsInput = {
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  screenResolution?: InputMaybe<Scalars['String']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
};

export type BrowserStat = {
  __typename: 'BrowserStat';
  browserName: Scalars['String']['output'];
  count: Scalars['Int']['output'];
};

export type BulkCreateItemInput = {
  items: Array<CreateItemInput>;
  skipDuplicates?: InputMaybe<Scalars['Boolean']['input']>;
  updateExisting?: InputMaybe<Scalars['Boolean']['input']>;
  validateOnly?: InputMaybe<Scalars['Boolean']['input']>;
};

export type BulkCreateItemsResponse = MutationPayload & {
  __typename: 'BulkCreateItemsResponse';
  code: Scalars['String']['output'];
  created: Array<Item>;
  errors: Array<ItemError>;
  message: Scalars['String']['output'];
  skipped: Array<SkippedItem>;
  success: Scalars['Boolean']['output'];
  summary: BulkOperationSummary;
  updated: Array<Item>;
};

/** Error detail for bulk device operations */
export type BulkDeviceError = {
  __typename: 'BulkDeviceError';
  deviceId: Scalars['ID']['output'];
  message: Scalars['String']['output'];
};

/** Result of bulk device update */
export type BulkDeviceResult = MutationPayload & {
  __typename: 'BulkDeviceResult';
  code: Scalars['String']['output'];
  devices: Array<Device>;
  errors: Array<BulkDeviceError>;
  message: Scalars['String']['output'];
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

export type BulkLoginHistoryPayload = MutationPayload & {
  __typename: 'BulkLoginHistoryPayload';
  code: Scalars['String']['output'];
  count: Scalars['Int']['output'];
  loginHistories: Array<LoginHistory>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type BulkNotificationInput = {
  actionUrl?: InputMaybe<Scalars['String']['input']>;
  batchId?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<NotificationCategory>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  payload: Scalars['JSON']['input'];
  priority?: InputMaybe<Priority>;
  title?: InputMaybe<Scalars['String']['input']>;
  type: NotificationType;
  userIds: Array<Scalars['String']['input']>;
};

export type BulkNotificationPayload = MutationPayload & {
  __typename: 'BulkNotificationPayload';
  code: Scalars['String']['output'];
  count: Scalars['Int']['output'];
  message: Scalars['String']['output'];
  notifications: Array<Notification>;
  success: Scalars['Boolean']['output'];
};

export type BulkNotificationResult = MutationPayload & {
  __typename: 'BulkNotificationResult';
  code: Scalars['String']['output'];
  failed: Array<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  sent: Array<Notification>;
  success: Scalars['Boolean']['output'];
  totalFailed: Scalars['Int']['output'];
  totalSent: Scalars['Int']['output'];
};

export type BulkOperationSummary = MutationPayload & {
  __typename: 'BulkOperationSummary';
  code: Scalars['String']['output'];
  executionTime: Scalars['Float']['output'];
  failed: Scalars['Int']['output'];
  message: Scalars['String']['output'];
  skipped: Scalars['Int']['output'];
  success: Scalars['Boolean']['output'];
  successful: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type BulkPurchasePayload = MutationPayload & {
  __typename: 'BulkPurchasePayload';
  code: Scalars['String']['output'];
  count: Scalars['Int']['output'];
  message: Scalars['String']['output'];
  purchases: Array<Purchase>;
  success: Scalars['Boolean']['output'];
};

export type BulkStorePayload = MutationPayload & {
  __typename: 'BulkStorePayload';
  code: Scalars['String']['output'];
  count: Scalars['Int']['output'];
  message: Scalars['String']['output'];
  stores: Array<Store>;
  success: Scalars['Boolean']['output'];
};

/**
 * Scope for cache control (PUBLIC or PRIVATE)
 * PUBLIC: Can be cached by CDN and shared caches
 * PRIVATE: Can only be cached by private/user-specific caches
 */
export enum CacheControlScope {
  Private = 'PRIVATE',
  Public = 'PUBLIC'
}

export type CanDeleteAccountResult = {
  __typename: 'CanDeleteAccountResult';
  blockers: Array<DeletionBlocker>;
  canDelete: Scalars['Boolean']['output'];
};

/** Input for categorizing an item */
export type CategorizeItemInput = {
  categoryId: Scalars['ID']['input'];
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
};

/**
 * Category type for organizing items
 * Cache: 2 hours - reference data that changes very rarely
 */
export type Category = {
  __typename: 'Category';
  children: Array<Category>;
  color: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy: Maybe<User>;
  description: Maybe<Scalars['String']['output']>;
  icon: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isSystem: Scalars['Boolean']['output'];
  itemCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  parent: Maybe<Category>;
  slug: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  type: CategoryType;
  updatedAt: Scalars['DateTime']['output'];
  usageCount: Scalars['Int']['output'];
  version: Scalars['Int']['output'];
  visibility: Visibility;
};

export type CategoryConnection = Connection & {
  __typename: 'CategoryConnection';
  edges: Array<CategoryEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Category connection for pagination (Relay spec) */
export type CategoryEdge = Edge & {
  __typename: 'CategoryEdge';
  cursor: Scalars['String']['output'];
  node: Category;
};

export type CategoryFilters = {
  parentId?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<CategoryType>;
};

export type CategoryOpsInput = {
  addCategoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  primaryCategoryId?: InputMaybe<Scalars['ID']['input']>;
  removeCategoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

/** Order by options for categories */
export type CategoryOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  sortOrder?: InputMaybe<SortOrder>;
};

export type CategoryPayload = MutationPayload & {
  __typename: 'CategoryPayload';
  category: Maybe<Category>;
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export enum CategorySource {
  Ai = 'AI',
  Auto = 'AUTO',
  Crowd = 'CROWD',
  Import = 'IMPORT',
  Manual = 'MANUAL'
}

export type CategorySuggestion = {
  __typename: 'CategorySuggestion';
  color: Maybe<Scalars['String']['output']>;
  icon: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  slug: Maybe<Scalars['String']['output']>;
  type: CategoryType;
};

export enum CategoryType {
  Cuisine = 'CUISINE',
  Custom = 'CUSTOM',
  Dietary = 'DIETARY',
  General = 'GENERAL',
  MealType = 'MEAL_TYPE',
  Storage = 'STORAGE',
  System = 'SYSTEM'
}

export type ChangePasswordInput = {
  currentPassword: Scalars['String']['input'];
  newPassword: Scalars['String']['input'];
};

export type ChangePasswordResponse = MutationPayload & {
  __typename: 'ChangePasswordResponse';
  code: Scalars['String']['output'];
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
  WebApp = 'WEB_APP'
}

/** Change types for pantry item modifications */
export enum ChangeType {
  Consumed = 'CONSUMED',
  Created = 'CREATED',
  Deleted = 'DELETED',
  ExpirationUpdated = 'EXPIRATION_UPDATED',
  LocationUpdated = 'LOCATION_UPDATED',
  QuantityUpdated = 'QUANTITY_UPDATED',
  WeightCorrected = 'WEIGHT_CORRECTED'
}

/** Response for clearing items from a shopping list */
export type ClearItemsResponse = {
  __typename: 'ClearItemsResponse';
  /** IDs of items that were cleared */
  clearedItemIds: Array<Scalars['ID']['output']>;
  /** Summary of the bulk operation */
  summary: BulkOperationSummary;
};

export type CollaborationChangeEvent = {
  __typename: 'CollaborationChangeEvent';
  collaborator: ShoppingListCollaborator;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

/** Order by options for collaborators */
export type CollaboratorOrderBy = {
  invitedAt?: InputMaybe<SortOrder>;
  itemsAdded?: InputMaybe<SortOrder>;
  lastViewedAt?: InputMaybe<SortOrder>;
};

/** Defines the role and permission level of a collaborator on a shopping list */
export enum CollaboratorRole {
  /** Can manage list settings, collaborators, and all items */
  Admin = 'ADMIN',
  /** Can add new items and edit their own contributions */
  Contributor = 'CONTRIBUTOR',
  /** Can add, edit, and remove any items on the list */
  Editor = 'EDITOR',
  /** Full ownership with the ability to transfer or delete the list */
  Owner = 'OWNER',
  /** Can view the list and mark items as purchased while shopping */
  Shopper = 'SHOPPER',
  /** Read-only access to view the list and its items */
  Viewer = 'VIEWER'
}

export enum CollaboratorStatus {
  Active = 'ACTIVE',
  Pending = 'PENDING',
  Removed = 'REMOVED'
}

export type CompatibleUnit = {
  __typename: 'CompatibleUnit';
  conversionConfidence: Maybe<Scalars['Float']['output']>;
  conversionRatio: Maybe<Scalars['Float']['output']>;
  isConfigured: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  source: Maybe<ConversionSource>;
  unit: Unit;
  usageContexts: Array<UnitUsageContext>;
};

export type CompleteShoppingListInput = {
  completedShopDate?: InputMaybe<Scalars['DateTime']['input']>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
};

/** Input for confirming recipe ingredient consumption from pantry */
export type ConfirmRecipeConsumptionInput = {
  consumptions: Array<ConfirmedIngredientConsumptionInput>;
  pantryId: Scalars['ID']['input'];
  recipeId: Scalars['ID']['input'];
};

export type ConfirmedIngredientConsumptionInput = {
  pantryItemId: Scalars['ID']['input'];
  quantity: Scalars['Float']['input'];
  recipeIngredientId: Scalars['ID']['input'];
  unitId: Scalars['ID']['input'];
};

export type Connection = {
  edges: Array<Edge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Sub-input for connectivity info */
export type ConnectivityInput = {
  carrier?: InputMaybe<Scalars['String']['input']>;
  isAirplaneMode?: InputMaybe<Scalars['Boolean']['input']>;
  isLocationEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ConsumptionFailure = {
  __typename: 'ConsumptionFailure';
  availableQuantity: Scalars['Float']['output'];
  pantryItemId: Scalars['ID']['output'];
  reason: Scalars['String']['output'];
  recipeIngredientId: Scalars['ID']['output'];
  requestedQuantity: Scalars['Float']['output'];
};

/** Consumption rate for an item or pantry */
export type ConsumptionRate = {
  __typename: 'ConsumptionRate';
  averageDailyConsumption: Scalars['Float']['output'];
  dataPoints: Scalars['Int']['output'];
  daysUntilEmpty: Maybe<Scalars['Float']['output']>;
  itemId: Maybe<Scalars['ID']['output']>;
  itemName: Maybe<Scalars['String']['output']>;
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  unitName: Maybe<Scalars['String']['output']>;
};

/** Conversion availability result */
export type ConversionAvailability = {
  __typename: 'ConversionAvailability';
  available: Scalars['Boolean']['output'];
  confidence: Scalars['Float']['output'];
  conversionType: ConversionType;
  notes: Maybe<Scalars['String']['output']>;
  requiresItemContext: Scalars['Boolean']['output'];
};

/** Result of a unit conversion operation */
export type ConversionResult = {
  __typename: 'ConversionResult';
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
  UserDefined = 'USER_DEFINED'
}

/** Count of conversions grouped by source */
export type ConversionSourceCount = {
  __typename: 'ConversionSourceCount';
  count: Scalars['Int']['output'];
  source: ConversionSource;
};

/** Summary statistics for item unit conversions */
export type ConversionStats = {
  __typename: 'ConversionStats';
  bySource: Array<ConversionSourceCount>;
  totalConversions: Scalars['Int']['output'];
  unverifiedCount: Scalars['Int']['output'];
  verifiedCount: Scalars['Int']['output'];
};

/** Type of conversion being performed */
export enum ConversionType {
  CrossTypeDensityBased = 'CROSS_TYPE_DENSITY_BASED',
  CrossTypeItemSpecific = 'CROSS_TYPE_ITEM_SPECIFIC',
  NotPossible = 'NOT_POSSIBLE',
  SameTypeCustom = 'SAME_TYPE_CUSTOM',
  SameTypeStandard = 'SAME_TYPE_STANDARD'
}

export type ConvertedUnitValue = {
  __typename: 'ConvertedUnitValue';
  conversionFactor: Scalars['Float']['output'];
  fromUnit: Unit;
  toUnit: Unit;
  value: Scalars['Float']['output'];
};

export type ConvertedValue = {
  __typename: 'ConvertedValue';
  unit: Unit;
  value: Scalars['Float']['output'];
};

/** Cooking activity log - personal user data */
export type CookingLog = {
  __typename: 'CookingLog';
  actualCookTime: Maybe<Scalars['Int']['output']>;
  actualPrepTime: Maybe<Scalars['Int']['output']>;
  cookedAt: Scalars['DateTime']['output'];
  deductionMethod: Maybe<DeductionMethod>;
  difficulty: Maybe<Difficulty>;
  id: Scalars['ID']['output'];
  imageUrl: Maybe<Scalars['String']['output']>;
  ingredientsUsed: Maybe<Scalars['JSON']['output']>;
  notes: Maybe<Scalars['String']['output']>;
  pantryDeducted: Scalars['Boolean']['output'];
  pantryItemsUsed: Array<PantryItemUsage>;
  rating: Maybe<Scalars['Int']['output']>;
  recipe: Recipe;
  servingsMade: Maybe<Scalars['Int']['output']>;
  user: User;
  wouldMakeAgain: Maybe<Scalars['Boolean']['output']>;
};

export type CookingLogConnection = Connection & {
  __typename: 'CookingLogConnection';
  edges: Array<CookingLogEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Cooking log connection for pagination */
export type CookingLogEdge = Edge & {
  __typename: 'CookingLogEdge';
  cursor: Scalars['String']['output'];
  node: CookingLog;
};

/** Order by options for cooking logs */
export type CookingLogOrderBy = {
  cookedAt?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
};

export type CookingLogPayload = MutationPayload & {
  __typename: 'CookingLogPayload';
  code: Scalars['String']['output'];
  cookingLog: Maybe<CookingLog>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type CookingStats = {
  __typename: 'CookingStats';
  averageRating: Maybe<Scalars['Float']['output']>;
  favoriteRecipes: Array<Recipe>;
  recentCookingLogs: Array<CookingLog>;
  totalCookingSessions: Scalars['Int']['output'];
  totalRecipesCooked: Scalars['Int']['output'];
};

/**
 * Input for correcting the net weight of a dual-tracked pantry item.
 * Recalculates remainingNetWeight proportionally and derives new quantity.
 */
export type CorrectPantryItemWeightInput = {
  /** The corrected net weight per unit (e.g., 12.5 for 12.5 oz per jar) */
  netWeight: Scalars['Float']['input'];
  /** Unit for the net weight (optional — only provide to also change the unit) */
  netWeightUnitId?: InputMaybe<Scalars['ID']['input']>;
  /** Why the correction is needed (required for audit trail) */
  reason: Scalars['String']['input'];
  /** Optimistic concurrency control */
  version: Scalars['Int']['input'];
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
  parentId?: InputMaybe<Scalars['ID']['input']>;
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
  appVersion?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<DeviceDetailsInput>;
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<NetworkLocationInput>;
  platform?: InputMaybe<MobilePlatform>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type CreateFromTemplateInput = {
  name?: InputMaybe<Scalars['String']['input']>;
  plannedShopDate?: InputMaybe<Scalars['DateTime']['input']>;
  targetStoreId?: InputMaybe<Scalars['ID']['input']>;
  templateId: Scalars['ID']['input'];
};

export type CreateHomeInput = {
  allowJoinCode?: InputMaybe<Scalars['Boolean']['input']>;
  createDefaultPantry?: InputMaybe<Scalars['Boolean']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  defaultPantryName?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  maxMembers?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<HomeType>;
};

export type CreateItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  classification?: InputMaybe<ItemClassificationInput>;
  description?: InputMaybe<Scalars['String']['input']>;
  externalSources?: InputMaybe<Array<ExternalSourceMappingInput>>;
  healthInfo?: InputMaybe<HealthInfoInput>;
  media?: InputMaybe<MediaAssetsInput>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  netWeights?: InputMaybe<Array<ItemNetWeightInput>>;
  nutritionFacts?: InputMaybe<Array<NutritionFactInput>>;
  packageInfo?: InputMaybe<PackageInfoInput>;
  productDetails?: InputMaybe<ProductDetailsInput>;
  storeSkus?: InputMaybe<Array<StoreSkuInput>>;
  type?: InputMaybe<ItemType>;
  unitConfig?: InputMaybe<ItemUnitConfigInput>;
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
  /**
   * Optional: Link meal plan to a home for shared access.
   * If not provided, the plan is personal (user-scoped only).
   */
  homeId?: InputMaybe<Scalars['ID']['input']>;
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
  /**
   * Optional: Link template to a home for shared access.
   * If not provided, the template is personal (user-scoped only).
   */
  homeId?: InputMaybe<Scalars['ID']['input']>;
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
  category?: InputMaybe<NotificationCategory>;
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
  brand?: InputMaybe<BrandReferenceInput>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  forceAdd?: InputMaybe<Scalars['Boolean']['input']>;
  item?: InputMaybe<InlineItemInput>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  netWeight?: InputMaybe<NetWeightInput>;
  pantryId: Scalars['ID']['input'];
  purchase?: InputMaybe<PurchaseInfoInput>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  storage?: InputMaybe<StorageDetailsInput>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  thresholds?: InputMaybe<InventoryThresholdsInput>;
  unit?: InputMaybe<UnitSpecInput>;
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
  attribution?: InputMaybe<RecipeAttributionInput>;
  caloriesPerServing?: InputMaybe<Scalars['Float']['input']>;
  category?: InputMaybe<RecipeCategory>;
  cookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  cuisine?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dietary?: InputMaybe<DietaryTagsInput>;
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
  media?: InputMaybe<MediaAssetsInput>;
  metadata?: InputMaybe<RecipeMetadataInput>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  nutrition?: InputMaybe<NutritionInfoInput>;
  nutritionData?: InputMaybe<Scalars['JSON']['input']>;
  prepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<RecipeStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timing?: InputMaybe<TimeEstimatesInput>;
  tips?: InputMaybe<Scalars['String']['input']>;
};

export type CreateRecipeReviewInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  rating: Scalars['Int']['input'];
  recipeId: Scalars['ID']['input'];
};

export type CreateShoppingListInput = {
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  homeId?: InputMaybe<Scalars['ID']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateShoppingListItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  category?: InputMaybe<Scalars['String']['input']>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  netWeight?: InputMaybe<NetWeightInput>;
  notes?: InputMaybe<Scalars['String']['input']>;
  pricing?: InputMaybe<PricingEstimatesInput>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  quantity?: InputMaybe<Scalars['FlexibleQuantity']['input']>;
  recipeContext?: InputMaybe<RecipeContextInput>;
  shoppingListId: Scalars['ID']['input'];
  sortOrder?: InputMaybe<Scalars['String']['input']>;
  storePrefs?: InputMaybe<StorePreferencesInput>;
  unit?: InputMaybe<UnitSpecInput>;
};

/** Input for creating shopping list items from a recipe */
export type CreateShoppingListItemsFromRecipeInput = {
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Int']['input']>;
  shoppingListId: Scalars['ID']['input'];
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
  baseUnitId?: InputMaybe<Scalars['ID']['input']>;
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
  Vietnamese = 'VIETNAMESE'
}

/** Sub-input for curation/trending filters */
export type CurationFilterInput = {
  isPopular?: InputMaybe<Scalars['Boolean']['input']>;
  isRecent?: InputMaybe<Scalars['Boolean']['input']>;
  isTrending?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  showInOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
  timeRange?: InputMaybe<DateRange>;
};

/**
 * Currency type for price information
 * Cache: 2 hours - currency definitions are static reference data
 */
export type Currency = {
  __typename: 'Currency';
  code: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  decimalPlaces: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type CurrencyPayload = MutationPayload & {
  __typename: 'CurrencyPayload';
  code: Scalars['String']['output'];
  currency: Maybe<Currency>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export enum DataSource {
  Api = 'API',
  BarcodeScan = 'BARCODE_SCAN',
  Import = 'IMPORT',
  Kroger = 'KROGER',
  Manual = 'MANUAL',
  Spoonacular = 'SPOONACULAR',
  Usda = 'USDA'
}

export enum DateRange {
  Custom = 'CUSTOM',
  LastMonth = 'LAST_MONTH',
  LastQuarter = 'LAST_QUARTER',
  LastWeek = 'LAST_WEEK',
  LastYear = 'LAST_YEAR',
  Today = 'TODAY',
  Yesterday = 'YESTERDAY'
}

/** Sub-input for date range filters */
export type DateRangeFilterInput = {
  createdAfter?: InputMaybe<Scalars['DateTime']['input']>;
  createdBefore?: InputMaybe<Scalars['DateTime']['input']>;
  updatedAfter?: InputMaybe<Scalars['DateTime']['input']>;
  updatedBefore?: InputMaybe<Scalars['DateTime']['input']>;
};

/** Date range filter with start and end bounds */
export type DateRangeInput = {
  end: Scalars['DateTime']['input'];
  start: Scalars['DateTime']['input'];
};

/** Method used to deduct ingredients from pantry */
export enum DeductionMethod {
  Automatic = 'AUTOMATIC',
  Manual = 'MANUAL',
  Skipped = 'SKIPPED'
}

export type DeleteRecipeFolderInput = {
  folder: Scalars['String']['input'];
  moveTo?: InputMaybe<Scalars['String']['input']>;
};

/** Input for deleted device cleanup */
export type DeletedDeviceCleanupInput = {
  olderThanDays?: InputMaybe<Scalars['Int']['input']>;
};

export type DeletionBlocker = {
  __typename: 'DeletionBlocker';
  message: Scalars['String']['output'];
  resourceId: Scalars['ID']['output'];
  resourceName: Scalars['String']['output'];
  type: DeletionBlockerType;
};

export enum DeletionBlockerType {
  HomeOwnership = 'HOME_OWNERSHIP',
  Other = 'OTHER',
  ShoppingList = 'SHOPPING_LIST'
}

/** User device information - contains sensitive device fingerprinting data */
export type Device = {
  __typename: 'Device';
  apiLevel: Maybe<Scalars['Int']['output']>;
  appVersion: Maybe<Scalars['String']['output']>;
  availableLocationProviders: Maybe<Scalars['String']['output']>;
  batteryLevel: Maybe<Scalars['Float']['output']>;
  brand: Maybe<Scalars['String']['output']>;
  browserName: Maybe<Scalars['String']['output']>;
  browserVersion: Maybe<Scalars['String']['output']>;
  buildNumber: Maybe<Scalars['String']['output']>;
  bundleId: Maybe<Scalars['String']['output']>;
  carrier: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deviceId: Scalars['String']['output'];
  deviceName: Maybe<Scalars['String']['output']>;
  deviceType: DeviceType;
  freeDiskStorage: Maybe<Scalars['String']['output']>;
  hasDynamicIsland: Maybe<Scalars['Boolean']['output']>;
  hasNotch: Maybe<Scalars['Boolean']['output']>;
  hostNames: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isAirplaneMode: Maybe<Scalars['Boolean']['output']>;
  isBatteryCharging: Maybe<Scalars['Boolean']['output']>;
  isBluetoothHeadphonesConnected: Maybe<Scalars['Boolean']['output']>;
  isHeadphonesConnected: Maybe<Scalars['Boolean']['output']>;
  isKeyboardConnected: Maybe<Scalars['Boolean']['output']>;
  isLocationEnabled: Maybe<Scalars['Boolean']['output']>;
  isMouseConnected: Maybe<Scalars['Boolean']['output']>;
  isTablet: Maybe<Scalars['Boolean']['output']>;
  isTrusted: Scalars['Boolean']['output'];
  isVerified: Scalars['Boolean']['output'];
  isWiredHeadphonesConnected: Maybe<Scalars['Boolean']['output']>;
  language: Maybe<Scalars['String']['output']>;
  lastLoginAt: Maybe<Scalars['DateTime']['output']>;
  lastSeenAt: Scalars['DateTime']['output'];
  loginCount: Scalars['Int']['output'];
  manufacturer: Maybe<Scalars['String']['output']>;
  maxMemory: Maybe<Scalars['String']['output']>;
  model: Maybe<Scalars['String']['output']>;
  osName: Maybe<Scalars['String']['output']>;
  osVersion: Maybe<Scalars['String']['output']>;
  platform: Maybe<MobilePlatform>;
  powerState: Maybe<Scalars['String']['output']>;
  readableVersion: Maybe<Scalars['String']['output']>;
  screenResolution: Maybe<Scalars['String']['output']>;
  supportedAbis: Maybe<Scalars['String']['output']>;
  supportedMediaTypes: Maybe<Scalars['String']['output']>;
  systemVersion: Maybe<Scalars['String']['output']>;
  timezone: Maybe<Scalars['String']['output']>;
  totalDiskCapacity: Maybe<Scalars['String']['output']>;
  totalMemory: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  usedMemory: Maybe<Scalars['String']['output']>;
  user: Maybe<User>;
  userAgent: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
  verifiedAt: Maybe<Scalars['DateTime']['output']>;
};

export type DeviceActivity = {
  __typename: 'DeviceActivity';
  deviceName: Maybe<Scalars['String']['output']>;
  deviceType: DeviceType;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isTrusted: Scalars['Boolean']['output'];
  lastSeenAt: Scalars['DateTime']['output'];
  loginCount: Scalars['Int']['output'];
};

export type DeviceBreakdown = {
  __typename: 'DeviceBreakdown';
  browsers: Array<BrowserStat>;
  deviceTypes: Array<DeviceTypeStat>;
  operatingSystems: Array<OperatingSystemStat>;
  platforms: Array<PlatformStat>;
};

export type DeviceChangeEvent = {
  __typename: 'DeviceChangeEvent';
  changeType: DeviceChangeType;
  device: Device;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export enum DeviceChangeType {
  Activity = 'ACTIVITY',
  Registered = 'REGISTERED',
  StatusChanged = 'STATUS_CHANGED',
  TrustChanged = 'TRUST_CHANGED',
  Verified = 'VERIFIED'
}

/** Sub-input for device characteristics */
export type DeviceCharacteristicsInput = {
  hasDynamicIsland?: InputMaybe<Scalars['Boolean']['input']>;
  hasNotch?: InputMaybe<Scalars['Boolean']['input']>;
  isEmulator?: InputMaybe<Scalars['Boolean']['input']>;
  isTablet?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Input for device cleanup operations */
export type DeviceCleanupInput = {
  /** Clean up soft-deleted devices older than X days */
  deletedDevices?: InputMaybe<DeletedDeviceCleanupInput>;
  /** Clean up stale devices (not seen for X days) */
  staleDevices?: InputMaybe<StaleDeviceCleanupInput>;
};

/** Result of device cleanup operation */
export type DeviceCleanupResult = MutationPayload & {
  __typename: 'DeviceCleanupResult';
  code: Scalars['String']['output'];
  deletedDevicesRemoved: Maybe<Scalars['Int']['output']>;
  message: Scalars['String']['output'];
  staleDevicesRemoved: Maybe<Scalars['Int']['output']>;
  success: Scalars['Boolean']['output'];
  totalRemoved: Scalars['Int']['output'];
};

export type DeviceConnection = Connection & {
  __typename: 'DeviceConnection';
  edges: Array<DeviceEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Filter input for device count query */
export type DeviceCountFilters = {
  deviceType?: InputMaybe<DeviceType>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  platform?: InputMaybe<MobilePlatform>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

/** Composite sub-input for all device details */
export type DeviceDetailsInput = {
  availableLocationProviders?: InputMaybe<Scalars['JSON']['input']>;
  browserOs?: InputMaybe<BrowserOsDetailsInput>;
  characteristics?: InputMaybe<DeviceCharacteristicsInput>;
  connectivity?: InputMaybe<ConnectivityInput>;
  hardware?: InputMaybe<DeviceHardwareInput>;
  hostNames?: InputMaybe<Scalars['JSON']['input']>;
  identification?: InputMaybe<DeviceIdentificationInput>;
  peripherals?: InputMaybe<DevicePeripheralsDetailsInput>;
  power?: InputMaybe<PowerStatusInput>;
  supportedMediaTypes?: InputMaybe<Scalars['JSON']['input']>;
};

/** Device connection for pagination */
export type DeviceEdge = Edge & {
  __typename: 'DeviceEdge';
  cursor: Scalars['String']['output'];
  node: Device;
};

/**
 * Filter input for querying devices.
 * If userId is not provided, returns current user's devices.
 */
export type DeviceFilters = {
  batteryLevelBelow?: InputMaybe<Scalars['Float']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  hasPeripherals?: InputMaybe<Scalars['Boolean']['input']>;
  inactiveDays?: InputMaybe<Scalars['Int']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isEmulated?: InputMaybe<Scalars['Boolean']['input']>;
  isSuspicious?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  platform?: InputMaybe<MobilePlatform>;
  search?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type DeviceHardwareInfoInput = {
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  maxMemory?: InputMaybe<Scalars['String']['input']>;
  totalDiskCapacity?: InputMaybe<Scalars['String']['input']>;
  totalMemory?: InputMaybe<Scalars['String']['input']>;
  usedMemory?: InputMaybe<Scalars['String']['input']>;
};

/** Sub-input for device hardware specs */
export type DeviceHardwareInput = {
  freeDiskStorage?: InputMaybe<Scalars['String']['input']>;
  maxMemory?: InputMaybe<Scalars['String']['input']>;
  supportedAbis?: InputMaybe<Scalars['JSON']['input']>;
  totalDiskCapacity?: InputMaybe<Scalars['String']['input']>;
  totalMemory?: InputMaybe<Scalars['String']['input']>;
  usedMemory?: InputMaybe<Scalars['String']['input']>;
};

/** Sub-input for device identification details */
export type DeviceIdentificationInput = {
  androidId?: InputMaybe<Scalars['String']['input']>;
  apiLevel?: InputMaybe<Scalars['Int']['input']>;
  brand?: InputMaybe<Scalars['String']['input']>;
  buildNumber?: InputMaybe<Scalars['String']['input']>;
  bundleId?: InputMaybe<Scalars['String']['input']>;
  deviceFingerprint?: InputMaybe<Scalars['String']['input']>;
  firstInstallTime?: InputMaybe<Scalars['DateTime']['input']>;
  instanceId?: InputMaybe<Scalars['String']['input']>;
  iosVendorId?: InputMaybe<Scalars['String']['input']>;
  lastUpdateTime?: InputMaybe<Scalars['DateTime']['input']>;
  manufacturer?: InputMaybe<Scalars['String']['input']>;
  model?: InputMaybe<Scalars['String']['input']>;
  readableVersion?: InputMaybe<Scalars['String']['input']>;
  securityPatch?: InputMaybe<Scalars['String']['input']>;
  systemVersion?: InputMaybe<Scalars['String']['input']>;
};

export type DeviceLocationInput = {
  lastCity?: InputMaybe<Scalars['String']['input']>;
  lastCountry?: InputMaybe<Scalars['String']['input']>;
  lastIpAddress?: InputMaybe<Scalars['String']['input']>;
};

export type DeviceOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  lastActiveAt?: InputMaybe<SortOrder>;
};

export type DevicePayload = MutationPayload & {
  __typename: 'DevicePayload';
  code: Scalars['String']['output'];
  device: Maybe<Device>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Sub-input for device peripherals (automation detection) */
export type DevicePeripheralsDetailsInput = {
  isBluetoothHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isKeyboardConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isMouseConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isWiredHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DevicePeripheralsInput = {
  isBluetoothHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isKeyboardConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isMouseConnected?: InputMaybe<Scalars['Boolean']['input']>;
  isWiredHeadphonesConnected?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DeviceRegistrationInput = {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<DeviceDetailsInput>;
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  location?: InputMaybe<NetworkLocationInput>;
  platform?: InputMaybe<MobilePlatform>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
};

/** Sort field options for devices */
export enum DeviceSortField {
  CreatedAt = 'CREATED_AT',
  DeviceName = 'DEVICE_NAME',
  LastLoginAt = 'LAST_LOGIN_AT',
  LastSeenAt = 'LAST_SEEN_AT'
}

export type DeviceStat = {
  __typename: 'DeviceStat';
  count: Scalars['Int']['output'];
  userAgent: Scalars['String']['output'];
};

export type DeviceStats = {
  __typename: 'DeviceStats';
  breakdown: DeviceBreakdown;
  recentActivity: Array<DeviceActivity>;
  summary: DeviceSummary;
};

export type DeviceSummary = {
  __typename: 'DeviceSummary';
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
  Watch = 'WATCH'
}

export type DeviceTypeStat = {
  __typename: 'DeviceTypeStat';
  count: Scalars['Int']['output'];
  deviceType: DeviceType;
};

/** Represents a dietary preference or restriction that influences recipe and meal recommendations */
export enum Diet {
  /** Excludes all foods containing gluten proteins found in wheat, barley, and rye */
  GlutenFree = 'GLUTEN_FREE',
  /** High-fat, very low-carbohydrate diet that promotes ketosis */
  Keto = 'KETO',
  /** Excludes meat, fish, and eggs but allows dairy products */
  LactoVegetarian = 'LACTO_VEGETARIAN',
  /** Limits fermentable carbohydrates that can trigger digestive issues */
  LowFodmap = 'LOW_FODMAP',
  /** Excludes meat, fish, and dairy but allows eggs */
  OvoVegetarian = 'OVO_VEGETARIAN',
  /** Focuses on whole foods that mimic pre-agricultural diets, excluding grains, legumes, and dairy */
  Paleo = 'PALEO',
  /** Excludes meat but allows fish, dairy, and eggs */
  Pescetarian = 'PESCETARIAN',
  /** Similar to paleo but allows some dairy products, especially raw and fermented */
  Primal = 'PRIMAL',
  /** Excludes all animal products including dairy, eggs, and honey */
  Vegan = 'VEGAN',
  /** Excludes meat and fish but allows dairy and eggs */
  Vegetarian = 'VEGETARIAN',
  /** Strict 30-day elimination diet that removes sugar, alcohol, grains, legumes, soy, and dairy */
  Whole30 = 'WHOLE30'
}

/** Sub-input for dietary filters */
export type DietaryFilterInput = {
  hasAllergens?: InputMaybe<Scalars['Boolean']['input']>;
  hasNutrition?: InputMaybe<Scalars['Boolean']['input']>;
  isDairyFree?: InputMaybe<Scalars['Boolean']['input']>;
  isGlutenFree?: InputMaybe<Scalars['Boolean']['input']>;
  isOrganic?: InputMaybe<Scalars['Boolean']['input']>;
  isVegan?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DietaryProfile = {
  __typename: 'DietaryProfile';
  budgetPerMeal: Maybe<Scalars['Float']['output']>;
  calorieTarget: Maybe<Scalars['Int']['output']>;
  carbsTarget: Maybe<Scalars['Int']['output']>;
  cookingSkillLevel: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dislikedIngredients: Array<Scalars['String']['output']>;
  fatTarget: Maybe<Scalars['Int']['output']>;
  favoriteIngredients: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  maxCookTimeMinutes: Maybe<Scalars['Int']['output']>;
  maxPrepTimeMinutes: Maybe<Scalars['Int']['output']>;
  mealsPerDay: Scalars['Int']['output'];
  preferredCuisines: Array<Scalars['String']['output']>;
  proteinTarget: Maybe<Scalars['Int']['output']>;
  restrictions: Array<DietaryRestriction>;
  snacksPerDay: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['ID']['output'];
};

export type DietaryProfilePayload = MutationPayload & {
  __typename: 'DietaryProfilePayload';
  code: Scalars['String']['output'];
  dietaryProfile: Maybe<DietaryProfile>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type DietaryRestriction = {
  __typename: 'DietaryRestriction';
  appliesToHomeId: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTime']['output'];
  diet: Maybe<Diet>;
  dietaryProfile: DietaryProfile;
  dietaryProfileId: Scalars['ID']['output'];
  healthGoal: Maybe<HealthGoal>;
  id: Scalars['ID']['output'];
  intolerance: Maybe<Intolerance>;
  notes: Maybe<Scalars['String']['output']>;
  severity: RestrictionSeverity;
  updatedAt: Scalars['DateTime']['output'];
};

export type DietaryRestrictionPayload = MutationPayload & {
  __typename: 'DietaryRestrictionPayload';
  code: Scalars['String']['output'];
  dietaryRestriction: Maybe<DietaryRestriction>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Reusable sub-input for dietary tags */
export type DietaryTagsInput = {
  diets?: InputMaybe<Array<Scalars['String']['input']>>;
  healthGoals?: InputMaybe<Array<Scalars['String']['input']>>;
  intolerances?: InputMaybe<Array<Scalars['String']['input']>>;
};

export enum Difficulty {
  Easy = 'EASY',
  Expert = 'EXPERT',
  Hard = 'HARD',
  Medium = 'MEDIUM',
  VeryEasy = 'VERY_EASY'
}

export type DismissNotificationInput = {
  notificationId: Scalars['ID']['input'];
};

/** Display format for quantities */
export enum DisplayFormat {
  Auto = 'AUTO',
  Decimal = 'DECIMAL',
  Fraction = 'FRACTION',
  Mixed = 'MIXED'
}

export type DuplicateMealPlanInput = {
  mealPlanId: Scalars['ID']['input'];
  newEndDate: Scalars['DateTime']['input'];
  newName: Scalars['String']['input'];
  newStartDate: Scalars['DateTime']['input'];
};

export type Edge = {
  cursor: Scalars['String']['output'];
};

/** Effective usage rate: consumed / (consumed + wasted) */
export type EffectiveUsageRate = {
  __typename: 'EffectiveUsageRate';
  effectiveRate: Scalars['Float']['output'];
  itemId: Maybe<Scalars['ID']['output']>;
  itemName: Maybe<Scalars['String']['output']>;
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  totalConsumed: Scalars['Float']['output'];
  totalWasted: Scalars['Float']['output'];
  unitName: Maybe<Scalars['String']['output']>;
};

export enum ExpirationAction {
  Consumed = 'CONSUMED',
  Cooked = 'COOKED',
  Extended = 'EXTENDED',
  NoAction = 'NO_ACTION',
  Shared = 'SHARED',
  Waste = 'WASTE'
}

export enum ExpirationFrequency {
  DailyEvening = 'DAILY_EVENING',
  DailyMorning = 'DAILY_MORNING',
  Never = 'NEVER',
  RealTime = 'REAL_TIME',
  WeeklyDigest = 'WEEKLY_DIGEST'
}

/** Sub-input for expiration notification config */
export type ExpirationNotifConfigInput = {
  expirationDaysThreshold?: InputMaybe<Scalars['Int']['input']>;
  expirationNotificationFrequency?: InputMaybe<ExpirationFrequency>;
  expirationNotifications?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ExpirationNotification = {
  __typename: 'ExpirationNotification';
  actionAt: Maybe<Scalars['DateTime']['output']>;
  actionTaken: Maybe<ExpirationAction>;
  batchId: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  daysUntilExpiry: Scalars['Int']['output'];
  dismissedAt: Maybe<Scalars['DateTime']['output']>;
  expiresAt: Scalars['DateTime']['output'];
  genericNotification: Maybe<Notification>;
  genericNotificationId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  isBatched: Scalars['Boolean']['output'];
  notificationType: ExpirationNotificationType;
  pantryItem: PantryItem;
  pantryItemId: Scalars['ID']['output'];
  readAt: Maybe<Scalars['DateTime']['output']>;
  sentAt: Maybe<Scalars['DateTime']['output']>;
  status: NotificationDeliveryStatus;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['ID']['output'];
};

export type ExpirationNotificationChangeEvent = {
  __typename: 'ExpirationNotificationChangeEvent';
  changeType: ExpirationNotificationChangeType;
  notification: ExpirationNotification;
  pantryId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
};

export enum ExpirationNotificationChangeType {
  Created = 'CREATED',
  Updated = 'UPDATED'
}

export type ExpirationNotificationConnection = Connection & {
  __typename: 'ExpirationNotificationConnection';
  edges: Array<ExpirationNotificationEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Expiration notification connection for pagination */
export type ExpirationNotificationEdge = Edge & {
  __typename: 'ExpirationNotificationEdge';
  cursor: Scalars['String']['output'];
  node: ExpirationNotification;
};

/** Order by options for expiration notifications */
export type ExpirationNotificationOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  expiresAt?: InputMaybe<SortOrder>;
};

export type ExpirationNotificationPayload = MutationPayload & {
  __typename: 'ExpirationNotificationPayload';
  code: Scalars['String']['output'];
  expirationNotification: Maybe<ExpirationNotification>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export enum ExpirationNotificationType {
  ExpiredReminder = 'EXPIRED_REMINDER',
  ExpiresIn_3Days = 'EXPIRES_IN_3_DAYS',
  ExpiresIn_7Days = 'EXPIRES_IN_7_DAYS',
  ExpiresToday = 'EXPIRES_TODAY',
  ExpiresTomorrow = 'EXPIRES_TOMORROW',
  WeeklyDigest = 'WEEKLY_DIGEST'
}

/** Expiration risk summary for a pantry */
export type ExpirationRisk = {
  __typename: 'ExpirationRisk';
  daysThreshold: Scalars['Int']['output'];
  items: Array<ExpirationRiskItem>;
  totalAtRisk: Scalars['Int']['output'];
};

/** Items at risk of expiring within a given threshold */
export type ExpirationRiskItem = {
  __typename: 'ExpirationRiskItem';
  condition: ItemCondition;
  daysUntilExpiry: Scalars['Int']['output'];
  expiresAt: Scalars['DateTime']['output'];
  itemName: Scalars['String']['output'];
  pantryItemId: Scalars['ID']['output'];
  quantity: Scalars['Float']['output'];
  unitName: Maybe<Scalars['String']['output']>;
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
  UserCreated = 'USER_CREATED'
}

export type ExternalSourceMapping = {
  __typename: 'ExternalSourceMapping';
  allergens: Maybe<Scalars['JSON']['output']>;
  availability: Maybe<Scalars['JSON']['output']>;
  brandInfo: Maybe<Scalars['JSON']['output']>;
  categories: Maybe<Scalars['JSON']['output']>;
  confidence: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  data: Maybe<Scalars['JSON']['output']>;
  externalDescription: Maybe<Scalars['String']['output']>;
  externalId: Scalars['String']['output'];
  externalName: Maybe<Scalars['String']['output']>;
  externalType: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  identifiers: Maybe<Scalars['JSON']['output']>;
  images: Maybe<Scalars['JSON']['output']>;
  isPrimary: Scalars['Boolean']['output'];
  item: Item;
  lastSyncedAt: Scalars['DateTime']['output'];
  location: Maybe<Scalars['JSON']['output']>;
  metadata: Maybe<Scalars['JSON']['output']>;
  netWeight: Maybe<Scalars['Float']['output']>;
  netWeightUnit: Maybe<Scalars['String']['output']>;
  nutritionData: Maybe<Scalars['JSON']['output']>;
  packageSize: Maybe<Scalars['String']['output']>;
  pricing: Maybe<Scalars['JSON']['output']>;
  retailInfo: Maybe<Scalars['JSON']['output']>;
  source: ExternalSource;
  storage: Maybe<Scalars['JSON']['output']>;
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

export type ExternalSourceMappingPayload = MutationPayload & {
  __typename: 'ExternalSourceMappingPayload';
  code: Scalars['String']['output'];
  externalSourceMapping: Maybe<ExternalSourceMapping>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type FacetValue = {
  __typename: 'FacetValue';
  count: Scalars['Int']['output'];
  label: Scalars['String']['output'];
  selected: Maybe<Scalars['Boolean']['output']>;
  value: Scalars['String']['output'];
};

export type FailedIpStat = {
  __typename: 'FailedIPStat';
  count: Scalars['Int']['output'];
  ipAddress: Maybe<Scalars['String']['output']>;
};

export type FavoriteRecipeInput = {
  folder?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId: Scalars['ID']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** Sub-input for feature-specific notifications */
export type FeatureNotificationsInput = {
  collaborationInvites?: InputMaybe<Scalars['Boolean']['input']>;
  cookingReminders?: InputMaybe<Scalars['Boolean']['input']>;
  homeInvites?: InputMaybe<Scalars['Boolean']['input']>;
  lowStockAlerts?: InputMaybe<Scalars['Boolean']['input']>;
  mealPlanReminders?: InputMaybe<Scalars['Boolean']['input']>;
  monthlyReport?: InputMaybe<Scalars['Boolean']['input']>;
  pantryChanges?: InputMaybe<Scalars['Boolean']['input']>;
  recipeRecommendations?: InputMaybe<Scalars['Boolean']['input']>;
  sharedListUpdates?: InputMaybe<Scalars['Boolean']['input']>;
  shoppingListUpdates?: InputMaybe<Scalars['Boolean']['input']>;
  weeklyDigest?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Sub-input for feature toggles */
export type FeatureTogglesInput = {
  betaFeatures?: InputMaybe<Array<Scalars['String']['input']>>;
  enabledFeatures?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type ForgotPasswordResponse = MutationPayload & {
  __typename: 'ForgotPasswordResponse';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type GenerateShoppingListFromMealPlanInput = {
  /** Deduct pantry availability from needed quantities (default true) */
  checkPantry?: InputMaybe<Scalars['Boolean']['input']>;
  mealPlanId: Scalars['ID']['input'];
  /** Name for new list (defaults to "Shopping List for {planName}") */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Optional: add to existing list instead of creating a new one */
  shoppingListId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetExpirationNotificationsInput = {
  pantryItemId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<NotificationDeliveryStatus>;
};

/** Progress toward a single nutrition goal */
export type GoalProgress = {
  __typename: 'GoalProgress';
  current: Scalars['Float']['output'];
  percentage: Scalars['Float']['output'];
  status: GoalStatus;
  target: Scalars['Float']['output'];
};

/** Status relative to nutrition target */
export enum GoalStatus {
  OnTarget = 'ON_TARGET',
  OverTarget = 'OVER_TARGET',
  UnderTarget = 'UNDER_TARGET'
}

/** Typed health benefit information (replaces JSON healthBenefits field) */
export type HealthBenefit = {
  __typename: 'HealthBenefit';
  benefit: Scalars['String']['output'];
  category: Maybe<HealthBenefitCategory>;
  confidenceLevel: Maybe<Scalars['Float']['output']>;
  description: Maybe<Scalars['String']['output']>;
  scientificEvidence: Maybe<Scalars['String']['output']>;
};

export enum HealthBenefitCategory {
  Dietary = 'DIETARY',
  Fitness = 'FITNESS',
  Medical = 'MEDICAL',
  Nutritional = 'NUTRITIONAL',
  Wellness = 'WELLNESS'
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
  SugarFree = 'SUGAR_FREE'
}

export type HealthInfoInput = {
  allergens?: InputMaybe<Array<AllergenInput>>;
  healthBenefits?: InputMaybe<Array<HealthBenefitInput>>;
  ingredients?: InputMaybe<Scalars['JSON']['input']>;
};

/**
 * Home/household for managing pantries and shopping lists
 * Cache: 5 minutes - metadata changes occasionally
 */
export type Home = {
  __typename: 'Home';
  allowJoinCode: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Maybe<Scalars['String']['output']>;
  description: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  inviteLogsConnection: InviteLogConnection;
  inviteStats: Array<HomeInviteStatsGroup>;
  invitesConnection: HomeInviteConnection;
  /**
   * Whether this home is the current user's default home.
   * Computed per-user from UserSettings.defaultHomeId.
   */
  isDefault: Scalars['Boolean']['output'];
  isPublic: Scalars['Boolean']['output'];
  joinCode: Maybe<Scalars['String']['output']>;
  lowStockItems: Array<LowStockItem>;
  maxMembers: Maybe<Scalars['Int']['output']>;
  mealPlansConnection: MealPlanConnection;
  mealTemplatesConnection: MealTemplateConnection;
  membersConnection: MembershipConnection;
  membershipStats: MembershipStats;
  metadata: Maybe<Scalars['JSON']['output']>;
  myMembership: Maybe<Membership>;
  name: Scalars['String']['output'];
  pantriesConnection: PantryConnection;
  shoppingListsConnection: ShoppingListConnection;
  tags: Array<Scalars['String']['output']>;
  timezone: Maybe<Scalars['String']['output']>;
  type: HomeType;
  updatedAt: Scalars['DateTime']['output'];
  /**
   * Usage statistics for this home.
   * Available for all users but primarily used by admin views.
   */
  usageStats: Maybe<HomeUsageStats>;
  version: Scalars['Int']['output'];
};


/**
 * Home/household for managing pantries and shopping lists
 * Cache: 5 minutes - metadata changes occasionally
 */
export type HomeInviteLogsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<InviteLogOrderBy>;
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
export type HomeMealPlansConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<MealPlanFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * Home/household for managing pantries and shopping lists
 * Cache: 5 minutes - metadata changes occasionally
 */
export type HomeMealTemplatesConnectionArgs = {
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

export type HomeConnection = Connection & {
  __typename: 'HomeConnection';
  edges: Array<HomeEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Home connection for pagination */
export type HomeEdge = Edge & {
  __typename: 'HomeEdge';
  cursor: Scalars['String']['output'];
  node: Home;
};

/**
 * Filters for querying homes.
 * userId filter is admin-only - ignored for regular users.
 */
export type HomeFilters = {
  /** Filter by public/private status */
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  /** Search by home name */
  search?: InputMaybe<Scalars['String']['input']>;
  /** Filter by home type */
  type?: InputMaybe<HomeType>;
  /** Admin-only: Filter by specific user ID (member of home) */
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type HomeInvite = {
  __typename: 'HomeInvite';
  acceptedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  customPermissions: Maybe<HomePermissions>;
  declinedAt: Maybe<Scalars['DateTime']['output']>;
  email: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
  home: Home;
  homeId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  invitedUser: Maybe<User>;
  invitedUserId: Maybe<Scalars['ID']['output']>;
  inviter: User;
  lastReminderAt: Maybe<Scalars['DateTime']['output']>;
  logs: Array<InviteLog>;
  message: Maybe<Scalars['String']['output']>;
  recipientName: Maybe<Scalars['String']['output']>;
  reminderCount: Scalars['Int']['output'];
  revokedAt: Maybe<Scalars['DateTime']['output']>;
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

export type HomeInviteChangeEvent = {
  __typename: 'HomeInviteChangeEvent';
  homeId: Scalars['ID']['output'];
  homeInvite: HomeInvite;
  mutation: HomeInviteMutationType;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type HomeInviteConnection = Connection & {
  __typename: 'HomeInviteConnection';
  edges: Array<HomeInviteEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Home invite connection for pagination */
export type HomeInviteEdge = Edge & {
  __typename: 'HomeInviteEdge';
  cursor: Scalars['String']['output'];
  node: HomeInvite;
};

export enum HomeInviteMutationType {
  Accepted = 'ACCEPTED',
  Created = 'CREATED',
  Declined = 'DECLINED',
  Revoked = 'REVOKED'
}

export type HomeInvitePayload = MutationPayload & {
  __typename: 'HomeInvitePayload';
  code: Scalars['String']['output'];
  homeInvite: Maybe<HomeInvite>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type HomeInviteStatsGroup = {
  __typename: 'HomeInviteStatsGroup';
  action: InviteAction;
  count: InviteActionCount;
};

/** Order by options for homes */
export type HomeOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
};

export type HomeOwnership = {
  __typename: 'HomeOwnership';
  createdAt: Scalars['DateTime']['output'];
  home: Home;
  homeId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  transferredAt: Maybe<Scalars['DateTime']['output']>;
  transferredFrom: Maybe<Scalars['String']['output']>;
  user: User;
  userId: Scalars['ID']['output'];
};

export type HomeOwnershipPayload = MutationPayload & {
  __typename: 'HomeOwnershipPayload';
  code: Scalars['String']['output'];
  homeOwnership: Maybe<HomeOwnership>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type HomePayload = MutationPayload & {
  __typename: 'HomePayload';
  code: Scalars['String']['output'];
  home: Maybe<Home>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Custom permissions that can override default role permissions */
export type HomePermissions = {
  __typename: 'HomePermissions';
  canAddItems: Maybe<Scalars['Boolean']['output']>;
  canEditPantry: Maybe<Scalars['Boolean']['output']>;
  canInviteOthers: Maybe<Scalars['Boolean']['output']>;
  canManageHome: Maybe<Scalars['Boolean']['output']>;
  canRemoveItems: Maybe<Scalars['Boolean']['output']>;
  canViewPantry: Maybe<Scalars['Boolean']['output']>;
};

export enum HomeType {
  Boat = 'BOAT',
  Household = 'HOUSEHOLD',
  Office = 'OFFICE',
  Other = 'OTHER',
  Personal = 'PERSONAL',
  Vacation = 'VACATION'
}

/**
 * Usage statistics for a Home.
 * Included when admin requests resources with stats.
 */
export type HomeUsageStats = {
  __typename: 'HomeUsageStats';
  /** Number of active shopping lists */
  activeShoppingListCount: Scalars['Int']['output'];
  /** Last activity timestamp in the home */
  lastActivityAt: Maybe<Scalars['DateTime']['output']>;
  /** Total number of active members */
  memberCount: Scalars['Int']['output'];
  /** Total number of pantries */
  pantryCount: Scalars['Int']['output'];
  /** Total pantry items across all pantries */
  pantryItemCount: Scalars['Int']['output'];
  /** Total number of shopping lists */
  shoppingListCount: Scalars['Int']['output'];
};

export type IpStat = {
  __typename: 'IPStat';
  count: Scalars['Int']['output'];
  ipAddress: Scalars['String']['output'];
};

/** Error details for a failed image deletion */
export type ImageDeletionError = {
  __typename: 'ImageDeletionError';
  /** Error message describing the failure */
  error: Scalars['String']['output'];
  /** The S3/MinIO key (path) of the image (may be null if extraction failed) */
  key: Maybe<Scalars['String']['output']>;
  /** The full URL of the image that failed to delete */
  url: Scalars['String']['output'];
};

/**
 * Status of a background image deletion job.
 * Use this to track progress of large batch deletions.
 */
export type ImageDeletionJobStatus = {
  __typename: 'ImageDeletionJobStatus';
  /** When the job was created */
  createdAt: Scalars['DateTime']['output'];
  /** When the job finished (null if still running) */
  finishedAt: Maybe<Scalars['DateTime']['output']>;
  /** Unique job identifier */
  jobId: Scalars['String']['output'];
  /** Progress percentage (0-100) */
  progress: Maybe<Scalars['Int']['output']>;
  /** Deletion result (only available when status is 'completed') */
  result: Maybe<ImageDeletionResult>;
  /** Current job status: waiting, active, completed, failed, delayed */
  status: Scalars['String']['output'];
};

/**
 * Result of an image deletion operation.
 * Contains counts of successfully deleted and failed images.
 */
export type ImageDeletionResult = MutationPayload & {
  __typename: 'ImageDeletionResult';
  code: Scalars['String']['output'];
  /** Number of database Item records updated */
  databaseUpdated: Scalars['Int']['output'];
  /** Number of images successfully deleted from S3/MinIO storage */
  deletedFromStorage: Scalars['Int']['output'];
  /** List of storage deletion failures with error details */
  failedStorage: Array<ImageDeletionError>;
  /**
   * Job ID if the operation was queued for background processing.
   * Use adminGetImageDeletionJobStatus to check progress.
   */
  jobId: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  /** Total number of images requested for deletion */
  totalRequested: Scalars['Int']['output'];
};

export type ImageInput = {
  featured?: InputMaybe<Scalars['Boolean']['input']>;
  format?: InputMaybe<Scalars['String']['input']>;
  hash?: InputMaybe<Scalars['String']['input']>;
  height?: InputMaybe<Scalars['Int']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  kind?: InputMaybe<ImageKind>;
  perspective?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  url: Scalars['String']['input'];
  width?: InputMaybe<Scalars['Int']['input']>;
};

export enum ImageKind {
  Barcode = 'BARCODE',
  Front = 'FRONT',
  Gallery = 'GALLERY',
  IngredientList = 'INGREDIENT_LIST',
  Main = 'MAIN',
  NutritionLabel = 'NUTRITION_LABEL',
  Size_128 = 'SIZE_128',
  Size_256 = 'SIZE_256',
  Size_512 = 'SIZE_512',
  Thumbnail = 'THUMBNAIL'
}

export enum ImageUploadPurpose {
  ItemImage = 'ITEM_IMAGE',
  PantryItemPhoto = 'PANTRY_ITEM_PHOTO',
  ProfileAvatar = 'PROFILE_AVATAR',
  ProfileCover = 'PROFILE_COVER'
}

export type IngredientInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isGMO?: InputMaybe<Scalars['Boolean']['input']>;
  isOrganic?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Int']['input']>;
  percentage?: InputMaybe<Scalars['Float']['input']>;
  subIngredients?: InputMaybe<Array<IngredientInput>>;
};

/** Input for ingredient usage when marking recipe as cooked */
export type IngredientUsageInput = {
  actualQuantity: Scalars['Float']['input'];
  actualUnitId: Scalars['ID']['input'];
  recipeIngredientId: Scalars['ID']['input'];
};

/** Sub-input for creating a new item inline (when itemId is not provided) */
export type InlineItemInput = {
  brand?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayUnitId?: InputMaybe<Scalars['ID']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  images?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  netWeights?: InputMaybe<Array<ItemNetWeightInput>>;
  units?: InputMaybe<Array<ItemUnitInput>>;
  upc?: InputMaybe<Scalars['String']['input']>;
};

/** Represents a food intolerance or allergy used to filter recipes and flag unsuitable ingredients */
export enum Intolerance {
  /** Sensitivity to lactose or proteins found in milk and dairy products */
  Dairy = 'DAIRY',
  /** Allergy or sensitivity to chicken eggs and egg-derived ingredients */
  Egg = 'EGG',
  /** Sensitivity specifically to finned fish such as salmon, tuna, and cod */
  Fish = 'FISH',
  /** Sensitivity to gluten proteins found in wheat, barley, and rye */
  Gluten = 'GLUTEN',
  /** Sensitivity to grains including wheat, rice, corn, and oats */
  Grain = 'GRAIN',
  /** Allergy to peanuts and peanut-derived products */
  Peanut = 'PEANUT',
  /** General sensitivity to all types of seafood including fish and shellfish */
  Seafood = 'SEAFOOD',
  /** Allergy to sesame seeds and sesame-derived products */
  Sesame = 'SESAME',
  /** Sensitivity specifically to shellfish such as shrimp, crab, and lobster */
  Shellfish = 'SHELLFISH',
  /** Sensitivity to soybeans and soy-derived ingredients */
  Soy = 'SOY',
  /** Sensitivity to sulfites commonly found in wine, dried fruits, and preservatives */
  Sulfite = 'SULFITE',
  /** Allergy to tree nuts such as almonds, walnuts, cashews, and pecans */
  TreeNut = 'TREE_NUT',
  /** Specific sensitivity to wheat and wheat-derived ingredients */
  Wheat = 'WHEAT'
}

/** Reusable sub-input for inventory thresholds (low stock alerts) */
export type InventoryThresholdsInput = {
  minQuantity?: InputMaybe<Scalars['Float']['input']>;
  restockQuantity?: InputMaybe<Scalars['Float']['input']>;
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
  StatusChanged = 'STATUS_CHANGED'
}

export type InviteActionCount = {
  __typename: 'InviteActionCount';
  action: Scalars['Int']['output'];
};

export type InviteActionStats = {
  __typename: 'InviteActionStats';
  inviteAccepted: Maybe<Scalars['Int']['output']>;
  inviteCancelled: Maybe<Scalars['Int']['output']>;
  inviteCreated: Maybe<Scalars['Int']['output']>;
  inviteDeclined: Maybe<Scalars['Int']['output']>;
  inviteExpired: Maybe<Scalars['Int']['output']>;
  inviteResent: Maybe<Scalars['Int']['output']>;
  inviteSent: Maybe<Scalars['Int']['output']>;
  inviteViewed: Maybe<Scalars['Int']['output']>;
};

export type InviteLog = {
  __typename: 'InviteLog';
  action: InviteAction;
  actor: Maybe<User>;
  actorId: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  invite: HomeInvite;
  inviteId: Scalars['ID']['output'];
  metadata: Maybe<Scalars['JSON']['output']>;
  newStatus: Maybe<InviteStatus>;
  oldStatus: Maybe<InviteStatus>;
};

export type InviteLogConnection = Connection & {
  __typename: 'InviteLogConnection';
  edges: Array<InviteLogEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Invite log connection for pagination */
export type InviteLogEdge = Edge & {
  __typename: 'InviteLogEdge';
  cursor: Scalars['String']['output'];
  node: InviteLog;
};

/** Order by options for invite logs */
export type InviteLogOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
};

export type InviteStats = {
  __typename: 'InviteStats';
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
  Used = 'USED'
}

export type InviteTimelineEntry = {
  __typename: 'InviteTimelineEntry';
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
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  role: CollaboratorRole;
  shoppingListId: Scalars['ID']['input'];
};

/**
 * Item/Product catalog type
 * Cache: 30 minutes - catalog items are relatively static
 */
export type Item = {
  __typename: 'Item';
  allergens: Array<AllergenInfo>;
  alternateUpcs: Array<Scalars['String']['output']>;
  approvedAt: Maybe<Scalars['DateTime']['output']>;
  approvedBy: Maybe<User>;
  baseDimension: Maybe<BaseDimension>;
  brands: Array<ItemBrand>;
  categories: Array<ItemCategory>;
  convertedNetWeight: Maybe<ConvertedValue>;
  createdAt: Scalars['DateTime']['output'];
  dataSource: DataSource;
  defaultConsumeIncrement: Maybe<Scalars['Float']['output']>;
  defaultConsumeUnit: Maybe<Unit>;
  defaultConsumeUnitId: Maybe<Scalars['ID']['output']>;
  density: Maybe<Scalars['Float']['output']>;
  description: Maybe<Scalars['String']['output']>;
  displayUnit: Maybe<Unit>;
  displayUnitId: Maybe<Scalars['ID']['output']>;
  externalSources: Array<ExternalSourceMapping>;
  healthBenefits: Array<HealthBenefit>;
  id: Scalars['ID']['output'];
  imageCount: Scalars['Int']['output'];
  imageUrl: Maybe<Scalars['String']['output']>;
  images: Array<ItemImage>;
  ingredients: Maybe<Scalars['JSON']['output']>;
  /** Whether this item has been soft-deleted (admin visibility) */
  isDeleted: Scalars['Boolean']['output'];
  isUserCreated: Scalars['Boolean']['output'];
  matchedVariation: Maybe<ProductVariation>;
  metadata: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  needsApproval: Scalars['Boolean']['output'];
  netWeight: Maybe<Scalars['Float']['output']>;
  nutritions: Maybe<Scalars['JSON']['output']>;
  popularity: Scalars['Int']['output'];
  preferredTrackingUnit: Maybe<Unit>;
  preferredTrackingUnitId: Maybe<Scalars['ID']['output']>;
  priceHistory: Array<ItemPriceHistory>;
  primaryUpc: Maybe<Scalars['String']['output']>;
  servingSize: Maybe<Scalars['Float']['output']>;
  servingSizeUnit: Maybe<Scalars['String']['output']>;
  servingsPerPackage: Maybe<Scalars['Int']['output']>;
  shelfLifeDays: Maybe<Scalars['Int']['output']>;
  shelfLifeOpenedDays: Maybe<Scalars['Int']['output']>;
  showInOnboarding: Scalars['Boolean']['output'];
  status: ItemStatus;
  storageState: StorageState;
  storeSkus: Array<ItemStoreSku>;
  tags: Array<Scalars['String']['output']>;
  type: ItemType;
  unitConversions: Array<ItemUnitConversion>;
  units: Array<ItemUnit>;
  updatedAt: Scalars['DateTime']['output'];
  variationBrand: Maybe<Brand>;
  version: Scalars['Int']['output'];
  visibility: Visibility;
};


/**
 * Item/Product catalog type
 * Cache: 30 minutes - catalog items are relatively static
 */
export type ItemImagesArgs = {
  kind?: InputMaybe<ImageKind>;
};

export type ItemAvailability = {
  __typename: 'ItemAvailability';
  available: Scalars['Boolean']['output'];
  inventory: Maybe<Scalars['Int']['output']>;
  lastChecked: Scalars['DateTime']['output'];
  price: Maybe<Scalars['Float']['output']>;
  storeId: Scalars['ID']['output'];
  storeName: Scalars['String']['output'];
};

export type ItemBrand = {
  __typename: 'ItemBrand';
  brand: Brand;
  id: Scalars['ID']['output'];
  item: Item;
};

export type ItemCategory = {
  __typename: 'ItemCategory';
  assignedAt: Maybe<Scalars['String']['output']>;
  assignedBy: Maybe<User>;
  category: Category;
  confidence: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  item: Item;
  source: CategorySource;
};

export type ItemCategoryPayload = MutationPayload & {
  __typename: 'ItemCategoryPayload';
  code: Scalars['String']['output'];
  itemCategory: Maybe<ItemCategory>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type ItemCategorySuggestion = {
  __typename: 'ItemCategorySuggestion';
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  type: CategoryType;
};

export type ItemClassificationInput = {
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  storageState?: InputMaybe<StorageState>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** Describes the current physical condition or quality of a pantry item */
export enum ItemCondition {
  /** Item has passed its expiration or best-by date */
  Expired = 'EXPIRED',
  /** Item is still usable but showing signs of age or quality decline */
  Fair = 'FAIR',
  /** Item is fresh and in optimal condition for use */
  Good = 'GOOD',
  /** Item has deteriorated and is no longer safe to consume */
  Spoiled = 'SPOILED'
}

export type ItemConnection = Connection & {
  __typename: 'ItemConnection';
  edges: Array<ItemEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type ItemCreation = {
  __typename: 'ItemCreation';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  item: Item;
  metadata: Maybe<Scalars['JSON']['output']>;
  reason: Maybe<Scalars['String']['output']>;
  source: DataSource;
  user: User;
};

/** Item connection for pagination (Relay spec) */
export type ItemEdge = Edge & {
  __typename: 'ItemEdge';
  cursor: Scalars['String']['output'];
  node: Item;
};

export type ItemEdit = {
  __typename: 'ItemEdit';
  createdAt: Scalars['DateTime']['output'];
  editReason: Maybe<Scalars['String']['output']>;
  fieldsChanged: Array<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  item: Item;
  newValues: Maybe<Scalars['JSON']['output']>;
  oldValues: Maybe<Scalars['JSON']['output']>;
  user: User;
};

export type ItemError = {
  __typename: 'ItemError';
  code: Maybe<Scalars['String']['output']>;
  error: Scalars['String']['output'];
  field: Maybe<Scalars['String']['output']>;
  identifier: Maybe<Scalars['String']['output']>;
  name: Maybe<Scalars['String']['output']>;
};

export type ItemFilters = {
  brandFilter?: InputMaybe<BrandFilterInput>;
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  category?: InputMaybe<Scalars['String']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  curation?: InputMaybe<CurationFilterInput>;
  dateRange?: InputMaybe<DateRangeFilterInput>;
  dietary?: InputMaybe<DietaryFilterInput>;
  /** Filter items that have a default unit assigned */
  hasDefaultUnit?: InputMaybe<Scalars['Boolean']['input']>;
  lookup?: InputMaybe<ItemLookupInput>;
  priceRange?: InputMaybe<PriceRangeInput>;
  status?: InputMaybe<ItemStatus>;
  statuses?: InputMaybe<Array<ItemStatus>>;
  storageState?: InputMaybe<StorageState>;
  storageStates?: InputMaybe<Array<StorageState>>;
  storeFilter?: InputMaybe<StoreFilterInput>;
  tagFilter?: InputMaybe<TagFilterInput>;
  type?: InputMaybe<ItemType>;
  types?: InputMaybe<Array<ItemType>>;
  visibility?: InputMaybe<Visibility>;
  workflow?: InputMaybe<WorkflowFilterInput>;
};

/** Typed image record for items (replaces JSON images field) */
export type ItemImage = {
  __typename: 'ItemImage';
  createdAt: Maybe<Scalars['DateTime']['output']>;
  featured: Maybe<Scalars['Boolean']['output']>;
  hash: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPrimary: Maybe<Scalars['Boolean']['output']>;
  kind: Maybe<ImageKind>;
  perspective: Maybe<Scalars['String']['output']>;
  size: Maybe<Scalars['Int']['output']>;
  source: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
};

/** Sub-input for item lookup by identifier */
export type ItemLookupInput = {
  /** External ID from a provider (e.g., Kroger product ID) */
  externalId?: InputMaybe<Scalars['String']['input']>;
  /** Provider type for external ID lookup */
  externalProvider?: InputMaybe<ProviderType>;
  /** SKU to search for */
  sku?: InputMaybe<Scalars['String']['input']>;
  /** Store ID for SKU lookup (optional, searches all stores if not provided) */
  skuStoreId?: InputMaybe<Scalars['String']['input']>;
  /** UPC/barcode to search for */
  upc?: InputMaybe<Scalars['String']['input']>;
  /** Format hint for UPC validation/normalization (defaults to AUTO) */
  upcFormat?: InputMaybe<UpcFormat>;
};

export enum ItemMatchType {
  Created = 'CREATED',
  ExistingName = 'EXISTING_NAME',
  ExistingUpc = 'EXISTING_UPC',
  Variation = 'VARIATION'
}

/** Manufacturer-provided net weight in a specific unit (e.g., 3.4 oz or 96g) */
export type ItemNetWeightInput = {
  unitId?: InputMaybe<Scalars['ID']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['Float']['input'];
};

export type ItemPayload = MutationPayload & {
  __typename: 'ItemPayload';
  code: Scalars['String']['output'];
  item: Maybe<Item>;
  matchType: Maybe<ItemMatchType>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Price history for items - may contain user-specific pricing data */
export type ItemPriceHistory = {
  __typename: 'ItemPriceHistory';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  item: Item;
  metadata: Maybe<Scalars['JSON']['output']>;
  price: Scalars['Float']['output'];
  source: Scalars['String']['output'];
};

export type ItemPriceHistoryConnection = Connection & {
  __typename: 'ItemPriceHistoryConnection';
  edges: Array<ItemPriceHistoryEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Item price history connection for pagination */
export type ItemPriceHistoryEdge = Edge & {
  __typename: 'ItemPriceHistoryEdge';
  cursor: Scalars['String']['output'];
  node: ItemPriceHistory;
};

export type ItemPriceHistoryOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  price?: InputMaybe<SortOrder>;
};

export type ItemPriceHistoryPayload = MutationPayload & {
  __typename: 'ItemPriceHistoryPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  priceHistory: Maybe<ItemPriceHistory>;
  success: Scalars['Boolean']['output'];
};

export enum ItemSortField {
  CreatedAt = 'CREATED_AT',
  ImageCount = 'IMAGE_COUNT',
  Name = 'NAME',
  Popularity = 'POPULARITY',
  Price = 'PRICE',
  ShelfLife = 'SHELF_LIFE',
  UnitPrice = 'UNIT_PRICE',
  UpdatedAt = 'UPDATED_AT'
}

export type ItemSortInput = {
  field: ItemSortField;
  order: SortOrder;
};

export enum ItemStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Deprecated = 'DEPRECATED',
  Pending = 'PENDING'
}

/**
 * Store SKU mapping for items
 * Cache: 10 minutes - SKU mappings can change but not frequently
 */
export type ItemStoreSku = {
  __typename: 'ItemStoreSku';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  item: Item;
  metadata: Maybe<Scalars['JSON']['output']>;
  price: Maybe<Scalars['Float']['output']>;
  sku: Scalars['String']['output'];
  store: Store;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type ItemStoreSkuConnection = Connection & {
  __typename: 'ItemStoreSkuConnection';
  edges: Array<ItemStoreSkuEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Item store SKU connection for pagination */
export type ItemStoreSkuEdge = Edge & {
  __typename: 'ItemStoreSkuEdge';
  cursor: Scalars['String']['output'];
  node: ItemStoreSku;
};

export type ItemStoreSkuOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
};

export type ItemSuggestion = {
  __typename: 'ItemSuggestion';
  brands: Array<BrandSuggestion>;
  category: Maybe<ItemCategorySuggestion>;
  defaultUnit: Maybe<ItemUnitSuggestion>;
  displayUnit: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageUrl: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  netWeight: Maybe<Scalars['Float']['output']>;
  type: ItemType;
};

/** Categorizes the general type of an item in the pantry or shopping list */
export enum ItemType {
  /** Beverages including water, juice, coffee, tea, and alcohol */
  Drink = 'DRINK',
  /** General food items including produce, meats, dairy, and prepared foods */
  Food = 'FOOD',
  /** Staple ingredients and basics such as flour, oil, salt, and sugar */
  Foundation = 'FOUNDATION',
  /** Household essentials like cleaning products, trash bags, and batteries */
  Household = 'HOUSEHOLD',
  /** Items that do not fit into any other category */
  Other = 'OTHER',
  /** Personal care items such as soap, shampoo, and hygiene products */
  PersonalCare = 'PERSONAL_CARE',
  /** Pet food, treats, litter, and other pet-related supplies */
  Pet = 'PET',
  /** Non-food grocery products such as cleaning supplies or paper goods */
  Product = 'PRODUCT',
  /** Vitamins, minerals, protein powders, and other dietary supplements */
  Supplement = 'SUPPLEMENT'
}

export type ItemUnit = {
  __typename: 'ItemUnit';
  averagePricePerUnit: Maybe<Scalars['Float']['output']>;
  contentUnit: Maybe<Unit>;
  contentUnitId: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['DateTime']['output'];
  displayFormat: DisplayFormat;
  displayNamePlural: Maybe<Scalars['String']['output']>;
  displayNameSingular: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isCommon: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  isPreferred: Scalars['Boolean']['output'];
  item: Maybe<Item>;
  itemId: Scalars['ID']['output'];
  maxQuantity: Maybe<Scalars['Float']['output']>;
  minQuantity: Maybe<Scalars['Float']['output']>;
  packageDescription: Maybe<Scalars['String']['output']>;
  packageSize: Maybe<Scalars['Float']['output']>;
  quantityStep: Maybe<Scalars['Float']['output']>;
  recommendedFor: Array<UnitRecommendation>;
  retailUnit: Scalars['Boolean']['output'];
  unit: Maybe<Unit>;
  unitId: Scalars['ID']['output'];
  updatedAt: Scalars['DateTime']['output'];
  usageContext: Array<UnitUsageContext>;
  version: Scalars['Int']['output'];
};

export type ItemUnitConfigInput = {
  defaultUnit?: InputMaybe<Scalars['String']['input']>;
  density?: InputMaybe<Scalars['Float']['input']>;
  preferredTrackingUnitId?: InputMaybe<Scalars['ID']['input']>;
  units?: InputMaybe<Array<ItemUnitInput>>;
};

/**
 * Item-specific unit conversion
 * Stores conversions like "1 cup flour = 120g"
 */
export type ItemUnitConversion = {
  __typename: 'ItemUnitConversion';
  addedBy: Maybe<User>;
  confidence: Scalars['Float']['output'];
  conversionRatio: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  fromUnit: Unit;
  id: Scalars['ID']['output'];
  isVerified: Scalars['Boolean']['output'];
  item: Item;
  notes: Maybe<Scalars['String']['output']>;
  source: ConversionSource;
  toUnit: Unit;
  updatedAt: Scalars['DateTime']['output'];
  verifiedBy: Maybe<User>;
};

export type ItemUnitConversionPayload = MutationPayload & {
  __typename: 'ItemUnitConversionPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  unitConversion: Maybe<ItemUnitConversion>;
};

export type ItemUnitInput = {
  averagePricePerUnit?: InputMaybe<Scalars['Float']['input']>;
  contentUnitId?: InputMaybe<Scalars['ID']['input']>;
  contentUnitName?: InputMaybe<Scalars['String']['input']>;
  externalSourceMappingId?: InputMaybe<Scalars['ID']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  isPreferred?: InputMaybe<Scalars['Boolean']['input']>;
  packageDescription?: InputMaybe<Scalars['String']['input']>;
  packageSize?: InputMaybe<Scalars['Float']['input']>;
  recommendedFor?: InputMaybe<Array<UnitRecommendation>>;
  retailUnit?: InputMaybe<Scalars['Boolean']['input']>;
  unitId?: InputMaybe<Scalars['ID']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  usageContext?: InputMaybe<Array<UnitUsageContext>>;
};

export type ItemUnitSuggestion = {
  __typename: 'ItemUnitSuggestion';
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  isPreferred: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  type: UnitType;
};

export type ItemValidationError = {
  __typename: 'ItemValidationError';
  code: Scalars['String']['output'];
  field: Scalars['String']['output'];
  message: Scalars['String']['output'];
};

export type ItemsResponse = {
  __typename: 'ItemsResponse';
  hasMore: Scalars['Boolean']['output'];
  items: Array<Item>;
  totalCount: Scalars['Int']['output'];
};

/** Comprehensive ledger analytics combining additions and consumption */
export type LedgerAnalytics = {
  __typename: 'LedgerAnalytics';
  costAnalytics: Maybe<AdditionCostAnalytics>;
  granularity: PeriodGranularity;
  periodData: Array<LedgerPeriodData>;
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  summary: LedgerSummary;
  topRestockedItems: Array<UsageByItem>;
};

/** Per-period ledger data for trend analysis */
export type LedgerPeriodData = {
  __typename: 'LedgerPeriodData';
  added: Scalars['Float']['output'];
  additionCost: Maybe<Scalars['Float']['output']>;
  consumed: Scalars['Float']['output'];
  net: Scalars['Float']['output'];
  periodEnd: Scalars['DateTime']['output'];
  periodLabel: Scalars['String']['output'];
  periodStart: Scalars['DateTime']['output'];
  wasted: Scalars['Float']['output'];
};

/**
 * Ledger summary showing additions vs consumption.
 * Top-level totals (totalAdded, totalConsumed, totalWasted, netQuantity) are only
 * populated when ALL records in the query share the same unit. Otherwise, use the
 * per-unit breakdowns (additionsByUnit, consumptionByUnit) for accurate data.
 */
export type LedgerSummary = {
  __typename: 'LedgerSummary';
  additionCount: Scalars['Int']['output'];
  additionsByUnit: Array<UsageByUnit>;
  consumptionByUnit: Array<UsageByUnit>;
  consumptionCount: Scalars['Int']['output'];
  netQuantity: Maybe<Scalars['Float']['output']>;
  totalAdded: Maybe<Scalars['Float']['output']>;
  totalConsumed: Maybe<Scalars['Float']['output']>;
  totalWasted: Maybe<Scalars['Float']['output']>;
  unitName: Maybe<Scalars['String']['output']>;
  wasteCount: Scalars['Int']['output'];
};

/** Input for linking an item to an external source */
export type LinkItemToExternalSourceInput = {
  data?: InputMaybe<Scalars['JSON']['input']>;
  externalId: Scalars['String']['input'];
  externalType?: InputMaybe<Scalars['String']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
  source: ExternalSource;
};

export enum ListActivityType {
  CollaboratorAdded = 'COLLABORATOR_ADDED',
  CollaboratorRemoved = 'COLLABORATOR_REMOVED',
  CollaboratorRoleChanged = 'COLLABORATOR_ROLE_CHANGED',
  ItemAdded = 'ITEM_ADDED',
  ItemPurchased = 'ITEM_PURCHASED',
  ItemRemoved = 'ITEM_REMOVED',
  ItemUpdated = 'ITEM_UPDATED',
  ListCreated = 'LIST_CREATED',
  ListDeleted = 'LIST_DELETED',
  ListShared = 'LIST_SHARED',
  ListUpdated = 'LIST_UPDATED'
}

export enum ListStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Paused = 'PAUSED',
  Template = 'TEMPLATE'
}

export type LocationStat = {
  __typename: 'LocationStat';
  count: Scalars['Int']['output'];
  ipCity: Maybe<Scalars['String']['output']>;
  ipCountry: Maybe<Scalars['String']['output']>;
};

export type LoginActivityEvent = {
  __typename: 'LoginActivityEvent';
  activityType: LoginActivityType;
  loginHistory: Maybe<LoginHistory>;
  suspiciousActivity: Maybe<SuspiciousActivity>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export enum LoginActivityType {
  Attempted = 'ATTEMPTED',
  Failed = 'FAILED',
  Risky = 'RISKY',
  Suspicious = 'SUSPICIOUS'
}

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
  SuspiciousActivity = 'SUSPICIOUS_ACTIVITY'
}

/** Security audit log for login attempts - NEVER cache */
export type LoginHistory = {
  __typename: 'LoginHistory';
  apiClient: Maybe<Scalars['String']['output']>;
  browserName: Maybe<Scalars['String']['output']>;
  browserVersion: Maybe<Scalars['String']['output']>;
  campaign: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  device: Maybe<Device>;
  deviceId: Maybe<Scalars['String']['output']>;
  deviceType: Maybe<DeviceType>;
  failureDetails: Maybe<Scalars['String']['output']>;
  failureReason: Maybe<LoginFailureReason>;
  flaggedAt: Maybe<Scalars['DateTime']['output']>;
  flaggedBy: Maybe<User>;
  flaggedById: Maybe<Scalars['ID']['output']>;
  flaggedReason: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  ipCity: Maybe<Scalars['String']['output']>;
  ipCountry: Maybe<Scalars['String']['output']>;
  ipRegion: Maybe<Scalars['String']['output']>;
  isApiLogin: Scalars['Boolean']['output'];
  isAutomated: Scalars['Boolean']['output'];
  isMobileApp: Scalars['Boolean']['output'];
  isNewBrowser: Scalars['Boolean']['output'];
  isNewDevice: Scalars['Boolean']['output'];
  isNewLocation: Scalars['Boolean']['output'];
  isProxy: Maybe<Scalars['Boolean']['output']>;
  isRisky: Scalars['Boolean']['output'];
  isTor: Maybe<Scalars['Boolean']['output']>;
  isVpn: Maybe<Scalars['Boolean']['output']>;
  landingPage: Maybe<Scalars['String']['output']>;
  lastActivityAt: Maybe<Scalars['DateTime']['output']>;
  loggedInAt: Scalars['DateTime']['output'];
  loggedOutAt: Maybe<Scalars['DateTime']['output']>;
  method: LoginMethod;
  mfaCompleted: Scalars['Boolean']['output'];
  mfaMethod: Maybe<MfaMethod>;
  osName: Maybe<Scalars['String']['output']>;
  osVersion: Maybe<Scalars['String']['output']>;
  provider: Maybe<Scalars['String']['output']>;
  referrer: Maybe<Scalars['String']['output']>;
  requiresMfa: Scalars['Boolean']['output'];
  reviewed: Scalars['Boolean']['output'];
  reviewedAt: Maybe<Scalars['DateTime']['output']>;
  reviewedBy: Maybe<User>;
  reviewedById: Maybe<Scalars['ID']['output']>;
  sessionDuration: Maybe<Scalars['Int']['output']>;
  source: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
  timezoneDiff: Maybe<Scalars['Int']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userAgent: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

export type LoginHistoryActivity = {
  __typename: 'LoginHistoryActivity';
  id: Scalars['ID']['output'];
  isRisky: Scalars['Boolean']['output'];
  loggedInAt: Scalars['DateTime']['output'];
  method: LoginMethod;
  success: Scalars['Boolean']['output'];
};

export type LoginHistoryBreakdown = {
  __typename: 'LoginHistoryBreakdown';
  locations: Array<LocationStat>;
  methods: Array<LoginMethodStat>;
  uniqueDevices: Array<DeviceStat>;
  uniqueIPs: Array<IpStat>;
};

export type LoginHistoryConnection = Connection & {
  __typename: 'LoginHistoryConnection';
  edges: Array<LoginHistoryEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Login history connection for pagination */
export type LoginHistoryEdge = Edge & {
  __typename: 'LoginHistoryEdge';
  cursor: Scalars['String']['output'];
  node: LoginHistory;
};

export type LoginHistoryOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  loginAt?: InputMaybe<SortOrder>;
};

export type LoginHistoryPayload = MutationPayload & {
  __typename: 'LoginHistoryPayload';
  code: Scalars['String']['output'];
  loginHistory: Maybe<LoginHistory>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type LoginHistoryPeriod = {
  __typename: 'LoginHistoryPeriod';
  days: Scalars['Int']['output'];
  from: Scalars['DateTime']['output'];
  to: Scalars['DateTime']['output'];
};

/** Filter input for querying login history. */
export type LoginHistoryQueryFilters = {
  failuresOnly?: InputMaybe<Scalars['Boolean']['input']>;
  fromDate?: InputMaybe<Scalars['DateTime']['input']>;
  hours?: InputMaybe<Scalars['Int']['input']>;
  ipAddress?: InputMaybe<Scalars['String']['input']>;
  method?: InputMaybe<LoginMethod>;
  riskyOnly?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  successOnly?: InputMaybe<Scalars['Boolean']['input']>;
  toDate?: InputMaybe<Scalars['DateTime']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type LoginHistoryStats = {
  __typename: 'LoginHistoryStats';
  breakdown: LoginHistoryBreakdown;
  period: LoginHistoryPeriod;
  recentActivity: Array<LoginHistoryActivity>;
  summary: LoginHistorySummary;
};

export type LoginHistorySummary = {
  __typename: 'LoginHistorySummary';
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
  Token = 'TOKEN'
}

export type LoginMethodStat = {
  __typename: 'LoginMethodStat';
  count: Scalars['Int']['output'];
  method: LoginMethod;
};

/** A pantry item that is running low on stock */
export type LowStockItem = {
  __typename: 'LowStockItem';
  currentQuantity: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  itemId: Scalars['ID']['output'];
  itemName: Scalars['String']['output'];
  minQuantity: Scalars['Float']['output'];
  pantryId: Scalars['ID']['output'];
  pantryName: Scalars['String']['output'];
  restockQuantity: Maybe<Scalars['Float']['output']>;
  unitId: Scalars['ID']['output'];
  unitName: Scalars['String']['output'];
};

/** Result of adding low stock items to a shopping list */
export type LowStockToShoppingListResult = {
  __typename: 'LowStockToShoppingListResult';
  addedCount: Scalars['Int']['output'];
  addedItems: Array<AddedLowStockItem>;
  skippedCount: Scalars['Int']['output'];
  skippedItems: Array<SkippedLowStockItem>;
};

/** Input for managing appeals (submit or review). */
export type ManageAppealInput = {
  /** For submitting: appeal notes from the user */
  appealNotes?: InputMaybe<Scalars['String']['input']>;
  /** For reviewing: whether the appeal is approved (null = submitting, true/false = reviewing) */
  approved?: InputMaybe<Scalars['Boolean']['input']>;
  /** For reviewing: reviewer's notes */
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

/** Input for managing restrictions (add and/or remove in one call). */
export type ManageRestrictionsInput = {
  /** Restrictions to add */
  add?: InputMaybe<Array<ModerationRestriction>>;
  reason?: InputMaybe<Scalars['String']['input']>;
  /** Restrictions to remove */
  remove?: InputMaybe<Array<ModerationRestriction>>;
  restrictedUntil?: InputMaybe<Scalars['DateTime']['input']>;
  userId: Scalars['ID']['input'];
};

export type MarkActionInput = {
  action: ExpirationAction;
  notificationId: Scalars['ID']['input'];
};

export type MarkAsTemplateInput = {
  saveItems?: InputMaybe<Scalars['Boolean']['input']>;
  templateName: Scalars['String']['input'];
};

/** Input for marking a recipe as cooked */
export type MarkRecipeAsCookedInput = {
  deductFromPantry: Scalars['Boolean']['input'];
  ingredientsUsed?: InputMaybe<Array<IngredientUsageInput>>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
};

export enum MatchType {
  Category = 'CATEGORY',
  Exact = 'EXACT',
  Fuzzy = 'FUZZY',
  Partial = 'PARTIAL'
}

/**
 * Meal plan for organizing meals over a period
 * Cache: 5 minutes - plans change occasionally
 */
export type MealPlan = {
  __typename: 'MealPlan';
  actualCost: Scalars['Float']['output'];
  budgetAmount: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy: Maybe<User>;
  description: Maybe<Scalars['String']['output']>;
  dietaryProfile: Maybe<DietaryProfile>;
  endDate: Scalars['DateTime']['output'];
  generatedShoppingLists: Array<ShoppingList>;
  home: Maybe<Home>;
  homeId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  mealPlanItems: Array<MealPlanItem>;
  name: Scalars['String']['output'];
  /**
   * Progress toward nutrition goals from linked dietary profile.
   * Returns null if no dietary profile is linked.
   */
  nutritionGoalProgress: Maybe<NutritionGoalProgress>;
  /**
   * Aggregated nutrition summary for the entire meal plan.
   * Includes totals, daily averages, and breakdown by meal type.
   */
  nutritionSummary: MealPlanNutritionSummary;
  planType: MealPlanType;
  servings: Scalars['Int']['output'];
  startDate: Scalars['DateTime']['output'];
  totalCalories: Maybe<Scalars['Float']['output']>;
  totalCarbs: Maybe<Scalars['Float']['output']>;
  totalFat: Maybe<Scalars['Float']['output']>;
  totalProtein: Maybe<Scalars['Float']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  version: Scalars['Int']['output'];
};

export type MealPlanConnection = Connection & {
  __typename: 'MealPlanConnection';
  edges: Array<MealPlanEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Meal plan connection for pagination */
export type MealPlanEdge = Edge & {
  __typename: 'MealPlanEdge';
  cursor: Scalars['String']['output'];
  node: MealPlan;
};

export type MealPlanFilters = {
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  /** Filter by home ID to see only home-scoped meal plans */
  homeId?: InputMaybe<Scalars['ID']['input']>;
  /** Filter to only active meal plans (current date within start/end range) */
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter by meal plan type */
  planType?: InputMaybe<MealPlanType>;
  /** Search by name or description (case-insensitive) */
  search?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['DateTime']['input']>;
  /** Admin-only: Filter by specific user ID */
  userId?: InputMaybe<Scalars['ID']['input']>;
};

/**
 * Meal plan item linking recipes to meals
 * Cache: 5 minutes - meal plans change occasionally
 */
export type MealPlanItem = {
  __typename: 'MealPlanItem';
  actualCost: Maybe<Scalars['Float']['output']>;
  calories: Maybe<Scalars['Float']['output']>;
  carbs: Maybe<Scalars['Float']['output']>;
  completedAt: Maybe<Scalars['DateTime']['output']>;
  customMealName: Maybe<Scalars['String']['output']>;
  date: Scalars['DateTime']['output'];
  estimatedCost: Maybe<Scalars['Float']['output']>;
  fat: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  isCompleted: Scalars['Boolean']['output'];
  mealPlan: MealPlan;
  mealType: MealType;
  notes: Maybe<Scalars['String']['output']>;
  nutritionSource: NutritionSource;
  protein: Maybe<Scalars['Float']['output']>;
  recipe: Maybe<Recipe>;
  servings: Maybe<Scalars['Int']['output']>;
  usedPantryItems: Scalars['JSON']['output'];
};

export type MealPlanItemPayload = MutationPayload & {
  __typename: 'MealPlanItemPayload';
  code: Scalars['String']['output'];
  mealPlanItem: Maybe<MealPlanItem>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Aggregated nutrition data for a meal plan */
export type MealPlanNutritionSummary = {
  __typename: 'MealPlanNutritionSummary';
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

/** Order by options for meal plans */
export type MealPlanOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  startDate?: InputMaybe<SortOrder>;
};

export type MealPlanPayload = MutationPayload & {
  __typename: 'MealPlanPayload';
  code: Scalars['String']['output'];
  mealPlan: Maybe<MealPlan>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export enum MealPlanType {
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY'
}

/**
 * Reusable meal template for quick meal plan creation.
 * Templates store meal patterns that can be applied to create meal plans.
 * Cache: 5 minutes - templates change occasionally
 */
export type MealTemplate = {
  __typename: 'MealTemplate';
  category: TemplateCategory;
  createdAt: Scalars['DateTime']['output'];
  defaultServings: Scalars['Int']['output'];
  description: Maybe<Scalars['String']['output']>;
  durationDays: Scalars['Int']['output'];
  home: Maybe<Home>;
  homeId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  items: Array<MealTemplateItem>;
  lastUsedAt: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  usageCount: Scalars['Int']['output'];
  user: User;
};

export type MealTemplateConnection = Connection & {
  __typename: 'MealTemplateConnection';
  edges: Array<MealTemplateEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Meal template connection for pagination */
export type MealTemplateEdge = Edge & {
  __typename: 'MealTemplateEdge';
  cursor: Scalars['String']['output'];
  node: MealTemplate;
};

/** Filter options for listing templates */
export type MealTemplateFilters = {
  category?: InputMaybe<TemplateCategory>;
  maxDuration?: InputMaybe<Scalars['Int']['input']>;
  minDuration?: InputMaybe<Scalars['Int']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Admin-only: Filter by specific user ID */
  userId?: InputMaybe<Scalars['ID']['input']>;
};

/** A single meal within a template */
export type MealTemplateItem = {
  __typename: 'MealTemplateItem';
  customMealName: Maybe<Scalars['String']['output']>;
  dayOffset: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  mealType: MealType;
  notes: Maybe<Scalars['String']['output']>;
  recipe: Maybe<Recipe>;
  servings: Maybe<Scalars['Int']['output']>;
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

export type MealTemplateItemPayload = MutationPayload & {
  __typename: 'MealTemplateItemPayload';
  code: Scalars['String']['output'];
  mealTemplateItem: Maybe<MealTemplateItem>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Order by options for meal templates */
export type MealTemplateOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
  usageCount?: InputMaybe<SortOrder>;
};

export type MealTemplatePayload = MutationPayload & {
  __typename: 'MealTemplatePayload';
  code: Scalars['String']['output'];
  mealTemplate: Maybe<MealTemplate>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Identifies the type of meal for meal planning and recipe categorization */
export enum MealType {
  /** Morning meal, typically the first meal of the day */
  Breakfast = 'BREAKFAST',
  /** Late-morning meal combining elements of breakfast and lunch */
  Brunch = 'BRUNCH',
  /** Sweet course served at the end of a meal or as a treat */
  Dessert = 'DESSERT',
  /** Evening meal, typically the main meal of the day */
  Dinner = 'DINNER',
  /** Midday meal */
  Lunch = 'LUNCH',
  /** Light bite or small portion eaten between main meals */
  Snack = 'SNACK'
}

/** Nutrition breakdown by meal type */
export type MealTypeNutrition = {
  __typename: 'MealTypeNutrition';
  mealCount: Scalars['Int']['output'];
  mealType: MealType;
  totalCalories: Scalars['Float']['output'];
  totalCarbs: Scalars['Float']['output'];
  totalFat: Scalars['Float']['output'];
  totalProtein: Scalars['Float']['output'];
};

/** Reusable sub-input for media assets (images) */
export type MediaAssetsInput = {
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  images?: InputMaybe<Array<ImageInput>>;
};

export type Membership = {
  __typename: 'Membership';
  canAddItems: Scalars['Boolean']['output'];
  canEditPantry: Scalars['Boolean']['output'];
  canInviteOthers: Scalars['Boolean']['output'];
  canManageHome: Scalars['Boolean']['output'];
  canRemoveItems: Scalars['Boolean']['output'];
  canViewPantry: Scalars['Boolean']['output'];
  createdAt: Scalars['DateTime']['output'];
  displayName: Maybe<Scalars['String']['output']>;
  home: Home;
  homeId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  joinedAt: Scalars['DateTime']['output'];
  lastActiveAt: Maybe<Scalars['DateTime']['output']>;
  leftAt: Maybe<Scalars['DateTime']['output']>;
  role: MembershipRole;
  status: MembershipStatus;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['ID']['output'];
  version: Scalars['Int']['output'];
};

export type MembershipChangeEvent = {
  __typename: 'MembershipChangeEvent';
  changeType: MembershipChangeType;
  homeId: Scalars['ID']['output'];
  membership: Membership;
  newRole: Maybe<MembershipRole>;
  previousRole: Maybe<MembershipRole>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export enum MembershipChangeType {
  Joined = 'JOINED',
  Left = 'LEFT',
  RoleChanged = 'ROLE_CHANGED',
  Updated = 'UPDATED'
}

export type MembershipConnection = Connection & {
  __typename: 'MembershipConnection';
  edges: Array<MembershipEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Membership connection for pagination */
export type MembershipEdge = Edge & {
  __typename: 'MembershipEdge';
  cursor: Scalars['String']['output'];
  node: Membership;
};

export enum MembershipJoinMethod {
  DirectAdd = 'DIRECT_ADD',
  Invite = 'INVITE',
  JoinCode = 'JOIN_CODE'
}

export type MembershipJoinedPayload = {
  __typename: 'MembershipJoinedPayload';
  homeId: Scalars['String']['output'];
  joinMethod: MembershipJoinMethod;
  membership: Membership;
  userId: Scalars['String']['output'];
};

export enum MembershipLeftMethod {
  Removed = 'REMOVED',
  Suspended = 'SUSPENDED',
  Voluntary = 'VOLUNTARY'
}

export type MembershipLeftPayload = {
  __typename: 'MembershipLeftPayload';
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
  Updated = 'UPDATED'
}

export type MembershipOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
};

export type MembershipPayload = MutationPayload & {
  __typename: 'MembershipPayload';
  code: Scalars['String']['output'];
  membership: Maybe<Membership>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Defines the role and permission level of a member within a household */
export enum MembershipRole {
  /** Can manage household settings, members, and all resources */
  Admin = 'ADMIN',
  /** Limited temporary access to household resources */
  Guest = 'GUEST',
  /** Standard member with access to shared household features */
  Member = 'MEMBER',
  /** Full ownership of the household including the ability to delete it */
  Owner = 'OWNER'
}

export type MembershipRoleChangedPayload = {
  __typename: 'MembershipRoleChangedPayload';
  changedBy: Scalars['String']['output'];
  homeId: Scalars['String']['output'];
  membership: Membership;
  newRole: MembershipRole;
  previousRole: MembershipRole;
  userId: Scalars['String']['output'];
};

export type MembershipRoleStats = {
  __typename: 'MembershipRoleStats';
  admin: Scalars['Int']['output'];
  guest: Scalars['Int']['output'];
  member: Scalars['Int']['output'];
  owner: Scalars['Int']['output'];
};

export type MembershipStats = {
  __typename: 'MembershipStats';
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
  Suspended = 'SUSPENDED'
}

export type MembershipStatusStats = {
  __typename: 'MembershipStatusStats';
  active: Scalars['Int']['output'];
  left: Scalars['Int']['output'];
  removed: Scalars['Int']['output'];
  suspended: Scalars['Int']['output'];
};

export type MembershipUpdatePayload = {
  __typename: 'MembershipUpdatePayload';
  mutation: MembershipMutationType;
  node: Maybe<Membership>;
  updatedFields: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['ID']['output'];
};

export enum MfaMethod {
  Biometric = 'BIOMETRIC',
  Email = 'EMAIL',
  Hardware = 'HARDWARE',
  Push = 'PUSH',
  Sms = 'SMS',
  Totp = 'TOTP'
}

export enum MobilePlatform {
  Android = 'ANDROID',
  Ios = 'IOS',
  Linux = 'LINUX',
  Macos = 'MACOS',
  Other = 'OTHER',
  Windows = 'WINDOWS'
}

export enum ModerationRestriction {
  LimitedInteractions = 'LIMITED_INTERACTIONS',
  NoCommenting = 'NO_COMMENTING',
  NoMessaging = 'NO_MESSAGING',
  NoPosting = 'NO_POSTING',
  NoRecipeCreation = 'NO_RECIPE_CREATION',
  NoReviews = 'NO_REVIEWS',
  NoSharing = 'NO_SHARING'
}

export enum ModerationStatus {
  Active = 'ACTIVE',
  Appealing = 'APPEALING',
  Banned = 'BANNED',
  Restricted = 'RESTRICTED',
  Suspended = 'SUSPENDED',
  UnderReview = 'UNDER_REVIEW',
  Warned = 'WARNED'
}

/** Result of moving all purchased items to pantry */
export type MovePurchasedItemsResult = {
  __typename: 'MovePurchasedItemsResult';
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
  /**
   * Actual per-unit price paid (optional).
   * If not provided, auto-derived from shopping item's purchasedPrice, then estimatedPrice.
   * Server calculates totalCost = actualPrice × actualQuantity for analytics.
   */
  actualPrice?: InputMaybe<Scalars['Float']['input']>;
  /** Actual quantity purchased (may differ from planned) */
  actualQuantity: Scalars['Float']['input'];
  /** Unit ID for the quantity (defaults to shopping item's unit) */
  actualUnitId?: InputMaybe<Scalars['ID']['input']>;
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
};

export type MoveShoppingListItemInput = {
  afterItemId?: InputMaybe<Scalars['ID']['input']>;
  beforeItemId?: InputMaybe<Scalars['ID']['input']>;
  itemId: Scalars['ID']['input'];
};

/** Info about a successfully moved item */
export type MovedItemInfo = {
  __typename: 'MovedItemInfo';
  itemName: Scalars['String']['output'];
  pantryItemId: Scalars['ID']['output'];
  quantity: Scalars['Float']['output'];
  shoppingListItemId: Scalars['ID']['output'];
};

/** Sub-input for multi-unit measurement */
export type MultiUnitMeasurementInput = {
  metricAmount?: InputMaybe<Scalars['Float']['input']>;
  metricUnit?: InputMaybe<Scalars['String']['input']>;
  usAmount?: InputMaybe<Scalars['Float']['input']>;
  usUnit?: InputMaybe<Scalars['String']['input']>;
};

export type Mutation = {
  __typename: 'Mutation';
  /** Accept a home invitation using its token. */
  acceptHomeInvite: MembershipPayload;
  /** Accept an invitation to collaborate on a shopping list. */
  acceptShoppingListInvite: ShoppingListCollaboratorPayload;
  /** Add a single item to a shopping list. */
  addItemToShoppingList: ShoppingListItemPayload;
  /**
   * Batch add multiple items to a shopping list.
   * More efficient than calling addItemToShoppingList multiple times.
   * Max 50 items per batch.
   */
  addItemsToShoppingList: BatchAddShoppingListItemsResponse;
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
  addRecipeToShoppingList: ShoppingListPayload;
  /** Add a dietary restriction to the user's profile. */
  addRestriction: DietaryRestrictionPayload;
  /** Add an item to a template */
  addTemplateItem: MealTemplateItemPayload;
  /** Add a new address to the current user's account. */
  addUserAddress: UserAddressPayload;
  /** Add a warning to a user's moderation record */
  addWarning: UserModerationPayload;
  /**
   * Adjust pantry item quantity to match a physical count.
   * Creates an ADJUSTMENT usage record with mandatory reason for audit trail.
   * The delta (positive or negative) is calculated automatically.
   */
  adjustPantryItemQuantity: PantryItemPayload;
  /** Admin: Delete multiple items (soft delete by default, permanent if specified) */
  adminBulkDeleteItems: BulkOperationSummary;
  /**
   * Delete images from S3/MinIO storage and update related Item records.
   *
   * For batches >50 images (or when useQueue=true), the operation runs
   * in the background. Use adminGetImageDeletionJobStatus to check progress.
   *
   * This endpoint is designed for admin panel use after duplicate detection.
   * It removes the specified images from storage and deletes the corresponding ItemImage records.
   */
  adminDeleteImages: ImageDeletionResult;
  /** Admin: Delete an item (soft delete by default, permanent if specified) */
  adminDeleteItem: ItemPayload;
  /** Admin: Delete any recipe (soft delete by default, permanent if specified) */
  adminDeleteRecipe: RecipePayload;
  /** Admin: Delete any recipe review (bypasses ownership restrictions) */
  adminDeleteRecipeReview: RecipeReviewPayload;
  /** Delete a user's account as an administrator. */
  adminDeleteUser: UserPayload;
  /** Admin: Update any item (bypasses ownership restrictions) */
  adminUpdateItem: ItemPayload;
  /** Admin: Update any recipe (bypasses ownership restrictions) */
  adminUpdateRecipe: RecipePayload;
  /** Approve a user-created item for public visibility */
  approveItem: ItemPayload;
  /** Archive a shopping list. */
  archiveShoppingList: ShoppingListPayload;
  /**
   * Admin: enqueue embedding computation for items that don't yet have one.
   * Returns the number of jobs queued. Use dryRun to estimate backlog without
   * enqueueing. Throttled server-side to protect the embedding provider.
   */
  backfillItemEmbeddings: BackfillEmbeddingsResult;
  /** Create multiple items at once */
  bulkCreateItems: BulkCreateItemsResponse;
  /** Create multiple purchase records at once. */
  bulkCreatePurchases: BulkPurchasePayload;
  bulkCreateStores: BulkStorePayload;
  /** Delete multiple items */
  bulkDeleteItems: BulkOperationSummary;
  /** Delete multiple purchase records at once. */
  bulkDeletePurchases: BulkPurchasePayload;
  /** Send notifications to multiple users at once (admin only). */
  bulkSendNotifications: BulkNotificationResult;
  /**
   * Bulk update multiple devices at once.
   * Replaces: trustMultipleDevices, untrustMultipleDevices, deactivateMultipleDevices, deleteMultipleDevices
   */
  bulkUpdateDevices: BulkDeviceResult;
  /** Update multiple items with the same changes */
  bulkUpdateItems: BulkOperationSummary;
  /**
   * Bulk update multiple login history records with the same changes.
   * Replaces markMultipleLoginsAsReviewed and flagMultipleLoginsAsRisky.
   */
  bulkUpdateLoginHistories: BulkLoginHistoryPayload;
  /** Bulk create or update items by external source (max 50 per batch). */
  bulkUpsertItemsByExternalSource: BatchUpsertItemsResponse;
  /** Cancel recurring generation for a shopping list. */
  cancelRecurring: ShoppingListPayload;
  /** Assign an item to a category. */
  categorizeItem: ItemCategoryPayload;
  /** Change password for authenticated user (requires current password verification) */
  changePassword: ChangePasswordResponse;
  /**
   * Cleanup stale or deleted devices.
   * Admin operation for maintenance.
   */
  cleanupDevices: DeviceCleanupResult;
  /** Clear the reminder from a shopping list. */
  clearReminder: ShoppingListPayload;
  /**
   * Clear items from a shopping list based on purchased status.
   * Soft-deletes all items matching the purchased filter and where deletedAt is not set.
   * Use purchased=true to clear purchased items, purchased=false to clear unpurchased items.
   * Returns summary with count of cleared items.
   */
  clearShoppingListItems: ClearItemsResponse;
  /** Mark user onboarding as complete and send welcome email */
  completeOnboarding: UserPayload;
  /** Mark a shopping list as completed. */
  completeShoppingList: ShoppingListPayload;
  /** Confirm an item image upload and associate it with the item. */
  confirmItemImageUpload: UploadPayload;
  /** Confirm a profile image upload and associate it with the user. */
  confirmProfileImageUpload: UploadPayload;
  confirmRecipeConsumption: RecipeConsumptionResult;
  /**
   * Convert only expired batches to waste within a pantry item.
   * Non-expired batches remain active. Aggregate is recalculated.
   */
  convertExpiredBatchesToWaste: PantryItemPayload;
  /**
   * Convert an expired pantry item to waste in one step.
   * Sets condition to SPOILED, creates a WASTE usage record with wasteReason=EXPIRED,
   * and sets quantity to 0. Use after expiration job marks item as EXPIRED.
   */
  convertExpiredToWaste: PantryItemPayload;
  /**
   * Correct the net weight for a dual-tracked pantry item.
   * Recalculates remainingNetWeight proportionally and derives new quantity.
   * Use this when the original net weight was entered incorrectly.
   */
  correctPantryItemWeight: PantryItemPayload;
  /** Create a new brand. */
  createBrand: BrandPayload;
  /** Create a new category. */
  createCategory: CategoryPayload;
  /** Create a new cooking log entry. */
  createCookingLog: CookingLogPayload;
  /** Create a new currency. */
  createCurrency: CurrencyPayload;
  /** Create a new shopping list from a template. */
  createFromTemplate: ShoppingListPayload;
  /** Create a new home. */
  createHome: HomePayload;
  /** Generate a presigned URL for image upload with purpose validation. */
  createImageUploadUrl: PresignPayload;
  /** Create a new item */
  createItem: ItemPayload;
  /** Create a new meal plan. */
  createMealPlan: MealPlanPayload;
  /**
   * Create a new meal plan from a template.
   * Copies all template items to the new plan with dates offset from startDate.
   */
  createMealPlanFromTemplate: MealPlanPayload;
  /** Add an item to a meal plan. */
  createMealPlanItem: MealPlanItemPayload;
  /** Create a new meal template */
  createMealTemplate: MealTemplatePayload;
  /** Create a new membership directly (owner/admin only). */
  createMembership: MembershipPayload;
  /** Create a moderation record for a user */
  createModerationRecord: UserModerationPayload;
  /** Create a new notification. */
  createNotification: NotificationPayload;
  /** Create a new pantry for a home. */
  createPantry: PantryPayload;
  /** Create a new pantry item in a pantry. */
  createPantryItem: PantryItemPayload;
  /** Record a usage event for a pantry item. */
  createPantryItemUsage: PantryItemUsagePayload;
  /** Create a user profile for the current user. */
  createProfile: UserProfilePayload;
  /** Create a new purchase record. */
  createPurchase: PurchasePayload;
  createRecipe: RecipePayload;
  /** Create a review for a published recipe. */
  createRecipeReview: RecipeReviewPayload;
  /** Create a new shopping list. */
  createShoppingList: ShoppingListPayload;
  createShoppingListItemFromRecipeIngredient: AddIngredientResult;
  createShoppingListItemsFromRecipe: AddRecipeToShoppingListResult;
  /**
   * Create a new storage location
   * Validates parent-child relationships and prevents circular references
   * Requires user to have edit permissions in the home
   */
  createStorageLocation: StorageLocationPayload;
  createStore: StorePayload;
  /**
   * Create a template from an existing meal plan.
   * Extracts the meal pattern into a reusable template.
   */
  createTemplateFromMealPlan: MealTemplatePayload;
  /** Create a new unit of measurement. */
  createUnit: UnitPayload;
  /** Decline a home invitation using its token. */
  declineHomeInvite: HomeInvitePayload;
  /** Decline an invitation to collaborate on a shopping list. */
  declineShoppingListInvite: ShoppingListCollaboratorPayload;
  /** Delete the current user's account. */
  deleteAccount: UserPayload;
  /** Delete all read notifications for the current user. */
  deleteAllReadNotifications: BulkNotificationPayload;
  /** Delete a brand. */
  deleteBrand: BrandPayload;
  /** Delete a category. */
  deleteCategory: CategoryPayload;
  /** Delete a cooking log entry. */
  deleteCookingLog: CookingLogPayload;
  /** Delete a currency. */
  deleteCurrency: CurrencyPayload;
  /** Delete all expired notifications (admin only). */
  deleteExpiredNotifications: BulkNotificationPayload;
  /** Delete an external source mapping. */
  deleteExternalSource: ExternalSourceMappingPayload;
  /** Delete a home (owner only). */
  deleteHome: HomePayload;
  /** Delete an item (soft delete by default, permanent if specified) */
  deleteItem: ItemPayload;
  /** Delete an item unit conversion and its reverse conversion (admin only) */
  deleteItemUnitConversion: ItemUnitConversionPayload;
  /** Delete a meal plan. */
  deleteMealPlan: MealPlanPayload;
  /** Remove an item from a meal plan. */
  deleteMealPlanItem: MealPlanItemPayload;
  /** Delete a meal template (soft delete) */
  deleteMealTemplate: MealTemplatePayload;
  /** Delete multiple notifications by their IDs. */
  deleteMultipleNotifications: BulkNotificationPayload;
  /** Delete a notification. */
  deleteNotification: NotificationPayload;
  /** Delete a pantry (owner only). */
  deletePantry: PantryPayload;
  /** Delete a pantry item (soft delete). */
  deletePantryItem: PantryItemPayload;
  /** Delete a purchase record. */
  deletePurchase: PurchasePayload;
  deleteRecipe: RecipePayload;
  /** Delete a recipe folder and optionally move its recipes. */
  deleteRecipeFolder: SavedRecipePayload;
  /** Delete a recipe review (author only). */
  deleteRecipeReview: RecipeReviewPayload;
  /** Delete a shopping list (owner only). */
  deleteShoppingList: ShoppingListPayload;
  /**
   * Delete a storage location (soft delete)
   * Fails if location has child locations or items
   * Requires user to have edit permissions in the home
   */
  deleteStorageLocation: StorageLocationPayload;
  deleteStore: StorePayload;
  /** Delete a unit of measurement. */
  deleteUnit: UnitPayload;
  /** Delete a user address. */
  deleteUserAddress: UserAddressPayload;
  /** Dismiss an expiration notification so it no longer appears. */
  dismissExpirationNotification: ExpirationNotificationPayload;
  /** Duplicate a meal plan with all its items, shifted to new dates. */
  duplicateMealPlan: MealPlanPayload;
  /** Duplicate a template with a new name */
  duplicateTemplate: MealTemplatePayload;
  /** Save a recipe as a favorite. */
  favoriteRecipe: SavedRecipePayload;
  /** Flag an item for review */
  flagItemForReview: ItemPayload;
  /** Request a password reset email */
  forgotPassword: ForgotPasswordResponse;
  forkRecipe: RecipePayload;
  /** Generate the next recurring shopping list instance. */
  generateNextRecurringList: ShoppingListPayload;
  /** Generate a shopping list from all recipe-based items in a meal plan. */
  generateShoppingListFromMealPlan: ShoppingListPayload;
  /** Hard delete a device permanently (admin only) */
  hardDeleteDevice: DevicePayload;
  /** Increment an item's popularity counter */
  incrementItemPopularity: ItemPayload;
  /** Increment the cooked count for a saved recipe. */
  incrementRecipeCookedCount: SavedRecipePayload;
  /** Send an invitation for a user to join a home. */
  inviteToHome: HomeInvitePayload;
  /** Invite a user to collaborate on a shopping list. */
  inviteToShoppingList: ShoppingListCollaboratorPayload;
  /** Join a home using its join code. */
  joinHomeByCode: MembershipPayload;
  /** Join a shared shopping list using its share code. */
  joinShoppingListByShareCode: ShoppingListPayload;
  /** Leave a home as the current user. */
  leaveHome: MembershipPayload;
  /** Link an existing item to an external source. */
  linkItemToExternalSource: ExternalSourceMappingPayload;
  /** Authenticate a user with credentials and return tokens. */
  login: AuthPayload;
  /**
   * Manage appeals (submit or review).
   * Consolidates: submitAppeal, reviewAppeal.
   */
  manageAppeal: UserModerationPayload;
  /**
   * Manage user restrictions (add and/or remove in one call).
   * Consolidates: addRestrictions, removeRestrictions.
   */
  manageRestrictions: UserModerationPayload;
  /** Mark all notifications as read for the current user. */
  markAllNotificationsAsRead: BulkNotificationPayload;
  /** Mark a shopping list as a reusable template. */
  markAsTemplate: ShoppingListPayload;
  /** Record an action taken on an expiring item. */
  markExpirationAction: ExpirationNotificationPayload;
  /** Mark an expiration notification as read. */
  markExpirationNotificationAsRead: ExpirationNotificationPayload;
  /** Mark a notification as read. */
  markNotificationAsRead: NotificationPayload;
  /** Mark a notification as unread. */
  markNotificationUnread: NotificationPayload;
  /** Mark a pantry item as expired. */
  markPantryItemExpired: PantryItemPayload;
  /** Mark recipe as cooked and optionally deduct from pantry */
  markRecipeAsCooked: CookingLogPayload;
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
  moveShoppingItemToPantry: PantryItemPayload;
  /** Reorder a shopping list item relative to other items. */
  moveShoppingListItem: ShoppingListItemPayload;
  /** Mark a pantry item as opened. */
  openPantryItem: PantryItemPayload;
  /**
   * Mark a specific batch as opened.
   * Sets isOpened=true and openedAt to current time on the targeted batch.
   */
  openPantryItemBatch: PantryItemPayload;
  /**
   * Record a login event. Consolidates recordLoginAttempt and createLoginHistory.
   * Use for all login recording — both high-level attempts and direct history creation.
   */
  recordLogin: LoginHistoryPayload;
  /** Manually record pantry item usage */
  recordPantryUsage: PantryItemUsagePayload;
  /** Record a price observation for historical tracking */
  recordPriceObservation: ItemPriceHistoryPayload;
  /** Refresh an expired access token using a refresh token. */
  refresh: RefreshTokenPayload;
  /** Register a new user account and return tokens. */
  register: AuthPayload;
  /**
   * Register a new device for the current user.
   * This is the primary way to add a device from mobile apps.
   */
  registerDevice: DevicePayload;
  /** Reject a user-created item */
  rejectItem: ItemPayload;
  /** Remove an item from a shopping list. */
  removeItemFromShoppingList: ShoppingListItemPayload;
  /** Remove the primary image from an item (deletes from S3) */
  removeItemImage: ItemPayload;
  /** Remove a member from a home (owner/admin only). */
  removeMember: MembershipPayload;
  /** Remove a dietary restriction from the user's profile. */
  removeRestriction: DietaryRestrictionPayload;
  /** Remove a collaborator from a shopping list. */
  removeShoppingListCollaborator: ShoppingListCollaboratorPayload;
  /** Remove an item from a template */
  removeTemplateItem: MealTemplateItemPayload;
  /** Remove the conversion factor from a unit. */
  removeUnitConversion: UnitPayload;
  /**
   * Reorder multiple storage locations
   * All locations must belong to the same home
   * Requires user to have edit permissions in the home
   */
  reorderStorageLocations: StorageLocationPayload;
  /** Resend the email verification message to a user. */
  resendVerificationEmail: UserPayload;
  /** Reset password using token from email */
  resetPassword: ResetPasswordResponse;
  /**
   * Restock a pantry item - adds quantity and creates a ledger record.
   * Use this when replenishing an existing pantry item.
   */
  restockPantryItem: PantryItemUsagePayload;
  /** Restore a soft-deleted item */
  restoreItem: ItemPayload;
  /** Revoke a pending home invitation. */
  revokeHomeInvite: HomeInvitePayload;
  /** Send a test notification of a specific type to the current user. */
  sendTestNotification: NotificationPayload;
  /** Set the default home for the current user. */
  setDefaultHome: SetDefaultHomePayload;
  /** Set a pantry as the default for its home. */
  setDefaultPantry: PantryPayload;
  /** Set a shopping list as the default. */
  setDefaultShoppingList: ShoppingListPayload;
  /**
   * Set a storage location as the default for its home
   * Automatically unsets the previous default location
   * Requires user to have edit permissions in the home
   */
  setDefaultStorageLocation: StorageLocationPayload;
  /** Set a reminder for a shopping list. */
  setReminder: ShoppingListPayload;
  /** Set up recurring generation for a shopping list. */
  setupRecurring: ShoppingListPayload;
  /** Set up a conversion factor between a unit and its base unit. */
  setupUnitConversion: UnitPayload;
  /** Share a shopping list publicly with an optional share code. */
  shareShoppingList: ShoppingListPayload;
  /** Sync a pantry item deletion from an offline client. */
  syncDeletePantryItem: SyncPantryItemResult;
  /** Sync a shopping list item deletion from an offline client. */
  syncDeleteShoppingListItem: SyncShoppingListItemResult;
  /** Sync a pantry item reorder from an offline client. */
  syncMovePantryItem: SyncPantryItemResult;
  /** Sync a shopping list item reorder from an offline client. */
  syncMoveShoppingListItem: SyncShoppingListItemResult;
  /** Sync a pantry item from an offline client. */
  syncPantryItem: SyncPantryItemResult;
  /** Sync a shopping list item from an offline client. */
  syncShoppingListItem: SyncShoppingListItemResult;
  /** Toggle a helpful vote on a recipe review. */
  toggleReviewHelpful: ReviewHelpfulPayload;
  /** Toggle the purchased state of a shopping list item. */
  toggleShoppingListItemPurchased: ShoppingListItemPayload;
  /** Transfer ownership of a home to another member. */
  transferHomeOwnership: HomeOwnershipPayload;
  /** Remove an item from a category. */
  uncategorizeItem: ItemCategoryPayload;
  /** Revert a completed shopping list back to active. */
  uncompleteShoppingList: ShoppingListPayload;
  /** Remove a recipe from favorites. */
  unfavoriteRecipe: SavedRecipePayload;
  /** Update an existing brand. */
  updateBrand: BrandPayload;
  /** Update an existing category. */
  updateCategory: CategoryPayload;
  /** Update a collaborator's granular permissions on a shopping list. */
  updateCollaboratorPermissions: ShoppingListCollaboratorPayload;
  /** Update a collaborator's role on a shopping list. */
  updateCollaboratorRole: ShoppingListCollaboratorPayload;
  /** Update an existing cooking log entry. */
  updateCookingLog: CookingLogPayload;
  /** Update an existing currency. */
  updateCurrency: CurrencyPayload;
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
  updateDevice: DevicePayload;
  /** Update the current user's dietary profile. */
  updateDietaryProfile: DietaryProfilePayload;
  /** Update an external source mapping. */
  updateExternalSource: ExternalSourceMappingPayload;
  /** Update details of a favorited recipe (notes, folder, rating). */
  updateFavoriteRecipe: SavedRecipePayload;
  /** Update an existing home's details. */
  updateHome: HomePayload;
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
   */
  updateItem: ItemPayload;
  /**
   * Update a login history record. Handles:
   * - Session updates (loggedOutAt, sessionDuration, lastActivityAt)
   * - Administrative actions (marking as reviewed, flagging as risky)
   * - General field updates
   */
  updateLoginHistory: LoginHistoryPayload;
  /** Update an existing meal plan. */
  updateMealPlan: MealPlanPayload;
  /** Update an item in a meal plan. */
  updateMealPlanItem: MealPlanItemPayload;
  /** Update an existing meal template */
  updateMealTemplate: MealTemplatePayload;
  /** Update membership details and permissions (owner/admin only). */
  updateMembership: MembershipPayload;
  /**
   * Update moderation state for a user.
   * Consolidates: updateModerationStatus, updateTrustLevel, updateRiskScore,
   * banUser, unbanUser, suspendUser, unsuspendUser, putUnderReview, completeReview.
   */
  updateModeration: UserModerationPayload;
  /** Update an existing notification. */
  updateNotification: NotificationPayload;
  /** Update notification preferences for the current user. */
  updateNotificationPreferences: NotificationPreferencesPayload;
  /** Update an existing pantry's details. */
  updatePantry: PantryPayload;
  /** Update an existing pantry item. */
  updatePantryItem: PantryItemPayload;
  /** Move a pantry item to a different storage location. */
  updatePantryItemLocation: PantryItemPayload;
  /** Update pantry item quantity (supports fractions) */
  updatePantryItemQuantity: PantryItemPayload;
  /**
   * Update user profile. Handles all profile fields including avatar and cover image.
   * Set avatarUrl/coverImageUrl to null to remove them.
   */
  updateProfile: UserProfilePayload;
  /** Update an existing purchase record. */
  updatePurchase: PurchasePayload;
  updateRecipe: RecipePayload;
  updateRecipeIngredients: RecipePayload;
  /** Update an existing recipe review (author only). */
  updateRecipeReview: RecipeReviewPayload;
  /** Update an existing dietary restriction. */
  updateRestriction: DietaryRestrictionPayload;
  /** Update settings for the current user. */
  updateSettings: UserSettingsPayload;
  /** Update an existing shopping list. */
  updateShoppingList: ShoppingListPayload;
  /** Update a shopping list item. */
  updateShoppingListItem: ShoppingListItemPayload;
  /** Update shopping list item quantity (supports fractions) */
  updateShoppingListItemQuantity: ShoppingListItemPayload;
  /**
   * Update an existing storage location
   * Validates parent-child relationships and prevents circular references
   * Requires user to have edit permissions in the home
   */
  updateStorageLocation: StorageLocationPayload;
  updateStore: StorePayload;
  updateStoreInfo: StorePayload;
  /** Update a template item */
  updateTemplateItem: MealTemplateItemPayload;
  /** Update an existing unit of measurement. */
  updateUnit: UnitPayload;
  /** Update a user's account details. */
  updateUser: UserPayload;
  /** Update an existing user address. */
  updateUserAddress: UserAddressPayload;
  upsertExternalRecipe: UpsertExternalRecipeResult;
  /** Create or update an item based on its external source ID. */
  upsertItemByExternalSource: UpsertItemResult;
  /**
   * Add or update item-specific unit conversion
   * Admins can set source, confidence, and isVerified; non-admins get defaults
   */
  upsertItemUnitConversion: ItemUnitConversionPayload;
  /** Validate if a password reset token is still valid */
  validatePasswordResetToken: ValidateTokenResponse;
  /** Verify a user's email address using a verification code. */
  verifyEmail: UserPayload;
  /**
   * Verify an item unit conversion as accurate (admin only)
   * Sets isVerified to true and records the verifying admin
   */
  verifyItemUnitConversion: ItemUnitConversionPayload;
  /** Manually verify a user's email address (admin use). */
  verifyUserEmail: UserPayload;
  /**
   * Waste a specific batch within a pantry item.
   * Only the targeted batch is zeroed out; other batches remain active.
   */
  wastePantryItemBatch: PantryItemPayload;
};


export type MutationAcceptHomeInviteArgs = {
  token: Scalars['String']['input'];
};


export type MutationAcceptShoppingListInviteArgs = {
  token: Scalars['String']['input'];
};


export type MutationAddItemToShoppingListArgs = {
  input: CreateShoppingListItemInput;
};


export type MutationAddItemsToShoppingListArgs = {
  items: Array<BatchAddShoppingListItemInput>;
  shoppingListId: Scalars['ID']['input'];
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
  input: AddRecipeToShoppingListInput;
};


export type MutationAddRestrictionArgs = {
  input: AddRestrictionInput;
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


export type MutationAdjustPantryItemQuantityArgs = {
  id: Scalars['ID']['input'];
  input: AdjustPantryItemQuantityInput;
};


export type MutationAdminBulkDeleteItemsArgs = {
  ids: Array<Scalars['ID']['input']>;
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationAdminDeleteImagesArgs = {
  input: AdminDeleteImagesInput;
};


export type MutationAdminDeleteItemArgs = {
  id: Scalars['ID']['input'];
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationAdminDeleteRecipeArgs = {
  id: Scalars['ID']['input'];
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};


export type MutationAdminDeleteRecipeReviewArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAdminDeleteUserArgs = {
  id: Scalars['ID']['input'];
  input?: InputMaybe<AdminDeleteUserInput>;
};


export type MutationAdminUpdateItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdateItemInput;
};


export type MutationAdminUpdateRecipeArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRecipeInput;
};


export type MutationApproveItemArgs = {
  itemId: Scalars['ID']['input'];
};


export type MutationArchiveShoppingListArgs = {
  id: Scalars['ID']['input'];
};


export type MutationBackfillItemEmbeddingsArgs = {
  dryRun?: InputMaybe<Scalars['Boolean']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationBulkCreateItemsArgs = {
  input: BulkCreateItemInput;
};


export type MutationBulkCreatePurchasesArgs = {
  purchases: Array<CreatePurchaseInput>;
};


export type MutationBulkCreateStoresArgs = {
  stores: Array<CreateStoreInput>;
};


export type MutationBulkDeleteItemsArgs = {
  ids: Array<Scalars['ID']['input']>;
};


export type MutationBulkDeletePurchasesArgs = {
  purchaseIds: Array<Scalars['ID']['input']>;
};


export type MutationBulkSendNotificationsArgs = {
  input: BulkNotificationInput;
};


export type MutationBulkUpdateDevicesArgs = {
  ids: Array<Scalars['ID']['input']>;
  input: BulkDeviceUpdateInput;
};


export type MutationBulkUpdateItemsArgs = {
  ids: Array<Scalars['ID']['input']>;
  input: UpdateItemInput;
};


export type MutationBulkUpdateLoginHistoriesArgs = {
  ids: Array<Scalars['ID']['input']>;
  input: UpdateLoginHistoryInput;
};


export type MutationBulkUpsertItemsByExternalSourceArgs = {
  items: Array<BatchUpsertItemInput>;
};


export type MutationCancelRecurringArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCategorizeItemArgs = {
  input: CategorizeItemInput;
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


export type MutationClearShoppingListItemsArgs = {
  purchased: Scalars['Boolean']['input'];
  shoppingListId: Scalars['ID']['input'];
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
  input: ConfirmRecipeConsumptionInput;
};


export type MutationConvertExpiredBatchesToWasteArgs = {
  pantryItemId: Scalars['ID']['input'];
};


export type MutationConvertExpiredToWasteArgs = {
  pantryItemId: Scalars['ID']['input'];
};


export type MutationCorrectPantryItemWeightArgs = {
  id: Scalars['ID']['input'];
  input: CorrectPantryItemWeightInput;
};


export type MutationCreateBrandArgs = {
  input: CreateBrandInput;
};


export type MutationCreateCategoryArgs = {
  input: CreateCategoryInput;
};


export type MutationCreateCookingLogArgs = {
  input: CreateCookingLogInput;
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


export type MutationCreateMealPlanArgs = {
  input: CreateMealPlanInput;
};


export type MutationCreateMealPlanFromTemplateArgs = {
  input: CreateMealPlanFromTemplateInput;
};


export type MutationCreateMealPlanItemArgs = {
  input: CreateMealPlanItemInput;
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


export type MutationCreateRecipeReviewArgs = {
  input: CreateRecipeReviewInput;
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
  input: CreateShoppingListItemsFromRecipeInput;
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


export type MutationDeclineHomeInviteArgs = {
  token: Scalars['String']['input'];
};


export type MutationDeclineShoppingListInviteArgs = {
  token: Scalars['String']['input'];
};


export type MutationDeleteBrandArgs = {
  id: Scalars['ID']['input'];
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


export type MutationDeleteExternalSourceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteHomeArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteItemArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteItemUnitConversionArgs = {
  conversionId: Scalars['ID']['input'];
};


export type MutationDeleteMealPlanArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMealPlanItemArgs = {
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


export type MutationDeleteRecipeFolderArgs = {
  input: DeleteRecipeFolderInput;
};


export type MutationDeleteRecipeReviewArgs = {
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


export type MutationDuplicateMealPlanArgs = {
  input: DuplicateMealPlanInput;
};


export type MutationDuplicateTemplateArgs = {
  id: Scalars['ID']['input'];
  newName: Scalars['String']['input'];
};


export type MutationFavoriteRecipeArgs = {
  input: FavoriteRecipeInput;
};


export type MutationFlagItemForReviewArgs = {
  itemId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
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


export type MutationGenerateShoppingListFromMealPlanArgs = {
  input: GenerateShoppingListFromMealPlanInput;
};


export type MutationHardDeleteDeviceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationIncrementItemPopularityArgs = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
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
  input: LinkItemToExternalSourceInput;
};


export type MutationLoginArgs = {
  input: LoginInput;
};


export type MutationManageAppealArgs = {
  input: ManageAppealInput;
};


export type MutationManageRestrictionsArgs = {
  input: ManageRestrictionsInput;
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
  input: MarkRecipeAsCookedInput;
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


export type MutationOpenPantryItemBatchArgs = {
  input: OpenBatchInput;
};


export type MutationRecordLoginArgs = {
  input: RecordLoginInput;
};


export type MutationRecordPantryUsageArgs = {
  input: RecordPantryUsageInput;
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


export type MutationRemoveItemFromShoppingListArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveItemImageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRemoveMemberArgs = {
  membershipId: Scalars['ID']['input'];
};


export type MutationRemoveRestrictionArgs = {
  input: RemoveRestrictionInput;
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


export type MutationRevokeHomeInviteArgs = {
  id: Scalars['ID']['input'];
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


export type MutationSyncDeletePantryItemArgs = {
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationSyncDeleteShoppingListItemArgs = {
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
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


export type MutationToggleReviewHelpfulArgs = {
  input: ToggleReviewHelpfulInput;
};


export type MutationToggleShoppingListItemPurchasedArgs = {
  input: ToggleShoppingListItemPurchasedInput;
};


export type MutationTransferHomeOwnershipArgs = {
  homeId: Scalars['ID']['input'];
  newOwnerId: Scalars['ID']['input'];
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


export type MutationUpdateBrandArgs = {
  id: Scalars['ID']['input'];
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
  input: UpdateCollaboratorRoleInput;
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


export type MutationUpdateExternalSourceArgs = {
  id: Scalars['ID']['input'];
  input: UpdateExternalSourceInput;
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


export type MutationUpdateMealPlanArgs = {
  id: Scalars['ID']['input'];
  input: UpdateMealPlanInput;
};


export type MutationUpdateMealPlanItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdateMealPlanItemInput;
};


export type MutationUpdateMealTemplateArgs = {
  id: Scalars['ID']['input'];
  input: UpdateMealTemplateInput;
};


export type MutationUpdateMembershipArgs = {
  id: Scalars['ID']['input'];
  input: UpdateMembershipInput;
};


export type MutationUpdateModerationArgs = {
  input: UpdateModerationInput;
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


export type MutationUpdateRecipeReviewArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRecipeReviewInput;
};


export type MutationUpdateRestrictionArgs = {
  input: UpdateRestrictionInput;
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
  input: UpdateStoreInfoInput;
  storeId: Scalars['ID']['input'];
};


export type MutationUpdateTemplateItemArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTemplateItemInput;
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
  id: Scalars['ID']['input'];
  input: UpdateUserAddressInput;
};


export type MutationUpsertExternalRecipeArgs = {
  input: CreateRecipeInput;
};


export type MutationUpsertItemByExternalSourceArgs = {
  externalId: Scalars['String']['input'];
  externalType?: InputMaybe<Scalars['String']['input']>;
  itemData: CreateItemInput;
  source: ExternalSource;
  sourceData?: InputMaybe<Scalars['JSON']['input']>;
};


export type MutationUpsertItemUnitConversionArgs = {
  input: UpsertItemUnitConversionInput;
};


export type MutationValidatePasswordResetTokenArgs = {
  token: Scalars['String']['input'];
};


export type MutationVerifyEmailArgs = {
  code: Scalars['String']['input'];
};


export type MutationVerifyItemUnitConversionArgs = {
  confidence?: InputMaybe<Scalars['Float']['input']>;
  conversionId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
};


export type MutationVerifyUserEmailArgs = {
  id: Scalars['ID']['input'];
};


export type MutationWastePantryItemBatchArgs = {
  input: WasteBatchInput;
};

/**
 * Base interface for all mutation payloads.
 * Ensures every mutation response includes operation metadata.
 * Domain-specific payload types implement this interface and add their entity field.
 */
export type MutationPayload = {
  /** Machine-readable status code (e.g., SUCCESS, VALIDATION_ERROR, NOT_FOUND) */
  code: Scalars['String']['output'];
  /** Human-readable message describing the result */
  message: Scalars['String']['output'];
  /** Whether the mutation operation succeeded */
  success: Scalars['Boolean']['output'];
};

/** Describes the type of mutation that triggered a real-time subscription event */
export enum MutationType {
  /** A new collaborator was added to a shared resource */
  CollaboratorAdded = 'COLLABORATOR_ADDED',
  /** A collaborator was removed from a shared resource */
  CollaboratorRemoved = 'COLLABORATOR_REMOVED',
  /** A resource was marked as completed */
  Completed = 'COMPLETED',
  /** A new resource was created */
  Created = 'CREATED',
  /** A resource was deleted or soft-deleted */
  Deleted = 'DELETED',
  /** Multiple items were cleared from a list in a single batch operation */
  ItemsBatchCleared = 'ITEMS_BATCH_CLEARED',
  /** A new item was added to a list or collection */
  ItemAdded = 'ITEM_ADDED',
  /** An item was marked as completed or purchased */
  ItemCompleted = 'ITEM_COMPLETED',
  /** An item was removed from a list or collection */
  ItemRemoved = 'ITEM_REMOVED',
  /** A previously completed item was reverted to an active state */
  ItemUncompleted = 'ITEM_UNCOMPLETED',
  /** An existing item within a list was modified */
  ItemUpdated = 'ITEM_UPDATED',
  /** The status of a resource changed */
  StatusChanged = 'STATUS_CHANGED',
  /** An existing resource was modified */
  Updated = 'UPDATED'
}

/**
 * Limited moderation view for users checking their own status.
 * Excludes internal scoring, automated flags, and moderator notes.
 */
export type MyModerationStatus = {
  __typename: 'MyModerationStatus';
  appealNotes: Maybe<Scalars['String']['output']>;
  appealStatus: Maybe<AppealStatus>;
  appealedAt: Maybe<Scalars['DateTime']['output']>;
  banReason: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isBanned: Scalars['Boolean']['output'];
  isSuspended: Scalars['Boolean']['output'];
  restrictedUntil: Maybe<Scalars['DateTime']['output']>;
  restrictionReason: Maybe<Scalars['String']['output']>;
  restrictions: Array<ModerationRestriction>;
  status: ModerationStatus;
  suspendedUntil: Maybe<Scalars['DateTime']['output']>;
  suspensionReason: Maybe<Scalars['String']['output']>;
  trustLevel: TrustLevel;
  underReview: Scalars['Boolean']['output'];
};

/** Reusable sub-input for net weight with unit */
export type NetWeightInput = {
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  netWeightUnitId?: InputMaybe<Scalars['ID']['input']>;
};

/** Reusable sub-input for network and location info */
export type NetworkLocationInput = {
  ipAddress?: InputMaybe<Scalars['String']['input']>;
  ipCity?: InputMaybe<Scalars['String']['input']>;
  ipCountry?: InputMaybe<Scalars['String']['input']>;
  ipRegion?: InputMaybe<Scalars['String']['input']>;
  isProxy?: InputMaybe<Scalars['Boolean']['input']>;
  isTor?: InputMaybe<Scalars['Boolean']['input']>;
  isVpn?: InputMaybe<Scalars['Boolean']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

/**
 * Notification type for user alerts and messages
 * Cache: None - notifications must be real-time
 */
export type Notification = Timestamped & {
  __typename: 'Notification';
  /** Deep link or CTA destination for this notification. */
  actionUrl: Maybe<Scalars['String']['output']>;
  /**
   * Grouping category for this notification.
   * Matches the categories returned by NotificationStats.byCategory.
   */
  category: Maybe<NotificationCategory>;
  createdAt: Scalars['DateTime']['output'];
  /** When this notification expires. Null if it does not expire. */
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  message: Maybe<Scalars['String']['output']>;
  payload: Scalars['JSON']['output'];
  priority: Priority;
  readAt: Maybe<Scalars['DateTime']['output']>;
  sentAt: Scalars['DateTime']['output'];
  /**
   * ID of the entity that triggered this notification (e.g. a HomeInvite ID).
   * Use this to correlate a notification back to its source entity.
   * Convention: sourceType="HOME_INVITE" means sourceId is a HomeInvite.id.
   */
  sourceId: Maybe<Scalars['String']['output']>;
  /** Type label for the source entity. Known values: HOME_INVITE, MEMBERSHIP_INVITE, COLLABORATION_INVITE. */
  sourceType: Maybe<Scalars['String']['output']>;
  status: NotificationStatus;
  title: Maybe<Scalars['String']['output']>;
  type: NotificationType;
  user: User;
  userId: Scalars['ID']['output'];
};

export enum NotificationCategory {
  Home = 'HOME',
  Pantry = 'PANTRY',
  Recipe = 'RECIPE',
  Shopping = 'SHOPPING',
  System = 'SYSTEM'
}

export type NotificationCategoryCount = {
  __typename: 'NotificationCategoryCount';
  category: NotificationCategory;
  count: Scalars['Int']['output'];
  unreadCount: Scalars['Int']['output'];
};

export type NotificationChangeEvent = {
  __typename: 'NotificationChangeEvent';
  changeType: NotificationChangeType;
  notification: Notification;
  timestamp: Scalars['DateTime']['output'];
};

export enum NotificationChangeType {
  Received = 'RECEIVED',
  Updated = 'UPDATED'
}

/** Sub-input for notification channel toggles */
export type NotificationChannelsInput = {
  emailEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  pushEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  smsEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type NotificationConnection = Connection & {
  __typename: 'NotificationConnection';
  edges: Array<NotificationEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
  unreadCount: Scalars['Int']['output'];
};

export enum NotificationDeliveryStatus {
  Cancelled = 'CANCELLED',
  Dismissed = 'DISMISSED',
  Failed = 'FAILED',
  Pending = 'PENDING',
  Read = 'READ',
  Sent = 'SENT'
}

export type NotificationEdge = Edge & {
  __typename: 'NotificationEdge';
  cursor: Scalars['String']['output'];
  node: Notification;
};

export type NotificationEventPayload = {
  __typename: 'NotificationEventPayload';
  mutation: Maybe<MutationType>;
  notification: Maybe<Notification>;
  timestamp: Maybe<Scalars['String']['output']>;
  userId: Maybe<Scalars['String']['output']>;
};

export type NotificationFilters = {
  batchId?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<NotificationCategory>;
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
  TypeDesc = 'TYPE_DESC'
}

export type NotificationPayload = MutationPayload & {
  __typename: 'NotificationPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  notification: Maybe<Notification>;
  success: Scalars['Boolean']['output'];
};

/**
 * User notification preferences
 * Cache: 10 minutes - preferences rarely change, always private
 */
export type NotificationPreferences = {
  __typename: 'NotificationPreferences';
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
  quietHoursEnd: Maybe<Scalars['String']['output']>;
  quietHoursStart: Maybe<Scalars['String']['output']>;
  quietHoursTimezone: Maybe<Scalars['String']['output']>;
  recipeRecommendations: Scalars['Boolean']['output'];
  sharedListUpdates: Scalars['Boolean']['output'];
  shoppingListUpdates: Scalars['Boolean']['output'];
  smsEnabled: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['ID']['output'];
  weeklyDigest: Scalars['Boolean']['output'];
};

export type NotificationPreferencesPayload = MutationPayload & {
  __typename: 'NotificationPreferencesPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  notificationPreferences: Maybe<NotificationPreferences>;
  success: Scalars['Boolean']['output'];
};

export type NotificationPriorityCount = {
  __typename: 'NotificationPriorityCount';
  count: Scalars['Int']['output'];
  priority: Priority;
  unreadCount: Scalars['Int']['output'];
};

/**
 * Notification statistics
 * Cache: 1 minute - stats update frequently but can tolerate brief staleness
 */
export type NotificationStats = {
  __typename: 'NotificationStats';
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
  Clicked = 'CLICKED',
  Dismissed = 'DISMISSED',
  Expired = 'EXPIRED',
  Failed = 'FAILED',
  Pending = 'PENDING',
  Read = 'READ',
  Sent = 'SENT'
}

/** Identifies the category of a notification sent to a user */
export enum NotificationType {
  /** A collaborator accepted a shopping list invitation */
  CollaborationAccepted = 'COLLABORATION_ACCEPTED',
  /** A collaborator declined a shopping list invitation */
  CollaborationDeclined = 'COLLABORATION_DECLINED',
  /** Invitation to collaborate on a shopping list */
  CollaborationInvite = 'COLLABORATION_INVITE',
  /** A collaborator's granular permissions were updated on a shopping list */
  CollaboratorPermissionsUpdated = 'COLLABORATOR_PERMISSIONS_UPDATED',
  /** A collaborator was removed from a shopping list */
  CollaboratorRemoved = 'COLLABORATOR_REMOVED',
  /** A collaborator's role was changed on a shopping list */
  CollaboratorRoleChanged = 'COLLABORATOR_ROLE_CHANGED',
  /** Alerts that a pantry item is approaching or has passed its expiration date */
  ExpiryReminder = 'EXPIRY_REMINDER',
  /** Invitation to join a household home */
  HomeInvitation = 'HOME_INVITATION',
  /** Confirmation that a user has joined a household */
  HomeJoined = 'HOME_JOINED',
  /** Informs that an item has been removed */
  ItemDeleted = 'ITEM_DELETED',
  /** Informs that an existing item has been modified */
  ItemUpdated = 'ITEM_UPDATED',
  /** Notifies that a shared shopping list has been updated */
  ListUpdated = 'LIST_UPDATED',
  /** Warns that a pantry item quantity has fallen below the configured threshold */
  LowStock = 'LOW_STOCK',
  /** Invitation to join a household as a member */
  MembershipInvite = 'MEMBERSHIP_INVITE',
  /** Informs that a new item has been added to the pantry or shopping list */
  NewItemAdded = 'NEW_ITEM_ADDED',
  /** Records that a recipe has been cooked or prepared */
  RecipeCooked = 'RECIPE_COOKED',
  /** Confirms that a recipe has been saved to the user's collection */
  RecipeSaved = 'RECIPE_SAVED'
}

export type NotificationTypeCount = {
  __typename: 'NotificationTypeCount';
  count: Scalars['Int']['output'];
  type: NotificationType;
  unreadCount: Scalars['Int']['output'];
};

export enum NutritionCategory {
  Macronutrient = 'MACRONUTRIENT',
  Mineral = 'MINERAL',
  Other = 'OTHER',
  Vitamin = 'VITAMIN'
}

export type NutritionFactInput = {
  category?: InputMaybe<NutritionCategory>;
  dailyValue?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  unit?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['Float']['input'];
};

/** Progress toward nutrition goals from dietary profile */
export type NutritionGoalProgress = {
  __typename: 'NutritionGoalProgress';
  caloriesProgress: Maybe<GoalProgress>;
  carbsProgress: Maybe<GoalProgress>;
  fatProgress: Maybe<GoalProgress>;
  /**
   * Overall score (0-100) based on how close to targets.
   * 100 = all targets met perfectly.
   */
  overallScore: Scalars['Float']['output'];
  proteinProgress: Maybe<GoalProgress>;
};

/** Reusable sub-input for nutrition info */
export type NutritionInfoInput = {
  caloriesPerServing?: InputMaybe<Scalars['Float']['input']>;
  nutritionData?: InputMaybe<Scalars['JSON']['input']>;
};

/** Source of nutrition data for a meal plan item */
export enum NutritionSource {
  Auto = 'AUTO',
  Manual = 'MANUAL',
  Partial = 'PARTIAL'
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
  __typename: 'OfferSummary';
  discount: Scalars['Float']['output'];
  id: Scalars['String']['output'];
  title: Scalars['String']['output'];
  type: Scalars['String']['output'];
};

/** Input for opening a specific batch */
export type OpenBatchInput = {
  batchId: Scalars['ID']['input'];
};

export type OperatingSystemStat = {
  __typename: 'OperatingSystemStat';
  count: Scalars['Int']['output'];
  osName: Scalars['String']['output'];
};

export type PackageBreakdown = {
  __typename: 'PackageBreakdown';
  contentUnit: Unit;
  count: Scalars['Float']['output'];
  perUnitNetWeight: Maybe<Scalars['Float']['output']>;
  perUnitNetWeightUnit: Maybe<Unit>;
  totalNetWeight: Maybe<Scalars['Float']['output']>;
};

export type PackageInfoInput = {
  baseDimension?: InputMaybe<BaseDimension>;
  defaultConsumeIncrement?: InputMaybe<Scalars['Float']['input']>;
  defaultConsumeUnitId?: InputMaybe<Scalars['ID']['input']>;
  displayUnitId?: InputMaybe<Scalars['ID']['input']>;
  displayUnitName?: InputMaybe<Scalars['String']['input']>;
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  servingSize?: InputMaybe<Scalars['Float']['input']>;
  servingSizeUnit?: InputMaybe<Scalars['String']['input']>;
  servingsPerPackage?: InputMaybe<Scalars['Int']['input']>;
};

export type PageInfo = {
  __typename: 'PageInfo';
  endCursor: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor: Maybe<Scalars['String']['output']>;
};

/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type Pantry = {
  __typename: 'Pantry';
  createdAt: Scalars['DateTime']['output'];
  description: Maybe<Scalars['String']['output']>;
  home: Home;
  homeId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  /** Paginated list of items in this pantry */
  itemsConnection: PantryItemConnection;
  ledgerAnalytics: LedgerAnalytics;
  location: Maybe<Scalars['String']['output']>;
  metadata: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  recentlyDeletedItems: Array<PantryItem>;
  stats: PantryStats;
  storageLocationsConnection: StorageLocationConnection;
  suggestions: Array<PantryItemSuggestion>;
  tags: Array<Scalars['String']['output']>;
  temperature: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  usageAnalytics: UsageAnalytics;
  /**
   * Usage statistics for this pantry.
   * Available for all users but primarily used by admin views.
   */
  usageStats: Maybe<PantryUsageStats>;
  version: Scalars['Int']['output'];
  wasteAnalytics: WasteAnalytics;
};


/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type PantryItemsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<PantryItemFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PantryItemOrderBy>;
};


/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type PantryLedgerAnalyticsArgs = {
  filter?: InputMaybe<AnalyticsFilters>;
  granularity?: InputMaybe<PeriodGranularity>;
  itemId?: InputMaybe<Scalars['String']['input']>;
};


/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type PantryRecentlyDeletedItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
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


/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type PantrySuggestionsArgs = {
  expirationDays?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  sources?: InputMaybe<Array<PantrySuggestionSource>>;
};


/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type PantryUsageAnalyticsArgs = {
  filter?: InputMaybe<AnalyticsFilters>;
};


/**
 * Pantry/storage location for a home
 * Cache: 5 minutes - updated when items added/removed
 */
export type PantryWasteAnalyticsArgs = {
  filter?: InputMaybe<AnalyticsFilters>;
};

export type PantryActivity = {
  __typename: 'PantryActivity';
  action: PantryActivityType;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  itemName: Maybe<Scalars['String']['output']>;
  metadata: Maybe<Scalars['JSON']['output']>;
  newValue: Maybe<Scalars['String']['output']>;
  oldValue: Maybe<Scalars['String']['output']>;
  pantry: Pantry;
  pantryId: Scalars['ID']['output'];
  quantity: Maybe<Scalars['Float']['output']>;
  user: User;
  userId: Scalars['ID']['output'];
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
  QuantityUpdated = 'QUANTITY_UPDATED'
}

export type PantryAlertEvent = {
  __typename: 'PantryAlertEvent';
  alertType: PantryAlertType;
  /** Populated for EXPIRING_ITEMS alerts */
  items: Maybe<Array<PantryItem>>;
  message: Maybe<Scalars['String']['output']>;
  pantryId: Scalars['ID']['output'];
  /** Populated for LOW_STOCK and WASTE alerts */
  pantryItem: Maybe<PantryItem>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export enum PantryAlertType {
  ExpiringItems = 'EXPIRING_ITEMS',
  LowStock = 'LOW_STOCK',
  Waste = 'WASTE'
}

export type PantryChangeEvent = {
  __typename: 'PantryChangeEvent';
  changeType: PantryChangeType;
  mutation: Maybe<MutationType>;
  /** Populated for UPDATED events */
  pantry: Maybe<Pantry>;
  pantryId: Scalars['ID']['output'];
  /** Populated for ITEMS_CHANGED events */
  pantryItem: Maybe<PantryItem>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Maybe<Array<Scalars['String']['output']>>;
  /** Populated for USAGE_CHANGED events */
  usage: Maybe<PantryItemUsage>;
  userId: Scalars['ID']['output'];
};

export enum PantryChangeType {
  ItemsChanged = 'ITEMS_CHANGED',
  Updated = 'UPDATED',
  UsageChanged = 'USAGE_CHANGED'
}

export type PantryConnection = Connection & {
  __typename: 'PantryConnection';
  edges: Array<PantryEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Deficit calculation for recipe ingredients */
export type PantryDeficit = {
  __typename: 'PantryDeficit';
  available: Scalars['Float']['output'];
  availableItems: Array<PantryItem>;
  deficit: Scalars['Float']['output'];
  ingredient: RecipeIngredient;
  needed: Scalars['Float']['output'];
  needsToBuy: Scalars['Boolean']['output'];
  unit: Unit;
};

/** Pantry connection for pagination */
export type PantryEdge = Edge & {
  __typename: 'PantryEdge';
  cursor: Scalars['String']['output'];
  node: Pantry;
};

export type PantryExpiringItemsAlertPayload = {
  __typename: 'PantryExpiringItemsAlertPayload';
  daysUntilExpiration: Scalars['Int']['output'];
  expiresAt: Scalars['DateTime']['output'];
  item: PantryItem;
  pantryId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

/**
 * Filters for querying pantries.
 * userId and homeId filters have different behavior for admins vs regular users.
 */
export type PantryFilters = {
  /** Filter by home ID - optional for admins, required for regular users */
  homeId?: InputMaybe<Scalars['ID']['input']>;
  /** Filter by default status */
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  /** Search by name, description, or location */
  search?: InputMaybe<Scalars['String']['input']>;
  /** Admin-only: Filter by specific user ID (via home membership) */
  userId?: InputMaybe<Scalars['ID']['input']>;
};

/** Real-time collaborative type - never cache */
export type PantryItem = {
  __typename: 'PantryItem';
  acquisitionMethod: AcquisitionMethod;
  activeBatchCount: Scalars['Int']['output'];
  addedAt: Scalars['DateTime']['output'];
  addedBy: Maybe<User>;
  batches: Array<PantryItemBatch>;
  brand: Maybe<Brand>;
  brandId: Maybe<Scalars['ID']['output']>;
  changeHistory: PantryItemChangeConnection;
  condition: ItemCondition;
  costPerUnit: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  earliestBatchExpiration: Maybe<Scalars['DateTime']['output']>;
  expirationAlert: Scalars['Boolean']['output'];
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  isComposted: Scalars['Boolean']['output'];
  isLowStock: Scalars['Boolean']['output'];
  isRecycled: Scalars['Boolean']['output'];
  item: Item;
  itemId: Scalars['ID']['output'];
  itemName: Scalars['String']['output'];
  itemUpc: Maybe<Scalars['String']['output']>;
  lastModifiedBy: Maybe<User>;
  lastUsedAt: Maybe<Scalars['DateTime']['output']>;
  ledger: LedgerSummary;
  lowStockAlert: Scalars['Boolean']['output'];
  minQuantity: Maybe<Scalars['Float']['output']>;
  netWeight: Maybe<Scalars['Float']['output']>;
  netWeightUnit: Maybe<Unit>;
  packageBreakdown: Maybe<PackageBreakdown>;
  pantry: Pantry;
  pantryId: Scalars['ID']['output'];
  photos: Array<PantryItemPhoto>;
  purchase: Maybe<Purchase>;
  purchaseId: Maybe<Scalars['ID']['output']>;
  quantity: Scalars['Float']['output'];
  quantityBreakdown: Maybe<QuantityBreakdown>;
  remainingNetWeight: Maybe<Scalars['Float']['output']>;
  restockQuantity: Maybe<Scalars['Float']['output']>;
  sourceShoppingListItemId: Maybe<Scalars['ID']['output']>;
  storageLocation: Maybe<StorageLocation>;
  storageNotes: Maybe<Scalars['String']['output']>;
  storageState: StorageState;
  store: Maybe<Store>;
  storeId: Maybe<Scalars['ID']['output']>;
  tags: Array<Scalars['String']['output']>;
  totalCost: Maybe<Scalars['Float']['output']>;
  unit: Maybe<Unit>;
  unitId: Maybe<Scalars['ID']['output']>;
  updatedAt: Maybe<Scalars['DateTime']['output']>;
  usageRecords: PantryItemUsageConnection;
  version: Scalars['Int']['output'];
  wasteDate: Maybe<Scalars['DateTime']['output']>;
  wasteReason: Maybe<WasteReason>;
};


/** Real-time collaborative type - never cache */
export type PantryItemChangeHistoryArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


/** Real-time collaborative type - never cache */
export type PantryItemLedgerArgs = {
  filter?: InputMaybe<AnalyticsFilters>;
};


/** Real-time collaborative type - never cache */
export type PantryItemUsageRecordsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PantryItemUsageOrderBy>;
};

/**
 * A batch within a pantry item, representing a specific restock event.
 * Each batch tracks its own expiration, cost, and remaining quantity.
 * Consumed FIFO by expiration date.
 */
export type PantryItemBatch = {
  __typename: 'PantryItemBatch';
  addedBy: Maybe<User>;
  batchNumber: Scalars['Int']['output'];
  costPerUnit: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  depletedAt: Maybe<Scalars['DateTime']['output']>;
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  expiresAtIsManual: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isOpened: Scalars['Boolean']['output'];
  notes: Maybe<Scalars['String']['output']>;
  openedAt: Maybe<Scalars['DateTime']['output']>;
  pantryItemId: Scalars['ID']['output'];
  quantity: Scalars['Float']['output'];
  remainingNetWeight: Maybe<Scalars['Float']['output']>;
  status: BatchStatus;
  store: Maybe<Store>;
  totalCost: Maybe<Scalars['Float']['output']>;
  updatedAt: Maybe<Scalars['DateTime']['output']>;
  wasteReason: Maybe<WasteReason>;
};

/** Audit record of a change to a pantry item */
export type PantryItemChange = {
  __typename: 'PantryItemChange';
  changeType: ChangeType;
  changedBy: User;
  changedById: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  deviceId: Maybe<Scalars['String']['output']>;
  field: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  metadata: Maybe<Scalars['JSON']['output']>;
  newValue: Maybe<Scalars['String']['output']>;
  oldValue: Maybe<Scalars['String']['output']>;
  pantryItem: PantryItem;
  pantryItemId: Scalars['ID']['output'];
  source: ChangeSource;
};

/** Connection type for paginated PantryItemChange results */
export type PantryItemChangeConnection = Connection & {
  __typename: 'PantryItemChangeConnection';
  edges: Array<PantryItemChangeEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Edge type for PantryItemChange pagination */
export type PantryItemChangeEdge = Edge & {
  __typename: 'PantryItemChangeEdge';
  cursor: Scalars['String']['output'];
  node: PantryItemChange;
};

export type PantryItemChangedPayload = {
  __typename: 'PantryItemChangedPayload';
  item: PantryItem;
  mutation: MutationType;
  pantryId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

export type PantryItemConnection = Connection & {
  __typename: 'PantryItemConnection';
  edges: Array<PantryItemEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Pantry item connection for pagination */
export type PantryItemEdge = Edge & {
  __typename: 'PantryItemEdge';
  cursor: Scalars['String']['output'];
  node: PantryItem;
};

export type PantryItemFilters = {
  condition?: InputMaybe<ItemCondition>;
  expirationDays?: InputMaybe<Scalars['Int']['input']>;
  expiringSoon?: InputMaybe<Scalars['Boolean']['input']>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  storageLocationId?: InputMaybe<Scalars['ID']['input']>;
  storageState?: InputMaybe<StorageState>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** Order by options for pantry items */
export type PantryItemOrderBy = {
  addedAt?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
  currentQuantity?: InputMaybe<SortOrder>;
  expiresAt?: InputMaybe<SortOrder>;
  itemName?: InputMaybe<SortOrder>;
};

export type PantryItemPayload = MutationPayload & {
  __typename: 'PantryItemPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  pantryItem: Maybe<PantryItem>;
  success: Scalars['Boolean']['output'];
};

export type PantryItemPhoto = {
  __typename: 'PantryItemPhoto';
  id: Scalars['ID']['output'];
  imageUrl: Scalars['String']['output'];
  pantryItem: PantryItem;
  photoType: PhotoType;
  takenAt: Scalars['DateTime']['output'];
  takenBy: User;
};

/**
 * A suggestion for adding or restocking a pantry item.
 * Combines multiple sources: low stock, expiring soon, recently deleted, frequently added, and popular items.
 */
export type PantryItemSuggestion = {
  __typename: 'PantryItemSuggestion';
  /** Primary category name */
  category: Maybe<Scalars['String']['output']>;
  /** Current quantity in pantry (for LOW_STOCK source) */
  currentQuantity: Maybe<Scalars['Float']['output']>;
  /** Days until expiration (for EXPIRING_SOON source) */
  daysUntilExpiry: Maybe<Scalars['Int']['output']>;
  /** Default unit object for one-tap add */
  defaultUnit: Maybe<SuggestionUnit>;
  /** Default unit ID for one-tap add (last used or item default) */
  defaultUnitId: Maybe<Scalars['ID']['output']>;
  /** Expiration date (for EXPIRING_SOON source) */
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  /** Frequency count - times user added this item to pantries (for FREQUENTLY_ADDED source) */
  frequencyCount: Maybe<Scalars['Int']['output']>;
  /** Unique suggestion ID (itemId or pantryItemId depending on source) */
  id: Scalars['ID']['output'];
  /** Primary image URL */
  imageUrl: Maybe<Scalars['String']['output']>;
  /** Full item reference */
  item: SuggestionItem;
  /** The catalog Item ID - always present */
  itemId: Scalars['ID']['output'];
  /** Last quantity used (for RECENTLY_DELETED source) */
  lastQuantity: Maybe<Scalars['Float']['output']>;
  /** Last unit ID used (for RECENTLY_DELETED source) */
  lastUnitId: Maybe<Scalars['ID']['output']>;
  /** Minimum quantity threshold (for LOW_STOCK source) */
  minQuantity: Maybe<Scalars['Float']['output']>;
  /** Item name for display */
  name: Scalars['String']['output'];
  /** Pantry item ID - present for LOW_STOCK, EXPIRING_SOON, and RECENTLY_DELETED sources */
  pantryItemId: Maybe<Scalars['ID']['output']>;
  /** Popularity ranking position (for POPULAR source) */
  popularityRank: Maybe<Scalars['Int']['output']>;
  /** Suggested restock quantity (for LOW_STOCK source) */
  restockQuantity: Maybe<Scalars['Float']['output']>;
  /** Source of this suggestion */
  source: PantrySuggestionSource;
};

export type PantryItemUsage = {
  __typename: 'PantryItemUsage';
  adjustmentReason: Maybe<Scalars['String']['output']>;
  cookingLog: Maybe<CookingLog>;
  cookingLogId: Maybe<Scalars['ID']['output']>;
  costPerUnit: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  isComposted: Maybe<Scalars['Boolean']['output']>;
  isRecycled: Maybe<Scalars['Boolean']['output']>;
  itemId: Maybe<Scalars['ID']['output']>;
  itemName: Maybe<Scalars['String']['output']>;
  mealPlanItem: Maybe<MealPlanItem>;
  mealPlanItemId: Maybe<Scalars['ID']['output']>;
  notes: Maybe<Scalars['String']['output']>;
  pantry: Maybe<Pantry>;
  pantryId: Maybe<Scalars['ID']['output']>;
  pantryItem: Maybe<PantryItem>;
  pantryItemId: Maybe<Scalars['ID']['output']>;
  purpose: UsagePurpose;
  quantityUsed: Scalars['Float']['output'];
  recipe: Maybe<Recipe>;
  recipeId: Maybe<Scalars['ID']['output']>;
  store: Maybe<Store>;
  storeId: Maybe<Scalars['ID']['output']>;
  totalCost: Maybe<Scalars['Float']['output']>;
  unitName: Maybe<Scalars['String']['output']>;
  usageSource: UsageSource;
  usageUnit: Maybe<Unit>;
  usageUnitId: Maybe<Scalars['ID']['output']>;
  usedAt: Scalars['DateTime']['output'];
  usedBy: Maybe<User>;
  wasteReason: Maybe<WasteReason>;
};

export type PantryItemUsageChangedPayload = {
  __typename: 'PantryItemUsageChangedPayload';
  mutation: MutationType;
  pantryId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  usage: PantryItemUsage;
  userId: Scalars['ID']['output'];
};

export type PantryItemUsageConnection = Connection & {
  __typename: 'PantryItemUsageConnection';
  edges: Array<PantryItemUsageEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Pantry item usage connection for pagination */
export type PantryItemUsageEdge = Edge & {
  __typename: 'PantryItemUsageEdge';
  cursor: Scalars['String']['output'];
  node: PantryItemUsage;
};

export type PantryItemUsageOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  usedAt?: InputMaybe<SortOrder>;
};

export type PantryItemUsagePayload = MutationPayload & {
  __typename: 'PantryItemUsagePayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  pantryItemUsage: Maybe<PantryItemUsage>;
  success: Scalars['Boolean']['output'];
  /** Eligible unit symbols when code is INVALID_UNIT. Null for other error codes and successes. */
  validUnits: Maybe<Array<Scalars['String']['output']>>;
};

export type PantryLowStockAlertPayload = {
  __typename: 'PantryLowStockAlertPayload';
  currentQuantity: Scalars['Float']['output'];
  item: PantryItem;
  minimumQuantity: Scalars['Float']['output'];
  pantryId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

/** Order by options for pantries */
export type PantryOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
};

export type PantryPayload = MutationPayload & {
  __typename: 'PantryPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  pantry: Maybe<Pantry>;
  success: Scalars['Boolean']['output'];
};

export type PantryStats = {
  __typename: 'PantryStats';
  activeItems: Scalars['Int']['output'];
  expiringCount: Scalars['Int']['output'];
  lowStockCount: Scalars['Int']['output'];
  storageLocationCounts: Array<StorageLocationCount>;
  storageStateCounts: Maybe<StorageStateCounts>;
  totalItems: Scalars['Int']['output'];
  totalValue: Scalars['Float']['output'];
};

/** Source of a pantry item suggestion */
export enum PantrySuggestionSource {
  /** Item is expiring soon - use it or replace */
  ExpiringSoon = 'EXPIRING_SOON',
  /** User frequently adds this item to pantries */
  FrequentlyAdded = 'FREQUENTLY_ADDED',
  /** Item is below minimum stock threshold - needs restocking */
  LowStock = 'LOW_STOCK',
  /** Globally popular pantry item */
  Popular = 'POPULAR',
  /** Item was recently removed from this pantry */
  RecentlyDeleted = 'RECENTLY_DELETED'
}

export type PantryUpdatedPayload = {
  __typename: 'PantryUpdatedPayload';
  mutation: MutationType;
  node: Pantry;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

/**
 * Usage statistics for a Pantry.
 * Included when admin requests resources with stats.
 */
export type PantryUsageStats = {
  __typename: 'PantryUsageStats';
  /** Total estimated value of items */
  estimatedValue: Maybe<Scalars['Float']['output']>;
  /** Number of items expiring within 7 days */
  expiringItemCount: Scalars['Int']['output'];
  /** Total number of items */
  itemCount: Scalars['Int']['output'];
  /** Last activity timestamp */
  lastActivityAt: Maybe<Scalars['DateTime']['output']>;
  /** Number of low stock items */
  lowStockItemCount: Scalars['Int']['output'];
};

export type PantryWasteAlertPayload = {
  __typename: 'PantryWasteAlertPayload';
  item: PantryItem;
  pantryId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
  wasteAmount: Scalars['Float']['output'];
  wasteReason: Scalars['String']['output'];
  wasteValue: Maybe<Scalars['Float']['output']>;
};

export type ParentCategorySuggestion = {
  __typename: 'ParentCategorySuggestion';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  slug: Maybe<Scalars['String']['output']>;
  type: CategoryType;
};

/** Period granularity for ledger analytics */
export enum PeriodGranularity {
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY'
}

export enum PhotoType {
  Condition = 'CONDITION',
  Expiration = 'EXPIRATION',
  General = 'GENERAL',
  Storage = 'STORAGE',
  Waste = 'WASTE'
}

export type PlatformStat = {
  __typename: 'PlatformStat';
  count: Scalars['Int']['output'];
  platform: MobilePlatform;
};

/** Sub-input for power/battery status */
export type PowerStatusInput = {
  batteryLevel?: InputMaybe<Scalars['Float']['input']>;
  isBatteryCharging?: InputMaybe<Scalars['Boolean']['input']>;
  powerState?: InputMaybe<Scalars['JSON']['input']>;
};

export type PresignPayload = {
  __typename: 'PresignPayload';
  key: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

/** Price estimate information for a shopping list item */
export type PriceEstimate = {
  __typename: 'PriceEstimate';
  /** Average price from purchase history */
  average: Maybe<Scalars['Float']['output']>;
  /** User-provided budget limit */
  budget: Maybe<Scalars['Float']['output']>;
  /** User-provided estimated price */
  estimated: Maybe<Scalars['Float']['output']>;
  /** Highest price seen */
  highest: Maybe<Scalars['Float']['output']>;
  /** Last known actual price from purchase history */
  lastKnown: Maybe<Scalars['Float']['output']>;
  /** When price data was last updated */
  lastUpdated: Maybe<Scalars['DateTime']['output']>;
  /** Lowest price seen */
  lowest: Maybe<Scalars['Float']['output']>;
};

export type PriceRangeFacet = {
  __typename: 'PriceRangeFacet';
  count: Scalars['Int']['output'];
  label: Scalars['String']['output'];
  max: Scalars['Float']['output'];
  min: Scalars['Float']['output'];
  selected: Maybe<Scalars['Boolean']['output']>;
};

/** Price range filter bounds */
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
  WebScraping = 'WEB_SCRAPING'
}

/** Sub-input for pricing estimates */
export type PricingEstimatesInput = {
  budgetPrice?: InputMaybe<Scalars['Float']['input']>;
  estimatedPrice?: InputMaybe<Scalars['Float']['input']>;
};

/** Indicates the priority level for shopping list items, notifications, or tasks */
export enum Priority {
  /** Important and should be addressed soon */
  High = 'HIGH',
  /** Not time-sensitive and can be addressed at convenience */
  Low = 'LOW',
  /** Standard priority with no special urgency */
  Normal = 'NORMAL',
  /** Critical and requires immediate attention */
  Urgent = 'URGENT'
}

/** Sub-input for privacy settings */
export type PrivacySettingsInput = {
  personalizedAds?: InputMaybe<Scalars['Boolean']['input']>;
  shareUsageData?: InputMaybe<Scalars['Boolean']['input']>;
  shareWithPartners?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ProductDetailsInput = {
  alternateUpcs?: InputMaybe<Array<Scalars['String']['input']>>;
  primaryUpc?: InputMaybe<Scalars['String']['input']>;
  shelfLifeDays?: InputMaybe<Scalars['Int']['input']>;
  shelfLifeOpenedDays?: InputMaybe<Scalars['Int']['input']>;
  vendor?: InputMaybe<Scalars['String']['input']>;
};

/**
 * Product variation data from ExternalSourceMapping
 * Represents a specific UPC/package variation of an Item
 */
export type ProductVariation = {
  __typename: 'ProductVariation';
  brandInfo: Maybe<VariationBrandInfo>;
  confidence: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  externalType: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  images: Maybe<Array<VariationImage>>;
  netWeight: Maybe<Scalars['Float']['output']>;
  netWeightUnit: Maybe<Scalars['String']['output']>;
  packageSize: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  upc: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export enum ProfileVisibility {
  Friends = 'FRIENDS',
  Private = 'PRIVATE',
  Public = 'PUBLIC'
}

export enum ProviderType {
  Amazon = 'AMAZON',
  GiantEagle = 'GIANT_EAGLE',
  Kroger = 'KROGER',
  OpenFoodFacts = 'OPEN_FOOD_FACTS',
  Usda = 'USDA',
  Walmart = 'WALMART'
}

/** Purchase record - contains financial and shopping data */
export type Purchase = {
  __typename: 'Purchase';
  createdAt: Scalars['DateTime']['output'];
  currency: Currency;
  currencyId: Scalars['ID']['output'];
  currencySymbol: Scalars['String']['output'];
  discountAmount: Maybe<Scalars['Float']['output']>;
  expirationDate: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  item: Item;
  itemId: Scalars['ID']['output'];
  itemName: Scalars['String']['output'];
  itemUpc: Maybe<Scalars['String']['output']>;
  originalPrice: Maybe<Scalars['Float']['output']>;
  pantryItems: Array<PantryItem>;
  purchaseDate: Scalars['DateTime']['output'];
  quantity: Scalars['Float']['output'];
  receiptNumber: Maybe<Scalars['String']['output']>;
  shoppingList: Maybe<ShoppingList>;
  shoppingListId: Maybe<Scalars['ID']['output']>;
  shoppingListItem: Maybe<ShoppingListItem>;
  shoppingListItemId: Maybe<Scalars['ID']['output']>;
  store: Maybe<Store>;
  storeId: Maybe<Scalars['ID']['output']>;
  storeName: Maybe<Scalars['String']['output']>;
  totalPrice: Scalars['Float']['output'];
  transactionId: Maybe<Scalars['String']['output']>;
  unit: Unit;
  unitId: Scalars['ID']['output'];
  unitPrice: Scalars['Float']['output'];
  unitSymbol: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['ID']['output'];
  version: Scalars['Int']['output'];
};

export type PurchaseConnection = Connection & {
  __typename: 'PurchaseConnection';
  edges: Array<PurchaseEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Purchase connection for pagination */
export type PurchaseEdge = Edge & {
  __typename: 'PurchaseEdge';
  cursor: Scalars['String']['output'];
  node: Purchase;
};

/** Filter for querying purchases - consolidates multiple query patterns. */
export type PurchaseFilters = {
  /** Start of the date range filter. */
  fromDate?: InputMaybe<Scalars['DateTime']['input']>;
  /** Filter by item. */
  itemId?: InputMaybe<Scalars['ID']['input']>;
  /** Filter by shopping list. */
  shoppingListId?: InputMaybe<Scalars['ID']['input']>;
  /** Filter by specific shopping list item. */
  shoppingListItemId?: InputMaybe<Scalars['ID']['input']>;
  /** Filter by store. */
  storeId?: InputMaybe<Scalars['ID']['input']>;
  /** End of the date range filter. */
  toDate?: InputMaybe<Scalars['DateTime']['input']>;
};

/** Summary of purchase history for a shopping list item */
export type PurchaseHistorySummary = {
  __typename: 'PurchaseHistorySummary';
  /** Date of most recent purchase */
  lastPurchaseDate: Maybe<Scalars['DateTime']['output']>;
  /** Whether this item has been purchased before */
  previouslyPurchased: Scalars['Boolean']['output'];
  /** Total number of times purchased */
  purchaseCount: Scalars['Int']['output'];
};

/** Reusable sub-input for purchase/acquisition info */
export type PurchaseInfoInput = {
  acquisitionMethod?: InputMaybe<AcquisitionMethod>;
  costPerUnit?: InputMaybe<Scalars['Float']['input']>;
  purchaseId?: InputMaybe<Scalars['ID']['input']>;
  storeId?: InputMaybe<Scalars['ID']['input']>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
};

/** Order by options for purchases */
export type PurchaseOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  purchaseDate?: InputMaybe<SortOrder>;
  totalPrice?: InputMaybe<SortOrder>;
};

export type PurchasePayload = MutationPayload & {
  __typename: 'PurchasePayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  purchase: Maybe<Purchase>;
  success: Scalars['Boolean']['output'];
};

export type PurchaseStats = {
  __typename: 'PurchaseStats';
  averagePurchaseAmount: Scalars['Float']['output'];
  mostFrequentStore: Maybe<Scalars['String']['output']>;
  recentPurchases: Array<Purchase>;
  totalAmountSpent: Scalars['Float']['output'];
  totalPurchases: Scalars['Int']['output'];
};

/** Sub-input for purchase tracking */
export type PurchaseTrackingInput = {
  isPurchased?: InputMaybe<Scalars['Boolean']['input']>;
  purchasedPrice?: InputMaybe<Scalars['Float']['input']>;
  purchasedQuantity?: InputMaybe<Scalars['Float']['input']>;
};

export type PutUnderReviewInput = {
  reason?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type QuantityBreakdown = {
  __typename: 'QuantityBreakdown';
  /** The content unit (e.g., can) */
  contentUnit: Maybe<Unit>;
  /** Number of full unopened packages (e.g., 1 full case) */
  fullPackages: Scalars['Int']['output'];
  /** Loose content units from opened packages (e.g., 9 cans) */
  looseContentUnits: Scalars['Float']['output'];
  /** Total remaining weight/volume */
  remainingWeight: Maybe<Scalars['Float']['output']>;
  /** Unit of the remaining weight */
  remainingWeightUnit: Maybe<Unit>;
  /** Total expressed as content units (e.g., 21 cans) */
  totalContentUnits: Scalars['Float']['output'];
};

/**
 * Quantity displayed in multiple formats
 * Useful for showing both fraction and decimal representations
 */
export type QuantityDisplay = {
  __typename: 'QuantityDisplay';
  decimal: Scalars['Float']['output'];
  display: Scalars['String']['output'];
  fraction: Maybe<Scalars['String']['output']>;
  mixed: Maybe<Scalars['String']['output']>;
  unit: Maybe<Unit>;
};

/** Sub-input for quantity display preferences */
export type QuantityDisplayInput = {
  alwaysShowFractions?: InputMaybe<Scalars['Boolean']['input']>;
  maxDecimalPlaces?: InputMaybe<Scalars['Int']['input']>;
  preferredFractionSet?: InputMaybe<Scalars['JSON']['input']>;
  quantityDisplayPreference?: InputMaybe<QuantityDisplayPreference>;
};

/** User preference for quantity display */
export enum QuantityDisplayPreference {
  Auto = 'AUTO',
  Decimal = 'DECIMAL',
  Fraction = 'FRACTION',
  Mixed = 'MIXED'
}

/** Input for quantity aggregation */
export type QuantityInput = {
  quantity: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
};

export type Query = {
  __typename: 'Query';
  activeModerations: UserModerationConnection;
  /** Check whether a specific user's account can be safely deleted (admin only). */
  adminCanDeleteUser: CanDeleteAccountResult;
  /** Get summary statistics for item unit conversions (admin) */
  adminConversionStats: ConversionStats;
  /**
   * Get the status of a background image deletion job.
   *
   * Use this to track progress of large batch deletions that were queued
   * instead of processed synchronously.
   */
  adminGetImageDeletionJobStatus: Maybe<ImageDeletionJobStatus>;
  /**
   * Admin: List all homes with optional filters.
   * Returns homes across all users. Use filters.userId to scope to a specific user.
   */
  adminHomes: HomeConnection;
  /**
   * List item unit conversions with optional filters (admin)
   * Supports filtering by item, source, verification status, and units.
   * By default only returns cross-type conversions (e.g., VOLUME→WEIGHT).
   * Same-type conversions are calculated from standard unit factors.
   */
  adminItemUnitConversions: AdminItemUnitConversionsResult;
  /**
   * Admin: List all login histories with comprehensive filtering.
   * Supports filtering by userId, ipAddress, date range, device, success/failure, and search.
   */
  adminLoginHistories: LoginHistoryConnection;
  /**
   * Admin: List all meal plans with optional filters.
   * Returns meal plans across all users.
   */
  adminMealPlans: MealPlanConnection;
  /**
   * Admin: List all meal templates with optional filters.
   * Returns meal templates across all users.
   */
  adminMealTemplates: MealTemplateConnection;
  /**
   * Admin: List all pantries with optional filters.
   * Returns pantries across all homes. homeId is optional.
   */
  adminPantries: PantryConnection;
  /**
   * Admin: List all recipes with optional filters.
   * Returns recipes across all users.
   */
  adminRecipes: RecipeConnection;
  /**
   * Admin: List all shopping lists with optional filters.
   * Returns lists across all users. Use filters.userId to scope to a specific user.
   */
  adminShoppingLists: ShoppingListConnection;
  /**
   * Aggregate multiple quantities of the same item
   * Useful for calculating total needed across multiple recipes
   */
  aggregateQuantities: AggregationResult;
  /** Autocomplete category names for faster item categorization. */
  autocompleteCategories: AutocompleteCategoryResponse;
  /** Autocomplete item names for quick search suggestions. */
  autocompleteItems: AutocompleteResponse;
  /**
   * Get best display unit for a quantity
   * Auto-converts to more readable units (1000mL → 1L)
   */
  bestDisplayUnit: Unit;
  /** Fetch a single brand by its ID. */
  brand: Maybe<Brand>;
  /**
   * Get brands with filtering and cursor-based pagination.
   * Replaces: rootBrands (use filters: { isRoot: true }),
   * popularBrands (use orderBy: POPULARITY_DESC, first: N)
   */
  brands: BrandConnection;
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
  /** Check whether the current user's account can be safely deleted. */
  canDeleteAccount: CanDeleteAccountResult;
  /**
   * Get categories with filtering and cursor-based pagination.
   * Replaces: rootCategories (use parentId: null),
   * popularCategories (use categories with appropriate sorting)
   */
  categories: CategoryConnection;
  /** Fetch a single category by its ID. */
  category: Maybe<Category>;
  /** Fetch a single category by its URL slug. */
  categoryBySlug: Maybe<Category>;
  /** Check item availability across specified stores. */
  checkItemAvailability: Array<ItemAvailability>;
  /** Compare prices for an item across multiple stores. */
  compareItemPrices: Array<StorePriceComparison>;
  /** List compatible units for an item with conversion metadata. */
  compatibleUnitsForItem: Array<CompatibleUnit>;
  /**
   * Get ranked consumption-eligible units for a catalog item.
   * Returns units in priority order: default consume unit → curated → auto measurement → tracking unit → portions.
   * Requires an itemId (catalog item) plus the pantry item's tracking unit context.
   */
  consumptionUnitsForItem: Array<RankedUnit>;
  /**
   * Convert quantity between units with item context
   * Supports both same-type (cup→tbsp) and cross-type (cup→gram) conversions
   */
  convertQuantity: Maybe<ConversionResult>;
  /** Convert a value from one unit to another. */
  convertUnit: Maybe<ConvertedUnitValue>;
  /** List all units that a given unit can be converted to. */
  convertibleUnits: Array<Unit>;
  /** Fetch a single cooking log by its ID. */
  cookingLog: Maybe<CookingLog>;
  /** List all currencies, optionally filtered by active status. */
  currencies: Array<Currency>;
  /** Fetch a single currency by its ID. */
  currency: Maybe<Currency>;
  /** Fetch a single currency by its ISO code. */
  currencyByCode: Maybe<Currency>;
  /** Get a single device by ID */
  device: Maybe<Device>;
  /** Get a single device by device identifier string */
  deviceByDeviceId: Maybe<Device>;
  /** Get device count with filters */
  deviceCount: Scalars['Int']['output'];
  /**
   * Consolidated device query with comprehensive filtering.
   * Replaces: userDevices, myDevices, activeDevices, trustedDevices, verifiedDevices,
   * mobileDevices, tabletDevices, emulatedDevices, suspiciousDevices, devicesByPlatform,
   * devicesByManufacturer, devicesWithPeripherals, lowBatteryDevices, staleDevices
   */
  devices: DeviceConnection;
  /** Fetch a single expiration notification by its ID. */
  expirationNotification: Maybe<ExpirationNotification>;
  /** Fetch a single home by its ID. */
  home: Maybe<Home>;
  /** Fetch a single home by its join code. */
  homeByJoinCode: Maybe<Home>;
  /** Fetch a home invite by its token for the acceptance flow. */
  homeInviteByToken: Maybe<HomeInvite>;
  /** Get homes where the current user is a member. */
  homes: HomeConnection;
  /** Fetch invite usage statistics for a specific invite (admin only). */
  inviteStats: InviteStats;
  /** Fetch a single item by its ID. */
  item: Maybe<Item>;
  /**
   * Get all available conversions for an item
   * Returns both stored conversions and calculable standard conversions
   */
  itemConversions: Array<ItemUnitConversion>;
  /**
   * List items with filtering and cursor-based pagination (Relay spec).
   * Use filters for UPC, SKU, or external ID lookups:
   * - items(filters: { upc, upcFormat }) - UPC/barcode lookup
   * - items(filters: { sku, skuStoreId }) - SKU lookup
   * - items(filters: { externalId, externalProvider }) - External ID lookup
   */
  items: ItemConnection;
  /**
   * Get login history for the current user.
   * Supports filtering by date range, device, success/failure, and method.
   */
  loginHistories: LoginHistoryConnection;
  matchRecipeIngredientsToPantry: Array<RecipeIngredientMatch>;
  /** Fetch the currently authenticated user. */
  me: Maybe<User>;
  /** Fetch a single meal plan by its ID. */
  mealPlan: Maybe<MealPlan>;
  /** List meal plans with filtering and cursor-based pagination. */
  mealPlans: MealPlanConnection;
  /** Get a single meal template by ID */
  mealTemplate: Maybe<MealTemplate>;
  /** List meal templates for the current user */
  mealTemplates: MealTemplateConnection;
  /** Fetch a single membership by its ID. */
  membership: Maybe<Membership>;
  /** List memberships for a home with cursor-based pagination. */
  memberships: MembershipConnection;
  myModeration: Maybe<MyModerationStatus>;
  /** Fetch a single notification by its ID. */
  notification: Maybe<Notification>;
  /** Fetch notification statistics with optional filtering. */
  notificationStats: NotificationStats;
  /**
   * Get pantries for a specific home. Requires homeId.
   * Replaces: defaultPantry (use filters: { isDefault: true })
   */
  pantries: PantryConnection;
  /** Fetch a single pantry by its ID. */
  pantry: Maybe<Pantry>;
  /** Fetch a single pantry item by its ID. */
  pantryItem: Maybe<PantryItem>;
  /** Get batches for a pantry item, optionally filtered by status */
  pantryItemBatches: Array<PantryItemBatch>;
  /**
   * Parse fractional input string to decimal
   * Handles "1/4", "1 1/4", "0.25" formats
   */
  parseQuantityInput: QuantityDisplay;
  /** Fetch a single purchase by its ID. */
  purchase: Maybe<Purchase>;
  /** List purchases with filtering and cursor-based pagination. */
  purchases: PurchaseConnection;
  recipe: Maybe<Recipe>;
  /** List cooking logs for a specific recipe with cursor-based pagination. */
  recipeCookingLogs: CookingLogConnection;
  recipeSuggestions: RecipeConnection;
  recipes: RecipeConnection;
  /** Fetch personalized item recommendations for a user. */
  recommendedItems: Array<ItemSuggestion>;
  /**
   * Get ranked restock-eligible units for a pantry item.
   * Returns units in priority order: tracking unit → curated retail → auto measurement.
   */
  restockUnitsForItem: Array<RankedUnit>;
  /** Fetch a single saved recipe by its ID. */
  savedRecipe: Maybe<SavedRecipe>;
  /** List all folder names the user has organized saved recipes into. */
  savedRecipeFolders: Array<Scalars['String']['output']>;
  /** Search items with cursor-based pagination (Relay spec). */
  searchItems: ItemConnection;
  /**
   * Semantic (vector) search over the catalog. The prompt is embedded
   * server-side and compared against Item.embedding via pgvector cosine
   * distance. Intended as an augmentation to exact-match paths (UPC, tsvector)
   * — use when text search fails or OCR is noisy.
   *
   * Items without a cached embedding are excluded until the enrichment
   * pipeline populates them. Auth-gated to bound embedding-service spend.
   */
  searchItemsSemantic: ItemConnection;
  searchRecipes: RecipeConnection;
  /**
   * Search units by name or symbol.
   * Set prioritizeCommon to true for autocomplete behavior (common units first).
   * Default limit: 10
   */
  searchUnits: Array<Unit>;
  /** Fetch a single shopping list by its ID. */
  shoppingList: Maybe<ShoppingList>;
  /** Fetch a shopping list by its share code. */
  shoppingListByShareCode: Maybe<ShoppingList>;
  /** Fetch a single shopping list item by its ID. */
  shoppingListItem: Maybe<ShoppingListItem>;
  /**
   * Get shopping lists accessible to the current user (owned, collaborated, or home-based).
   * Replaces: defaultShoppingList (use filters: { isDefault: true }),
   * searchShoppingLists (use filters: { search: "query" }),
   * shoppingListCollaborators (use ShoppingList.collaboratorsConnection)
   */
  shoppingLists: ShoppingListConnection;
  /**
   * Get a single storage location by ID
   * Requires user to be a member of the home
   */
  storageLocation: Maybe<StorageLocation>;
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
  storageLocations: StorageLocationConnection;
  /** Get a single store by ID */
  store: Maybe<Store>;
  /**
   * List stores with filtering, sorting, and Relay-style pagination.
   * Replaces: stores, searchStores, storeByName, popularStores, nearbyStores, recommendedStores.
   * Use storeWithPriceHistory/storeWithPurchases via Store.priceHistory and Store.purchases field resolvers.
   */
  stores: StoreConnection;
  /**
   * Get suggested display format for a quantity
   * Based on unit rules, user preferences, and quantity value
   */
  suggestDisplayFormat: QuantityDisplay;
  /** List suspicious invite activity within a time window (admin only). */
  suspiciousInviteActivity: InviteLogConnection;
  /** Fetch a single unit by its ID. */
  unit: Maybe<Unit>;
  /** Fetch a single unit by its symbol. */
  unitBySymbol: Maybe<Unit>;
  /**
   * Get all units, optionally filtered by type and/or common flag.
   * Default limit: 50
   */
  units: Array<Unit>;
  /** Fetch a single user by their ID. */
  user: Maybe<User>;
  userModeration: Maybe<UserModeration>;
  /** List users with search and cursor-based pagination (admin only). */
  users: UserConnection;
  /** Validate item data integrity (read-only check) */
  validateItem: ValidationResult;
  /** Validate a UPC barcode string. */
  validateUpc: UpcValidation;
};


export type QueryActiveModerationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAdminCanDeleteUserArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryAdminGetImageDeletionJobStatusArgs = {
  jobId: Scalars['String']['input'];
};


export type QueryAdminHomesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<HomeFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<HomeOrderBy>;
};


export type QueryAdminItemUnitConversionsArgs = {
  crossTypeOnly?: InputMaybe<Scalars['Boolean']['input']>;
  fromUnitId?: InputMaybe<Scalars['ID']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  source?: InputMaybe<ConversionSource>;
  toUnitId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryAdminLoginHistoriesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<LoginHistoryQueryFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<LoginHistoryOrderBy>;
  orderDirection?: InputMaybe<SortOrder>;
};


export type QueryAdminMealPlansArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<MealPlanFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<MealPlanOrderBy>;
};


export type QueryAdminMealTemplatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<MealTemplateFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<MealTemplateOrderBy>;
};


export type QueryAdminPantriesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<PantryFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  homeId?: InputMaybe<Scalars['ID']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PantryOrderBy>;
};


export type QueryAdminRecipesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<RecipeCategory>;
  difficulty?: InputMaybe<Difficulty>;
  first?: InputMaybe<Scalars['Int']['input']>;
  includeDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryAdminShoppingListsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<ShoppingListFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ShoppingListOrderBy>;
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


export type QueryBestDisplayUnitArgs = {
  currentUnitId: Scalars['ID']['input'];
  itemId?: InputMaybe<Scalars['ID']['input']>;
  quantity: Scalars['Float']['input'];
};


export type QueryBrandArgs = {
  id: Scalars['ID']['input'];
};


export type QueryBrandsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<BrandFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<BrandOrderBy>;
};


export type QueryCalculateRecipePantryDeficitArgs = {
  householdId: Scalars['ID']['input'];
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
};


export type QueryCanConvertArgs = {
  fromUnitId: Scalars['ID']['input'];
  itemId?: InputMaybe<Scalars['ID']['input']>;
  pantryItemId?: InputMaybe<Scalars['ID']['input']>;
  toUnitId: Scalars['ID']['input'];
};


export type QueryCategoriesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<CategoryFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CategoryOrderBy>;
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


export type QueryConsumptionUnitsForItemArgs = {
  itemId: Scalars['ID']['input'];
  netWeightUnitId?: InputMaybe<Scalars['ID']['input']>;
  trackingUnitId: Scalars['ID']['input'];
};


export type QueryConvertQuantityArgs = {
  fromUnitId: Scalars['ID']['input'];
  pantryItemId?: InputMaybe<Scalars['ID']['input']>;
  quantity: Scalars['Float']['input'];
  toUnitId: Scalars['ID']['input'];
};


export type QueryConvertUnitArgs = {
  fromUnitId: Scalars['ID']['input'];
  toUnitId: Scalars['ID']['input'];
  value: Scalars['Float']['input'];
};


export type QueryConvertibleUnitsArgs = {
  unitId: Scalars['ID']['input'];
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
  filters?: InputMaybe<DeviceCountFilters>;
};


export type QueryDevicesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<DeviceFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<DeviceSortField>;
  orderDirection?: InputMaybe<SortOrder>;
};


export type QueryExpirationNotificationArgs = {
  id: Scalars['ID']['input'];
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


export type QueryHomesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<HomeFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<HomeOrderBy>;
};


export type QueryInviteStatsArgs = {
  inviteId: Scalars['String']['input'];
};


export type QueryItemArgs = {
  id: Scalars['ID']['input'];
};


export type QueryItemConversionsArgs = {
  includeStandard?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
};


export type QueryItemsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<ItemFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<ItemSortInput>;
};


export type QueryLoginHistoriesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<LoginHistoryQueryFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<LoginHistoryOrderBy>;
  orderDirection?: InputMaybe<SortOrder>;
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
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<MealPlanFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<MealPlanOrderBy>;
};


export type QueryMealTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type QueryMealTemplatesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<MealTemplateFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<MealTemplateOrderBy>;
};


export type QueryMembershipArgs = {
  id: Scalars['ID']['input'];
};


export type QueryMembershipsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  homeId: Scalars['ID']['input'];
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryNotificationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNotificationStatsArgs = {
  filters?: InputMaybe<NotificationFilters>;
};


export type QueryPantriesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<PantryFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  homeId?: InputMaybe<Scalars['ID']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PantryOrderBy>;
};


export type QueryPantryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPantryItemArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPantryItemBatchesArgs = {
  pantryItemId: Scalars['ID']['input'];
  status?: InputMaybe<BatchStatus>;
};


export type QueryParseQuantityInputArgs = {
  input: Scalars['String']['input'];
  unitId: Scalars['ID']['input'];
};


export type QueryPurchaseArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPurchasesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<PurchaseFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PurchaseOrderBy>;
};


export type QueryRecipeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRecipeCookingLogsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CookingLogOrderBy>;
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


export type QueryRestockUnitsForItemArgs = {
  pantryItemId: Scalars['ID']['input'];
};


export type QuerySavedRecipeArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySearchItemsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<ItemFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  sort?: InputMaybe<ItemSortInput>;
};


export type QuerySearchItemsSemanticArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<ItemFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  maxDistance?: InputMaybe<Scalars['Float']['input']>;
  prompt: Scalars['String']['input'];
};


export type QuerySearchRecipesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};


export type QuerySearchUnitsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  prioritizeCommon?: InputMaybe<Scalars['Boolean']['input']>;
  query: Scalars['String']['input'];
  type?: InputMaybe<UnitType>;
};


export type QueryShoppingListArgs = {
  id: Scalars['ID']['input'];
};


export type QueryShoppingListByShareCodeArgs = {
  shareCode: Scalars['String']['input'];
};


export type QueryShoppingListItemArgs = {
  id: Scalars['ID']['input'];
};


export type QueryShoppingListsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<ShoppingListFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ShoppingListOrderBy>;
};


export type QueryStorageLocationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryStorageLocationTreeArgs = {
  homeId: Scalars['ID']['input'];
};


export type QueryStorageLocationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  homeId: Scalars['ID']['input'];
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StorageLocationOrderBy>;
};


export type QueryStoreArgs = {
  id: Scalars['ID']['input'];
};


export type QueryStoresArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<StoreFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StoreOrderBy>;
};


export type QuerySuggestDisplayFormatArgs = {
  quantity: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QuerySuspiciousInviteActivityArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  timeWindowHours?: InputMaybe<Scalars['Int']['input']>;
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


export type QueryUsersArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<UserOrderBy>;
  search?: InputMaybe<Scalars['String']['input']>;
};


export type QueryValidateItemArgs = {
  deep?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
};


export type QueryValidateUpcArgs = {
  upc: Scalars['String']['input'];
};

/** Sub-input for quiet hours config */
export type QuietHoursInput = {
  quietHoursEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  quietHoursEnd?: InputMaybe<Scalars['String']['input']>;
  quietHoursStart?: InputMaybe<Scalars['String']['input']>;
  quietHoursTimezone?: InputMaybe<Scalars['String']['input']>;
};

/** A unit ranked for consumption or restock eligibility, with display hints for the frontend unit picker. */
export type RankedUnit = {
  __typename: 'RankedUnit';
  commonFractions: Maybe<Array<Scalars['Float']['output']>>;
  defaultIncrement: Maybe<Scalars['Float']['output']>;
  isWholeContainer: Scalars['Boolean']['output'];
  rank: Scalars['Int']['output'];
  source: UnitSource;
  unit: Unit;
};

export type RapidAttempt = {
  __typename: 'RapidAttempt';
  count: Scalars['Int']['output'];
  hour: Scalars['String']['output'];
};

/**
 * Recipe type for meal instructions and ingredients
 * Cache: 30 minutes - published recipes are static content
 */
export type Recipe = {
  __typename: 'Recipe';
  averageRating: Maybe<Scalars['Float']['output']>;
  caloriesPerServing: Maybe<Scalars['Float']['output']>;
  category: RecipeCategory;
  cookTimeMinutes: Maybe<Scalars['Int']['output']>;
  cookingLogs: CookingLogConnection;
  createdAt: Scalars['DateTime']['output'];
  createdBy: Maybe<User>;
  cuisine: Maybe<Scalars['String']['output']>;
  description: Maybe<Scalars['String']['output']>;
  diets: Array<Diet>;
  difficulty: Difficulty;
  externalData: Maybe<Scalars['JSON']['output']>;
  externalId: Maybe<Scalars['String']['output']>;
  externalSource: Maybe<ExternalSource>;
  externalUrl: Maybe<Scalars['String']['output']>;
  forkedFrom: Maybe<Recipe>;
  forkedFromId: Maybe<Scalars['ID']['output']>;
  forks: Array<Recipe>;
  healthGoals: Array<HealthGoal>;
  id: Scalars['ID']['output'];
  imageUrl: Maybe<Scalars['String']['output']>;
  ingredients: Array<RecipeIngredient>;
  instructions: Scalars['JSON']['output'];
  intolerances: Array<Intolerance>;
  /** Whether this recipe has been soft-deleted (admin visibility) */
  isDeleted: Scalars['Boolean']['output'];
  isExternal: Scalars['Boolean']['output'];
  isPublished: Scalars['Boolean']['output'];
  isSaved: Scalars['Boolean']['output'];
  matchPercentage: Maybe<Scalars['Float']['output']>;
  mealPlanItems: Array<MealPlanItem>;
  name: Scalars['String']['output'];
  notes: Maybe<Scalars['String']['output']>;
  nutritionData: Maybe<Scalars['JSON']['output']>;
  originalAuthor: Maybe<Scalars['String']['output']>;
  prepTimeMinutes: Maybe<Scalars['Int']['output']>;
  primarySource: Maybe<Scalars['String']['output']>;
  publishedAt: Maybe<Scalars['DateTime']['output']>;
  rating1Count: Scalars['Int']['output'];
  rating2Count: Scalars['Int']['output'];
  rating3Count: Scalars['Int']['output'];
  rating4Count: Scalars['Int']['output'];
  rating5Count: Scalars['Int']['output'];
  reviews: RecipeReviewConnection;
  savedDetails: Maybe<SavedRecipe>;
  servings: Scalars['Int']['output'];
  source: Maybe<Scalars['String']['output']>;
  sourceMapping: Maybe<RecipeSourceMapping>;
  sourceUrl: Maybe<Scalars['String']['output']>;
  status: RecipeStatus;
  tags: Array<Scalars['String']['output']>;
  tips: Maybe<Scalars['String']['output']>;
  totalCookingLogs: Scalars['Int']['output'];
  totalReviews: Scalars['Int']['output'];
  totalSaves: Scalars['Int']['output'];
  totalTimeMinutes: Maybe<Scalars['Int']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
  videoUrl: Maybe<Scalars['String']['output']>;
};


/**
 * Recipe type for meal instructions and ingredients
 * Cache: 30 minutes - published recipes are static content
 */
export type RecipeCookingLogsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CookingLogOrderBy>;
};


/**
 * Recipe type for meal instructions and ingredients
 * Cache: 30 minutes - published recipes are static content
 */
export type RecipeReviewsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RecipeReviewOrderBy>;
};

/** Sub-input for recipe attribution */
export type RecipeAttributionInput = {
  originalAuthor?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  sourceUrl?: InputMaybe<Scalars['String']['input']>;
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
  Snack = 'SNACK'
}

export type RecipeConnection = Connection & {
  __typename: 'RecipeConnection';
  edges: Array<RecipeEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type RecipeConsumptionResult = {
  __typename: 'RecipeConsumptionResult';
  consumedItems: Array<PantryItemUsage>;
  cookingLog: Maybe<CookingLog>;
  failedItems: Array<ConsumptionFailure>;
  success: Scalars['Boolean']['output'];
  totalConsumed: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

/** Sub-input for recipe context */
export type RecipeContextInput = {
  addedContext?: InputMaybe<Scalars['String']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  recipeIngredientId?: InputMaybe<Scalars['ID']['input']>;
};

/** Recipe connection for pagination */
export type RecipeEdge = Edge & {
  __typename: 'RecipeEdge';
  cursor: Scalars['String']['output'];
  node: Recipe;
};

export type RecipeIngredient = {
  __typename: 'RecipeIngredient';
  availablePantryItemIds: Array<Scalars['ID']['output']>;
  externalSources: Array<RecipeIngredientSourceMapping>;
  id: Scalars['ID']['output'];
  image: Maybe<Scalars['String']['output']>;
  isOptional: Scalars['Boolean']['output'];
  item: Maybe<Item>;
  name: Scalars['String']['output'];
  notes: Maybe<Scalars['String']['output']>;
  preparation: Maybe<Scalars['String']['output']>;
  quantity: Scalars['Float']['output'];
  recipe: Recipe;
  section: Maybe<Scalars['String']['output']>;
  sortOrder: Scalars['Int']['output'];
  unit: Maybe<Unit>;
};

export type RecipeIngredientInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  consistency?: InputMaybe<Scalars['String']['input']>;
  externalSources?: InputMaybe<Array<RecipeIngredientSourceInput>>;
  image?: InputMaybe<Scalars['String']['input']>;
  isOptional?: InputMaybe<Scalars['Boolean']['input']>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
  measurements?: InputMaybe<MultiUnitMeasurementInput>;
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
  spoonacular?: InputMaybe<SpoonacularDataInput>;
  spoonacularIngredientId?: InputMaybe<Scalars['Int']['input']>;
  unitId?: InputMaybe<Scalars['ID']['input']>;
  usAmount?: InputMaybe<Scalars['Float']['input']>;
  usUnit?: InputMaybe<Scalars['String']['input']>;
};

export type RecipeIngredientMatch = {
  __typename: 'RecipeIngredientMatch';
  alternativeMatches: Array<PantryItem>;
  availableQuantity: Scalars['Float']['output'];
  ingredient: RecipeIngredient;
  isAvailable: Scalars['Boolean']['output'];
  matchConfidence: Scalars['Float']['output'];
  matchedPantryItem: Maybe<PantryItem>;
  shortfall: Maybe<Scalars['Float']['output']>;
  suggestedQuantity: Scalars['Float']['output'];
  suggestedUnit: Maybe<Unit>;
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
  __typename: 'RecipeIngredientSourceMapping';
  aisle: Maybe<Scalars['String']['output']>;
  consistency: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  data: Maybe<Scalars['JSON']['output']>;
  externalId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  imageUrl: Maybe<Scalars['String']['output']>;
  isPrimary: Scalars['Boolean']['output'];
  lastSyncedAt: Scalars['DateTime']['output'];
  metadata: Maybe<Scalars['JSON']['output']>;
  originalName: Maybe<Scalars['String']['output']>;
  originalString: Maybe<Scalars['String']['output']>;
  recipeIngredient: RecipeIngredient;
  source: ExternalSource;
  updatedAt: Scalars['DateTime']['output'];
};

/** Sub-input for recipe metadata */
export type RecipeMetadataInput = {
  category?: InputMaybe<RecipeCategory>;
  cuisine?: InputMaybe<Scalars['String']['input']>;
  difficulty?: InputMaybe<Difficulty>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

export type RecipePayload = MutationPayload & {
  __typename: 'RecipePayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  recipe: Maybe<Recipe>;
  success: Scalars['Boolean']['output'];
};

export type RecipeReview = {
  __typename: 'RecipeReview';
  comment: Maybe<Scalars['String']['output']>;
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

export type RecipeReviewConnection = Connection & {
  __typename: 'RecipeReviewConnection';
  edges: Array<RecipeReviewEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Recipe review connection for pagination */
export type RecipeReviewEdge = Edge & {
  __typename: 'RecipeReviewEdge';
  cursor: Scalars['String']['output'];
  node: RecipeReview;
};

export type RecipeReviewOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  rating?: InputMaybe<SortOrder>;
};

export type RecipeReviewPayload = MutationPayload & {
  __typename: 'RecipeReviewPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  recipeReview: Maybe<RecipeReview>;
  success: Scalars['Boolean']['output'];
};

export type RecipeSourceMapping = {
  __typename: 'RecipeSourceMapping';
  createdAt: Scalars['DateTime']['output'];
  data: Maybe<Scalars['JSON']['output']>;
  externalId: Scalars['String']['output'];
  externalType: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  lastSyncedAt: Maybe<Scalars['DateTime']['output']>;
  metadata: Maybe<Scalars['JSON']['output']>;
  source: ExternalSource;
  updatedAt: Scalars['DateTime']['output'];
};

export enum RecipeStatus {
  Draft = 'DRAFT',
  Published = 'PUBLISHED'
}

/**
 * Consolidated input for recording a login event.
 * Replaces both LoginAttemptInput (high-level) and CreateLoginHistoryInput (detailed).
 */
export type RecordLoginInput = {
  attribution?: InputMaybe<AttributionInput>;
  automation?: InputMaybe<ApiAutomationInput>;
  behavioral?: InputMaybe<BehavioralSignalsInput>;
  browserOs?: InputMaybe<BrowserOsDetailsInput>;
  deviceId?: InputMaybe<Scalars['ID']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  failureDetails?: InputMaybe<Scalars['String']['input']>;
  failureReason?: InputMaybe<LoginFailureReason>;
  ipAddress?: InputMaybe<Scalars['String']['input']>;
  isMobileApp?: InputMaybe<Scalars['Boolean']['input']>;
  method?: InputMaybe<LoginMethod>;
  network?: InputMaybe<NetworkLocationInput>;
  provider?: InputMaybe<Scalars['String']['input']>;
  referrer?: InputMaybe<Scalars['String']['input']>;
  risk?: InputMaybe<RiskAssessmentInput>;
  session?: InputMaybe<SessionInfoInput>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
  source?: InputMaybe<Scalars['String']['input']>;
  success: Scalars['Boolean']['input'];
  userAgent?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type RecordPantryItemUsageInput = {
  cookingLogId?: InputMaybe<Scalars['ID']['input']>;
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  mealPlanItemId?: InputMaybe<Scalars['ID']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  pantryItemId: Scalars['ID']['input'];
  purpose: UsagePurpose;
  quantityUsed: Scalars['Float']['input'];
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  targetBatchId?: InputMaybe<Scalars['ID']['input']>;
  usageUnitId?: InputMaybe<Scalars['ID']['input']>;
  wasteReason?: InputMaybe<WasteReason>;
};

/** Input for recording pantry item usage */
export type RecordPantryUsageInput = {
  notes?: InputMaybe<Scalars['String']['input']>;
  pantryItemId: Scalars['ID']['input'];
  purpose?: InputMaybe<UsagePurpose>;
  quantity: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
};

/** Input for recording a price observation (historical tracking) */
export type RecordPriceObservationInput = {
  itemId: Scalars['ID']['input'];
  observedAt?: InputMaybe<Scalars['DateTime']['input']>;
  price: Scalars['Float']['input'];
  storeId: Scalars['ID']['input'];
};

export enum RecurringPattern {
  Biweekly = 'BIWEEKLY',
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY'
}

/** Token refresh response - NEVER cache */
export type RefreshTokenPayload = {
  __typename: 'RefreshTokenPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
};

/** Sub-input for regional/locale settings */
export type RegionalSettingsInput = {
  language?: InputMaybe<Scalars['String']['input']>;
  preferredCurrency?: InputMaybe<Scalars['String']['input']>;
  preferredUnitSystem?: InputMaybe<UnitSystem>;
  timezone?: InputMaybe<Scalars['String']['input']>;
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
  __typename: 'RelatedItemsResponse';
  complementaryItems: Array<ItemSuggestion>;
  frequentlyBoughtTogether: Array<ItemSuggestion>;
  similarItems: Array<ItemSuggestion>;
};

export enum ReligiousDiet {
  Halal = 'HALAL',
  Kosher = 'KOSHER'
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

export type ResetPasswordResponse = MutationPayload & {
  __typename: 'ResetPasswordResponse';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

/** Input for restocking a pantry item - adds quantity and creates ledger record */
export type RestockPantryItemInput = {
  costPerUnit?: InputMaybe<Scalars['Float']['input']>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  quantity: Scalars['Float']['input'];
  restockedAt?: InputMaybe<Scalars['DateTime']['input']>;
  storeId?: InputMaybe<Scalars['ID']['input']>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
  unitId?: InputMaybe<Scalars['ID']['input']>;
};

/** Restocking frequency for an item or pantry */
export type RestockingFrequency = {
  __typename: 'RestockingFrequency';
  averageDaysBetweenRestocks: Scalars['Float']['output'];
  itemId: Maybe<Scalars['ID']['output']>;
  itemName: Maybe<Scalars['String']['output']>;
  lastRestockedAt: Maybe<Scalars['DateTime']['output']>;
  periodEnd: Scalars['DateTime']['output'];
  periodStart: Scalars['DateTime']['output'];
  totalRestocks: Scalars['Int']['output'];
};

export enum RestrictionSeverity {
  Allergy = 'ALLERGY',
  Goal = 'GOAL',
  Intolerance = 'INTOLERANCE',
  Preference = 'PREFERENCE'
}

export type ReviewAppealInput = {
  approved: Scalars['Boolean']['input'];
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type ReviewHelpful = {
  __typename: 'ReviewHelpful';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  review: RecipeReview;
  user: User;
};

export type ReviewHelpfulPayload = MutationPayload & {
  __typename: 'ReviewHelpfulPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  reviewHelpful: Maybe<ReviewHelpful>;
  success: Scalars['Boolean']['output'];
};

/** Sub-input for risk assessment data */
export type RiskAssessmentInput = {
  isRisky?: InputMaybe<Scalars['Boolean']['input']>;
  mfaCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  mfaMethod?: InputMaybe<MfaMethod>;
  requiresMfa?: InputMaybe<Scalars['Boolean']['input']>;
  riskFactors?: InputMaybe<Array<RiskFactor>>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
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
  VpnDetected = 'VPN_DETECTED'
}

export type SavedRecipe = {
  __typename: 'SavedRecipe';
  cookedCount: Scalars['Int']['output'];
  createdAt: Scalars['DateTime']['output'];
  folder: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastCookedAt: Maybe<Scalars['DateTime']['output']>;
  notes: Maybe<Scalars['String']['output']>;
  personalRating: Maybe<Scalars['Int']['output']>;
  recipe: Recipe;
  recipeId: Scalars['ID']['output'];
  tags: Array<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['ID']['output'];
};

export type SavedRecipeConnection = Connection & {
  __typename: 'SavedRecipeConnection';
  edges: Array<SavedRecipeEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Saved recipe connection for pagination */
export type SavedRecipeEdge = Edge & {
  __typename: 'SavedRecipeEdge';
  cursor: Scalars['String']['output'];
  node: SavedRecipe;
};

/** Order by options for saved recipes */
export type SavedRecipeOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  savedAt?: InputMaybe<SortOrder>;
};

export type SavedRecipePayload = MutationPayload & {
  __typename: 'SavedRecipePayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  savedRecipe: Maybe<SavedRecipe>;
  success: Scalars['Boolean']['output'];
};

export type SearchFacets = {
  __typename: 'SearchFacets';
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
  first?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  skip?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<ItemSortInput>;
};

/** Sub-input for session info */
export type SessionInfoInput = {
  lastActivityAt?: InputMaybe<Scalars['DateTime']['input']>;
  loggedOutAt?: InputMaybe<Scalars['DateTime']['input']>;
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
};

export type SetDefaultHomePayload = MutationPayload & {
  __typename: 'SetDefaultHomePayload';
  code: Scalars['String']['output'];
  defaultPantry: Maybe<Pantry>;
  message: Scalars['String']['output'];
  settings: Maybe<UserSettings>;
  success: Scalars['Boolean']['output'];
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
  __typename: 'ShoppingList';
  activitiesConnection: ShoppingListActivityConnection;
  autoAddSuggestions: Scalars['Boolean']['output'];
  /**
   * Available pantries for moving items (from linked home).
   * Returns empty array if not linked to a home.
   */
  availablePantries: Array<Pantry>;
  basedOnTemplate: Maybe<ShoppingList>;
  budgetAmount: Maybe<Scalars['Float']['output']>;
  /**
   * Whether items from this list can be moved to pantry.
   * True only if the list is linked to a home.
   */
  canMoveToPantry: Scalars['Boolean']['output'];
  category: Maybe<Scalars['String']['output']>;
  collaboratorsConnection: ShoppingListCollaboratorConnection;
  completedAt: Maybe<Scalars['DateTime']['output']>;
  completedItems: Scalars['Int']['output'];
  completedShopDate: Maybe<Scalars['DateTime']['output']>;
  completionRate: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  currency: Maybe<Scalars['String']['output']>;
  /** Default pantry for the linked home (if any). */
  defaultPantry: Maybe<Pantry>;
  description: Maybe<Scalars['String']['output']>;
  estimatedTotal: Scalars['Float']['output'];
  generatedFromMealPlan: Scalars['Boolean']['output'];
  home: Maybe<Home>;
  homeId: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  isCompleted: Scalars['Boolean']['output'];
  isDefault: Scalars['Boolean']['output'];
  isPublic: Scalars['Boolean']['output'];
  isRecurring: Scalars['Boolean']['output'];
  isTemplate: Scalars['Boolean']['output'];
  itemsConnection: ShoppingListItemConnection;
  lastRecurredAt: Maybe<Scalars['DateTime']['output']>;
  lastReminderSent: Maybe<Scalars['DateTime']['output']>;
  mealPlan: Maybe<MealPlan>;
  metadata: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  nextRecurringDate: Maybe<Scalars['DateTime']['output']>;
  ownerships: Array<ShoppingListOwnership>;
  plannedShopDate: Maybe<Scalars['DateTime']['output']>;
  priceTracking: Scalars['Boolean']['output'];
  priority: Scalars['Int']['output'];
  /** Recently deleted items for quick re-adding suggestions. */
  recentlyDeletedItems: Array<ShoppingListItem>;
  recurringInterval: Maybe<Scalars['Int']['output']>;
  recurringPattern: Maybe<RecurringPattern>;
  remainingItems: Scalars['Int']['output'];
  reminderDate: Maybe<Scalars['DateTime']['output']>;
  reminderEnabled: Scalars['Boolean']['output'];
  shareCode: Maybe<Scalars['String']['output']>;
  shareCount: Scalars['Int']['output'];
  smartSorting: Scalars['Boolean']['output'];
  sortOrder: Scalars['Int']['output'];
  status: ListStatus;
  /** Smart suggestions for adding items to this shopping list. */
  suggestions: Array<ShoppingListSuggestion>;
  tags: Array<Scalars['String']['output']>;
  targetStore: Maybe<Store>;
  targetStoreId: Maybe<Scalars['ID']['output']>;
  templateName: Maybe<Scalars['String']['output']>;
  totalCollaborators: Scalars['Int']['output'];
  totalCost: Scalars['Float']['output'];
  totalItems: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
  /**
   * Usage statistics for this shopping list.
   * Available for all users but primarily used by admin views.
   */
  usageStats: Maybe<ShoppingListUsageStats>;
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
  filters?: InputMaybe<ShoppingListItemFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ShoppingListItemOrderBy>;
};


/**
 * Shopping list for a home
 * Cache: 1 minute - frequently updated by collaborators
 */
export type ShoppingListRecentlyDeletedItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * Shopping list for a home
 * Cache: 1 minute - frequently updated by collaborators
 */
export type ShoppingListSuggestionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  sources?: InputMaybe<Array<SuggestionSource>>;
};

export type ShoppingListActivity = {
  __typename: 'ShoppingListActivity';
  action: ListActivityType;
  createdAt: Scalars['DateTime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  itemName: Maybe<Scalars['String']['output']>;
  metadata: Maybe<Scalars['JSON']['output']>;
  newValue: Maybe<Scalars['String']['output']>;
  oldValue: Maybe<Scalars['String']['output']>;
  shoppingList: ShoppingList;
  shoppingListId: Scalars['ID']['output'];
  source: Maybe<Scalars['String']['output']>;
  user: User;
  userId: Scalars['ID']['output'];
};

export type ShoppingListActivityConnection = Connection & {
  __typename: 'ShoppingListActivityConnection';
  edges: Array<ShoppingListActivityEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Shopping list activity connection for pagination */
export type ShoppingListActivityEdge = Edge & {
  __typename: 'ShoppingListActivityEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingListActivity;
};

/** Order by options for shopping list activities */
export type ShoppingListActivityOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  timestamp?: InputMaybe<SortOrder>;
};

export type ShoppingListChangeEvent = {
  __typename: 'ShoppingListChangeEvent';
  changeType: ShoppingListChangeType;
  clearedCount: Maybe<Scalars['Int']['output']>;
  /** Populated for ITEMS_BATCH_CLEARED events */
  clearedItemIds: Maybe<Array<Scalars['ID']['output']>>;
  /** Populated for ITEMS_CHANGED events */
  item: Maybe<ShoppingListItem>;
  listId: Scalars['ID']['output'];
  mutation: Maybe<MutationType>;
  /** Populated for LIST_UPDATED and STATUS_CHANGED events */
  shoppingList: Maybe<ShoppingList>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['ID']['output'];
};

export enum ShoppingListChangeType {
  ItemsBatchCleared = 'ITEMS_BATCH_CLEARED',
  ItemsChanged = 'ITEMS_CHANGED',
  ListUpdated = 'LIST_UPDATED',
  StatusChanged = 'STATUS_CHANGED'
}

export type ShoppingListCollaborator = {
  __typename: 'ShoppingListCollaborator';
  canAddItems: Scalars['Boolean']['output'];
  canEdit: Scalars['Boolean']['output'];
  canEditItems: Scalars['Boolean']['output'];
  canExport: Scalars['Boolean']['output'];
  canInviteOthers: Scalars['Boolean']['output'];
  canMarkPurchased: Scalars['Boolean']['output'];
  canRemoveItems: Scalars['Boolean']['output'];
  canViewHistory: Scalars['Boolean']['output'];
  collaborator: Maybe<User>;
  collaboratorId: Maybe<Scalars['ID']['output']>;
  email: Maybe<Scalars['String']['output']>;
  expiresAt: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  invitedAt: Scalars['DateTime']['output'];
  invitedBy: Maybe<User>;
  itemsAdded: Scalars['Int']['output'];
  itemsPurchased: Scalars['Int']['output'];
  lastEditedAt: Maybe<Scalars['DateTime']['output']>;
  lastViewedAt: Maybe<Scalars['DateTime']['output']>;
  notifyOnChanges: Scalars['Boolean']['output'];
  notifyOnComplete: Scalars['Boolean']['output'];
  role: CollaboratorRole;
  shoppingList: ShoppingList;
  shoppingListId: Scalars['ID']['output'];
  status: CollaboratorStatus;
  statusChangedAt: Maybe<Scalars['DateTime']['output']>;
  token: Maybe<Scalars['String']['output']>;
};

export type ShoppingListCollaboratorChangedPayload = {
  __typename: 'ShoppingListCollaboratorChangedPayload';
  collaborator: ShoppingListCollaborator;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  originatorClientId: Maybe<Scalars['ID']['output']>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type ShoppingListCollaboratorConnection = Connection & {
  __typename: 'ShoppingListCollaboratorConnection';
  edges: Array<ShoppingListCollaboratorEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Shopping list collaborator connection for pagination */
export type ShoppingListCollaboratorEdge = Edge & {
  __typename: 'ShoppingListCollaboratorEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingListCollaborator;
};

export type ShoppingListCollaboratorPayload = MutationPayload & {
  __typename: 'ShoppingListCollaboratorPayload';
  code: Scalars['String']['output'];
  collaborator: Maybe<ShoppingListCollaborator>;
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type ShoppingListConnection = Connection & {
  __typename: 'ShoppingListConnection';
  edges: Array<ShoppingListEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Shopping list connection for pagination */
export type ShoppingListEdge = Edge & {
  __typename: 'ShoppingListEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingList;
};

export type ShoppingListFilters = {
  homeId?: InputMaybe<Scalars['ID']['input']>;
  isArchived?: InputMaybe<Scalars['Boolean']['input']>;
  isCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  isRecurring?: InputMaybe<Scalars['Boolean']['input']>;
  isTemplate?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ListStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Admin-only: Filter by specific user ID (owner or collaborator) */
  userId?: InputMaybe<Scalars['ID']['input']>;
};

/**
 * Real-time collaborative type - never cache
 * Shopping list item with focused sub-types for better organization
 */
export type ShoppingListItem = {
  __typename: 'ShoppingListItem';
  addedBy: Maybe<User>;
  addedById: Maybe<Scalars['ID']['output']>;
  brand: Maybe<Brand>;
  brandId: Maybe<Scalars['ID']['output']>;
  category: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  displayFormat: DisplayFormat;
  id: Scalars['ID']['output'];
  item: Maybe<Item>;
  itemBarcode: Maybe<Scalars['String']['output']>;
  itemName: Maybe<Scalars['String']['output']>;
  lastEditedBy: Maybe<User>;
  lastEditedById: Maybe<Scalars['ID']['output']>;
  netWeight: Maybe<Scalars['Float']['output']>;
  netWeightUnit: Maybe<Unit>;
  netWeightUnitId: Maybe<Scalars['ID']['output']>;
  normalizedQuantity: Maybe<Scalars['Float']['output']>;
  normalizedUnit: Maybe<Unit>;
  normalizedUnitId: Maybe<Scalars['ID']['output']>;
  notes: Maybe<Scalars['String']['output']>;
  priceEstimate: PriceEstimate;
  priority: Scalars['Int']['output'];
  purchaseHistory: PurchaseHistorySummary;
  purchaseInfo: ShoppingListItemPurchaseInfo;
  purchasesConnection: PurchaseConnection;
  quantity: Maybe<Scalars['Float']['output']>;
  quantityInput: Maybe<Scalars['String']['output']>;
  shoppingList: ShoppingList;
  sortOrder: Scalars['String']['output'];
  source: ShoppingListItemSource;
  storeInfo: ShoppingListItemStoreInfo;
  unit: Maybe<Unit>;
  unitName: Maybe<Scalars['String']['output']>;
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
  __typename: 'ShoppingListItemChangedPayload';
  item: ShoppingListItem;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  originatorClientId: Maybe<Scalars['ID']['output']>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

export type ShoppingListItemConnection = Connection & {
  __typename: 'ShoppingListItemConnection';
  edges: Array<ShoppingListItemEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Shopping list item connection for pagination */
export type ShoppingListItemEdge = Edge & {
  __typename: 'ShoppingListItemEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingListItem;
};

/** Filters for shopping list items pagination */
export type ShoppingListItemFilters = {
  /** Filter by purchase status */
  isPurchased?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Order by options for shopping list items */
export type ShoppingListItemOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  priority?: InputMaybe<SortOrder>;
  sortOrder?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type ShoppingListItemPayload = MutationPayload & {
  __typename: 'ShoppingListItemPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  shoppingListItem: Maybe<ShoppingListItem>;
  success: Scalars['Boolean']['output'];
};

/** Purchase state for a shopping list item */
export type ShoppingListItemPurchaseInfo = {
  __typename: 'ShoppingListItemPurchaseInfo';
  /** Whether the item has been purchased */
  isPurchased: Scalars['Boolean']['output'];
  /** When the item was purchased */
  purchaseDate: Maybe<Scalars['DateTime']['output']>;
  /** Who purchased the item */
  purchasedBy: Maybe<User>;
  /** ID of user who purchased */
  purchasedById: Maybe<Scalars['ID']['output']>;
  /** Actual price paid */
  purchasedPrice: Maybe<Scalars['Float']['output']>;
  /** Actual quantity purchased (may differ from requested) */
  purchasedQuantity: Maybe<Scalars['Float']['output']>;
};

/** Source information for how a shopping list item was added */
export type ShoppingListItemSource = {
  __typename: 'ShoppingListItemSource';
  /** Context about why item was added */
  addedContext: Maybe<Scalars['String']['output']>;
  /** Reason for auto-add (e.g., 'low_stock', 'meal_plan') */
  autoAddReason: Maybe<Scalars['String']['output']>;
  /** Whether item was auto-added (e.g., from low stock) */
  isAutoAdded: Scalars['Boolean']['output'];
  /** Whether item came from meal planning */
  isFromMealPlan: Scalars['Boolean']['output'];
  /** Associated meal plan */
  mealPlan: Maybe<MealPlan>;
  mealPlanId: Maybe<Scalars['ID']['output']>;
  /** Specific meal plan item */
  mealPlanItem: Maybe<MealPlanItem>;
  mealPlanItemId: Maybe<Scalars['ID']['output']>;
  /** Reference to meal plan (legacy) */
  mealPlanReference: Maybe<Scalars['String']['output']>;
  /** Associated recipe */
  recipe: Maybe<Recipe>;
  /** Specific recipe ingredient */
  recipeIngredient: Maybe<RecipeIngredient>;
};

/** Store and location preferences for a shopping list item */
export type ShoppingListItemStoreInfo = {
  __typename: 'ShoppingListItemStoreInfo';
  /** Aisle location in store */
  aisle: Maybe<Scalars['String']['output']>;
  /** Preferred store for this item */
  preferredStore: Maybe<Store>;
  /** Storage location after purchase */
  storageLocation: Maybe<Scalars['String']['output']>;
  /** Section within store */
  storeSection: Maybe<Scalars['String']['output']>;
};

export type ShoppingListItemsBatchClearedPayload = {
  __typename: 'ShoppingListItemsBatchClearedPayload';
  /** Count of items cleared */
  clearedCount: Scalars['Int']['output'];
  /** IDs of items that were cleared */
  clearedItemIds: Array<Scalars['ID']['output']>;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  originatorClientId: Maybe<Scalars['ID']['output']>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

/** Order by options for shopping lists */
export type ShoppingListOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
};

export type ShoppingListOwnership = {
  __typename: 'ShoppingListOwnership';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  shoppingList: ShoppingList;
  shoppingListId: Scalars['ID']['output'];
  transferredAt: Maybe<Scalars['DateTime']['output']>;
  transferredFrom: Maybe<Scalars['String']['output']>;
  user: User;
  userId: Scalars['ID']['output'];
};

export type ShoppingListPayload = MutationPayload & {
  __typename: 'ShoppingListPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  shoppingList: Maybe<ShoppingList>;
  success: Scalars['Boolean']['output'];
};

/** Sub-input for shopping list planning details */
export type ShoppingListPlanningInput = {
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  plannedShopDate?: InputMaybe<Scalars['DateTime']['input']>;
  reminderDate?: InputMaybe<Scalars['DateTime']['input']>;
  reminderEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  targetStoreId?: InputMaybe<Scalars['ID']['input']>;
};

/** Sub-input for shopping list settings */
export type ShoppingListSettingsInput = {
  autoAddSuggestions?: InputMaybe<Scalars['Boolean']['input']>;
  category?: InputMaybe<Scalars['String']['input']>;
  priceTracking?: InputMaybe<Scalars['Boolean']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  smartSorting?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ShoppingListStatusChangedPayload = {
  __typename: 'ShoppingListStatusChangedPayload';
  completedBy: Maybe<User>;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  newStatus: ListStatus;
  originatorClientId: Maybe<Scalars['ID']['output']>;
  previousStatus: Maybe<ListStatus>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

/**
 * A suggestion for adding an item to a shopping list.
 * Combines multiple sources: recently deleted, frequently added, and popular items.
 */
export type ShoppingListSuggestion = {
  __typename: 'ShoppingListSuggestion';
  /** Primary category name */
  category: Maybe<Scalars['String']['output']>;
  /** Default unit object for one-tap add */
  defaultUnit: Maybe<SuggestionUnit>;
  /** Default unit ID for one-tap add (last used or item default) */
  defaultUnitId: Maybe<Scalars['ID']['output']>;
  /** Frequency count - times user added this item (for FREQUENTLY_ADDED source) */
  frequencyCount: Maybe<Scalars['Int']['output']>;
  /** Unique suggestion ID (itemId or shoppingListItemId depending on source) */
  id: Scalars['ID']['output'];
  /** Primary image URL */
  imageUrl: Maybe<Scalars['String']['output']>;
  /** Full item reference */
  item: SuggestionItem;
  /** The catalog Item ID - always present */
  itemId: Scalars['ID']['output'];
  /** Last quantity used (for RECENTLY_DELETED source) */
  lastQuantity: Maybe<Scalars['Float']['output']>;
  /** Last unit ID used (for RECENTLY_DELETED source) */
  lastUnitId: Maybe<Scalars['ID']['output']>;
  /** Item name for display */
  name: Scalars['String']['output'];
  /** Popularity ranking position (for POPULAR source) */
  popularityRank: Maybe<Scalars['Int']['output']>;
  /** Shopping list item ID - only present for RECENTLY_DELETED source */
  shoppingListItemId: Maybe<Scalars['ID']['output']>;
  /** Source of this suggestion */
  source: SuggestionSource;
};

export type ShoppingListUpdatedPayload = {
  __typename: 'ShoppingListUpdatedPayload';
  mutation: MutationType;
  node: ShoppingList;
  originatorClientId: Maybe<Scalars['ID']['output']>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

/**
 * Usage statistics for a ShoppingList.
 * Included when admin requests resources with stats.
 */
export type ShoppingListUsageStats = {
  __typename: 'ShoppingListUsageStats';
  /** Number of active collaborators */
  collaboratorCount: Scalars['Int']['output'];
  /** Number of completed/purchased items */
  completedItemCount: Scalars['Int']['output'];
  /** Total number of items */
  itemCount: Scalars['Int']['output'];
  /** Last activity timestamp */
  lastActivityAt: Maybe<Scalars['DateTime']['output']>;
  /** Total share count */
  shareCount: Scalars['Int']['output'];
  /** Total view count */
  viewCount: Scalars['Int']['output'];
};

export type SkippedItem = {
  __typename: 'SkippedItem';
  identifier: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  reason: Scalars['String']['output'];
};

/** Info about a skipped item */
export type SkippedItemInfo = {
  __typename: 'SkippedItemInfo';
  itemName: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  shoppingListItemId: Scalars['ID']['output'];
};

/** Item that was skipped when adding to shopping list */
export type SkippedLowStockItem = {
  __typename: 'SkippedLowStockItem';
  itemName: Scalars['String']['output'];
  pantryItemId: Scalars['ID']['output'];
  reason: Scalars['String']['output'];
};

export enum SortOrder {
  Asc = 'ASC',
  Desc = 'DESC'
}

/** Sub-input for spoonacular-specific data */
export type SpoonacularDataInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  consistency?: InputMaybe<Scalars['String']['input']>;
  originalString?: InputMaybe<Scalars['String']['input']>;
  spoonacularIngredientId?: InputMaybe<Scalars['Int']['input']>;
};

/** Input for stale device cleanup */
export type StaleDeviceCleanupInput = {
  daysInactive?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};

/** Reusable sub-input for storage details */
export type StorageDetailsInput = {
  condition?: InputMaybe<ItemCondition>;
  storageLocationId?: InputMaybe<Scalars['ID']['input']>;
  storageLocationName?: InputMaybe<Scalars['String']['input']>;
  storageNotes?: InputMaybe<Scalars['String']['input']>;
  storageState?: InputMaybe<StorageState>;
};

/**
 * Storage location within a home (refrigerator, freezer, pantry shelf, etc.)
 * Supports hierarchical organization with parent-child relationships
 */
export type StorageLocation = {
  __typename: 'StorageLocation';
  /** Maximum capacity (in capacityUnit) */
  capacity: Maybe<Scalars['Float']['output']>;
  /** Unit of measurement for capacity (e.g., 'liters', 'cubic feet') */
  capacityUnit: Maybe<Scalars['String']['output']>;
  /** Child locations nested within this location */
  childLocations: Array<StorageLocation>;
  /** Optional color code (hex) for UI display */
  color: Maybe<Scalars['String']['output']>;
  /** When this storage location was created */
  createdAt: Scalars['DateTime']['output'];
  /** Current count of items stored in this location */
  currentItemCount: Scalars['Int']['output'];
  /** Optional description or notes about this location */
  description: Maybe<Scalars['String']['output']>;
  /** The home this storage location belongs to */
  home: Home;
  /** ID of the home this storage location belongs to */
  homeId: Scalars['ID']['output'];
  /** Optional icon identifier for UI display */
  icon: Maybe<Scalars['String']['output']>;
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
  parentLocation: Maybe<StorageLocation>;
  /** ID of the parent location */
  parentLocationId: Maybe<Scalars['ID']['output']>;
  /** Sort order for display (lower numbers appear first) */
  sortOrder: Scalars['Int']['output'];
  /** Temperature state (FROZEN, REFRIGERATED, AMBIENT, NONE) */
  temperature: Maybe<StorageState>;
  /** Type of storage (REFRIGERATOR, FREEZER, PANTRY_SHELF, etc.) */
  type: StorageType;
  /** When this storage location was last updated */
  updatedAt: Scalars['DateTime']['output'];
};

export type StorageLocationConnection = Connection & {
  __typename: 'StorageLocationConnection';
  edges: Array<StorageLocationEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Count of pantry items in a specific storage location. */
export type StorageLocationCount = {
  __typename: 'StorageLocationCount';
  itemCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  storageLocationId: Scalars['ID']['output'];
  type: StorageType;
};

/** Storage location connection for pagination */
export type StorageLocationEdge = Edge & {
  __typename: 'StorageLocationEdge';
  cursor: Scalars['String']['output'];
  node: StorageLocation;
};

/** Order by options for storage locations */
export type StorageLocationOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
};

export type StorageLocationPayload = MutationPayload & {
  __typename: 'StorageLocationPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  storageLocation: Maybe<StorageLocation>;
  success: Scalars['Boolean']['output'];
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
  Refrigerated = 'REFRIGERATED'
}

/**
 * Counts of pantry items grouped by storage state.
 * Always reflects the full pantry (not affected by itemsConnection filters).
 */
export type StorageStateCounts = {
  __typename: 'StorageStateCounts';
  /** Count of items with storageState = AMBIENT, NONE, or null */
  ambient: Scalars['Int']['output'];
  /** Count of items with storageState = FROZEN */
  frozen: Scalars['Int']['output'];
  /** Count of items with storageState = REFRIGERATED */
  refrigerated: Scalars['Int']['output'];
};

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
  RvStorage = 'RV_STORAGE'
}

/**
 * Store type for retail locations
 * Cache: 30 minutes - store information changes rarely
 */
export type Store = {
  __typename: 'Store';
  address: Maybe<Scalars['String']['output']>;
  averageShelfLife: Maybe<Scalars['JSON']['output']>;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  lastPriceUpdate: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  pantryItems: PantryItemConnection;
  priceAccuracy: Maybe<Scalars['Float']['output']>;
  priceHistory: ItemPriceHistoryConnection;
  purchases: PurchaseConnection;
  qualityRating: Maybe<Scalars['Float']['output']>;
  stats: Maybe<StoreStats>;
  storeInfo: Maybe<StoreInfo>;
  storeSkus: ItemStoreSkuConnection;
  supportsPriceAPI: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
};


/**
 * Store type for retail locations
 * Cache: 30 minutes - store information changes rarely
 */
export type StorePantryItemsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PantryItemOrderBy>;
};


/**
 * Store type for retail locations
 * Cache: 30 minutes - store information changes rarely
 */
export type StorePriceHistoryArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ItemPriceHistoryOrderBy>;
};


/**
 * Store type for retail locations
 * Cache: 30 minutes - store information changes rarely
 */
export type StorePurchasesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PurchaseOrderBy>;
};


/**
 * Store type for retail locations
 * Cache: 30 minutes - store information changes rarely
 */
export type StoreStoreSkusArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ItemStoreSkuOrderBy>;
};

export type StoreChangeEvent = {
  __typename: 'StoreChangeEvent';
  changeType: StoreChangeType;
  store: Store;
  timestamp: Scalars['DateTime']['output'];
};

export enum StoreChangeType {
  RatingChanged = 'RATING_CHANGED',
  Updated = 'UPDATED'
}

export type StoreConnection = Connection & {
  __typename: 'StoreConnection';
  edges: Array<StoreEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** Cost breakdown by store */
export type StoreCostBreakdown = {
  __typename: 'StoreCostBreakdown';
  averageCostPerUnit: Scalars['Float']['output'];
  itemCount: Scalars['Int']['output'];
  storeId: Maybe<Scalars['ID']['output']>;
  storeName: Maybe<Scalars['String']['output']>;
  totalSpent: Scalars['Float']['output'];
};

/** Store connection for Relay-style pagination */
export type StoreEdge = Edge & {
  __typename: 'StoreEdge';
  cursor: Scalars['String']['output'];
  node: Store;
};

/** Sub-input for store-related filters */
export type StoreFilterInput = {
  inventoryStatus?: InputMaybe<Scalars['String']['input']>;
  storeId?: InputMaybe<Scalars['String']['input']>;
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

/**
 * Filter input for querying stores.
 * Consolidates searchStores, storeByName, popularStores, nearbyStores, recommendedStores.
 */
export type StoreFilters = {
  /** Location-based filter */
  location?: InputMaybe<StoreLocationInput>;
  /** Exact name match */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Filter to recommended stores for current user */
  recommended?: InputMaybe<Scalars['Boolean']['input']>;
  /** Text search across store name and address */
  search?: InputMaybe<Scalars['String']['input']>;
};

/** Typed store operating hours (replaces hoursJSON field) */
export type StoreHours = {
  __typename: 'StoreHours';
  friday: Maybe<Scalars['String']['output']>;
  monday: Maybe<Scalars['String']['output']>;
  saturday: Maybe<Scalars['String']['output']>;
  sunday: Maybe<Scalars['String']['output']>;
  thursday: Maybe<Scalars['String']['output']>;
  tuesday: Maybe<Scalars['String']['output']>;
  wednesday: Maybe<Scalars['String']['output']>;
};

/** Input for store operating hours */
export type StoreHoursInput = {
  friday?: InputMaybe<Scalars['String']['input']>;
  monday?: InputMaybe<Scalars['String']['input']>;
  saturday?: InputMaybe<Scalars['String']['input']>;
  sunday?: InputMaybe<Scalars['String']['input']>;
  thursday?: InputMaybe<Scalars['String']['input']>;
  tuesday?: InputMaybe<Scalars['String']['input']>;
  wednesday?: InputMaybe<Scalars['String']['input']>;
};

/**
 * Store information and contact details
 * Cache: 30 minutes - store metadata changes rarely
 */
export type StoreInfo = {
  __typename: 'StoreInfo';
  email: Maybe<Scalars['String']['output']>;
  hours: Maybe<StoreHours>;
  id: Scalars['ID']['output'];
  lat: Maybe<Scalars['Float']['output']>;
  lng: Maybe<Scalars['Float']['output']>;
  phone: Maybe<Scalars['String']['output']>;
  website: Maybe<Scalars['String']['output']>;
};

export type StoreLocationInput = {
  lat: Scalars['Float']['input'];
  lng: Scalars['Float']['input'];
  /** Radius in miles (default: 10) */
  radius?: InputMaybe<Scalars['Float']['input']>;
};

export enum StoreOrderBy {
  CreatedAtDesc = 'CREATED_AT_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  PopularityDesc = 'POPULARITY_DESC'
}

export type StorePayload = MutationPayload & {
  __typename: 'StorePayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  store: Maybe<Store>;
  success: Scalars['Boolean']['output'];
};

/** Sub-input for store preferences */
export type StorePreferencesInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  preferredStoreId?: InputMaybe<Scalars['ID']['input']>;
  storeSection?: InputMaybe<Scalars['String']['input']>;
};

export type StorePriceComparison = {
  __typename: 'StorePriceComparison';
  inventoryStatus: Maybe<Scalars['String']['output']>;
  lastUpdated: Maybe<Scalars['DateTime']['output']>;
  offers: Array<OfferSummary>;
  price: Maybe<Scalars['Float']['output']>;
  storeId: Scalars['String']['output'];
  storeName: Scalars['String']['output'];
  unitPrice: Maybe<Scalars['Float']['output']>;
};

export type StoreSkuInput = {
  displayItemSize?: InputMaybe<Scalars['String']['input']>;
  fulfillmentMethods?: InputMaybe<Array<Scalars['String']['input']>>;
  inventoryStatus?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['Float']['input']>;
  sku: Scalars['String']['input'];
  storeId: Scalars['ID']['input'];
};

export type StoreSkuOpsInput = {
  addStoreSkus?: InputMaybe<Array<StoreSkuInput>>;
  removeStoreSkuIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  storeSkus?: InputMaybe<Array<StoreSkuInput>>;
};

/**
 * Store statistics and analytics
 * Cache: 10 minutes - stats aggregate over time
 */
export type StoreStats = {
  __typename: 'StoreStats';
  averagePurchaseAmount: Scalars['Float']['output'];
  priceAccuracy: Maybe<Scalars['Float']['output']>;
  qualityRating: Maybe<Scalars['Float']['output']>;
  recentActivity: Array<Purchase>;
  topItems: Array<StoreTopItem>;
  totalPurchases: Scalars['Int']['output'];
  totalRevenue: Scalars['Float']['output'];
  uniqueCustomers: Scalars['Int']['output'];
};

export type StoreTopItem = {
  __typename: 'StoreTopItem';
  count: Scalars['Int']['output'];
  itemName: Scalars['String']['output'];
  revenue: Scalars['Float']['output'];
};

export type SubmitAppealInput = {
  appealNotes: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type Subscription = {
  __typename: 'Subscription';
  /** Subscribe to collaborator changes for a shopping list (invites, removals, role/permission updates) */
  collaborationChanged: CollaborationChangeEvent;
  /** Subscribe to all device changes for a user */
  deviceChanged: DeviceChangeEvent;
  /** Subscribe to expiration notification changes for a pantry */
  expirationNotificationChanged: ExpirationNotificationChangeEvent;
  /** Subscribe to home invitation changes for a specific home */
  homeInviteChanged: HomeInviteChangeEvent;
  /** Subscribe to all login activity for a user */
  loginActivityChanged: LoginActivityEvent;
  /** Subscribe to all membership changes for a home */
  membershipChanged: MembershipChangeEvent;
  /** Subscribe to changes across all of the current user's shopping lists */
  myShoppingListsChanged: ShoppingListChangeEvent;
  /** Subscribe to notification changes */
  notificationChanged: NotificationChangeEvent;
  /** Subscribe to pantry alerts (low stock, expiring, waste) */
  pantryAlert: PantryAlertEvent;
  /** Subscribe to pantry data changes (updates, items, usage) */
  pantryChanged: PantryChangeEvent;
  /** Subscribe to all changes for a specific shopping list */
  shoppingListChanged: ShoppingListChangeEvent;
  /** Subscribe to store changes */
  storeChanged: StoreChangeEvent;
  /** Subscribe to all user changes */
  userChanged: UserChangeEvent;
};


export type SubscriptionCollaborationChangedArgs = {
  listId: Scalars['ID']['input'];
};


export type SubscriptionDeviceChangedArgs = {
  userId: Scalars['ID']['input'];
};


export type SubscriptionExpirationNotificationChangedArgs = {
  pantryId: Scalars['ID']['input'];
};


export type SubscriptionHomeInviteChangedArgs = {
  homeId: Scalars['ID']['input'];
};


export type SubscriptionLoginActivityChangedArgs = {
  userId: Scalars['ID']['input'];
};


export type SubscriptionMembershipChangedArgs = {
  homeId: Scalars['ID']['input'];
};


export type SubscriptionPantryAlertArgs = {
  pantryId: Scalars['ID']['input'];
};


export type SubscriptionPantryChangedArgs = {
  pantryId: Scalars['ID']['input'];
};


export type SubscriptionShoppingListChangedArgs = {
  listId: Scalars['ID']['input'];
};


export type SubscriptionStoreChangedArgs = {
  storeId?: InputMaybe<Scalars['ID']['input']>;
};


export type SubscriptionUserChangedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

/**
 * Lightweight item type for suggestion displays.
 * Contains only the display fields needed for suggestion cards.
 */
export type SuggestionItem = {
  __typename: 'SuggestionItem';
  id: Scalars['ID']['output'];
  imageUrl: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
};

/** Source of a shopping list suggestion */
export enum SuggestionSource {
  /** User frequently adds this item to shopping lists */
  FrequentlyAdded = 'FREQUENTLY_ADDED',
  /** Globally popular item */
  Popular = 'POPULAR',
  /** Item was recently removed from this shopping list */
  RecentlyDeleted = 'RECENTLY_DELETED'
}

/**
 * Lightweight unit type for suggestion displays.
 * Contains only the fields needed for one-tap add UI.
 */
export type SuggestionUnit = {
  __typename: 'SuggestionUnit';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
};

export type SuspendUserInput = {
  reason: Scalars['String']['input'];
  suspendedUntil: Scalars['DateTime']['input'];
  userId: Scalars['ID']['input'];
};

export type SuspiciousActivity = {
  __typename: 'SuspiciousActivity';
  failedFromSameIP: Array<FailedIpStat>;
  multipleAccountsFromIP: Array<FailedIpStat>;
  newDeviceLogins: Array<LoginHistory>;
  newLocationLogins: Array<LoginHistory>;
  rapidAttempts: Array<RapidAttempt>;
  riskyLogins: Array<LoginHistory>;
  suspiciousActivity: Scalars['Boolean']['output'];
  unusualTimeLogins: Array<LoginHistory>;
};

export type SuspiciousActivitySummary = {
  __typename: 'SuspiciousActivitySummary';
  actionsBreakdown: InviteActionStats;
  timeWindow: Scalars['Int']['output'];
  totalSuspiciousActions: Scalars['Int']['output'];
};

export type SuspiciousInviteActivity = {
  __typename: 'SuspiciousInviteActivity';
  logs: Array<InviteLog>;
  summary: SuspiciousActivitySummary;
};

/** Information about a sync conflict */
export type SyncConflictInfo = {
  __typename: 'SyncConflictInfo';
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
  Update = 'UPDATE'
}

export type SyncPantryItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  expirationAlert?: InputMaybe<Scalars['Boolean']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  forceAdd?: InputMaybe<Scalars['Boolean']['input']>;
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  item?: InputMaybe<InlineItemInput>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  lowStockAlert?: InputMaybe<Scalars['Boolean']['input']>;
  netWeight?: InputMaybe<NetWeightInput>;
  pantryId: Scalars['ID']['input'];
  purchase?: InputMaybe<PurchaseInfoInput>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  storage?: InputMaybe<StorageDetailsInput>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  thresholds?: InputMaybe<InventoryThresholdsInput>;
  unit?: InputMaybe<UnitSpecInput>;
  version?: InputMaybe<Scalars['Int']['input']>;
  wasteReason?: InputMaybe<WasteReason>;
};

export type SyncPantryItemResult = {
  __typename: 'SyncPantryItemResult';
  clientId: Scalars['ID']['output'];
  conflict: Maybe<SyncConflictInfo>;
  item: Maybe<PantryItem>;
  operation: SyncOperation;
  serverId: Maybe<Scalars['ID']['output']>;
  wasCreated: Scalars['Boolean']['output'];
};

/** Sub-input for sync settings */
export type SyncSettingsInput = {
  autoSync?: InputMaybe<Scalars['Boolean']['input']>;
  offlineMode?: InputMaybe<Scalars['Boolean']['input']>;
};

export type SyncShoppingListItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  category?: InputMaybe<Scalars['String']['input']>;
  /** Item reference (if linking to catalog item) */
  itemId?: InputMaybe<Scalars['ID']['input']>;
  /** Item details (for items not in catalog) */
  itemName?: InputMaybe<Scalars['String']['input']>;
  netWeight?: InputMaybe<NetWeightInput>;
  /** User-provided information */
  notes?: InputMaybe<Scalars['String']['input']>;
  pricing?: InputMaybe<PricingEstimatesInput>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  purchaseTracking?: InputMaybe<PurchaseTrackingInput>;
  /** Quantity of the item. Accepts: "1/3", "1 1/4", "0.5", "2", or numbers like 1, 1.5 */
  quantity?: InputMaybe<QuantityInput>;
  recipeContext?: InputMaybe<RecipeContextInput>;
  /** Required: ID of the shopping list this item belongs to */
  shoppingListId: Scalars['ID']['input'];
  sortOrder?: InputMaybe<Scalars['String']['input']>;
  storePrefs?: InputMaybe<StorePreferencesInput>;
  unit?: InputMaybe<UnitSpecInput>;
  /** Version for optimistic locking (null if new item) */
  version?: InputMaybe<Scalars['Int']['input']>;
};

/** Result of syncing a shopping list item */
export type SyncShoppingListItemResult = {
  __typename: 'SyncShoppingListItemResult';
  /** The client-provided ID (may be temp ID like 'temp-uuid') */
  clientId: Scalars['ID']['output'];
  /** Conflict information if version mismatch occurred */
  conflict: Maybe<SyncConflictInfo>;
  /** The synced shopping list item (null for delete operations) */
  item: Maybe<ShoppingListItem>;
  /** The operation that was performed */
  operation: SyncOperation;
  /** The server-assigned database ID (null if item was deleted before reaching server) */
  serverId: Maybe<Scalars['ID']['output']>;
  /** Whether this was a create (true) or update (false) operation */
  wasCreated: Scalars['Boolean']['output'];
};

/** Sub-input for tag-based filters */
export type TagFilterInput = {
  /** Items that have NONE of these tags */
  excludeTags?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Items that have ALL of these tags */
  hasTags?: InputMaybe<Array<Scalars['String']['input']>>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type TagOpsInput = {
  addTags?: InputMaybe<Array<Scalars['String']['input']>>;
  removeTags?: InputMaybe<Array<Scalars['String']['input']>>;
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
  Weekly = 'WEEKLY'
}

/** Sub-input for time estimates */
export type TimeEstimatesInput = {
  cookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  prepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  totalTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
};

/** Time series data point for charting usage/waste trends */
export type TimeSeriesDataPoint = {
  __typename: 'TimeSeriesDataPoint';
  count: Scalars['Int']['output'];
  date: Scalars['DateTime']['output'];
  value: Scalars['Float']['output'];
};

export type Timestamped = {
  createdAt: Scalars['DateTime']['output'];
};

export type ToggleReviewHelpfulInput = {
  isHelpful: Scalars['Boolean']['input'];
  reviewId: Scalars['ID']['input'];
};

/** Input for toggling the purchased state of a shopping list item */
export type ToggleShoppingListItemPurchasedInput = {
  id: Scalars['ID']['input'];
  purchased: Scalars['Boolean']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export enum TrustLevel {
  Admin = 'ADMIN',
  Basic = 'BASIC',
  Moderator = 'MODERATOR',
  NewUser = 'NEW_USER',
  Trusted = 'TRUSTED',
  Verified = 'VERIFIED'
}

/** Sub-input for UI preferences */
export type UiPreferencesInput = {
  compactMode?: InputMaybe<Scalars['Boolean']['input']>;
  showTutorials?: InputMaybe<Scalars['Boolean']['input']>;
  theme?: InputMaybe<AppTheme>;
};

/**
 * Unit of measurement type
 * Cache: 2 hours - measurement units are static reference data
 */
export type Unit = {
  __typename: 'Unit';
  autoConvertThreshold: Maybe<Scalars['Float']['output']>;
  autoConvertToUnit: Maybe<UnitRef>;
  autoConvertToUnitId: Maybe<Scalars['ID']['output']>;
  baseUnit: Maybe<UnitRef>;
  baseUnitId: Maybe<Scalars['ID']['output']>;
  commonFractions: Maybe<Scalars['JSON']['output']>;
  conversionFactor: Scalars['Float']['output'];
  createdAt: Scalars['DateTime']['output'];
  displayAsFraction: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  isCommon: Scalars['Boolean']['output'];
  isMetric: Scalars['Boolean']['output'];
  minPrecision: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  notes: Maybe<Scalars['String']['output']>;
  sortOrder: Scalars['Int']['output'];
  symbol: Scalars['String']['output'];
  type: UnitType;
  unitRole: UnitRole;
  updatedAt: Scalars['DateTime']['output'];
};

export type UnitOpsInput = {
  addUnits?: InputMaybe<Array<ItemUnitInput>>;
  removeUnitIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type UnitPayload = MutationPayload & {
  __typename: 'UnitPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  unit: Maybe<Unit>;
};

export enum UnitRecommendation {
  BulkBuying = 'BULK_BUYING',
  CostComparison = 'COST_COMPARISON',
  MealPlanning = 'MEAL_PLANNING',
  PortionControl = 'PORTION_CONTROL',
  PrecisionCooking = 'PRECISION_COOKING',
  RecipeScaling = 'RECIPE_SCALING',
  StoragePlanning = 'STORAGE_PLANNING'
}

/** Lightweight unit reference to break self-referential cycles */
export type UnitRef = {
  __typename: 'UnitRef';
  id: Scalars['ID']['output'];
  isMetric: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  type: UnitType;
};

/** Operational role of a unit for eligibility in consumption and restock operations */
export enum UnitRole {
  /**
   * Physical packaging unit (tub, can, jar, bottle, bag, box, package, carton, tube, case, pack, dozen).
   * Valid for restock if it matches the tracking unit. Not valid for consumption as a different container.
   */
  Container = 'CONTAINER',
  /**
   * Continuous measurement unit (gram, ounce, cup, tablespoon, milliliter, etc.).
   * Valid for consumption if convertible to the item's net weight unit. Valid for restock if convertible.
   */
  Measurement = 'MEASUREMENT',
  /**
   * Discrete sub-unit of an item (piece, item, slice, clove, head, stalk, sprig, leaf, bunch).
   * Valid for consumption if an item-specific conversion exists. Not valid for restock.
   */
  Portion = 'PORTION'
}

/** How a unit was determined to be eligible for an operation */
export enum UnitSource {
  /** Automatically derived from Unit.unitRole and convertibility */
  Auto = 'AUTO',
  /** Admin curated via ItemUnit.usageContext, retailUnit, or Item.defaultConsumeUnit */
  Curated = 'CURATED',
  /** The item's tracking unit (always eligible) */
  TrackingUnit = 'TRACKING_UNIT'
}

/** Reusable sub-input for specifying a unit by ID, name, or symbol */
export type UnitSpecInput = {
  unitId?: InputMaybe<Scalars['ID']['input']>;
  unitName?: InputMaybe<Scalars['String']['input']>;
  unitSymbol?: InputMaybe<Scalars['String']['input']>;
};

export enum UnitSystem {
  Imperial = 'IMPERIAL',
  Metric = 'METRIC',
  System = 'SYSTEM'
}

export enum UnitType {
  Area = 'AREA',
  Count = 'COUNT',
  Length = 'LENGTH',
  Time = 'TIME',
  Volume = 'VOLUME',
  Weight = 'WEIGHT'
}

export enum UnitUsageContext {
  Bulk = 'BULK',
  Cooking = 'COOKING',
  Nutrition = 'NUTRITION',
  Packaging = 'PACKAGING',
  Recipe = 'RECIPE',
  Serving = 'SERVING',
  Shopping = 'SHOPPING',
  Storing = 'STORING'
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
  UpcE = 'UPC_E'
}

export type UpcValidation = {
  __typename: 'UpcValidation';
  exists: Scalars['Boolean']['output'];
  format: Maybe<Scalars['String']['output']>;
  isValid: Scalars['Boolean']['output'];
  item: Maybe<Item>;
};

export type UpdateBrandInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
};

export type UpdateCategoryInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  icon?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
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

/** Input for updating a collaborator's role */
export type UpdateCollaboratorRoleInput = {
  collaboratorId: Scalars['ID']['input'];
  role: CollaboratorRole;
  shoppingListId: Scalars['ID']['input'];
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
  appVersion?: InputMaybe<Scalars['String']['input']>;
  /** Clear the push token (replaces removePushToken mutation) */
  clearPushToken?: InputMaybe<Scalars['Boolean']['input']>;
  /** Soft delete the device (replaces deleteDevice mutation) */
  delete?: InputMaybe<Scalars['Boolean']['input']>;
  details?: InputMaybe<DeviceDetailsInput>;
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  /** Increment the login count (replaces incrementDeviceLoginCount mutation) */
  incrementLoginCount?: InputMaybe<Scalars['Boolean']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<NetworkLocationInput>;
  platform?: InputMaybe<MobilePlatform>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
  /** Update lastSeenAt to now (replaces updateDeviceLastSeen mutation) */
  touchLastSeen?: InputMaybe<Scalars['Boolean']['input']>;
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

export type UpdateExternalSourceInput = {
  externalName?: InputMaybe<Scalars['String']['input']>;
  identifiers?: InputMaybe<Scalars['JSON']['input']>;
  images?: InputMaybe<Scalars['JSON']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  netWeightUnit?: InputMaybe<Scalars['String']['input']>;
  packageSize?: InputMaybe<Scalars['String']['input']>;
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
  brand?: InputMaybe<BrandReferenceInput>;
  brandOps?: InputMaybe<BrandOpsInput>;
  categoryOps?: InputMaybe<CategoryOpsInput>;
  classification?: InputMaybe<ItemClassificationInput>;
  description?: InputMaybe<Scalars['String']['input']>;
  editReason?: InputMaybe<Scalars['String']['input']>;
  healthInfo?: InputMaybe<HealthInfoInput>;
  media?: InputMaybe<MediaAssetsInput>;
  mergeMetadata?: InputMaybe<Scalars['Boolean']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  nutritionFacts?: InputMaybe<Array<NutritionFactInput>>;
  packageInfo?: InputMaybe<PackageInfoInput>;
  popularity?: InputMaybe<Scalars['Int']['input']>;
  productDetails?: InputMaybe<ProductDetailsInput>;
  showInOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<ItemStatus>;
  storeSkuOps?: InputMaybe<StoreSkuOpsInput>;
  tagOps?: InputMaybe<TagOpsInput>;
  type?: InputMaybe<ItemType>;
  unitConfig?: InputMaybe<ItemUnitConfigInput>;
  unitOps?: InputMaybe<UnitOpsInput>;
  visibility?: InputMaybe<Visibility>;
};

/** Input for updating an item's price */
export type UpdateItemPriceInput = {
  itemId: Scalars['ID']['input'];
  price: Scalars['Float']['input'];
  source?: InputMaybe<Scalars['String']['input']>;
  storeId?: InputMaybe<Scalars['ID']['input']>;
};

export type UpdateLoginHistoryInput = {
  attribution?: InputMaybe<AttributionInput>;
  automation?: InputMaybe<ApiAutomationInput>;
  behavioral?: InputMaybe<BehavioralSignalsInput>;
  browserOs?: InputMaybe<BrowserOsDetailsInput>;
  deviceId?: InputMaybe<Scalars['ID']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  failureDetails?: InputMaybe<Scalars['String']['input']>;
  failureReason?: InputMaybe<LoginFailureReason>;
  flaggedById?: InputMaybe<Scalars['ID']['input']>;
  flaggedReason?: InputMaybe<Scalars['String']['input']>;
  isMobileApp?: InputMaybe<Scalars['Boolean']['input']>;
  network?: InputMaybe<NetworkLocationInput>;
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  reviewed?: InputMaybe<Scalars['Boolean']['input']>;
  reviewerId?: InputMaybe<Scalars['ID']['input']>;
  risk?: InputMaybe<RiskAssessmentInput>;
  session?: InputMaybe<SessionInfoInput>;
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
  /** Whether to auto-deduct recipe ingredients from pantry on completion (default: true) */
  deductFromPantry?: InputMaybe<Scalars['Boolean']['input']>;
  estimatedCost?: InputMaybe<Scalars['Float']['input']>;
  fat?: InputMaybe<Scalars['Float']['input']>;
  isCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  mealType?: InputMaybe<MealType>;
  notes?: InputMaybe<Scalars['String']['input']>;
  protein?: InputMaybe<Scalars['Float']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  /** Pantry items used for this meal: [{pantryItemId, quantityUsed}] */
  usedPantryItems?: InputMaybe<Scalars['JSON']['input']>;
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

/**
 * Consolidated input for updating moderation state.
 * Handles status transitions, trust level, risk score, ban/suspend/unban/unsuspend, and review operations.
 */
export type UpdateModerationInput = {
  moderatorNotes?: InputMaybe<Scalars['String']['input']>;
  /** Ban/suspend reason */
  reason?: InputMaybe<Scalars['String']['input']>;
  /** Review notes (used when completing a review) */
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
  /** New moderation status (ACTIVE, WARNED, RESTRICTED, SUSPENDED, BANNED, UNDER_REVIEW, APPEALING) */
  status?: InputMaybe<ModerationStatus>;
  /** Suspension end date (required when status=SUSPENDED) */
  suspendedUntil?: InputMaybe<Scalars['DateTime']['input']>;
  trustLevel?: InputMaybe<TrustLevel>;
};

export type UpdateNotificationInput = {
  actionUrl?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<NotificationCategory>;
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
  channels?: InputMaybe<NotificationChannelsInput>;
  expiration?: InputMaybe<ExpirationNotifConfigInput>;
  features?: InputMaybe<FeatureNotificationsInput>;
  quietHours?: InputMaybe<QuietHoursInput>;
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
  brand?: InputMaybe<BrandReferenceInput>;
  expirationAlert?: InputMaybe<Scalars['Boolean']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  lowStockAlert?: InputMaybe<Scalars['Boolean']['input']>;
  netWeight?: InputMaybe<NetWeightInput>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  storage?: InputMaybe<StorageDetailsInput>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  thresholds?: InputMaybe<InventoryThresholdsInput>;
  unit?: InputMaybe<UnitSpecInput>;
  version?: InputMaybe<Scalars['Int']['input']>;
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
  attribution?: InputMaybe<RecipeAttributionInput>;
  category?: InputMaybe<RecipeCategory>;
  cookTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  cuisine?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dietary?: InputMaybe<DietaryTagsInput>;
  difficulty?: InputMaybe<Difficulty>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  instructions?: InputMaybe<Scalars['JSON']['input']>;
  media?: InputMaybe<MediaAssetsInput>;
  metadata?: InputMaybe<RecipeMetadataInput>;
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  nutrition?: InputMaybe<NutritionInfoInput>;
  prepTimeMinutes?: InputMaybe<Scalars['Int']['input']>;
  removeTags?: InputMaybe<Array<Scalars['String']['input']>>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<RecipeStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timing?: InputMaybe<TimeEstimatesInput>;
  tips?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateRecipeReviewInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  rating?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateRestrictionInput = {
  id: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  severity?: InputMaybe<RestrictionSeverity>;
};

export type UpdateShoppingListInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  homeId?: InputMaybe<Scalars['ID']['input']>;
  isCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  planning?: InputMaybe<ShoppingListPlanningInput>;
  settings?: InputMaybe<ShoppingListSettingsInput>;
  status?: InputMaybe<ListStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateShoppingListItemInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  pricing?: InputMaybe<PricingEstimatesInput>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  purchaseTracking?: InputMaybe<PurchaseTrackingInput>;
  /** Accepts: "1/3", "1 1/4", "0.5", "2", or numbers like 1, 1.5 */
  quantity?: InputMaybe<Scalars['FlexibleQuantity']['input']>;
  sortOrder?: InputMaybe<Scalars['String']['input']>;
  storePrefs?: InputMaybe<StorePreferencesInput>;
  unit?: InputMaybe<UnitSpecInput>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

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

/** Input for updating store information */
export type UpdateStoreInfoInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  hours?: InputMaybe<StoreHoursInput>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
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
  baseUnitId?: InputMaybe<Scalars['ID']['input']>;
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
  features?: InputMaybe<FeatureTogglesInput>;
  notifications?: InputMaybe<UserNotificationSettingsInput>;
  privacy?: InputMaybe<PrivacySettingsInput>;
  quantityDisplay?: InputMaybe<QuantityDisplayInput>;
  regional?: InputMaybe<RegionalSettingsInput>;
  sync?: InputMaybe<SyncSettingsInput>;
  ui?: InputMaybe<UiPreferencesInput>;
};

export type UploadPayload = MutationPayload & {
  __typename: 'UploadPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  url: Maybe<Scalars['String']['output']>;
};

export type UpsertExternalRecipeResult = {
  __typename: 'UpsertExternalRecipeResult';
  created: Scalars['Boolean']['output'];
  recipe: Recipe;
};

export type UpsertItemResult = {
  __typename: 'UpsertItemResult';
  created: Scalars['Boolean']['output'];
  item: Item;
  mapping: ExternalSourceMapping;
};

/**
 * Input for adding or updating item-specific unit conversion.
 * Admin-only fields (source, confidence, isVerified) are ignored for non-admin users.
 */
export type UpsertItemUnitConversionInput = {
  /** Admin only: set the confidence score 0-1 (defaults to 0.9) */
  confidence?: InputMaybe<Scalars['Float']['input']>;
  conversionRatio: Scalars['Float']['input'];
  fromUnitId: Scalars['ID']['input'];
  /** Admin only: mark the conversion as verified */
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Admin only: set the conversion source (defaults to USER_DEFINED) */
  source?: InputMaybe<ConversionSource>;
  toUnitId: Scalars['ID']['input'];
};

/** Comprehensive usage analytics for a pantry */
export type UsageAnalytics = {
  __typename: 'UsageAnalytics';
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
  __typename: 'UsageByItem';
  count: Scalars['Int']['output'];
  imageUrl: Maybe<Scalars['String']['output']>;
  itemId: Scalars['ID']['output'];
  itemName: Scalars['String']['output'];
  totalQuantity: Scalars['Float']['output'];
  unitName: Maybe<Scalars['String']['output']>;
};

/** Usage breakdown by purpose (cooking, snack, waste, etc.) */
export type UsageByPurpose = {
  __typename: 'UsageByPurpose';
  count: Scalars['Int']['output'];
  percentage: Scalars['Float']['output'];
  purpose: UsagePurpose;
  totalQuantity: Scalars['Float']['output'];
};

/** Usage breakdown by source (manual, cooking log, meal plan, recipe) */
export type UsageBySource = {
  __typename: 'UsageBySource';
  count: Scalars['Int']['output'];
  percentage: Scalars['Float']['output'];
  source: UsageSource;
  totalQuantity: Scalars['Float']['output'];
};

/** Usage breakdown by unit for mixed-unit tracking */
export type UsageByUnit = {
  __typename: 'UsageByUnit';
  count: Scalars['Int']['output'];
  totalQuantity: Scalars['Float']['output'];
  unitId: Scalars['ID']['output'];
  unitName: Scalars['String']['output'];
  unitSymbol: Scalars['String']['output'];
};

/** Describes the purpose or reason for consuming or adjusting pantry item quantities */
export enum UsagePurpose {
  /** Manual correction to reconcile actual stock with recorded quantities */
  Adjustment = 'ADJUSTMENT',
  /** Used as an ingredient in a cooked dish or recipe */
  Cooking = 'COOKING',
  /** General-purpose consumption that does not fit a specific category */
  General = 'GENERAL',
  /** Given away as a gift to someone outside the household */
  Gift = 'GIFT',
  /** Used for batch cooking or advance meal preparation */
  MealPrep = 'MEAL_PREP',
  /** Quantity added back to the pantry through a restock or purchase */
  Restock = 'RESTOCK',
  /** Consumed directly as a snack without preparation */
  Snack = 'SNACK',
  /** Moved to a different storage location or household */
  Transfer = 'TRANSFER',
  /** Discarded due to spoilage, expiration, or other waste */
  Waste = 'WASTE'
}

/** Source that triggered pantry item usage */
export enum UsageSource {
  Manual = 'MANUAL',
  RecipeAuto = 'RECIPE_AUTO',
  RecipeManual = 'RECIPE_MANUAL',
  Transfer = 'TRANSFER',
  Waste = 'WASTE'
}

/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type User = {
  __typename: 'User';
  addresses: Array<UserAddress>;
  /** Whether this user can access developer tools and internal dashboards */
  canAccessDevTools: Scalars['Boolean']['output'];
  collaboratedShoppingLists: Array<ShoppingList>;
  cookingLogsConnection: CookingLogConnection;
  cookingStats: Maybe<CookingStats>;
  createdAt: Scalars['DateTime']['output'];
  defaultHome: Maybe<Home>;
  defaultHomeId: Maybe<Scalars['ID']['output']>;
  defaultShoppingListId: Maybe<Scalars['ID']['output']>;
  deviceStats: DeviceStats;
  devices: DeviceConnection;
  dietaryProfile: Maybe<DietaryProfile>;
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  expirationNotificationsConnection: ExpirationNotificationConnection;
  hasUrgentNotifications: Scalars['Boolean']['output'];
  homeOwnerships: Array<HomeOwnership>;
  id: Scalars['ID']['output'];
  inviteLogsConnection: InviteLogConnection;
  language: Maybe<Scalars['String']['output']>;
  lastActiveAt: Maybe<Scalars['DateTime']['output']>;
  loginHistory: LoginHistoryConnection;
  loginHistoryStats: LoginHistoryStats;
  membershipInHome: Maybe<Membership>;
  memberships: MembershipConnection;
  moderation: Maybe<UserModeration>;
  notificationPreferences: Maybe<NotificationPreferences>;
  notificationsConnection: NotificationConnection;
  onBoarded: Scalars['Boolean']['output'];
  pendingCollaborationInvites: Array<ShoppingListCollaborator>;
  pendingHomeInvites: Array<HomeInvite>;
  preferredCurrency: Maybe<Scalars['String']['output']>;
  profile: Maybe<UserProfile>;
  purchaseStats: PurchaseStats;
  purchasesConnection: PurchaseConnection;
  role: UserRole;
  savedRecipesConnection: SavedRecipeConnection;
  sentHomeInvites: Array<HomeInvite>;
  settings: Maybe<UserSettings>;
  shoppingListInvites: Array<ShoppingListCollaborator>;
  shoppingListOwnerships: Array<ShoppingListOwnership>;
  statistics: Maybe<UserStatistics>;
  suspiciousLoginActivity: SuspiciousActivity;
  timezone: Maybe<Scalars['String']['output']>;
  unreadNotificationCount: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserCookingLogsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<CookingLogOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserDevicesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<DeviceOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserExpirationNotificationsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  input?: InputMaybe<GetExpirationNotificationsInput>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ExpirationNotificationOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserInviteLogsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<InviteLogOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserLoginHistoryArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<LoginHistoryOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserLoginHistoryStatsArgs = {
  days?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserMembershipInHomeArgs = {
  homeId: Scalars['ID']['input'];
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserMembershipsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<MembershipOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserNotificationsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<NotificationFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<NotificationOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserPurchasesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<PurchaseFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PurchaseOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserSavedRecipesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  folder?: InputMaybe<Scalars['String']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SavedRecipeOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserSuspiciousLoginActivityArgs = {
  hours?: InputMaybe<Scalars['Int']['input']>;
};

export type UserActivityPayload = {
  __typename: 'UserActivityPayload';
  activityType: UserActivityType;
  description: Scalars['String']['output'];
  metadata: Maybe<Scalars['JSON']['output']>;
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
  SocialAction = 'SOCIAL_ACTION'
}

/**
 * User address information
 * Cache: 10 minutes - addresses rarely change, always private
 */
export type UserAddress = {
  __typename: 'UserAddress';
  city: Scalars['String']['output'];
  country: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  label: Scalars['String']['output'];
  lat: Maybe<Scalars['Float']['output']>;
  lng: Maybe<Scalars['Float']['output']>;
  postalCode: Scalars['String']['output'];
  state: Scalars['String']['output'];
  street: Scalars['String']['output'];
};

export type UserAddressPayload = MutationPayload & {
  __typename: 'UserAddressPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  userAddress: Maybe<UserAddress>;
};

export type UserAuthPayload = {
  __typename: 'UserAuthPayload';
  authType: Scalars['String']['output'];
  deviceInfo: Maybe<Scalars['JSON']['output']>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export type UserChangeEvent = {
  __typename: 'UserChangeEvent';
  changeType: UserChangeType;
  profile: Maybe<UserProfile>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Maybe<Array<Scalars['String']['output']>>;
  user: Maybe<User>;
  userId: Scalars['ID']['output'];
};

export enum UserChangeType {
  Activity = 'ACTIVITY',
  ModerationChanged = 'MODERATION_CHANGED',
  ProfileChanged = 'PROFILE_CHANGED',
  StatusChanged = 'STATUS_CHANGED',
  Updated = 'UPDATED'
}

export type UserConnection = Connection & {
  __typename: 'UserConnection';
  edges: Array<UserEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

/** User connection for pagination (admin only) */
export type UserEdge = Edge & {
  __typename: 'UserEdge';
  cursor: Scalars['String']['output'];
  node: User;
};

export type UserModeration = {
  __typename: 'UserModeration';
  abuseScore: Scalars['Float']['output'];
  appealNotes: Maybe<Scalars['String']['output']>;
  appealStatus: Maybe<AppealStatus>;
  appealedAt: Maybe<Scalars['DateTime']['output']>;
  automatedFlags: Array<AutomatedFlag>;
  banReason: Maybe<Scalars['String']['output']>;
  bannedAt: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy: Maybe<User>;
  createdById: Maybe<Scalars['String']['output']>;
  deletedBy: Maybe<User>;
  deletedById: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isBanned: Scalars['Boolean']['output'];
  isSuspended: Scalars['Boolean']['output'];
  lastModifiedBy: Maybe<User>;
  lastModifiedById: Maybe<Scalars['String']['output']>;
  lastViolationAt: Maybe<Scalars['DateTime']['output']>;
  moderatorNotes: Maybe<Scalars['String']['output']>;
  restrictedUntil: Maybe<Scalars['DateTime']['output']>;
  restrictionReason: Maybe<Scalars['String']['output']>;
  restrictions: Array<ModerationRestriction>;
  reviewStartedAt: Maybe<Scalars['DateTime']['output']>;
  riskScore: Scalars['Float']['output'];
  spamScore: Scalars['Float']['output'];
  status: ModerationStatus;
  suspendedAt: Maybe<Scalars['DateTime']['output']>;
  suspendedUntil: Maybe<Scalars['DateTime']['output']>;
  suspensionReason: Maybe<Scalars['String']['output']>;
  trustLevel: TrustLevel;
  underReview: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  userId: Scalars['ID']['output'];
  version: Scalars['Int']['output'];
  violationCount: Scalars['Int']['output'];
  warningCount: Scalars['Int']['output'];
};

export type UserModerationChangedPayload = {
  __typename: 'UserModerationChangedPayload';
  moderatedBy: Scalars['String']['output'];
  moderationStatus: Scalars['String']['output'];
  moderationType: Scalars['String']['output'];
  reason: Maybe<Scalars['String']['output']>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export type UserModerationConnection = Connection & {
  __typename: 'UserModerationConnection';
  edges: Array<UserModerationEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type UserModerationEdge = Edge & {
  __typename: 'UserModerationEdge';
  cursor: Scalars['String']['output'];
  node: UserModeration;
};

export type UserModerationPayload = MutationPayload & {
  __typename: 'UserModerationPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  userModeration: Maybe<UserModeration>;
};

/** Sub-input for notification settings within user settings */
export type UserNotificationSettingsInput = {
  emailNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  expiredItemAlerts?: InputMaybe<Scalars['Boolean']['input']>;
  lowStockAlerts?: InputMaybe<Scalars['Boolean']['input']>;
  pushNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  recipeRecommendations?: InputMaybe<Scalars['Boolean']['input']>;
  shoppingListUpdates?: InputMaybe<Scalars['Boolean']['input']>;
  smsNotifications?: InputMaybe<Scalars['Boolean']['input']>;
  weeklyDigest?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Order by options for users */
export type UserOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  username?: InputMaybe<SortOrder>;
};

export type UserPayload = MutationPayload & {
  __typename: 'UserPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  user: Maybe<User>;
};

/**
 * User profile information
 * Cache: 10 minutes - profile data rarely changes, always private
 */
export type UserProfile = {
  __typename: 'UserProfile';
  avatar: Maybe<Scalars['String']['output']>;
  bio: Maybe<Scalars['String']['output']>;
  coverImage: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dateOfBirth: Maybe<Scalars['DateTime']['output']>;
  displayName: Maybe<Scalars['String']['output']>;
  firstName: Maybe<Scalars['String']['output']>;
  gender: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastName: Maybe<Scalars['String']['output']>;
  phone: Maybe<Scalars['String']['output']>;
  profileVisibility: ProfileVisibility;
  showEmail: Scalars['Boolean']['output'];
  showPhone: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
  website: Maybe<Scalars['String']['output']>;
};

export type UserProfileChangedPayload = {
  __typename: 'UserProfileChangedPayload';
  mutation: Scalars['String']['output'];
  profile: UserProfile;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
};

export type UserProfilePayload = MutationPayload & {
  __typename: 'UserProfilePayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  userProfile: Maybe<UserProfile>;
};

export enum UserRole {
  Admin = 'ADMIN',
  Moderator = 'MODERATOR',
  SuperAdmin = 'SUPER_ADMIN',
  User = 'USER'
}

/**
 * User settings and preferences
 * Cache: 10 minutes - settings rarely change, always private
 */
export type UserSettings = {
  __typename: 'UserSettings';
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
  preferredFractionSet: Maybe<Scalars['JSON']['output']>;
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

export type UserSettingsPayload = MutationPayload & {
  __typename: 'UserSettingsPayload';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  userSettings: Maybe<UserSettings>;
};

export type UserSocialPayload = {
  __typename: 'UserSocialPayload';
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
  __typename: 'UserStatistics';
  averageRatingGiven: Maybe<Scalars['Float']['output']>;
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
  userId: Scalars['ID']['output'];
};

export type UserStatusChangedPayload = {
  __typename: 'UserStatusChangedPayload';
  isOnline: Scalars['Boolean']['output'];
  lastActiveAt: Maybe<Scalars['DateTime']['output']>;
  newStatus: UserStatusType;
  previousStatus: Maybe<UserStatusType>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export enum UserStatusType {
  Away = 'AWAY',
  Busy = 'BUSY',
  Invisible = 'INVISIBLE',
  Offline = 'OFFLINE',
  Online = 'ONLINE'
}

export type UserUpdatedPayload = {
  __typename: 'UserUpdatedPayload';
  mutation: MutationType;
  node: User;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
};

export type ValidateTokenResponse = MutationPayload & {
  __typename: 'ValidateTokenResponse';
  code: Scalars['String']['output'];
  message: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
  userId: Maybe<Scalars['String']['output']>;
};

export type ValidationResult = {
  __typename: 'ValidationResult';
  errors: Array<ItemValidationError>;
  isValid: Scalars['Boolean']['output'];
  warnings: Array<ValidationWarning>;
};

export type ValidationWarning = {
  __typename: 'ValidationWarning';
  field: Scalars['String']['output'];
  message: Scalars['String']['output'];
  suggestion: Maybe<Scalars['String']['output']>;
};

/** Brand information for a product variation */
export type VariationBrandInfo = {
  __typename: 'VariationBrandInfo';
  id: Maybe<Scalars['ID']['output']>;
  name: Scalars['String']['output'];
  type: Maybe<Scalars['String']['output']>;
};

/** Image information for a product variation */
export type VariationImage = {
  __typename: 'VariationImage';
  isPrimary: Maybe<Scalars['Boolean']['output']>;
  size: Maybe<Scalars['String']['output']>;
  source: Maybe<Scalars['String']['output']>;
  url: Scalars['String']['output'];
};

export enum Visibility {
  Private = 'PRIVATE',
  Public = 'PUBLIC',
  Restricted = 'RESTRICTED'
}

/** Comprehensive waste analytics for a pantry */
export type WasteAnalytics = {
  __typename: 'WasteAnalytics';
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

/** Input for wasting a specific batch */
export type WasteBatchInput = {
  batchId: Scalars['ID']['input'];
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  wasteReason?: InputMaybe<WasteReason>;
};

/** Waste breakdown by item - most wasted items */
export type WasteByItem = {
  __typename: 'WasteByItem';
  count: Scalars['Int']['output'];
  estimatedValue: Maybe<Scalars['Float']['output']>;
  imageUrl: Maybe<Scalars['String']['output']>;
  itemId: Scalars['ID']['output'];
  itemName: Scalars['String']['output'];
  totalQuantity: Scalars['Float']['output'];
  unitName: Maybe<Scalars['String']['output']>;
};

/** Waste breakdown by reason (expired, spoiled, etc.) */
export type WasteByReason = {
  __typename: 'WasteByReason';
  count: Scalars['Int']['output'];
  estimatedValue: Maybe<Scalars['Float']['output']>;
  percentage: Scalars['Float']['output'];
  reason: WasteReason;
  totalQuantity: Scalars['Float']['output'];
};

/** Describes the reason why a pantry item was wasted or discarded */
export enum WasteReason {
  /** Overcooked or charred beyond edibility */
  Burnt = 'BURNT',
  /** Ruined during the cooking or preparation process */
  CookingFail = 'COOKING_FAIL',
  /** Item passed its expiration or best-by date */
  Expired = 'EXPIRED',
  /** Given away to someone outside the household */
  GaveAway = 'GAVE_AWAY',
  /** Developed visible mold growth */
  Mold = 'MOLD',
  /** Wasted for a reason not covered by the other options */
  Other = 'OTHER',
  /** Bought in excess and could not be used before going bad */
  Overstock = 'OVERSTOCK',
  /** Contaminated or damaged by pests or insects */
  Pest = 'PEST',
  /** Accidentally spilled or dropped */
  Spilled = 'SPILLED',
  /** Item deteriorated in quality and is no longer safe to consume */
  Spoiled = 'SPOILED',
  /** Discarded due to undesirable taste or flavor */
  Taste = 'TASTE',
  /** Lost or unaccounted for with no clear explanation */
  UnknownLoss = 'UNKNOWN_LOSS'
}

/** Sub-input for workflow/approval filters */
export type WorkflowFilterInput = {
  /** Filter by creator user ID */
  createdById?: InputMaybe<Scalars['ID']['input']>;
  /** Filter user-created items */
  isUserCreated?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter items that need admin approval */
  needsApproval?: InputMaybe<Scalars['Boolean']['input']>;
};
