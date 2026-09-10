import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SettingRow, SettingRowProps } from './SettingRow';
import { Text } from '#components/atoms/Text';

export interface SettingsSectionProps {
  title: string;
  /** Optional explanatory line under the title. */
  description?: string;
  /** Rendered as `SettingRow`s; mutually exclusive with `children`. */
  items?: SettingRowProps['item'][];
  /** Arbitrary section content, for rows that are not `SettingRow`s. */
  children?: ReactNode;
  /**
   * `card` is an inset rounded surface (profile screens); `inset` is full-bleed
   * with hairline rules (app and notification settings). Two treatments because
   * the screens genuinely look different — collapsing them is a visual change.
   */
  variant?: 'card' | 'inset';
}

/** A titled group of settings rows. */
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
        <Text role="label" tone="secondary" style={styles.title}>
          {title}
        </Text>
        {description ? (
          <Text role="caption" tone="tertiary" style={styles.description}>
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
        // The `label` role is the CARD variant's scale; the inset header is
        // one step up and bold, so it overrides here — a kit escape hatch.
        inset: {
          letterSpacing: 0.5,
          fontSize: theme.fonts.size.xsPlus,
          fontWeight: theme.fonts.weight.bold,
        },
      },
    },
  },
  description: {
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
          borderTopWidth: theme.borderWidth.hairline,
          borderBottomWidth: theme.borderWidth.hairline,
          borderColor: theme.colors.border,
        },
      },
    },
  },
}));
