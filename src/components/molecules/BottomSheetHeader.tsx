import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Text, type TextTone } from '#components/atoms/Text';
import { Divider } from '#components/atoms/Divider';

type ConfirmColor = 'primary' | 'success' | 'warning' | 'error';

const CONFIRM_TONE: Record<ConfirmColor, TextTone> = {
  primary: 'accent',
  success: 'success',
  warning: 'warning',
  error: 'danger',
};

interface BottomSheetHeaderProps {
  /** Optional centered title. Omit when the confirm action already names the
   *  intent (e.g. a "Mark Cooked" / "Generate" button) to avoid redundancy. */
  title?: string;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  /** `error` is a destructive action, so it renders in the danger tone. */
  confirmColor?: ConfirmColor;
  /**
   * A submission is in FLIGHT — distinct from `confirmDisabled`, which is an
   * incomplete form. Both dim the control; only this one swaps the label, so a
   * caller can say "Saving…" without inventing a second header.
   */
  saving?: boolean;
  savingLabel?: string;
  cancelTestID?: string;
  confirmTestID?: string;
  /** The title is inert, so a test taps it to blur a field without side effects. */
  titleTestID?: string;
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
  titleTestID,
}) => {
  const { t } = useTranslation();

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
            testID={titleTestID}
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
          <Text
            role="bodyStrong"
            align="right"
            tone={confirmBlocked ? 'tertiary' : CONFIRM_TONE[confirmColor]}
          >
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
  divider: {
    marginTop: theme.spacing.sm,
  },
}));

export default BottomSheetHeader;
