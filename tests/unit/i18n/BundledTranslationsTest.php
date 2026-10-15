<?php
/**
 * Tests for the translations bundled in the languages folder.
 *
 * @package Blockstudio
 */

use Blockstudio\Admin;
use Blockstudio\Blocks;
use Blockstudio\Translations;
use PHPUnit\Framework\TestCase;

class BundledTranslationsTest extends TestCase {

	private $previous_scripts;
	private $previous_styles;
	private bool $previous_capture;
	private string $locale = 'de_DE';
	private $locale_filter;

	protected function setUp(): void {
		$this->previous_scripts = $GLOBALS['wp_scripts'] ?? null;
		$this->previous_styles  = $GLOBALS['wp_styles'] ?? null;
		$GLOBALS['wp_scripts'] = new WP_Scripts();
		$GLOBALS['wp_styles']  = new WP_Styles();

		$property = new ReflectionProperty( Admin::class, 'capturing_assets' );
		$this->previous_capture = $property->getValue();
		$property->setValue( null, true );

		$this->locale_filter = fn () => $this->locale;
		add_filter( 'pre_determine_locale', $this->locale_filter );
	}

	protected function tearDown(): void {
		remove_filter( 'pre_determine_locale', $this->locale_filter );
		unload_textdomain( Translations::DOMAIN );
		WP_Translation_Controller::get_instance()->set_locale( determine_locale() );
		$GLOBALS['wp_scripts'] = $this->previous_scripts;
		$GLOBALS['wp_styles']  = $this->previous_styles;
		$property = new ReflectionProperty( Admin::class, 'capturing_assets' );
		$property->setValue( null, $this->previous_capture );
		parent::tearDown();
	}

	public function test_php_strings_are_translated(): void {
		Translations::load();
		$this->assertSame( 'Ungültiger Block.', __( 'Invalid block.', 'blockstudio' ) );
	}

	public function test_formal_german_loads_its_own_file(): void {
		$this->locale = 'de_DE_formal';
		Translations::load();
		$this->assertSame(
			'Sie sind leider nicht berechtigt, die Blöcke dieses Beitrags zu lesen.',
			__( 'Sorry, you are not allowed to read blocks of this post.', 'blockstudio' )
		);
	}

	public function test_unknown_locale_keeps_english(): void {
		$this->locale = 'xx_XX';
		Translations::load();
		$this->assertSame( 'Invalid block.', __( 'Invalid block.', 'blockstudio' ) );
	}

	public function test_editor_bundle_loads_bundled_script_translations(): void {
		// Avoid attaching duplicate enqueue hooks to the shared test process.
		$blocks = ( new ReflectionClass( Blocks::class ) )->newInstanceWithoutConstructor();
		$blocks->enqueue_editor_assets();

		$translations = wp_scripts()->print_translations( 'blockstudio-blocks', false );
		$this->assertIsString( $translations );
		$this->assertStringContainsString( '"Zeile hinzufügen"', $translations );
	}

	public function test_every_language_ships_compiled_files(): void {
		$languages = glob( Translations::path() . '/blockstudio-*.po' );
		$this->assertNotEmpty( $languages );

		foreach ( $languages as $po ) {
			$base = substr( $po, 0, -3 );
			$this->assertFileExists( $base . '.mo' );
			$this->assertFileExists( $base . '.l10n.php' );
			foreach ( array( 'blocks', 'admin-page', 'canvas', 'devtools' ) as $handle ) {
				$this->assertFileExists( $base . '-blockstudio-' . $handle . '.json' );
			}
		}
	}

	public function test_site_php_override_wins_and_missing_strings_fall_back_to_the_bundle(): void {
		require_once ABSPATH . WPINC . '/pomo/mo.php';
		$file = tempnam( sys_get_temp_dir(), 'blockstudio-override-' ) . '.mo';
		$mo   = new MO();
		$mo->set_header( 'Language', 'de_DE' );
		$mo->set_header( 'Content-Type', 'text/plain; charset=UTF-8' );
		$mo->add_entry( new Translation_Entry( array( 'singular' => 'Invalid block.', 'translations' => array( 'Site override' ) ) ) );
		$this->assertTrue( $mo->export_to_file( $file ) );
		$override = static fn ( $path, $domain ) => Translations::DOMAIN === $domain && str_starts_with( $path, WP_LANG_DIR . '/plugins/' ) ? $file : $path;
		add_filter( 'load_textdomain_mofile', $override, 10, 2 );
		try {
			Translations::load();
			$this->assertSame( 'Site override', __( 'Invalid block.', 'blockstudio' ) );
			$this->assertSame( 'Du bist leider nicht berechtigt, die Blöcke dieses Beitrags zu lesen.', __( 'Sorry, you are not allowed to read blocks of this post.', 'blockstudio' ) );
		} finally {
			remove_filter( 'load_textdomain_mofile', $override, 10 );
			unlink( $file );
			unlink( substr( $file, 0, -3 ) );
		}
	}

	public function test_site_script_override_path_takes_precedence(): void {
		$handle = 'blockstudio-test-' . uniqid();
		$path   = WP_LANG_DIR . '/plugins';
		$file   = $path . '/blockstudio-de_DE-' . $handle . '.json';
		wp_mkdir_p( $path );
		$this->assertSame( Translations::path(), Translations::script_path( $handle ) );
		file_put_contents( $file, '{}' );
		try {
			$this->assertSame( $path, Translations::script_path( $handle ) );
		} finally {
			unlink( $file );
		}
	}

	public function test_wordpress_locale_switches_and_restores_bundled_translations(): void {
		remove_filter( 'pre_determine_locale', $this->locale_filter );
		$previous = $GLOBALS['wp_locale_switcher'];
		$switcher = new WP_Locale_Switcher();
		$property = new ReflectionProperty( WP_Locale_Switcher::class, 'available_languages' );
		$property->setValue( $switcher, array( 'en_US', 'de_DE', 'de_DE_formal', 'xx_XX' ) );
		$switcher->init();
		$GLOBALS['wp_locale_switcher'] = $switcher;
		try {
			$this->assertTrue( switch_to_locale( 'de_DE' ) );
			$this->assertSame( 'Ungültiger Block.', __( 'Invalid block.', 'blockstudio' ) );
			$this->assertTrue( switch_to_locale( 'de_DE_formal' ) );
			$this->assertSame( 'Sie sind leider nicht berechtigt, die Blöcke dieses Beitrags zu lesen.', __( 'Sorry, you are not allowed to read blocks of this post.', 'blockstudio' ) );
			$this->assertTrue( switch_to_locale( 'xx_XX' ) );
			$this->assertSame( 'Invalid block.', __( 'Invalid block.', 'blockstudio' ) );
			$this->assertSame( 'de_DE_formal', restore_previous_locale() );
			$this->assertSame( 'Ungültiger Block.', __( 'Invalid block.', 'blockstudio' ) );
		} finally {
			restore_current_locale();
			remove_filter( 'locale', array( $switcher, 'filter_locale' ) );
			remove_filter( 'determine_locale', array( $switcher, 'filter_locale' ) );
			$GLOBALS['wp_locale_switcher'] = $previous;
			add_filter( 'pre_determine_locale', $this->locale_filter );
		}
	}
}
