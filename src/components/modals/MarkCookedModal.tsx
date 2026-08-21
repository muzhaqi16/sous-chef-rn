import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/molecules/FormInput';
import { BottomSheetHeader } from '#components/atoms/BottomSheetHeader';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Text } from '#components/atoms/Text';

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
  const { t } = useTranslation();
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['55%'],
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
      >
        {/* Header — no title; the "Mark Cooked" action and the recipe name
            below already convey intent. */}
        <BottomSheetHeader
          onCancel={onClose}
          onConfirm={handleConfirm}
          confirmLabel={t('markCookedModal.markCooked')}
          confirmColor="success"
        />

        {/* Recipe Info */}
        <View style={styles.recipeInfo}>
          <Text size="md" weight="semibold" numberOfLines={2}>
            {recipeName}
          </Text>
        </View>

        {/* Servings Input */}
        <View style={styles.section}>
          <FractionInput
            label={t('markCookedModal.servingsMade')}
            value={servingsInput}
            onChangeText={setServingsInput}
            placeholder={t('markCookedModal.servingsPlaceholderPrefix', {
              count: defaultServings || 1,
            })}
            keyboardType="numeric"
          />
        </View>

        {/* Deduct from Pantry Toggle */}
        <View style={styles.toggleSection}>
          <View style={styles.toggleInfo}>
            <Text size="base" weight="medium">
              {t('markCookedModal.deductFromPantry')}
            </Text>
            <Text size="sm" tone="secondary" style={styles.toggleDescription}>
              {t('markCookedModal.deductFromPantryDesc')}
            </Text>
          </View>
          <BaseSwitch
            value={deductFromPantry}
            onValueChange={setDeductFromPantry}
          />
        </View>

        {/* Deduction Mode - only shown when deductFromPantry is ON and user has a pantry */}
        {!!deductFromPantry && !!hasPantry && (
          <View style={styles.toggleSection}>
            <View style={styles.toggleInfo}>
              <Text size="base" weight="medium">
                {t('markCookedModal.smartDeduction')}
              </Text>
              <Text size="sm" tone="secondary" style={styles.toggleDescription}>
                {t('markCookedModal.smartDeductionDesc')}
              </Text>
            </View>
            <BaseSwitch
              value={useGranularDeduction}
              onValueChange={setUseGranularDeduction}
            />
          </View>
        )}

        {/* Notes (Optional) */}
        <View style={styles.section}>
          <FormInput
            label={t('markCookedModal.notesOptional')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('markCookedModal.notesPlaceholder')}
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
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing['3'],
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
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
    borderCurve: 'continuous',
  },
  toggleInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  toggleDescription: {
    marginTop: theme.spacing.xs,
  },
}));
