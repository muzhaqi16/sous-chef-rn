import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { BottomSheetFormScrollView } from '#components/atoms/BottomSheetFormScrollView';
import { ThemedBottomSheetTextInput } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { SheetFormHeader } from '#components/molecules/SheetFormHeader';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { useReportItem } from '#features/catalog/hooks/useReportItem';
import { MIN_EDIT_REASON_LENGTH } from '#utils/validation/item';

export interface ReportItemTarget {
  id: string;
  name: string;
  imageUrl?: string | null;
  brandName?: string | null;
}

interface ReportItemFormProps {
  /** The items the user can see right now. A single candidate skips the picker. */
  candidates: ReportItemTarget[];
  /** Return to the search step of the host sheet. */
  onClose: () => void;
}

/**
 * The "report" step of the morphing `AddItemSheet`, not a sheet of its own — a
 * second `BottomSheetModal` minimizes the host under gorhom's default
 * `stackBehavior: 'switch'`. Free-text because an autocomplete row shows only
 * name, brand and thumbnail; the barcode flow suggests structured edits.
 */
export const ReportItemForm: React.FC<ReportItemFormProps> = ({
  candidates,
  onClose,
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

  const handleSubmit = async () => {
    if (!targetId || reasonTooShort) return;
    const succeeded = await reportItem(targetId, reason);
    // On failure the step stays put so the typed reason survives a retry.
    if (succeeded) onClose();
  };

  return (
    <View style={styles.container}>
      <SheetFormHeader
        title={t('reportItem.title')}
        cancelLabel={t('labels.back')}
        cancelTestID="report-item-cancel-button"
        saveLabel={t('reportItem.submit')}
        onCancel={onClose}
        onSave={handleSubmit}
        saving={loading}
        disabled={!target || reasonTooShort}
        submitTestID="report-item-submit-button"
      />
      <BottomSheetFormScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
              testID="report-item-reason-input"
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
          </View>
        )}
      </BottomSheetFormScrollView>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
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
    fontSize: theme.fonts.size.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    padding: theme.spacing.md,
  },
}));
