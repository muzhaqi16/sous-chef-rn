import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

interface NutrientRow {
  labelKey: string;
  value: string;
}

// nutritionData is an untyped JSON blob (Spoonacular-shaped). Narrow to a record
// after a runtime typeof check — no `any`, just defensive structural access.
function asRecord(x: unknown): Record<string, unknown> | null {
  return x !== null && typeof x === 'object'
    ? (x as Record<string, unknown>)
    : null;
}

// Keys are the Spoonacular nutrient `name` values (matched against the blob);
// values are the i18n keys whose label is resolved at render time so the macro
// names follow the active language.
const MACRO_LABEL_KEYS: Record<string, string> = {
  Calories: 'labels.calories',
  Protein: 'recipes.macroProtein',
  Carbohydrates: 'recipes.macroCarbohydrates',
  Fat: 'recipes.macroFat',
  Fiber: 'recipes.macroFiber',
  Sugar: 'recipes.macroSugar',
  Sodium: 'recipes.macroSodium',
};
const MACRO_ORDER = Object.keys(MACRO_LABEL_KEYS);

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
  isBackendRecipe: boolean;
  isPublished?: boolean;
}

export const RecipeEnrichment: React.FC<RecipeEnrichmentProps> = ({
  caloriesPerServing,
  nutritionData,
  tips,
  videoUrl,
  forkedFromName,
  originalAuthor,
  tags,
  isBackendRecipe,
  isPublished,
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
          <Text size="md" weight="semibold" style={styles.sectionTitle}>
            {t('recipes.nutritionTitle')}
          </Text>
          <View style={styles.nutrientGrid}>
            {caloriesPerServing != null && (
              <View style={styles.nutrientCell}>
                <Text size="sm" weight="semibold">
                  {Math.round(caloriesPerServing)}
                </Text>
                <Text size="xs" tone="secondary">
                  {t('recipes.caloriesPerServingLabel')}
                </Text>
              </View>
            )}
            {nutrients.map(row => (
              <View key={row.labelKey} style={styles.nutrientCell}>
                <Text size="sm" weight="semibold">
                  {row.value}
                </Text>
                <Text size="xs" tone="secondary">
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
          <Text size="md" weight="semibold" style={styles.sectionTitle}>
            {t('labels.tips')}
          </Text>
          <Text size="sm" tone="secondary">
            {tips}
          </Text>
        </View>
      )}

      {/* Tags */}
      {!!hasTags && (
        <View style={styles.tagRow}>
          {tags.map(tag => (
            <View key={tag} style={styles.tagChip}>
              <Text size="xs" tone="secondary">
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
              <Text size="xs" tone="secondary" style={styles.metaText}>
                {t('recipes.forkedFrom', { name: forkedFromName })}
              </Text>
            </View>
          )}
          {!!originalAuthor && (
            <View style={styles.metaLine}>
              <Icon name="person-outline" size={14} tone="textSecondary" />
              <Text size="xs" tone="secondary" style={styles.metaText}>
                {t('recipes.byAuthor', { author: originalAuthor })}
              </Text>
            </View>
          )}
          {!!videoUrl && (
            <View style={styles.metaLine}>
              <Icon name="videocam-outline" size={14} tone="textSecondary" />
              <Text size="xs" tone="secondary" style={styles.metaText}>
                {t('recipes.hasVideo')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Draft badge — owner sees when a backend recipe is unpublished. */}
      {!!(isBackendRecipe && isPublished === false) && (
        <View style={styles.draftBadge}>
          <Icon name="eye-off-outline" size={14} tone="textSecondary" />
          <Text size="xs" tone="secondary" style={styles.metaText}>
            {t('recipes.draftBadge')}
          </Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    marginTop: theme.spacing.md,
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
    marginTop: theme.spacing.md,
  },
  tagChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metaColumn: {
    marginTop: theme.spacing.md,
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
  draftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.md,
  },
}));
