import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useController, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#i18n';
import { ThemedTextInput } from '#components/atoms/themedComponents';
import { StorageType } from '#graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { reportValidationErrors } from '#utils/validation/common';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';
import {
  addStorageLocationSchema,
  type AddStorageLocationFormValues,
} from './addStorageLocationFormConfig';

/** Module-level async wrapper to keep try-catch out of the component body (React Compiler). */
async function executeCreateLocation(
  createFn: (input: { name: string; type: StorageType }) => Promise<unknown>,
  input: { name: string; type: StorageType },
): Promise<{ failed?: boolean }> {
  try {
    await createFn(input);
    return {};
  } catch {
    return { failed: true };
  }
}

interface AddStorageLocationSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreateLocation: (input: {
    name: string;
    type: StorageType;
  }) => Promise<unknown>;
  creating?: boolean;
}

type AddStorageLocationFormProps = Omit<
  AddStorageLocationSheetProps,
  'visible'
>;

const AddStorageLocationForm: React.FC<AddStorageLocationFormProps> = ({
  onClose,
  onCreateLocation,
  creating = false,
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { isDirty },
  } = useForm<AddStorageLocationFormValues>({
    resolver: yupResolver(addStorageLocationSchema),
    defaultValues: { name: '' },
  });
  useSheetUnsavedInput(isDirty);
  const {
    field: { ref, ...field },
    fieldState,
  } = useController({ control, name: 'name' });

  // Focus once the sheet's open animation has run.
  useEffect(() => {
    requestIdleCallback(() => setFocus('name'));
  }, [setFocus]);

  const create = handleSubmit(async ({ name }) => {
    const result = await executeCreateLocation(onCreateLocation, {
      name,
      type: StorageType.Custom,
    });
    if (result.failed) {
      setError('name', { message: t('addStorageLocation.createFailed') });
    } else {
      onClose();
    }
  }, reportValidationErrors);

  const variantStyles = styles.useVariants({ error: !!fieldState.error });

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('labels.addLocation')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void create();
            },
            accessibilityLabel: t('labels.create'),
            loading: creating,
          }}
        />
      </SheetHeaderSlot>

      <View style={variantStyles.inputContainer}>
        <Text role="label" tone="secondary" style={variantStyles.label}>
          {t('addStorageLocation.locationName')}
        </Text>

        <ThemedTextInput
          ref={ref}
          style={variantStyles.input}
          defaultValue={field.value}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          placeholder={t('addStorageLocation.namePlaceholder')}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={50}
          returnKeyType="done"
          onSubmitEditing={() => {
            void create();
          }}
        />
        {fieldState.error ? (
          <Text role="error" tone="error" style={variantStyles.errorText}>
            {fieldState.error.message}
          </Text>
        ) : null}

        <Text role="caption" tone="tertiary" style={variantStyles.hint}>
          {t('addStorageLocation.hintText')}
        </Text>
      </View>
    </>
  );
};

/** Name-only quick create from PantryMain; the location gets the default type. */
export const AddStorageLocationSheet: React.FC<
  AddStorageLocationSheetProps
> = ({ visible, ...form }) => {
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={['35%']}
    >
      {opening ? <AddStorageLocationForm key={opening.id} {...form} /> : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    marginBottom: theme.spacing.sm,
  },
  input: {
    ...theme.type.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceVariant,
    borderColor: theme.colors.border,
    variants: {
      error: {
        true: { borderColor: theme.colors.error },
      },
    },
  },
  errorText: {
    marginTop: theme.spacing.xs,
  },
  hint: {
    marginTop: theme.spacing.sm,
  },
}));
