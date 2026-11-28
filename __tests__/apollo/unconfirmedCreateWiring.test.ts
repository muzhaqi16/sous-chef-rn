import * as ts from 'typescript';
import {
  calleeName,
  nodesOf,
  parseSource,
  productionSources,
  propertyName,
} from '#/test-utils/sourceAst';

/**
 * A local-first create that publishes a client-minted id must claim it, and the
 * detail screens keyed on that id must wait for the claim to clear.
 *
 * The create mints the row's permanent cuid and writes it into
 * `Pantry.itemsConnection` BEFORE firing — that is what makes the row appear
 * instantly and survive offline. But it also makes the row tappable, and both
 * pantry detail screens query the server by that id. Until the create lands the
 * server has no such row, so the read can only return `RESOURCE_NOT_FOUND`, and
 * `errorPolicy: 'all'` leaves the query parked in an error state that never
 * retries on its own.
 *
 * That shipped: production logged `GetPantryItem` and `GetPantryItemBatches`
 * failing back-to-back on a freshly created item, and the screen stayed broken
 * until the user navigated away and re-entered. `unconfirmedCreates` is the
 * repo's answer to exactly this and was wired for meal plans only.
 *
 * `PendingWrites.send` claims every id a write mints and releases it however
 * the write ends (`pendingWrites.test.ts`), so a create path holds the claim by
 * sending as a pending write. One that sent otherwise would leave the gate
 * below open, and the detail screen races the server and loses.
 *
 * Derived from the tree rather than a hand-kept list, so another pantry create
 * path cannot ship without the decision being made.
 */

/**
 * Mutations creating a PantryItem with a client-minted id. `MoveShoppingItemToPantry`
 * mints one in `input.pantryItemId`, not `input.id`.
 */
const CREATE_DOCUMENTS = [
  'CreatePantryItemDocument',
  'MoveShoppingItemToPantryDocument',
  // Mints one per stocked line, in `input.lines[].pantryItemId`.
  'CreateReceiptCheckInDocument',
];

/** What a file calls, by the called name: `a.b.f()` and `f()` as `f`. */
const callsIn = (file: string, text?: string): Set<string> =>
  new Set(
    nodesOf(parseSource(file, text))
      .filter(ts.isCallExpression)
      .map(call => {
        const callee = call.expression;
        return ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : '';
      }),
  );

/** The binding a document is sent through: `CreateHomeDocument` → `createHomeWrite`. */
const bindingOf = (document: string) =>
  `${document.charAt(0).toLowerCase()}${document.slice(
    1,
    -'Document'.length,
  )}Write`;

/**
 * Whether the file sends one of `documents` through `useMutation` or
 * `useLocalWrite`: by the document, its binding, or the binding's document.
 */
const sendsDocument = (
  file: string,
  documents: readonly string[],
  text?: string,
): boolean =>
  nodesOf(parseSource(file, text))
    .filter(ts.isCallExpression)
    .some(
      call =>
        ['useMutation', 'useLocalWrite'].includes(calleeName(call) ?? '') &&
        documents.some(document => {
          const sent = call.arguments[0]?.getText();
          const binding = bindingOf(document);
          return (
            sent === document ||
            sent === binding ||
            sent === `${binding}.document`
          );
        }),
    );

/** Whether a subscription's `variables` name a home or a pantry, in any position. */
const subscribesById = (file: string, text?: string): boolean =>
  nodesOf(parseSource(file, text))
    .filter(ts.isCallExpression)
    .filter(call => calleeName(call) === 'useSubscription')
    .some(call => {
      const options = call.arguments[1];
      if (!options || !ts.isObjectLiteralExpression(options)) return false;
      const variables = options.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          propertyName(property.name) === 'variables',
      )?.initializer;
      return (
        !!variables &&
        ts.isObjectLiteralExpression(variables) &&
        variables.properties.some(
          property =>
            (ts.isPropertyAssignment(property) ||
              ts.isShorthandPropertyAssignment(property)) &&
            ['homeId', 'pantryId'].includes(propertyName(property.name) ?? ''),
        )
      );
    });

const sources = productionSources();

/** A pending write, sent directly or through the helpers that send one. */
const PENDING_WRITE_SENDS = [
  'pendingWritesOf',
  'sendLocalWrite',
  'useLocalWrite',
];

/** Writers that publish the client-minted row into a cached connection. */
const OPTIMISTIC_PUBLISHERS = [
  'addToPantryItemsCache',
  'addToPantryItemsConnection',
  'addPantryItemLocally',
  // The shared local writes a door delegates to; the test below proves each
  // publishes through `addPantryItemLocally(`.
  'writeLocalMove',
  'writeLocalIntake',
  // A pending write, whose registered local write the test below checks.
  ...PENDING_WRITE_SENDS,
];

/** The shared writers, and the publisher and reconciler each must call. */
const SHARED_LOCAL_WRITES = [
  // An add, a move and a check-in: the answer's commit lists only the row it kept.
  {
    file: 'src/features/pantry/offline/localWrites.ts',
    publishes: 'showLocalPantryItem',
    reconciles: 'listAnsweredPantryItem',
  },
  {
    file: 'src/entities/shoppingList/localWrites.ts',
    publishes: 'showLocalPantryItem',
    reconciles: 'listAnsweredPantryItem',
  },
  {
    file: 'src/features/receipts/offline/localWrites.ts',
    publishes: 'showLocalPantryItem',
    reconciles: 'listAnsweredPantryItem',
  },
];

