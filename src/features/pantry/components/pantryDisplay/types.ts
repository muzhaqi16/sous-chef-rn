import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import {
  type PantryItem,
  type PantryStats,
} from '#/graphql/generated/schemaTypes';
import type { LocationFilter } from '#utils/pantryFilters';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import type { ItemVariant, ExpirationVariant } from '../PantryItemCard';

// Sort types (exported for use in other components)
export type SortOption = 'name' | 'expiry' | 'quantity' | 'recent';
export type SortDirection = 'asc' | 'desc';

/** Theme-resolved color palette used by display map cache and main component. */
export interface ExpirationColors {
  expired: string;
  warning: string;
  normal: string;
}

/** Pre-computed display data for a single pantry item. */
export interface ItemDisplayData {
  id: string;
  name: string;
  imageUrl: string | null | undefined;
  expirationText: string | null;
  expirationVariant: ExpirationVariant | undefined;
  expirationColor: string | undefined;
  variant: ItemVariant;
  quantityDisplay: string;
  location: string | null;
  isOutOfStock: boolean;
  packageBreakdownText: string | null | undefined;
  remainingNetWeightText: string | null | undefined;
  quantityBreakdownText: string | null | undefined;
  activeBatchCount: number | undefined;
}

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
    'totalItems' | 'expiringCount' | 'lowStockCount'
  > | null;

  // Items
  items: PantryItem[];

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
