import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetHeader } from '#components/molecules/BottomSheetHeader';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/molecules/ChipScrollRow';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { Text } from '#components/atoms/Text';
import { TemplateCategory } from '#/graphql/generated/schemaTypes';
import { Sheet } from '#components/templates/Sheet';

const CATEGORY_OPTION_KEYS: { key: TemplateCategory; labelKey: string }[] = [
  { key: TemplateCategory.Weekly, labelKey: 'saveAsTemplate.categoryWeekly' },
  { key: TemplateCategory.Monthly, labelKey: 'saveAsTemplate.categoryMonthly' },
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
  /** Server unreachable (offline / API down) — disables confirm (no replay path). */
  disabled?: boolean;
}

export const SaveAsTemplateSheet: React.FC<SaveAsTemplateSheetProps> = ({
  visible,
  mealPlanId,
  mealPlanName,
  homeName,
  onClose,
  onSave,
  saving,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const categoryOptions: ChipOption<TemplateCategory>[] =
    CATEGORY_OPTION_KEYS.map(o => ({ key: o.key, label: t(o.labelKey) }));

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TemplateCategory>(
    TemplateCategory.Weekly,
  );
  const [tagsInput, setTagsInput] = useState('');

  // Reset state when sheet opens (render-time conditional state update)
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevMealPlanName, setPrevMealPlanName] = useState(mealPlanName);
  if (visible !== prevVisible || mealPlanName !== prevMealPlanName) {
    setPrevVisible(visible);
    setPrevMealPlanName(mealPlanName);
    if (visible) {
      setName(
        mealPlanName
          ? t('saveAsTemplate.templateNameSuffix', { name: mealPlanName })
          : '',
      );
      setDescription('');
      setCategory(TemplateCategory.Weekly);
      setTagsInput('');
    }
  }

  const handleSave = () => {
    if (!mealPlanId || !name.trim()) return;
    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    onSave({
      mealPlanId,
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['70%']}
      contentContainerStyle={styles.contentContainer}
      style={styles.scrollView}
    >
      <BottomSheetHeader
        title={t('labels.saveAsTemplate')}
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? t('labels.saving') : t('labels.save')}
        confirmDisabled={saving || disabled || !name.trim()}
        confirmColor="primary"
      />

      {!!homeName && (
        <View style={styles.infoNote}>
          <Text role="caption" tone="accent">
            {t('saveAsTemplate.sharedWithHome', { name: homeName })}
          </Text>
        </View>
      )}

      <FormInput
        label={t('labels.templateName')}
        value={name}
        onChangeText={setName}
        placeholder={t('saveAsTemplate.templateNamePlaceholder')}
        required
      />

      <FormTextArea
        label={t('saveAsTemplate.descriptionLabel')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('saveAsTemplate.descriptionPlaceholder')}
      />

      {/* Category selector */}
      <View style={styles.section}>
        <Text role="label" tone="secondary">
          {t('labels.category')}
        </Text>
        <ChipScrollRow
          options={categoryOptions}
          selected={category}
          onSelect={setCategory}
          edgeFadeColor="surface"
        />
      </View>

      <FormInput
        label={t('saveAsTemplate.tagsLabel')}
        value={tagsInput}
        onChangeText={setTagsInput}
        placeholder={t('saveAsTemplate.tagsPlaceholder')}
      />
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
