<?php
/**
 * Private runtime dependency configuration. Invoke through composer scope.
 *
 * @package Blockstudio
 */

declare(strict_types=1);

use Isolated\Symfony\Component\Finder\Finder;

$directories = json_decode( getenv( 'BLOCKSTUDIO_SCOPE_DIRS' ) ?: '[]', true, 512, JSON_THROW_ON_ERROR );
if ( empty( $directories ) ) {
	throw new RuntimeException( 'Run composer scope to resolve the locked runtime dependency graph.' );
}

return array(
	'prefix'                  => 'BlockstudioVendor',
	'finders'                 => array(
		Finder::create()->files()->in( $directories )
			->exclude( array( 'tests', 'test', 'Tests', '.github', 'docs', 'doc', 'bench', 'tools', 'bin' ) )
			->notName( array( 'CLAUDE.md', 'AGENTS.md', 'phpunit*', 'phpstan*', 'phpcs*', '*.dist' ) ),
	),
	'expose-global-classes'   => false,
	'expose-global-functions' => false,
	'expose-global-constants' => false,
	'exclude-classes'         => array( '/^WP_/', 'Plugin_Upgrader_Skin', 'Theme_Upgrader_Skin', 'Debug_Bar_Panel' ),
	'exclude-functions'       => array( '/^wp_/' ),
	'patchers'                => array(
		static function ( string $file, string $prefix, string $content ): string {
			if ( 'load-v5p6.php' === basename( $file ) ) {
				// These are factory lookup keys, not PHP class names.
				foreach ( array( 'Plugin\\UpdateChecker', 'Theme\\UpdateChecker', 'Vcs\\PluginUpdateChecker', 'Vcs\\ThemeUpdateChecker' ) as $key ) {
					$content = str_replace( "'" . $prefix . '\\' . $key . "'", "'" . $key . "'", $content );
				}
			}
			return $content;
		},
	),
);
