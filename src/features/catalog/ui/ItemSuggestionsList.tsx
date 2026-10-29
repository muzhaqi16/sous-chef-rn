import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { Text } from '#components/atoms/Text';
import { ListItem } from '#components/molecules/ListItem';
import { resolveImageUrl } from '#utils/imageUtils';
import { useTranslation } from '#/i18n';
import type { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { QuickAddButton } from '#features/catalog/components/QuickAddButton';
import { catalogTestIDs } from '#features/catalog/testIDs';

interface ItemSuggestionsListProps {
  /** Search query for the "Add manually" text */
  searchQuery: string;
  /** Autocomplete suggestions from the API */
  suggestions: ItemSuggestion[];
  /** Position of the "Add manually" option */
  addManuallyPosition: 'top' | 'bottom';
  /** Sheet's testID prefix; names the "Add manually" row for e2e. */
  testIDPrefix: string;
  /** Callback when "Add manually" is pressed */
  onAddManually: () => void;
  /** Callback when a suggestion is selected */
  onSelectSuggestion: (item: ItemSuggestion) => void;
  /** Whether to show brand names (default: true) */
  showBrands?: boolean;
  /** When false, rows show no photo even when they have one */
  showImages?: boolean;
  /** Renders a "wrong details?" footer row under the results. Omit for no footer.
   *  Only shown when there are results — with none there is nothing to report. */
  onReportItem?: () => void;
}

interface SuggestionRowProps {
  item: ItemSuggestion;
  onSelectSuggestion: (item: ItemSuggestion) => void;
  showBrands: boolean;
  showImages: boolean;
}

const SuggestionRow = ({
  item,
  onSelectSuggestion,
  showBrands,
  showImages,
}: SuggestionRowProps) => {
  const { t } = useTranslation();

  return (
    <RowCard>
      <ListItem
        title={item.name}
        subtitle={showBrands ? item.brands[0]?.name : undefined}
        leftElement={
          showImages ? <RowThumbnail uri={resolveImageUrl(item)} /> : null
        }
        rightElement={
          <QuickAddButton
            onPress={() => onSelectSuggestion(item)}
            accessibilityLabel={t('a11y.quickAdd', { name: item.name })}
          />
        }
      />
    </RowCard>
  );
};

interface AddManuallyOptionProps {
  hasResults: boolean;
  searchQuery: string;
  onPress: () => void;
  testIDPrefix: string;
}

const AddManuallyOption = ({
  hasResults,
  searchQuery,
  onPress,
  testIDPrefix,
}: AddManuallyOptionProps) => {
  const { t } = useTranslation();

  return (
    <AppPressable
      style={styles.action}
      onPress={onPress}
      testID={catalogTestIDs.addManuallyButton(testIDPrefix)}
    >
      <Icon name="add-circle-outline" size={20} tone="primary" />
      <Text role="bodyStrong" tone="accent">
        {hasResults
          ? t('addItemSheet.addManuallyWithTerm', { term: searchQuery })
          : t('addItemSheet.noMatchesAddManually', { term: searchQuery })}
      </Text>
    </AppPressable>
  );
};

// Secondary tone throughout so it doesn't compete with the accent-toned
// "Add manually" call to action directly above it.
const ReportItemOption = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();

  return (
    <AppPressable
      style={styles.action}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('reportItem.footer')}
    >
      <Icon name="alert-circle-outline" size={18} tone="secondary" />
      <Text role="caption" tone="secondary">
        {t('reportItem.footer')}
      </Text>
    </AppPressable>
  );
};

export const ItemSuggestionsList = ({
  searchQuery,
  suggestions,
  addManuallyPosition,
  testIDPrefix,
  onAddManually,
  onSelectSuggestion,
  showBrands = true,
  showImages = true,
  onReportItem,
}: ItemSuggestionsListProps) => {
  const hasResults = suggestions.length > 0;
  // With no results there is nothing to report.
  const showReportOption = !!onReportItem && hasResults;

  const addManually = (
    <AddManuallyOption
      hasResults={hasResults}
      searchQuery={searchQuery}
      onPress={onAddManually}
      testIDPrefix={testIDPrefix}
    />
  );

  return (
    <View style={styles.container}>
      {addManuallyPosition === 'top' && addManually}
      {suggestions.map(item => (
        <SuggestionRow
          key={item.id}
          item={item}
          onSelectSuggestion={onSelectSuggestion}
          showBrands={showBrands}
          showImages={showImages}
        />
      ))}
      {addManuallyPosition === 'bottom' && addManually}
      {!!showReportOption && <ReportItemOption onPress={onReportItem} />}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
  },
  // A plain action beside the cards, its content in line with theirs.
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.layout.rowSlotGap,
    paddingVertical: theme.layout.rowInset,
    paddingHorizontal: theme.layout.rowInsetHorizontal,
    minHeight: theme.sizes.touchTarget.min,
  },
}));
