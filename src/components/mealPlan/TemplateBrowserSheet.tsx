import React from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
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
import { useMealTemplates } from '#hooks/mealPlan/useMealTemplates';
import { TemplateCategory, type MealTemplateDisplayFragment } from '#generated';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';

const CATEGORIES: ChipOption<TemplateCategory | undefined>[] = [
  { key: undefined, label: 'All' },
  { key: TemplateCategory.Weekly, label: 'Weekly' },
  { key: TemplateCategory.Monthly, label: 'Monthly' },
  { key: TemplateCategory.Breakfast, label: 'Breakfast' },
  { key: TemplateCategory.Lunch, label: 'Lunch' },
  { key: TemplateCategory.Dinner, label: 'Dinner' },
  { key: TemplateCategory.Holiday, label: 'Holiday' },
  { key: TemplateCategory.SpecialDiet, label: 'Special Diet' },
  { key: TemplateCategory.Custom, label: 'Custom' },
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
  const { ref, modalProps, contentContainerStyle, theme } =
    useStandardBottomSheet({
      visible,
      onDismiss: onClose,
      snapPoints: ['85%'],
    });

  const {
    templates,
    loading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    loadMore,
    hasMore,
  } = useMealTemplates();

  return (
    <BottomSheetModal ref={ref} {...modalProps}>
      <BottomSheetView style={[styles.container, contentContainerStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Browse Templates</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={24} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color={theme.colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search templates..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category chips */}
        <ChipScrollRow
          options={CATEGORIES}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRowContent}
        />

        {/* Template list */}
        {loading && templates.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : templates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon
              name="document-text-outline"
              size={48}
              color={theme.colors.textTertiary}
            />
            <Text style={styles.emptyText}>No templates found</Text>
          </View>
        ) : (
          <TemplateBrowserProvider onSelectTemplate={onSelectTemplate}>
            <FlashList
              data={templates}
              renderItem={renderTemplate}
              keyExtractor={keyExtractor}
              getItemType={getTemplateItemType}
              {...FLASHLIST_DEFAULTS.bottomSheet}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              onEndReached={hasMore ? loadMore : undefined}
              onEndReachedThreshold={0.5}
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
  title: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
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
  emptyText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.textSecondary,
  },
}));
