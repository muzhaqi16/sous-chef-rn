import React from 'react';
import { useTranslation } from '#/i18n';
import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import { AnimatedItemSelector } from '#components/organisms/AnimatedItemSelector/AnimatedItemSelector';
import type { SelectorConfig } from '#components/organisms/AnimatedItemSelector/types';
import type { AisleLine } from '#features/shoppingList/hooks/useMoveToAisleModal';

interface Aisle {
  id: StoreDepartment;
  name: string;
}

interface AislePickerSheetProps {
  visible: boolean;
  line: AisleLine | null;
  /** A department, or null to put the line back under its item's. */
  onMove: (department: StoreDepartment | null) => void;
  onClose: () => void;
}

/** Picks the aisle a line is shopped in; found by name, OTHER last. */
export const AislePickerSheet: React.FC<AislePickerSheetProps> = ({
  visible,
  line,
  onMove,
  onClose,
}) => {
  const { t } = useTranslation();
  const aisles: Aisle[] = Object.values(StoreDepartment)
    .map(id => ({
      id,
      name: t(`shoppingListScreens.aisles.department.${id}`),
    }))
    .sort((a, b) => {
      if (a.id === StoreDepartment.Other) return 1;
      if (b.id === StoreDepartment.Other) return -1;
      return a.name.localeCompare(b.name);
    });

  const config: SelectorConfig<Aisle> = {
    title: t('shoppingListScreens.aisles.move'),
    data: aisles,
    selectedId: line?.department,
    onSelect: (_id, aisle) => onMove(aisle.id),
    displayProperty: 'name',
    actions: [],
    headerActions: line?.moved
      ? [
          {
            label: t('settings.resetSection'),
            accessibilityLabel: t(
              'shoppingListScreens.aisles.resetAccessibility',
            ),
            onPress: () => onMove(null),
          },
        ]
      : undefined,
  };

  return (
    <AnimatedItemSelector
      isVisible={visible}
      config={config}
      onClose={onClose}
    />
  );
};
