#!/usr/bin/env bash
# Test OTLP metrics ingestion to Grafana Cloud
#
# Usage:
#   # Using env vars directly:
#   AUTH_PASSWORD=glc_xxx ./infra/grafana/test-otlp.sh
#
#   # Or source from .env file:
#   source .env && AUTH_PASSWORD=$OTLP_METRICS_AUTH_PASSWORD AUTH_USERNAME=$OTLP_METRICS_AUTH_USERNAME ./infra/grafana/test-otlp.sh
#
# After running, query in Grafana Explore (Prometheus datasource):
#   {__name__="test_otlp_ping_total", service_name="sous-chef-app"}

set -euo pipefail

OTLP_ENDPOINT="${OTLP_ENDPOINT:-https://otlp-gateway-prod-us-east-2.grafana.net/otlp}"
AUTH_USERNAME="${AUTH_USERNAME:-1564351}"
AUTH_PASSWORD="${AUTH_PASSWORD:-}"

if [ -z "$AUTH_PASSWORD" ]; then
  echo "ERROR: AUTH_PASSWORD is required."
  echo ""
  echo "Usage: AUTH_PASSWORD=glc_xxx ./infra/grafana/test-otlp.sh"
  echo ""
  echo "Or source from .env:"
  echo "  source .env && AUTH_PASSWORD=\$OTLP_METRICS_AUTH_PASSWORD ./infra/grafana/test-otlp.sh"
  exit 1
fi

NOW_NS="$(date +%s)000000000"

PAYLOAD=$(cat <<EOF
{
  "resourceMetrics": [{
    "resource": {
      "attributes": [
        {"key": "service.name", "value": {"stringValue": "sous-chef-app"}},
        {"key": "deployment.environment.name", "value": {"stringValue": "test-script"}},
        {"key": "os.type", "value": {"stringValue": "curl"}}
      ]
    },
    "scopeMetrics": [{
      "scope": {"name": "sous-chef-telemetry", "version": "1.0.0"},
      "metrics": [
        {
          "name": "test_otlp_ping_total",
          "sum": {
            "dataPoints": [{
              "asDouble": 1,
              "startTimeUnixNano": "$NOW_NS",
              "timeUnixNano": "$NOW_NS",
              "attributes": [
                {"key": "env", "value": {"stringValue": "test-script"}},
                {"key": "platform", "value": {"stringValue": "curl"}}
              ]
            }],
            "aggregationTemporality": 2,
            "isMonotonic": true
          }
        },
        {
          "name": "test_otlp_gauge",
          "gauge": {
            "dataPoints": [{
              "asDouble": 42,
              "timeUnixNano": "$NOW_NS",
              "attributes": [
                {"key": "env", "value": {"stringValue": "test-script"}},
                {"key": "platform", "value": {"stringValue": "curl"}}
              ]
            }]
          }
        }
      ]
    }]
  }]
}
EOF
)

echo "=== OTLP Metrics Test ==="
echo "Endpoint: ${OTLP_ENDPOINT}/v1/metrics"
echo "Auth user: ${AUTH_USERNAME}"
echo ""

HTTP_CODE=$(curl -s -o /tmp/otlp-response.txt -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -u "${AUTH_USERNAME}:${AUTH_PASSWORD}" \
  "${OTLP_ENDPOINT}/v1/metrics" \
  -d "$PAYLOAD")

RESPONSE=$(cat /tmp/otlp-response.txt)

echo "HTTP status: $HTTP_CODE"
if [ -n "$RESPONSE" ]; then
  echo "Response: $RESPONSE"
fi
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
  echo "SUCCESS! Metrics ingested."
  echo ""
  echo "Query in Grafana Explore (Prometheus datasource):"
  echo '  {__name__="test_otlp_ping_total", service_name="sous-chef-app"}'
  echo '  {__name__="test_otlp_gauge", service_name="sous-chef-app"}'
  echo ""
  echo "Note: It may take 30-60 seconds for metrics to appear."
else
  echo "FAILED. Check:"
  echo "  1. OTLP endpoint URL is correct"
  echo "  2. AUTH_USERNAME is your Prometheus/Mimir instance ID (numeric)"
  echo "  3. AUTH_PASSWORD is a valid Grafana Cloud API token (glc_...)"
fi
