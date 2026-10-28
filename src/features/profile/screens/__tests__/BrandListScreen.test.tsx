import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { BrandListView } from '#features/profile/hooks/useBrandLists';
import { BrandListScreen } from '../BrandListScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#components/templates/SubScreen', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    SubScreen: ({
      children,
      title,
      actions = [],
    }: {
      children?: React.ReactNode;
      title?: string;
      actions?: { accessibilityLabel: string; onPress: () => void }[];
    }) => (
      <View>
        <Text>{title}</Text>
        {actions.map(action => (
          <Pressable
            key={action.accessibilityLabel}
            accessibilityLabel={action.accessibilityLabel}
            onPress={action.onPress}
          >
            <Text>{action.accessibilityLabel}</Text>
          </Pressable>
        ))}
        {children}
      </View>
    ),
  };
});
// The sheets' own forms have their tests; here, what the screen does with them.
jest.mock('#features/profile/components/AddBrandSheet', () => {
  const { Pressable, Text } = require('react-native');
  return {
    AddBrandSheet: ({
      visible,
      onPick,
    }: {
      visible: boolean;
      onPick: (
        brand: { id: string; name: string },
        reason: string | null,
      ) => void;
    }) =>
      visible ? (
        <Pressable
          testID="add-sheet"
          onPress={() => onPick({ id: 'b-chips', name: 'ChipCo' }, 'salty')}
        >
          <Text>add sheet</Text>
        </Pressable>
      ) : null,
  };
});
jest.mock(
  '#components/organisms/TextEditBottomSheet/TextEditBottomSheet',
  () => {
    const { Pressable, Text } = require('react-native');
    return {
      TextEditBottomSheet: ({
        visible,
        onSave,
      }: {
        visible: boolean;
        onSave: (value: string) => void;
      }) =>
        visible ? (
          <Pressable testID="name-sheet" onPress={() => onSave('Never')}>
            <Text>name sheet</Text>
          </Pressable>
        ) : null,
    };
  },
);

const BOYCOTT: BrandListView = {
  id: 'l-boycott',
  name: 'Boycott',
  enabled: true,
  brands: [
    { entryId: 'e-1', brandId: 'b-soda', name: 'SodaCo', reason: 'parent' },
  ],
};
const mockWrites = {
  setEnabled: jest.fn(),
  renameList: jest.fn(),
  deleteList: jest.fn(),
  addBrand: jest.fn(),
  removeBrand: jest.fn(),
};
jest.mock('#features/profile/hooks/useBrandLists', () => ({
  useBrandLists: () => ({ lists: [BOYCOTT], ...mockWrites }),
}));

const route = {
  key: 'BrandList',
  name: 'BrandList',
  params: { listId: 'l-boycott' },
} as const;

describe('BrandListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows each brand with its note, and removes one', () => {
    render(<BrandListScreen route={route} />);

    expect(screen.getByText('SodaCo')).toBeTruthy();
    expect(screen.getByText('parent')).toBeTruthy();
    fireEvent.press(
      screen.getByLabelText(t('a11y.removeNamed', { name: 'SodaCo' })),
    );
    expect(mockWrites.removeBrand).toHaveBeenCalledWith('l-boycott', 'e-1');
  });

  it('adds the brand the sheet picked, with its note', () => {
    render(<BrandListScreen route={route} />);

    fireEvent.press(screen.getByLabelText(t('brandLists.addBrand')));
    fireEvent.press(screen.getByTestId('add-sheet'));

    expect(mockWrites.addBrand).toHaveBeenCalledWith(
      'l-boycott',
      { id: 'b-chips', name: 'ChipCo' },
      'salty',
    );
  });

  it('renames the list', () => {
    render(<BrandListScreen route={route} />);

    fireEvent.press(screen.getByText(t('brandLists.rename')));
    fireEvent.press(screen.getByTestId('name-sheet'));

    expect(mockWrites.renameList).toHaveBeenCalledWith('l-boycott', 'Never');
  });

  it('deletes the list only once the user confirms, and leaves its screen', () => {
    const alert = jest.spyOn(alertService, 'alert').mockImplementation();
    render(<BrandListScreen route={route} />);

    fireEvent.press(screen.getByText(t('brandLists.deleteList')));
    expect(mockWrites.deleteList).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]?.[2] ?? [];
    const destroy = buttons.find(button => button.style === 'destructive');
    destroy?.onPress?.();

    expect(jest.mocked(useAppNavigation)().goBack).toHaveBeenCalled();
    expect(mockWrites.deleteList).toHaveBeenCalledWith('l-boycott');
  });
});
