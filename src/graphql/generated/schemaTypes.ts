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
  JSON: { input: JsonInput; output: JsonValue; }
  Upload: { input: { uri: string; type: string; name: string }; output: { uri: string; type: string; name: string }; }
};

export type AcceptHomeInviteInput = {
  token: Scalars['String']['input'];
};

export type AcceptHomeInvitePayload = {
  __typename: 'AcceptHomeInvitePayload';
  home: Maybe<Home>;
  membership: Membership;
};

export type AcceptHomeInviteResult = AcceptHomeInvitePayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AcceptShoppingListInviteInput = {
  token: Scalars['String']['input'];
};

export type AcceptShoppingListInvitePayload = {
  __typename: 'AcceptShoppingListInvitePayload';
  collaborator: ShoppingListCollaborator;
  shoppingList: Maybe<ShoppingList>;
};

export type AcceptShoppingListInviteResult = AcceptShoppingListInvitePayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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

/** Input for categorizing an item */
export type AddItemToCategoryInput = {
  categoryId: Scalars['ID']['input'];
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  itemId: Scalars['ID']['input'];
};

export type AddItemToCategoryPayload = {
  __typename: 'AddItemToCategoryPayload';
  itemCategory: ItemCategory;
};

export type AddItemToCategoryResult = AddItemToCategoryPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AddItemsToShoppingListInput = {
  items: Array<BatchAddShoppingListItemInput>;
  shoppingListId: Scalars['ID']['input'];
};

export type AddItemsToShoppingListPayload = {
  __typename: 'AddItemsToShoppingListPayload';
  /**
   * Per-item results, in input order. Each element carries its own
   * success/error and quantityIncremented flag (add-vs-increment split lives
   * here; increments are counted under summary.skipped).
   */
  results: Array<BatchAddShoppingListItemResult>;
  summary: BulkSummary;
};

export type AddItemsToShoppingListResult = AddItemsToShoppingListPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AddLowStockItemsToShoppingListInput = {
  homeId: Scalars['ID']['input'];
  shoppingListId?: InputMaybe<Scalars['ID']['input']>;
};

export type AddLowStockItemsToShoppingListPayload = {
  __typename: 'AddLowStockItemsToShoppingListPayload';
  addedItems: Array<AddedLowStockItem>;
  skippedItems: Array<SkippedLowStockItem>;
  summary: BulkSummary;
};

