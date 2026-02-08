import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { SharedValue } from 'react-native-reanimated';
import type { IconLibrary } from '#/utils/iconUtils';

export interface FloatingTabBarProps extends BottomTabBarProps {}

export interface FloatingTabItemProps {
  route: any;
  index: number;
  activeIndex: SharedValue<number>;
  onPress: () => void;
  onLongPress: () => void;
  icon?: BottomTabNavigationOptions['tabBarIcon'];
  accessibilityLabel?: string;
  isActive: boolean;
}

export interface AddButtonProps {
  onPress: () => void;
  isActive?: boolean;
  icon?: string;
  iconLibrary?: IconLibrary;
  disabled?: boolean;
}