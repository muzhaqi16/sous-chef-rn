import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DataStateView } from '../DataStateView';

const empty = {
  icon: 'create-outline',
  title: 'No recipes yet',
  description: 'Recipes you write will show up here',
  action: { label: 'Create recipe', onPress: jest.fn() },
};

describe('DataStateView', () => {
  it('renders nothing when there is data to show', () => {
    const { toJSON } = render(
      <DataStateView state="ready" onRetry={jest.fn()} empty={empty} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the screen’s own empty state when the result was genuinely empty', () => {
    render(<DataStateView state="empty" onRetry={jest.fn()} empty={empty} />);
    expect(screen.getByText('No recipes yet')).toBeTruthy();
    expect(screen.getByText('Create recipe')).toBeTruthy();
  });

  describe('a failure is not an empty result', () => {
    it.each(['error', 'offline'] as const)(
      '%s shows a retry and never the empty copy',
      state => {
        const onRetry = jest.fn();
        render(<DataStateView state={state} onRetry={onRetry} empty={empty} />);

        // The defect: a failed fetch used to render this exact text, plus a
        // button offering to recreate recipes the person already owns.
        expect(screen.queryByText('No recipes yet')).toBeNull();
        expect(screen.queryByText('Create recipe')).toBeNull();

        fireEvent.press(screen.getByText('Try again'));
        expect(onRetry).toHaveBeenCalledTimes(1);
      },
    );

    it('says something different for offline than for a failure', () => {
      // "Check your connection and try again" is wrong advice for someone who
      // already knows they are offline, and "not downloaded yet" is wrong for a
      // server that returned a 500. Both states exist so they can differ.
      const textOf = (state: 'error' | 'offline') => {
        const view = render(
          <DataStateView state={state} onRetry={jest.fn()} empty={empty} />,
        );
        const text = JSON.stringify(view.toJSON());
        view.unmount();
        return text;
      };

      expect(textOf('error')).not.toEqual(textOf('offline'));
    });

    it('shows no internal diagnostics', () => {
      render(<DataStateView state="error" onRetry={jest.fn()} empty={empty} />);
      const rendered = JSON.stringify(screen.toJSON());
      // No operation names, ids, or server text — those go to the logs.
      expect(rendered).not.toMatch(/Query|Mutation|GraphQL|Error:|undefined/);
    });
  });

  it('renders a spinner while loading', () => {
    render(<DataStateView state="loading" onRetry={jest.fn()} empty={empty} />);
    expect(screen.getByTestId('state-loading')).toBeTruthy();
    expect(screen.queryByText('No recipes yet')).toBeNull();
  });

  it('leaves the empty state to the caller when none is given', () => {
    // For screens with a bespoke empty state; the failure states are still ours.
    const { toJSON } = render(
      <DataStateView state="empty" onRetry={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });
});
