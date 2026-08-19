#!/usr/bin/env node
/**
 * Verify echo suppression against a LIVE API. Needs `localhost:4000` up and the
 * dev test account seeded; it is not part of `npm test`.
 *
 * A "device" in this contract is just an `x-device-id` header, so proving the
 * two-device case needs no second emulator — and reading `originatorClientId`
 * off the wire is stronger evidence than watching two UIs, because it names the
 * field the client actually branches on.
 *
 *   npm run check:echo
 *       Subscribes as DEVICE_A, writes as DEVICE_B and then as DEVICE_A, and
 *       checks the stamping on two different envelopes.
 *
 *   node scripts/check-subscription-echo.mjs --as-other-device
 *       Fires one write as a foreign device and exits. Run the app on a
 *       simulator signed in as the same account, then run this: the screen
 *       should update. Before `isSelfEcho`, it did not — the client suppressed
 *       on `actorUserId`, which is the same user on both devices.
 *
 * Mutates the test account: renames a shopping list and writes a pantry item's
 * own name back. The rename round-trips, so a clean run leaves no change; a run
 * that dies midway can leave the list with a "·" suffix.
 *
 * The access token is cached in the OS temp dir, because `login` is rate
 * limited to 10 requests per 15 minutes — and `--as-other-device` is meant to
 * be run over and over while you watch a screen.
 */
import { createClient } from 'graphql-ws';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HTTP = process.env.E2E_HTTP_URL || 'http://localhost:4000/graphql';
const WS = process.env.E2E_WS_URL || 'ws://localhost:4000/graphql';
const EMAIL = process.env.E2E_EMAIL || 'test@souschef.dev';
const PASSWORD = process.env.E2E_PASSWORD || 'Test123!';

// Fixed so a failure names which side wrote. Real ids are `device_` + uuid v4;
// the server treats anything over 128 chars as absent.
const DEVICE_A = 'device_echo-check-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const DEVICE_B = 'device_echo-check-bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

const WRITE_ONLY = process.argv.includes('--as-other-device');
const CACHE = join(tmpdir(), `souschef-echo-check-${EMAIL}.json`);

const results = [];
const record = (name, pass, detail) => {
  results.push({ pass });
  console.log(
    `  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}` +
      (detail ? ` — ${detail}` : ''),
  );
};

const die = message => {
  console.error(`\n${message}`);
  process.exit(1);
};

async function gql(query, variables, deviceId, token) {
  let response;
  try {
    response = await fetch(HTTP, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(deviceId ? { 'x-device-id': deviceId } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (cause) {
    die(
      `The API at ${HTTP} is not reachable (${cause}).\n` +
        `Start it, then re-check with:\n` +
        `  curl -sS -X POST ${HTTP} -H 'content-type: application/json' ` +
        `-d '{"query":"{ __typename }"}'`,
    );
  }
  const json = await response.json();
  if (json.errors) {
    die('GraphQL error:\n' + json.errors.map(e => `  ${e.message}`).join('\n'));
  }
  return json.data;
}

/** A cached session, or null when there is none worth reusing. */
function cachedSession() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(CACHE, 'utf8'));
  } catch {
    return null;
  }
  const payload = parsed?.accessToken?.split('.')?.[1];
  if (!payload) return null;
  let exp;
  try {
    exp = JSON.parse(Buffer.from(payload, 'base64url').toString()).exp;
  } catch {
    return null;
  }
  // A minute of headroom, so a long run doesn't expire mid-flight.
  return exp * 1000 > Date.now() + 60_000 ? parsed : null;
}

async function signIn() {
  const cached = cachedSession();
  if (cached) return cached;

  const auth = await gql(
    `mutation EchoCheckLogin($input: LoginInput!) {
       login(input: $input) {
         __typename
         ... on AuthPayload { accessToken user { id email } }
         ... on Error { code message }
       }
     }`,
    { input: { email: EMAIL, password: PASSWORD } },
    DEVICE_A,
  );
  if (auth.login.__typename !== 'AuthPayload') {
    die(`Login failed for ${EMAIL}: ${JSON.stringify(auth.login)}`);
  }
  const session = {
    accessToken: auth.login.accessToken,
    userId: auth.login.user.id,
    email: auth.login.user.email,
  };
  writeFileSync(CACHE, JSON.stringify(session), { mode: 0o600 });
  return session;
}

/** One waiter per stream; `next()` resolves whichever is pending. */
function openStream(client, payload, pick, label) {
  let waiter = null;
  const dispose = client.subscribe(payload, {
    next: ({ data, errors }) => {
      if (errors) {
        die(`${label} refused:\n${JSON.stringify(errors, null, 2)}`);
      }
      const event = pick(data);
      if (waiter) {
        const resolve = waiter;
        waiter = null;
        resolve(event);
      }
    },
    error: error => {
      const detail =
        error instanceof Error
          ? error.message
          : `code=${error?.code ?? '?'} reason=${error?.reason ?? '?'}`;
      die(`${label} socket error: ${detail}`);
    },
    complete: () => {},
  });

  const next = (ms = 8000) =>
    new Promise(resolve => {
      const timer = setTimeout(() => {
        waiter = null;
        resolve(null);
      }, ms);
      waiter = event => {
        clearTimeout(timer);
        resolve(event);
      };
    });

  return { dispose, next };
}

