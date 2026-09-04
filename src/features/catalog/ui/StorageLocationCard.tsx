import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { StorageLocationIcon } from '#features/catalog/ui/StorageLocationIcon';
import { commonStyles } from '#/styles/commonStyles';
import { Badge } from '#components/atoms/Badge';
import { Text } from '#components/atoms/Text';
import { STORAGE_TYPE_VALUES } from '#features/catalog/components/storageLocationFormConfig';

/** Key paths, not resolved strings — `t` is only available inside the
 *  component, and resolving at module load would freeze the language. */
const TEMPERATURE_LABEL_KEYS: Record<string, string> = {
  REFRIGERATED: 'storageState.REFRIGERATED',
  FROZEN: 'storageState.FROZEN',
  AMBIENT: 'storageState.AMBIENT',
};

const STORAGE_TYPE_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  STORAGE_TYPE_VALUES.map(({ value, key }) => [
    value,
    `storageLocationForm.${key}`,
  ]),
);

/** The storage-location fields this card renders. */
interface StorageLocationCardLocation {
  type: string;
  name: string;
  color?: string | null;
  temperature?: string | null;
  capacity?: number | null;
  capacityUnit?: string | null;
  currentItemCount?: number | null;
  description?: string | null;
  parentLocation?: { name?: string | null } | null;
}

interface StorageLocationCardProps {
  location: StorageLocationCardLocation;
  isDefault: boolean;
  onPress?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  /**
   * Editing a location is online-only — there is no `sync*` twin or
   * `idempotencyKey` for these mutations, so a queued replay has no
   * at-most-once guarantee. Disable rather than let the tap through to a
   * failure. Creating one is unaffected: the server links-or-creates by name.
   */
  actionsDisabled?: boolean;
}

export const StorageLocationCard: React.FC<StorageLocationCardProps> = ({
  location,
  isDefault,
  onPress,
  onEdit,
  onDelete,
  onSetDefault,
  actionsDisabled = false,
}) => {
  const { t } = useTranslation();
  /** Fallback for a type the schema gained after this table was written. */
  const formatType = (type: string): string => {
    return type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const hasColor = !!location.color;
  const typeLabelKey = STORAGE_TYPE_LABEL_KEYS[location.type];
  const typeLabel = typeLabelKey ? t(typeLabelKey) : formatType(location.type);
  const temperatureLabelKey = location.temperature
    ? TEMPERATURE_LABEL_KEYS[location.temperature]
    : undefined;
  const hasCapacity = location.capacity != null && location.capacity > 0;

  return (
    <View style={[commonStyles.card, commonStyles.shadow, styles.card]}>
      <View style={styles.cardContent}>
        {hasColor ? (
          <View
            style={[
              styles.colorStrip,
              { backgroundColor: location.color ?? undefined },
            ]}
          />
        ) : null}
        <View style={styles.cardBody}>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => [
              styles.cardHeader,
              pressed && onPress && styles.pressed,
            ]}
            disabled={!onPress}
          >
            <View style={styles.headerRow}>
              <StorageLocationIcon type={location.type} size={20} />
              <View style={styles.info}>
                <View style={commonStyles.rowSpaceBetween}>
                  <Text style={commonStyles.title}>{location.name}</Text>
                  <View style={styles.badges}>
                    {!!isDefault && (
                      <Badge variant="primary">
                        {t('storageLocationCard.default')}
                      </Badge>
                    )}
                    {!!temperatureLabelKey && (
                      <Badge variant="primary">{t(temperatureLabelKey)}</Badge>
                    )}
                  </View>
                </View>
                <Text style={[commonStyles.caption, styles.subtitle]}>
                  {!location.parentLocation && <Text>{typeLabel} • </Text>}
                  {t('storageLocationCard.itemCount', {
                    // i18next selects the plural form from `count`, and a
                    // non-number silently lands on the wrong one. The prop is
                    // declared `number | null | undefined` even though the
                    // schema has `currentItemCount: Int!`.
                    count: location.currentItemCount ?? 0,
                  })}
                  {hasCapacity ? (
                    <Text>
                      {' '}
                      / {location.capacity}{' '}
                      {location.capacityUnit || t('labels.units')}
                    </Text>
                  ) : null}
                  {!!location.parentLocation?.name && (
                    <Text tone="secondary" style={styles.parentInfo}>
                      {' • '}
                      {t('storageLocationCard.insideParent', {
                        parent: location.parentLocation.name,
                      })}
                    </Text>
                  )}
                </Text>
                {!!location.description && (
                  <Text
                    role="caption"
                    tone="secondary"
                    style={styles.description}
                    numberOfLines={1}
                  >
                    {location.description}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>

          <View style={[commonStyles.row, styles.actions]}>
            {!isDefault && (
              <AppPressable
                style={[commonStyles.row, styles.actionButton]}
                onPress={onSetDefault}
                disabled={actionsDisabled}
              >
                <Icon
                  name="star-outline"
                  size={18}
                  tone={actionsDisabled ? 'textSecondary' : undefined}
                />
                <Text
                  role="label"
                  tone={actionsDisabled ? 'tertiary' : undefined}
                >
                  {t('labels.setDefault')}
                </Text>
              </AppPressable>
            )}
            <AppPressable
              style={[commonStyles.row, styles.actionButton]}
              onPress={onEdit}
              disabled={actionsDisabled}
            >
              <Icon
                name="create-outline"
                size={18}
                tone={actionsDisabled ? 'textSecondary' : undefined}
              />
              <Text
                role="label"
                tone={actionsDisabled ? 'tertiary' : undefined}
              >
                {t('labels.edit')}
              </Text>
            </AppPressable>
            <AppPressable
              style={[commonStyles.row, styles.deleteActionButton]}
              onPress={onDelete}
              disabled={actionsDisabled}
            >
              <Icon
                name="trash-outline"
                size={18}
                tone={actionsDisabled ? 'textSecondary' : 'error'}
              />
              <Text role="label" tone={actionsDisabled ? 'tertiary' : 'error'}>
                {t('labels.delete')}
              </Text>
            </AppPressable>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    marginBottom: theme.spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
  },
  colorStrip: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: theme.spacing.md,
  },
  cardHeader: {
    paddingBottom: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  info: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
  },
  description: {
    marginTop: theme.spacing.xs,
    fontStyle: 'italic',
  },
  parentInfo: {
    fontStyle: 'italic',
  },
  actions: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  deleteActionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
