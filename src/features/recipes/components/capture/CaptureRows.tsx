import React from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { RowCard } from '#components/atoms/RowCard';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { ListItem } from '#components/molecules/ListItem';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  useCaptureEntries,
  useRecipeCaptureActions,
  type CaptureEntry,
} from '#features/recipes/store/recipeCaptureStore';
import { recipesTestIDs } from '#features/recipes/testIDs';

/** Captures still reading, and partial reads waiting to be finished. */
export const CaptureRows: React.FC = () => {
  const { t } = useTranslation();
  const entries = useCaptureEntries();
  const { settle } = useRecipeCaptureActions();
  const { toRecipeCreate } = useAppNavigation();

  if (entries.length === 0) return null;

  const readingTitle = ({ source, label }: CaptureEntry) => {
    switch (source) {
      case 'url':
        return label
          ? t('recipes.captureReadingPage', { label })
          : t('recipes.captureReadingText');
      case 'text':
        return t('recipes.captureReadingText');
      case 'photo':
        return t('recipes.captureReadingPhotos');
    }
  };

  return (
    <View testID={recipesTestIDs.captureRows}>
      {entries.map(entry =>
        entry.state === 'reading' ? (
          <RowCard key={entry.id}>
            <ListItem
              title={readingTitle(entry)}
              leftElement={<ThemedActivityIndicator size="small" />}
            />
          </RowCard>
        ) : (
          <RowCard key={entry.id}>
            <ListItem
              title={
                entry.label
                  ? t('recipes.captureToFinish', { label: entry.label })
                  : t('recipes.captureToFinishUnnamed')
              }
              leftIcon="create-outline"
              onPress={() => toRecipeCreate({ captureId: entry.id })}
              rightElement={
                <IconButton
                  name="close"
                  size="sm"
                  tone="textSecondary"
                  onPress={() => settle(entry.id)}
                  accessibilityLabel={t('labels.close')}
                  accessibilityRole="button"
                />
              }
            />
          </RowCard>
        ),
      )}
    </View>
  );
};
