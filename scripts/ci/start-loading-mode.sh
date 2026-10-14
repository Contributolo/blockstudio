#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
case "$mode" in
	plugin|mu-plugin|composer-theme|composer-plugin) ;;
	*) echo "Unknown loading mode: ${mode}" >&2; exit 64 ;;
esac

log=$(mktemp)
trap 'rm -f "$log"' EXIT

if npm run "wp-env:implementations:${mode}:start" 2>&1 | tee "$log"; then
	exit 0
else
	status=$?
fi

# wp-env waits for mysql, not tests-mysql. A cold test database can still be initializing.
if ! grep -Fq 'Error establishing a database connection' "$log"; then
	exit "$status"
fi

echo 'Retrying loading-mode setup once after database initialization.' >&2
npm run "wp-env:implementations:${mode}:start"
