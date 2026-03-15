import React, { useState } from 'react';
import { View, Text } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

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
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      visible,
      onDismiss: onClose,
      snapPoints: ['30%'],
    });

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
      ? parseFloat(inputValue)
      : parseInt(inputValue);

    if (isNaN(numValue) || inputValue.trim() === '') {
      setError('This field is required');
      return;
    }
    if (min !== undefined && numValue < min) {
      setError(`Value must be at least ${min}`);
      return;
    }
    if (max !== undefined && numValue > max) {
      setError(`Value must be at most ${max}`);
      return;
    }

    executeWithLoadingState(
      async () => {
        const success = await onSave(numValue);
        if (success) {
          onClose();
        } else {
          setError('Failed to save');
        }
      },
      setLoading,
      (err: unknown) => {
        setError((err as any).message || 'An error occurred');
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

  return (
    <BottomSheetModal ref={ref} {...modalProps} index={0}>
      <BottomSheetView style={[styles.content, contentContainerStyle]}>
        <BottomSheetHeader
          title={title}
          onCancel={handleCancel}
          onConfirm={handleSave}
          confirmDisabled={loading}
        />

        <View style={styles.inputContainer}>
          {!!rangeText && (
            <Text
              style={[styles.rangeText, { color: theme.colors.textSecondary }]}
            >
              {rangeText}
            </Text>
          )}

          <BottomSheetTextInput
            style={[
              styles.input,
              {
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: error ? theme.colors.error : theme.colors.border,
              },
            ]}
            value={inputValue}
            onChangeText={text => {
              setInputValue(text);
              setError('');
            }}
            keyboardType={allowDecimals ? 'decimal-pad' : 'number-pad'}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textTertiary}
            autoFocus
            editable={!loading}
          />

          {!!error && (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          )}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
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
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.sm,
  },
  input: {
    width: '100%',
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.fonts.weight.semibold,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
}));
