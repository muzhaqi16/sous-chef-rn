import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetAction } from '#components/templates/BottomSheetAction';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { Button } from '#components/atoms/Button';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { useReportItem } from '#hooks/items/useReportItem';
import { MIN_EDIT_REASON_LENGTH } from '#utils/validation/item';

export interface ReportItemTarget {
  id: string;
  name: string;
  imageUrl?: string | null;
  brandName?: string | null;
}

interface ReportItemSheetProps {
  visible: boolean;
  /** The items the user can see right now. A single candidate skips the picker. */
  candidates: ReportItemTarget[];
  onDismiss: () => void;
}

/**
 * Reports a catalog item with wrong details.
 *
 * Deliberately not an edit form: from an autocomplete row the user has only
 * seen a name, brand and thumbnail, so a free-text reason is the most they can
 * meaningfully supply. An admin triages from there. The barcode flow, where the
 * full item is on screen, offers structured suggestions instead.
 */
export const ReportItemSheet: React.FC<ReportItemSheetProps> = ({
  visible,
  candidates,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const { reportItem, loading } = useReportItem();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const trimmedReason = reason.trim();
  const reasonTooShort = trimmedReason.length < MIN_EDIT_REASON_LENGTH;

  const onlyCandidateId = candidates.length === 1 ? candidates[0].id : null;
  const targetId = selectedId ?? onlyCandidateId;
  const target = candidates.find(item => item.id === targetId);

  const handleDismiss = () => {
    setSelectedId(null);
    setReason('');
    onDismiss();
  };

  const handleSubmit = async () => {
    if (!targetId) return;
    const succeeded = await reportItem(targetId, reason);
    // On failure the sheet stays open so the typed reason survives a retry.
    if (succeeded) handleDismiss();
  };

  return (
    <BottomSheetAction
      visible={visible}
      onDismiss={handleDismiss}
      sheetTitle={t('reportItem.title')}
      snapPoints={['55%', '85%']}
    >
      {!target ? (
        <View>
          <Text size="sm" tone="secondary" style={styles.prompt}>
            {t('reportItem.pickPrompt')}
          </Text>
          {candidates.map(item => (
            <AppPressable
              key={item.id}
              style={styles.candidateRow}
              onPress={() => setSelectedId(item.id)}
            >
              {item.imageUrl ? (
                <CachedImage
                  uri={item.imageUrl}
                  style={styles.candidateImage}
                  displaySize={40}
                />
              ) : (
                <View style={styles.candidatePlaceholder}>
                  <Icon name="cube-outline" size={20} tone="primary" />
                </View>
              )}
              <View style={styles.candidateInfo}>
                <Text size="base" weight="medium" numberOfLines={1}>
                  {item.name}
                </Text>
                {!!item.brandName && (
                  <Text size="sm" tone="secondary" numberOfLines={1}>
                    {item.brandName}
                  </Text>
                )}
              </View>
              <Icon name="chevron-forward" size={18} tone="secondary" />
            </AppPressable>
          ))}
        </View>
      ) : (
        <View>
          <Text size="base" weight="semibold" numberOfLines={1}>
            {target.name}
          </Text>
          {!!target.brandName && (
            <Text size="sm" tone="secondary" numberOfLines={1}>
              {target.brandName}
            </Text>
          )}

          <Text size="sm" weight="medium" style={styles.reasonLabel}>
            {t('reportItem.reasonLabel')}
          </Text>
          <ThemedBottomSheetTextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder={t('reportItem.reasonPlaceholder')}
            accessibilityLabel={t('reportItem.reasonLabel')}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
          {/* Says why submit is disabled. Withheld until they start typing, so
              it reads as guidance rather than an error on an untouched field. */}
          {!!trimmedReason && !!reasonTooShort && (
            <Text size="sm" tone="secondary" style={styles.reasonHint}>
              {t('reportItem.reasonTooShort', {
                count: MIN_EDIT_REASON_LENGTH,
              })}
            </Text>
          )}

          <Button
            variant="primary"
            fullWidth
            loading={loading}
            disabled={reasonTooShort}
            onPress={handleSubmit}
            style={styles.submit}
          >
            {t('reportItem.submit')}
          </Button>
        </View>
      )}
    </BottomSheetAction>
  );
};

const styles = StyleSheet.create(theme => ({
  prompt: {
    marginBottom: theme.spacing.md,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  candidateImage: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  candidatePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateInfo: {
    flex: 1,
  },
  reasonLabel: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  reasonHint: {
    marginTop: theme.spacing.sm,
  },
  reasonInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
  },
  submit: {
    marginTop: theme.spacing.xl,
  },
}));