/**
 * The risk condition is not "creates a pantry item" — it is "publishes a
 * client-minted id into the cache before the server has the row". A plain
 * awaited create writes nothing until the payload lands, so no phantom id ever
 * becomes tappable and there is no window to gate, so such a path is absent
 * below rather than exempted by name: add an optimistic write there and it
 * joins this list automatically.
 *
 * The hook and the document name are matched across whitespace because
 * prettier splits the call when the options object is long.
 */
const creators = sources
  .filter(file => {
    const calls = callsIn(file);
    return (
      sendsDocument(file, CREATE_DOCUMENTS) &&
      OPTIMISTIC_PUBLISHERS.some(writer => calls.has(writer))
    );
  })
  .sort();

describe('unconfirmed-create wiring (pantry items)', () => {
  it('finds the create paths at all, so the checks below are not vacuous', () => {
    expect(creators).toEqual(
      expect.arrayContaining([
        'src/features/pantry/hooks/usePantryIntake.ts',
        'src/features/receipts/hooks/useReceiptCheckIn.ts',
        'src/features/shoppingList/hooks/useMoveToPantry.ts',
      ]),
    );
  });

  it.each(creators)(
    '%s sends its create as a pending write, which claims the id it mints',
    file => {
      const calls = callsIn(file);
      expect(PENDING_WRITE_SENDS.some(send => calls.has(send))).toBe(true);
    },
  );

  it.each(creators)(
    '%s reconciles a server-resolved id divergence',
    // The connection updaters dedupe BY ID, so a payload whose returned id
    // differs from the minted one leaves the client cuid behind as a second,
    // permanently unresolvable edge — a row that 404s on every tap for the rest
    // of the session.
    //
    // Two valid reconciliations: adopt the server's id, or withdraw the local
    // row and let the answer add the server's. The move path must take the
    // second — its divergence names a row that already exists. A pending write
    // withdraws by lifting its layer.
    file => {
      const calls = callsIn(file);
      const adopts = calls.has('adoptServerEntityId');
      const withdraws = PENDING_WRITE_SENDS.some(send => calls.has(send));

      expect(adopts || withdraws).toBe(true);
    },
  );

  it.each(SHARED_LOCAL_WRITES)(
    '$file publishes and reconciles the row a delegating door writes',
    ({ file, publishes, reconciles }) => {
      const calls = callsIn(file);
      expect(calls.has(publishes)).toBe(true);
      expect(calls.has(reconciles)).toBe(true);
    },
  );

  // The other half of the contract: the screens that read by that id.
  it.each([
    'src/features/pantry/screens/usePantryItemDetailData.ts',
    'src/features/pantry/components/form/usePantryItemFormData.ts',
  ])('%s gates its pantry-item read on the create being acknowledged', file => {
    expect(callsIn(file).has('useIsCreateUnconfirmed')).toBe(true);
    expect(
      nodesOf(parseSource(file)).some(
        node => ts.isIdentifier(node) && node.text === 'isUnconfirmed',
      ),
    ).toBe(true);
  });
});

/**
 * Selecting a new home or pantry opens the event subscriptions keyed on its id.
 * The server refuses a subscription on a row it has not created and completes
 * it, and nothing reopens it: a subscription opened before the create lands
 * leaves that home's or pantry's events dark for the session.
 */
describe('unconfirmed-create wiring (homes and pantries)', () => {
  const homeAndPantryCreators = sources
    .filter(file => {
      const calls = callsIn(file);
      return (
        sendsDocument(file, ['CreateHomeDocument', 'CreatePantryDocument']) &&
        (calls.has('writeLocalHome') ||
          PENDING_WRITE_SENDS.some(send => calls.has(send)))
      );
    })
    .sort();

  /** Every subscription whose variables name a home or a pantry. */
  const idKeyedSubscribers = sources
    .filter(file => subscribesById(file))
    .sort();

  it('reads a home id in any position, and a call only where it is code', () => {
    expect(
      subscribesById(
        'planted.ts',
        `useSubscription(ListEventsDocument, { variables: { userId, homeId } });`,
      ),
    ).toBe(true);
    expect(
      callsIn(
        'planted.ts',
        `// sendLocalWrite(client, write)\nconst x = 1;`,
      ).has('sendLocalWrite'),
    ).toBe(false);
  });

  it('finds the create paths and the subscriptions, so the checks below are not vacuous', () => {
    expect(homeAndPantryCreators).toEqual([
      'src/features/home/hooks/useCreateHome.ts',
      'src/features/pantry/hooks/useCreatePantry.ts',
    ]);
    expect(idKeyedSubscribers).toEqual([
      'src/features/home/hooks/useHomeSubscriptions.ts',
      'src/features/mealPlan/hooks/useMealPlanSubscriptions.ts',
      'src/features/pantry/hooks/usePantrySubscriptions.ts',
    ]);
  });

  it.each(homeAndPantryCreators)(
    '%s sends its create as a pending write, which claims the id it mints',
    file => {
      const calls = callsIn(file);
      expect(PENDING_WRITE_SENDS.some(send => calls.has(send))).toBe(true);
    },
  );

  it.each(idKeyedSubscribers)(
    '%s takes its skip from useEntitySubscriptionSkip',
    file => {
      expect(callsIn(file).has('useEntitySubscriptionSkip')).toBe(true);
    },
  );
});
