import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Link } from '#components/atoms/Link';
import { Text } from '#components/atoms/Text';
import type { DataAttribution } from '#/graphql/generated/schemaTypes';
import { kitTestIDs } from '#components/testIDs';

export type DataAttributionValue = Pick<
  DataAttribution,
  'source' | 'notice' | 'licenseUrl' | 'sourceUrl'
>;

interface DataAttributionNoticesProps {
  attributions: readonly DataAttributionValue[];
  /** Centred under centred content, like a recipe's source line. */
  centered?: boolean;
}

/**
 * The notices a licensed dataset asks a reader to see wherever its data is
 * shown (Open Food Facts' ODbL, the USDA citation, Spoonacular's backlink),
 * as the API words them: each links to its source, and to its licence when it
 * names one.
 */
export const DataAttributionNotices: React.FC<DataAttributionNoticesProps> = ({
  attributions,
  centered = false,
}) => {
  const { t } = useTranslation();
  styles.useVariants({ centered });
  if (attributions.length === 0) return null;

  return (
    <View style={styles.list}>
      {attributions.map(({ source, notice, licenseUrl, sourceUrl }) => (
        <View key={source} style={styles.row}>
          {sourceUrl ? (
            <Link
              variant="caption"
              href={sourceUrl}
              testID={kitTestIDs.dataAttributionSource(source)}
            >
              {notice}
            </Link>
          ) : (
            <Text role="caption" tone="secondary">
              {notice}
            </Text>
          )}
          {!!licenseUrl && (
            <Link
              variant="caption"
              href={licenseUrl}
              testID={kitTestIDs.dataAttributionLicense(source)}
            >
              {t('labels.license')}
            </Link>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  list: {
    gap: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: theme.spacing.sm,
    rowGap: theme.spacing['2xs'],
    variants: {
      centered: {
        true: {
          justifyContent: 'center',
        },
      },
    },
  },
}));
