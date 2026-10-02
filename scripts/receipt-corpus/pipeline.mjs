/**
 * Runs a corpus `build.mjs` wrote through the server half of the app's
 * pipeline, as the app calls it: `createReceiptParse` + polled `receiptParse`,
 * then `resolveReceiptLines` on the review's lines. Writes one result per
 * receipt to `<corpus>/pipeline/` for the D8 metrics (design.md § D8 of the
 * `receipt-scanning` change); `pipeline-report.mjs` summarises them.
 *
 *   RECEIPT_EVAL_ACCOUNTS='email:password,email:password' \
 *     node --experimental-transform-types scripts/receipt-corpus/pipeline.mjs \
 *     [corpus-dir] [api-url]
 *
 * The transform flag is for the generated schema enums `serverReceipt.ts`
 * imports, which Node's type stripping alone rejects.
 *
 * Each account parses at most RECEIPT_PARSE_DAILY_LIMIT (30) receipts a day, so
 * a corpus over 30 needs a second account.
 */
import { createId } from '@paralleldrive/cuid2';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./resolveAppAliases.mjs', import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const UTILS = join(resolve(HERE, '../..'), 'src/features/receipts/utils');
const corpus =
  process.argv[2] ?? join(tmpdir(), 'sous-chef-receipt-corpus', 'corpus');
const api = process.argv[3] ?? 'http://localhost:4000/graphql';
const outDir = join(corpus, 'pipeline');
mkdirSync(outDir, { recursive: true });

const { fromServerReceipt } = await import(`${UTILS}/serverReceipt.ts`);
const { receiptReviewLines } = await import(`${UTILS}/receiptReviewLines.ts`);
const { receiptTotalsGap } = await import(`${UTILS}/receiptTotalsGap.ts`);

const accounts = (process.env.RECEIPT_EVAL_ACCOUNTS ?? '')
  .split(',')
  .filter(Boolean)
  .map(pair => {
    const at = pair.indexOf(':');
    return { email: pair.slice(0, at), password: pair.slice(at + 1) };
  });
if (accounts.length === 0) {
  throw new Error('Set RECEIPT_EVAL_ACCOUNTS=email:password[,email:password]');
}
const PER_ACCOUNT = 30;
// As the app: the chain and its store number print in the first six rows.
const HEADER_LINES = 6;
const POLL_MS = 2500;
const DEADLINE_MS = 10 * 60_000;

// Worded apart from the deny-list, so a loosened rule still shows here.
const PAYMENT_FIELD =
  /\b(?:AUTH(?:ORI[SZ]ATION)?|APPROVAL|APPR|REF(?:ERENCE)?|SEQ|TRACE|AID|TVR|TSI|IAD|ARQC|MERCHANT\s*ID|TERMINAL\s*ID|ACCOUNT|ACCT|MEMBER)\b\W{0,4}[A-Z]*\d{4,}/i;
const CARD_TAIL =
  /(?:[*Xx#•]{4,}|\b(?:VISA|MC|AMEX|DISCOVER)\s+)\d{4}\b(?![.,]\d)/;

const sleep = ms => new Promise(done => setTimeout(done, ms));

// A dev API restarts on every file change; a request it drops is sent again.
const RETRIES = 10;

const post = async (token, query, variables) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query, variables }),
      });
      if (response.status < 500) return await response.json();
      if (attempt >= RETRIES) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt >= RETRIES) throw error;
    }
    await sleep(3000);
  }
};

const graphql = async (token, query, variables) => {
  const body = await post(token, query, variables);
  if (body.errors?.length) {
    throw new Error(body.errors.map(error => error.message).join('; '));
  }
  return body.data;
};

const LOGIN = `mutation Login($input: LoginInput!) {
  login(input: $input) {
    __typename
    ... on AuthPayload { accessToken }
    ... on Error { code message }
  }
}`;

const CREATE = `mutation CreateReceiptParse($input: CreateReceiptParseInput!) {
  createReceiptParse(input: $input) {
    __typename
    ... on CreateReceiptParsePayload { receiptParse { id status } }
    ... on Error { code message }
  }
}`;

