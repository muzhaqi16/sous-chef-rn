import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Switch, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetModal, BottomSheetBackdropProps, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { ItemAutocompleteField } from '#components/molecules/AutocompleteField/ItemAutocompleteField';
import { UnitAutocompleteField } from '#components/molecules/AutocompleteField/UnitAutocompleteField';
import { FormInput } from '#components/molecules/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/molecules/FieldRow';
import { Header } from '#components/molecules/Header';
import { generateId } from '#/utils/generateId';
import type { ItemSuggestion } from '#generated';
import type { IngredientFormState } from '../useRecipeForm';

export interface RecipeIngredientEditorRef {
  open: (ingredient?: IngredientFormState) => void;
  close: () => void;
}

interface RecipeIngredientEditorProps {
  onSave: (ingredient: IngredientFormState) => void;
}

export const RecipeIngredientEditor = forwardRef<RecipeIngredientEditorRef, RecipeIngredientEditorProps>(
  ({ onSave }, ref) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
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
        bottomSheetRef.current?.present();
      },
      close: () => bottomSheetRef.current?.dismiss() }));

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
        sortOrder: 0 });
      bottomSheetRef.current?.dismiss();
    };

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
        <GlobalBottomSheetBackdrop {...props} onClose={() => bottomSheetRef.current?.dismiss()} />
      );

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={['80%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBackground}
      >
        <Header
          title={editingId ? 'Edit Ingredient' : 'Add Ingredient'}
          centerTitle
          leftActions={[{
            icon: 'close',
            onPress: () => bottomSheetRef.current?.dismiss() }]}
          rightActions={[{
            icon: 'checkmark',
            onPress: handleSave }]}
        />

        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.autocompleteWrapper}>
            <ItemAutocompleteField
              variant="inline"
              label="Ingredient Name"
              value={name}
              onChangeText={handleNameChange}
              onSelectItem={handleItemSelect}
              placeholder="e.g., Chicken breast"
              required
            />
          </View>

          <FieldRow>
            <EditableCounter
              label="Quantity"
              value={quantity}
              onChangeText={setQuantity}
              min={0}
              step={0.25}
            />
            <UnitAutocompleteField
              variant="modal"
              label="Unit"
              value={unit}
              onChangeText={setUnit}
              onUnitSelected={handleUnitSelect}
              placeholder="pcs, kg, etc."
            />
          </FieldRow>

          <FormInput
            label="Preparation"
            value={preparation}
            onChangeText={setPreparation}
            placeholder="e.g., diced, minced..."
            useBottomSheetInput
          />

          <FormInput
            label="Section"
            value={section}
            onChangeText={setSection}
            placeholder="e.g., For the sauce..."
            useBottomSheetInput
          />

          <FormInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes..."
            useBottomSheetInput
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Optional</Text>
            <Switch value={isOptional} onValueChange={setIsOptional} />
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

RecipeIngredientEditor.displayName = 'RecipeIngredientEditor';

const styles = StyleSheet.create(theme => ({
  handleIndicator: {
    backgroundColor: theme.colors.textTertiary },
  sheetBackground: {
    backgroundColor: theme.colors.background },
  content: {
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    overflow: 'visible' },
  autocompleteWrapper: {
    zIndex: 10,
    marginBottom: theme.spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md },
  switchLabel: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary } }));
