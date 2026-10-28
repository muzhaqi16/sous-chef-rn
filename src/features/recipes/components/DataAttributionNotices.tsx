import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Link } from '#components/atoms/Link';
import { Text } from '#components/atoms/Text';
import type { DataAttributionValue } from '#/types/attribution';
import { recipesTestIDs } from '#features/recipes/testIDs';

interface DataAttributionNoticesProps {
  attributions: readonly DataAttributionValue[];
  /** Centred under centred content, like a recipe's source line. */
  centered?: boolean;
}

/**
 * The notices a recipe's provider asks a reader to see, such as Spoonacular's
 * backlink, as the API words them: each links to its source, and to its licence
 * when it names one.
 */
export const DataAttributionNotices: React.FC<DataAttributionNoticesProps> = ({
  attributions,
  centered = false,
}) => {
  const { t } = useTranslation();
  if (attributions.length === 0) return null;

  // One paragraph per notice: the licence runs on after it, so a long notice
  // wraps as text instead of pushing the licence onto a line of its own.
  return (
    <View style={styles.list}>
      {attributions.map(({ source, notice, licenseUrl, sourceUrl }) => (
        <Text
          key={source}
          role="caption"
          tone="secondary"
          align={centered ? 'center' : undefined}
        >
          {sourceUrl ? (
            <Link
              variant="caption"
              href={sourceUrl}
              testID={recipesTestIDs.dataAttributionSource(source)}
            >
              {notice}
            </Link>
          ) : (
            notice
          )}
          {licenseUrl ? (
            <>
              {' · '}
              <Link
                variant="caption"
                href={licenseUrl}
                testID={recipesTestIDs.dataAttributionLicense(source)}
              >
                {t('labels.license')}
              </Link>
            </>
          ) : null}
        </Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  list: {
    gap: theme.spacing.xs,
  },
}));
