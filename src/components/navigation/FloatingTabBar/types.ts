import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { SharedValue } from 'react-native-reanimated';
import type { IconLibrary } from '#/utils/iconUtils';

export interface FloatingTabBarProps extends BottomTabBarProps {}

export interface TabIndicatorProps {
  activeIndex: SharedValue<number>;
  tabWidth: number;
  tabCount: number;
  tabBarWidth: number;
}

export interface FloatingTabItemProps {
  route: any;
  index: number;
  activeIndex: SharedValue<number>;
  onPress: () => void;
  onLongPress: () => void;
  icon?: React.ComponentType<{
    focused: boolean;
    color: string;
    size: number;
  }>;
  accessibilityLabel?: string;
  isActive: boolean;
}

export interface AddButtonProps {
  onPress: () => void;
  isActive?: boolean;
  icon?: string;
  iconLibrary?: IconLibrary;
}