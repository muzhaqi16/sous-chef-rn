import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  MEAL_TYPE_LABEL_KEYS,
  TEMPLATE_CATEGORY_LABEL_KEYS,
} from '#features/mealPlan/utils/mealPlanEnumLabels';
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
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { logValidationErrors } from '#/utils/validation/common';
import { AddMealSheet } from '#features/mealPlan/components/AddMealSheet';
import {
  changedMealRef,
  mealRefOf,
  templateDefaults,
  templateItemDefaults,
  templateItemSchema,
  templateSchema,
  type TemplateFormValues,
  type TemplateItemFormValues,
} from './mealTemplateBuilderFormConfig';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';

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

// A meal held in the builder before it becomes a server item (create mode) or
// mirrored from a loaded template item (edit mode; `serverId` is set).
interface DraftItem {
  key: string;
  serverId?: string;
  dayOffset: number;
  mealType: MealType;
  customMealName: string;
  recipeId: string | null;
  recipeName: string;
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
    readRecipeName,
    creating,
    updating,
  } = useMealTemplateEditor();

  // Edit mode writes each item as it is saved; create mode holds drafts until
  // the template itself is created.
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
  const [recipePickerVisible, setRecipePickerVisible] = useState(false);
  const [itemRecipeId, itemRecipeName, itemMealType] = useWatch({
    control: itemForm.control,
    name: ['itemRecipeId', 'itemRecipeName', 'itemMealType'],
  });

  // An effect, not a render-body adjustment: `reset` notifies every mounted
  // `Controller` synchronously, and a torn-up concurrent render drops it.
  // Keyed on the id, not the loaded object — a cache write emits a new object
  // for the same template, and rehydrating there discards unsaved edits.
  const hydratedTemplateId = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded || hydratedTemplateId.current === loaded.id) return;
    hydratedTemplateId.current = loaded.id;
    templateForm.reset({
      name: loaded.name,
      category: loaded.category,
      description: loaded.description ?? '',
      defaultServings: String(loaded.defaultServings),
      tags: loaded.tags.join(', '),
    });
  }, [loaded, templateForm]);

  const items: DraftItem[] = isEdit
    ? (loaded?.items ?? []).map(item => ({
        key: item.id,
        serverId: item.id,
        dayOffset: item.dayOffset,
        mealType: item.mealType,
        customMealName: item.customMealName ?? '',
        recipeId: item.recipe?.id ?? null,
        recipeName: item.recipe?.name ?? '',
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
      itemRecipeId: item.recipeId ?? '',
      itemRecipeName: item.recipeName,
      itemServings: String(item.servings),
    });
    setEditingKey(item.key);
    setEditingServerId(item.serverId ?? null);
  };

  const handlePickRecipe = (recipeId: string, mealType: MealType) => {
    itemForm.setValue('itemRecipeId', recipeId);
    itemForm.setValue('itemRecipeName', readRecipeName(recipeId));
    itemForm.setValue('itemMealType', mealType);
    // The recipe satisfies the name rule, so re-run it to clear a stale error.
    void itemForm.trigger('itemName');
  };

  const handlePickCustomMeal = (name: string, mealType: MealType) => {
    itemForm.setValue('itemRecipeId', '');
    itemForm.setValue('itemRecipeName', '');
    itemForm.setValue('itemName', name);
    itemForm.setValue('itemMealType', mealType);
  };

  const clearRecipe = () => {
    itemForm.setValue('itemRecipeId', '');
    itemForm.setValue('itemRecipeName', '');
  };

  // Reaching here means the sub-form's schema passed, so the missing-name rule
  // has already reported itself on the name field.
  const onValidItem = async (values: TemplateItemFormValues) => {
    const { itemDay: day, itemMealType: mealType, itemServings } = values;
    const dayOffset = parseInt(day) || 0;
    const servings = parseInt(itemServings) || 2;

    if (isEdit && templateId) {
      const original = items.find(it => it.serverId === editingServerId);
      const meal = original ? changedMealRef(original, values) : undefined;
      const ok = editingServerId
        ? await updateItem({
            id: editingServerId,
            dayOffset,
            mealType,
            servings,
            ...(meal ? { meal } : {}),
          })
        : await addItem({
            templateId,
            dayOffset,
            mealType,
            meal: mealRefOf(values),
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
        mealType,
        customMealName: values.itemRecipeId ? '' : values.itemName.trim(),
        recipeId: values.itemRecipeId || null,
        recipeName: values.itemRecipeName,
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
      void removeItem(item.serverId, templateId);
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
        meal: mealRefOf({
          itemRecipeId: item.recipeId ?? '',
          itemName: item.customMealName,
        }),
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
      testID={mealPlanTestIDs.templateBuilderScreen}
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
            testID={mealPlanTestIDs.templateNameInput}
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
            onValueChange={value => field.onChange(value)}
            options={CATEGORY_OPTIONS.map(value => ({
              label: t(TEMPLATE_CATEGORY_LABEL_KEYS[value]),
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
          const mealName = item.recipeId
            ? item.recipeName || t('mealTemplateBuilder.savedRecipe')
            : item.customMealName;
          return (
            <View key={item.key} style={styles.itemRow}>
              <Pressable
                style={styles.itemInfo}
                onPress={() => loadItemIntoForm(item)}
                testID={mealPlanTestIDs.templateItemRow(item.key)}
              >
                <View style={styles.itemTitle}>
                  {!!item.recipeId && (
                    <Icon name="book-outline" size={14} tone="primary" />
                  )}
                  <Text role="label">{mealName}</Text>
                </View>
                <Text role="caption" tone="secondary">
                  {t('mealTemplateBuilder.itemSummary', {
                    day: item.dayOffset + 1,
                    meal: t(MEAL_TYPE_LABEL_KEYS[item.mealType]),
                    servings: item.servings,
                  })}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleRemoveItem(item)}
                accessibilityLabel={t('a11y.removeNamed', {
                  name: mealName || t(MEAL_TYPE_LABEL_KEYS[item.mealType]),
                })}
                hitSlop={8}
                testID={mealPlanTestIDs.templateRemoveItem(item.key)}
              >
                <Icon name="close-circle" size={22} tone="error" />
              </Pressable>
            </View>
          );
        })
      )}

      {/* Add / edit meal sub-form */}
      <View style={styles.itemForm}>
        {itemRecipeId ? (
          <View
            style={styles.recipeRow}
            testID={mealPlanTestIDs.templateItemRecipe}
          >
            <Icon name="book-outline" size={18} tone="primary" />
            <Text role="label" style={styles.recipeName} numberOfLines={1}>
              {itemRecipeName || t('mealTemplateBuilder.savedRecipe')}
            </Text>
            <Pressable
              onPress={clearRecipe}
              accessibilityLabel={t('a11y.removeNamed', {
                name: itemRecipeName || t('mealTemplateBuilder.savedRecipe'),
              })}
              hitSlop={8}
              testID={mealPlanTestIDs.templateClearRecipeButton}
            >
              <Icon name="close-circle" size={20} tone="textSecondary" />
            </Pressable>
          </View>
        ) : (
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
                testID={mealPlanTestIDs.templateItemNameInput}
              />
            )}
          />
        )}
        <Pressable
          style={({ pressed }) => [
            styles.chooseRecipeButton,
            pressed && styles.pressed,
          ]}
          onPress={() => setRecipePickerVisible(true)}
          testID={mealPlanTestIDs.templateChooseRecipeButton}
        >
          <Icon name="book-outline" size={18} tone="primary" />
          <Text role="label" tone="primary">
            {itemRecipeId
              ? t('mealTemplateBuilder.changeRecipe')
              : t('mealTemplateBuilder.chooseRecipe')}
          </Text>
        </Pressable>
        <Controller
          control={itemForm.control}
          name="itemMealType"
          render={({ field }) => (
            <FormSelect
              label={t('labels.mealType')}
              value={field.value}
              onValueChange={value => field.onChange(value)}
              options={MEAL_TYPE_OPTIONS.map(value => ({
                label: t(MEAL_TYPE_LABEL_KEYS[value]),
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
          testID={mealPlanTestIDs.templateSubmitItemButton}
        >
          <Icon
            name={editingKey ? 'checkmark' : 'add'}
            size={18}
            tone="primary"
          />
          <Text role="body" tone="primary" style={styles.addMealText}>
            {editingKey
              ? t('mealTemplateBuilder.updateMeal')
              : t('mealTemplateBuilder.addMeal')}
          </Text>
        </Pressable>
      </View>

      <AddMealSheet
        visible={recipePickerVisible}
        onClose={() => setRecipePickerVisible(false)}
        initialMealType={itemMealType}
        onAddRecipe={handlePickRecipe}
        onAddCustomMeal={handlePickCustomMeal}
      />
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
  itemTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceVariant,
  },
  recipeName: {
    flex: 1,
  },
  chooseRecipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
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
