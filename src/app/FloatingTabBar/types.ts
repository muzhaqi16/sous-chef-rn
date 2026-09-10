import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { IconLibrary } from '#/utils/iconUtils';

/** Ionicons names for a tab, focused and unfocused. */
export interface TabIconPair {
  active: string;
  inactive: string;
}

/**
 * Per-tab presentation, keyed by screen name, supplied by whoever composes the
 * navigator: the tab bar is kit code, so which tabs exist is the app's decision.
 */
export type TabAppearance = Record<
  string,
  { icon: TabIconPair; mainScreen: string }
>;

export interface FloatingTabBarProps extends BottomTabBarProps {
  tabs: TabAppearance;
}

export interface AddButtonProps {
  onPress: () => void;
  isActive?: boolean;
  icon?: string;
  iconLibrary?: IconLibrary;
  disabled?: boolean;
}
