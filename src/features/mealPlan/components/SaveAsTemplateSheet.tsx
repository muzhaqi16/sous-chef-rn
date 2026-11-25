import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { mixed, object, string, type ObjectSchema } from 'yup';
import { useTranslation, type TranslationKey } from '#i18n';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/molecules/ChipScrollRow';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { Text } from '#components/atoms/Text';
import { TemplateCategory } from '#graphql/generated/schemaTypes';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { SheetHeaderSlot } from '#components/templates/SheetHeaderSlot';
import { useOpening } from '#hooks/ui/useOpening';
import {
  commaTagsRule,
  lazyMessage,
  parseCommaTags,
  reportValidationErrors,
} from '#utils/validation/common';
import { useSheetUnsavedInput } from '#components/templates/SheetCloseGuard';
import { MAX_TEMPLATE_TAGS } from '#utils/validation/entryLimits';

const CATEGORY_OPTION_KEYS: {
  key: TemplateCategory;
  labelKey: TranslationKey;
}[] = [
  { key: TemplateCategory.Weekly, labelKey: 'labels.weekly' },
  { key: TemplateCategory.Monthly, labelKey: 'labels.monthly' },
  {
    key: TemplateCategory.Breakfast,
    labelKey: 'labels.breakfast',
  },
  { key: TemplateCategory.Lunch, labelKey: 'labels.lunch' },
  { key: TemplateCategory.Dinner, labelKey: 'labels.dinner' },
  { key: TemplateCategory.Holiday, labelKey: 'saveAsTemplate.categoryHoliday' },
  {
    key: TemplateCategory.SpecialDiet,
    labelKey: 'saveAsTemplate.categorySpecialDiet',
  },
  { key: TemplateCategory.Custom, labelKey: 'saveAsTemplate.categoryCustom' },
];

interface SaveAsTemplateFormValues {
  name: string;
  description: string;
  category: TemplateCategory;
  /** Comma-separated, as typed. */
  tags: string;
}

const saveAsTemplateSchema: ObjectSchema<SaveAsTemplateFormValues> = object({
  name: string()
    .trim()
    .required(lazyMessage('mealTemplateBuilder.nameRequiredMessage')),
  description: string().trim().defined(),
  category: mixed<TemplateCategory>()
    .oneOf(Object.values(TemplateCategory))
    .defined(),
  tags: commaTagsRule(MAX_TEMPLATE_TAGS),
});

interface SaveAsTemplateSheetProps {
  visible: boolean;
  mealPlanId: string | null;
  mealPlanName?: string;
  homeName?: string | null;
  onClose: () => void;
  onSave: (input: {
    mealPlanId: string;
    name: string;
    description?: string;
    category?: TemplateCategory;
    tags?: string[];
  }) => void;
  saving: boolean;
}

type SaveAsTemplateFormProps = Omit<
  SaveAsTemplateSheetProps,
  'visible' | 'mealPlanId'
> & { mealPlanId: string };

const SaveAsTemplateForm: React.FC<SaveAsTemplateFormProps> = ({
  mealPlanId,
  mealPlanName,
  homeName,
  onClose,
  onSave,
  saving,
}) => {
  const { t } = useTranslation();
  const categoryOptions: ChipOption<TemplateCategory>[] =
    CATEGORY_OPTION_KEYS.map(o => ({ key: o.key, label: t(o.labelKey) }));
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<SaveAsTemplateFormValues>({
    resolver: yupResolver(saveAsTemplateSchema),
    defaultValues: {
      name: mealPlanName
        ? t('saveAsTemplate.templateNameSuffix', { name: mealPlanName })
        : '',
      description: '',
      category: TemplateCategory.Weekly,
      tags: '',
    },
  });
  useSheetUnsavedInput(isDirty);

  const save = handleSubmit(({ name, description, category, tags }) => {
    const tagList = parseCommaTags(tags);
    onSave({
      mealPlanId,
      name,
      description: description || undefined,
      category,
      tags: tagList.length > 0 ? tagList : undefined,
    });
  }, reportValidationErrors);

  return (
    <>
      <SheetHeaderSlot>
        <SheetHeader
          title={t('labels.saveAsTemplate')}
          onClose={onClose}
          confirm={{
            onPress: () => {
              void save();
            },
            loading: saving,
          }}
        />
      </SheetHeaderSlot>

      {!!homeName && (
        <View style={styles.infoNote}>
          <Text role="caption" tone="accent">
            {t('saveAsTemplate.sharedWithHome', { name: homeName })}
          </Text>
        </View>
      )}

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormInput
            label={t('labels.templateName')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('saveAsTemplate.templateNamePlaceholder')}
            error={fieldState.error?.message}
            required
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <FormTextArea
            label={t('labels.description')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('saveAsTemplate.descriptionPlaceholder')}
          />
        )}
      />

      {/* Category selector */}
      <View style={styles.section}>
        <Text role="label" tone="secondary">
          {t('labels.category')}
        </Text>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <ChipScrollRow
              options={categoryOptions}
              selected={field.value}
              onSelect={field.onChange}
              edgeFadeColor="surface"
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="tags"
        render={({ field, fieldState }) => (
          <FormInput
            label={t('saveAsTemplate.tagsLabel')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t('saveAsTemplate.tagsPlaceholder')}
            error={fieldState.error?.message}
          />
        )}
      />
    </>
  );
};

export const SaveAsTemplateSheet: React.FC<SaveAsTemplateSheetProps> = ({
  visible,
  mealPlanId,
  ...form
}) => {
  const opening = useOpening(visible && mealPlanId !== null, mealPlanId);

  return (
    <Sheet
      mode="form"
      headerFromContent
      visible={visible}
      onDismiss={form.onClose}
      snapPoints={['70%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      {opening?.payload ? (
        <SaveAsTemplateForm
          key={opening.id}
          mealPlanId={opening.payload}
          {...form}
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
    gap: theme.spacing.md,
  },
  section: {
    gap: theme.spacing.sm,
  },
  infoNote: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
  },
}));
