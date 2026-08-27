import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { IconLibrary } from '#/utils/iconUtils';

/** Ionicons names for a tab, focused and unfocused. */
export interface TabIconPair {
  active: string;
  inactive: string;
}

/**
 * Per-tab presentation, keyed by React Navigation screen name.
 *
 * Supplied by whoever composes the navigator. The tab bar is kit code and has
 * no way to learn which tabs exist or what they should look like — that is the
 * app's decision, and passing it in is what lets a different app ship a
 * different set of tabs without editing this component.
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
