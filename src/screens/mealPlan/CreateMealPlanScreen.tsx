import React, { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { FormModal } from '#components/organisms/FormModal';
import { FormInput } from '#components/molecules/FormInput';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMealPlanActions } from '#hooks/mealPlan/useMealPlanActions';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { MealPlanType } from '#generated';

const PLAN_TYPES = [MealPlanType.Weekly, MealPlanType.Monthly] as const;

function formatPlanType(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function computeEndDate(startDate: Date, planType: MealPlanType): Date {
  switch (planType) {
    case MealPlanType.Weekly:
      return addDays(startDate, 6);
    case MealPlanType.Monthly:
      return addDays(addMonths(startDate, 1), -1);
    default:
      return addWeeks(startDate, 1);
  }
}

export const CreateMealPlanScreen: React.FC = () => {
  const { goBack } = useAppNavigation();
  const { createMealPlan, creating } = useMealPlanActions();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [planType, setPlanType] = useState<MealPlanType>(MealPlanType.Weekly);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [servings, setServings] = useState('2');

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your meal plan.');
      return;
    }
    if (!startDate) {
      Alert.alert('Start Date Required', 'Please select a start date.');
      return;
    }

    try {
      const endDate = computeEndDate(startDate, planType);
      const result = await createMealPlan({
        name: name.trim(),
        description: description.trim() || undefined,
        planType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        servings: parseInt(servings) || 2,
      });

      if (result?.success) {
        goBack();
      } else {
        Alert.alert('Error', result?.message ?? 'Failed to create meal plan.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message ?? 'Failed to create meal plan.');
    }
  }, [name, description, planType, startDate, servings, createMealPlan, goBack]);

  return (
    <FormModal
      title="Create Meal Plan"
      onClose={goBack}
      onSave={handleSave}
      loading={creating}
      testID="create-meal-plan-screen"
    >
      <FormInput
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g., Week 8 Plan"
        required
        testID="meal-plan-name-input"
      />

      <FormTextArea
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional description..."
        testID="meal-plan-description-input"
      />

      <SegmentedControl
        label="Plan Type"
        options={PLAN_TYPES}
        value={planType}
        onChange={setPlanType}
        formatLabel={formatPlanType}
        required
      />

      <DatePickerField
        label="Start Date"
        value={startDate}
        onChange={setStartDate}
        minimumDate={new Date()}
        required
      />

      <EditableCounter
        label="Default Servings"
        value={servings}
        onChangeText={setServings}
        min={1}
        step={1}
      />
    </FormModal>
  );
};
