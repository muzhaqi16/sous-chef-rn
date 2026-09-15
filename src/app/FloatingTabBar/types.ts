import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
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
}
