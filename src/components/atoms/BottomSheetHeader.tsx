import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
  const { theme } = useUnistyles();

  const getConfirmColor = () => {
    if (confirmDisabled) return theme.colors.textTertiary;
    switch (confirmColor) {
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.primary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={onCancel}
          style={({pressed}) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        >
          <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>
            {cancelLabel}
          </Text>
        </Pressable>

        <Text
          style={[styles.title, { color: theme.colors.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Pressable
          onPress={onConfirm}
          style={({pressed}) => [styles.button, pressed && styles.pressed]}
          disabled={confirmDisabled}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          accessibilityState={{ disabled: confirmDisabled }}
        >
          <Text style={[styles.confirmText, { color: getConfirmColor() }]}>
            {confirmLabel}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
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
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    flex: 1,
  },
  cancelText: {
    fontSize: theme.typography.fontSize.md,
  },
  confirmText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    marginTop: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default BottomSheetHeader;
