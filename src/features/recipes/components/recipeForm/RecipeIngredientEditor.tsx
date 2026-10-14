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
import { Button } from '#components/molecules/Button';
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

export const RecipeIngredientEditor = forwardRef<
  RecipeIngredientEditorRef,
  RecipeIngredientEditorProps
>(({ onSave, candidatesFor }, ref) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [preparation, setPreparation] = useState('');
  const [section, setSection] = useState('');
  const [notes, setNotes] = useState('');
  const [isOptional, setIsOptional] = useState(false);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // State-driven presentation: the hook auto-presents/dismisses off `visible`
  // via its guarded path (immune to gorhom 5.2.14's dismiss-before-present
  // wedge) and owns the back handler, animation configs, focus-aware
  // dismiss-on-blur, theme styles, and backdrop claim wiring. The imperative
  // `open` / `close` ref API is preserved — it just toggles `visible`.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    visible,
    onDismiss: () => setVisible(false),
    snapPoints: ['80%'],
    enableDynamicSizing: false,
  });

  useImperativeHandle(ref, () => ({
    open: (ingredient?: IngredientFormState) => {
      if (ingredient) {
        setEditingId(ingredient.id);
        setName(ingredient.name);
        setItemId(ingredient.itemId ?? null);
        setQuantity(formatQuantityForInput(ingredient.quantity));
        setUnit(ingredient.unitLabel ?? '');
        setUnitId(ingredient.unitId ?? null);
        setPreparation(ingredient.preparation ?? '');
        setSection(ingredient.section ?? '');
        setNotes(ingredient.notes ?? '');
        setIsOptional(ingredient.isOptional);
        setOriginalText(ingredient.originalText ?? null);
      } else {
        setEditingId(null);
        setName('');
        setItemId(null);
        setQuantity('1');
        setUnit('');
        setUnitId(null);
        setPreparation('');
        setSection('');
        setNotes('');
        setIsOptional(false);
        setOriginalText(null);
      }
      setVisible(true);
    },
    close: () => setVisible(false),
  }));

  // Offered only while the line is unlinked as the capture left it.
  const candidates = candidatesFor ? candidatesFor(originalText) : [];

  const handleNameChange = (text: string) => {
    setName(text);
    setItemId(null);
  };

  const handleItemSelect = (item: ItemSuggestion) => {
    setItemId(item.id);
    if (item.defaultUnit?.symbol) {
      setUnit(item.defaultUnit.symbol);
    }
    if (item.defaultUnit?.id) {
      setUnitId(item.defaultUnit.id);
    }
  };

  const handleUnitSelect = (selectedUnitId: string | null) => {
    setUnitId(selectedUnitId);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    // The counter reads and steps fractions ("1 1/4"), so the save does too.
    // No amount above zero is a line stating none ("salt, to taste"), never an
    // invented 1: the API deducts, prices and converts only a stated amount.
    const parsedQuantity = parseFractionalInput(quantity);
    onSave({
      id: editingId ?? `temp-ing-${generateId()}`,
      name: name.trim(),
      quantity:
        parsedQuantity !== null && parsedQuantity > 0 ? parsedQuantity : null,
      itemId,
      unitId,
      unitLabel: unit.trim(),
      originalText,
      preparation: preparation.trim(),
      section: section.trim(),
      notes: notes.trim(),
      isOptional,
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
          editingId ? t('recipes.editIngredient') : t('recipes.addIngredient')
        }
        onClose={() => setVisible(false)}
        confirm={{ onPress: handleSave }}
      />

      <BottomSheetFormScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <DropdownStack>
          {originalText ? (
            <Text role="caption" tone="secondary">
              {t('recipes.ingredientAsWritten', { line: originalText })}
            </Text>
          ) : null}
          {candidates.length > 0 ? (
            <View style={styles.candidates}>
              <Text role="caption" tone="secondary">
                {t('recipes.captureMatchTo')}
              </Text>
              {candidates.map(candidate => (
                <Button
                  key={candidate.itemId}
                  size="small"
                  variant={itemId === candidate.itemId ? 'primary' : 'outline'}
                  onPress={() =>
                    setItemId(
                      itemId === candidate.itemId ? null : candidate.itemId,
                    )
                  }
                >
                  {candidate.name}
                </Button>
              ))}
            </View>
          ) : null}
          <View style={styles.autocompleteWrapper}>
            <ItemAutocompleteField
              variant="inline"
              label={t('recipes.ingredientName')}
              value={name}
              onChangeText={handleNameChange}
              onSelectItem={handleItemSelect}
              placeholder={t('recipes.ingredientNamePlaceholder')}
              required
            />
          </View>

          <FieldRow>
            <EditableCounter
              label={t('labels.quantity')}
              value={quantity}
              onChangeText={setQuantity}
              placeholder={t('recipes.quantityNoAmountPlaceholder')}
              min={0}
              step={0.25}
            />
            <UnitAutocompleteField
              variant="modal"
              label={t('labels.unit')}
              value={unit}
              onChangeText={setUnit}
              onUnitSelected={handleUnitSelect}
              placeholder={t('labels.pcsKgEtc')}
            />
          </FieldRow>

          <FormInput
            label={t('recipes.preparation')}
            value={preparation}
            onChangeText={setPreparation}
            placeholder={t('recipes.preparationPlaceholder')}
            useBottomSheetInput
          />

          <FormInput
            label={t('recipes.section')}
            value={section}
            onChangeText={setSection}
            placeholder={t('recipes.sectionPlaceholder')}
            useBottomSheetInput
          />

          <FormInput
            label={t('recipes.notes')}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('labels.anyAdditionalNotes')}
            useBottomSheetInput
          />

          <View style={styles.switchRow}>
            <Text role="body">{t('recipes.optional')}</Text>
            <BaseSwitch
              accessibilityLabel={t('recipes.optional')}
              value={isOptional}
              onValueChange={setIsOptional}
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
    paddingTop: theme.spacing.md,
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
