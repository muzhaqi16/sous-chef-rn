import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, type IconLibrary } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

export interface ActionCardProps {
  icon: string;
  iconLibrary?: IconLibrary;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * ActionCard - Large action button with icon and label
 *
 * Used for prominent quick actions in bottom sheets and action areas.
 * Displays a large icon in a circular container with a label below.
 */
export const ActionCard: React.FC<ActionCardProps> = ({
  icon,
  iconLibrary,
  label,
  onPress,
  disabled = false,
  testID,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    >
      <View style={styles.iconContainer}>
        <Icon
          name={icon}
          size={32}
          tone={disabled ? 'textTertiary' : 'primary'}
          library={iconLibrary}
        />
      </View>
      <Text
        size="base"
        weight="medium"
        align="center"
        tone={disabled ? 'tertiary' : undefined}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.lg,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
