import type { IconLibrary } from '#utils/iconUtils';

export interface SelectableItem {
  id: string;
  [key: string]: any;
}

export interface ActionButtonConfig {
  icon: string;
  label: string;
  onPress: () => void;
  iconLibrary?: IconLibrary;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  color?: string;
}

export interface SelectorConfig<T extends SelectableItem> {
  title: string;
  data: T[];
  selectedId?: string;
  onSelect: (id: string, item: T) => void;
  displayProperty: keyof T;
  actions: ActionButtonConfig[];
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor?: (item: T) => string;
  renderCustomItem?: (
    item: T,
    isSelected: boolean,
    onPress: () => void
  ) => React.ReactElement;
}

export interface AnimatedItemSelectorProps<T extends SelectableItem> {
  config: SelectorConfig<T>;
  isVisible?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
}

export interface ItemSelectorRef {
  open: () => void;
  close: () => void;
  isActive: () => boolean;
  toggle: () => void;
}

export interface SelectorItemProps<T extends SelectableItem> {
  item: T;
  index?: number;
  isSelected: boolean;
  onPress: () => void;
  displayProperty: keyof T;
  renderCustomItem?: (
    item: T,
    isSelected: boolean,
    onPress: () => void
  ) => React.ReactElement;
}