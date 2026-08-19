# Bundled credentials — what we ship, and why

Decision record, 2026-08-17. Supersedes the "remove the credential from the
bundle" framing of review findings 5.2 and 5.7, which was wrong about what the
problem is.

## The premise that was wrong

The review found two third-party credentials inlined into the release bundle
and concluded they must be removed. That framing treats *presence in the
binary* as the defect.

It isn't, because presence is unavoidable. Every mobile app ships strings anyone
can extract — an APK and an IPA are both zip files. An unattended client cannot
hold a secret, and no amount of obfuscation, string encryption, or certificate
pinning changes that: anything the app decrypts at runtime, an attacker reads at
runtime.

So the useful question is not "can this be extracted" (everything can) but:

> **What does this credential grant to a hostile holder?**

## The two kinds of credential

**Public by design.** Shipped in the binary deliberately, documented as
not-secret by the vendors who issue them: a Sentry DSN, Firebase's
`google-services.json`, an Amplitude or Mixpanel write key, a Datadog RUM client
token, a Stripe `pk_live_` publishable key. Every one of them is **write-only or
identity-only, individually revocable, and rate-limited on the server side**.
Extraction is an annoyance, not a breach.

**Privileged secrets.** Never in a client: server-side API keys, database
credentials, payment secret keys, anything metered and billed to you.

`scripts/check-bundled-secrets.mjs` encodes this split. Every credential-shaped
var in `generate-env.js`'s `KEYS` list must be classified as `PUBLIC_BY_DESIGN`
or `ACCEPTED_FINDINGS`, or the build fails — so the decision about what a leaked
copy grants gets made by a person, in writing, once.

## What we ship, and the reasoning for each

### `API_KEY` — public by design, no action

This is the correct shape and needs no change. It identifies the client to our
own backend and authorizes nothing on its own; the JWT does that, via the schema
auth directives. It is a hashed `ApiKey` row carrying `permissions`,
`rateLimit`, and separate `isActive` / `revokedAt`, so it is throttled and
revocable server-side without an app release. Same shape as a Sentry DSN.

### `SPOONACULAR_API_KEY` — shipping deliberately

**Decision: recipe search stays client-side.** Proxying it through our API would
couple recipe-search availability to API availability, and search continuing to
work while our backend is down is worth more than the exposure.

The trade accepted: the key is metered and billed to us, so a stranger with the
APK can burn quota. Watch for anomalous consumption; that's the signal that this
needs revisiting.

If it is ever revisited, the proxy also buys server-side caching by
`externalId`, which collapses one quota unit *per user per recipe view* into one
*per recipe* across the whole install base. That's a cost argument independent
of security, and probably the stronger one.

### `OTLP_METRICS_AUTH_PASSWORD` / `OTLP_LOGS_AUTH_PASSWORD` — out of scope

**Decision: ship as-is, plan properly later.**

These are the genuine anomaly. Not because they're extractable, but because
they're the wrong *kind* of credential for a client: basic auth to the metrics
and logs stores is an infrastructure credential, not a client token. They grant
direct, unmediated, unthrottled write into the observability backend, and can't
be revoked without an app release. No observability vendor hands you their
ingestion cluster's password — Datadog gives you a client token that hits
*their* chokepoint.

Blast radius is bounded: write access to metrics and logs. No user data, no read
access. Someone could poison dashboards, inject misleading log lines, or inflate
series cardinality until storage costs rise or ingestion starts shedding
legitimate data.

Rotation (done 2026-08-16) is containment, not a fix — the next release inlines
the replacement identically.

**When this is picked up, in cost-to-benefit order:**

1. **Tenant quotas on Mimir and Loki** — ingestion rate, max active series, max
   label names, scoped to the tenant that credential writes into. Infra config,
   no client or API change, and it bounds the cardinality-bomb case. Cheapest by
   a wide margin; check whether it's already configured before doing anything
   else.
2. **Scope the credential to write-only on one tenant**, if it isn't already.
3. **Route through our own API** — an OTLP/HTTP passthrough at, say,
   `POST /v1/telemetry/{metrics,logs}`, gated by the existing `apiKeyAuth`
   middleware, with the store's credential held server-side. This converts an
   infrastructure credential into a client token: `rateLimit` applies, and
   revocation stops abuse without an app release.

   Notes for whoever builds it: the client already emits well-formed OTLP/JSON
   and appends `/v1/metrics` and `/v1/logs` to its configured base URL, so this
   is a passthrough, not a new schema. Do **not** require a bearer token —
   telemetry is emitted before sign-in and after sign-out, which are the paths
   most worth measuring. Watch the global `1mb` JSON body limit against log
   bursts, and give these routes their own rate limit, since every install
   writes on a timer.
4. **Play Integrity / App Attest on the ingest route** — only if abuse actually
   happens. Raises the cost from "unzip the APK" to "run a device farm."

Note that (3) does not *eliminate* the abuse, because `API_KEY` is extractable
too. It changes what the extracted credential is worth: throttled, revocable,
validated, and reaching one chokepoint we control instead of three systems
directly. That's blast-radius reduction, not elimination — worth being precise
about, since the original framing implied otherwise.

## Verification

```bash
node scripts/check-bundled-secrets.mjs --self-test
node scripts/check-bundled-secrets.mjs android/app/build/generated/assets/
```

Wired as a blocking step in `build-android.yml` and `build-ios.yml`. It fails on
an unclassified credential-shaped var, fails when it finds no bundle to scan,
and fails when an accepted finding is **no longer** in the bundle — that last one
so a stale exemption can't outlive the problem it was written for. Accepted
findings print on every release build, so what we're shipping stays visible
rather than quietly normalized.
