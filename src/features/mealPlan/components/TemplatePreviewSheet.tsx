import React, { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { date, object, string, type ObjectSchema } from 'yup';
import { useTranslation } from '#i18n';
import {
  MEAL_TYPE_LABEL_KEYS,
  TEMPLATE_CATEGORY_LABEL_KEYS,
} from '#features/mealPlan/utils/mealPlanEnumLabels';
import {
  Pressable,
  PrimaryActivityIndicator,
  OnPrimaryActivityIndicator,
} from '#components/atoms/themedComponents';
import { Sheet } from '#components/templates/Sheet';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { FormInput } from '#components/atoms/FormInput';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { useMealTemplate } from '#features/mealPlan/hooks/useMealTemplate';
import type { MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { alertService } from '#services/alertService';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';
import { DataStateView } from '#components/organisms/DataStateView';
import { useDataState } from '#hooks/data/useDataState';
import { useOpening } from '#hooks/ui/useOpening';
import { toDateKey } from '#utils/dateUtils';
import { destructiveConfirm } from '#services/destructiveConfirm';
import { lazyMessage, reportValidationErrors } from '#utils/validation/common';

interface PlanFromTemplateFormValues {
  /** Blank takes the template's name. */
  name: string;
  startDate: Date | null;
  servings: string;
}

const planFromTemplateSchema: ObjectSchema<PlanFromTemplateFormValues> = object(
  {
    name: string().trim().defined(),
    startDate: date()
      .nullable()
      .required(lazyMessage('mealPlan.startDateRequiredMessage')),
    servings: string().defined(),
  },
);

interface DuplicateTemplateFormValues {
  name: string;
}

const duplicateTemplateSchema: ObjectSchema<DuplicateTemplateFormValues> =
  object({
    name: string()
      .trim()
      .required(lazyMessage('mealTemplateBuilder.nameRequiredMessage')),
  });

interface TemplatePreviewSheetProps {
  visible: boolean;
  template: MealTemplateDisplayFragment | null;
  onClose: () => void;
  onConfirm: (config: {
    templateId: string;
    startDate: string;
    name?: string;
    servings?: number;
  }) => void;
  confirmLoading: boolean;
  /** Each management action renders only when its handler is passed. */
  onEdit?: (templateId: string) => void;
  /** Called after the user confirms the deletion. */
  onDelete?: (templateId: string) => void;
  onDuplicate?: (templateId: string, newName: string) => void;
  duplicating?: boolean;
}

interface DuplicateTemplateFormProps {
  templateName: string;
  duplicating: boolean;
  onCancel: () => void;
  onDuplicate: (newName: string) => void;
}

const DuplicateTemplateForm: React.FC<DuplicateTemplateFormProps> = ({
  templateName,
  duplicating,
  onCancel,
  onDuplicate,
}) => {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<DuplicateTemplateFormValues>({
    resolver: yupResolver(duplicateTemplateSchema),
    defaultValues: { name: t('labels.copyOfName', { name: templateName }) },
  });

  const duplicate = handleSubmit(({ name }) => {
    onDuplicate(name);
  }, reportValidationErrors);

  return (
    <View style={styles.duplicateForm}>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormInput
            label={t('templatePreview.duplicateNameLabel')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            testID={mealPlanTestIDs.templateDuplicateNameInput}
          />
        )}
      />
      <View style={styles.duplicateActions}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text role="bodyStrong" tone="secondary">
            {t('labels.cancel')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void duplicate();
          }}
          disabled={duplicating}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
            duplicating && styles.buttonDisabled,
          ]}
          testID={mealPlanTestIDs.templateDuplicateConfirmButton}
        >
          <Text role="bodyStrong" tone="primary">
            {duplicating
              ? t('duplicatePlan.duplicating')
              : t('duplicatePlan.duplicate')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

type TemplatePreviewContentProps = Omit<
  TemplatePreviewSheetProps,
  'visible' | 'template' | 'onClose' | 'duplicating'
> & { template: MealTemplateDisplayFragment; duplicating: boolean };

/** One opening: the template's days, the plan made from it, and its actions. */
const TemplatePreviewContent: React.FC<TemplatePreviewContentProps> = ({
  template,
  onConfirm,
  confirmLoading,
  onEdit,
  onDelete,
  onDuplicate,
  duplicating,
}) => {
  const { t } = useTranslation();

  const { groupedByDay, loading, error, hasResult, refetch } = useMealTemplate(
    template.id,
  );
  const previewState = useDataState({
    loading,
    error,
    hasResult,
    isEmpty: groupedByDay.length === 0,
  });
  // The copy is derived from the loaded items.
  const itemsLoaded = previewState === 'ready' || previewState === 'empty';

  const { control, handleSubmit } = useForm<PlanFromTemplateFormValues>({
    resolver: yupResolver(planFromTemplateSchema),
    defaultValues: {
      name: '',
      startDate: new Date(),
      servings: template.defaultServings.toString(),
    },
  });
  const [copyFormOpen, setCopyFormOpen] = useState(false);

  const createPlan = handleSubmit(({ name, startDate, servings }) => {
    if (!startDate) return;
    const servingsNum = parseInt(servings);
    onConfirm({
      templateId: template.id,
      startDate: toDateKey(startDate),
      name: name || undefined,
      servings:
        !isNaN(servingsNum) && servingsNum > 0 ? servingsNum : undefined,
    });
  }, reportValidationErrors);

  const handleDelete = (confirmDelete: (templateId: string) => void) => {
    alertService.alert(
      t('templatePreview.deleteTemplate'),
      t('labels.areYouSureYouWantToDeleteThisCannotBeUndone', {
        name: template.name,
      }),
      destructiveConfirm(t('labels.delete'), () => confirmDelete(template.id)),
    );
  };

  return (
    <>
      {/* Template header */}
      <View style={styles.templateHeader}>
        <Text role="heading" style={styles.templateName}>
          {template.name}
        </Text>
        {!!template.description && (
          <Text
            role="caption"
            tone="secondary"
            style={styles.templateDescription}
          >
            {template.description}
          </Text>
        )}
        <View style={styles.metaRow}>
          <Text role="caption" tone="tertiary">
            {t('templatePreview.metaLine', {
              days: template.durationDays,
              servings: template.defaultServings,
            })}
            {template.home?.name ? ` · ${template.home.name}` : ''}
          </Text>
          <Text role="label" tone="primary">
            {t(TEMPLATE_CATEGORY_LABEL_KEYS[template.category])}
          </Text>
        </View>
      </View>

      {/* Configuration form */}
      <View style={styles.configSection}>
        <SectionHeader variant="title" style={styles.sectionTitle}>
          {t('templatePreview.configuration')}
        </SectionHeader>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <FormInput
              label={t('templatePreview.planNameLabel')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={template.name}
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
              minimumDate={new Date()}
              error={fieldState.error?.message}
              required
            />
          )}
        />
        <Controller
          control={control}
          name="servings"
          render={({ field }) => (
            <EditableCounter
              label={t('labels.servings')}
              value={field.value}
              onChangeText={field.onChange}
              min={1}
              step={1}
            />
          )}
        />
      </View>

      {/* Day-by-day preview */}
      <View style={styles.previewSection}>
        <SectionHeader variant="title" style={styles.sectionTitle}>
          {t('templatePreview.preview')}
        </SectionHeader>
        {previewState === 'loading' ? (
          <PrimaryActivityIndicator size="small" />
        ) : previewState === 'error' || previewState === 'offline' ? (
          <DataStateView state={previewState} onRetry={refetch} />
        ) : previewState === 'empty' ? (
          <Text
            role="caption"
            tone="tertiary"
            align="center"
            style={styles.emptyPreview}
          >
            {t('templatePreview.emptyPreview')}
          </Text>
        ) : (
          groupedByDay.map(day => (
            <View key={day.dayOffset} style={styles.dayGroup}>
              <Text role="label" tone="primary" style={styles.dayLabel}>
                {t('templatePreview.day', { day: day.dayOffset + 1 })}
              </Text>
              {day.items.map(item => (
                <View key={item.id} style={styles.mealRow}>
                  <Text role="label" tone="tertiary" style={styles.mealType}>
                    {t(MEAL_TYPE_LABEL_KEYS[item.mealType])}
                  </Text>
                  <Text
                    role="caption"
                    style={styles.mealName}
                    numberOfLines={1}
                  >
                    {item.recipe?.name ??
                      item.customMealName ??
                      t('mealPlanItem.recipeUnavailable')}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>

      {/* Confirm button */}
      <Pressable
        onPress={() => {
          void createPlan();
        }}
        disabled={confirmLoading}
        style={({ pressed }) => [
          styles.confirmButton,
          pressed && styles.buttonPressed,
          confirmLoading && styles.buttonDisabled,
        ]}
      >
        {confirmLoading ? (
          <OnPrimaryActivityIndicator size="small" />
        ) : (
          <>
            <Icon name="calendar-outline" size="sm" tone="onPrimary" />
            <Text role="bodyStrong" style={styles.confirmText}>
              {t('labels.createMealPlan')}
            </Text>
          </>
        )}
      </Pressable>

      {!!onDuplicate && !!copyFormOpen && (
        <DuplicateTemplateForm
          templateName={template.name}
          duplicating={duplicating}
          onCancel={() => setCopyFormOpen(false)}
          onDuplicate={newName => onDuplicate(template.id, newName)}
        />
      )}

      {!!onEdit && (
        <Pressable
          onPress={() => onEdit(template.id)}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.buttonPressed,
          ]}
          testID={mealPlanTestIDs.templatePreviewEditButton}
        >
          <Icon name="create-outline" size="xsPlus" tone="primary" />
          <Text role="bodyStrong" tone="primary" style={styles.editText}>
            {t('labels.editTemplate')}
          </Text>
        </Pressable>
      )}

      {!!onDuplicate && !copyFormOpen && (
        <Pressable
          onPress={() => setCopyFormOpen(true)}
          disabled={!itemsLoaded}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.buttonPressed,
            !itemsLoaded && styles.buttonDisabled,
          ]}
          testID={mealPlanTestIDs.templatePreviewDuplicateButton}
        >
          <Icon name="copy-outline" size="xsPlus" tone="primary" />
          <Text role="bodyStrong" tone="primary" style={styles.editText}>
            {t('templatePreview.duplicateTemplate')}
          </Text>
        </Pressable>
      )}

      {!!onDelete && (
        <Pressable
          onPress={() => handleDelete(onDelete)}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.buttonPressed,
          ]}
          testID={mealPlanTestIDs.templatePreviewDeleteButton}
        >
          <Icon name="trash-outline" size="xsPlus" tone="error" />
          <Text role="bodyStrong" tone="danger" style={styles.editText}>
            {t('templatePreview.deleteTemplate')}
          </Text>
        </Pressable>
      )}
    </>
  );
};

export const TemplatePreviewSheet: React.FC<TemplatePreviewSheetProps> = ({
  visible,
  template,
  onClose,
  duplicating = false,
  ...content
}) => {
  const presented = visible && !!template;
  const opening = useOpening(presented, template);

  // `form`: the sheet holds inputs, and only the form scrollable supplies
  // gorhom's input context, so the sheet sees the keyboard over a field.
  return (
    <Sheet
      mode="form"
      visible={presented}
      onDismiss={onClose}
      snapPoints={['85%']}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
    >
      {opening?.payload ? (
        <TemplatePreviewContent
          key={opening.id}
          template={opening.payload}
          duplicating={duplicating}
          {...content}
        />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  templateHeader: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
  templateName: {
    marginBottom: theme.spacing.xs,
  },
  templateDescription: {
    marginBottom: theme.spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configSection: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
  },
  previewSection: {
    marginBottom: theme.spacing.lg,
  },
  emptyPreview: {
    paddingVertical: theme.spacing.md,
  },
  dayGroup: {
    marginBottom: theme.spacing.md,
  },
  dayLabel: {
    marginBottom: theme.spacing.xs,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    paddingLeft: theme.spacing.sm,
  },
  mealType: {
    width: 70,
  },
  mealName: {
    flex: 1,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
  },
  confirmText: {
    color: theme.colors.onPrimary,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  editText: {
    marginLeft: theme.spacing.xs,
  },
  duplicateForm: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  duplicateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  buttonPressed: {
    opacity: theme.opacity.pressed,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
}));
