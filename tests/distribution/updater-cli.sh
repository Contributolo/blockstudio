#!/usr/bin/env bash
set -euo pipefail

wordpress=$(cd "${1:?Pass the WordPress directory}" && pwd -P)
plugin="$wordpress/wp-content/plugins/blockstudio"
probe='if (!defined("BLOCKSTUDIO_VERSION")) { throw new RuntimeException("Blockstudio did not load."); } new \Blockstudio\Github_Updater(); echo "Updater initialized: " . BLOCKSTUDIO_FILE . PHP_EOL;'

for path in "$wordpress" "$wordpress/./" "$wordpress/wp-content/../"; do
  echo "Checking WP-CLI path: $path"
  wp --path="$path" eval "$probe"
done

if [ ! -d "$plugin" ] || [ -L "$plugin" ]; then
  echo "Expected a regular Blockstudio plugin directory: $plugin" >&2
  exit 1
fi

external=$(mktemp -d)
restore_plugin() {
  if [ -L "$plugin" ]; then
    rm "$plugin"
  fi
  if [ -d "$external/blockstudio" ]; then
    mv "$external/blockstudio" "$plugin"
  fi
  rmdir "$external"
}
trap restore_plugin EXIT
mv "$plugin" "$external/blockstudio"
ln -s "$external/blockstudio" "$plugin"

echo "Checking a plugin symlinked from outside WordPress"
wp --path="$wordpress" eval 'if (str_starts_with(BLOCKSTUDIO_FILE, WP_PLUGIN_DIR . "/")) { throw new RuntimeException("The fixture did not exercise an external plugin path."); }'
wp --path="$wordpress" eval "$probe"
wp --path="$wordpress/./" eval "$probe"
