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
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { alertService } from '#/services/alertService';
import { useReceiptScan } from '../hooks/useReceiptScan';
import { useServerReceiptParse } from '../hooks/useServerReceiptParse';
import { formatDateTime } from '#/utils/formatters/date';
import { receiptReviewLines } from '../utils/receiptReviewLines';
import { receiptsTestIDs } from '../testIDs';

export const ReceiptScanScreen: React.FC = () => {
  const { t } = useTranslation();
  const { goBack, toReceiptReview } = useAppNavigation();
  const {
    status,
    draft,
    pickedFromLibrary,
    canSendPhotos,
    scan,
    takePhoto,
    pickPhoto,
    sendPhotos,
    declinePhotos,
    discard,
  } = useReceiptScan({ onCancel: goBack });
  // Only once the phone has had its go at the receipt.
  const { readingStatus, retryAt } = useServerReceiptParse({
    enabled: status === 'saved',
  });

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
  const startSend = () => {
    void sendPhotos();
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
    // A receipt sent as photos keeps no text until the server reads it.
    const sentPhotos = !!draft.photoKeys;
    return (
      <Screen header={header} testID={receiptsTestIDs.scanScreen}>
        <View style={styles.saved}>
          <Text role="title">{t('receipts.saved.title')}</Text>
          <Text role="body" tone="secondary">
            {sentPhotos
              ? t('receipts.saved.bodyPhoto')
              : t('receipts.saved.body')}
          </Text>
          {pickedFromLibrary ? (
            <Text role="body" tone="secondary">
              {t('receipts.saved.libraryPhoto')}
            </Text>
          ) : null}
          {readingStatus === 'reading' && (
            <Loading
              size="small"
              message={t('receipts.saved.reading')}
              testID={receiptsTestIDs.savedReading}
            />
          )}
          {readingStatus === 'offline' && (
            <AlertBanner
              variant="info"
              icon="cloud-offline-outline"
              iconLibrary="Ionicons"
              title={t('receipts.saved.offline')}
            />
          )}
          {readingStatus === 'retryLater' && (
            <AlertBanner
              variant="info"
              icon="time-outline"
              iconLibrary="Ionicons"
              title={t('receipts.saved.retryLaterTitle')}
              subtitle={t('receipts.saved.retryLaterBody')}
            />
          )}
          {readingStatus === 'unreadable' && (
            <AlertBanner
              variant="warning"
              icon="alert-circle-outline"
              iconLibrary="Ionicons"
              title={t('receipts.unreadable.title')}
              subtitle={t('receipts.unreadable.body')}
            />
          )}
          {readingStatus === 'limited' && retryAt !== undefined && (
            <AlertBanner
              variant="info"
              icon="time-outline"
              iconLibrary="Ionicons"
              title={
                sentPhotos
                  ? t('receipts.saved.photoLimitedTitle')
                  : t('receipts.saved.limitedTitle')
              }
              subtitle={
                sentPhotos
                  ? t('receipts.saved.photoLimitedBody', {
                      time: formatDateTime(retryAt),
                    })
                  : t('receipts.saved.limitedBody', {
                      time: formatDateTime(retryAt),
                    })
              }
            />
          )}
          {readingStatus === 'unavailable' && (
            <AlertBanner
              variant="info"
              icon="information-circle-outline"
              iconLibrary="Ionicons"
              title={
                sentPhotos
                  ? t('receipts.saved.photoNotReadTitle')
                  : t('receipts.saved.notReadTitle')
              }
              subtitle={
                sentPhotos
                  ? t('receipts.saved.photoNotReadBody')
                  : t('receipts.saved.notReadBody')
              }
            />
          )}
          {readingStatus === 'tooLong' && (
            <AlertBanner
              variant="info"
              icon="information-circle-outline"
              iconLibrary="Ionicons"
              title={t('receipts.saved.tooLongTitle')}
              subtitle={t('receipts.saved.tooLongBody')}
            />
          )}
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
      case 'readFailed':
        return (
          <EmptyState
            icon="cloud-upload-outline"
            title={t('receipts.photoSend.title')}
            description={t('receipts.photoSend.body')}
            {...(canSendPhotos
              ? {}
              : { hint: t('receipts.photoSend.offline') })}
            action={{
              label: t('receipts.photoSend.send'),
              onPress: startSend,
              icon: 'cloud-upload-outline',
            }}
            secondaryAction={{
              label: t('receipts.photoSend.dontSend'),
              onPress: declinePhotos,
            }}
            testID={receiptsTestIDs.photoSend}
          />
        );
      case 'sending':
        return <Loading message={t('receipts.photoSend.sending')} />;
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
