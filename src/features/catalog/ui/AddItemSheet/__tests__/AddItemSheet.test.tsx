import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { t } from '#/i18n';
import {
  AutocompleteItemsDocument,
  SearchItemsSemanticDocument,
} from '#operations/item/item.generated';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { kitTestIDs } from '#components/testIDs';
import { Text } from '#components/atoms/Text';
import { pantrySheetConfig } from '#features/pantry/components/modals/AddToPantrySheet/pantrySheetConfig';
import type {
  BaseSuggestionItem,
  SuggestionsHookResult,
} from '#features/catalog/types';
import type { AddItemSheetConfig } from '../types';
import { AddItemSheet } from '../AddItemSheet';
import { SuggestionDrilldown } from '../SuggestionDrilldown';

let log = operationLog();

const PREFIX = pantrySheetConfig.testIDPrefix;

const CONFIG: AddItemSheetConfig = {
  ...pantrySheetConfig,
  suggestionGroups: [
    {
      key: 'add_again',
      titleKey: 'addItemSheet.sections.addAgain',
      accessor: grouped => grouped.addAgain ?? [],
      priority: 2,
    },
    {
      key: 'low_stock',
      titleKey: 'addItemSheet.sections.lowStock',
      accessor: grouped => grouped.lowStock ?? [],
      priority: 1,
      dismissible: true,
    },
  ],
};

const item = (name: string): BaseSuggestionItem => ({
  id: `s-${name}`,
  itemId: `item-${name}`,
  name,
  category: 'Dairy',
});

const suggestionsOf = (
  over: Partial<SuggestionsHookResult> = {},
): SuggestionsHookResult => ({
  grouped: {},
  state: 'empty',
  refetch: jest.fn(),
  ...over,
});

type Found = NonNullable<
  MockDataFor<typeof AutocompleteItemsDocument>['autocompleteItems']
>;

const found = (...names: string[]): Found => ({
  __typename: 'AutocompleteResult',
  suggestions: names.map(name => ({
    __typename: 'ItemSuggestion',
    id: `found-${name}`,
    name,
    brands: [],
  })),
});

const props = {
  visible: true,
  contextId: 'pantry-1',
  onClose: jest.fn(),
  onQuickAddSearchSuggestion: jest.fn(),
  onQuickAddSuggestion: jest.fn(),
  onDismissSuggestion: jest.fn(),
  onAddManually: jest.fn(),
};

async function openSheet(
  over: Partial<React.ComponentProps<typeof AddItemSheet>> = {},
  answers: ReturnType<typeof recordMock>[] = [],
) {
  renderWithApollo(
    <AddItemSheet
      {...props}
      config={CONFIG}
      suggestions={suggestionsOf()}
      {...over}
    />,
    {
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        recordMock(SearchItemsSemanticDocument, { held: true }).mock,
      ],
    },
  );
  // The suggestions paint once the sheet's opening has gone idle.
  await act(
    () =>
      new Promise<void>(resolve => {
        requestIdleCallback(() => resolve());
      }),
  );
}

/**
 * Types a search and waits for the answer it asked for. The request is awaited
 * outside `act`: the search bar's debounce fires on a timer, and a held `act`
 * scope keeps back the render that sends it.
 */
async function search(text: string) {
  fireEvent.changeText(
    screen.getByTestId(catalogTestIDs.addItemSheetSearchInput(PREFIX)),
    text,
  );
  await log.requested(AutocompleteItemsDocument);
  await log.landed(AutocompleteItemsDocument);
}

const searching = (...names: string[]) =>
  recordMock(AutocompleteItemsDocument, {
    data: { autocompleteItems: found(...names) },
  });

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({ isOnline: true, apiReachable: true });
});

