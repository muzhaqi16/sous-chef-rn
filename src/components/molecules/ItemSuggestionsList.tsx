import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { resolveImageUrl } from '#utils/imageUtils';
import { Text } from '#components/atoms/Text';
import { ItemSuggestion } from '#/graphql/generated/schemaTypes';

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
  /** Icon to show in suggestion placeholder (default: 'cube-outline') */
  placeholderIcon?: 'cube-outline' | 'cart-outline';
  /** Whether to show brand names (default: true) */
  showBrands?: boolean;
  /** When false, always show placeholder icon regardless of image URL */
  showImages?: boolean;
}

interface SuggestionRowProps {
  item: ItemSuggestion;
  isLast: boolean;
  onSelectSuggestion: (item: ItemSuggestion) => void;
  quickAddDisabled: boolean;
  placeholderIcon: 'cube-outline' | 'cart-outline';
  primaryColor: string;
  showBrands: boolean;
  showImages: boolean;
}

const SuggestionRow = ({
  item,
  isLast,
  onSelectSuggestion,
  quickAddDisabled,
  placeholderIcon,
  primaryColor,
  showBrands,
  showImages,
}: SuggestionRowProps) => {
  const imageUrl = resolveImageUrl(item);
  const handlePress = () => onSelectSuggestion(item);

  return (
    <View style={[styles.suggestionItem, !isLast && styles.itemBorder]}>
      {!!showImages && (
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <CachedImage uri={imageUrl} style={styles.image} displaySize={40} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name={placeholderIcon} size={20} color={primaryColor} />
            </View>
          )}
        </View>
      )}
      <View style={styles.suggestionInfo}>
        <Text size="base" weight="medium" numberOfLines={1}>
          {item.name}
        </Text>
        {!!showBrands && !!item.brands && item.brands.length > 0 && (
          <Text
            size="sm"
            tone="secondary"
            style={styles.suggestionBrands}
            numberOfLines={1}
          >
            {item.brands[0].name}
          </Text>
        )}
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.quickAddButton,
          quickAddDisabled && styles.quickAddButtonDisabled,
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
        disabled={quickAddDisabled}
      >
        <Icon name="add" size={20} color={primaryColor} />
      </Pressable>
    </View>
  );
};

export const ItemSuggestionsList = ({
  searchQuery,
  suggestions,
  addManuallyPosition,
  onAddManually,
  onSelectSuggestion,
  quickAddDisabled = false,
  placeholderIcon = 'cube-outline',
  showBrands = true,
  showImages = true,
}: ItemSuggestionsListProps) => {
  const { theme } = useUnistyles();

  const hasResults = suggestions.length > 0;

  // Render "Add manually" option
  const renderAddManually = (isLast: boolean) => (
    <Pressable
      key="add-manually"
      style={({ pressed }) => [
        styles.addManuallyOption,
        !isLast && styles.itemBorder,
        pressed && styles.pressed,
      ]}
      onPress={onAddManually}
    >
      <Icon name="add-circle-outline" size={20} tone="primary" />
      <Text size="base" tone="accent" weight="medium">
        {hasResults
          ? `Add "${searchQuery}" manually`
          : `No matches. Add "${searchQuery}" manually`}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {addManuallyPosition === 'top' && renderAddManually(!hasResults)}
      {suggestions.map((item, index) => {
        const isLastSuggestion = index === suggestions.length - 1;
        const isLast = addManuallyPosition === 'top' ? isLastSuggestion : false;
        return (
          <SuggestionRow
            key={item.id}
            item={item}
            isLast={isLast}
            onSelectSuggestion={onSelectSuggestion}
            quickAddDisabled={quickAddDisabled}
            placeholderIcon={placeholderIcon}
            primaryColor={theme.colors.primary}
            showBrands={showBrands}
            showImages={showImages}
          />
        );
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
  suggestionBrands: {
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
    opacity: theme.opacity.disabled,
  },
  addManuallyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
