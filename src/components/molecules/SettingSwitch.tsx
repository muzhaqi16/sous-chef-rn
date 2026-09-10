import React from 'react';
import { View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { Text } from '#components/atoms/Text';

interface SettingSwitchProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  isAction?: boolean;
  testID?: string;
  containerStyle?: ViewStyle;
}

/**
 * A switch setting by props. Deliberately NOT routed through `SettingRow`:
 * that component renders a `TextEditBottomSheet` unconditionally, so every
 * switch would mount a sheet it never opens.
 */
export const SettingSwitch: React.FC<SettingSwitchProps> = ({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  loading = false,
  testID,
  containerStyle,
}) => {
  return (
    <View
      style={[
        styles.container,
        disabled && styles.containerDisabled,
        containerStyle,
      ]}
    >
      <View style={styles.textContainer}>
        <Text style={[styles.title, disabled && styles.titleDisabled]}>
          {title}
        </Text>
        {!!description && (
          <Text
            role="caption"
            style={[styles.description, disabled && styles.descriptionDisabled]}
          >
            {description}
          </Text>
        )}
      </View>
      <BaseSwitch
        testID={testID}
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        loading={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  containerDisabled: {
    opacity: theme.opacity.disabled,
  },
  textContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  titleDisabled: {
    color: theme.colors.textTertiary,
  },
  description: {
    color: theme.colors.textSecondary,
  },
  descriptionDisabled: {
    color: theme.colors.textTertiary,
  },
}));
