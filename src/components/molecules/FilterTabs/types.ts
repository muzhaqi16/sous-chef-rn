/**
 * FilterTabs - Generic configurable tab filter component
 *
 * Can be used for:
 * - Pantry location filters (All, Fridge, Freezer, Pantry)
 * - Shopping list status filters (Shopping, Purchased)
 * - Recipe diet filters (All, Vegetarian, Vegan, etc.)
 */

export interface FilterTabConfig<T extends string = string> {
  /** Unique identifier for the tab */
  id: T;
  /** Display label */
  label: string;
  /** Optional emoji or icon name */
  icon?: string;
  /** Icon library if using Icon component */
  iconLibrary?: 'MaterialIcons' | 'MaterialDesignIcons' | 'Ionicons' | 'Feather';
}

export interface FilterTabActionButton {
  /** Icon name to display */
  icon: string;
  /** Icon library (default: MaterialIcons) */
  iconLibrary?: 'MaterialIcons' | 'MaterialDesignIcons' | 'Ionicons' | 'Feather';
  /** Callback when button is pressed */
  onPress: () => void;
  /** Test ID for accessibility */
  testID?: string;
}

export interface FilterTabsProps<T extends string = string> {
  /** Array of tab configurations */
  tabs: FilterTabConfig<T>[];
  /** Currently active tab ID */
  activeTabId: T;
  /** Callback when tab is changed */
  onTabChange: (tabId: T) => void;
  /** Optional count badges per tab */
  counts?: Partial<Record<T, number>>;
  /** Whether to show count badges (default: true if counts provided) */
  showCounts?: boolean;
  /** Visual variant */
  variant?: 'default' | 'compact';
  /** Test ID prefix for accessibility */
  testIDPrefix?: string;
  /** Optional action button at the end of tabs (e.g., "+" to add new) */
  actionButton?: FilterTabActionButton;
}
