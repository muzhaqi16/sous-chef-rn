import React, { useState, useEffect } from 'react';
import { View, Modal, TextInput } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { errorMessageOr } from '#/services/errorService';
import { OnPrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

export interface NumberInputModalProps {
  /**
   * Whether the modal is visible
   */
  visible: boolean;

  /**
   * Modal title
   */
  title: string;

  /**
   * Current value
   */
  value?: number | null;

  /**
   * Callback when save is pressed
   * Should return true on success, false on failure
   */
  onSave: (value: number) => Promise<boolean> | boolean;

  /**
   * Callback when cancel/close is pressed
   */
  onCancel: () => void;

  /**
   * Minimum allowed value (inclusive)
   */
  min?: number;

  /**
   * Maximum allowed value (inclusive)
   */
  max?: number;

  /**
   * Input placeholder
   */
  placeholder?: string;

  /**
   * Field label (displayed above input)
   */
  label?: string;

  /**
   * Helper text displayed below label
   */
  helperText?: string;

  /**
   * Unit to display (e.g., 'minutes', 'kcal', 'g')
   */
  unit?: string;

  /**
   * Allow decimal values (default: false)
   */
  allowDecimals?: boolean;

  /**
   * Required field (default: true)
   */
  required?: boolean;

  /**
   * Custom validation function
   * Return error message if invalid, null if valid
   */
  validate?: (value: number) => string | null;

  /**
   * Save button label (default: 'Save')
   */
  saveButtonLabel?: string;

  /**
   * Cancel button label (default: 'Cancel')
   */
  cancelButtonLabel?: string;
}

/**
 * NumberInputModal - A reusable modal for number input with validation
 *
 * Provides a complete modal UI for entering numeric values with
 * min/max validation, decimal support, and error handling.
 *
 * **Eliminates 100+ lines per usage** (6 times in DietaryProfile = 600 lines).
 *
 * @example Basic usage
 * ```tsx
 * <NumberInputModal
 *   visible={isEditingMeals}
 *   title="Meals Per Day"
 *   value={profile.mealsPerDay}
 *   onSave={async (value) => {
 *     return await updateProfile({ mealsPerDay: value });
 *   }}
 *   onCancel={() => setIsEditingMeals(false)}
 *   min={1}
 *   max={6}
 * />
 * ```
 *
 * @example With units and helper text
 * ```tsx
 * <NumberInputModal
 *   visible={editingPrepTime}
 *   title="Max Prep Time"
 *   label="Maximum preparation time"
 *   helperText="How much time you're willing to spend preparing a meal"
 *   value={profile.maxPrepTimeMinutes}
 *   onSave={handleSavePrepTime}
 *   onCancel={handleCancel}
 *   min={0}
 *   max={480}
 *   unit="minutes"
 *   placeholder="e.g., 30"
 * />
 * ```
 *
 * @example With decimal support
 * ```tsx
 * <NumberInputModal
 *   visible={editingBudget}
 *   title="Budget Per Meal"
 *   value={profile.budgetPerMeal}
 *   onSave={handleSave}
 *   onCancel={handleCancel}
 *   min={0}
 *   max={1000}
 *   unit="USD"
 *   allowDecimals
 *   placeholder="e.g., 15.50"
 * />
 * ```
 */
/** Module-level helper to initialize modal input when it opens */
function initNumberInputModal(
  value: number | null | undefined,
  setInputValue: (v: string) => void,
  setError: (v: string) => void,
) {
  setInputValue(value !== null && value !== undefined ? String(value) : '');
  setError('');
}

export const NumberInputModal: React.FC<NumberInputModalProps> = ({
  visible,
  title,
  value,
  onSave,
  onCancel,
  min,
  max,
  placeholder,
  label,
  helperText,
  unit,
  allowDecimals = false,
  required = true,
  validate,
  saveButtonLabel,
  cancelButtonLabel,
}) => {
  const { t } = useTranslation();
  const resolvedSaveLabel = saveButtonLabel ?? t('labels.save');
  const resolvedCancelLabel = cancelButtonLabel ?? t('labels.cancel');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize input value when modal opens
  useEffect(() => {
    if (visible) {
      initNumberInputModal(value, setInputValue, setError);
    }
  }, [visible, value]);

  const validateInput = (numValue: number): string | null => {
    // Check required
    if (required && (isNaN(numValue) || inputValue.trim() === '')) {
      return t('numberInputModal.required');
    }

    // Check min
    if (min !== undefined && numValue < min) {
      return t('numberInputModal.minError', {
        value: `${min}${unit ? ` ${unit}` : ''}`,
      });
    }

    // Check max
    if (max !== undefined && numValue > max) {
      return t('numberInputModal.maxError', {
        value: `${max}${unit ? ` ${unit}` : ''}`,
      });
    }

    // Custom validation
    if (validate) {
      return validate(numValue);
    }

    return null;
  };

  const handleSave = () => {
    setError('');

    // Parse input
    const numValue = allowDecimals
      ? parseDecimalInput(inputValue)
      : parseInt(inputValue);

    // Validate
    const validationError = validateInput(numValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    executeWithLoadingState(
      async () => {
        const success = await onSave(numValue);

        if (success) {
          onCancel(); // Close modal on success
        } else {
          setError(t('errors.saveFailed'));
        }
      },
      setLoading,
      (err: unknown) => {
        setError(errorMessageOr(err, t('errors.generic')));
      },
    );
  };

  const handleCancel = () => {
    setError('');
    setInputValue('');
    onCancel();
  };

  const getRangeText = () => {
    if (min !== undefined && max !== undefined) {
      return `(${min}-${max}${unit ? ` ${unit}` : ''})`;
    }
    if (min !== undefined) {
      return t('numberInputModal.minRange', {
        value: `${min}${unit ? ` ${unit}` : ''}`,
      });
    }
    if (max !== undefined) {
      return t('numberInputModal.maxRange', {
        value: `${max}${unit ? ` ${unit}` : ''}`,
      });
    }
    return '';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={localStyles.modalOverlay}>
        <View style={[commonStyles.card, localStyles.modalContent]}>
          {/* Title */}
          <Text style={commonStyles.h3}>{title}</Text>

          {/* Label and helper text */}
          {!!(label || helperText) && (
            <View style={localStyles.labelContainer}>
              {!!label && (
                <Text style={commonStyles.body}>
                  {label} {getRangeText()}
                </Text>
              )}
              {!!helperText && (
                <Text
                  style={[commonStyles.bodySecondary, localStyles.helperText]}
                >
                  {helperText}
                </Text>
              )}
            </View>
          )}

          {/* Input */}
          <TextInput
            style={[
              commonStyles.input,
              localStyles.numberInput,
              error && localStyles.inputError,
            ]}
            value={inputValue}
            onChangeText={text => {
              setInputValue(text);
              setError(''); // Clear error on input
            }}
            keyboardType={allowDecimals ? 'decimal-pad' : 'number-pad'}
            placeholder={
              placeholder ||
              t('numberInputModal.enterPlaceholder', {
                title: title.toLowerCase(),
              })
            }
            autoFocus
            editable={!loading}
          />

          {/* Error message */}
          {error ? <Text style={localStyles.errorText}>{error}</Text> : null}

          {/* Buttons */}
          <View style={localStyles.modalButtons}>
            <AppPressable
              style={[commonStyles.button, localStyles.modalButton]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={commonStyles.buttonText}>{resolvedCancelLabel}</Text>
            </AppPressable>

            <AppPressable
              style={[
                commonStyles.button,
                commonStyles.buttonPrimary,
                localStyles.modalButton,
                loading && localStyles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <OnPrimaryActivityIndicator />
              ) : (
                <Text
                  style={[
                    commonStyles.buttonText,
                    commonStyles.buttonTextPrimary,
                  ]}
                >
                  {resolvedSaveLabel}
                </Text>
              )}
            </AppPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const localStyles = StyleSheet.create(theme => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: theme.sizes.modal.md,
    padding: theme.spacing.lg,
  },
  labelContainer: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  helperText: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm - 1,
  },
  numberInput: {
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.fonts.weight.semibold,
  },
  inputError: {
    borderColor: theme.colors.danger,
    borderWidth: 1,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.fontSize.sm,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: theme.opacity.disabled,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
