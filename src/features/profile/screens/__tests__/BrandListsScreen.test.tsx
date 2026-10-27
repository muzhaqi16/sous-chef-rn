import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { profileTestIDs } from '#features/profile/testIDs';
import type { BrandListView } from '#features/profile/hooks/useBrandLists';
import { BrandListsScreen } from '../BrandListsScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#components/templates/SubScreen', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    SubScreen: ({
      children,
      actions = [],
    }: {
      children?: React.ReactNode;
      actions?: { accessibilityLabel: string; onPress: () => void }[];
    }) => (
      <View>
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
// The sheet's own form is the kit's; here, what the screen does with a name.
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
          <Pressable testID="name-sheet" onPress={() => onSave(' Snacks ')}>
            <Text>name sheet</Text>
          </Pressable>
        ) : null,
    };
  },
);

const mockLists: { lists: BrandListView[]; loaded: boolean } = {
  lists: [],
  loaded: true,
};
const mockCreateList = jest.fn();
const mockSetEnabled = jest.fn();
jest.mock('#features/profile/hooks/useBrandLists', () => ({
  useBrandLists: () => ({
    ...mockLists,
    createList: (...args: unknown[]) => mockCreateList(...args),
    setEnabled: (...args: unknown[]) => mockSetEnabled(...args),
  }),
}));

const BOYCOTT: BrandListView = {
  id: 'l-boycott',
  name: 'Boycott',
  enabled: true,
  brands: [
    { entryId: 'e-1', brandId: 'b-1', name: 'SodaCo', reason: null },
    { entryId: 'e-2', brandId: 'b-2', name: 'ChipCo', reason: null },
  ],
};

describe('BrandListsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLists.lists = [];
  });

  it('shows each list with its brand count and its own switch', () => {
    mockLists.lists = [BOYCOTT];
    render(<BrandListsScreen />);

    expect(screen.getByText('Boycott')).toBeTruthy();
    expect(
      screen.getByText(t('brandLists.brandCount', { count: 2 })),
    ).toBeTruthy();
    fireEvent(
      screen.getByTestId(profileTestIDs.brandListSwitch('l-boycott')),
      'valueChange',
      false,
    );
    expect(mockSetEnabled).toHaveBeenCalledWith('l-boycott', false);

    fireEvent.press(screen.getByText('Boycott'));
    expect(jest.mocked(useAppNavigation)().toBrandList).toHaveBeenCalledWith({
      listId: 'l-boycott',
    });
  });

  it('makes a list from the name typed and opens it', async () => {
    mockCreateList.mockResolvedValue('l-new');
    render(<BrandListsScreen />);

    expect(screen.getByText(t('brandLists.emptyTitle'))).toBeTruthy();
    // The header's action and the empty state's both make one.
    const [headerAction] = screen.getAllByLabelText(t('brandLists.newList'));
    fireEvent.press(headerAction!);
    fireEvent.press(screen.getByTestId('name-sheet'));

    expect(mockCreateList).toHaveBeenCalledWith('Snacks');
    await waitFor(() =>
      expect(jest.mocked(useAppNavigation)().toBrandList).toHaveBeenCalledWith({
        listId: 'l-new',
      }),
    );
  });
});
