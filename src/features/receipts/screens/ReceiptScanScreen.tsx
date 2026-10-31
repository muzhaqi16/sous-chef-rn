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
import { useReceiptFlowExits } from './receiptFlowExits';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { alertService } from '#/services/alertService';
import { useTranslation, type TranslationKey } from '#/i18n';
import { useReceiptScan } from './useReceiptScan';
import {
  useServerReceiptParse,
  type ServerReadingStatus,
} from '../hooks/useServerReceiptParse';
import { formatDateTime } from '#/utils/formatters/date';
import { receiptReviewLines } from '../utils/receiptReviewLines';
import type { ReceiptDraft } from '../store/receiptDraftStore';
import { receiptsTestIDs } from '../testIDs';
import { cappedNames } from '#/utils/cappedNames';

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

// What left the phone: nothing for a receipt the phone read; else its photos,
// masked or as they were; else its text, sent only where the server reads
// receipts.
function savedBodyOf(
  { parsedBy, photoKeys, photosMasked }: ReceiptDraft,
  serverParsing: boolean,
): TranslationKey {
  if (parsedBy === 'device') return 'receipts.saved.bodyDevice';
  if (photoKeys) {
    return photosMasked
      ? 'receipts.saved.bodyPhotoMasked'
      : 'receipts.saved.bodyPhoto';
  }
  return serverParsing ? 'receipts.saved.bodyText' : 'receipts.saved.body';
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
  const navigation = useAppNavigation();
  const exits = useReceiptFlowExits();
  const goBack = exits?.close ?? navigation.goBack;
  const toReceiptReview = exits?.toReview ?? navigation.toReceiptReview;
  const serverParsing = useFeatureFlag('receiptParsing');
  const deviceReading = useFeatureFlag('deviceReceiptReading');
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
  } = useReceiptScan({
    onCancel: goBack,
    serverParsing,
    deviceReading,
  });
  // Only once the phone has had its go at the receipt.
  const { readingStatus, retryAt, slowPhotoRead } = useServerReceiptParse({
    enabled: serverParsing && status === 'saved',
  });

  const header: ScreenHeaderConfig = {
    title: t('labels.scanReceipt'),
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
          afterClose: true,
        },
      ],
    );
  };

  if (status === 'saved' && draft) {
    const lines = draft.parsed ? receiptReviewLines(draft.parsed) : [];
    // What is left to review, once some of it went in.
    const added = new Set(draft.added);
    const left = lines.filter(line => !added.has(line.index)).length;
    const itemCount = left > 0 ? left : lines.length;
    // Named as the user chose them, else as printed.
    const failedNames = lines.flatMap(line =>
      draft.failed?.[line.index] !== undefined
        ? [draft.choices?.[line.index]?.itemName ?? line.printed]
        : [],
    );
    // Photos the server failed to read give way to the receipt's text, so a
    // photo banner shows only for a receipt with none.
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
            {t(savedBodyOf(draft, serverParsing))}
          </Text>
          {pickedFromLibrary ? (
            <Text role="body" tone="secondary">
              {t('receipts.saved.libraryPhoto')}
            </Text>
          ) : null}
          {readingStatus === 'reading' && (
            <Loading
              size="small"
              message={
                slowPhotoRead
                  ? t('receipts.saved.readingPhotosSlow')
                  : t('receipts.saved.reading')
              }
              testID={receiptsTestIDs.savedReading}
            />
          )}
          {banner ? readingBanner(banner) : null}
          {failedNames.length > 0 ? (
            <AlertBanner
              variant="warning"
              icon="alert-circle-outline"
              iconLibrary="Ionicons"
              title={t('receipts.saved.failedTitle', {
                count: failedNames.length,
              })}
              subtitle={t('receipts.saved.failedBody', {
                names: cappedNames(failedNames).shown,
              })}
              testID={receiptsTestIDs.savedFailed}
            />
          ) : null}
          {draft.checkIn?.state === 'queued' ? (
            <AlertBanner
              variant="info"
              icon="cloud-upload-outline"
              iconLibrary="Ionicons"
              title={t('receipts.saved.queuedTitle')}
              subtitle={t('receipts.saved.queuedBody')}
              testID={receiptsTestIDs.savedQueued}
            />
          ) : null}
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
              disabled: !canSendPhotos,
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
              label: t('labels.scanReceipt'),
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
