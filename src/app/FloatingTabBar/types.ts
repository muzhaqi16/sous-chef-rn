import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { SharedValue } from 'react-native-reanimated';
import type { IconLibrary } from '#/utils/iconUtils';
import type { TabAppearance } from '#features/types';

export interface FloatingTabBarProps extends BottomTabBarProps {
  tabs: TabAppearance;
}

export interface AddButtonProps {
  onPress: () => void;
  isActive?: boolean;
  icon?: string;
  iconLibrary?: IconLibrary;
  disabled?: boolean;
  /** Set when the `+` opens a menu: whether it is open. */
  menuOpen?: boolean;
  /** The menu's 0…1 progress, which turns the `+` into a close glyph. */
  menuProgress?: SharedValue<number>;
}
