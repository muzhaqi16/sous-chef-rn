import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedActivityIndicator,
  ThemedBottomSheetTextInput,
  type ThemedBottomSheetTextInputRef,
} from '#components/atoms/themedComponents';
import { StorageType } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { Divider } from '#components/atoms/Divider';
import { Sheet } from '#components/templates/Sheet';

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

/** Name-only quick create from PantryMain; the location gets the default type. */
export const AddStorageLocationSheet: React.FC<
  AddStorageLocationSheetProps
> = ({ visible, onClose, onCreateLocation, creating = false }) => {
  const { t } = useTranslation();
  const inputRef = useRef<ThemedBottomSheetTextInputRef>(null);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset state when sheet closes (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) {
      setName('');
      setError(null);
    }
  }

  // Focus input after sheet open animation completes
  useEffect(() => {
    if (visible) {
      requestIdleCallback(() => inputRef.current?.focus());
    }
  }, [visible]);

  const handleCreate = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError(t('addStorageLocation.nameRequired'));
      return;
    }

    if (trimmedName.length < 2) {
      setError(t('commonValidation.nameMin'));
      return;
    }

    const result = await executeCreateLocation(onCreateLocation, {
      name: trimmedName,
      type: StorageType.Custom,
    });
    if (result.failed) {
      setError(t('addStorageLocation.createFailed'));
    } else {
      onClose();
    }
  };

  const handleCancel = () => {
    setName('');
    setError(null);
    onClose();
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (error) setError(null);
  };

  const isCreateDisabled = creating || name.trim().length < 2;

  styles.useVariants({ error: !!error });

  return (
    <Sheet
      mode="view"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['35%']}
      contentContainerStyle={styles.content}
    >
      {/* Header with Cancel/Create */}
      <View style={styles.header}>
        <AppPressable
          onPress={handleCancel}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('labels.cancel')}
        >
          <Text tone="secondary">{t('labels.cancel')}</Text>
        </AppPressable>

        <Text role="heading" align="center" style={styles.title}>
          {t('labels.addLocation')}
        </Text>

        <AppPressable
          onPress={handleCreate}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={t('labels.create')}
          disabled={isCreateDisabled}
        >
          {creating ? (
            <ThemedActivityIndicator size="small" />
          ) : (
            <Text
              role="bodyStrong"
              align="right"
              tone={isCreateDisabled ? 'tertiary' : 'accent'}
            >
              {t('labels.create')}
            </Text>
          )}
        </AppPressable>
      </View>

      {/* Divider */}
      <Divider style={styles.dividerGap} />

      {/* Input Field */}
      <View style={styles.inputContainer}>
        <Text role="label" tone="secondary" style={styles.label}>
          {t('addStorageLocation.locationName')}
        </Text>

        <ThemedBottomSheetTextInput
          ref={inputRef}
          style={styles.input}
          defaultValue={name}
          onChangeText={handleNameChange}
          placeholder={t('addStorageLocation.namePlaceholder')}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={50}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        {!!error && (
          <Text role="caption" tone="error" style={styles.errorText}>
            {error}
          </Text>
        )}

        <Text role="caption" tone="tertiary" style={styles.hint}>
          {t('addStorageLocation.hintText')}
        </Text>
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  headerButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    minWidth: 60,
  },
  title: {
    flex: 1,
  },
  dividerGap: {
    marginBottom: theme.spacing.lg,
  },
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export default AddStorageLocationSheet;
