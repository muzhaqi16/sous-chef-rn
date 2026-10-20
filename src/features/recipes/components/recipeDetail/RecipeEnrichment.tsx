import React from 'react';
import { View } from 'react-native';
import { useTranslation, type TranslationKey } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { isRecord } from '#/utils/isRecord';
import { RecipeStatus } from '#/graphql/generated/schemaTypes';

interface NutrientRow {
  labelKey: TranslationKey;
  value: string;
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return isRecord(x) ? x : null;
}

// Keys are the Spoonacular nutrient `name` values (matched against the blob);
// values are the i18n keys whose label is resolved at render time so the macro
// names follow the active language.
type MacroNutrient =
  | 'Calories'
  | 'Protein'
  | 'Carbohydrates'
  | 'Fat'
  | 'Fiber'
  | 'Sugar'
  | 'Sodium';

const MACRO_LABEL_KEYS: Record<MacroNutrient, TranslationKey> = {
  Calories: 'labels.calories',
  Protein: 'recipes.macroProtein',
  Carbohydrates: 'recipes.macroCarbohydrates',
  Fat: 'recipes.macroFat',
  Fiber: 'recipes.macroFiber',
  Sugar: 'recipes.macroSugar',
  Sodium: 'recipes.macroSodium',
};
const MACRO_ORDER: MacroNutrient[] = [
  'Calories',
  'Protein',
  'Carbohydrates',
  'Fat',
  'Fiber',
  'Sugar',
  'Sodium',
];

/** Pull the common macros out of a Spoonacular-style `{ nutrients: [...] }` blob. */
function parseNutrition(data: unknown): NutrientRow[] {
  const root = asRecord(data);
  const nutrients = root?.nutrients;
  if (!Array.isArray(nutrients)) return [];
  const rows: NutrientRow[] = [];
  for (const name of MACRO_ORDER) {
    const rec = asRecord(nutrients.find(n => asRecord(n)?.name === name));
    if (!rec) continue;
    const amount =
      typeof rec.amount === 'number' ? rec.amount : Number(rec.amount);
    if (Number.isNaN(amount)) continue;
    const unit = typeof rec.unit === 'string' ? rec.unit : '';
    rows.push({
      labelKey: MACRO_LABEL_KEYS[name],
      value: `${Math.round(amount)}${unit ? ` ${unit}` : ''}`,
    });
  }
  return rows;
}

interface RecipeEnrichmentProps {
  caloriesPerServing?: number;
  nutritionData?: unknown;
  tips?: string;
  videoUrl?: string;
  forkedFromName?: string;
  originalAuthor?: string;
  tags?: string[];
  status?: RecipeStatus;
  reviewNote?: string;
  hasPendingRevision?: boolean;
  revisionRejectionNote?: string;
}

export const RecipeEnrichment: React.FC<RecipeEnrichmentProps> = ({
  caloriesPerServing,
  nutritionData,
  tips,
  videoUrl,
  forkedFromName,
  originalAuthor,
  tags,
  status,
  reviewNote,
  hasPendingRevision,
  revisionRejectionNote,
}) => {
  const { t } = useTranslation();
  const nutrients = parseNutrition(nutritionData);
  const hasNutrition = caloriesPerServing != null || nutrients.length > 0;
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
            {caloriesPerServing != null && (
              <View style={styles.nutrientCell}>
                <Text role="label">{Math.round(caloriesPerServing)}</Text>
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

      {/* Attribution / provenance */}
      {(!!forkedFromName || !!originalAuthor || !!videoUrl) && (
        <View style={styles.metaColumn}>
          {!!forkedFromName && (
            <View style={styles.metaLine}>
              <Icon name="git-branch-outline" size={14} tone="textSecondary" />
              <Text role="caption" tone="secondary" style={styles.metaText}>
                {t('recipes.forkedFrom', { name: forkedFromName })}
              </Text>
            </View>
          )}
          {!!originalAuthor && (
            <View style={styles.metaLine}>
              <Icon name="person-outline" size={14} tone="textSecondary" />
              <Text role="caption" tone="secondary" style={styles.metaText}>
                {t('recipes.byAuthor', { author: originalAuthor })}
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
