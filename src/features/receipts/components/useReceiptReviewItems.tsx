import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#i18n';
import type { BadgeVariant } from '#components/atoms/Badge';
import { Icon, type IconName, type IconTone } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { rowType } from '#theme/foundations/type';
import { accessibilityLabelOf } from '#utils/accessibilityLabel';
import { useReceiptMoney } from '../hooks/useReceiptCurrency';
import type {
  ReceiptReviewRow,
  ReceiptRowStatus,
} from '../hooks/useReceiptReview';
import {
  REVIEW_SECTION_ORDER,
  reviewRowSubtitle,
  reviewSectionOf,
  reviewSectionTitle,
} from '../utils/reviewRows';

interface StatusLook {
  icon: IconName;
  tone: IconTone;
  badge?: { text: TranslationKey; variant: BadgeVariant };
}

const STATUS_LOOK: Readonly<Record<ReceiptRowStatus, StatusLook>> = {
  add: {
    icon: 'checkmark-circle',
    tone: 'success',
    badge: { text: 'labels.onYourList', variant: 'primary' },
  },
  failed: {
    icon: 'alert-circle',
    tone: 'error',
    badge: { text: 'receipts.review.notAdded', variant: 'danger' },
  },
  pending: { icon: 'hourglass-outline', tone: 'iconTertiary' },
  unmatched: { icon: 'ellipse-outline', tone: 'iconTertiary' },
  skipped: { icon: 'remove-circle-outline', tone: 'iconTertiary' },
  added: {
    icon: 'checkmark-done-circle',
    tone: 'success',
    badge: { text: 'labels.added', variant: 'success' },
  },
  queued: {
    icon: 'cloud-upload-outline',
    tone: 'iconTertiary',
    badge: { text: 'receipts.review.waitingBadge', variant: 'neutral' },
  },
};

/** The review's lines as list rows, each section titled at its first row. */
export function useReceiptReviewItems(
  rows: ReceiptReviewRow[],
  matchFailed: boolean,
) {
  const { t } = useTranslation();
  const money = useReceiptMoney();

  return REVIEW_SECTION_ORDER.flatMap(section => {
    const inSection = rows.filter(row => reviewSectionOf(row) === section);
    return inSection.map((row, at) => {
      const price = row.choice ? row.choice.price : row.price;
      const { icon, tone, badge } = STATUS_LOOK[row.status];
      const title = row.choice?.itemName ?? row.printed;
      const subtitle = reviewRowSubtitle(row, matchFailed, t);
      // A line to add is badged only when it ticks a list line off.
      const badgeLabel =
        section === 'recorded' && row.status !== 'queued'
          ? 'receipts.review.recordedBadge'
          : badge?.text;
      const badgeText =
        badgeLabel && (row.status !== 'add' || row.onList)
          ? t(badgeLabel)
          : null;
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
          ? {
              sectionTitle: reviewSectionTitle(
                section,
                inSection.length,
                matchFailed,
                t,
              ),
            }
          : {}),
      };
    });
  });
}

const styles = StyleSheet.create({
  // A price over the discount that made it.
  price: {
    alignItems: 'flex-end',
  },
});
