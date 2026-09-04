import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { DetailTemplate } from '../DetailTemplate';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import type { IconName } from '#utils/iconUtils';

jest.mock('#components/organisms/Header', () => {
  const { View, Text: RNText, Pressable } = require('react-native');
  return {
    Header: ({
      title,
      onBack,
      rightActions,
    }: {
      title?: string;
      onBack?: () => void;
      rightActions?: HeaderAction[];
    }) => (
      <View testID="header">
        <Pressable onPress={onBack} testID="header-back">
          <RNText>Back</RNText>
        </Pressable>
        {title ? <RNText>{title}</RNText> : null}
        {rightActions?.map((action: HeaderAction, i: number) => (
          <Pressable
            key={i}
            onPress={action.onPress}
            testID={`header-action-${i}`}
          >
            <RNText>{action.icon || 'action'}</RNText>
          </Pressable>
        ))}
      </View>
    ),
  };
});

jest.mock('#components/molecules/Button', () => {
  const { Pressable, Text: RNText } = require('react-native');
  return {
    Button: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress: () => void;
    }) => (
      <Pressable onPress={onPress} testID="primary-action-button">
        <RNText>{children}</RNText>
      </Pressable>
    ),
  };
});

jest.mock('#utils/iconUtils', () => ({
  Icon: 'Icon',
}));

describe('DetailTemplate', () => {
  const defaultProps = {
    title: 'Item Details',
    onBack: jest.fn(),
    sections: [
      { title: 'Info', content: <Text>Item info here</Text> },
      { content: <Text>Section without title</Text> },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with title', () => {
    render(<DetailTemplate {...defaultProps} />);
    expect(screen.getByText('Item Details')).toBeTruthy();
  });

  it('renders section titles', () => {
    render(<DetailTemplate {...defaultProps} />);
    expect(screen.getByText('Info')).toBeTruthy();
  });

  it('renders section content', () => {
    render(<DetailTemplate {...defaultProps} />);
    expect(screen.getByText('Item info here')).toBeTruthy();
    expect(screen.getByText('Section without title')).toBeTruthy();
  });

  it('calls onBack when back is pressed', async () => {
    const user = userEvent.setup();
    render(<DetailTemplate {...defaultProps} />);
    await user.press(screen.getByTestId('header-back'));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('renders primary action button when provided', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(
      <DetailTemplate
        {...defaultProps}
        primaryAction={{ label: 'Save', onPress }}
      />,
    );
    expect(screen.getByText('Save')).toBeTruthy();
    await user.press(screen.getByTestId('primary-action-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not render primary action when not provided', () => {
    render(<DetailTemplate {...defaultProps} />);
    expect(screen.queryByTestId('primary-action-button')).toBeNull();
  });

  it('renders header actions', async () => {
    const user = userEvent.setup();
    const headerAction = {
      icon: 'edit' as IconName,
      accessibilityLabel: 'Edit',
      onPress: jest.fn(),
    };
    render(<DetailTemplate {...defaultProps} headerActions={[headerAction]} />);
    await user.press(screen.getByTestId('header-action-0'));
    expect(headerAction.onPress).toHaveBeenCalledTimes(1);
  });
});
