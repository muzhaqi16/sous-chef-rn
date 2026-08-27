import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SettingRow, SettingRowProps } from '../molecules/SettingRow';
import { Text } from '#components/atoms/Text';

export interface SettingsSectionProps {
  title: string;
  /** Optional explanatory line under the title. */
  description?: string;
  /**
   * Rows rendered as `SettingRow`s, with first/last handled here.
   * Mutually exclusive with `children`.
   */
  items?: SettingRowProps['item'][];
  /** Arbitrary section content, for rows that are not `SettingRow`s. */
  children?: ReactNode;
  /**
   * Body treatment.
   *
   * `card` — inset, rounded surface (profile screens).
   * `inset` — full-bleed surface with hairline top/bottom rules (app and
   *   notification settings).
   *
   * Two treatments rather than one because this component replaced three
   * near-identical sections that disagreed only here; collapsing them to a
   * single look would have been a visual change dressed up as a refactor.
   */
  variant?: 'card' | 'inset';
}

/**
 * A titled group of settings rows.
 *
 * Replaces `components/settings/SettingSection`, `organisms/SettingsSection`
 * and `organisms/ProfileInfo/Section` — three components that each rendered an
 * uppercase title above a `surface`-backed body and passed `isFirst`/`isLast`
 * down. Two screens imported from two of them at once.
 */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  items,
  children,
  variant = 'card',
}) => {
  styles.useVariants({ variant });

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text size="xs" weight="semibold" tone="secondary" style={styles.title}>
          {title}
        </Text>
        {description ? (
          <Text tone="tertiary" style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={styles.body}>
        {children ??
          items?.map((item, idx) => (
            <SettingRow
              key={item.key}
              item={item}
              isFirst={idx === 0}
              isLast={idx === items.length - 1}
            />
          ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  section: {
    variants: {
      variant: {
        card: {
          marginBottom: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
        },
        inset: { marginBottom: theme.spacing.xl },
      },
    },
  },
  header: {
    variants: {
      variant: {
        card: {},
        inset: {
          paddingHorizontal: theme.spacing.md,
          marginTop: theme.spacing.md,
        },
      },
    },
  },
  title: {
    textTransform: 'uppercase',
    variants: {
      variant: {
        card: { marginBottom: theme.spacing.md, marginTop: theme.spacing.md },
        inset: { letterSpacing: 0.5 },
      },
    },
  },
  description: {
    fontSize: theme.typography.fontSize.sm - 1,
    marginTop: theme.spacing.xs,
  },
  body: {
    backgroundColor: theme.colors.surface,
    variants: {
      variant: {
        card: {
          borderRadius: theme.radii.lg,
          borderCurve: 'continuous',
          overflow: 'hidden',
        },
        inset: {
          marginTop: theme.spacing.sm,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
        },
      },
    },
  },
}));
