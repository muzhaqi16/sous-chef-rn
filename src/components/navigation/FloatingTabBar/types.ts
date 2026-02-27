import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { IconLibrary } from '#/utils/iconUtils';

export interface FloatingTabBarProps extends BottomTabBarProps {}

export interface AddButtonProps {
  onPress: () => void;
  isActive?: boolean;
  icon?: string;
  iconLibrary?: IconLibrary;
  disabled?: boolean;
}