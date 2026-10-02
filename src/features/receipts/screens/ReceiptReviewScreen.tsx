import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { ItemList } from '#components/organisms/ItemList';
import { Text } from '#components/atoms/Text';
import type { BadgeContent } from '#components/atoms/Badge';
import { Icon, type IconTone } from '#utils/iconUtils';
import { Button } from '#components/molecules/Button';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { toastService } from '#/services/toastService';
import { rowType } from '#/theme/foundations/type';
import { useMoney } from '#domain/money';
import { fromDateKey, toDateKey } from '#/utils/dateUtils';
import {
  formatQuantityDisplay,
  formatQuantityForDisplay,
} from '#/utils/formatQuantity';
import { ReceiptLineSheet } from '../components/ReceiptLineSheet';
import {
  useReceiptReview,
  type ReceiptReviewRow,
  type ReceiptRowStatus,
} from '../hooks/useReceiptReview';
import { receiptsTestIDs } from '../testIDs';

type ReviewSection = 'toAdd' | 'pending' | 'notAdded' | 'added';

// Lines that will be added first, then those waiting for a match, those that
// won't be added, and those already in.
const SECTION_OF: Record<ReceiptRowStatus, ReviewSection> = {
  add: 'toAdd',
  failed: 'toAdd',
  pending: 'pending',
  guess: 'notAdded',
  unmatched: 'notAdded',
  skipped: 'notAdded',
  added: 'added',
};
const SECTION_ORDER: readonly ReviewSection[] = [
  'toAdd',
  'pending',
  'notAdded',
  'added',
];

const STATUS_ICON: Record<ReceiptRowStatus, { name: string; tone: IconTone }> =
  {
    add: { name: 'checkmark-circle', tone: 'success' },
    failed: { name: 'alert-circle', tone: 'error' },
    added: { name: 'checkmark-done-circle', tone: 'success' },
    pending: { name: 'hourglass-outline', tone: 'iconTertiary' },
    guess: { name: 'help-circle', tone: 'warning' },
    unmatched: { name: 'ellipse-outline', tone: 'iconTertiary' },
    skipped: { name: 'remove-circle-outline', tone: 'iconTertiary' },
  };

