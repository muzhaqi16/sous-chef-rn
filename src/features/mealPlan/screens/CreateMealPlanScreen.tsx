import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { localizedErrorMessage } from '#/services/errorService';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { MEAL_PLAN_TYPE_LABEL_KEYS } from '#features/mealPlan/utils/mealPlanEnumLabels';
import { Icon } from '#utils/iconUtils';
import { FormScreen } from '#components/templates/FormScreen';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { FormSelect } from '#components/molecules/FormSelect';
import { FormCheckbox } from '#components/molecules/FormCheckbox';
import { SegmentedControl } from '#components/molecules/SegmentedControl';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { TemplateBrowserSheet } from '#features/mealPlan/components/TemplateBrowserSheet';
import { TemplatePreviewSheet } from '#features/mealPlan/components/TemplatePreviewSheet';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMealPlanActions } from '#features/mealPlan/hooks/useMealPlanActions';
import { useMealTemplateActions } from '#features/mealPlan/hooks/useMealTemplateActions';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useHomeQuery } from '#features/home/hooks/useHomeQuery';
import { useSelectedHomeId } from '#store/useAppStore';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { MealPlanType } from '#/graphql/generated/schemaTypes';
import type { MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';
import type { Translate } from '#/i18n/types';
import { logValidationErrors } from '#/utils/validation/common';
import {
  createMealPlanDefaults,
  createMealPlanSchema,
  PERSONAL_VALUE,
  type CreateMealPlanFormValues,
} from './createMealPlanFormConfig';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';

const PLAN_TYPES = [MealPlanType.Weekly, MealPlanType.Monthly];

/** The fields that render their own validation message. */
const FIELDS_WITH_MESSAGES: ReadonlyArray<keyof CreateMealPlanFormValues> = [
  'name',
  'startDate',
];

function getPlanTypeFormatter(t: Translate) {
  return (value: MealPlanType): string => t(MEAL_PLAN_TYPE_LABEL_KEYS[value]);
}

function computeEndDate(startDate: Date, planType: MealPlanType): Date {
  switch (planType) {
    case MealPlanType.Weekly:
      return addDays(startDate, 6);
    case MealPlanType.Monthly:
      return addDays(addMonths(startDate, 1), -1);
    case MealPlanType.Custom:
    case MealPlanType.Daily:
      return addWeeks(startDate, 1);
  }
}

export const CreateMealPlanScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const { createMealPlan, creating } = useMealPlanActions();
  const { createPlanFromTemplate, creatingFromTemplate } =
    useMealTemplateActions();
  const { homes } = useHomeQuery();
  const { profile: dietaryProfile } = useDietaryProfile();
  const selectedHomeId = useSelectedHomeId();

  const { control, handleSubmit, setError } = useForm<CreateMealPlanFormValues>(
    {
      resolver: yupResolver(createMealPlanSchema),
      defaultValues: createMealPlanDefaults(selectedHomeId),
      mode: 'onTouched',
    },
  );

  const homeOptions = (() => {
    const opts = [{ label: t('mealPlan.personal'), value: PERSONAL_VALUE }];
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
    if (result) {
      setTemplatePreviewVisible(false);
      setSelectedTemplate(null);
      goBack();
    }
  };

  const onValid = async ({
    name,
    description,
    planType,
    startDate,
    servings,
    budget,
    trackNutrition,
    homeSelection,
  }: CreateMealPlanFormValues) => {
    if (!startDate) return;
    const endDate = computeEndDate(startDate, planType);
    const homeId = homeSelection !== PERSONAL_VALUE ? homeSelection : undefined;
    const descriptionValue = description.trim() || undefined;
    const servingsValue = parseInt(servings) || 2;
    // Empty clears the budget; ignore a non-numeric entry rather than send NaN.
    const parsedBudget = budget.trim() === '' ? undefined : Number(budget);
    const budgetValue =
      parsedBudget !== undefined && !Number.isNaN(parsedBudget)
        ? parsedBudget
        : undefined;

    let outcome;
    const createMealPlanOptions = {
      name: name.trim(),
      description: descriptionValue,
      planType,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      servings: servingsValue,
      budgetAmount: budgetValue,
      dietaryProfileId:
        trackNutrition && dietaryProfile ? dietaryProfile.id : undefined,
      homeId,
    };
    try {
      outcome = await createMealPlan(createMealPlanOptions, {
        present: 'none',
      });
    } catch (error) {
      alertService.alert(
        t('labels.error'),
        localizedErrorMessage(error, t('mealPlan.failedToCreate')),
      );
      return;
    }

    if (outcome.status !== 'failed') {
      goBack();
      return;
    }
    // A refusal naming a field the form shows a message for lands on it.
    const { failure } = outcome;
    const field = FIELDS_WITH_MESSAGES.find(key => key === failure.field);
    if (field) {
      setError(field, { type: 'server', message: failure.body });
      return;
    }
    alertService.alert(failure.title, failure.body);
  };

  return (
    <FormScreen
      title={t('labels.createMealPlan')}
      onClose={goBack}
      onSave={handleSubmit(onValid, logValidationErrors)}
      loading={creating}
      testID={mealPlanTestIDs.createScreen}
    >
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormInput
            label={t('mealPlan.name')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder={t('mealPlan.namePlaceholder')}
            required
            testID={mealPlanTestIDs.createNameInput}
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormTextArea
            label={t('mealPlan.description')}
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t('mealPlan.descriptionPlaceholder')}
            testID={mealPlanTestIDs.createDescriptionInput}
          />
        )}
      />

      <Controller
        control={control}
        name="planType"
        render={({ field }) => (
          <SegmentedControl
            label={t('mealPlan.planType')}
            options={PLAN_TYPES}
            value={field.value}
            onChange={field.onChange}
            formatLabel={getPlanTypeFormatter(t)}
            required
          />
        )}
      />

      <Controller
        control={control}
        name="startDate"
        render={({ field, fieldState }) => (
          <DatePickerField
            label={t('labels.startDate')}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            minimumDate={new Date()}
            required
          />
        )}
      />

      <Controller
        control={control}
        name="servings"
        render={({ field }) => (
          <EditableCounter
            label={t('labels.defaultServings')}
            value={field.value}
            onChangeText={field.onChange}
            min={1}
            step={1}
          />
        )}
      />

      <Controller
        control={control}
        name="budget"
        render={({ field }) => (
          <FormInput
            label={t('mealPlan.budgetAmount')}
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t('mealPlan.budgetPlaceholder')}
            keyboardType="numeric"
            testID={mealPlanTestIDs.createBudgetInput}
          />
        )}
      />

      {!!dietaryProfile && (
        <Controller
          control={control}
          name="trackNutrition"
          render={({ field }) => (
            <FormCheckbox
              label={t('labels.trackNutritionGoals')}
              checked={field.value}
              onPress={() => field.onChange(!field.value)}
            />
          )}
        />
      )}

      {homeOptions.length > 1 && (
        <Controller
          control={control}
          name="homeSelection"
          render={({ field }) => (
            <FormSelect
              label={t('mealPlan.shareWith')}
              value={field.value}
              onValueChange={field.onChange}
              options={homeOptions}
              placeholder={t('mealPlan.personal')}
            />
          )}
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
        <Text role="bodyStrong" tone="accent">
          {t('mealPlan.orCreateFromTemplate')}
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
    </FormScreen>
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
