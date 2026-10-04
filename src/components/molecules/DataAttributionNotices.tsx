import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import type { DataAttribution } from '#/graphql/generated/schemaTypes';
import { openWebUrl } from '#utils/externalUrl';
import { hitSlop } from '#/theme/foundations/sizes';
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
            <Pressable
              onPress={() => {
                void openWebUrl(sourceUrl);
              }}
              hitSlop={hitSlop.sm}
              accessibilityRole="link"
              testID={kitTestIDs.dataAttributionSource(source)}
            >
              <Text role="caption" tone="secondary" style={styles.link}>
                {notice}
              </Text>
            </Pressable>
          ) : (
            <Text role="caption" tone="secondary">
              {notice}
            </Text>
          )}
          {!!licenseUrl && (
            <Pressable
              onPress={() => {
                void openWebUrl(licenseUrl);
              }}
              hitSlop={hitSlop.sm}
              accessibilityRole="link"
              testID={kitTestIDs.dataAttributionLicense(source)}
            >
              <Text role="caption" tone="secondary" style={styles.link}>
                {t('labels.license')}
              </Text>
            </Pressable>
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
  link: {
    textDecorationLine: 'underline',
  },
}));
