/**
 * Pins `isLibraryFatalCloseCode` to what the INSTALLED graphql-ws actually does,
 * rather than to our own copy of its list.
 *
 * `wsCloseCodes.ts` records which closes the library refuses to retry no matter
 * what `shouldRetry` returns — and the whole reason that record exists is that
 * the client cannot see it from the outside. A test asserting
 * `isLibraryFatalCloseCode(4500) === true` only compares our constant to our
 * constant: it would keep passing through a graphql-ws upgrade that moved a code
 * in or out of the fatal set, which is precisely the drift the record is for.
 *
 * So this drives a real `createClient` against a fake socket and observes the
 * outcome. A close the library considers fatal ERRORS the subscription's sink
 * even though `shouldRetry` says retry; a retryable one is re-dialled instead.
 *
 * Same intent as `scripts/probe-compiler-try-forms.mjs`: keep the claim
 * falsifiable against whatever is in node_modules.
 */

// This suite needs the REAL library, not the module mock the other wsLink tests
// rely on.
jest.unmock('graphql-ws');

import { createClient } from 'graphql-ws';
import { isLibraryFatalCloseCode, WS_CLOSE_TERMINATED } from '../wsCloseCodes';

/**
 * A socket that acks the handshake, then closes with `code` as soon as a
 * subscription is sent.
 */
const fakeSocketClosingWith = (code: number) =>
  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = FakeWebSocket.OPEN;
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onclose: ((e: { code: number; reason: string }) => void) | null = null;
    onerror: (() => void) | null = null;

    constructor() {
      setTimeout(() => this.onopen?.(), 0);
    }

    send(raw: string) {
      const msg = JSON.parse(raw) as { type: string };
      if (msg.type === 'connection_init') {
        setTimeout(
          () =>
            this.onmessage?.({
              data: JSON.stringify({ type: 'connection_ack' }),
            }),
          0,
        );
      }
      if (msg.type === 'subscribe') {
        setTimeout(() => {
          this.readyState = FakeWebSocket.CLOSED;
          this.onclose?.({ code, reason: 'probe' });
        }, 0);
      }
    }

    close(closeCode = 1000, closeReason = '') {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.({ code: closeCode, reason: closeReason });
    }
  };

/** Acks the handshake and then holds the socket open. */
class HoldingSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = HoldingSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }

  send(raw: string) {
    if ((JSON.parse(raw) as { type: string }).type === 'connection_init') {
      setTimeout(
        () =>
          this.onmessage?.({
            data: JSON.stringify({ type: 'connection_ack' }),
          }),
        0,
      );
    }
  }

  close(closeCode = 1000, closeReason = '') {
    this.readyState = HoldingSocket.CLOSED;
    this.onclose?.({ code: closeCode, reason: closeReason });
  }
}

/**
 * Subscribe once against a socket that closes with `code`, always answering
 * "retry" when the library bothers to ask.
 *
 * @returns how the subscription ended, and how many connects it took.
 */
const observeClose = (
  code: number,
  overrides: Partial<Parameters<typeof createClient>[0]> = {},
) =>
  new Promise<{ ended: 'error' | 'complete'; connects: number }>(resolve => {
    let connects = 0;

    const client = createClient({
      url: 'ws://localhost:4000/graphql',
      webSocketImpl: fakeSocketClosingWith(code),
      lazy: true,
      retryAttempts: Infinity,
      // A macrotask, not `Promise.resolve()`: a microtask-only wait starves the
      // fake socket's own timers and the retry loop never makes progress.
      retryWait: () => new Promise<void>(r => setTimeout(r, 1)),
      // Unconditionally retryable. Anything that still ends the subscription
      // was refused by the library over our heads.
      shouldRetry: () => true,
      on: {
        connected: () => {
          connects++;
        },
      },
      ...overrides,
    });

    let done = false;
    const settle = (ended: 'error' | 'complete') => {
      if (done) return;
      done = true;
      clearTimeout(window);
      resolve({ ended, connects });
      client.dispose();
    };
    // A retryable close never settles on its own — sample a fixed window and
    // report how many dials it took.
    const window = setTimeout(() => settle('complete'), 1500);

    client.subscribe(
      { query: '{ __typename }' },
      {
        next: () => {},
        error: () => settle('error'),
        complete: () => settle('complete'),
      },
    );
  });

