import React from 'react';
import {View, Text} from 'react-native';
import {Control, FieldErrors} from 'react-hook-form';
import {StyleSheet} from 'react-native-unistyles';
import {DynamicFormFields, FieldDef} from '#components/molecules/DynamicFormFields';
import {Counter} from '#components/molecules/Counter';
import {FormInput} from '#components/molecules/FormInput';
import {FormCheckbox} from '#components/molecules/FormCheckbox';
import {commonStyles} from '#/styles/commonStyles';

interface QuantitySectionProps {
  control: Control<any>;
  errors: FieldErrors<any>;
  mode: 'add' | 'edit';
  quantity: number;
  unit: string;
  isAutoReorder?: boolean;
  onIncrementQuantity: () => void;
  onDecrementQuantity: () => void;
  onUnitSelected?: (unitId: string | null) => void;
}

export const QuantitySection: React.FC<QuantitySectionProps> = ({
  control,
  errors,
  mode,
  quantity,
  unit,
  isAutoReorder,
  onIncrementQuantity,
  onDecrementQuantity,
  onUnitSelected,
}) => {
  const getFields = (): FieldDef<any>[] => {
    if (mode === 'add') {
      return [
        {
          name: 'quantity',
          label: 'Quantity',
          component: () => (
            <View style={[commonStyles.row, commonStyles.gap]}>
              <View style={[commonStyles.inputGroup, commonStyles.flex1]}>
                <Text style={commonStyles.label}>Quantity *</Text>
                <View style={styles.quantityContainer}>
                  <Counter
                    count={quantity}
                    onIncrement={onIncrementQuantity}
                    onDecrement={onDecrementQuantity}
                  />
                </View>
              </View>
              <View style={[commonStyles.inputGroup, commonStyles.flex1]}>
                <Text style={commonStyles.label}>Unit</Text>
                <View style={styles.quantityContainer}>
                  <Text style={styles.unitText}>{unit || 'Select unit'}</Text>
                </View>
              </View>
            </View>
          ),
        },
        {
          name: 'unit',
          label: 'Unit',
          placeholder: 'kg, lbs, pcs',
          component: 'unitAutocomplete',
          onUnitSelected,
        },
        {
          name: 'minimumQuantity',
          label: 'Minimum Quantity',
          placeholder: 'Alert when below this quantity',
          component: FormInput,
          props: {keyboardType: 'numeric'},
        },
      ];
    } else {
      // Edit mode fields
      const baseFields: FieldDef<any>[] = [
        {
          name: 'quantity',
          label: 'Current Quantity',
          placeholder: '1',
          component: FormInput,
          props: {keyboardType: 'numeric'},
        },
        {
          name: 'unit',
          label: 'Unit',
          component: () => (
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{unit}</Text>
            </View>
          ),
        },
        {
          name: 'reservedQuantity',
          label: 'Minimum Stock Level',
          placeholder: 'Alert when below this quantity',
          component: FormInput,
          props: {keyboardType: 'numeric'},
        },
        {
          name: 'isAutoReorder',
          label: 'Auto Reorder',
          component: FormCheckbox,
          props: {componentType: 'checkbox'},
        },
      ];

      if (isAutoReorder) {
        baseFields.push({
          name: 'autoReorderPoint',
          label: 'Reorder Point',
          placeholder: 'Reorder when quantity reaches...',
          component: FormInput,
          props: {keyboardType: 'numeric'},
        });
      }

      return baseFields;
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {mode === 'add' ? 'Quantity & Unit' : 'Quantity & Stock'}
      </Text>
      <DynamicFormFields
        fields={getFields()}
        control={control}
        errors={errors}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  quantityContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  unitText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  readOnlyField: {
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceVariant,
  },
  readOnlyText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textTertiary,
  },
}));