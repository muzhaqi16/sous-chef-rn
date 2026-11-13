'use no memo';

import React, { useEffect } from 'react';

import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { makeCache } from '#/apollo/cache';
import { useStore } from '#store';
import { GetHomesDocument } from '#operations/home/home.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  homesWithRole,
  type HomeFixture,
} from '#/test-utils/fixtures/homeFixtures';
import {
  pantryData,
  type PantryFixture,
} from '#/test-utils/fixtures/pantryFixtures';
import {
  TabBarActionsProvider,
  useTabBarSetters,
  useTabBarState,
  type TabBarAddAction,
} from '#/context/TabBarActionsContext';
import { tutorialSession } from '#hooks/ui/tutorialSession';
import { GUIDE_TOURS } from '#domain/guides';
import { Telemetry } from '#services/telemetry';
import { pantryTestIDs } from '#features/pantry/testIDs';
import { t } from '#/i18n';
import { PantryMain } from '../PantryMain';

jest.mock('#hooks/navigation/useAppNavigation');
// Navigation is the boundary: there is no navigator, so the screen counts as
// focused while mounted, on the route the test gives it.
const mockRoute: { params: Record<string, unknown> } = { params: {} };
jest.mock('@react-navigation/native', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (effect: () => undefined | (() => void)) =>
      useMountEffect(effect, [effect]),
    useIsFocused: () => true,
    useRoute: () => mockRoute,
  };
});
// Jest lays nothing out, so a measured target reports a fixed rect.
jest.mock('#hooks/ui/useMeasuredRect', () => {
  const { useEffect: useMountEffect } = jest.requireActual('react');
  return {
    useMeasuredRect: (
      onMeasure?: (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => void,
    ) => {
      useMountEffect(() => {
        onMeasure?.({ x: 16, y: 60, width: 140, height: 28 });
      }, [onMeasure]);
      return { ref: { current: null }, measure: () => undefined };
    },
  };
});

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

/** The tab shows only to a signed-in member. */
const member = {
  id: 'user-1',
  email: 'member@example.com',
  emailVerified: true,
  onBoarded: true,
};

const kitchen: PantryFixture = {
  id: 'p1',
  name: 'Kitchen',
  items: [
    { id: 'i1', itemName: 'Rice' },
    { id: 'i2', itemName: 'Beans' },
  ],
};
const home: HomeFixture = {
  id: 'h1',
  name: 'Smith Home',
  pantries: [{ id: 'p1', name: 'Kitchen' }],
};

/** What the shell's tab bar reads from the screen. */
const shell: { addMenu?: readonly TabBarAddAction[] } = {};

/** Stands where FloatingTabBar does: marks the tab active, places +, reads its menu. */
function TabBar() {
  const { setActiveTab, setAddButtonRect } = useTabBarSetters();
  const { addMenu } = useTabBarState();
  useEffect(() => {
    setActiveTab('Pantry');
    setAddButtonRect({ x: 300, y: 760, width: 56, height: 56 });
  }, [setActiveTab, setAddButtonRect]);
  useEffect(() => {
    shell.addMenu = addMenu;
  });
  return null;
}

const menuAction = (key: string) =>
  shell.addMenu?.find(action => action.key === key);

let log = operationLog();
/** Resolves when the tour shows the step, the signal the spotlight is up. */
const stepViewed = (featureId: string) =>
  new Promise<void>(resolve => {
    jest.mocked(Telemetry.trackEvent).mockImplementation((name, props) => {
      if (name === 'tour_step_viewed' && props?.feature_id === featureId) {
        resolve();
      }
    });
  });

/** The pantry tab as HomeTabs mounts it, over homes the app has already read. */
async function renderPantryTab({
  homes = [home],
  pantry = kitchen,
  role = MembershipRole.Owner,
  morePages = false,
}: {
  homes?: HomeFixture[];
  pantry?: PantryFixture | null;
  role?: MembershipRole;
  morePages?: boolean;
} = {}) {
  // The app fetches the homes before any tab mounts (`useDefaultHome`); the
  // tab reads them cache-only.
  const cache = makeCache();
  seedQuery(cache, {
    query: GetHomesDocument,
    data: homesWithRole(homes, role),
  });
  const answer = pantry ? pantryData(pantry) : null;
  if (answer?.pantry && morePages) {
    answer.pantry.itemsConnection.pageInfo = {
      ...answer.pantry.itemsConnection.pageInfo,
      hasNextPage: true,
      endCursor: 'page-1',
    };
  }
  const pantryRead = answer
    ? recordMock(GetPantryDocument, { data: answer, maxUsageCount: 10 })
    : null;
  renderWithApollo(
    <TabBarActionsProvider>
      <TabBar />
      <PantryMain />
    </TabBarActionsProvider>,
    {
      cache,
      links: [log.link],
      operationMocks: pantryRead ? [pantryRead.mock] : [],
    },
  );
  if (pantry) await log.landed(GetPantryDocument);
  return { pantryReads: pantryRead?.fired ?? [] };
}

/** The pantry reads that asked for a further page. */
const pageRequests = (reads: Array<Record<string, unknown>>) =>
  reads.filter(variables => variables.itemsCursor !== undefined);

const reachListEnd = () =>
  fireEvent(screen.getByTestId(pantryTestIDs.list), 'endReached');

/** The swipe actions a row offers, by the name assistive tech reads them by. */
function rowActions(itemName: string) {
  const label = screen.getByText(itemName);
  let node: typeof label | null = label;
  while (node && !node.props.accessibilityActions) node = node.parent;
  return (node?.props.accessibilityActions ?? []).map(
    (action: { name: string }) => action.name,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute.params = {};
  shell.addMenu = undefined;
  log = operationLog();
  useStore.setState({
    user: member,
    selectedHomeId: 'h1',
    selectedPantryId: 'p1',
    isHomeSelectionReady: true,
    isOnline: true,
    apiReachable: true,
    pendingPantryScrollToTop: false,
  });
  mockNav.navigation.getState.mockReturnValue({
    type: 'tab',
    index: 0,
    routes: [{ name: 'Pantry' }],
  });
});

describe('the + menu', () => {
  it('offers every way to add, in order', async () => {
    await renderPantryTab();

    expect(shell.addMenu?.map(action => action.key)).toEqual([
      'search',
      'barcode',
      'receipt',
      'manual',
    ]);
  });

  it('opens each way to add', async () => {
    await renderPantryTab();

    act(() => menuAction('barcode')?.onPress());
    expect(mockNav.toBarcode).toHaveBeenCalledWith({
      source: 'pantry',
      pantryId: 'p1',
    });

    act(() => menuAction('receipt')?.onPress());
    expect(mockNav.toReceiptScan).toHaveBeenCalled();

    act(() => menuAction('search')?.onPress());
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'add_pantry_item_clicked',
    );
  });

  it('with no home yet, takes the one step that gets one', async () => {
    useStore.setState({ selectedHomeId: null, selectedPantryId: null });
    await renderPantryTab({ homes: [], pantry: null });

    expect(shell.addMenu).toEqual([
      expect.objectContaining({
        key: 'getStarted',
        label: t('labels.getStarted'),
      }),
    ]);
    act(() => shell.addMenu?.[0]?.onPress());
    expect(mockNav.toHomeManagement).toHaveBeenCalled();
  });

  it('with homes but none chosen, asks to choose one', async () => {
    useStore.setState({ selectedHomeId: null, selectedPantryId: null });
    await renderPantryTab({ pantry: null });

    expect(shell.addMenu).toEqual([
      expect.objectContaining({
        key: 'chooseHome',
        label: t('pantryScreen.noHomeSelectedAction'),
      }),
    ]);
  });

  it('with no pantry in the home, offers to make one, under the plain title', async () => {
    useStore.setState({ selectedPantryId: null });
    await renderPantryTab({
      homes: [{ ...home, pantries: [] }],
      pantry: null,
    });

    expect(shell.addMenu).toEqual([
      expect.objectContaining({ key: 'createPantry' }),
    ]);
    act(() => shell.addMenu?.[0]?.onPress());
    expect(mockNav.toPantrySettings).toHaveBeenCalled();
    expect(screen.getByText(t('labels.pantry'))).toBeTruthy();
  });

  it('tells a member who may not add why, naming the home', async () => {
    await renderPantryTab({ role: MembershipRole.Guest });

    const reason = t('moveToPantry.cannotAddBody', { home: 'Smith Home' });
    expect(
      shell.addMenu?.map(action => [action.key, action.disabledReason]),
    ).toEqual([
      ['search', reason],
      ['barcode', reason],
      ['receipt', reason],
      ['manual', reason],
    ]);
  });
});

