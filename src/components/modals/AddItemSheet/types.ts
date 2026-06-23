import type { RefObject } from 'react';
import type { BottomSheetModalRef } from '#hooks/useStandardBottomSheet';
import type { BottomSheetSearchBarRef } from '#components/molecules/BottomSheetSearchBar';
import { type ItemSuggestion } from '#/graphql/generated/schemaTypes';

/**
 * Base interface for suggestion items that can be displayed in the sheet.
 * Both pantry and shopping list suggestions must have these fields.
 */
export interface BaseSuggestionItem {
  id: string;
  itemId: string;
  name: string;
  category?: string | null | undefined;
  imageUrl?: string | null | undefined;
}

/**
 * Configuration for a suggestion group/section in the sheet.
 * Parameterized over the concrete suggestion type so wrapper components
 * (AddToPantrySheet, AddToShoppingListSheet) preserve their entity shape.
 */
export interface SuggestionGroupConfig<
  T extends BaseSuggestionItem = BaseSuggestionItem,
> {
  /** Unique key for this group */
  key: string;
  /** i18n key for the section title (e.g. `addItemSheet.sections.lowStock`).
   *  Resolved via `t()` at render so the overview header, the "More" affordance,
   *  and the drill-down header all show one translated, localizable label. */
  titleKey: string;
  /** Function to extract items from grouped data */
  accessor: (grouped: Record<string, T[]>) => T[];
  /** Priority order for display (lower = higher priority) */
  priority: number;
  /**
   * When true, rows in this section show a ✕ to dismiss the suggestion. Only
   * valid for sources the API can suppress (Add Again / Favorites / Popular) —
   * not Low Stock / Expiring Soon, which are alerts about items you own.
   */
  dismissible?: boolean;
}

/**
 * Quick add behavior configuration.
 */
export interface QuickAddConfig {
  /** If true, don't await mutation before showing toast (fire-and-forget) */
  fireAndForget: boolean;
  /** If true, enable exit animations on suggestion items */
  enableExitAnimations: boolean;
  /** Function to generate toast message */
  toastMessage: (name: string) => string;
}

/**
 * Add details sub-sheet configuration.
 */
export interface AddDetailsConfig {
  /** If true, show "Add Manually" navigation to details sheet */
  enabled: boolean;
}

/**
 * Main configuration object for AddItemSheet.
 */
export interface AddItemSheetConfig<
  T extends BaseSuggestionItem = BaseSuggestionItem,
> {
  /** Sheet title (e.g., "Add to Pantry", "Add to Shopping List") */
  title: string;
  /** Test ID prefix for testing */
  testIDPrefix: string;
  /** Icon for placeholder images */
  placeholderIcon: 'cube-outline' | 'cart-outline';
  /** Search bar placeholder text */
  searchPlaceholder: string;
  /** Suggestion groups to display */
  suggestionGroups: SuggestionGroupConfig<T>[];
  /** Quick add behavior configuration */
  quickAdd: QuickAddConfig;
  /** Add details sheet configuration */
  addDetails: AddDetailsConfig;
  /** If true, defer query fetch by 50ms to allow sheet animation */
  deferFetch: boolean;
  /** Barcode scanner source parameter */
  barcodeSource: 'pantry' | 'shoppingList';
  /** Position of "Add manually" option in search results */
  addManuallyPosition: 'top' | 'bottom';
  /** Empty state message when no suggestions */
  emptyStateMessage: string;
  /** Empty state subtext */
  emptyStateSubtext: string;
}

/**
 * Result from a suggestions hook (usePantryItemSuggestions or useShoppingListSuggestions).
 */
export interface SuggestionsHookResult<
  T extends BaseSuggestionItem = BaseSuggestionItem,
> {
  /** Grouped suggestions by category */
  grouped: Record<string, T[]>;
  /** Whether suggestions are loading */
  loading: boolean;
  /** Whether there are any suggestions to display */
  hasSuggestions: boolean;
  /** Function to refetch suggestions */
  refetch: () => void;
}

/**
 * Props for the generic AddItemSheet component.
 *
 * Parameterized over the concrete suggestion type so wrapper components
 * (AddToPantrySheet, AddToShoppingListSheet) keep their entity shape end-to-end
 * — no `as unknown as` casts needed at the callback boundary.
 */
export interface AddItemSheetProps<
  T extends BaseSuggestionItem = BaseSuggestionItem,
> {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Context ID (pantryId or shoppingListId) */
  contextId: string | undefined;
  /** Callback when sheet is closed */
  onClose: () => void;
  /** Configuration for this sheet instance */
  config: AddItemSheetConfig<T>;
  /** Suggestions hook result */
  suggestions: SuggestionsHookResult<T>;
  /** Handler for quick adding from search autocomplete */
  onQuickAddSearchSuggestion: (item: ItemSuggestion) => void;
  /** Handler for quick adding from suggestion list */
  onQuickAddSuggestion: (item: T) => void;
  /** Optional: Handler for dismissing a suggestion (hides it from this surface) */
  onDismissSuggestion?: (item: T) => void;
  /** Whether a mutation is currently in progress */
  isMutating: boolean;
  /** Handler for "Add manually" button */
  onAddManually: (searchValue: string) => void;
  /** Handler for barcode scan button */
  onScanPress: () => void;
  /** Optional: Items currently animating out (for exit animations) */
  exitingItems?: Set<string>;
  /** Optional: Callback when exit animation completes */
  onExitComplete?: (itemId: string) => void;
  /** Optional: Whether to use the deferred fetch state */
  shouldFetch?: boolean;
  /** Optional: Initial search query */
  initialSearchQuery?: string;
  /** Optional: Refs for external control */
  bottomSheetRef?: RefObject<BottomSheetModalRef>;
  searchBarRef?: RefObject<BottomSheetSearchBarRef>;
  /** Optional: When false, hide product images in suggestions (default: true) */
  showImages?: boolean;
  /** Optional: Tutorial hint element rendered above action buttons */
  tutorialHint?: React.ReactNode;
  /**
   * Optional: renders the "details" step IN PLACE inside this same sheet
   * (morphing flow). When provided, "Add manually" switches the sheet to the
   * details step instead of opening a second modal — one BottomSheetModal, one
   * backdrop, no stacking. `goBack` returns to the search step. The consumer
   * still gets `onAddManually(searchValue)` first to prep the form's inputs.
   */
  renderDetails?: (controls: { goBack: () => void }) => React.ReactNode;
}

/**
 * Return type for useAddItemSheetState hook.
 */
export interface AddItemSheetState {
  /** Current search query */
  searchQuery: string;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Whether data fetching should begin (after animation) */
  shouldFetch: boolean;
  /** Whether suggestion sections should render (deferred until after sheet animation) */
  shouldRenderSuggestions: boolean;
  /** Items currently in exit animation */
  exitingItems: Set<string>;
  /** Start exit animation for an item */
  startExitAnimation: (itemId: string) => void;
  /** Complete exit animation for an item */
  completeExitAnimation: (itemId: string) => void;
  /** Whether to show search results (query >= 2 chars) */
  showSearchResults: boolean;
  /** Whether to show suggestions (no active search) */
  showSuggestions: boolean;
}
