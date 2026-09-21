import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface SearchIncompleteNoticeProps {
  onRetry: () => void;
}

/** Above the matches a partial load found, which may not be all of them. */
export const SearchIncompleteNotice: React.FC<SearchIncompleteNoticeProps> = ({
  onRetry,
}) => {
  const { t } = useTranslation();
  return (
    <View
      style={styles.container}
      testID={recipesTestIDs.searchIncompleteNotice}
    >
      <Icon name="warning-outline" size="md" tone="alertBannerWarning" />
      <View style={styles.text}>
        <Text role="label" style={styles.title}>
          {t('recipes.searchIncompleteTitle')}
        </Text>
        <Text role="caption" style={styles.title}>
          {t('recipes.searchIncompleteDescription')}
        </Text>
      </View>
      <Button
        title={t('labels.retry')}
        variant="ghost"
        size="small"
        onPress={onRetry}
        testID={recipesTestIDs.searchIncompleteRetry}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    backgroundColor: theme.colors.alertBanner.warning.bg,
    borderColor: theme.colors.alertBanner.warning.border,
  },
  text: {
    flex: 1,
  },
  title: {
    color: theme.colors.alertBanner.warning.text,
  },
}));
