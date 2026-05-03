import React from 'react';
import { Ionicons } from '@react-native-vector-icons/ionicons';

// Extract icon name type from Ionicons
type IoniconsIconName = React.ComponentProps<typeof Ionicons>['name'];

// Icon name type - Ionicons only
export type IconName = IoniconsIconName;

// Kept for backward compatibility — all icons now use Ionicons
export type IconLibrary = string;

// Icon component props
interface IconProps {
  name: string;
  size?: number;
  color?: string;
  library?: string;
}

// Utility function to render icons
export const renderIcon = ({
  name,
  size = 24,
  color = '#000',
}: IconProps): React.ReactElement => {
  return <Ionicons size={size} color={color} name={name as IoniconsIconName} />;
};

// Reusable Icon component
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#000',
}) => {
  return renderIcon({ name, size, color });
};
