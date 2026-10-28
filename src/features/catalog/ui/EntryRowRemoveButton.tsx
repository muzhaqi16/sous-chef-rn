import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { Label } from '#components/atoms/Label';

interface EntryRowRemoveButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * An entry row's remove control, level with the inputs beside it. An unseen
 * label the size of theirs sits above it, so it keeps level at any text size.
 */
export const EntryRowRemoveButton: React.FC<EntryRowRemoveButtonProps> = ({
  onPress,
  disabled = false,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.column}>
      <View
        style={styles.labelSpacer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Label> </Label>
      </View>
      <AppPressable
        onPress={onPress}
        accessibilityLabel={t('labels.remove')}
        disabled={disabled}
        style={styles.button}
      >
        <Icon name="trash-outline" size={20} tone="error" />
      </AppPressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  column: {
    flex: 0.1,
  },
  labelSpacer: {
    opacity: 0,
  },
  button: {
    height: theme.sizes.input.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
