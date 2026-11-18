import http from 'node:http';
import net from 'node:net';

const API = { host: 'localhost', port: 4000 };
// Long enough for the queue's backoff and the reachability probe to come round.
const RULE_MS = 90_000;

/**
 * A proxy a spec runs in front of the dev API, which the app reaches through
 * the `detoxApiUrl` launch argument, so the spec decides what the network does:
 * the API unreachable, an answer lost after the API applied the request, or a
 * request delivered twice. WebSockets pass through untouched.
 */
export interface ApiProxy {
  /** The GraphQL endpoint the app is pointed at. */
  url: string;
  /** Refuses every connection and drops the open ones, as a lost network does. */
  goDown(): Promise<void>;
  comeBack(): Promise<void>;
  /**
   * The next request for `operation` reaches the API, which applies it, and
   * its answer never reaches the app. Resolves once that has happened.
   */
  loseNextAnswer(operation: string): Promise<void>;
  /** The next request for `operation` reaches the API twice; the app gets the second answer. */
  repeatNext(operation: string): Promise<void>;
  close(): Promise<void>;
}

interface Rule {
  operation: string;
  kind: 'lose' | 'repeat';
  done: () => void;
}

/** The operation a request names, from its JSON body or its query string. */
function operationOf(url: string | undefined, body: Buffer): string | null {
  try {
    const parsed: unknown = JSON.parse(body.toString('utf8'));
    if (
      parsed &&
      typeof parsed === 'object' &&
      'operationName' in parsed &&
      typeof parsed.operationName === 'string'
    ) {
      return parsed.operationName;
    }
  } catch {
    // Not JSON: a GET names it in its query string.
  }
  return new URL(url ?? '/', 'http://proxy').searchParams.get('operationName');
}

/** Sends one request to the API and collects its whole answer. */
function forward(
  req: http.IncomingMessage,
  body: Buffer,
): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const upstream = http.request(
      {
        ...API,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: `${API.host}:${API.port}` },
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 502,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    upstream.on('error', reject);
    upstream.end(body);
  });
}

export async function startApiProxy(port = 4100): Promise<ApiProxy> {
  const sockets = new Set<net.Socket>();
  let rules: Rule[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const operation = operationOf(req.url, body);
      void (async () => {
        try {
          let answer = await forward(req, body);
          // A persisted id the API has not seen yet applies nothing; the app
          // sends the document next, which is the request a rule is for.
          const applied = !answer.body.includes('PERSISTED_QUERY_NOT_FOUND');
          const rule = applied
            ? rules.find(r => r.operation === operation)
            : undefined;
          if (rule) rules = rules.filter(r => r !== rule);
          if (rule?.kind === 'repeat') answer = await forward(req, body);
          if (rule?.kind === 'lose') {
            req.socket.destroy();
            rule.done();
            return;
          }
          res.writeHead(answer.status, answer.headers);
          res.end(answer.body);
          rule?.done();
        } catch {
          req.socket.destroy();
        }
      })();
    });
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  // A WebSocket's upgrade goes to the API as it came, and both ends are piped.
  server.on('upgrade', (req, socket, head) => {
    const upstream = net.connect(API.port, API.host, () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      }
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (head.length > 0) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    const end = () => {
      upstream.destroy();
      socket.destroy();
    };
    upstream.on('error', end);
    socket.on('error', end);
    sockets.add(upstream);
    upstream.on('close', () => sockets.delete(upstream));
  });

  const listen = () =>
    new Promise<void>(resolve => {
      // Every interface: the simulator may reach `localhost` over IPv6.
      server.listen(port, () => resolve());
    });
  await listen();

  // A rule no request meets fails the spec by name, not by its own timeout.
  const withRule = (operation: string, kind: Rule['kind']) =>
    new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => {
        rules = rules.filter(r => r.done !== done);
        reject(
          new Error(`No ${operation} reached the API within ${RULE_MS} ms`),
        );
      }, RULE_MS);
      const done = () => {
        clearTimeout(deadline);
        resolve();
      };
      rules.push({ operation, kind, done });
    });

  return {
    url: `http://localhost:${port}/graphql`,
    goDown: () =>
      new Promise<void>(resolve => {
        server.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      }),
    comeBack: listen,
    loseNextAnswer: operation => withRule(operation, 'lose'),
    repeatNext: operation => withRule(operation, 'repeat'),
    close: () =>
      new Promise<void>(resolve => {
        for (const socket of sockets) socket.destroy();
        if (!server.listening) {
          resolve();
          return;
        }
        server.close(() => resolve());
      }),
  };
}
