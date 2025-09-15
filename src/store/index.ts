export {createItemsSlice} from './itemsSlice';
export {createShoppingListSlice} from './shoppingListSlice';
export {createAuthSlice} from './authSlice';
export {createProfileSlice} from './profileSlice';
export {createPreferencesSlice} from './preferencesSlice';
export {createPantrySlice} from './pantrySlice';
export {createAppSlice} from './appSlice';
export {createShoppingListItemSlice} from './shoppingListItemSlice';
import {initialPantryListState, type PantryState} from './pantrySlice';
import {
  initialPreferencesState,
  type PreferencesState,
} from './preferencesSlice';
import {initialAuthState, type AuthState} from './authSlice';
import {initialItemsState, type ItemsState} from './itemsSlice';
import {
  initialShoppingListState,
  type ShoppingListState,
} from './shoppingListSlice';
import {initialAppState, type AppState} from './appSlice';
import {initialProfileState, type ProfileState} from './profileSlice';
import {
  ShoppingListItemState,
  initialShoppingListItemState,
} from './shoppingListItemSlice';

export const initialStoreState = {
  ...initialAuthState,
  ...initialItemsState,
  ...initialPantryListState,
  ...initialPreferencesState,
  ...initialProfileState,
  ...initialShoppingListState,
  ...initialAppState,
  ...initialShoppingListItemState,
};

export type RootState = ShoppingListState &
  AuthState &
  ProfileState &
  PreferencesState &
  PantryState &
  ItemsState &
  ShoppingListItemState &
  AppState;
