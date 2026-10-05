import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen, type ScreenHeaderConfig } from '#components/templates/Screen';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { EmptyState } from '#components/molecules/EmptyState';
import { ErrorState } from '#components/molecules/ErrorState';
import { Loading } from '#components/molecules/Loading';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { alertService } from '#/services/alertService';
import { useTranslation, type TranslationKey } from '#/i18n';
import { useReceiptScan } from '../hooks/useReceiptScan';
import {
  useServerReceiptParse,
  type ServerReadingStatus,
} from '../hooks/useServerReceiptParse';
import { formatDateTime } from '#/utils/formatters/date';
import { receiptReviewLines } from '../utils/receiptReviewLines';
import { receiptsTestIDs } from '../testIDs';

interface BannerCopy {
  title: TranslationKey;
  body?: TranslationKey;
}

interface ReadingBanner extends BannerCopy {
  variant: 'info' | 'warning';
  icon: string;
  /** Its copy when the receipt went to the server as photos. */
  photos?: BannerCopy;
}

// What the saved screen says of the server's reading, past `reading`'s spinner.
const READING_BANNER: Record<ServerReadingStatus, ReadingBanner | null> = {
  none: null,
  reading: null,
  offline: {
    variant: 'info',
    icon: 'cloud-offline-outline',
    title: 'receipts.saved.offline',
  },
  retryLater: {
    variant: 'info',
    icon: 'time-outline',
    title: 'receipts.saved.retryLaterTitle',
    body: 'receipts.saved.retryLaterBody',
  },
  unreadable: {
    variant: 'warning',
    icon: 'alert-circle-outline',
    title: 'receipts.unreadable.title',
    body: 'receipts.unreadable.body',
  },
  limited: {
    variant: 'info',
    icon: 'time-outline',
    title: 'receipts.saved.limitedTitle',
    body: 'receipts.saved.limitedBody',
    photos: {
      title: 'receipts.saved.photoLimitedTitle',
      body: 'receipts.saved.photoLimitedBody',
    },
  },
  unavailable: {
    variant: 'info',
    icon: 'information-circle-outline',
    title: 'receipts.saved.notReadTitle',
    body: 'receipts.saved.notReadBody',
    photos: {
      title: 'receipts.saved.photoNotReadTitle',
      body: 'receipts.saved.photoNotReadBody',
    },
  },
  tooLong: {
    variant: 'info',
    icon: 'information-circle-outline',
    title: 'receipts.saved.tooLongTitle',
    body: 'receipts.saved.tooLongBody',
  },
};

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
    const readingBanner = (banner: ReadingBanner) => {
      const { title, body } =
        sentPhotos && banner.photos ? banner.photos : banner;
      return (
        <AlertBanner
          variant={banner.variant}
          icon={banner.icon}
          iconLibrary="Ionicons"
          title={t(title)}
          subtitle={
            body
              ? t(body, { time: retryAt && formatDateTime(retryAt) })
              : undefined
          }
        />
      );
    };
    const banner = READING_BANNER[readingStatus];
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
          {banner ? readingBanner(banner) : null}
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
