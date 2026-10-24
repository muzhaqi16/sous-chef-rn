import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { ItemList } from '#components/organisms/ItemList';
import { ItemCard } from '#components/organisms/ItemCard';
import { Text } from '#components/atoms/Text';
import { Reveal } from '#components/atoms/Reveal';
import type { BadgeVariant } from '#components/atoms/Badge';
import { Icon, type IconTone } from '#components/atoms/Icon';
import { AppPressable } from '#components/atoms/AppPressable';
import { Button } from '#components/molecules/Button';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { storeBranchLabel } from '#features/catalog/ui/storeBranchLabel';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { toastService } from '#/services/toastService';
import { rowType } from '#/theme/foundations/type';
import { hitSlop } from '#/theme/foundations/sizes';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';
import { useMoney } from '#domain/money';
import { useToday } from '#hooks/app/useToday';
import { fromDateKey, toDateKey } from '#/utils/dateUtils';
import { EARLIEST_RECEIPT_DAY } from '#features/receipts/utils/receiptDate';
import { formatQuantityDisplay } from '#/utils/formatQuantity';
import { ReceiptLineSheet } from '../components/ReceiptLineSheet';
import {
  useReceiptReview,
  type ReceiptReviewRow,
  type ReceiptRowStatus,
} from '../hooks/useReceiptReview';
import { receiptsTestIDs } from '../testIDs';

type ReviewSection = 'toAdd' | 'pending' | 'toCheck' | 'notAdded' | 'added';

// Lines that will be added first, then those waiting for a match, those with
// no product to add yet, those left out, and those already in.
const SECTION_ORDER: readonly ReviewSection[] = [
  'toAdd',
  'pending',
  'toCheck',
  'notAdded',
  'added',
];

interface StatusLook {
  section: ReviewSection;
  icon: string;
  tone: IconTone;
  badge?: { text: TranslationKey; variant: BadgeVariant };
}

const STATUS_LOOK: Record<ReceiptRowStatus, StatusLook> = {
  add: {
    section: 'toAdd',
    icon: 'checkmark-circle',
    tone: 'success',
    badge: { text: 'receipts.review.onList', variant: 'primary' },
  },
  failed: {
    section: 'toAdd',
    icon: 'alert-circle',
    tone: 'error',
    badge: { text: 'receipts.review.notAdded', variant: 'danger' },
  },
  pending: {
    section: 'pending',
    icon: 'hourglass-outline',
    tone: 'iconTertiary',
  },
  guess: {
    section: 'toAdd',
    icon: 'help-circle',
    tone: 'warning',
    badge: { text: 'labels.check', variant: 'warning' },
  },
  unmatched: {
    section: 'toCheck',
    icon: 'ellipse-outline',
    tone: 'iconTertiary',
  },
  skipped: {
    section: 'notAdded',
    icon: 'remove-circle-outline',
    tone: 'iconTertiary',
  },
  added: {
    section: 'added',
    icon: 'checkmark-done-circle',
    tone: 'success',
    badge: { text: 'labels.added', variant: 'success' },
  },
};

