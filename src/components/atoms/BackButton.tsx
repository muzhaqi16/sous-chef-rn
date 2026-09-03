import React from 'react';
import { useTranslation } from '#/i18n';
import type { StyleProp, ViewStyle } from 'react-native';
import { withUnistyles } from 'react-native-unistyles';
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

/** Tinted with `theme.colors.textPrimary`. Declared beside what it wraps. */
export const ThemedBackButton = withUnistyles(BackButton, theme => ({
  color: theme.colors.textPrimary,
}));