async function main() {
  const session = await signIn();
  const { accessToken: token, userId } = session;
  console.log(`\nSigned in as ${session.email}`);

  const listData = await gql(
    `query EchoCheckLists {
       shoppingLists(first: 1) { edges { node { id name version } } }
     }`,
    {},
    DEVICE_A,
    token,
  );
  const list = listData.shoppingLists?.edges?.[0]?.node;
  if (!list) {
    die('No shopping list on the test account — create one and re-run.');
  }
  const baseName = list.name.replace(/ ·$/, '');

  const renameList = async (name, version, deviceId) => {
    const data = await gql(
      `mutation EchoCheckRename($input: UpdateShoppingListInput!) {
         updateShoppingList(input: $input) {
           __typename
           ... on UpdateShoppingListPayload { shoppingList { id name version } }
           ... on Error { code message }
         }
       }`,
      { input: { id: list.id, name, version } },
      deviceId,
      token,
    );
    if (data.updateShoppingList.__typename !== 'UpdateShoppingListPayload') {
      die(`Mutation rejected: ${JSON.stringify(data.updateShoppingList)}`);
    }
    return data.updateShoppingList.shoppingList.version;
  };

  if (WRITE_ONLY) {
    const renamed = `${baseName} ·`;
    await renameList(renamed, list.version, DEVICE_B);
    console.log(
      `\nWrote as ${DEVICE_B}:\n` +
        `  list "${list.name}" → "${renamed}"\n\n` +
        `A device signed in as this account should now show the new name\n` +
        `without a refresh. Run again to toggle the suffix back.`,
    );
    return 0;
  }

  const pantryData = await gql(
    `query EchoCheckPantry {
       homes(first: 1) {
         edges { node { id
           pantriesConnection(first: 1) { edges { node { id
             itemsConnection(first: 1) { edges { node { id itemName version } } } } } } } }
       }
     }`,
    {},
    DEVICE_A,
    token,
  );
  const pantry =
    pantryData.homes?.edges?.[0]?.node?.pantriesConnection?.edges?.[0]?.node;
  const pantryItem = pantry?.itemsConnection?.edges?.[0]?.node;
  if (!pantryItem) {
    die('No pantry item on the test account — add one and re-run.');
  }

  const wsClient = createClient({
    url: WS,
    webSocketImpl: globalThis.WebSocket,
    connectionParams: { authorization: `Bearer ${token}`, deviceId: DEVICE_A },
    retryAttempts: 2,
  });

  const lists = openStream(
    wsClient,
    {
      query: `subscription EchoCheckListEvents {
        myShoppingListsEvents { subtype listId originatorClientId actorUserId }
      }`,
    },
    d => d.myShoppingListsEvents,
    'MyShoppingListsEvents',
  );

  const pantryEvents = openStream(
    wsClient,
    {
      query: `subscription EchoCheckPantryEvents($pantryId: ID!) {
        pantryEvents(pantryId: $pantryId) {
          subtype pantryId originatorClientId actorUserId
        }
      }`,
      variables: { pantryId: pantry.id },
    },
    d => d.pantryEvents,
    'PantryEvents',
  );

  // graphql-ws must see connection_ack before a subscribe is live.
  await new Promise(resolve => setTimeout(resolve, 1500));

  console.log('\nA write from another device, watched by this one');
  const bumped = await renameList(`${baseName} ·`, list.version, DEVICE_B);
  let event = await lists.next();
  record(
    'the event is delivered',
    Boolean(event),
    event ? `subtype=${event.subtype}` : 'nothing within 8s',
  );
  record(
    'originatorClientId is stamped from the x-device-id header',
    event?.originatorClientId === DEVICE_B,
    `originatorClientId=${event?.originatorClientId ?? 'null'}`,
  );
  record(
    'actorUserId is US, so suppressing on it would drop this event',
    event?.actorUserId === userId,
    `actorUserId=${event?.actorUserId ?? 'null'}`,
  );

  console.log('\nA write from this device (the echo it should drop)');
  await renameList(baseName, bumped, DEVICE_A);
  event = await lists.next();
  record(
    'the event is delivered',
    Boolean(event),
    event ? `subtype=${event.subtype}` : 'nothing within 8s',
  );
  record(
    'originatorClientId matches this device, so isSelfEcho drops it',
    event?.originatorClientId === DEVICE_A,
    `originatorClientId=${event?.originatorClientId ?? 'null'}`,
  );

  console.log(
    '\nThe same, on PantryEvents — a different envelope and resolver',
  );
  await gql(
    `mutation EchoCheckItem($input: UpdatePantryItemInput!) {
       updatePantryItem(input: $input) {
         __typename
         ... on UpdatePantryItemPayload { pantryItem { id version } }
         ... on Error { code message }
       }
     }`,
    {
      input: {
        id: pantryItem.id,
        version: pantryItem.version,
        itemName: pantryItem.itemName,
      },
    },
    DEVICE_B,
    token,
  );
  event = await pantryEvents.next();
  record(
    'the event is delivered',
    Boolean(event),
    event ? `subtype=${event.subtype}` : 'nothing within 8s',
  );
  record(
    'PantryEvent stamps originatorClientId too',
    event?.originatorClientId === DEVICE_B,
    `originatorClientId=${event?.originatorClientId ?? 'null'}`,
  );

  lists.dispose();
  pantryEvents.dispose();
  await wsClient.dispose();

  const failures = results.filter(r => !r.pass).length;
  console.log(
    `\n${results.length - failures}/${results.length} checks passed` +
      (failures ? ' — echo suppression is NOT safe to rely on' : ''),
  );
  return failures ? 1 : 0;
}

main().then(
  code => process.exit(code),
  error => die(error?.stack || String(error)),
);
