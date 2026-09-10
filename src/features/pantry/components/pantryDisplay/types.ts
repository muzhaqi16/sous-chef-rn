import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { type PantryStats } from '#/graphql/generated/schemaTypes';
import type { LocationFilter } from '#features/pantry/utils/pantryFilters';
import type { FilterTabConfig } from '#components/organisms/FilterTabs/types';
import type {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferenceTypes';
import type { PantryListNode } from './renderItem';

// Aliases of the store preference enums, so display and persisted preference
// share one source of truth.
export type SortOption = PantrySortOption;
export type SortDirection = PantrySortDirection;

export interface PantryContentRef {
  scrollToTop(): void;
}

export interface PantryContentProps {
  /** Omitted when the account has no name yet; the header greets without one. */
  userName?: string;
  householdName: string;
  avatarUrl?: string | null;
  notificationCount?: number;

  stats?: Pick<
    PantryStats,
    'totalItems' | 'expiringCount' | 'expiredCount' | 'lowStockCount'
  > | null;

  // Opaque fragment refs, unmasked by the leaf card. Carries `id` so the
  // keyExtractor and sort comparators work without unmasking.
  items: PantryListNode[];

  locationFilter: LocationFilter;
  onLocationFilterChange: (filter: LocationFilter) => void;
  locationCounts: Record<string, number>;

  /** Falls back to `getDefaultPantryTabs()`. */
  tabs?: FilterTabConfig<LocationFilter>[];
  onAddLocation?: () => void;

  searchQuery: string;
  onSearchChange: (query: string) => void;

  initialSortOption?: SortOption;
  initialSortDirection?: SortDirection;
  onSortChange?: (option: SortOption, direction: SortDirection) => void;

  /** True hands sort+search to the server; false sorts the loaded set locally. */
  useServerSort?: boolean;

  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;

  onAvatarPress?: () => void;
  onHomePress?: () => void;
  onNotificationPress?: () => void;
  onSettingsPress?: () => void;
  onAnalyticsPress?: () => void;
  onLowStockNavigate?: () => void;
  onExpiringNavigate?: () => void;
  onExpiredNavigate?: () => void;

  onRefresh?: () => void;
  onEndReached?: () => void;

  totalCount?: number;
  onAddItem?: () => void;

  noHomeSelected?: boolean;
  noHomes?: boolean;
  noPantries?: boolean;
  onSelectHome?: () => void;
  onCreatePantry?: () => void;

  isLoadingMore?: boolean;
  hasMore?: boolean;

  refreshing?: boolean;
  loading?: boolean;
  /**
   * True while a server-mode tab/sort switch re-fetches the filtered page, so
   * the switch skeleton hides the lingering previous tab. Always false in
   * client mode, where switching is instant.
   */
  fetching?: boolean;
  /**
   * True when the server pages/filters the items. Gates the switch-skeleton
   * latch: a client-mode switch never fetches, so an armed latch would wait on
   * a transition that never comes.
   */
  serverMode?: boolean;

  /** Screen-coordinate rect of the home badge. */
  onHomeBadgeLayout?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;

  /** Screen-coordinate rect of the settings gear icon. */
  onSettingsIconLayout?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;

  /** Scroll handler for tab bar direction tracking */
  scrollHandler?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Marks the scroll as finger-driven so only user scrolls hide the tab bar */
  onScrollBeginDrag?: () => void;
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
