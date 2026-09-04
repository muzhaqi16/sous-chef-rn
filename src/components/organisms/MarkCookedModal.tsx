import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Text } from '#components/atoms/Text';
import { Sheet } from '#components/templates/Sheet';

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

  // Empty means "as many as the recipe makes" — the field opens pre-filled and
  // the placeholder says so. A value the user TYPED that is not a positive
  // number is a different thing: the server refuses it on `servingsMade`, and
  // silently cooking a different number of servings than was entered is worse
  // than saying so. `null` = use the default, `undefined` = unusable.
  const typedServings = servingsInput.trim();
  const parsedServings = typedServings
    ? parseFractionalInput(typedServings)
    : null;
  const servingsError =
    parsedServings != null && (isNaN(parsedServings) || parsedServings <= 0)
      ? t('errors.field.servingsMade')
      : undefined;

  const handleConfirm = () => {
    if (servingsError) return;

    onConfirm({
      servings: parsedServings ?? defaultServings ?? 1,
      deductFromPantry,
      useGranularDeduction:
        deductFromPantry && hasPantry && useGranularDeduction,
      notes: notes || undefined,
    });
    onClose();
  };

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['55%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      {/* Header — no title; the "Mark Cooked" action and the recipe name
            below already convey intent. */}
      <BottomSheetHeader
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel={t('markCookedModal.markCooked')}
        confirmColor="success"
        confirmDisabled={!!servingsError}
      />

      {/* Recipe Info */}
      <View style={styles.recipeInfo}>
        <Text role="bodyStrong" numberOfLines={2}>
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
          error={servingsError}
        />
      </View>

      {/* Deduct from Pantry Toggle */}
      <View style={styles.toggleSection}>
        <View style={styles.toggleInfo}>
          <Text role="bodyStrong">{t('markCookedModal.deductFromPantry')}</Text>
          <Text
            role="caption"
            tone="secondary"
            style={styles.toggleDescription}
          >
            {t('markCookedModal.deductFromPantryDesc')}
          </Text>
        </View>
        <BaseSwitch
          accessibilityLabel={t('markCookedModal.deductFromPantry')}
          value={deductFromPantry}
          onValueChange={setDeductFromPantry}
        />
      </View>

      {/* Deduction Mode - only shown when deductFromPantry is ON and user has a pantry */}
      {!!deductFromPantry && !!hasPantry && (
        <View style={styles.toggleSection}>
          <View style={styles.toggleInfo}>
            <Text role="bodyStrong">{t('markCookedModal.smartDeduction')}</Text>
            <Text
              role="caption"
              tone="secondary"
              style={styles.toggleDescription}
            >
              {t('markCookedModal.smartDeductionDesc')}
            </Text>
          </View>
          <BaseSwitch
            accessibilityLabel={t('markCookedModal.smartDeduction')}
            value={useGranularDeduction}
            onValueChange={setUseGranularDeduction}
          />
        </View>
      )}

      {/* Notes (Optional) */}
      <View style={styles.section}>
        <FormInput
          label={t('labels.notesOptional')}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('markCookedModal.notesPlaceholder')}
          multiline
          numberOfLines={2}
        />
      </View>
    </Sheet>
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
    paddingHorizontal: theme.spacing.base,
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
