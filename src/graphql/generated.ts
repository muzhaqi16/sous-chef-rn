import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: any; output: any; }
  JSON: { input: any; output: any; }
};

export type AddCollaboratorInput = {
  email: Scalars['String']['input'];
  role: CollaboratorRole;
  shoppingListId: Scalars['ID']['input'];
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
  user: User;
};

export type Brand = {
  __typename?: 'Brand';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type Category = {
  __typename?: 'Category';
  children?: Maybe<Array<Category>>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  parent?: Maybe<Category>;
};

export enum CollaboratorRole {
  Editor = 'EDITOR',
  Viewer = 'VIEWER'
}

export enum CollaboratorStatus {
  Active = 'ACTIVE',
  Pending = 'PENDING',
  Removed = 'REMOVED'
}

/**
 * Input payload for creating a new Home.
 * - name: user-friendly display name
 * - type: category (PERSONAL, HOUSEHOLD, BOAT, OFFICE)
 */
export type CreateHomeInput = {
  /** A human-friendly name for this Home. */
  name: Scalars['String']['input'];
  /**
   * The HomeType controls UI / feature flags:
   * - PERSONAL: private, auto-created on signup
   * - HOUSEHOLD: shared with family/roommates
   * - BOAT: inventory for marine use
   * - OFFICE: company or team pantry
   */
  type?: HomeType;
};

export type CreateHomeInviteInput = {
  email: Scalars['String']['input'];
  expiresAt: Scalars['DateTime']['input'];
  homeId: Scalars['ID']['input'];
  role: Role;
};

export type CreatePantryInput = {
  homeId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type CreatePantryItemInput = {
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  itemId: Scalars['ID']['input'];
  pantryId: Scalars['ID']['input'];
  quantity: Scalars['Float']['input'];
  storageState?: InputMaybe<StorageState>;
  unitId: Scalars['ID']['input'];
};

/**
 * Input payload for creating a new Shopping List.
 * - name: user-friendly display name
 * - isDefault: whether this is the user's default shopping list
 * - tags: optional list of tags for categorization
 */
export type CreateShoppingListInput = {
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateUpdateItemInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  barcode?: InputMaybe<Scalars['String']['input']>;
  brandIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  dataType?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  fdcId?: InputMaybe<Scalars['Int']['input']>;
  foodCategory?: InputMaybe<Scalars['String']['input']>;
  healthBenefits?: InputMaybe<Scalars['JSON']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  marketCountry?: InputMaybe<Scalars['String']['input']>;
  metadata?: InputMaybe<Scalars['JSON']['input']>;
  modifiedDate?: InputMaybe<Scalars['DateTime']['input']>;
  name: Scalars['String']['input'];
  nutritions?: InputMaybe<Scalars['JSON']['input']>;
  publishedDate?: InputMaybe<Scalars['DateTime']['input']>;
  servingSize?: InputMaybe<Scalars['Float']['input']>;
  servingSizeUnit?: InputMaybe<Scalars['String']['input']>;
  shelfLifeDays?: InputMaybe<Scalars['Int']['input']>;
  showInOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<ItemStatus>;
  storageState: StorageState;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  unitIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  visibility?: InputMaybe<Visibility>;
};

export type Currency = {
  __typename?: 'Currency';
  code: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export enum CurrencyCode {
  Aud = 'AUD',
  Cad = 'CAD',
  Eur = 'EUR',
  Gbp = 'GBP',
  Usd = 'USD'
}

export type Home = {
  __typename?: 'Home';
  createdAt: Scalars['DateTime']['output'];
  defaultPantry?: Maybe<Pantry>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  invites: Array<HomeInvite>;
  members: Array<Membership>;
  name: Scalars['String']['output'];
  ownerId: Scalars['ID']['output'];
  pantries: Array<Pantry>;
  tags: Array<Scalars['String']['output']>;
  type: HomeType;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type HomeInvite = {
  __typename?: 'HomeInvite';
  acceptedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  email: Scalars['String']['output'];
  expiresAt: Scalars['DateTime']['output'];
  home: Home;
  homeId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  inviter: User;
  inviterId: Scalars['ID']['output'];
  role: Role;
  status: InviteStatus;
  token: Scalars['String']['output'];
};

export enum HomeType {
  Boat = 'BOAT',
  Household = 'HOUSEHOLD',
  Office = 'OFFICE',
  Personal = 'PERSONAL'
}

export enum InviteStatus {
  Accepted = 'ACCEPTED',
  Expired = 'EXPIRED',
  Pending = 'PENDING',
  Revoked = 'REVOKED'
}

export type Item = {
  __typename?: 'Item';
  aisle?: Maybe<Scalars['String']['output']>;
  barcode?: Maybe<Scalars['String']['output']>;
  brands?: Maybe<Array<Brand>>;
  categories?: Maybe<Array<Category>>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<User>;
  dataType?: Maybe<Scalars['String']['output']>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  fdcId?: Maybe<Scalars['Int']['output']>;
  foodCategory?: Maybe<Scalars['String']['output']>;
  healthBenefits?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  marketCountry?: Maybe<Scalars['String']['output']>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  modifiedDate?: Maybe<Scalars['DateTime']['output']>;
  name: Scalars['String']['output'];
  nutritions?: Maybe<Scalars['JSON']['output']>;
  popularityCount: Scalars['Int']['output'];
  publishedDate?: Maybe<Scalars['DateTime']['output']>;
  servingSize?: Maybe<Scalars['Float']['output']>;
  servingSizeUnit?: Maybe<Scalars['String']['output']>;
  shelfLifeDays?: Maybe<Scalars['Int']['output']>;
  showInOnboarding: Scalars['Boolean']['output'];
  skus?: Maybe<Array<ItemStoreSku>>;
  status: ItemStatus;
  storageState: StorageState;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  units?: Maybe<Array<ItemUnit>>;
  updatedAt: Scalars['DateTime']['output'];
  updatedBy?: Maybe<User>;
  version: Scalars['Int']['output'];
  visibility: Visibility;
};

export type ItemCategory = {
  __typename?: 'ItemCategory';
  category: Category;
  id: Scalars['ID']['output'];
};

export type ItemFilterInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  barcode?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ItemStatus>;
  visibility?: InputMaybe<Visibility>;
};

export enum ItemStatus {
  Approved = 'APPROVED',
  Pending = 'PENDING',
  Rejected = 'REJECTED'
}

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
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type ItemUnit = {
  __typename?: 'ItemUnit';
  conversionFactor?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  unit: Unit;
};

export type LeaveHomeInput = {
  homeId: Scalars['ID']['input'];
};

export type LoginHistory = {
  __typename?: 'LoginHistory';
  id: Scalars['ID']['output'];
  ip?: Maybe<Scalars['String']['output']>;
  loggedAt: Scalars['DateTime']['output'];
  success: Scalars['Boolean']['output'];
  userAgent?: Maybe<Scalars['String']['output']>;
};

export type LoginHistoryInput = {
  userId: Scalars['ID']['input'];
};

export type Membership = {
  __typename?: 'Membership';
  id: Scalars['ID']['output'];
  joinedAt: Scalars['DateTime']['output'];
  role: Role;
  user: User;
};

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  acceptHomeInvite: Home;
  addCollaborator: ShoppingListCollaborator;
  addItemToPantry: PantryItem;
  addItemToShoppingList: ShoppingListItem;
  addUserAddress: UserAddress;
  createBrand: Brand;
  createCategory: Category;
  createCurrency: Currency;
  /** Create a new Home (and its default pantry) for the signed-in user. */
  createHome: Home;
  createHomeInvite: HomeInvite;
  createItem: Item;
  createNotification: Notification;
  createPantry: Pantry;
  createPantryItem: PantryItem;
  createPurchase: Purchase;
  createShoppingList: ShoppingList;
  createStore: Store;
  createUnit: Unit;
  deleteBrand: Brand;
  deleteCategory: Category;
  deleteCurrency: Currency;
  deleteItem: Item;
  deleteNotification: Notification;
  deletePantry: Scalars['Boolean']['output'];
  deletePantryItem: Scalars['Boolean']['output'];
  deletePurchase: Purchase;
  deleteShoppingList: ShoppingList;
  deleteStore: Store;
  deleteUnit: Unit;
  deleteUser: User;
  deleteUserAddress: UserAddress;
  forgotPassword: Scalars['Boolean']['output'];
  leaveHome: Scalars['Boolean']['output'];
  login: AuthPayload;
  markItemPurchased: ShoppingListItem;
  markNotificationRead: Notification;
  refresh: AuthPayload;
  register: AuthPayload;
  removeCollaborator: Scalars['Boolean']['output'];
  removeItemFromShoppingList: Scalars['Boolean']['output'];
  resendVerificationEmail: Scalars['Boolean']['output'];
  resetPassword: Scalars['Boolean']['output'];
  revokeHomeInvite: HomeInvite;
  updateBrand: Brand;
  updateCategory: Category;
  updateCurrency: Currency;
  updateHome: Home;
  updateItem: Item;
  updateMembershipRole: Membership;
  updatePantry: Pantry;
  updatePantryItem: PantryItem;
  updatePurchase: Purchase;
  updateShoppingList: ShoppingList;
  updateStore: Store;
  updateStoreInfo: StoreInfo;
  updateUnit: Unit;
  updateUser: User;
  updateUserAddress: UserAddress;
  updateUserModeration: UserModeration;
  updateUserProfile?: Maybe<UserProfile>;
  updateUserSettings: UserSettings;
  verifyEmail: Scalars['Boolean']['output'];
};


export type MutationAcceptHomeInviteArgs = {
  token: Scalars['String']['input'];
};


export type MutationAddCollaboratorArgs = {
  data: AddCollaboratorInput;
};


export type MutationAddItemToPantryArgs = {
  input: CreatePantryItemInput;
};


export type MutationAddItemToShoppingListArgs = {
  data: ShoppingListItemInput;
};


export type MutationAddUserAddressArgs = {
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


export type MutationCreateBrandArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationCreateCategoryArgs = {
  name: Scalars['String']['input'];
  parentId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationCreateCurrencyArgs = {
  code: Scalars['String']['input'];
  name: Scalars['String']['input'];
  symbol: Scalars['String']['input'];
};


export type MutationCreateHomeArgs = {
  input: CreateHomeInput;
};


export type MutationCreateHomeInviteArgs = {
  input: CreateHomeInviteInput;
};


export type MutationCreateItemArgs = {
  data: CreateUpdateItemInput;
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


export type MutationCreatePantryItemArgs = {
  input: CreatePantryItemInput;
};


export type MutationCreatePurchaseArgs = {
  currency?: InputMaybe<Scalars['String']['input']>;
  expirationDate?: InputMaybe<Scalars['DateTime']['input']>;
  itemId: Scalars['ID']['input'];
  itemName: Scalars['String']['input'];
  price: Scalars['Float']['input'];
  purchaseDate?: InputMaybe<Scalars['DateTime']['input']>;
  quantity: Scalars['Float']['input'];
  storeId: Scalars['ID']['input'];
  unitId: Scalars['ID']['input'];
  unitSymbol: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationCreateShoppingListArgs = {
  data: CreateShoppingListInput;
};


export type MutationCreateStoreArgs = {
  location?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
};


export type MutationCreateUnitArgs = {
  conversionFactor: Scalars['Float']['input'];
  name: Scalars['String']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  symbol: Scalars['String']['input'];
  type: UnitType;
};


export type MutationDeleteBrandArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCurrencyArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteItemArgs = {
  id: Scalars['ID']['input'];
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


export type MutationDeleteShoppingListArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteStoreArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUnitArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUserArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUserAddressArgs = {
  id: Scalars['ID']['input'];
};


export type MutationForgotPasswordArgs = {
  email: Scalars['String']['input'];
};


export type MutationLeaveHomeArgs = {
  input: LeaveHomeInput;
};


export type MutationLoginArgs = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};


export type MutationMarkItemPurchasedArgs = {
  id: Scalars['ID']['input'];
};


export type MutationMarkNotificationReadArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRefreshArgs = {
  token: Scalars['String']['input'];
};


export type MutationRegisterArgs = {
  email: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  password: Scalars['String']['input'];
};


export type MutationRemoveCollaboratorArgs = {
  data: RemoveCollaboratorInput;
};


export type MutationRemoveItemFromShoppingListArgs = {
  id: Scalars['ID']['input'];
};


export type MutationResendVerificationEmailArgs = {
  email: Scalars['String']['input'];
};


export type MutationResetPasswordArgs = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationRevokeHomeInviteArgs = {
  token: Scalars['String']['input'];
};


export type MutationUpdateBrandArgs = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUpdateCategoryArgs = {
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  parentId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationUpdateCurrencyArgs = {
  code?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateHomeArgs = {
  input: UpdateHomeInput;
};


export type MutationUpdateItemArgs = {
  data: CreateUpdateItemInput;
  id: Scalars['ID']['input'];
};


export type MutationUpdateMembershipRoleArgs = {
  input: UpdateMembershipRoleInput;
};


export type MutationUpdatePantryArgs = {
  input: UpdatePantryInput;
};


export type MutationUpdatePantryItemArgs = {
  input: UpdatePantryItemInput;
};


export type MutationUpdatePurchaseArgs = {
  currency?: InputMaybe<Scalars['String']['input']>;
  expirationDate?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
  itemName?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['Float']['input']>;
  purchaseDate?: InputMaybe<Scalars['DateTime']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  unitSymbol?: InputMaybe<Scalars['String']['input']>;
};


export type MutationUpdateShoppingListArgs = {
  data: UpdateShoppingListInput;
  id: Scalars['ID']['input'];
};


export type MutationUpdateStoreArgs = {
  id: Scalars['ID']['input'];
  location?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
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


export type MutationUpdateUnitArgs = {
  conversionFactor?: InputMaybe<Scalars['Float']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<UnitType>;
};


export type MutationUpdateUserArgs = {
  email?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  role?: InputMaybe<Role>;
};


export type MutationUpdateUserAddressArgs = {
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


export type MutationUpdateUserModerationArgs = {
  banReason?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isBanned?: InputMaybe<Scalars['Boolean']['input']>;
  violationCount?: InputMaybe<Scalars['Int']['input']>;
};


export type MutationUpdateUserProfileArgs = {
  data: UpdateUserSettingsInput;
};


export type MutationUpdateUserSettingsArgs = {
  dietaryRestrictions?: InputMaybe<Array<Scalars['String']['input']>>;
  locale?: InputMaybe<Scalars['String']['input']>;
  notifyExpirySoon?: InputMaybe<Scalars['Boolean']['input']>;
  notifyLowStock?: InputMaybe<Scalars['Boolean']['input']>;
  timeZone?: InputMaybe<Scalars['String']['input']>;
};


export type MutationVerifyEmailArgs = {
  code: Scalars['String']['input'];
};

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
  Sent = 'SENT'
}

export enum NotificationType {
  ExpiryReminder = 'EXPIRY_REMINDER',
  ItemDeleted = 'ITEM_DELETED',
  ItemUpdated = 'ITEM_UPDATED',
  LowStock = 'LOW_STOCK',
  NewItemAdded = 'NEW_ITEM_ADDED'
}

export type PaginatedItems = {
  __typename?: 'PaginatedItems';
  items: Array<Item>;
  totalCount: Scalars['Int']['output'];
};

export type Pantry = {
  __typename?: 'Pantry';
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  homeId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  items: Array<PantryItem>;
  name: Scalars['String']['output'];
  tags: Array<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type PantryItem = {
  __typename?: 'PantryItem';
  addedAt: Scalars['DateTime']['output'];
  expiresAt?: Maybe<Scalars['DateTime']['output']>;
  grams: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  item: Item;
  itemId: Scalars['ID']['output'];
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  pantryId: Scalars['ID']['output'];
  quantity: Scalars['Float']['output'];
  storageState: StorageState;
  unit: Unit;
  unitId: Scalars['ID']['output'];
  version: Scalars['Int']['output'];
};

export type Purchase = {
  __typename?: 'Purchase';
  currency: Currency;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  expirationDate?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  itemId: Scalars['ID']['output'];
  itemName: Scalars['String']['output'];
  price: Scalars['Float']['output'];
  purchaseDate: Scalars['DateTime']['output'];
  quantity: Scalars['Float']['output'];
  storeId: Scalars['ID']['output'];
  unitId: Scalars['ID']['output'];
  unitSymbol: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
  version: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  autocompleteItems?: Maybe<Array<ItemSuggestion>>;
  brand?: Maybe<Brand>;
  brands: Array<Brand>;
  categories: Array<Category>;
  category?: Maybe<Category>;
  currencies: Array<Currency>;
  currency?: Maybe<Currency>;
  home: Home;
  homeInvite?: Maybe<HomeInvite>;
  homeInvites: Array<HomeInvite>;
  homes: Array<Home>;
  item?: Maybe<Item>;
  itemByBarcode?: Maybe<Item>;
  itemByName?: Maybe<Item>;
  items?: Maybe<PaginatedItems>;
  itemsByIds?: Maybe<Array<Item>>;
  loginHistory?: Maybe<Array<LoginHistory>>;
  me?: Maybe<User>;
  notificationsByUser: Array<Notification>;
  onBoardingPantryItems?: Maybe<Array<Item>>;
  pantries: Array<Pantry>;
  pantry?: Maybe<Pantry>;
  pantryItems: Array<PantryItem>;
  popularItems: Array<ItemSuggestion>;
  purchasesByUser: Array<Purchase>;
  shoppingList?: Maybe<ShoppingList>;
  shoppingListCollaborators: Array<ShoppingListCollaborator>;
  shoppingListItem?: Maybe<ShoppingListItem>;
  shoppingListItems: Array<ShoppingListItem>;
  shoppingLists: Array<ShoppingList>;
  stores: Array<Store>;
  unit?: Maybe<Unit>;
  units: Array<Unit>;
  user?: Maybe<User>;
  userProfile?: Maybe<UserProfile>;
  users: Array<User>;
};


export type QueryAutocompleteItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
};


export type QueryBrandArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCategoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryCurrencyArgs = {
  id: Scalars['ID']['input'];
};


export type QueryHomeArgs = {
  id?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryHomeInviteArgs = {
  token: Scalars['String']['input'];
};


export type QueryHomeInvitesArgs = {
  homeId: Scalars['ID']['input'];
};


export type QueryHomesArgs = {
  type?: InputMaybe<HomeType>;
};


export type QueryItemArgs = {
  id: Scalars['ID']['input'];
};


export type QueryItemByBarcodeArgs = {
  barcode: Scalars['String']['input'];
};


export type QueryItemByNameArgs = {
  name: Scalars['String']['input'];
};


export type QueryItemsArgs = {
  filter?: InputMaybe<ItemFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryItemsByIdsArgs = {
  ids: Array<Scalars['ID']['input']>;
};


export type QueryLoginHistoryArgs = {
  data: LoginHistoryInput;
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


export type QueryPantryItemsArgs = {
  pantryId: Scalars['ID']['input'];
};


export type QueryPopularItemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryPurchasesByUserArgs = {
  userId: Scalars['ID']['input'];
};


export type QueryShoppingListArgs = {
  id: Scalars['ID']['input'];
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


export type QueryUnitArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

export type RemoveCollaboratorInput = {
  collaboratorId?: InputMaybe<Scalars['ID']['input']>;
  email?: InputMaybe<Scalars['String']['input']>;
  shoppingListId: Scalars['ID']['input'];
};

export enum Role {
  Admin = 'ADMIN',
  User = 'USER'
}

export type ShoppingList = {
  __typename?: 'ShoppingList';
  collaborators?: Maybe<Array<ShoppingListCollaborator>>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  items?: Maybe<Array<ShoppingListItem>>;
  metadata?: Maybe<Scalars['JSON']['output']>;
  name: Scalars['String']['output'];
  owner: User;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
};

export type ShoppingListCollaborator = {
  __typename?: 'ShoppingListCollaborator';
  collaborator?: Maybe<User>;
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  invitedAt: Scalars['DateTime']['output'];
  role: CollaboratorRole;
  status: CollaboratorStatus;
  statusChangedAt?: Maybe<Scalars['DateTime']['output']>;
};

export type ShoppingListItem = {
  __typename?: 'ShoppingListItem';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  isPurchased: Scalars['Boolean']['output'];
  item?: Maybe<Item>;
  itemName?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  quantity?: Maybe<Scalars['Float']['output']>;
  shoppingListId: Scalars['ID']['output'];
  unit?: Maybe<Unit>;
  unitSymbol?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
};

export type ShoppingListItemInput = {
  itemId?: InputMaybe<Scalars['ID']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  shoppingListId: Scalars['ID']['input'];
  unitId?: InputMaybe<Scalars['ID']['input']>;
};

export enum StorageState {
  Ambient = 'AMBIENT',
  Chilled = 'CHILLED',
  Cold = 'COLD',
  Frozen = 'FROZEN',
  Hot = 'HOT',
  None = 'NONE',
  Refrigerated = 'REFRIGERATED',
  RoomTemperature = 'ROOM_TEMPERATURE',
  Warm = 'WARM'
}

export type Store = {
  __typename?: 'Store';
  id: Scalars['ID']['output'];
  info?: Maybe<StoreInfo>;
  location?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
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

export type Subscription = {
  __typename?: 'Subscription';
  _empty?: Maybe<Scalars['String']['output']>;
  shoppingListUpdated: ShoppingListItem;
};


export type SubscriptionShoppingListUpdatedArgs = {
  listId: Scalars['ID']['input'];
};

export type SyncShoppingListInput = {
  createdAt: Scalars['String']['input'];
  deletedAt?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  updatedAt?: InputMaybe<Scalars['String']['input']>;
};

export type Unit = {
  __typename?: 'Unit';
  conversionFactor?: Maybe<Scalars['Float']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  symbol: Scalars['String']['output'];
  type: UnitType;
};

export enum UnitType {
  Count = 'COUNT',
  Length = 'LENGTH',
  Mass = 'MASS',
  Volume = 'VOLUME'
}

export type UpdateHomeInput = {
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type UpdateMembershipRoleInput = {
  homeId: Scalars['ID']['input'];
  membershipId: Scalars['ID']['input'];
  role: Role;
};

export type UpdatePantryInput = {
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type UpdatePantryItemInput = {
  expiresAt?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
  quantity?: InputMaybe<Scalars['Float']['input']>;
  storageState?: InputMaybe<StorageState>;
};

export type UpdateShoppingListInput = {
  addTags?: InputMaybe<Array<Scalars['String']['input']>>;
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  removeTags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateUserSettingsInput = {
  avatarUrl?: InputMaybe<Scalars['String']['input']>;
  dateOfBirth?: InputMaybe<Scalars['DateTime']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  email: Scalars['String']['output'];
  emailVerified: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  moderation?: Maybe<UserModeration>;
  role: Role;
};

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

export type UserModeration = {
  __typename?: 'UserModeration';
  banReason?: Maybe<Scalars['String']['output']>;
  bannedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isBanned: Scalars['Boolean']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
  violationCount: Scalars['Int']['output'];
};

export type UserProfile = {
  __typename?: 'UserProfile';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  dateOfBirth?: Maybe<Scalars['DateTime']['output']>;
  firstName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  userId: Scalars['String']['output'];
};

export type UserSettings = {
  __typename?: 'UserSettings';
  dietaryRestrictions: Array<Scalars['String']['output']>;
  locale: Scalars['String']['output'];
  notifyExpirySoon: Scalars['Boolean']['output'];
  notifyLowStock: Scalars['Boolean']['output'];
  timeZone: Scalars['String']['output'];
};

export enum Visibility {
  Private = 'PRIVATE',
  Public = 'PUBLIC'
}

export type LoginMutationVariables = Exact<{
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string, user: { __typename?: 'User', id: string, email: string, role: Role, emailVerified: boolean } } };

export type RegisterMutationVariables = Exact<{
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
}>;


export type RegisterMutation = { __typename?: 'Mutation', register: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string, user: { __typename?: 'User', id: string, email: string, role: Role, emailVerified: boolean } } };

export type ForgotPasswordMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type ForgotPasswordMutation = { __typename?: 'Mutation', forgotPassword: boolean };

export type ResetPasswordMutationVariables = Exact<{
  token: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type ResetPasswordMutation = { __typename?: 'Mutation', resetPassword: boolean };

export type RefreshTokenMutationVariables = Exact<{
  token: Scalars['String']['input'];
}>;


export type RefreshTokenMutation = { __typename?: 'Mutation', refresh: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string } };

export type VerifyEmailMutationVariables = Exact<{
  code: Scalars['String']['input'];
}>;


export type VerifyEmailMutation = { __typename?: 'Mutation', verifyEmail: boolean };

export type ResendVerificationEmailMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type ResendVerificationEmailMutation = { __typename?: 'Mutation', resendVerificationEmail: boolean };

export type CreateHomeMutationVariables = Exact<{
  input: CreateHomeInput;
}>;


export type CreateHomeMutation = { __typename?: 'Mutation', createHome: { __typename?: 'Home', id: string, name: string, type: HomeType, ownerId: string, createdAt: any, updatedAt: any, version: number, deletedAt?: any | null } };

export type AddItemToPantryMutationVariables = Exact<{
  input: CreatePantryItemInput;
}>;


export type AddItemToPantryMutation = { __typename?: 'Mutation', addItemToPantry: { __typename?: 'PantryItem', id: string, pantryId: string, itemId: string, unitId: string, quantity: number, grams: number, addedAt: any, lastUsedAt?: any | null, expiresAt?: any | null, storageState: StorageState, version: number, item: { __typename?: 'Item', id: string, imageUrl?: string | null }, unit: { __typename?: 'Unit', name: string, id: string, symbol: string } } };

export type UpdateUserProfileMutationVariables = Exact<{
  data: UpdateUserSettingsInput;
}>;


export type UpdateUserProfileMutation = { __typename?: 'Mutation', updateUserProfile?: { __typename?: 'UserProfile', id: string, firstName?: string | null, lastName?: string | null, avatarUrl?: string | null, phone?: string | null, dateOfBirth?: any | null } | null };

export type CreateShoppingListMutationVariables = Exact<{
  data: CreateShoppingListInput;
}>;


export type CreateShoppingListMutation = { __typename?: 'Mutation', createShoppingList: { __typename?: 'ShoppingList', id: string, name: string, tags?: Array<string> | null, version: number, updatedAt: any, isDefault: boolean, createdAt: any, deletedAt?: any | null, metadata?: any | null, owner: { __typename?: 'User', id: string } } };

export type AddCollaboratorMutationVariables = Exact<{
  data: AddCollaboratorInput;
}>;


export type AddCollaboratorMutation = { __typename?: 'Mutation', addCollaborator: { __typename?: 'ShoppingListCollaborator', id: string, role: CollaboratorRole, status: CollaboratorStatus, invitedAt: any, statusChangedAt?: any | null, email?: string | null, collaborator?: { __typename?: 'User', email: string, id: string, role: Role } | null } };

export type AddItemToShoppingListMutationVariables = Exact<{
  data: ShoppingListItemInput;
}>;


export type AddItemToShoppingListMutation = { __typename?: 'Mutation', addItemToShoppingList: { __typename?: 'ShoppingListItem', id: string, itemName?: string | null, unitSymbol?: string | null } };

export type RemoveItemFromShoppingListMutationVariables = Exact<{
  removeItemFromShoppingListId: Scalars['ID']['input'];
}>;


export type RemoveItemFromShoppingListMutation = { __typename?: 'Mutation', removeItemFromShoppingList: boolean };

export type ShoppingListCollaboratorsQueryVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;


export type ShoppingListCollaboratorsQuery = { __typename?: 'Query', shoppingListCollaborators: Array<{ __typename?: 'ShoppingListCollaborator', id: string, role: CollaboratorRole, status: CollaboratorStatus, invitedAt: any, statusChangedAt?: any | null, email?: string | null, collaborator?: { __typename?: 'User', email: string, role: Role, emailVerified: boolean, id: string } | null }> };

export type HomeQueryVariables = Exact<{ [key: string]: never; }>;


export type HomeQuery = { __typename?: 'Query', home: { __typename?: 'Home', id: string, name: string, ownerId: string, createdAt: any, updatedAt: any, defaultPantry?: { __typename?: 'Pantry', id: string } | null } };

export type HomeByIdQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type HomeByIdQuery = { __typename?: 'Query', home: { __typename?: 'Home', id: string, name: string, ownerId: string, createdAt: any, updatedAt: any, defaultPantry?: { __typename?: 'Pantry', id: string } | null } };

export type HomesQueryVariables = Exact<{ [key: string]: never; }>;


export type HomesQuery = { __typename?: 'Query', homes: Array<{ __typename?: 'Home', id: string, name: string, ownerId: string, createdAt: any, updatedAt: any, defaultPantry?: { __typename?: 'Pantry', id: string } | null }> };

export type ItemsQueryVariables = Exact<{
  filter?: InputMaybe<ItemFilterInput>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ItemsQuery = { __typename?: 'Query', items?: { __typename?: 'PaginatedItems', totalCount: number, items: Array<{ __typename?: 'Item', id: string, fdcId?: number | null, name: string, dataType?: string | null, barcode?: string | null, aisle?: string | null, storageState: StorageState, imageUrl?: string | null, shelfLifeDays?: number | null, popularityCount: number, tags?: Array<string> | null, status: ItemStatus, visibility: Visibility, showInOnboarding: boolean, nutritions?: any | null, marketCountry?: string | null, publishedDate?: any | null, modifiedDate?: any | null, foodCategory?: string | null, servingSize?: number | null, servingSizeUnit?: string | null, healthBenefits?: any | null, metadata?: any | null, createdAt: any, updatedAt: any, deletedAt?: any | null, version: number, units?: Array<{ __typename?: 'ItemUnit', id: string, isDefault: boolean, conversionFactor?: number | null, notes?: string | null }> | null, brands?: Array<{ __typename?: 'Brand', name: string, id: string }> | null, categories?: Array<{ __typename?: 'Category', name: string, id: string }> | null, createdBy?: { __typename?: 'User', id: string } | null, updatedBy?: { __typename?: 'User', id: string } | null }> } | null };

export type AutocompleteItemsQueryVariables = Exact<{
  name: Scalars['String']['input'];
}>;


export type AutocompleteItemsQuery = { __typename?: 'Query', autocompleteItems?: Array<{ __typename?: 'ItemSuggestion', id: string, name: string }> | null };

export type PantriesQueryVariables = Exact<{
  homeId: Scalars['ID']['input'];
}>;


export type PantriesQuery = { __typename?: 'Query', pantries: Array<{ __typename?: 'Pantry', id: string, homeId: string, name: string, version: number, createdAt: any, updatedAt: any, deletedAt?: any | null, items: Array<{ __typename?: 'PantryItem', itemId: string, storageState: StorageState, expiresAt?: any | null, id: string, grams: number, unit: { __typename?: 'Unit', symbol: string, name: string }, item: { __typename?: 'Item', name: string, status: ItemStatus, storageState: StorageState } }> }> };

export type PantryItemsQueryVariables = Exact<{
  pantryId: Scalars['ID']['input'];
}>;


export type PantryItemsQuery = { __typename?: 'Query', pantryItems: Array<{ __typename?: 'PantryItem', id: string, pantryId: string, itemId: string, unitId: string, quantity: number, grams: number, addedAt: any, lastUsedAt?: any | null, expiresAt?: any | null, storageState: StorageState, version: number, item: { __typename?: 'Item', id: string }, unit: { __typename?: 'Unit', symbol: string, name: string } }> };

export type OnBoardingPantryItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type OnBoardingPantryItemsQuery = { __typename?: 'Query', onBoardingPantryItems?: Array<{ __typename?: 'Item', id: string, imageUrl?: string | null, name: string, units?: Array<{ __typename?: 'ItemUnit', id: string }> | null }> | null };

export type UserProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type UserProfileQuery = { __typename?: 'Query', userProfile?: { __typename?: 'UserProfile', id: string, userId: string, firstName?: string | null, lastName?: string | null, avatarUrl?: string | null, phone?: string | null, dateOfBirth?: any | null, createdAt: any, updatedAt: any } | null };

export type ShoppingListsQueryVariables = Exact<{ [key: string]: never; }>;


export type ShoppingListsQuery = { __typename?: 'Query', shoppingLists: Array<{ __typename?: 'ShoppingList', id: string, name: string, isDefault: boolean, tags?: Array<string> | null, createdAt: any, updatedAt: any, owner: { __typename?: 'User', email: string, id: string } }> };

export type ShoppingListItemsQueryVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;


export type ShoppingListItemsQuery = { __typename?: 'Query', shoppingListItems: Array<{ __typename?: 'ShoppingListItem', id: string, label?: string | null, quantity?: number | null, itemName?: string | null, unitSymbol?: string | null, isPurchased: boolean, createdAt: any, updatedAt: any, item?: { __typename?: 'Item', imageUrl?: string | null } | null }> };

export type ShoppingListUpdatedSubscriptionVariables = Exact<{
  listId: Scalars['ID']['input'];
}>;


export type ShoppingListUpdatedSubscription = { __typename?: 'Subscription', shoppingListUpdated: { __typename?: 'ShoppingListItem', id: string, shoppingListId: string, label?: string | null, quantity?: number | null, itemName?: string | null, unitSymbol?: string | null, isPurchased: boolean, createdAt: any, updatedAt: any } };


export const LoginDocument = gql`
    mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    accessToken
    refreshToken
    user {
      id
      email
      role
      emailVerified
    }
  }
}
    `;
export type LoginMutationFn = Apollo.MutationFunction<LoginMutation, LoginMutationVariables>;

/**
 * __useLoginMutation__
 *
 * To run a mutation, you first call `useLoginMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLoginMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [loginMutation, { data, loading, error }] = useLoginMutation({
 *   variables: {
 *      email: // value for 'email'
 *      password: // value for 'password'
 *   },
 * });
 */
export function useLoginMutation(baseOptions?: Apollo.MutationHookOptions<LoginMutation, LoginMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<LoginMutation, LoginMutationVariables>(LoginDocument, options);
      }
export type LoginMutationHookResult = ReturnType<typeof useLoginMutation>;
export type LoginMutationResult = Apollo.MutationResult<LoginMutation>;
export type LoginMutationOptions = Apollo.BaseMutationOptions<LoginMutation, LoginMutationVariables>;
export const RegisterDocument = gql`
    mutation Register($email: String!, $password: String!, $name: String) {
  register(email: $email, password: $password, name: $name) {
    accessToken
    refreshToken
    user {
      id
      email
      role
      emailVerified
    }
  }
}
    `;
export type RegisterMutationFn = Apollo.MutationFunction<RegisterMutation, RegisterMutationVariables>;

/**
 * __useRegisterMutation__
 *
 * To run a mutation, you first call `useRegisterMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRegisterMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [registerMutation, { data, loading, error }] = useRegisterMutation({
 *   variables: {
 *      email: // value for 'email'
 *      password: // value for 'password'
 *      name: // value for 'name'
 *   },
 * });
 */
export function useRegisterMutation(baseOptions?: Apollo.MutationHookOptions<RegisterMutation, RegisterMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RegisterMutation, RegisterMutationVariables>(RegisterDocument, options);
      }
export type RegisterMutationHookResult = ReturnType<typeof useRegisterMutation>;
export type RegisterMutationResult = Apollo.MutationResult<RegisterMutation>;
export type RegisterMutationOptions = Apollo.BaseMutationOptions<RegisterMutation, RegisterMutationVariables>;
export const ForgotPasswordDocument = gql`
    mutation ForgotPassword($email: String!) {
  forgotPassword(email: $email)
}
    `;
export type ForgotPasswordMutationFn = Apollo.MutationFunction<ForgotPasswordMutation, ForgotPasswordMutationVariables>;

/**
 * __useForgotPasswordMutation__
 *
 * To run a mutation, you first call `useForgotPasswordMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useForgotPasswordMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [forgotPasswordMutation, { data, loading, error }] = useForgotPasswordMutation({
 *   variables: {
 *      email: // value for 'email'
 *   },
 * });
 */
export function useForgotPasswordMutation(baseOptions?: Apollo.MutationHookOptions<ForgotPasswordMutation, ForgotPasswordMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ForgotPasswordMutation, ForgotPasswordMutationVariables>(ForgotPasswordDocument, options);
      }
export type ForgotPasswordMutationHookResult = ReturnType<typeof useForgotPasswordMutation>;
export type ForgotPasswordMutationResult = Apollo.MutationResult<ForgotPasswordMutation>;
export type ForgotPasswordMutationOptions = Apollo.BaseMutationOptions<ForgotPasswordMutation, ForgotPasswordMutationVariables>;
export const ResetPasswordDocument = gql`
    mutation ResetPassword($token: String!, $password: String!) {
  resetPassword(token: $token, password: $password)
}
    `;
export type ResetPasswordMutationFn = Apollo.MutationFunction<ResetPasswordMutation, ResetPasswordMutationVariables>;

/**
 * __useResetPasswordMutation__
 *
 * To run a mutation, you first call `useResetPasswordMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useResetPasswordMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [resetPasswordMutation, { data, loading, error }] = useResetPasswordMutation({
 *   variables: {
 *      token: // value for 'token'
 *      password: // value for 'password'
 *   },
 * });
 */
export function useResetPasswordMutation(baseOptions?: Apollo.MutationHookOptions<ResetPasswordMutation, ResetPasswordMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ResetPasswordMutation, ResetPasswordMutationVariables>(ResetPasswordDocument, options);
      }
export type ResetPasswordMutationHookResult = ReturnType<typeof useResetPasswordMutation>;
export type ResetPasswordMutationResult = Apollo.MutationResult<ResetPasswordMutation>;
export type ResetPasswordMutationOptions = Apollo.BaseMutationOptions<ResetPasswordMutation, ResetPasswordMutationVariables>;
export const RefreshTokenDocument = gql`
    mutation RefreshToken($token: String!) {
  refresh(token: $token) {
    accessToken
    refreshToken
  }
}
    `;
export type RefreshTokenMutationFn = Apollo.MutationFunction<RefreshTokenMutation, RefreshTokenMutationVariables>;

/**
 * __useRefreshTokenMutation__
 *
 * To run a mutation, you first call `useRefreshTokenMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRefreshTokenMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [refreshTokenMutation, { data, loading, error }] = useRefreshTokenMutation({
 *   variables: {
 *      token: // value for 'token'
 *   },
 * });
 */
export function useRefreshTokenMutation(baseOptions?: Apollo.MutationHookOptions<RefreshTokenMutation, RefreshTokenMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RefreshTokenMutation, RefreshTokenMutationVariables>(RefreshTokenDocument, options);
      }
export type RefreshTokenMutationHookResult = ReturnType<typeof useRefreshTokenMutation>;
export type RefreshTokenMutationResult = Apollo.MutationResult<RefreshTokenMutation>;
export type RefreshTokenMutationOptions = Apollo.BaseMutationOptions<RefreshTokenMutation, RefreshTokenMutationVariables>;
export const VerifyEmailDocument = gql`
    mutation VerifyEmail($code: String!) {
  verifyEmail(code: $code)
}
    `;
export type VerifyEmailMutationFn = Apollo.MutationFunction<VerifyEmailMutation, VerifyEmailMutationVariables>;

/**
 * __useVerifyEmailMutation__
 *
 * To run a mutation, you first call `useVerifyEmailMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useVerifyEmailMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [verifyEmailMutation, { data, loading, error }] = useVerifyEmailMutation({
 *   variables: {
 *      code: // value for 'code'
 *   },
 * });
 */
export function useVerifyEmailMutation(baseOptions?: Apollo.MutationHookOptions<VerifyEmailMutation, VerifyEmailMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<VerifyEmailMutation, VerifyEmailMutationVariables>(VerifyEmailDocument, options);
      }
export type VerifyEmailMutationHookResult = ReturnType<typeof useVerifyEmailMutation>;
export type VerifyEmailMutationResult = Apollo.MutationResult<VerifyEmailMutation>;
export type VerifyEmailMutationOptions = Apollo.BaseMutationOptions<VerifyEmailMutation, VerifyEmailMutationVariables>;
export const ResendVerificationEmailDocument = gql`
    mutation ResendVerificationEmail($email: String!) {
  resendVerificationEmail(email: $email)
}
    `;
export type ResendVerificationEmailMutationFn = Apollo.MutationFunction<ResendVerificationEmailMutation, ResendVerificationEmailMutationVariables>;

/**
 * __useResendVerificationEmailMutation__
 *
 * To run a mutation, you first call `useResendVerificationEmailMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useResendVerificationEmailMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [resendVerificationEmailMutation, { data, loading, error }] = useResendVerificationEmailMutation({
 *   variables: {
 *      email: // value for 'email'
 *   },
 * });
 */
export function useResendVerificationEmailMutation(baseOptions?: Apollo.MutationHookOptions<ResendVerificationEmailMutation, ResendVerificationEmailMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ResendVerificationEmailMutation, ResendVerificationEmailMutationVariables>(ResendVerificationEmailDocument, options);
      }
export type ResendVerificationEmailMutationHookResult = ReturnType<typeof useResendVerificationEmailMutation>;
export type ResendVerificationEmailMutationResult = Apollo.MutationResult<ResendVerificationEmailMutation>;
export type ResendVerificationEmailMutationOptions = Apollo.BaseMutationOptions<ResendVerificationEmailMutation, ResendVerificationEmailMutationVariables>;
export const CreateHomeDocument = gql`
    mutation CreateHome($input: CreateHomeInput!) {
  createHome(input: $input) {
    id
    name
    type
    ownerId
    createdAt
    updatedAt
    version
    deletedAt
  }
}
    `;
export type CreateHomeMutationFn = Apollo.MutationFunction<CreateHomeMutation, CreateHomeMutationVariables>;

/**
 * __useCreateHomeMutation__
 *
 * To run a mutation, you first call `useCreateHomeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateHomeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createHomeMutation, { data, loading, error }] = useCreateHomeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateHomeMutation(baseOptions?: Apollo.MutationHookOptions<CreateHomeMutation, CreateHomeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateHomeMutation, CreateHomeMutationVariables>(CreateHomeDocument, options);
      }
export type CreateHomeMutationHookResult = ReturnType<typeof useCreateHomeMutation>;
export type CreateHomeMutationResult = Apollo.MutationResult<CreateHomeMutation>;
export type CreateHomeMutationOptions = Apollo.BaseMutationOptions<CreateHomeMutation, CreateHomeMutationVariables>;
export const AddItemToPantryDocument = gql`
    mutation AddItemToPantry($input: CreatePantryItemInput!) {
  addItemToPantry(input: $input) {
    id
    pantryId
    itemId
    unitId
    quantity
    grams
    addedAt
    lastUsedAt
    expiresAt
    storageState
    version
    item {
      id
      imageUrl
    }
    unit {
      name
      id
      symbol
    }
  }
}
    `;
export type AddItemToPantryMutationFn = Apollo.MutationFunction<AddItemToPantryMutation, AddItemToPantryMutationVariables>;

/**
 * __useAddItemToPantryMutation__
 *
 * To run a mutation, you first call `useAddItemToPantryMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddItemToPantryMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addItemToPantryMutation, { data, loading, error }] = useAddItemToPantryMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAddItemToPantryMutation(baseOptions?: Apollo.MutationHookOptions<AddItemToPantryMutation, AddItemToPantryMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddItemToPantryMutation, AddItemToPantryMutationVariables>(AddItemToPantryDocument, options);
      }
export type AddItemToPantryMutationHookResult = ReturnType<typeof useAddItemToPantryMutation>;
export type AddItemToPantryMutationResult = Apollo.MutationResult<AddItemToPantryMutation>;
export type AddItemToPantryMutationOptions = Apollo.BaseMutationOptions<AddItemToPantryMutation, AddItemToPantryMutationVariables>;
export const UpdateUserProfileDocument = gql`
    mutation UpdateUserProfile($data: UpdateUserSettingsInput!) {
  updateUserProfile(data: $data) {
    id
    firstName
    lastName
    avatarUrl
    phone
    dateOfBirth
  }
}
    `;
export type UpdateUserProfileMutationFn = Apollo.MutationFunction<UpdateUserProfileMutation, UpdateUserProfileMutationVariables>;

/**
 * __useUpdateUserProfileMutation__
 *
 * To run a mutation, you first call `useUpdateUserProfileMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateUserProfileMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateUserProfileMutation, { data, loading, error }] = useUpdateUserProfileMutation({
 *   variables: {
 *      data: // value for 'data'
 *   },
 * });
 */
export function useUpdateUserProfileMutation(baseOptions?: Apollo.MutationHookOptions<UpdateUserProfileMutation, UpdateUserProfileMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateUserProfileMutation, UpdateUserProfileMutationVariables>(UpdateUserProfileDocument, options);
      }
export type UpdateUserProfileMutationHookResult = ReturnType<typeof useUpdateUserProfileMutation>;
export type UpdateUserProfileMutationResult = Apollo.MutationResult<UpdateUserProfileMutation>;
export type UpdateUserProfileMutationOptions = Apollo.BaseMutationOptions<UpdateUserProfileMutation, UpdateUserProfileMutationVariables>;
export const CreateShoppingListDocument = gql`
    mutation CreateShoppingList($data: CreateShoppingListInput!) {
  createShoppingList(data: $data) {
    id
    name
    tags
    version
    updatedAt
    isDefault
    owner {
      id
    }
    createdAt
    deletedAt
    metadata
  }
}
    `;
export type CreateShoppingListMutationFn = Apollo.MutationFunction<CreateShoppingListMutation, CreateShoppingListMutationVariables>;

/**
 * __useCreateShoppingListMutation__
 *
 * To run a mutation, you first call `useCreateShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createShoppingListMutation, { data, loading, error }] = useCreateShoppingListMutation({
 *   variables: {
 *      data: // value for 'data'
 *   },
 * });
 */
export function useCreateShoppingListMutation(baseOptions?: Apollo.MutationHookOptions<CreateShoppingListMutation, CreateShoppingListMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<CreateShoppingListMutation, CreateShoppingListMutationVariables>(CreateShoppingListDocument, options);
      }
export type CreateShoppingListMutationHookResult = ReturnType<typeof useCreateShoppingListMutation>;
export type CreateShoppingListMutationResult = Apollo.MutationResult<CreateShoppingListMutation>;
export type CreateShoppingListMutationOptions = Apollo.BaseMutationOptions<CreateShoppingListMutation, CreateShoppingListMutationVariables>;
export const AddCollaboratorDocument = gql`
    mutation AddCollaborator($data: AddCollaboratorInput!) {
  addCollaborator(data: $data) {
    id
    role
    status
    invitedAt
    statusChangedAt
    email
    collaborator {
      email
      id
      role
    }
  }
}
    `;
export type AddCollaboratorMutationFn = Apollo.MutationFunction<AddCollaboratorMutation, AddCollaboratorMutationVariables>;

/**
 * __useAddCollaboratorMutation__
 *
 * To run a mutation, you first call `useAddCollaboratorMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddCollaboratorMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addCollaboratorMutation, { data, loading, error }] = useAddCollaboratorMutation({
 *   variables: {
 *      data: // value for 'data'
 *   },
 * });
 */
export function useAddCollaboratorMutation(baseOptions?: Apollo.MutationHookOptions<AddCollaboratorMutation, AddCollaboratorMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddCollaboratorMutation, AddCollaboratorMutationVariables>(AddCollaboratorDocument, options);
      }
export type AddCollaboratorMutationHookResult = ReturnType<typeof useAddCollaboratorMutation>;
export type AddCollaboratorMutationResult = Apollo.MutationResult<AddCollaboratorMutation>;
export type AddCollaboratorMutationOptions = Apollo.BaseMutationOptions<AddCollaboratorMutation, AddCollaboratorMutationVariables>;
export const AddItemToShoppingListDocument = gql`
    mutation AddItemToShoppingList($data: ShoppingListItemInput!) {
  addItemToShoppingList(data: $data) {
    id
    itemName
    unitSymbol
  }
}
    `;
export type AddItemToShoppingListMutationFn = Apollo.MutationFunction<AddItemToShoppingListMutation, AddItemToShoppingListMutationVariables>;

/**
 * __useAddItemToShoppingListMutation__
 *
 * To run a mutation, you first call `useAddItemToShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddItemToShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addItemToShoppingListMutation, { data, loading, error }] = useAddItemToShoppingListMutation({
 *   variables: {
 *      data: // value for 'data'
 *   },
 * });
 */
export function useAddItemToShoppingListMutation(baseOptions?: Apollo.MutationHookOptions<AddItemToShoppingListMutation, AddItemToShoppingListMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<AddItemToShoppingListMutation, AddItemToShoppingListMutationVariables>(AddItemToShoppingListDocument, options);
      }
export type AddItemToShoppingListMutationHookResult = ReturnType<typeof useAddItemToShoppingListMutation>;
export type AddItemToShoppingListMutationResult = Apollo.MutationResult<AddItemToShoppingListMutation>;
export type AddItemToShoppingListMutationOptions = Apollo.BaseMutationOptions<AddItemToShoppingListMutation, AddItemToShoppingListMutationVariables>;
export const RemoveItemFromShoppingListDocument = gql`
    mutation RemoveItemFromShoppingList($removeItemFromShoppingListId: ID!) {
  removeItemFromShoppingList(id: $removeItemFromShoppingListId)
}
    `;
export type RemoveItemFromShoppingListMutationFn = Apollo.MutationFunction<RemoveItemFromShoppingListMutation, RemoveItemFromShoppingListMutationVariables>;

/**
 * __useRemoveItemFromShoppingListMutation__
 *
 * To run a mutation, you first call `useRemoveItemFromShoppingListMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveItemFromShoppingListMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeItemFromShoppingListMutation, { data, loading, error }] = useRemoveItemFromShoppingListMutation({
 *   variables: {
 *      removeItemFromShoppingListId: // value for 'removeItemFromShoppingListId'
 *   },
 * });
 */
export function useRemoveItemFromShoppingListMutation(baseOptions?: Apollo.MutationHookOptions<RemoveItemFromShoppingListMutation, RemoveItemFromShoppingListMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RemoveItemFromShoppingListMutation, RemoveItemFromShoppingListMutationVariables>(RemoveItemFromShoppingListDocument, options);
      }
export type RemoveItemFromShoppingListMutationHookResult = ReturnType<typeof useRemoveItemFromShoppingListMutation>;
export type RemoveItemFromShoppingListMutationResult = Apollo.MutationResult<RemoveItemFromShoppingListMutation>;
export type RemoveItemFromShoppingListMutationOptions = Apollo.BaseMutationOptions<RemoveItemFromShoppingListMutation, RemoveItemFromShoppingListMutationVariables>;
export const ShoppingListCollaboratorsDocument = gql`
    query ShoppingListCollaborators($shoppingListId: ID!) {
  shoppingListCollaborators(shoppingListId: $shoppingListId) {
    id
    role
    status
    invitedAt
    statusChangedAt
    email
    collaborator {
      email
      role
      emailVerified
      id
    }
  }
}
    `;

/**
 * __useShoppingListCollaboratorsQuery__
 *
 * To run a query within a React component, call `useShoppingListCollaboratorsQuery` and pass it any options that fit your needs.
 * When your component renders, `useShoppingListCollaboratorsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useShoppingListCollaboratorsQuery({
 *   variables: {
 *      shoppingListId: // value for 'shoppingListId'
 *   },
 * });
 */
export function useShoppingListCollaboratorsQuery(baseOptions: Apollo.QueryHookOptions<ShoppingListCollaboratorsQuery, ShoppingListCollaboratorsQueryVariables> & ({ variables: ShoppingListCollaboratorsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ShoppingListCollaboratorsQuery, ShoppingListCollaboratorsQueryVariables>(ShoppingListCollaboratorsDocument, options);
      }
export function useShoppingListCollaboratorsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ShoppingListCollaboratorsQuery, ShoppingListCollaboratorsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ShoppingListCollaboratorsQuery, ShoppingListCollaboratorsQueryVariables>(ShoppingListCollaboratorsDocument, options);
        }
export function useShoppingListCollaboratorsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ShoppingListCollaboratorsQuery, ShoppingListCollaboratorsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ShoppingListCollaboratorsQuery, ShoppingListCollaboratorsQueryVariables>(ShoppingListCollaboratorsDocument, options);
        }
export type ShoppingListCollaboratorsQueryHookResult = ReturnType<typeof useShoppingListCollaboratorsQuery>;
export type ShoppingListCollaboratorsLazyQueryHookResult = ReturnType<typeof useShoppingListCollaboratorsLazyQuery>;
export type ShoppingListCollaboratorsSuspenseQueryHookResult = ReturnType<typeof useShoppingListCollaboratorsSuspenseQuery>;
export type ShoppingListCollaboratorsQueryResult = Apollo.QueryResult<ShoppingListCollaboratorsQuery, ShoppingListCollaboratorsQueryVariables>;
export const HomeDocument = gql`
    query Home {
  home {
    id
    name
    ownerId
    defaultPantry {
      id
    }
    createdAt
    updatedAt
  }
}
    `;

/**
 * __useHomeQuery__
 *
 * To run a query within a React component, call `useHomeQuery` and pass it any options that fit your needs.
 * When your component renders, `useHomeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHomeQuery({
 *   variables: {
 *   },
 * });
 */
export function useHomeQuery(baseOptions?: Apollo.QueryHookOptions<HomeQuery, HomeQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<HomeQuery, HomeQueryVariables>(HomeDocument, options);
      }
export function useHomeLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<HomeQuery, HomeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<HomeQuery, HomeQueryVariables>(HomeDocument, options);
        }
export function useHomeSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<HomeQuery, HomeQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<HomeQuery, HomeQueryVariables>(HomeDocument, options);
        }
export type HomeQueryHookResult = ReturnType<typeof useHomeQuery>;
export type HomeLazyQueryHookResult = ReturnType<typeof useHomeLazyQuery>;
export type HomeSuspenseQueryHookResult = ReturnType<typeof useHomeSuspenseQuery>;
export type HomeQueryResult = Apollo.QueryResult<HomeQuery, HomeQueryVariables>;
export const HomeByIdDocument = gql`
    query HomeById($id: ID!) {
  home(id: $id) {
    id
    name
    ownerId
    defaultPantry {
      id
    }
    createdAt
    updatedAt
  }
}
    `;

/**
 * __useHomeByIdQuery__
 *
 * To run a query within a React component, call `useHomeByIdQuery` and pass it any options that fit your needs.
 * When your component renders, `useHomeByIdQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHomeByIdQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useHomeByIdQuery(baseOptions: Apollo.QueryHookOptions<HomeByIdQuery, HomeByIdQueryVariables> & ({ variables: HomeByIdQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<HomeByIdQuery, HomeByIdQueryVariables>(HomeByIdDocument, options);
      }
export function useHomeByIdLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<HomeByIdQuery, HomeByIdQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<HomeByIdQuery, HomeByIdQueryVariables>(HomeByIdDocument, options);
        }
export function useHomeByIdSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<HomeByIdQuery, HomeByIdQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<HomeByIdQuery, HomeByIdQueryVariables>(HomeByIdDocument, options);
        }
export type HomeByIdQueryHookResult = ReturnType<typeof useHomeByIdQuery>;
export type HomeByIdLazyQueryHookResult = ReturnType<typeof useHomeByIdLazyQuery>;
export type HomeByIdSuspenseQueryHookResult = ReturnType<typeof useHomeByIdSuspenseQuery>;
export type HomeByIdQueryResult = Apollo.QueryResult<HomeByIdQuery, HomeByIdQueryVariables>;
export const HomesDocument = gql`
    query Homes {
  homes {
    id
    name
    ownerId
    defaultPantry {
      id
    }
    createdAt
    updatedAt
  }
}
    `;

/**
 * __useHomesQuery__
 *
 * To run a query within a React component, call `useHomesQuery` and pass it any options that fit your needs.
 * When your component renders, `useHomesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHomesQuery({
 *   variables: {
 *   },
 * });
 */
export function useHomesQuery(baseOptions?: Apollo.QueryHookOptions<HomesQuery, HomesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<HomesQuery, HomesQueryVariables>(HomesDocument, options);
      }
export function useHomesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<HomesQuery, HomesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<HomesQuery, HomesQueryVariables>(HomesDocument, options);
        }
export function useHomesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<HomesQuery, HomesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<HomesQuery, HomesQueryVariables>(HomesDocument, options);
        }
export type HomesQueryHookResult = ReturnType<typeof useHomesQuery>;
export type HomesLazyQueryHookResult = ReturnType<typeof useHomesLazyQuery>;
export type HomesSuspenseQueryHookResult = ReturnType<typeof useHomesSuspenseQuery>;
export type HomesQueryResult = Apollo.QueryResult<HomesQuery, HomesQueryVariables>;
export const ItemsDocument = gql`
    query Items($filter: ItemFilterInput, $offset: Int, $limit: Int) {
  items(filter: $filter, offset: $offset, limit: $limit) {
    items {
      id
      fdcId
      name
      dataType
      barcode
      aisle
      storageState
      imageUrl
      shelfLifeDays
      popularityCount
      tags
      status
      visibility
      showInOnboarding
      units {
        id
        isDefault
        conversionFactor
        notes
      }
      brands {
        name
        id
      }
      categories {
        name
        id
      }
      nutritions
      marketCountry
      publishedDate
      modifiedDate
      foodCategory
      servingSize
      servingSizeUnit
      healthBenefits
      metadata
      createdBy {
        id
      }
      updatedBy {
        id
      }
      createdAt
      updatedAt
      deletedAt
      version
    }
    totalCount
  }
}
    `;

/**
 * __useItemsQuery__
 *
 * To run a query within a React component, call `useItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useItemsQuery({
 *   variables: {
 *      filter: // value for 'filter'
 *      offset: // value for 'offset'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useItemsQuery(baseOptions?: Apollo.QueryHookOptions<ItemsQuery, ItemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ItemsQuery, ItemsQueryVariables>(ItemsDocument, options);
      }
export function useItemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ItemsQuery, ItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ItemsQuery, ItemsQueryVariables>(ItemsDocument, options);
        }
export function useItemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ItemsQuery, ItemsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ItemsQuery, ItemsQueryVariables>(ItemsDocument, options);
        }
export type ItemsQueryHookResult = ReturnType<typeof useItemsQuery>;
export type ItemsLazyQueryHookResult = ReturnType<typeof useItemsLazyQuery>;
export type ItemsSuspenseQueryHookResult = ReturnType<typeof useItemsSuspenseQuery>;
export type ItemsQueryResult = Apollo.QueryResult<ItemsQuery, ItemsQueryVariables>;
export const AutocompleteItemsDocument = gql`
    query AutocompleteItems($name: String!) {
  autocompleteItems(name: $name) {
    id
    name
  }
}
    `;

/**
 * __useAutocompleteItemsQuery__
 *
 * To run a query within a React component, call `useAutocompleteItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAutocompleteItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAutocompleteItemsQuery({
 *   variables: {
 *      name: // value for 'name'
 *   },
 * });
 */
export function useAutocompleteItemsQuery(baseOptions: Apollo.QueryHookOptions<AutocompleteItemsQuery, AutocompleteItemsQueryVariables> & ({ variables: AutocompleteItemsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>(AutocompleteItemsDocument, options);
      }
export function useAutocompleteItemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>(AutocompleteItemsDocument, options);
        }
export function useAutocompleteItemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>(AutocompleteItemsDocument, options);
        }
export type AutocompleteItemsQueryHookResult = ReturnType<typeof useAutocompleteItemsQuery>;
export type AutocompleteItemsLazyQueryHookResult = ReturnType<typeof useAutocompleteItemsLazyQuery>;
export type AutocompleteItemsSuspenseQueryHookResult = ReturnType<typeof useAutocompleteItemsSuspenseQuery>;
export type AutocompleteItemsQueryResult = Apollo.QueryResult<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>;
export const PantriesDocument = gql`
    query Pantries($homeId: ID!) {
  pantries(homeId: $homeId) {
    id
    homeId
    name
    version
    createdAt
    updatedAt
    deletedAt
    items {
      itemId
      unit {
        symbol
        name
      }
      item {
        name
        status
        storageState
      }
      storageState
      expiresAt
      id
      grams
    }
  }
}
    `;

/**
 * __usePantriesQuery__
 *
 * To run a query within a React component, call `usePantriesQuery` and pass it any options that fit your needs.
 * When your component renders, `usePantriesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePantriesQuery({
 *   variables: {
 *      homeId: // value for 'homeId'
 *   },
 * });
 */
export function usePantriesQuery(baseOptions: Apollo.QueryHookOptions<PantriesQuery, PantriesQueryVariables> & ({ variables: PantriesQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PantriesQuery, PantriesQueryVariables>(PantriesDocument, options);
      }
export function usePantriesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PantriesQuery, PantriesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PantriesQuery, PantriesQueryVariables>(PantriesDocument, options);
        }
export function usePantriesSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<PantriesQuery, PantriesQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<PantriesQuery, PantriesQueryVariables>(PantriesDocument, options);
        }
export type PantriesQueryHookResult = ReturnType<typeof usePantriesQuery>;
export type PantriesLazyQueryHookResult = ReturnType<typeof usePantriesLazyQuery>;
export type PantriesSuspenseQueryHookResult = ReturnType<typeof usePantriesSuspenseQuery>;
export type PantriesQueryResult = Apollo.QueryResult<PantriesQuery, PantriesQueryVariables>;
export const PantryItemsDocument = gql`
    query PantryItems($pantryId: ID!) {
  pantryItems(pantryId: $pantryId) {
    id
    pantryId
    itemId
    unitId
    quantity
    grams
    addedAt
    lastUsedAt
    expiresAt
    storageState
    version
    item {
      id
    }
    unit {
      symbol
      name
    }
  }
}
    `;

/**
 * __usePantryItemsQuery__
 *
 * To run a query within a React component, call `usePantryItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `usePantryItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePantryItemsQuery({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *   },
 * });
 */
export function usePantryItemsQuery(baseOptions: Apollo.QueryHookOptions<PantryItemsQuery, PantryItemsQueryVariables> & ({ variables: PantryItemsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PantryItemsQuery, PantryItemsQueryVariables>(PantryItemsDocument, options);
      }
export function usePantryItemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PantryItemsQuery, PantryItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PantryItemsQuery, PantryItemsQueryVariables>(PantryItemsDocument, options);
        }
export function usePantryItemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<PantryItemsQuery, PantryItemsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<PantryItemsQuery, PantryItemsQueryVariables>(PantryItemsDocument, options);
        }
export type PantryItemsQueryHookResult = ReturnType<typeof usePantryItemsQuery>;
export type PantryItemsLazyQueryHookResult = ReturnType<typeof usePantryItemsLazyQuery>;
export type PantryItemsSuspenseQueryHookResult = ReturnType<typeof usePantryItemsSuspenseQuery>;
export type PantryItemsQueryResult = Apollo.QueryResult<PantryItemsQuery, PantryItemsQueryVariables>;
export const OnBoardingPantryItemsDocument = gql`
    query OnBoardingPantryItems {
  onBoardingPantryItems {
    id
    imageUrl
    name
    units {
      id
    }
  }
}
    `;

/**
 * __useOnBoardingPantryItemsQuery__
 *
 * To run a query within a React component, call `useOnBoardingPantryItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useOnBoardingPantryItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useOnBoardingPantryItemsQuery({
 *   variables: {
 *   },
 * });
 */
export function useOnBoardingPantryItemsQuery(baseOptions?: Apollo.QueryHookOptions<OnBoardingPantryItemsQuery, OnBoardingPantryItemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<OnBoardingPantryItemsQuery, OnBoardingPantryItemsQueryVariables>(OnBoardingPantryItemsDocument, options);
      }
export function useOnBoardingPantryItemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<OnBoardingPantryItemsQuery, OnBoardingPantryItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<OnBoardingPantryItemsQuery, OnBoardingPantryItemsQueryVariables>(OnBoardingPantryItemsDocument, options);
        }
export function useOnBoardingPantryItemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<OnBoardingPantryItemsQuery, OnBoardingPantryItemsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<OnBoardingPantryItemsQuery, OnBoardingPantryItemsQueryVariables>(OnBoardingPantryItemsDocument, options);
        }
export type OnBoardingPantryItemsQueryHookResult = ReturnType<typeof useOnBoardingPantryItemsQuery>;
export type OnBoardingPantryItemsLazyQueryHookResult = ReturnType<typeof useOnBoardingPantryItemsLazyQuery>;
export type OnBoardingPantryItemsSuspenseQueryHookResult = ReturnType<typeof useOnBoardingPantryItemsSuspenseQuery>;
export type OnBoardingPantryItemsQueryResult = Apollo.QueryResult<OnBoardingPantryItemsQuery, OnBoardingPantryItemsQueryVariables>;
export const UserProfileDocument = gql`
    query UserProfile {
  userProfile {
    id
    userId
    firstName
    lastName
    avatarUrl
    phone
    dateOfBirth
    createdAt
    updatedAt
  }
}
    `;

/**
 * __useUserProfileQuery__
 *
 * To run a query within a React component, call `useUserProfileQuery` and pass it any options that fit your needs.
 * When your component renders, `useUserProfileQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useUserProfileQuery({
 *   variables: {
 *   },
 * });
 */
export function useUserProfileQuery(baseOptions?: Apollo.QueryHookOptions<UserProfileQuery, UserProfileQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<UserProfileQuery, UserProfileQueryVariables>(UserProfileDocument, options);
      }
export function useUserProfileLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<UserProfileQuery, UserProfileQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<UserProfileQuery, UserProfileQueryVariables>(UserProfileDocument, options);
        }
export function useUserProfileSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<UserProfileQuery, UserProfileQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<UserProfileQuery, UserProfileQueryVariables>(UserProfileDocument, options);
        }
export type UserProfileQueryHookResult = ReturnType<typeof useUserProfileQuery>;
export type UserProfileLazyQueryHookResult = ReturnType<typeof useUserProfileLazyQuery>;
export type UserProfileSuspenseQueryHookResult = ReturnType<typeof useUserProfileSuspenseQuery>;
export type UserProfileQueryResult = Apollo.QueryResult<UserProfileQuery, UserProfileQueryVariables>;
export const ShoppingListsDocument = gql`
    query ShoppingLists {
  shoppingLists {
    id
    name
    owner {
      email
      id
    }
    isDefault
    tags
    createdAt
    updatedAt
  }
}
    `;

/**
 * __useShoppingListsQuery__
 *
 * To run a query within a React component, call `useShoppingListsQuery` and pass it any options that fit your needs.
 * When your component renders, `useShoppingListsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useShoppingListsQuery({
 *   variables: {
 *   },
 * });
 */
export function useShoppingListsQuery(baseOptions?: Apollo.QueryHookOptions<ShoppingListsQuery, ShoppingListsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ShoppingListsQuery, ShoppingListsQueryVariables>(ShoppingListsDocument, options);
      }
export function useShoppingListsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ShoppingListsQuery, ShoppingListsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ShoppingListsQuery, ShoppingListsQueryVariables>(ShoppingListsDocument, options);
        }
export function useShoppingListsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ShoppingListsQuery, ShoppingListsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ShoppingListsQuery, ShoppingListsQueryVariables>(ShoppingListsDocument, options);
        }
export type ShoppingListsQueryHookResult = ReturnType<typeof useShoppingListsQuery>;
export type ShoppingListsLazyQueryHookResult = ReturnType<typeof useShoppingListsLazyQuery>;
export type ShoppingListsSuspenseQueryHookResult = ReturnType<typeof useShoppingListsSuspenseQuery>;
export type ShoppingListsQueryResult = Apollo.QueryResult<ShoppingListsQuery, ShoppingListsQueryVariables>;
export const ShoppingListItemsDocument = gql`
    query ShoppingListItems($shoppingListId: ID!) {
  shoppingListItems(shoppingListId: $shoppingListId) {
    id
    label
    quantity
    itemName
    unitSymbol
    isPurchased
    createdAt
    updatedAt
    item {
      imageUrl
    }
  }
}
    `;

/**
 * __useShoppingListItemsQuery__
 *
 * To run a query within a React component, call `useShoppingListItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useShoppingListItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useShoppingListItemsQuery({
 *   variables: {
 *      shoppingListId: // value for 'shoppingListId'
 *   },
 * });
 */
export function useShoppingListItemsQuery(baseOptions: Apollo.QueryHookOptions<ShoppingListItemsQuery, ShoppingListItemsQueryVariables> & ({ variables: ShoppingListItemsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<ShoppingListItemsQuery, ShoppingListItemsQueryVariables>(ShoppingListItemsDocument, options);
      }
export function useShoppingListItemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<ShoppingListItemsQuery, ShoppingListItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<ShoppingListItemsQuery, ShoppingListItemsQueryVariables>(ShoppingListItemsDocument, options);
        }
export function useShoppingListItemsSuspenseQuery(baseOptions?: Apollo.SkipToken | Apollo.SuspenseQueryHookOptions<ShoppingListItemsQuery, ShoppingListItemsQueryVariables>) {
          const options = baseOptions === Apollo.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return Apollo.useSuspenseQuery<ShoppingListItemsQuery, ShoppingListItemsQueryVariables>(ShoppingListItemsDocument, options);
        }
export type ShoppingListItemsQueryHookResult = ReturnType<typeof useShoppingListItemsQuery>;
export type ShoppingListItemsLazyQueryHookResult = ReturnType<typeof useShoppingListItemsLazyQuery>;
export type ShoppingListItemsSuspenseQueryHookResult = ReturnType<typeof useShoppingListItemsSuspenseQuery>;
export type ShoppingListItemsQueryResult = Apollo.QueryResult<ShoppingListItemsQuery, ShoppingListItemsQueryVariables>;
export const ShoppingListUpdatedDocument = gql`
    subscription ShoppingListUpdated($listId: ID!) {
  shoppingListUpdated(listId: $listId) {
    id
    shoppingListId
    label
    quantity
    itemName
    unitSymbol
    isPurchased
    createdAt
    updatedAt
  }
}
    `;

/**
 * __useShoppingListUpdatedSubscription__
 *
 * To run a query within a React component, call `useShoppingListUpdatedSubscription` and pass it any options that fit your needs.
 * When your component renders, `useShoppingListUpdatedSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useShoppingListUpdatedSubscription({
 *   variables: {
 *      listId: // value for 'listId'
 *   },
 * });
 */
export function useShoppingListUpdatedSubscription(baseOptions: Apollo.SubscriptionHookOptions<ShoppingListUpdatedSubscription, ShoppingListUpdatedSubscriptionVariables> & ({ variables: ShoppingListUpdatedSubscriptionVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<ShoppingListUpdatedSubscription, ShoppingListUpdatedSubscriptionVariables>(ShoppingListUpdatedDocument, options);
      }
export type ShoppingListUpdatedSubscriptionHookResult = ReturnType<typeof useShoppingListUpdatedSubscription>;
export type ShoppingListUpdatedSubscriptionResult = Apollo.SubscriptionResult<ShoppingListUpdatedSubscription>;