export type AddLowStockItemsToShoppingListResult = AddLowStockItemsToShoppingListPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AddPantryItemToShoppingListInput = {
  pantryItemId: Scalars['ID']['input'];
  quantity?: InputMaybe<Scalars['Float']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type AddPantryItemToShoppingListPayload = {
  __typename: 'AddPantryItemToShoppingListPayload';
  shoppingListItemId: Scalars['ID']['output'];
};

export type AddPantryItemToShoppingListResult = AddPantryItemToShoppingListPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AddRecipeToFavoritesInput = {
  folder?: InputMaybe<Scalars['String']['input']>;
  /**
   * Optional client-generated permanent ID (CUID2).
   * Offline-first clients mint this as the saved-recipe row's permanent primary
   * key so a re-synced favorite resolves to the same record (idempotent) instead
   * of duplicating. When omitted, the server generates one via @default(cuid(2)).
   * Must match the CUID2 format; invalid formats are rejected by ID validation.
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId: Scalars['ID']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type AddRecipeToFavoritesPayload = {
  __typename: 'AddRecipeToFavoritesPayload';
  /**
   * True when this call CONVERGED on a pre-existing favorite (the recipe was
   * already favorited) — it did NOT create one. Either way savedRecipe is the
   * canonical server record. The canonical, API-wide replay flag.
   */
  converged: Scalars['Boolean']['output'];
  recipe: Maybe<Recipe>;
  savedRecipe: SavedRecipe;
};

export type AddRecipeToFavoritesResult = AddRecipeToFavoritesPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/** Input for adding recipe ingredients to a shopping list */
export type AddRecipeToShoppingListInput = {
  checkPantry?: InputMaybe<Scalars['Boolean']['input']>;
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type AddRecipeToShoppingListPayload = {
  __typename: 'AddRecipeToShoppingListPayload';
  shoppingList: ShoppingList;
};

export type AddRecipeToShoppingListResult = AddRecipeToShoppingListPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AddRestrictionInput = {
  appliesToHomeId?: InputMaybe<Scalars['ID']['input']>;
  diet?: InputMaybe<Diet>;
  healthGoal?: InputMaybe<HealthGoal>;
  intolerance?: InputMaybe<Intolerance>;
  notes?: InputMaybe<Scalars['String']['input']>;
  severity: RestrictionSeverity;
};

export type AddRestrictionPayload = {
  __typename: 'AddRestrictionPayload';
  dietaryProfile: Maybe<DietaryProfile>;
  dietaryRestriction: DietaryRestriction;
};

export type AddRestrictionResult = AddRestrictionPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AddRestrictionsInput = {
  reason: Scalars['String']['input'];
  restrictedUntil?: InputMaybe<Scalars['DateTime']['input']>;
  restrictions: Array<ModerationRestriction>;
  userId: Scalars['ID']['input'];
};

export type AddTemplateItemInput = {
  dayOffset: Scalars['Int']['input'];
  /** Meal reference: exactly one of a recipe id or a custom meal name (@oneOf). */
  meal: MealRefInput;
  mealType: MealType;
  notes?: InputMaybe<Scalars['String']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  templateId: Scalars['ID']['input'];
};

export type AddTemplateItemPayload = {
  __typename: 'AddTemplateItemPayload';
  mealTemplate: Maybe<MealTemplate>;
  mealTemplateItem: MealTemplateItem;
};

export type AddTemplateItemResult = AddTemplateItemPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AddUserAddressInput = {
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

export type AddUserAddressPayload = {
  __typename: 'AddUserAddressPayload';
  userAddress: UserAddress;
};

export type AddUserAddressResult = AddUserAddressPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AddWarningInput = {
  reason: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type AddWarningPayload = {
  __typename: 'AddWarningPayload';
  userModeration: UserModeration;
};

export type AddWarningResult = AddWarningPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
  /** The actual quantity from physical count */
  newQuantity: Scalars['Float']['input'];
  /** Why the adjustment was made (required for audit trail) */
  reason: Scalars['String']['input'];
  /** Explicit remaining net weight override for full recount scenarios (dual-tracked items only) */
  remainingNetWeight?: InputMaybe<Scalars['Float']['input']>;
  /** Optimistic concurrency control — must match current version */
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type AdjustPantryItemQuantityPayload = {
  __typename: 'AdjustPantryItemQuantityPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type AdjustPantryItemQuantityResult = AdjustPantryItemQuantityPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/**
 * Input for correcting the net weight of a dual-tracked pantry item.
 * Recalculates remainingNetWeight proportionally and derives new quantity.
 */
export type AdjustPantryItemWeightInput = {
  id: Scalars['ID']['input'];
  /** The corrected net weight per unit (e.g., 12.5 for 12.5 oz per jar) */
  netWeight: Scalars['Float']['input'];
  /** Unit for the net weight (optional — only provide to also change the unit) */
  netWeightUnitId?: InputMaybe<Scalars['ID']['input']>;
  /** Why the correction is needed (required for audit trail) */
  reason: Scalars['String']['input'];
  /** Optimistic concurrency control */
  version: Scalars['Int']['input'];
};

export type AdjustPantryItemWeightPayload = {
  __typename: 'AdjustPantryItemWeightPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type AdjustPantryItemWeightResult = AdjustPantryItemWeightPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AdminBulkDeleteItemsInput = {
  ids: Array<Scalars['ID']['input']>;
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type AdminBulkDeleteItemsPayload = {
  __typename: 'AdminBulkDeleteItemsPayload';
  /** Items that were deleted by the batch. */
  items: Array<Item>;
  summary: BulkSummary;
};

export type AdminBulkDeleteItemsResult = AdminBulkDeleteItemsPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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

export type AdminDeleteImagesPayload = {
  __typename: 'AdminDeleteImagesPayload';
  /** Number of database Item records updated. */
  databaseUpdated: Scalars['Int']['output'];
  /** Number of images successfully deleted from storage. */
  deletedFromStorage: Scalars['Int']['output'];
  /** Storage deletion failures with error details. */
  failedStorage: Array<ImageDeletionError>;
  /** Job ID if the operation was queued for background processing. */
  jobId: Maybe<Scalars['String']['output']>;
  /** Total number of images requested for deletion. */
  totalRequested: Scalars['Int']['output'];
};

export type AdminDeleteImagesResult = AdminDeleteImagesPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AdminDeleteItemInput = {
  id: Scalars['ID']['input'];
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type AdminDeleteItemPayload = {
  __typename: 'AdminDeleteItemPayload';
  item: Maybe<Item>;
};

export type AdminDeleteItemResult = AdminDeleteItemPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AdminDeleteRecipeInput = {
  id: Scalars['ID']['input'];
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type AdminDeleteRecipePayload = {
  __typename: 'AdminDeleteRecipePayload';
  recipe: Maybe<Recipe>;
};

export type AdminDeleteRecipeResult = AdminDeleteRecipePayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AdminDeleteRecipeReviewInput = {
  id: Scalars['ID']['input'];
};

export type AdminDeleteRecipeReviewPayload = {
  __typename: 'AdminDeleteRecipeReviewPayload';
  recipeReview: RecipeReview;
};

export type AdminDeleteRecipeReviewResult = AdminDeleteRecipeReviewPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AdminDeleteUserInput = {
  /** If true, permanently deletes the user (SuperAdmin only) */
  hard?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
};

export type AdminDeleteUserPayload = {
  __typename: 'AdminDeleteUserPayload';
  user: Maybe<User>;
};

export type AdminDeleteUserResult = AdminDeleteUserPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/** Paginated result for admin item unit conversion listing */
export type AdminItemUnitConversionsResult = {
  __typename: 'AdminItemUnitConversionsResult';
  conversions: Array<ItemUnitConversion>;
  totalCount: Scalars['Int']['output'];
};

/**
 * Admin input to purge homes by id, bypassing ownership. Intended for data
 * consistency / cleanup of junk or test homes.
 */
export type AdminPurgeHomesInput = {
  /** Home ids to purge. */
  ids: Array<Scalars['ID']['input']>;
  /** When true, permanently hard-delete each home and ALL associated data (pantries, pantry items, shopping lists + items, meal plans, meal templates, memberships, invites, storage). When false/omitted, soft-delete the home subtree. */
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type AdminPurgeHomesPayload = {
  __typename: 'AdminPurgeHomesPayload';
  /** Homes that were purged by the batch. */
  homes: Array<Home>;
  summary: BulkSummary;
};

export type AdminPurgeHomesResult = AdminPurgeHomesPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/**
 * Admin input to purge pantry items by id, bypassing ownership. Intended for
 * cleaning up junk/test rows (e.g. E2E fixtures) that pollute the
 * RECENTLY_DELETED suggestion source.
 */
export type AdminPurgePantryItemsInput = {
  /** Pantry item row ids to delete. */
  ids: Array<Scalars['ID']['input']>;
  /** When true, hard-delete the rows (cascades photos/changes/batches, nulls usages). When false/omitted, soft-delete (sets deletedAt). */
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type AdminPurgePantryItemsPayload = {
  __typename: 'AdminPurgePantryItemsPayload';
  /** Pantry items that were purged by the batch. */
  pantryItems: Array<PantryItem>;
  summary: BulkSummary;
};

export type AdminPurgePantryItemsResult = AdminPurgePantryItemsPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/**
 * Admin input to purge shopping list items by id, bypassing ownership. Intended
 * for cleaning up junk/test rows (e.g. E2E fixtures) that pollute the
 * RECENTLY_DELETED suggestion source.
 */
export type AdminPurgeShoppingListItemsInput = {
  /** Shopping list item row ids to delete. */
  ids: Array<Scalars['ID']['input']>;
  /** When true, hard-delete the rows. When false/omitted, soft-delete (sets deletedAt). */
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type AdminPurgeShoppingListItemsPayload = {
  __typename: 'AdminPurgeShoppingListItemsPayload';
  /** Shopping list items that were purged by the batch. */
  shoppingListItems: Array<ShoppingListItem>;
  summary: BulkSummary;
};

export type AdminPurgeShoppingListItemsResult = AdminPurgeShoppingListItemsPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AdminUpdateItemPayload = {
  __typename: 'AdminUpdateItemPayload';
  item: Item;
};

export type AdminUpdateItemResult = AdminUpdateItemPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type AdminUpdateRecipePayload = {
  __typename: 'AdminUpdateRecipePayload';
  recipe: Recipe;
};

export type AdminUpdateRecipeResult = AdminUpdateRecipePayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/**
 * Admin-authority twin of updateAccount — updates any user's User row,
 * including privileged fields. Gated by @requireSystemRole(role: ADMIN); the
 * SUPER_ADMIN role ceiling is enforced in the service.
 */
export type AdminUpdateUserInput = {
  deletedAt?: InputMaybe<Scalars['DateTime']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  emailVerified?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
  onBoarded?: InputMaybe<Scalars['Boolean']['input']>;
  preferredCurrency?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<UserRole>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type AdminUpdateUserPayload = {
  __typename: 'AdminUpdateUserPayload';
  user: User;
};

export type AdminUpdateUserResult = AdminUpdateUserPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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

/**
 * Approve a primary item and merge the given secondary duplicates into it,
 * atomically.
 */
export type ApproveAndMergeInput = {
  primaryItemId: Scalars['ID']['input'];
  secondaryItemIds: Array<Scalars['ID']['input']>;
};

export type ApproveAndMergePayload = {
  __typename: 'ApproveAndMergePayload';
  item: Item;
};

export type ApproveAndMergeResult = ApproveAndMergePayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type ApproveItemInput = {
  itemId: Scalars['ID']['input'];
};

export type ApproveItemPayload = {
  __typename: 'ApproveItemPayload';
  item: Item;
};

export type ApproveItemResult = ApproveItemPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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

/**
 * Mirrors AutocompleteResult: a bounded, ranked top-N suggestion set where
 * `totalCount` is meaningful, retained as an envelope rather than a connection
 * or bare list. Named `*Result` — the `*Response` suffix is retired.
 */
export type AutocompleteCategoryResult = {
  __typename: 'AutocompleteCategoryResult';
  suggestions: Array<CategorySuggestion>;
  totalCount: Scalars['Int']['output'];
};

export type AutocompleteInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
  storeId?: InputMaybe<Scalars['ID']['input']>;
};

/**
 * Autocomplete returns a bounded, ranked top-N suggestion set (not a growable
 * Relay list); `totalCount` (how many items matched beyond the returned
 * suggestions) is meaningful, so it stays an envelope rather than a connection or
 * bare list. Named `*Result` — the `*Response` suffix is retired.
 */
export type AutocompleteResult = {
  __typename: 'AutocompleteResult';
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
  /**
   * Optional client-generated permanent ID (CUID2) for this item. Persisted as
   * the row primary key so a re-synced batch resolves to the same rows (idempotent).
   * Distinct from clientId below, which is only a response-matching token.
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  item: ItemRefInput;
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

export type BrandEdge = Edge & {
  __typename: 'BrandEdge';
  cursor: Scalars['String']['output'];
  node: Brand;
};

/** Sub-input for brand-related filters */
export type BrandFilterInput = {
  brand?: InputMaybe<Scalars['String']['input']>;
  brandIds?: InputMaybe<Array<Scalars['ID']['input']>>;
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

export type BulkCreateItemsPayload = {
  __typename: 'BulkCreateItemsPayload';
  /** Items that were created or updated by the batch. */
  items: Array<Item>;
  summary: BulkSummary;
};

export type BulkCreateItemsResult = BulkCreateItemsPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type BulkCreatePurchasesInput = {
  purchases: Array<CreatePurchaseInput>;
};

export type BulkCreatePurchasesPayload = {
  __typename: 'BulkCreatePurchasesPayload';
  purchases: Array<Purchase>;
  summary: BulkSummary;
};

export type BulkCreatePurchasesResult = BulkCreatePurchasesPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type BulkCreateStoresInput = {
  stores: Array<CreateStoreInput>;
};

export type BulkCreateStoresPayload = {
  __typename: 'BulkCreateStoresPayload';
  stores: Array<Store>;
  summary: BulkSummary;
};

export type BulkCreateStoresResult = BulkCreateStoresPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type BulkDeleteItemsInput = {
  ids: Array<Scalars['ID']['input']>;
};

export type BulkDeleteItemsPayload = {
  __typename: 'BulkDeleteItemsPayload';
  /** Items that were deleted by the batch. */
  items: Array<Item>;
  summary: BulkSummary;
};

export type BulkDeleteItemsResult = BulkDeleteItemsPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type BulkDeletePurchasesInput = {
  purchaseIds: Array<Scalars['ID']['input']>;
};

export type BulkDeletePurchasesPayload = {
  __typename: 'BulkDeletePurchasesPayload';
  /**
   * Purchases removed by the batch. Empty for hard deletes where the removed
   * rows are no longer retrievable — the counts live in the summary.
   */
  purchases: Array<Purchase>;
  summary: BulkSummary;
};

export type BulkDeletePurchasesResult = BulkDeletePurchasesPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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
  category?: InputMaybe<NotificationCategory>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  message?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  payload: Scalars['JSON']['input'];
  priority?: InputMaybe<Priority>;
  title?: InputMaybe<Scalars['String']['input']>;
  type: NotificationType;
  userIds: Array<Scalars['ID']['input']>;
};

export type BulkSendNotificationsPayload = {
  __typename: 'BulkSendNotificationsPayload';
  /** Notifications that were successfully sent. */
  sent: Array<Notification>;
  summary: BulkSummary;
};

export type BulkSendNotificationsResult = BulkSendNotificationsPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/**
 * The single canonical summary for every bulk / batch / admin-purge mutation
 * (bulk-operation-standard). Replaces the retired BulkOperationSummary and
 * BatchOperationSummary. Operation-level failure is the result union's error
 * members; per-element outcome is a per-item result type — never a
 * success/code/message triple here.
 */
export type BulkSummary = {
  __typename: 'BulkSummary';
  /** Wall-clock execution time in milliseconds. */
  executionTime: Scalars['Float']['output'];
  /** Elements that failed. */
  failed: Scalars['Int']['output'];
  /** Elements skipped (e.g. no-op, already in target state). */
  skipped: Scalars['Int']['output'];
  /** Elements that succeeded. */
  succeeded: Scalars['Int']['output'];
  /** Total elements the operation attempted. */
  total: Scalars['Int']['output'];
};

export type BulkUpdateDevicesInput = {
  ids: Array<Scalars['ID']['input']>;
  update: BulkDeviceUpdateInput;
};

export type BulkUpdateDevicesPayload = {
  __typename: 'BulkUpdateDevicesPayload';
  /** Devices that were successfully updated by the batch. */
  devices: Array<Device>;
  summary: BulkSummary;
};

export type BulkUpdateDevicesResult = BulkUpdateDevicesPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/**
 * Fields to apply to all items in a bulk update.
 * Same shape as UpdateItemInput but without id (ids are supplied separately).
 */
export type BulkUpdateItemFieldsInput = {
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

export type BulkUpdateItemsInput = {
  ids: Array<Scalars['ID']['input']>;
  update: BulkUpdateItemFieldsInput;
};

export type BulkUpdateItemsPayload = {
  __typename: 'BulkUpdateItemsPayload';
  /** Items that were updated by the batch. */
  items: Array<Item>;
  summary: BulkSummary;
};

export type BulkUpdateItemsResult = BulkUpdateItemsPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type BulkUpdateLoginHistoriesInput = {
  ids: Array<Scalars['ID']['input']>;
  update: UpdateLoginHistoryInput;
};

export type BulkUpdateLoginHistoriesPayload = {
  __typename: 'BulkUpdateLoginHistoriesPayload';
  loginHistories: Array<LoginHistory>;
  summary: BulkSummary;
};

export type BulkUpdateLoginHistoriesResult = BulkUpdateLoginHistoriesPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type BulkUpsertItemsByExternalSourceInput = {
  items: Array<BatchUpsertItemInput>;
};

export type BulkUpsertItemsByExternalSourcePayload = {
  __typename: 'BulkUpsertItemsByExternalSourcePayload';
  /**
   * Per-item upsert results, in input order. Each element carries its own
   * success/error and created flag (create-vs-update split lives here, not in
   * the summary).
   */
  results: Array<BatchUpsertItemResult>;
  summary: BulkSummary;
};

export type BulkUpsertItemsByExternalSourceResult = BulkUpsertItemsByExternalSourcePayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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

export type CancelRecurringInput = {
  id: Scalars['ID']['input'];
};

export type CancelRecurringPayload = {
  __typename: 'CancelRecurringPayload';
  shoppingList: ShoppingList;
};

export type CancelRecurringResult = CancelRecurringPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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

export type ChangePasswordPayload = {
  __typename: 'ChangePasswordPayload';
  message: Scalars['String']['output'];
  status: PasswordActionStatus;
};

export type ChangePasswordResult = ChangePasswordPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

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

export type CompleteOnboardingPayload = {
  __typename: 'CompleteOnboardingPayload';
  user: User;
};

export type CompleteOnboardingResult = CompleteOnboardingPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type CompleteShoppingListInput = {
  completedShopDate?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
  totalCost?: InputMaybe<Scalars['Float']['input']>;
};

export type CompleteShoppingListPayload = {
  __typename: 'CompleteShoppingListPayload';
  shoppingList: ShoppingList;
};

export type CompleteShoppingListResult = CompleteShoppingListPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type ConfirmItemImageUploadInput = {
  itemId: Scalars['ID']['input'];
  key: Scalars['String']['input'];
};

export type ConfirmItemImageUploadPayload = {
  __typename: 'ConfirmItemImageUploadPayload';
  url: Maybe<Scalars['String']['output']>;
};

export type ConfirmItemImageUploadResult = ConfirmItemImageUploadPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type ConfirmProfileImageUploadInput = {
  key: Scalars['String']['input'];
};

export type ConfirmProfileImageUploadPayload = {
  __typename: 'ConfirmProfileImageUploadPayload';
  url: Maybe<Scalars['String']['output']>;
};

export type ConfirmProfileImageUploadResult = ConfirmProfileImageUploadPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

/** Input for confirming recipe ingredient consumption from pantry */
export type ConfirmRecipeConsumptionInput = {
  consumptions: Array<ConfirmedIngredientConsumptionInput>;
  /**
   * Optional client-generated permanent ID (CUID2) for the cooking-log record.
   * Offline-first clients mint this so a re-synced consumption converges on the
   * same cooking log instead of creating a duplicate AND re-consuming the pantry
   * items. When omitted, the server generates one. Must match the CUID2 format.
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  pantryId: Scalars['ID']['input'];
  recipeId: Scalars['ID']['input'];
};

export type ConfirmRecipeConsumptionPayload = {
  __typename: 'ConfirmRecipeConsumptionPayload';
  /** Pantry usages recorded for the consumed ingredients. */
  consumedItems: Array<PantryItemUsage>;
  /**
   * True when this call CONVERGED on a pre-existing cooking log (a client-provided
   * id matched an existing log) — it did NOT re-consume. On a converge,
   * consumedItems is empty. The canonical, API-wide replay flag.
   */
  converged: Scalars['Boolean']['output'];
  /** The cooking log entry recorded for this consumption, if any. */
  cookingLog: Maybe<CookingLog>;
  /** Ingredients that could not be consumed (e.g. insufficient stock). */
  failedItems: Array<ConsumptionFailure>;
  totalConsumed: Scalars['Int']['output'];
  totalFailed: Scalars['Int']['output'];
};

export type ConfirmRecipeConsumptionResult = ConfirmRecipeConsumptionPayload | ConflictError | ForbiddenError | NotFoundError | ValidationError;

export type ConfirmedIngredientConsumptionInput = {
  pantryItemId: Scalars['ID']['input'];
  quantity: Scalars['Float']['input'];
  recipeIngredientId: Scalars['ID']['input'];
  unitId: Scalars['ID']['input'];
};

/**
 * The operation would violate a uniqueness, state, or optimistic-locking
 * invariant. Includes both `CONFLICT` (logical) and `VERSION_CONFLICT`
 * (optimistic locking) cases — disambiguate via `code`.
 */
export type ConflictError = Error & {
  __typename: 'ConflictError';
  code: ErrorCode;
  message: Scalars['String']['output'];
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

export type ConvertExpiredBatchesToWasteInput = {
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
  pantryItemId: Scalars['ID']['input'];
};

export type ConvertExpiredBatchesToWastePayload = {
  __typename: 'ConvertExpiredBatchesToWastePayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type ConvertExpiredBatchesToWasteResult = ConflictError | ConvertExpiredBatchesToWastePayload | ForbiddenError | NotFoundError | ValidationError;

export type ConvertExpiredToWasteInput = {
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
  pantryItemId: Scalars['ID']['input'];
};

export type ConvertExpiredToWastePayload = {
  __typename: 'ConvertExpiredToWastePayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type ConvertExpiredToWasteResult = ConflictError | ConvertExpiredToWastePayload | ForbiddenError | NotFoundError | ValidationError;

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

export type CookingLogEdge = Edge & {
  __typename: 'CookingLogEdge';
  cursor: Scalars['String']['output'];
  node: CookingLog;
};

/**
 * Consolidated real-time event envelope for a single cooking log
 * (create / update / delete). Subscribe via cookingLogEvents(cookingLogId)
 * and branch on mutation. Subscribers can only watch logs they own.
 */
export type CookingLogEvent = {
  __typename: 'CookingLogEvent';
  /** The user who caused the change. */
  actorUserId: Maybe<Scalars['ID']['output']>;
  mutation: MutationType;
  node: CookingLog;
  subtype: CookingLogSubtype;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
};

/** Order by options for cooking logs */
export type CookingLogOrderBy = {
  cookedAt?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
};

/** Subtype discriminator for cooking-log domain events. */
export enum CookingLogSubtype {
  /** A cooking log was created, updated, or deleted. */
  CookingLogChanged = 'COOKING_LOG_CHANGED'
}

export type CookingStats = {
  __typename: 'CookingStats';
  averageRating: Maybe<Scalars['Float']['output']>;
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

export type CreateBrandPayload = {
  __typename: 'CreateBrandPayload';
  brand: Brand;
};

export type CreateBrandResult = ConflictError | CreateBrandPayload | ForbiddenError | NotFoundError | ValidationError;

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

export type CreateCategoryPayload = {
  __typename: 'CreateCategoryPayload';
  category: Category;
};

export type CreateCategoryResult = ConflictError | CreateCategoryPayload | ForbiddenError | NotFoundError | ValidationError;

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

export type CreateCookingLogPayload = {
  __typename: 'CreateCookingLogPayload';
  cookingLog: CookingLog;
  recipe: Maybe<Recipe>;
};

export type CreateCookingLogResult = ConflictError | CreateCookingLogPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateCurrencyInput = {
  code: Scalars['String']['input'];
  decimalPlaces: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  symbol: Scalars['String']['input'];
};

export type CreateCurrencyPayload = {
  __typename: 'CreateCurrencyPayload';
  currency: Currency;
};

export type CreateCurrencyResult = ConflictError | CreateCurrencyPayload | ForbiddenError | NotFoundError | ValidationError;

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

export type CreateFromTemplatePayload = {
  __typename: 'CreateFromTemplatePayload';
  shoppingList: ShoppingList;
};

export type CreateFromTemplateResult = ConflictError | CreateFromTemplatePayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateHomeInput = {
  allowJoinCode?: InputMaybe<Scalars['Boolean']['input']>;
  createDefaultPantry?: InputMaybe<Scalars['Boolean']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  defaultPantryName?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  /** Optional client-generated permanent ID (CUID2) for offline-first idempotency. */
  id?: InputMaybe<Scalars['ID']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  maxMembers?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<HomeType>;
};

export type CreateHomePayload = {
  __typename: 'CreateHomePayload';
  home: Home;
};

export type CreateHomeResult = ConflictError | CreateHomePayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateImageUploadUrlInput = {
  itemId?: InputMaybe<Scalars['ID']['input']>;
  mime: Scalars['String']['input'];
  purpose: ImageUploadPurpose;
};

export type CreateImageUploadUrlPayload = {
  __typename: 'CreateImageUploadUrlPayload';
  fields: Array<UploadFormField>;
  key: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

export type CreateImageUploadUrlResult = ConflictError | CreateImageUploadUrlPayload | ForbiddenError | NotFoundError | ValidationError;

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

export type CreateItemPayload = {
  __typename: 'CreateItemPayload';
  item: Item;
  matchType: Maybe<ItemMatchType>;
};

export type CreateItemResult = ConflictError | CreateItemPayload | ForbiddenError | NotFoundError | ValidationError;

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
  /** Optional client-generated permanent ID (CUID2) for offline-first idempotency. */
  id?: InputMaybe<Scalars['ID']['input']>;
  name: Scalars['String']['input'];
  planType: MealPlanType;
  servings?: InputMaybe<Scalars['Int']['input']>;
  startDate: Scalars['DateTime']['input'];
};

export type CreateMealPlanItemInput = {
  /** Manual nutrition override - if not provided, will be pulled from recipe */
  calories?: InputMaybe<Scalars['Float']['input']>;
  carbs?: InputMaybe<Scalars['Float']['input']>;
  date: Scalars['DateTime']['input'];
  estimatedCost?: InputMaybe<Scalars['Float']['input']>;
  fat?: InputMaybe<Scalars['Float']['input']>;
  /**
   * Optional client-generated permanent ID (CUID2) for offline-first idempotency.
   * A retry converges on the existing row (its original id wins): recipe meals via
   * the (mealPlanId, date, mealType, recipeId) natural key, and custom meals (no
   * recipeId) via this client-minted id. Convergence is scoped to the target meal
   * plan, so an id colliding with another plan's item conflicts (never returns a
   * foreign row).
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Meal reference: exactly one of a recipe id or a custom meal name (@oneOf). */
  meal: MealRefInput;
  mealPlanId: Scalars['ID']['input'];
  mealType: MealType;
  notes?: InputMaybe<Scalars['String']['input']>;
  protein?: InputMaybe<Scalars['Float']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateMealPlanItemPayload = {
  __typename: 'CreateMealPlanItemPayload';
  mealPlan: Maybe<MealPlan>;
  mealPlanItem: MealPlanItem;
};

export type CreateMealPlanItemResult = ConflictError | CreateMealPlanItemPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateMealPlanPayload = {
  __typename: 'CreateMealPlanPayload';
  home: Maybe<Home>;
  mealPlan: MealPlan;
};

export type CreateMealPlanResult = ConflictError | CreateMealPlanPayload | ForbiddenError | NotFoundError | ValidationError;

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
  /** Optional client-generated permanent ID (CUID2) for offline-first idempotency. */
  id?: InputMaybe<Scalars['ID']['input']>;
  /** Initial items to add to the template */
  items?: InputMaybe<Array<MealTemplateItemInput>>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateMealTemplatePayload = {
  __typename: 'CreateMealTemplatePayload';
  home: Maybe<Home>;
  mealTemplate: MealTemplate;
};

export type CreateMealTemplateResult = ConflictError | CreateMealTemplatePayload | ForbiddenError | NotFoundError | ValidationError;

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

export type CreateMembershipPayload = {
  __typename: 'CreateMembershipPayload';
  home: Maybe<Home>;
  membership: Membership;
};

export type CreateMembershipResult = ConflictError | CreateMembershipPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateModerationRecordPayload = {
  __typename: 'CreateModerationRecordPayload';
  userModeration: UserModeration;
};

export type CreateModerationRecordResult = ConflictError | CreateModerationRecordPayload | ForbiddenError | NotFoundError | ValidationError;

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
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateNotificationPayload = {
  __typename: 'CreateNotificationPayload';
  notification: Maybe<Notification>;
};

export type CreateNotificationResult = ConflictError | CreateNotificationPayload | ForbiddenError | NotFoundError | ValidationError;

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
  /**
   * Optional client-generated permanent ID (CUID2).
   * Offline-first clients mint this as the row's permanent primary key so a
   * re-synced create resolves to the same row (idempotent) instead of duplicating.
   * When omitted, the server generates one via @default(cuid(2)).
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  temperature?: InputMaybe<Scalars['String']['input']>;
};

export type CreatePantryItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  forceAdd?: InputMaybe<Scalars['Boolean']['input']>;
  /**
   * Optional client-generated permanent ID (CUID2).
   * Offline-first clients mint this as the row's permanent primary key so a
   * re-synced create resolves to the same row (idempotent) instead of duplicating.
   * When omitted, the server generates one via @default(cuid(2)). Must match the
   * CUID2 format; invalid formats are rejected by ID validation.
   */
  id?: InputMaybe<Scalars['ID']['input']>;
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

export type CreatePantryItemPayload = {
  __typename: 'CreatePantryItemPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type CreatePantryItemResult = ConflictError | CreatePantryItemPayload | DuplicatePantryItemError | ForbiddenError | NotFoundError | ValidationError;

export type CreatePantryItemUsageInput = {
  cookingLogId?: InputMaybe<Scalars['ID']['input']>;
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
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

export type CreatePantryItemUsagePayload = {
  __typename: 'CreatePantryItemUsagePayload';
  pantry: Maybe<Pantry>;
  pantryItem: Maybe<PantryItem>;
  pantryItemUsage: PantryItemUsage;
};

export type CreatePantryItemUsageResult = ConflictError | CreatePantryItemUsagePayload | ForbiddenError | NotFoundError | ValidationError;

export type CreatePantryPayload = {
  __typename: 'CreatePantryPayload';
  home: Maybe<Home>;
  pantry: Pantry;
};

export type CreatePantryResult = ConflictError | CreatePantryPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateProfileInput = {
  bio?: InputMaybe<Scalars['String']['input']>;
  dateOfBirth?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  gender?: InputMaybe<Scalars['String']['input']>;
  /**
   * Optional client-generated permanent ID (CUID2). Note: a profile is 1:1 with
   * the user (userId is unique), so creation is already idempotent per user; this
   * is accepted for consistency with other offline-first creates.
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  profileVisibility?: InputMaybe<ProfileVisibility>;
  showEmail?: InputMaybe<Scalars['Boolean']['input']>;
  showPhone?: InputMaybe<Scalars['Boolean']['input']>;
  website?: InputMaybe<Scalars['String']['input']>;
};

export type CreateProfilePayload = {
  __typename: 'CreateProfilePayload';
  userProfile: UserProfile;
};

export type CreateProfileResult = ConflictError | CreateProfilePayload | ForbiddenError | NotFoundError | ValidationError;

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

export type CreatePurchasePayload = {
  __typename: 'CreatePurchasePayload';
  purchase: Purchase;
  store: Maybe<Store>;
};

export type CreatePurchaseResult = ConflictError | CreatePurchasePayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateRecipeInput = {
  attribution?: InputMaybe<RecipeAttributionInput>;
  description?: InputMaybe<Scalars['String']['input']>;
  dietary?: InputMaybe<DietaryTagsInput>;
  externalSourceData?: InputMaybe<Scalars['JSON']['input']>;
  externalSourceId?: InputMaybe<Scalars['String']['input']>;
  externalSourceUrl?: InputMaybe<Scalars['String']['input']>;
  /** Optional client-generated permanent ID (CUID2) for offline-first idempotency. */
  id?: InputMaybe<Scalars['ID']['input']>;
  ingredients: Array<RecipeIngredientInput>;
  instructions: Scalars['JSON']['input'];
  media?: InputMaybe<MediaAssetsInput>;
  metadata?: InputMaybe<RecipeMetadataInput>;
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  nutrition?: InputMaybe<NutritionInfoInput>;
  source?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<RecipeStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timing?: InputMaybe<TimeEstimatesInput>;
  tips?: InputMaybe<Scalars['String']['input']>;
};

export type CreateRecipePayload = {
  __typename: 'CreateRecipePayload';
  recipe: Recipe;
};

export type CreateRecipeResult = ConflictError | CreateRecipePayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateRecipeReviewInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  rating: Scalars['Int']['input'];
  recipeId: Scalars['ID']['input'];
};

export type CreateRecipeReviewPayload = {
  __typename: 'CreateRecipeReviewPayload';
  recipe: Maybe<Recipe>;
  recipeReview: RecipeReview;
};

export type CreateRecipeReviewResult = ConflictError | CreateRecipeReviewPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateRecurringShoppingListInput = {
  id: Scalars['ID']['input'];
  nextRecurringDate?: InputMaybe<Scalars['DateTime']['input']>;
  recurringInterval: Scalars['Int']['input'];
  recurringPattern: RecurringPattern;
};

export type CreateRecurringShoppingListPayload = {
  __typename: 'CreateRecurringShoppingListPayload';
  shoppingList: ShoppingList;
};

export type CreateRecurringShoppingListResult = ConflictError | CreateRecurringShoppingListPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateShoppingListInput = {
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  homeId?: InputMaybe<Scalars['ID']['input']>;
  /**
   * Optional client-generated permanent ID (CUID2).
   * Offline-first clients mint this as the row's permanent primary key so a
   * re-synced create resolves to the same row (idempotent) instead of duplicating.
   * When omitted, the server generates one via @default(cuid(2)).
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateShoppingListItemFromRecipeIngredientInput = {
  /**
   * Optional client-generated permanent ID (CUID2) for the created item;
   * persisted as the row primary key for offline-first idempotency.
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  quantityOverride?: InputMaybe<Scalars['Float']['input']>;
  recipeIngredientId: Scalars['ID']['input'];
  shoppingListId: Scalars['ID']['input'];
};

export type CreateShoppingListItemFromRecipeIngredientPayload = {
  __typename: 'CreateShoppingListItemFromRecipeIngredientPayload';
  previousQuantity: Maybe<Scalars['Float']['output']>;
  quantityAdded: Scalars['Float']['output'];
  shoppingListItem: ShoppingListItem;
  unitConversionApplied: Scalars['Boolean']['output'];
  wasUpdated: Scalars['Boolean']['output'];
};

export type CreateShoppingListItemFromRecipeIngredientResult = ConflictError | CreateShoppingListItemFromRecipeIngredientPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateShoppingListItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  category?: InputMaybe<Scalars['String']['input']>;
  /**
   * Optional client-generated permanent ID (CUID2).
   * Offline-first clients mint this as the row's permanent primary key so a
   * re-synced create resolves to the same row (idempotent) instead of duplicating.
   * When omitted, the server generates one via @default(cuid(2)). Must match the
   * CUID2 format; invalid formats are rejected by ID validation.
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  item: ItemRefInput;
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

export type CreateShoppingListItemsFromRecipePayload = {
  __typename: 'CreateShoppingListItemsFromRecipePayload';
  /** Items newly added to the shopping list. */
  addedItems: Array<ShoppingListItem>;
  /** Recipe ingredients skipped (e.g. already stocked). */
  skippedItems: Array<RecipeIngredient>;
  totalAdded: Scalars['Int']['output'];
  totalSkipped: Scalars['Int']['output'];
  totalUpdated: Scalars['Int']['output'];
  /** Existing items whose quantity was increased. */
  updatedItems: Array<ShoppingListItem>;
};

export type CreateShoppingListItemsFromRecipeResult = ConflictError | CreateShoppingListItemsFromRecipePayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateShoppingListPayload = {
  __typename: 'CreateShoppingListPayload';
  shoppingList: ShoppingList;
};

export type CreateShoppingListResult = ConflictError | CreateShoppingListPayload | ForbiddenError | NotFoundError | ValidationError;

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
  /** Optional client-generated permanent ID (CUID2) for offline-first idempotency. */
  id?: InputMaybe<Scalars['ID']['input']>;
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

export type CreateStorageLocationPayload = {
  __typename: 'CreateStorageLocationPayload';
  home: Maybe<Home>;
  storageLocation: StorageLocation;
};

export type CreateStorageLocationResult = ConflictError | CreateStorageLocationPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateStoreInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  averageShelfLife?: InputMaybe<Scalars['JSON']['input']>;
  name: Scalars['String']['input'];
  priceAccuracy?: InputMaybe<Scalars['Float']['input']>;
  qualityRating?: InputMaybe<Scalars['Float']['input']>;
  supportsPriceAPI?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateStorePayload = {
  __typename: 'CreateStorePayload';
  store: Store;
};

export type CreateStoreResult = ConflictError | CreateStorePayload | ForbiddenError | NotFoundError | ValidationError;

/** Input for creating a template from an existing meal plan */
export type CreateTemplateFromMealPlanInput = {
  category?: InputMaybe<TemplateCategory>;
  description?: InputMaybe<Scalars['String']['input']>;
  mealPlanId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateTemplateFromMealPlanPayload = {
  __typename: 'CreateTemplateFromMealPlanPayload';
  home: Maybe<Home>;
  mealTemplate: MealTemplate;
};

export type CreateTemplateFromMealPlanResult = ConflictError | CreateTemplateFromMealPlanPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateUnitConversionInput = {
  baseUnitId: Scalars['ID']['input'];
  conversionFactor: Scalars['Float']['input'];
  unitId: Scalars['ID']['input'];
};

export type CreateUnitConversionPayload = {
  __typename: 'CreateUnitConversionPayload';
  unit: Unit;
};

export type CreateUnitConversionResult = ConflictError | CreateUnitConversionPayload | ForbiddenError | NotFoundError | ValidationError;

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

export type CreateUnitPayload = {
  __typename: 'CreateUnitPayload';
  unit: Unit;
};

export type CreateUnitResult = ConflictError | CreateUnitPayload | ForbiddenError | NotFoundError | ValidationError;

export type CreateUserModerationInput = {
  moderatorNotes?: InputMaybe<Scalars['String']['input']>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
  status?: InputMaybe<ModerationStatus>;
  trustLevel?: InputMaybe<TrustLevel>;
  userId: Scalars['ID']['input'];
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

export type DeclineHomeInviteInput = {
  token: Scalars['String']['input'];
};

export type DeclineHomeInvitePayload = {
  __typename: 'DeclineHomeInvitePayload';
  home: Maybe<Home>;
  homeInvite: HomeInvite;
};

export type DeclineHomeInviteResult = ConflictError | DeclineHomeInvitePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeclineShoppingListInviteInput = {
  token: Scalars['String']['input'];
};

export type DeclineShoppingListInvitePayload = {
  __typename: 'DeclineShoppingListInvitePayload';
  collaborator: ShoppingListCollaborator;
  shoppingList: Maybe<ShoppingList>;
};

export type DeclineShoppingListInviteResult = ConflictError | DeclineShoppingListInvitePayload | ForbiddenError | NotFoundError | ValidationError;

/** Method used to deduct ingredients from pantry */
export enum DeductionMethod {
  Automatic = 'AUTOMATIC',
  Manual = 'MANUAL',
  Skipped = 'SKIPPED'
}

export type DeleteAccountPayload = {
  __typename: 'DeleteAccountPayload';
  user: Maybe<User>;
};

export type DeleteAccountResult = ConflictError | DeleteAccountPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteAllReadNotificationsPayload = {
  __typename: 'DeleteAllReadNotificationsPayload';
  notifications: Array<Notification>;
  summary: BulkSummary;
};

export type DeleteAllReadNotificationsResult = ConflictError | DeleteAllReadNotificationsPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteBrandInput = {
  id: Scalars['ID']['input'];
};

export type DeleteBrandPayload = {
  __typename: 'DeleteBrandPayload';
  brand: Brand;
};

export type DeleteBrandResult = ConflictError | DeleteBrandPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteCategoryInput = {
  id: Scalars['ID']['input'];
};

export type DeleteCategoryPayload = {
  __typename: 'DeleteCategoryPayload';
  category: Category;
};

export type DeleteCategoryResult = ConflictError | DeleteCategoryPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteCookingLogInput = {
  id: Scalars['ID']['input'];
};

export type DeleteCookingLogPayload = {
  __typename: 'DeleteCookingLogPayload';
  cookingLog: CookingLog;
  recipe: Maybe<Recipe>;
};

export type DeleteCookingLogResult = ConflictError | DeleteCookingLogPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteCurrencyInput = {
  id: Scalars['ID']['input'];
};

export type DeleteCurrencyPayload = {
  __typename: 'DeleteCurrencyPayload';
  currency: Currency;
};

export type DeleteCurrencyResult = ConflictError | DeleteCurrencyPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteDeviceInput = {
  id: Scalars['ID']['input'];
  /** Hard-delete (admin only). Defaults to a reversible soft delete. */
  permanent?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DeleteDevicePayload = {
  __typename: 'DeleteDevicePayload';
  device: Device;
};

export type DeleteDeviceResult = ConflictError | DeleteDevicePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteExpiredNotificationsPayload = {
  __typename: 'DeleteExpiredNotificationsPayload';
  notifications: Array<Notification>;
  summary: BulkSummary;
};

export type DeleteExpiredNotificationsResult = ConflictError | DeleteExpiredNotificationsPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteExternalSourceInput = {
  id: Scalars['ID']['input'];
};

export type DeleteExternalSourcePayload = {
  __typename: 'DeleteExternalSourcePayload';
  externalSourceMapping: ExternalSourceMapping;
};

export type DeleteExternalSourceResult = ConflictError | DeleteExternalSourcePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteHomeInput = {
  id: Scalars['ID']['input'];
};

export type DeleteHomeInviteInput = {
  id: Scalars['ID']['input'];
};

export type DeleteHomeInvitePayload = {
  __typename: 'DeleteHomeInvitePayload';
  home: Maybe<Home>;
  homeInvite: HomeInvite;
};

export type DeleteHomeInviteResult = ConflictError | DeleteHomeInvitePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteHomePayload = {
  __typename: 'DeleteHomePayload';
  home: Home;
};

export type DeleteHomeResult = ConflictError | DeleteHomePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteItemInput = {
  id: Scalars['ID']['input'];
};

export type DeleteItemPayload = {
  __typename: 'DeleteItemPayload';
  item: Item;
};

export type DeleteItemResult = ConflictError | DeleteItemPayload | ForbiddenError | NotFoundError | ValidationError;

/** Input for deleting an item unit conversion (admin only) */
export type DeleteItemUnitConversionInput = {
  conversionId: Scalars['ID']['input'];
};

export type DeleteItemUnitConversionPayload = {
  __typename: 'DeleteItemUnitConversionPayload';
  unitConversion: ItemUnitConversion;
};

export type DeleteItemUnitConversionResult = ConflictError | DeleteItemUnitConversionPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteMealPlanInput = {
  id: Scalars['ID']['input'];
};

export type DeleteMealPlanItemInput = {
  id: Scalars['ID']['input'];
};

export type DeleteMealPlanItemPayload = {
  __typename: 'DeleteMealPlanItemPayload';
  mealPlan: Maybe<MealPlan>;
  mealPlanItem: MealPlanItem;
};

export type DeleteMealPlanItemResult = ConflictError | DeleteMealPlanItemPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteMealPlanPayload = {
  __typename: 'DeleteMealPlanPayload';
  home: Maybe<Home>;
  mealPlan: MealPlan;
};

export type DeleteMealPlanResult = ConflictError | DeleteMealPlanPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteMealTemplateInput = {
  id: Scalars['ID']['input'];
};

export type DeleteMealTemplatePayload = {
  __typename: 'DeleteMealTemplatePayload';
  home: Maybe<Home>;
  mealTemplate: MealTemplate;
};

export type DeleteMealTemplateResult = ConflictError | DeleteMealTemplatePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteMultipleNotificationsInput = {
  ids: Array<Scalars['ID']['input']>;
};

export type DeleteMultipleNotificationsPayload = {
  __typename: 'DeleteMultipleNotificationsPayload';
  notifications: Array<Notification>;
  summary: BulkSummary;
};

export type DeleteMultipleNotificationsResult = ConflictError | DeleteMultipleNotificationsPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteNotificationInput = {
  id: Scalars['ID']['input'];
};

export type DeleteNotificationPayload = {
  __typename: 'DeleteNotificationPayload';
  notification: Notification;
};

export type DeleteNotificationResult = ConflictError | DeleteNotificationPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeletePantryInput = {
  id: Scalars['ID']['input'];
};

export type DeletePantryItemInput = {
  id: Scalars['ID']['input'];
};

export type DeletePantryItemPayload = {
  __typename: 'DeletePantryItemPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type DeletePantryItemResult = ConflictError | DeletePantryItemPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeletePantryPayload = {
  __typename: 'DeletePantryPayload';
  home: Maybe<Home>;
  pantry: Pantry;
};

export type DeletePantryResult = ConflictError | DeletePantryPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeletePurchaseInput = {
  id: Scalars['ID']['input'];
};

export type DeletePurchasePayload = {
  __typename: 'DeletePurchasePayload';
  purchase: Purchase;
  store: Maybe<Store>;
};

export type DeletePurchaseResult = ConflictError | DeletePurchasePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteRecipeFolderInput = {
  folder: Scalars['String']['input'];
  moveTo?: InputMaybe<Scalars['String']['input']>;
};

export type DeleteRecipeFolderPayload = {
  __typename: 'DeleteRecipeFolderPayload';
  /** The deleted folder label (folders are string labels, not entities). */
  folder: Scalars['String']['output'];
  /** How many saved recipes were moved out of the folder. */
  movedCount: Scalars['Int']['output'];
};

export type DeleteRecipeFolderResult = ConflictError | DeleteRecipeFolderPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteRecipeInput = {
  id: Scalars['ID']['input'];
};

export type DeleteRecipePayload = {
  __typename: 'DeleteRecipePayload';
  recipe: Recipe;
};

export type DeleteRecipeResult = ConflictError | DeleteRecipePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteRecipeReviewInput = {
  id: Scalars['ID']['input'];
};

export type DeleteRecipeReviewPayload = {
  __typename: 'DeleteRecipeReviewPayload';
  recipe: Maybe<Recipe>;
  recipeReview: RecipeReview;
};

export type DeleteRecipeReviewResult = ConflictError | DeleteRecipeReviewPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteShoppingListInput = {
  id: Scalars['ID']['input'];
};

export type DeleteShoppingListItemsInput = {
  purchased: Scalars['Boolean']['input'];
  shoppingListId: Scalars['ID']['input'];
};

export type DeleteShoppingListItemsPayload = {
  __typename: 'DeleteShoppingListItemsPayload';
  /** Shopping list items that were cleared (soft-deleted) by the batch. */
  shoppingListItems: Array<ShoppingListItem>;
  summary: BulkSummary;
};

export type DeleteShoppingListItemsResult = ConflictError | DeleteShoppingListItemsPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteShoppingListPayload = {
  __typename: 'DeleteShoppingListPayload';
  shoppingList: ShoppingList;
};

export type DeleteShoppingListReminderInput = {
  id: Scalars['ID']['input'];
};

export type DeleteShoppingListReminderPayload = {
  __typename: 'DeleteShoppingListReminderPayload';
  shoppingList: ShoppingList;
};

export type DeleteShoppingListReminderResult = ConflictError | DeleteShoppingListReminderPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteShoppingListResult = ConflictError | DeleteShoppingListPayload | ForbiddenError | NotFoundError | ValidationError;

/** Input for device cleanup operations */
export type DeleteStaleDevicesInput = {
  /** Clean up soft-deleted devices older than X days */
  deletedDevices?: InputMaybe<DeletedDeviceCleanupInput>;
  /** Clean up stale devices (not seen for X days) */
  staleDevices?: InputMaybe<StaleDeviceCleanupInput>;
};

export type DeleteStaleDevicesPayload = {
  __typename: 'DeleteStaleDevicesPayload';
  /**
   * Devices removed by the cleanup. Empty for hard-delete cleanups where the
   * removed rows are no longer retrievable — the counts live in the summary.
   */
  devices: Array<Device>;
  summary: BulkSummary;
};

export type DeleteStaleDevicesResult = ConflictError | DeleteStaleDevicesPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteStorageLocationInput = {
  id: Scalars['ID']['input'];
};

export type DeleteStorageLocationPayload = {
  __typename: 'DeleteStorageLocationPayload';
  home: Maybe<Home>;
  storageLocation: StorageLocation;
};

export type DeleteStorageLocationResult = ConflictError | DeleteStorageLocationPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteStoreInput = {
  id: Scalars['ID']['input'];
};

export type DeleteStorePayload = {
  __typename: 'DeleteStorePayload';
  store: Store;
};

export type DeleteStoreResult = ConflictError | DeleteStorePayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteUnitInput = {
  id: Scalars['ID']['input'];
};

export type DeleteUnitPayload = {
  __typename: 'DeleteUnitPayload';
  unit: Unit;
};

export type DeleteUnitResult = ConflictError | DeleteUnitPayload | ForbiddenError | NotFoundError | ValidationError;

export type DeleteUserAddressInput = {
  id: Scalars['ID']['input'];
};

export type DeleteUserAddressPayload = {
  __typename: 'DeleteUserAddressPayload';
  userAddress: UserAddress;
};

export type DeleteUserAddressResult = ConflictError | DeleteUserAddressPayload | ForbiddenError | NotFoundError | ValidationError;

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

/** Sub-input for device characteristics */
export type DeviceCharacteristicsInput = {
  hasDynamicIsland?: InputMaybe<Scalars['Boolean']['input']>;
  hasNotch?: InputMaybe<Scalars['Boolean']['input']>;
  isEmulator?: InputMaybe<Scalars['Boolean']['input']>;
  isTablet?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DeviceConnection = Connection & {
  __typename: 'DeviceConnection';
  edges: Array<DeviceEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
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

export type DeviceEdge = Edge & {
  __typename: 'DeviceEdge';
  cursor: Scalars['String']['output'];
  node: Device;
};

/**
 * Consolidated real-time event envelope for a single user's devices.
 * Subscribe once via deviceEvents(userId) and branch on subtype. For DELETED
 * the node is the (soft-deleted) row snapshot so clients can evict by node.id.
 */
export type DeviceEvent = {
  __typename: 'DeviceEvent';
  /** The user who caused the change (self-service: same as userId). */
  actorUserId: Maybe<Scalars['ID']['output']>;
  mutation: MutationType;
  node: Device;
  subtype: DeviceSubtype;
  timestamp: Scalars['DateTime']['output'];
  /** The user the device belongs to (subscription scope). */
  userId: Scalars['ID']['output'];
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
  deviceName?: InputMaybe<SortOrder>;
  lastLoginAt?: InputMaybe<SortOrder>;
  lastSeenAt?: InputMaybe<SortOrder>;
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

/** Subtype discriminator for device domain events. */
export enum DeviceSubtype {
  /** Device activity updated (last-seen, location, login count). */
  Activity = 'ACTIVITY',
  /** Device was deleted. */
  Deleted = 'DELETED',
  /** A new device was registered for the user. */
  Registered = 'REGISTERED',
  /** Device active-status flipped (activated / deactivated). */
  StatusChanged = 'STATUS_CHANGED',
  /** Device trust flipped (trusted / untrusted). */
  TrustChanged = 'TRUST_CHANGED',
  /** Device was marked verified. */
  Verified = 'VERIFIED'
}

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

/** Reusable sub-input for dietary tags */
export type DietaryTagsInput = {
  diets?: InputMaybe<Array<Diet>>;
  healthGoals?: InputMaybe<Array<HealthGoal>>;
  intolerances?: InputMaybe<Array<Intolerance>>;
};

export enum Difficulty {
  Easy = 'EASY',
  Expert = 'EXPERT',
  Hard = 'HARD',
  Medium = 'MEDIUM',
  VeryEasy = 'VERY_EASY'
}

/** Display format for quantities */
export enum DisplayFormat {
  Auto = 'AUTO',
  Decimal = 'DECIMAL',
  Fraction = 'FRACTION',
  Mixed = 'MIXED'
}

/** An item that is a UPC-duplicate of another, with its reference counts. */
export type DuplicateItem = {
  __typename: 'DuplicateItem';
  item: Item;
  references: ItemReferenceCounts;
};

export type DuplicateMealPlanInput = {
  mealPlanId: Scalars['ID']['input'];
  newEndDate: Scalars['DateTime']['input'];
  newName: Scalars['String']['input'];
  newStartDate: Scalars['DateTime']['input'];
};

export type DuplicateMealPlanPayload = {
  __typename: 'DuplicateMealPlanPayload';
  home: Maybe<Home>;
  mealPlan: MealPlan;
};

export type DuplicateMealPlanResult = ConflictError | DuplicateMealPlanPayload | ForbiddenError | NotFoundError | ValidationError;

/**
 * The pantry already has an active stack of this catalog item. Returned by
 * `createPantryItem` (unless `forceAdd` is set) so the client can route the
 * user to restock the existing item instead of creating a duplicate. The
 * `code` is `PANTRY_ITEM_ALREADY_EXISTS`.
 */
export type DuplicatePantryItemError = Error & {
  __typename: 'DuplicatePantryItemError';
  code: ErrorCode;
  /** Active pantry items already stocking this catalog item — offer a one-tap restock. */
  existingPantryItemIds: Array<Scalars['ID']['output']>;
  message: Scalars['String']['output'];
  /** Suggested client action, e.g. `RESTOCK_EXISTING`. */
  suggestion: Maybe<Scalars['String']['output']>;
};

export type DuplicateTemplateInput = {
  id: Scalars['ID']['input'];
  newName: Scalars['String']['input'];
};

export type DuplicateTemplatePayload = {
  __typename: 'DuplicateTemplatePayload';
  home: Maybe<Home>;
  mealTemplate: MealTemplate;
};

export type DuplicateTemplateResult = ConflictError | DuplicateTemplatePayload | ForbiddenError | NotFoundError | ValidationError;

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

export type EnableHomeJoinLinkInput = {
  /** ID of the home to enable the join link for. */
  id: Scalars['ID']['input'];
};

/**
 * Base interface for every mutation error variant. Every concrete error
 * type implements this so clients can write a generic
 * `... on Error { code message }` fallback alongside specific variants.
 */
export type Error = {
  code: ErrorCode;
  message: Scalars['String']['output'];
};

/**
 * Machine-readable error code. Returned on every Error implementer so
 * clients can branch on `code` without needing to inspect `__typename`
 * for common cases.
 */
export enum ErrorCode {
  AuthAccountLocked = 'AUTH_ACCOUNT_LOCKED',
  AuthCredentialsInvalid = 'AUTH_CREDENTIALS_INVALID',
  AuthTokenExpired = 'AUTH_TOKEN_EXPIRED',
  AuthTokenMissing = 'AUTH_TOKEN_MISSING',
  Conflict = 'CONFLICT',
  Deadlock = 'DEADLOCK',
  EmailAlreadyExists = 'EMAIL_ALREADY_EXISTS',
  EmailAlreadyVerified = 'EMAIL_ALREADY_VERIFIED',
  Forbidden = 'FORBIDDEN',
  HomeAccessDenied = 'HOME_ACCESS_DENIED',
  /** An idempotency-keyed operation was already applied (a safe replay). Clients should treat this as success, not a hard failure. */
  IdempotentReplay = 'IDEMPOTENT_REPLAY',
  InternalError = 'INTERNAL_ERROR',
  NotFound = 'NOT_FOUND',
  PantryItemAlreadyExists = 'PANTRY_ITEM_ALREADY_EXISTS',
  RateLimited = 'RATE_LIMITED',
  ResourceAlreadyExists = 'RESOURCE_ALREADY_EXISTS',
  UnitInvalid = 'UNIT_INVALID',
  ValidationFailed = 'VALIDATION_FAILED',
  VersionConflict = 'VERSION_CONFLICT'
}

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

export type ExpirationNotificationConnection = Connection & {
  __typename: 'ExpirationNotificationConnection';
  edges: Array<ExpirationNotificationEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type ExpirationNotificationEdge = Edge & {
  __typename: 'ExpirationNotificationEdge';
  cursor: Scalars['String']['output'];
  node: ExpirationNotification;
};

/** Filter criteria for User.expirationNotificationsConnection. */
export type ExpirationNotificationFilters = {
  pantryItemId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<NotificationDeliveryStatus>;
};

/** Order by options for expiration notifications */
export type ExpirationNotificationOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  expiresAt?: InputMaybe<SortOrder>;
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

/**
 * Caller is authenticated but not authorized for this operation. (Pure
 * authentication failures surface as top-level GraphQL errors, not as a
 * result variant.)
 */
export type ForbiddenError = Error & {
  __typename: 'ForbiddenError';
  code: ErrorCode;
  message: Scalars['String']['output'];
};

export type ForgotPasswordInput = {
  email: Scalars['String']['input'];
};

export type ForgotPasswordPayload = {
  __typename: 'ForgotPasswordPayload';
  message: Scalars['String']['output'];
  status: PasswordActionStatus;
};

export type ForgotPasswordResult = ConflictError | ForbiddenError | ForgotPasswordPayload | NotFoundError | ValidationError;

export type ForkRecipeInput = {
  id: Scalars['ID']['input'];
};

export type ForkRecipePayload = {
  __typename: 'ForkRecipePayload';
  recipe: Recipe;
};

export type ForkRecipeResult = ConflictError | ForbiddenError | ForkRecipePayload | NotFoundError | ValidationError;

export type GenerateNextRecurringListInput = {
  id: Scalars['ID']['input'];
};

export type GenerateNextRecurringListPayload = {
  __typename: 'GenerateNextRecurringListPayload';
  shoppingList: ShoppingList;
};

export type GenerateNextRecurringListResult = ConflictError | ForbiddenError | GenerateNextRecurringListPayload | NotFoundError | ValidationError;

export type GenerateShoppingListFromMealPlanInput = {
  /** Deduct pantry availability from needed quantities (default true) */
  checkPantry?: InputMaybe<Scalars['Boolean']['input']>;
  mealPlanId: Scalars['ID']['input'];
  /** Name for new list (defaults to "Shopping List for {planName}") */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Optional: add to existing list instead of creating a new one */
  shoppingListId?: InputMaybe<Scalars['ID']['input']>;
};

export type GenerateShoppingListFromMealPlanPayload = {
  __typename: 'GenerateShoppingListFromMealPlanPayload';
  shoppingList: ShoppingList;
};

export type GenerateShoppingListFromMealPlanResult = ConflictError | ForbiddenError | GenerateShoppingListFromMealPlanPayload | NotFoundError | ValidationError;

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
  /**
   * Anyone-with-link join link for this home. Joining the home also grants
   * access to its pantry, so this doubles as the pantry-share link. Null
   * unless allowJoinCode is enabled and a joinCode is set.
   */
  joinLink: Maybe<ShareLink>;
  lowStockItems: Array<LowStockItem>;
  maxMembers: Maybe<Scalars['Int']['output']>;
  mealPlansConnection: MealPlanConnection;
  mealTemplatesConnection: MealTemplateConnection;
  membersConnection: MembershipConnection;
  membershipStats: MembershipStats;
  metadata: Maybe<Scalars['JSON']['output']>;
  myMembership: Maybe<Membership>;
  name: Scalars['String']['output'];
  /** Deep link that opens this home in the app (for existing members). */
  navigateLink: ShareLink;
  pantriesConnection: PantryConnection;
  /** Deep link that opens this home's pantry in the app (for existing members). */
  pantryLink: ShareLink;
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

export type HomeEdge = Edge & {
  __typename: 'HomeEdge';
  cursor: Scalars['String']['output'];
  node: Home;
};

/**
 * Consolidated per-home event envelope. Replaces membershipChanged +
 * homeInviteChanged — subscribe once per home and branch on subtype, then on
 * node's __typename (Membership vs HomeInvite).
 */
export type HomeEvent = {
  __typename: 'HomeEvent';
  /** Originator of the change, for self-echo suppression. */
  actorUserId: Maybe<Scalars['ID']['output']>;
  homeId: Scalars['ID']['output'];
  mutation: MutationType;
  newRole: Maybe<MembershipRole>;
  node: HomeEventNode;
  previousRole: Maybe<MembershipRole>;
  subtype: HomeSubtype;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Maybe<Array<Scalars['String']['output']>>;
};

/**
 * The changed entity for a homeEvents payload: a Membership for the
 * MEMBERSHIP_* subtypes, a HomeInvite for the INVITE_* subtypes.
 */
export type HomeEventNode = HomeInvite | Membership;

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

export type HomeInviteConnection = Connection & {
  __typename: 'HomeInviteConnection';
  edges: Array<HomeInviteEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

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

export type HomeOwnershipConnection = Connection & {
  __typename: 'HomeOwnershipConnection';
  edges: Array<HomeOwnershipEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type HomeOwnershipEdge = Edge & {
  __typename: 'HomeOwnershipEdge';
  cursor: Scalars['String']['output'];
  node: HomeOwnership;
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

/** Subtype discriminator for the consolidated homeEvents stream. */
export enum HomeSubtype {
  InviteAccepted = 'INVITE_ACCEPTED',
  InviteCreated = 'INVITE_CREATED',
  InviteDeclined = 'INVITE_DECLINED',
  InviteRevoked = 'INVITE_REVOKED',
  MembershipJoined = 'MEMBERSHIP_JOINED',
  MembershipLeft = 'MEMBERSHIP_LEFT',
  MembershipRoleChanged = 'MEMBERSHIP_ROLE_CHANGED',
  MembershipUpdated = 'MEMBERSHIP_UPDATED'
}

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
export type ImageDeletionResult = {
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

export type InviteToHomePayload = {
  __typename: 'InviteToHomePayload';
  home: Maybe<Home>;
  homeInvite: HomeInvite;
};

export type InviteToHomeResult = ConflictError | ForbiddenError | InviteToHomePayload | NotFoundError | ValidationError;

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

export type InviteToShoppingListPayload = {
  __typename: 'InviteToShoppingListPayload';
  collaborator: ShoppingListCollaborator;
  shoppingList: Maybe<ShoppingList>;
};

export type InviteToShoppingListResult = ConflictError | ForbiddenError | InviteToShoppingListPayload | NotFoundError | ValidationError;

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
  priceHistory: ItemPriceHistoryConnection;
  primaryUpc: Maybe<Scalars['String']['output']>;
  servingSize: Maybe<Scalars['Float']['output']>;
  servingSizeUnit: Maybe<Scalars['String']['output']>;
  servingsPerPackage: Maybe<Scalars['Int']['output']>;
  shelfLifeDays: Maybe<Scalars['Int']['output']>;
  shelfLifeOpenedDays: Maybe<Scalars['Int']['output']>;
  showInOnboarding: Scalars['Boolean']['output'];
  status: ItemStatus;
  storageState: StorageState;
  storeSkus: ItemStoreSkuConnection;
  tags: Array<Scalars['String']['output']>;
  type: ItemType;
  unitConversionsConnection: ItemUnitConversionConnection;
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


/**
 * Item/Product catalog type
 * Cache: 30 minutes - catalog items are relatively static
 */
export type ItemPriceHistoryArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ItemPriceHistoryOrderBy>;
};


/**
 * Item/Product catalog type
 * Cache: 30 minutes - catalog items are relatively static
 */
export type ItemStoreSkusArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ItemStoreSkuOrderBy>;
};


/**
 * Item/Product catalog type
 * Cache: 30 minutes - catalog items are relatively static
 */
export type ItemUnitConversionsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ItemUnitConversionOrderBy>;
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

/** A cluster of items that share a UPC. */
export type ItemDuplicateCluster = {
  __typename: 'ItemDuplicateCluster';
  items: Array<DuplicateItem>;
  upc: Scalars['String']['output'];
};

/** A page of duplicate clusters (offset paginated). */
export type ItemDuplicateClusterPage = {
  __typename: 'ItemDuplicateClusterPage';
  clusters: Array<ItemDuplicateCluster>;
  hasMore: Scalars['Boolean']['output'];
  totalCount: Scalars['Int']['output'];
};

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

export type ItemFilters = {
  brandFilter?: InputMaybe<BrandFilterInput>;
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  category?: InputMaybe<Scalars['String']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
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
  skuStoreId?: InputMaybe<Scalars['ID']['input']>;
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

/**
 * Sort options for item lists (items, searchItems). Object-map convention:
 * set the field(s) to sort by to ASC or DESC.
 */
export type ItemOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  imageCount?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  popularity?: InputMaybe<SortOrder>;
  price?: InputMaybe<SortOrder>;
  shelfLife?: InputMaybe<SortOrder>;
  unitPrice?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
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

export type ItemPriceHistoryEdge = Edge & {
  __typename: 'ItemPriceHistoryEdge';
  cursor: Scalars['String']['output'];
  node: ItemPriceHistory;
};

export type ItemPriceHistoryOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  price?: InputMaybe<SortOrder>;
};

/**
 * Mutually-exclusive item reference: supply exactly one of an existing catalog
 * item id or a free-text name. Enforced by the GraphQL executor (@oneOf) — the
 * request is rejected before any resolver runs if zero or both are provided.
 */
export type ItemRefInput = {
  itemId?: InputMaybe<Scalars['ID']['input']>;
  itemName?: InputMaybe<Scalars['String']['input']>;
};

/** Number of records that reference an item, used to gauge the impact of a merge. */
export type ItemReferenceCounts = {
  __typename: 'ItemReferenceCounts';
  pantryItems: Scalars['Int']['output'];
  purchases: Scalars['Int']['output'];
  recipeIngredients: Scalars['Int']['output'];
  shoppingListItems: Scalars['Int']['output'];
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

export type ItemUnitConversionConnection = Connection & {
  __typename: 'ItemUnitConversionConnection';
  edges: Array<ItemUnitConversionEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type ItemUnitConversionEdge = Edge & {
  __typename: 'ItemUnitConversionEdge';
  cursor: Scalars['String']['output'];
  node: ItemUnitConversion;
};

export type ItemUnitConversionOrderBy = {
  confidence?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
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

export type JoinHomeByCodeInput = {
  joinCode: Scalars['String']['input'];
};

export type JoinHomeByCodePayload = {
  __typename: 'JoinHomeByCodePayload';
  home: Maybe<Home>;
  membership: Membership;
};

export type JoinHomeByCodeResult = ConflictError | ForbiddenError | JoinHomeByCodePayload | NotFoundError | ValidationError;

export type JoinShoppingListByShareCodeInput = {
  shareCode: Scalars['String']['input'];
};

export type JoinShoppingListByShareCodePayload = {
  __typename: 'JoinShoppingListByShareCodePayload';
  shoppingList: ShoppingList;
};

export type JoinShoppingListByShareCodeResult = ConflictError | ForbiddenError | JoinShoppingListByShareCodePayload | NotFoundError | ValidationError;

export type LeaveHomeInput = {
  homeId: Scalars['ID']['input'];
};

export type LeaveHomePayload = {
  __typename: 'LeaveHomePayload';
  home: Maybe<Home>;
  membership: Membership;
};

export type LeaveHomeResult = ConflictError | ForbiddenError | LeaveHomePayload | NotFoundError | ValidationError;

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

export type LinkItemToExternalSourcePayload = {
  __typename: 'LinkItemToExternalSourcePayload';
  externalSourceMapping: ExternalSourceMapping;
};

export type LinkItemToExternalSourceResult = ConflictError | ForbiddenError | LinkItemToExternalSourcePayload | NotFoundError | ValidationError;

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

/**
 * Consolidated real-time event envelope for a single user's login history.
 * Subscribe once via loginEvents(userId) and branch on subtype. Detection
 * criteria (riskFactors) are redacted on delivery so attackers cannot adapt.
 */
export type LoginEvent = {
  __typename: 'LoginEvent';
  /** The user who caused the change (self-service: same as userId). */
  actorUserId: Maybe<Scalars['ID']['output']>;
  /** Failure reason (FAILED). */
  failureReason: Maybe<Scalars['String']['output']>;
  mutation: MutationType;
  node: LoginHistory;
  /** Whether the login requires MFA (RISKY). */
  requiresMfa: Maybe<Scalars['Boolean']['output']>;
  /** Redacted on delivery — always empty. */
  riskFactors: Maybe<Array<Scalars['String']['output']>>;
  /** Authoritative risk score (RISKY / SUSPICIOUS). */
  riskScore: Maybe<Scalars['Float']['output']>;
  subtype: LoginSubtype;
  timestamp: Scalars['DateTime']['output'];
  /** What triggered the suspicion classification (SUSPICIOUS). */
  triggerEvent: Maybe<Scalars['String']['output']>;
  /** The user whose login history this is (subscription scope). */
  userId: Scalars['ID']['output'];
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

export type LoginHistoryEdge = Edge & {
  __typename: 'LoginHistoryEdge';
  cursor: Scalars['String']['output'];
  node: LoginHistory;
};

export type LoginHistoryOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  loginAt?: InputMaybe<SortOrder>;
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

/** Subtype discriminator for login domain events. */
export enum LoginSubtype {
  /** A successful login was recorded. */
  Attempted = 'ATTEMPTED',
  /** A failed login attempt was recorded. */
  Failed = 'FAILED',
  /** An individual login was classified as high-risk. */
  Risky = 'RISKY',
  /** An aggregate pattern of activity crossed a suspicion threshold. */
  Suspicious = 'SUSPICIOUS'
}

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

export type MarkAllNotificationsAsReadPayload = {
  __typename: 'MarkAllNotificationsAsReadPayload';
  notifications: Array<Notification>;
  summary: BulkSummary;
};

export type MarkAllNotificationsAsReadResult = ConflictError | ForbiddenError | MarkAllNotificationsAsReadPayload | NotFoundError | ValidationError;

export type MarkAsTemplateInput = {
  id: Scalars['ID']['input'];
  saveItems?: InputMaybe<Scalars['Boolean']['input']>;
  templateName: Scalars['String']['input'];
};

export type MarkAsTemplatePayload = {
  __typename: 'MarkAsTemplatePayload';
  shoppingList: ShoppingList;
};

export type MarkAsTemplateResult = ConflictError | ForbiddenError | MarkAsTemplatePayload | NotFoundError | ValidationError;

export type MarkExpirationActionInput = {
  action: ExpirationAction;
  notificationId: Scalars['ID']['input'];
};

export type MarkExpirationActionPayload = {
  __typename: 'MarkExpirationActionPayload';
  expirationNotification: ExpirationNotification;
  pantryItem: Maybe<PantryItem>;
};

export type MarkExpirationActionResult = ConflictError | ForbiddenError | MarkExpirationActionPayload | NotFoundError | ValidationError;

export type MarkExpirationNotificationAsReadInput = {
  notificationId: Scalars['ID']['input'];
};

export type MarkExpirationNotificationAsReadPayload = {
  __typename: 'MarkExpirationNotificationAsReadPayload';
  expirationNotification: ExpirationNotification;
  pantryItem: Maybe<PantryItem>;
};

export type MarkExpirationNotificationAsReadResult = ConflictError | ForbiddenError | MarkExpirationNotificationAsReadPayload | NotFoundError | ValidationError;

export type MarkHomeAsDefaultInput = {
  homeId: Scalars['ID']['input'];
};

export type MarkHomeAsDefaultPayload = {
  __typename: 'MarkHomeAsDefaultPayload';
  defaultPantry: Maybe<Pantry>;
  settings: UserSettings;
};

export type MarkHomeAsDefaultResult = ConflictError | ForbiddenError | MarkHomeAsDefaultPayload | NotFoundError | ValidationError;

export type MarkItemForReviewInput = {
  itemId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};

export type MarkItemForReviewPayload = {
  __typename: 'MarkItemForReviewPayload';
  item: Item;
};

export type MarkItemForReviewResult = ConflictError | ForbiddenError | MarkItemForReviewPayload | NotFoundError | ValidationError;

export type MarkNotificationAsReadInput = {
  id: Scalars['ID']['input'];
};

export type MarkNotificationAsReadPayload = {
  __typename: 'MarkNotificationAsReadPayload';
  notification: Notification;
};

export type MarkNotificationAsReadResult = ConflictError | ForbiddenError | MarkNotificationAsReadPayload | NotFoundError | ValidationError;

export type MarkNotificationUnreadInput = {
  id: Scalars['ID']['input'];
};

export type MarkNotificationUnreadPayload = {
  __typename: 'MarkNotificationUnreadPayload';
  notification: Notification;
};

export type MarkNotificationUnreadResult = ConflictError | ForbiddenError | MarkNotificationUnreadPayload | NotFoundError | ValidationError;

export type MarkPantryAsDefaultInput = {
  id: Scalars['ID']['input'];
};

export type MarkPantryAsDefaultPayload = {
  __typename: 'MarkPantryAsDefaultPayload';
  home: Maybe<Home>;
  pantry: Pantry;
};

export type MarkPantryAsDefaultResult = ConflictError | ForbiddenError | MarkPantryAsDefaultPayload | NotFoundError | ValidationError;

export type MarkPantryItemExpiredInput = {
  id: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type MarkPantryItemExpiredPayload = {
  __typename: 'MarkPantryItemExpiredPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type MarkPantryItemExpiredResult = ConflictError | ForbiddenError | MarkPantryItemExpiredPayload | NotFoundError | ValidationError;

/** Input for marking a recipe as cooked */
export type MarkRecipeAsCookedInput = {
  deductFromPantry: Scalars['Boolean']['input'];
  /**
   * Optional client-generated permanent ID (CUID2) for the cooking-log record.
   * Offline-first clients mint this so a re-synced "I cooked this" converges on
   * the same cooking log instead of creating a duplicate AND re-deducting the
   * pantry. When omitted, the server generates one via @default(cuid(2)). Must
   * match the CUID2 format; invalid formats are rejected by ID validation.
   */
  id?: InputMaybe<Scalars['ID']['input']>;
  ingredientsUsed?: InputMaybe<Array<IngredientUsageInput>>;
  notes?: InputMaybe<Scalars['String']['input']>;
  recipeId: Scalars['ID']['input'];
  servings?: InputMaybe<Scalars['Float']['input']>;
};

export type MarkRecipeAsCookedPayload = {
  __typename: 'MarkRecipeAsCookedPayload';
  /**
   * True when this call CONVERGED on a pre-existing cooking log (a client-provided
   * id matched an existing log) — it did NOT re-log or re-deduct the pantry. The
   * canonical, API-wide replay flag; clients treat converged=true as already-synced.
   */
  converged: Scalars['Boolean']['output'];
  cookingLog: CookingLog;
  recipe: Maybe<Recipe>;
};

export type MarkRecipeAsCookedResult = ConflictError | ForbiddenError | MarkRecipeAsCookedPayload | NotFoundError | ValidationError;

export type MarkShoppingListActiveInput = {
  id: Scalars['ID']['input'];
};

export type MarkShoppingListActivePayload = {
  __typename: 'MarkShoppingListActivePayload';
  shoppingList: ShoppingList;
};

export type MarkShoppingListActiveResult = ConflictError | ForbiddenError | MarkShoppingListActivePayload | NotFoundError | ValidationError;

export type MarkShoppingListAsDefaultInput = {
  id: Scalars['ID']['input'];
};

export type MarkShoppingListAsDefaultPayload = {
  __typename: 'MarkShoppingListAsDefaultPayload';
  shoppingList: ShoppingList;
};

export type MarkShoppingListAsDefaultResult = ConflictError | ForbiddenError | MarkShoppingListAsDefaultPayload | NotFoundError | ValidationError;

export type MarkStorageLocationAsDefaultInput = {
  id: Scalars['ID']['input'];
};

export type MarkStorageLocationAsDefaultPayload = {
  __typename: 'MarkStorageLocationAsDefaultPayload';
  home: Maybe<Home>;
  storageLocation: StorageLocation;
};

export type MarkStorageLocationAsDefaultResult = ConflictError | ForbiddenError | MarkStorageLocationAsDefaultPayload | NotFoundError | ValidationError;

/** Input to restore a previously-dismissed item so it can be suggested again. */
export type MarkSuggestionActiveInput = {
  /** Catalog item to start suggesting again. */
  itemId: Scalars['ID']['input'];
  /** Which surface to restore it on (pantry vs shopping). */
  surface: SuggestionSurface;
};

export type MarkSuggestionActivePayload = {
  __typename: 'MarkSuggestionActivePayload';
  /** Always false — the item can be suggested again on this surface. */
  dismissed: Scalars['Boolean']['output'];
  /** The item the dismissal was removed for. */
  itemId: Scalars['ID']['output'];
  /** Surface the item was restored on. */
  surface: SuggestionSurface;
};

export type MarkSuggestionActiveResult = ConflictError | ForbiddenError | MarkSuggestionActivePayload | NotFoundError | ValidationError;

/** Input to hide a catalog item from a user's suggestions on a given surface. */
export type MarkSuggestionDismissedInput = {
  /** Catalog item to stop suggesting. */
  itemId: Scalars['ID']['input'];
  /** Which surface to hide it from (pantry vs shopping). */
  surface: SuggestionSurface;
};

export type MarkSuggestionDismissedPayload = {
  __typename: 'MarkSuggestionDismissedPayload';
  /** Always true — the item is now dismissed on this surface. */
  dismissed: Scalars['Boolean']['output'];
  /** The item the dismissal applies to. */
  itemId: Scalars['ID']['output'];
  /** Surface the dismissal applies to. */
  surface: SuggestionSurface;
};

export type MarkSuggestionDismissedResult = ConflictError | ForbiddenError | MarkSuggestionDismissedPayload | NotFoundError | ValidationError;

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

export type MealPlanEdge = Edge & {
  __typename: 'MealPlanEdge';
  cursor: Scalars['String']['output'];
  node: MealPlan;
};

/**
 * Real-time notification for shared meal-plan and meal-template mutations within
 * a home. Lets collaborating clients stay in sync via push instead of polling;
 * discriminate by subtype (and node's __typename) to interpret the payload.
 * Only home-shared plans/templates (homeId set) are pushed — personal ones need
 * no collaboration channel.
 */
export type MealPlanEvent = {
  __typename: 'MealPlanEvent';
  actorUserId: Maybe<Scalars['ID']['output']>;
  homeId: Scalars['ID']['output'];
  /** Set for MEAL_PLAN_CHANGED / MEAL_PLAN_ITEM_CHANGED events. */
  mealPlanId: Maybe<Scalars['ID']['output']>;
  mutation: MutationType;
  node: Maybe<MealPlanEventNode>;
  subtype: MealPlanSubtype;
  /** Set for MEAL_TEMPLATE_CHANGED / MEAL_TEMPLATE_ITEM_CHANGED events. */
  templateId: Maybe<Scalars['ID']['output']>;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Array<Scalars['String']['output']>;
};

export type MealPlanEventNode = MealPlan | MealPlanItem | MealTemplate | MealTemplateItem;

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

/** Subtype discriminator for meal-plan / meal-template collaboration events. */
export enum MealPlanSubtype {
  /** A shared meal plan was created, updated, or soft-deleted. node is a MealPlan. */
  MealPlanChanged = 'MEAL_PLAN_CHANGED',
  /** A meal plan item was created, updated, or deleted. node is a MealPlanItem. */
  MealPlanItemChanged = 'MEAL_PLAN_ITEM_CHANGED',
  /**
   * A shared meal template was created, updated, or soft-deleted. node is a
   * MealTemplate.
   */
  MealTemplateChanged = 'MEAL_TEMPLATE_CHANGED',
  /**
   * A meal template item was added, updated, or removed. node is a
   * MealTemplateItem.
   */
  MealTemplateItemChanged = 'MEAL_TEMPLATE_ITEM_CHANGED'
}

export enum MealPlanType {
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY'
}

/**
 * Mutually-exclusive meal reference: supply exactly one of a recipe id or a
 * free-text custom meal name. Enforced by the GraphQL executor (@oneOf) — the
 * request is rejected before any resolver runs if zero or both are provided.
 */
export type MealRefInput = {
  customMealName?: InputMaybe<Scalars['String']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
};

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
  dayOffset: Scalars['Int']['input'];
  /** Meal reference: exactly one of a recipe id or a custom meal name (@oneOf). */
  meal: MealRefInput;
  mealType: MealType;
  notes?: InputMaybe<Scalars['String']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

/** Order by options for meal templates */
export type MealTemplateOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  updatedAt?: InputMaybe<SortOrder>;
  usageCount?: InputMaybe<SortOrder>;
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

export type MembershipConnection = Connection & {
  __typename: 'MembershipConnection';
  edges: Array<MembershipEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

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
  homeId: Scalars['ID']['output'];
  joinMethod: MembershipJoinMethod;
  membership: Membership;
  userId: Scalars['ID']['output'];
};

export enum MembershipLeftMethod {
  Removed = 'REMOVED',
  Suspended = 'SUSPENDED',
  Voluntary = 'VOLUNTARY'
}

export type MembershipLeftPayload = {
  __typename: 'MembershipLeftPayload';
  homeId: Scalars['ID']['output'];
  leftMethod: MembershipLeftMethod;
  membership: Membership;
  userId: Scalars['ID']['output'];
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
  homeId: Scalars['ID']['output'];
  membership: Membership;
  newRole: MembershipRole;
  previousRole: MembershipRole;
  userId: Scalars['ID']['output'];
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

/**
 * Merge one or more secondary items into a primary. References on the
 * secondaries are retargeted onto the primary and the secondaries are deleted.
 */
export type MergeItemsInput = {
  primaryItemId: Scalars['ID']['input'];
  secondaryItemIds: Array<Scalars['ID']['input']>;
};

export type MergeItemsPayload = {
  __typename: 'MergeItemsPayload';
  item: Item;
};

export type MergeItemsResult = ConflictError | ForbiddenError | MergeItemsPayload | NotFoundError | ValidationError;

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

export type MovePurchasedItemsToPantryInput = {
  shoppingListId: Scalars['ID']['input'];
};

export type MovePurchasedItemsToPantryPayload = {
  __typename: 'MovePurchasedItemsToPantryPayload';
  /** Items that were successfully moved from the shopping list into the pantry. */
  movedItems: Array<MovedItemInfo>;
  summary: BulkSummary;
};

export type MovePurchasedItemsToPantryResult = ConflictError | ForbiddenError | MovePurchasedItemsToPantryPayload | NotFoundError | ValidationError;

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
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
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

export type MoveShoppingItemToPantryPayload = {
  __typename: 'MoveShoppingItemToPantryPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type MoveShoppingItemToPantryResult = ConflictError | ForbiddenError | MoveShoppingItemToPantryPayload | NotFoundError | ValidationError;

export type MoveShoppingListItemInput = {
  afterItemId?: InputMaybe<Scalars['ID']['input']>;
  beforeItemId?: InputMaybe<Scalars['ID']['input']>;
  itemId: Scalars['ID']['input'];
};

export type MoveShoppingListItemPayload = {
  __typename: 'MoveShoppingListItemPayload';
  shoppingList: Maybe<ShoppingList>;
  shoppingListItem: ShoppingListItem;
};

export type MoveShoppingListItemResult = ConflictError | ForbiddenError | MoveShoppingListItemPayload | NotFoundError | ValidationError;

/**
 * Info about a successfully moved item (the per-element entity of
 * movePurchasedItemsToPantry).
 */
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

/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type Mutation = {
  __typename: 'Mutation';
  /** Accept a home invitation using its token. */
  acceptHomeInvite: AcceptHomeInviteResult;
  /** Accept an invitation to collaborate on a shopping list. */
  acceptShoppingListInvite: AcceptShoppingListInviteResult;
  /** Add an item to a category. */
  addItemToCategory: AddItemToCategoryResult;
  /**
   * Batch add multiple items to a shopping list.
   * More efficient than calling addItemToShoppingList multiple times.
   * Max 50 items per batch.
   */
  addItemsToShoppingList: AddItemsToShoppingListResult;
  /**
   * Add all low stock items from a home's pantries to a shopping list.
   * If no shoppingListId is provided, uses the home's default shopping list.
   */
  addLowStockItemsToShoppingList: AddLowStockItemsToShoppingListResult;
  /**
   * Add a specific pantry item to a shopping list.
   * Useful for manually adding items when running low.
   */
  addPantryItemToShoppingList: AddPantryItemToShoppingListResult;
  /**
   * Add a recipe to the user's favorites (creates a saved recipe with optional
   * folder/tags/notes).
   */
  addRecipeToFavorites: AddRecipeToFavoritesResult;
  /**
   * Add a recipe's ingredients to a shopping list, pantry-deficit-aware: checks
   * the pantry and adds only the shortfall (with smart unit handling). Use
   * createShoppingListItemsFromRecipe instead to add every ingredient in full
   * regardless of pantry stock — the two are intentional variants (see
   * graphql-operation-conventions.md §5), not duplicates.
   */
  addRecipeToShoppingList: AddRecipeToShoppingListResult;
  /** Add a dietary restriction to the user's profile. */
  addRestriction: AddRestrictionResult;
  /** Add an item to a template */
  addTemplateItem: AddTemplateItemResult;
  /** Add a new address to the current user's account. */
  addUserAddress: AddUserAddressResult;
  /**
   * Adjust pantry item quantity to match a physical count. Creates an ADJUSTMENT
   * usage record with a mandatory reason for the audit trail; the delta
   * (positive or negative) is computed automatically. For a plain quantity set
   * with no audit record, use updatePantryItemQuantity — the two are intentional
   * variants (see graphql-operation-conventions.md §5): audited adjust vs.
   * quick set.
   */
  adjustPantryItemQuantity: AdjustPantryItemQuantityResult;
  /**
   * Adjust the net weight for a dual-tracked pantry item.
   * Recalculates remainingNetWeight proportionally and derives new quantity.
   * Use this when the original net weight was entered incorrectly.
   */
  adjustPantryItemWeight: AdjustPantryItemWeightResult;
  /** Create multiple items at once */
  bulkCreateItems: BulkCreateItemsResult;
  /** Create multiple purchase records at once. */
  bulkCreatePurchases: BulkCreatePurchasesResult;
  bulkCreateStores: BulkCreateStoresResult;
  /** Delete multiple items */
  bulkDeleteItems: BulkDeleteItemsResult;
  /** Delete multiple purchase records at once. */
  bulkDeletePurchases: BulkDeletePurchasesResult;
  /**
   * Bulk update multiple devices at once.
   * Replaces: trustMultipleDevices, untrustMultipleDevices, deactivateMultipleDevices, deleteMultipleDevices
   */
  bulkUpdateDevices: BulkUpdateDevicesResult;
  /**
   * Update multiple items with the same changes.
   * Note: the `id` field on `update` is ignored — ids are taken from the `ids` field.
   */
  bulkUpdateItems: BulkUpdateItemsResult;
  /** Bulk create or update items by external source (max 50 per batch). */
  bulkUpsertItemsByExternalSource: BulkUpsertItemsByExternalSourceResult;
  /** Cancel recurring generation for a shopping list. */
  cancelRecurring: CancelRecurringResult;
  /** Change password for authenticated user (requires current password verification) */
  changePassword: ChangePasswordResult;
  /** Mark user onboarding as complete and send welcome email */
  completeOnboarding: CompleteOnboardingResult;
  /** Mark a shopping list as completed. */
  completeShoppingList: CompleteShoppingListResult;
  /** Confirm an item image upload and associate it with the item. */
  confirmItemImageUpload: ConfirmItemImageUploadResult;
  /** Confirm a profile image upload and associate it with the user. */
  confirmProfileImageUpload: ConfirmProfileImageUploadResult;
  /**
   * Record consumption of a recipe by deducting the exact pantry items the
   * client specifies per ingredient (recipeIngredientId → pantryItemId +
   * quantity + unit). Use this for the reviewed, item-level flow where the user
   * confirms specific allocations. For the quick "I cooked this" flow with
   * automatic FIFO deduction, use markRecipeAsCooked instead.
   */
  confirmRecipeConsumption: ConfirmRecipeConsumptionResult;
  /**
   * Convert only expired batches to waste within a pantry item.
   * Non-expired batches remain active. Aggregate is recalculated.
   */
  convertExpiredBatchesToWaste: ConvertExpiredBatchesToWasteResult;
  /**
   * Convert an expired pantry item to waste in one step.
   * Sets condition to SPOILED, creates a WASTE usage record with wasteReason=EXPIRED,
   * and sets quantity to 0. Use after expiration job marks item as EXPIRED.
   */
  convertExpiredToWaste: ConvertExpiredToWasteResult;
  /** Create a new brand. */
  createBrand: CreateBrandResult;
  /** Create a new category. */
  createCategory: CreateCategoryResult;
  /** Create a new cooking log entry. */
  createCookingLog: CreateCookingLogResult;
  /** Create a new currency. */
  createCurrency: CreateCurrencyResult;
  /** Create a new shopping list from a template. */
  createFromTemplate: CreateFromTemplateResult;
  /** Create a new home. */
  createHome: CreateHomeResult;
  /** Generate a presigned URL for image upload with purpose validation. */
  createImageUploadUrl: CreateImageUploadUrlResult;
  /** Create a new item */
  createItem: CreateItemResult;
  /** Create a new meal plan. */
  createMealPlan: CreateMealPlanResult;
  /**
   * Create a new meal plan from a template.
   * Copies all template items to the new plan with dates offset from startDate.
   */
  createMealPlanFromTemplate: CreateMealPlanResult;
  /** Add an item to a meal plan. */
  createMealPlanItem: CreateMealPlanItemResult;
  /** Create a new meal template */
  createMealTemplate: CreateMealTemplateResult;
  /** Create a new membership directly (owner/admin only). */
  createMembership: CreateMembershipResult;
  /** Create a new notification. */
  createNotification: CreateNotificationResult;
  /** Create a new pantry for a home. */
  createPantry: CreatePantryResult;
  /** Create a new pantry item in a pantry. */
  createPantryItem: CreatePantryItemResult;
  /** Record a usage event for a pantry item. */
  createPantryItemUsage: CreatePantryItemUsageResult;
  /** Create a user profile for the current user. */
  createProfile: CreateProfileResult;
  /** Create a new purchase record. */
  createPurchase: CreatePurchaseResult;
  createRecipe: CreateRecipeResult;
  /** Create a review for a published recipe. */
  createRecipeReview: CreateRecipeReviewResult;
  /** Create recurring generation for a shopping list. */
  createRecurringShoppingList: CreateRecurringShoppingListResult;
  /** Create a new shopping list. */
  createShoppingList: CreateShoppingListResult;
  /**
   * Add a SINGLE recipe ingredient to a shopping list (smart-merge: if the item
   * already exists, quantities are added with unit conversion). This is the
   * per-ingredient variant of createShoppingListItemsFromRecipe (which adds the
   * whole recipe at once) — the two are intentional variants (see
   * graphql-operation-conventions.md §5), not duplicates:
   * use this to add one ingredient, the plural op to add them all.
   */
  createShoppingListItemFromRecipeIngredient: CreateShoppingListItemFromRecipeIngredientResult;
  /**
   * Add every ingredient of a recipe to a shopping list in full (scaling
   * quantities when servings differ), without checking the pantry. Use
   * addRecipeToShoppingList instead for the pantry-deficit-aware variant that
   * adds only the shortfall — the two are intentional variants (see
   * graphql-operation-conventions.md §5), not duplicates.
   */
  createShoppingListItemsFromRecipe: CreateShoppingListItemsFromRecipeResult;
  /**
   * Create a new storage location
   * Validates parent-child relationships and prevents circular references
   * Requires user to have edit permissions in the home
   */
  createStorageLocation: CreateStorageLocationResult;
  createStore: CreateStoreResult;
  /**
   * Create a template from an existing meal plan.
   * Extracts the meal pattern into a reusable template.
   */
  createTemplateFromMealPlan: CreateTemplateFromMealPlanResult;
  /** Create a new unit of measurement. */
  createUnit: CreateUnitResult;
  /** Create a conversion factor between a unit and its base unit. */
  createUnitConversion: CreateUnitConversionResult;
  /** Decline a home invitation using its token. */
  declineHomeInvite: DeclineHomeInviteResult;
  /** Decline an invitation to collaborate on a shopping list. */
  declineShoppingListInvite: DeclineShoppingListInviteResult;
  /** Delete the current user's account. */
  deleteAccount: DeleteAccountResult;
  /** Delete all read notifications for the current user. */
  deleteAllReadNotifications: DeleteAllReadNotificationsResult;
  /** Delete a brand. */
  deleteBrand: DeleteBrandResult;
  /** Delete a category. */
  deleteCategory: DeleteCategoryResult;
  /** Delete a cooking log entry. */
  deleteCookingLog: DeleteCookingLogResult;
  /** Delete a currency. */
  deleteCurrency: DeleteCurrencyResult;
  /**
   * Delete a device. Soft-deletes (reversible) by default; pass
   * permanent: true for a hard delete (admin only).
   */
  deleteDevice: DeleteDeviceResult;
  /** Delete an external source mapping. */
  deleteExternalSource: DeleteExternalSourceResult;
  /** Delete a home (owner only). */
  deleteHome: DeleteHomeResult;
  /** Delete a pending home invitation. */
  deleteHomeInvite: DeleteHomeInviteResult;
  /** Delete an item (soft delete by default, permanent if specified) */
  deleteItem: DeleteItemResult;
  /** Delete a meal plan. */
  deleteMealPlan: DeleteMealPlanResult;
  /** Remove an item from a meal plan. */
  deleteMealPlanItem: DeleteMealPlanItemResult;
  /** Delete a meal template (soft delete) */
  deleteMealTemplate: DeleteMealTemplateResult;
  /** Delete multiple notifications by their IDs. */
  deleteMultipleNotifications: DeleteMultipleNotificationsResult;
  /** Delete a notification. */
  deleteNotification: DeleteNotificationResult;
  /** Delete a pantry (owner only). */
  deletePantry: DeletePantryResult;
  /** Delete a pantry item (soft delete). */
  deletePantryItem: DeletePantryItemResult;
  /** Delete a purchase record. */
  deletePurchase: DeletePurchaseResult;
  deleteRecipe: DeleteRecipeResult;
  /** Delete a recipe folder and optionally move its recipes. */
  deleteRecipeFolder: DeleteRecipeFolderResult;
  /** Delete a recipe review (author only). */
  deleteRecipeReview: DeleteRecipeReviewResult;
  /** Delete a shopping list (owner only). */
  deleteShoppingList: DeleteShoppingListResult;
  /**
   * Delete items from a shopping list based on purchased status.
   * Soft-deletes all items matching the purchased filter and where deletedAt is not set.
   * Use purchased=true to delete purchased items, purchased=false to delete unpurchased items.
   * Returns summary with count of deleted items.
   */
  deleteShoppingListItems: DeleteShoppingListItemsResult;
  /** Delete the reminder from a shopping list. */
  deleteShoppingListReminder: DeleteShoppingListReminderResult;
  /**
   * Delete a storage location (soft delete)
   * Fails if location has child locations or items
   * Requires user to have edit permissions in the home
   */
  deleteStorageLocation: DeleteStorageLocationResult;
  deleteStore: DeleteStoreResult;
  /** Delete a unit of measurement. */
  deleteUnit: DeleteUnitResult;
  /** Delete a user address. */
  deleteUserAddress: DeleteUserAddressResult;
  /** Duplicate a meal plan with all its items, shifted to new dates. */
  duplicateMealPlan: DuplicateMealPlanResult;
  /** Duplicate a template with a new name */
  duplicateTemplate: DuplicateTemplateResult;
  /**
   * Enable the anyone-with-link join code for a home (doubles as the
   * pantry-share link). Idempotent — preserves an existing code so links
   * already shared keep working. Read the resulting link via home.joinLink.
   */
  enableHomeJoinLink: UpdateHomeResult;
  /** Request a password reset email */
  forgotPassword: ForgotPasswordResult;
  forkRecipe: ForkRecipeResult;
  /** Generate the next recurring shopping list instance. */
  generateNextRecurringList: GenerateNextRecurringListResult;
  /** Generate a shopping list from all recipe-based items in a meal plan. */
  generateShoppingListFromMealPlan: GenerateShoppingListFromMealPlanResult;
  /** Send an invitation for a user to join a home. */
  inviteToHome: InviteToHomeResult;
  /** Invite a user to collaborate on a shopping list. */
  inviteToShoppingList: InviteToShoppingListResult;
  /** Join a home using its join code. */
  joinHomeByCode: JoinHomeByCodeResult;
  /** Join a shared shopping list using its share code. */
  joinShoppingListByShareCode: JoinShoppingListByShareCodeResult;
  /** Leave a home as the current user. */
  leaveHome: LeaveHomeResult;
  /** Link an existing item to an external source. */
  linkItemToExternalSource: LinkItemToExternalSourceResult;
  /** Authenticate a user with credentials and return tokens. */
  login: AuthPayload;
  /** Mark all notifications as read for the current user. */
  markAllNotificationsAsRead: MarkAllNotificationsAsReadResult;
  /** Mark a shopping list as a reusable template. */
  markAsTemplate: MarkAsTemplateResult;
  /** Record an action taken on an expiring item. */
  markExpirationAction: MarkExpirationActionResult;
  /**
   * Mark an expiration notification as read (the canonical read/dismiss op —
   * the former markExpirationNotificationDismissed was merged into this in the
   * 2026 cutover; read is the single acknowledged state).
   */
  markExpirationNotificationAsRead: MarkExpirationNotificationAsReadResult;
  /** Mark a home as the default for the current user. */
  markHomeAsDefault: MarkHomeAsDefaultResult;
  /** Mark an item for review */
  markItemForReview: MarkItemForReviewResult;
  /** Mark a notification as read. */
  markNotificationAsRead: MarkNotificationAsReadResult;
  /** Mark a notification as unread. */
  markNotificationUnread: MarkNotificationUnreadResult;
  /** Mark a pantry as the default for its home. */
  markPantryAsDefault: MarkPantryAsDefaultResult;
  /** Mark a pantry item as expired. */
  markPantryItemExpired: MarkPantryItemExpiredResult;
  /**
   * Mark a recipe as cooked, logging it and (optionally) auto-deducting its
   * ingredients from the pantry by FIFO matching. Use this for the quick
   * "I cooked this" flow. For reviewed, item-level deduction where the client
   * supplies the exact pantry items/quantities consumed, use
   * confirmRecipeConsumption instead.
   */
  markRecipeAsCooked: MarkRecipeAsCookedResult;
  /** Mark a completed shopping list active again. */
  markShoppingListActive: MarkShoppingListActiveResult;
  /** Mark a shopping list as the default. */
  markShoppingListAsDefault: MarkShoppingListAsDefaultResult;
  /**
   * Mark a storage location as the default for its home.
   * Automatically unsets the previous default location.
   * Requires user to have edit permissions in the home.
   */
  markStorageLocationAsDefault: MarkStorageLocationAsDefaultResult;
  /**
   * Mark a previously-dismissed item active again so it can appear in your
   * suggestions on the given surface.
   */
  markSuggestionActive: MarkSuggestionActiveResult;
  /**
   * Mark a catalog item dismissed from your pantry or shopping suggestions
   * ("stop suggesting this"). Non-destructive and reversible via
   * markSuggestionActive — the item's history and frequency data are preserved.
   * Affects the RECENTLY_DELETED, FREQUENTLY_ADDED, and POPULAR sources on the
   * chosen surface; low-stock and expiring-soon alerts are never suppressed.
   * Dismissals are per-user, so on shared lists/homes only your own
   * suggestions are affected.
   */
  markSuggestionDismissed: MarkSuggestionDismissedResult;
  /**
   * Move all purchased items from a shopping list to the home's default pantry.
   * Only available for shopping lists linked to a home.
   * Items without an itemId (custom items not in catalog) will be skipped.
   */
  movePurchasedItemsToPantry: MovePurchasedItemsToPantryResult;
  /**
   * Move a shopping list item to the pantry after purchase.
   * Creates a PantryItem with full traceability back to the shopping list item.
   * Optionally removes the item from the shopping list.
   */
  moveShoppingItemToPantry: MoveShoppingItemToPantryResult;
  /** Reorder a shopping list item relative to other items. */
  moveShoppingListItem: MoveShoppingListItemResult;
  /** Mark a pantry item as opened. */
  openPantryItem: OpenPantryItemResult;
  /**
   * Mark a specific batch as opened.
   * Sets isOpened=true and openedAt to current time on the targeted batch.
   */
  openPantryItemBatch: OpenPantryItemBatchResult;
  /** Record an increment to an item's popularity counter. */
  recordItemPopularity: RecordItemPopularityResult;
  /**
   * Record a login event. Consolidates recordLoginAttempt and createLoginHistory.
   * Use for all login recording — both high-level attempts and direct history creation.
   */
  recordLogin: RecordLoginResult;
  /** Record a price observation for historical tracking */
  recordPriceObservation: RecordPriceObservationResult;
  /** Record that a saved recipe was cooked (increments the cooked count). */
  recordRecipeCooked: RecordRecipeCookedResult;
  /** Refresh an expired access token using a refresh token. */
  refresh: RefreshTokenPayload;
  /**
   * Register a new user account. Existence-blind and verification-first: always
   * returns the same result and (for an available email) sends a verification
   * link. It never returns tokens — the user activates via the emailed link,
   * then signs in with `login`.
   */
  register: RegisterResult;
  /**
   * Register a new device for the current user.
   * This is the primary way to add a device from mobile apps.
   */
  registerDevice: RegisterDeviceResult;
  /** Remove an item from a category. */
  removeItemFromCategory: RemoveItemFromCategoryResult;
  /** Remove an item from a shopping list. */
  removeItemFromShoppingList: RemoveItemFromShoppingListResult;
  /** Remove the primary image from an item (deletes from S3) */
  removeItemImage: RemoveItemImageResult;
  /**
   * Batch remove specific items from a shopping list by id (batch twin of
   * removeItemFromShoppingList). Deletes exactly the given ids scoped to
   * shoppingListId; an id that no longer exists is a no-op, not an error.
   *
   * Offline-safe alternative to deleteShoppingListItems for "clear list": the
   * client sends the concrete ids captured at tap time, so a replayed clear can
   * never delete items other members added/purchased after the request was built
   * (deleteShoppingListItems re-evaluates its purchased filter at drain time).
   */
  removeItemsFromShoppingList: RemoveItemsFromShoppingListResult;
  /** Remove a member from a home (owner/admin only). */
  removeMember: RemoveMemberResult;
  /** Remove a recipe from the user's favorites. */
  removeRecipeFromFavorites: RemoveRecipeFromFavoritesResult;
  /** Remove a dietary restriction from the user's profile. */
  removeRestriction: RemoveRestrictionResult;
  /** Remove a collaborator from a shopping list. */
  removeShoppingListCollaborator: RemoveShoppingListCollaboratorResult;
  /** Remove an item from a template */
  removeTemplateItem: RemoveTemplateItemResult;
  /** Remove the conversion factor from a unit. */
  removeUnitConversion: RemoveUnitConversionResult;
  /** Resend the email verification message to a user. */
  resendVerificationEmail: ResendVerificationEmailResult;
  /** Reset password using token from email */
  resetPassword: ResetPasswordResult;
  /**
   * Restock a pantry item - adds quantity and creates a ledger record.
   * Use this when replenishing an existing pantry item.
   */
  restockPantryItem: RestockPantryItemResult;
  /** Restore a soft-deleted item */
  restoreItem: RestoreItemResult;
  /** Send a test notification of a specific type to the current user. */
  sendTestNotification: SendTestNotificationResult;
  /** Share a shopping list publicly with an optional share code. */
  shareShoppingList: ShareShoppingListResult;
  /** Offline-sync twin of deletePantryItem — idempotent by a client-minted id. */
  syncDeletePantryItem: SyncPantryItemResult;
  /**
   * Offline-sync twin of removeItemFromShoppingList — idempotent by a
   * client-minted id.
   */
  syncDeleteShoppingListItem: SyncShoppingListItemResult;
  /**
   * Offline-sync twin of moveShoppingListItem (reorder) — idempotent by a
   * client-minted id.
   */
  syncMoveShoppingListItem: SyncShoppingListItemResult;
  /**
   * Offline-sync twin of createPantryItem/updatePantryItem — idempotent by a
   * client-minted id (the primary key for creates, idempotencyKey for
   * cumulative deltas). Use the online mutations directly when not syncing
   * offline edits. See docs/api/graphql-operation-conventions.md (§5 variants).
   */
  syncPantryItem: SyncPantryItemResult;
  /**
   * Offline-sync twin of addItemsToShoppingList/updateShoppingListItem —
   * idempotent by a client-minted id (the primary key or idempotencyKey). Use
   * the online mutations directly when not syncing offline edits. See
   * docs/api/graphql-operation-conventions.md (§5).
   */
  syncShoppingListItem: SyncShoppingListItemResult;
  /** Toggle a helpful vote on a recipe review. */
  toggleReviewHelpful: ToggleReviewHelpfulResult;
  /** Toggle the purchased state of a shopping list item. */
  toggleShoppingListItemPurchased: ToggleShoppingListItemPurchasedResult;
  /** Transfer ownership of a home to another member. */
  transferHomeOwnership: TransferHomeOwnershipResult;
  /**
   * Update the current user's own account (non-privileged, self-editable
   * fields only). Privileged changes go through adminUpdateUser.
   */
  updateAccount: UpdateAccountResult;
  /** Update an existing brand. */
  updateBrand: UpdateBrandResult;
  /** Update an existing category. */
  updateCategory: UpdateCategoryResult;
  /** Update a collaborator's granular permissions on a shopping list. */
  updateCollaboratorPermissions: UpdateCollaboratorPermissionsResult;
  /** Update a collaborator's role on a shopping list. */
  updateCollaboratorRole: UpdateCollaboratorRoleResult;
  /** Update an existing cooking log entry. */
  updateCookingLog: UpdateCookingLogResult;
  /** Update an existing currency. */
  updateCurrency: UpdateCurrencyResult;
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
  updateDevice: UpdateDeviceResult;
  /** Update the current user's dietary profile. */
  updateDietaryProfile: UpdateDietaryProfileResult;
  /** Update an external source mapping. */
  updateExternalSource: UpdateExternalSourceResult;
  /** Update details of a favorited recipe (notes, folder, rating). */
  updateFavoriteRecipe: UpdateFavoriteRecipeResult;
  /** Update an existing home's details. */
  updateHome: UpdateHomeResult;
  /** Rotate (update) a home's join code, invalidating any previously shared join link. */
  updateHomeJoinCode: UpdateHomeResult;
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
  updateItem: UpdateItemResult;
  /**
   * Update a login history record. Handles:
   * - Session updates (loggedOutAt, sessionDuration, lastActivityAt)
   * - Administrative actions (marking as reviewed, flagging as risky)
   * - General field updates
   */
  updateLoginHistory: UpdateLoginHistoryResult;
  /** Update an existing meal plan. */
  updateMealPlan: UpdateMealPlanResult;
  /** Update an item in a meal plan. */
  updateMealPlanItem: UpdateMealPlanItemResult;
  /** Update an existing meal template */
  updateMealTemplate: UpdateMealTemplateResult;
  /** Update membership details and permissions (owner/admin only). */
  updateMembership: UpdateMembershipResult;
  /** Update an existing notification. */
  updateNotification: UpdateNotificationResult;
  /** Update notification preferences for the current user. */
  updateNotificationPreferences: UpdateNotificationPreferencesResult;
  /** Update an existing pantry's details. */
  updatePantry: UpdatePantryResult;
  /** Update an existing pantry item. */
  updatePantryItem: UpdatePantryItemResult;
  /** Move a pantry item to a different storage location. */
  updatePantryItemLocation: UpdatePantryItemLocationResult;
  /**
   * Set a pantry item's quantity directly (supports fractions). A plain setter
   * with no audit record. When reconciling to a physical count and you want an
   * auditable ADJUSTMENT usage record (mandatory reason, auto-computed delta),
   * use adjustPantryItemQuantity instead — the two are intentional variants
   * (see graphql-operation-conventions.md §5): quick set vs. audited adjust.
   */
  updatePantryItemQuantity: UpdatePantryItemQuantityResult;
  /**
   * Update user profile. Handles all profile fields including avatar and cover image.
   * Set avatarUrl/coverImageUrl to null to remove them.
   */
  updateProfile: UpdateProfileResult;
  /** Update an existing purchase record. */
  updatePurchase: UpdatePurchaseResult;
  updateRecipe: UpdateRecipeResult;
  updateRecipeIngredients: UpdateRecipeIngredientsResult;
  /** Update an existing recipe review (author only). */
  updateRecipeReview: UpdateRecipeReviewResult;
  /** Update an existing dietary restriction. */
  updateRestriction: UpdateRestrictionResult;
  /** Update settings for the current user. */
  updateSettings: UpdateSettingsResult;
  /** Update an existing shopping list. */
  updateShoppingList: UpdateShoppingListResult;
  /** Update a shopping list item. */
  updateShoppingListItem: UpdateShoppingListItemResult;
  /** Update shopping list item quantity (supports fractions) */
  updateShoppingListItemQuantity: UpdateShoppingListItemQuantityResult;
  /** Update the reminder for a shopping list. */
  updateShoppingListReminder: UpdateShoppingListReminderResult;
  /**
   * Update an existing storage location
   * Validates parent-child relationships and prevents circular references
   * Requires user to have edit permissions in the home
   */
  updateStorageLocation: UpdateStorageLocationResult;
  /**
   * Update the order of multiple storage locations
   * All locations must belong to the same home
   * Requires user to have edit permissions in the home
   */
  updateStorageLocationOrder: UpdateStorageLocationOrderResult;
  /**
   * Admin-managed canonical store fields (name, address, pricing/quality
   * metadata). Distinct from updateStoreInfo, which lets any authed user
   * contribute contact/location/hours details — the two are intentional
   * variants by audience and field set (see graphql-operation-conventions.md
   * §5), not duplicates. NOTE: their id argument names differ (this input uses
   * `id`, UpdateStoreInfoInput uses `storeId`); unify to `id` in the next
   * coordinated breaking cutover.
   */
  updateStore: UpdateStoreResult;
  /**
   * User-contributed store details (phone, email, website, lat/lng, hours).
   * Distinct from the admin-managed updateStore (canonical name/address/pricing)
   * — the two are intentional variants by audience and field set (see
   * graphql-operation-conventions.md §5). NOTE: this input's id argument is
   * `storeId` while UpdateStoreInput uses `id`; unify to `id` in the next
   * coordinated breaking cutover.
   */
  updateStoreInfo: UpdateStoreInfoResult;
  /** Update a template item */
  updateTemplateItem: UpdateTemplateItemResult;
  /** Update an existing unit of measurement. */
  updateUnit: UpdateUnitResult;
  /** Update an existing user address. */
  updateUserAddress: UpdateUserAddressResult;
  /**
   * Update appeals (submit or review).
   * Consolidates: submitAppeal, reviewAppeal.
   */
  updateUserAppeal: UpdateUserAppealResult;
  upsertExternalRecipe: UpsertExternalRecipeResult;
  /** Create or update an item based on its external source ID. */
  upsertItemByExternalSource: UpsertItemByExternalSourceResult;
  /**
   * Add or update item-specific unit conversion
   * Admins can set source, confidence, and isVerified; non-admins get defaults
   */
  upsertItemUnitConversion: UpsertItemUnitConversionResult;
  /** Validate if a password reset token is still valid */
  validatePasswordResetToken: ValidatePasswordResetTokenResult;
  /** Verify a user's email address using a verification code. */
  verifyEmail: VerifyEmailResult;
  /**
   * Waste a specific batch within a pantry item.
   * Only the targeted batch is zeroed out; other batches remain active.
   */
  wastePantryItemBatch: WastePantryItemBatchResult;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAcceptHomeInviteArgs = {
  input: AcceptHomeInviteInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAcceptShoppingListInviteArgs = {
  input: AcceptShoppingListInviteInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddItemToCategoryArgs = {
  input: AddItemToCategoryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddItemsToShoppingListArgs = {
  input: AddItemsToShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddLowStockItemsToShoppingListArgs = {
  input: AddLowStockItemsToShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddPantryItemToShoppingListArgs = {
  input: AddPantryItemToShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddRecipeToFavoritesArgs = {
  input: AddRecipeToFavoritesInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddRecipeToShoppingListArgs = {
  input: AddRecipeToShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddRestrictionArgs = {
  input: AddRestrictionInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddTemplateItemArgs = {
  input: AddTemplateItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAddUserAddressArgs = {
  input: AddUserAddressInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAdjustPantryItemQuantityArgs = {
  input: AdjustPantryItemQuantityInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationAdjustPantryItemWeightArgs = {
  input: AdjustPantryItemWeightInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationBulkCreateItemsArgs = {
  input: BulkCreateItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationBulkCreatePurchasesArgs = {
  input: BulkCreatePurchasesInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationBulkCreateStoresArgs = {
  input: BulkCreateStoresInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationBulkDeleteItemsArgs = {
  input: BulkDeleteItemsInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationBulkDeletePurchasesArgs = {
  input: BulkDeletePurchasesInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationBulkUpdateDevicesArgs = {
  input: BulkUpdateDevicesInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationBulkUpdateItemsArgs = {
  input: BulkUpdateItemsInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationBulkUpsertItemsByExternalSourceArgs = {
  input: BulkUpsertItemsByExternalSourceInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCancelRecurringArgs = {
  input: CancelRecurringInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationChangePasswordArgs = {
  input: ChangePasswordInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCompleteShoppingListArgs = {
  input: CompleteShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationConfirmItemImageUploadArgs = {
  input: ConfirmItemImageUploadInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationConfirmProfileImageUploadArgs = {
  input: ConfirmProfileImageUploadInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationConfirmRecipeConsumptionArgs = {
  input: ConfirmRecipeConsumptionInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationConvertExpiredBatchesToWasteArgs = {
  input: ConvertExpiredBatchesToWasteInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationConvertExpiredToWasteArgs = {
  input: ConvertExpiredToWasteInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateBrandArgs = {
  input: CreateBrandInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateCategoryArgs = {
  input: CreateCategoryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateCookingLogArgs = {
  input: CreateCookingLogInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateCurrencyArgs = {
  input: CreateCurrencyInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateFromTemplateArgs = {
  input: CreateFromTemplateInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateHomeArgs = {
  input: CreateHomeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateImageUploadUrlArgs = {
  input: CreateImageUploadUrlInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateItemArgs = {
  input: CreateItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateMealPlanArgs = {
  input: CreateMealPlanInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateMealPlanFromTemplateArgs = {
  input: CreateMealPlanFromTemplateInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateMealPlanItemArgs = {
  input: CreateMealPlanItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateMealTemplateArgs = {
  input: CreateMealTemplateInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateMembershipArgs = {
  input: CreateMembershipInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateNotificationArgs = {
  input: CreateNotificationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreatePantryArgs = {
  input: CreatePantryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreatePantryItemArgs = {
  input: CreatePantryItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreatePantryItemUsageArgs = {
  input: CreatePantryItemUsageInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateProfileArgs = {
  input: CreateProfileInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreatePurchaseArgs = {
  input: CreatePurchaseInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateRecipeArgs = {
  input: CreateRecipeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateRecipeReviewArgs = {
  input: CreateRecipeReviewInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateRecurringShoppingListArgs = {
  input: CreateRecurringShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateShoppingListArgs = {
  input: CreateShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateShoppingListItemFromRecipeIngredientArgs = {
  input: CreateShoppingListItemFromRecipeIngredientInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateShoppingListItemsFromRecipeArgs = {
  input: CreateShoppingListItemsFromRecipeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateStorageLocationArgs = {
  input: CreateStorageLocationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateStoreArgs = {
  input: CreateStoreInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateTemplateFromMealPlanArgs = {
  input: CreateTemplateFromMealPlanInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateUnitArgs = {
  input: CreateUnitInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationCreateUnitConversionArgs = {
  input: CreateUnitConversionInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeclineHomeInviteArgs = {
  input: DeclineHomeInviteInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeclineShoppingListInviteArgs = {
  input: DeclineShoppingListInviteInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteBrandArgs = {
  input: DeleteBrandInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteCategoryArgs = {
  input: DeleteCategoryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteCookingLogArgs = {
  input: DeleteCookingLogInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteCurrencyArgs = {
  input: DeleteCurrencyInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteDeviceArgs = {
  input: DeleteDeviceInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteExternalSourceArgs = {
  input: DeleteExternalSourceInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteHomeArgs = {
  input: DeleteHomeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteHomeInviteArgs = {
  input: DeleteHomeInviteInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteItemArgs = {
  input: DeleteItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteMealPlanArgs = {
  input: DeleteMealPlanInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteMealPlanItemArgs = {
  input: DeleteMealPlanItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteMealTemplateArgs = {
  input: DeleteMealTemplateInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteMultipleNotificationsArgs = {
  input: DeleteMultipleNotificationsInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteNotificationArgs = {
  input: DeleteNotificationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeletePantryArgs = {
  input: DeletePantryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeletePantryItemArgs = {
  input: DeletePantryItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeletePurchaseArgs = {
  input: DeletePurchaseInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteRecipeArgs = {
  input: DeleteRecipeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteRecipeFolderArgs = {
  input: DeleteRecipeFolderInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteRecipeReviewArgs = {
  input: DeleteRecipeReviewInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteShoppingListArgs = {
  input: DeleteShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteShoppingListItemsArgs = {
  input: DeleteShoppingListItemsInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteShoppingListReminderArgs = {
  input: DeleteShoppingListReminderInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteStorageLocationArgs = {
  input: DeleteStorageLocationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteStoreArgs = {
  input: DeleteStoreInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteUnitArgs = {
  input: DeleteUnitInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDeleteUserAddressArgs = {
  input: DeleteUserAddressInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDuplicateMealPlanArgs = {
  input: DuplicateMealPlanInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationDuplicateTemplateArgs = {
  input: DuplicateTemplateInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationEnableHomeJoinLinkArgs = {
  input: EnableHomeJoinLinkInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationForgotPasswordArgs = {
  input: ForgotPasswordInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationForkRecipeArgs = {
  input: ForkRecipeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationGenerateNextRecurringListArgs = {
  input: GenerateNextRecurringListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationGenerateShoppingListFromMealPlanArgs = {
  input: GenerateShoppingListFromMealPlanInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationInviteToHomeArgs = {
  input: InviteToHomeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationInviteToShoppingListArgs = {
  input: InviteToShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationJoinHomeByCodeArgs = {
  input: JoinHomeByCodeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationJoinShoppingListByShareCodeArgs = {
  input: JoinShoppingListByShareCodeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationLeaveHomeArgs = {
  input: LeaveHomeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationLinkItemToExternalSourceArgs = {
  input: LinkItemToExternalSourceInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationLoginArgs = {
  input: LoginInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkAsTemplateArgs = {
  input: MarkAsTemplateInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkExpirationActionArgs = {
  input: MarkExpirationActionInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkExpirationNotificationAsReadArgs = {
  input: MarkExpirationNotificationAsReadInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkHomeAsDefaultArgs = {
  input: MarkHomeAsDefaultInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkItemForReviewArgs = {
  input: MarkItemForReviewInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkNotificationAsReadArgs = {
  input: MarkNotificationAsReadInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkNotificationUnreadArgs = {
  input: MarkNotificationUnreadInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkPantryAsDefaultArgs = {
  input: MarkPantryAsDefaultInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkPantryItemExpiredArgs = {
  input: MarkPantryItemExpiredInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkRecipeAsCookedArgs = {
  input: MarkRecipeAsCookedInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkShoppingListActiveArgs = {
  input: MarkShoppingListActiveInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkShoppingListAsDefaultArgs = {
  input: MarkShoppingListAsDefaultInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkStorageLocationAsDefaultArgs = {
  input: MarkStorageLocationAsDefaultInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkSuggestionActiveArgs = {
  input: MarkSuggestionActiveInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMarkSuggestionDismissedArgs = {
  input: MarkSuggestionDismissedInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMovePurchasedItemsToPantryArgs = {
  input: MovePurchasedItemsToPantryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMoveShoppingItemToPantryArgs = {
  input: MoveShoppingItemToPantryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationMoveShoppingListItemArgs = {
  input: MoveShoppingListItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationOpenPantryItemArgs = {
  input: OpenPantryItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationOpenPantryItemBatchArgs = {
  input: OpenPantryItemBatchInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRecordItemPopularityArgs = {
  input: RecordItemPopularityInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRecordLoginArgs = {
  input: RecordLoginInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRecordPriceObservationArgs = {
  input: RecordPriceObservationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRecordRecipeCookedArgs = {
  input: RecordRecipeCookedInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRefreshArgs = {
  input: RefreshTokenInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRegisterArgs = {
  input: RegisterInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRegisterDeviceArgs = {
  input: RegisterDeviceInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveItemFromCategoryArgs = {
  input: RemoveItemFromCategoryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveItemFromShoppingListArgs = {
  input: RemoveItemFromShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveItemImageArgs = {
  input: RemoveItemImageInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveItemsFromShoppingListArgs = {
  input: RemoveItemsFromShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveMemberArgs = {
  input: RemoveMemberInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveRecipeFromFavoritesArgs = {
  input: RemoveRecipeFromFavoritesInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveRestrictionArgs = {
  input: RemoveRestrictionInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveShoppingListCollaboratorArgs = {
  input: RemoveShoppingListCollaboratorInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveTemplateItemArgs = {
  input: RemoveTemplateItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRemoveUnitConversionArgs = {
  input: RemoveUnitConversionInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationResendVerificationEmailArgs = {
  input: ResendVerificationEmailInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationResetPasswordArgs = {
  input: ResetPasswordWithTokenInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRestockPantryItemArgs = {
  input: RestockPantryItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationRestoreItemArgs = {
  input: RestoreItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationSendTestNotificationArgs = {
  input: SendTestNotificationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationShareShoppingListArgs = {
  input: ShareShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationSyncDeletePantryItemArgs = {
  input: SyncDeletePantryItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationSyncDeleteShoppingListItemArgs = {
  input: SyncDeleteShoppingListItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationSyncMoveShoppingListItemArgs = {
  input: SyncMoveShoppingListItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationSyncPantryItemArgs = {
  input: SyncPantryItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationSyncShoppingListItemArgs = {
  input: SyncShoppingListItemFullInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationToggleReviewHelpfulArgs = {
  input: ToggleReviewHelpfulInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationToggleShoppingListItemPurchasedArgs = {
  input: ToggleShoppingListItemPurchasedInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationTransferHomeOwnershipArgs = {
  input: TransferHomeOwnershipInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateAccountArgs = {
  input: UpdateAccountInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateBrandArgs = {
  input: UpdateBrandInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateCategoryArgs = {
  input: UpdateCategoryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateCollaboratorPermissionsArgs = {
  input: UpdateCollaboratorPermissionsFullInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateCollaboratorRoleArgs = {
  input: UpdateCollaboratorRoleInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateCookingLogArgs = {
  input: UpdateCookingLogInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateCurrencyArgs = {
  input: UpdateCurrencyInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateDeviceArgs = {
  input: UpdateDeviceInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateDietaryProfileArgs = {
  input: UpdateDietaryProfileInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateExternalSourceArgs = {
  input: UpdateExternalSourceInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateFavoriteRecipeArgs = {
  input: UpdateFavoriteRecipeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateHomeArgs = {
  input: UpdateHomeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateHomeJoinCodeArgs = {
  input: UpdateHomeJoinCodeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateItemArgs = {
  input: UpdateItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateLoginHistoryArgs = {
  input: UpdateLoginHistoryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateMealPlanArgs = {
  input: UpdateMealPlanInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateMealPlanItemArgs = {
  input: UpdateMealPlanItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateMealTemplateArgs = {
  input: UpdateMealTemplateInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateMembershipArgs = {
  input: UpdateMembershipInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateNotificationArgs = {
  input: UpdateNotificationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateNotificationPreferencesArgs = {
  input: UpdateNotificationPreferencesInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdatePantryArgs = {
  input: UpdatePantryInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdatePantryItemArgs = {
  input: UpdatePantryItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdatePantryItemLocationArgs = {
  input: UpdatePantryItemLocationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdatePantryItemQuantityArgs = {
  input: UpdatePantryItemQuantityInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateProfileArgs = {
  input: UpdateProfileInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdatePurchaseArgs = {
  input: UpdatePurchaseInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateRecipeArgs = {
  input: UpdateRecipeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateRecipeIngredientsArgs = {
  input: UpdateRecipeIngredientsInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateRecipeReviewArgs = {
  input: UpdateRecipeReviewInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateRestrictionArgs = {
  input: UpdateRestrictionInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateSettingsArgs = {
  input: UpdateSettingsInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateShoppingListArgs = {
  input: UpdateShoppingListInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateShoppingListItemArgs = {
  input: UpdateShoppingListItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateShoppingListItemQuantityArgs = {
  input: UpdateShoppingListItemQuantityInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateShoppingListReminderArgs = {
  input: UpdateShoppingListReminderInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateStorageLocationArgs = {
  input: UpdateStorageLocationInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateStorageLocationOrderArgs = {
  input: UpdateStorageLocationOrderInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateStoreArgs = {
  input: UpdateStoreInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateStoreInfoArgs = {
  input: UpdateStoreInfoInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateTemplateItemArgs = {
  input: UpdateTemplateItemInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateUnitArgs = {
  input: UpdateUnitInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateUserAddressArgs = {
  input: UpdateUserAddressInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpdateUserAppealArgs = {
  input: UpdateUserAppealInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpsertExternalRecipeArgs = {
  input: CreateRecipeInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpsertItemByExternalSourceArgs = {
  input: UpsertItemByExternalSourceInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationUpsertItemUnitConversionArgs = {
  input: UpsertItemUnitConversionInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationValidatePasswordResetTokenArgs = {
  input: ValidatePasswordResetTokenInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationVerifyEmailArgs = {
  input: VerifyEmailInput;
};


/**
 * Mutations are inherently uncacheable. Pinning maxAge: 0 + scope: PRIVATE
 * on the root Mutation type prevents any mutation response from being
 * served from a CDN if HTTP batching is ever re-enabled (currently off,
 * see src/index.ts) or if a caller proxies responses. Per-field overrides
 * win, so payload types that genuinely benefit from caching (e.g. read-
 * through reservation tokens) can opt back in.
 */
export type MutationWastePantryItemBatchArgs = {
  input: WastePantryItemBatchInput;
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

/** A referenced resource does not exist (or is not visible to the caller). */
export type NotFoundError = Error & {
  __typename: 'NotFoundError';
  code: ErrorCode;
  message: Scalars['String']['output'];
  /** Logical resource type, e.g. `MealPlan`. */
  resource: Maybe<Scalars['String']['output']>;
  /** Identifier the caller supplied, when applicable. */
  resourceId: Maybe<Scalars['ID']['output']>;
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

/**
 * Consolidated notification event envelope. Replaces notificationCreated +
 * notificationUpdated (and the former lightweight notificationRead /
 * notificationDismissed streams) — subscribe once and branch on subtype.
 * READ / DISMISSED are derived from the notification's status on update, so
 * read-state and dismissal transitions arrive on this stream too. Bulk
 * operations arrive as a single BULK_READ / BULK_CLEARED / BULK_EXPIRED event.
 */
export type NotificationEvent = {
  __typename: 'NotificationEvent';
  actorUserId: Maybe<Scalars['ID']['output']>;
  /**
   * Number of notifications affected by an aggregate subtype (BULK_READ /
   * BULK_CLEARED / BULK_EXPIRED). Null for per-entity subtypes.
   */
  affectedCount: Maybe<Scalars['Int']['output']>;
  mutation: MutationType;
  /**
   * The changed notification for per-entity subtypes. Null for the aggregate
   * subtypes (BULK_READ / BULK_CLEARED / BULK_EXPIRED), which describe a
   * set-based mutation with no single node — read affectedCount instead.
   */
  node: Maybe<Notification>;
  subtype: NotificationSubtype;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Maybe<Array<Scalars['String']['output']>>;
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

/**
 * Subtype discriminator for the consolidated notificationEvents stream.
 * BULK_READ / BULK_CLEARED / BULK_EXPIRED are aggregate subtypes emitted once
 * per set-based operation (markAllAsRead / deleteAllRead / the system-driven
 * expiry cleanup) — they carry affectedCount and a null node instead of a
 * single changed notification. BULK_EXPIRED is the system-expiry counterpart to
 * the user-initiated BULK_CLEARED.
 */
export enum NotificationSubtype {
  BulkCleared = 'BULK_CLEARED',
  BulkExpired = 'BULK_EXPIRED',
  BulkRead = 'BULK_READ',
  Created = 'CREATED',
  Dismissed = 'DISMISSED',
  Read = 'READ',
  Updated = 'UPDATED'
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
export type OpenPantryItemBatchInput = {
  batchId: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
};

export type OpenPantryItemBatchPayload = {
  __typename: 'OpenPantryItemBatchPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type OpenPantryItemBatchResult = ConflictError | ForbiddenError | NotFoundError | OpenPantryItemBatchPayload | ValidationError;

export type OpenPantryItemInput = {
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type OpenPantryItemPayload = {
  __typename: 'OpenPantryItemPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type OpenPantryItemResult = ConflictError | ForbiddenError | NotFoundError | OpenPantryItemPayload | ValidationError;

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
 * Pantry/storage location for a home.
 * Not cached at the response level: child PantryItem mutations happen frequently and
 * TTL-based caching can't be invalidated mid-window. Server-side coherence is handled
 * via DataLoader + Redis invalidation in resolvers (invalidatePantryItemCache).
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
 * Pantry/storage location for a home.
 * Not cached at the response level: child PantryItem mutations happen frequently and
 * TTL-based caching can't be invalidated mid-window. Server-side coherence is handled
 * via DataLoader + Redis invalidation in resolvers (invalidatePantryItemCache).
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
 * Pantry/storage location for a home.
 * Not cached at the response level: child PantryItem mutations happen frequently and
 * TTL-based caching can't be invalidated mid-window. Server-side coherence is handled
 * via DataLoader + Redis invalidation in resolvers (invalidatePantryItemCache).
 */
export type PantryLedgerAnalyticsArgs = {
  filters?: InputMaybe<AnalyticsFilters>;
  granularity?: InputMaybe<PeriodGranularity>;
  itemId?: InputMaybe<Scalars['ID']['input']>;
};


/**
 * Pantry/storage location for a home.
 * Not cached at the response level: child PantryItem mutations happen frequently and
 * TTL-based caching can't be invalidated mid-window. Server-side coherence is handled
 * via DataLoader + Redis invalidation in resolvers (invalidatePantryItemCache).
 */
export type PantryRecentlyDeletedItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * Pantry/storage location for a home.
 * Not cached at the response level: child PantryItem mutations happen frequently and
 * TTL-based caching can't be invalidated mid-window. Server-side coherence is handled
 * via DataLoader + Redis invalidation in resolvers (invalidatePantryItemCache).
 */
export type PantryStorageLocationsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<StorageLocationOrderBy>;
};


/**
 * Pantry/storage location for a home.
 * Not cached at the response level: child PantryItem mutations happen frequently and
 * TTL-based caching can't be invalidated mid-window. Server-side coherence is handled
 * via DataLoader + Redis invalidation in resolvers (invalidatePantryItemCache).
 */
export type PantrySuggestionsArgs = {
  expirationDays?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  sources?: InputMaybe<Array<PantrySuggestionSource>>;
};


/**
 * Pantry/storage location for a home.
 * Not cached at the response level: child PantryItem mutations happen frequently and
 * TTL-based caching can't be invalidated mid-window. Server-side coherence is handled
 * via DataLoader + Redis invalidation in resolvers (invalidatePantryItemCache).
 */
export type PantryUsageAnalyticsArgs = {
  filters?: InputMaybe<AnalyticsFilters>;
};


/**
 * Pantry/storage location for a home.
 * Not cached at the response level: child PantryItem mutations happen frequently and
 * TTL-based caching can't be invalidated mid-window. Server-side coherence is handled
 * via DataLoader + Redis invalidation in resolvers (invalidatePantryItemCache).
 */
export type PantryWasteAnalyticsArgs = {
  filters?: InputMaybe<AnalyticsFilters>;
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

export type PantryEdge = Edge & {
  __typename: 'PantryEdge';
  cursor: Scalars['String']['output'];
  node: Pantry;
};

/**
 * Real-time notification for pantry domain mutations.
 * Clients subscribe once per pantry; the subtype field routes payload interpretation.
 */
export type PantryEvent = {
  __typename: 'PantryEvent';
  actorUserId: Maybe<Scalars['ID']['output']>;
  mutation: MutationType;
  node: PantryEventNode;
  pantryId: Scalars['ID']['output'];
  parents: PantryEventParents;
  subtype: PantrySubtype;
  timestamp: Scalars['DateTime']['output'];
};

export type PantryEventNode = ExpirationNotification | Pantry | PantryItem | PantryItemUsage;

/** Parent resource IDs for cache updates without refetch. */
export type PantryEventParents = {
  __typename: 'PantryEventParents';
  homeId: Scalars['ID']['output'];
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
  updatedAt: Scalars['DateTime']['output'];
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
  filters?: InputMaybe<AnalyticsFilters>;
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
  updatedAt: Scalars['DateTime']['output'];
  wasteReason: Maybe<WasteReason>;
};

export type PantryItemBatchConnection = Connection & {
  __typename: 'PantryItemBatchConnection';
  edges: Array<PantryItemBatchEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type PantryItemBatchEdge = Edge & {
  __typename: 'PantryItemBatchEdge';
  cursor: Scalars['String']['output'];
  node: PantryItemBatch;
};

/**
 * Sort options for the pantry item batches connection. Object-map convention:
 * set a field to ASC or DESC.
 */
export type PantryItemBatchOrderBy = {
  batchNumber?: InputMaybe<SortOrder>;
  createdAt?: InputMaybe<SortOrder>;
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

export type PantryItemChangeConnection = Connection & {
  __typename: 'PantryItemChangeConnection';
  edges: Array<PantryItemChangeEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type PantryItemChangeEdge = Edge & {
  __typename: 'PantryItemChangeEdge';
  cursor: Scalars['String']['output'];
  node: PantryItemChange;
};

export type PantryItemConnection = Connection & {
  __typename: 'PantryItemConnection';
  edges: Array<PantryItemEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

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

export type PantryItemUsageConnection = Connection & {
  __typename: 'PantryItemUsageConnection';
  edges: Array<PantryItemUsageEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type PantryItemUsageEdge = Edge & {
  __typename: 'PantryItemUsageEdge';
  cursor: Scalars['String']['output'];
  node: PantryItemUsage;
};

export type PantryItemUsageOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  usedAt?: InputMaybe<SortOrder>;
};

/** Order by options for pantries */
export type PantryOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
};

export type PantryStats = {
  __typename: 'PantryStats';
  activeItems: Scalars['Int']['output'];
  expiredCount: Scalars['Int']['output'];
  expiringCount: Scalars['Int']['output'];
  lowStockCount: Scalars['Int']['output'];
  storageLocationCounts: Array<StorageLocationCount>;
  storageStateCounts: Maybe<StorageStateCounts>;
  totalItems: Scalars['Int']['output'];
  totalValue: Scalars['Float']['output'];
};

/** Subtype discriminator for pantry domain events. */
export enum PantrySubtype {
  /**
   * An action was taken on an expiration notification (waste, restock,
   * mark-consumed, etc.). node is an ExpirationNotification.
   */
  ExpirationActionTaken = 'EXPIRATION_ACTION_TAKEN',
  /** Item expiration date approaching */
  ExpirationAlert = 'EXPIRATION_ALERT',
  /**
   * A new expiration notification was created by the background
   * expiration-check job. node is an ExpirationNotification.
   */
  ExpirationNotificationCreated = 'EXPIRATION_NOTIFICATION_CREATED',
  /**
   * An expiration notification was marked as read by the user.
   * node is an ExpirationNotification.
   */
  ExpirationNotificationRead = 'EXPIRATION_NOTIFICATION_READ',
  /** Pantry item created, updated, or soft-deleted */
  ItemChanged = 'ITEM_CHANGED',
  /** Item quantity fell below minimum threshold */
  LowStockAlert = 'LOW_STOCK_ALERT',
  /** Pantry metadata changed (name, description, settings) */
  PantryUpdated = 'PANTRY_UPDATED',
  /** Pantry item usage recorded (consume, restock, adjust) */
  UsageChanged = 'USAGE_CHANGED',
  /** Item marked as waste or discarded */
  WasteAlert = 'WASTE_ALERT'
}

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

export type ParentCategorySuggestion = {
  __typename: 'ParentCategorySuggestion';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  slug: Maybe<Scalars['String']['output']>;
  type: CategoryType;
};

/**
 * Outcome of a password-flow action (bulk-operation-standard sibling: replaces
 * the flat {success,code,message} status types). Anti-enumeration is preserved
 * by the resolver — e.g. forgotPassword always resolves to SENT regardless of
 * whether the email exists.
 */
export enum PasswordActionStatus {
  /** The action completed (changePassword / resetPassword). */
  Completed = 'COMPLETED',
  /** The token was missing, invalid, or expired. */
  InvalidOrExpired = 'INVALID_OR_EXPIRED',
  /** A reset email was sent (forgotPassword — always this, existence-blind). */
  Sent = 'SENT',
  /** The token was valid (validatePasswordResetToken). */
  Validated = 'VALIDATED'
}

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
  /**
   * Aggregate multiple quantities of the same item
   * Useful for calculating total needed across multiple recipes
   */
  aggregateQuantities: AggregationResult;
  /** Autocomplete category names for faster item categorization. */
  autocompleteCategories: AutocompleteCategoryResult;
  /** Autocomplete item names for quick search suggestions. */
  autocompleteItems: AutocompleteResult;
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
  /**
   * Fetch a single home by its join code. Reachable anonymously so a
   * not-yet-signed-up recipient of a join link can preview the home.
   */
  homeByJoinCode: Maybe<Home>;
  /** Fetch a home invite by its token for the acceptance flow. */
  homeInviteByToken: Maybe<HomeInvite>;
  /** Get homes where the current user is a member. */
  homes: HomeConnection;
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
  /**
   * Get batches for a pantry item, optionally filtered by status, with
   * cursor-based pagination (Relay spec).
   */
  pantryItemBatchesConnection: PantryItemBatchConnection;
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
   * Resolve an anyone-with-link code (home join code or list share code)
   * without knowing its type. Returns null when the code matches nothing.
   * Reachable anonymously so a not-yet-signed-up recipient can preview.
   */
  resolveShareLink: Maybe<ResolveShareLinkResult>;
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
   * Items without a cached embedding are excluded; the catalog has been
   * backfilled, and new or edited items are embedded asynchronously by the
   * ITEM_EMBEDDING job. Auth-gated to bound embedding-service spend.
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
  /**
   * Fetch a shopping list by its share code. Reachable anonymously so a
   * not-yet-signed-up recipient of a share link can preview the list.
   */
  shoppingListByShareCode: Maybe<ShoppingList>;
  /**
   * Fetch a shopping list collaborator invite by its token for the
   * acceptance-flow preview (parity with homeInviteByToken).
   */
  shoppingListInviteByToken: Maybe<ShoppingListCollaborator>;
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
  /** Validate item data integrity (read-only check) */
  validateItem: ValidationResult;
  /** Validate a UPC barcode string. */
  validateUpc: UpcValidation;
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
  pantryId: Scalars['ID']['input'];
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
  storeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};


export type QueryCompareItemPricesArgs = {
  itemId: Scalars['ID']['input'];
  storeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
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


export type QueryDevicesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<DeviceFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<DeviceOrderBy>;
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
  orderBy?: InputMaybe<ItemOrderBy>;
};


export type QueryLoginHistoriesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<LoginHistoryQueryFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<LoginHistoryOrderBy>;
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


export type QueryPantryItemBatchesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<PantryItemBatchOrderBy>;
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
  filters?: InputMaybe<RecipeFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryRecommendedItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryResolveShareLinkArgs = {
  code: Scalars['String']['input'];
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
  orderBy?: InputMaybe<ItemOrderBy>;
  query: Scalars['String']['input'];
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
  filters?: InputMaybe<RecipeFilters>;
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


export type QueryShoppingListInviteByTokenArgs = {
  token: Scalars['String']['input'];
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
  forksConnection: RecipeForkConnection;
  healthGoals: Array<HealthGoal>;
  id: Scalars['ID']['output'];
  imageUrl: Maybe<Scalars['String']['output']>;
  ingredientsConnection: RecipeIngredientConnection;
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
export type RecipeForksConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<RecipeOrderBy>;
};


/**
 * Recipe type for meal instructions and ingredients
 * Cache: 30 minutes - published recipes are static content
 */
export type RecipeIngredientsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
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

/** Sub-input for recipe context */
export type RecipeContextInput = {
  addedContext?: InputMaybe<Scalars['String']['input']>;
  /**
   * Meal plan this item was generated from. When set, the server flags the
   * item as meal-plan-sourced (isFromMealPlan).
   */
  mealPlanId?: InputMaybe<Scalars['ID']['input']>;
  /** Specific meal plan item this ingredient came from. */
  mealPlanItemId?: InputMaybe<Scalars['ID']['input']>;
  /** Human-readable meal/recipe reference for display (e.g. the meal plan name). */
  mealPlanReference?: InputMaybe<Scalars['String']['input']>;
  recipeId?: InputMaybe<Scalars['ID']['input']>;
  recipeIngredientId?: InputMaybe<Scalars['ID']['input']>;
};

export type RecipeEdge = Edge & {
  __typename: 'RecipeEdge';
  cursor: Scalars['String']['output'];
  node: Recipe;
};

/**
 * Filter criteria for recipe list queries (recipes, adminRecipes, searchRecipes).
 * Each query honors the subset of fields relevant to it. The searchRecipes
 * filters mirror the Spoonacular complexSearch parameters:
 *   - diets         -> recipe must match ALL selected
 *   - intolerances  -> exclude recipes containing ANY selected intolerance
 *   - category      -> meal type
 *   - cuisine       -> match ANY of the selected
 *   - maxReadyTime  -> total time, in minutes
 */
export type RecipeFilters = {
  /** Filter by meal-type category */
  category?: InputMaybe<RecipeCategory>;
  /** Cuisines to match any of (searchRecipes) */
  cuisine?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Dietary restrictions the recipe must match (searchRecipes) */
  diets?: InputMaybe<Array<Diet>>;
  /** Filter by difficulty (recipes/adminRecipes) */
  difficulty?: InputMaybe<Difficulty>;
  /** Include soft-deleted recipes (recipes/adminRecipes) */
  includeDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  /** Intolerances to exclude (searchRecipes) */
  intolerances?: InputMaybe<Array<Intolerance>>;
  /** Maximum total ready time in minutes (searchRecipes) */
  maxReadyTime?: InputMaybe<Scalars['Int']['input']>;
};

export type RecipeForkConnection = Connection & {
  __typename: 'RecipeForkConnection';
  edges: Array<RecipeForkEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type RecipeForkEdge = Edge & {
  __typename: 'RecipeForkEdge';
  cursor: Scalars['String']['output'];
  node: Recipe;
};

export type RecipeIngredient = {
  __typename: 'RecipeIngredient';
  availablePantryItemIds: Array<Scalars['ID']['output']>;
  estimatedPrice: Maybe<Scalars['Float']['output']>;
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

export type RecipeIngredientConnection = Connection & {
  __typename: 'RecipeIngredientConnection';
  edges: Array<RecipeIngredientEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type RecipeIngredientEdge = Edge & {
  __typename: 'RecipeIngredientEdge';
  cursor: Scalars['String']['output'];
  node: RecipeIngredient;
};

export type RecipeIngredientInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  consistency?: InputMaybe<Scalars['String']['input']>;
  estimatedPrice?: InputMaybe<Scalars['Float']['input']>;
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
  spoonacular?: InputMaybe<SpoonacularIngredientInput>;
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

/** Order by options for recipes */
export type RecipeOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
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

export type RecipeReviewEdge = Edge & {
  __typename: 'RecipeReviewEdge';
  cursor: Scalars['String']['output'];
  node: RecipeReview;
};

export type RecipeReviewOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  rating?: InputMaybe<SortOrder>;
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

export type RecordItemPopularityInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};

export type RecordItemPopularityPayload = {
  __typename: 'RecordItemPopularityPayload';
  item: Item;
};

export type RecordItemPopularityResult = ConflictError | ForbiddenError | NotFoundError | RecordItemPopularityPayload | ValidationError;

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

export type RecordLoginPayload = {
  __typename: 'RecordLoginPayload';
  loginHistory: LoginHistory;
};

export type RecordLoginResult = ConflictError | ForbiddenError | NotFoundError | RecordLoginPayload | ValidationError;

/** Input for recording a price observation (historical tracking) */
export type RecordPriceObservationInput = {
  itemId: Scalars['ID']['input'];
  observedAt?: InputMaybe<Scalars['DateTime']['input']>;
  price: Scalars['Float']['input'];
  storeId: Scalars['ID']['input'];
};

export type RecordPriceObservationPayload = {
  __typename: 'RecordPriceObservationPayload';
  item: Maybe<Item>;
  priceHistory: ItemPriceHistory;
  store: Maybe<Store>;
};

export type RecordPriceObservationResult = ConflictError | ForbiddenError | NotFoundError | RecordPriceObservationPayload | ValidationError;

export type RecordRecipeCookedInput = {
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
  recipeId: Scalars['ID']['input'];
};

export type RecordRecipeCookedPayload = {
  __typename: 'RecordRecipeCookedPayload';
  recipe: Maybe<Recipe>;
  savedRecipe: SavedRecipe;
};

export type RecordRecipeCookedResult = ConflictError | ForbiddenError | NotFoundError | RecordRecipeCookedPayload | ValidationError;

export enum RecurringPattern {
  Biweekly = 'BIWEEKLY',
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY'
}

export type RefreshTokenInput = {
  token: Scalars['String']['input'];
};

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

export type RegisterDeviceInput = {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<DeviceDetailsInput>;
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  location?: InputMaybe<NetworkLocationInput>;
  platform?: InputMaybe<MobilePlatform>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
};

export type RegisterDevicePayload = {
  __typename: 'RegisterDevicePayload';
  device: Maybe<Device>;
};

export type RegisterDeviceResult = ConflictError | ForbiddenError | NotFoundError | RegisterDevicePayload | ValidationError;

export type RegisterInput = {
  email: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
};

export type RegisterPayload = {
  __typename: 'RegisterPayload';
  /** Existence-blind confirmation to show the user; always present (String! so it merges with ValidationError.message when both are selected). */
  message: Scalars['String']['output'];
  status: RegistrationStatus;
};

export type RegisterResult = ConflictError | ForbiddenError | NotFoundError | RegisterPayload | ValidationError;

/**
 * Outcome of a registration request. Registration is existence-blind: the same
 * status is returned whether or not the email is already registered, and no
 * tokens are issued — the account is activated via the emailed verification
 * link, then the user logs in (audit M11).
 */
export enum RegistrationStatus {
  /** A verification link was sent (or would have been, for an available email). */
  VerificationSent = 'VERIFICATION_SENT'
}

/** Input for rejecting a user-created item */
export type RejectItemInput = {
  itemId: Scalars['ID']['input'];
  notifyUser?: InputMaybe<Scalars['Boolean']['input']>;
  reason: Scalars['String']['input'];
};

export type RejectItemPayload = {
  __typename: 'RejectItemPayload';
  item: Item;
};

export type RejectItemResult = ConflictError | ForbiddenError | NotFoundError | RejectItemPayload | ValidationError;

export enum ReligiousDiet {
  Halal = 'HALAL',
  Kosher = 'KOSHER'
}

export type RemoveCollaboratorInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type RemoveItemFromCategoryInput = {
  categoryId: Scalars['ID']['input'];
  itemId: Scalars['ID']['input'];
};

export type RemoveItemFromCategoryPayload = {
  __typename: 'RemoveItemFromCategoryPayload';
  itemCategory: ItemCategory;
};

export type RemoveItemFromCategoryResult = ConflictError | ForbiddenError | NotFoundError | RemoveItemFromCategoryPayload | ValidationError;

export type RemoveItemFromShoppingListInput = {
  id: Scalars['ID']['input'];
};

export type RemoveItemFromShoppingListPayload = {
  __typename: 'RemoveItemFromShoppingListPayload';
  shoppingList: Maybe<ShoppingList>;
  shoppingListItem: ShoppingListItem;
};

export type RemoveItemFromShoppingListResult = ConflictError | ForbiddenError | NotFoundError | RemoveItemFromShoppingListPayload | ValidationError;

export type RemoveItemImageInput = {
  id: Scalars['ID']['input'];
};

export type RemoveItemImagePayload = {
  __typename: 'RemoveItemImagePayload';
  item: Item;
};

export type RemoveItemImageResult = ConflictError | ForbiddenError | NotFoundError | RemoveItemImagePayload | ValidationError;

/**
 * Batch remove specific shopping list items by id (batch twin of
 * removeItemFromShoppingList). Deletes exactly the given ids, scoped to
 * shoppingListId; an id that no longer exists is a no-op, not an error.
 *
 * Offline-safe alternative to deleteShoppingListItems for "clear list": the
 * client captures the concrete ids on screen at tap time, so a replayed clear
 * never touches items other members added/purchased after the request was built.
 * deleteShoppingListItems re-evaluates its purchased filter at drain time and
 * cannot offer that guarantee.
 */
export type RemoveItemsFromShoppingListInput = {
  /** Exact item ids to remove (scoped to shoppingListId). Unknown ids are skipped. */
  ids: Array<Scalars['ID']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export type RemoveItemsFromShoppingListPayload = {
  __typename: 'RemoveItemsFromShoppingListPayload';
  /** Shopping list items that were removed (soft-deleted) by the batch. */
  shoppingListItems: Array<ShoppingListItem>;
  /** summary.succeeded = ids actually removed; summary.skipped = ids that matched nothing (already removed or foreign to the list). */
  summary: BulkSummary;
};

export type RemoveItemsFromShoppingListResult = ConflictError | ForbiddenError | NotFoundError | RemoveItemsFromShoppingListPayload | ValidationError;

export type RemoveMemberInput = {
  membershipId: Scalars['ID']['input'];
};

export type RemoveMemberPayload = {
  __typename: 'RemoveMemberPayload';
  home: Maybe<Home>;
  membership: Membership;
};

export type RemoveMemberResult = ConflictError | ForbiddenError | NotFoundError | RemoveMemberPayload | ValidationError;

export type RemoveRecipeFromFavoritesInput = {
  recipeId: Scalars['ID']['input'];
};

export type RemoveRecipeFromFavoritesPayload = {
  __typename: 'RemoveRecipeFromFavoritesPayload';
  /**
   * True when this call CONVERGED on a pre-existing state (the recipe was already
   * not favorited) — a no-op success. The canonical, API-wide replay flag.
   */
  converged: Scalars['Boolean']['output'];
  recipe: Maybe<Recipe>;
  /**
   * The removed favorite, or null when the recipe was already not favorited — an
   * idempotent replay (or second device) that converged as success. See converged.
   */
  savedRecipe: Maybe<SavedRecipe>;
};

export type RemoveRecipeFromFavoritesResult = ConflictError | ForbiddenError | NotFoundError | RemoveRecipeFromFavoritesPayload | ValidationError;

export type RemoveRestrictionInput = {
  id: Scalars['ID']['input'];
};

export type RemoveRestrictionPayload = {
  __typename: 'RemoveRestrictionPayload';
  dietaryProfile: Maybe<DietaryProfile>;
  dietaryRestriction: DietaryRestriction;
};

export type RemoveRestrictionResult = ConflictError | ForbiddenError | NotFoundError | RemoveRestrictionPayload | ValidationError;

export type RemoveRestrictionsInput = {
  restrictions: Array<ModerationRestriction>;
  userId: Scalars['ID']['input'];
};

export type RemoveShoppingListCollaboratorInput = {
  id: Scalars['ID']['input'];
};

export type RemoveShoppingListCollaboratorPayload = {
  __typename: 'RemoveShoppingListCollaboratorPayload';
  collaborator: ShoppingListCollaborator;
  shoppingList: Maybe<ShoppingList>;
};

export type RemoveShoppingListCollaboratorResult = ConflictError | ForbiddenError | NotFoundError | RemoveShoppingListCollaboratorPayload | ValidationError;

export type RemoveTemplateItemInput = {
  id: Scalars['ID']['input'];
};

export type RemoveTemplateItemPayload = {
  __typename: 'RemoveTemplateItemPayload';
  mealTemplate: Maybe<MealTemplate>;
  mealTemplateItem: MealTemplateItem;
};

export type RemoveTemplateItemResult = ConflictError | ForbiddenError | NotFoundError | RemoveTemplateItemPayload | ValidationError;

export type RemoveUnitConversionInput = {
  unitId: Scalars['ID']['input'];
};

export type RemoveUnitConversionPayload = {
  __typename: 'RemoveUnitConversionPayload';
  unit: Unit;
};

export type RemoveUnitConversionResult = ConflictError | ForbiddenError | NotFoundError | RemoveUnitConversionPayload | ValidationError;

export type ResendVerificationEmailInput = {
  email: Scalars['String']['input'];
};

export type ResendVerificationEmailPayload = {
  __typename: 'ResendVerificationEmailPayload';
  user: Maybe<User>;
};

export type ResendVerificationEmailResult = ConflictError | ForbiddenError | NotFoundError | ResendVerificationEmailPayload | ValidationError;

export type ResetPasswordInput = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type ResetPasswordPayload = {
  __typename: 'ResetPasswordPayload';
  message: Scalars['String']['output'];
  status: PasswordActionStatus;
};

export type ResetPasswordResult = ConflictError | ForbiddenError | NotFoundError | ResetPasswordPayload | ValidationError;

export type ResetPasswordWithTokenInput = {
  newPassword: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

/**
 * Resolution of a shareable code (home join code or list share code) into a
 * preview plus the deep link to follow. Lets the app and the web fallback
 * handle any link without knowing its type up front.
 */
export type ResolveShareLinkResult = {
  __typename: 'ResolveShareLinkResult';
  /** Whether the (authenticated) caller already has access to this resource. */
  alreadyMember: Scalars['Boolean']['output'];
  /** Present when targetType is HOME_JOIN. */
  homeId: Maybe<Scalars['ID']['output']>;
  /** Item count (LIST_JOIN only). */
  itemCount: Maybe<Scalars['Int']['output']>;
  /** Deep link to follow to join/open the target. */
  link: ShareLink;
  /** Present when targetType is LIST_JOIN. */
  listId: Maybe<Scalars['ID']['output']>;
  /** Active member count (HOME_JOIN only). */
  memberCount: Maybe<Scalars['Int']['output']>;
  /** Display name of the home or list. */
  name: Scalars['String']['output'];
  targetType: ShareLinkTargetType;
};

/** Input for restocking a pantry item - adds quantity and creates ledger record */
export type RestockPantryItemInput = {
  costPerUnit?: InputMaybe<Scalars['Float']['input']>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  quantity: Scalars['Float']['input'];
  restockedAt?: InputMaybe<Scalars['DateTime']['input']>;
  storeId?: InputMaybe<Scalars['ID']['input']>;
  totalCost?: InputMaybe<Scalars['Float']['input']>;
  unitId?: InputMaybe<Scalars['ID']['input']>;
};

export type RestockPantryItemPayload = {
  __typename: 'RestockPantryItemPayload';
  pantry: Maybe<Pantry>;
  pantryItem: Maybe<PantryItem>;
  pantryItemUsage: PantryItemUsage;
};

export type RestockPantryItemResult = ConflictError | ForbiddenError | NotFoundError | RestockPantryItemPayload | ValidationError;

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

export type RestoreItemInput = {
  id: Scalars['ID']['input'];
};

export type RestoreItemPayload = {
  __typename: 'RestoreItemPayload';
  item: Item;
};

export type RestoreItemResult = ConflictError | ForbiddenError | NotFoundError | RestoreItemPayload | ValidationError;

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

export type SendTestNotificationInput = {
  type: NotificationType;
};

export type SendTestNotificationPayload = {
  __typename: 'SendTestNotificationPayload';
  notification: Maybe<Notification>;
};

export type SendTestNotificationResult = ConflictError | ForbiddenError | NotFoundError | SendTestNotificationPayload | ValidationError;

/** Sub-input for session info */
export type SessionInfoInput = {
  lastActivityAt?: InputMaybe<Scalars['DateTime']['input']>;
  loggedOutAt?: InputMaybe<Scalars['DateTime']['input']>;
  sessionDuration?: InputMaybe<Scalars['Int']['input']>;
  sessionId?: InputMaybe<Scalars['String']['input']>;
};

/**
 * A shareable deep link expressed in both forms so clients can choose:
 * - universal: an https:// Universal Link / App Link (opens the installed app,
 *   falls back to the web page when the app is absent).
 * - scheme: a souschef:// custom-scheme URL (force-launches an installed app).
 */
export type ShareLink = {
  __typename: 'ShareLink';
  scheme: Scalars['String']['output'];
  universal: Scalars['String']['output'];
};

/** What kind of resource an anyone-with-link code points at. */
export enum ShareLinkTargetType {
  HomeJoin = 'HOME_JOIN',
  ListJoin = 'LIST_JOIN'
}

export type ShareShoppingListInput = {
  id: Scalars['ID']['input'];
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  shareCode?: InputMaybe<Scalars['String']['input']>;
};

export type ShareShoppingListPayload = {
  __typename: 'ShareShoppingListPayload';
  shoppingList: ShoppingList;
};

export type ShareShoppingListResult = ConflictError | ForbiddenError | NotFoundError | ShareShoppingListPayload | ValidationError;

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
  /** Deep link that opens this list in the app (for existing collaborators). */
  navigateLink: ShareLink;
  nextRecurringDate: Maybe<Scalars['DateTime']['output']>;
  ownerships: Array<ShoppingListOwnership>;
  plannedShopDate: Maybe<Scalars['DateTime']['output']>;
  priceTracking: Scalars['Boolean']['output'];
  priority: Scalars['Int']['output'];
  /**
   * Recently deleted items for quick re-adding suggestions.
   * Bounded field: limit defaults to 10 and is clamped server-side to a
   * maximum of 50.
   */
  recentlyDeletedItems: Array<ShoppingListItem>;
  recurringInterval: Maybe<Scalars['Int']['output']>;
  recurringPattern: Maybe<RecurringPattern>;
  remainingItems: Scalars['Int']['output'];
  reminderDate: Maybe<Scalars['DateTime']['output']>;
  reminderEnabled: Scalars['Boolean']['output'];
  shareCode: Maybe<Scalars['String']['output']>;
  shareCount: Scalars['Int']['output'];
  /**
   * Anyone-with-link share/join link for this list. Null unless the list is
   * public (isPublic) and a shareCode is set.
   */
  shareLink: Maybe<ShareLink>;
  smartSorting: Scalars['Boolean']['output'];
  sortOrder: Scalars['Int']['output'];
  status: ListStatus;
  /**
   * Smart suggestions for adding items to this shopping list.
   * Bounded field: limit defaults to 10 and is clamped server-side to a
   * maximum of 50.
   */
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

export type ShoppingListCollaboratorEdge = Edge & {
  __typename: 'ShoppingListCollaboratorEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingListCollaborator;
};

export type ShoppingListConnection = Connection & {
  __typename: 'ShoppingListConnection';
  edges: Array<ShoppingListEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type ShoppingListEdge = Edge & {
  __typename: 'ShoppingListEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingList;
};

/**
 * Real-time notification for shopping list domain mutations.
 * Clients subscribe once per list (or once for all their lists via
 * myShoppingListsEvents); the subtype field routes payload interpretation.
 */
export type ShoppingListEvent = {
  __typename: 'ShoppingListEvent';
  /** User who made the change. */
  actorUserId: Maybe<Scalars['ID']['output']>;
  /** Count of items cleared (ITEMS_BATCH_CLEARED only). */
  clearedCount: Maybe<Scalars['Int']['output']>;
  /** IDs of items that were cleared (ITEMS_BATCH_CLEARED only). */
  clearedItemIds: Maybe<Array<Scalars['ID']['output']>>;
  listId: Scalars['ID']['output'];
  mutation: MutationType;
  /**
   * The affected resource: ShoppingList for LIST_UPDATED / STATUS_CHANGED,
   * ShoppingListItem for ITEMS_CHANGED. Null for ITEMS_BATCH_CLEARED
   * (use clearedItemIds). For STATUS_CHANGED, read the new status from
   * node.status.
   */
  node: Maybe<ShoppingListEventNode>;
  /** Device/client that triggered the change (for echo suppression). */
  originatorClientId: Maybe<Scalars['ID']['output']>;
  subtype: ShoppingListSubtype;
  timestamp: Scalars['DateTime']['output'];
  /**
   * Names of the fields that changed (LIST_UPDATED / STATUS_CHANGED /
   * ITEMS_CHANGED). Empty when not applicable.
   */
  updatedFields: Array<Scalars['String']['output']>;
};

export type ShoppingListEventNode = ShoppingList | ShoppingListCollaborator | ShoppingListItem;

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

export type ShoppingListItemConnection = Connection & {
  __typename: 'ShoppingListItemConnection';
  edges: Array<ShoppingListItemEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

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

export type ShoppingListOwnershipConnection = Connection & {
  __typename: 'ShoppingListOwnershipConnection';
  edges: Array<ShoppingListOwnershipEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type ShoppingListOwnershipEdge = Edge & {
  __typename: 'ShoppingListOwnershipEdge';
  cursor: Scalars['String']['output'];
  node: ShoppingListOwnership;
};

/** Order by options for shopping list ownerships */
export type ShoppingListOwnershipOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  transferredAt?: InputMaybe<SortOrder>;
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

/**
 * Subtype discriminator for shopping list domain events.
 * Values match the client-side changeType contract.
 */
export enum ShoppingListSubtype {
  /**
   * A collaborator on the list was added, updated, or removed.
   * node is a ShoppingListCollaborator; branch on collaborator.status.
   */
  CollaborationChanged = 'COLLABORATION_CHANGED',
  /** Multiple items cleared from the list in one operation */
  ItemsBatchCleared = 'ITEMS_BATCH_CLEARED',
  /** Shopping list item created, updated, or deleted */
  ItemsChanged = 'ITEMS_CHANGED',
  /** Shopping list metadata changed (name, settings, etc.) */
  ListUpdated = 'LIST_UPDATED',
  /** Shopping list status changed (ACTIVE / COMPLETED / etc.) */
  StatusChanged = 'STATUS_CHANGED'
}

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

export type SpoonacularCaloricBreakdownInput = {
  percentCarbs?: InputMaybe<Scalars['Float']['input']>;
  percentFat?: InputMaybe<Scalars['Float']['input']>;
  percentProtein?: InputMaybe<Scalars['Float']['input']>;
};

/** Sub-input for spoonacular-specific data */
export type SpoonacularDataInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  consistency?: InputMaybe<Scalars['String']['input']>;
  originalString?: InputMaybe<Scalars['String']['input']>;
  spoonacularIngredientId?: InputMaybe<Scalars['Int']['input']>;
};

export type SpoonacularEstimatedCostInput = {
  unit?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['Float']['input']>;
};

/**
 * Typed Spoonacular ingredient payload. Mirrors Spoonacular
 * GET /food/ingredients/{id}/information (+ recipe extendedIngredient fields)
 * so the catalog mirror is loss-free. See docs/architecture/external-ingredient-mirror.md.
 */
export type SpoonacularIngredientInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  amount?: InputMaybe<Scalars['Float']['input']>;
  categoryPath?: InputMaybe<Array<Scalars['String']['input']>>;
  consistency?: InputMaybe<Scalars['String']['input']>;
  estimatedCost?: InputMaybe<SpoonacularEstimatedCostInput>;
  id: Scalars['Int']['input'];
  image?: InputMaybe<Scalars['String']['input']>;
  measures?: InputMaybe<SpoonacularMeasuresInput>;
  meta?: InputMaybe<Array<Scalars['String']['input']>>;
  name: Scalars['String']['input'];
  nameClean?: InputMaybe<Scalars['String']['input']>;
  nutrition?: InputMaybe<SpoonacularNutritionInput>;
  original?: InputMaybe<Scalars['String']['input']>;
  originalName?: InputMaybe<Scalars['String']['input']>;
  possibleUnits?: InputMaybe<Array<Scalars['String']['input']>>;
  shoppingListUnits?: InputMaybe<Array<Scalars['String']['input']>>;
  unit?: InputMaybe<Scalars['String']['input']>;
  unitLong?: InputMaybe<Scalars['String']['input']>;
  unitShort?: InputMaybe<Scalars['String']['input']>;
};

export type SpoonacularMeasureInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  unitLong?: InputMaybe<Scalars['String']['input']>;
  unitShort?: InputMaybe<Scalars['String']['input']>;
};

export type SpoonacularMeasuresInput = {
  metric?: InputMaybe<SpoonacularMeasureInput>;
  us?: InputMaybe<SpoonacularMeasureInput>;
};

export type SpoonacularNutrientInput = {
  amount: Scalars['Float']['input'];
  name: Scalars['String']['input'];
  percentOfDailyNeeds?: InputMaybe<Scalars['Float']['input']>;
  unit?: InputMaybe<Scalars['String']['input']>;
};

export type SpoonacularNutritionInput = {
  caloricBreakdown?: InputMaybe<SpoonacularCaloricBreakdownInput>;
  flavonoids?: InputMaybe<Array<SpoonacularNutrientInput>>;
  nutrients?: InputMaybe<Array<SpoonacularNutrientInput>>;
  properties?: InputMaybe<Array<SpoonacularNutrientInput>>;
  weightPerServing?: InputMaybe<SpoonacularWeightPerServingInput>;
};

export type SpoonacularWeightPerServingInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  unit?: InputMaybe<Scalars['String']['input']>;
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

export type StoreEdge = Edge & {
  __typename: 'StoreEdge';
  cursor: Scalars['String']['output'];
  node: Store;
};

/**
 * Consolidated real-time event envelope for store changes. Subscribe via
 * storeEvents(storeId) (omit storeId for all stores) and branch on
 * mutation (CREATED / UPDATED).
 */
export type StoreEvent = {
  __typename: 'StoreEvent';
  /** The user who caused the change. */
  actorUserId: Maybe<Scalars['ID']['output']>;
  mutation: MutationType;
  node: Store;
  /** The affected store's id (subscription scope). */
  storeId: Maybe<Scalars['ID']['output']>;
  subtype: StoreSubtype;
  timestamp: Scalars['DateTime']['output'];
};

/** Sub-input for store-related filters */
export type StoreFilterInput = {
  inventoryStatus?: InputMaybe<Scalars['String']['input']>;
  storeId?: InputMaybe<Scalars['ID']['input']>;
  storeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
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

/**
 * Sort options for the stores list. Object-map convention: set a field to
 * ASC or DESC. Setting `popularity` routes to the popular-stores ranking.
 */
export type StoreOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  name?: InputMaybe<SortOrder>;
  popularity?: InputMaybe<SortOrder>;
};

/** Sub-input for store preferences */
export type StorePreferencesInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  preferredStoreId?: InputMaybe<Scalars['ID']['input']>;
  storeSection?: InputMaybe<Scalars['String']['input']>;
};

export type StorePriceComparison = {
  __typename: 'StorePriceComparison';
  lastUpdated: Maybe<Scalars['DateTime']['output']>;
  offers: Array<OfferSummary>;
  price: Maybe<Scalars['Float']['output']>;
  storeId: Scalars['ID']['output'];
  storeName: Scalars['String']['output'];
  unitPrice: Maybe<Scalars['Float']['output']>;
};

export type StoreSkuInput = {
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

/** Subtype discriminator for store domain events. */
export enum StoreSubtype {
  /** A store (or its store-info) was created or updated. */
  StoreChanged = 'STORE_CHANGED'
}

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
  /**
   * Subscribe to create / update / delete events for a single cooking log.
   * Subscribers can only watch logs they own.
   */
  cookingLogEvents: CookingLogEvent;
  /**
   * Subscribe to all device events for a user. Discriminate by subtype:
   * REGISTERED, ACTIVITY, STATUS_CHANGED, TRUST_CHANGED, VERIFIED, DELETED.
   */
  deviceEvents: DeviceEvent;
  /**
   * Consolidated per-home event stream (membership changes + home-invite
   * changes). Subscribe once per home and branch on subtype, then on node's
   * __typename (Membership vs HomeInvite).
   */
  homeEvents: HomeEvent;
  /**
   * Subscribe to all login events for a user. Discriminate by subtype:
   * ATTEMPTED, FAILED, RISKY, SUSPICIOUS.
   */
  loginEvents: LoginEvent;
  /**
   * Subscribe to all shared meal-plan and meal-template collaboration events for
   * a home. Discriminate by subtype: MEAL_PLAN_CHANGED, MEAL_PLAN_ITEM_CHANGED,
   * MEAL_TEMPLATE_CHANGED, MEAL_TEMPLATE_ITEM_CHANGED. Caller must be a member of
   * the home.
   */
  mealPlanEvents: MealPlanEvent;
  /**
   * Subscribe to all shopping list domain events across all of the current
   * user's shopping lists. One subscription covers every list the user can
   * access.
   */
  myShoppingListsEvents: ShoppingListEvent;
  /**
   * Consolidated notification event stream for the current user (created,
   * updated, read, dismissed). Subscribe once and branch on subtype. Always
   * scoped to the authenticated user.
   */
  notificationEvents: NotificationEvent;
  /**
   * Subscribe to all pantry domain events for a single pantry.
   * Discriminate by subtype: PANTRY_UPDATED, ITEM_CHANGED, USAGE_CHANGED,
   * LOW_STOCK_ALERT, EXPIRATION_ALERT, WASTE_ALERT,
   * EXPIRATION_NOTIFICATION_CREATED, EXPIRATION_ACTION_TAKEN.
   */
  pantryEvents: PantryEvent;
  /**
   * Subscribe to all shopping list domain events for a single list.
   * Discriminate by subtype: LIST_UPDATED, STATUS_CHANGED, ITEMS_CHANGED,
   * ITEMS_BATCH_CLEARED, COLLABORATION_CHANGED.
   */
  shoppingListEvents: ShoppingListEvent;
  /** Subscribe to store changes. Omit storeId to watch all stores. */
  storeEvents: StoreEvent;
  /**
   * Consolidated per-user event stream (account update, profile change, and
   * home/shopping-list membership + moderation lifecycle transitions).
   * Subscribe once and branch on subtype.
   */
  userEvents: UserEvent;
};


export type SubscriptionCookingLogEventsArgs = {
  cookingLogId: Scalars['ID']['input'];
};


export type SubscriptionDeviceEventsArgs = {
  userId: Scalars['ID']['input'];
};


export type SubscriptionHomeEventsArgs = {
  homeId: Scalars['ID']['input'];
};


export type SubscriptionLoginEventsArgs = {
  userId: Scalars['ID']['input'];
};


export type SubscriptionMealPlanEventsArgs = {
  homeId: Scalars['ID']['input'];
};


export type SubscriptionPantryEventsArgs = {
  pantryId: Scalars['ID']['input'];
};


export type SubscriptionShoppingListEventsArgs = {
  listId: Scalars['ID']['input'];
};


export type SubscriptionStoreEventsArgs = {
  storeId?: InputMaybe<Scalars['ID']['input']>;
};


export type SubscriptionUserEventsArgs = {
  userId: Scalars['ID']['input'];
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
 * Which suggestion surface a dismissal applies to. Dismissals are scoped per
 * surface, so a user can hide an item from pantry suggestions while keeping it
 * in shopping suggestions (and vice-versa).
 */
export enum SuggestionSurface {
  /** Pantry item suggestions (Pantry.suggestions) */
  Pantry = 'PANTRY',
  /** Shopping list item suggestions (ShoppingList.suggestions) */
  Shopping = 'SHOPPING'
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

export type SyncDeletePantryItemInput = {
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type SyncDeleteShoppingListItemInput = {
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type SyncMoveShoppingListItemInput = {
  afterId?: InputMaybe<Scalars['ID']['input']>;
  beforeId?: InputMaybe<Scalars['ID']['input']>;
  clientId: Scalars['ID']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export enum SyncOperation {
  Create = 'CREATE',
  Delete = 'DELETE',
  Move = 'MOVE',
  Update = 'UPDATE'
}

export type SyncPantryItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  clientId: Scalars['ID']['input'];
  expirationAlert?: InputMaybe<Scalars['Boolean']['input']>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
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
  /**
   * True when this sync CONVERGED on a pre-existing row (the client id matched,
   * so it was an update/replay rather than a fresh create). The canonical,
   * API-wide replay flag.
   */
  converged: Scalars['Boolean']['output'];
  item: Maybe<PantryItem>;
  operation: SyncOperation;
  serverId: Maybe<Scalars['ID']['output']>;
};

/** Sub-input for sync settings */
export type SyncSettingsInput = {
  autoSync?: InputMaybe<Scalars['Boolean']['input']>;
  offlineMode?: InputMaybe<Scalars['Boolean']['input']>;
};

export type SyncShoppingListItemFullInput = {
  clientId: Scalars['ID']['input'];
  item: SyncShoppingListItemInput;
};

export type SyncShoppingListItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  category?: InputMaybe<Scalars['String']['input']>;
  /** Item reference: exactly one of a catalog item id or a free-text name (@oneOf). */
  item: ItemRefInput;
  netWeight?: InputMaybe<NetWeightInput>;
  /** User-provided information */
  notes?: InputMaybe<Scalars['String']['input']>;
  pricing?: InputMaybe<PricingEstimatesInput>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  purchaseTracking?: InputMaybe<PurchaseTrackingInput>;
  /**
   * Quantity of the item. Accepts: "1/3", "1 1/4", "0.5", "2", or numbers like 1, 1.5.
   * Unitless by default; specify a unit via the unit field when needed (shopping
   * items are frequently unitless, e.g. Milk x2). Mirrors CreateShoppingListItemInput.
   */
  quantity?: InputMaybe<Scalars['FlexibleQuantity']['input']>;
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
  /** The client-provided permanent ID (CUID) echoed back for correlation */
  clientId: Scalars['ID']['output'];
  /** Conflict information if version mismatch occurred */
  conflict: Maybe<SyncConflictInfo>;
  /**
   * True when this sync CONVERGED on a pre-existing row (the client id matched,
   * so it was an update/replay rather than a fresh create). The canonical,
   * API-wide replay flag.
   */
  converged: Scalars['Boolean']['output'];
  /** The synced shopping list item (null for delete operations) */
  item: Maybe<ShoppingListItem>;
  /** The operation that was performed */
  operation: SyncOperation;
  /** The server-assigned database ID (equals clientId; null if item was deleted before reaching server) */
  serverId: Maybe<Scalars['ID']['output']>;
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

export type ToggleReviewHelpfulPayload = {
  __typename: 'ToggleReviewHelpfulPayload';
  recipeReview: Maybe<RecipeReview>;
  reviewHelpful: ReviewHelpful;
};

export type ToggleReviewHelpfulResult = ConflictError | ForbiddenError | NotFoundError | ToggleReviewHelpfulPayload | ValidationError;

/** Input for toggling the purchased state of a shopping list item */
export type ToggleShoppingListItemPurchasedInput = {
  id: Scalars['ID']['input'];
  purchased: Scalars['Boolean']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type ToggleShoppingListItemPurchasedPayload = {
  __typename: 'ToggleShoppingListItemPurchasedPayload';
  shoppingList: Maybe<ShoppingList>;
  shoppingListItem: ShoppingListItem;
};

export type ToggleShoppingListItemPurchasedResult = ConflictError | ForbiddenError | NotFoundError | ToggleShoppingListItemPurchasedPayload | ValidationError;

export type TransferHomeOwnershipInput = {
  homeId: Scalars['ID']['input'];
  newOwnerId: Scalars['ID']['input'];
};

export type TransferHomeOwnershipPayload = {
  __typename: 'TransferHomeOwnershipPayload';
  home: Maybe<Home>;
  homeOwnership: HomeOwnership;
};

export type TransferHomeOwnershipResult = ConflictError | ForbiddenError | NotFoundError | TransferHomeOwnershipPayload | ValidationError;

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

/**
 * Self-service account update: the caller updating their own User row. Exposes
 * ONLY non-privileged, self-editable fields — privileged fields (email, role,
 * emailVerified, deletedAt) are deliberately absent so a caller cannot submit
 * them at all (schema-surface mass-assignment prevention, finding C1). Admin
 * changes go through adminUpdateUser. Profile (name/bio/avatar) lives on
 * updateProfile; app settings on updateSettings.
 */
export type UpdateAccountInput = {
  onBoarded?: InputMaybe<Scalars['Boolean']['input']>;
  preferredCurrency?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateAccountPayload = {
  __typename: 'UpdateAccountPayload';
  user: User;
};

export type UpdateAccountResult = ConflictError | ForbiddenError | NotFoundError | UpdateAccountPayload | ValidationError;

export type UpdateBrandInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
};

export type UpdateBrandPayload = {
  __typename: 'UpdateBrandPayload';
  brand: Brand;
};

export type UpdateBrandResult = ConflictError | ForbiddenError | NotFoundError | UpdateBrandPayload | ValidationError;

export type UpdateCategoryInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  icon?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  visibility?: InputMaybe<Visibility>;
};

export type UpdateCategoryPayload = {
  __typename: 'UpdateCategoryPayload';
  category: Category;
};

export type UpdateCategoryResult = ConflictError | ForbiddenError | NotFoundError | UpdateCategoryPayload | ValidationError;

export type UpdateCollaboratorPermissionsFullInput = {
  collaboratorId: Scalars['ID']['input'];
  permissions: UpdateCollaboratorPermissionsInput;
  shoppingListId: Scalars['ID']['input'];
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

export type UpdateCollaboratorPermissionsPayload = {
  __typename: 'UpdateCollaboratorPermissionsPayload';
  collaborator: ShoppingListCollaborator;
  shoppingList: Maybe<ShoppingList>;
};

export type UpdateCollaboratorPermissionsResult = ConflictError | ForbiddenError | NotFoundError | UpdateCollaboratorPermissionsPayload | ValidationError;

/** Input for updating a collaborator's role */
export type UpdateCollaboratorRoleInput = {
  collaboratorId: Scalars['ID']['input'];
  role: CollaboratorRole;
  shoppingListId: Scalars['ID']['input'];
};

export type UpdateCollaboratorRolePayload = {
  __typename: 'UpdateCollaboratorRolePayload';
  collaborator: ShoppingListCollaborator;
  shoppingList: Maybe<ShoppingList>;
};

export type UpdateCollaboratorRoleResult = ConflictError | ForbiddenError | NotFoundError | UpdateCollaboratorRolePayload | ValidationError;

export type UpdateCookingLogInput = {
  actualCookTime?: InputMaybe<Scalars['Int']['input']>;
  actualPrepTime?: InputMaybe<Scalars['Int']['input']>;
  difficulty?: InputMaybe<Difficulty>;
  id: Scalars['ID']['input'];
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  rating?: InputMaybe<Scalars['Int']['input']>;
  servingsMade?: InputMaybe<Scalars['Int']['input']>;
  wouldMakeAgain?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateCookingLogPayload = {
  __typename: 'UpdateCookingLogPayload';
  cookingLog: CookingLog;
  recipe: Maybe<Recipe>;
};

export type UpdateCookingLogResult = ConflictError | ForbiddenError | NotFoundError | UpdateCookingLogPayload | ValidationError;

export type UpdateCurrencyInput = {
  code?: InputMaybe<Scalars['String']['input']>;
  decimalPlaces?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateCurrencyPayload = {
  __typename: 'UpdateCurrencyPayload';
  currency: Currency;
};

export type UpdateCurrencyResult = ConflictError | ForbiddenError | NotFoundError | UpdateCurrencyPayload | ValidationError;

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
  id: Scalars['ID']['input'];
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

export type UpdateDevicePayload = {
  __typename: 'UpdateDevicePayload';
  device: Maybe<Device>;
};

export type UpdateDeviceResult = ConflictError | ForbiddenError | NotFoundError | UpdateDevicePayload | ValidationError;

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

export type UpdateDietaryProfilePayload = {
  __typename: 'UpdateDietaryProfilePayload';
  dietaryProfile: DietaryProfile;
};

export type UpdateDietaryProfileResult = ConflictError | ForbiddenError | NotFoundError | UpdateDietaryProfilePayload | ValidationError;

export type UpdateExternalSourceInput = {
  externalName?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  identifiers?: InputMaybe<Scalars['JSON']['input']>;
  images?: InputMaybe<Scalars['JSON']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  netWeight?: InputMaybe<Scalars['Float']['input']>;
  netWeightUnit?: InputMaybe<Scalars['String']['input']>;
  packageSize?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateExternalSourcePayload = {
  __typename: 'UpdateExternalSourcePayload';
  externalSourceMapping: ExternalSourceMapping;
};

export type UpdateExternalSourceResult = ConflictError | ForbiddenError | NotFoundError | UpdateExternalSourcePayload | ValidationError;

export type UpdateFavoriteRecipeInput = {
  folder?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  personalRating?: InputMaybe<Scalars['Int']['input']>;
  recipeId: Scalars['ID']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateFavoriteRecipePayload = {
  __typename: 'UpdateFavoriteRecipePayload';
  recipe: Maybe<Recipe>;
  savedRecipe: SavedRecipe;
};

export type UpdateFavoriteRecipeResult = ConflictError | ForbiddenError | NotFoundError | UpdateFavoriteRecipePayload | ValidationError;

export type UpdateHomeInput = {
  allowJoinCode?: InputMaybe<Scalars['Boolean']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  maxMembers?: InputMaybe<Scalars['Int']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateHomeJoinCodeInput = {
  /** ID of the home whose join code to rotate. */
  id: Scalars['ID']['input'];
};

export type UpdateHomePayload = {
  __typename: 'UpdateHomePayload';
  home: Home;
};

export type UpdateHomeResult = ConflictError | ForbiddenError | NotFoundError | UpdateHomePayload | ValidationError;

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
  id: Scalars['ID']['input'];
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

export type UpdateItemPayload = {
  __typename: 'UpdateItemPayload';
  item: Item;
};

/** Input for updating an item's price */
export type UpdateItemPriceInput = {
  itemId: Scalars['ID']['input'];
  price: Scalars['Float']['input'];
  source?: InputMaybe<Scalars['String']['input']>;
  storeId?: InputMaybe<Scalars['ID']['input']>;
};

export type UpdateItemResult = ConflictError | ForbiddenError | NotFoundError | UpdateItemPayload | ValidationError;

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
  id: Scalars['ID']['input'];
  isMobileApp?: InputMaybe<Scalars['Boolean']['input']>;
  network?: InputMaybe<NetworkLocationInput>;
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  reviewed?: InputMaybe<Scalars['Boolean']['input']>;
  reviewerId?: InputMaybe<Scalars['ID']['input']>;
  risk?: InputMaybe<RiskAssessmentInput>;
  session?: InputMaybe<SessionInfoInput>;
};

export type UpdateLoginHistoryPayload = {
  __typename: 'UpdateLoginHistoryPayload';
  loginHistory: LoginHistory;
};

export type UpdateLoginHistoryResult = ConflictError | ForbiddenError | NotFoundError | UpdateLoginHistoryPayload | ValidationError;

export type UpdateMealPlanInput = {
  actualCost?: InputMaybe<Scalars['Float']['input']>;
  budgetAmount?: InputMaybe<Scalars['Float']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  /** Link or unlink dietary profile for nutrition goal tracking */
  dietaryProfileId?: InputMaybe<Scalars['ID']['input']>;
  endDate?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
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
  date?: InputMaybe<Scalars['DateTime']['input']>;
  /** Whether to auto-deduct recipe ingredients from pantry on completion (default: true) */
  deductFromPantry?: InputMaybe<Scalars['Boolean']['input']>;
  estimatedCost?: InputMaybe<Scalars['Float']['input']>;
  fat?: InputMaybe<Scalars['Float']['input']>;
  id: Scalars['ID']['input'];
  isCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  /**
   * Meal reference: omit to leave unchanged; if provided, exactly one of a recipe
   * id or a custom meal name (@oneOf).
   */
  meal?: InputMaybe<MealRefInput>;
  mealType?: InputMaybe<MealType>;
  notes?: InputMaybe<Scalars['String']['input']>;
  protein?: InputMaybe<Scalars['Float']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
  /** Pantry items used for this meal: [{pantryItemId, quantityUsed}] */
  usedPantryItems?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpdateMealPlanItemPayload = {
  __typename: 'UpdateMealPlanItemPayload';
  mealPlan: Maybe<MealPlan>;
  mealPlanItem: MealPlanItem;
};

export type UpdateMealPlanItemResult = ConflictError | ForbiddenError | NotFoundError | UpdateMealPlanItemPayload | ValidationError;

export type UpdateMealPlanPayload = {
  __typename: 'UpdateMealPlanPayload';
  home: Maybe<Home>;
  mealPlan: MealPlan;
};

export type UpdateMealPlanResult = ConflictError | ForbiddenError | NotFoundError | UpdateMealPlanPayload | ValidationError;

export type UpdateMealTemplateInput = {
  category?: InputMaybe<TemplateCategory>;
  defaultServings?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  durationDays?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateMealTemplatePayload = {
  __typename: 'UpdateMealTemplatePayload';
  home: Maybe<Home>;
  mealTemplate: MealTemplate;
};

export type UpdateMealTemplateResult = ConflictError | ForbiddenError | NotFoundError | UpdateMealTemplatePayload | ValidationError;

export type UpdateMembershipInput = {
  canAddItems?: InputMaybe<Scalars['Boolean']['input']>;
  canEditPantry?: InputMaybe<Scalars['Boolean']['input']>;
  canInviteOthers?: InputMaybe<Scalars['Boolean']['input']>;
  canManageHome?: InputMaybe<Scalars['Boolean']['input']>;
  canRemoveItems?: InputMaybe<Scalars['Boolean']['input']>;
  canViewPantry?: InputMaybe<Scalars['Boolean']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  role?: InputMaybe<MembershipRole>;
};

export type UpdateMembershipPayload = {
  __typename: 'UpdateMembershipPayload';
  home: Maybe<Home>;
  membership: Membership;
};

export type UpdateMembershipResult = ConflictError | ForbiddenError | NotFoundError | UpdateMembershipPayload | ValidationError;

/**
 * Input for updateModeration mutation. Wraps the target userId alongside the
 * consolidated moderation update fields so callers pass a single `input`.
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
  userId: Scalars['ID']['input'];
};

export type UpdateModerationPayload = {
  __typename: 'UpdateModerationPayload';
  userModeration: Maybe<UserModeration>;
};

export type UpdateModerationResult = ConflictError | ForbiddenError | NotFoundError | UpdateModerationPayload | ValidationError;

export type UpdateNotificationInput = {
  actionUrl?: InputMaybe<Scalars['String']['input']>;
  category?: InputMaybe<NotificationCategory>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
  message?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  payload?: InputMaybe<Scalars['JSON']['input']>;
  priority?: InputMaybe<Priority>;
  readAt?: InputMaybe<Scalars['DateTime']['input']>;
  status?: InputMaybe<NotificationStatus>;
  title?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<NotificationType>;
};

export type UpdateNotificationPayload = {
  __typename: 'UpdateNotificationPayload';
  notification: Notification;
};

export type UpdateNotificationPreferencesInput = {
  channels?: InputMaybe<NotificationChannelsInput>;
  expiration?: InputMaybe<ExpirationNotifConfigInput>;
  features?: InputMaybe<FeatureNotificationsInput>;
  quietHours?: InputMaybe<QuietHoursInput>;
};

export type UpdateNotificationPreferencesPayload = {
  __typename: 'UpdateNotificationPreferencesPayload';
  notificationPreferences: NotificationPreferences;
};

export type UpdateNotificationPreferencesResult = ConflictError | ForbiddenError | NotFoundError | UpdateNotificationPreferencesPayload | ValidationError;

export type UpdateNotificationResult = ConflictError | ForbiddenError | NotFoundError | UpdateNotificationPayload | ValidationError;

export type UpdatePantryInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  temperature?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePantryItemInput = {
  brand?: InputMaybe<BrandReferenceInput>;
  expirationAlert?: InputMaybe<Scalars['Boolean']['input']>;
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
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

export type UpdatePantryItemLocationInput = {
  id: Scalars['ID']['input'];
  storageLocationId: Scalars['String']['input'];
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdatePantryItemLocationPayload = {
  __typename: 'UpdatePantryItemLocationPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type UpdatePantryItemLocationResult = ConflictError | ForbiddenError | NotFoundError | UpdatePantryItemLocationPayload | ValidationError;

export type UpdatePantryItemPayload = {
  __typename: 'UpdatePantryItemPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

/** Input for updating pantry item quantity */
export type UpdatePantryItemQuantityInput = {
  pantryItemId: Scalars['ID']['input'];
  quantity: Scalars['String']['input'];
  unitId?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdatePantryItemQuantityPayload = {
  __typename: 'UpdatePantryItemQuantityPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type UpdatePantryItemQuantityResult = ConflictError | ForbiddenError | NotFoundError | UpdatePantryItemQuantityPayload | ValidationError;

export type UpdatePantryItemResult = ConflictError | ForbiddenError | NotFoundError | UpdatePantryItemPayload | ValidationError;

export type UpdatePantryPayload = {
  __typename: 'UpdatePantryPayload';
  home: Maybe<Home>;
  pantry: Pantry;
};

export type UpdatePantryResult = ConflictError | ForbiddenError | NotFoundError | UpdatePantryPayload | ValidationError;

export type UpdateProfileInput = {
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

export type UpdateProfilePayload = {
  __typename: 'UpdateProfilePayload';
  userProfile: UserProfile;
};

export type UpdateProfileResult = ConflictError | ForbiddenError | NotFoundError | UpdateProfilePayload | ValidationError;

export type UpdatePurchaseInput = {
  discountAmount?: InputMaybe<Scalars['Float']['input']>;
  expirationDate?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
  originalPrice?: InputMaybe<Scalars['Float']['input']>;
  purchaseDate?: InputMaybe<Scalars['DateTime']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  receiptNumber?: InputMaybe<Scalars['String']['input']>;
  totalPrice?: InputMaybe<Scalars['Float']['input']>;
  transactionId?: InputMaybe<Scalars['String']['input']>;
  unitPrice?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdatePurchasePayload = {
  __typename: 'UpdatePurchasePayload';
  purchase: Purchase;
  store: Maybe<Store>;
};

export type UpdatePurchaseResult = ConflictError | ForbiddenError | NotFoundError | UpdatePurchasePayload | ValidationError;

export type UpdateRecipeIngredientsInput = {
  ingredients: Array<RecipeIngredientInput>;
  recipeId: Scalars['ID']['input'];
};

export type UpdateRecipeIngredientsPayload = {
  __typename: 'UpdateRecipeIngredientsPayload';
  recipe: Recipe;
};

export type UpdateRecipeIngredientsResult = ConflictError | ForbiddenError | NotFoundError | UpdateRecipeIngredientsPayload | ValidationError;

export type UpdateRecipeInput = {
  addTags?: InputMaybe<Array<Scalars['String']['input']>>;
  attribution?: InputMaybe<RecipeAttributionInput>;
  description?: InputMaybe<Scalars['String']['input']>;
  dietary?: InputMaybe<DietaryTagsInput>;
  id: Scalars['ID']['input'];
  instructions?: InputMaybe<Scalars['JSON']['input']>;
  media?: InputMaybe<MediaAssetsInput>;
  metadata?: InputMaybe<RecipeMetadataInput>;
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  nutrition?: InputMaybe<NutritionInfoInput>;
  removeTags?: InputMaybe<Array<Scalars['String']['input']>>;
  status?: InputMaybe<RecipeStatus>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  timing?: InputMaybe<TimeEstimatesInput>;
  tips?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateRecipePayload = {
  __typename: 'UpdateRecipePayload';
  recipe: Recipe;
};

export type UpdateRecipeResult = ConflictError | ForbiddenError | NotFoundError | UpdateRecipePayload | ValidationError;

export type UpdateRecipeReviewInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  rating?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateRecipeReviewPayload = {
  __typename: 'UpdateRecipeReviewPayload';
  recipe: Maybe<Recipe>;
  recipeReview: RecipeReview;
};

export type UpdateRecipeReviewResult = ConflictError | ForbiddenError | NotFoundError | UpdateRecipeReviewPayload | ValidationError;

export type UpdateRestrictionInput = {
  id: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  severity?: InputMaybe<RestrictionSeverity>;
};

export type UpdateRestrictionPayload = {
  __typename: 'UpdateRestrictionPayload';
  dietaryProfile: Maybe<DietaryProfile>;
  dietaryRestriction: DietaryRestriction;
};

export type UpdateRestrictionResult = ConflictError | ForbiddenError | NotFoundError | UpdateRestrictionPayload | ValidationError;

export type UpdateSettingsInput = {
  features?: InputMaybe<FeatureTogglesInput>;
  notifications?: InputMaybe<UserNotificationSettingsInput>;
  privacy?: InputMaybe<PrivacySettingsInput>;
  quantityDisplay?: InputMaybe<QuantityDisplayInput>;
  regional?: InputMaybe<RegionalSettingsInput>;
  sync?: InputMaybe<SyncSettingsInput>;
  ui?: InputMaybe<UiPreferencesInput>;
};

export type UpdateSettingsPayload = {
  __typename: 'UpdateSettingsPayload';
  userSettings: UserSettings;
};

export type UpdateSettingsResult = ConflictError | ForbiddenError | NotFoundError | UpdateSettingsPayload | ValidationError;

export type UpdateShoppingListInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  homeId?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
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
  id: Scalars['ID']['input'];
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

export type UpdateShoppingListItemPayload = {
  __typename: 'UpdateShoppingListItemPayload';
  shoppingList: Maybe<ShoppingList>;
  shoppingListItem: ShoppingListItem;
};

/** Input for updating shopping list item quantity */
export type UpdateShoppingListItemQuantityInput = {
  itemId: Scalars['ID']['input'];
  quantity: Scalars['String']['input'];
  unitId?: InputMaybe<Scalars['ID']['input']>;
  version?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateShoppingListItemQuantityPayload = {
  __typename: 'UpdateShoppingListItemQuantityPayload';
  shoppingList: Maybe<ShoppingList>;
  shoppingListItem: ShoppingListItem;
};

export type UpdateShoppingListItemQuantityResult = ConflictError | ForbiddenError | NotFoundError | UpdateShoppingListItemQuantityPayload | ValidationError;

export type UpdateShoppingListItemResult = ConflictError | ForbiddenError | NotFoundError | UpdateShoppingListItemPayload | ValidationError;

export type UpdateShoppingListPayload = {
  __typename: 'UpdateShoppingListPayload';
  shoppingList: ShoppingList;
};

export type UpdateShoppingListReminderInput = {
  id: Scalars['ID']['input'];
  reminderDate: Scalars['DateTime']['input'];
  reminderEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateShoppingListReminderPayload = {
  __typename: 'UpdateShoppingListReminderPayload';
  shoppingList: ShoppingList;
};

export type UpdateShoppingListReminderResult = ConflictError | ForbiddenError | NotFoundError | UpdateShoppingListReminderPayload | ValidationError;

export type UpdateShoppingListResult = ConflictError | ForbiddenError | NotFoundError | UpdateShoppingListPayload | ValidationError;

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
  id: Scalars['ID']['input'];
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

/**
 * Input for reordering multiple storage locations
 * Arrays must be the same length
 */
export type UpdateStorageLocationOrderInput = {
  /** Array of location IDs to reorder */
  locationIds: Array<Scalars['ID']['input']>;
  /** Array of new sort orders (must match locationIds length) */
  sortOrders: Array<Scalars['Int']['input']>;
};

export type UpdateStorageLocationOrderPayload = {
  __typename: 'UpdateStorageLocationOrderPayload';
  home: Maybe<Home>;
  storageLocation: StorageLocation;
};

export type UpdateStorageLocationOrderResult = ConflictError | ForbiddenError | NotFoundError | UpdateStorageLocationOrderPayload | ValidationError;

export type UpdateStorageLocationPayload = {
  __typename: 'UpdateStorageLocationPayload';
  home: Maybe<Home>;
  storageLocation: StorageLocation;
};

export type UpdateStorageLocationResult = ConflictError | ForbiddenError | NotFoundError | UpdateStorageLocationPayload | ValidationError;

/** Input for updating store information */
export type UpdateStoreInfoInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  hours?: InputMaybe<StoreHoursInput>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  storeId: Scalars['ID']['input'];
  website?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateStoreInfoPayload = {
  __typename: 'UpdateStoreInfoPayload';
  store: Store;
};

export type UpdateStoreInfoResult = ConflictError | ForbiddenError | NotFoundError | UpdateStoreInfoPayload | ValidationError;

export type UpdateStoreInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  averageShelfLife?: InputMaybe<Scalars['JSON']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  priceAccuracy?: InputMaybe<Scalars['Float']['input']>;
  qualityRating?: InputMaybe<Scalars['Float']['input']>;
  supportsPriceAPI?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateStorePayload = {
  __typename: 'UpdateStorePayload';
  store: Store;
};

export type UpdateStoreResult = ConflictError | ForbiddenError | NotFoundError | UpdateStorePayload | ValidationError;

export type UpdateTemplateItemInput = {
  dayOffset?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  /**
   * Meal reference: omit to leave unchanged; if provided, exactly one of a recipe
   * id or a custom meal name (@oneOf).
   */
  meal?: InputMaybe<MealRefInput>;
  mealType?: InputMaybe<MealType>;
  notes?: InputMaybe<Scalars['String']['input']>;
  servings?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateTemplateItemPayload = {
  __typename: 'UpdateTemplateItemPayload';
  mealTemplate: Maybe<MealTemplate>;
  mealTemplateItem: MealTemplateItem;
};

export type UpdateTemplateItemResult = ConflictError | ForbiddenError | NotFoundError | UpdateTemplateItemPayload | ValidationError;

export type UpdateUnitInput = {
  baseUnitId?: InputMaybe<Scalars['ID']['input']>;
  conversionFactor?: InputMaybe<Scalars['Float']['input']>;
  id: Scalars['ID']['input'];
  isCommon?: InputMaybe<Scalars['Boolean']['input']>;
  isMetric?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<UnitType>;
};

export type UpdateUnitPayload = {
  __typename: 'UpdateUnitPayload';
  unit: Unit;
};

export type UpdateUnitResult = ConflictError | ForbiddenError | NotFoundError | UpdateUnitPayload | ValidationError;

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

export type UpdateUserAddressPayload = {
  __typename: 'UpdateUserAddressPayload';
  userAddress: UserAddress;
};

export type UpdateUserAddressResult = ConflictError | ForbiddenError | NotFoundError | UpdateUserAddressPayload | ValidationError;

/** Input for managing appeals (submit or review). */
export type UpdateUserAppealInput = {
  /** For submitting: appeal notes from the user */
  appealNotes?: InputMaybe<Scalars['String']['input']>;
  /** For reviewing: whether the appeal is approved (null = submitting, true/false = reviewing) */
  approved?: InputMaybe<Scalars['Boolean']['input']>;
  /** For reviewing: reviewer's notes */
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type UpdateUserAppealPayload = {
  __typename: 'UpdateUserAppealPayload';
  userModeration: Maybe<UserModeration>;
};

export type UpdateUserAppealResult = ConflictError | ForbiddenError | NotFoundError | UpdateUserAppealPayload | ValidationError;

export type UpdateUserModerationInput = {
  moderatorNotes?: InputMaybe<Scalars['String']['input']>;
  restrictedUntil?: InputMaybe<Scalars['DateTime']['input']>;
  restrictionReason?: InputMaybe<Scalars['String']['input']>;
  restrictions?: InputMaybe<Array<ModerationRestriction>>;
  riskScore?: InputMaybe<Scalars['Float']['input']>;
  status?: InputMaybe<ModerationStatus>;
  trustLevel?: InputMaybe<TrustLevel>;
};

/** Input for managing restrictions (add and/or remove in one call). */
export type UpdateUserRestrictionsInput = {
  /** Restrictions to add */
  add?: InputMaybe<Array<ModerationRestriction>>;
  reason?: InputMaybe<Scalars['String']['input']>;
  /** Restrictions to remove */
  remove?: InputMaybe<Array<ModerationRestriction>>;
  restrictedUntil?: InputMaybe<Scalars['DateTime']['input']>;
  userId: Scalars['ID']['input'];
};

export type UpdateUserRestrictionsPayload = {
  __typename: 'UpdateUserRestrictionsPayload';
  userModeration: Maybe<UserModeration>;
};

export type UpdateUserRestrictionsResult = ConflictError | ForbiddenError | NotFoundError | UpdateUserRestrictionsPayload | ValidationError;

export type UploadFormField = {
  __typename: 'UploadFormField';
  name: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type UpsertExternalRecipePayload = {
  __typename: 'UpsertExternalRecipePayload';
  /** True if the recipe was newly created, false if an existing one was updated. */
  created: Scalars['Boolean']['output'];
  /** The created or updated recipe. */
  recipe: Recipe;
};

export type UpsertExternalRecipeResult = ConflictError | ForbiddenError | NotFoundError | UpsertExternalRecipePayload | ValidationError;

export type UpsertItemByExternalSourceInput = {
  externalId: Scalars['String']['input'];
  externalType?: InputMaybe<Scalars['String']['input']>;
  itemData: CreateItemInput;
  source: ExternalSource;
  sourceData?: InputMaybe<Scalars['JSON']['input']>;
};

export type UpsertItemByExternalSourcePayload = {
  __typename: 'UpsertItemByExternalSourcePayload';
  /** True if the item was newly created, false if an existing one was updated. */
  created: Scalars['Boolean']['output'];
  /** The created or updated catalog item. */
  item: Item;
  /** The external-source mapping linking the item to its source. */
  mapping: ExternalSourceMapping;
};

export type UpsertItemByExternalSourceResult = ConflictError | ForbiddenError | NotFoundError | UpsertItemByExternalSourcePayload | ValidationError;

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

export type UpsertItemUnitConversionPayload = {
  __typename: 'UpsertItemUnitConversionPayload';
  unitConversion: ItemUnitConversion;
};

export type UpsertItemUnitConversionResult = ConflictError | ForbiddenError | NotFoundError | UpsertItemUnitConversionPayload | ValidationError;

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
  addressesConnection: UserAddressConnection;
  /** Whether this user can access developer tools and internal dashboards */
  canAccessDevTools: Scalars['Boolean']['output'];
  collaboratedShoppingListsConnection: ShoppingListConnection;
  cookingLogsConnection: CookingLogConnection;
  cookingStats: Maybe<CookingStats>;
  createdAt: Scalars['DateTime']['output'];
  defaultHome: Maybe<Home>;
  defaultHomeId: Maybe<Scalars['ID']['output']>;
  defaultShoppingListId: Maybe<Scalars['ID']['output']>;
  deviceStats: DeviceStats;
  devicesConnection: DeviceConnection;
  dietaryProfile: Maybe<DietaryProfile>;
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  expirationNotificationsConnection: ExpirationNotificationConnection;
  hasUrgentNotifications: Scalars['Boolean']['output'];
  homeOwnershipsConnection: HomeOwnershipConnection;
  id: Scalars['ID']['output'];
  inviteLogsConnection: InviteLogConnection;
  language: Maybe<Scalars['String']['output']>;
  lastActiveAt: Maybe<Scalars['DateTime']['output']>;
  loginHistoryConnection: LoginHistoryConnection;
  loginHistoryStats: LoginHistoryStats;
  membershipInHome: Maybe<Membership>;
  membershipsConnection: MembershipConnection;
  moderation: Maybe<UserModeration>;
  notificationPreferences: Maybe<NotificationPreferences>;
  notificationsConnection: NotificationConnection;
  onBoarded: Scalars['Boolean']['output'];
  pendingCollaborationInvitesConnection: ShoppingListCollaboratorConnection;
  pendingHomeInvitesConnection: HomeInviteConnection;
  preferredCurrency: Maybe<Scalars['String']['output']>;
  profile: Maybe<UserProfile>;
  purchaseStats: PurchaseStats;
  purchasesConnection: PurchaseConnection;
  role: UserRole;
  savedRecipesConnection: SavedRecipeConnection;
  sentHomeInvitesConnection: HomeInviteConnection;
  settings: Maybe<UserSettings>;
  shoppingListInvitesConnection: ShoppingListCollaboratorConnection;
  shoppingListOwnershipsConnection: ShoppingListOwnershipConnection;
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
export type UserAddressesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<UserAddressOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserCollaboratedShoppingListsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ShoppingListOrderBy>;
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
export type UserDevicesConnectionArgs = {
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
  filters?: InputMaybe<ExpirationNotificationFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ExpirationNotificationOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserHomeOwnershipsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
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
export type UserLoginHistoryConnectionArgs = {
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
export type UserMembershipsConnectionArgs = {
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
  filters?: InputMaybe<NotificationFilters>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<NotificationOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserPendingCollaborationInvitesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserPendingHomeInvitesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserPurchasesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<PurchaseFilters>;
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
export type UserSentHomeInvitesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserShoppingListInvitesConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserShoppingListOwnershipsConnectionArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ShoppingListOwnershipOrderBy>;
};


/**
 * User account type
 * Cache: 5 minutes - user data changes occasionally, always private
 */
export type UserSuspiciousLoginActivityArgs = {
  hours?: InputMaybe<Scalars['Int']['input']>;
};

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

export type UserAddressConnection = Connection & {
  __typename: 'UserAddressConnection';
  edges: Array<UserAddressEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type UserAddressEdge = Edge & {
  __typename: 'UserAddressEdge';
  cursor: Scalars['String']['output'];
  node: UserAddress;
};

export type UserAddressOrderBy = {
  createdAt?: InputMaybe<SortOrder>;
  isDefault?: InputMaybe<SortOrder>;
};

export type UserAuthPayload = {
  __typename: 'UserAuthPayload';
  authType: Scalars['String']['output'];
  deviceInfo: Maybe<Scalars['JSON']['output']>;
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
};

export type UserConnection = Connection & {
  __typename: 'UserConnection';
  edges: Array<UserEdge>;
  pageInfo: PageInfo;
  totalCount: Maybe<Scalars['Int']['output']>;
};

export type UserEdge = Edge & {
  __typename: 'UserEdge';
  cursor: Scalars['String']['output'];
  node: User;
};

/**
 * Consolidated per-user event envelope. Discriminate by subtype; branch on
 * node's __typename for ACCOUNT_UPDATED / PROFILE_CHANGED and read
 * parents / reason / warningCount for the lifecycle subtypes.
 */
export type UserEvent = {
  __typename: 'UserEvent';
  /**
   * Originator of the change, for self-echo suppression. For account/profile
   * updates this is the user themselves; for moderation it is the moderator
   * (null for system actions).
   */
  actorUserId: Maybe<Scalars['ID']['output']>;
  /**
   * Mutation kind for this event. UPDATED for ACCOUNT_UPDATED / PROFILE_CHANGED
   * and the moderation subtypes (BANNED / UNBANNED / SUSPENDED / UNSUSPENDED /
   * WARNED); CREATED for ADDED_TO_*; DELETED for REMOVED_FROM_*.
   */
  mutation: MutationType;
  node: Maybe<UserEventNode>;
  parents: Maybe<UserEventParents>;
  reason: Maybe<Scalars['String']['output']>;
  subtype: UserSubtype;
  timestamp: Scalars['DateTime']['output'];
  updatedFields: Maybe<Array<Scalars['String']['output']>>;
  userId: Scalars['ID']['output'];
  warningCount: Maybe<Scalars['Int']['output']>;
};

/**
 * The changed entity for a userEvents payload. Present for ACCOUNT_UPDATED
 * (User) and PROFILE_CHANGED (UserProfile); null for lifecycle subtypes,
 * which carry their context on the envelope (parents / reason / warningCount).
 */
export type UserEventNode = User | UserProfile;

/**
 * Parent resource IDs for lifecycle subtypes. Null for ACCOUNT_UPDATED /
 * PROFILE_CHANGED.
 */
export type UserEventParents = {
  __typename: 'UserEventParents';
  homeId: Maybe<Scalars['ID']['output']>;
  shoppingListId: Maybe<Scalars['ID']['output']>;
};

/** Filter criteria for the admin users list query. */
export type UserFilters = {
  /** Free-text search across username / email */
  search?: InputMaybe<Scalars['String']['input']>;
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
  createdById: Maybe<Scalars['ID']['output']>;
  deletedBy: Maybe<User>;
  deletedById: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  isBanned: Scalars['Boolean']['output'];
  isSuspended: Scalars['Boolean']['output'];
  lastModifiedBy: Maybe<User>;
  lastModifiedById: Maybe<Scalars['ID']['output']>;
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

export type UserSocialPayload = {
  __typename: 'UserSocialPayload';
  action: Scalars['String']['output'];
  targetUserId: Scalars['ID']['output'];
  timestamp: Scalars['DateTime']['output'];
  userId: Scalars['ID']['output'];
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

/**
 * Subtype discriminator for the consolidated userEvents stream.
 * Carries the account/profile mutation subtypes plus every per-user
 * lifecycle transition (home/shopping-list membership + moderation), so a
 * single subscription replaces userUpdated + userProfileChanged.
 */
export enum UserSubtype {
  AccountUpdated = 'ACCOUNT_UPDATED',
  AddedToHome = 'ADDED_TO_HOME',
  AddedToShoppingList = 'ADDED_TO_SHOPPING_LIST',
  Banned = 'BANNED',
  ProfileChanged = 'PROFILE_CHANGED',
  RemovedFromHome = 'REMOVED_FROM_HOME',
  RemovedFromShoppingList = 'REMOVED_FROM_SHOPPING_LIST',
  Suspended = 'SUSPENDED',
  Unbanned = 'UNBANNED',
  Unsuspended = 'UNSUSPENDED',
  Warned = 'WARNED'
}

export type ValidatePasswordResetTokenInput = {
  token: Scalars['String']['input'];
};

export type ValidatePasswordResetTokenPayload = {
  __typename: 'ValidatePasswordResetTokenPayload';
  message: Scalars['String']['output'];
  status: PasswordActionStatus;
  userId: Maybe<Scalars['ID']['output']>;
};

export type ValidatePasswordResetTokenResult = ConflictError | ForbiddenError | NotFoundError | ValidatePasswordResetTokenPayload | ValidationError;

/**
 * Input validation failure. Either a top-level rule was violated or a
 * specific field failed validation (carried in `field`).
 */
export type ValidationError = Error & {
  __typename: 'ValidationError';
  code: ErrorCode;
  /** Dotted path to the offending field, when the error is field-specific. */
  field: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
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

export type VerifyEmailInput = {
  code: Scalars['String']['input'];
};

export type VerifyEmailPayload = {
  __typename: 'VerifyEmailPayload';
  user: User;
};

export type VerifyEmailResult = ConflictError | ForbiddenError | NotFoundError | ValidationError | VerifyEmailPayload;

/** Input for verifying an item unit conversion (admin only) */
export type VerifyItemUnitConversionInput = {
  confidence?: InputMaybe<Scalars['Float']['input']>;
  conversionId: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
};

export type VerifyItemUnitConversionPayload = {
  __typename: 'VerifyItemUnitConversionPayload';
  unitConversion: ItemUnitConversion;
};

export type VerifyItemUnitConversionResult = ConflictError | ForbiddenError | NotFoundError | ValidationError | VerifyItemUnitConversionPayload;

export type VerifyUserEmailInput = {
  id: Scalars['ID']['input'];
};

export type VerifyUserEmailPayload = {
  __typename: 'VerifyUserEmailPayload';
  user: User;
};

export type VerifyUserEmailResult = ConflictError | ForbiddenError | NotFoundError | ValidationError | VerifyUserEmailPayload;

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

/** Input for wasting a specific batch */
export type WastePantryItemBatchInput = {
  batchId: Scalars['ID']['input'];
  idempotencyKey?: InputMaybe<Scalars['ID']['input']>;
  isComposted?: InputMaybe<Scalars['Boolean']['input']>;
  isRecycled?: InputMaybe<Scalars['Boolean']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  wasteReason?: InputMaybe<WasteReason>;
};

export type WastePantryItemBatchPayload = {
  __typename: 'WastePantryItemBatchPayload';
  pantry: Maybe<Pantry>;
  pantryItem: PantryItem;
};

export type WastePantryItemBatchResult = ConflictError | ForbiddenError | NotFoundError | ValidationError | WastePantryItemBatchPayload;

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
