import MaterialIcon from '@react-native-vector-icons/material-icons';

export type MaterialIconName = React.ComponentProps<
  typeof MaterialIcon
>['name'];

export interface IconProps {
  name: MaterialIconName;
  size?: number;
  color?: string;
}
