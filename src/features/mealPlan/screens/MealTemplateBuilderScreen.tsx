import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import type { StaticScreenProps } from '@react-navigation/native';
import { Pressable } from '#components/atoms/themedComponents';
import { FormScreen } from '#components/templates/FormScreen';
import { FormInput } from '#components/atoms/FormInput';
import { FormTextArea } from '#components/atoms/FormTextArea';
import { FormSelect } from '#components/molecules/FormSelect';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMealTemplateEditor } from '#features/mealPlan/hooks/useMealTemplateEditor';
import { useMealTemplateForEdit } from '#features/mealPlan/hooks/useMealTemplateForEdit';
import { TemplateCategory, MealType } from '#/graphql/generated/schemaTypes';
import { generateId } from '#/utils/generateId';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { logValidationErrors } from '#/utils/validation/common';
import {
  templateDefaults,
  templateItemDefaults,
  templateItemSchema,
  templateSchema,
  type TemplateFormValues,
  type TemplateItemFormValues,
} from './mealTemplateBuilderFormConfig';

const CATEGORY_OPTIONS = [
  TemplateCategory.Weekly,
  TemplateCategory.Monthly,
  TemplateCategory.Breakfast,
  TemplateCategory.Lunch,
  TemplateCategory.Dinner,
  TemplateCategory.Holiday,
  TemplateCategory.SpecialDiet,
  TemplateCategory.Custom,
];

const MEAL_TYPE_OPTIONS = [
  MealType.Breakfast,
  MealType.Brunch,
  MealType.Lunch,
  MealType.Dinner,
  MealType.Snack,
  MealType.Dessert,
];

