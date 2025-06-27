export {createItemsSlice} from './itemsSlice';
export {createShoppingListSlice} from './shoppingListSlice';
export {createAuthSlice} from './authSlice';
export {createProfileSlice} from './profileSlice';
export {createPreferencesSlice} from './preferencesSlice';
export {createPantrySlice} from './pantrySlice';
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
import {initialProfileState, type ProfileState} from './profileSlice';

export const initialStoreState = {
  ...initialAuthState,
  ...initialItemsState,
  ...initialPantryListState,
  ...initialPreferencesState,
  ...initialProfileState,
  ...initialShoppingListState,
};

export type RootState = ShoppingListState &
  AuthState &
  ProfileState &
  PreferencesState &
  PantryState &
  ItemsState & {
    // our hydration slice
    isHydrated: boolean;
    setHydrated: (flag: boolean) => void;
    reset: () => void;
  };
