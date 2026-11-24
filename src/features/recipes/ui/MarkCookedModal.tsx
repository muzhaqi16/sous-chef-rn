import React, { useState } from 'react';
import { SheetHeader } from '#components/templates/SheetHeader';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { FractionInput } from '#components/molecules/FractionInput';
import { FormInput } from '#components/atoms/FormInput';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { Text } from '#components/atoms/Text';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import type { CookConfirmOutcome } from '#features/recipes/types';

interface MarkCookedModalProps {
  visible: boolean;
  recipeName: string;
  defaultServings: number;
  onClose: () => void;
  /** Closes the sheet unless the cook answers that it stays open. */
  onConfirm: (input: {
    servings: number;
    deductFromPantry: boolean;
    useGranularDeduction: boolean;
    notes?: string;
  }) => void | Promise<CookConfirmOutcome>;
  hasPantry?: boolean;
  /** A planned meal records whole servings; a recipe cook scales by any amount. */
  wholeServings?: boolean;
}

type MarkCookedFormProps = Omit<MarkCookedModalProps, 'visible'>;

/** One opening, on the recipe's servings with the pantry deducted. */
const MarkCookedForm: React.FC<MarkCookedFormProps> = ({
  recipeName,
  defaultServings,
  onClose,
  onConfirm,
  hasPantry = false,
  wholeServings = false,
}) => {
  const { t } = useTranslation();

  const [servingsInput, setServingsInput] = useState(String(defaultServings));
  const [deductFromPantry, setDeductFromPantry] = useState(true);
  const [useGranularDeduction, setUseGranularDeduction] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewUnavailable, setReviewUnavailable] = useState(false);

  // Empty means "as many as the recipe makes". A TYPED value that is not a
  // positive number is refused on `servingsMade`, so it is reported, not
  // swapped for the default. `null` = use the default, `undefined` = unusable.
  const typedServings = servingsInput.trim();
  const parsedServings = typedServings
    ? parseFractionalInput(typedServings)
    : null;
  // The parser reports "cannot read this" with the same `null` the empty field
  // uses, so the two are separated here: substituting the default for text
  // nobody could read cooks — and deducts — a number never entered.
  const servingsUnreadable = !!typedServings && parsedServings == null;
  // A planned meal's servings are an Int, so there a fraction refuses the
  // whole request.
  const servingsError =
    servingsUnreadable ||
    (parsedServings != null &&
      (parsedServings <= 0 ||
        (wholeServings && !Number.isInteger(parsedServings))))
      ? t(wholeServings ? 'errors.field.servingsMade' : 'errors.field.servings')
      : undefined;

  const handleConfirm = async () => {
    if (servingsError || saving) return;
    setSaving(true);
    const outcome = await onConfirm({
      servings: parsedServings ?? defaultServings,
      deductFromPantry,
      useGranularDeduction:
        deductFromPantry && hasPantry && useGranularDeduction,
      notes: notes || undefined,
    });
    setSaving(false);
    if (outcome === 'retry') return;
    if (outcome === 'reviewUnavailable') {
      // Confirmed again, the cook deducts what the recipe uses, unreviewed.
      setUseGranularDeduction(false);
      setReviewUnavailable(true);
      return;
    }
    onClose();
  };

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('markCookedModal.markCooked')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void handleConfirm();
            },
            accessibilityLabel: t('markCookedModal.markCooked'),
            // The servings field says why.
            disabled: !!servingsError,
            loading: saving,
            testID: recipesTestIDs.cookConfirm,
          }}
        />
      </SheetHeaderSlot>

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
          error={servingsError}
          testID={recipesTestIDs.cookServings}
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
      {reviewUnavailable && deductFromPantry && !useGranularDeduction ? (
        <Text
          role="caption"
          tone="warning"
          testID={recipesTestIDs.cookReviewUnavailable}
        >
          {t('markCookedModal.reviewUnavailable', {
            action: t('markCookedModal.markCooked'),
          })}
        </Text>
      ) : null}

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
    </>
  );
};

export const MarkCookedModal: React.FC<MarkCookedModalProps> = ({
  visible,
  ...form
}) => {
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={['55%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      {opening ? <MarkCookedForm key={opening.id} {...form} /> : null}
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
