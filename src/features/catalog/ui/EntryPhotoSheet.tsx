import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import type { IconName } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { ActionMenuRow } from '#components/molecules/ActionMenuRow';
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
  icon: IconName;
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
          <View style={styles.choices}>
            {choices.map(choice => (
              <ActionMenuRow
                key={choice.key}
                testID={choice.testID}
                icon={choice.icon}
                label={t(choice.labelKey)}
                onPress={choice.onPress}
              />
            ))}
          </View>
        )}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  note: {
    marginBottom: theme.spacing.md,
  },
  choices: {
    gap: theme.spacing.sm,
  },
}));
