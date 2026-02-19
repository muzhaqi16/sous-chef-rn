import React, { useState, useCallback } from 'react';
import { Alert, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormModal } from '#components/organisms/FormModal';
import { FormInput } from '#components/molecules/FormInput';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { TemplateBrowserSheet } from '#components/mealPlan/TemplateBrowserSheet';
import { TemplatePreviewSheet } from '#components/mealPlan/TemplatePreviewSheet';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMealPlanActions } from '#hooks/mealPlan/useMealPlanActions';
import { useMealTemplateActions } from '#hooks/mealPlan/useMealTemplateActions';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { MealPlanType, type MealTemplateDisplayFragment } from '#generated';

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
  const { createPlanFromTemplate, creatingFromTemplate } = useMealTemplateActions();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [planType, setPlanType] = useState<MealPlanType>(MealPlanType.Weekly);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [servings, setServings] = useState('2');

  // Template state
  const [templateBrowserVisible, setTemplateBrowserVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MealTemplateDisplayFragment | null>(null);
  const [templatePreviewVisible, setTemplatePreviewVisible] = useState(false);

  const handleSelectTemplate = useCallback((template: MealTemplateDisplayFragment) => {
    setSelectedTemplate(template);
    setTemplateBrowserVisible(false);
    setTemplatePreviewVisible(true);
  }, []);

  const handleCreateFromTemplate = useCallback(
    async (config: {
      templateId: string;
      startDate: string;
      name?: string;
      servings?: number;
    }) => {
      const result = await createPlanFromTemplate(config);
      if (result?.success) {
        setTemplatePreviewVisible(false);
        setSelectedTemplate(null);
        goBack();
      }
    },
    [createPlanFromTemplate, goBack],
  );

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

      {/* Create from template link */}
      <Pressable
        onPress={() => setTemplateBrowserVisible(true)}
        style={({ pressed }) => [
          createFromTemplateStyles.link,
          pressed && createFromTemplateStyles.linkPressed,
        ]}
      >
        <Icon
          name="document-text-outline"
          library="Ionicons"
          size={18}
          color={createFromTemplateStyles.linkIcon.color}
        />
        <Text style={createFromTemplateStyles.linkText}>
          Or create from a template
        </Text>
      </Pressable>

      {/* Template Browser Sheet */}
      <TemplateBrowserSheet
        visible={templateBrowserVisible}
        onClose={() => setTemplateBrowserVisible(false)}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Template Preview Sheet */}
      <TemplatePreviewSheet
        visible={templatePreviewVisible}
        template={selectedTemplate}
        onClose={() => {
          setTemplatePreviewVisible(false);
          setSelectedTemplate(null);
        }}
        onConfirm={handleCreateFromTemplate}
        confirmLoading={creatingFromTemplate}
      />
    </FormModal>
  );
};

const createFromTemplateStyles = StyleSheet.create(theme => ({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  linkPressed: {
    opacity: theme.opacity.pressed,
  },
  linkIcon: {
    color: theme.colors.primary,
  },
  linkText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
}));
