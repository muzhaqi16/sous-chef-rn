import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { Pressable } from '#components/atoms/themedComponents';

interface RecipeCreditProps {
  author?: string;
  sourceName?: string;
  sourceUrl?: string;
  onOpenSource: () => void;
}

/**
 * A recipe's only credit, at the foot of its page: who wrote it and where it
 * came from, linking to the original when there is one.
 */
export const RecipeCredit: React.FC<RecipeCreditProps> = ({
  author,
  sourceName,
  sourceUrl,
  onOpenSource,
}) => {
  const { t } = useTranslation();
  const url = firstNonBlank(sourceUrl);
  const source =
    firstNonBlank(sourceName) ??
    (url && !author ? t('recipes.externalSource') : undefined);

  if (!author && !source) return null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.credit,
        !!url && pressed && { opacity: 0.7 },
      ]}
      onPress={onOpenSource}
      disabled={!url}
    >
      {!!author && (
        <Text role="caption" style={styles.creditText}>
          {t('recipes.byAuthor', { author })}
        </Text>
      )}
      {!!source && (
        <Text role="caption" style={styles.creditText}>
          {t('recipes.recipeFrom', { source })}
        </Text>
      )}
      {!!url && (
        <View style={styles.viewOriginalLink}>
          <Text role="label" style={styles.viewOriginalText}>
            {t('recipes.viewOriginalRecipe')}
          </Text>
          <Icon name="open-outline" size={14} tone="primary" />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  credit: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.md,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xl,
  },
  creditText: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  viewOriginalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  viewOriginalText: {
    color: theme.colors.primary,
  },
}));
