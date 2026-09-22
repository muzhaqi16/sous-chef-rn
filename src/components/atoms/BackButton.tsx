import React from 'react';
import { useTranslation } from '#/i18n';
import type { StyleProp, ViewStyle } from 'react-native';
import { IconButton } from './IconButton';
import type { IconTone } from '#/utils/iconUtils';

export interface BackButtonProps {
  onPress: () => void;
  /** Defaults to `textPrimary`; a header over a fill names its own. */
  tone?: IconTone;
  color?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  testID?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  tone = 'textPrimary',
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
      tone={tone}
      color={color}
      style={style}
      disabled={disabled}
      testID={testID}
    />
  );
};

export default BackButton;
