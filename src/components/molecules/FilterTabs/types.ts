export interface FilterTabConfig<T extends string = string> {
  id: T;
  label: string;
  /** Rendered under the label (e.g. a location's parent, to disambiguate). */
  subLabel?: string;
  icon?: string;
  /** Beats the string `icon`. */
  iconElement?: React.ReactNode;
  iconLibrary?: string;
  /** Overrides `onTabChange`, for modal-triggering pills. */
  onPress?: () => void;
  showDropdownIndicator?: boolean;
  /** Primary-colored and not selectable. */
  isAction?: boolean;
  activeColor?: string;
}

export interface FilterTabActionButton {
  icon?: string;
  /** Either `icon` or `label` is enough. */
  label?: string;
  iconLibrary?: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}

export interface FilterTabsProps<T extends string = string> {
  tabs: FilterTabConfig<T>[];
  activeTabId: T;
  onTabChange: (tabId: T) => void;
  counts?: Partial<Record<T, number>>;
  /** Defaults to true when `counts` is given. */
  showCounts?: boolean;
  variant?: 'default' | 'compact';
  testIDPrefix?: string;
  actionButton?: FilterTabActionButton;
  /** Tabs with active filters, shown with the filtered styling. */
  filteredTabIds?: T[];
}
