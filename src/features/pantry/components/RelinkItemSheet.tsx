import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import type { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';
import { RowCard } from '#components/atoms/RowCard';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { ListItem } from '#components/molecules/ListItem';
import { Loading } from '#components/molecules/Loading';
import { SearchBar } from '#components/molecules/SearchBar';
import { Sheet } from '#components/templates/Sheet';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useItemAutocomplete } from '#features/catalog/hooks/useItemAutocomplete';
import { useMovePantryItem } from '#features/pantry/hooks/mutations/useMovePantryItem';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { resolveImageUrl } from '#utils/imageUtils';
import { commonStyles } from '#/styles/commonStyles';

interface RelinkItemSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** The stack being moved, as the detail last read it. */
  stack: { id: string; version: number; itemId: string; itemName: string };
  /** Re-reads the stack after a version conflict. */
  onConflictRefresh: () => void;
}

/**
 * "Not this item?": moves a pantry entry onto the catalog item it really is,
 * keeping its stock and history. Opens searching the entry's own name, the one
 * it was matched from.
 */
export const RelinkItemSheet: React.FC<RelinkItemSheetProps> = ({
  visible,
  onDismiss,
  stack,
  onConflictRefresh,
}) => {
  const { t } = useTranslation();
  const { toPantryItemDetail } = useAppNavigation();
  const autocomplete = useItemAutocomplete({ debounceMs: 0 });
  const { handleSearchTermChange, reset } = autocomplete;
  const { moveToItem, moving } = useMovePantryItem();

  useEffect(() => {
    if (visible) handleSearchTermChange(stack.itemName);
    else reset();
  }, [visible, stack.itemName, handleSearchTermChange, reset]);

  const candidates = autocomplete.displayItems.filter(
    item => item.id !== stack.itemId,
  );
  const searched =
    autocomplete.searchTerm.length >= 2 && !autocomplete.isLoading;

  const handlePick = async (picked: ItemSuggestion) => {
    const outcome = await moveToItem(stack, picked.id, onConflictRefresh);
    if (outcome.status === 'failed') return;
    onDismiss();
    if (outcome.status === 'moved') {
      toastService.success(
        outcome.receiptCorrectionRecorded
          ? t('relinkItem.movedLearned', { name: picked.name })
          : t('relinkItem.moved', { name: picked.name }),
      );
      return;
    }
    // Refused, not merged: the stack already there is where its stock goes.
    alertService.alert(
      t('duplicateItem.title'),
      t('relinkItem.duplicateBody', { name: picked.name }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('relinkItem.openExisting'),
          onPress: () =>
            toPantryItemDetail({ itemId: outcome.existingPantryItemId }),
        },
      ],
    );
  };

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['85%']}
      title={t('relinkItem.title')}
      contentContainerStyle={commonStyles.bottomSheetContent}
    >
      <View testID={pantryTestIDs.relinkSheet}>
        <Text role="body" tone="secondary" style={styles.hint}>
          {t('relinkItem.hint')}
        </Text>
        <SearchBar
          testID={pantryTestIDs.relinkSearchInput}
          placeholder={t('relinkItem.searchPlaceholder')}
          defaultValue={stack.itemName}
          onChangeText={handleSearchTermChange}
          debounceMs={250}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          isLoading={!!autocomplete.isLoading}
          containerStyle={styles.search}
        />
        {moving ? (
          <Loading size="small" message={t('relinkItem.moving')} />
        ) : (
          candidates.map(item => (
            <RowCard
              key={item.id}
              testID={pantryTestIDs.relinkCandidate(item.id)}
            >
              <ListItem
                title={item.name}
                subtitle={item.category?.name ?? undefined}
                leftElement={<RowThumbnail uri={resolveImageUrl(item)} />}
                onPress={() => {
                  void handlePick(item);
                }}
                accessibilityLabel={t('relinkItem.moveTo', { name: item.name })}
              />
            </RowCard>
          ))
        )}
        {!moving && !!searched && candidates.length === 0 && (
          <Text role="body" tone="secondary" align="center">
            {t('empty.noResultsFor', { query: autocomplete.searchTerm })}
          </Text>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  hint: {
    marginBottom: theme.spacing.md,
  },
  search: {
    marginBottom: theme.spacing.md,
  },
}));
