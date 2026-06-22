import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  PrimaryActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { FlashList } from '@shopify/flash-list';
import {
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { FLASHLIST_DEFAULTS } from '#utils/flashListDefaults';
import { TemplateCard } from './TemplateCard';
import {
  TemplateBrowserProvider,
  useTemplateBrowserActions,
} from './TemplateBrowserContext';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/atoms/ChipScrollRow';
import { useMealTemplates } from '#features/mealPlan/hooks/useMealTemplates';
import { TemplateCategory } from '#/graphql/generated/schemaTypes';
import { type MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';

const CATEGORY_KEYS: { key: TemplateCategory | undefined; labelKey: string }[] =
  [
    { key: undefined, labelKey: 'templateBrowser.categoryAll' },
    { key: TemplateCategory.Weekly, labelKey: 'saveAsTemplate.categoryWeekly' },
    {
      key: TemplateCategory.Monthly,
      labelKey: 'saveAsTemplate.categoryMonthly',
    },
    {
      key: TemplateCategory.Breakfast,
      labelKey: 'saveAsTemplate.categoryBreakfast',
    },
    { key: TemplateCategory.Lunch, labelKey: 'saveAsTemplate.categoryLunch' },
    { key: TemplateCategory.Dinner, labelKey: 'saveAsTemplate.categoryDinner' },
    {
      key: TemplateCategory.Holiday,
      labelKey: 'saveAsTemplate.categoryHoliday',
    },
    {
      key: TemplateCategory.SpecialDiet,
      labelKey: 'saveAsTemplate.categorySpecialDiet',
    },
    { key: TemplateCategory.Custom, labelKey: 'saveAsTemplate.categoryCustom' },
  ];

const keyExtractor = (item: MealTemplateDisplayFragment) => item.id;

const TemplateBrowserRenderItemComponent: React.FC<{
  item: MealTemplateDisplayFragment;
}> = ({ item }) => {
  const { onSelectTemplate } = useTemplateBrowserActions();
  return <TemplateCard template={item} onPress={onSelectTemplate} />;
};

const TemplateBrowserRenderItem = TemplateBrowserRenderItemComponent;

const renderTemplate = ({ item }: { item: MealTemplateDisplayFragment }) => (
  <TemplateBrowserRenderItem item={item} />
);

const getTemplateItemType = () => 'item';

interface TemplateBrowserSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: MealTemplateDisplayFragment) => void;
}

export const TemplateBrowserSheet: React.FC<TemplateBrowserSheetProps> = ({
  visible,
  onClose,
  onSelectTemplate,
}) => {
  const { t } = useTranslation();
  const categories: ChipOption<TemplateCategory | undefined>[] =
    CATEGORY_KEYS.map(o => ({ key: o.key, label: t(o.labelKey) }));
  const { ref, modalProps, contentContainerStyle } = useStandardBottomSheet({
    visible,
    onDismiss: onClose,
    snapPoints: ['85%'],
  });
  const BottomSheetScrollable = useBottomSheetScrollableCreator();

  const {
    state: { templates, loading, searchQuery, selectedCategory, hasMore },
    actions: { setSearchQuery, setSelectedCategory, loadMore },
  } = useMealTemplates();

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetView style={[styles.container, contentContainerStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <Text size="lg" weight="semibold">
            {t('templateBrowser.title')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={24} tone="textSecondary" />
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} tone="textTertiary" />
          <ThemedBottomSheetTextInput
            style={styles.searchInput}
            placeholder={t('templateBrowser.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category chips */}
        <ChipScrollRow
          options={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRowContent}
          edgeFadeColor="surface"
        />

        {/* Template list */}
        {loading && templates.length === 0 ? (
          <View style={styles.loadingContainer}>
            <PrimaryActivityIndicator size="large" />
          </View>
        ) : templates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="document-text-outline" size={48} tone="textTertiary" />
            <Text size="base" tone="secondary">
              {t('templateBrowser.noTemplates')}
            </Text>
          </View>
        ) : (
          <TemplateBrowserProvider onSelectTemplate={onSelectTemplate}>
            <FlashList
              renderScrollComponent={BottomSheetScrollable}
              data={templates}
              renderItem={renderTemplate}
              keyExtractor={keyExtractor}
              getItemType={getTemplateItemType}
              {...FLASHLIST_DEFAULTS.bottomSheet}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              onEndReached={hasMore ? loadMore : undefined}
            />
          </TemplateBrowserProvider>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fonts.size.base,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  chipScroll: {
    maxHeight: 44,
    marginBottom: theme.spacing.sm,
  },
  chipRowContent: {
    paddingHorizontal: theme.spacing.md,
  },
  list: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
}));
