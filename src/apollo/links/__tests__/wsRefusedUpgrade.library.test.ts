/**
 * `wsLink`'s `closed` handler reports a dial still at `dialStage === 'dialing'`
 * (`reportDialFailedBeforeOpen`) as one that never opened. That rests on the
 * INSTALLED graphql-ws: a refused HTTP upgrade emits `closed` and never
 * `opened`, and never calls `connectionParams`, so the API key stays on the
 * device; an accepted upgrade emits `opened` and does call it. An unreachable
 * host emits the same events as a refusal, which is why the report carries the
 * close reason and names no cause.
 */

// This suite needs the REAL library, not the module mock the other wsLink tests
// rely on.
jest.unmock('graphql-ws');

import * as crypto from 'node:crypto';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { createClient } from 'graphql-ws';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const listen = (server: http.Server) =>
  new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

const close = (server: http.Server) =>
  new Promise<void>(resolve => {
    server.close(() => {
      resolve();
    });
  });

const urlOf = (server: http.Server) =>
  `ws://127.0.0.1:${(server.address() as AddressInfo).port}/graphql`;

/** Answers 401 without upgrading, as the API does for a bare `GET /graphql`. */
const refusing = http.createServer((_req, res) => {
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: 'API_KEY_MISSING' }));
});

const upgraded = new Set<Duplex>();

/** Completes the upgrade by hand, then never acks. */
const accepting = http.createServer((_req, res) => {
  res.end();
});
accepting.on('upgrade', (req: http.IncomingMessage, socket: Duplex) => {
  upgraded.add(socket);
  const accept = crypto
    .createHash('sha1')
    .update(`${req.headers['sec-websocket-key'] ?? ''}${WS_GUID}`)
    .digest('base64');
  const [protocol = ''] = (req.headers['sec-websocket-protocol'] ?? '').split(
    ',',
  );
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      ...(protocol ? [`Sec-WebSocket-Protocol: ${protocol.trim()}`] : []),
      '',
      '',
    ].join('\r\n'),
  );
  // Ends the dial on the client's first frame, its `connection_init`, so
  // nothing waits on an ack timeout.
  socket.once('data', () => {
    socket.destroy();
  });
});

/** One dial with no retry: the events it emitted, in order. */
const dial = async (url: string) => {
  const events: string[] = [];
  let connectionParamsCalls = 0;
  const client = createClient({
    url,
    webSocketImpl: WebSocket,
    lazy: true,
    retryAttempts: 0,
    connectionParams: () => {
      connectionParamsCalls++;
      return { 'x-api-key': 'test-api-key' };
    },
    on: {
      connecting: () => {
        events.push('connecting');
      },
      opened: () => {
        events.push('opened');
      },
      connected: () => {
        events.push('connected');
      },
      closed: event => {
        events.push(`closed(${(event as { code?: number }).code})`);
      },
      error: () => {
        events.push('error');
      },
    },
  });

  await new Promise<void>(resolve => {
    client.subscribe(
      { query: '{ __typename }' },
      { next: () => {}, error: () => resolve(), complete: () => resolve() },
    );
  });
  await client.dispose();
  return { events, connectionParamsCalls };
};

const isClose = (event: string) => event.startsWith('closed(');

beforeAll(async () => {
  await Promise.all([listen(refusing), listen(accepting)]);
});

afterAll(async () => {
  for (const socket of upgraded) socket.destroy();
  await Promise.all([close(refusing), close(accepting)]);
});

describe('graphql-ws on a dial that never opens', () => {
  it('a refused upgrade closes without opening, and the API key stays on the device', async () => {
    const { events, connectionParamsCalls } = await dial(urlOf(refusing));

    expect(events.some(isClose)).toBe(true);
    expect(events).not.toContain('opened');
    expect(connectionParamsCalls).toBe(0);
  });

  it('an accepted upgrade opens and sends the API key', async () => {
    const { events, connectionParamsCalls } = await dial(urlOf(accepting));

    expect(events).toContain('opened');
    expect(events.some(isClose)).toBe(true);
    expect(connectionParamsCalls).toBe(1);
  });

  it('an unreachable host emits exactly what a refused upgrade does', async () => {
    const vacated = http.createServer();
    await listen(vacated);
    const url = urlOf(vacated);
    await close(vacated);

    const [unreachable, refused] = await Promise.all([
      dial(url),
      dial(urlOf(refusing)),
    ]);

    expect(unreachable.events).not.toContain('opened');
    expect(unreachable.connectionParamsCalls).toBe(0);
    expect(unreachable.events).toEqual(refused.events);
  });
});
