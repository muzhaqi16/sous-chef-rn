import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { DropdownStack } from '#components/atoms/DropdownStack';
import {
  BottomSheetModal,
  useStandardBottomSheet,
} from '#hooks/useStandardBottomSheet';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { ItemAutocompleteField } from '#features/catalog/ui/autocomplete/ItemAutocompleteField';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { FormInput } from '#components/atoms/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/atoms/FieldRow';
import { AnimatedChip } from '#components/molecules/AnimatedChip';
import { SheetHeader } from '#components/templates/SheetHeader';
import { generateId } from '#/utils/generateId';
import type { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import type { IngredientFormState } from '#features/recipes/screens/RecipeForm/formState';
import { Text } from '#components/atoms/Text';
import { parseFractionalInput } from '#/utils/fractionUtils';
import type { CaptureCandidate } from '#features/recipes/hooks/useCaptureReview';
import { formatQuantityForInput } from '#/utils/formatQuantity';

export interface RecipeIngredientEditorRef {
  open: (ingredient?: IngredientFormState) => void;
  close: () => void;
}

interface RecipeIngredientEditorProps {
  onSave: (ingredient: IngredientFormState) => void;
  /** Items a capture proposed for a line it did not link, by the line as written. */
  candidatesFor?: (
    originalText: string | null | undefined,
  ) => CaptureCandidate[];
}

/** The sheet's fields, as typed; a new ingredient starts from `EMPTY_DRAFT`. */
interface IngredientDraft {
  editingId: string | null;
  name: string;
  itemId: string | null;
  quantity: string;
  unit: string;
  unitId: string | null;
  preparation: string;
  section: string;
  notes: string;
  isOptional: boolean;
  originalText: string | null;
}

const EMPTY_DRAFT: IngredientDraft = {
  editingId: null,
  name: '',
  itemId: null,
  quantity: '1',
  unit: '',
  unitId: null,
  preparation: '',
  section: '',
  notes: '',
  isOptional: false,
  originalText: null,
};

const draftOf = (ingredient: IngredientFormState): IngredientDraft => ({
  editingId: ingredient.id,
  name: ingredient.name,
  itemId: ingredient.itemId ?? null,
  quantity: formatQuantityForInput(ingredient.quantity),
  unit: ingredient.unitLabel ?? '',
  unitId: ingredient.unitId ?? null,
  preparation: ingredient.preparation ?? '',
  section: ingredient.section ?? '',
  notes: ingredient.notes ?? '',
  isOptional: ingredient.isOptional,
  originalText: ingredient.originalText ?? null,
});

export const RecipeIngredientEditor = forwardRef<
  RecipeIngredientEditorRef,
  RecipeIngredientEditorProps
>(({ onSave, candidatesFor }, ref) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [visible, setVisible] = useState(false);
  const update = (changes: Partial<IngredientDraft>) =>
    setDraft(prev => ({ ...prev, ...changes }));

  // The hook presents and dismisses off `visible` through its guarded path,
  // immune to gorhom 5.2.14's dismiss-before-present wedge. The imperative
  // `open` / `close` ref API just toggles `visible`.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible,
    onDismiss: () => setVisible(false),
    snapPoints: ['80%'],
    enableDynamicSizing: false,
  });

  useImperativeHandle(ref, () => ({
    open: (ingredient?: IngredientFormState) => {
      setDraft(ingredient ? draftOf(ingredient) : EMPTY_DRAFT);
      setVisible(true);
    },
    close: () => setVisible(false),
  }));

  // Offered only while the line is unlinked as the capture left it.
  const candidates = candidatesFor ? candidatesFor(draft.originalText) : [];

  const handleItemSelect = ({ id, defaultUnit }: ItemSuggestion) => {
    const changes: Partial<IngredientDraft> = { itemId: id };
    if (defaultUnit?.symbol) changes.unit = defaultUnit.symbol;
    if (defaultUnit?.id) changes.unitId = defaultUnit.id;
    update(changes);
  };

  const handleSave = () => {
    const name = draft.name.trim();
    if (!name) return;
    // The counter reads and steps fractions ("1 1/4"), so the save does too.
    // No amount above zero is a line stating none ("salt, to taste"), never an
    // invented 1: the API deducts, prices and converts only a stated amount.
    const parsedQuantity = parseFractionalInput(draft.quantity);
    onSave({
      id: draft.editingId ?? `temp-ing-${generateId()}`,
      name,
      quantity:
        parsedQuantity !== null && parsedQuantity > 0 ? parsedQuantity : null,
      itemId: draft.itemId,
      unitId: draft.unitId,
      unitLabel: draft.unit.trim(),
      originalText: draft.originalText,
      preparation: draft.preparation.trim(),
      section: draft.section.trim(),
      notes: draft.notes.trim(),
      isOptional: draft.isOptional,
      sortOrder: 0,
    });
    setVisible(false);
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      {...modalProps}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
    >
      <SheetHeader
        title={
          draft.editingId
            ? t('recipes.editIngredient')
            : t('recipes.addIngredient')
        }
        onClose={() => setVisible(false)}
        confirm={{ onPress: handleSave }}
      />

      <BottomSheetFormScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <DropdownStack>
          {draft.originalText ? (
            <Text role="caption" tone="secondary">
              {t('recipes.ingredientAsWritten', { line: draft.originalText })}
            </Text>
          ) : null}
          {candidates.length > 0 ? (
            <View style={styles.candidates}>
              <Text role="caption" tone="secondary">
                {t('recipes.captureMatchTo')}
              </Text>
              {candidates.map(candidate => (
                <AnimatedChip
                  key={candidate.itemId}
                  label={candidate.name}
                  selected={draft.itemId === candidate.itemId}
                  onPress={() =>
                    update({
                      itemId:
                        draft.itemId === candidate.itemId
                          ? null
                          : candidate.itemId,
                    })
                  }
                />
              ))}
            </View>
          ) : null}
          <View style={styles.autocompleteWrapper}>
            <ItemAutocompleteField
              variant="inline"
              label={t('recipes.ingredientName')}
              value={draft.name}
              onChangeText={name => update({ name, itemId: null })}
              onSelectItem={handleItemSelect}
              placeholder={t('recipes.ingredientNamePlaceholder')}
              required
            />
          </View>

          <FieldRow>
            <EditableCounter
              label={t('labels.quantity')}
              value={draft.quantity}
              onChangeText={quantity => update({ quantity })}
              placeholder={t('recipes.quantityNoAmountPlaceholder')}
              min={0}
              step={0.25}
            />
            <UnitAutocompleteField
              variant="modal"
              label={t('labels.unit')}
              value={draft.unit}
              onChangeText={unit => update({ unit })}
              onUnitSelected={unitId => update({ unitId })}
              placeholder={t('labels.pcsKgEtc')}
            />
          </FieldRow>

          <FormInput
            label={t('recipes.preparation')}
            value={draft.preparation}
            onChangeText={preparation => update({ preparation })}
            placeholder={t('recipes.preparationPlaceholder')}
            useBottomSheetInput
          />

          <FormInput
            label={t('recipes.section')}
            value={draft.section}
            onChangeText={section => update({ section })}
            placeholder={t('recipes.sectionPlaceholder')}
            useBottomSheetInput
          />

          <FormInput
            label={t('recipes.notes')}
            value={draft.notes}
            onChangeText={notes => update({ notes })}
            placeholder={t('labels.anyAdditionalNotes')}
            useBottomSheetInput
          />

          <View style={styles.switchRow}>
            <Text role="body">{t('recipes.optional')}</Text>
            <BaseSwitch
              accessibilityLabel={t('recipes.optional')}
              value={draft.isOptional}
              onValueChange={isOptional => update({ isOptional })}
            />
          </View>
        </DropdownStack>
      </BottomSheetFormScrollView>
    </BottomSheetModal>
  );
});

RecipeIngredientEditor.displayName = 'RecipeIngredientEditor';

const styles = StyleSheet.create(theme => ({
  handleIndicator: {
    backgroundColor: theme.colors.textTertiary,
  },
  sheetBackground: {
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    overflow: 'visible',
  },
  candidates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  autocompleteWrapper: {
    marginBottom: theme.spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
}));
