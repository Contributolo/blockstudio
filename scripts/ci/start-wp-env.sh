#!/usr/bin/env bash
set -euo pipefail

environment="${1:-main}"
case "$environment" in
	main) command='wp-env:start' ;;
	empty) command='wp-env:empty:start' ;;
	plugin|mu-plugin|composer-theme|composer-plugin) command="wp-env:implementations:${environment}:start" ;;
	*) echo "Unknown wp-env environment: ${environment}" >&2; exit 64 ;;
esac

log=$(mktemp)
trap 'rm -f "$log"' EXIT

if npm run "$command" 2>&1 | tee "$log"; then
	exit 0
else
	status=$?
fi

# wp-env waits for mysql, not tests-mysql. A cold test database can still be initializing.
if ! grep -Fq 'Error establishing a database connection' "$log"; then
	exit "$status"
fi

echo 'Retrying wp-env setup once after database initialization.' >&2
npm run "$command"
