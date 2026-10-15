#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
composer scope -- --check

rm -rf build/blockstudio
mkdir -p build/blockstudio
git ls-files --cached --others --exclude-standard -z | \
rsync -ar --from0 --files-from=- --exclude='.git/***' --exclude='node_modules/***' --exclude='/tests/***' --exclude='/docs/***' \
  --exclude='/evals/***' --exclude='/src/***' --exclude='/.github/***' --exclude='/_reference/***' \
  --exclude='.env*' --exclude='*.config.*' --exclude='tsconfig*' \
  --exclude='package.json' --exclude='package-lock.json' --exclude='.npmrc' \
  --exclude='.gitignore' --exclude='.gitattributes' --exclude='.prettierrc*' --exclude='eslint*' \
  --exclude='phpcs.xml*' --exclude='scoper.inc.php' --exclude='build.sh' \
  --exclude='CLAUDE.md' --exclude='/.claude/***' --exclude='/build/***' --exclude='/packages/***' \
  --exclude='/prds/***' --exclude='/scripts/***' --exclude='/vendor/***' --exclude='/blockstudio.zip' \
  . build/blockstudio/
for path in node_modules tests docs evals src .github _reference .claude build packages prds scripts; do
  if [ -e "build/blockstudio/$path" ]; then
    echo "Development files leaked into release: $path" >&2
    exit 1
  fi
done
composer install --working-dir=build/blockstudio --no-dev --optimize-autoloader --no-interaction
php tests/distribution/dependencies.php build/blockstudio
rm -f blockstudio.zip
(cd build && zip -qr ../blockstudio.zip blockstudio/)
