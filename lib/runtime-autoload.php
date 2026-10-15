<?php
/**
 * Private runtime dependencies, independent of the site's Composer packages.
 *
 * @package Blockstudio
 */

spl_autoload_register(
	static function ( string $class ): void {
		if ( ! str_starts_with( $class, 'BlockstudioVendor\\' ) ) {
			return;
		}
		static $classes = null;
		$classes ??= require __DIR__ . '/dependencies/classmap.php';
		if ( isset( $classes[ $class ] ) ) {
			require_once __DIR__ . '/' . $classes[ $class ];
		}
	}
);

require_once __DIR__ . '/dependencies/native-functions.php';

foreach ( require __DIR__ . '/dependencies/files.php' as $blockstudio_dependency_file ) {
	require_once __DIR__ . '/' . $blockstudio_dependency_file;
}
unset( $blockstudio_dependency_file );
