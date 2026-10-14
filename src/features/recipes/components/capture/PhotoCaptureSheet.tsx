import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Sheet } from '#components/templates/Sheet';
import { SheetHeader } from '#components/templates/SheetHeader';
import { CachedImage } from '#components/atoms/CachedImage';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { Icon } from '#utils/iconUtils';
import { hitSlop } from '#/theme/foundations/sizes';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useCapturePhotos } from '#features/recipes/hooks/useCapturePhotos';
import { useRecipeCapture } from '#features/recipes/hooks/useRecipeCapture';
import { recipesTestIDs } from '#features/recipes/testIDs';

const THUMBNAIL_SIZE = 88;

const PhotoForm: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation();
  const photos = useCapturePhotos();
  const { start, sending } = useRecipeCapture();
  const unavailable = useIsApiUnavailable();
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
    const outcome = await start({ source: 'photo', photoKeys: keys });
    switch (outcome.kind) {
      case 'started':
        onClose();
        return;
      case 'limited':
        setFailure(t('recipes.captureLimited'));
        return;
      case 'upgrade':
        setFailure(t('errors.codes.clientUpgradeRequired'));
        return;
      case 'disabled':
        setFailure(t('errors.codes.featureDisabled'));
        return;
      case 'premium':
        setFailure(t('errors.codes.premiumRequired'));
        return;
      case 'refused':
        setFailure(
          t(
            outcome.field === 'photos'
              ? 'recipes.capturePhotosRefused'
              : 'recipes.captureFailedUnavailable',
          ),
        );
    }
  };

  return (
    <>
      <SheetHeader
        contentPadding="md"
        title={t('recipes.capturePhotoTitle')}
        onClose={onClose}
      />
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
      {unavailable ? (
        <Text role="caption" tone="warning" style={styles.note}>
          {t('recipes.captureNeedsConnection')}
        </Text>
      ) : null}
      {failure ? (
        <AlertBanner
          title={failure}
          icon="alert-circle-outline"
          iconLibrary="Ionicons"
        />
      ) : null}
      <Button
        onPress={() => {
          void send();
        }}
        loading={busy}
        disabled={unavailable || photos.pages.length === 0}
        testID={recipesTestIDs.captureSend}
      >
        {t('recipes.captureImport')}
      </Button>
    </>
  );
};

interface PhotoCaptureSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

/** A recipe from photos of one to three of its pages. */
export const PhotoCaptureSheet: React.FC<PhotoCaptureSheetProps> = ({
  visible,
  onDismiss,
}) => {
  // A fresh set of pages per opening, kept while the sheet animates out.
  const [opening, setOpening] = useState(0);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setOpening(opening + 1);
  }

  return (
    <Sheet
      mode="form"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={['70%']}
      contentContainerStyle={styles.content}
    >
      {opening > 0 ? (
        <PhotoForm key={opening} visible={visible} onClose={onDismiss} />
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
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
  note: {
    marginBottom: theme.spacing.md,
  },
}));
