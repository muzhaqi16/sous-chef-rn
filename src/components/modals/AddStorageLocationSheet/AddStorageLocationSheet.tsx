import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import {
  ThemedActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StorageType } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';

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

/**
 * AddStorageLocationSheet - Simple bottom sheet for quick storage location creation
 *
 * Features:
 * - Text input for location name
 * - Cancel/Create buttons
 * - Creates location with default type (Other)
 * - Used from PantryMain for quick creation
 */
export const AddStorageLocationSheet: React.FC<
  AddStorageLocationSheetProps
> = ({ visible, onClose, onCreateLocation, creating = false }) => {
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['35%'],
  });
  const inputRef =
    useRef<React.ComponentRef<typeof BottomSheetTextInput>>(null);

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
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetView style={[styles.content, contentContainerStyle]}>
        {/* Header with Cancel/Create */}
        <View style={styles.header}>
          <AppPressable
            onPress={handleCancel}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel={t('labels.cancel')}
          >
            <Text size="md" tone="secondary">
              {t('labels.cancel')}
            </Text>
          </AppPressable>

          <Text size="lg" weight="semibold" align="center" style={styles.title}>
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
                size="md"
                weight="semibold"
                align="right"
                tone={isCreateDisabled ? 'tertiary' : 'accent'}
              >
                {t('labels.create')}
              </Text>
            )}
          </AppPressable>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Input Field */}
        <View style={styles.inputContainer}>
          <Text size="sm" weight="medium" tone="secondary" style={styles.label}>
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
            <Text size="sm" tone="error" style={styles.errorText}>
              {error}
            </Text>
          )}

          <Text size="xs" tone="tertiary" style={styles.hint}>
            {t('addStorageLocation.hintText')}
          </Text>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
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
  divider: {
    height: 1,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.border,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    marginBottom: theme.spacing.sm,
  },
  input: {
    fontSize: theme.typography.fontSize.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
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