export const ReceiptReviewScreen: React.FC = () => {
  const { t } = useTranslation();
  const money = useMoney();
  const today = useToday();
  const { toPantryMain } = useAppNavigation();
  const {
    rows,
    merchant,
    store,
    proposedStoreName,
    storeLocation,
    storeOffer,
    storeUnrecognized,
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
    listLoading,
    listIncomplete,
    chooseLine,
    listItemNameFor,
    pickItem,
    addChosen,
    finish,
  } = useReceiptReview();

  // The draft is cleared once the screen has gone: cleared first, the review
  // shows its "no items" state while it slides away. Once, however often the
  // draft changes while it is open.
  const applied = useRef(false);
  const leave = useEffectEvent(() => {
    if (applied.current) finish();
  });
  useEffect(() => () => leave(), []);

  // What was read shows as text that opens its field; what wasn't is a field.
  const [changingStore, setChangingStore] = useState(false);
  // What the user types to search; a store is only what they pick.
  const [storeText, setStoreText] = useState<string | null>(null);
  const storeTitle = store?.name ?? proposedStoreName ?? merchant;
  const showStore = storeUnrecognized || changingStore;
  const toggleStore = () => setChangingStore(open => !open);
  const storeWhere = storeLocation
    ? storeBranchLabel(storeLocation, t)
    : undefined;

  // Kept after closing, so the sheet animates out full.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [opening, setOpening] = useState(0);
  const editing = rows.find(row => row.index === editingIndex);
  const openLine = (id: string) => {
    const row = rows.find(candidate => String(candidate.index) === id);
    if (!row || row.status === 'added') return;
    setEditingIndex(row.index);
    setOpening(count => count + 1);
    setSheetVisible(true);
  };
  const closeSheet = () => {
    setSheetVisible(false);
    pickItem(null);
  };

  const subtitleOf = (row: ReceiptReviewRow) => {
    const { choice } = row;
    switch (row.status) {
      case 'failed':
        return row.failure ?? t('receipts.review.notAdded');
      case 'pending':
        return matchState === 'failed'
          ? t('receipts.review.notMatchedYet')
          : t('receipts.review.findingMatch');
      case 'unmatched':
        return t('receipts.review.choose');
      case 'skipped':
        return t('receipts.review.leftOut');
      case 'add':
      case 'guess':
      case 'added': {
        if (!choice) return row.printed;
        return t(
          choice.notStocked
            ? 'receipts.review.chosenDetailNotStocked'
            : 'receipts.review.chosenDetail',
          {
            printed: row.printed,
            amount: formatQuantityDisplay(choice.quantity, choice.unitText),
          },
        );
      }
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
      case 'toCheck':
        return t('receipts.review.sectionToCheck', { count });
      case 'notAdded':
        return t('receipts.review.sectionNotAdded', { count });
      case 'added':
        return t('receipts.review.sectionAdded', { count });
    }
  };

  const items = SECTION_ORDER.flatMap(section => {
    const inSection = rows.filter(
      row => STATUS_LOOK[row.status].section === section,
    );
    return inSection.map((row, at) => {
      const price = row.choice ? row.choice.price : row.price;
      const { icon, tone, badge } = STATUS_LOOK[row.status];
      const title = row.choice?.itemName ?? row.printed;
      const subtitle = subtitleOf(row);
      // A line to add is badged only when it ticks a list line off.
      const badgeText =
        badge && (row.status !== 'add' || row.onList) ? t(badge.text) : null;
      const priceText =
        price === undefined || price === null
          ? null
          : price === 0 && row.discount
          ? t('receipts.review.free')
          : money(price);
      const discountText = row.discount
        ? t('receipts.review.discountOff', { amount: money(row.discount) })
        : null;
      return {
        id: String(row.index),
        title,
        subtitle,
        badge:
          badge && badgeText
            ? { text: badgeText, variant: badge.variant }
            : undefined,
        accessibilityLabel: accessibilityLabelOf(
          title,
          subtitle,
          badgeText,
          priceText,
          priceText && discountText,
        ),
        leftElement: <Icon name={icon} size="md" tone={tone} />,
        rightElement:
          priceText === null ? undefined : (
            <View style={styles.price}>
              <Text
                role={rowType.title}
                tone={section === 'toAdd' ? 'primary' : 'secondary'}
              >
                {priceText}
              </Text>
              {!!discountText && (
                <Text role="caption" tone="success">
                  {discountText}
                </Text>
              )}
            </View>
          ),
        ...(at === 0
          ? { sectionTitle: sectionTitle(section, inSection.length) }
          : {}),
      };
    });
  });

  // The check-in runs on without the review: its lines are in the pantry now.
  const handleAdd = async () => {
    const { sent, held } = await addChosen();
    if (sent > 0) {
      toastService.success(
        pantryName
          ? t('receipts.review.addedTo', { count: sent, pantry: pantryName })
          : t('receipts.review.addedCount', { count: sent }),
      );
    }
    // A line that still lacks something keeps the review, saying which; so do
    // lines still waiting for a match, to add once matched.
    if (held > 0 || rows.some(row => row.status === 'pending')) return;
    applied.current = true;
    toPantryMain();
  };

  // A day read from the receipt shows as text that opens the calendar.
  const dateField = (
    <DatePickerField
      presentation={dayIsScanDay ? 'field' : 'row'}
      label={t('receipts.review.dateLabel')}
      value={fromDateKey(purchasedOn)}
      onChange={date => {
        if (date) setPurchasedOn(toDateKey(date));
      }}
      minimumDate={fromDateKey(EARLIEST_RECEIPT_DAY)}
      maximumDate={fromDateKey(today)}
      testID={receiptsTestIDs.reviewDate}
    />
  );

  const footer =
    rows.length > 0 ? (
      <Button
        onPress={() => {
          void handleAdd();
        }}
        disabled={pendingCount === 0}
        loading={applying || listLoading}
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
      title={storeTitle ?? t('receipts.review.title')}
      {...(storeTitle && !storeUnrecognized
        ? { switchable: { onPress: toggleStore, open: changingStore } }
        : {})}
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
              {storeWhere ? (
                <AppPressable
                  onPress={toggleStore}
                  disabled={storeUnrecognized}
                  accessibilityRole="button"
                  accessibilityLabel={storeWhere}
                  accessibilityHint={t('receipts.review.storeWhereHint')}
                  hitSlop={hitSlop.lg}
                  style={styles.storeWhere}
                  testID={receiptsTestIDs.reviewStoreWhere}
                >
                  <Icon
                    name="location-outline"
                    size="xs"
                    tone="textSecondary"
                  />
                  <Text
                    role="caption"
                    tone="secondary"
                    style={styles.storeWhereText}
                  >
                    {storeWhere}
                  </Text>
                </AppPressable>
              ) : null}
              <View>
                <Reveal open={showStore}>
                  <View style={styles.revealedStore}>
                    <StoreAutocompleteField
                      variant="modal"
                      label={t('labels.store')}
                      value={storeText ?? store?.name ?? ''}
                      onChangeText={setStoreText}
                      // Kept by id, from the pick: typed text alone is no store.
                      onStoreSelected={(id, name) => {
                        if (id && name) chooseStore({ id, name });
                      }}
                      placeholder={t('receipts.review.storePlaceholder')}
                      helperText={t('labels.storeSelectHint')}
                      testID={receiptsTestIDs.reviewStore}
                    />
                  </View>
                </Reveal>
                {storeOffer ? (
                  <ItemCard
                    id={storeOffer.id}
                    title={storeOffer.name}
                    subtitle={t('receipts.review.addsAddress')}
                    leftElement={
                      <Icon
                        name="storefront-outline"
                        size="md"
                        tone="primary"
                      />
                    }
                    onPress={() => chooseStore(storeOffer)}
                    testID={receiptsTestIDs.reviewStoreOffer}
                  />
                ) : null}
                {dayIsScanDay ? (
                  <View>
                    {dateField}
                    <Text role="caption" tone="tertiary">
                      {t('receipts.review.dateScanned')}
                    </Text>
                  </View>
                ) : (
                  dateField
                )}
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
              {listIncomplete ? (
                <AlertBanner
                  variant="info"
                  icon="list-outline"
                  iconLibrary="Ionicons"
                  title={t('receipts.review.listIncompleteTitle')}
                  subtitle={t('receipts.review.listIncompleteBody')}
                  testID={receiptsTestIDs.reviewListIncomplete}
                />
              ) : null}
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
        line={editing ?? null}
        choice={editing?.choice}
        candidates={editing?.candidates ?? []}
        listItemNameFor={key =>
          editing ? listItemNameFor(editing.index, key) : undefined
        }
        onPickItem={pickItem}
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
  // In the revealed content, so the gap opens and closes with the field.
  revealedStore: {
    paddingBottom: theme.spacing.md,
  },
  intro: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  storeWhere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  storeWhereText: {
    flexShrink: 1,
  },
  // A price over the discount that made it.
  price: {
    alignItems: 'flex-end',
  },
}));
