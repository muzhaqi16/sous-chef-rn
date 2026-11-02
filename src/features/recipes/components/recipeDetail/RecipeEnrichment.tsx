import React from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';
import type { RecipeNutritionFacts } from '#domain/nutrition';

type MacroField = Exclude<keyof RecipeNutritionFacts, 'calories'>;

// The macros under the calories, in order, with the unit each is stated in.
const MACROS: { field: MacroField; labelKey: TranslationKey; unit: string }[] =
  [
    { field: 'protein', labelKey: 'labels.protein', unit: 'g' },
    { field: 'totalCarbs', labelKey: 'recipes.macroCarbohydrates', unit: 'g' },
    { field: 'totalFat', labelKey: 'recipes.macroFat', unit: 'g' },
    { field: 'dietaryFiber', labelKey: 'recipes.macroFiber', unit: 'g' },
    { field: 'totalSugars', labelKey: 'recipes.macroSugar', unit: 'g' },
    { field: 'sodium', labelKey: 'recipes.macroSodium', unit: 'mg' },
  ];

interface NutrientRow {
  labelKey: TranslationKey;
  value: string;
}

function macroRows(
  nutrition: RecipeNutritionFacts | null | undefined,
): NutrientRow[] {
  if (!nutrition) return [];
  return MACROS.flatMap(({ field, labelKey, unit }) => {
    const amount = nutrition[field];
    return amount === null
      ? []
      : [{ labelKey, value: `${Math.round(amount)} ${unit}` }];
  });
}

interface RecipeEnrichmentProps {
  caloriesPerServing?: number;
  nutrition?: RecipeNutritionFacts | null;
  tips?: string;
  videoUrl?: string;
  forkedFromName?: string;
  tags?: string[];
  status?: RecipeStatus;
  reviewNote?: string;
  hasPendingRevision?: boolean;
  revisionRejectionNote?: string;
}

export const RecipeEnrichment: React.FC<RecipeEnrichmentProps> = ({
  caloriesPerServing,
  nutrition,
  tips,
  videoUrl,
  forkedFromName,
  tags,
  status,
  reviewNote,
  hasPendingRevision,
  revisionRejectionNote,
}) => {
  const { t } = useTranslation();
  const calories = caloriesPerServing ?? nutrition?.calories ?? null;
  const nutrients = macroRows(nutrition);
  const hasNutrition = calories !== null || nutrients.length > 0;
  const hasTags = !!tags && tags.length > 0;

  return (
    <>
      {/* Nutrition */}
      {!!hasNutrition && (
        <View style={styles.section}>
          <SectionHeader variant="title" style={styles.sectionTitle}>
            {t('recipes.nutritionTitle')}
          </SectionHeader>
          <View style={styles.nutrientGrid}>
            {calories !== null && (
              <View style={styles.nutrientCell}>
                <Text role="label">{Math.round(calories)}</Text>
                <Text role="caption" tone="secondary">
                  {t('recipes.caloriesPerServingLabel')}
                </Text>
              </View>
            )}
            {nutrients.map(row => (
              <View key={row.labelKey} style={styles.nutrientCell}>
                <Text role="label">{row.value}</Text>
                <Text role="caption" tone="secondary">
                  {t(row.labelKey)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tips */}
      {!!tips && (
        <View style={styles.section}>
          <SectionHeader variant="title" style={styles.sectionTitle}>
            {t('labels.tips')}
          </SectionHeader>
          <Text role="caption" tone="secondary">
            {tips}
          </Text>
        </View>
      )}

      {/* Tags */}
      {!!hasTags && (
        <View style={styles.tagRow}>
          {tags.map(tag => (
            <View key={tag} style={styles.tagChip}>
              <Text role="caption" tone="secondary">
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Provenance */}
      {(!!forkedFromName || !!videoUrl) && (
        <View style={styles.metaColumn}>
          {!!forkedFromName && (
            <View style={styles.metaLine}>
              <Icon name="git-branch-outline" size={14} tone="textSecondary" />
              <Text role="caption" tone="secondary" style={styles.metaText}>
                {t('recipes.forkedFrom', { name: forkedFromName })}
              </Text>
            </View>
          )}
          {!!videoUrl && (
            <View style={styles.metaLine}>
              <Icon name="videocam-outline" size={14} tone="textSecondary" />
              <Text role="caption" tone="secondary" style={styles.metaText}>
                {t('recipes.hasVideo')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Only the author sees a recipe that is not published. */}
      {status === RecipeStatus.Draft && (
        <View style={styles.status}>
          <View style={styles.metaLine}>
            <Icon name="eye-off-outline" size={14} tone="textSecondary" />
            <Text role="caption" tone="secondary" style={styles.metaText}>
              {t('recipes.draftBadge')}
            </Text>
          </View>
          {/* A rejection returns the recipe as a draft, always with a note. */}
          {!!reviewNote && (
            <Text role="caption" tone="secondary">
              {t('recipes.reviewNote', { note: reviewNote })}
            </Text>
          )}
        </View>
      )}
      {status === RecipeStatus.PendingReview && (
        <View style={styles.status}>
          <View style={styles.metaLine}>
            <Icon name="hourglass-outline" size={14} tone="textSecondary" />
            <Text role="caption" tone="secondary" style={styles.metaText}>
              {t('recipes.inReviewBadge')}
            </Text>
          </View>
        </View>
      )}
      {/* An edit to a published recipe waits for review while the recipe stays live. */}
      {status === RecipeStatus.Published &&
        (!!hasPendingRevision || !!revisionRejectionNote) && (
          <View style={styles.status}>
            {!!hasPendingRevision && (
              <View style={styles.metaLine}>
                <Icon name="hourglass-outline" size={14} tone="textSecondary" />
                <Text role="caption" tone="secondary" style={styles.metaText}>
                  {t('recipes.pendingChangesBadge')}
                </Text>
              </View>
            )}
            {!!revisionRejectionNote && (
              <Text role="caption" tone="secondary">
                {t('recipes.revisionRejectedNote', {
                  note: revisionRejectionNote,
                })}
              </Text>
            )}
          </View>
        )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  // Each block spaces below itself, as the detail screen around it does.
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.sm,
  },
  nutrientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  nutrientCell: {
    minWidth: 64,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tagChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
  },
  metaColumn: {
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    flex: 1,
  },
  status: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
}));
