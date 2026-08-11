#!/usr/bin/env bash
#
# On-device check that a comma-typed decimal survives the whole write path.
#
# `parseFloat('4,99')` is 4, so before the parseDecimalInput fix a price typed
# on a Spanish or Italian keypad was silently saved as 4. The unit tests pin the
# parser; this pins the wiring, by driving the real edit screen and then reading
# the stored value back from the API.
#
# The assertion lives here rather than in the spec because `fetch` fails inside
# Detox's jest environment while the identical query succeeds from plain Node.
#
# Prerequisites: API on :4000, Metro on :8081 with a warm bundle, and the app
# installed on the Detox simulator (see the ui-tour notes for the install and
# rebuild steps).
set -euo pipefail

API="${API:-http://localhost:4000/graphql}"
EMAIL="${E2E_EMAIL:-test@souschef.dev}"
PASSWORD="${E2E_PASSWORD:-Test123!}"

gql() { # $1 = json body
  curl -s -X POST "$API" -H 'Content-Type: application/json' \
    ${TOKEN:+-H "Authorization: Bearer $TOKEN"} -d "$1"
}

# The API allows 10 logins per 900s and this script needs a token twice per
# run, so repeated runs exhaust the budget and fail with OPERATION_RATE_LIMITED
# (~9 minutes to recover). Cache the token and reuse it while it is fresh.
TOKEN_CACHE="${TMPDIR:-/tmp}/souschef-e2e-token"
if [ -f "$TOKEN_CACHE" ] && [ "$(( $(date +%s) - $(stat -f %m "$TOKEN_CACHE") ))" -lt 600 ]; then
  TOKEN=$(cat "$TOKEN_CACHE")
  echo "→ reusing cached token"
fi

if [ -z "${TOKEN:-}" ]; then
echo "→ authenticating"
TOKEN=$(gql "{\"query\":\"mutation(\$input: LoginInput!){login(input:\$input){__typename ... on AuthPayload{accessToken}}}\",\"variables\":{\"input\":{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}}}" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print((d.get('data') or {}).get('login',{}).get('accessToken') or '')")
  if [ -z "$TOKEN" ]; then
    echo "✗ login failed — if this says OPERATION_RATE_LIMITED, wait for the window to reset (10 logins / 900s)"
    exit 1
  fi
  printf '%s' "$TOKEN" > "$TOKEN_CACHE"
fi

FIRST_ITEM_QUERY='{"query":"{ shoppingLists(first:1){edges{node{itemsConnection(first:1){edges{node{id itemName priceEstimate{estimated}}}}}}} }"}'

read_item() {
  gql "$FIRST_ITEM_QUERY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
n=d['data']['shoppingLists']['edges'][0]['node']['itemsConnection']['edges'][0]['node']
print(n['id'], n['itemName'], (n.get('priceEstimate') or {}).get('estimated'))
"
}

read -r ITEM_ID ITEM_NAME BEFORE <<<"$(read_item)"
echo "→ target: $ITEM_NAME ($ITEM_ID), stored price before = $BEFORE"

# Rotate the value so it always differs from what is stored. A run that typed
# the value already saved would pass without the app doing anything — the
# vacuous-pass trap this exercise kept falling into.
if [ "$BEFORE" = "4.99" ]; then
  TYPED="3,77"; EXPECT="3.77"
else
  TYPED="4,99"; EXPECT="4.99"
fi
echo "→ will type '$TYPED' and expect '$EXPECT' stored"

echo "→ driving the edit screen on device (typing $TYPED)"
E2E_ITEM_ID="$ITEM_ID" E2E_ITEM_NAME="$ITEM_NAME" E2E_PRICE="$TYPED" npx detox test -c ios.sim.debug \
  e2e/tests/comma-decimal-price.e2e.ts --loglevel error

read -r _ _ AFTER <<<"$(read_item)"
echo "→ stored price after = $AFTER"

if [ "$AFTER" = "$EXPECT" ]; then
  echo "✓ PASS — $TYPED persisted as $EXPECT (was $BEFORE)"
  exit 0
fi

TRUNCATED="${TYPED%%,*}"
if [ "$AFTER" = "$TRUNCATED" ] || [ "$AFTER" = "$TRUNCATED.0" ]; then
  echo "✗ FAIL — persisted as $AFTER: the comma was truncated (parseFloat behaviour)"
else
  echo "✗ FAIL — persisted as $AFTER, expected $EXPECT"
fi
exit 1
