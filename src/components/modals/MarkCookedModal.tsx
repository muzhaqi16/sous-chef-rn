import React, { useState } from 'react';
import { View, Text, Switch } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { parseFractionalInput } from '#/utils/fractionUtils';

interface MarkCookedModalProps {
  visible: boolean;
  recipeName: string;
  defaultServings: number;
  onClose: () => void;
  onConfirm: (input: {
    servings: number;
    deductFromPantry: boolean;
    useGranularDeduction: boolean;
    notes?: string;
  }) => void;
  hasPantry?: boolean;
}

export const MarkCookedModal: React.FC<MarkCookedModalProps> = ({
  visible,
  recipeName,
  defaultServings,
  onClose,
  onConfirm,
  hasPantry = false,
}) => {
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      visible,
      onDismiss: onClose,
      snapPoints: ['55%'],
      keyboardAware: true,
    });

  // Form state
  const [servingsInput, setServingsInput] = useState('');
  const [deductFromPantry, setDeductFromPantry] = useState(true);
  const [useGranularDeduction, setUseGranularDeduction] = useState(true);
  const [notes, setNotes] = useState('');

  // Reset form when modal opens (render-time state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevDefaultServings, setPrevDefaultServings] =
    useState(defaultServings);
  if (visible !== prevVisible || defaultServings !== prevDefaultServings) {
    setPrevVisible(visible);
    setPrevDefaultServings(defaultServings);
    if (visible) {
      setServingsInput(defaultServings?.toString() || '1');
      setDeductFromPantry(true);
      setUseGranularDeduction(true);
      setNotes('');
    }
  }

  const handleConfirm = () => {
    const servingsValue = parseFractionalInput(servingsInput);
    const finalServings =
      servingsValue && !isNaN(servingsValue) && servingsValue > 0
        ? servingsValue
        : defaultServings || 1;

    onConfirm({
      servings: finalServings,
      deductFromPantry,
      useGranularDeduction:
        deductFromPantry && hasPantry && useGranularDeduction,
      notes: notes || undefined,
    });
    onClose();
  };

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetFormScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        {/* Header */}
        <BottomSheetHeader
          title="I Cooked This!"
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel="Mark Cooked"
          confirmColor="success"
        />

        {/* Recipe Info */}
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName}>{recipeName}</Text>
        </View>

        {/* Servings Input */}
        <View style={styles.section}>
          <FractionInput
            label="Servings Made"
            value={servingsInput}
            onChangeText={setServingsInput}
            placeholder={`e.g., ${defaultServings || 1}`}
            keyboardType="numeric"
          />
        </View>

        {/* Deduct from Pantry Toggle */}
        <View style={styles.toggleSection}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Deduct from Pantry</Text>
            <Text style={styles.toggleDescription}>
              Automatically reduce ingredient quantities in your pantry
            </Text>
          </View>
          <Switch
            value={deductFromPantry}
            onValueChange={setDeductFromPantry}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.primary,
            }}
            thumbColor={theme.colors.white}
          />
        </View>

        {/* Deduction Mode - only shown when deductFromPantry is ON and user has a pantry */}
        {!!deductFromPantry && !!hasPantry && (
          <View style={styles.toggleSection}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Smart Deduction</Text>
              <Text style={styles.toggleDescription}>
                Review and adjust ingredient quantities before deducting
              </Text>
            </View>
            <Switch
              value={useGranularDeduction}
              onValueChange={setUseGranularDeduction}
              trackColor={{
                false: theme.colors.border,
                true: theme.colors.primary,
              }}
              thumbColor={theme.colors.white}
            />
          </View>
        )}

        {/* Notes (Optional) */}
        <View style={styles.section}>
          <FormInput
            label="Notes (Optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it turn out?"
            multiline
            numberOfLines={2}
          />
        </View>
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  recipeInfo: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  recipeName: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleLabel: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  toggleDescription: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
}));
