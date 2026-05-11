import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface BottomSheetHeaderProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  confirmColor?: 'primary' | 'success' | 'warning' | 'error';
}

/**
 * BottomSheetHeader - Consistent header for bottom sheets
 *
 * Layout: [Cancel] [Title] [Confirm]
 * - Cancel button on left
 * - Title centered
 * - Confirm button on right with customizable color
 */
export const BottomSheetHeader: React.FC<BottomSheetHeaderProps> = ({
  title,
  onCancel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmLabel = 'Save',
  confirmDisabled = false,
  confirmColor = 'primary',
}) => {
  styles.useVariants({ confirmColor, confirmDisabled });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        >
          <Text size="md" tone="secondary">
            {cancelLabel}
          </Text>
        </Pressable>

        <Text
          size="lg"
          weight="semibold"
          align="center"
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Pressable
          onPress={onConfirm}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          disabled={confirmDisabled}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          accessibilityState={{ disabled: confirmDisabled }}
        >
          <Text
            size="md"
            weight="semibold"
            align="right"
            style={styles.confirmText}
          >
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
      <View style={styles.divider} />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  button: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    minWidth: 70,
  },
  title: {
    flex: 1,
  },
  confirmText: {
    variants: {
      confirmColor: {
        primary: { color: theme.colors.primary },
        success: { color: theme.colors.success },
        warning: { color: theme.colors.warning },
        error: { color: theme.colors.error },
      },
      confirmDisabled: {
        true: { color: theme.colors.textTertiary },
      },
    },
  },
  divider: {
    height: 1,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default BottomSheetHeader;
