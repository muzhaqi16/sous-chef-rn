import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { Button } from '#components/molecules/Button';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { homeTestIDs } from '#features/home/testIDs';
import { logValidationErrors } from '#/utils/validation/common';
import {
  CREATE_HOME_DEFAULTS,
  createHomeSchema,
  type CreateHomeFormValues,
} from './createHomeFormConfig';

interface CreateHomeFormProps {
  /** False while the address is unverified: the server refuses a join code then. */
  joinCodeAvailable: boolean;
  /** Asks for a verified address before a join code is turned on; false without one. */
  requireVerifiedEmail: () => boolean;
  /** Receives the name cleaned; a name the API would refuse never reaches it. */
  onSubmit: (values: CreateHomeFormValues) => Promise<void>;
  onCancel: () => void;
  isCreating: boolean;
}

export const CreateHomeForm: React.FC<CreateHomeFormProps> = ({
  joinCodeAvailable,
  requireVerifiedEmail,
  onSubmit,
  onCancel,
  isCreating,
}) => {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<CreateHomeFormValues>({
    resolver: yupResolver(createHomeSchema),
    defaultValues: CREATE_HOME_DEFAULTS,
  });

  return (
    <View style={styles.createForm}>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <BaseInput
            testID={homeTestIDs.createHomeNameInput}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('labels.enterHomeName')}
            errorMessage={fieldState.error?.message}
            autoFocus
            autoCapitalize="words"
          />
        )}
      />
      <Controller
        control={control}
        name="allowJoinCode"
        render={({ field }) => {
          const checked = field.value && joinCodeAvailable;
          return (
            <FormCheckbox
              label={t('createHome.allowJoinCode')}
              checked={checked}
              onPress={() => {
                if (!checked && !requireVerifiedEmail()) return;
                field.onChange(!checked);
              }}
            />
          );
        }}
      />
      <View style={styles.formActions}>
        <Button
          testID={homeTestIDs.createHomeCancelButton}
          variant="secondary"
          onPress={onCancel}
          fullWidth
        >
          {t('labels.cancel')}
        </Button>
        <Button
          testID={homeTestIDs.createHomeSubmitButton}
          loading={isCreating}
          onPress={handleSubmit(onSubmit, logValidationErrors)}
          variant="primary"
          style={styles.button}
        >
          {t('labels.create')}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  createForm: {
    backgroundColor: theme.colors.surface,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
  },
}));
