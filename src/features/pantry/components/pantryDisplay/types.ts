import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { type PantryStats } from '#/graphql/generated/schemaTypes';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import type {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferenceTypes';
import type { PantryListNode } from './renderItem';

// Sort types — aliases of the store preference enums so the display layer and
// the persisted preference share one nominal source of truth.
export type SortOption = PantrySortOption;
export type SortDirection = PantrySortDirection;

export interface PantryContentRef {
  scrollToTop(): void;
}

export interface PantryContentProps {
  // User info
  userName: string;
  householdName: string;
  avatarUrl?: string | null;
  notificationCount?: number;

  // Stats
  stats?: Pick<
    PantryStats,
    'totalItems' | 'expiringCount' | 'expiredCount' | 'lowStockCount'
  > | null;

  // Items — opaque fragment refs; the leaf `PantryItemCard` unmasks each via
  // `useFragment`. Carries `id` so FlashList keyExtractor + sort comparators
  // can identify entries without unmasking.
  items: PantryListNode[];

  // Location filter
  locationFilter: LocationFilter;
  onLocationFilterChange: (filter: LocationFilter) => void;
  locationCounts: Record<string, number>;

  // Dynamic filter tabs (optional - falls back to default tabs if not provided)
  tabs?: FilterTabConfig<LocationFilter>[];
  onAddLocation?: () => void;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Sort (initial values from store, callbacks to persist changes)
  initialSortOption?: SortOption;
  initialSortDirection?: SortDirection;
  onSortChange?: (option: SortOption, direction: SortDirection) => void;

  // Hybrid sort/search: when true, server handles sort+search; when false, local
  useServerSort?: boolean;

  // Actions (passed to context provider)
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;

  // Header actions
  onAvatarPress?: () => void;
  onHomePress?: () => void;
  onNotificationPress?: () => void;
  onSettingsPress?: () => void;
  onAnalyticsPress?: () => void;
  onLowStockNavigate?: () => void;
  onExpiringNavigate?: () => void;
  onExpiredNavigate?: () => void;

  // List actions
  onRefresh?: () => void;
  onEndReached?: () => void;

  // Empty state
  totalCount?: number;
  onAddItem?: () => void;

  // No-home states
  noHomeSelected?: boolean;
  noHomes?: boolean;
  noPantries?: boolean;
  onSelectHome?: () => void;
  onCreatePantry?: () => void;

  // Pagination
  isLoadingMore?: boolean;
  hasMore?: boolean;

  // State
  refreshing?: boolean;
  loading?: boolean;
  /**
   * True while a server-mode tab/sort switch is re-fetching the filtered page
   * (the previous tab's items linger until it lands). Drives the switch skeleton
   * overlay so the stale list doesn't show through during the fetch. Always
   * false in client mode, where switching filters the already-loaded set
   * instantly.
   */
  fetching?: boolean;
  /**
   * True when items are paged/filtered by the server (large pantry, online).
   * Gates the switch-skeleton latch: client-mode switches are instant and
   * never fetch, so the latch must not arm (it could only clear via a
   * fetching transition that never comes).
   */
  serverMode?: boolean;

  /** Callback with screen-coordinate rect when the home badge lays out */
  onHomeBadgeLayout?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;

  /** Callback with screen-coordinate rect when the settings gear icon lays out */
  onSettingsIconLayout?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;

  /** Scroll handler for tab bar direction tracking */
  scrollHandler?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Shows tab bar when drag ends without momentum */
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Shows tab bar when momentum scrolling ends */
  onMomentumScrollEnd?: () => void;
}

export interface PantryEmptyStateProps {
  showSkeletons: boolean;
  searchQuery: string;
  itemCount: number;
  locationFilter: LocationFilter;
  tabs: FilterTabConfig<LocationFilter>[];
  onAddItem?: () => void;
  noHomeSelected?: boolean;
  noHomes?: boolean;
  noPantries?: boolean;
  onSelectHome?: () => void;
  onCreatePantry?: () => void;
  overallItemCount: number;
}
