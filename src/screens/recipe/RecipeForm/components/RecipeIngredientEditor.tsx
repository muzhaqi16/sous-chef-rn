import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Switch, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import BottomSheet, { BottomSheetBackdropProps, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { FormInput } from '#components/molecules/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { Header } from '#components/molecules/Header';
import type { IngredientFormState } from '../useRecipeForm';

export interface RecipeIngredientEditorRef {
  open: (ingredient?: IngredientFormState) => void;
  close: () => void;
}

interface RecipeIngredientEditorProps {
  onSave: (ingredient: IngredientFormState) => void;
}

let tempIdCounter = 100;

export const RecipeIngredientEditor = forwardRef<RecipeIngredientEditorRef, RecipeIngredientEditorProps>(
  ({ onSave }, ref) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [preparation, setPreparation] = useState('');
    const [section, setSection] = useState('');
    const [notes, setNotes] = useState('');
    const [isOptional, setIsOptional] = useState(false);

    useImperativeHandle(ref, () => ({
      open: (ingredient?: IngredientFormState) => {
        if (ingredient) {
          setEditingId(ingredient.id);
          setName(ingredient.name);
          setQuantity(String(ingredient.quantity));
          setPreparation(ingredient.preparation ?? '');
          setSection(ingredient.section ?? '');
          setNotes(ingredient.notes ?? '');
          setIsOptional(ingredient.isOptional);
        } else {
          setEditingId(null);
          setName('');
          setQuantity('1');
          setPreparation('');
          setSection('');
          setNotes('');
          setIsOptional(false);
        }
        bottomSheetRef.current?.expand();
      },
      close: () => bottomSheetRef.current?.close() }));

    const handleSave = () => {
      if (!name.trim()) return;
      onSave({
        id: editingId ?? `temp-ing-${tempIdCounter++}`,
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        preparation: preparation.trim(),
        section: section.trim(),
        notes: notes.trim(),
        isOptional,
        sortOrder: 0 });
      bottomSheetRef.current?.close();
    };

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
        <GlobalBottomSheetBackdrop {...props} />
      );

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={['80%']}
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
            onPress: () => bottomSheetRef.current?.close() }]}
          rightActions={[{
            icon: 'checkmark',
            onPress: handleSave }]}
        />

        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <FormInput
            label="Ingredient Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g., Chicken breast"
            required
            useBottomSheetInput
          />

          <EditableCounter
            label="Quantity"
            value={quantity}
            onChangeText={setQuantity}
            min={0}
            step={0.25}
          />

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
      </BottomSheet>
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
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md },
  switchLabel: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary } }));
