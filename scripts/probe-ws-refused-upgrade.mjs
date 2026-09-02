/**
 * wsLink reports a refused WebSocket handshake by noticing that a dial closed
 * without ever reaching `opened`. Two things have to hold for that to work,
 * and both are graphql-ws behaviour rather than ours:
 *
 *   1. a refused HTTP upgrade emits `closed` and NEVER `opened`, and
 *      `connectionParams` is not called — so the API key never leaves the
 *      device and the server sees a plain unauthenticated request;
 *   2. an accepted upgrade DOES emit `opened`, so a healthy dial is never
 *      mistaken for a failure; and
 *   3. an UNREACHABLE host is indistinguishable from a refused upgrade by the
 *      events alone — which is why wsLink reports "closed before open" and
 *      carries the close reason rather than claiming a refusal.
 *
 * Uses Node's built-in WebSocket and a hand-rolled 101, so the probe pulls in
 * nothing that is not already a direct dependency.
 *
 * Run: node scripts/probe-ws-refused-upgrade.mjs
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { createClient } from 'graphql-ws';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// A probe that hangs reports nothing at all; fail loudly instead.
setTimeout(() => {
  console.error('FAIL — probe did not settle within 15s');
  process.exit(1);
}, 15_000).unref();

const liveSockets = new Set();

/** Complete the upgrade by hand: 101 plus the accept hash and the subprotocol. */
const acceptUpgrade = (req, socket) => {
  liveSockets.add(socket);
  const accept = crypto
    .createHash('sha1')
    .update(req.headers['sec-websocket-key'] + WS_GUID)
    .digest('base64');
  const protocol = (req.headers['sec-websocket-protocol'] ?? '')
    .split(',')[0]
    .trim();
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      (protocol ? `Sec-WebSocket-Protocol: ${protocol}\r\n` : '') +
      '\r\n',
  );
  // Drop it once opened. A raw socket never answers graphql-ws's closing
  // handshake, and the client waits for that reply before emitting `closed`.
  setTimeout(() => socket.destroy(), 300);
};

const makeClient = (url, events, onParams) =>
  createClient({
    url,
    webSocketImpl: globalThis.WebSocket,
    lazy: true,
    retryAttempts: 0,
    connectionAckWaitTimeout: 1500,
    connectionParams: () => {
      onParams();
      return { 'x-api-key': 'probe-key' };
    },
    on: {
      connecting: () => events.push('connecting'),
      opened: () => events.push('opened'),
      connected: () => events.push('connected'),
      closed: e => events.push(`closed(${e?.code})`),
      error: () => events.push('error'),
    },
  });

const dialUrl = async url => {
  const events = [];
  let connectionParamsCalls = 0;
  const client = makeClient(url, events, () => connectionParamsCalls++);
  await new Promise(resolve => {
    client.subscribe(
      { query: '{ __typename }' },
      { next: () => {}, error: () => resolve(), complete: () => resolve() },
    );
  });
  void client.dispose().catch(() => {});
  return { events, connectionParamsCalls };
};

const dial = async server => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const events = [];
  let connectionParamsCalls = 0;

  const client = makeClient(
    `ws://127.0.0.1:${port}/graphql`,
    events,
    () => connectionParamsCalls++,
  );

  await new Promise(resolve => {
    client.subscribe(
      { query: '{ __typename }' },
      { next: () => {}, error: () => resolve(), complete: () => resolve() },
    );
  });
  // An upgraded socket outlives both dispose() and server.close(), each of
  // which waits on a peer that has stopped answering.
  for (const socket of liveSockets) socket.destroy();
  liveSockets.clear();
  void client.dispose().catch(() => {});
  server.closeAllConnections();
  await new Promise(r => server.close(r));
  return { events, connectionParamsCalls };
};

// 1 — refused: answers 401 and never upgrades, as the API does for a
// `GET /graphql` that reaches Express instead of the upgrade handler.
const refusing = http.createServer((req, res) => {
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: 'API_KEY_MISSING' }));
});
const refused = await dial(refusing);

// 2 — accepted: completes the upgrade, then never acks.
const accepting = http.createServer((_req, res) => res.end());
accepting.on('upgrade', acceptUpgrade);
const accepted = await dial(accepting);

// 3 — unreachable: a port with nothing listening. Same events as leg 1.
const unreachablePort = await new Promise(resolve => {
  const probe = http.createServer();
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});
const unreachable = await dialUrl(`ws://127.0.0.1:${unreachablePort}/graphql`);

const checks = [
  ['refused: closed fires', refused.events.some(e => e.startsWith('closed('))],
  ['refused: opened never fires', !refused.events.includes('opened')],
  ['refused: API key stays on device', refused.connectionParamsCalls === 0],
  ['accepted: opened fires', accepted.events.includes('opened')],
  ['accepted: API key is sent', accepted.connectionParamsCalls > 0],
  ['unreachable: opened never fires', !unreachable.events.includes('opened')],
  [
    'unreachable: indistinguishable from a refusal by events alone',
    unreachable.events.join(' ') === refused.events.join(' '),
  ],
];

console.log('refused upgrade:  ', refused.events.join(' → '));
console.log('accepted upgrade: ', accepted.events.join(' → '));
console.log('unreachable host: ', unreachable.events.join(' → '));
console.log();
for (const [label, ok] of checks)
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`);

const failed = checks.filter(([, ok]) => !ok);
console.log(
  failed.length
    ? '\nFAIL — the dial-stage signal does not hold'
    : '\nPASS — "closed without opened" identifies a dial that never opened.\n' +
        '       It does NOT identify WHY: an unreachable host looks the same.',
);
process.exit(failed.length ? 1 : 0);
