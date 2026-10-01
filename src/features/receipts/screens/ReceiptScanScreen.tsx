import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Screen, type ScreenHeaderConfig } from '#components/templates/Screen';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { EmptyState } from '#components/molecules/EmptyState';
import { ErrorState } from '#components/molecules/ErrorState';
import { Loading } from '#components/molecules/Loading';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { alertService } from '#/services/alertService';
import { useReceiptScan } from '../hooks/useReceiptScan';
import { receiptReviewLines } from '../utils/receiptReviewLines';
import { receiptsTestIDs } from '../testIDs';

export const ReceiptScanScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack, toReceiptReview } = useAppNavigation();
  const { status, draft, scan, takePhoto, pickPhoto, discard } = useReceiptScan(
    {
      onCancel: goBack,
    },
  );

  const header: ScreenHeaderConfig = {
    title: t('receipts.title'),
    close: goBack,
  };
  const startScan = () => {
    void scan();
  };
  const startPhoto = () => {
    void takePhoto();
  };
  const startPick = () => {
    void pickPhoto();
  };

  const scanReplacing = () => {
    alertService.alert(
      t('receipts.replace.title'),
      t('receipts.replace.body'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('receipts.replace.confirm'),
          onPress: startScan,
        },
      ],
    );
  };

  if (status === 'saved' && draft) {
    const itemCount = draft.parsed
      ? receiptReviewLines(draft.parsed).length
      : 0;
    return (
      <Screen header={header} testID={receiptsTestIDs.scanScreen}>
        <View style={styles.saved}>
          <Text role="title">{t('receipts.saved.title')}</Text>
          <Text role="body" tone="secondary">
            {t('receipts.saved.body')}
          </Text>
          <View style={styles.actions}>
            {itemCount > 0 && (
              <Button
                onPress={toReceiptReview}
                icon="list-outline"
                testID={receiptsTestIDs.savedReview}
              >
                {t('receipts.saved.review', { count: itemCount })}
              </Button>
            )}
            <Button
              variant={itemCount > 0 ? 'secondary' : 'primary'}
              onPress={scanReplacing}
              icon="receipt-outline"
            >
              {t('receipts.saved.scanAnother')}
            </Button>
            <Button variant="ghost" onPress={discard}>
              {t('labels.discard')}
            </Button>
          </View>
          <Text
            role="footnote"
            tone="secondary"
            testID={receiptsTestIDs.savedText}
          >
            {draft.pages.join('\n\n')}
          </Text>
        </View>
      </Screen>
    );
  }

  const renderState = () => {
    switch (status) {
      case 'reading':
        return <Loading message={t('receipts.reading')} />;
      case 'scannerUnavailable':
        return (
          <EmptyState
            icon="camera-outline"
            title={t('receipts.photo.title')}
            description={t('receipts.photo.body')}
            action={{
              label: t('labels.takePhoto'),
              onPress: startPhoto,
              icon: 'camera-outline',
            }}
            secondaryAction={{
              label: t('a11y.choosePhoto'),
              onPress: startPick,
              icon: 'images-outline',
            }}
          />
        );
      case 'unreadable':
        return (
          <ErrorState
            icon="receipt-outline"
            severity="warning"
            title={t('receipts.unreadable.title')}
            message={t('receipts.unreadable.body')}
            onRetry={startScan}
            retryLabel={t('labels.retake')}
            alignment="center"
          />
        );
      case 'failed':
        return (
          <ErrorState
            icon="alert-circle-outline"
            title={t('receipts.failed.title')}
            message={t('receipts.failed.body')}
            onRetry={startScan}
            retryLabel={t('labels.tryAgain')}
            alignment="center"
          />
        );
      case 'idle':
      case 'saved':
        return (
          <EmptyState
            icon="receipt-outline"
            title={t('receipts.intro.title')}
            description={t('receipts.intro.body')}
            action={{
              label: t('receipts.title'),
              onPress: startScan,
              icon: 'scan-outline',
            }}
          />
        );
    }
  };

  return (
    <Screen header={header} scroll="none" testID={receiptsTestIDs.scanScreen}>
      {renderState()}
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  saved: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  actions: {
    gap: theme.spacing.sm,
  },
}));
