import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { ListItem } from '#components/molecules/ListItem';
import {
  Pressable,
  ThemedActivityIndicator,
} from '#components/atoms/themedComponents';
import { Icon } from '#components/atoms/Icon';
import { commonStyles } from '#/styles/commonStyles';
import { hitSlop } from '#/theme/foundations/sizes';
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
          <View key={entry.id} style={commonStyles.rowWrapper}>
            <ListItem
              title={readingTitle(entry)}
              leftElement={<ThemedActivityIndicator size="small" />}
            />
          </View>
        ) : (
          <View key={entry.id} style={commonStyles.rowWrapper}>
            <ListItem
              title={
                entry.label
                  ? t('recipes.captureToFinish', { label: entry.label })
                  : t('recipes.captureToFinishUnnamed')
              }
              leftIcon="create-outline"
              onPress={() => toRecipeCreate({ captureId: entry.id })}
              rightElement={
                <Pressable
                  onPress={() => settle(entry.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('labels.close')}
                  hitSlop={hitSlop.md}
                >
                  <Icon name="close" size={20} tone="textSecondary" />
                </Pressable>
              }
            />
          </View>
        ),
      )}
    </View>
  );
};
