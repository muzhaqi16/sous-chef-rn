import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { Loading } from '#components/molecules/Loading';
import { Sheet } from '#components/templates/Sheet';
import { usePhotoCapture } from '#hooks/device/usePhotoCapture';
import type { useEntryPhoto } from '#features/catalog/hooks/useEntryPhoto';
import { catalogTestIDs } from '#features/catalog/testIDs';
import type { ImageFile } from '#/types/media';

interface EntryPhotoSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** The host's `useEntryPhoto`, which its photo viewer shares. */
  entryPhoto: ReturnType<typeof useEntryPhoto>;
  /** The entries show the household's choice, so the catalog's is offered back. */
  hasHouseholdPhoto: boolean;
  /** Opens the item's photos to pick one from; omitted when it has none. */
  onPickItemPhoto?: () => void;
}

interface Choice {
  key: string;
  labelKey: TranslationKey;
  icon: string;
  testID: string;
  onPress: () => void;
}

/**
 * "Change photo" for a household's entries of one catalog item: its own photo,
 * one of the item's, or the catalog's again. Only the household sees it.
 */
export const EntryPhotoSheet: React.FC<EntryPhotoSheetProps> = ({
  visible,
  onDismiss,
  entryPhoto,
  hasHouseholdPhoto,
  onPickItemPhoto,
}) => {
  const { t } = useTranslation();
  const { takePhoto, pickPhoto } = usePhotoCapture();
  const { setOwnPhoto, revertToCatalogPhoto, busy } = entryPhoto;

  const closeWhen = (landed: boolean) => {
    if (landed) onDismiss();
  };

  const applyCapture = async (capture: () => Promise<ImageFile[]>) => {
    const [file] = await capture();
    if (!file) return;
    closeWhen(await setOwnPhoto(file));
  };

  const pickChoices: Choice[] = onPickItemPhoto
    ? [
        {
          key: 'pick',
          labelKey: 'entryPhoto.pickItemPhoto',
          icon: 'images-outline',
          testID: catalogTestIDs.entryPhotoPickItemPhoto,
          onPress: onPickItemPhoto,
        },
      ]
    : [];
  const revertChoices: Choice[] = hasHouseholdPhoto
    ? [
        {
          key: 'catalog',
          labelKey: 'entryPhoto.useCatalogPhoto',
          icon: 'refresh-outline',
          testID: catalogTestIDs.entryPhotoUseCatalog,
          onPress: () => {
            void revertToCatalogPhoto().then(closeWhen);
          },
        },
      ]
    : [];
  const choices: Choice[] = [
    {
      key: 'take',
      labelKey: 'labels.takePhoto',
      icon: 'camera-outline',
      testID: catalogTestIDs.entryPhotoTake,
      onPress: () => {
        void applyCapture(takePhoto);
      },
    },
    {
      key: 'choose',
      labelKey: 'imagePicker.chooseFromLibrary',
      icon: 'image-outline',
      testID: catalogTestIDs.entryPhotoChoose,
      onPress: () => {
        void applyCapture(pickPhoto);
      },
    },
    ...pickChoices,
    ...revertChoices,
  ];

  return (
    <Sheet
      mode="action"
      visible={visible}
      onDismiss={onDismiss}
      enableDynamicSizing
      snapPoints={[]}
      title={t('entryPhoto.title')}
    >
      <View testID={catalogTestIDs.entryPhotoSheet}>
        <Text role="caption" tone="secondary" style={styles.note}>
          {t('entryPhoto.privacyNote')}
        </Text>
        {busy ? (
          <Loading size="small" message={t('entryPhoto.saving')} />
        ) : (
          choices.map(choice => (
            <AppPressable
              key={choice.key}
              testID={choice.testID}
              style={styles.choice}
              onPress={choice.onPress}
              accessibilityRole="button"
            >
              <Icon name={choice.icon} size={20} tone="primary" />
              <Text role="bodyStrong" style={styles.choiceLabel}>
                {t(choice.labelKey)}
              </Text>
            </AppPressable>
          ))
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  note: {
    marginBottom: theme.spacing.md,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.basePlus,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  choiceLabel: {
    flex: 1,
  },
}));
