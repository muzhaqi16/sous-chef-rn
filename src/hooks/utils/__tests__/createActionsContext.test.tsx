'use no memo';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from '#components/atoms/Text';
import { Pressable } from '#components/atoms/themedComponents';
import { render, screen, userEvent } from '@testing-library/react-native';
import { createActionsContext } from '../createActionsContext';

/**
 * The factory hands every list in the app its row callbacks, so two properties
 * decide whether a row's affordance is real:
 *
 * - a key whose value is `undefined` must NOT produce a truthy wrapper, because
 *   consumers gate rendering on truthiness (`canEdit && onItemEdit`);
 * - a key that appears after the first render must still get a wrapper.
 */

interface TestActions {
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

describe('createActionsContext', () => {
  it('does not manufacture a truthy wrapper for an undefined handler', () => {
    const { Provider, useActions } = createActionsContext<TestActions>('Test');

    let seen: TestActions | null = null;
    const Consumer = () => {
      seen = useActions();
      return null;
    };

    render(
      <Provider actions={{ onEdit: jest.fn(), onDelete: undefined }}>
        <Consumer />
      </Provider>,
    );

    expect(seen).not.toBeNull();
    expect(seen!.onEdit).toBeInstanceOf(Function);
    // The defect: `Object.keys` includes `onDelete`, so a delegating wrapper is
    // built for it. A consumer's `if (onDelete)` is then always true and the
    // affordance renders, but pressing it calls `undefined?.()` and no-ops.
    expect(seen!.onDelete).toBeUndefined();
  });

  it('exposes a handler supplied only after the first render', async () => {
    const user = userEvent.setup();
    const { Provider, useActions } = createActionsContext<TestActions>('Test2');
    const onDelete = jest.fn();

    const Consumer = () => {
      const actions = useActions();
      return (
        <View>
          {actions.onDelete ? (
            <Pressable testID="delete" onPress={() => actions.onDelete!('1')}>
              <Text>Delete</Text>
            </Pressable>
          ) : (
            <Text>no delete</Text>
          )}
        </View>
      );
    };

    // Mirrors FilteredPantryItems: the cart action is spread in conditionally
    // and its condition depends on permissions that arrive from a query, so it
    // is false on the provider's first render and true later.
    const Host = () => {
      const [allowed, setAllowed] = useState(false);
      return (
        <>
          <Pressable testID="grant" onPress={() => setAllowed(true)}>
            <Text>grant</Text>
          </Pressable>
          <Provider
            actions={{ onEdit: jest.fn(), ...(allowed && { onDelete }) }}
          >
            <Consumer />
          </Provider>
        </>
      );
    };

    render(<Host />);
    expect(screen.getByText('no delete')).toBeTruthy();

    await user.press(screen.getByTestId('grant'));

    expect(screen.queryByText('no delete')).toBeNull();
    expect(screen.getByTestId('delete')).toBeTruthy();

    await user.press(screen.getByTestId('delete'));
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('withdraws a handler that becomes unavailable', () => {
    const { Provider, useActions } = createActionsContext<TestActions>('Test3');

    let seen: TestActions | null = null;
    const Consumer = () => {
      seen = useActions();
      return null;
    };

    const { rerender } = render(
      <Provider actions={{ onEdit: jest.fn(), onDelete: jest.fn() }}>
        <Consumer />
      </Provider>,
    );
    expect(seen!.onDelete).toBeInstanceOf(Function);

    rerender(
      <Provider actions={{ onEdit: jest.fn() }}>
        <Consumer />
      </Provider>,
    );
    expect(seen!.onDelete).toBeUndefined();
  });

  it('keeps a stable identity while the available key set is unchanged', () => {
    const { Provider, useActions } = createActionsContext<TestActions>('Test4');

    const seen: (TestActions | null)[] = [];
    const Consumer = () => {
      seen.push(useActions());
      return null;
    };

    const { rerender } = render(
      <Provider actions={{ onEdit: jest.fn(), onDelete: jest.fn() }}>
        <Consumer />
      </Provider>,
    );
    // New function identities every render — the whole point of the factory is
    // that consumers must not see the context value change because of them.
    rerender(
      <Provider actions={{ onEdit: jest.fn(), onDelete: jest.fn() }}>
        <Consumer />
      </Provider>,
    );

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[seen.length - 1]).toBe(seen[0]);
  });

  it('routes a call to the latest handler, not the one captured first', async () => {
    const user = userEvent.setup();
    const { Provider, useActions } = createActionsContext<TestActions>('Test5');
    const first = jest.fn();
    const second = jest.fn();

    const Consumer = () => {
      const actions = useActions();
      return (
        <Pressable testID="edit" onPress={() => actions.onEdit!('x')}>
          <Text>Edit</Text>
        </Pressable>
      );
    };

    const { rerender } = render(
      <Provider actions={{ onEdit: first }}>
        <Consumer />
      </Provider>,
    );
    rerender(
      <Provider actions={{ onEdit: second }}>
        <Consumer />
      </Provider>,
    );

    await user.press(screen.getByTestId('edit'));
    expect(second).toHaveBeenCalledWith('x');
    expect(first).not.toHaveBeenCalled();
  });
});

describe('the bag holds commands, not derivations', () => {
  interface MaybeDerivation {
    // Written as if it returned something. The factory voids it.
    build?: (id: string) => { left: string[] };
  }

  it('returns nothing from a stabilised wrapper', () => {
    const { Provider, useActions } =
      createActionsContext<MaybeDerivation>('D1');

    let result: unknown = 'unset';
    const Consumer = () => {
      const actions = useActions();
      result = (actions.build as ((id: string) => unknown) | undefined)?.('x');
      return null;
    };

    render(
      <Provider actions={{ build: () => ({ left: ['edit'] }) }}>
        <Consumer />
      </Provider>,
    );

    // A derivation cannot be served from here: the value would come from a ref
    // published after children render, so the row would build itself from the
    // previous render's data. Voiding the return makes that a compile error at
    // the consumer rather than a stale value at runtime — this asserts the
    // runtime half of that contract. Derivations go through
    // `createValueContext`; see `itemSwipeActionsContext`.
    expect(result).toBeUndefined();
  });

  it('still delivers a command to the latest callback after commit', async () => {
    const user = userEvent.setup();
    const { Provider, useActions } = createActionsContext<TestActions>('D2');
    const second = jest.fn();

    const Consumer = () => {
      const actions = useActions();
      return (
        <Pressable testID="go" onPress={() => actions.onEdit!('x')}>
          <Text>Go</Text>
        </Pressable>
      );
    };

    const { rerender } = render(
      <Provider actions={{ onEdit: jest.fn() }}>
        <Consumer />
      </Provider>,
    );
    rerender(
      <Provider actions={{ onEdit: second }}>
        <Consumer />
      </Provider>,
    );

    // A command is invoked from a gesture, long after the commit that changed
    // it — which is why a latest-ref is the right mechanism for commands and
    // the wrong one for anything read while rendering.
    await user.press(screen.getByTestId('go'));
    expect(second).toHaveBeenCalledWith('x');
  });
});
