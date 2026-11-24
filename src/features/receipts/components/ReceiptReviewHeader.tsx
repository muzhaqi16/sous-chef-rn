import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { Link } from '#components/atoms/Link';
import { Reveal } from '#components/atoms/Reveal';
import { Text } from '#components/atoms/Text';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { ItemCard } from '#components/organisms/ItemCard';
import { DataStateView } from '#components/organisms/DataStateView';
import { OPENSTREETMAP_COPYRIGHT } from '#domain/openStreetMap';
import { storeBranchLabel } from '#domain/stores';
import { StoreAutocompleteField } from '#features/catalog/ui/autocomplete/StoreAutocompleteField';
import { useToday } from '#hooks/app/useToday';
import { hitSlop } from '#/theme/foundations/sizes';
import { fromDateKey, toDateKey } from '#/utils/dateUtils';
import { useReceiptMoney } from '../hooks/useReceiptCurrency';
import type { ReceiptReview } from '../hooks/useReceiptReview';
import { receiptsTestIDs } from '../testIDs';
import { EARLIEST_RECEIPT_DAY } from '../utils/receiptDate';

interface ReceiptReviewHeaderProps {
  review: ReceiptReview;
  /** The store field, shown when nothing was recognised or the title opened it. */
  storeOpen: boolean;
  onToggleStore: () => void;
  /** What the user types to search; a store is only what they pick. */
  storeText: string | null;
  onStoreTextChange: (text: string) => void;
}

/** Where and when the receipt was, and what stands in the way of adding it. */
export const ReceiptReviewHeader: React.FC<ReceiptReviewHeaderProps> = ({
  review,
  storeOpen,
  onToggleStore,
  storeText,
  onStoreTextChange,
}) => {
  const { t } = useTranslation();
  const money = useReceiptMoney();
  const today = useToday();
  const {
    store,
    storeLocation,
    storeOffer,
    storeChoices,
    chooseStore,
    chooseStoreChoice,
    storeUnrecognized,
    purchasedOn,
    dayIsScanDay,
    setPurchasedOn,
    matchState,
    retryMatching,
    pantryName,
    listIncomplete,
    listState,
    retryList,
    totalsGap,
  } = review;
  const storeWhere = storeLocation
    ? storeBranchLabel(storeLocation, t)
    : undefined;

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
  const storeIcon = <Icon name="storefront-outline" size="md" tone="primary" />;

  return (
    <View style={styles.intro}>
      {storeWhere ? (
        <AppPressable
          onPress={onToggleStore}
          disabled={storeUnrecognized}
          accessibilityRole="button"
          accessibilityLabel={storeWhere}
          accessibilityHint={t('receipts.review.storeWhereHint')}
          hitSlop={hitSlop.lg}
          style={styles.storeWhere}
          testID={receiptsTestIDs.reviewStoreWhere}
        >
          <Icon name="location-outline" size="xs" tone="textSecondary" />
          <Text role="caption" tone="secondary" style={styles.storeWhereText}>
            {storeWhere}
          </Text>
        </AppPressable>
      ) : null}
      <View>
        <Reveal open={storeOpen}>
          <View style={styles.revealedStore}>
            <StoreAutocompleteField
              variant="modal"
              label={t('labels.store')}
              value={storeText ?? store?.name ?? ''}
              onChangeText={onStoreTextChange}
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
            leftElement={storeIcon}
            onPress={() => chooseStore(storeOffer)}
            testID={receiptsTestIDs.reviewStoreOffer}
          />
        ) : null}
        {storeChoices.length > 0 ? (
          <View style={styles.storeChoices}>
            <Text role="bodyStrong">
              {t('receipts.review.storeChoicesTitle')}
            </Text>
            {storeChoices.map(choice => (
              <ItemCard
                key={choice.placeId}
                id={choice.placeId}
                title={choice.name}
                subtitle={choice.address}
                leftElement={storeIcon}
                onPress={() => {
                  void chooseStoreChoice(choice);
                }}
                testID={receiptsTestIDs.reviewStoreChoice(choice.placeId)}
              />
            ))}
            {[...new Set(storeChoices.map(choice => choice.credit))].map(
              credit => (
                <Link
                  key={credit}
                  variant="caption"
                  href={OPENSTREETMAP_COPYRIGHT}
                >
                  {credit}
                </Link>
              ),
            )}
          </View>
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
      {listState === 'error' || listState === 'offline' ? (
        <DataStateView state={listState} onRetry={retryList} />
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
  storeChoices: {
    gap: theme.spacing.sm,
  },
}));
