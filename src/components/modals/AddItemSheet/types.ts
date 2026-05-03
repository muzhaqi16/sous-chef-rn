import type { RefObject } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
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
 * Uses `any` for grouped data since the actual type varies by use case.
 */
export interface SuggestionGroupConfig {
  /** Unique key for this group */
  key: string;
  /** Display title (e.g., "LOW STOCK", "ADD AGAIN") */
  title: string;
  /** Function to extract items from grouped data */
  accessor: (
    grouped: Record<string, BaseSuggestionItem[]>,
  ) => BaseSuggestionItem[];
  /** Priority order for display (lower = higher priority) */
  priority: number;
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
export interface AddItemSheetConfig {
  /** Sheet title (e.g., "Add to Pantry", "Add to Shopping List") */
  title: string;
  /** Test ID prefix for testing */
  testIDPrefix: string;
  /** Icon for placeholder images */
  placeholderIcon: 'cube-outline' | 'cart-outline';
  /** Search bar placeholder text */
  searchPlaceholder: string;
  /** Suggestion groups to display */
  suggestionGroups: SuggestionGroupConfig[];
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
export interface SuggestionsHookResult {
  /** Grouped suggestions by category */
  grouped: Record<string, BaseSuggestionItem[]>;
  /** Whether suggestions are loading */
  loading: boolean;
  /** Whether there are any suggestions to display */
  hasSuggestions: boolean;
  /** Function to refetch suggestions */
  refetch: () => void;
}

/**
 * Props for the generic AddItemSheet component.
 */
export interface AddItemSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Context ID (pantryId or shoppingListId) */
  contextId: string | undefined;
  /** Callback when sheet is closed */
  onClose: () => void;
  /** Configuration for this sheet instance */
  config: AddItemSheetConfig;
  /** Suggestions hook result */
  suggestions: SuggestionsHookResult;
  /** Handler for quick adding from search autocomplete */
  onQuickAddSearchSuggestion: (item: ItemSuggestion) => void;
  /** Handler for quick adding from suggestion list */
  onQuickAddSuggestion: (item: BaseSuggestionItem) => void;
  /** Whether a mutation is currently in progress */
  isMutating: boolean;
  /** Handler for "Add manually" button */
  onAddManually: (searchValue: string) => void;
  /** Handler for barcode scan button */
  onScanPress: () => void;
  /** Optional: Handler for "Identify with camera" (OCR) button. When provided,
   *  a third action card is rendered alongside Scan Barcode / Add Manually. */
  onIdentifyPress?: () => void;
  /** Optional: Items currently animating out (for exit animations) */
  exitingItems?: Set<string>;
  /** Optional: Callback when exit animation completes */
  onExitComplete?: (itemId: string) => void;
  /** Optional: Whether to use the deferred fetch state */
  shouldFetch?: boolean;
  /** Optional: Initial search query */
  initialSearchQuery?: string;
  /** Optional: Refs for external control */
  bottomSheetRef?: RefObject<BottomSheetModal>;
  searchBarRef?: RefObject<BottomSheetSearchBarRef>;
  /** Optional: When false, hide product images in suggestions (default: true) */
  showImages?: boolean;
  /** Optional: Tutorial hint element rendered above action buttons */
  tutorialHint?: React.ReactNode;
  /** Optional: Child component (e.g., AddDetailsSheet) */
  children?: React.ReactNode;
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
