import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { ItemList } from '#components/organisms/ItemList';
import { Text } from '#components/atoms/Text';
import type { BadgeContent } from '#components/atoms/Badge';
import { Button } from '#components/molecules/Button';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { toastService } from '#/services/toastService';
import { rowType } from '#/theme/foundations/type';
import { useMoney } from '#domain/money';
import {
  formatQuantityDisplay,
  formatQuantityForDisplay,
} from '#/utils/formatQuantity';
import { ReceiptLineSheet } from '../components/ReceiptLineSheet';
import {
  useReceiptReview,
  type ReceiptReviewRow,
} from '../hooks/useReceiptReview';
import { receiptsTestIDs } from '../testIDs';

export const ReceiptReviewScreen: React.FC = () => {
  const { t } = useTranslation();
  const money = useMoney();
  const { toPantryMain } = useAppNavigation();
  const {
    rows,
    merchant,
    totalsGap,
    pantryName,
    pendingCount,
    applying,
    chooseLine,
    addChosen,
    finish,
  } = useReceiptReview();

  const [editing, setEditing] = useState<ReceiptReviewRow | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [opening, setOpening] = useState(0);
  const openLine = (id: string) => {
    const row = rows.find(candidate => String(candidate.index) === id);
    if (!row || row.added) return;
    setEditing(row);
    setOpening(count => count + 1);
    setSheetVisible(true);
  };
  const closeSheet = () => setSheetVisible(false);
  // The saved choice, not the one captured when the row was tapped.
  const editingChoice = editing
    ? rows.find(row => row.index === editing.index)?.choice
    : undefined;

  const subtitleOf = (row: ReceiptReviewRow) => {
    if (row.failure) return row.failure;
    const { choice } = row;
    if (!choice) return t('receipts.review.choose');
    // One of no stated unit says nothing the receipt line does not.
    if (!choice.unitText && choice.quantity === 1) return row.printed;
    const amount = choice.unitText
      ? formatQuantityDisplay(choice.quantity, choice.unitText)
      : formatQuantityForDisplay(choice.quantity);
    return t('receipts.review.chosenDetail', { printed: row.printed, amount });
  };

  const badgeOf = (row: ReceiptReviewRow): BadgeContent | undefined => {
    if (row.added) return { text: t('labels.added'), variant: 'success' };
    if (row.failure) {
      return { text: t('receipts.review.notAdded'), variant: 'danger' };
    }
    return undefined;
  };

  const items = rows.map(row => {
    const price = row.choice ? row.choice.price : row.price;
    return {
      id: String(row.index),
      title: row.choice?.itemName ?? row.printed,
      subtitle: subtitleOf(row),
      badge: badgeOf(row),
      rightElement:
        price === undefined || price === null ? undefined : (
          <Text role={rowType.title}>{money(price)}</Text>
        ),
    };
  });

  const handleAdd = async () => {
    const { added, failed } = await addChosen();
    if (failed > 0) {
      toastService.error(t('receipts.review.someFailed', { count: failed }));
      return;
    }
    toastService.success(
      pantryName
        ? t('receipts.review.addedTo', { count: added, pantry: pantryName })
        : t('receipts.review.addedCount', { count: added }),
    );
    finish();
    toPantryMain();
  };

  const footer =
    rows.length > 0 ? (
      <Button
        onPress={() => {
          void handleAdd();
        }}
        disabled={pendingCount === 0}
        loading={applying}
        icon="add-circle-outline"
        testID={receiptsTestIDs.reviewAdd}
      >
        {pendingCount > 0
          ? t('receipts.review.add', { count: pendingCount })
          : t('receipts.review.addNone')}
      </Button>
    ) : undefined;

  return (
    <SubScreen
      title={merchant ?? t('receipts.review.title')}
      scroll="list"
      footer={footer}
      testID={receiptsTestIDs.reviewScreen}
    >
      <ItemList
        items={items}
        onItemPress={openLine}
        testIDPrefix={receiptsTestIDs.reviewLine}
        ListHeaderComponent={
          rows.length > 0 ? (
            <View style={styles.intro}>
              <Text role="body" tone="secondary">
                {pantryName
                  ? t('receipts.review.introTo', { pantry: pantryName })
                  : t('receipts.review.intro')}
              </Text>
              {!!totalsGap && (
                <AlertBanner
                  variant="warning"
                  icon="alert-circle-outline"
                  iconLibrary="Ionicons"
                  title={t('receipts.review.totalsTitle')}
                  subtitle={t('receipts.review.totalsBody', {
                    counted: money(totalsGap.counted),
                    printed: money(totalsGap.printed),
                  })}
                  testID={receiptsTestIDs.reviewTotalsGap}
                />
              )}
            </View>
          ) : null
        }
        emptyState={{
          icon: 'receipt-outline',
          title: t('receipts.review.emptyTitle'),
          description: t('receipts.review.emptyBody'),
        }}
      />
      <ReceiptLineSheet
        visible={sheetVisible}
        line={editing}
        choice={editingChoice}
        opening={opening}
        onClose={closeSheet}
        onSave={choice => {
          if (editing) chooseLine(editing.index, choice);
        }}
        onRemove={() => {
          if (editing) chooseLine(editing.index, null);
          closeSheet();
        }}
      />
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  intro: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
}));
