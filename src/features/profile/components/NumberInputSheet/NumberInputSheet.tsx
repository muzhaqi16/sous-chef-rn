import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { localizedErrorMessage } from '#/services/errorService';
import { Text } from '#components/atoms/Text';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { Sheet } from '#components/templates/Sheet';

interface NumberInputSheetProps {
  visible: boolean;
  title: string;
  value?: number | null;
  onSave: (value: number) => Promise<boolean> | boolean;
  onClose: () => void;
  min?: number;
  max?: number;
  placeholder?: string;
  allowDecimals?: boolean;
}

export const NumberInputSheet: React.FC<NumberInputSheetProps> = ({
  visible,
  title,
  value,
  onSave,
  onClose,
  min,
  max,
  placeholder,
  allowDecimals = false,
}) => {
  const { t } = useTranslation();

  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [prevVisible, setPrevVisible] = useState(false);

  // Adjust state during render — reset when sheet opens
  if (visible && !prevVisible) {
    setInputValue(value !== null && value !== undefined ? String(value) : '');
    setError('');
  }
  if (visible !== prevVisible) {
    setPrevVisible(visible);
  }

  const handleSave = () => {
    setError('');

    const numValue = allowDecimals
      ? parseDecimalInput(inputValue)
      : parseInt(inputValue);

    if (isNaN(numValue) || inputValue.trim() === '') {
      setError(t('labels.thisFieldIsRequired'));
      return;
    }
    if (min !== undefined && numValue < min) {
      setError(t('numberInputSheet.minError', { min }));
      return;
    }
    if (max !== undefined && numValue > max) {
      setError(t('numberInputSheet.maxError', { max }));
      return;
    }

    executeWithLoadingState(
      async () => {
        const success = await onSave(numValue);
        if (success) {
          onClose();
        } else {
          setError(t('errors.saveFailed'));
        }
      },
      setLoading,
      (err: unknown) => {
        setError(localizedErrorMessage(err, t('errors.generic')));
      },
    );
  };

  const handleCancel = () => {
    setError('');
    setInputValue('');
    onClose();
  };

  const rangeText =
    min !== undefined && max !== undefined ? `(${min}-${max})` : '';

  styles.useVariants({ error: !!error });

  return (
    <Sheet
      mode="view"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['30%']}
      contentContainerStyle={styles.content}
    >
      <BottomSheetHeader
        title={title}
        onCancel={handleCancel}
        onConfirm={handleSave}
        confirmDisabled={loading}
      />

      <View style={styles.inputContainer}>
        {!!rangeText && (
          <Text role="caption" tone="secondary" style={styles.rangeText}>
            {rangeText}
          </Text>
        )}

        <ThemedBottomSheetTextInput
          style={styles.input}
          value={inputValue}
          onChangeText={text => {
            setInputValue(text);
            setError('');
          }}
          keyboardType={allowDecimals ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          autoFocus
          editable={!loading}
        />

        {!!error && (
          <Text role="caption" tone="error" style={styles.errorText}>
            {error}
          </Text>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  inputContainer: {
    alignItems: 'center',
  },
  rangeText: {
    marginBottom: theme.spacing.sm,
  },
  input: {
    width: '100%',
    ...theme.type.title,
    textAlign: 'center',
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
}));
