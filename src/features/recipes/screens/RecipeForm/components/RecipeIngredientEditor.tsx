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
import { FormInput } from '#components/molecules/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/molecules/FieldRow';
import { Header } from '#components/molecules/Header';
import { generateId } from '#/utils/generateId';
import { type ItemSuggestion } from '#/graphql/generated/schemaTypes';
import type { IngredientFormState } from '../useRecipeForm';
import { Text } from '#components/atoms/Text';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { formatNumberForInput } from '#/utils/formatters/number';

export interface RecipeIngredientEditorRef {
  open: (ingredient?: IngredientFormState) => void;
  close: () => void;
}

interface RecipeIngredientEditorProps {
  onSave: (ingredient: IngredientFormState) => void;
}

export const RecipeIngredientEditor = forwardRef<
  RecipeIngredientEditorRef,
  RecipeIngredientEditorProps
>(({ onSave }, ref) => {
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
        setQuantity(formatNumberForInput(ingredient.quantity));
        setUnit(''); // Unit display text not stored - user can re-select
        setUnitId(ingredient.unitId ?? null);
        setPreparation(ingredient.preparation ?? '');
        setSection(ingredient.section ?? '');
        setNotes(ingredient.notes ?? '');
        setIsOptional(ingredient.isOptional);
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
      }
      setVisible(true);
    },
    close: () => setVisible(false),
  }));

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
    onSave({
      id: editingId ?? `temp-ing-${generateId()}`,
      name: name.trim(),
      quantity: parseDecimalInput(quantity) || 1,
      itemId,
      unitId,
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
      <Header
        title={
          editingId ? t('recipes.editIngredient') : t('recipes.addIngredient')
        }
        centerTitle
        leftActions={[
          {
            icon: 'close',
            onPress: () => setVisible(false),
          },
        ]}
        rightActions={[
          {
            icon: 'checkmark',
            onPress: handleSave,
          },
        ]}
      />

      <BottomSheetFormScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <DropdownStack>
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
              min={0}
              step={0.25}
            />
            <UnitAutocompleteField
              variant="modal"
              label={t('storageLocationForm.unit')}
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
            <Text size="md">{t('recipes.optional')}</Text>
            <BaseSwitch value={isOptional} onValueChange={setIsOptional} />
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