describe('the add-item sheet', () => {
  it('lists each source by priority, skipping empty ones, a long one capped behind More', async () => {
    await openSheet({
      suggestions: suggestionsOf({
        state: 'ready',
        grouped: {
          lowStock: ['Milk', 'Eggs', 'Butter', 'Cream', 'Yogurt', 'Kefir'].map(
            item,
          ),
          addAgain: [item('Bread')],
          recentlyDeleted: [],
        },
      }),
    });

    const titles = [
      t('addItemSheet.sections.lowStock'),
      t('addItemSheet.sections.addAgain'),
    ];
    const order = screen
      .getAllByText(new RegExp(titles.join('|')))
      .map(node => node.props.children);
    expect(order).toEqual(titles);
    expect(screen.queryByText('Kefir')).not.toBeOnTheScreen();

    await userEvent
      .setup()
      .press(
        screen.getByLabelText(
          `${t('labels.more')} ${t('addItemSheet.sections.lowStock')}`,
        ),
      );
    // The stand-in's sheet list paints no rows, so the list it is handed tells.
    expect(
      screen
        .UNSAFE_getByType(SuggestionDrilldown)
        .props.items.map((each: BaseSuggestionItem) => each.name),
    ).toContain('Kefir');
  });

  it('shows no heading for a source with nothing in it', async () => {
    await openSheet({
      suggestions: suggestionsOf({
        state: 'ready',
        grouped: { lowStock: [item('Milk')], addAgain: [] },
      }),
    });

    expect(
      screen.queryByText(t('addItemSheet.sections.addAgain')),
    ).not.toBeOnTheScreen();
  });

  it('comes back from a source drilled into', async () => {
    await openSheet({
      suggestions: suggestionsOf({
        state: 'ready',
        grouped: {
          lowStock: ['Milk', 'Eggs', 'Butter', 'Cream', 'Yogurt', 'Kefir'].map(
            item,
          ),
          addAgain: [item('Bread')],
        },
      }),
    });
    const user = userEvent.setup();
    await user.press(
      screen.getByLabelText(
        `${t('labels.more')} ${t('addItemSheet.sections.lowStock')}`,
      ),
    );

    await user.press(screen.getByLabelText(t('labels.back')));

    expect(screen.getByText('Bread')).toBeTruthy();
  });

  it('adds a suggestion pressed, and offers dismiss only where a source may', async () => {
    await openSheet({
      suggestions: suggestionsOf({
        state: 'ready',
        grouped: { lowStock: [item('Milk')], addAgain: [item('Bread')] },
      }),
    });
    const [addBread] = screen.getAllByLabelText(
      t('labels.addNamed', { name: 'Bread' }),
    );
    if (!addBread) throw new Error('no add for Bread');

    await userEvent.setup().press(addBread);

    expect(props.onQuickAddSuggestion).toHaveBeenCalledWith(item('Bread'));
    expect(
      screen.getByLabelText(t('labels.dismissNamed', { name: 'Milk' })),
    ).toBeTruthy();
    expect(
      screen.queryByLabelText(t('labels.dismissNamed', { name: 'Bread' })),
    ).not.toBeOnTheScreen();
  });

  it('says a failed read failed, offering a retry, not that there are none', async () => {
    const suggestions = suggestionsOf({ state: 'error' });
    await openSheet({ suggestions });

    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));

    expect(suggestions.refetch).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText(t(CONFIG.emptyStateMessageKey)),
    ).not.toBeOnTheScreen();
  });

  it('says an offline miss is offline', async () => {
    await openSheet({ suggestions: suggestionsOf({ state: 'offline' }) });

    expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();
  });

  it('says when there is nothing to suggest', async () => {
    await openSheet();

    expect(screen.getByText(t(CONFIG.emptyStateMessageKey))).toBeTruthy();
  });
});

describe('its search', () => {
  it('waits for two letters', async () => {
    const answer = searching('Milk');
    await openSheet({}, [answer]);

    fireEvent.changeText(
      screen.getByTestId(catalogTestIDs.addItemSheetSearchInput(PREFIX)),
      'm',
    );
    await search('mi');

    expect(answer.fired).toHaveLength(1);
    expect(
      screen.getByLabelText(t('a11y.quickAdd', { name: 'Milk' })),
    ).toBeTruthy();
  });

  it('adds a result picked, and clears for the next', async () => {
    await openSheet({}, [searching('Milk')]);
    await search('milk');

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('a11y.quickAdd', { name: 'Milk' })));

    expect(props.onQuickAddSearchSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'found-Milk', name: 'Milk' }),
    );
    expect(
      screen.queryByLabelText(t('a11y.quickAdd', { name: 'Milk' })),
    ).not.toBeOnTheScreen();
  });

  it('hands what was typed to a manual add, and turns to the details', async () => {
    await openSheet(
      { renderDetails: () => <Text role="body">Details step</Text> },
      [searching('Oat drink')],
    );
    await search('oat milk');

    await userEvent
      .setup()
      .press(screen.getByTestId(catalogTestIDs.addManuallyButton(PREFIX)));

    expect(props.onAddManually).toHaveBeenCalledWith('oat milk');
    expect(screen.getByText('Details step')).toBeTruthy();
  });

  it('turns to a report in place', async () => {
    await openSheet({}, [searching('Milk')]);
    await search('milk');

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('reportItem.footer')));

    expect(
      screen.queryByTestId(catalogTestIDs.addItemSheetSearchInput(PREFIX)),
    ).not.toBeOnTheScreen();
  });
});

describe('opened on its details', () => {
  it('readies the owner, and closes on back', async () => {
    let goBack: () => void = () => undefined;
    await openSheet({
      startStep: 'details',
      renderDetails: step => {
        goBack = step.goBack;
        return <Text role="body">Details step</Text>;
      },
    });

    expect(props.onAddManually).toHaveBeenCalledWith('');
    act(() => {
      goBack();
    });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
