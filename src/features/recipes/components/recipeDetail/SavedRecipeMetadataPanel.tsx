import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Icon } from '#utils/iconUtils';

interface SavedRecipeMetadataPanelProps {
  savedFolder: string | null;
  savedTags: string[];
  savedNotes: string | null;
  savedRating: number | null;
  updatingFolderTags: boolean;
  onUpdateRating: (rating: number | null) => void;
}

export const SavedRecipeMetadataPanel: React.FC<
  SavedRecipeMetadataPanelProps
> = ({
  savedFolder,
  savedTags,
  savedNotes,
  savedRating,
  updatingFolderTags,
  onUpdateRating,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.detailRow}>
        <Text role="caption" style={styles.detailLabel}>
          {t('recipes.rating')}
        </Text>
        <View style={styles.ratingStars}>
          {[1, 2, 3, 4, 5].map(star => (
            <Pressable
              key={star}
              onPress={() => onUpdateRating(star === savedRating ? null : star)}
              accessibilityLabel={t('a11y.rateStars', { count: star })}
              hitSlop={4}
              disabled={updatingFolderTags}
            >
              <Icon
                name={
                  savedRating !== null && star <= savedRating
                    ? 'star'
                    : 'star-outline'
                }
                size={18}
                tone={
                  savedRating !== null && star <= savedRating
                    ? 'rating'
                    : 'textSecondary'
                }
              />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{t('labels.folder')}</Text>
        <View style={styles.detailValue}>
          <Icon
            name="folder"
            size={14}
            tone={savedFolder ? 'primary' : 'textSecondary'}
          />
          <Text
            role="caption"
            style={[
              styles.detailValueText,
              savedFolder && styles.detailValueTextActive,
            ]}
          >
            {savedFolder || t('recipes.none')}
          </Text>
        </View>
      </View>

      {savedTags.length > 0 && (
        <View style={styles.tagsDisplayRow}>
          <Text style={styles.detailLabel}>{t('recipes.tags')}</Text>
          <View style={styles.tagsChipsContainer}>
            {savedTags.map((tag, index) => (
              <View key={`${tag}-${index}`} style={styles.tagChip}>
                <Text role="label" style={styles.tagChipText}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {!!savedNotes && (
        <View style={styles.notesDisplayRow}>
          <Text style={styles.detailLabel}>{t('recipes.notes')}</Text>
          <Text role="caption" style={styles.notesText}>
            {savedNotes}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  detailLabel: {
    color: theme.colors.textSecondary,
  },
  detailValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  detailValueText: {
    color: theme.colors.textSecondary,
  },
  detailValueTextActive: {
    color: theme.colors.primary,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tagsDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  tagsChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  tagChip: {
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radii.full,
  },
  tagChipText: {
    color: theme.colors.primary,
  },
  notesDisplayRow: {
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  notesText: {
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
