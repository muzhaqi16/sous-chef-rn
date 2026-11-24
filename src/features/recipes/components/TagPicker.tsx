import React, { useState } from 'react';
import { SearchBar } from '#components/molecules/SearchBar';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { useBottomSheetScrollableCreator } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { identity, useLocalSearch } from '#hooks/search/useLocalSearch';
import { Divider } from '#components/atoms/Divider';
import { Sheet } from '#components/templates/Sheet';
import { useOpening } from '#hooks/ui/useOpening';

const TagListSeparator = () => <View style={styles.tagSeparator} />;
// Every row is the same component, so one recycling pool is correct.
const getItemType = () => 'item';

export interface TagPickerProps {
  visible: boolean;
  tags: string[];
  selectedTags: string[];
  onSelect: (tags: string[]) => void;
  onCancel: () => void;
  loading?: boolean;
}

type TagPickerContentProps = Omit<TagPickerProps, 'visible' | 'onCancel'>;

/** One opening: the search starts empty. */
const TagPickerContent: React.FC<TagPickerContentProps> = ({
  tags,
  selectedTags,
  onSelect,
  loading = false,
}) => {
  const BottomSheetScrollable = useBottomSheetScrollableCreator();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTags = useLocalSearch(tags, searchQuery, [identity]);

  const handleToggleTag = (tag: string) => {
    const newSelection = selectedTags.includes(tag)
      ? selectedTags.filter(existing => existing !== tag)
      : [...selectedTags, tag];
    onSelect(newSelection);
  };

  const handleClearAll = () => {
    onSelect([]);
  };

  const renderTagItem = ({ item }: { item: string }) => {
    const isSelected = selectedTags.includes(item);
    return (
      <AppPressable
        style={[styles.tagItem, isSelected && styles.tagItemSelected]}
        onPress={() => handleToggleTag(item)}
      >
        <Icon
          name="pricetag-outline"
          size="sm"
          tone={isSelected ? 'primary' : 'textSecondary'}
        />
        <Text
          role={isSelected ? 'bodyStrong' : 'body'}
          tone={isSelected ? 'accent' : 'primary'}
          style={styles.tagName}
          numberOfLines={1}
        >
          {item}
        </Text>
        {!!isSelected && <Icon name="checkmark" size="sm" tone="primary" />}
      </AppPressable>
    );
  };

  return (
    <>
      <View style={styles.header}>
        <Text role="heading">{t('tagPicker.filterByTags')}</Text>
      </View>

      {/* Search Input */}
      {tags.length > 5 && (
        <SearchBar
          placeholder={t('tagPicker.searchPlaceholder')}
          defaultValue={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          containerStyle={styles.search}
        />
      )}

      {/* Clear All / Selected Count */}
      <View style={styles.selectionRow}>
        <Text role="caption" tone="secondary">
          {selectedTags.length === 0
            ? t('tagPicker.noneSelected')
            : t('tagPicker.selectedCount', {
                count: selectedTags.length,
              })}
        </Text>
        {selectedTags.length > 0 && (
          <Pressable
            onPress={handleClearAll}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text role="label" tone="accent">
              {t('labels.clearAll')}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Divider */}
      <Divider style={styles.dividerGap} />

      {/* Tags List */}
      {loading ? (
        <View style={styles.centeredSpinner}>
          <Text role="body" tone="secondary">
            {t('tagPicker.loading')}
          </Text>
        </View>
      ) : filteredTags.length > 0 ? (
        <FlashList
          renderScrollComponent={BottomSheetScrollable}
          data={filteredTags}
          renderItem={renderTagItem}
          getItemType={getItemType}
          keyExtractor={(item: string) => item}
          extraData={selectedTags}
          showsVerticalScrollIndicator={false}
          style={styles.tagList}
          contentContainerStyle={styles.tagListContent}
          ItemSeparatorComponent={TagListSeparator}
        />
      ) : tags.length > 0 && searchQuery ? (
        <View style={styles.emptyInset}>
          <Text role="body" tone="secondary" align="center">
            {t('tagPicker.noMatches', { query: searchQuery })}
          </Text>
        </View>
      ) : (
        <View style={styles.emptyInset}>
          <Text role="body" tone="secondary" align="center">
            {t('tagPicker.noTags')}
          </Text>
        </View>
      )}
    </>
  );
};

export const TagPicker: React.FC<TagPickerProps> = ({
  visible,
  onCancel,
  ...content
}) => {
  const opening = useOpening(visible);

  return (
    <Sheet
      mode="view"
      visible={visible}
      onDismiss={onCancel}
      snapPoints={['55%', '70%']}
      contentContainerStyle={styles.bottomSheetContent}
    >
      {opening ? <TagPickerContent key={opening.id} {...content} /> : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  bottomSheetContent: {
    padding: theme.spacing.mdPlus,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    gap: theme.spacing.base,
  },
  tagItemSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  tagName: {
    flex: 1,
  },
  dividerGap: {
    marginVertical: theme.spacing.md,
  },
  tagList: {
    maxHeight: 250,
  },
  tagListContent: {
    paddingBottom: theme.spacing.sm,
  },
  tagSeparator: {
    height: theme.spacing.sm,
  },
  centeredSpinner: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyInset: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  search: {
    marginBottom: theme.spacing.md,
  },
}));
