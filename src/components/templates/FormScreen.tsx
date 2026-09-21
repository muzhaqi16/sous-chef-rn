import React from 'react';
import { useTranslation } from '#/i18n';
import { Screen } from './Screen';

interface FormScreenProps {
  title: string;
  onClose: () => void;
  onSave: () => void;
  loading?: boolean;
  /** False while there is nothing to save — the form is still loading, or gone. */
  canSave?: boolean;
  children: React.ReactNode;
  testID?: string;
  submitButtonTestID?: string;
}

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
  children,
  testID,
  submitButtonTestID,
}) => {
  const { t } = useTranslation();
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
      {children}
    </Screen>
  );
};
