import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { lazyMessage, reportValidationErrors } from '#utils/validation/common';

interface NewFolderFormValues {
  name: string;
}

const newFolderSchema: ObjectSchema<NewFolderFormValues> = object({
  name: string().trim().required(lazyMessage('folderPicker.nameRequired')),
});

interface NewFolderFormProps {
  /** Called with the trimmed name. */
  onCreate: (name: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** A new folder's name, mounted fresh each time the create row opens. */
export const NewFolderForm: React.FC<NewFolderFormProps> = ({
  onCreate,
  style,
}) => {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<NewFolderFormValues>({
    resolver: yupResolver(newFolderSchema),
    defaultValues: { name: '' },
  });
  const create = handleSubmit(({ name }) => {
    onCreate(name);
  }, reportValidationErrors);

  return (
    <Controller
      control={control}
      name="name"
      render={({ field, fieldState }) => (
        <View style={style}>
          <View style={styles.row}>
            <ThemedBottomSheetTextInput
              style={styles.input}
              placeholder={t('labels.enterFolderName')}
              defaultValue={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoFocus
              autoCapitalize="words"
              onSubmitEditing={() => {
                void create();
              }}
            />
            <AppPressable
              style={styles.createButton}
              onPress={() => {
                void create();
              }}
            >
              <Text role="bodyStrong" style={styles.createButtonText}>
                {t('labels.create')}
              </Text>
            </AppPressable>
          </View>
          {fieldState.error ? (
            <Text role="error" tone="error" style={styles.errorText}>
              {fieldState.error.message}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.base,
    ...theme.type.body,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  createButtonText: {
    color: theme.colors.onPrimary,
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
}));
