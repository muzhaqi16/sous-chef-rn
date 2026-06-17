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
  /** Optional secondary label rendered under the main label in smaller text
   * (e.g. a storage location's parent, to disambiguate same-named children). */
  subLabel?: string;
  /** Optional emoji or icon name */
  icon?: string;
  /** Custom React element to render as icon (takes precedence over string icon) */
  iconElement?: React.ReactNode;
  /** Icon library if using Icon component */
  iconLibrary?: string;
  /** Custom press handler (overrides onTabChange for modal triggers) */
  onPress?: () => void;
  /** Show dropdown indicator (chevron-down) for modal-triggering pills */
  showDropdownIndicator?: boolean;
  /** Mark as action tab (uses primary color, not selectable) */
  isAction?: boolean;
  /** Custom background color when tab is active (overrides theme default) */
  activeColor?: string;
}

export interface FilterTabActionButton {
  /** Icon name to display (optional - can use label instead) */
  icon?: string;
  /** Text label to display (optional - can use icon instead) */
  label?: string;
  /** Icon library */
  iconLibrary?: string;
  /** Callback when button is pressed */
  onPress: () => void;
  /** Test ID for accessibility */
  testID?: string;
  /** Whether the button is disabled (shown dimmed, no-op on press) */
  disabled?: boolean;
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
  /** Tab IDs that have active filters (shown with subtle filtered styling) */
  filteredTabIds?: T[];
}
