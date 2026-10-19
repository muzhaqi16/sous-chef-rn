import React from 'react';
import { View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { destructiveConfirm } from '#/services/destructiveConfirm';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { Screen } from './Screen';

interface FormScreenProps {
  title: string;
  onClose: () => void;
  onSave: () => void;
  loading?: boolean;
  /** False while there is nothing to save — the form is still loading, or gone. */
  canSave?: boolean;
  /** False when the first child brings its own lead-in, as a tab strip does. */
  leadIn?: boolean;
  /**
   * While true, leaving by any route (close, back, a gesture) asks first. False
   * once a save has landed, before the screen navigates away.
   */
  unsavedChanges?: boolean;
  children: React.ReactNode;
  testID?: string;
  submitButtonTestID?: string;
}

/** Mounted only for a form that opts in: the hook needs a navigator's route. */
const DiscardChangesGuard: React.FC<{ active: boolean }> = ({ active }) => {
  const { t } = useTranslation();
  const { navigation } = useAppNavigation();
  usePreventRemove(active, ({ data }) => {
    alertService.alert(
      t('confirmations.discardChangesTitle'),
      t('confirmations.discardChanges'),
      destructiveConfirm(t('labels.discard'), () =>
        navigation.dispatch(data.action),
      ),
    );
  });
  return null;
};

/**
 * A full-screen form with close and confirm in the header. A `Screen` preset,
 * not a sheet: it fills the screen and pushes like one, so the sheet shell's
 * rules — a snap point, a backdrop claim, a drag handle — do not apply.
 */
export const FormScreen: React.FC<FormScreenProps> = ({
  title,
  onClose,
  onSave,
  loading = false,
  canSave = true,
  leadIn = true,
  unsavedChanges,
  children,
  testID,
  submitButtonTestID,
}) => {
  const { t } = useTranslation();
  styles.useVariants({ leadIn });
  return (
    <Screen
      testID={testID}
      scroll="form"
      header={{
        title,
        actions: [
          {
            icon: 'checkmark',
            accessibilityLabel: t('labels.save'),
            onPress: onSave,
            variant: 'primary',
            loading,
            disabled: loading || !canSave,
            testID: submitButtonTestID,
          },
        ],
        close: onClose,
      }}
    >
      {unsavedChanges === undefined ? null : (
        <DiscardChangesGuard active={unsavedChanges} />
      )}
      <View style={styles.body}>{children}</View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  // Grows so a centred loading or error state still fills the screen.
  body: {
    flexGrow: 1,
    variants: {
      leadIn: {
        true: { paddingTop: theme.layout.pageTop },
        false: {},
      },
    },
  },
}));