describe('the list', () => {
  it("shows the pantry's items under its name, and opens one when pressed", async () => {
    await renderPantryTab();

    expect(screen.getByText('Kitchen')).toBeTruthy();
    fireEvent.press(screen.getByText('Rice'));

    expect(mockNav.toPantryItemDetail).toHaveBeenCalledWith({ itemId: 'i1' });
  });

  it('offers the swipe actions only a member who may take them', async () => {
    await renderPantryTab();
    expect(rowActions('Rice')).toEqual(
      expect.arrayContaining(['edit', 'delete']),
    );
  });

  it('offers a guest no edit or delete', async () => {
    await renderPantryTab({ role: MembershipRole.Guest });

    expect(rowActions('Rice')).not.toContain('edit');
    expect(rowActions('Rice')).not.toContain('delete');
  });

  it('offers to add from an empty pantry only to a member who may', async () => {
    await renderPantryTab({ pantry: { ...kitchen, items: [] } });
    expect(screen.getByText(t('labels.addItems'))).toBeTruthy();
  });

  it('offers a guest no add from an empty pantry', async () => {
    await renderPantryTab({
      pantry: { ...kitchen, items: [] },
      role: MembershipRole.Guest,
    });

    expect(screen.queryByText(t('labels.addItems'))).toBeNull();
  });

  it('says no more pages can come offline', async () => {
    useStore.setState({ apiReachable: false });
    await renderPantryTab({ morePages: true });

    expect(screen.getByText(t('errors.offlineNoMorePages'))).toBeTruthy();
  });

  it('pages nothing while a server search shows, and pages again once cleared', async () => {
    // A pantry larger than a page reads again in server order once its size
    // is known, then searches on the server.
    const { pantryReads } = await renderPantryTab({
      pantry: { ...kitchen, totalItems: 500 },
      morePages: true,
    });
    await log.landed(GetPantryDocument, 2);
    const search = screen.getByPlaceholderText(
      t('pantryScreen.searchPlaceholder'),
    );

    fireEvent.changeText(search, 'ri');
    // A term is debounced, so its request is awaited before its answer.
    await log.requested(GetPantryDocument, 3);
    await log.landed(GetPantryDocument, 3);
    expect(pantryReads[2]?.itemsFilter).toMatchObject({ search: 'ri' });

    reachListEnd();
    // A page the end asked for would go before the next term's answer lands.
    fireEvent.changeText(search, 'ric');
    await log.requested(GetPantryDocument, 4);
    await log.landed(GetPantryDocument, 4);
    expect(pageRequests(pantryReads)).toEqual([]);

    fireEvent.changeText(search, '');
    reachListEnd();
    await log.requested(GetPantryDocument, 5);
    expect(pageRequests(pantryReads)).toHaveLength(1);
  });

  it('asks for no further page when the first held none', async () => {
    const { pantryReads } = await renderPantryTab({
      homes: [
        {
          ...home,
          pantries: [
            { id: 'p1', name: 'Kitchen' },
            { id: 'p2', name: 'Garage' },
          ],
        },
      ],
      pantry: { ...kitchen, items: [] },
      morePages: true,
    });

    reachListEnd();
    // Switching pantries reads again; a page the end asked for went first, so
    // it is in the reads by the time that answer lands.
    act(() => {
      useStore.setState({ selectedPantryId: 'p2' });
    });
    await log.landed(GetPantryDocument, 2);

    expect(pageRequests(pantryReads)).toEqual([]);
  });
});

