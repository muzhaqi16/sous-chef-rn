import { useState } from 'react';
import type { SortOption, SortDirection } from '../pantryDisplay/types';
import {
  PantrySortOption,
  PantrySortDirection,
  PREFERENCE_DEFAULTS,
} from '#store/slices/preferenceTypes';

interface SortableItem {
  id: string;
  itemName?: string | null;
  expiresAt?: string | null;
  quantity: number;
  createdAt?: string;
}

// Reference-identity cache: unchanged inputs must return the same array, or
// FlashList re-renders every mounted cell. At module scope so the compiler
// doesn't read the cache writes as side effects inside a hook body.
let _lastSortInput: unknown = null;
let _lastSortOption: SortOption | null = null;
let _lastSortDirection: SortDirection | null = null;
let _lastSortResult: SortableItem[] = [];

function cachedSort<T extends SortableItem>(
  items: T[],
  option: SortOption,
  direction: SortDirection,
): T[] {
  if (
    items === _lastSortInput &&
    option === _lastSortOption &&
    direction === _lastSortDirection
  ) {
    return _lastSortResult as T[];
  }

  // Pre-computed O(n) instead of wrapping each item.
  const expiryMap = new Map<string, number>();
  const createdMap = new Map<string, number>();
  for (const item of items) {
    if (option === PantrySortOption.EXPIRY) {
      expiryMap.set(
        item.id,
        item.expiresAt ? new Date(item.expiresAt).getTime() : Infinity,
      );
    } else if (option === PantrySortOption.RECENT) {
      createdMap.set(
        item.id,
        item.createdAt ? new Date(item.createdAt).getTime() : 0,
      );
    }
  }

  const sorted = items.slice();
  sorted.sort((a, b) => {
    let comparison = 0;
    switch (option) {
      case PantrySortOption.NAME:
        comparison = (a.itemName || '').localeCompare(b.itemName || '');
        break;
      case PantrySortOption.EXPIRY:
        comparison = expiryMap.get(a.id)! - expiryMap.get(b.id)!;
        break;
      case PantrySortOption.QUANTITY:
        comparison = a.quantity - b.quantity;
        break;
      case PantrySortOption.RECENT:
        comparison = createdMap.get(b.id)! - createdMap.get(a.id)!;
        break;
    }
    return direction === PantrySortDirection.ASC ? comparison : -comparison;
  });

  _lastSortInput = items;
  _lastSortOption = option;
  _lastSortDirection = direction;
  _lastSortResult = sorted;
  return sorted;
}

interface UsePantrySortingOptions {
  initialSortOption?: SortOption;
  initialSortDirection?: SortDirection;
  /** Persists the change to the preferences store. */
  onSortChange?: (option: SortOption, direction: SortDirection) => void;
}

interface UsePantrySortingResult<T extends SortableItem> {
  sortOption: SortOption;
  sortDirection: SortDirection;
  sortModalVisible: boolean;
  openSortModal: () => void;
  closeSortModal: () => void;
  handleSortSelect: (option: SortOption) => void;
  sortItems: (items: T[]) => T[];
}

export function usePantrySorting<T extends SortableItem>(
  options: UsePantrySortingOptions = {},
): UsePantrySortingResult<T> {
  const {
    initialSortOption = PREFERENCE_DEFAULTS.pantrySortOption,
    initialSortDirection = PREFERENCE_DEFAULTS.pantrySortDirection,
    onSortChange,
  } = options;

  const [sortOption, setSortOption] = useState<SortOption>(initialSortOption);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const openSortModal = () => {
    setSortModalVisible(true);
  };

  const closeSortModal = () => {
    setSortModalVisible(false);
  };

  const handleSortSelect = (option: SortOption) => {
    let newOption = sortOption;
    let newDirection = sortDirection;

    if (sortOption === option) {
      newDirection =
        sortDirection === PantrySortDirection.ASC
          ? PantrySortDirection.DESC
          : PantrySortDirection.ASC;
      setSortDirection(newDirection);
    } else {
      newOption = option;
      newDirection = PantrySortDirection.ASC;
      setSortOption(newOption);
      setSortDirection(newDirection);
    }

    onSortChange?.(newOption, newDirection);
    setSortModalVisible(false);
  };

  const sortItems = (items: T[]): T[] =>
    cachedSort(items, sortOption, sortDirection);

  return {
    sortOption,
    sortDirection,
    sortModalVisible,
    openSortModal,
    closeSortModal,
    handleSortSelect,
    sortItems,
  };
}
