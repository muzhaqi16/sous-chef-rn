import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { Divider } from '#components/atoms/Divider';

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
  /**
   * A submission is in FLIGHT — distinct from `confirmDisabled`, which is an
   * incomplete form. Both dim the control; only this one swaps the label, so a
   * caller can say "Saving…" without inventing a second header.
   */
  saving?: boolean;
  savingLabel?: string;
  cancelTestID?: string;
  confirmTestID?: string;
}

export const BottomSheetHeader: React.FC<BottomSheetHeaderProps> = ({
  title,
  onCancel,
  onConfirm,
  cancelLabel,
  confirmLabel,
  confirmDisabled = false,
  confirmColor = 'primary',
  saving = false,
  savingLabel,
  cancelTestID,
  confirmTestID,
}) => {
  const { t } = useTranslation();
  styles.useVariants({
    confirmColor,
    confirmDisabled: confirmDisabled || saving,
  });

  const resolvedCancelLabel = cancelLabel ?? t('labels.cancel');
  // `saving` blocks the controls; it substitutes the LABEL only when the caller
  // supplies one, because several callers already encode the in-flight wording
  // in `confirmLabel` itself ("Adding…").
  const resolvedConfirmLabel =
    (saving ? savingLabel : undefined) ?? confirmLabel ?? t('labels.save');
  const confirmBlocked = confirmDisabled || saving;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppPressable
          onPress={onCancel}
          style={styles.button}
          testID={cancelTestID}
          accessibilityRole="button"
          accessibilityLabel={resolvedCancelLabel}
        >
          <Text tone="secondary">{resolvedCancelLabel}</Text>
        </AppPressable>

        {!!title && (
          <Text
            role="heading"
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
          disabled={confirmBlocked}
          testID={confirmTestID}
          accessibilityRole="button"
          accessibilityLabel={resolvedConfirmLabel}
          accessibilityState={{ disabled: confirmBlocked }}
        >
          <Text role="bodyStrong" align="right" style={styles.confirmText}>
            {resolvedConfirmLabel}
          </Text>
        </AppPressable>
      </View>
      <Divider style={styles.divider} />
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
    marginTop: theme.spacing.sm,
  },
}));

export default BottomSheetHeader;