const PARSE = `query ReceiptParse($id: ID!) {
  receiptParse(id: $id) {
    id
    status
    warnings { code }
    receipt {
      merchant { name }
      purchasedOn
      lines { text kind product code quantity unit unitPrice amount appliesTo }
    }
  }
}`;

const RESOLVE = `query ResolveReceiptLines($input: ResolveReceiptLinesInput!) {
  resolveReceiptLines(input: $input) {
    store { id }
    lines {
      clientId
      confidence
      best { method item { id name } }
      candidates { method item { id name } }
    }
  }
}`;

const tokens = [];
for (const account of accounts) {
  const { login } = await graphql(null, LOGIN, { input: account });
  if (!login.accessToken) {
    throw new Error(`${account.email}: ${login.code} ${login.message}`);
  }
  tokens.push(login.accessToken);
}

const files = readdirSync(corpus)
  .filter(name => name.endsWith('.json'))
  .sort();
if (files.length > tokens.length * PER_ACCOUNT) {
  throw new Error(
    `${files.length} receipts need ${Math.ceil(
      files.length / PER_ACCOUNT,
    )} accounts`,
  );
}

const parseOf = async (token, pages) => {
  const id = createId();
  const started = Date.now();
  const { createReceiptParse: created } = await graphql(token, CREATE, {
    input: { id, pages, locale: 'en-US' },
  });
  if (!created.receiptParse) {
    return { status: `REFUSED ${created.code}`, ms: Date.now() - started };
  }
  let parse = created.receiptParse;
  while (parse.status === 'PENDING' && Date.now() - started < DEADLINE_MS) {
    await sleep(POLL_MS);
    parse = (await graphql(token, PARSE, { id })).receiptParse;
  }
  return { ...parse, ms: Date.now() - started };
};

for (const [at, file] of files.entries()) {
  const receipt = JSON.parse(readFileSync(join(corpus, file), 'utf8'));
  const token = tokens[Math.floor(at / PER_ACCOUNT)];
  const pageLines = receipt.pages.flatMap(page => page.split('\n'));
  const leaks = pageLines.filter(
    line => PAYMENT_FIELD.test(line) || CARD_TAIL.test(line),
  );

  const parse = await parseOf(token, receipt.pages);
  const result = {
    id: receipt.id,
    group: receipt.group,
    leaks,
    parse: { status: parse.status, ms: parse.ms },
  };

  if (parse.status === 'PARSED' && parse.receipt) {
    const parsed = fromServerReceipt(parse.receipt);
    const review = receiptReviewLines(parsed);
    const kinds = {};
    for (const line of parse.receipt.lines) {
      kinds[line.kind] = (kinds[line.kind] ?? 0) + 1;
    }
    result.parse.warnings = parse.warnings.map(warning => warning.code);
    result.parse.kinds = kinds;
    result.totalsGap = receiptTotalsGap(parsed);

    const started = Date.now();
    const { resolveReceiptLines: resolved } = await graphql(token, RESOLVE, {
      input: {
        merchantHeader:
          (receipt.pages[0] ?? '')
            .split('\n')
            .slice(0, HEADER_LINES)
            .join('\n') || undefined,
        parsedBy: 'SERVER',
        lines: review.map(line => ({
          clientId: String(line.index),
          text: line.printed,
          ...(line.code ? { code: line.code } : {}),
        })),
      },
    });
    result.resolveMs = Date.now() - started;
    result.store = resolved.store?.id ?? null;
    const byClient = new Map(resolved.lines.map(line => [line.clientId, line]));
    result.items = review.map(line => {
      const match = byClient.get(String(line.index));
      return {
        printed: line.printed,
        ...(line.code ? { code: line.code } : {}),
        price: line.price ?? null,
        confidence: match?.confidence ?? 'NONE',
        best: match?.best
          ? { name: match.best.item.name, method: match.best.method }
          : null,
        candidates: (match?.candidates ?? []).map(
          candidate => candidate.item.name,
        ),
      };
    });
  }

  writeFileSync(join(outDir, file), `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    [
      receipt.id.slice(0, 44).padEnd(44),
      String(parse.status).padEnd(11),
      `items ${String(result.items?.length ?? 0).padStart(2)}`,
      `parse ${Math.round(parse.ms / 1000)}s`,
      leaks.length ? `LEAKS ${leaks.length}` : '',
    ].join('  '),
  );
}
