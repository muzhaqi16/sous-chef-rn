import React from 'react';
import { SearchBar } from '#components/molecules/SearchBar';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { FlashList } from '@shopify/flash-list';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { StyleSheet } from 'react-native-unistyles';
import { PaginationFooter } from '#components/atoms/PaginationFooter';
import { FLASHLIST_DEFAULTS } from '#constants/flashListDefaults';
import { TemplateCard } from './TemplateCard';
import {
  TemplateBrowserProvider,
  useTemplateBrowserActions,
} from './TemplateBrowserContext';
import {
  ChipScrollRow,
  type ChipOption,
} from '#components/molecules/ChipScrollRow';
import {
  useMealTemplates,
  type MealTemplateRef,
} from '#features/mealPlan/hooks/useMealTemplates';
import { TemplateCategory } from '#/graphql/generated/schemaTypes';
import type { MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import { DataStateView } from '#components/organisms/DataStateView';
import { useDataState } from '#hooks/data/useDataState';

const CATEGORY_KEYS: {
  key: TemplateCategory | undefined;
  labelKey: TranslationKey;
}[] = [
  { key: undefined, labelKey: 'templateBrowser.categoryAll' },
  { key: TemplateCategory.Weekly, labelKey: 'labels.weekly' },
  {
    key: TemplateCategory.Monthly,
    labelKey: 'labels.monthly',
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

const keyExtractor = (item: MealTemplateRef) => item.id;

const TemplateBrowserRenderItemComponent: React.FC<{
  item: MealTemplateRef;
}> = ({ item }) => {
  const { onSelectTemplate } = useTemplateBrowserActions();
  return <TemplateCard template={item} onPress={onSelectTemplate} />;
};

const TemplateBrowserRenderItem = TemplateBrowserRenderItemComponent;

const renderTemplate = ({ item }: { item: MealTemplateRef }) => (
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
      isLoadingMore,
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
    <Sheet
      mode="list"
      visible={visible}
      onDismiss={onClose}
      snapPoints={['85%']}
      header={
        <SheetHeader title={t('templateBrowser.title')} onClose={onClose} />
      }
    >
      <View style={styles.container}>
        {/* Search bar */}
        <SearchBar
          placeholder={t('templateBrowser.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          containerStyle={styles.search}
        />

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
        {dataState !== 'ready' ? (
          <DataStateView
            state={dataState}
            onRetry={refetch}
            empty={{
              icon: 'document-text-outline',
              title: t('templateBrowser.noTemplates'),
            }}
          />
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
              ListFooterComponent={
                <PaginationFooter
                  hasMore={hasMore}
                  isFetchingMore={isLoadingMore}
                  itemCount={templates.length}
                />
              }
            />
          </TemplateBrowserProvider>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
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
  search: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
}));
