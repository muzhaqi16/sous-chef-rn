import React from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { IconButton } from './IconButton';

export interface BackButtonProps {
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color,
  style,
  disabled,
  testID,
}) => {
  const { t } = useTranslation();
  return (
    <IconButton
      name="arrow-back"
      onPress={onPress}
      accessibilityLabel={t('labels.goBack')}
      color={color}
      style={style}
      disabled={disabled}
      testID={testID}
    />
  );
};

export default BackButton;
