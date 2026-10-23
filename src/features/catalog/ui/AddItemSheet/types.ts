import type { RefObject } from 'react';
import type { BottomSheetModalRef } from '#hooks/ui/useStandardBottomSheet';
import type { SearchBarRef } from '#components/molecules/SearchBar';
import type { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import type { TranslationKey } from '#/i18n';
import type {
  BaseSuggestionItem,
  SuggestionsHookResult,
} from '#features/catalog/types';

export interface SuggestionGroupConfig<
  T extends BaseSuggestionItem = BaseSuggestionItem,
> {
  key: string;
  titleKey: TranslationKey;
  accessor: (grouped: Record<string, T[]>) => T[];
  /** Lower renders first. */
  priority: number;
  /**
   * Shows a ✕ on each row. Only valid for sources the API can suppress (Add
   * Again / Favorites / Popular), not Low Stock / Expiring Soon.
   */
  dismissible?: boolean;
}

export interface QuickAddConfig {
  /** Toast without awaiting the mutation. */
  fireAndForget: boolean;
  enableExitAnimations: boolean;
  /** Interpolates `{{name}}`. */
  toastMessageKey: TranslationKey;
}

export interface AddDetailsConfig {
  /** Shows the "Add Manually" affordance. */
  enabled: boolean;
}

export interface AddItemSheetConfig<
  T extends BaseSuggestionItem = BaseSuggestionItem,
> {
  /**
   * Every user-facing string on this config is an i18n KEY, resolved by
   * `AddItemSheet` at render: these configs are module-level constants, so a
   * `t()` here would freeze the copy in the bootstrap language.
   */
  titleKey: TranslationKey;
  testIDPrefix: string;
  placeholderIcon: 'cube-outline' | 'cart-outline';
  searchPlaceholderKey: TranslationKey;
  suggestionGroups: SuggestionGroupConfig<T>[];
  quickAdd: QuickAddConfig;
  addDetails: AddDetailsConfig;
  /** Defer the query past the sheet's open animation (a frame, then idle). */
  deferFetch: boolean;
  barcodeSource: 'pantry' | 'shoppingList';
  addManuallyPosition: 'top' | 'bottom';
  emptyStateMessageKey: TranslationKey;
  emptyStateSubtextKey: TranslationKey;
}

export interface AddItemSheetProps<
  T extends BaseSuggestionItem = BaseSuggestionItem,
> {
  visible: boolean;
  /** pantryId or shoppingListId. */
  contextId: string | undefined;
  onClose: () => void;
  config: AddItemSheetConfig<T>;
  suggestions: SuggestionsHookResult<T>;
  onQuickAddSearchSuggestion: (item: ItemSuggestion) => void;
  onQuickAddSuggestion: (item: T) => void;
  /** Hides the suggestion from this surface. */
  onDismissSuggestion?: (item: T) => void;
  isMutating: boolean;
  onAddManually: (searchValue: string) => void;
  /**
   * The step the sheet opens on. `details` is the + menu's "Add manually": the
   * sheet opens on the form, after asking `onAddManually('')` to prep it.
   */
  startStep?: 'search' | 'details';
  exitingItems?: Set<string>;
  onExitComplete?: (itemId: string) => void;
  shouldFetch?: boolean;
  initialSearchQuery?: string;
  bottomSheetRef?: RefObject<BottomSheetModalRef>;
  searchBarRef?: RefObject<SearchBarRef>;
  /** Defaults to true. */
  showImages?: boolean;
  /** Rendered above the action buttons. */
  tutorialHint?: React.ReactNode;
  /**
   * Renders the "details" step IN PLACE in this sheet: one BottomSheetModal,
   * one backdrop, no stacking. The consumer still gets
   * `onAddManually(searchValue)` first, to prep the form's inputs.
   */
  renderDetails?: (controls: { goBack: () => void }) => React.ReactNode;
}

export interface AddItemSheetState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Deferred until after the sheet's open animation. */
  shouldFetch: boolean;
  shouldRenderSuggestions: boolean;
  exitingItems: Set<string>;
  startExitAnimation: (itemId: string) => void;
  completeExitAnimation: (itemId: string) => void;
}
