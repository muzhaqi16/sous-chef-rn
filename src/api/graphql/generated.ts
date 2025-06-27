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

export type AddItemToPantryInput = {
  itemId: Scalars['ID']['input'];
};

export type AuthPayload = {
  __typename?: 'AuthPayload';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
  user: User;
};

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

export type Category = {
  __typename?: 'Category';
  children: Array<Category>;
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  parent?: Maybe<Category>;
  updatedAt: Scalars['DateTime']['output'];
  version: Scalars['Int']['output'];
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

export type CreatePantryItemInput = {
  expirationDate?: InputMaybe<Scalars['DateTime']['input']>;
  itemId: Scalars['ID']['input'];
  itemName: Scalars['String']['input'];
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  quantity: Scalars['Float']['input'];
  storageState?: InputMaybe<StorageState>;
  unitId: Scalars['ID']['input'];
  unitSymbol: Scalars['String']['input'];
};

export type CreateShoppingListInput = {
  isDefault?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateUpdateItemInput = {
  aisle?: InputMaybe<Scalars['String']['input']>;
  barcode?: InputMaybe<Scalars['String']['input']>;
  categoryIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  description?: InputMaybe<Scalars['String']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  shelfLifeDays?: InputMaybe<Scalars['Int']['input']>;
  showInOnboarding?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<ItemStatus>;
  storageState: StorageState;
  tags?: InputMaybe<Array<Scalars['String']['input']>>;
  unitId?: InputMaybe<Scalars['ID']['input']>;
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

export type Item = {
  __typename?: 'Item';
  aisle?: Maybe<Scalars['String']['output']>;
  barcode?: Maybe<Scalars['String']['output']>;
  categories?: Maybe<Array<Category>>;
  createdAt: Scalars['DateTime']['output'];
  createdBy?: Maybe<User>;
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  popularityCount: Scalars['Int']['output'];
  shelfLifeDays?: Maybe<Scalars['Int']['output']>;
  showInOnboarding: Scalars['Boolean']['output'];
  skus?: Maybe<Array<ItemStoreSku>>;
  status: ItemStatus;
  storageState: StorageState;
  tags: Array<Scalars['String']['output']>;
  unit?: Maybe<Unit>;
  updatedAt: Scalars['DateTime']['output'];
  updatedBy?: Maybe<User>;
  version: Scalars['Int']['output'];
  visibility: Visibility;
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

export type Mutation = {
  __typename?: 'Mutation';
  _empty?: Maybe<Scalars['String']['output']>;
  addCollaborator: ShoppingListCollaborator;
  addItemToPantry: PantryItem;
  addItemToShoppingList: ShoppingListItem;
  addUserAddress: UserAddress;
  createBrand: Brand;
  createCategory: Category;
  createCurrency: Currency;
  createItem: Item;
  createNotification: Notification;
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
  deletePantryItem: PantryItem;
  deletePurchase: Purchase;
  deleteShoppingList: ShoppingList;
  deleteStore: Store;
  deleteUnit: Unit;
  deleteUser: User;
  deleteUserAddress: UserAddress;
  forgotPassword: Scalars['Boolean']['output'];
  login: AuthPayload;
  markItemPurchased: ShoppingListItem;
  markNotificationRead: Notification;
  register: AuthPayload;
  removeCollaborator: ShoppingListCollaborator;
  removeItemFromShoppingList: Scalars['Boolean']['output'];
  resetPassword: Scalars['Boolean']['output'];
  shareShoppingList: ShoppingList;
  unshareShoppingList: ShoppingList;
  updateBrand: Brand;
  updateCategory: Category;
  updateCurrency: Currency;
  updateItem: Item;
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
};


export type MutationAddCollaboratorArgs = {
  data: AddCollaboratorInput;
};


export type MutationAddItemToPantryArgs = {
  input: AddItemToPantryInput;
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


export type MutationCreateItemArgs = {
  data: CreateUpdateItemInput;
};


export type MutationCreateNotificationArgs = {
  payload: Scalars['JSON']['input'];
  status?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
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


export type MutationResetPasswordArgs = {
  password: Scalars['String']['input'];
  token: Scalars['String']['input'];
};


export type MutationShareShoppingListArgs = {
  listId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationUnshareShoppingListArgs = {
  listId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
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


export type MutationUpdateItemArgs = {
  data: CreateUpdateItemInput;
  id: Scalars['ID']['input'];
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
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  sharedWith?: InputMaybe<Array<Scalars['ID']['input']>>;
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

export type PantryItem = {
  __typename?: 'PantryItem';
  addedDate: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  expirationDate?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  item: PantryItemEmbeddedItem;
  itemId: Scalars['ID']['output'];
  itemName: Scalars['String']['output'];
  lastUsedAt?: Maybe<Scalars['DateTime']['output']>;
  quantity: Scalars['Float']['output'];
  storageState?: Maybe<StorageState>;
  unit: PantryItemEmbeddedUnit;
  unitId: Scalars['ID']['output'];
  unitSymbol: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

export type PantryItemEmbeddedItem = {
  __typename?: 'PantryItemEmbeddedItem';
  id: Scalars['ID']['output'];
  imageUrl?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  storageState: StorageState;
};

export type PantryItemEmbeddedUnit = {
  __typename?: 'PantryItemEmbeddedUnit';
  id: Scalars['ID']['output'];
  symbol: Scalars['String']['output'];
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
  item?: Maybe<Item>;
  itemByBarcode?: Maybe<Item>;
  itemByName?: Maybe<Item>;
  items?: Maybe<PaginatedItems>;
  itemsByIds?: Maybe<Array<Item>>;
  loginHistory?: Maybe<Array<LoginHistory>>;
  me?: Maybe<User>;
  notificationsByUser: Array<Notification>;
  onBoardingPantryItems: Array<Item>;
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
  id: Scalars['ID']['output'];
  isDefault: Scalars['Boolean']['output'];
  items?: Maybe<Array<ShoppingListItem>>;
  name: Scalars['String']['output'];
  owner: User;
  tags?: Maybe<Array<Scalars['String']['output']>>;
  updatedAt: Scalars['DateTime']['output'];
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

export type Unit = {
  __typename?: 'Unit';
  conversionFactor: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  symbol: Scalars['String']['output'];
  type: UnitType;
};

export enum UnitType {
  Count = 'COUNT',
  Length = 'LENGTH',
  Mass = 'MASS',
  Volume = 'VOLUME'
}

export type UpdatePantryItemInput = {
  expirationDate?: InputMaybe<Scalars['DateTime']['input']>;
  id: Scalars['ID']['input'];
  itemName?: InputMaybe<Scalars['String']['input']>;
  lastUsedAt?: InputMaybe<Scalars['DateTime']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  storageState?: InputMaybe<StorageState>;
  unitSymbol?: InputMaybe<Scalars['String']['input']>;
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
  id: Scalars['ID']['output'];
  moderation?: Maybe<UserModeration>;
  notifications?: Maybe<Array<Notification>>;
  pantryItems?: Maybe<Array<PantryItem>>;
  profile?: Maybe<UserProfile>;
  purchases?: Maybe<Array<Purchase>>;
  role: Role;
  shoppingLists?: Maybe<Array<ShoppingList>>;
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
  id: Scalars['ID']['output'];
  isBanned: Scalars['Boolean']['output'];
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


export type LoginMutation = { __typename?: 'Mutation', login: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string, user: { __typename?: 'User', email: string, id: string, role: Role, profile?: { __typename?: 'UserProfile', firstName?: string | null } | null } } };

export type RegisterMutationVariables = Exact<{
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
}>;


export type RegisterMutation = { __typename?: 'Mutation', register: { __typename?: 'AuthPayload', accessToken: string, refreshToken: string, user: { __typename?: 'User', id: string, email: string, role: Role, profile?: { __typename?: 'UserProfile', firstName?: string | null } | null } } };

export type ForgotPasswordMutationVariables = Exact<{
  email: Scalars['String']['input'];
}>;


export type ForgotPasswordMutation = { __typename?: 'Mutation', forgotPassword: boolean };

export type ResetPasswordMutationVariables = Exact<{
  token: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type ResetPasswordMutation = { __typename?: 'Mutation', resetPassword: boolean };

export type AddItemToPantryMutationVariables = Exact<{
  input: AddItemToPantryInput;
}>;


export type AddItemToPantryMutation = { __typename?: 'Mutation', addItemToPantry: { __typename?: 'PantryItem', id: string, itemId: string, quantity: number, unitId: string, itemName: string, unitSymbol: string, addedDate: any, lastUsedAt?: any | null, expirationDate?: any | null, storageState?: StorageState | null, deletedAt?: any | null, version: number } };

export type UpdateUserProfileMutationVariables = Exact<{
  data: UpdateUserSettingsInput;
}>;


export type UpdateUserProfileMutation = { __typename?: 'Mutation', updateUserProfile?: { __typename?: 'UserProfile', id: string, firstName?: string | null, lastName?: string | null, avatarUrl?: string | null, phone?: string | null, dateOfBirth?: any | null } | null };

export type CreateShoppingListMutationVariables = Exact<{
  data: CreateShoppingListInput;
}>;


export type CreateShoppingListMutation = { __typename?: 'Mutation', createShoppingList: { __typename?: 'ShoppingList', id: string, name: string, isDefault: boolean, tags?: Array<string> | null, createdAt: any, updatedAt: any, owner: { __typename?: 'User', email: string, id: string } } };

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

export type ItemsQueryVariables = Exact<{
  filter?: InputMaybe<ItemFilterInput>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type ItemsQuery = { __typename?: 'Query', items?: { __typename?: 'PaginatedItems', totalCount: number, items: Array<{ __typename?: 'Item', id: string, name: string, description?: string | null, barcode?: string | null, aisle?: string | null, storageState: StorageState, imageUrl?: string | null, shelfLifeDays?: number | null, popularityCount: number, tags: Array<string>, status: ItemStatus, visibility: Visibility, showInOnboarding: boolean, updatedAt: any, deletedAt?: any | null, version: number, unit?: { __typename?: 'Unit', conversionFactor: number, id: string, name: string, symbol: string, type: UnitType } | null, categories?: Array<{ __typename?: 'Category', name: string }> | null, skus?: Array<{ __typename?: 'ItemStoreSku', sku: string }> | null }> } | null };

export type AutocompleteItemsQueryVariables = Exact<{
  name: Scalars['String']['input'];
}>;


export type AutocompleteItemsQuery = { __typename?: 'Query', autocompleteItems?: Array<{ __typename?: 'ItemSuggestion', id: string, name: string }> | null };

export type PantryItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type PantryItemsQuery = { __typename?: 'Query', pantryItems: Array<{ __typename?: 'PantryItem', id: string, itemId: string, quantity: number, unitId: string, itemName: string, unitSymbol: string, addedDate: any, lastUsedAt?: any | null, expirationDate?: any | null, storageState?: StorageState | null, deletedAt?: any | null, version: number }> };

export type OnBoardingPantryItemsQueryVariables = Exact<{ [key: string]: never; }>;


export type OnBoardingPantryItemsQuery = { __typename?: 'Query', onBoardingPantryItems: Array<{ __typename?: 'Item', id: string, name: string, imageUrl?: string | null }> };

export type UserProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type UserProfileQuery = { __typename?: 'Query', userProfile?: { __typename?: 'UserProfile', id: string, userId: string, firstName?: string | null, lastName?: string | null, avatarUrl?: string | null, phone?: string | null, dateOfBirth?: any | null, createdAt: any, updatedAt: any } | null };

export type ShoppingListsQueryVariables = Exact<{ [key: string]: never; }>;


export type ShoppingListsQuery = { __typename?: 'Query', shoppingLists: Array<{ __typename?: 'ShoppingList', id: string, name: string, isDefault: boolean, tags?: Array<string> | null, createdAt: any, updatedAt: any, owner: { __typename?: 'User', email: string, id: string } }> };

export type ShoppingListItemsQueryVariables = Exact<{
  shoppingListId: Scalars['ID']['input'];
}>;


export type ShoppingListItemsQuery = { __typename?: 'Query', shoppingListItems: Array<{ __typename?: 'ShoppingListItem', id: string, label?: string | null, quantity?: number | null, itemName?: string | null, unitSymbol?: string | null, isPurchased: boolean, createdAt: any, updatedAt: any, item?: { __typename?: 'Item', imageUrl?: string | null } | null }> };


export const LoginDocument = gql`
    mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    accessToken
    refreshToken
    user {
      email
      id
      role
      profile {
        firstName
      }
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
      profile {
        firstName
      }
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
export const AddItemToPantryDocument = gql`
    mutation AddItemToPantry($input: AddItemToPantryInput!) {
  addItemToPantry(input: $input) {
    id
    itemId
    quantity
    unitId
    itemName
    unitSymbol
    addedDate
    lastUsedAt
    expirationDate
    storageState
    deletedAt
    version
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
    isDefault
    tags
    createdAt
    updatedAt
    owner {
      email
      id
    }
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
export const ItemsDocument = gql`
    query Items($filter: ItemFilterInput, $limit: Int, $offset: Int) {
  items(filter: $filter, limit: $limit, offset: $offset) {
    totalCount
    items {
      id
      name
      description
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
      unit {
        conversionFactor
        id
        name
        symbol
        type
      }
      categories {
        name
      }
      skus {
        sku
      }
      updatedAt
      deletedAt
      version
    }
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
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
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
export const PantryItemsDocument = gql`
    query PantryItems {
  pantryItems {
    id
    itemId
    quantity
    unitId
    itemName
    unitSymbol
    addedDate
    lastUsedAt
    expirationDate
    storageState
    deletedAt
    version
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
 *   },
 * });
 */
export function usePantryItemsQuery(baseOptions?: Apollo.QueryHookOptions<PantryItemsQuery, PantryItemsQueryVariables>) {
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
    name
    imageUrl
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