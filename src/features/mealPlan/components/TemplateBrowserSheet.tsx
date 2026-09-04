import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  Pressable,
  PrimaryActivityIndicator,
  ThemedBottomSheetTextInput,
} from '#components/atoms/themedComponents';
import { FlashList } from '@shopify/flash-list';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
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
} from '#components/molecules/ChipScrollRow';
import { useMealTemplates } from '#features/mealPlan/hooks/useMealTemplates';
import { TemplateCategory } from '#/graphql/generated/schemaTypes';
import { type MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { Text } from '#components/atoms/Text';
import { DataStateView } from '#components/organisms/DataStateView';
import { useDataState } from '#hooks/data/useDataState';

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
      labelKey: 'labels.breakfast',
    },
    { key: TemplateCategory.Lunch, labelKey: 'labels.lunch' },
    { key: TemplateCategory.Dinner, labelKey: 'labels.dinner' },
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
    state: {
      templates,
      loading,
      error,
      hasResult,
      searchQuery,
      selectedCategory,
      hasMore,
    },
    actions: { setSearchQuery, setSelectedCategory, loadMore, refetch },
  } = useMealTemplates();

  const dataState = useDataState({
    loading,
    error,
    hasResult,
    isEmpty: templates.length === 0,
  });

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      {/*
        A plain View, NOT `BottomSheetView`: gorhom's own container style is
        absolutely positioned with no bottom and no height, and it composes
        AFTER the caller's — so a `flex: 1` here loses and the FlashList below
        is never height-bounded.
      */}
      <View style={[styles.container, contentContainerStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <Text role="heading">{t('templateBrowser.title')}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityLabel={t('labels.close')}
          >
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
        {dataState === 'loading' ? (
          <View style={styles.centeredSpinner}>
            <PrimaryActivityIndicator size="large" />
          </View>
        ) : dataState === 'error' || dataState === 'offline' ? (
          // `error` and `offline` both need a retry affordance — reading only
          // `offline` renders a genuine failure as "No templates found".
          <DataStateView state={dataState} onRetry={refetch} />
        ) : dataState === 'empty' ? (
          <View style={styles.emptyInset}>
            <Icon name="document-text-outline" size={48} tone="textTertiary" />
            <Text tone="secondary" align="center">
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
      </View>
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
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    ...theme.type.body,
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
  centeredSpinner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyInset: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
}));
