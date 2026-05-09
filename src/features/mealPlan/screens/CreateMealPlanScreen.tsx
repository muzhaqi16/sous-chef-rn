import React, { useState } from 'react';

import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FormModal } from '#components/organisms/FormModal';
import { FormInput } from '#components/molecules/FormInput';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { FormSelect } from '#components/molecules/FormSelect';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { TemplateBrowserSheet } from '#features/mealPlan/components/TemplateBrowserSheet';
import { TemplatePreviewSheet } from '#features/mealPlan/components/TemplatePreviewSheet';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import { useMealTemplateActions } from '#features/mealPlan/hooks/useMealTemplateActions';
import { useHomeQuery } from '#hooks/home/hooks/useHomeQuery';
import { useAppStore } from '#store/useAppStore';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { MealPlanType } from '#/graphql/generated/schemaTypes';
import { type MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';

const PLAN_TYPES = [MealPlanType.Weekly, MealPlanType.Monthly];

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

const PERSONAL_VALUE = '__personal__';

export const CreateMealPlanScreen: React.FC = () => {
  const { goBack } = useAppNavigation();
  const { createMealPlan, creating } = useMealPlanActions();
  const { createPlanFromTemplate, creatingFromTemplate } =
    useMealTemplateActions();
  const { homes } = useHomeQuery();
  const selectedHomeId = useAppStore(s => s.selectedHomeId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [planType, setPlanType] = useState<MealPlanType>(MealPlanType.Weekly);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [servings, setServings] = useState('2');
  const [homeSelection, setHomeSelection] = useState<string>(
    selectedHomeId ?? PERSONAL_VALUE,
  );

  const homeOptions = (() => {
    const opts = [{ label: 'Personal', value: PERSONAL_VALUE }];
    if (homes) {
      for (const home of homes) {
        if (home?.id && home?.name) {
          opts.push({ label: home.name, value: home.id });
        }
      }
    }
    return opts;
  })();

  // Template state
  const [templateBrowserVisible, setTemplateBrowserVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<MealTemplateDisplayFragment | null>(null);
  const [templatePreviewVisible, setTemplatePreviewVisible] = useState(false);

  const handleSelectTemplate = (template: MealTemplateDisplayFragment) => {
    setSelectedTemplate(template);
    setTemplateBrowserVisible(false);
    setTemplatePreviewVisible(true);
  };

  const handleCreateFromTemplate = async (config: {
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
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alertService.alert(
        'Name Required',
        'Please enter a name for your meal plan.',
      );
      return;
    }
    if (!startDate) {
      alertService.alert('Start Date Required', 'Please select a start date.');
      return;
    }

    const endDate = computeEndDate(startDate, planType);
    const homeId = homeSelection !== PERSONAL_VALUE ? homeSelection : undefined;
    const descriptionValue = description.trim() || undefined;
    const servingsValue = parseInt(servings) || 2;

    let result;
    try {
      result = await createMealPlan({
        name: name.trim(),
        description: descriptionValue,
        planType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        servings: servingsValue,
        homeId,
      });
    } catch (error: any) {
      const errorMessage = error.message ?? 'Failed to create meal plan.';
      alertService.alert('Error', errorMessage);
      return;
    }

    if (result?.success) {
      goBack();
    } else {
      const message = result?.message ?? 'Failed to create meal plan.';
      alertService.alert('Error', message);
    }
  };

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

      {homeOptions.length > 1 && (
        <FormSelect
          label="Share With"
          value={homeSelection}
          onValueChange={setHomeSelection}
          options={homeOptions}
          placeholder="Personal"
        />
      )}

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
          size={18}
          color={createFromTemplateStyles.linkIcon.color}
        />
        <Text size="base" weight="medium" tone="accent">
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
}));