describe('isLibraryFatalCloseCode matches the installed graphql-ws', () => {
  jest.setTimeout(20_000);

  it.each([
    ['internal server error', 4500],
    ['too many initialisation requests', 4429],
    ['malformed frame', 4400],
    ['subscribed before the ack', 4401],
    ['duplicate operation id', 4409],
    ['a response the client rejected', 4004],
    ['an internal client error', 4005],
  ])(
    'refuses to retry %s (%i) even when shouldRetry says yes',
    async (_label, code) => {
      expect(isLibraryFatalCloseCode(code)).toBe(true);

      const { ended, connects } = await observeClose(code);
      // Errored the sink after a single connect: the library never re-dialled.
      expect(ended).toBe('error');
      expect(connects).toBe(1);
    },
  );

  it.each([
    ['a stale access token', 4403],
    ['subscription duration exceeded', 4410],
    ['a normal closure with subscriptions still open', 1000],
  ])('keeps re-dialling after %s (%i)', async (_label, code) => {
    expect(isLibraryFatalCloseCode(code)).toBe(false);

    const { connects } = await observeClose(code);
    // Never errors the sink — the control group that gives the assertions above
    // their meaning.
    expect(connects).toBeGreaterThan(1);
  });

  // `reconnectWebSocket` drops the socket with `terminate()` on every token
  // rotation, and `wsLink` excludes that close from its dial-failure report. The
  // code it closes with is the library's choice, not ours.
  it('terminate() closes with WS_CLOSE_TERMINATED', async () => {
    const closes: number[] = [];
    const client = createClient({
      url: 'ws://localhost:4000/graphql',
      webSocketImpl: HoldingSocket,
      lazy: true,
      retryAttempts: 0,
      on: { closed: e => closes.push((e as { code: number }).code) },
    });

    await new Promise<void>(resolve => {
      client.subscribe(
        { query: '{ __typename }' },
        { next: () => {}, error: () => resolve(), complete: () => resolve() },
      );
      setTimeout(() => client.terminate(), 20);
    });

    expect(closes).toContain(WS_CLOSE_TERMINATED);
  });

  // Why `wsLink` paces dials in `url()` rather than `retryWait`.
  //
  // graphql-ws resets `retries` to 0 on every `connection_ack`, and skips
  // `retryWait` altogether for a close of 1000 (`shouldRetryConnectOrThrow`
  // returns `locks > 0` before `retrying` is set). A server that accepts the
  // handshake and immediately closes therefore gets no backoff at all — which
  // is exactly how this server refuses a subscription over the per-user cap.
  describe('a server that accepts then immediately closes', () => {
    const GATE_MS = 300;

    it('runs retryWait not once, so pacing put there would not apply', async () => {
      let retryWaits = 0;
      await observeClose(1000, {
        retryWait: () => {
          retryWaits++;
          return new Promise<void>(r => setTimeout(r, GATE_MS));
        },
      });

      expect(retryWaits).toBe(0);
    });

    it('is paced by a wait inside url(), which every dial passes through', async () => {
      let urlCalls = 0;

      // Both halves measured in the same run and compared, so the assertion
      // does not depend on how fast this machine happens to be.
      const unpaced = await observeClose(1000);
      const paced = await observeClose(1000, {
        url: async () => {
          urlCalls++;
          await new Promise<void>(r => setTimeout(r, GATE_MS));
          return 'ws://localhost:4000/graphql';
        },
      });

      expect(urlCalls).toBeGreaterThan(0);
      // url() is awaited before every dial, so the flap can only go as fast as
      // the gate lets it — here an order of magnitude slower.
      expect(paced.connects * 10).toBeLessThan(unpaced.connects);
    });
  });
});
