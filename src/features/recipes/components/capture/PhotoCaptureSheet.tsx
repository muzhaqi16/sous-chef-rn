import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { errorCopy } from '#/services/errorService';
import { CachedImage } from '#components/atoms/CachedImage';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { Icon } from '#components/atoms/Icon';
import { hitSlop } from '#/theme/foundations/sizes';
import { useCapturePhotos } from '#features/recipes/hooks/useCapturePhotos';
import type {
  CaptureRequest,
  CaptureStart,
} from '#features/recipes/hooks/useRecipeCapture';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { CaptureFormFrame, CaptureSheetShell } from './CaptureSheetShell';

const THUMBNAIL_SIZE = 88;

interface PhotoFormProps {
  visible: boolean;
  onSend: (request: CaptureRequest) => Promise<CaptureStart>;
  sending: boolean;
  onClose: () => void;
}

const PhotoForm: React.FC<PhotoFormProps> = ({
  visible,
  onSend,
  sending,
  onClose,
}) => {
  const { t } = useTranslation();
  const photos = useCapturePhotos();
  const [failure, setFailure] = useState<string | null>(null);

  // A dismissed sheet takes its pages off the phone.
  const discardRef = useRef(photos.discard);
  useEffect(() => {
    discardRef.current = photos.discard;
  });
  useEffect(() => {
    if (!visible) discardRef.current();
  }, [visible]);

  const busy = photos.uploading || sending;
  const canAdd = photos.canAddPage && !busy;

  const send = async () => {
    setFailure(null);
    const keys = await photos.upload();
    if (!keys) {
      setFailure(t('recipes.capturePhotoUploadFailed'));
      return;
    }
    const outcome = await onSend({ source: 'photo', photoKeys: keys });
    switch (outcome.kind) {
      case 'started':
        onClose();
        return;
      case 'limited':
        setFailure(t('recipes.captureLimited'));
        return;
      case 'refused':
        setFailure(
          outcome.field === 'photos'
            ? t('recipes.capturePhotosRefused')
            : errorCopy(
                outcome.error,
                t,
                t('recipes.captureFailedUnavailable'),
              ),
        );
    }
  };

  return (
    <CaptureFormFrame
      title={t('recipes.capturePhotoTitle')}
      onClose={onClose}
      failure={failure}
      sending={busy}
      canSend={photos.pages.length > 0}
      onSend={() => {
        void send();
      }}
    >
      <Text role="body" tone="secondary" style={styles.hint}>
        {t('recipes.capturePhotoHint')}
      </Text>
      {photos.pages.length > 0 ? (
        <View style={styles.pages}>
          {photos.pages.map((uri, index) => (
            <View key={uri} style={styles.page}>
              <CachedImage
                uri={uri}
                style={styles.thumbnail}
                displaySize={THUMBNAIL_SIZE}
              />
              <Pressable
                style={styles.remove}
                onPress={() => photos.remove(uri)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.removeNamed', {
                  name: String(index + 1),
                })}
                hitSlop={hitSlop.md}
              >
                <Icon name="close-circle" size={22} tone="textInverse" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        {photos.scannerUnavailable ? null : (
          <Button
            variant="outline"
            size="small"
            icon="scan-outline"
            onPress={() => {
              void photos.scan();
            }}
            disabled={!canAdd}
            testID={recipesTestIDs.captureScan}
          >
            {photos.pages.length > 0
              ? t('recipes.captureAddPage')
              : t('recipes.captureScanPages')}
          </Button>
        )}
        <Button
          variant="outline"
          size="small"
          icon="images-outline"
          onPress={() => {
            void photos.choose();
          }}
          disabled={!canAdd}
          testID={recipesTestIDs.captureChoosePhotos}
        >
          {t('recipes.captureChoosePhotos')}
        </Button>
      </View>
    </CaptureFormFrame>
  );
};

interface PhotoCaptureSheetProps {
  visible: boolean;
  /** Starts the capture; from the screen, as the sheet renders outside the navigator. */
  onSend: (request: CaptureRequest) => Promise<CaptureStart>;
  sending: boolean;
  onDismiss: () => void;
}

/** A recipe from photos of one to three of its pages. */
export const PhotoCaptureSheet: React.FC<PhotoCaptureSheetProps> = ({
  visible,
  onSend,
  sending,
  onDismiss,
}) => (
  <CaptureSheetShell visible={visible} snapPoint="70%" onDismiss={onDismiss}>
    {() => (
      <PhotoForm
        visible={visible}
        onSend={onSend}
        sending={sending}
        onClose={onDismiss}
      />
    )}
  </CaptureSheetShell>
);

const styles = StyleSheet.create(theme => ({
  hint: {
    marginBottom: theme.spacing.md,
  },
  pages: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  page: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: theme.radii.md,
  },
  remove: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
}));
