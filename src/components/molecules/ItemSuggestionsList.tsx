import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { resolveImageUrl } from '#utils/imageUtils';
import { Text } from '#components/atoms/Text';
import { useTranslation } from '#/i18n';
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
  /** Renders a "wrong details?" footer row under the results. Omit for no footer.
   *  Only shown when there are results — with none there is nothing to report. */
  onReportItem?: () => void;
}

interface SuggestionRowProps {
  item: ItemSuggestion;
  isLast: boolean;
  onSelectSuggestion: (item: ItemSuggestion) => void;
  quickAddDisabled: boolean;
  placeholderIcon: 'cube-outline' | 'cart-outline';
  showBrands: boolean;
  showImages: boolean;
}

const SuggestionRow = ({
  item,
  isLast,
  onSelectSuggestion,
  quickAddDisabled,
  placeholderIcon,
  showBrands,
  showImages,
}: SuggestionRowProps) => {
  const imageUrl = resolveImageUrl(item);
  const handlePress = () => onSelectSuggestion(item);

  styles.useVariants({ withBorder: !isLast, disabled: quickAddDisabled });

  return (
    <View style={styles.suggestionItem}>
      {!!showImages && (
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <CachedImage uri={imageUrl} style={styles.image} displaySize={40} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon name={placeholderIcon} size={20} tone="primary" />
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
      <AppPressable
        style={styles.quickAddButton}
        onPress={handlePress}
        disabled={quickAddDisabled}
      >
        <Icon name="add" size={20} tone="primary" />
      </AppPressable>
    </View>
  );
};

interface AddManuallyOptionProps {
  isLast: boolean;
  hasResults: boolean;
  searchQuery: string;
  onPress: () => void;
}

const AddManuallyOption = ({
  isLast,
  hasResults,
  searchQuery,
  onPress,
}: AddManuallyOptionProps) => {
  styles.useVariants({ withBorder: !isLast, disabled: false });

  return (
    <AppPressable
      key="add-manually"
      style={styles.addManuallyOption}
      onPress={onPress}
    >
      <Icon name="add-circle-outline" size={20} tone="primary" />
      <Text size="base" tone="accent" weight="medium">
        {hasResults
          ? `Add "${searchQuery}" manually`
          : `No matches. Add "${searchQuery}" manually`}
      </Text>
    </AppPressable>
  );
};

// No `styles.useVariants` here, unlike the rows above: `reportOption` declares
// no variants, so selecting them would be a no-op.
const ReportItemOption = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();

  return (
    <AppPressable
      style={styles.reportOption}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('reportItem.footer')}
    >
      <Icon name="alert-circle-outline" size={18} tone="secondary" />
      <Text size="sm" tone="secondary">
        {t('reportItem.footer')}
      </Text>
    </AppPressable>
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
  onReportItem,
}: ItemSuggestionsListProps) => {
  const hasResults = suggestions.length > 0;

  // Render "Add manually" option
  const renderAddManually = (isLast: boolean) => {
    return (
      <AddManuallyOption
        isLast={isLast}
        hasResults={hasResults}
        searchQuery={searchQuery}
        onPress={onAddManually}
      />
    );
  };

  // Only rendered with results behind it — with none there is nothing to report.
  const showReportOption = !!onReportItem && hasResults;

  return (
    <View style={styles.container}>
      {addManuallyPosition === 'top' && renderAddManually(!hasResults)}
      {suggestions.map((item, index) => {
        // `isLast` drops the row's separator, so it means "nothing follows me"
        // rather than "last suggestion" — with add-manually or the report row
        // below, the separator has to stay.
        const isLast =
          addManuallyPosition === 'top' &&
          index === suggestions.length - 1 &&
          !showReportOption;
        return (
          <SuggestionRow
            key={item.id}
            item={item}
            isLast={isLast}
            onSelectSuggestion={onSelectSuggestion}
            quickAddDisabled={quickAddDisabled}
            placeholderIcon={placeholderIcon}
            showBrands={showBrands}
            showImages={showImages}
          />
        );
      })}
      {addManuallyPosition === 'bottom' && renderAddManually(!showReportOption)}
      {!!showReportOption && <ReportItemOption onPress={onReportItem} />}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    variants: {
      withBorder: {
        true: {
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
      },
    },
  },
  imageContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
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
    variants: {
      disabled: {
        true: { opacity: theme.opacity.disabled },
      },
    },
  },
  addManuallyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    variants: {
      withBorder: {
        true: {
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
      },
    },
  },
  // Secondary tone throughout so it doesn't compete with the accent-toned
  // "Add manually" call to action directly above it.
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
