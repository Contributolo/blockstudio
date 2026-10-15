<?php
/**
 * Translations class.
 *
 * @package Blockstudio
 */

namespace Blockstudio;

/**
 * Loads the translations bundled in the languages folder.
 *
 * Blockstudio is not hosted on WordPress.org, so WordPress cannot download
 * language packs for it. The bundled files are loaded from wherever
 * Blockstudio is installed: plugin, must-use plugin, or Composer package.
 * Translation files in wp-content/languages/plugins take precedence.
 *
 * @since 7.8.0
 */
final class Translations {

	/**
	 * Text domain.
	 *
	 * @var string
	 */
	public const DOMAIN = 'blockstudio';

	/**
	 * Register the loading hooks.
	 *
	 * @return void
	 */
	public static function register(): void {
		add_action( 'init', array( self::class, 'load' ), 0 );
		add_action( 'change_locale', array( self::class, 'load' ) );
	}

	/**
	 * Get the directory of the bundled translation files.
	 *
	 * @return string Absolute path without a trailing slash.
	 */
	public static function path(): string {
		return BLOCKSTUDIO_DIR . '/languages';
	}

	/**
	 * Get the directory WordPress loads a script's translations from.
	 *
	 * @param string $handle Script handle.
	 *
	 * @return string Absolute path without a trailing slash.
	 */
	public static function script_path( string $handle ): string {
		$languages = WP_LANG_DIR . '/plugins';
		$file      = self::DOMAIN . '-' . determine_locale() . '-' . $handle . '.json';

		return file_exists( $languages . '/' . $file ) ? $languages : self::path();
	}

	/**
	 * Load the PHP translations for a locale.
	 *
	 * @param string $locale Locale. Defaults to the current locale.
	 *
	 * @return void
	 */
	public static function load( $locale = '' ): void {
		$locale = is_string( $locale ) && '' !== $locale ? $locale : determine_locale();
		$file   = self::DOMAIN . '-' . $locale . '.mo';

		// For a string in both files, WordPress uses the file loaded first.
		load_textdomain( self::DOMAIN, WP_LANG_DIR . '/plugins/' . $file, $locale );
		load_textdomain( self::DOMAIN, self::path() . '/' . $file, $locale );
	}
}
