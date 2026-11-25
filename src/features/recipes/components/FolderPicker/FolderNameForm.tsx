import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import {
  OnPrimaryActivityIndicator,
  ThemedTextInput,
} from '#components/atoms/themedComponents';
import { reportValidationErrors } from '#utils/validation/common';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';

import {
  folderNameSchema,
  type FolderNameFormContext,
  type FolderNameFormValues,
} from './folderNameFormConfig';

interface FolderNameFormProps {
  /** Called with the trimmed name. */
  onSubmit: (name: string) => void;
  /** Its action's label: Create, or Rename. */
  actionLabel: string;
  /** The name it starts from; empty for a new folder. */
  initialName?: string;
  /** Names other folders already have, refused on the field. */
  takenNames?: readonly string[];
  /** While the action runs, its button waits. */
  busy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A folder's name, new or renamed, mounted fresh each time it opens. */
export const FolderNameForm: React.FC<FolderNameFormProps> = ({
  onSubmit,
  actionLabel,
  initialName = '',
  takenNames = [],
  busy = false,
  placeholder,
  autoFocus = false,
  style,
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<FolderNameFormValues, FolderNameFormContext>({
    resolver: yupResolver(folderNameSchema),
    defaultValues: { name: initialName },
    context: { takenNames },
  });
  useSheetUnsavedInput(isDirty);
  const submit = handleSubmit(({ name }) => {
    onSubmit(name);
  }, reportValidationErrors);

  return (
    <Controller
      control={control}
      name="name"
      render={({ field, fieldState }) => (
        <View style={style}>
          <View style={styles.row}>
            <ThemedTextInput
              style={styles.input}
              placeholder={placeholder ?? t('labels.enterFolderName')}
              defaultValue={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoFocus={autoFocus}
              autoCapitalize="words"
              editable={!busy}
              onSubmitEditing={() => {
                void submit();
              }}
            />
            <AppPressable
              style={styles.actionButton}
              onPress={() => {
                void submit();
              }}
              disabled={busy}
            >
              {busy ? (
                <OnPrimaryActivityIndicator size="small" />
              ) : (
                <Text role="bodyStrong" style={styles.actionButtonText}>
                  {actionLabel}
                </Text>
              )}
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
  actionButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.base,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  actionButtonText: {
    color: theme.colors.onPrimary,
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
}));
