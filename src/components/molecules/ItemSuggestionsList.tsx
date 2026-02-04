import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { ItemSuggestion } from '#generated';

interface ItemSuggestionsListProps {
  /** Search query for the "Add manually" text */
  searchQuery: string;
  /** Autocomplete suggestions from the API */
  suggestions: ItemSuggestion[];
  /** Whether suggestions are currently loading (kept for potential future use) */
  loading?: boolean;
  /** Position of the "Add manually" option */
  addManuallyPosition: 'top' | 'bottom';
  /** Callback when "Add manually" is pressed */
  onAddManually: () => void;
  /** Callback when a suggestion is selected */
  onSelectSuggestion: (item: ItemSuggestion) => void;
  /** Whether quick add is disabled (e.g., during mutation) */
  quickAddDisabled?: boolean;
  /** Icon to show in suggestion placeholder (default: 'inventory-2') */
  placeholderIcon?: 'inventory-2' | 'shopping-cart';
  /** Whether to show brand names (default: true) */
  showBrands?: boolean;
}

export const ItemSuggestionsList: React.FC<ItemSuggestionsListProps> = ({
  searchQuery,
  suggestions,
  addManuallyPosition,
  onAddManually,
  onSelectSuggestion,
  quickAddDisabled = false,
  placeholderIcon = 'inventory-2',
  showBrands = true,
}) => {
  const { theme } = useUnistyles();

  const hasResults = suggestions.length > 0;

  // Render "Add manually" option
  const renderAddManually = (isLast: boolean) => (
    <TouchableOpacity
      key="add-manually"
      style={[styles.addManuallyOption, !isLast && styles.itemBorder]}
      onPress={onAddManually}
    >
      <Icon
        name="add-circle-outline"
        size={20}
        color={theme.colors.primary}
        library="MaterialIcons"
      />
      <Text style={styles.addManuallyText}>
        {hasResults
          ? `Add "${searchQuery}" manually`
          : `No matches. Add "${searchQuery}" manually`}
      </Text>
    </TouchableOpacity>
  );

  // Render a single suggestion item
  const renderSuggestion = (item: ItemSuggestion, isLast: boolean) => {
    const imageUrl = item.imageUrl || null;
    return (
      <View
        key={item.id}
        style={[styles.suggestionItem, !isLast && styles.itemBorder]}
      >
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon
                name={placeholderIcon}
                size={20}
                color={theme.colors.primary}
                library="MaterialIcons"
              />
            </View>
          )}
        </View>
        <View style={styles.suggestionInfo}>
          <Text style={styles.suggestionName} numberOfLines={1}>
            {item.name}
          </Text>
          {showBrands && item.brands && item.brands.length > 0 && (
            <Text style={styles.suggestionBrands} numberOfLines={1}>
              {item.brands[0].name}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.quickAddButton,
            quickAddDisabled && styles.quickAddButtonDisabled,
          ]}
          onPress={() => onSelectSuggestion(item)}
          disabled={quickAddDisabled}
        >
          <Icon
            name="add"
            size={20}
            color={theme.colors.primary}
            library="MaterialIcons"
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {addManuallyPosition === 'top' && renderAddManually(!hasResults)}
      {suggestions.map((item, index) => {
        const isLastSuggestion = index === suggestions.length - 1;
        const isLast =
          addManuallyPosition === 'top' ? isLastSuggestion : false;
        return renderSuggestion(item, isLast);
      })}
      {addManuallyPosition === 'bottom' && renderAddManually(true)}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  imageContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
    marginRight: theme.spacing.md,
  },
  image: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  suggestionName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  suggestionBrands: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  quickAddButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddButtonDisabled: {
    opacity: 0.5,
  },
  addManuallyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addManuallyText: {
    fontSize: theme.fonts.size.base,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
}));
