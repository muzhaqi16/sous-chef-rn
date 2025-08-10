// Shared GraphQL types - no hooks
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends {[key: string]: unknown}> = {[K in keyof T]: T[K]};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<T extends {[key: string]: unknown}, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | {[P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: {input: string; output: string};
  String: {input: string; output: string};
  Boolean: {input: boolean; output: boolean};
  Int: {input: number; output: number};
  Float: {input: number; output: number};
  DateTime: {input: string; output: string};
  JSON: {input: any; output: any};
  Upload: {input: any; output: any};
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
  itemId: Scalars['String']['input'];
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
  unitId: Scalars['String']['input'];
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

export type BarcodeValidation = {
  __typename?: 'BarcodeValidation';
  exists: Scalars['Boolean']['output'];
  format?: Maybe<Scalars['String']['output']>;
  isValid: Scalars['Boolean']['output'];
  item?: Maybe<Item>;
};

export type Brand = {
  __typename?: 'Brand';
  children: Array<Brand>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  itemCount: Scalars['Int']['output'];
  items: Array<ItemBrand>;
  logo?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  parent?: Maybe<Brand>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
  website?: Maybe<Scalars['String']['output']>;
};

export type BrandInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  logo?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  website?: InputMaybe<Scalars['String']['input']>;
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

export type CreateCurrencyInput = {
  code: Scalars['String']['input'];
  decimalPlaces: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  symbol: Scalars['String']['input'];
};

export type CreateDeviceInput = {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  lastCity?: InputMaybe<Scalars['String']['input']>;
  lastCountry?: InputMaybe<Scalars['String']['input']>;
  lastIpAddress?: InputMaybe<Scalars['String']['input']>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  platform?: InputMaybe<MobilePlatform>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
  screenResolution?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  userAgent?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type CreateHomeInput = {
  allowJoinCode?: InputMaybe<Scalars['Boolean']['input']>;
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
  allergens?: InputMaybe<Array<AllergenInput>>;
  averagePrice?: InputMaybe<Scalars['Float']['input']>;
  barcode?: InputMaybe<Scalars['String']['input']>;
  brandId?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<CategoryInput>>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  comparedPrice?: InputMaybe<Scalars['Float']['input']>;
  dataSource?: InputMaybe<DataSource>;
  defaultUnit?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayItemSize?: InputMaybe<Scalars['String']['input']>;
  displayPricePerUnit?: InputMaybe<Scalars['String']['input']>;
  externalId?: InputMaybe<Scalars['String']['input']>;
  fdcId?: InputMaybe<Scalars['String']['input']>;
  fulfillmentMethods?: InputMaybe<Array<Scalars['String']['input']>>;
  healthBenefits?: InputMaybe<Array<HealthBenefitInput>>;
  healthClaims?: InputMaybe<Array<Scalars['String']['input']>>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  images?: InputMaybe<Array<ImageInput>>;
  ingredients?: InputMaybe<Array<IngredientInput>>;
  inventoryStatus?: InputMaybe<Scalars['String']['input']>;
  isEverydaySavings?: InputMaybe<Scalars['Boolean']['input']>;
  isFoodStampItem?: InputMaybe<Scalars['Boolean']['input']>;
  isFsaEligible?: InputMaybe<Scalars['Boolean']['input']>;
  isNewLowPrice?: InputMaybe<Scalars['Boolean']['input']>;
  lastSyncedAt?: InputMaybe<Scalars['String']['input']>;
  maxPrice?: InputMaybe<Scalars['Float']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  minPrice?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
  nutritionFacts?: InputMaybe<Array<NutritionFactInput>>;
  offers?: InputMaybe<Array<OfferInput>>;
  popularity?: InputMaybe<Scalars['Int']['input']>;
  price?: InputMaybe<Scalars['Float']['input']>;
  productLocation?: InputMaybe<Scalars['String']['input']>;
  shelfLifeDays?: InputMaybe<Scalars['Int']['input']>;
  showInOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ItemStatus>;
  storageState?: InputMaybe<StorageState>;
  storeSkus?: InputMaybe<Array<StoreSkuInput>>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  type?: InputMaybe<ItemType>;
  unitPrice?: InputMaybe<Scalars['Float']['input']>;
  unitQty?: InputMaybe<Scalars['Float']['input']>;
  units?: InputMaybe<Array<ItemUnitInput>>;
  vendor?: InputMaybe<Scalars['String']['input']>;
  visibility?: InputMaybe<Visibility>;
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

export type CreateShoppingListInput = {
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
  endDate: Scalars['DateTime']['input'];
  startDate: Scalars['DateTime']['input'];
};

export type Device = {
  __typename?: 'Device';
  appVersion?: Maybe<Scalars['String']['output']>;
  browserName?: Maybe<Scalars['String']['output']>;
  browserVersion?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deviceId: Scalars['String']['output'];
  deviceName?: Maybe<Scalars['String']['output']>;
  deviceType: DeviceType;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isTrusted: Scalars['Boolean']['output'];
  isVerified: Scalars['Boolean']['output'];
  language?: Maybe<Scalars['String']['output']>;
  lastCity?: Maybe<Scalars['String']['output']>;
  lastCountry?: Maybe<Scalars['String']['output']>;
  lastIpAddress?: Maybe<Scalars['String']['output']>;
  lastLoginAt?: Maybe<Scalars['DateTime']['output']>;
  lastSeenAt: Scalars['DateTime']['output'];
  loginCount: Scalars['Int']['output'];
  osName?: Maybe<Scalars['String']['output']>;
  osVersion?: Maybe<Scalars['String']['output']>;
  platform?: Maybe<MobilePlatform>;
  pushToken?: Maybe<Scalars['String']['output']>;
  screenResolution?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
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

export type DeviceRegistrationInput = {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  deviceId: Scalars['String']['input'];
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  language?: InputMaybe<Scalars['String']['input']>;
  lastCity?: InputMaybe<Scalars['String']['input']>;
  lastCountry?: InputMaybe<Scalars['String']['input']>;
  lastIpAddress?: InputMaybe<Scalars['String']['input']>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  platform?: InputMaybe<MobilePlatform>;
  screenResolution?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
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
  invites: Array<HomeInvite>;
  isPublic: Scalars['Boolean']['output'];
  joinCode?: Maybe<Scalars['String']['output']>;
  maxMembers?: Maybe<Scalars['Int']['output']>;
  members: Array<User>;
  membershipStats: MembershipStats;
  memberships: Array<Membership>;
  metadata?: Maybe<Scalars['String']['output']>;
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
  customPermissions?: Maybe<Scalars['String']['output']>;
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
  personalMessage?: Maybe<Scalars['String']['output']>;
  recipientName?: Maybe<Scalars['String']['output']>;
  reminderCount: Scalars['Int']['output'];
  revokedAt?: Maybe<Scalars['String']['output']>;
  role: MembershipRole;
  sentAt: Scalars['String']['output'];
  status: InviteStatus;
  token: Scalars['String']['output'];
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

export enum InviteStatus {
  Accepted = 'ACCEPTED',
  Declined = 'DECLINED',
  Expired = 'EXPIRED',
  Pending = 'PENDING',
  Revoked = 'REVOKED',
}

export type InviteToHomeInput = {
  customExpiration?: InputMaybe<Scalars['Int']['input']>;
  email: Scalars['String']['input'];
  homeId: Scalars['ID']['input'];
  personalMessage?: InputMaybe<Scalars['String']['input']>;
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

export type InviteUserInput = {
  email: Scalars['String']['input'];
  homeId: Scalars['ID']['input'];
  message?: InputMaybe<Scalars['String']['input']>;
  role?: InputMaybe<MembershipRole>;
};

export type Item = {
  __typename?: 'Item';
  allergens?: Maybe<Scalars['JSON']['output']>;
  averagePrice?: Maybe<Scalars['Float']['output']>;
  barcode?: Maybe<Scalars['String']['output']>;
  brands: Array<ItemBrand>;
  categories: Array<ItemCategory>;
  createdAt: Scalars['DateTime']['output'];
  creations: Array<ItemCreation>;
  dataSource: DataSource;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  edits: Array<ItemEdit>;
  fdcId?: Maybe<Scalars['String']['output']>;
  healthBenefits?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  ingredients?: Maybe<Scalars['JSON']['output']>;
  maxPrice?: Maybe<Scalars['Float']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  minPrice?: Maybe<Scalars['Float']['output']>;
  name: Scalars['String']['output'];
  nutritions?: Maybe<Scalars['JSON']['output']>;
  pantryItems: Array<PantryItem>;
  popularity: Scalars['Int']['output'];
  priceHistory: Array<ItemPriceHistory>;
  priceUpdatedAt?: Maybe<Scalars['DateTime']['output']>;
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
  brand: Brand;
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  item: Item;
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
  Inactive = 'INACTIVE',
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
  item: Item;
  reason: Scalars['String']['output'];
  score: Scalars['Float']['output'];
};

export enum ItemType {
  Drink = 'DRINK',
  Food = 'FOOD',
  Foundation = 'FOUNDATION',
  Household = 'HOUSEHOLD',
  Other = 'OTHER',
  PersonalCare = 'PERSONAL_CARE',
  Pet = 'PET',
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
  unitId: Scalars['String']['input'];
  usageContext?: InputMaybe<Array<UnitUsageContext>>;
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

export type MealPlan = {
  __typename?: 'MealPlan';
  createdAt: Scalars['DateTime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  endDate: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  planType: MealPlanType;
  servings?: Maybe<Scalars['Int']['output']>;
  startDate: Scalars['DateTime']['output'];
  updatedAt: Scalars['DateTime']['output'];
  user: User;
  version: Scalars['Int']['output'];
};

export enum MealPlanType {
  Custom = 'CUSTOM',
  Daily = 'DAILY',
  Monthly = 'MONTHLY',
  Weekly = 'WEEKLY',
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
  addCollaborator: ShoppingListCollaborator;
  addItemImage: Item;
  addItemTags: Item;
  addItemToCategory: Item;
  addItemToPantry: PantryItem;
  addItemToShoppingList: ShoppingListItem;
  addItemUnit: ItemUnit;
  addRecipe: Recipe;
  addRestrictions: UserModeration;
  addUserAddress: UserAddress;
  addWarning: UserModeration;
  adminDeleteUser: Scalars['Boolean']['output'];
  banUser: UserModeration;
  bulkCreateItems: BulkCreateItemsResponse;
  bulkDeleteItems: BulkOperationSummary;
  bulkUpdateItems: BulkOperationSummary;
  categorizeItem: ItemCategory;
  cleanupDeletedDevices: Scalars['Int']['output'];
  cleanupStaleDevices: Scalars['Int']['output'];
  completeReview: UserModeration;
  createBrand: Brand;
  createBulkPurchases: Array<Purchase>;
  createBulkStores: Array<Store>;
  createCategory: Category;
  createCurrency: Currency;
  createDevice: Device;
  createHome: Home;
  createItem: Item;
  createLoginHistory: LoginHistory;
  createMembership: Membership;
  createModerationRecord: UserModeration;
  createNotification: Notification;
  createPantry: Pantry;
  createProfile: UserProfile;
  createPurchase: Purchase;
  createShoppingList: ShoppingList;
  createStore: Store;
  createUnit: Unit;
  deactivateDevice: Device;
  deactivateMultipleDevices: Array<Device>;
  declineHomeInvite: Scalars['Boolean']['output'];
  deleteAccount: Scalars['Boolean']['output'];
  deleteBrand: Brand;
  deleteBulkPurchases: Scalars['Boolean']['output'];
  deleteCategory: Scalars['Boolean']['output'];
  deleteCurrency: Scalars['Boolean']['output'];
  deleteDevice: Device;
  deleteHome: Scalars['Boolean']['output'];
  deleteItem: Scalars['Boolean']['output'];
  deleteMultipleDevices: Array<Device>;
  deleteNotification: Notification;
  deletePantry: Scalars['Boolean']['output'];
  deletePurchase: Scalars['Boolean']['output'];
  deleteShoppingList: Scalars['Boolean']['output'];
  deleteStore: Scalars['Boolean']['output'];
  deleteUnit: Scalars['Boolean']['output'];
  deleteUserAddress: UserAddress;
  exportItems: ExportResponse;
  flagLoginAsRisky: LoginHistory;
  flagMultipleLoginsAsRisky: Array<LoginHistory>;
  forgotPassword: Scalars['Boolean']['output'];
  generateShoppingListShareCode: ShoppingList;
  hardDeleteDevice: Scalars['Boolean']['output'];
  importItemsFromCSV: ImportItemsResponse;
  importItemsFromProvider: ImportItemsResponse;
  incrementDeviceLoginCount: Device;
  incrementItemPopularity: Item;
  inviteToHome: HomeInvite;
  inviteUserToHome: Scalars['Boolean']['output'];
  joinHomeByCode: Membership;
  joinShoppingListByShareCode: ShoppingList;
  leaveHome: Scalars['Boolean']['output'];
  login: AuthPayload;
  markItemAsWaste: PantryItem;
  markItemPurchased: Scalars['Boolean']['output'];
  markLoginAsReviewed: LoginHistory;
  markMultipleLoginsAsReviewed: Array<LoginHistory>;
  markNotificationRead: Notification;
  mergeItems: Item;
  putUnderReview: UserModeration;
  reactivateDevice: Device;
  recordLoginAttempt: LoginHistory;
  recordPantryItemUsage: PantryItemUsage;
  recordPriceObservation: ItemPriceHistory;
  refresh: AuthPayload;
  register: AuthPayload;
  registerDevice: Device;
  removeCollaborator: Scalars['Boolean']['output'];
  removeItemBrand: Item;
  removeItemFromCategory: Item;
  removeItemFromPantry: Scalars['Boolean']['output'];
  removeItemFromShoppingList: Scalars['Boolean']['output'];
  removeItemImage: Item;
  removeItemTags: Item;
  removeItemUnit: Scalars['Boolean']['output'];
  removeMember: Scalars['Boolean']['output'];
  removePushToken: Device;
  removeRestrictions: UserModeration;
  resendVerificationEmail: Scalars['Boolean']['output'];
  resetPassword: Scalars['Boolean']['output'];
  restoreItem: Item;
  reviewAppeal: UserModeration;
  revokeHomeInvite: Scalars['Boolean']['output'];
  setDefaultItemUnit: ItemUnit;
  setDefaultShoppingList: ShoppingList;
  setItemBrand: Item;
  setItemCategories: Item;
  setItemPrimaryImage: Item;
  shareShoppingList: ShoppingList;
  submitAppeal: UserModeration;
  suspendUser: UserModeration;
  syncAllItemPrices: BulkOperationSummary;
  syncItemOffers: Item;
  syncItemPrices: Item;
  syncItemWithProvider: Item;
  toggleShoppingListItemCompletion: Scalars['Boolean']['output'];
  transferHomeOwnership: HomeOwnership;
  trustDevice: Device;
  trustMultipleDevices: Array<Device>;
  unbanUser: UserModeration;
  uncategorizeItem: Scalars['Boolean']['output'];
  unsuspendUser: UserModeration;
  untrustDevice: Device;
  untrustMultipleDevices: Array<Device>;
  updateBrand: Brand;
  updateCategory: Category;
  updateCurrency: Currency;
  updateDevice: Device;
  updateDeviceLastSeen: Device;
  updateDeviceLocation: Device;
  updateHome: Home;
  updateItem: Item;
  updateItemAllergens: Item;
  updateItemIngredients: Item;
  updateItemMetadata: Item;
  updateItemNutrition: Item;
  updateItemPrice: Item;
  updateItemUnit: ItemUnit;
  updateLoginHistory: LoginHistory;
  updateLoginSession: LoginHistory;
  updateMembership: Membership;
  updateModerationStatus: UserModeration;
  updatePantry: Pantry;
  updatePantryItem: PantryItem;
  updateProfile: UserProfile;
  updatePurchase: Purchase;
  updatePushToken: Device;
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
  validateItem: ValidationResult;
  verifyDevice: Device;
  verifyEmail: Scalars['Boolean']['output'];
  verifyItemUnit: ItemUnit;
  verifyUserEmail: User;
};

export type MutationAcceptHomeInviteArgs = {
  token: Scalars['String']['input'];
};

export type MutationAddCollaboratorArgs = {
  data: AddCollaboratorInput;
};

export type MutationAddItemImageArgs = {
  image: ImageInput;
  itemId: Scalars['ID']['input'];
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
  cookTime: Scalars['Int']['input'];
  ingredients: Array<Scalars['String']['input']>;
  instructions: Array<Scalars['String']['input']>;
  prepTime: Scalars['Int']['input'];
  title: Scalars['String']['input'];
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

export type MutationCompleteReviewArgs = {
  newStatus: ModerationStatus;
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
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

export type MutationCreateHomeArgs = {
  input: CreateHomeInput;
};

export type MutationCreateItemArgs = {
  input: CreateItemInput;
};

export type MutationCreateLoginHistoryArgs = {
  input: CreateLoginHistoryInput;
};

export type MutationCreateMembershipArgs = {
  input: CreateMembershipInput;
};

export type MutationCreateModerationRecordArgs = {
  input: CreateUserModerationInput;
};

export type MutationCreateNotificationArgs = {
  payload: Scalars['JSON']['input'];
  status?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
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

export type MutationDeactivateDeviceArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeactivateMultipleDevicesArgs = {
  deviceIds: Array<Scalars['ID']['input']>;
};

export type MutationDeclineHomeInviteArgs = {
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

export type MutationDeleteMultipleDevicesArgs = {
  deviceIds: Array<Scalars['ID']['input']>;
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

export type MutationInviteUserToHomeArgs = {
  input: InviteUserInput;
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

export type MutationLoginArgs = {
  input: LoginInput;
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

export type MutationMarkNotificationReadArgs = {
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
  imageUrl: Scalars['String']['input'];
  itemId: Scalars['ID']['input'];
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

export type MutationResendVerificationEmailArgs = {
  email: Scalars['String']['input'];
};

export type MutationResetPasswordArgs = {
  input: ResetPasswordInput;
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

export type MutationSetItemPrimaryImageArgs = {
  imageUrl: Scalars['String']['input'];
  itemId: Scalars['ID']['input'];
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

export type MutationToggleShoppingListItemCompletionArgs = {
  id: Scalars['ID']['input'];
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

export type MutationUpdateCurrencyArgs = {
  id: Scalars['ID']['input'];
  input: UpdateCurrencyInput;
};

export type MutationUpdateDeviceArgs = {
  id: Scalars['ID']['input'];
  input: UpdateDeviceInput;
};

export type MutationUpdateDeviceLastSeenArgs = {
  id: Scalars['ID']['input'];
};

export type MutationUpdateDeviceLocationArgs = {
  id: Scalars['ID']['input'];
  input: DeviceLocationInput;
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

export type MutationUpdateMembershipArgs = {
  id: Scalars['ID']['input'];
  input: UpdateMembershipInput;
};

export type MutationUpdateModerationStatusArgs = {
  reason?: InputMaybe<Scalars['String']['input']>;
  status: ModerationStatus;
  userId: Scalars['ID']['input'];
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

export type MutationUpdatePurchaseArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePurchaseInput;
};

export type MutationUpdatePushTokenArgs = {
  id: Scalars['ID']['input'];
  pushToken: Scalars['String']['input'];
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

export type MutationValidateItemArgs = {
  deep?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
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

export type Notification = {
  __typename?: 'Notification';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  payload: Scalars['JSON']['output'];
  readAt?: Maybe<Scalars['DateTime']['output']>;
  sentAt: Scalars['DateTime']['output'];
  status: NotificationStatus;
  type: NotificationType;
  userId: Scalars['ID']['output'];
};

export enum NotificationStatus {
  Delivered = 'DELIVERED',
  Failed = 'FAILED',
  Pending = 'PENDING',
  Read = 'READ',
  Sent = 'SENT',
}

export enum NotificationType {
  ExpiryReminder = 'EXPIRY_REMINDER',
  ItemDeleted = 'ITEM_DELETED',
  ItemUpdated = 'ITEM_UPDATED',
  LowStock = 'LOW_STOCK',
  NewItemAdded = 'NEW_ITEM_ADDED',
}

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
  metadata?: Maybe<Scalars['String']['output']>;
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
  addedAt: Scalars['String']['output'];
  addedBy?: Maybe<User>;
  alertSentAt?: Maybe<Scalars['String']['output']>;
  autoReorderPoint?: Maybe<Scalars['Float']['output']>;
  batchNumber?: Maybe<Scalars['String']['output']>;
  bestByDate?: Maybe<Scalars['String']['output']>;
  condition: ItemCondition;
  consumedQuantity: Scalars['Float']['output'];
  costPerUnit?: Maybe<Scalars['Float']['output']>;
  createdAt: Scalars['DateTime']['output'];
  currentQuantity: Scalars['Float']['output'];
  customCategory?: Maybe<Scalars['String']['output']>;
  estimatedShelfLife?: Maybe<Scalars['Int']['output']>;
  expirationAlert: Scalars['Boolean']['output'];
  expiresAt?: Maybe<Scalars['String']['output']>;
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
  lastReorderDate?: Maybe<Scalars['String']['output']>;
  lastUsedAt?: Maybe<Scalars['String']['output']>;
  lotNumber?: Maybe<Scalars['String']['output']>;
  lowStockAlert: Scalars['Boolean']['output'];
  openedAt?: Maybe<Scalars['String']['output']>;
  pantry: Pantry;
  pantryId: Scalars['String']['output'];
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
  unit: Unit;
  unitId: Scalars['String']['output'];
  unitName: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
  usageFrequency: UsageFrequency;
  usageRecords: Array<PantryItemUsage>;
  wasteAmount: Scalars['Float']['output'];
  wasteDate?: Maybe<Scalars['String']['output']>;
  wasteReason?: Maybe<WasteReason>;
};

export type PantryItemChangedPayload = {
  __typename?: 'PantryItemChangedPayload';
  action: Scalars['String']['output'];
  item: PantryItem;
  itemId: Scalars['String']['output'];
  pantryId: Scalars['ID']['output'];
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
  metadata?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  temperature?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type PlatformStat = {
  __typename?: 'PlatformStat';
  count: Scalars['Int']['output'];
  platform: MobilePlatform;
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
  itemBarcode?: Maybe<Scalars['String']['output']>;
  itemId: Scalars['String']['output'];
  itemName: Scalars['String']['output'];
  originalPrice?: Maybe<Scalars['Float']['output']>;
  pantryItems: Array<PantryItem>;
  purchaseDate: Scalars['DateTime']['output'];
  quantity: Scalars['Float']['output'];
  receiptNumber?: Maybe<Scalars['String']['output']>;
  shoppingList?: Maybe<ShoppingList>;
  shoppingListId?: Maybe<Scalars['String']['output']>;
  shoppingListItem?: Maybe<ShoppingListItem>;
  shoppingListItemId?: Maybe<Scalars['String']['output']>;
  store: Store;
  storeId: Scalars['String']['output'];
  storeName: Scalars['String']['output'];
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
  brand?: Maybe<Brand>;
  brands: Array<Brand>;
  categories: Array<Category>;
  category?: Maybe<Category>;
  categoryBySlug?: Maybe<Category>;
  checkItemAvailability: Array<ItemAvailability>;
  compareItemPrices: Array<StorePriceComparison>;
  currencies: Array<Currency>;
  currency?: Maybe<Currency>;
  currencyByCode?: Maybe<Currency>;
  defaultShoppingList?: Maybe<ShoppingList>;
  device?: Maybe<Device>;
  deviceByDeviceId?: Maybe<Device>;
  deviceCount: Scalars['Int']['output'];
  deviceStats: DeviceStats;
  devicesByPlatform: Array<Device>;
  expiringItems: Array<PantryItem>;
  failedLoginAttempts: Array<LoginHistory>;
  home?: Maybe<Home>;
  homeByJoinCode?: Maybe<Home>;
  homeInvites: Array<HomeInvite>;
  homeMemberships: Array<Membership>;
  homes: Array<Home>;
  item?: Maybe<Item>;
  itemByBarcode?: Maybe<Item>;
  itemByExternalId?: Maybe<Item>;
  itemBySku?: Maybe<Item>;
  itemPriceHistory: Array<ItemPriceHistory>;
  items: ItemsResponse;
  loginHistory?: Maybe<LoginHistory>;
  loginHistoryByIP: Array<LoginHistory>;
  loginHistoryForUser: Array<LoginHistory>;
  loginHistoryStats: LoginHistoryStats;
  lowStockItems: Array<PantryItem>;
  me?: Maybe<User>;
  membership?: Maybe<Membership>;
  membershipStats: MembershipStats;
  mobileDevices: Array<Device>;
  myDevices: Array<Device>;
  myHomes: Array<Home>;
  myMembershipInHome?: Maybe<Membership>;
  myMemberships: Array<Membership>;
  myModeration?: Maybe<UserModeration>;
  myPurchases: Array<Purchase>;
  nearbyStores: Array<Store>;
  notificationsByUser: Array<Notification>;
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
  popularItems: Array<Item>;
  popularStores: Array<Store>;
  purchase?: Maybe<Purchase>;
  purchaseStats: PurchaseStats;
  purchasesByDateRange: Array<Purchase>;
  purchasesByItem: Array<Purchase>;
  purchasesByShoppingListItem: Array<Purchase>;
  purchasesByStore: Array<Purchase>;
  recentItems: Array<Item>;
  recommendedItems: Array<ItemSuggestion>;
  recommendedStores: Array<Store>;
  relatedItems: RelatedItemsResponse;
  rootBrands: Array<Brand>;
  rootCategories: Array<Category>;
  searchDevicesByUserAgent: Array<Device>;
  searchItems: ItemsResponse;
  searchItemsByBarcode: Array<Item>;
  searchLoginHistory: Array<LoginHistory>;
  searchRecipes: Array<Recipe>;
  searchShoppingLists: Array<ShoppingList>;
  searchStores: Array<Store>;
  shoppingList?: Maybe<ShoppingList>;
  shoppingListByShareCode?: Maybe<ShoppingList>;
  shoppingListCollaborators: Array<ShoppingListCollaborator>;
  shoppingListItem?: Maybe<ShoppingListItem>;
  shoppingListItems: Array<ShoppingListItem>;
  shoppingLists: Array<ShoppingList>;
  staleDevices: Array<Device>;
  store?: Maybe<Store>;
  storeByName?: Maybe<Store>;
  storeStats?: Maybe<StoreStats>;
  storeWithPriceHistory?: Maybe<Store>;
  storeWithPurchases?: Maybe<Store>;
  stores: Array<Store>;
  suggestedRecipes: Array<Recipe>;
  suspiciousLoginActivity: SuspiciousActivity;
  trendingItems: Array<Item>;
  trustedDevices: Array<Device>;
  unit?: Maybe<Unit>;
  unitBySymbol?: Maybe<Unit>;
  units: Array<Unit>;
  user?: Maybe<User>;
  userDevices: Array<Device>;
  userModeration?: Maybe<UserModeration>;
  userProfile?: Maybe<UserProfile>;
  userPurchases: Array<Purchase>;
  users: Array<User>;
  validateBarcode: BarcodeValidation;
  verifiedDevices: Array<Device>;
};

export type QueryActiveDevicesArgs = {
  userId: Scalars['ID']['input'];
};

export type QueryBrandArgs = {
  id: Scalars['ID']['input'];
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
  storeIds: Array<Scalars['String']['input']>;
};

export type QueryCompareItemPricesArgs = {
  itemId: Scalars['ID']['input'];
  storeIds?: InputMaybe<Array<Scalars['String']['input']>>;
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

export type QueryDevicesByPlatformArgs = {
  platform: MobilePlatform;
  userId: Scalars['ID']['input'];
};

export type QueryExpiringItemsArgs = {
  pantryId: Scalars['ID']['input'];
};

export type QueryFailedLoginAttemptsArgs = {
  hours?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['ID']['input'];
};

export type QueryHomeArgs = {
  id: Scalars['ID']['input'];
};

export type QueryHomeByJoinCodeArgs = {
  joinCode: Scalars['String']['input'];
};

export type QueryHomeInvitesArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryHomeMembershipsArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryItemArgs = {
  id: Scalars['ID']['input'];
};

export type QueryItemByBarcodeArgs = {
  barcode: Scalars['String']['input'];
};

export type QueryItemByExternalIdArgs = {
  externalId: Scalars['String']['input'];
  provider: ProviderType;
};

export type QueryItemBySkuArgs = {
  sku: Scalars['String']['input'];
  storeId?: InputMaybe<Scalars['String']['input']>;
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

export type QueryLowStockItemsArgs = {
  pantryId: Scalars['ID']['input'];
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

export type QueryMyDevicesArgs = {
  filters?: InputMaybe<DeviceFiltersInput>;
};

export type QueryMyMembershipInHomeArgs = {
  homeId: Scalars['ID']['input'];
};

export type QueryNearbyStoresArgs = {
  lat: Scalars['Float']['input'];
  lng: Scalars['Float']['input'];
  radius?: InputMaybe<Scalars['Float']['input']>;
};

export type QueryNotificationsByUserArgs = {
  userId: Scalars['ID']['input'];
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

export type QuerySearchItemsByBarcodeArgs = {
  barcode: Scalars['String']['input'];
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

export type QuerySuspiciousLoginActivityArgs = {
  hours?: InputMaybe<Scalars['Int']['input']>;
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

export type QueryUsersArgs = {
  search?: InputMaybe<Scalars['String']['input']>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  take?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryValidateBarcodeArgs = {
  barcode: Scalars['String']['input'];
};

export type QueryVerifiedDevicesArgs = {
  userId: Scalars['ID']['input'];
};

export type RapidAttempt = {
  __typename?: 'RapidAttempt';
  count: Scalars['Int']['output'];
  hour: Scalars['String']['output'];
};

export type Recipe = {
  __typename?: 'Recipe';
  cookTime: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  difficulty: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  ingredients: Array<RecipeIngredient>;
  instructions: Array<Scalars['String']['output']>;
  matchPercentage?: Maybe<Scalars['Float']['output']>;
  prepTime: Scalars['Int']['output'];
  title: Scalars['String']['output'];
};

export type RecipeIngredient = {
  __typename?: 'RecipeIngredient';
  id: Scalars['ID']['output'];
  isOptional: Scalars['Boolean']['output'];
  item: Item;
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  preperation?: Maybe<Scalars['String']['output']>;
  quantity: Scalars['Float']['output'];
  recipe: Recipe;
  section?: Maybe<Scalars['String']['output']>;
  sortOrder: Scalars['Int']['output'];
  unit?: Maybe<Unit>;
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

export type ResetPasswordInput = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};

export type ReviewAppealInput = {
  approved: Scalars['Boolean']['input'];
  reviewNotes?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
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

export type ShareShoppingListInput = {
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  shareCode?: InputMaybe<Scalars['String']['input']>;
};

export type ShoppingList = {
  __typename?: 'ShoppingList';
  activities: Array<ShoppingListActivity>;
  autoAddSuggestions: Scalars['Boolean']['output'];
  basedOnTemplate?: Maybe<ShoppingList>;
  budgetAmount?: Maybe<Scalars['Float']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  collaborators: Array<ShoppingListCollaborator>;
  completedAt?: Maybe<Scalars['String']['output']>;
  completedItems: Scalars['Int']['output'];
  completedShopDate?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  currency?: Maybe<Scalars['String']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
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
  lastRecurredAt?: Maybe<Scalars['String']['output']>;
  lastReminderSent?: Maybe<Scalars['String']['output']>;
  mealPlan?: Maybe<MealPlan>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  nextRecurringDate?: Maybe<Scalars['String']['output']>;
  ownerships: Array<ShoppingListOwnership>;
  plannedShopDate?: Maybe<Scalars['String']['output']>;
  priceTracking: Scalars['Boolean']['output'];
  priority: Scalars['Int']['output'];
  purchases: Array<Purchase>;
  recurringInterval?: Maybe<Scalars['Int']['output']>;
  recurringPattern?: Maybe<RecurringPattern>;
  reminderDate?: Maybe<Scalars['String']['output']>;
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
  templatesCreated: Array<ShoppingList>;
  totalCollaborators: Scalars['Int']['output'];
  totalCost: Scalars['Float']['output'];
  totalItems: Scalars['Int']['output'];
  updatedAt: Scalars['DateTime']['output'];
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
  metadata?: Maybe<Scalars['String']['output']>;
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
  lastKnownPrice?: Maybe<Scalars['Float']['output']>;
  lastPurchaseDate?: Maybe<Scalars['String']['output']>;
  lowestPrice?: Maybe<Scalars['Float']['output']>;
  mealPlanReference?: Maybe<Scalars['String']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  preferredStore?: Maybe<Store>;
  previouslyPurchased: Scalars['Boolean']['output'];
  priceLastUpdated?: Maybe<Scalars['String']['output']>;
  priority: Scalars['Int']['output'];
  purchaseCount: Scalars['Int']['output'];
  purchaseDate?: Maybe<Scalars['String']['output']>;
  purchasedBy?: Maybe<User>;
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

export type ShoppingListOwnership = {
  __typename?: 'ShoppingListOwnership';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  shoppingList: ShoppingList;
  shoppingListId: Scalars['String']['output'];
  transferredAt?: Maybe<Scalars['String']['output']>;
  transferredFrom?: Maybe<Scalars['String']['output']>;
  user: User;
  userId: Scalars['String']['output'];
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
  myPantriesUpdated: Array<Pantry>;
  myShoppingListsUpdated?: Maybe<ShoppingListUpdatedPayload>;
  notificationCreated: Notification;
  notificationDeleted: Notification;
  notificationRead: Notification;
  notificationUpdated: Notification;
  pantryActivityAdded: PantryActivity;
  pantryExpiringItemsAlert: Array<PantryItem>;
  pantryItemsChanged: PantryItemChangedPayload;
  pantryLowStockAlert: Array<PantryItem>;
  pantryUpdated: PantryUpdatedPayload;
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
  userActivity: UserActivityPayload;
  userAuth: UserAuthPayload;
  userModerationChanged: UserModerationChangedPayload;
  userProfileChanged: UserProfileChangedPayload;
  userSocial: UserSocialPayload;
  userStatusChanged: UserStatusChangedPayload;
  userUpdated: UserUpdatedPayload;
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

export type SubscriptionMyPantriesUpdatedArgs = {
  homeId: Scalars['ID']['input'];
};

export type SubscriptionNotificationCreatedArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionNotificationDeletedArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionNotificationReadArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionNotificationUpdatedArgs = {
  userId: Scalars['ID']['input'];
};

export type SubscriptionPantryActivityAddedArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryExpiringItemsAlertArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryItemsChangedArgs = {
  itemId: Scalars['String']['input'];
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryLowStockAlertArgs = {
  pantryId: Scalars['ID']['input'];
};

export type SubscriptionPantryUpdatedArgs = {
  id: Scalars['ID']['input'];
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

export type SubscriptionUserAuthArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionUserModerationChangedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionUserProfileChangedArgs = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type SubscriptionUserSocialArgs = {
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

export type UpdateCurrencyInput = {
  code?: InputMaybe<Scalars['String']['input']>;
  decimalPlaces?: InputMaybe<Scalars['Int']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateDeviceInput = {
  appVersion?: InputMaybe<Scalars['String']['input']>;
  browserName?: InputMaybe<Scalars['String']['input']>;
  browserVersion?: InputMaybe<Scalars['String']['input']>;
  deviceName?: InputMaybe<Scalars['String']['input']>;
  deviceType?: InputMaybe<DeviceType>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isTrusted?: InputMaybe<Scalars['Boolean']['input']>;
  isVerified?: InputMaybe<Scalars['Boolean']['input']>;
  language?: InputMaybe<Scalars['String']['input']>;
  lastCity?: InputMaybe<Scalars['String']['input']>;
  lastCountry?: InputMaybe<Scalars['String']['input']>;
  lastIpAddress?: InputMaybe<Scalars['String']['input']>;
  osName?: InputMaybe<Scalars['String']['input']>;
  osVersion?: InputMaybe<Scalars['String']['input']>;
  platform?: InputMaybe<MobilePlatform>;
  pushToken?: InputMaybe<Scalars['String']['input']>;
  screenResolution?: InputMaybe<Scalars['String']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
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
  allergens?: InputMaybe<Array<AllergenInput>>;
  averagePrice?: InputMaybe<Scalars['Float']['input']>;
  barcode?: InputMaybe<Scalars['String']['input']>;
  brand?: InputMaybe<BrandInput>;
  brandId?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<CategoryInput>>;
  categoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  comparedPrice?: InputMaybe<Scalars['Float']['input']>;
  defaultUnit?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  displayItemSize?: InputMaybe<Scalars['String']['input']>;
  displayPricePerUnit?: InputMaybe<Scalars['String']['input']>;
  editReason?: InputMaybe<Scalars['String']['input']>;
  externalId?: InputMaybe<Scalars['String']['input']>;
  fdcId?: InputMaybe<Scalars['String']['input']>;
  fulfillmentMethods?: InputMaybe<Array<Scalars['String']['input']>>;
  healthBenefits?: InputMaybe<Array<HealthBenefitInput>>;
  healthClaims?: InputMaybe<Array<Scalars['String']['input']>>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  images?: InputMaybe<Array<ImageInput>>;
  ingredients?: InputMaybe<Array<IngredientInput>>;
  inventoryStatus?: InputMaybe<Scalars['String']['input']>;
  isEverydaySavings?: InputMaybe<Scalars['Boolean']['input']>;
  isFoodStampItem?: InputMaybe<Scalars['Boolean']['input']>;
  isFsaEligible?: InputMaybe<Scalars['Boolean']['input']>;
  isNewLowPrice?: InputMaybe<Scalars['Boolean']['input']>;
  lastSyncedAt?: InputMaybe<Scalars['String']['input']>;
  maxPrice?: InputMaybe<Scalars['Float']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  minPrice?: InputMaybe<Scalars['Float']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  nutritionFacts?: InputMaybe<Array<NutritionFactInput>>;
  offers?: InputMaybe<Array<OfferInput>>;
  popularity?: InputMaybe<Scalars['Int']['input']>;
  price?: InputMaybe<Scalars['Float']['input']>;
  productLocation?: InputMaybe<Scalars['String']['input']>;
  removeCategoryIds?: InputMaybe<Array<Scalars['String']['input']>>;
  removeStoreSkuIds?: InputMaybe<Array<Scalars['String']['input']>>;
  removeTags?: InputMaybe<Array<Scalars['String']['input']>>;
  removeUnitIds?: InputMaybe<Array<Scalars['String']['input']>>;
  shelfLifeDays?: InputMaybe<Scalars['Int']['input']>;
  showInOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
  sku?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ItemStatus>;
  storageState?: InputMaybe<StorageState>;
  storeSkus?: InputMaybe<Array<StoreSkuInput>>;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  type?: InputMaybe<ItemType>;
  unitPrice?: InputMaybe<Scalars['Float']['input']>;
  unitQty?: InputMaybe<Scalars['Float']['input']>;
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
  defaultHomeId?: Maybe<Scalars['String']['output']>;
  defaultShoppingListId?: Maybe<Scalars['String']['output']>;
  devices: Array<Device>;
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  homeOwnerships: Array<HomeOwnership>;
  id: Scalars['ID']['output'];
  language?: Maybe<Scalars['String']['output']>;
  lastActiveAt?: Maybe<Scalars['DateTime']['output']>;
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
  emailNotifications: Scalars['Boolean']['output'];
  enabledFeatures: Array<Scalars['String']['output']>;
  expiredItemAlerts: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  lowStockAlerts: Scalars['Boolean']['output'];
  offlineMode: Scalars['Boolean']['output'];
  personalizedAds: Scalars['Boolean']['output'];
  pushNotifications: Scalars['Boolean']['output'];
  recipeRecommendations: Scalars['Boolean']['output'];
  shareUsageData: Scalars['Boolean']['output'];
  shareWithPartners: Scalars['Boolean']['output'];
  shoppingListUpdates: Scalars['Boolean']['output'];
  showTutorials: Scalars['Boolean']['output'];
  smsNotifications: Scalars['Boolean']['output'];
  theme: AppTheme;
  updatedAt: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
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
  Shared = 'SHARED',
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

export type AuthUserFragment = {
  __typename?: 'User';
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  onBoarded: boolean;
  createdAt: string;
  updatedAt: string;
  timezone?: string | null;
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
  timezone?: string | null;
  addresses: Array<{
    __typename?: 'UserAddress';
    id: string;
    label: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    lat?: number | null;
    lng?: number | null;
    isDefault: boolean;
  }>;
  devices: Array<{
    __typename?: 'Device';
    id: string;
    userId: string;
    deviceId: string;
    deviceName?: string | null;
    deviceType: DeviceType;
    userAgent?: string | null;
    browserName?: string | null;
    browserVersion?: string | null;
    osName?: string | null;
    osVersion?: string | null;
    screenResolution?: string | null;
    timezone?: string | null;
    language?: string | null;
    appVersion?: string | null;
    platform?: MobilePlatform | null;
    pushToken?: string | null;
    isActive: boolean;
    isTrusted: boolean;
    lastSeenAt: string;
    lastIpAddress?: string | null;
    lastCountry?: string | null;
    lastCity?: string | null;
    isVerified: boolean;
    verifiedAt?: string | null;
    loginCount: number;
    lastLoginAt?: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
  }>;
  homeOwnerships: Array<{
    __typename?: 'HomeOwnership';
    id: string;
    home: {__typename?: 'Home'; id: string; name: string; createdAt: string};
  }>;
  purchases: Array<{__typename?: 'Purchase'; id: string}>;
  shoppingListOwnerships: Array<{
    __typename?: 'ShoppingListOwnership';
    createdAt: string;
    id: string;
    shoppingListId: string;
    transferredAt?: string | null;
    transferredFrom?: string | null;
  }>;
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
      timezone?: string | null;
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
      timezone?: string | null;
    };
  };
};

export type RefreshTokenMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;

export type RefreshTokenMutation = {
  __typename?: 'Mutation';
  refresh: {
    __typename?: 'AuthPayload';
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
  forgotPassword: boolean;
};

export type ResetPasswordMutationVariables = Exact<{
  input: ResetPasswordInput;
}>;

export type ResetPasswordMutation = {
  __typename?: 'Mutation';
  resetPassword: boolean;
};

export type ResendVerificationEmailMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;

export type ResendVerificationEmailMutation = {
  __typename?: 'Mutation';
  resendVerificationEmail: boolean;
};

export type GetCurrentUserQueryVariables = Exact<{[key: string]: never}>;

export type GetCurrentUserQuery = {
  __typename?: 'Query';
  me?: {
    __typename?: 'User';
    id: string;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    onBoarded: boolean;
    createdAt: string;
    updatedAt: string;
    timezone?: string | null;
  } | null;
};

export type GetUserProfileQueryVariables = Exact<{[key: string]: never}>;

export type GetUserProfileQuery = {
  __typename?: 'Query';
  me?: {
    __typename?: 'User';
    id: string;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    onBoarded: boolean;
    createdAt: string;
    updatedAt: string;
    timezone?: string | null;
    addresses: Array<{
      __typename?: 'UserAddress';
      id: string;
      label: string;
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      lat?: number | null;
      lng?: number | null;
      isDefault: boolean;
    }>;
    devices: Array<{
      __typename?: 'Device';
      id: string;
      userId: string;
      deviceId: string;
      deviceName?: string | null;
      deviceType: DeviceType;
      userAgent?: string | null;
      browserName?: string | null;
      browserVersion?: string | null;
      osName?: string | null;
      osVersion?: string | null;
      screenResolution?: string | null;
      timezone?: string | null;
      language?: string | null;
      appVersion?: string | null;
      platform?: MobilePlatform | null;
      pushToken?: string | null;
      isActive: boolean;
      isTrusted: boolean;
      lastSeenAt: string;
      lastIpAddress?: string | null;
      lastCountry?: string | null;
      lastCity?: string | null;
      isVerified: boolean;
      verifiedAt?: string | null;
      loginCount: number;
      lastLoginAt?: string | null;
      createdAt: string;
      updatedAt: string;
      deletedAt?: string | null;
    }>;
    homeOwnerships: Array<{
      __typename?: 'HomeOwnership';
      id: string;
      home: {__typename?: 'Home'; id: string; name: string; createdAt: string};
    }>;
    purchases: Array<{__typename?: 'Purchase'; id: string}>;
    shoppingListOwnerships: Array<{
      __typename?: 'ShoppingListOwnership';
      createdAt: string;
      id: string;
      shoppingListId: string;
      transferredAt?: string | null;
      transferredFrom?: string | null;
    }>;
  } | null;
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
    description?: string | null;
    type: HomeType;
    currency?: string | null;
    timezone?: string | null;
    isPublic: boolean;
    allowJoinCode: boolean;
    joinCode?: string | null;
    maxMembers?: number | null;
    tags: Array<string>;
    createdAt: string;
    updatedAt: string;
    pantries?: Array<{
      __typename?: 'Pantry';
      id: string;
      name: string;
      isDefault: boolean;
    }> | null;
    members: Array<{__typename?: 'User'; id: string; email: string}>;
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
    role: MembershipRole;
    status: InviteStatus;
    expiresAt: string;
    sentAt: string;
    personalMessage?: string | null;
    createdAt: string;
    home: {__typename?: 'Home'; id: string; name: string};
    inviter: {__typename?: 'User'; id: string; email: string};
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
    description?: string | null;
    barcode?: string | null;
    fdcId?: string | null;
    dataSource: DataSource;
    type: ItemType;
    storageState: StorageState;
    showInOnboarding: boolean;
    shelfLifeDays?: number | null;
    popularity: number;
    status: ItemStatus;
    visibility: Visibility;
    averagePrice?: number | null;
    minPrice?: number | null;
    maxPrice?: number | null;
    priceUpdatedAt?: string | null;
    imageUrl?: string | null;
    tags: Array<string>;
    healthBenefits?: any | null;
    allergens?: any | null;
    nutritions?: any | null;
    metadata?: any | null;
    ingredients?: any | null;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
    version: number;
    categories: Array<{
      __typename?: 'ItemCategory';
      id: string;
      category: {__typename?: 'Category'; name: string};
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
    description?: string | null;
    isDefault: boolean;
    location?: string | null;
    temperature?: string | null;
    tags: Array<string>;
    createdAt: string;
    updatedAt?: string | null;
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
    unitId: string;
    initialQuantity: number;
    currentQuantity: number;
    itemName: string;
    itemBarcode?: string | null;
    unitName: string;
    expiresAt?: string | null;
    bestByDate?: string | null;
    storageState: StorageState;
    storageLocation?: string | null;
    condition: ItemCondition;
    acquisitionMethod: AcquisitionMethod;
    createdAt: string;
  };
};

export type UpdateProfileMutationVariables = Exact<{
  input: UpdateUserProfileInput;
}>;

export type UpdateProfileMutation = {
  __typename?: 'Mutation';
  updateProfile: {
    __typename?: 'UserProfile';
    id: string;
    userId: string;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatar?: string | null;
    coverImage?: string | null;
    phone?: string | null;
    website?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    profileVisibility: ProfileVisibility;
    showEmail: boolean;
    showPhone: boolean;
    createdAt: string;
    updatedAt: string;
  };
};

export type UpdateSettingsMutationVariables = Exact<{
  input: UpdateUserSettingsInput;
}>;

export type UpdateSettingsMutation = {
  __typename?: 'Mutation';
  updateSettings: {
    __typename?: 'UserSettings';
    id: string;
    userId: string;
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
  };
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
    description?: string | null;
    isDefault: boolean;
    tags: Array<string>;
    metadata?: any | null;
    createdAt: string;
    updatedAt: string;
    ownerships: Array<{
      __typename?: 'ShoppingListOwnership';
      id: string;
      userId: string;
      shoppingListId: string;
      createdAt: string;
      transferredAt?: string | null;
      transferredFrom?: string | null;
    }>;
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
    email?: string | null;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    canEdit: boolean;
    canAddItems: boolean;
    canRemoveItems: boolean;
    canEditItems: boolean;
    canMarkPurchased: boolean;
    canInviteOthers: boolean;
    invitedAt: string;
    statusChangedAt?: string | null;
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
    description?: string | null;
    tags: Array<string>;
    budgetAmount?: number | null;
    currency?: string | null;
    category?: string | null;
    priority: number;
    status: ListStatus;
    isCompleted: boolean;
    isDefault: boolean;
    updatedAt: string;
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
    id: string;
    isPublic: boolean;
    shareCode?: string | null;
  };
};

export type AddItemToShoppingListMutationVariables = Exact<{
  input: CreateShoppingListItemInput;
}>;

export type AddItemToShoppingListMutation = {
  __typename?: 'Mutation';
  addItemToShoppingList: {
    __typename?: 'ShoppingListItem';
    id: string;
    quantity?: number | null;
    estimatedPrice?: number | null;
    itemName?: string | null;
    unitName?: string | null;
    notes?: string | null;
    priority: number;
    category?: string | null;
    isPurchased: boolean;
    item?: {
      __typename?: 'Item';
      id: string;
      name: string;
      description?: string | null;
      imageUrl?: string | null;
    } | null;
    unit?: {
      __typename?: 'Unit';
      id: string;
      name: string;
      symbol: string;
    } | null;
    shoppingList: {
      __typename?: 'ShoppingList';
      id: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
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
    id: string;
    quantity?: number | null;
    estimatedPrice?: number | null;
    budgetPrice?: number | null;
    isPurchased: boolean;
    purchasedQuantity?: number | null;
    purchasedPrice?: number | null;
    itemName?: string | null;
    unitName?: string | null;
    notes?: string | null;
    priority: number;
    category?: string | null;
    item?: {__typename?: 'Item'; id: string; name: string} | null;
    unit?: {
      __typename?: 'Unit';
      id: string;
      name: string;
      symbol: string;
    } | null;
  };
};

export type RemoveItemFromShoppingListMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type RemoveItemFromShoppingListMutation = {
  __typename?: 'Mutation';
  removeItemFromShoppingList: boolean;
};

export type ToggleShoppingListItemCompletionMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type ToggleShoppingListItemCompletionMutation = {
  __typename?: 'Mutation';
  toggleShoppingListItemCompletion: boolean;
};

export type MarkItemPurchasedMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type MarkItemPurchasedMutation = {
  __typename?: 'Mutation';
  markItemPurchased: boolean;
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
    timezone?: string | null;
    preferredCurrency?: string | null;
    language?: string | null;
    defaultShoppingListId?: string | null;
    defaultHomeId?: string | null;
    createdAt: string;
    updatedAt: string;
    lastActiveAt?: string | null;
  };
};

export type ShoppingListCollaboratorsQueryVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type ShoppingListCollaboratorsQuery = {
  __typename?: 'Query';
  shoppingListCollaborators: Array<{
    __typename?: 'ShoppingListCollaborator';
    id: string;
    role: CollaboratorRole;
    status: CollaboratorStatus;
    invitedAt: string;
    statusChangedAt?: string | null;
    email?: string | null;
    collaborator?: {
      __typename?: 'User';
      email: string;
      role: UserRole;
      emailVerified: boolean;
      id: string;
    } | null;
  }>;
};

export type HomeQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type HomeQuery = {
  __typename?: 'Query';
  home?: {
    __typename?: 'Home';
    id: string;
    name: string;
    description?: string | null;
    pantries?: Array<{
      __typename?: 'Pantry';
      name: string;
      id: string;
      isDefault: boolean;
    }> | null;
    memberships: Array<{
      __typename?: 'Membership';
      id: string;
      homeId: string;
      userId: string;
      user: {__typename?: 'User'; email: string};
    }>;
    membershipStats: {
      __typename?: 'MembershipStats';
      total: number;
      active: number;
      recentlyActive: number;
    };
  } | null;
};

export type HomesQueryVariables = Exact<{[key: string]: never}>;

export type HomesQuery = {
  __typename?: 'Query';
  homes: Array<{
    __typename?: 'Home';
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    pantries?: Array<{
      __typename?: 'Pantry';
      id: string;
      name: string;
      isDefault: boolean;
    }> | null;
  }>;
};

export type ItemsQueryVariables = Exact<{
  filters?: InputMaybe<ItemFilters>;
  sort?: InputMaybe<ItemSortInput>;
  pagination?: InputMaybe<PaginationInput>;
}>;

export type ItemsQuery = {
  __typename?: 'Query';
  items: {
    __typename?: 'ItemsResponse';
    totalCount: number;
    items?: Array<{
      __typename?: 'Item';
      id: string;
      name: string;
      description?: string | null;
      type: ItemType;
      barcode?: string | null;
      storageState: StorageState;
      imageUrl?: string | null;
      shelfLifeDays?: number | null;
      tags: Array<string>;
      status: ItemStatus;
      visibility: Visibility;
      showInOnboarding: boolean;
      nutritions?: any | null;
      healthBenefits?: any | null;
      metadata?: any | null;
      createdAt: string;
      updatedAt: string;
      deletedAt?: string | null;
      version: number;
      units: Array<{
        __typename?: 'ItemUnit';
        id: string;
        isDefault?: boolean | null;
      }>;
      brands: Array<{__typename?: 'ItemBrand'; id: string}>;
      categories: Array<{__typename?: 'ItemCategory'; id: string}>;
    }> | null;
  };
};

export type SearchItemsQueryVariables = Exact<{
  input: SearchItemsInput;
}>;

export type SearchItemsQuery = {
  __typename?: 'Query';
  searchItems: {
    __typename?: 'ItemsResponse';
    totalCount: number;
    hasMore: boolean;
    items?: Array<{__typename?: 'Item'; id: string; name: string}> | null;
  };
};

export type SearchItemsByBarcodeQueryVariables = Exact<{
  barcode: Scalars['String']['input'];
}>;

export type SearchItemsByBarcodeQuery = {
  __typename?: 'Query';
  searchItemsByBarcode: Array<{
    __typename?: 'Item';
    id: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    barcode?: string | null;
  }>;
};

export type PantriesQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;

export type PantriesQuery = {
  __typename?: 'Query';
  pantries: Array<{
    __typename?: 'Pantry';
    id: string;
    homeId: string;
    name: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt?: string | null;
    version: number;
    tags: Array<string>;
    items?: Array<{
      __typename?: 'PantryItem';
      id: string;
      itemName: string;
      item: {__typename?: 'Item'; name: string};
    }> | null;
  }>;
};

export type PantryItemsQueryVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;

export type PantryItemsQuery = {
  __typename?: 'Query';
  pantryItems: Array<{
    __typename?: 'PantryItem';
    id: string;
    unitName: string;
    unitId: string;
    pantryId: string;
    itemName: string;
    itemId: string;
    itemBarcode?: string | null;
    expiresAt?: string | null;
    storageLocation?: string | null;
    storageState: StorageState;
    initialQuantity: number;
    item: {
      __typename?: 'Item';
      id: string;
      name: string;
      description?: string | null;
      imageUrl?: string | null;
    };
    unit: {__typename?: 'Unit'; id: string; name: string; symbol: string};
  }>;
};

export type OnboardingItemsQueryVariables = Exact<{[key: string]: never}>;

export type OnboardingItemsQuery = {
  __typename?: 'Query';
  onboardingItems: Array<{
    __typename?: 'Item';
    id: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    type: ItemType;
    storageState: StorageState;
    popularity: number;
    status: ItemStatus;
    units: Array<{
      __typename?: 'ItemUnit';
      id: string;
      itemId: string;
      unitId: string;
      unit?: {
        __typename?: 'Unit';
        id: string;
        name: string;
        symbol: string;
        type: UnitType;
        isMetric: boolean;
        baseUnitId?: string | null;
        conversionFactor: number;
        isCommon: boolean;
      } | null;
    }>;
  }>;
};

export type UserProfileQueryVariables = Exact<{[key: string]: never}>;

export type UserProfileQuery = {
  __typename?: 'Query';
  userProfile?: {
    __typename?: 'UserProfile';
    id: string;
    userId: string;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatar?: string | null;
    coverImage?: string | null;
    phone?: string | null;
    website?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    profileVisibility: ProfileVisibility;
    showEmail: boolean;
    showPhone: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type ShoppingListQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;

export type ShoppingListQuery = {
  __typename?: 'Query';
  shoppingList?: {
    __typename?: 'ShoppingList';
    id: string;
    name: string;
    description?: string | null;
    isDefault: boolean;
    isPublic: boolean;
    shareCode?: string | null;
    tags: Array<string>;
    budgetAmount?: number | null;
    totalCost: number;
    estimatedTotal: number;
    currency?: string | null;
    category?: string | null;
    priority: number;
    status: ListStatus;
    isCompleted: boolean;
    completedAt?: string | null;
    totalItems: number;
    completedItems: number;
    createdAt: string;
    updatedAt: string;
    items: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      quantity?: number | null;
      estimatedPrice?: number | null;
      budgetPrice?: number | null;
      isPurchased: boolean;
      purchasedQuantity?: number | null;
      purchasedPrice?: number | null;
      purchaseDate?: string | null;
      itemName?: string | null;
      itemBarcode?: string | null;
      unitName?: string | null;
      notes?: string | null;
      priority: number;
      category?: string | null;
      sortOrder: number;
      isAutoAdded: boolean;
      autoAddReason?: string | null;
      isFromMealPlan: boolean;
      createdAt: string;
      updatedAt: string;
      item?: {
        __typename?: 'Item';
        id: string;
        name: string;
        description?: string | null;
        barcode?: string | null;
        imageUrl?: string | null;
        type: ItemType;
        storageState: StorageState;
        averagePrice?: number | null;
      } | null;
      unit?: {
        __typename?: 'Unit';
        id: string;
        name: string;
        symbol: string;
      } | null;
      preferredStore?: {
        __typename?: 'Store';
        id: string;
        name: string;
        address?: string | null;
      } | null;
      purchasedBy?: {__typename?: 'User'; id: string; email: string} | null;
      addedBy?: {__typename?: 'User'; id: string; email: string} | null;
    }>;
    collaborators: Array<{
      __typename?: 'ShoppingListCollaborator';
      id: string;
      email?: string | null;
      role: CollaboratorRole;
      status: CollaboratorStatus;
      canEdit: boolean;
      canAddItems: boolean;
      canRemoveItems: boolean;
      canEditItems: boolean;
      canMarkPurchased: boolean;
      canInviteOthers: boolean;
      invitedAt: string;
      lastViewedAt?: string | null;
    }>;
    targetStore?: {
      __typename?: 'Store';
      id: string;
      name: string;
      address?: string | null;
    } | null;
  } | null;
};

export type ShoppingListsQueryVariables = Exact<{[key: string]: never}>;

export type ShoppingListsQuery = {
  __typename?: 'Query';
  shoppingLists: Array<{
    __typename?: 'ShoppingList';
    id: string;
    name: string;
    description?: string | null;
    isDefault: boolean;
    isPublic: boolean;
    tags: Array<string>;
    totalItems: number;
    completedItems: number;
    estimatedTotal: number;
    currency?: string | null;
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
    collaborators: Array<{
      __typename?: 'ShoppingListCollaborator';
      id: string;
      email?: string | null;
      role: CollaboratorRole;
    }>;
  }>;
};

export type DefaultShoppingListQueryVariables = Exact<{[key: string]: never}>;

export type DefaultShoppingListQuery = {
  __typename?: 'Query';
  defaultShoppingList?: {
    __typename?: 'ShoppingList';
    id: string;
    name: string;
    description?: string | null;
    isDefault: boolean;
    totalItems: number;
    completedItems: number;
    items: Array<{
      __typename?: 'ShoppingListItem';
      id: string;
      itemName?: string | null;
      quantity?: number | null;
      isPurchased: boolean;
      item?: {
        __typename?: 'Item';
        id: string;
        name: string;
        imageUrl?: string | null;
      } | null;
    }>;
  } | null;
};

export type ShoppingListItemsQueryVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type ShoppingListItemsQuery = {
  __typename?: 'Query';
  shoppingListItems: Array<{
    __typename?: 'ShoppingListItem';
    id: string;
    quantity?: number | null;
    itemName?: string | null;
    unitName?: string | null;
    isPurchased: boolean;
    createdAt: string;
    updatedAt: string;
    item?: {
      __typename?: 'Item';
      id: string;
      name: string;
      imageUrl?: string | null;
    } | null;
  }>;
};

export type UnitsQueryVariables = Exact<{[key: string]: never}>;

export type UnitsQuery = {
  __typename?: 'Query';
  units: Array<{
    __typename?: 'Unit';
    id: string;
    name: string;
    symbol: string;
    type: UnitType;
    conversionFactor: number;
    notes?: string | null;
  }>;
};

export type MeQueryVariables = Exact<{[key: string]: never}>;

export type MeQuery = {
  __typename?: 'Query';
  me?: {
    __typename?: 'User';
    id: string;
    email: string;
    emailVerified: boolean;
    role: UserRole;
    onBoarded: boolean;
    timezone?: string | null;
    preferredCurrency?: string | null;
    language?: string | null;
    defaultShoppingListId?: string | null;
    defaultHomeId?: string | null;
    createdAt: string;
    updatedAt: string;
    lastActiveAt?: string | null;
    profile?: {
      __typename?: 'UserProfile';
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      displayName?: string | null;
      bio?: string | null;
      avatar?: string | null;
      phone?: string | null;
    } | null;
    settings?: {
      __typename?: 'UserSettings';
      id: string;
      emailNotifications: boolean;
      pushNotifications: boolean;
      theme: AppTheme;
    } | null;
  } | null;
};

export type PantryItemsChangedSubscriptionVariables = Exact<{
  pantryId: Scalars['ID']['input'];
  itemId: Scalars['String']['input'];
}>;

export type PantryItemsChangedSubscription = {
  __typename?: 'Subscription';
  pantryItemsChanged: {
    __typename?: 'PantryItemChangedPayload';
    pantryId: string;
    itemId: string;
    item: {__typename?: 'PantryItem'; itemId: string; itemName: string};
  };
};

export type ShoppingListUpdatedSubscriptionVariables = Exact<{
  listId: Scalars['ID']['input'];
}>;

export type ShoppingListUpdatedSubscription = {
  __typename?: 'Subscription';
  shoppingListUpdated?: {
    __typename?: 'ShoppingListUpdatedPayload';
    mutation: MutationType;
    node?: {
      __typename?: 'ShoppingList';
      id: string;
      name: string;
      totalItems: number;
      completedItems: number;
      estimatedTotal: number;
      items: Array<{
        __typename?: 'ShoppingListItem';
        id: string;
        itemName?: string | null;
        quantity?: number | null;
        isPurchased: boolean;
      }>;
    } | null;
  } | null;
};

export type ShoppingListItemAddedSubscriptionVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type ShoppingListItemAddedSubscription = {
  __typename?: 'Subscription';
  shoppingListItemAdded: {
    __typename?: 'ShoppingListItem';
    id: string;
    itemName?: string | null;
    quantity?: number | null;
    isPurchased: boolean;
    addedBy?: {__typename?: 'User'; id: string; email: string} | null;
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
    itemName?: string | null;
    quantity?: number | null;
    isPurchased: boolean;
    notes?: string | null;
    priority: number;
  };
};

export type ShoppingListItemRemovedSubscriptionVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;

export type ShoppingListItemRemovedSubscription = {
  __typename?: 'Subscription';
  shoppingListItemRemoved: {__typename?: 'ShoppingListItem'; id: string};
};
