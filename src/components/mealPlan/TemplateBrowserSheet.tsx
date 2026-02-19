import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { GlobalBottomSheetBackdrop } from '#components/atoms/GlobalBottomSheetBackdrop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedBottomSheetConfigs } from '#hooks/useSharedBottomSheetConfigs';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { TemplateCard } from './TemplateCard';
import { useMealTemplates } from '#hooks/mealPlan/useMealTemplates';
import { TemplateCategory, type MealTemplateDisplayFragment } from '#generated';

const CATEGORIES: { key: TemplateCategory | undefined; label: string }[] = [
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
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const animationConfigs = useSharedBottomSheetConfigs();

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

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderTemplate = useCallback(
    ({ item }: { item: MealTemplateDisplayFragment }) => (
      <TemplateCard template={item} onPress={onSelectTemplate} />
    ),
    [onSelectTemplate],
  );

  const keyExtractor = useCallback(
    (item: MealTemplateDisplayFragment) => item.id,
    [],
  );

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={['85%']}
      enablePanDownToClose
      enableDynamicSizing={false}
      topInset={insets.top}
      onDismiss={onClose}
      animationConfigs={animationConfigs}
      backgroundStyle={{ backgroundColor: theme.colors.background }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.textSecondary }}
      backdropComponent={props => (
        <GlobalBottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
          onClose={() => bottomSheetRef.current?.dismiss()}
        />
      )}
    >
      <BottomSheetView
        style={[styles.container, { paddingBottom: insets.bottom + 16 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Browse Templates</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" library="Ionicons" size={24} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" library="Ionicons" size={18} color={theme.colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search templates..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipScroll}
        >
          {CATEGORIES.map(cat => {
            const isActive = selectedCategory === cat.key;
            return (
              <Pressable
                key={cat.label}
                onPress={() => setSelectedCategory(cat.key)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Template list */}
        {loading && templates.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : templates.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon
              name="document-text-outline"
              library="Ionicons"
              size={48}
              color={theme.colors.textTertiary}
            />
            <Text style={styles.emptyText}>No templates found</Text>
          </View>
        ) : (
          <FlashList
            data={templates}
            renderItem={renderTemplate}
            keyExtractor={keyExtractor}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            onEndReached={hasMore ? loadMore : undefined}
            onEndReachedThreshold={0.5}
          />
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
  chipRow: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fonts.weight.medium,
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
