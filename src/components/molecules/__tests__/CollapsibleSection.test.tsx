'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { CollapsibleSection } from '../CollapsibleSection';
import { Text } from '#components/atoms/Text';

describe('CollapsibleSection', () => {
  const defaultProps = {
    title: 'Section Title',
    expanded: false,
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title', () => {
    render(
      <CollapsibleSection {...defaultProps}>
        <Text>Content</Text>
      </CollapsibleSection>,
    );
    expect(screen.getByText('Section Title')).toBeTruthy();
  });

  it('does not render children when collapsed', () => {
    render(
      <CollapsibleSection {...defaultProps} expanded={false}>
        <Text>Hidden Content</Text>
      </CollapsibleSection>,
    );
    expect(screen.queryByText('Hidden Content')).toBeNull();
  });

  it('renders children when expanded', () => {
    render(
      <CollapsibleSection {...defaultProps} expanded={true}>
        <Text>Visible Content</Text>
      </CollapsibleSection>,
    );
    expect(screen.getByText('Visible Content')).toBeTruthy();
  });

  it('displays count in parentheses when provided', () => {
    render(
      <CollapsibleSection {...defaultProps} count={5}>
        <Text>Content</Text>
      </CollapsibleSection>,
    );
    expect(screen.getByText('Section Title (5)')).toBeTruthy();
  });

  it('does not display count when not provided', () => {
    render(
      <CollapsibleSection {...defaultProps}>
        <Text>Content</Text>
      </CollapsibleSection>,
    );
    expect(screen.getByText('Section Title')).toBeTruthy();
    expect(screen.queryByText(/\(/)).toBeNull();
  });

  it('calls onToggle when header is pressed', async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    render(
      <CollapsibleSection {...defaultProps} onToggle={onToggle}>
        <Text>Content</Text>
      </CollapsibleSection>,
    );
    await user.press(screen.getByText('Section Title'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