export const ReceiptReviewScreen: React.FC = () => {
  const { t } = useTranslation();
  const money = useMoney();
  const { toPantryMain } = useAppNavigation();
  const {
    rows,
    merchant,
    store,
    purchasedOn,
    dayIsScanDay,
    setPurchasedOn,
    chooseStore,
    totalsGap,
    matchState,
    retryMatching,
    pantryName,
    pendingCount,
    applying,
    chooseLine,
    listItemNameFor,
    addChosen,
    finish,
  } = useReceiptReview();

  // The draft is cleared once the screen has gone: cleared first, the review
  // shows its "no items" state while it slides away.
  const applied = useRef(false);
  useEffect(
    () => () => {
      if (applied.current) finish();
    },
    [finish],
  );

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
  const editingRow = editing
    ? rows.find(row => row.index === editing.index)
    : undefined;

  const subtitleOf = (row: ReceiptReviewRow) => {
    const { choice } = row;
    switch (row.status) {
      case 'failed':
        return row.failure ?? t('receipts.review.notAdded');
      case 'pending':
        return matchState === 'failed'
          ? t('receipts.review.notMatchedYet')
          : t('receipts.review.findingMatch');
      case 'guess':
        return t('receipts.review.maybe', { name: row.guess ?? '' });
      case 'unmatched':
        return t('receipts.review.choose');
      case 'skipped':
        return t('receipts.review.leftOut');
      case 'add':
      case 'added': {
        if (!choice) return row.printed;
        const amount = choice.unitText
          ? formatQuantityDisplay(choice.quantity, choice.unitText)
          : formatQuantityForDisplay(choice.quantity);
        return t('receipts.review.chosenDetail', {
          printed: row.printed,
          amount,
        });
      }
    }
  };

  const badgeOf = (row: ReceiptReviewRow): BadgeContent | undefined => {
    switch (row.status) {
      case 'added':
        return { text: t('labels.added'), variant: 'success' };
      case 'failed':
        return { text: t('receipts.review.notAdded'), variant: 'danger' };
      case 'guess':
        return { text: t('receipts.review.check'), variant: 'warning' };
      case 'add':
        return row.onList
          ? { text: t('receipts.review.onList'), variant: 'primary' }
          : undefined;
      case 'pending':
      case 'unmatched':
      case 'skipped':
        return undefined;
    }
  };

  const sectionTitle = (section: ReviewSection, count: number) => {
    switch (section) {
      case 'toAdd':
        return t('receipts.review.sectionToAdd', { count });
      case 'pending':
        return matchState === 'failed'
          ? t('receipts.review.sectionNotMatchedYet', { count })
          : t('receipts.review.sectionMatching', { count });
      case 'notAdded':
        return t('receipts.review.sectionNotAdded', { count });
      case 'added':
        return t('receipts.review.sectionAdded', { count });
    }
  };

  const items = SECTION_ORDER.flatMap(section => {
    const inSection = rows.filter(row => SECTION_OF[row.status] === section);
    return inSection.map((row, at) => {
      const price = row.choice ? row.choice.price : row.price;
      const icon = STATUS_ICON[row.status];
      return {
        id: String(row.index),
        title: row.choice?.itemName ?? row.printed,
        subtitle: subtitleOf(row),
        badge: badgeOf(row),
        leftElement: <Icon name={icon.name} size="md" tone={icon.tone} />,
        rightElement:
          price === undefined || price === null ? undefined : (
            <Text
              role={rowType.title}
              tone={section === 'toAdd' ? 'primary' : 'secondary'}
            >
              {money(price)}
            </Text>
          ),
        ...(at === 0
          ? { sectionTitle: sectionTitle(section, inSection.length) }
          : {}),
      };
    });
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
    applied.current = true;
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
      title={store?.name ?? merchant ?? t('receipts.review.title')}
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
              <View style={styles.details}>
                <StoreAutocompleteField
                  variant="modal"
                  label={t('labels.store')}
                  value={store?.name ?? ''}
                  // Kept by id, from the pick: typed text alone is no store.
                  onChangeText={() => undefined}
                  onStoreSelected={(id, name) => {
                    if (id && name) chooseStore({ id, name });
                  }}
                  placeholder={t('receipts.review.storePlaceholder')}
                  helperText={t('labels.storeSelectHint')}
                  testID={receiptsTestIDs.reviewStore}
                />
                <View>
                  <DatePickerField
                    label={t('receipts.review.dateLabel')}
                    value={fromDateKey(purchasedOn)}
                    onChange={date => {
                      if (date) setPurchasedOn(toDateKey(date));
                    }}
                    maximumDate={new Date()}
                    testID={receiptsTestIDs.reviewDate}
                  />
                  {dayIsScanDay ? (
                    <Text role="caption" tone="tertiary">
                      {t('receipts.review.dateScanned')}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text role="body" tone="secondary">
                {matchState === 'matching'
                  ? t('receipts.review.matching')
                  : pantryName
                  ? t('receipts.review.introTo', { pantry: pantryName })
                  : t('receipts.review.intro')}
              </Text>
              {matchState === 'failed' && (
                <AlertBanner
                  variant="warning"
                  icon="cloud-offline-outline"
                  iconLibrary="Ionicons"
                  title={t('receipts.review.matchFailedTitle')}
                  subtitle={t('receipts.review.matchFailedBody')}
                  onPress={retryMatching}
                  showChevron
                  testID={receiptsTestIDs.reviewMatchRetry}
                />
              )}
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
        choice={editingRow?.choice}
        candidates={editingRow?.candidates ?? []}
        listItemNameFor={key =>
          editing ? listItemNameFor(editing.index, key) : undefined
        }
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
  details: {
    gap: theme.spacing.md,
  },
  intro: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
}));
