import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { useQuery } from '@apollo/client/react';
import type { StaticScreenProps } from '@react-navigation/native';
import { Pressable } from '#components/atoms/themedComponents';
import { FormModal } from '#components/organisms/FormModal';
import { FormInput } from '#components/molecules/FormInput';
import { FormTextArea } from '#components/molecules/FormTextArea';
import { FormSelect } from '#components/molecules/FormSelect';
import { EditableCounter } from '#components/molecules/EditableCounter';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { alertService } from '#/services/alertService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useMealTemplateEditor } from '#features/mealPlan/hooks/useMealTemplateEditor';
import { GetMealTemplateForEditDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { TemplateCategory, MealType } from '#/graphql/generated/schemaTypes';
import { generateId } from '#/utils/generateId';

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

  const { data } = useQuery(GetMealTemplateForEditDocument, {
    variables: { id: templateId ?? '' },
    skip: !templateId,
  });
  const loaded = data?.mealTemplate;

  // Metadata form
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>(
    TemplateCategory.Weekly,
  );
  const [description, setDescription] = useState('');
  const [defaultServings, setDefaultServings] = useState('2');
  const [tags, setTags] = useState('');

  // Draft items (create mode). In edit mode the list comes from `loaded.items`.
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  // Item sub-form
  const [itemDay, setItemDay] = useState('0');
  const [itemMealType, setItemMealType] = useState<MealType>(
    MealType.Breakfast,
  );
  const [itemName, setItemName] = useState('');
  const [itemServings, setItemServings] = useState('2');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  // Hydrate the metadata form from the loaded template once, adjusting state
  // during render (not an effect) when the loaded template first arrives.
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  if (loaded && hydratedId !== loaded.id) {
    setHydratedId(loaded.id);
    setName(loaded.name);
    setCategory(loaded.category ?? TemplateCategory.Weekly);
    setDescription(loaded.description ?? '');
    setDefaultServings(String(loaded.defaultServings ?? 2));
    setTags((loaded.tags ?? []).join(', '));
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
    setItemDay('0');
    setItemMealType(MealType.Breakfast);
    setItemName('');
    setItemServings('2');
    setEditingKey(null);
    setEditingServerId(null);
  };

  const loadItemIntoForm = (item: DraftItem) => {
    setItemDay(String(item.dayOffset));
    setItemMealType(item.mealType);
    setItemName(item.customMealName);
    setItemServings(String(item.servings));
    setEditingKey(item.key);
    setEditingServerId(item.serverId ?? null);
  };

  const handleSubmitItem = async () => {
    if (!itemName.trim()) {
      alertService.alert(
        t('mealTemplateBuilder.itemNameRequiredTitle'),
        t('mealTemplateBuilder.itemNameRequiredMessage'),
      );
      return;
    }
    const dayOffset = parseInt(itemDay) || 0;
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
      removeItem(item.serverId);
    } else {
      setDraftItems(prev => prev.filter(it => it.key !== item.key));
    }
    if (editingKey === item.key) resetItemForm();
  };

  const parseTags = () =>
    tags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

  const handleSave = async () => {
    if (!name.trim()) {
      alertService.alert(
        t('mealTemplateBuilder.nameRequiredTitle'),
        t('mealTemplateBuilder.nameRequiredMessage'),
      );
      return;
    }
    const servingsValue = parseInt(defaultServings) || 2;

    if (isEdit && templateId) {
      const ok = await updateTemplate(templateId, {
        name: name.trim(),
        category,
        description: description.trim() || null,
        defaultServings: servingsValue,
        tags: parseTags(),
      });
      if (ok) goBack();
      return;
    }

    const newId = await createTemplate({
      name: name.trim(),
      category,
      description: description.trim() || undefined,
      defaultServings: servingsValue,
      tags: parseTags(),
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
    <FormModal
      title={
        isEdit
          ? t('mealTemplateBuilder.editTitle')
          : t('mealTemplateBuilder.createTitle')
      }
      onClose={goBack}
      onSave={handleSave}
      loading={creating || updating}
      testID="meal-template-builder-screen"
    >
      <FormInput
        label={t('mealTemplateBuilder.name')}
        value={name}
        onChangeText={setName}
        placeholder={t('mealTemplateBuilder.namePlaceholder')}
        required
        testID="template-name-input"
      />

      <FormSelect
        label={t('mealTemplateBuilder.category')}
        value={category}
        onValueChange={value => setCategory(value as TemplateCategory)}
        options={CATEGORY_OPTIONS.map(value => ({
          label: formatEnum(value),
          value,
        }))}
      />

      <EditableCounter
        label={t('mealTemplateBuilder.defaultServings')}
        value={defaultServings}
        onChangeText={setDefaultServings}
        min={1}
        step={1}
      />

      <FormTextArea
        label={t('mealTemplateBuilder.description')}
        value={description}
        onChangeText={setDescription}
        placeholder={t('mealTemplateBuilder.descriptionPlaceholder')}
      />

      <FormInput
        label={t('mealTemplateBuilder.tags')}
        value={tags}
        onChangeText={setTags}
        placeholder={t('mealTemplateBuilder.tagsPlaceholder')}
      />

      {/* Meals */}
      <Text size="md" weight="semibold" style={styles.sectionTitle}>
        {t('mealTemplateBuilder.mealsSection')}
      </Text>

      {items.length === 0 ? (
        <Text size="sm" tone="secondary" style={styles.emptyMeals}>
          {t('mealTemplateBuilder.noMeals')}
        </Text>
      ) : (
        items.map(item => (
          <View key={item.key} style={styles.itemRow}>
            <Pressable
              style={styles.itemInfo}
              onPress={() => loadItemIntoForm(item)}
            >
              <Text size="sm" weight="medium">
                {item.customMealName}
              </Text>
              <Text size="xs" tone="secondary">
                {t('mealTemplateBuilder.itemSummary', {
                  day: item.dayOffset + 1,
                  meal: formatEnum(item.mealType),
                  servings: item.servings,
                })}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleRemoveItem(item)}
              hitSlop={8}
              testID={`remove-item-${item.key}`}
            >
              <Icon name="close-circle" size={22} tone="error" />
            </Pressable>
          </View>
        ))
      )}

      {/* Add / edit meal sub-form */}
      <View style={styles.itemForm}>
        <FormInput
          label={t('mealTemplateBuilder.mealName')}
          value={itemName}
          onChangeText={setItemName}
          placeholder={t('mealTemplateBuilder.mealNamePlaceholder')}
          testID="item-name-input"
        />
        <FormSelect
          label={t('mealTemplateBuilder.mealType')}
          value={itemMealType}
          onValueChange={value => setItemMealType(value as MealType)}
          options={MEAL_TYPE_OPTIONS.map(value => ({
            label: formatEnum(value),
            value,
          }))}
        />
        <EditableCounter
          label={t('mealTemplateBuilder.dayNumber')}
          value={String((parseInt(itemDay) || 0) + 1)}
          onChangeText={text =>
            setItemDay(String(Math.max(0, (parseInt(text) || 1) - 1)))
          }
          min={1}
          step={1}
        />
        <EditableCounter
          label={t('mealTemplateBuilder.servings')}
          value={itemServings}
          onChangeText={setItemServings}
          min={1}
          step={1}
        />
        <Pressable
          style={({ pressed }) => [
            styles.addMealButton,
            pressed && styles.pressed,
          ]}
          onPress={handleSubmitItem}
          testID="submit-item-button"
        >
          <Icon
            name={editingKey ? 'checkmark' : 'add'}
            size={18}
            tone="accent"
          />
          <Text size="md" tone="accent" style={styles.addMealText}>
            {editingKey
              ? t('mealTemplateBuilder.updateMeal')
              : t('mealTemplateBuilder.addMeal')}
          </Text>
        </Pressable>
      </View>
    </FormModal>
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  itemForm: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
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
