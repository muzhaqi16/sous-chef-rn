# Session end & transport

How a session ends, how tokens rotate, and how WebSocket close codes are read.
The short rules live in [CLAUDE.md](../CLAUDE.md); this file carries the
mechanisms and the reasoning. The canonical, test-pinned record of the close
codes is `src/apollo/links/wsCloseCodes.ts` +
`src/apollo/links/__tests__/wsCloseCodes.library.test.ts`, which drives the
REAL installed graphql-ws against a fake socket — not this table.

## Session end

**`authService.logout()` is the only sign-out.** There were two paths clearing
different subsets, and the profile button used the weaker one — so the previous
person's notification inbox, scanner history, item-autocomplete LRU and queued
mutations survived a sign-out on a shared device.

`SESSION_SCOPED_STATE` in `src/store/resetManager.ts` is the single list of
what a session end removes. `resetStore` applies it in memory and
`clearAuthFromStorage` deletes the same keys from the persisted blob, so the
two cannot disagree. It spreads the notification and scanner slices' own
`initial*State`, so a field added to either is cleared without anyone
remembering.

`src/store/__tests__/sessionEndLeavesNoData.test.ts` plants a marker in
**every** key of the real `PERSISTED_KEYS` allowlist and requires each survivor
to be named in `KEPT_ON_PURPOSE` with a reason. Adding a persisted key fails
the test until someone classifies it.

**A session end must also STOP things, not just clear them.** Clearing the
tokens leaves the socket dialling, in-flight queries landing and the offline
queue waking — all against credentials the server has already refused, which is
what the user sees as a screen that never loads. `endSession` therefore runs
`runSessionTeardown()` (`src/store/sessionTeardown.ts`) *before* the state
reset.

That registry exists because the steps live in the Apollo layer while
`endSession` lives in the store, and importing both ways closes the cycle
`store → resetManager → apollo/client → links → store`. Each module registers
its own step at module init — `logoutCleanup` the Apollo teardown,
`queueManager` the drain cancel — the same hand-off `registerApolloClient` and
`registerTokenRefresh` use. Three things about it are load-bearing:

- **`completeLogout()` must run after `performLogoutCleanup()`.** That latch
  makes `authLink` and `errorLink` refuse every operation; left set, the next
  sign-in cannot send its login mutation.
- **`queueManager.onLogout()` is deliberately NOT called.** It deletes the
  user's queued writes, and a rejected refresh token is not the user choosing
  to discard unsynced work. Only the pending drain is cancelled; the entries
  wait for that user's next sign-in. `onLogout` stays on the deliberate
  sign-out path.
- **`apiReachabilityBreaker`'s `/health` probe keeps running.** It is
  unauthenticated, and the sign-in screen needs to know whether the API is up.

## Token rotation

**Both transports rotate, and that is safe** — but only because the server
tells a lost race apart from a dead session. Rotation is single-use; when an
HTTP refresh and a WebSocket handshake reach for the same token, the loser is
refused `AUTH_REFRESH_TOKEN_SUPERSEDED`, which means the winner's successor is
valid and the session is alive. `AUTH_REFRESH_TOKEN_INVALID` is the terminal
one. Never collapse the two: signing out on the first ends a session the
server considers perfectly healthy.

**The hazard that remains is re-presenting a token you already know was
spent.** The server forgives a replay for ten seconds and then reads it as
compromise, revoking the whole token lineage — successor included. So the
retry rule is not "retry on superseded", it is **retry only once a different
token is stored** (`retryWithSuccessorToken` in
`src/apollo/links/refreshToken.ts`). An unchanged token means our own response
was the one that went missing and no successor exists anywhere; there is
nothing to recover, so defer rather than spend the lineage looking. That
decision lives in one place, and the socket's 4403 handling routes through it
rather than reconnecting straight into a second rotation attempt — the
reconnect backoff crosses the ten-second window by its fourth attempt.

`connectionParams` sends the refresh token on every connect. The server spends
it only when the access token has actually expired, so an ordinary connect
costs nothing, and the rotated pair comes back in the `connection_ack` payload
— the only delivery there will ever be.

## WebSocket close codes

**graphql-ws owns the reconnect loop. The app owns only the verdict.** The
library re-dials after every retryable close, re-evaluating `connectionParams`
each attempt; `retryWait` in `src/apollo/links/wsLink.ts` supplies the backoff
curve and parks a retry while the device is offline. `shouldRetry` is the
single hook over that loop and answers one question — **is this verdict
terminal** — reading `src/apollo/links/wsCloseCodes.ts`.
`shouldAutoReconnect` is folded into it, because it is now the only thing that
can stop a re-dial.

**Do NOT add a second backoff beside it.** There was one: a timer whose only
action was `wsClient.terminate()`, which is `if (connecting) emit('closed')` —
a no-op once a socket has closed, since graphql-ws clears `connecting` in its
own close handler. It could interrupt a live connection; it could never dial
one, so every path that looked like recovery silently wasn't. (Pacing also
does not belong in `retryWait`: graphql-ws resets `retries` on every ack and
skips `retryWait` for close 1000 — pacing lives in `url()`, which every dial
passes through. Asserted by the "server that accepts then immediately closes"
cases in the library test.)

| Code                      | Meaning                                                            | Response                                                         |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 4403                      | Token is stale — expired, or superseded by a rotation we lost      | **Never terminal.** Retry; one HTTP refresh as a fast path       |
| 4410                      | Subscription lifetime cap                                          | Retry with the counter reset, so the next wait is the base delay |
| 4411                      | Build below the server minimum                                     | Stop; prompt to update                                           |
| 4412                      | Session unrecoverable — at the handshake **or** revoked mid-stream | Stop **and** `endSession`                                        |
| 4429 / 4500               | Transient, but the library refuses to retry them regardless        | The subscription layer re-subscribes (see below)                 |
| 4413                      | API key refused                                                    | Stop, but do **not** sign the user out — it is a build fault     |
| 1006 / 1000               | Transient                                                          | Library retry with backoff                                       |
| 4400 / 4401 / 4406 / 4409 | Protocol violation                                                 | Stop; only a code change fixes it                                |
| 4004 / 4005               | graphql-ws's own BadResponse / InternalClientError — never sent by our server | Library-fatal; the subscription layer re-subscribes    |

**`shouldRetry` is not consulted for every code.** `shouldRetryConnectOrThrow`
(graphql-ws `dist/client.js`) rethrows 4400, 4401, 4406, 4409, 4429, 4500 and
its own 4004/4005 before reaching it — and a rethrow errors every active
subscription's sink. Apollo's `useSubscription` has no auto-restart, so those
subscriptions are finished until something re-subscribes.
`useSubscriptionTransportRecovery` is what does, on the line after every
`useSubscription`; `isLibraryFatalCloseCode` records the list, and the library
test pins it to the installed package's actual behaviour.

**Never branch on the close reason.** Each code carries exactly one verdict,
and the same reason string is emitted for several distinct conditions.

**A session end must drop the socket client, not just dispose it.** `dispose()`
latches `disposed` inside graphql-ws with no reset, and a disposed client
connects once and then refuses every retry — silently. `disposeWebSocket()`
(`src/apollo/links/wsLink.ts`) therefore clears the reference so the next
`enableAutoReconnect()` builds a fresh one.

## See also

- [Apollo client patterns § Subscriptions](apollo-client-patterns.md) — the
  hook-level subscription patterns and cache write scoping.
- [Local-first architecture](local-first-architecture.md) — the offline queue
  the teardown deliberately does not delete.
