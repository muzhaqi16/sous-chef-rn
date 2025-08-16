import React from 'react';
import {MaterialIcons} from '@react-native-vector-icons/material-icons';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {Ionicons} from '@react-native-vector-icons/ionicons';
import {Feather} from '@react-native-vector-icons/feather';

// Define available libraries
export type IconLibrary =
  | 'MaterialIcons'
  | 'MaterialDesignIcons'
  | 'Ionicons'
  | 'Feather';

// Extract icon name types from each library
type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];
type MaterialDesignIconName = React.ComponentProps<
  typeof MaterialDesignIcons
>['name'];
type IoniconsIconName = React.ComponentProps<typeof Ionicons>['name'];
type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

// Union type for all possible icon names
export type IconName =
  | MaterialIconName
  | MaterialDesignIconName
  | IoniconsIconName
  | FeatherIconName;

// Icon component props
interface IconProps {
  name: string; // We'll use string and cast appropriately
  size?: number;
  color?: string;
  library?: IconLibrary;
}

// Utility function to render icons from different libraries
export const renderIcon = ({
  name,
  size = 24,
  color = '#000',
  library = 'MaterialIcons',
}: IconProps): React.ReactElement => {
  const iconProps = {size, color};

  switch (library) {
    case 'MaterialIcons':
      return <MaterialIcons {...iconProps} name={name as MaterialIconName} />;

    case 'MaterialDesignIcons':
      return (
        <MaterialDesignIcons
          {...iconProps}
          name={name as MaterialDesignIconName}
        />
      );

    case 'Ionicons':
      return <Ionicons {...iconProps} name={name as IoniconsIconName} />;

    case 'Feather':
      return <Feather {...iconProps} name={name as FeatherIconName} />;

    default:
      // Fallback to MaterialIcons
      return <MaterialIcons {...iconProps} name={name as MaterialIconName} />;
  }
};

// Alternative: Create a reusable Icon component
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#000',
  library = 'MaterialIcons',
}) => {
  return renderIcon({name, size, color, library});
};
