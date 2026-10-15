#!/bin/bash

set -euo pipefail

# Ensure script is run from the directory where it resides
cd "$(dirname "$0")"

composer install --no-interaction

composer run-script scope

composer dump-autoload --optimize --no-interaction

echo "Build process completed successfully!"