describe('arriving on the tab', () => {
  it('switches to the home a link names', async () => {
    mockRoute.params = { homeId: 'h2' };
    await renderPantryTab();

    expect(useStore.getState().selectedHomeId).toBe('h2');
  });

  it('clears a scroll to the top it was asked for', async () => {
    useStore.setState({ pendingPantryScrollToTop: true });
    await renderPantryTab();

    expect(useStore.getState().pendingPantryScrollToTop).toBe(false);
  });
});

describe('its tours', () => {
  const PANTRY_TOUR = 'pantry_tutorial_settings';

  beforeEach(() => {
    tutorialSession.endGuide(PANTRY_TOUR);
    tutorialSession.endGuide(GUIDE_TOURS.stock);
  });

  it('with one pantry, starts at adding: switching needs a second', async () => {
    tutorialSession.startGuide(PANTRY_TOUR);
    const viewed = stepViewed('pantry_tutorial_add');

    await renderPantryTab();
    // Its step shows through a render, which `act` would hold while awaited.
    await viewed;

    expect(
      screen.getByLabelText(t('pantryScreen.tutorialAddItemsTitle')),
    ).toBeTruthy();
  });

  it('with two pantries, starts at switching between them', async () => {
    tutorialSession.startGuide(PANTRY_TOUR);
    const viewed = stepViewed('pantry_tutorial_settings');

    await renderPantryTab({
      homes: [
        {
          ...home,
          pantries: [
            { id: 'p1', name: 'Kitchen' },
            { id: 'p2', name: 'Garage' },
          ],
        },
      ],
    });
    // Its step shows through a render, which `act` would hold while awaited.
    await viewed;

    expect(screen.getByLabelText(t('labels.pantrySettings'))).toBeTruthy();
  });

  it('offline, says a receipt needs a connection and opens no scanner', async () => {
    useStore.setState({ apiReachable: false });
    tutorialSession.startGuide(GUIDE_TOURS.stock);
    const viewed = stepViewed('stock_guide_receipt');

    await renderPantryTab();
    // Its step shows through a render, which `act` would hold while awaited.
    await viewed;
    expect(screen.getByText(t('pantryScreen.stockGuideOffline'))).toBeTruthy();

    fireEvent.press(screen.getByLabelText(t('labels.scanReceipt')));

    expect(mockNav.toReceiptScan).not.toHaveBeenCalled();
  });
});
