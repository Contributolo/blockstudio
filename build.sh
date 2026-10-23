#!/bin/bash

set -euo pipefail

# Resolve Composer paths from the repository, regardless of the caller's directory.
cd "$(dirname "$0")"

composer install --no-interaction

composer run-script scope

composer dump-autoload --optimize --no-interaction

echo "Build process completed successfully!"
