import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#i18n';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { DropdownStack } from '#components/atoms/DropdownStack';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import { reportValidationErrors } from '#utils/validation/common';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { ItemAutocompleteField } from '#features/catalog/ui/autocomplete/ItemAutocompleteField';
import { UnitAutocompleteField } from '#features/catalog/ui/autocomplete/UnitAutocompleteField';
import { FormInput } from '#components/atoms/FormInput';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { FieldRow } from '#components/atoms/FieldRow';
import { Chip } from '#components/molecules/Chip';
import { SheetHeader } from '#components/templates/SheetHeader';
import { generateId } from '#utils/generateId';
import type { ItemSuggestion } from '#graphql/generated/schemaTypes';
import type { IngredientFormState } from '#features/recipes/types';
import { Text } from '#components/atoms/Text';
import { parseFractionalInput } from '#utils/fractionUtils';
import type { CaptureCandidate } from '#features/recipes/hooks/useCaptureReview';
import { unitLabel } from '#utils/formatQuantity';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';
import {
  ingredientSchema,
  valuesOf,
  type IngredientFormValues,
} from './ingredientFormConfig';

interface RecipeIngredientEditorProps {
  visible: boolean;
  /** The ingredient being edited; absent, a new one. */
  ingredient?: IngredientFormState;
  onDismiss: () => void;
  onSave: (ingredient: IngredientFormState) => void;
  /** Items a capture proposed for a line it did not link, by the line as written. */
  candidatesFor?: (
    originalText: string | null | undefined,
  ) => CaptureCandidate[];
}

type IngredientFormProps = Pick<
  RecipeIngredientEditorProps,
  'candidatesFor'
> & {
  /** The ingredient being edited; absent for a new one. */
  ingredient: IngredientFormState | undefined;
  onSave: RecipeIngredientEditorProps['onSave'];
  onClose: () => void;
};

/** One opening, on the ingredient's fields or a new one's. */
const IngredientForm: React.FC<IngredientFormProps> = ({
  ingredient,
  onSave,
  onClose,
  candidatesFor,
}) => {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isDirty },
  } = useForm<IngredientFormValues>({
    resolver: yupResolver(ingredientSchema),
    defaultValues: valuesOf(ingredient),
  });
  useSheetUnsavedInput(isDirty);
  const itemId = useWatch({ control, name: 'itemId' });
  const originalText = ingredient?.originalText ?? null;

  // Offered only while the line is unlinked as the capture left it.
  const candidates = candidatesFor ? candidatesFor(originalText) : [];

  const handleItemSelect = ({ id, defaultUnit }: ItemSuggestion) => {
    setValue('itemId', id, { shouldDirty: true });
    const seededUnit = unitLabel(defaultUnit);
    if (seededUnit) setValue('unit', seededUnit);
    if (defaultUnit?.id) setValue('unitId', defaultUnit.id);
  };

  const save = handleSubmit(values => {
    // The counter reads and steps fractions ("1 1/4"), so the save does too.
    // No amount above zero is a line stating none ("salt, to taste"), never an
    // invented 1: the API deducts, prices and converts only a stated amount.
    const parsedQuantity = parseFractionalInput(values.quantity);
    onSave({
      id: ingredient?.id ?? `temp-ing-${generateId()}`,
      name: values.name,
      quantity:
        parsedQuantity !== null && parsedQuantity > 0 ? parsedQuantity : null,
      itemId: values.itemId,
      unitId: values.unitId,
      unitLabel: values.unit,
      originalText,
      preparation: values.preparation,
      section: values.section,
      notes: values.notes,
      isOptional: values.isOptional,
      sortOrder: 0,
    });
    onClose();
  }, reportValidationErrors);

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={
            ingredient
              ? t('recipes.editIngredient')
              : t('recipes.addIngredient')
          }
          onClose={onClose}
          confirm={{
            onPress: () => {
              void save();
            },
          }}
        />
      </SheetHeaderSlot>

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
              <Chip
                key={candidate.itemId}
                label={candidate.name}
                selected={itemId === candidate.itemId}
                onPress={() =>
                  setValue(
                    'itemId',
                    itemId === candidate.itemId ? null : candidate.itemId,
                    { shouldDirty: true },
                  )
                }
              />
            ))}
          </View>
        ) : null}
        <View style={styles.autocompleteWrapper}>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <ItemAutocompleteField
                variant="inline"
                label={t('recipes.ingredientName')}
                value={field.value}
                onChangeText={name => {
                  field.onChange(name);
                  setValue('itemId', null);
                }}
                onSelectItem={handleItemSelect}
                placeholder={t('recipes.ingredientNamePlaceholder')}
                error={fieldState.error?.message}
                required
              />
            )}
          />
        </View>

        <FieldRow>
          <Controller
            control={control}
            name="quantity"
            render={({ field, fieldState }) => (
              <EditableCounter
                label={t('labels.quantity')}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                placeholder={t('recipes.quantityNoAmountPlaceholder')}
                min={0}
                step={0.25}
              />
            )}
          />
          <Controller
            control={control}
            name="unit"
            render={({ field }) => (
              <UnitAutocompleteField
                variant="modal"
                label={t('labels.unit')}
                value={field.value}
                onChangeText={field.onChange}
                onUnitSelected={unitId =>
                  setValue('unitId', unitId, { shouldDirty: true })
                }
                placeholder={t('labels.pcsKgEtc')}
              />
            )}
          />
        </FieldRow>

        <Controller
          control={control}
          name="preparation"
          render={({ field }) => (
            <FormInput
              label={t('recipes.preparation')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('recipes.preparationPlaceholder')}
            />
          )}
        />

        <Controller
          control={control}
          name="section"
          render={({ field }) => (
            <FormInput
              label={t('recipes.section')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('recipes.sectionPlaceholder')}
            />
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <FormInput
              label={t('labels.notes')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('labels.anyAdditionalNotes')}
            />
          )}
        />

        <View style={styles.switchRow}>
          <Text role="body">{t('recipes.optional')}</Text>
          <Controller
            control={control}
            name="isOptional"
            render={({ field }) => (
              <BaseSwitch
                accessibilityLabel={t('recipes.optional')}
                value={field.value}
                onValueChange={field.onChange}
              />
            )}
          />
        </View>
      </DropdownStack>
    </>
  );
};

export const RecipeIngredientEditor: React.FC<RecipeIngredientEditorProps> = ({
  visible,
  ingredient,
  onDismiss,
  onSave,
  candidatesFor,
}) => {
  const opening = useOpening(visible, ingredient);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['80%']}
      enableDynamicSizing={false}
      contentContainerStyle={styles.content}
    >
      {opening ? (
        <IngredientForm
          key={opening.id}
          ingredient={opening.payload}
          onSave={onSave}
          onClose={onDismiss}
          candidatesFor={candidatesFor}
        />
      ) : null}
    </Sheet>
  );
};

RecipeIngredientEditor.displayName = 'RecipeIngredientEditor';

const styles = StyleSheet.create(theme => ({
  content: {
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
