import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { Button } from '#components/molecules/Button';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { homeTestIDs } from '#features/home/testIDs';

interface CreateHomeFormProps {
  isVisible: boolean;
  homeName: string;
  onHomeNameChange: (name: string) => void;
  allowJoinCode: boolean;
  onAllowJoinCodeChange: (value: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isCreating: boolean;
}

export const CreateHomeForm: React.FC<CreateHomeFormProps> = ({
  isVisible,
  homeName,
  onHomeNameChange,
  allowJoinCode,
  onAllowJoinCodeChange,
  onSubmit,
  onCancel,
  isCreating,
}) => {
  const { t } = useTranslation();
  if (!isVisible) return null;

  return (
    <View style={styles.createForm}>
      <BaseInput
        testID={homeTestIDs.createHomeNameInput}
        value={homeName}
        onChangeText={onHomeNameChange}
        placeholder={t('labels.enterHomeName')}
        autoFocus
        autoCapitalize="words"
      />
      <FormCheckbox
        label={t('createHome.allowJoinCode')}
        checked={allowJoinCode}
        onPress={() => onAllowJoinCodeChange(!allowJoinCode)}
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
          disabled={!homeName.trim()}
          onPress={onSubmit}
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
