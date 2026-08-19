import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

interface BottomSheetHeaderProps {
  /** Optional centered title. Omit when the confirm action already names the
   *  intent (e.g. a "Mark Cooked" / "Generate" button) to avoid redundancy. */
  title?: string;
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
  cancelLabel,
  confirmLabel,
  confirmDisabled = false,
  confirmColor = 'primary',
}) => {
  const { t } = useTranslation();
  styles.useVariants({ confirmColor, confirmDisabled });

  const resolvedCancelLabel = cancelLabel ?? t('labels.cancel');
  const resolvedConfirmLabel = confirmLabel ?? t('labels.save');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppPressable
          onPress={onCancel}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={resolvedCancelLabel}
        >
          <Text size="md" tone="secondary">
            {resolvedCancelLabel}
          </Text>
        </AppPressable>

        {!!title && (
          <Text
            size="lg"
            weight="semibold"
            align="center"
            style={styles.title}
            numberOfLines={1}
          >
            {title}
          </Text>
        )}

        <AppPressable
          onPress={onConfirm}
          style={styles.button}
          disabled={confirmDisabled}
          accessibilityRole="button"
          accessibilityLabel={resolvedConfirmLabel}
          accessibilityState={{ disabled: confirmDisabled }}
        >
          <Text
            size="md"
            weight="semibold"
            align="right"
            style={styles.confirmText}
          >
            {resolvedConfirmLabel}
          </Text>
        </AppPressable>
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