/** BREAKFAST -> "Breakfast", SPECIAL_DIET -> "Special Diet" (mirrors formatPlanType). */
function formatEnum(value: string): string {
  return value
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

// A meal held in the builder before it becomes a server item (create mode) or
// mirrored from a loaded template item (edit mode; `serverId` is set).
interface DraftItem {
  key: string;
  serverId?: string;
  dayOffset: number;
  mealType: MealType;
  customMealName: string;
  servings: number;
}

export const MealTemplateBuilderScreen: React.FC<
  StaticScreenProps<{ templateId?: string } | undefined>
> = ({ route }) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const templateId = route.params?.templateId;
  const isEdit = !!templateId;

  const {
    createTemplate,
    updateTemplate,
    addItem,
    updateItem,
    removeItem,
    creating,
    updating,
  } = useMealTemplateEditor();

  // Only EDIT mode touches the server per item; in create mode the rows are
  // local drafts flushed with the template itself, which is local-first. So
  // being offline blocks editing an existing template's items, and nothing at
  // all about building a new one.

  const { template: loaded } = useMealTemplateForEdit(templateId);

  // Two forms on one screen: the template's own metadata, and the sub-form that
  // adds one meal to it.
  const templateForm = useForm<TemplateFormValues>({
    resolver: yupResolver(templateSchema),
    defaultValues: templateDefaults(TemplateCategory.Weekly),
    mode: 'onTouched',
  });

  // Draft items (create mode). In edit mode the list comes from `loaded.items`.
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const itemForm = useForm<TemplateItemFormValues>({
    resolver: yupResolver(templateItemSchema),
    defaultValues: templateItemDefaults(MealType.Breakfast),
    mode: 'onTouched',
  });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  // Hydrate the metadata form from the loaded template once, adjusting state
  // during render (not an effect) when the loaded template first arrives.
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  if (loaded && hydratedId !== loaded.id) {
    setHydratedId(loaded.id);
    templateForm.reset({
      name: loaded.name,
      category: loaded.category ?? TemplateCategory.Weekly,
      description: loaded.description ?? '',
      defaultServings: String(loaded.defaultServings ?? 2),
      tags: (loaded.tags ?? []).join(', '),
    });
  }

  const items: DraftItem[] = isEdit
    ? (loaded?.items ?? []).map(item => ({
        key: item.id,
        serverId: item.id,
        dayOffset: item.dayOffset,
        mealType: item.mealType,
        customMealName: item.customMealName ?? '',
        servings: item.servings ?? 2,
      }))
    : draftItems;

  const resetItemForm = () => {
    itemForm.reset(templateItemDefaults(MealType.Breakfast));
    setEditingKey(null);
    setEditingServerId(null);
  };

  const loadItemIntoForm = (item: DraftItem) => {
    itemForm.reset({
      itemDay: String(item.dayOffset),
      itemMealType: item.mealType,
      itemName: item.customMealName,
      itemServings: String(item.servings),
    });
    setEditingKey(item.key);
    setEditingServerId(item.serverId ?? null);
  };

  // Reaching here means the sub-form's schema passed, so the missing-name rule
  // has already reported itself on the name field.
  const onValidItem = async ({
    itemDay: day,
    itemMealType,
    itemName,
    itemServings,
  }: TemplateItemFormValues) => {
    const dayOffset = parseInt(day) || 0;
    const servings = parseInt(itemServings) || 2;
    const customMealName = itemName.trim();

    if (isEdit && templateId) {
      const ok = editingServerId
        ? await updateItem({
            id: editingServerId,
            dayOffset,
            mealType: itemMealType,
            meal: { customMealName },
            servings,
          })
        : await addItem({
            templateId,
            dayOffset,
            mealType: itemMealType,
            meal: { customMealName },
            servings,
          });
      if (ok) resetItemForm();
      return;
    }

    setDraftItems(prev => {
      const next: DraftItem = {
        // A unique id, not an index-derived key: prev.length repeats after a
        // remove-then-add, colliding with an existing row's key (duplicate
        // React keys, and removing one row would filter out both).
        key: editingKey ?? `draft-${generateId()}`,
        dayOffset,
        mealType: itemMealType,
        customMealName,
        servings,
      };
      return editingKey
        ? prev.map(it => (it.key === editingKey ? next : it))
        : [...prev, next];
    });
    resetItemForm();
  };

  const handleRemoveItem = (item: DraftItem) => {
    if (isEdit && item.serverId) {
      removeItem(item.serverId, templateId);
    } else {
      setDraftItems(prev => prev.filter(it => it.key !== item.key));
    }
    if (editingKey === item.key) resetItemForm();
  };

  const parseTags = (tags: string) =>
    tags
      .split(',')
      .map((tag: string) => tag.trim())
      .filter(Boolean);

  // Reaching here means the template schema passed, so the missing-name rule
  // has already reported itself on the name field.
  const onValidTemplate = async ({
    name,
    category,
    description,
    defaultServings,
    tags,
  }: TemplateFormValues) => {
    const servingsValue = parseInt(defaultServings) || 2;

    if (isEdit && templateId) {
      const ok = await updateTemplate(templateId, {
        name: name.trim(),
        category,
        description: description.trim() || null,
        defaultServings: servingsValue,
        tags: parseTags(tags),
      });
      if (ok) goBack();
      return;
    }

    const newId = await createTemplate({
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      defaultServings: servingsValue,
      tags: parseTags(tags),
      items: draftItems.map(item => ({
        dayOffset: item.dayOffset,
        mealType: item.mealType,
        meal: { customMealName: item.customMealName },
        servings: item.servings,
      })),
    });
    if (newId) goBack();
  };

  return (
    <FormScreen
      title={isEdit ? t('labels.editTemplate') : t('labels.newTemplate')}
      onClose={goBack}
      onSave={templateForm.handleSubmit(onValidTemplate, logValidationErrors)}
      loading={creating || updating}
      testID="meal-template-builder-screen"
    >
      <Controller
        control={templateForm.control}
        name="name"
        render={({ field, fieldState }) => (
          <FormInput
            label={t('labels.templateName')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder={t('mealTemplateBuilder.namePlaceholder')}
            required
            testID="template-name-input"
          />
        )}
      />

      <Controller
        control={templateForm.control}
        name="category"
        render={({ field }) => (
          <FormSelect
            label={t('labels.category')}
            value={field.value}
            onValueChange={value => field.onChange(value as TemplateCategory)}
            options={CATEGORY_OPTIONS.map(value => ({
              label: formatEnum(value),
              value,
            }))}
          />
        )}
      />

      <Controller
        control={templateForm.control}
        name="defaultServings"
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
        control={templateForm.control}
        name="description"
        render={({ field }) => (
          <FormTextArea
            label={t('mealTemplateBuilder.description')}
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t('mealTemplateBuilder.descriptionPlaceholder')}
          />
        )}
      />

      <Controller
        control={templateForm.control}
        name="tags"
        render={({ field }) => (
          <FormInput
            label={t('mealTemplateBuilder.tags')}
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t('labels.commaSeparated')}
          />
        )}
      />

      {/* Meals */}
      <SectionHeader variant="title" style={styles.sectionTitle}>
        {t('mealTemplateBuilder.mealsSection')}
      </SectionHeader>

      {items.length === 0 ? (
        <Text role="caption" tone="secondary" style={styles.emptyMeals}>
          {t('mealTemplateBuilder.noMeals')}
        </Text>
      ) : (
        items.map(item => {
          // Only a row that exists on the server needs a network call to
          // remove; a local draft row is removed from state either way.
          return (
            <View key={item.key} style={styles.itemRow}>
              <Pressable
                style={styles.itemInfo}
                onPress={() => loadItemIntoForm(item)}
              >
                <Text role="label">{item.customMealName}</Text>
                <Text role="caption" tone="secondary">
                  {t('mealTemplateBuilder.itemSummary', {
                    day: item.dayOffset + 1,
                    meal: formatEnum(item.mealType),
                    servings: item.servings,
                  })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleRemoveItem(item)}
                accessibilityLabel={t('a11y.removeNamed', {
                  name: item.customMealName || formatEnum(item.mealType),
                })}
                hitSlop={8}
                testID={`remove-item-${item.key}`}
              >
                <Icon name="close-circle" size={22} tone="error" />
              </Pressable>
            </View>
          );
        })
      )}

      {/* Add / edit meal sub-form */}
      <View style={styles.itemForm}>
        <Controller
          control={itemForm.control}
          name="itemName"
          render={({ field, fieldState }) => (
            <FormInput
              label={t('mealTemplateBuilder.mealName')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              placeholder={t('mealTemplateBuilder.mealNamePlaceholder')}
              testID="item-name-input"
            />
          )}
        />
        <Controller
          control={itemForm.control}
          name="itemMealType"
          render={({ field }) => (
            <FormSelect
              label={t('labels.mealType')}
              value={field.value}
              onValueChange={value => field.onChange(value as MealType)}
              options={MEAL_TYPE_OPTIONS.map(value => ({
                label: formatEnum(value),
                value,
              }))}
            />
          )}
        />
        <Controller
          control={itemForm.control}
          name="itemDay"
          render={({ field }) => (
            <EditableCounter
              label={t('mealTemplateBuilder.dayNumber')}
              // The field holds a zero-based offset; the control shows day 1.
              value={String((parseInt(field.value) || 0) + 1)}
              onChangeText={text =>
                field.onChange(String(Math.max(0, (parseInt(text) || 1) - 1)))
              }
              min={1}
              step={1}
            />
          )}
        />
        <Controller
          control={itemForm.control}
          name="itemServings"
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
        <Pressable
          style={({ pressed }) => [
            styles.addMealButton,
            pressed && styles.pressed,
          ]}
          onPress={itemForm.handleSubmit(onValidItem, logValidationErrors)}
          testID="submit-item-button"
        >
          <Icon
            name={editingKey ? 'checkmark' : 'add'}
            size={18}
            tone="primary"
          />
          <Text tone="primary" style={styles.addMealText}>
            {editingKey
              ? t('mealTemplateBuilder.updateMeal')
              : t('mealTemplateBuilder.addMeal')}
          </Text>
        </Pressable>
      </View>
    </FormScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  sectionTitle: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyMeals: {
    marginBottom: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  itemInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  itemForm: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  addMealText: {
    marginLeft: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
