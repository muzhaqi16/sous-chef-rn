import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  BottomSheetModal,
  useStandardBottomSheet,
} from '#hooks/useStandardBottomSheet';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { ItemAutocompleteField } from '#components/molecules/AutocompleteField/ItemAutocompleteField';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FormInput } from '#components/molecules/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/molecules/FieldRow';
import { Header } from '#components/molecules/Header';
import { generateId } from '#/utils/generateId';
import { type ItemSuggestion } from '#/graphql/generated/schemaTypes';
import type { IngredientFormState } from '../useRecipeForm';
import { Text } from '#components/atoms/Text';

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

  // Manual-presentation pattern: omit `visible` so the hook doesn't auto-
  // present/dismiss off prop changes, then drive presentation via the
  // effect below. `useStandardBottomSheet` still owns the back handler,
  // animation configs, focus-aware dismiss-on-blur, theme styles, and the
  // backdrop claim wiring.
  const { ref: bottomSheetRef, modalProps } = useStandardBottomSheet({
    onDismiss: () => setVisible(false),
    snapPoints: ['80%'],
    enableDynamicSizing: false,
  });

  // Per CLAUDE.md: never call present()/dismiss() outside an effect.
  // The imperative `open` / `close` API is preserved (parents still pass a
  // ref), but internally it sets `visible` and an effect dispatches the
  // present/dismiss after render commits.
  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, bottomSheetRef]);

  useImperativeHandle(ref, () => ({
    open: (ingredient?: IngredientFormState) => {
      if (ingredient) {
        setEditingId(ingredient.id);
        setName(ingredient.name);
        setItemId(ingredient.itemId ?? null);
        setQuantity(String(ingredient.quantity));
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
      quantity: parseFloat(quantity) || 1,
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

      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
            label={t('recipes.quantity')}
            value={quantity}
            onChangeText={setQuantity}
            min={0}
            step={0.25}
          />
          <UnitAutocompleteField
            variant="modal"
            label={t('recipes.unit')}
            value={unit}
            onChangeText={setUnit}
            onUnitSelected={handleUnitSelect}
            placeholder={t('recipes.unitPlaceholder')}
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
          placeholder={t('recipes.notesPlaceholder')}
          useBottomSheetInput
        />

        <View style={styles.switchRow}>
          <Text size="md">{t('recipes.optional')}</Text>
          <BaseSwitch value={isOptional} onValueChange={setIsOptional} />
        </View>
      </BottomSheetScrollView>
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
    zIndex: 10,
    marginBottom: theme.spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
}));
