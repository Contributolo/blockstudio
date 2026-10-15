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
			$this->assertFileExists( $base . '-blockstudio-blocks.json' );
			$this->assertFileExists( $base . '-blockstudio-admin-page.json' );
		}
	}
}
